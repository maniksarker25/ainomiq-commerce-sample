import { NextRequest } from 'next/server';
import { assertShopifyWebhookHmac } from '@/lib/shopify-webhook-request';
import { db, initDb } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Mandatory GDPR webhook: shop/redact
 * Shopify sends this 48h after a store uninstalls the app.
 */
export async function POST(request: NextRequest) {
  const check = await assertShopifyWebhookHmac(request);
  if (!check.ok) {
    return new Response('Unauthorized', { status: 401 });
  }

  let shopDomain = '';
  try {
    const data = JSON.parse(check.rawBody) as { shop_domain?: string };
    shopDomain = (data.shop_domain || '').trim().toLowerCase();
    console.log('[Shopify Webhook] shop/redact received for:', shopDomain || '(no shop_domain)');
  } catch (err) {
    console.error('[shop/redact] JSON parse error (HMAC was valid):', err);
    return Response.json({ received: true }, { status: 200 });
  }

  if (!shopDomain) {
    return Response.json({ received: true }, { status: 200 });
  }

  try {
    await initDb();
    await db.execute({
      sql: `DELETE FROM integrations WHERE provider = 'shopify' AND LOWER(TRIM(provider_account_id)) = ?`,
      args: [shopDomain],
    });
  } catch (err) {
    console.error('[shop/redact] Error cleaning up:', err);
    return new Response('Internal Server Error', { status: 500 });
  }

  return Response.json({ received: true }, { status: 200 });
}
