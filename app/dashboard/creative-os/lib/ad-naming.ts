export const DEFAULT_AD_NAMING_TEMPLATE = "{angle} | {format} | {source} | {date}";

type AdNameContext = {
  template?: string;
  productName?: string;
  sourceName?: string;
  brief?: string;
  angle?: string;
  hook?: string;
  format?: string;
  platform?: string;
  outputIndex?: number;
  date?: Date;
};

const TOKEN_LABELS: Record<string, string> = {
  product: "productName",
  catalog: "productName",
  productname: "productName",
  source: "sourceName",
  library: "sourceName",
  brief: "brief",
  persona: "brief",
  angle: "angle",
  hook: "hook",
  format: "format",
  platform: "platform",
  edit: "output",
  output: "output",
  date: "date",
};

function cleanPart(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .trim();
}

function shortPart(value: unknown, max = 34) {
  const clean = cleanPart(value);
  return clean.length > max ? `${clean.slice(0, max - 3).trim()}...` : clean;
}

function datePart(date = new Date()) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

function tokenValue(token: string, context: AdNameContext) {
  const key = TOKEN_LABELS[token.toLowerCase().replace(/[^a-z0-9]/g, "")] || token;
  const values: Record<string, string> = {
    productName: shortPart(context.productName),
    sourceName: shortPart(context.sourceName),
    brief: shortPart(context.brief),
    angle: shortPart(context.angle),
    hook: shortPart(context.hook),
    format: shortPart(context.format || "VIDEO").toUpperCase(),
    platform: shortPart(context.platform || "UGC").toUpperCase(),
    output: context.outputIndex ? `AD ${context.outputIndex}` : "",
    date: datePart(context.date),
  };
  return values[key] || "";
}

function buildFromLegacyConvention(template: string, context: AdNameContext) {
  const separator = template.includes("|") ? " | " : " - ";
  const parts = template
    .split(/\s*[|-]\s*/)
    .map((token) => tokenValue(token, context))
    .filter(Boolean);
  return parts.join(separator);
}

export function buildCreativeOsAdName(context: AdNameContext) {
  const template = cleanPart(context.template) || DEFAULT_AD_NAMING_TEMPLATE;
  const name = template.includes("{")
    ? template.replace(/\{([^}]+)\}/g, (_match, token) => tokenValue(token, context))
    : buildFromLegacyConvention(template, context);
  const cleaned = cleanPart(name).replace(/\s*-\s*-\s*/g, " - ").replace(/\s*\|\s*\|\s*/g, " | ");
  return cleaned || `Creative OS ad ${datePart(context.date)}`;
}
