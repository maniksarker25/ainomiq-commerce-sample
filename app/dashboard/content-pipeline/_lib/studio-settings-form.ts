import { CONTENT_PIPELINE_OUTPUT_TYPES } from "@/lib/content-pipeline-config-schema";
import type { ContentConfig } from "./types";

/** Fields edited in Studio Settings - used for dirty-state comparison only. */
export type StudioSettingsSnapshot = {
  brand_name: string;
  brand_voice: string;
  target_audience: string;
  product_focus: string;
  content_generation_mode: "source_material" | "ai_images";
  content_source: string;
  output_types: string[];
  publish_platforms: string[];
  publishing_enabled: boolean;
  publish_timezone: string;
};

function sortedUnique(values: string[]) {
  return [...new Set(values)].sort();
}

export function studioSettingsSnapshot(
  config: ContentConfig | null,
): StudioSettingsSnapshot | null {
  if (!config) return null;

  const output_types = sortedUnique(
    config.output_types?.length
      ? config.output_types.map(String)
      : [...CONTENT_PIPELINE_OUTPUT_TYPES],
  );
  const publish_platforms = sortedUnique(
    config.publish_platforms?.length
      ? config.publish_platforms.map(String)
      : ["instagram"],
  );

  return {
    brand_name: String(config.brand_name ?? "").trim(),
    brand_voice: String(config.brand_voice ?? "").trim(),
    target_audience: String(config.target_audience ?? "").trim(),
    product_focus: String(config.product_focus ?? "").trim(),
    content_generation_mode:
      config.content_generation_mode === "ai_images"
        ? "ai_images"
        : "source_material",
    content_source: String(config.content_source ?? "").trim(),
    output_types,
    publish_platforms,
    publishing_enabled: config.publishing_enabled !== false,
    publish_timezone: String(
      config.publish_timezone || "Europe/Amsterdam",
    ).trim(),
  };
}

export function studioSettingsIsDirty(
  current: ContentConfig | null,
  saved: ContentConfig | null,
): boolean {
  const next = studioSettingsSnapshot(current);
  const baseline = studioSettingsSnapshot(saved);
  if (!next || !baseline) return false;
  return JSON.stringify(next) !== JSON.stringify(baseline);
}
