import type { ScheduledPost } from '@/app/dashboard/content-pipeline/_lib/types';

export const CONTENT_STUDIO_STATE_KEY = 'content_studio_state';
export const CONTENT_PIPELINE_CONFIG_KEY = 'content_pipeline_config';
export const DEFAULT_PUBLISH_TIMEZONE = 'Europe/Amsterdam';

function getTzParts(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

export function computeScheduledAt(
  date: string,
  time: string,
  timeZone = DEFAULT_PUBLISH_TIMEZONE,
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!match) return new Date().toISOString();

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const [hourRaw, minuteRaw] = (time || '10:00').split(':');
  const hour = Number(hourRaw) || 0;
  const minute = Number(minuteRaw) || 0;

  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  for (let i = 0; i < 6; i += 1) {
    const parts = getTzParts(guess, timeZone);
    const targetMs = Date.UTC(year, month - 1, day, hour, minute);
    const actualMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    guess = new Date(guess.getTime() + (targetMs - actualMs));
  }
  return guess.toISOString();
}

export function normalizeScheduledPost(
  post: ScheduledPost,
  timeZone = DEFAULT_PUBLISH_TIMEZONE,
): ScheduledPost {
  const scheduledAt =
    post.scheduledAt ||
    computeScheduledAt(post.date, post.time, timeZone);
  return { ...post, scheduledAt };
}

export function migrateScheduledPosts(
  posts: ScheduledPost[],
  timeZone = DEFAULT_PUBLISH_TIMEZONE,
): ScheduledPost[] {
  return posts.map((post) => normalizeScheduledPost(post, timeZone));
}

export function isPostDue(post: ScheduledPost, now = new Date()): boolean {
  if (post.status !== 'Ready') return false;
  if (!post.scheduledAt) return false;
  return new Date(post.scheduledAt).getTime() <= now.getTime();
}

export function hasPublishableImage(post: ScheduledPost): boolean {
  const value = String(post.draft?.imageUrl || '').trim();
  return Boolean(value) && /^https:\/\//i.test(value);
}

export type ContentPipelinePublishConfig = {
  publishing_enabled: boolean;
  publish_platforms: string[];
  publish_timezone: string;
};

export function parseContentPipelinePublishConfig(raw: string | null): ContentPipelinePublishConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const platforms = Array.isArray(parsed.publish_platforms)
      ? parsed.publish_platforms.map(String).filter(Boolean)
      : [];
    return {
      publishing_enabled: parsed.publishing_enabled !== false,
      publish_platforms: platforms,
      publish_timezone:
        typeof parsed.publish_timezone === 'string' && parsed.publish_timezone.trim()
          ? parsed.publish_timezone.trim()
          : DEFAULT_PUBLISH_TIMEZONE,
    };
  } catch {
    return null;
  }
}
