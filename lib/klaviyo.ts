import { getIntegration, upsertIntegration } from './db';
import { getEnv } from './oauth-config';

const KLAVIYO_API = 'https://a.klaviyo.com/api';
const KLAVIYO_REVISION = '2024-02-15';

export class KlaviyoError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function getKlaviyoToken(tenantId: string): Promise<string> {
  const integration = await getIntegration(tenantId, 'klaviyo');
  if (!integration) {
    throw new KlaviyoError('Klaviyo account not connected', 401);
  }

  const accessToken = integration.access_token as string;
  const refreshToken = integration.refresh_token as string | null;
  const expiresAt = integration.token_expires_at as string | null;

  // Proactively refresh if expired, about to expire, or no expiry recorded
  if (refreshToken) {
    const now = Date.now();
    const expiry = expiresAt ? new Date(expiresAt).getTime() : 0;
    if (!expiresAt || now > expiry - 5 * 60 * 1000) {
      try {
        return await refreshKlaviyoToken(tenantId, refreshToken);
      } catch (refreshError) {
        console.error('[Klaviyo] Token refresh failed, using current token:', refreshError);
        return accessToken;
      }
    }
  }

  return accessToken;
}

async function refreshKlaviyoToken(tenantId: string, refreshToken: string): Promise<string> {
  const res = await fetch('https://a.klaviyo.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: getEnv('KLAVIYO_CLIENT_ID'),
      client_secret: getEnv('KLAVIYO_CLIENT_SECRET'),
    }),
  });

  if (!res.ok) {
    throw new KlaviyoError('Failed to refresh Klaviyo token. Please reconnect.', 401);
  }

  const data = await res.json();
  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000)
    : null;

  await upsertIntegration(
    tenantId,
    'klaviyo',
    data.access_token,
    data.refresh_token || refreshToken,
    expiresAt,
    null,
    null,
    null,
  );

  return data.access_token;
}

export async function klaviyoFetch(token: string, path: string, options?: RequestInit) {
  const res = await fetch(`${KLAVIYO_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      revision: KLAVIYO_REVISION,
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    throw new KlaviyoError('Klaviyo token expired. Please reconnect.', 401);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new KlaviyoError(`Klaviyo API error: ${res.status} ${text}`, res.status);
  }

  return res.json();
}

export async function getKlaviyoTokenAndFetch(tenantId: string, path: string, options?: RequestInit) {
  let token: string;
  try {
    token = await getKlaviyoToken(tenantId);
  } catch (err) {
    throw err;
  }

  try {
    return await klaviyoFetch(token, path, options);
  } catch (err) {
    if (err instanceof KlaviyoError && err.status === 401) {
      const integration = await getIntegration(tenantId, 'klaviyo');
      const refreshToken = integration?.refresh_token as string | null;
      if (refreshToken) {
        const newToken = await refreshKlaviyoToken(tenantId, refreshToken);
        return await klaviyoFetch(newToken, path, options);
      }
    }
    throw err;
  }
}
