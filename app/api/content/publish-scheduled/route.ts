import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import type { ScheduledPost } from '@/app/dashboard/content-pipeline/_lib/types';
import {
  loadStudioState,
  parseContentPipelinePublishConfig,
  publishScheduledPost,
  saveStudioState,
  CONTENT_PIPELINE_CONFIG_KEY,
  migrateScheduledPosts,
} from '@/lib/content-studio-schedule';
import { getTenantConfig } from '@/lib/db';
import {
  apiSuccess,
  badRequest,
  apiError,
  ErrorCode,
  withErrorHandler,
  handleStructuredAuthError,
} from '@/lib/api-response';

export const dynamic = 'force-dynamic';

type Body = {
  tenant_id?: string;
  post_id?: string;
};

export const POST = withErrorHandler(async (request: NextRequest) => {
  let body: Body = {};
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

  const postId = String(body.post_id || '').trim();
  if (!postId) {
    return badRequest('Missing post_id.', ErrorCode.MISSING_FIELD);
  }

  const pipelineRaw = await getTenantConfig(tenantId, CONTENT_PIPELINE_CONFIG_KEY);
  const pipelineConfig = parseContentPipelinePublishConfig(pipelineRaw);
  if (!pipelineConfig?.publishing_enabled) {
    return badRequest('Direct publishing is disabled in Studio settings.', ErrorCode.VALIDATION_ERROR);
  }

  const state = await loadStudioState(tenantId);
  if (!state || !Array.isArray(state.scheduledPosts)) {
    return badRequest('No scheduled posts found.', ErrorCode.CONFIG_NOT_FOUND);
  }

  const timeZone = pipelineConfig.publish_timezone;
  const posts = migrateScheduledPosts(state.scheduledPosts as ScheduledPost[], timeZone);
  const index = posts.findIndex((post) => post.id === postId);
  if (index < 0) {
    return badRequest('Scheduled post not found.', ErrorCode.CONFIG_NOT_FOUND);
  }

  const current = posts[index];
  if (current.status !== 'Ready') {
    return badRequest('Only Ready posts can be published.', ErrorCode.VALIDATION_ERROR);
  }

  try {
    posts[index] = await publishScheduledPost(tenantId, current);
    await saveStudioState(tenantId, { ...state, scheduledPosts: posts });
    return apiSuccess({ post: posts[index], published: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Publish failed.';
    posts[index] = {
      ...current,
      status: 'Failed',
      lastError: message,
      attempts: (current.attempts || 0) + 1,
    };
    await saveStudioState(tenantId, { ...state, scheduledPosts: posts });
    return apiSuccess({ post: posts[index], published: false });
  }
});
