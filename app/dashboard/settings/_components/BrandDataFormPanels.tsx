"use client";

import React from "react";
import { BrandProfile } from "../_lib/types";
import { SectionDescription } from "./Typography";
import { BrandTextarea } from "./BrandTextarea";
import { BRAND_TEXT_FIELD_LIMITS } from "../_lib/constants";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Globe2,
  ImageIcon,
  Layers,
  Package,
  Palette,
  Pencil,
  RotateCcw,
  Share2,
  Sparkles,
  Trash2,
  Upload,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const BRAND_TEXT_FIELDS: Array<[keyof BrandProfile, string]> = [
  ["what_you_sell", "What you sell"],
  ["ideal_customer", "Ideal customer"],
  ["customer_problem", "Customer problem"],
  ["main_offer", "Main offer"],
  ["proof_points", "Proof points"],
  ["brand_purpose", "Brand purpose"],
  ["brand_tone", "Brand tone"],
  ["visual_style", "Visual style"],
  ["content_goals", "Automation and content goals"],
];

type ScanMetric = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
};

export function ScanMetricsStrip({ profile }: { profile: BrandProfile }) {
  const summary = profile.source_summary;
  const confidence = summary?.confidence;
  const metrics: ScanMetric[] = [
    {
      label: "Products",
      value: summary?.products ?? 0,
      icon: Package,
      hint: "Catalog items found",
    },
    {
      label: "Tools",
      value: summary?.technologies?.length ?? 0,
      icon: Wrench,
      hint: "Stack & pixels",
    },
    {
      label: "Pages",
      value: summary?.page_count ?? 0,
      icon: Layers,
      hint: "Internal URLs",
    },
    {
      label: "Markets",
      value: summary?.markets ?? 0,
      icon: Globe2,
      hint: "Regions detected",
    },
    {
      label: "Confidence",
      value: confidence ? `${confidence}%` : "Review",
      icon: BarChart3,
      hint: confidence && confidence >= 70 ? "Strong scrape" : "Confirm fields",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 mt-8 text-left sm:grid-cols-3 lg:grid-cols-5">
      {metrics.map(({ label, value, icon: Icon, hint }) => (
        <div
          key={label}
          className="group relative overflow-hidden rounded-2xl border border-blue-100/80 bg-white/95 p-4 shadow-[0_10px_40px_rgba(37,99,235,0.08)] backdrop-blur-sm transition-shadow hover:shadow-[0_14px_44px_rgba(37,99,235,0.12)]"
        >
          <div
            className="absolute inset-0 transition-opacity opacity-0 pointer-events-none group-hover:opacity-100"
            style={{
              background:
                "radial-gradient(circle at 100% 0%, rgba(59,130,246,0.08), transparent 55%)",
            }}
          />
          <div className="relative flex items-center justify-between gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 text-blue-600 rounded-xl bg-blue-50">
              <Icon className="w-4 h-4" strokeWidth={2.25} />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              {label}
            </span>
          </div>
          <p className="relative mt-3 text-2xl font-black tracking-tight text-gray-950 tabular-nums">
            {value}
          </p>
          {hint && (
            <p className="relative mt-1 text-[11px] font-medium text-gray-500">
              {hint}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function PanelShell({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[20px] border border-gray-200/90 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)] ${className}`}
    >
      <div className="mb-4">
        <h4 className="text-sm font-bold text-gray-900">{title}</h4>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-sm text-gray-500">{children}</p>;
}

type SourcePanelProps = {
  profile: BrandProfile;
  brandLogoPreview: string;
  open: boolean;
  onToggle: () => void;
};

export function ScannedSourcePanel({
  profile,
  brandLogoPreview,
  open,
  onToggle,
}: SourcePanelProps) {
  const summary = profile.source_summary;
  const toolCount = summary?.technologies?.length ?? 0;
  const productCount = summary?.top_products?.length ?? 0;
  const channelCount = summary?.social_channels?.length ?? 0;
  const scrapedLabel = summary?.scraped_at
    ? new Date(summary.scraped_at).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <section className="overflow-hidden rounded-[22px] border border-gray-200 bg-linear-to-b from-gray-50/80 to-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-start w-full gap-4 p-5 text-left transition-colors hover:bg-white/60 sm:items-center"
      >
        <span className="inline-flex shrink-0 items-center justify-center w-10 h-10 rounded-xl bg-blue-600 text-white shadow-[0_8px_24px_rgba(37,99,235,0.28)]">
          <Sparkles className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-bold text-gray-900">
              Scanned source data
            </h4>
            {!open && (
              <div className="flex flex-wrap gap-1.5">
                {toolCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-semibold bg-white border-gray-200"
                  >
                    {toolCount} tools
                  </Badge>
                )}
                {productCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-semibold bg-white border-gray-200"
                  >
                    {productCount} products
                  </Badge>
                )}
                {channelCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-semibold bg-white border-gray-200"
                  >
                    {channelCount} channels
                  </Badge>
                )}
              </div>
            )}
          </div>
          <SectionDescription className="mt-1 text-xs!">
            Raw signals from your site - tools, catalog, colors, and pages. Use
            this to validate the AI-filled fields below.
          </SectionDescription>
          {scrapedLabel && (
            <p className="mt-2 text-[11px] font-medium text-gray-400">
              Last scan · {scrapedLabel}
            </p>
          )}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow-sm">
          {open ? (
            <>
              Hide <ChevronUp className="w-3.5 h-3.5" />
            </>
          ) : (
            <>
              View <ChevronDown className="w-3.5 h-3.5" />
            </>
          )}
        </span>
      </button>

      {open && (
        <div className="p-5 pt-4 space-y-4 duration-200 border-t border-gray-200/90 animate-in fade-in slide-in-from-top-1">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <PanelShell
              title="Detected tools"
              description="Commerce, analytics, and marketing stack."
            >
              <div className="flex flex-wrap gap-2">
                {(summary?.technologies || []).length ? (
                  (summary?.technologies || []).map((tool) => (
                    <Badge
                      key={tool}
                      className="px-2.5 py-1 text-[11px] font-semibold text-blue-800 bg-blue-50 border-blue-100 hover:bg-blue-100"
                    >
                      {tool}
                    </Badge>
                  ))
                ) : (
                  <EmptyHint>No tools detected</EmptyHint>
                )}
              </div>
            </PanelShell>

            <PanelShell
              title="Brand colors"
              description="Dominant colors from the storefront HTML."
            >
              <div className="flex flex-wrap gap-2">
                {(summary?.brand_colors || []).length ? (
                  (summary?.brand_colors || []).map((color) => (
                    <span
                      key={color}
                      className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700"
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-inner"
                        style={{ backgroundColor: color }}
                      />
                      {color}
                    </span>
                  ))
                ) : (
                  <EmptyHint>No colors detected</EmptyHint>
                )}
              </div>
            </PanelShell>

            <PanelShell
              title="Social & reach"
              description="Channels and page footprint."
            >
              <div className="flex flex-wrap gap-2">
                {(summary?.social_channels || []).length ? (
                  (summary?.social_channels || []).map((channel) => (
                    <Badge
                      key={channel}
                      variant="outline"
                      className="capitalize text-[11px] font-semibold"
                    >
                      <Share2 className="w-3 h-3 mr-1 opacity-60" />
                      {channel}
                    </Badge>
                  ))
                ) : (
                  <EmptyHint>No social channels</EmptyHint>
                )}
              </div>
              <p className="mt-3 text-xs font-medium text-gray-500">
                {summary?.page_count || 0} internal pages indexed
              </p>
            </PanelShell>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PanelShell
              title="Top products"
              description="Sample SKUs from the scrape."
            >
              <ul className="divide-y divide-gray-100">
                {(summary?.top_products || []).length ? (
                  (summary?.top_products || [])
                    .slice(0, 8)
                    .map((product, i) => (
                      <li
                        key={`${product.title}-${i}`}
                        className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                      >
                        <span className="text-sm font-semibold text-gray-800 truncate">
                          {product.title}
                        </span>
                        {product.price && (
                          <span className="text-xs font-bold text-gray-500 shrink-0 tabular-nums">
                            {product.price}
                          </span>
                        )}
                      </li>
                    ))
                ) : (
                  <EmptyHint>No products in scrape</EmptyHint>
                )}
              </ul>
            </PanelShell>

            <PanelShell
              title="Purpose clues"
              description="Mission and positioning snippets."
            >
              <ul className="space-y-2.5">
                {(summary?.purpose_clues || []).length ? (
                  (summary?.purpose_clues || []).slice(0, 5).map((clue, i) => (
                    <li
                      key={`${clue}-${i}`}
                      className="pl-3 text-sm leading-relaxed text-gray-700 border-l-2 border-blue-200"
                    >
                      {clue}
                    </li>
                  ))
                ) : (
                  <EmptyHint>No purpose clues</EmptyHint>
                )}
              </ul>
            </PanelShell>
          </div>

          {brandLogoPreview && (
            <PanelShell title="Detected logo preview" className="max-w-xs">
              <div className="flex items-center justify-center h-16 px-4 border border-gray-200 border-dashed rounded-xl bg-gray-50">
                <img
                  src={brandLogoPreview}
                  alt="Detected logo"
                  className="object-contain max-w-full max-h-12"
                />
              </div>
            </PanelShell>
          )}

          {!!(summary?.key_pages || []).length && (
            <PanelShell
              title="Useful source pages"
              description="Policy, about, and catalog URLs."
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(summary?.key_pages || []).slice(0, 12).map((page) => (
                  <a
                    key={page}
                    href={page}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2.5 text-xs font-semibold text-gray-700 transition-colors hover:border-blue-200 hover:bg-blue-50/50 hover:text-blue-700"
                  >
                    <span className="flex-1 truncate">{page}</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-40 group-hover:opacity-100" />
                  </a>
                ))}
              </div>
            </PanelShell>
          )}
        </div>
      )}
    </section>
  );
}

type AssetCardProps = {
  kind: "icon" | "logo";
  preview: string;
  inputValue: string;
  onInputChange: (value: string) => void;
  onUpload: (file?: File | null) => void;
  candidates: string[];
  onSelectCandidate: (url: string) => void;
};

export function BrandAssetCard({
  kind,
  preview,
  inputValue,
  onInputChange,
  onUpload,
  candidates,
  onSelectCandidate,
}: AssetCardProps) {
  const isIcon = kind === "icon";
  const title = isIcon ? "Brand icon" : "Full logo";
  const description = isIcon
    ? "Square mark or favicon for compact placements."
    : "Wordmark for templates, footers, and wide layouts.";

  return (
    <article className="flex flex-col overflow-hidden rounded-[20px] border border-gray-200 bg-white shadow-[0_2px_14px_rgba(15,23,42,0.05)]">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-linear-to-r from-gray-50 to-white">
        <span className="inline-flex items-center justify-center w-8 h-8 text-blue-600 rounded-lg bg-blue-50">
          {isIcon ? (
            <ImageIcon className="w-4 h-4" />
          ) : (
            <Palette className="w-4 h-4" />
          )}
        </span>
        <div>
          <h4 className="text-sm font-bold text-gray-900">{title}</h4>
          <p className="text-[11px] text-gray-500">{description}</p>
        </div>
      </div>

      <div className="flex flex-col flex-1 gap-4 p-4">
        <div
          className={`flex items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-[linear-gradient(145deg,#f8fafc,#f1f5f9)] ${
            isIcon
              ? "aspect-square max-w-[140px] mx-auto w-full"
              : "h-[100px] w-full"
          }`}
        >
          {preview ? (
            <img
              src={preview}
              alt={title}
              className={`object-contain ${isIcon ? "max-h-16 max-w-16" : "max-h-14 max-w-[85%]"}`}
            />
          ) : (
            <span className="text-xs font-semibold text-gray-400">
              No {isIcon ? "icon" : "logo"} yet
            </span>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            {isIcon ? "Icon URL" : "Logo URL"}
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder={isIcon ? "https://…/icon.png" : "https://…/logo.svg"}
              className="h-10 text-sm border-gray-200 rounded-xl bg-gray-50/50"
            />
            <Label className="inline-flex items-center justify-center h-10 px-4 text-sm font-bold text-blue-700 transition-colors border border-blue-200 cursor-pointer shrink-0 rounded-xl bg-blue-50 hover:bg-blue-100">
              <Upload className="w-4 h-4 mr-2" />
              Upload
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onUpload(e.target.files?.[0])}
              />
            </Label>
          </div>
        </div>

        {candidates.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              From scan
            </p>
            <div className="flex flex-wrap gap-2">
              {candidates.map((url, i) => (
                <button
                  key={`${url}-${i}`}
                  type="button"
                  onClick={() => onSelectCandidate(url)}
                  className={`overflow-hidden rounded-xl border-2 bg-white p-1.5 transition-all hover:border-blue-400 hover:shadow-md ${
                    preview && preview === url
                      ? "border-blue-500 ring-2 ring-blue-100"
                      : "border-gray-200"
                  } ${isIcon ? "w-12 h-12" : "h-12 w-18"}`}
                >
                  <img
                    src={url}
                    alt=""
                    className="object-contain w-full h-full"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

type ProfileFormProps = {
  profile: BrandProfile;
  updateBrandProfile: (key: keyof BrandProfile, value: string) => void;
};

function previewField(value: string | undefined, max = 140) {
  const text = (value || "").trim();
  if (!text) return "-";
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

type BrandCompactProps = {
  profile: BrandProfile;
  brandIconPreview: string;
  brandLogoPreview: string;
  brandSourceOpen: boolean;
  onToggleSource: () => void;
  onEdit: () => void;
  onRescan: () => void;
  onDelete: () => void;
  brandDeleting: boolean;
  brandDeleteConfirm: boolean;
  onCancelDelete: () => void;
};

export function BrandProfileCompactView({
  profile,
  brandIconPreview,
  brandLogoPreview,
  brandSourceOpen,
  onToggleSource,
  onEdit,
  onRescan,
  onDelete,
  brandDeleting,
  brandDeleteConfirm,
  onCancelDelete,
}: BrandCompactProps) {
  const website = profile.website?.trim();
  const websiteHref =
    website && /^https?:\/\//i.test(website)
      ? website
      : website
        ? `https://${website}`
        : "";
  const scrapedLabel = profile.source_summary?.scraped_at
    ? new Date(profile.source_summary.scraped_at).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[28px] border border-gray-200/90 bg-white shadow-[0_8px_40px_rgba(15,23,42,0.06)]">
        <div className="border-b border-gray-100 bg-linear-to-r from-white to-blue-50/30 p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                {brandIconPreview ? (
                  <img
                    src={brandIconPreview}
                    alt=""
                    className="h-11 w-11 object-contain"
                  />
                ) : brandLogoPreview ? (
                  <img
                    src={brandLogoPreview}
                    alt=""
                    className="max-h-10 max-w-[90%] object-contain"
                  />
                ) : (
                  <span className="text-lg font-black text-blue-600">
                    {(profile.brand_name || "B").charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-black tracking-tight text-gray-950 md:text-2xl">
                    {profile.brand_name?.trim() || "Your brand"}
                  </h2>
                  <Badge className="border-none bg-green-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-green-800 hover:bg-green-100">
                    Saved
                  </Badge>
                </div>
                {websiteHref ? (
                  <a
                    href={websiteHref}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700"
                  >
                    {website.replace(/^https?:\/\//i, "")}
                    <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                  </a>
                ) : (
                  <p className="mt-1 text-sm text-gray-500">
                    No website on file
                  </p>
                )}
                {scrapedLabel && (
                  <p className="mt-2 text-xs text-gray-500">
                    Last scanned {scrapedLabel}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={onEdit}
                className="h-10 rounded-xl border-gray-200 px-4 text-sm font-bold text-gray-800 hover:bg-gray-50"
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit profile
              </Button>
              <Button
                type="button"
                onClick={onRescan}
                className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Scan again
              </Button>
            </div>
          </div>
          <ScanMetricsStrip profile={profile} />
        </div>

        <div className="grid grid-cols-1 gap-px bg-gray-100 md:grid-cols-2">
          {BRAND_TEXT_FIELDS.map(([key, label]) => (
            <div key={key} className="bg-white px-5 py-4 md:px-6">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                {label}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-800 line-clamp-3">
                {previewField(
                  typeof profile[key] === "string"
                    ? (profile[key] as string)
                    : "",
                )}
              </p>
            </div>
          ))}
          {profile.competitors?.trim() && (
            <div className="bg-white px-5 py-4 md:col-span-2 md:px-6">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Competitors
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-800 line-clamp-2">
                {previewField(profile.competitors, 200)}
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 p-5 md:px-6">
          <ScannedSourcePanel
            profile={profile}
            brandLogoPreview={brandLogoPreview}
            open={brandSourceOpen}
            onToggle={onToggleSource}
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-end md:px-6">
          {brandDeleteConfirm && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancelDelete}
              disabled={brandDeleting}
              className="h-10 rounded-xl border-gray-200 px-4 text-sm font-bold"
            >
              Cancel
            </Button>
          )}
          <Button
            type="button"
            variant={brandDeleteConfirm ? "destructive" : "outline"}
            onClick={onDelete}
            disabled={brandDeleting}
            className={`h-10 rounded-xl px-4 text-sm font-bold ${!brandDeleteConfirm ? "border-red-100 bg-red-50 text-red-700 hover:bg-red-100" : ""}`}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {brandDeleting
              ? "Deleting..."
              : brandDeleteConfirm
                ? "Yes, delete all data"
                : "Delete all brand data"}
          </Button>
        </div>
      </section>
    </div>
  );
}

export function BrandProfileFields({
  profile,
  updateBrandProfile,
}: ProfileFormProps) {
  return (
    <div className="space-y-8">
      <section>
        <h4 className="mb-4 text-xs font-bold tracking-wider text-gray-400 uppercase">
          Core identity
        </h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-700">
              Brand name
            </Label>
            <Input
              value={profile.brand_name}
              onChange={(e) => updateBrandProfile("brand_name", e.target.value)}
              className="border-gray-200 h-11 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-700">
              Competitors
            </Label>
            <Input
              value={profile.competitors}
              onChange={(e) =>
                updateBrandProfile("competitors", e.target.value)
              }
              placeholder="Known competitors or alternatives"
              className="border-gray-200 h-11 rounded-xl"
            />
          </div>
        </div>
      </section>

      <section>
        <h4 className="mb-1 text-xs font-bold tracking-wider text-gray-400 uppercase">
          Brand narrative
        </h4>
        <p className="mb-4 text-xs text-gray-500">
          AI-filled from your site. Edit anything that needs a human touch
          before saving.
        </p>
        <div className="space-y-1 rounded-[20px] border border-gray-200 bg-gray-50/40 p-4 md:p-5">
          {BRAND_TEXT_FIELDS.map(([key, label]) => (
            <BrandTextarea
              key={key}
              label={label}
              value={
                typeof profile[key] === "string" ? (profile[key] as string) : ""
              }
              maxLength={BRAND_TEXT_FIELD_LIMITS[key as string] ?? 1500}
              onChange={(value) => updateBrandProfile(key, value)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
