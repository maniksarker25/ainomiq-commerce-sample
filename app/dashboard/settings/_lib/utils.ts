import { buildMetaConnectHref, META_RETURN_PATHS } from '../../../../lib/meta-oauth';
import { buildShopifyConnectHref, SHOPIFY_RETURN_PATHS } from '../../../../lib/shopify-oauth';

export function integrationProviderId(id: string) {
  return id;
}

export function connectHrefForIntegration(id: string, tenantId: string) {
  if (id === 'shopify') {
    return buildShopifyConnectHref({ tenantId, returnTo: SHOPIFY_RETURN_PATHS.settings });
  }
  const tenant = encodeURIComponent(tenantId || '');
  if (id === 'gmail') return `/api/auth/google/connect?service=gmail&tenant_id=${tenant}`;
  if (id === 'google_drive') return `/api/auth/google/connect?service=drive&tenant_id=${tenant}`;
  if (id === 'google_calendar') return `/api/auth/google/connect?service=calendar&tenant_id=${tenant}`;
  if (id === 'meta_ads') return `/api/auth/meta/connect?intent=ads&tenant_id=${tenant}`;
  if (id === 'meta_messaging') {
    return buildMetaConnectHref({
      tenantId,
      intent: 'messaging',
      platform: 'both',
      returnTo: META_RETURN_PATHS.settings,
      force: true,
    });
  }
  if (id === 'meta_posting') {
    return buildMetaConnectHref({
      tenantId,
      intent: 'posting',
      platform: 'both',
      returnTo: META_RETURN_PATHS.settings,
      force: true,
    });
  }
  return `/api/auth/${integrationProviderId(id)}/connect?tenant_id=${tenant}`;
}

export function disconnectPathForIntegration(id: string) {
  if (id === 'gmail' || id === 'google_drive' || id === 'google_calendar') return '/api/auth/google/disconnect';
  if (id === 'meta_ads' || id === 'meta_messaging' || id === 'meta_posting') return '/api/auth/meta/disconnect';
  return `/api/auth/${integrationProviderId(id)}/disconnect`;
}

function hasScope(scopes: string, needle: string) {
  return scopes.toLowerCase().includes(needle.toLowerCase());
}

export function connectionForIntegration(id: string, rows: Array<{ provider: string; email?: string; scopes?: string; providerAccountId?: string }>) {
  if (id === 'asset_library') return { connected: true, email: 'Built in', provider: 'asset_library', providerAccountId: '' };

  const exact = rows.find(row => row.provider === id);
  if (exact) return { connected: true, email: exact.email || '', provider: exact.provider, providerAccountId: exact.providerAccountId || '' };

  const legacyGoogle = rows.find(row => row.provider === 'google');
  if (legacyGoogle) {
    const scopes = legacyGoogle.scopes || '';
    if (id === 'gmail' && hasScope(scopes, 'gmail')) return { connected: true, email: legacyGoogle.email || '', provider: 'google', providerAccountId: legacyGoogle.providerAccountId || '' };
    if (id === 'google_drive' && hasScope(scopes, 'drive')) return { connected: true, email: legacyGoogle.email || '', provider: 'google', providerAccountId: legacyGoogle.providerAccountId || '' };
    if (id === 'google_calendar' && hasScope(scopes, 'calendar')) return { connected: true, email: legacyGoogle.email || '', provider: 'google', providerAccountId: legacyGoogle.providerAccountId || '' };
  }

  const legacyMetaAds = rows.find(row => row.provider === 'meta');
  if (id === 'meta_ads' && legacyMetaAds) return { connected: true, email: legacyMetaAds.email || '', provider: 'meta', providerAccountId: legacyMetaAds.providerAccountId || '' };

  if (id === 'meta_messaging') {
    const row = rows.find(r => {
      if (r.provider !== 'instagram' && r.provider !== 'facebook') return false;
      const rowScopes = r.scopes || '';
      return hasScope(rowScopes, 'pages_messaging') || hasScope(rowScopes, 'instagram_manage_messages');
    });
    if (row) {
      return { connected: true, email: row.email || '', provider: row.provider, providerAccountId: row.providerAccountId || '' };
    }
  }

  if (id === 'meta_posting') {
    const row = rows.find(r => {
      if (r.provider !== 'instagram' && r.provider !== 'facebook') return false;
      const rowScopes = r.scopes || '';
      return hasScope(rowScopes, 'pages_manage_posts') || hasScope(rowScopes, 'instagram_content_publish');
    });
    if (row) {
      return { connected: true, email: row.email || '', provider: row.provider, providerAccountId: row.providerAccountId || '' };
    }
  }

  return { connected: false, email: '', provider: integrationProviderId(id), providerAccountId: '' };
}

export function getConnectedPlatforms(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem('ainomiq_integrations');
    return stored ? JSON.parse(stored) : {};
  } catch { return {}; }
}

export function setConnectedPlatform(platform: string, connected: boolean) {
  const current = getConnectedPlatforms();
  current[platform] = connected;
  localStorage.setItem('ainomiq_integrations', JSON.stringify(current));
}

export function sameAsset(left?: string | null, right?: string | null) {
  if (!left || !right) return false;
  const clean = (value: string) => {
    try {
      const url = new URL(value);
      url.hash = '';
      url.search = '';
      return url.toString().replace(/\/$/, '').toLowerCase();
    } catch {
      return value.split(/[?#]/)[0].replace(/\/$/, '').toLowerCase();
    }
  };
  return clean(left) === clean(right);
}

export function usableBrandImage(value?: string | null) {
  const url = String(value || '').trim();
  if (!url) return false;
  if (/^data:image\//i.test(url)) return true;
  if (!/^https?:\/\//i.test(url)) return false;
  if (/google\.com\/s2\/favicons/i.test(url)) return false;
  return /\.(?:png|svg|webp|jpe?g|ico)(?:$|[?#])/i.test(url);
}

export function uniqueAssets(values: Array<string | null | undefined>) {
  return values.filter(usableBrandImage).filter((value, index, list) => list.findIndex(candidate => sameAsset(candidate, value)) === index) as string[];
}
