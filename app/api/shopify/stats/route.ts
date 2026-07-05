import { NextRequest } from 'next/server';
import { getShopifyTimezone } from '@/lib/shopify';
import { fetchAllOrders } from '@/lib/shopify-graphql';
import { isDemoTenant } from '@/lib/demo';
import { getDemoShopifyStats } from '@/lib/demo-data';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';

// In-memory cache voor Shopify stats (max 5 min TTL)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minuten

function getCacheKey(tenantId: string, days: number): string {
  return `${tenantId}:${days}`;
}

function clearOldCache() {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      cache.delete(key);
    }
  }
}

// Helper to get date key (YYYY-MM-DD) in a given timezone
function getDateKey(date: Date, tz: string): string {
  return date.toLocaleDateString('sv-SE', { timeZone: tz });
}

// Helper to get start of day in a given timezone
function getStartOfDay(dateStr: string, tz: string): Date {
  const d = new Date(dateStr + 'T00:00:00');
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' });
  const parts = formatter.formatToParts(d);
  const tzPart = parts.find(p => p.type === 'timeZoneName');
  const offsetMatch = tzPart?.value?.match(/GMT([+-]\d+)/);
  const offsetHours = offsetMatch ? parseInt(offsetMatch[1]) : 0;
  return new Date(dateStr + `T00:00:00.000${offsetHours >= 0 ? '+' : ''}${String(Math.abs(offsetHours)).padStart(2,'0')}:00`);
}

async function fetchAllOrdersForStats(tenantId: string, startDate: Date) {
  return fetchAllOrders(tenantId, { createdAtMin: startDate, maxOrders: 2500 });
}

async function fetchShopifyStats(tenantId: string, days: number) {
  // Get store timezone from Shopify API
  let storeTz = 'UTC';
  try {
    storeTz = await getShopifyTimezone(tenantId);
  } catch {}

  // Calculate start date as start of day in store timezone
  const now = new Date();
  const todayKey = getDateKey(now, storeTz);
  const utcDate = new Date(todayKey + 'T00:00:00Z');
  utcDate.setUTCDate(utcDate.getUTCDate() - days + 1);
  const startDateKey = utcDate.toISOString().split('T')[0];
  const startDate = getStartOfDay(startDateKey, storeTz);
  const orders = await fetchAllOrdersForStats(tenantId, startDate);

  let totalRevenue = 0;
  let totalOrders = 0;
  let totalRefunds = 0;
  let totalCOGS = 0;
  const customerOrdersMap = new Map<string, number>(); // customer email -> order count

  for (const order of orders) {
    const revenue = parseFloat(order.total_price || '0');
    totalRevenue += revenue;
    totalOrders++;

    // Refunds
    if (order.refunds && order.refunds.length > 0) {
      for (const refund of order.refunds) {
        totalRefunds += parseFloat(refund.total_refund || '0');
      }
    }

    // COGS: real unit economics for Billie Jeans
    if (order.line_items) {
      for (const item of order.line_items) {
        const quantity = item.quantity || 1;
        const title = (item.title || '').toLowerCase();
        const variantTitle = (item.variant_title || '').toLowerCase();
        let cogsPerUnit = 1.00; // default fallback
        // Match on full product identifiers, not substrings
        const isWK = title.includes('waist knot') || title === 'wk' || title.startsWith('wk ') || title.includes(' wk ') || title.endsWith(' wk') ||
                     variantTitle.includes('waist knot') || variantTitle === 'wk' || variantTitle.startsWith('wk ') || variantTitle.includes(' wk ') || variantTitle.endsWith(' wk');
        const isRW = title.includes('retro watch') || title === 'rw' || title.startsWith('rw ') || title.includes(' rw ') || title.endsWith(' rw') ||
                     variantTitle.includes('retro watch') || variantTitle === 'rw' || variantTitle.startsWith('rw ') || variantTitle.includes(' rw ') || variantTitle.endsWith(' rw');
        const isBL = title.includes('belt') || title.includes('leather') ||
                     variantTitle.includes('belt') || variantTitle.includes('leather');
        if (isWK) {
          cogsPerUnit = 0.19;
        } else if (isRW) {
          cogsPerUnit = 1.90;
        } else if (isBL) {
          cogsPerUnit = 7.00;
        }
        totalCOGS += cogsPerUnit * quantity;
      }
    }

    // Customer counting
    if (order.customer?.email) {
      const email = order.customer.email;
      customerOrdersMap.set(email, (customerOrdersMap.get(email) || 0) + 1);
    }
  }

  // New vs returning customers
  let newCustomers = 0;
  let returningCustomers = 0;
  for (const count of customerOrdersMap.values()) {
    if (count === 1) newCustomers++;
    else returningCustomers++;
  }

  const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const refundRate = totalOrders > 0 ? (totalRefunds / totalRevenue) * 100 : 0;
  // Shipping cost per order: EUR 6.75 flat + pick & pack EUR 1.00
  const shipping = totalOrders * (6.75 + 1.00);
  // Gateway fees: 3.07% of revenue
  const gatewayFees = totalRevenue * 0.0307;

  return {
    revenue: totalRevenue,
    orders: totalOrders,
    aov,
    newCustomers,
    returningCustomers,
    refunds: totalRefunds,
    refundRate,
    cogs: totalCOGS,
    shipping: shipping,
    gatewayFees: gatewayFees,
  };
}

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  const { searchParams } = request.nextUrl;
  const daysParam = searchParams.get('days');
  const days = daysParam ? parseInt(daysParam, 10) : 7;

  if (isDemoTenant(tenantId)) {
    return Response.json(getDemoShopifyStats(days));
  }

  // Controleer cache
  clearOldCache();
  const cacheKey = getCacheKey(tenantId, days);
  const cached = cache.get(cacheKey);
  if (cached) {
    return Response.json(cached.data);
  }

  try {
    const stats = await fetchShopifyStats(tenantId, days);
    cache.set(cacheKey, { data: stats, timestamp: Date.now() });
    return Response.json(stats);
  } catch (error: any) {
    console.error('[Shopify Stats] Error:', error);
    if (error.status === 401) {
      return Response.json({ error: 'Shopify token expired. Please reconnect.' }, { status: 401 });
    }
    return Response.json({ error: 'Failed to fetch Shopify stats', detail: error?.message || String(error) }, { status: 500 });
  }
}