import { NextRequest } from 'next/server';
import { assertShopifyWebhookHmac } from '@/lib/shopify-webhook-request';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Mandatory GDPR webhook: customers/redact
 * Shopify sends this when a customer requests deletion of their data.
 */
export async function POST(request: NextRequest) {
  const check = await assertShopifyWebhookHmac(request);
  if (!check.ok) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const data = JSON.parse(check.rawBody) as { shop_domain?: string };
    console.log('[Shopify Webhook] customers/redact received for shop:', data.shop_domain);
  } catch {
    console.log('[Shopify Webhook] customers/redact received (unparsed body)');
  }

  return Response.json({ received: true }, { status: 200 });
}
