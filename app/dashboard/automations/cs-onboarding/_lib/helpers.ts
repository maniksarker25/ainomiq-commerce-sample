const LANG_FLAGS: Record<string, string> = {
  nl: "🇳🇱",
  en: "🇬🇧",
  de: "🇩🇪",
  fr: "🇫🇷",
  es: "🇪🇸",
  it: "🇮🇹",
  pt: "🇵🇹",
  pl: "🇵🇱",
  sv: "🇸🇪",
  da: "🇩🇰",
  nb: "🇳🇴",
  no: "🇳🇴",
  fi: "🇫🇮",
  cs: "🇨🇿",
  ro: "🇷🇴",
  hu: "🇭🇺",
  el: "🇬🇷",
  tr: "🇹🇷",
  ja: "🇯🇵",
  ko: "🇰🇷",
  zh: "🇨🇳",
  ar: "🇸🇦",
  hi: "🇮🇳",
  ru: "🇷🇺",
  uk: "🇺🇦",
  bg: "🇧🇬",
  hr: "🇭🇷",
  sk: "🇸🇰",
  sl: "🇸🇮",
  lt: "🇱🇹",
  lv: "🇱🇻",
  et: "🇪🇪",
  th: "🇹🇭",
  vi: "🇻🇳",
  id: "🇮🇩",
  ms: "🇲🇾",
};

const LANG_NAMES: Record<string, string> = {
  nl: "Dutch",
  en: "English",
  de: "German",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  pt: "Portuguese",
  pl: "Polish",
  sv: "Swedish",
  da: "Danish",
  nb: "Norwegian",
  no: "Norwegian",
  fi: "Finnish",
  cs: "Czech",
  ro: "Romanian",
  hu: "Hungarian",
  el: "Greek",
  tr: "Turkish",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  ar: "Arabic",
  hi: "Hindi",
  ru: "Russian",
};

export function langFlag(code: string): string {
  return LANG_FLAGS[code.toLowerCase().split("-")[0]] || "🌐";
}

export function langName(code: string): string {
  return LANG_NAMES[code.toLowerCase().split("-")[0]] || code.toUpperCase();
}

export function platformLabel(p: string) {
  const map: Record<string, string> = {
    shopify: "Shopify",
    woocommerce: "WooCommerce",
    magento: "Magento",
    prestashop: "PrestaShop",
    bigcommerce: "BigCommerce",
    lightspeed: "Lightspeed",
    squarespace: "Squarespace",
    wix: "Wix",
    nextjs: "Next.js",
    wordpress: "WordPress",
    unknown: "Custom / Unknown",
  };
  return map[p] || p;
}

export function langFromCode(code: string | null): string {
  if (!code) return "English";
  const c = code.toLowerCase().split("-")[0];
  const map: Record<string, string> = {
    en: "English",
    nl: "Dutch",
    de: "German",
    fr: "French",
    es: "Spanish",
  };
  return map[c] || "English";
}
export function buildDefaultEscalationRules(
  language: string,
  labels: string[] = [],
): string {
  const labelText = labels.join(" ").toLowerCase();
  const hasVip = /vip|priority/.test(labelText);
  const hasRefund = /refund|retour/.test(labelText);
  const hasLegal = /legal|jurid/.test(labelText);

  const isDutch =
    language.toLowerCase().startsWith("dutch") ||
    language.toLowerCase().startsWith("nl");

  if (isDutch) {
    return [
      "Escaleren als één van deze situaties geldt:",
      `- Na 2 onduidelijke of negatieve replies zonder oplossing${hasVip ? " (1 reply voor VIP klanten)" : ""}`,
      `- Terugbetalingen of compensaties boven EUR 75${hasRefund ? " of elke expliciete refund-escalatie" : ""}`,
      `- Juridische dreiging, chargeback, fraude of publieke klacht${hasLegal ? " (altijd direct)" : ""}`,
      "- Onzekerheid over policy/uitzondering: direct naar team lead",
    ].join("\n");
  }

  return [
    "Escalate when one of these conditions is met:",
    `- After 2 unresolved or negative back-and-forth replies${hasVip ? " (after 1 for VIP customers)" : ""}`,
    `- Refunds/compensation above EUR 75${hasRefund ? " or any explicit refund escalation" : ""}`,
    `- Legal threats, chargebacks, fraud, or public complaint risk${hasLegal ? " (always immediate)" : ""}`,
    "- Any policy exception uncertainty: escalate to team lead immediately",
  ].join("\n");
}

export function defaultEscalationName(storeName: string | null): string {
  const cleaned = (storeName || "").trim();
  return cleaned ? `${cleaned} Support Lead` : "Support Team Lead";
}

export function defaultBotStartLocalValue() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
