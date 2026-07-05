import { getIntegrationWithAliases, upsertIntegration, resolveCanonicalTenantId } from './db';

export const SHOPIFY_API_VERSION = '2026-04';

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID || '';
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET || '';

const TOKEN_PROBE_QUERY = `query { shop { name } }`;
const TIMEZONE_QUERY = `query { shop { ianaTimezone } }`;

export class ShopifyError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type GraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

const tokenCache = new Map<string, { token: string; shop: string; expiresAt: number }>();

async function refreshShopifyToken(shop: string): Promise<string> {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: SHOPIFY_CLIENT_ID,
      client_secret: SHOPIFY_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });
  if (!res.ok) {
    throw new ShopifyError(`Failed to refresh Shopify token: ${res.status}`, res.status);
  }
  const data = await res.json();
  return data.access_token;
}

function phoneAgentFallbackTokenForTenant(tenantId: string): string {
  if (tenantId === 'pimsmit@billiejeans.eu') {
    return (process.env.BJ_SHOPIFY_ADMIN_TOKEN || '').trim();
  }
  return '';
}

function graphqlUrl(shop: string): string {
  return `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
}

function formatGraphqlErrors(errors: Array<{ message: string }>): string {
  return errors.map((e) => e.message).join('; ');
}

export async function shopifyGraphql<T>(
  token: string,
  shop: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(graphqlUrl(shop), {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (res.status === 401) {
    throw new ShopifyError('Shopify token invalid. Please reconnect.', 401);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new ShopifyError(`Shopify API error: ${res.status} ${text}`, res.status);
  }

  const payload = (await res.json()) as GraphqlResponse<T>;
  if (payload.errors?.length) {
    throw new ShopifyError(`Shopify GraphQL error: ${formatGraphqlErrors(payload.errors)}`, 502);
  }

  if (!payload.data) {
    throw new ShopifyError('Shopify GraphQL returned no data', 502);
  }

  return payload.data;
}

export async function getShopifyTokenAndGraphql<T>(
  tenantId: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const { token, shop } = await getShopifyToken(tenantId);
  return shopifyGraphql<T>(token, shop, query, variables);
}

async function probeShopifyToken(shop: string, accessToken: string): Promise<boolean> {
  try {
    await shopifyGraphql<{ shop: { name: string } }>(accessToken, shop, TOKEN_PROBE_QUERY);
    return true;
  } catch (err) {
    if (err instanceof ShopifyError && err.status === 401) {
      return false;
    }
    throw err;
  }
}

export async function getShopifyToken(tenantId: string): Promise<{ token: string; shop: string }> {
  const cached = tokenCache.get(tenantId);
  if (cached && Date.now() < cached.expiresAt) {
    return { token: cached.token, shop: cached.shop };
  }

  const canonical = await resolveCanonicalTenantId(tenantId);
  const integration = await getIntegrationWithAliases(canonical, 'shopify');
  if (!integration) {
    throw new ShopifyError('Shopify account not connected', 401);
  }

  const shop = integration.provider_account_id as string;
  if (!shop) {
    throw new ShopifyError('Shopify shop domain not found', 400);
  }

  let accessToken = integration.access_token as string;
  const fallbackToken = phoneAgentFallbackTokenForTenant(tenantId);
  if (fallbackToken) {
    accessToken = fallbackToken;
  }

  try {
    const valid = await probeShopifyToken(shop, accessToken);
    if (valid) {
      tokenCache.set(tenantId, { token: accessToken, shop, expiresAt: Date.now() + 12 * 60 * 60 * 1000 });
      return { token: accessToken, shop };
    }
  } catch {
    // Token expired or probe failed — refresh below
  }

  console.log(`[Shopify] Refreshing token for ${shop}`);
  accessToken = await refreshShopifyToken(shop);

  await upsertIntegration(tenantId, 'shopify', accessToken, null, null, null, shop, null);
  tokenCache.set(tenantId, { token: accessToken, shop, expiresAt: Date.now() + 12 * 60 * 60 * 1000 });

  return { token: accessToken, shop };
}

const tzCache = new Map<string, { tz: string; timestamp: number }>();
const TZ_CACHE_TTL = 24 * 60 * 60 * 1000;

export async function getShopifyTimezone(tenantId: string): Promise<string> {
  const cached = tzCache.get(tenantId);
  if (cached && Date.now() - cached.timestamp < TZ_CACHE_TTL) {
    return cached.tz;
  }

  try {
    const data = await getShopifyTokenAndGraphql<{ shop: { ianaTimezone: string } }>(
      tenantId,
      TIMEZONE_QUERY,
    );
    const tz = data.shop?.ianaTimezone || 'Europe/Amsterdam';
    tzCache.set(tenantId, { tz, timestamp: Date.now() });
    return tz;
  } catch {
    return 'Europe/Amsterdam';
  }
}
