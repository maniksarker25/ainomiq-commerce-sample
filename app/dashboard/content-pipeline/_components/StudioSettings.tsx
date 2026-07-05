"use client";

import React, { useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ContentConfig } from "../_lib/types";
import { studioSettingsIsDirty } from "../_lib/studio-settings-form";
import { DEFAULT_PUBLISH_TIMEZONE } from "@/lib/content-studio-schedule-utils";
import { CONTENT_PIPELINE_OUTPUT_TYPES } from "@/lib/content-pipeline-config-schema";
import {
  RefreshCw,
  Save,
  Sparkles,
  Globe,
  Smartphone,
  Layout,
  Layers,
  CheckCircle2,
} from "lucide-react";

interface Props {
  config: ContentConfig | null;
  /** Last saved config from the server - used to enable Save only when dirty. */
  savedConfig: ContentConfig | null;
  onUpdate: (next: Partial<ContentConfig>) => void;
  onSave: () => void;
  saving?: boolean;
}

const OUTPUT_LABELS: Record<
  (typeof CONTENT_PIPELINE_OUTPUT_TYPES)[number],
  string
> = {
  instagram_caption: "Instagram captions",
  ad_copy: "Ad copy",
  email_snippet: "Email snippets",
  content_calendar: "Content calendar ideas",
};

const PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
] as const;

const PUBLISH_TIMEZONES = [
  "Europe/Amsterdam",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Singapore",
  "Australia/Sydney",
] as const;

