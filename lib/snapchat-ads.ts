/**
 * Snapchat Ads (Marketing API) provider — SCAFFOLD.
 *
 * Not yet implemented. See docs/PLATFORM-REVIEW/snapchat-ads.md. Follow
 * lib/meta.ts as the reference: encrypted token storage (lib/encryption.ts),
 * per-tenant scoping, refresh + rate-limit handling.
 */
import {
  type AdProvider,
  type AdAccount,
  type CampaignInsight,
  type OAuthTokenSet,
  NotImplementedError,
} from "./ads-provider";

const PROVIDER = "snapchat" as const;

// Snapchat Marketing API base. Confirm against current docs before use.
export const SNAPCHAT_API_BASE = "https://adsapi.snapchat.com/v1";

export const snapchatAdsProvider: AdProvider = {
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
