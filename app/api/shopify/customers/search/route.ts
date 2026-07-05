import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { searchCustomers } from '@/lib/shopify-graphql';

export const dynamic = 'force-dynamic';

/**
 * Search Shopify customers by email or name.
 * GET /api/shopify/customers/search?tenant_id=...&q=...
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
    // Shopify customer search supports email, name, etc.
    const data = await searchCustomers(tenantId, q, 5);

    const customers = (data.customers || []).map((c) => ({
      id: c.id,
      firstName: c.first_name,
      lastName: c.last_name,
      email: c.email,
      phone: c.phone,
      ordersCount: c.orders_count,
      totalSpent: c.total_spent,
      createdAt: c.created_at,
      tags: c.tags,
      note: c.note,
      verified: c.verified_email,
      state: c.state,
      defaultAddress: c.addresses?.[0] ? {
        city: c.addresses[0].city,
        country: c.addresses[0].country,
      } : null,
    }));

    return Response.json({ customers });
  } catch (err: any) {
    console.error('[Shopify Customers Search] Error:', err);
    return Response.json({ error: err.message || 'Failed to search customers' }, { status: err.status || 500 });
  }
}
