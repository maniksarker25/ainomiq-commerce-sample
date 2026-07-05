import type { ScrapeResult } from "@/lib/scraper";

export type Phase =
  | "url-input"
  | "scraping"
  | "verify"
  | "email-setup"
  | "shopify-connect"
  | "brand-voice"
  | "channel-upsell"
  | "success";

export interface ScrapeProgress {
  step: string;
  message: string;
  data?: ScrapeResult;
}

export interface EmailSetupData {
  emailProvider: string;
  connectionMethod: "google_oauth" | "imap_smtp";
  supportEmails: string[];
  hasWorkspace: string;
  hasWorkspaceOther: string;
  imapHost?: string;
  imapPort?: string;
  smtpHost?: string;
  smtpPort?: string;
  imapUser?: string;
  imapPassword?: string;
}

export interface BrandVoiceData {
  tone: string;
  languageHandling: string;
  emailSignature: string;
  dos: string[];
  donts: string[];
  escalationName: string;
  escalationEmail: string;
  internalLang: string;
  escalationRules: string;
}

export interface ChannelUpsellData {
  whatsappUpsell: boolean;
  phoneNumberUpsell: boolean;
  preferredCountry: string;
  numberType: "local" | "mobile";
  numberContains?: string;
  useExistingNumber?: boolean;
  existingPhoneNumber?: string;
  preferredLanguage: string;
  voiceStyle: "friendly" | "professional" | "warm";
  expectedMonthlyEmails: number;
  expectedMonthlyMessages: number;
  expectedMonthlyCalls: number;
  botStartMode: "now" | "scheduled";
  botStartAt: string;
  botStartTimezone: string;
}

export interface GmailInfo {
  connected: boolean;
  email?: string;
  messagesTotal?: number;
  threadsTotal?: number;
  sendAsEmails?: string[];
  labels?: { id: string; name: string; type: string }[];
  error?: string;
}

export const SETUP_STEPS = [
  { key: "email-setup", label: "Email Setup" },
  { key: "shopify-connect", label: "Shopify", conditional: true },
  { key: "brand-voice", label: "Brand Voice" },
  { key: "channel-upsell", label: "Channels & Upsells" },
] as const;

export const STEPS = [
  { key: "detecting", label: "Detecting platform" },
  { key: "store-info", label: "Store information" },
  { key: "products", label: "Products" },
  { key: "policies", label: "Policies" },
  { key: "contact", label: "Contact info" },
];

export const PROVIDER_LOGOS: Record<string, string> = {
  // Local (already in public/logos/)
  "Google Workspace": "/logos/google.svg",
  Gmail: "/logos/google.svg",
  // Google Favicon Service (reliable, returns real favicons at 128px)
  "Microsoft 365":
    "https://www.google.com/s2/favicons?domain=microsoft.com&sz=128",
  Outlook: "https://www.google.com/s2/favicons?domain=outlook.com&sz=128",
  Hotmail: "https://www.google.com/s2/favicons?domain=outlook.com&sz=128",
  "Yahoo Mail": "https://www.google.com/s2/favicons?domain=yahoo.com&sz=128",
  "Zoho Mail": "https://www.google.com/s2/favicons?domain=zoho.com&sz=128",
  "Zoho EU": "https://www.google.com/s2/favicons?domain=zoho.com&sz=128",
  "iCloud Mail": "https://www.google.com/s2/favicons?domain=icloud.com&sz=128",
  ProtonMail: "https://www.google.com/s2/favicons?domain=proton.me&sz=128",
  "ProtonMail (Bridge)":
    "https://www.google.com/s2/favicons?domain=proton.me&sz=128",
  "Namecheap Private Email":
    "https://www.google.com/s2/favicons?domain=namecheap.com&sz=128",
  Namecheap: "https://www.google.com/s2/favicons?domain=namecheap.com&sz=128",
  TransIP: "https://www.google.com/s2/favicons?domain=transip.nl&sz=128",
  Hostnet: "https://www.google.com/s2/favicons?domain=hostnet.nl&sz=128",
  "one.com": "https://www.google.com/s2/favicons?domain=one.com&sz=128",
  Hostinger: "https://www.google.com/s2/favicons?domain=hostinger.com&sz=128",
  "Titan Email": "https://www.google.com/s2/favicons?domain=titan.email&sz=128",
  Ziggo: "https://www.google.com/s2/favicons?domain=ziggo.nl&sz=128",
  KPN: "https://www.google.com/s2/favicons?domain=kpn.com&sz=128",
  Strato: "https://www.google.com/s2/favicons?domain=strato.de&sz=128",
  Fastmail: "https://www.google.com/s2/favicons?domain=fastmail.com&sz=128",
  OVH: "https://www.google.com/s2/favicons?domain=ovh.com&sz=128",
  IONOS: "https://www.google.com/s2/favicons?domain=ionos.com&sz=128",
};

export const PROVIDER_COLORS: Record<string, string> = {
  Google: "#4285F4",
  Microsoft: "#00A4EF",
  Yahoo: "#6001D2",
  Zoho: "#C8202B",
  iCloud: "#333333",
  ProtonMail: "#6D4AFF",
  Namecheap: "#FF6600",
  TransIP: "#6B2FAD",
  Hostnet: "#0066CC",
  "one.com": "#1A1A1A",
  Hostinger: "#6730E3",
  Titan: "#3F51B5",
  Ziggo: "#E4003A",
  KPN: "#009900",
  Strato: "#003399",
  Fastmail: "#304FFE",
  OVH: "#000E9C",
  IONOS: "#003D8F",
};

export const PLATFORM_LOGOS: Record<string, string> = {
  shopify: "https://www.google.com/s2/favicons?domain=shopify.com&sz=128",
  woocommerce:
    "https://www.google.com/s2/favicons?domain=woocommerce.com&sz=128",
  magento: "https://www.google.com/s2/favicons?domain=magento.com&sz=128",
  prestashop: "https://www.google.com/s2/favicons?domain=prestashop.com&sz=128",
  bigcommerce:
    "https://www.google.com/s2/favicons?domain=bigcommerce.com&sz=128",
  lightspeed:
    "https://www.google.com/s2/favicons?domain=lightspeedhq.com&sz=128",
  squarespace:
    "https://www.google.com/s2/favicons?domain=squarespace.com&sz=128",
  wix: "https://www.google.com/s2/favicons?domain=wix.com&sz=128",
  nextjs: "https://www.google.com/s2/favicons?domain=nextjs.org&sz=128",
  wordpress: "https://www.google.com/s2/favicons?domain=wordpress.org&sz=128",
};

export const LANGUAGES = ["English", "Dutch", "German", "French", "Spanish", "Other"];
