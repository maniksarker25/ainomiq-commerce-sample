import { getIntegration, upsertIntegration } from './db';
import { getEnv } from './oauth-config';

const META_API = 'https://graph.facebook.com/v21.0';
const META_TIMEOUT_MS = 12000;

export class MetaError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function metaErrorMessage(status: number, text: string) {
  try {
    const parsed = JSON.parse(text);
    const error = parsed?.error || {};
    const code = Number(error.code);
    const subcode = Number(error.error_subcode);
    const title = String(error.error_user_title || "");
    const userMessage = String(error.error_user_msg || "");
    if (status === 17 || subcode === 2446079 || code === 17) {
      return "Meta rate limit: Account Has Too Many API Calls. Please wait 15-30 minutes before trying again; repeated retries will extend the limit.";
    }
    if (title || userMessage) {
      return `Meta API error: ${title || "Request failed"}${userMessage ? ` - ${userMessage}` : ""}`;
    }
  } catch {
    // Fall through to the raw response below.
  }
  return `Meta API error: ${status} ${text}`;
}

/** Parse provider_account_id which may be a single ID or comma-separated list */
function parseAdAccountIds(raw: string): string[] {
  return raw.split(',').map(s => s.trim()).filter(s => s.startsWith('act_'));
}

export async function getMetaToken(tenantId: string): Promise<{ token: string; adAccountId: string; adAccountIds: string[] }> {
  const integration = await getIntegration(tenantId, 'meta');
  if (!integration) {
    throw new MetaError('Meta Ads account not connected', 401);
  }

  const accessToken = integration.access_token as string;
  const raw = integration.provider_account_id as string;

  if (!raw || !raw.startsWith('act_')) {
    throw new MetaError('No ad account selected. Please select an ad account in Meta setup.', 400);
  }

  const adAccountIds = parseAdAccountIds(raw);
  const adAccountId = adAccountIds[0]; // primary account for backward compat

  // Meta long-lived tokens last ~60 days; system user tokens are permanent
  // Proactively refresh if expiry is set and approaching
  const expiresAt = integration.token_expires_at as string | null;

  if (expiresAt) {
    const expiry = new Date(expiresAt).getTime();
    const now = Date.now();
    // Refresh 7 days before expiry to avoid any disruption
    if (now > expiry - 7 * 24 * 60 * 60 * 1000) {
      try {
        const newToken = await refreshMetaToken(tenantId, accessToken, 'meta');
        return { token: newToken, adAccountId, adAccountIds };
      } catch {
        // If refresh fails, try with current token (might still be valid)
        console.error('[Meta] Token refresh failed, using current token');
      }
    }
  }

  return { token: accessToken, adAccountId, adAccountIds };
}

async function refreshMetaToken(tenantId: string, currentToken: string, provider: string = 'meta'): Promise<string> {
  // Fetch existing integration to preserve fields
  const integration = await getIntegration(tenantId, provider);
  if (!integration) {
    throw new MetaError(`Integration not found for ${provider}`, 404);
  }

  // Meta uses token exchange to extend long-lived tokens
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: getEnv('META_APP_ID'),
    client_secret: getEnv('META_APP_SECRET'),
    fb_exchange_token: currentToken,
  });

  const res = await fetch(`${META_API}/oauth/access_token?${params}`);
  if (!res.ok) {
    throw new MetaError('Failed to refresh Meta token. Please reconnect.', 401);
  }

  const data = await res.json();
  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000)
    : null;

  await upsertIntegration(
    tenantId,
    provider,
    data.access_token,
    null,
    expiresAt,
    integration.scopes as string | null,
    integration.provider_account_id as string | null,
    integration.provider_email as string | null,
  );

  return data.access_token;
}

export async function exchangeMetaToken(
  tenantId: string,
  provider: string,
  shortLivedToken: string,
  scopes: string | null,
  providerAccountId: string | null,
  providerEmail: string | null,
): Promise<{ access_token: string; expires_in: number }> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: getEnv('META_APP_ID'),
    client_secret: getEnv('META_APP_SECRET'),
    fb_exchange_token: shortLivedToken,
  });

  const res = await fetch(`${META_API}/oauth/access_token?${params}`);
  if (!res.ok) {
    throw new MetaError('Failed to exchange for long-lived token.', 401);
  }

  const data = await res.json();
  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000)
    : null;

  await upsertIntegration(
    tenantId,
    provider,
    data.access_token,
    null,
    expiresAt,
    scopes,
    providerAccountId,
    providerEmail,
  );

  return data;
}

export async function metaFetch(token: string, path: string, options?: RequestInit) {
  const separator = path.includes('?') ? '&' : '?';
  const url = `${META_API}${path}${separator}access_token=${encodeURIComponent(token)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), META_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      signal: options?.signal || controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new MetaError('Meta API timed out. Try again, or create a new campaign/ad set instead of loading existing ones.', 504);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (res.status === 401 || res.status === 190) {
    throw new MetaError('Meta token expired. Please reconnect.', 401);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new MetaError(metaErrorMessage(res.status, text), res.status);
  }

  return res.json();
}

export async function getMetaTokenAndFetch(tenantId: string, path: string, options?: RequestInit) {
  const { token, adAccountId, adAccountIds } = await getMetaToken(tenantId);

  // If path uses {ad_account_id} and there are multiple accounts, fetch from each and merge
  if (path.includes('{ad_account_id}') && adAccountIds.length > 1) {
    let currentToken = token;
    const results = await Promise.all(
      adAccountIds.map(async (accountId) => {
        const resolvedPath = path.replace('{ad_account_id}', accountId);
        try {
          return await metaFetch(currentToken, resolvedPath, options);
        } catch (err) {
          if (err instanceof MetaError && err.status === 401) {
            currentToken = await refreshMetaToken(tenantId, token, 'meta');
            return await metaFetch(currentToken, resolvedPath, options);
          }
          console.error(`[Meta] Failed to fetch from ${accountId}:`, err);
          return { data: [] };
        }
      })
    );
    // Merge all .data arrays into a single response
    const mergedData = results.flatMap(r => r.data || []);
    return { data: mergedData };
  }

  // Single account path
  const resolvedPath = path.replace('{ad_account_id}', adAccountId);
  try {
    return await metaFetch(token, resolvedPath, options);
  } catch (err) {
    if (err instanceof MetaError && err.status === 401) {
      const newToken = await refreshMetaToken(tenantId, token, 'meta');
      return await metaFetch(newToken, resolvedPath, options);
    }
    throw err;
  }
}
