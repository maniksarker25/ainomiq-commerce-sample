import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { fetchOrderFulfillments } from '@/lib/shopify-graphql';

export const dynamic = 'force-dynamic';

/**
 * Get tracking info for a Shopify order's fulfillments.
 * GET /api/shopify/tracking?tenant_id=...&order_id=...
 * Also supports searching by tracking number: &tracking_number=...
 */
export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  const orderId = request.nextUrl.searchParams.get('order_id');

  if (!orderId) {
    return Response.json({ error: 'Missing order_id' }, { status: 400 });
  }

  try {
    const data = await fetchOrderFulfillments(tenantId, orderId);

    const fulfillments = (data.fulfillments || []).map((f) => ({
      id: f.id,
      status: f.status,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
      trackingCompany: f.tracking_company,
      trackingNumber: f.tracking_number,
      trackingNumbers: f.tracking_numbers,
      trackingUrl: f.tracking_url,
      trackingUrls: f.tracking_urls,
      lineItems: (f.line_items || []).map((li) => ({
        title: li.title,
        quantity: li.quantity,
      })),
      shipmentStatus: f.shipment_status, // e.g. 'in_transit', 'delivered', 'out_for_delivery'
    }));

    return Response.json({ fulfillments });
  } catch (err: any) {
    console.error('[Shopify Tracking] Error:', err);
    return Response.json({ error: err.message || 'Failed to fetch tracking' }, { status: err.status || 500 });
  }
}
