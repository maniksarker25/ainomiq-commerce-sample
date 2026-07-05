import { NextRequest } from "next/server";
export const dynamic = "force-dynamic";

import { getIntegrations } from "@/lib/db";
import { isDemoTenant, DEMO_INTEGRATION_STATUS } from "@/lib/demo";
import { requireAuth, handleAuthError } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  // Demo tenant - return platforms as connected, EXCEPT instagram
  // Instagram must show as "Not connected" so the Meta reviewer can see the full OAuth connect flow
  if (isDemoTenant(tenantId)) {
    // Check if this tenant has a REAL instagram integration in DB
    const realIntegrations = await getIntegrations(tenantId);
    const reallyConnectedIG = realIntegrations.some(
      (i) => i.provider === "instagram",
    );

    const demoIntegrations = Object.entries(DEMO_INTEGRATION_STATUS)
      .filter(([provider]) => {
        // Skip instagram from demo data - only show if really connected
        if (provider === "instagram") return false;
        return true;
      })
      .map(([provider, data]) => ({
        provider,
        email: data.email || "",
        connectedAt: data.connectedAt || "2026-02-15T10:00:00Z",
      }));

    // If instagram is really connected, add it from real DB data
    if (reallyConnectedIG) {
      const igRow = realIntegrations.find((i) => i.provider === "instagram")!;
      demoIntegrations.push({
        provider: "instagram",
        email: String(igRow.provider_email || ""),
        connectedAt: String(igRow.created_at || "2026-02-15T10:20:00Z"),
      });
    }

    return Response.json({ integrations: demoIntegrations });
  }

  const integrations = await getIntegrations(tenantId);
  return Response.json({
    integrations: integrations.map((i) => ({
      provider: i.provider,
      email: i.provider_email,
      connectedAt: i.created_at,
      providerAccountId: i.provider_account_id,
      scopes: i.scopes || "",
    })),
  });
}
