import crypto from 'crypto';

/**
 * Shopify Partner / App Store API secret used to sign webhooks and OAuth.
 * CLI often writes SHOPIFY_API_SECRET; apps may use SHOPIFY_CLIENT_SECRET.
 */
function getShopifyWebhookSecret(): string {
  return (
    process.env.SHOPIFY_CLIENT_SECRET ||
    process.env.SHOPIFY_API_SECRET ||
    ''
  ).trim();
}

/**
 * Verify Shopify webhook HMAC signature.
 * Shopify sends X-Shopify-Hmac-Sha256 with base64-encoded HMAC of the **raw** request body.
 * @see https://shopify.dev/docs/apps/build/webhooks/subscribe/https
 */
export function verifyShopifyHmac(body: string, hmacHeader: string): boolean {
  const secret = getShopifyWebhookSecret();
  if (!secret) return false;

  const received = (hmacHeader || '').trim();
  if (!received) return false;

  const digest = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64');

  const a = Buffer.from(digest, 'utf8');
  const b = Buffer.from(received, 'utf8');
  if (a.length !== b.length) return false;

  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
