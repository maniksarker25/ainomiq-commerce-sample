import { NextRequest } from "next/server";
import { getShopifyTimezone } from "@/lib/shopify";
import { fetchAllOrders } from "@/lib/shopify-graphql";
import { getMetaTokenAndFetch } from "@/lib/meta";
import { isDemoTenant } from "@/lib/demo";
import { getDemoPerformanceDaily } from "@/lib/demo-data";
import { requireAuth, handleAuthError } from "@/lib/auth-guard";
import {
  mapIntegrationFetchError,
  type IntegrationFetchError,
} from "@/lib/performance-integrations";

// Helper to get date key (YYYY-MM-DD) in a given timezone
function getDateKey(date: Date, tz: string): string {
  return date.toLocaleDateString("sv-SE", { timeZone: tz }); // returns YYYY-MM-DD
}

// Helper to get start of day in a given timezone
function getStartOfDay(dateStr: string, tz: string): Date {
  const d = new Date(dateStr + "T00:00:00");
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "shortOffset",
  });
  const parts = formatter.formatToParts(d);
  const tzPart = parts.find((p) => p.type === "timeZoneName");
  const offsetMatch = tzPart?.value?.match(/GMT([+-]\d+)/);
  const offsetHours = offsetMatch ? parseInt(offsetMatch[1]) : 0;
  return new Date(
    dateStr +
      `T00:00:00.000${offsetHours >= 0 ? "+" : ""}${String(Math.abs(offsetHours)).padStart(2, "0")}:00`,
  );
}

// Format date key to locale string
function formatDate(dateKey: string, tz: string): string {
  const date = new Date(dateKey + "T12:00:00Z"); // noon UTC to avoid edge cases
  return date.toLocaleDateString("en-US", {
    timeZone: tz,
    day: "numeric",
    month: "short",
  });
}

function getDateKeys(days: number, tz: string): string[] {
  const today = new Date();
  const todayKey = getDateKey(today, tz);
  const utcDate = new Date(todayKey + "T00:00:00Z");
  const dateKeys = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(utcDate);
    d.setUTCDate(d.getUTCDate() - (days - 1 - i));
    dateKeys.push(d.toISOString().split("T")[0]);
  }
  return dateKeys;
}

// Store timezone is passed through to grouping
let tz = "UTC";

async function fetchAllShopifyOrders(
  tenantId: string,
  startDate: Date,
  endDate: Date,
) {
  return fetchAllOrders(tenantId, {
    createdAtMin: startDate,
    createdAtMax: endDate,
    maxOrders: 2500,
  });
}

async function fetchShopifyDailyRevenue(
  tenantId: string,
  startDate: Date,
  endDate: Date,
): Promise<{
  data: Map<string, number>;
  fetchError: IntegrationFetchError | null;
}> {
  try {
    const orders = await fetchAllShopifyOrders(
      tenantId,
      startDate,
      endDate,
    );

    const revenueByDay = new Map<string, number>();
    for (const order of orders) {
      if (!order.created_at) continue;
      const orderDate = new Date(order.created_at);
      const dateKey = getDateKey(orderDate, tz);
      const revenue = parseFloat(order.total_price || "0");
      revenueByDay.set(dateKey, (revenueByDay.get(dateKey) || 0) + revenue);
    }
    return { data: revenueByDay, fetchError: null };
  } catch (error) {
    console.error("[Daily] Failed to fetch Shopify daily revenue:", error);
    return {
      data: new Map<string, number>(),
      fetchError: mapIntegrationFetchError(error, "shopify"),
    };
  }
}

async function fetchMetaDailySpend(
  tenantId: string,
  startDate: Date,
  endDate: Date,
): Promise<{
  data: Map<string, number>;
  fetchError: IntegrationFetchError | null;
}> {
  try {
    const startStr = startDate.toISOString().split("T")[0];
    const endStr = endDate.toISOString().split("T")[0];
    const data = await getMetaTokenAndFetch(
      tenantId,
      `/{ad_account_id}/insights?fields=spend,date_start&time_increment=1&time_range={'since':'${startStr}','until':'${endStr}'}`,
    );
    const insights = data.data || [];
    const spendByDay = new Map<string, number>();
    for (const insight of insights) {
      const date = insight.date_start;
      const spend = parseFloat(insight.spend || "0");
      spendByDay.set(date, (spendByDay.get(date) || 0) + spend);
    }
    return { data: spendByDay, fetchError: null };
  } catch (error) {
    console.error("[Daily] Failed to fetch Meta daily spend:", error);
    return {
      data: new Map<string, number>(),
      fetchError: mapIntegrationFetchError(error, "meta"),
    };
  }
}

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  const { searchParams } = request.nextUrl;
  const daysParam = searchParams.get("days");
  const days = daysParam ? parseInt(daysParam, 10) : 7;
  const origin = request.nextUrl.origin;

  if (isDemoTenant(tenantId)) {
    return Response.json({ series: getDemoPerformanceDaily(days), errors: {} });
  }

  // Get store timezone from Shopify API
  let storeTz = "UTC";
  try {
    storeTz = await getShopifyTimezone(tenantId);
  } catch {}
  tz = storeTz;

  // Determine date range in store timezone
  const dateKeys = getDateKeys(days, storeTz);
  const startDate = getStartOfDay(dateKeys[0], storeTz);
  const lastDate = new Date(dateKeys[days - 1] + "T00:00:00Z");
  lastDate.setUTCDate(lastDate.getUTCDate() + 1);
  const endDateKey = lastDate.toISOString().split("T")[0];
  const endDate = getStartOfDay(endDateKey, storeTz);

  try {
    // Fetch Shopify daily revenue and Meta daily spend concurrently
    const [shopifyResult, metaResult] = await Promise.all([
      fetchShopifyDailyRevenue(tenantId, startDate, endDate),
      fetchMetaDailySpend(tenantId, startDate, endDate),
    ]);

    const metaDataAvailable = !metaResult.fetchError;
    const errors: Record<string, IntegrationFetchError> = {};
    if (metaResult.fetchError) errors.meta = metaResult.fetchError;
    if (shopifyResult.fetchError) errors.shopify = shopifyResult.fetchError;

    const series = dateKeys.map((dateKey) => {
      const revenue = shopifyResult.data.get(dateKey) || 0;
      const adSpend = metaDataAvailable
        ? metaResult.data.get(dateKey) || 0
        : null;
      const netProfit = adSpend !== null ? revenue - adSpend : revenue;
      return {
        date: formatDate(dateKey, storeTz),
        revenue,
        adSpend,
        netProfit,
      };
    });

    return Response.json({ series, errors });
  } catch (error: any) {
    console.error("[Daily] Error:", error);
    return Response.json(
      { error: "Failed to fetch daily performance data" },
      { status: 500 },
    );
  }
}
