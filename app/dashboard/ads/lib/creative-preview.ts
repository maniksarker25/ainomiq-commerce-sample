import type { DbRow } from "../types";
import { parseDbJson } from "../utils";

export function getCreativePreview(creative: DbRow) {
  const sourceRefs = parseDbJson(creative.source_asset_refs);
  const metadata = parseDbJson(creative.metadata);
  const product = sourceRefs?.product || {};
  const mediaAsset = metadata?.media_asset || {};
  const renderedTemplateName =
    sourceRefs?.selected_template_name ||
    metadata?.rendered_template?.name ||
    "";
  const sourceLabel = sourceRefs?.rendered_from_template
    ? `Template creative${renderedTemplateName ? ` - ${renderedTemplateName}` : ""}`
    : sourceRefs?.content_source === "drive"
      ? "Drive content"
      : sourceRefs?.content_source === "creative_library"
        ? "Creative Library"
        : sourceRefs?.ai_generation_required
          ? "AI image generation"
          : "Creative source";
  return {
    imageUrl: String(
      creative.final_asset_url ||
        creative.asset_url ||
        mediaAsset.asset_url ||
        product.imageUrl ||
        product.image_url ||
        "",
    ),
    title: String(metadata?.title || product.name || creative.id || "Creative"),
    subtitle: String(
      metadata?.hook ||
        metadata?.overlay ||
        mediaAsset.persona_name ||
        sourceRefs?.content_source ||
        "Ad creative",
    ),
    source: String(sourceLabel),
    mediaType: String(creative.media_type || mediaAsset.type || "image"),
    ratio: String(mediaAsset.ratio || sourceRefs?.ratio || "4:5"),
    productName: String(mediaAsset.product_name || product.name || ""),
    personaName: String(mediaAsset.persona_name || metadata?.persona?.name || ""),
  };
}

export function ratioClass(ratio: string) {
  if (ratio === "9:16") return "aspect-9/16";
  if (ratio === "1:1") return "aspect-square";
  if (ratio === "16:9") return "aspect-video";
  return "aspect-4/5";
}
