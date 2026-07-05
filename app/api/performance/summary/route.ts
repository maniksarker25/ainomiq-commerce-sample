import { NextRequest } from 'next/server';
import { getMetaTokenAndFetch } from '@/lib/meta';
import { getKlaviyoTokenAndFetch } from '@/lib/klaviyo';
import { isDemoTenant } from '@/lib/demo';
import { getDemoPerformanceSummary } from '@/lib/demo-data';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import {
  getPerformancePlatformStatuses,
  mapIntegrationFetchError,
  metaNoAdAccountError,
  type IntegrationFetchError,
} from '@/lib/performance-integrations';

// In-memory cache voor performance summary (max 5 min TTL)
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minuten

type MetaStats = {
  spend: number;
  roas: number;
  purchases: number;
  cpc: number;
  ctr: number;
  cpm: number;
  impressions: number;
  clicks: number;
};

type ShopifyStats = {
  revenue: number;
  orders: number;
  aov: number;
  newCustomers: number;
  returningCustomers: number;
  refunds: number;
  refundRate: number;
  cogs: number;
  shipping: number;
  gatewayFees: number;
};

type FetchResult<T> = {
  stats: T | null;
  fetchError: IntegrationFetchError | null;
};

const EMPTY_SHOPIFY: ShopifyStats = {
  revenue: 0,
  orders: 0,
  aov: 0,
  newCustomers: 0,
  returningCustomers: 0,
  refunds: 0,
  refundRate: 0,
  cogs: 0,
  shipping: 0,
  gatewayFees: 0,
};

function getCacheKey(tenantId: string, days: number): string {
  return `summary:${tenantId}:${days}`;
}

function clearOldCache() {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      cache.delete(key);
    }
  }
}

function metaDatePreset(days: number): string {
  if (days <= 1) return 'today';
  if (days <= 7) return 'last_7d';
  if (days <= 14) return 'last_14d';
  if (days <= 30) return 'last_30d';
  return 'last_90d';
}

function aggregateMetaRows(rows: Array<Record<string, unknown>>): MetaStats {
  if (rows.length === 0) {
    return { spend: 0, roas: 0, purchases: 0, cpc: 0, ctr: 0, cpm: 0, impressions: 0, clicks: 0 };
  }

  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalPurchases = 0;
  let totalPurchaseValue = 0;

  for (const row of rows) {
    totalSpend += parseFloat(String(row.spend || '0'));
    totalImpressions += parseInt(String(row.impressions || '0'), 10);
    totalClicks += parseInt(String(row.clicks || '0'), 10);
    const actions = (row.actions || []) as Array<{ action_type: string; value: string }>;
    const actionValues = (row.action_values || []) as Array<{ action_type: string; value: string }>;
    const purchaseAction = actions.find(
      (a) => a.action_type === 'purchase' || a.action_type === 'omni_purchase',
    );
    totalPurchases += purchaseAction ? parseInt(purchaseAction.value, 10) : 0;
    const purchaseVal = actionValues.find(
      (a) => a.action_type === 'purchase' || a.action_type === 'omni_purchase',
    );
    totalPurchaseValue += purchaseVal ? parseFloat(purchaseVal.value) : 0;
  }

  const roas = totalSpend > 0 ? totalPurchaseValue / totalSpend : 0;
  const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;

  return {
    spend: totalSpend,
    roas,
    purchases: totalPurchases,
    cpc,
    ctr,
    cpm,
    impressions: totalImpressions,
    clicks: totalClicks,
  };
}

async function fetchMetaStats(tenantId: string, days: number): Promise<FetchResult<MetaStats>> {
  try {
    const datePreset = metaDatePreset(days);
    const data = await getMetaTokenAndFetch(
      tenantId,
      `/{ad_account_id}/insights?fields=spend,impressions,clicks,cpc,ctr,cpm,actions,action_values,purchase_roas&date_preset=${datePreset}`,
    );
    return { stats: aggregateMetaRows(data.data || []), fetchError: null };
  } catch (error) {
    console.error('[Performance Summary] Failed to fetch Meta stats:', error);
    return { stats: null, fetchError: mapIntegrationFetchError(error, 'meta') };
  }
}

