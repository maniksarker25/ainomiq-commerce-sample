import type { ScheduledPost } from '@/app/dashboard/content-pipeline/_lib/types';
import { publishToPlannerPlatforms } from '@/lib/content-publish';
import { getTenantConfig, setTenantConfig } from '@/lib/db';
import {
  CONTENT_STUDIO_STATE_KEY,
  DEFAULT_PUBLISH_TIMEZONE,
  hasPublishableImage,
  isPostDue,
  migrateScheduledPosts,
  type ContentPipelinePublishConfig,
} from './content-studio-schedule-utils';

export * from './content-studio-schedule-utils';

const MAX_POSTS_PER_CRON_RUN = 5;

export async function loadStudioState(tenantId: string): Promise<Record<string, unknown> | null> {
  const raw = await getTenantConfig(tenantId, CONTENT_STUDIO_STATE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function saveStudioState(tenantId: string, state: Record<string, unknown>) {
  await setTenantConfig(
    tenantId,
    CONTENT_STUDIO_STATE_KEY,
    JSON.stringify({ ...state, updated_at: new Date().toISOString() }),
  );
}

export async function publishScheduledPost(
  tenantId: string,
  post: ScheduledPost,
): Promise<ScheduledPost> {
  const imageUrl = String(post.draft?.imageUrl || '').trim();
  const caption = String(post.caption || '').trim();
  if (!caption) {
    throw new Error('Caption is required before publishing.');
  }
  if (!hasPublishableImage(post)) {
    throw new Error('A public HTTPS image is required before publishing.');
  }

  const { permalink } = await publishToPlannerPlatforms(tenantId, post.platform, {
    imageUrl,
    caption,
  });

  return {
    ...post,
    status: 'Published',
    publishedAt: new Date().toISOString(),
    permalink: permalink || post.permalink || null,
    lastError: null,
    attempts: (post.attempts || 0) + 1,
  };
}

export type TenantCronStats = {
  due: number;
  published: number;
  failed: number;
  skipped: number;
};

export async function processTenantScheduledPosts(
  tenantId: string,
  pipelineConfig: ContentPipelinePublishConfig,
): Promise<TenantCronStats> {
  const stats: TenantCronStats = { due: 0, published: 0, failed: 0, skipped: 0 };
  if (!pipelineConfig.publishing_enabled || pipelineConfig.publish_platforms.length === 0) {
    return stats;
  }

  const state = await loadStudioState(tenantId);
  if (!state || !Array.isArray(state.scheduledPosts)) return stats;

  const timeZone = pipelineConfig.publish_timezone || DEFAULT_PUBLISH_TIMEZONE;
  const posts = migrateScheduledPosts(state.scheduledPosts as ScheduledPost[], timeZone);
  const now = new Date();
  let changed = false;
  let handled = 0;

  for (let index = 0; index < posts.length && handled < MAX_POSTS_PER_CRON_RUN; index += 1) {
    const post = posts[index];
    if (!isPostDue(post, now)) continue;

    stats.due += 1;
    handled += 1;
    changed = true;

    posts[index] = {
      ...post,
      status: 'Publishing',
      attempts: (post.attempts || 0) + 1,
    };

    try {
      posts[index] = await publishScheduledPost(tenantId, post);
      stats.published += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Publish failed.';
      posts[index] = {
        ...post,
        status: 'Failed',
        lastError: message,
        attempts: (post.attempts || 0) + 1,
      };
      stats.failed += 1;
    }
  }

  if (changed) {
    await saveStudioState(tenantId, { ...state, scheduledPosts: posts });
  }

  return stats;
}
