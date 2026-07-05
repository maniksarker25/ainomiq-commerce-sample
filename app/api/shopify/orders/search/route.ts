import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { fetchOrders } from '@/lib/shopify-graphql';

export const dynamic = 'force-dynamic';

/**
 * Search Shopify orders by email, order name (#1001), or query.
 * GET /api/shopify/orders/search?tenant_id=...&q=...
 */
export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  const q = (request.nextUrl.searchParams.get('q') || '').trim();
  if (!q) {
    return Response.json({ error: 'Missing search query' }, { status: 400 });
  }

  try {
    // Shopify supports searching orders by name, email, etc.
    const searchQuery = q.includes('@') ? `email:${q}` : `name:${q}`;
    const data = await fetchOrders(tenantId, { query: searchQuery, first: 5 });

    const orders = (data.orders || []).map((o) => ({
      id: o.id,
      name: o.name,
      email: o.email,
      createdAt: o.created_at,
      financialStatus: o.financial_status,
      fulfillmentStatus: o.fulfillment_status,
      total: `${o.currency} ${o.total_price}`,
      items: (o.line_items || []).map((li) => ({
        title: li.title,
        quantity: li.quantity,
        variant: li.variant_title,
      })),
      customer: o.customer ? {
        firstName: o.customer.first_name,
        lastName: o.customer.last_name,
        email: o.customer.email,
        ordersCount: o.customer.orders_count,
      } : null,
      shippingAddress: o.shipping_address ? {
        city: o.shipping_address.city,
        country: o.shipping_address.country,
      } : null,
      fulfillments: (o.fulfillments || []).map((f) => ({
        status: f.status,
        trackingNumber: f.tracking_number,
        trackingUrl: f.tracking_url,
        trackingCompany: f.tracking_company,
        createdAt: f.created_at,
      })),
      note: o.note,
    }));

    return Response.json({ orders });
  } catch (err: any) {
    console.error('[Shopify Orders Search] Error:', err);
    return Response.json({ error: err.message || 'Failed to search orders' }, { status: err.status || 500 });
  }
}
