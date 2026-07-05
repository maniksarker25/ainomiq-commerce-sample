/**
 * TikTok Ads (Marketing API) provider — SCAFFOLD.
 *
 * Not yet implemented. See docs/PLATFORM-REVIEW/tiktok-ads.md for the access
 * requirements and approach. Follow lib/meta.ts as the reference: store tokens
 * encrypted (lib/encryption.ts), scope per tenant, handle refresh + rate limits.
 */
import {
  type AdProvider,
  type AdAccount,
  type CampaignInsight,
  type OAuthTokenSet,
  NotImplementedError,
} from "./ads-provider";

const PROVIDER = "tiktok" as const;

// TikTok Marketing API base. Confirm against current docs before use.
export const TIKTOK_API_BASE = "https://business-api.tiktok.com/open_api";

export const tiktokAdsProvider: AdProvider = {
  id: PROVIDER,

  async exchangeCode(): Promise<OAuthTokenSet> {
    throw new NotImplementedError(PROVIDER, "exchangeCode");
  },

  async refreshTokens(): Promise<OAuthTokenSet> {
    throw new NotImplementedError(PROVIDER, "refreshTokens");
  },

  async listAdAccounts(): Promise<AdAccount[]> {
    throw new NotImplementedError(PROVIDER, "listAdAccounts");
  },

  async getCampaignInsights(): Promise<CampaignInsight[]> {
    throw new NotImplementedError(PROVIDER, "getCampaignInsights");
  },
};
