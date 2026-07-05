import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { publishFacebookPost } from '@/lib/content-publish';
import { isContentPublishError, mapContentPublishErrorCode } from '@/lib/content-publish-errors';
import {
  apiSuccess,
  badRequest,
  apiError,
  ErrorCode,
  withErrorHandler,
  handleStructuredAuthError,
} from '@/lib/api-response';

export const dynamic = 'force-dynamic';

type PublishBody = {
  tenant_id?: string;
  image_url?: string;
  caption?: string;
  link?: string;
};

export const POST = withErrorHandler(async (request: NextRequest) => {
  let body: PublishBody = {};
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body.', ErrorCode.INVALID_JSON);
  }

  let tenantId = '';
  try {
    tenantId = await requireAuth(request, body.tenant_id);
  } catch (err) {
    return handleStructuredAuthError(err);
  }

  const imageUrl = String(body.image_url || '').trim();
  const caption = String(body.caption || '').trim();
  const link = String(body.link || '').trim();

  if (!caption && !imageUrl) {
    return badRequest('Provide a caption and/or image_url.', ErrorCode.MISSING_FIELD);
  }

  if (imageUrl) {
    try {
      const result = await publishFacebookPost(tenantId, { imageUrl, caption, link });
      return apiSuccess({
        postId: result.postId,
        permalink: result.permalink,
        demo: result.demo,
      });
    } catch (err) {
      if (isContentPublishError(err)) {
        return apiError(err.message, mapContentPublishErrorCode(err.code), err.status);
      }
      throw err;
    }
  }

  return badRequest('Image URL is required for Facebook photo posts.', ErrorCode.MISSING_FIELD);
});
