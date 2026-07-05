"use client";

import { useState, useEffect, useCallback } from "react";
import { getSession, getSessionTenantId } from "../../../lib/session";
import {
  buildShopifyConnectHref,
  SHOPIFY_RETURN_PATHS,
} from "../../../lib/shopify-oauth";
import { PERFORMANCE_META_RECONNECT_HREF } from "../../../lib/performance-constants";

type IntegrationFetchError = {
  code: string;
  message: string;
  reconnectHref: string;
};

type MetaStatus = {
  connected: boolean;
  accountIds?: string[];
  accountId?: string;
};
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import ConnectionStatus from "../../../components/ConnectionStatus";
import AppSettingsPanel from "../../../components/AppSettingsPanel";

interface PlatformStatus {
  id: string;
  name: string;
  connected: boolean;
  comingSoon?: boolean;
  stats?: {
    spend: number;
    roas: number;
    cpc: number;
    purchases: number;
    ctr: number;
    impressions?: number;
    clicks?: number;
  };
}

interface SummaryData {
  timeframe: string;
  revenue: { total: number; change: number };
  adSpend: { total: number | null; change: number | null };
  netProfit: { total: number | null; change: number | null };
  blendedROAS: { value: number | null; change: number | null };
  orders: { total: number; change: number };
  aov: { value: number; change: number };
  newCustomers: { total: number; change: number };
  returningCustomers: { total: number; change: number };
  cac: { value: number | null; change: number | null };
  conversionRate: { value: number | null; change: number | null };
  refunds: { total: number; rate: number };
  cogs: { total: number };
  shipping: { total: number };
  gatewayFees: { total: number };
  grossMargin: { value: number; change: number };
  platforms: {
    meta: {
      connected: boolean;
      adsReady?: boolean;
      adAccountCount?: number;
      dataAvailable?: boolean;
      fetchError?: IntegrationFetchError;
      spend?: number;
      roas?: number;
      purchases?: number;
      cpc?: number;
      ctr?: number;
      cpm?: number;
      impressions?: number;
      clicks?: number;
    };
    shopify: { connected: boolean };
    klaviyo: {
      connected: boolean;
      totalSubscribers: number;
      activeFlows: number;
      totalFlows: number;
      avgOpenRate: number;
      avgClickRate: number;
      emailRevenue: {
        total: number;
        campaigns: number;
        flows: number;
        orders: number;
      };
    };
    google: { connected: boolean; comingSoon: boolean };
    tiktok: { connected: boolean; comingSoon: boolean };
    snapchat: { connected: boolean; comingSoon: boolean };
  };
}

interface DailyData {
  date: string;
  revenue: number;
  adSpend: number | null;
  netProfit: number;
}

