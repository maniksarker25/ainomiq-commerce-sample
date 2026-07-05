export const DEMO_EMAIL = "demo@ainomiq.com";
export const DEMO_TENANT_ID = "demo";

// All accounts that should see demo data
// NOTE: metademo/reviewer/review accounts are NOT demo - they use real API data for Meta App Review
const DEMO_ACCOUNTS = new Set([DEMO_EMAIL, DEMO_TENANT_ID]);

export function isDemoTenant(tenantId: string): boolean {
  const normalized = tenantId.toLowerCase().trim();
  return DEMO_ACCOUNTS.has(normalized);
}

export function isDemoEmail(email: string): boolean {
  return email.toLowerCase().trim() === DEMO_EMAIL;
}

export const DEMO_INTEGRATION_STATUS: Record<
  string,
  {
    connected: true;
    email?: string;
    shop?: string;
    accountName?: string;
    accountId?: string;
    accountIds?: string[];
    connectedAt?: string;
  }
> = {
  shopify: {
    connected: true,
    shop: "demo-store.myshopify.com",
    connectedAt: "2026-02-15T10:00:00Z",
  },
  meta: {
    connected: true,
    accountName: "Ainomiq Demo Ads",
    accountId: "act_demo123456",
    accountIds: ["act_demo123456"],
    email: "info@ainomiq.com",
    connectedAt: "2026-02-15T10:05:00Z",
  },
  klaviyo: {
    connected: true,
    accountId: "DemoKL",
    email: "info@ainomiq.com",
    connectedAt: "2026-02-15T10:10:00Z",
  },
  google: {
    connected: true,
    email: "info@ainomiq.com",
    connectedAt: "2026-02-15T10:15:00Z",
  },
  instagram: {
    connected: true,
    accountName: "demo_store",
    connectedAt: "2026-02-15T10:20:00Z",
  },
  facebook: {
    connected: true,
    accountName: "Demo Store",
    connectedAt: "2026-02-15T10:25:00Z",
  },
};
