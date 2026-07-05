import {
  PERFORMANCE_KLAVIYO_RECONNECT_HREF,
  PERFORMANCE_META_RECONNECT_HREF,
  PERFORMANCE_SHOPIFY_RECONNECT_HREF,
} from '@/lib/performance-constants';
import { getIntegration, getIntegrationWithAliases, resolveCanonicalTenantId } from '@/lib/db';

export {
  PERFORMANCE_KLAVIYO_RECONNECT_HREF,
  PERFORMANCE_META_RECONNECT_HREF,
  PERFORMANCE_SHOPIFY_RECONNECT_HREF,
} from '@/lib/performance-constants';

export type IntegrationProvider = 'meta' | 'shopify' | 'klaviyo';

export type IntegrationFetchError = {
  code: string;
  message: string;
  reconnectHref: string;
};

const RECONNECT_HREFS: Record<IntegrationProvider, string> = {
  meta: PERFORMANCE_META_RECONNECT_HREF,
  shopify: PERFORMANCE_SHOPIFY_RECONNECT_HREF,
  klaviyo: PERFORMANCE_KLAVIYO_RECONNECT_HREF,
};

const ERROR_CODES: Record<IntegrationProvider, string> = {
  meta: 'META_FETCH_FAILED',
  shopify: 'SHOPIFY_FETCH_FAILED',
  klaviyo: 'KLAVIYO_FETCH_FAILED',
};

function errorStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as { status: unknown }).status;
    if (typeof status === 'number') return status;
  }
  return undefined;
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function isAuthIntegrationError(err: unknown): boolean {
  const status = errorStatus(err);
  return status === 401 || status === 400;
}

export type PerformancePlatformStatus = {
  connected: boolean;
  adsReady?: boolean;
  adAccountCount?: number;
};

function parseMetaAdAccountIds(raw: string | null | undefined): string[] {
  return String(raw || '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.startsWith('act_'));
}

/** Read integration connection state from DB (avoids server-side HTTP status fetches without session cookies). */
export async function getPerformancePlatformStatuses(tenantId: string): Promise<{
  meta: PerformancePlatformStatus;
  shopify: PerformancePlatformStatus;
  klaviyo: PerformancePlatformStatus;
  google: PerformancePlatformStatus;
  tiktok: PerformancePlatformStatus;
  snapchat: PerformancePlatformStatus;
}> {
  const canonical = await resolveCanonicalTenantId(tenantId);
  const [meta, shopify, klaviyo, google, tiktok, snapchat] = await Promise.all([
    getIntegration(canonical, 'meta'),
    getIntegrationWithAliases(canonical, 'shopify'),
    getIntegrationWithAliases(canonical, 'klaviyo'),
    getIntegrationWithAliases(canonical, 'google'),
    getIntegration(canonical, 'tiktok'),
    getIntegration(canonical, 'snapchat'),
  ]);

  const metaAdAccountIds = parseMetaAdAccountIds(meta?.provider_account_id as string | undefined);

  return {
    meta: {
      connected: Boolean(meta?.access_token),
      adsReady: metaAdAccountIds.length > 0,
      adAccountCount: metaAdAccountIds.length,
    },
    shopify: { connected: Boolean(shopify?.access_token) },
    klaviyo: { connected: Boolean(klaviyo?.access_token) },
    google: { connected: Boolean(google?.access_token) },
    tiktok: { connected: Boolean(tiktok?.access_token) },
    snapchat: { connected: Boolean(snapchat?.access_token) },
  };
}

export function metaNoAdAccountError(): IntegrationFetchError {
  return {
    code: 'META_NO_AD_ACCOUNT',
    message:
      'Meta is connected, but no ad account is selected. Choose an ad account in Meta setup to load ad metrics.',
    reconnectHref: PERFORMANCE_META_RECONNECT_HREF,
  };
}

export function mapIntegrationFetchError(
  err: unknown,
  provider: IntegrationProvider,
): IntegrationFetchError {
  const reconnectHref = RECONNECT_HREFS[provider];
  const defaultCode = ERROR_CODES[provider];
  const status = errorStatus(err);
  const message = errorMessage(err, 'Failed to load platform data.');
  const lower = message.toLowerCase();

  if (provider === 'meta') {
    const code =
      status === 401
        ? 'META_TOKEN_EXPIRED'
        : lower.includes('ad account')
          ? 'META_NO_AD_ACCOUNT'
          : defaultCode;
    return { code, message, reconnectHref };
  }

  if (provider === 'shopify') {
    return {
      code: status === 401 ? 'SHOPIFY_TOKEN_EXPIRED' : defaultCode,
      message,
      reconnectHref,
    };
  }

  return {
    code: status === 401 ? 'KLAVIYO_TOKEN_EXPIRED' : defaultCode,
    message,
    reconnectHref,
  };
}
