import { NextRequest } from 'next/server';
import { isDemoTenant } from '@/lib/demo';
import { ShopifyError } from '@/lib/shopify';
import { fetchProducts } from '@/lib/shopify-graphql';
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
    return Response.json({
      summary: { totalProducts: 18, totalVariants: 53, totalInventory: 1247, outOfStock: 2, lowStock: 9 },
      alerts: [
        { product: 'Cropped Denim Jacket', variant: 'L / Light Wash', stock: 3 },
        { product: 'Knit Beanie', variant: 'One Size / Cream', stock: 4 },
      ],
    });
  }

  try {
    const data = await fetchProducts(tenantId, 250);
    const products = (data.products || []).map((p: any) => {
      const variants = (p.variants || []).map((v: any) => ({
        id: v.id,
        title: v.title,
        sku: v.sku,
        inventory_quantity: v.inventory_quantity ?? 0,
        price: v.price,
      }));
      const totalStock = variants.reduce((sum: number, v: any) => sum + (v.inventory_quantity || 0), 0);
      return {
        id: p.id,
        title: p.title,
        image: p.images?.[0]?.src || null,
        status: p.status,
        totalStock,
        variants,
      };
    });

    const totalInventory = products.reduce((sum: number, p: any) => sum + p.totalStock, 0);
    const outOfStock = products.filter((p: any) => p.totalStock === 0).length;
    const lowStock = products.filter((p: any) => p.totalStock > 0 && p.totalStock <= 10).length;

    const alerts = products
      .filter((p: any) => p.totalStock > 0 && p.totalStock <= 10)
      .flatMap((p: any) =>
        p.variants
          .filter((v: any) => v.inventory_quantity > 0 && v.inventory_quantity <= 10)
          .map((v: any) => ({
            product: p.title,
            variant: v.title,
            stock: v.inventory_quantity,
          }))
      )
      .sort((a: any, b: any) => a.stock - b.stock)
      .slice(0, 10);

    return Response.json({
      products,
      summary: {
        totalProducts: products.length,
        totalVariants: products.reduce((sum: number, p: any) => sum + p.variants.length, 0),
        totalInventory,
        outOfStock,
        lowStock,
      },
      alerts,
    });
  } catch (err) {
    if (err instanceof ShopifyError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error('[Stock]', err);
    return Response.json({ error: 'Failed to fetch stock data' }, { status: 500 });
  }
}
