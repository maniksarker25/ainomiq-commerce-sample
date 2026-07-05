import { NextRequest } from 'next/server';
import { ShopifyError } from '@/lib/shopify';
import { fetchProducts, fetchInventoryLevels } from '@/lib/shopify-graphql';
import { validateTenantId, checkRateLimit, ValidationError } from '@/lib/validate-tenant';
import { isDemoTenant } from '@/lib/demo';
import { getDemoStockProducts } from '@/lib/demo-data';
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
    return Response.json(getDemoStockProducts());
  }

  try {
    // Fetch products
    const productsData = await fetchProducts(tenantId, 50);

    const products = productsData.products || [];

    // Collect all inventory_item_ids
    const inventoryItemIds: number[] = [];
    for (const product of products) {
      for (const variant of product.variants || []) {
        if (variant.inventory_item_id) {
          inventoryItemIds.push(variant.inventory_item_id);
        }
      }
    }

    // Fetch inventory levels in batches of 50
    const inventoryMap: Record<number, number> = {};
    for (let i = 0; i < inventoryItemIds.length; i += 50) {
      const batch = inventoryItemIds.slice(i, i + 50);
      const inventoryData = await fetchInventoryLevels(tenantId, batch);
      for (const level of inventoryData.inventory_levels || []) {
        const existing = inventoryMap[level.inventory_item_id] || 0;
        inventoryMap[level.inventory_item_id] = existing + (level.available || 0);
      }
    }

    // Build response
    const result = products.map((product) => ({
      id: String(product.id),
      title: product.title,
      status: product.status,
      image: product.images?.[0]?.src || null,
      variants: (product.variants || []).map((v) => ({
        id: String(v.id),
        title: v.title,
        sku: v.sku || '',
        price: v.price,
        inventory: inventoryMap[v.inventory_item_id ?? 0] ?? v.inventory_quantity ?? 0,
      })),
    }));

    return Response.json({ products: result });
  } catch (err) {
    if (err instanceof ShopifyError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error('[Stock Products]', err);
    return Response.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}
