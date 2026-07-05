import { NextRequest, NextResponse } from "next/server";
import {
  verifyJwt,
  shouldRefresh,
  createJwt,
  buildCookieHeader,
  COOKIE_NAME,
} from "./lib/jwt";
import { isLikelyShopifyInstallQuery } from "./lib/shopify-install-hmac";

const CS_COOKIE = "ainomiq_cs_pass";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Shopify App Store install: send merchants straight to OAuth before any HTML UI or coming-soon gate.
  if (
    pathname === "/" &&
    isLikelyShopifyInstallQuery(request.nextUrl.searchParams)
  ) {
    const u = new URL(request.url);
    u.pathname = "/api/auth/shopify/install";
    return NextResponse.redirect(u);
  }

  const isStaticOrPublicAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/logo") ||
    /\.(?:png|jpg|jpeg|svg|ico|webp|woff2?)$/.test(pathname);

  if (isStaticOrPublicAsset) {
    return NextResponse.next();
  }

  const isCreativeOsAuthEntry =
    (pathname === "/login" || pathname === "/register") &&
    (request.nextUrl.searchParams.get("force") === "1" ||
      request.nextUrl.searchParams.get("switch") === "1" ||
      request.nextUrl.searchParams.get("return") === "/dashboard/creative-os" ||
      request.nextUrl.searchParams.has("invite"));

  if (isCreativeOsAuthEntry) {
    const response = NextResponse.next();
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
  const sessionPayload = sessionToken ? await verifyJwt(sessionToken) : null;
  const hasAuthenticatedSession = Boolean(sessionPayload);

  // JWT protection - auto-authenticate for local development/exploration!
  if (pathname.startsWith("/dashboard")) {
    if (!sessionToken || !sessionPayload) {
      const dummyToken = await createJwt({
        email: "dummy@example.com",
        tenantId: "dummy-tenant-id",
        name: "Tester",
        organization: "Ainomiq Demo",
        modules: ['performance', 'ads', 'creative-os', 'stock', 'cs', 'content'],
        accessMode: "customer",
      });

      const response = NextResponse.next();
      response.headers.set("Set-Cookie", buildCookieHeader(dummyToken));
      return response;
    }

    if (shouldRefresh(sessionPayload)) {
      const newToken = await createJwt({
        email: sessionPayload.email,
        tenantId: sessionPayload.tenantId,
        name: sessionPayload.name,
        organization: sessionPayload.organization,
        modules: sessionPayload.modules,
        accessMode: sessionPayload.accessMode,
      });
      const response = NextResponse.next();
      response.headers.set("Set-Cookie", buildCookieHeader(newToken));
      return response;
    }

    return NextResponse.next();
  }

  // Coming soon gate - keep marketing/public pages gated, but never block auth,
  // OAuth callbacks, webhooks, cron jobs, or app API calls needed before login.
  const isExemptFromComingSoon =
    hasAuthenticatedSession ||
    pathname.startsWith("/coming-soon") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/creative-os/invite") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/coming-soon-auth") ||
    pathname.startsWith("/api/ad-manager") ||
    pathname.startsWith("/api/creative-library") ||
    pathname.startsWith("/api/cron/cs-email") ||
    pathname.startsWith("/api/content") ||
    pathname.startsWith("/api/cs") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/integrations") ||
    pathname.startsWith("/api/performance") ||
    pathname.startsWith("/api/ads") ||
    pathname.startsWith("/api/stock") ||
    pathname.startsWith("/api/email") ||
    pathname.startsWith("/api/billing") ||
    pathname.startsWith("/api/app-settings") ||
    pathname.startsWith("/api/settings") ||
    pathname.startsWith("/api/onboarding") ||
    pathname.startsWith("/api/klaviyo") ||
    pathname.startsWith("/api/support") ||
    pathname.startsWith("/api/data-deletion") ||
    pathname === "/privacy-policy" ||
    pathname === "/terms-of-service" ||
    pathname === "/data-deletion" ||
    pathname === "/support";

  if (!isExemptFromComingSoon) {
    const csPass = request.cookies.get(CS_COOKIE)?.value;
    if (csPass !== "1") {
      return NextResponse.redirect(new URL("/coming-soon", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files with extensions
     */
    "/((?!_next/static|_next/image|favicon\.ico|.*\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|eot)).*)",
  ],
};
