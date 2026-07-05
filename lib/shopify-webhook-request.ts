import type { NextRequest } from 'next/server';
import { verifyShopifyHmac } from '@/lib/shopify-hmac';

/** Raw body must be used for HMAC (do not parse JSON first). */
export function getShopifyWebhookHmacHeader(request: NextRequest): string {
  return (
    request.headers.get('x-shopify-hmac-sha256') ||
    request.headers.get('X-Shopify-Hmac-Sha256') ||
    ''
  ).trim();
}

export async function assertShopifyWebhookHmac(request: NextRequest): Promise<{ ok: true; rawBody: string } | { ok: false; rawBody: string }> {
  const rawBody = await request.text();
  const hmac = getShopifyWebhookHmacHeader(request);
  if (!verifyShopifyHmac(rawBody, hmac)) {
    return { ok: false, rawBody };
  }
  return { ok: true, rawBody };
}