export function StudioSettings({
  config,
  savedConfig,
  onUpdate,
  onSave,
  saving,
}: Props) {
  const isDirty = useMemo(
    () => studioSettingsIsDirty(config, savedConfig),
    [config, savedConfig],
  );

  if (!config) return null;

  const generationMode = config.content_generation_mode ?? "source_material";
  const outputTypes = config.output_types?.length
    ? config.output_types
    : [...CONTENT_PIPELINE_OUTPUT_TYPES];
  const publishPlatforms = config.publish_platforms?.length
    ? config.publish_platforms
    : ["instagram"];

  const toggleOutput = (type: string) => {
    const current = outputTypes;
    if (current.includes(type) && current.length === 1) {
      toast.error("Keep at least one active content output.");
      return;
    }
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    onUpdate({ output_types: next });
  };

  const togglePlatform = (platform: string) => {
    const current = publishPlatforms;
    if (current.includes(platform) && current.length === 1) {
      toast.error(
        "Keep at least one publishing target, or disable direct publishing.",
      );
      return;
    }
    const next = current.includes(platform)
      ? current.filter((p) => p !== platform)
      : [...current, platform];
    onUpdate({ publish_platforms: next });
  };

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-2">
        <div className="space-y-8">
          <section className="space-y-5">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-blue-600">
                Brand Identity
              </h3>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-gray-500">
                Brand Display Name
              </Label>
              <Input
                value={config.brand_name || ""}
                onChange={(e) => onUpdate({ brand_name: e.target.value })}
                className="h-11 rounded-xl border-gray-200 bg-gray-50/50 text-sm shadow-sm transition-colors focus:bg-white focus-visible:ring-blue-500/20"
                placeholder="e.g. Acme Corp"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-gray-500">
                Detailed Brand Voice
              </Label>
              <Textarea
                value={config.brand_voice || ""}
                onChange={(e) => onUpdate({ brand_voice: e.target.value })}
                className="resize-none rounded-xl border-gray-200 bg-gray-50/50 p-4 text-sm shadow-sm transition-colors focus:bg-white focus-visible:ring-blue-500/20"
                placeholder="Bold, minimal, direct, conversion-focused…"
                rows={4}
              />
            </div>
          </section>

          <section className="space-y-5">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
              <Layout className="h-4 w-4 text-blue-600" />
              <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-blue-600">
                Targeting & Focus
              </h3>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-gray-500">
                Target Audience Summary
              </Label>
              <Textarea
                value={config.target_audience || ""}
                onChange={(e) => onUpdate({ target_audience: e.target.value })}
                className="resize-none rounded-xl border-gray-200 bg-gray-50/50 p-4 text-sm shadow-sm transition-colors focus:bg-white focus-visible:ring-blue-500/20"
                placeholder="Ideal customers and core pain points…"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-gray-500">
                Core Product Focus
              </Label>
              <Input
                value={config.product_focus || ""}
                onChange={(e) => onUpdate({ product_focus: e.target.value })}
                className="h-11 rounded-xl border-gray-200 bg-gray-50/50 text-sm shadow-sm transition-colors focus:bg-white focus-visible:ring-blue-500/20"
                placeholder="Main product, offer, or value proposition"
              />
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="space-y-5">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
              <Layers className="h-4 w-4 text-blue-600" />
              <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-blue-600">
                Generation Strategy
              </h3>
            </div>
            <div
              className="grid grid-cols-2 gap-3"
              role="group"
              aria-label="Generation strategy"
            >
              <button
                type="button"
                aria-pressed={generationMode === "source_material"}
                onClick={() =>
                  onUpdate({ content_generation_mode: "source_material" })
                }
                className={`rounded-2xl border p-4 text-left transition-all ${
                  generationMode === "source_material"
                    ? "border-blue-500 bg-blue-50/40 shadow-sm"
                    : "border-gray-100 bg-gray-50/50 hover:border-gray-200"
                }`}
              >
                <Globe
                  className={`mb-2 h-4 w-4 ${generationMode === "source_material" ? "text-blue-600" : "text-gray-400"}`}
                />
                <div className="text-xs font-bold leading-tight text-gray-950">
                  Content Source
                </div>
                <p className="mt-1 text-[10px] leading-normal text-gray-500">
                  Scrape web pages, blogs, or product details.
                </p>
              </button>
              <button
                type="button"
                aria-pressed={generationMode === "ai_images"}
                onClick={() =>
                  onUpdate({ content_generation_mode: "ai_images" })
                }
                className={`rounded-2xl border p-4 text-left transition-all ${
                  generationMode === "ai_images"
                    ? "border-blue-500 bg-blue-50/40 shadow-sm"
                    : "border-gray-100 bg-gray-50/50 hover:border-gray-200"
                }`}
              >
                <Smartphone
                  className={`mb-2 h-4 w-4 ${generationMode === "ai_images" ? "text-blue-600" : "text-gray-400"}`}
                />
                <div className="text-xs font-bold leading-tight text-gray-950">
                  AI Visuals
                </div>
                <p className="mt-1 text-[10px] leading-normal text-gray-500">
                  Synthesize layout cards from brand context.
                </p>
              </button>
            </div>

            {generationMode === "source_material" ? (
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-gray-500">
                  Source URL / Folder
                </Label>
                <Input
                  value={config.content_source || ""}
                  onChange={(e) => onUpdate({ content_source: e.target.value })}
                  className="h-11 rounded-xl border-gray-200 bg-gray-50/50 text-sm shadow-sm transition-colors focus:bg-white focus-visible:ring-blue-500/20"
                  placeholder="Blog URL, product page, or Drive folder"
                />
                <p className="px-1 text-[10px] font-medium text-gray-400">
                  Leave empty if Brand Data context is enough for daily
                  generation.
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-4 text-sm font-medium text-blue-900">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <p>
                  AI visuals run from your saved Brand Data. No external source
                  URL is required.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

      <section className="space-y-8 border-t border-gray-50 pt-8">
        <div className="space-y-4">
          <Label className="block text-xs font-bold uppercase tracking-widest text-gray-500">
            Active Content Outputs
          </Label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CONTENT_PIPELINE_OUTPUT_TYPES.map((type) => {
              const active = outputTypes.includes(type);
              return (
                <label
                  key={type}
                  htmlFor={`output-settings-${type}`}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-all ${
                    active
                      ? "border-blue-200 bg-blue-50/20 shadow-sm"
                      : "border-gray-100 bg-gray-50/50 hover:border-gray-200"
                  }`}
                >
                  <Checkbox
                    id={`output-settings-${type}`}
                    checked={active}
                    onCheckedChange={() => toggleOutput(type)}
                    className="rounded-md border-gray-300"
                  />
                  <span className="text-xs font-extrabold leading-none text-gray-800">
                    {OUTPUT_LABELS[type]}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <Label className="block text-xs font-bold uppercase tracking-widest text-gray-500">
              Publishing Targets
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {PLATFORMS.map((platform) => {
                const active = publishPlatforms.includes(platform.id);
                return (
                  <label
                    key={platform.id}
                    htmlFor={`platform-settings-${platform.id}`}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-all ${
                      active
                        ? "border-blue-200 bg-blue-50/20 shadow-sm"
                        : "border-gray-100 bg-gray-50/50 hover:border-gray-200"
                    }`}
                  >
                    <Checkbox
                      id={`platform-settings-${platform.id}`}
                      checked={active}
                      onCheckedChange={() => togglePlatform(platform.id)}
                      className="rounded-md border-gray-300"
                    />
                    <span className="text-xs font-extrabold leading-none text-gray-800">
                      {platform.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <Label className="block text-xs font-bold uppercase tracking-widest text-gray-500">
              Direct Publishing Engine
            </Label>
            <div className="flex h-[58px] items-center justify-between gap-4 rounded-2xl border border-gray-100/60 bg-gray-50/50 p-4">
              <div className="space-y-0.5">
                <div className="text-xs font-bold leading-none text-gray-900">
                  Automate Posting Process
                </div>
                <p className="mt-0.5 text-[10px] font-medium leading-normal text-gray-500">
                  Ready planner posts publish within about 5 minutes of their
                  scheduled time.
                </p>
              </div>
              <Switch
                checked={config.publishing_enabled !== false}
                onCheckedChange={(val) => onUpdate({ publishing_enabled: val })}
                className="data-[state=checked]:bg-blue-600"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="publish-timezone"
                className="text-xs font-bold uppercase tracking-widest text-gray-500"
              >
                Schedule timezone
              </Label>
              <select
                id="publish-timezone"
                value={config.publish_timezone || DEFAULT_PUBLISH_TIMEZONE}
                onChange={(e) => onUpdate({ publish_timezone: e.target.value })}
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900"
              >
                {PUBLISH_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-4 flex justify-end border-t border-gray-100 pt-6">
        <Button
          type="button"
          onClick={onSave}
          disabled={saving || !isDirty}
          className="h-12 rounded-xl bg-blue-600 px-8 font-extrabold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Saving Settings…
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Studio Config
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
