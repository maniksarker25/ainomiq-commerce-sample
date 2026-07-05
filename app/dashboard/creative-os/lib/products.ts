import { blankProduct, type Product } from "../types";
import { stableHash } from "./sources";

function uniqueList(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

export function cleanCompanyName(value: string) {
  const cleaned = value.trim();
  if (!cleaned || cleaned.toLowerCase() === "ainomiq") return "";
  return cleaned;
}

export function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function editorAssigneeValue(permission: {
  email?: string;
  userName: string;
}) {
  const email = (permission.email || "").trim();
  if (email && looksLikeEmail(email)) return normalizeEmail(email);
  const userName = permission.userName.trim();
  if (userName && looksLikeEmail(userName)) return normalizeEmail(userName);
  return userName || "Unassigned";
}

export function resolveBriefAssignee(
  assignee: string,
  permissions: Array<{ email?: string; userName: string }>,
) {
  const trimmed = assignee.trim();
  if (!trimmed || trimmed === "Unassigned") return "Unassigned";
  const normalized = normalizeEmail(trimmed);
  const match = permissions.find((permission) => {
    const value = editorAssigneeValue(permission);
    return (
      normalizeEmail(value) === normalized ||
      normalizeEmail(permission.userName) === normalized ||
      normalizeEmail(permission.email || "") === normalized
    );
  });
  if (match) return editorAssigneeValue(match);
  return looksLikeEmail(trimmed) ? normalized : trimmed;
}

function isAiPlaceholder(value: string) {
  return /\bai will fill\b|\bwill read\b|\bsource-backed\b|\bproduct-specific context\b/i.test(
    value.trim(),
  );
}

export function firstRealValue(items: string[], fallback: string) {
  return (
    items
      .map((item) => item.trim())
      .find((item) => item && !isAiPlaceholder(item)) || fallback
  );
}

function slugifyCollectionName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferCatalogCollectionName(products: Product[]) {
  const names = products.map((product) => product.name.trim()).filter(Boolean);
  if (!names.length) return "";
  const tokenLists = names.map((name) => name.split(/\s+/).filter(Boolean));
  const first = tokenLists[0] || [];
  const prefix: string[] = [];
  for (let index = 0; index < first.length; index += 1) {
    const token = first[index];
    if (
      tokenLists.every(
        (tokens) => tokens[index]?.toLowerCase() === token.toLowerCase(),
      )
    )
      prefix.push(token);
    else break;
  }
  return prefix.length >= 2 ? prefix.join(" ") : "";
}

function inferCollectionUrl(products: Product[], collectionName = "") {
  const urls = products.map((product) => product.url).filter(Boolean);
  for (const url of urls) {
    try {
      const parsed = new URL(url);
      const collectionMatch = parsed.pathname.match(/^(\/collections\/[^/]+)/);
      if (collectionMatch) {
        parsed.pathname = collectionMatch[1];
        parsed.search = "";
        parsed.hash = "";
        return parsed.toString();
      }
    } catch {}
  }
  const firstUrl = urls[0] || "";
  if (!firstUrl || !collectionName) return "";
  try {
    const parsed = new URL(firstUrl);
    parsed.pathname = `/collections/${slugifyCollectionName(collectionName)}`;
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

export function createCatalogGroup(products: Product[]): Product {
  const first = products[0];
  const groupKey = products
    .map((product) => product.id || product.url || product.name)
    .join("|");
  const groupId = stableHash(groupKey);
  const collectionName = inferCatalogCollectionName(products);
  return {
    ...first,
    id: `catalog-group-${groupId}`,
    name: collectionName || "Catalog selection",
    url: inferCollectionUrl(products, collectionName),
    imageUrl: first?.imageUrl || "",
    explanation: `${products.length} catalog products selected together.`,
    sellingPoints: [],
    pains: [],
    personas: [],
    claimBoundaries: [],
    defaultDerivativeCap: first?.defaultDerivativeCap || 5,
    platforms: first?.platforms || [],
    namingConvention: "catalog-product-source-edit-platform",
    createdAt: new Date().toISOString(),
    isCatalogGroup: true,
    catalogItems: products.map((product) => ({
      id: product.id,
      name: product.name,
      url: product.url,
      imageUrl: product.imageUrl,
    })),
  };
}

export function catalogDisplayName(product: Product, index = 0) {
  if (!product.isCatalogGroup) return product.name || "Untitled product";
  const count = product.catalogItems?.length || 0;
  const name =
    product.name && product.name !== "Catalog selection"
      ? product.name
      : `Catalog ${index + 1}`;
  return `${name}${count ? ` (${count} products)` : ""}`;
}

export function collectionUrlForProduct(product: Product) {
  if (!product.isCatalogGroup) return product.url;
  const items =
    product.catalogItems?.map((item) => ({
      ...blankProduct("catalog-item"),
      id: item.id,
      name: item.name,
      url: item.url,
      imageUrl: item.imageUrl,
    })) || [];
  const currentUrl = product.url.trim();
  if (currentUrl && !/\/products\//i.test(currentUrl)) return currentUrl;
  return inferCollectionUrl(items, product.name) || currentUrl;
}

export function inferProductFieldSuggestions(product: Product) {
  const catalogNames = uniqueList(
    (
      product.catalogItems?.map((item) => item.name).filter(Boolean) || []
    ).filter(Boolean),
  );
  const productName =
    product.name.trim() || catalogNames[0] || "selected product";
  const isGroup =
    (product.catalogItems?.length || 0) > 1 || product.isCatalogGroup;

  return {
    explanation: isGroup
      ? "Read the selected product pages and write product-specific context."
      : `Read ${productName} and write product-specific context.`,
    sellingPoints: ["Add 5 product-specific buying reasons"],
    pains: ["Add real customer pains from the product page"],
    personas: [],
    claimBoundaries: ["Add source-backed claim boundaries"],
    platforms: product.platforms.length
      ? product.platforms
      : ["Instagram", "Facebook"],
  };
}

export function textMatchesAiSuggestion(value: string, suggestion: string) {
  const cleanValue = value.trim().toLowerCase();
  const cleanSuggestion = suggestion.trim().toLowerCase();
  return (
    Boolean(cleanValue) &&
    (cleanValue === cleanSuggestion ||
      cleanValue.startsWith("selected catalog group:") ||
      cleanValue.includes("selected from the catalog. use the product photo"))
  );
}

export function listMatchesAiSuggestion(items: string[], suggestions: string[]) {
  const text = items.join(", ").toLowerCase();
  if (!text) return false;
  if (items.join("|").toLowerCase() === suggestions.join("|").toLowerCase())
    return true;
  return (
    text.includes("product photo ready for ads") ||
    text.includes("customer does not instantly understand") ||
    text.includes("product-aware shopper") ||
    text.includes("problem-aware shopper") ||
    text.includes("comparison shopper") ||
    text.includes("quick-decision buyer") ||
    text.includes("no unsupported performance claims") ||
    text.includes("catalog") ||
    text.includes("billie jeans pins linear") ||
    text.includes("billie jeans pins stellar") ||
    text.includes("billie jeans pins signature buyer")
  );
}

export function normalizeAiProductFields(product: Product): Product {
  const suggestions = inferProductFieldSuggestions(product);
  const personas = listMatchesAiSuggestion(
    product.personas,
    suggestions.personas,
  )
    ? suggestions.personas
    : product.personas.filter(
        (persona) =>
          !/catalog|linear|stellar|signature buyer|product-aware shopper|problem-aware shopper|comparison shopper|quick-decision buyer/i.test(
            persona,
          ),
      );
  return {
    ...product,
    explanation:
      textMatchesAiSuggestion(product.explanation, suggestions.explanation) ||
      isAiPlaceholder(product.explanation)
        ? ""
        : product.explanation,
    sellingPoints: listMatchesAiSuggestion(
      product.sellingPoints,
      suggestions.sellingPoints,
    )
      ? suggestions.sellingPoints
      : product.sellingPoints,
    pains: listMatchesAiSuggestion(product.pains, suggestions.pains)
      ? suggestions.pains
      : product.pains,
    personas: personas.length ? personas : suggestions.personas,
    claimBoundaries: listMatchesAiSuggestion(
      product.claimBoundaries,
      suggestions.claimBoundaries,
    )
      ? suggestions.claimBoundaries
      : product.claimBoundaries,
  };
}