async function fetchShopifyStats(
  tenantId: string,
  days: number,
  origin: string,
  cookieHeader?: string,
): Promise<FetchResult<ShopifyStats>> {
  try {
    const url = `${origin}/api/shopify/stats?tenant_id=${encodeURIComponent(tenantId)}&days=${days}`;
    const headers: Record<string, string> = {};
    if (cookieHeader) headers.cookie = cookieHeader;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const message =
        typeof body?.error === 'string' ? body.error : `Shopify API error: ${res.status}`;
      throw new Error(message);
    }
    const data = await res.json();
    if (data.error) {
      throw new Error(String(data.error));
    }
    return { stats: data as ShopifyStats, fetchError: null };
  } catch (error) {
    console.error('[Performance Summary] Failed to fetch Shopify stats:', error);
    return { stats: null, fetchError: mapIntegrationFetchError(error, 'shopify') };
  }
}

async function fetchKlaviyoStats(tenantId: string, days: number) {
  try {
    const [profilesData, flowsData, metricsData] = await Promise.all([
      getKlaviyoTokenAndFetch(tenantId, '/profiles/?page[size]=1'),
      getKlaviyoTokenAndFetch(tenantId, '/flows/?fields[flow]=status'),
      getKlaviyoTokenAndFetch(tenantId, '/metrics/?filter=equals(name,"Placed Order")&fields[metric]=name').catch(
        () => ({ data: [] }),
      ),
    ]);

    const totalSubscribers = profilesData.meta?.total || profilesData.data?.length || 0;
    const activeFlows = (flowsData.data || []).filter(
      (f: { attributes: { status: string } }) => f.attributes.status === 'live',
    ).length;
    const totalFlows = (flowsData.data || []).length;

    let emailRevenue = { total: 0, campaigns: 0, flows: 0, orders: 0 };
    const placedOrderMetric = metricsData.data?.[0];

    if (placedOrderMetric) {
      try {
        const now = new Date();
        const start = new Date(now.getTime() - days * 86400000);
        const aggregateData = await getKlaviyoTokenAndFetch(tenantId, '/metric-aggregates/', {
          method: 'POST',
          body: JSON.stringify({
            data: {
              type: 'metric-aggregate',
              attributes: {
                metric_id: placedOrderMetric.id,
                measurements: ['sum_value', 'count'],
                interval: 'day',
                page_size: 500,
                by: ['$attribution_type'],
                filter: [
                  `greater-or-equal(datetime,${start.toISOString()})`,
                  `less-than(datetime,${now.toISOString()})`,
                ],
                timezone: 'UTC',
              },
            },
          }),
        });

        for (const row of aggregateData.data?.attributes?.data || []) {
          const attrType = (row.dimensions?.[0] || '').toLowerCase();
          const revenue = (row.measurements?.sum_value || []).reduce((s: number, v: number) => s + v, 0);
          const count = (row.measurements?.count || []).reduce((s: number, v: number) => s + v, 0);
          if (attrType === 'campaign') {
            emailRevenue.campaigns += revenue;
          } else if (attrType === 'flow') {
            emailRevenue.flows += revenue;
          }
          emailRevenue.orders += count;
        }
        emailRevenue.total = emailRevenue.campaigns + emailRevenue.flows;
      } catch (revenueErr) {
        console.error('[Performance Summary] Klaviyo revenue fetch failed:', revenueErr);
      }
    }

    return {
      stats: {
        totalSubscribers,
        avgOpenRate: '0',
        avgClickRate: '0',
        activeFlows,
        totalFlows,
        emailRevenue,
      },
      fetchError: null as IntegrationFetchError | null,
    };
  } catch (error) {
    console.error('[Performance Summary] Klaviyo stats fetch failed:', error);
    return { stats: null, fetchError: mapIntegrationFetchError(error, 'klaviyo') };
  }
}

