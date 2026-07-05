/**
 * Shared ad-provider interface.
 *
 * Logic Ads and Performance should depend on this interface, not on a specific
 * platform. Meta is the reference implementation (lib/meta.ts). TikTok and
 * Snapchat are scaffolded (lib/tiktok-ads.ts, lib/snapchat-ads.ts) and must be
 * completed by the tech lead — see docs/PLATFORM-REVIEW/.
 *
 * All token storage MUST go through lib/encryption.ts (encrypted at rest) and
 * be scoped per tenant_id.
 */

export type AdProviderId = "meta" | "tiktok" | "snapchat" | "google";

export interface AdAccount {
  id: string;
  name: string;
  currency: string;
  status: string;
}

export interface CampaignInsight {
  campaignId: string;
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  // Normalised across providers so the UI is provider-agnostic.
}

export interface OAuthTokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes?: string[];
}

export interface AdProvider {
  readonly id: AdProviderId;

  /** Exchange an OAuth callback code for tokens. */
  exchangeCode(tenantId: string, code: string, redirectUri: string): Promise<OAuthTokenSet>;

  /** Refresh tokens before expiry; returns the new set. */
  refreshTokens(tenantId: string, current: OAuthTokenSet): Promise<OAuthTokenSet>;

  /** List the ad accounts the authorised user can access. */
  listAdAccounts(tenantId: string): Promise<AdAccount[]>;

  /** Fetch normalised campaign insights for a date range. */
  getCampaignInsights(
    tenantId: string,
    adAccountId: string,
    since: Date,
    until: Date
  ): Promise<CampaignInsight[]>;
}

export class NotImplementedError extends Error {
  constructor(provider: AdProviderId, method: string) {
    super(`[${provider}] ${method} is not implemented yet — see docs/PLATFORM-REVIEW/`);
    this.name = "NotImplementedError";
  }
}
