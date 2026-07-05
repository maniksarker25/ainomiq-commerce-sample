import { NextRequest } from 'next/server';
import { ShopifyError } from '@/lib/shopify';
import { fetchProducts, fetchProductsCount } from '@/lib/shopify-graphql';
import { validateTenantId, checkRateLimit, ValidationError } from '@/lib/validate-tenant';
import { isDemoTenant } from '@/lib/demo';
import { getDemoStockStats } from '@/lib/demo-data';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  if (isDemoTenant(tenantId)) {
    return Response.json(getDemoStockStats());
  }

  try {
    const productsData = await fetchProductsCount(tenantId);

    const allProducts = await fetchProducts(tenantId, 250);

    let totalInventory = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const product of allProducts.products || []) {
      for (const variant of product.variants || []) {
        const qty = variant.inventory_quantity || 0;
        totalInventory += qty;
        if (qty === 0) outOfStockCount++;
        else if (qty < 10) lowStockCount++;
      }
    }

    return Response.json({
      totalProducts: productsData.count || 0,
      totalInventory,
      lowStockCount,
      outOfStockCount,
    });
  } catch (err) {
    if (err instanceof ShopifyError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error('[Stock Stats]', err);
    return Response.json({ error: 'Failed to fetch stock stats' }, { status: 500 });
  }
}