function formatEUR(val: number): string {
  if (isNaN(val)) return "EUR 0.00";
  return `EUR ${val.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(val: number): string {
  if (isNaN(val)) return "0%";
  const sign = val >= 0 ? "+" : "";
  return `${sign}${val.toFixed(1)}%`;
}

function formatNumber(val: number): string {
  if (isNaN(val)) return "0";
  return val.toLocaleString("nl-NL", { maximumFractionDigits: 0 });
}

function formatROAS(val: number): string {
  if (isNaN(val)) return "0.00x";
  return `${val.toFixed(2)}x`;
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      "Performance API returned an unexpected response. Refresh and try again.",
    );
  }
  return res.json() as Promise<T>;
}

export default function PerformancePage() {
  const [platforms, setPlatforms] = useState<PlatformStatus[]>([
    { id: "shopify", name: "Shopify", connected: false, comingSoon: false },
    { id: "meta", name: "Meta Ads", connected: false, comingSoon: false },
    { id: "klaviyo", name: "Klaviyo", connected: false, comingSoon: false },
    { id: "google", name: "Google Ads", connected: false, comingSoon: true },
    { id: "tiktok", name: "TikTok Ads", connected: false, comingSoon: true },
    {
      id: "snapchat",
      name: "Snapchat Ads",
      connected: false,
      comingSoon: true,
    },
  ]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeframe, setTimeframe] = useState(7); // days
  const [error, setError] = useState<string | null>(null);
  const [metaStatus, setMetaStatus] = useState<MetaStatus | null>(null);
  const [metaCampaignError, setMetaCampaignError] = useState<string | null>(
    null,
  );
  const [metaTokenWarning, setMetaTokenWarning] = useState<string | null>(null);

  interface CampaignInsight {
    id: string;
    name: string;
    status: string;
    objective: string;
    spend: number;
    impressions: number;
    reach: number;
    clicks: number;
    cpc: number;
    cpm: number;
    ctr: number;
    frequency: number;
    purchases: number;
    purchaseValue: number;
    roas: number;
  }

  const [campaigns, setCampaigns] = useState<CampaignInsight[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);

  const getTenantId = () => getSessionTenantId(getSession());

  const fetchAllData = useCallback(
    async (showLoading = true) => {
      const tenantId = getTenantId();
      if (!tenantId) return;

      if (showLoading) setLoading(true);
      setRefreshing(true);
      setError(null);
      setMetaCampaignError(null);
      try {
        // Fetch platform statuses
        const updatedPlatforms = [...platforms];

        // Shopify status
        try {
          const shopifyRes = await fetch(
            `/api/auth/shopify/status?tenant_id=${encodeURIComponent(tenantId)}`,
          );
          if (shopifyRes.ok) {
            const shopifyData = await shopifyRes.json();
            updatedPlatforms[0].connected = shopifyData.connected || false;
          }
        } catch {}

        // Meta status
        try {
          const metaRes = await fetch(
            `/api/auth/meta/status?tenant_id=${encodeURIComponent(tenantId)}`,
          );
          if (metaRes.ok) {
            const metaData = await metaRes.json();
            updatedPlatforms[1].connected = metaData.connected || false;
            setMetaStatus(metaData);
          }
        } catch {}

        try {
          const healthRes = await fetch(
            `/api/integrations/health?tenant_id=${encodeURIComponent(tenantId)}`,
          );
          if (healthRes.ok) {
            const healthData = await healthRes.json();
            const metaHealth = (healthData.health || []).find(
              (row: { provider: string }) => row.provider === "meta",
            );
            if (
              metaHealth?.tokenStatus === "expiring_soon" &&
              metaHealth.action
            ) {
              setMetaTokenWarning(metaHealth.action);
            } else {
              setMetaTokenWarning(null);
            }
          }
        } catch {
          setMetaTokenWarning(null);
        }

        // Klaviyo status
        try {
          const klaviyoRes = await fetch(
            `/api/auth/klaviyo/status?tenant_id=${encodeURIComponent(tenantId)}`,
          );
          if (klaviyoRes.ok) {
            const klaviyoData = await klaviyoRes.json();
            updatedPlatforms[2].connected = klaviyoData.connected || false;
          }
        } catch {}

        // Google, TikTok, Snapchat blijven coming soon
        setPlatforms(updatedPlatforms);

        // Fetch performance summary
        const summaryRes = await fetch(
          `/api/performance/summary?tenant_id=${encodeURIComponent(tenantId)}&days=${timeframe}`,
        );
        if (!summaryRes.ok) {
          throw new Error(`Failed to fetch summary: ${summaryRes.status}`);
        }
        const summaryData = await parseJsonResponse<
          SummaryData & { error?: string }
        >(summaryRes);
        if (summaryData.error) {
          throw new Error(summaryData.error);
        }
        setSummary(summaryData);

        // Fetch daily performance data
        const dailyRes = await fetch(
          `/api/performance/daily?tenant_id=${encodeURIComponent(tenantId)}&days=${timeframe}`,
        );
        if (dailyRes.ok) {
          const dailyPayload = await parseJsonResponse<
            { series?: DailyData[] } | DailyData[]
          >(dailyRes);
          const series = Array.isArray(dailyPayload)
            ? dailyPayload
            : dailyPayload.series || [];
          setDailyData(series);
        } else {
          setDailyData([]);
        }

        // Fetch campaign insights
        setCampaignsLoading(true);
        try {
          const campRes = await fetch(
            `/api/ads/campaign-insights?tenant_id=${encodeURIComponent(tenantId)}&days=${timeframe}`,
          );
          if (campRes.ok) {
            const campData = await campRes.json();
            setCampaigns(campData.campaigns || []);
          } else if (campRes.status === 401) {
            const campBody = await campRes.json().catch(() => ({}));
            setMetaCampaignError(
              typeof campBody.error === "string"
                ? campBody.error
                : "Meta token expired. Reconnect to load campaign data.",
            );
            setCampaigns([]);
          } else {
            setCampaigns([]);
          }
        } catch {}
        setCampaignsLoading(false);
      } catch (err: any) {
        console.error("[Performance] Failed to fetch data:", err);
        setError(err.message || "Failed to load performance data");
      } finally {
        if (showLoading) setLoading(false);
        setRefreshing(false);
      }
    },
    [timeframe],
  );

  useEffect(() => {
    fetchAllData();
  }, [timeframe]);

  // Auto-refresh when query param ?connected is present (OAuth callback)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("connected")) {
      // Refresh data after a short delay to allow backend to process
      setTimeout(() => {
        fetchAllData();
        // Remove query param without reload
        window.history.replaceState({}, "", "/dashboard/performance");
      }, 1000);
    }
  }, []);

  const metaSetupHref = PERFORMANCE_META_RECONNECT_HREF;

  const handleConnect = (platformId: string, isConnected?: boolean) => {
    const tenantId = getTenantId();
    if (!tenantId) return;
    if (platformId === "meta") {
      if (isConnected) {
        window.location.href = metaSetupHref;
      } else {
        const returnTo = encodeURIComponent("/dashboard/performance");
        window.location.href = `/api/auth/meta/connect?tenant_id=${encodeURIComponent(tenantId)}&return_to=${returnTo}`;
      }
    } else if (platformId === "shopify") {
      window.location.href = buildShopifyConnectHref({
        tenantId,
        returnTo: SHOPIFY_RETURN_PATHS.performance,
      });
    } else if (platformId === "klaviyo") {
      if (isConnected) {
        window.location.href = "/dashboard/settings";
      } else {
        window.location.href = `/api/auth/klaviyo/connect?tenant_id=${encodeURIComponent(tenantId)}`;
      }
    } else {
      // others: link to settings
      window.location.href = "/dashboard/settings";
    }
  };

  const timeframes = [
    { label: "Today", value: 1 },
    { label: "7 days", value: 7 },
    { label: "14 days", value: 14 },
    { label: "30 days", value: 30 },
    { label: "90 days", value: 90 },
  ];

  const metaAccountCount =
    summary?.platforms.meta.adAccountCount ??
    metaStatus?.accountIds?.length ??
    (metaStatus?.accountId
      ? metaStatus.accountId.split(",").filter(Boolean).length
      : 0);

  const shopifyConnected =
    summary?.platforms.shopify.connected ??
    platforms.find((p) => p.id === "shopify")?.connected ??
    false;
  const metaConnected =
    summary?.platforms.meta.connected ??
    platforms.find((p) => p.id === "meta")?.connected ??
    false;
  const metaAdsReady = summary?.platforms.meta.adsReady ?? metaAccountCount > 0;
  const metaDataAvailable = summary?.platforms.meta.dataAvailable ?? false;
  const metaFetchError = summary?.platforms.meta.fetchError;
  const klaviyoConnected = summary?.platforms.klaviyo?.connected ?? false;
  const metaHasZeroActivity =
    metaAdsReady &&
    metaDataAvailable &&
    summary?.platforms.meta.spend === 0 &&
    (summary?.platforms.meta.impressions ?? 0) === 0;

  const metaReconnectHref = metaFetchError?.reconnectHref || metaSetupHref;

  const kpiCards = summary
    ? (() => {
        const cards: Array<{
          title: string;
          value: string;
          change: number | null;
          color: string;
          bgColor: string;
          borderColor: string;
        }> = [];
        // Shopify KPIs - only when Shopify is connected
        if (shopifyConnected) {
          cards.push(
            {
              title: "Revenue",
              value: formatEUR(summary.revenue.total),
              change: summary.revenue.change,
              color: "text-gray-900",
              bgColor: "bg-gray-50",
              borderColor: "border-gray-200",
            },
            {
              title: "Orders",
              value: formatNumber(summary.orders.total),
              change: summary.orders.change,
              color: "text-gray-900",
              bgColor: "bg-gray-50",
              borderColor: "border-gray-200",
            },
            {
              title: "AOV",
              value: formatEUR(summary.aov.value),
              change: summary.aov.change,
              color: "text-gray-900",
              bgColor: "bg-gray-50",
              borderColor: "border-gray-200",
            },
          );
        }
        // Meta KPIs - when ad account is ready and insights loaded (including zero-activity periods)
        if (
          metaAdsReady &&
          metaDataAvailable &&
          summary.platforms.meta.spend !== undefined
        ) {
          cards.push(
            {
              title: "Ad Spend",
              value: formatEUR(summary.adSpend.total ?? 0),
              change: summary.adSpend.change,
              color: "text-gray-900",
              bgColor: "bg-gray-50",
              borderColor: "border-gray-200",
            },
            {
              title: "ROAS",
              value: formatROAS(summary.platforms.meta.roas ?? 0),
              change: null,
              color: "text-gray-900",
              bgColor: "bg-gray-50",
              borderColor: "border-gray-200",
            },
            {
              title: "CPC",
              value: formatEUR(summary.platforms.meta.cpc ?? 0),
              change: null,
              color: "text-gray-900",
              bgColor: "bg-gray-50",
              borderColor: "border-gray-200",
            },
            {
              title: "CTR",
              value: `${(summary.platforms.meta.ctr ?? 0).toFixed(2)}%`,
              change: null,
              color: "text-gray-900",
              bgColor: "bg-gray-50",
              borderColor: "border-gray-200",
            },
            {
              title: "Purchases",
              value: formatNumber(summary.platforms.meta.purchases ?? 0),
              change: null,
              color: "text-gray-900",
              bgColor: "bg-gray-50",
              borderColor: "border-gray-200",
            },
          );
        }
        // Klaviyo KPIs - only when Klaviyo is connected
        if (klaviyoConnected) {
          cards.push(
            {
              title: "Email Revenue",
              value: formatEUR(
                summary.platforms.klaviyo.emailRevenue?.total || 0,
              ),
              change: null,
              color: "text-gray-900",
              bgColor: "bg-gray-50",
              borderColor: "border-gray-200",
            },
            {
              title: "Subscribers",
              value: formatNumber(summary.platforms.klaviyo.totalSubscribers),
              change: null,
              color: "text-gray-900",
              bgColor: "bg-gray-50",
              borderColor: "border-gray-200",
            },
          );
        }
        // Combined KPIs - Shopify + Meta when both have usable data
        if (
          shopifyConnected &&
          metaConnected &&
          metaDataAvailable &&
          summary.netProfit.total !== null
        ) {
          const netTotal = summary.netProfit.total;
          cards.push(
            {
              title: "Net Profit",
              value: formatEUR(netTotal),
              change: summary.netProfit.change,
              color: netTotal >= 0 ? "text-green-700" : "text-red-700",
              bgColor: netTotal >= 0 ? "bg-green-50" : "bg-red-50",
              borderColor:
                netTotal >= 0 ? "border-green-200" : "border-red-200",
            },
            {
              title: "Blended ROAS",
              value: formatROAS(summary.blendedROAS.value ?? 0),
              change: summary.blendedROAS.change,
              color: "text-gray-900",
              bgColor: "bg-gray-50",
              borderColor: "border-gray-200",
            },
            {
              title: "CAC",
              value: formatEUR(summary.cac.value ?? 0),
              change: summary.cac.change,
              color: "text-gray-900",
              bgColor: "bg-gray-50",
              borderColor: "border-gray-200",
            },
            {
              title: "New Customers",
              value: formatNumber(summary.newCustomers.total),
              change: summary.newCustomers.change,
              color: "text-gray-900",
              bgColor: "bg-gray-50",
              borderColor: "border-gray-200",
            },
          );
        } else if (shopifyConnected && metaConnected && !metaDataAvailable) {
          cards.push({
            title: "New Customers",
            value: formatNumber(summary.newCustomers.total),
            change: summary.newCustomers.change,
            color: "text-gray-900",
            bgColor: "bg-gray-50",
            borderColor: "border-gray-200",
          });
        }
        return cards;
      })()
    : [];

  const profitBreakdown = summary
    ? [
        {
          label: "Revenue",
          value: summary.revenue.total,
          percentage: 100,
          color: "#10b981",
        },
        {
          label: "COGS",
          value: summary.cogs.total,
          percentage:
            summary.revenue.total > 0
              ? (summary.cogs.total / summary.revenue.total) * 100
              : 0,
          color: "#ef4444",
        },
        {
          label: "Shipping",
          value: summary.shipping.total,
          percentage:
            summary.revenue.total > 0
              ? (summary.shipping.total / summary.revenue.total) * 100
              : 0,
          color: "#f59e0b",
        },
        {
          label: "Gateway Fees",
          value: summary.gatewayFees.total,
          percentage:
            summary.revenue.total > 0
              ? (summary.gatewayFees.total / summary.revenue.total) * 100
              : 0,
          color: "#8b5cf6",
        },
        ...(summary.adSpend.total !== null
          ? [
              {
                label: "Ad Spend",
                value: summary.adSpend.total,
                percentage:
                  summary.revenue.total > 0
                    ? (summary.adSpend.total / summary.revenue.total) * 100
                    : 0,
                color: "#3b82f6",
              },
            ]
          : []),
      ]
    : [];

  const hasAnyDataSource = shopifyConnected || metaConnected;
  const noPlatformsConnected = !loading && !error && !hasAnyDataSource;
  const onlyShopifyConnected =
    hasAnyDataSource && shopifyConnected && !metaConnected;
  const onlyMetaConnected =
    hasAnyDataSource && !shopifyConnected && metaConnected;
  const metaNeedsAdAccount =
    metaConnected &&
    !metaAdsReady &&
    metaFetchError?.code !== "META_NO_AD_ACCOUNT";

  return (
    <ConnectionStatus
      connections={[
        { platform: "shopify", required: false },
        { platform: "meta", required: false },
        { platform: "klaviyo", required: false },
      ]}
    >
      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Performance</h1>
            <p className="mt-1 text-sm text-gray-600">
              E-commerce profit command center
            </p>
          </div>
          <button
            onClick={() => fetchAllData(false)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-800 transition-colors bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            {refreshing ? (
              <>
                <div className="w-4 h-4 border-2 border-gray-300 rounded-full border-t-gray-800 animate-spin"></div>
                Refreshing...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh
              </>
            )}
          </button>
        </div>

        <AppSettingsPanel
          appName="Performance"
          appKey="performance"
          directory="/dashboard/performance"
          integrations={[
            {
              provider: "shopify",
              label: "Shopify revenue",
              href: buildShopifyConnectHref({
                tenantId: getTenantId(),
                returnTo: SHOPIFY_RETURN_PATHS.performance,
              }),
            },
            { provider: "meta", label: "Meta Ads spend", href: metaSetupHref },
            {
              provider: "klaviyo",
              label: "Klaviyo revenue",
              href: "/dashboard/settings?tab=integrations",
            },
          ]}
          settingsName="Performance settings"
          description="Performance has its own reporting directory, metric preferences, and dashboard notes."
        />

        {/* Timeframe selector */}
        <div className="flex flex-wrap gap-2 mb-8">
          {timeframes.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                timeframe === tf.value
                  ? "bg-blue-50 border-blue-500 text-blue-600"
                  : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {metaTokenWarning && !metaFetchError && (
          <div className="flex items-center justify-between p-4 mb-6 border glass rounded-2xl border-amber-200 bg-amber-50 text-amber-900">
            <span className="text-sm">{metaTokenWarning}</span>
            <a
              href={metaSetupHref}
              className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 shrink-0 ml-4"
            >
              Manage Meta
            </a>
          </div>
        )}

        {metaNeedsAdAccount && (
          <div className="flex items-center justify-between gap-4 p-4 mb-6 border glass rounded-2xl border-amber-200 bg-amber-50 text-amber-900">
            <span className="text-sm">
              Meta is connected, but Performance needs an ad account selected
              before it can load spend and ROAS.
            </span>
            <a
              href={metaSetupHref}
              className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 shrink-0"
            >
              Select ad account
            </a>
          </div>
        )}

        {(metaFetchError || metaCampaignError) && (
          <div className="flex items-center justify-between gap-4 p-4 mb-6 text-red-800 border border-red-200 glass rounded-2xl bg-red-50">
            <span className="text-sm">
              {metaFetchError?.message || metaCampaignError}
            </span>
            <a
              href={metaReconnectHref}
              className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 shrink-0"
            >
              {metaFetchError?.code === "META_NO_AD_ACCOUNT"
                ? "Open Meta setup"
                : "Reconnect Meta"}
            </a>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="flex items-center justify-between p-4 mb-6 text-red-700 border border-red-200 glass rounded-2xl bg-red-50">
            <span className="text-sm">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-800 hover:text-red-900"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}

        {/* No platforms connected banner */}
        {noPlatformsConnected && (
          <div className="p-6 mb-6 text-blue-800 border border-blue-200 glass rounded-2xl bg-blue-50">
            <h3 className="mb-2 text-lg font-bold">
              Connect a platform to get started
            </h3>
            <p className="mb-4">
              Connect Shopify for revenue & order data, or Meta Ads for ad
              performance. Connect both for the full profit dashboard.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => handleConnect("shopify")}
                className="px-4 py-2 bg-[#3b82f6] text-white rounded-lg font-medium hover:bg-[#2563eb]"
              >
                Connect Shopify
              </button>
              <button
                onClick={() => handleConnect("meta")}
                className="px-4 py-2 bg-[#3b82f6] text-white rounded-lg font-medium hover:bg-[#2563eb]"
              >
                Connect Meta Ads
              </button>
            </div>
          </div>
        )}

        {/* Suggestion to connect other platform */}
        {onlyMetaConnected && !loading && (
          <div className="flex items-center justify-between p-4 mb-6 text-blue-700 border border-blue-100 glass rounded-2xl bg-blue-50/50">
            <span className="text-sm">
              Connect Shopify to unlock revenue, profit breakdown, and customer
              insights.
            </span>
            <button
              onClick={() => handleConnect("shopify")}
              className="px-3 py-1.5 bg-[#3b82f6] text-white rounded-lg text-sm font-medium hover:bg-[#2563eb] shrink-0 ml-4"
            >
              Connect Shopify
            </button>
          </div>
        )}
        {onlyShopifyConnected && !loading && (
          <div className="flex items-center justify-between p-4 mb-6 text-blue-700 border border-blue-100 glass rounded-2xl bg-blue-50/50">
            <span className="text-sm">
              Connect Meta Ads to see ad spend, ROAS, CPC, and campaign
              performance.
            </span>
            <button
              onClick={() => handleConnect("meta")}
              className="px-3 py-1.5 bg-[#3b82f6] text-white rounded-lg text-sm font-medium hover:bg-[#2563eb] shrink-0 ml-4"
            >
              Connect Meta Ads
            </button>
          </div>
        )}

        {!noPlatformsConnected && (
          <>
            {/* KPI Cards Row */}
            <div
              className={`grid grid-cols-2 md:grid-cols-4 ${kpiCards.length > 6 ? "lg:grid-cols-8" : kpiCards.length > 4 ? "lg:grid-cols-6" : "lg:grid-cols-4"} gap-3 mb-8`}
            >
              {loading
                ? Array.from({ length: 8 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="p-4 border border-gray-200 glass rounded-2xl bg-gray-50 animate-pulse"
                    >
                      <div className="h-4 mb-2 bg-gray-300 rounded"></div>
                      <div className="h-8 mb-1 bg-gray-400 rounded"></div>
                      <div className="w-16 h-3 bg-gray-300 rounded"></div>
                    </div>
                  ))
                : kpiCards.map((card, idx) => (
                    <div
                      key={idx}
                      className={`glass rounded-2xl p-4 border ${card.borderColor} ${card.bgColor}`}
                    >
                      <div className="mb-1 text-xs font-medium text-gray-500">
                        {card.title}
                      </div>
                      <div className={`text-xl font-bold ${card.color} mb-1`}>
                        {card.value}
                      </div>
                      {card.change !== null && (
                        <div
                          className={`text-xs font-medium ${card.change >= 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          {formatPercent(card.change)}
                        </div>
                      )}
                    </div>
                  ))}
            </div>
          </>
        )}

        {!noPlatformsConnected && (
          <>
            {/* Revenue vs Spend Chart */}
            <div className="p-6 mb-8 glass rounded-2xl">
              <h2 className="mb-6 text-xl font-bold text-gray-900">
                {shopifyConnected && metaConnected && metaDataAvailable
                  ? "Revenue vs Ad Spend"
                  : metaConnected && metaDataAvailable
                    ? "Ad Spend Over Time"
                    : "Revenue Over Time"}
              </h2>
              {loading ? (
                <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg animate-pulse"></div>
              ) : dailyData.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  No data available
                </div>
              ) : (
                <div className="h-64" style={{ minHeight: "256px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                      <YAxis
                        stroke="#6b7280"
                        fontSize={12}
                        tickFormatter={(value) =>
                          `EUR ${value.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}`
                        }
                      />
                      <Tooltip
                        formatter={(value) => [
                          `EUR ${Number(value).toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`,
                          "",
                        ]}
                      />
                      {shopifyConnected && (
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="#10b981"
                          fill="#10b981"
                          fillOpacity={0.1}
                          strokeWidth={2}
                          name="Revenue"
                        />
                      )}
                      {metaConnected && metaDataAvailable && (
                        <Area
                          type="monotone"
                          dataKey="adSpend"
                          stroke="#3b82f6"
                          fill="#3b82f6"
                          fillOpacity={0.1}
                          strokeWidth={2}
                          name="Ad Spend"
                        />
                      )}
                      {shopifyConnected &&
                        metaConnected &&
                        metaDataAvailable && (
                          <Area
                            type="monotone"
                            dataKey="netProfit"
                            stroke="#8b5cf6"
                            fill="#8b5cf6"
                            fillOpacity={0.1}
                            strokeWidth={2}
                            name="Net Profit"
                          />
                        )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </>
        )}

        {/* Profit Breakdown Card - only when Shopify connected */}
        {shopifyConnected && (
          <div className="p-6 mb-8 glass rounded-2xl">
            <h2 className="mb-6 text-xl font-bold text-gray-900">
              Profit Breakdown
            </h2>
            {loading ? (
              <div className="space-y-4 animate-pulse">
                <div className="w-full h-8 bg-gray-200 rounded-md"></div>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="w-16 h-4 bg-gray-300 rounded"></div>
                      <div className="w-20 h-6 bg-gray-400 rounded"></div>
                      <div className="w-12 h-3 bg-gray-300 rounded"></div>
                    </div>
                  ))}
                </div>
              </div>
            ) : !summary ? (
              <div className="flex items-center justify-center h-48 text-gray-500">
                No data available
              </div>
            ) : (
              <div className="space-y-4">
                {/* Horizontal stacked bar */}
                <div className="flex w-full h-8 overflow-hidden rounded-md">
                  {profitBreakdown.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: item.color,
                      }}
                      className="h-full transition-all"
                      title={`${item.label}: ${formatEUR(item.value)} (${item.percentage.toFixed(1)}%)`}
                    />
                  ))}
                </div>
                {/* Legend and values */}
                <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                  {profitBreakdown.map((item, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-sm"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm font-medium text-gray-700">
                          {item.label}
                        </span>
                      </div>
                      <div className="text-lg font-bold text-gray-900">
                        {formatEUR(item.value)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.percentage.toFixed(1)}%
                      </div>
                    </div>
                  ))}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-gray-900 rounded-sm" />
                      <span className="text-sm font-medium text-gray-700">
                        Net Profit
                      </span>
                    </div>
                    <div
                      className={`text-lg font-bold ${(summary.netProfit.total ?? 0) >= 0 ? "text-green-700" : "text-red-700"}`}
                    >
                      {summary.netProfit.total !== null
                        ? formatEUR(summary.netProfit.total)
                        : "-"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {summary.netProfit.total !== null &&
                      summary.revenue.total > 0
                        ? (
                            (summary.netProfit.total / summary.revenue.total) *
                            100
                          ).toFixed(1)
                        : "0"}
                      %
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Marketing Channels */}
        {summary && (metaConnected || klaviyoConnected) && (
          <div className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-gray-900">
              Marketing Channels
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* Meta Ads Channel */}
              {metaConnected &&
                metaDataAvailable &&
                summary.platforms.meta.spend !== undefined &&
                (() => {
                  const metaSpend = summary.platforms.meta.spend ?? 0;
                  const metaRoas = summary.platforms.meta.roas ?? 0;
                  const metaPurchases = summary.platforms.meta.purchases ?? 0;
                  const metaCtr = summary.platforms.meta.ctr ?? 0;
                  return (
                    <div className="p-6 border border-gray-200 glass rounded-2xl">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg">
                          <svg
                            className="w-5 h-5 text-blue-600"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            Meta Ads
                          </h3>
                          <span className="text-xs font-medium text-green-600">
                            Connected
                          </span>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Spend</span>
                          <span className="text-sm font-semibold">
                            {formatEUR(metaSpend)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">
                            Attributed Revenue
                          </span>
                          <span className="text-sm font-semibold">
                            {formatEUR(metaSpend * metaRoas)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">ROAS</span>
                          <span className="text-sm font-semibold">
                            {metaRoas.toFixed(2)}x
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">
                            Purchases
                          </span>
                          <span className="text-sm font-semibold">
                            {formatNumber(metaPurchases)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">CPA</span>
                          <span className="text-sm font-semibold">
                            {metaPurchases > 0
                              ? formatEUR(metaSpend / metaPurchases)
                              : "-"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">CTR</span>
                          <span className="text-sm font-semibold">
                            {metaCtr.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

              {/* Klaviyo Email Channel */}
              {klaviyoConnected && summary.platforms.klaviyo && (
                <div className="p-6 border border-gray-200 glass rounded-2xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-lg">
                      <svg
                        className="w-5 h-5 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        Klaviyo Email
                      </h3>
                      <span className="text-xs font-medium text-green-600">
                        Connected
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">
                        Email Revenue
                      </span>
                      <span className="text-sm font-semibold">
                        {formatEUR(
                          summary.platforms.klaviyo.emailRevenue?.total || 0,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">
                        Campaign Revenue
                      </span>
                      <span className="text-sm font-semibold">
                        {formatEUR(
                          summary.platforms.klaviyo.emailRevenue?.campaigns ||
                            0,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">
                        Flow Revenue
                      </span>
                      <span className="text-sm font-semibold">
                        {formatEUR(
                          summary.platforms.klaviyo.emailRevenue?.flows || 0,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Orders</span>
                      <span className="text-sm font-semibold">
                        {formatNumber(
                          summary.platforms.klaviyo.emailRevenue?.orders || 0,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Subscribers</span>
                      <span className="text-sm font-semibold">
                        {formatNumber(
                          summary.platforms.klaviyo.totalSubscribers,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">
                        Active Flows
                      </span>
                      <span className="text-sm font-semibold">
                        {summary.platforms.klaviyo.activeFlows}/
                        {summary.platforms.klaviyo.totalFlows}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Coming Soon Placeholder */}
              <div className="flex flex-col items-center justify-center p-6 text-center border border-gray-300 border-dashed glass rounded-2xl">
                <div className="flex items-center justify-center w-10 h-10 mb-3 bg-gray-100 rounded-lg">
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                </div>
                <h3 className="mb-1 font-semibold text-gray-500">
                  More channels coming soon
                </h3>
                <p className="text-xs text-gray-400">
                  Google Ads, TikTok Ads, Snapchat Ads
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Platform Connection Cards */}
        <div className="grid grid-cols-2 gap-4 mb-8 md:grid-cols-3 lg:grid-cols-6">
          {loading
            ? Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="flex flex-col items-center p-5 text-center glass rounded-2xl animate-pulse"
                >
                  <div className="w-10 h-10 mb-3 bg-gray-200 rounded-full"></div>
                  <div className="w-20 h-5 mb-4 bg-gray-300 rounded"></div>
                  <div className="w-full bg-gray-200 rounded-lg h-9"></div>
                </div>
              ))
            : platforms.map((platform) => (
                <div
                  key={platform.id}
                  className={`glass rounded-2xl p-5 flex flex-col items-center text-center ${platform.comingSoon && !platform.connected ? "opacity-50" : ""}`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${platform.connected ? "bg-green-100" : "bg-gray-100"}`}
                  >
                    {platform.connected ? (
                      <svg
                        className="w-5 h-5 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {platform.name}
                  </h3>
                  {platform.id === "meta" && platform.connected && (
                    <p className="mt-1 text-xs text-gray-500">
                      {metaAccountCount > 0
                        ? `${metaAccountCount} ad account${metaAccountCount !== 1 ? "s" : ""}`
                        : "No ad account selected"}
                    </p>
                  )}
                  <button
                    onClick={() =>
                      handleConnect(platform.id, platform.connected)
                    }
                    className={`mt-3 w-full py-2 rounded-lg text-sm font-medium ${
                      platform.connected
                        ? "bg-green-50 text-green-700 hover:bg-green-100"
                        : platform.comingSoon
                          ? "bg-gray-50 text-gray-400 cursor-not-allowed"
                          : "bg-[#3b82f6] text-white hover:bg-[#2563eb]"
                    }`}
                    disabled={platform.comingSoon && !platform.connected}
                  >
                    {platform.connected
                      ? "Manage"
                      : platform.comingSoon
                        ? "Coming Soon"
                        : "Connect"}
                  </button>
                </div>
              ))}
        </div>

        {/* Customer Insights Card */}
        {/* Live Campaigns Section */}
        {summary?.platforms.meta.connected &&
          (metaDataAvailable || metaCampaignError) && (
            <div className="p-6 mb-8 glass rounded-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  Live Campaigns
                </h2>
                {campaigns.length > 0 && (
                  <span className="text-sm text-gray-500">
                    {campaigns.length} campaigns
                  </span>
                )}
              </div>
              {campaignsLoading ? (
                <div className="space-y-3 animate-pulse">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-16 bg-gray-200 rounded-xl"></div>
                  ))}
                </div>
              ) : campaigns.length === 0 ? (
                <div className="py-12 text-center text-gray-500">
                  {metaCampaignError
                    ? "Reconnect Meta to load campaign performance."
                    : "No active campaigns found"}
                </div>
              ) : (
                <div className="space-y-2">
                  {campaigns.map((camp) => {
                    const isExpanded = expandedCampaign === camp.id;
                    const statusColor =
                      camp.status === "ACTIVE"
                        ? "bg-green-100 text-green-700"
                        : camp.status === "PAUSED"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-600";
                    return (
                      <div
                        key={camp.id}
                        className="overflow-hidden border border-gray-200 rounded-xl"
                      >
                        <button
                          onClick={() =>
                            setExpandedCampaign(isExpanded ? null : camp.id)
                          }
                          className="flex items-center w-full gap-4 px-4 py-3 text-left transition hover:bg-gray-50"
                        >
                          <svg
                            className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${isExpanded ? "rotate-90" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 truncate">
                                {camp.name}
                              </span>
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${statusColor}`}
                              >
                                {camp.status}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-6 text-sm shrink-0">
                            <div className="text-right">
                              <div className="text-xs text-gray-500">Spend</div>
                              <div className="font-semibold">
                                EUR {camp.spend.toFixed(2)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-gray-500">ROAS</div>
                              <div
                                className={`font-semibold ${camp.roas >= 2 ? "text-green-600" : camp.roas >= 1 ? "text-yellow-600" : "text-red-600"}`}
                              >
                                {camp.roas.toFixed(2)}x
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-gray-500">
                                Purchases
                              </div>
                              <div className="font-semibold">
                                {camp.purchases}
                              </div>
                            </div>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="px-4 pt-2 pb-4 border-t border-gray-100 bg-gray-50/50">
                            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
                              <div>
                                <div className="mb-1 text-xs text-gray-500">
                                  Impressions
                                </div>
                                <div className="font-semibold text-gray-900">
                                  {camp.impressions.toLocaleString()}
                                </div>
                              </div>
                              <div>
                                <div className="mb-1 text-xs text-gray-500">
                                  Reach
                                </div>
                                <div className="font-semibold text-gray-900">
                                  {camp.reach.toLocaleString()}
                                </div>
                              </div>
                              <div>
                                <div className="mb-1 text-xs text-gray-500">
                                  Clicks
                                </div>
                                <div className="font-semibold text-gray-900">
                                  {camp.clicks.toLocaleString()}
                                </div>
                              </div>
                              <div>
                                <div className="mb-1 text-xs text-gray-500">
                                  CTR
                                </div>
                                <div className="font-semibold text-gray-900">
                                  {camp.ctr.toFixed(2)}%
                                </div>
                              </div>
                              <div>
                                <div className="mb-1 text-xs text-gray-500">
                                  CPC
                                </div>
                                <div className="font-semibold text-gray-900">
                                  EUR {camp.cpc.toFixed(2)}
                                </div>
                              </div>
                              <div>
                                <div className="mb-1 text-xs text-gray-500">
                                  CPM
                                </div>
                                <div className="font-semibold text-gray-900">
                                  EUR {camp.cpm.toFixed(2)}
                                </div>
                              </div>
                              <div>
                                <div className="mb-1 text-xs text-gray-500">
                                  Frequency
                                </div>
                                <div className="font-semibold text-gray-900">
                                  {camp.frequency.toFixed(2)}
                                </div>
                              </div>
                              <div>
                                <div className="mb-1 text-xs text-gray-500">
                                  Purchase Value
                                </div>
                                <div className="font-semibold text-gray-900">
                                  EUR {camp.purchaseValue.toFixed(2)}
                                </div>
                              </div>
                              <div>
                                <div className="mb-1 text-xs text-gray-500">
                                  Objective
                                </div>
                                <div className="text-xs font-semibold text-gray-900">
                                  {camp.objective || "-"}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        {shopifyConnected && (
          <div className="p-6 mb-8 glass rounded-2xl">
            <h2 className="mb-6 text-xl font-bold text-gray-900">
              Customer Insights
            </h2>
            {loading ? (
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2 animate-pulse">
                <div>
                  <div className="w-48 h-6 mb-4 bg-gray-300 rounded"></div>
                  <div className="flex items-center gap-8">
                    <div className="w-32 h-32 bg-gray-200 rounded-full"></div>
                    <div className="space-y-4">
                      <div className="h-16 bg-gray-200 rounded"></div>
                      <div className="h-16 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="w-48 h-6 mb-4 bg-gray-300 rounded"></div>
                  <div className="space-y-4">
                    <div className="h-8 bg-gray-200 rounded"></div>
                    <div className="h-8 bg-gray-200 rounded"></div>
                    <div className="h-8 bg-gray-200 rounded"></div>
                    <div className="h-8 bg-gray-200 rounded"></div>
                  </div>
                </div>
              </div>
            ) : !summary ? (
              <div className="flex items-center justify-center h-48 text-gray-500">
                No data available
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <div>
                  <h3 className="mb-4 text-lg font-semibold text-gray-800">
                    New vs Returning Customers
                  </h3>
                  <div className="flex items-center gap-8">
                    <div className="relative w-32 h-32">
                      <svg viewBox="0 0 100 100" className="w-full h-full">
                        {/* Donut chart */}
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          stroke="#e5e7eb"
                          strokeWidth="20"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="20"
                          strokeDasharray={`${(summary.newCustomers.total / (summary.newCustomers.total + summary.returningCustomers.total)) * 251.2} 251.2`}
                          transform="rotate(-90 50 50)"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="text-2xl font-bold text-gray-900">
                          {summary.newCustomers.total +
                            summary.returningCustomers.total}
                        </div>
                        <div className="text-sm text-gray-600">Total</div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 bg-green-500 rounded-sm"></div>
                        <div>
                          <div className="font-medium text-gray-900">
                            New Customers
                          </div>
                          <div className="text-2xl font-bold">
                            {summary.newCustomers.total}
                          </div>
                          <div className="text-sm text-gray-600">
                            {summary.newCustomers.total +
                              summary.returningCustomers.total >
                            0
                              ? Math.round(
                                  (summary.newCustomers.total /
                                    (summary.newCustomers.total +
                                      summary.returningCustomers.total)) *
                                    100,
                                )
                              : 0}
                            % of total
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 bg-gray-300 rounded-sm"></div>
                        <div>
                          <div className="font-medium text-gray-900">
                            Returning Customers
                          </div>
                          <div className="text-2xl font-bold">
                            {summary.returningCustomers.total}
                          </div>
                          <div className="text-sm text-gray-600">
                            {summary.newCustomers.total +
                              summary.returningCustomers.total >
                            0
                              ? Math.round(
                                  (summary.returningCustomers.total /
                                    (summary.newCustomers.total +
                                      summary.returningCustomers.total)) *
                                    100,
                                )
                              : 0}
                            % of total
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="mb-4 text-lg font-semibold text-gray-800">
                    Customer Acquisition Cost Trend
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <div className="text-gray-600">CAC</div>
                      <div className="text-xl font-bold text-gray-900">
                        {summary.cac.value !== null
                          ? formatEUR(summary.cac.value)
                          : "-"}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <div className="text-gray-600">Change</div>
                      <div
                        className={`text-lg font-semibold ${(summary.cac.change ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        {summary.cac.change !== null
                          ? formatPercent(summary.cac.change)
                          : "-"}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <div className="text-gray-600">New Customers</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {formatNumber(summary.newCustomers.total)}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <div className="text-gray-600">Ad Spend</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {summary.adSpend.total !== null
                          ? formatEUR(summary.adSpend.total)
                          : "-"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Per-platform Ad Breakdown Table */}
        <div className="p-6 mb-8 glass rounded-2xl">
          <h2 className="mb-6 text-xl font-bold text-gray-900">
            Per‑Platform Ad Performance
          </h2>
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-2 border-gray-300 rounded-full border-t-blue-600 animate-spin"></div>
            </div>
          ) : !summary?.platforms.meta.connected || !metaDataAvailable ? (
            <div className="py-8 text-center">
              <svg
                className="w-12 h-12 mx-auto text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 0 002-2m0 0V5a2 2 0 012-2h2a2 0 012 2v14a2 2 0 01-2 2h-2a2 0 01-2-2z"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                No ad platforms connected
              </h3>
              <p className="mt-2 text-gray-600">
                Connect Meta Ads to see performance breakdown.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto" style={{ maxHeight: "480px" }}>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-sm font-semibold text-left text-gray-700">
                      Campaign
                    </th>
                    <th className="px-4 py-3 text-sm font-semibold text-right text-gray-700">
                      Spend
                    </th>
                    <th className="px-4 py-3 text-sm font-semibold text-right text-gray-700">
                      Revenue
                    </th>
                    <th className="px-4 py-3 text-sm font-semibold text-right text-gray-700">
                      ROAS
                    </th>
                    <th className="px-4 py-3 text-sm font-semibold text-right text-gray-700">
                      CPC
                    </th>
                    <th className="px-4 py-3 text-sm font-semibold text-right text-gray-700">
                      CTR
                    </th>
                    <th className="px-4 py-3 text-sm font-semibold text-right text-gray-700">
                      CPM
                    </th>
                    <th className="px-4 py-3 text-sm font-semibold text-right text-gray-700">
                      CPA
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Placeholder row - in production fetch actual campaigns */}
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      Meta Ads (aggregated)
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-right text-gray-900">
                      {formatEUR(summary.platforms.meta.spend ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-right text-gray-900">
                      {formatEUR(
                        (summary.platforms.meta.spend ?? 0) *
                          (summary.platforms.meta.roas ?? 0),
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-right text-gray-900">
                      {(summary.platforms.meta.roas ?? 0).toFixed(2)}x
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-right text-gray-900">
                      {formatEUR(summary.platforms.meta.cpc ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-right text-gray-900">
                      {(summary.platforms.meta.ctr ?? 0).toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-right text-gray-900">
                      {formatEUR(summary.platforms.meta.cpm ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-right text-gray-900">
                      {(summary.platforms.meta.purchases ?? 0) > 0
                        ? formatEUR(
                            (summary.platforms.meta.spend ?? 0) /
                              (summary.platforms.meta.purchases ?? 1),
                          )
                        : "-"}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="py-4 text-sm text-center text-gray-500">
                Detailed campaign breakdown coming soon
              </div>
            </div>
          )}
        </div>
      </div>
    </ConnectionStatus>
  );
}
