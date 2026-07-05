"use client";

import React from "react";
import {
  Draft,
  BrandProfile,
  ContentConfig,
  ManualLayout,
} from "../_lib/types";
import { migrateManualLayout } from "../_lib/manual-canvas";
import { ImageSlot } from "./VisualTemplateCard";
import { sameAsset } from "../_lib/utils";

type Props = {
  draft: Draft;
  layout: ManualLayout;
  config?: ContentConfig | null;
  brandProfile?: BrandProfile | null;
  className?: string;
};

export function ManualLayoutCanvas({
  draft,
  layout,
  config,
  brandProfile,
  className = "",
}: Props) {
  const migrated = migrateManualLayout(layout);
  const brand = config?.brand_name || brandProfile?.brand_name || "Ainomiq";
  const visual = draft.imageUrl?.trim() || null;
  const rawIcon =
    brandProfile?.icon_url ||
    brandProfile?.source_summary?.icon ||
    brandProfile?.source_summary?.favicon ||
    "";
  const rawLogo =
    brandProfile?.full_logo_url ||
    brandProfile?.logo_url ||
    brandProfile?.source_summary?.logo ||
    "";
  const logo = rawLogo && !sameAsset(rawLogo, rawIcon) ? rawLogo : "";
  const colors = (brandProfile?.source_summary?.brand_colors || []).filter(
    (color) => /^#[0-9a-f]{6}$/i.test(color),
  );
  const primary = colors[0] || "#3b82f6";
  const tone =
    `${brandProfile?.visual_style || ""} ${brandProfile?.brand_tone || ""}`.toLowerCase();
  const isLight =
    tone.includes("minimal") ||
    tone.includes("clean") ||
    tone.includes("white") ||
    colors.some((color) =>
      ["#ffffff", "#f8fafc", "#f9fafb", "#f5f5f5"].includes(
        color.toLowerCase(),
      ),
    );
  const baseBg = isLight ? "#ffffff" : "#f8fafc";
  const textColor = "#0f172a";
  const frameClass = draft.roundedFrames ? "rounded-[28px]" : "rounded-[18px]";

  const logoNode = draft.hideLogo ? null : logo ? (
    <img
      src={logo}
      alt={`${brand} logo`}
      className="h-7 max-w-[116px] object-contain"
    />
  ) : (
    <div className="text-xl font-bold lowercase">{brand}</div>
  );

  return (
    <div
      className={`@container relative h-full w-full overflow-hidden border border-gray-200 bg-white ${className}`}
      style={{ background: baseBg, color: textColor, containerType: "size" }}
    >
      {migrated.showImage !== false && (
        <div
          className={`absolute overflow-hidden border border-dashed border-blue-200 bg-blue-50 ${frameClass}`}
          style={{
            left: `${migrated.imageX}%`,
            top: `${migrated.imageY}%`,
            width: `${migrated.imageW}%`,
            height: `${migrated.imageH}%`,
          }}
        >
          <ImageSlot
            label="Customer image"
            visual={visual}
            className="h-full w-full border-0 rounded-none"
          />
        </div>
      )}

      {migrated.showExtraText !== false && migrated.extraText && (
        <div
          className="absolute flex items-end overflow-hidden px-1"
          style={{
            left: `${migrated.extraX ?? migrated.textX}%`,
            top: `${migrated.extraY ?? migrated.textY}%`,
            width: `${migrated.extraW ?? migrated.textW ?? 58}%`,
            height: `${migrated.extraH ?? 8}%`,
          }}
        >
          <div
            className="w-full overflow-hidden font-bold uppercase tracking-[0.16em] text-blue-600"
            style={{ fontSize: "clamp(8px, 2.5cqw, 11px)" }}
          >
            {migrated.extraText}
          </div>
        </div>
      )}

      {migrated.showHeadline !== false && (
        <div
          className="absolute flex items-center overflow-hidden px-1"
          style={{
            left: `${migrated.headlineX ?? migrated.textX}%`,
            top: `${migrated.headlineY ?? migrated.textY}%`,
            width: `${migrated.headlineW ?? migrated.textW ?? 58}%`,
            height: `${migrated.headlineH ?? 22}%`,
          }}
        >
          <div
            className="w-full overflow-hidden font-black leading-[0.95] tracking-tight wrap-break-word"
            style={{ color: textColor, fontSize: "clamp(14px, 5cqw, 32px)" }}
          >
            {migrated.headline}
          </div>
        </div>
      )}

      {migrated.showSubline !== false && migrated.subline && (
        <div
          className="absolute flex items-start overflow-hidden px-1"
          style={{
            left: `${migrated.sublineX ?? migrated.textX}%`,
            top: `${migrated.sublineY ?? migrated.textY + 24}%`,
            width: `${migrated.sublineW ?? migrated.textW ?? 58}%`,
            height: `${migrated.sublineH ?? 12}%`,
          }}
        >
          <div
            className="w-full overflow-hidden font-semibold leading-tight text-gray-600 wrap-break-word"
            style={{ fontSize: "clamp(10px, 3cqw, 16px)" }}
          >
            {migrated.subline}
          </div>
        </div>
      )}

      {migrated.showAccent !== false && (
        <div
          className="absolute rounded-full"
          style={{
            left: `${migrated.accentX}%`,
            top: `${migrated.accentY}%`,
            width: `${migrated.accentW || 16}%`,
            height: `${migrated.accentH || 1.5}%`,
            background: primary,
          }}
        />
      )}

      {!draft.hideLogo && (
        <div className="absolute bottom-5 right-5 pointer-events-none">
          {logoNode}
        </div>
      )}
    </div>
  );
}
