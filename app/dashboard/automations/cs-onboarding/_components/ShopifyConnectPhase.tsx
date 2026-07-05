"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, Loader2 } from "lucide-react";
import {
  buildShopifyConnectHref,
  extractMyshopifyDomain,
  getShopifyAppStoreListingUrl,
  SHOPIFY_CONNECTOR_FREE_NOTICE,
  SHOPIFY_RETURN_PATHS,
} from "@/lib/shopify-oauth";
import { getSession, getSessionTenantId } from "@/lib/session";
import type { ScrapeResult } from "@/lib/scraper";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SetupStepIndicator } from "./SetupStepIndicator";
import { PlatformIcon } from "./shared";


export function ShopifyConnectPhase({
  data,
  onBack,
  onContinue,
}: {
  data: ScrapeResult;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [shopifyStatus, setShopifyStatus] = useState<{
    connected: boolean;
    shop?: string;
    loading: boolean;
  }>({ connected: false, loading: true });
  const [derivedShop, setDerivedShop] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const getTenantId = useCallback(() => getSessionTenantId(getSession()), []);

  // Check if Shopify is already connected
  useEffect(() => {
    const tenantId = getTenantId();
    if (!tenantId) {
      setShopifyStatus({ connected: false, loading: false });
      return;
    }
    fetch(
      `/api/auth/shopify/status?tenant_id=${encodeURIComponent(tenantId)}`,
      { credentials: "same-origin" },
    )
      .then((r) => r.json())
      .then((d) =>
        setShopifyStatus({
          connected: d.connected === true,
          shop: d.shop,
          loading: false,
        }),
      )
      .catch(() => setShopifyStatus({ connected: false, loading: false }));
  }, [getTenantId]);

  // Poll for connection after redirect
  useEffect(() => {
    if (shopifyStatus.connected || shopifyStatus.loading || !connecting) return;
    const interval = setInterval(() => {
      const tenantId = getTenantId();
      if (!tenantId) return;
      fetch(
        `/api/auth/shopify/status?tenant_id=${encodeURIComponent(tenantId)}`,
        { credentials: "same-origin" },
      )
        .then((r) => r.json())
        .then((d) => {
          if (d.connected) {
            setShopifyStatus({ connected: true, shop: d.shop, loading: false });
            setConnecting(false);
            clearInterval(interval);
          }
        })
        .catch(() => {});
    }, 2000);
    return () => clearInterval(interval);
  }, [shopifyStatus, connecting, getTenantId]);

  // Auto-detect shop from scraped store URL only (no manual myshopify.com field - App Store compliance).
  useEffect(() => {
    const fromUrl = extractMyshopifyDomain(data.storeUrl || "");
    setDerivedShop(fromUrl);
  }, [data.storeUrl]);

  const connectShopify = () => {
    const tenantId = getTenantId();
    if (!tenantId) return;
    setConnecting(true);
    if (derivedShop) {
      window.location.href = buildShopifyConnectHref({
        tenantId,
        shop: derivedShop,
        returnTo: SHOPIFY_RETURN_PATHS.csOnboarding,
      });
      return;
    }
    window.open(
      getShopifyAppStoreListingUrl(),
      "_blank",
      "noopener,noreferrer",
    );
  };

  const CS_SCOPES = [
    {
      scope: "read_orders",
      label: "Orders",
      description: "Look up order status, history, and details",
    },
    {
      scope: "read_customers",
      label: "Customers",
      description: "Access customer profiles and contact info",
    },
    {
      scope: "read_fulfillments",
      label: "Fulfillments",
      description: "Check shipment status and tracking numbers",
    },
    {
      scope: "read_products",
      label: "Products",
      description: "View product info, stock, and variants",
    },
    {
      scope: "read_shipping",
      label: "Shipping",
      description: "Access shipping rates and zones",
    },
    {
      scope: "read_returns",
      label: "Returns",
      description: "View return/refund status",
    },
  ];

  return (
    <div>
      <SetupStepIndicator current="shopify-connect" platform={data.platform} />
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Connect Shopify</h1>
          <p className="text-sm text-gray-500 mt-1">
            Connect your Shopify store so the AI agent can look up orders,
            tracking info, and customer data in real-time.
          </p>
          <p className="text-xs text-gray-400 mt-2 max-w-xl">
            {SHOPIFY_CONNECTOR_FREE_NOTICE}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
          <PlatformIcon platform="shopify" size={16} />
          <span className="text-sm font-medium text-gray-700">
            {data.storeInfo.name || "Shopify Store"}
          </span>
        </div>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Connection status */}
        <div
          className={`p-5 rounded-xl border ${shopifyStatus.connected ? "bg-green-50/50 border-green-200" : "bg-white border-gray-200"}`}
        >
          {shopifyStatus.loading ? (
            <div className="flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm text-gray-500">
                Checking Shopify connection...
              </span>
            </div>
          ) : shopifyStatus.connected ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-green-600"
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
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Shopify connected
                </p>
                <p className="text-xs text-gray-500">{shopifyStatus.shop}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
                  <PlatformIcon platform="shopify" size={16} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Connect your Shopify store
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    This allows the CS agent to access real order and customer
                    data when handling emails.
                  </p>
                </div>
              </div>

              {!derivedShop && (
                <p className="text-xs text-gray-500 leading-relaxed">
                  Open the free Ainomiq app from your Shopify Admin to authorize
                  access. After you approve permissions in Shopify, return
                  here-we will detect the connection automatically.
                </p>
              )}

              <Button
                onClick={connectShopify}
                disabled={connecting}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#96bf48] text-white text-sm font-medium rounded-lg hover:bg-[#7fa73c] disabled:opacity-50 transition-colors"
              >
                {connecting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    Waiting for connection...
                  </>
                ) : (
                  <>
                    <PlatformIcon platform="shopify" size={14} />
                    {derivedShop ? "Connect Shopify" : "Open in Shopify Admin"}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* What scopes are needed */}
        <div className="p-5 rounded-xl border border-gray-200 bg-white">
          <h3 className="text-sm font-medium text-gray-900 mb-3">
            What the AI agent needs access to
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {CS_SCOPES.map((s) => (
              <div
                key={s.scope}
                className="flex items-start gap-2 p-2 rounded-lg bg-gray-50"
              >
                <svg
                  className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0"
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
                <div>
                  <p className="text-xs font-medium text-gray-700">{s.label}</p>
                  <p className="text-[10px] text-gray-400">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-3 pt-2">
          <Button
            onClick={onBack}
            className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            ← Back
          </Button>
          <Button
            onClick={onContinue}
            className={`px-6 py-2.5 text-sm font-medium rounded-xl transition-colors ${
              shopifyStatus.connected
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {shopifyStatus.connected ? "Continue →" : "Skip for now →"}
          </Button>
        </div>
      </div>
    </div>
  );
}
