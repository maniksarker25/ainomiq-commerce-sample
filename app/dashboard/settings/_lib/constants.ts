import { BrandProfile, IntegrationDef } from "./types";

export const PLATFORM_LOGOS: Record<string, string> = {
  shopify: "/logos/shopify.svg",
  meta_ads: "/logos/meta.svg",
  meta_messaging: "meta-messaging",
  meta_posting: "meta-posting",
  klaviyo: "/logos/klaviyo.webp",
  google_workspace: "/logos/google-workspace-v3.png",
  gmail: "gmail-icon",
  google_drive: "/logos/google-drive-v3.png",
  asset_library: "asset-library-icon",
  google_calendar: "google-calendar-icon",
  google_ads: "/logos/google-ads-v3.png",
  tiktok_ads: "/logos/tiktok-ads.svg",
  snapchat_ads: "/logos/snapchat-ads.svg",
  linkedin: "linkedin-blue",
};

export const INTEGRATION_DEFS: IntegrationDef[] = [
  {
    id: "shopify",
    group: "commerce",
    name: "Shopify",
    desc: "Free connector - sync catalog, orders, and inventory into Ainomiq (no Shopify app fee)",
    logo: PLATFORM_LOGOS.shopify,
    comingSoon: false,
  },
  {
    id: "meta_messaging",
    group: "meta",
    name: "Meta Messaging",
    desc: "Instagram and Facebook DMs, comments and inbox workflows",
    logo: PLATFORM_LOGOS.meta_ads,
    comingSoon: false,
  },
  {
    id: "meta_posting",
    group: "meta",
    name: "Meta Posting",
    desc: "Publish and manage Instagram and Facebook posts from Content Studio",
    logo: PLATFORM_LOGOS.meta_ads,
    comingSoon: false,
  },
  {
    id: "meta_ads",
    group: "meta",
    name: "Meta Performance",
    desc: "Ad accounts, spend, ROAS, CPC, CTR and campaign performance",
    logo: PLATFORM_LOGOS.meta_ads,
    comingSoon: false,
  },
  {
    id: "klaviyo",
    group: "marketing",
    name: "Klaviyo",
    desc: "Email flows, campaigns, subscribers and revenue attribution",
    logo: PLATFORM_LOGOS.klaviyo,
    comingSoon: false,
  },
  {
    id: "asset_library",
    group: "internal",
    name: "Ainomiq Library",
    desc: "Ainomiq storage for product photos, videos, review deliveries and approved creative",
    logo: PLATFORM_LOGOS.asset_library,
    comingSoon: false,
    builtIn: true,
  },
  {
    id: "gmail",
    group: "google",
    name: "Google Workspace",
    desc: "Gmail, shared inbox and Workspace automation for customer support flows",
    logo: PLATFORM_LOGOS.google_workspace,
    comingSoon: false,
  },
  {
    id: "google_drive",
    group: "google",
    name: "Google Drive",
    desc: "Product folders, photos and videos for AI Ad Manager and Content Studio",
    logo: PLATFORM_LOGOS.google_drive,
    comingSoon: false,
  },
  {
    id: "google_ads",
    group: "google",
    name: "Google Ads",
    desc: "Campaign performance, keyword data and conversion tracking",
    logo: PLATFORM_LOGOS.google_ads,
    comingSoon: true,
  },
  {
    id: "linkedin",
    group: "social",
    name: "LinkedIn",
    desc: "Company page posting and B2B content workflows",
    logo: PLATFORM_LOGOS.linkedin,
    comingSoon: true,
  },
  {
    id: "tiktok_ads",
    group: "social",
    name: "TikTok Ads",
    desc: "TikTok ad campaigns, creative performance and audience insights",
    logo: PLATFORM_LOGOS.tiktok_ads,
    comingSoon: true,
  },
  {
    id: "snapchat_ads",
    group: "social",
    name: "Snapchat Ads",
    desc: "Snapchat ad campaigns, reach and conversion metrics",
    logo: PLATFORM_LOGOS.snapchat_ads,
    comingSoon: true,
  },
  {
    id: "custom",
    group: "custom",
    name: "Custom Integration",
    desc: "Don't see your platform? Request a custom integration and we'll build it.",
    logo: "custom-question",
    comingSoon: false,
    isRequest: true,
  },
];

/** Matches backend `clean()` limits in brand-profile scrape. */
export const BRAND_TEXT_FIELD_LIMITS: Record<string, number> = {
  what_you_sell: 1500,
  ideal_customer: 1500,
  customer_problem: 1500,
  main_offer: 1500,
  proof_points: 1500,
  competitors: 1000,
  brand_purpose: 1200,
  brand_tone: 1200,
  visual_style: 1200,
  content_goals: 1200,
};

export const EMPTY_BRAND_PROFILE: BrandProfile = {
  brand_name: "",
  website: "",
  what_you_sell: "",
  ideal_customer: "",
  customer_problem: "",
  main_offer: "",
  proof_points: "",
  competitors: "",
  brand_purpose: "",
  brand_tone: "",
  visual_style: "",
  content_goals: "",
  logo_url: "",
  icon_url: "",
  full_logo_url: "",
};

export const ALL_NAV_ITEMS = [
  { id: "performance", label: "Performance", alwaysOn: true },
  { id: "add-automations", label: "Automations", alwaysOn: true },
  { id: "stock", label: "Stock Management", alwaysOn: false },
  { id: "cs", label: "Intelli Support", alwaysOn: false },
  { id: "instagram", label: "Instagram", alwaysOn: false },
  { id: "settings", label: "Settings", alwaysOn: true },
];

export const ALERT_TYPES = [
  { id: "low_stock", label: "Low stock alerts" },
  { id: "out_of_stock", label: "Out of stock alerts" },
  { id: "new_order", label: "New order notifications" },
  { id: "weekly_report", label: "Weekly performance report" },
  { id: "cs_ticket", label: "New support ticket" },
  { id: "ad_performance", label: "Ad performance alerts" },
];

export const NAV_ORDER_KEY = "ainomiq_nav_order";
export const NAV_HIDDEN_KEY = "ainomiq_nav_hidden";
export const NOTIF_EMAILS_KEY = "ainomiq_notif_emails";
export const NOTIF_ALERTS_KEY = "ainomiq_notif_alerts";
