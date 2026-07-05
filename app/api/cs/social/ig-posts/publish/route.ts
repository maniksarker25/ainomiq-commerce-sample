import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { publishInstagramPost, validatePublicHttpsImageUrl } from '@/lib/content-publish';
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

  if (!imageUrl || !caption) {
    return badRequest('Missing image_url or caption.', ErrorCode.MISSING_FIELD);
  }

  try {
    validatePublicHttpsImageUrl(imageUrl);
    const result = await publishInstagramPost(tenantId, { imageUrl, caption });
    return apiSuccess({
      mediaId: result.mediaId,
      permalink: result.permalink,
      demo: result.demo,
    });
  } catch (err) {
    if (isContentPublishError(err)) {
      return apiError(err.message, mapContentPublishErrorCode(err.code), err.status);
    }
    throw err;
  }
});
