import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { fetchOrderById } from '@/lib/shopify-graphql';

export const dynamic = 'force-dynamic';

/**
 * Get a specific Shopify order by ID.
 * GET /api/shopify/orders/[id]?tenant_id=...
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  try {
    const data = await fetchOrderById(tenantId, id);
    const o = data.order;
    if (!o) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }

    return Response.json({
      order: {
        id: o.id,
        name: o.name,
        email: o.email,
        phone: o.phone,
        createdAt: o.created_at,
        financialStatus: o.financial_status,
        fulfillmentStatus: o.fulfillment_status,
        total: `${o.currency} ${o.total_price}`,
        subtotal: o.subtotal_price,
        totalShipping: o.total_shipping_price_set?.shop_money?.amount,
        totalTax: o.total_tax,
        items: (o.line_items || []).map((li) => ({
          title: li.title,
          quantity: li.quantity,
          price: li.price,
          variant: li.variant_title,
          sku: li.sku,
        })),
        customer: o.customer ? {
          id: o.customer.id,
          firstName: o.customer.first_name,
          lastName: o.customer.last_name,
          email: o.customer.email,
          phone: o.customer.phone,
          ordersCount: o.customer.orders_count,
          totalSpent: o.customer.total_spent,
        } : null,
        shippingAddress: o.shipping_address ? {
          name: o.shipping_address.name,
          address1: o.shipping_address.address1,
          city: o.shipping_address.city,
          zip: o.shipping_address.zip,
          country: o.shipping_address.country,
        } : null,
        fulfillments: (o.fulfillments || []).map((f) => ({
          status: f.status,
          trackingNumber: f.tracking_number,
          trackingUrl: f.tracking_url,
          trackingCompany: f.tracking_company,
          createdAt: f.created_at,
          lineItems: (f.line_items || []).map((li) => li.title),
        })),
        refunds: (o.refunds || []).map((r) => ({
          createdAt: r.created_at,
          note: r.note,
          items: (r.refund_line_items || []).map((rli) => ({
            title: rli.line_item?.title,
            quantity: rli.quantity,
          })),
        })),
        note: o.note,
        tags: o.tags,
        cancelledAt: o.cancelled_at,
        cancelReason: o.cancel_reason,
      },
    });
  } catch (err: any) {
    console.error('[Shopify Order] Error:', err);
    return Response.json({ error: err.message || 'Failed to fetch order' }, { status: err.status || 500 });
  }
}
