import crypto from 'crypto';
import { getEnv } from '@/lib/oauth-config';

const GRAPH = 'https://graph.facebook.com/v21.0';

/** Fields subscribed on the Facebook Page for messaging + feed (comments). */
export const PAGE_SUBSCRIBED_FIELDS_LIST = [
  'messages',
  'messaging_postbacks',
  'message_echoes',
  'feed',
] as const;

const PAGE_SUBSCRIBED_FIELDS = PAGE_SUBSCRIBED_FIELDS_LIST.join(',');

export function getMetaWebhookVerifyToken(): string | null {
  const token =
    process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() ||
    process.env.META_VERIFY_TOKEN?.trim();
  return token || null;
}

export function isMetaWebhookVerifyTokenConfigured(): boolean {
  return getMetaWebhookVerifyToken() !== null;
}

export function isMetaAppSecretConfigured(): boolean {
  const secret = process.env.META_APP_SECRET?.trim();
  if (secret) return true;
  try {
    getEnv('META_APP_SECRET');
    return true;
  } catch {
    return false;
  }
}

export type PageWebhookSubscriptionStatus = {
  ok: boolean;
  pageId: string;
  appSubscribed: boolean;
  subscribedFields: string[];
  missingFields: string[];
  error?: string;
  rawError?: any;
};

/**
 * Subscribe a Page to this app's webhooks (requires pages_manage_metadata).
 * Call after content/messaging OAuth when a page access token is available.
 */
export async function subscribePageToAppWebhooks(pageId: string, pageAccessToken: string): Promise<{ ok: boolean; error?: string; rawError?: any }> {
  const id = String(pageId || '').trim();
  const token = String(pageAccessToken || '').trim();
  if (!id || !token) {
    return { ok: false, error: 'Missing page id or access token' };
  }

  try {
    const url = new URL(`${GRAPH}/${id}/subscribed_apps`);
    url.searchParams.set('subscribed_fields', PAGE_SUBSCRIBED_FIELDS);
    url.searchParams.set('access_token', token);

    const res = await fetch(url.toString(), { method: 'POST', cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message || `subscribe failed (${res.status})`;
      console.error('[meta-webhooks] Page subscribe failed:', msg, data);
      return { ok: false, error: msg, rawError: data?.error };
    }
    console.log('[meta-webhooks] Page subscribed:', id, data);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'subscribe failed';
    console.error('[meta-webhooks] Page subscribe error:', msg);
    return { ok: false, error: msg };
  }
}

/**
 * Read which webhook fields this app is subscribed to on a Page (requires pages_manage_metadata).
 */
export async function getPageWebhookSubscriptionStatus(
  pageId: string,
  pageAccessToken: string,
  appId?: string,
): Promise<PageWebhookSubscriptionStatus> {
  const id = String(pageId || '').trim();
  const token = String(pageAccessToken || '').trim();
  const required = [...PAGE_SUBSCRIBED_FIELDS_LIST];
  const base: PageWebhookSubscriptionStatus = {
    ok: false,
    pageId: id,
    appSubscribed: false,
    subscribedFields: [],
    missingFields: required,
  };

  if (!id || !token) {
    return { ...base, error: 'Missing page id or access token' };
  }

  const resolvedAppId = (appId || process.env.META_APP_ID || '').trim();
  if (!resolvedAppId) {
    return { ...base, error: 'META_APP_ID is not configured' };
  }

  try {
    const url = new URL(`${GRAPH}/${id}/subscribed_apps`);
    url.searchParams.set('access_token', token);

    const res = await fetch(url.toString(), { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message || `subscribed_apps failed (${res.status})`;
      console.error('[meta-webhooks] subscribed_apps read failed:', msg, data);
      return { ...base, error: msg, rawError: data?.error };
    }

    const apps = Array.isArray(data?.data) ? data.data : [];
    const ours = apps.find(
      (app: { id?: string }) => String(app?.id || '') === resolvedAppId,
    );
    if (!ours) {
      return {
        ...base,
        error: 'This app is not subscribed to Page webhooks. Use Repair webhooks in Socials.',
      };
    }

    const subscribedFields = (
      Array.isArray(ours.subscribed_fields) ? ours.subscribed_fields : []
    ).map((field: string) => String(field).toLowerCase());
    const fieldSet = new Set(subscribedFields);
    const missingFields = required.filter((field) => !fieldSet.has(field));

    return {
      ok: missingFields.length === 0,
      pageId: id,
      appSubscribed: true,
      subscribedFields,
      missingFields,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'subscribed_apps failed';
    console.error('[meta-webhooks] subscribed_apps error:', msg);
    return { ...base, error: msg };
  }
}

export function verifyMetaWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.META_APP_SECRET?.trim() || getEnv('META_APP_SECRET');
  if (!secret || !signatureHeader?.startsWith('sha256=')) return false;

  try {
    const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
    const received = signatureHeader.slice(7).trim();
    const expectedBuf = Buffer.from(expected, 'hex');
    const receivedBuf = Buffer.from(received, 'hex');
    if (expectedBuf.length !== receivedBuf.length || expectedBuf.length === 0) return false;
    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}
