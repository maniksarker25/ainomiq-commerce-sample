import { NextRequest } from 'next/server';
import { assertShopifyWebhookHmac } from '@/lib/shopify-webhook-request';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Mandatory GDPR webhook: customers/data_request
 * Shopify sends this when a customer requests their data.
 */
export async function POST(request: NextRequest) {
  const check = await assertShopifyWebhookHmac(request);
  if (!check.ok) {
    return new Response('Unauthorized', { status: 401 });
  }

  console.log('[Shopify Webhook] customers/data_request received');

  return Response.json({ received: true }, { status: 200 });
}