function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function hasIntegrationFetchErrors(result: {
  platforms: {
    meta: { fetchError?: IntegrationFetchError };
    shopify: { fetchError?: IntegrationFetchError };
    klaviyo: { fetchError?: IntegrationFetchError };
  };
}): boolean {
  return Boolean(
    result.platforms.meta.fetchError ||
      result.platforms.shopify.fetchError ||
      result.platforms.klaviyo.fetchError,
  );
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
  const origin = request.nextUrl.origin;

  if (isDemoTenant(tenantId)) {
    const platformStatuses = {
      meta: { connected: true },
      shopify: { connected: true },
      klaviyo: { connected: true },
      google: { connected: true },
      tiktok: { connected: false },
      snapchat: { connected: false },
    };
    return Response.json(getDemoPerformanceSummary(days, platformStatuses));
  }

  clearOldCache();
  const cacheKey = getCacheKey(tenantId, days);
  const cached = cache.get(cacheKey);
  if (cached) {
    return Response.json(cached.data);
  }

  const cookieHeader = request.headers.get('cookie') || undefined;

  try {
    const platformStatuses = await getPerformancePlatformStatuses(tenantId);

    const metaConnected = platformStatuses.meta.connected;
    const metaAdsReady = platformStatuses.meta.adsReady ?? false;
    const shopifyConnected = platformStatuses.shopify.connected;
    const klaviyoConnected = platformStatuses.klaviyo.connected;

    const [metaCurrent, shopifyCurrent, metaPrev, shopifyPrev, klaviyoResult] = await Promise.all([
      metaAdsReady ? fetchMetaStats(tenantId, days) : Promise.resolve({ stats: null, fetchError: null }),
      fetchShopifyStats(tenantId, days, origin, cookieHeader),
      metaAdsReady ? fetchMetaStats(tenantId, days * 2) : Promise.resolve({ stats: null, fetchError: null }),
      fetchShopifyStats(tenantId, days * 2, origin, cookieHeader),
      fetchKlaviyoStats(tenantId, days),
    ]);

    const metaDataAvailable = Boolean(metaCurrent.stats);
    const metaFetchError = metaConnected && !metaAdsReady
      ? metaNoAdAccountError()
      : metaConnected && metaAdsReady && !metaDataAvailable
        ? metaCurrent.fetchError || metaPrev.fetchError
        : null;

    const shopifyStats = shopifyCurrent.stats || EMPTY_SHOPIFY;
    const shopifyPrevStats = shopifyPrev.stats || EMPTY_SHOPIFY;
    const shopifyDataAvailable = Boolean(shopifyCurrent.stats);
    const shopifyFetchError =
      shopifyConnected && !shopifyDataAvailable ? shopifyCurrent.fetchError : null;

    const klaviyoStats = klaviyoResult.stats;
    const klaviyoFetchError =
      klaviyoConnected && !klaviyoStats ? klaviyoResult.fetchError : null;

    const revenue = shopifyStats.revenue;
    const revenuePrev = shopifyPrevStats.revenue;
    const revenueChange = calculatePercentageChange(revenue, revenuePrev);

    const metaStats = metaCurrent.stats;
    const metaPrevStats = metaPrev.stats;

    const adSpend = metaDataAvailable && metaStats ? metaStats.spend : null;
    const adSpendPrev = metaDataAvailable && metaPrevStats ? metaPrevStats.spend : null;
    const adSpendChange =
      adSpend !== null && adSpendPrev !== null
        ? calculatePercentageChange(adSpend, adSpendPrev)
        : null;

    const cogs = shopifyStats.cogs;
    const shipping = shopifyStats.shipping;
    const gatewayFees = shopifyStats.gatewayFees;

    const netProfit =
      metaDataAvailable && adSpend !== null
        ? revenue - adSpend - cogs - shipping - gatewayFees
        : shopifyDataAvailable
          ? revenue - cogs - shipping - gatewayFees
          : null;
    const netProfitPrev =
      metaDataAvailable && metaPrevStats
        ? revenuePrev -
          metaPrevStats.spend -
          shopifyPrevStats.cogs -
          shopifyPrevStats.shipping -
          shopifyPrevStats.gatewayFees
        : shopifyDataAvailable
          ? revenuePrev - shopifyPrevStats.cogs - shopifyPrevStats.shipping - shopifyPrevStats.gatewayFees
          : null;
    const netProfitChange =
      netProfit !== null && netProfitPrev !== null
        ? calculatePercentageChange(netProfit, netProfitPrev)
        : null;

    const blendedROAS =
      metaDataAvailable && adSpend !== null && adSpend > 0 ? revenue / adSpend : null;
    const blendedROASPrev =
      metaDataAvailable && metaPrevStats && metaPrevStats.spend > 0
        ? revenuePrev / metaPrevStats.spend
        : null;
    const blendedROASChange =
      blendedROAS !== null && blendedROASPrev !== null
        ? calculatePercentageChange(blendedROAS, blendedROASPrev)
        : null;

    const orders = shopifyStats.orders;
    const ordersPrev = shopifyPrevStats.orders;
    const ordersChange = calculatePercentageChange(orders, ordersPrev);

    const aov = shopifyStats.aov;
    const aovPrev = shopifyPrevStats.aov;
    const aovChange = calculatePercentageChange(aov, aovPrev);

    const newCustomers = shopifyStats.newCustomers;
    const newCustomersPrev = shopifyPrevStats.newCustomers;
    const newCustomersChange = calculatePercentageChange(newCustomers, newCustomersPrev);

    const cac =
      metaDataAvailable && adSpend !== null && newCustomers > 0 ? adSpend / newCustomers : null;
    const cacPrev =
      metaDataAvailable && metaPrevStats && newCustomersPrev > 0
        ? metaPrevStats.spend / newCustomersPrev
        : null;
    const cacChange =
      cac !== null && cacPrev !== null ? calculatePercentageChange(cac, cacPrev) : null;

    const conversionRate =
      metaDataAvailable && metaStats && metaStats.clicks > 0
        ? (metaStats.purchases / metaStats.clicks) * 100
        : null;
    const conversionRatePrev =
      metaDataAvailable && metaPrevStats && metaPrevStats.clicks > 0
        ? (metaPrevStats.purchases / metaPrevStats.clicks) * 100
        : null;
    const conversionRateChange =
      conversionRate !== null && conversionRatePrev !== null
        ? calculatePercentageChange(conversionRate, conversionRatePrev)
        : null;

    const grossMargin = revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0;
    const grossMarginPrev =
      revenuePrev > 0 ? ((revenuePrev - shopifyPrevStats.cogs) / revenuePrev) * 100 : 0;
    const grossMarginChange = calculatePercentageChange(grossMargin, grossMarginPrev);

    const result = {
      timeframe: `${days}d`,
      revenue: { total: revenue, change: revenueChange },
      adSpend: { total: adSpend, change: adSpendChange },
      netProfit: { total: netProfit, change: netProfitChange },
      blendedROAS: { value: blendedROAS, change: blendedROASChange },
      orders: { total: orders, change: ordersChange },
      aov: { value: aov, change: aovChange },
      newCustomers: { total: newCustomers, change: newCustomersChange },
      returningCustomers: {
        total: shopifyStats.returningCustomers,
        change: calculatePercentageChange(
          shopifyStats.returningCustomers,
          shopifyPrevStats.returningCustomers,
        ),
      },
      cac: { value: cac, change: cacChange },
      conversionRate: { value: conversionRate, change: conversionRateChange },
      refunds: { total: shopifyStats.refunds, rate: shopifyStats.refundRate },
      cogs: { total: cogs },
      shipping: { total: shipping },
      gatewayFees: { total: gatewayFees },
      grossMargin: { value: grossMargin, change: grossMarginChange },
      platforms: {
        meta: {
          connected: metaConnected,
          adsReady: metaAdsReady,
          adAccountCount: platformStatuses.meta.adAccountCount ?? 0,
          dataAvailable: metaDataAvailable,
          ...(metaFetchError ? { fetchError: metaFetchError } : {}),
          ...(metaDataAvailable && metaStats
            ? {
                spend: metaStats.spend,
                roas: metaStats.roas,
                purchases: metaStats.purchases,
                cpc: metaStats.cpc,
                ctr: metaStats.ctr,
                cpm: metaStats.cpm,
                impressions: metaStats.impressions,
                clicks: metaStats.clicks,
              }
            : {}),
        },
        shopify: {
          connected: shopifyConnected,
          dataAvailable: shopifyDataAvailable,
          ...(shopifyFetchError ? { fetchError: shopifyFetchError } : {}),
        },
        klaviyo: {
          connected: klaviyoConnected,
          dataAvailable: Boolean(klaviyoStats),
          ...(klaviyoFetchError ? { fetchError: klaviyoFetchError } : {}),
          totalSubscribers: klaviyoStats?.totalSubscribers || 0,
          activeFlows: klaviyoStats?.activeFlows || 0,
          totalFlows: klaviyoStats?.totalFlows || 0,
          avgOpenRate: parseFloat(klaviyoStats?.avgOpenRate || '0'),
          avgClickRate: parseFloat(klaviyoStats?.avgClickRate || '0'),
          emailRevenue: klaviyoStats?.emailRevenue || {
            total: 0,
            campaigns: 0,
            flows: 0,
            orders: 0,
          },
        },
        google: { connected: platformStatuses.google?.connected || false, comingSoon: true },
        tiktok: { connected: platformStatuses.tiktok?.connected || false, comingSoon: true },
        snapchat: { connected: platformStatuses.snapchat?.connected || false, comingSoon: true },
      },
    };

    if (!hasIntegrationFetchErrors(result)) {
      cache.set(cacheKey, { data: result, timestamp: Date.now() });
    }

    return Response.json(result);
  } catch (error) {
    console.error('[Performance Summary] Error:', error);
    return Response.json({ error: 'Failed to fetch performance summary' }, { status: 500 });
  }
}
