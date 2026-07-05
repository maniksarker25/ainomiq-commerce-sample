import {
  GENERIC_SOURCE_TOKENS,
  SOURCE_GROUP_VALUE_PREFIX,
  type CreativeOsState,
  type Product,
  type SourceCreative,
} from "../types";
import { isAinomiqStoredSource, sourceLibraryUrl } from "./library-urls";

export function sourceStatusLabel(source: SourceCreative) {
  if (source.status === "maxed out") return "Used";
  if (source.status === "assigned") return "In brief";
  if (source.status === "do not use") return "Paused";
  return "Ready";
}

export function sourceIsEditable(source: SourceCreative) {
  return (
    source.status !== "do not use" &&
    source.status !== "maxed out" &&
    source.derivativeCount < source.derivativeCap
  );
}

export function sourceStorageLabel(source: SourceCreative) {
  if (isAinomiqStoredSource(source)) return "Ainomiq Library";
  return "Reference";
}

export function sourceRootGroupName(source: SourceCreative) {
  const importName = (source.importName || "").trim();
  if (!importName.includes("/")) return "";
  return importName.split("/")[0]?.trim() || "";
}

export function sourceLegacyGroupKey(source: SourceCreative) {
  if (source.importName)
    return `import:${source.importName}:${source.importUrl || source.uploadedAt.slice(0, 16)}`;
  return "";
}

export function sourceRootGroupKey(source: SourceCreative) {
  const rootName = sourceRootGroupName(source);
  if (!rootName) return "";
  // Stable per (product, root folder) so every upload/import into the same
  // catalog folder lands in one group instead of one card per file/batch.
  // Legacy keys carried a trailing ":<uploadedAt-minute>" — sourceMatchesGroupKey
  // stays backward compatible with those so existing briefs keep matching.
  return `import-root:${source.productId}:${rootName}`;
}

export function sourceGroupName(source: SourceCreative) {
  const rootName = sourceRootGroupName(source);
  if (rootName) return rootName;
  if (source.importName) return source.importName;
  if (source.creator === "Catalog import") return "Legacy catalog source";
  if (isAinomiqStoredSource(source)) return "Ainomiq Library import";
  if (source.creator === "Ainomiq Library") return "External source reference";
  return source.name || "Source import";
}

export function sourceGroupKey(source: SourceCreative) {
  const rootKey = sourceRootGroupKey(source);
  if (rootKey) return rootKey;
  const legacyKey = sourceLegacyGroupKey(source);
  if (legacyKey) return legacyKey;
  if (source.creator === "Catalog import") return `catalog:${source.productId}`;
  if (isAinomiqStoredSource(source))
    return `library:${sourceLibraryUrl(source) || source.productId}`;
  return `source:${source.id}`;
}

export function sourceMatchesGroupKey(source: SourceCreative, groupKey: string) {
  if (!groupKey) return false;
  const rootKey = sourceRootGroupKey(source);
  return (
    sourceGroupKey(source) === groupKey ||
    rootKey === groupKey ||
    sourceLegacyGroupKey(source) === groupKey ||
    // Backward compat: briefs created before the stable-key change stored
    // "import-root:<product>:<rootName>:<uploadedAt-minute>".
    (rootKey !== "" && groupKey.startsWith(`${rootKey}:`))
  );
}

export function sourceGroupValue(key: string) {
  return `${SOURCE_GROUP_VALUE_PREFIX}${key}`;
}

export function sourceGroupKeyFromValue(value: string) {
  return value.startsWith(SOURCE_GROUP_VALUE_PREFIX)
    ? value.slice(SOURCE_GROUP_VALUE_PREFIX.length)
    : "";
}

export function stableHash(value: string) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

export function catalogScopeKey(
  product: Pick<
    Product,
    "id" | "name" | "url" | "isCatalogGroup" | "catalogItems"
  >,
) {
  const parts =
    product.isCatalogGroup && product.catalogItems?.length
      ? product.catalogItems
          .map((item) => item.id || item.url || item.name)
          .sort()
      : [product.id || product.url || product.name];
  return stableHash(parts.join("|").toLowerCase());
}

export function meaningfulTokens(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !GENERIC_SOURCE_TOKENS.has(token));
}

export function sourceBelongsToProduct(source: SourceCreative, product: Product) {
  if (source.productId !== product.id) return false;
  const scopeKey = catalogScopeKey(product);
  if (source.catalogScopeKey) return source.catalogScopeKey === scopeKey;
  if (!product.isCatalogGroup) return true;

  const sourceName = sourceGroupName(source);
  const sourceTokens = meaningfulTokens(sourceName);
  if (!sourceTokens.length) return true;

  const productTokens = new Set(
    meaningfulTokens(
      [
        product.name,
        product.url,
        ...(product.catalogItems?.flatMap((item) => [item.name, item.url]) ||
          []),
      ].join(" "),
    ),
  );
  if (!productTokens.size) return true;

  return sourceTokens.some((token) => productTokens.has(token));
}

export function approvedSourceUsageCount(
  state: Pick<
    CreativeOsState,
    "sources" | "tasks" | "deliveredEdits" | "launchItems"
  >,
  sourceId: string,
) {
  return state.launchItems.reduce((total, item) => {
    const sourceIds = [
      ...(Array.isArray(item.sourceCreativeIds) ? item.sourceCreativeIds : []),
      item.sourceCreativeId || "",
    ].filter(Boolean);
    if (!sourceIds.includes(sourceId)) return total;
    const edit = state.deliveredEdits.find(
      (delivered) => delivered.id === item.deliveredEditId,
    );
    const task = edit
      ? state.tasks.find((candidate) => candidate.id === edit.taskId)
      : null;
    return (
      total +
      Math.max(1, Number(edit?.outputCount) || Number(task?.outputCount) || 1)
    );
  }, 0);
}
