import type { Session } from "./session";

/**
 * Tenant id for API calls from the browser. Prefer email - integrations and
 * tenant_config are keyed by email in most OAuth flows (see Google connect).
 */
export function getSessionTenantId(
  session: Session | null | undefined,
): string {
  if (!session) return "";
  const email = (session.email || "").trim().toLowerCase();
  const tenantId = (session.tenantId || "").trim();
  return email || tenantId;
}
