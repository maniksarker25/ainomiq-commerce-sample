/**
 * Client-safe Shopify OAuth helpers - NO imports from lib/db or any server-only module.
 * Safe to import in browser components.
 */

/** Shown near Shopify connect UI - App Store connector is free; Nomi charges are separate. */
export const SHOPIFY_CONNECTOR_FREE_NOTICE =
  "The Shopify app is a free connector. Viewing store data in Ainomiq is included. Nomi credits apply only when you run paid AI content or automation actions-not for connecting Shopify or reading your data.";

export const SHOPIFY_RETURN_PATHS = {
  performance: "/dashboard/performance",
  stock: "/dashboard/stock",
  cs: "/dashboard/cs",
  csOnboarding: "/dashboard/automations/cs-onboarding",
  settings: "/dashboard/settings?tab=integrations",
} as const;

export function buildShopifyConnectQuery(args: {
  tenantId: string;
  shop?: string;
  returnTo?: string;
}): string {
  const params = new URLSearchParams({ tenant_id: args.tenantId });
  if (args.shop?.trim()) params.set("shop", args.shop.trim().toLowerCase());
  if (args.returnTo?.trim()) params.set("return_to", args.returnTo.trim());
  return params.toString();
}

export function buildShopifyConnectHref(args: {
  tenantId: string;
  shop?: string;
  returnTo?: string;
}): string {
  return `/api/auth/shopify/connect?${buildShopifyConnectQuery(args)}`;
}

export function shopifyOAuthSuccessUrl(
  returnTo: string,
  origin: string,
): string {
  const url = new URL(returnTo, origin);
  url.searchParams.set("connected", "shopify");
  return url.toString();
}

/** Derive shop from a merchant store URL (scrape/onboarding) - not manual myshopify entry. */
export function extractMyshopifyDomain(input: string): string | null {
  const m = (input || "").match(/([a-z0-9][a-z0-9-]*\.myshopify\.com)/i);
  return m ? m[1].toLowerCase() : null;
}

/** Install/open the free connector from Shopify (App Store / Admin). No typed shop domain. */
export function getShopifyAppStoreListingUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SHOPIFY_APP_STORE_URL?.trim() ||
    "https://apps.shopify.com/ainomiq"
  );
}
