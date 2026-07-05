// Klaviyo App Install URL
// This is the URL that lives on the "Install App" button in the Klaviyo App Marketplace.
// Flow:
//   1. User clicks Install on Klaviyo marketplace
//   2. Klaviyo redirects here
//   3. If user is logged in → start OAuth immediately
//   4. If user is NOT logged in → redirect to login, then resume OAuth
import { NextRequest } from "next/server";
import { jwtVerify } from "jose";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "ainomiq_jwt";

async function getTenantFromCookie(
  request: NextRequest,
): Promise<string | null> {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "");
    const { payload } = await jwtVerify(token, secret);
    return (payload as any).tenantId || null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin || "https://app.ainomiq.com";
  const tenantId = await getTenantFromCookie(request);

  if (tenantId) {
    // User is logged in - start OAuth flow immediately
    return Response.redirect(
      `${origin}/api/auth/klaviyo/connect?tenant_id=${encodeURIComponent(tenantId)}`,
    );
  }

  // User is NOT logged in - redirect to login, then resume install
  const returnUrl = encodeURIComponent(`${origin}/api/auth/klaviyo/install`);
  return Response.redirect(`${origin}/login?return=${returnUrl}`);
}
