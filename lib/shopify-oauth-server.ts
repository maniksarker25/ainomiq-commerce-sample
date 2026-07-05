/**
 * Server-only Shopify OAuth helpers - imports from lib/db.
 * Do NOT import this file in client components.
 */
import type { NextRequest } from "next/server";
import { getIntegrationWithAliases, resolveCanonicalTenantId } from "@/lib/db";
import { SHOPIFY_RETURN_PATHS } from "@/lib/shopify-oauth";

export function safeShopifyReturnTo(
  request: NextRequest,
  fallback = SHOPIFY_RETURN_PATHS.settings,
): string {
  const explicit =
    request.nextUrl.searchParams.get("return_to") ||
    request.nextUrl.searchParams.get("returnTo");
  const referer = request.headers.get("referer") || "";
  const candidate = explicit || referer;
  if (!candidate) return fallback;

  try {
    const url = new URL(candidate, request.nextUrl.origin);
    if (url.origin !== request.nextUrl.origin) return fallback;
    if (!url.pathname.startsWith("/dashboard/")) return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}

/** Shop domain for OAuth: explicit param, else previously connected shop for this tenant. */
export async function resolveShopDomainForOAuth(
  tenantId: string,
  shopParam: string | null,
): Promise<string | null> {
  const normalized = (shopParam || "").trim().toLowerCase();
  if (normalized) {
    if (!normalized.endsWith(".myshopify.com")) return null;
    return normalized;
  }

  const canonical = await resolveCanonicalTenantId(tenantId);
  const integration = await getIntegrationWithAliases(canonical, "shopify");
  const shop = (integration?.provider_account_id as string | undefined)
    ?.trim()
    .toLowerCase();
  if (shop && shop.endsWith(".myshopify.com")) return shop;

  const devShop = (process.env.SHOPIFY_SHOP_DOMAIN || "").trim().toLowerCase();
  if (devShop && devShop.endsWith(".myshopify.com")) return devShop;

  return null;
}
