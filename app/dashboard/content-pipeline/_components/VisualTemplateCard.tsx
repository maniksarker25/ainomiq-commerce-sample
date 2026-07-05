"use client";

import React from "react";
import { Draft, BrandProfile, ContentConfig } from "../_lib/types";
import { 
  templateStyle, 
  templateDisplayCopy, 
  sameAsset, 
  templatePurpose, 
} from "../_lib/utils";
import { ManualLayoutCanvas } from "./ManualLayoutCanvas";

export function ImageSlot({
  label,
  className = "",
  visual,
  dark = false,
  fit = "cover",
}: {
  label: string;
  className?: string;
  visual?: string | null;
  dark?: boolean;
  fit?: "cover" | "contain";
}) {
  const imageFitClass = fit === "contain" ? "object-contain" : "object-cover";

  return (
    <div
      className={`relative overflow-hidden rounded-[22px] border border-dashed ${dark ? "border-white/35 bg-white/10" : "border-blue-200 bg-blue-50"} ${className}`}
    >
      {visual ? (
        <img
          src={visual}
          alt=""
          className={`absolute inset-0 h-full w-full ${imageFitClass}`}
          referrerPolicy="no-referrer"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}
      <div
        className={`absolute inset-0 flex items-center justify-center px-4 text-center text-[11px] font-bold uppercase tracking-[0.18em] ${dark ? "text-white/70" : "text-blue-500/75"}`}
      >
        {visual ? "" : label}
      </div>
    </div>
  );
}

interface Props {
  draft: Draft;
  index: number;
  config?: ContentConfig | null;
  brandProfile?: BrandProfile | null;
  compact?: boolean;
  final?: boolean;
  className?: string;
}

export function VisualTemplateCard({
  draft,
  index,
  config,
  brandProfile,
  compact = false,
  final = false,
  className = "",
}: Props) {
  const rootClass = `relative h-full w-full overflow-hidden border border-gray-200 shadow-sm ${className}`;
  const styleIndex =
    typeof draft.templateIndex === "number" ? draft.templateIndex : index;
  const style = templateStyle(styleIndex);
  const displayCopy = templateDisplayCopy(draft, index);
  const headline = displayCopy.headline;
  const subline = displayCopy.subline;
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
  const icon = rawIcon;
  const logo = rawLogo && !sameAsset(rawLogo, rawIcon) ? rawLogo : "";
  
  const colors = (brandProfile?.source_summary?.brand_colors || []).filter(
    (color) => /^#[0-9a-f]{6}$/i.test(color),
  );
  const primary = colors[0] || "#3b82f6";
  const secondary = colors[1] || "#020617";
  const accent = colors[2] || "#60a5fa";
  
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
  const purpose = templatePurpose(styleIndex);
  const showUtilityLabels = !final && !draft.cleanAlign;
  const frameClass = draft.roundedFrames
    ? "rounded-[28px]"
    : "rounded-[18px]";

  const logoNode = draft.hideLogo ? null : logo ? (
    <img
      src={logo}
      alt={`${brand} logo`}
      className="h-7 max-w-[116px] object-contain"
    />
  ) : (
    <div className="text-xl font-bold lowercase">{brand}</div>
  );

  const iconNode = draft.hideLogo ? null : icon ? (
    <img
      src={icon}
      alt={`${brand} icon`}
      className="object-contain w-8 h-8 rounded-lg"
    />
  ) : (
    <div className="w-8 h-8 rounded-lg" style={{ background: primary }} />
  );

  if (draft.manualLayout) {
    return (
      <ManualLayoutCanvas
        draft={draft}
        layout={draft.manualLayout}
        config={config}
        brandProfile={brandProfile}
        className={className}
      />
    );
  }


  // Predefined Styles
  if (style === "graphic-hub") {
    return (
      <div
        className={rootClass}
        style={{ background: baseBg, color: textColor }}
      >
        <div className="absolute inset-0 p-5 grid grid-cols-[46%_54%] gap-4">
          <ImageSlot
            label="Customer image"
            visual={visual}
            className={`h-full ${frameClass}`}
          />
          <div className="flex flex-col justify-between py-2">
            {showUtilityLabels && (
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-600">
                {purpose}
              </div>
            )}
            <div>
              <div className="text-[25px] font-black leading-[0.96] tracking-tight">
                {headline}
              </div>
              {subline && (
                <div className="mt-4 text-[15px] font-semibold leading-tight text-gray-600">
                  {subline}
                </div>
              )}
            </div>
            <div className="flex justify-end">{logoNode}</div>
          </div>
        </div>
      </div>
    );
  }

  if (style === "dark-loop") {
    return (
      <div
        className={rootClass}
        style={{
          background: "#ffffff",
          color: textColor,
        }}
      >
        <div className="absolute inset-0 flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            {showUtilityLabels && (
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-600">
                {purpose}
              </div>
            )}
            {iconNode}
          </div>
          <ImageSlot
            label="Product or proof image"
            visual={visual}
            className={`h-[46%] ${frameClass}`}
          />
          <div className="flex flex-col justify-between flex-1">
            <div>
              <div
                className="text-[27px] font-black leading-[0.95] tracking-tight"
                style={{ color: primary }}
              >
                {headline}
              </div>
              {subline && (
                <div className="mt-3 max-w-[88%] text-[14px] font-semibold leading-tight text-gray-600">
                  {subline}
                </div>
              )}
            </div>
            <div className="flex items-end justify-between">
              <div
                className="h-1.5 w-16 rounded-full"
                style={{ background: primary }}
              />
              {logoNode}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (style === "editorial-band") {
    return (
      <div
        className={rootClass}
        style={{ background: baseBg, color: textColor }}
      >
        <div
          className="absolute top-0 left-0 w-4 h-full"
          style={{ background: primary }}
        />
        <div className="absolute inset-0 flex flex-col justify-between p-6 pl-9">
          <div className="flex items-center justify-between">
            {showUtilityLabels && (
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-600">
                {purpose}
              </div>
            )}
            {logoNode}
          </div>
          <div className="grid grid-cols-[54%_46%] gap-4 items-center">
            <div>
              <div className="text-[29px] font-black leading-[0.92] tracking-tight">
                {headline}
              </div>
              {subline && (
                <div className="mt-4 text-[14px] font-semibold leading-tight text-gray-600">
                  {subline}
                </div>
              )}
            </div>
            <ImageSlot
              label="Customer image"
              visual={visual}
              className={`h-40 ${frameClass}`}
            />
          </div>
          {showUtilityLabels && (
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400">
              Editable text slots
            </div>
          )}
        </div>
      </div>
    );
  }

  if (style === "modular-frame") {
    return (
      <div
        className={rootClass}
        style={{ background: baseBg, color: textColor }}
      >
        <div
          className="absolute border inset-5"
          style={{ borderColor: `${primary}55` }}
        />
        <div className="absolute inset-0 flex flex-col justify-between p-7">
          <div className="flex items-center justify-between">
            {showUtilityLabels && (
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-600">
                {purpose}
              </div>
            )}
            {iconNode}
          </div>
          <ImageSlot
            label="Step image"
            visual={visual}
            className={`h-32 ${frameClass}`}
          />
          <div>
            <div className="text-[28px] font-black leading-[0.94] tracking-tight">
              {headline}
            </div>
            {subline && (
              <div className="mt-3 max-w-[85%] text-[14px] font-semibold leading-tight text-gray-600">
                {subline}
              </div>
            )}
          </div>
          <div className="flex justify-end">{logoNode}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={rootClass}
      style={{
        background: "#ffffff",
        color: textColor,
      }}
    >
      <div className="absolute inset-0 flex flex-col justify-between p-5">
        <ImageSlot
          label="Customer image"
          visual={visual}
          className={`h-[56%] ${frameClass}`}
        />
        <div>
          {showUtilityLabels && (
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-600 mb-3">
              {purpose}
            </div>
          )}
          <div className="text-[28px] font-black leading-[0.94] tracking-tight max-w-[90%]">
            {headline}
          </div>
          {subline && (
            <div className="mt-3 max-w-[75%] text-[15px] font-semibold leading-tight text-gray-600">
              {subline}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div
            className="h-1.5 w-14 rounded-full"
            style={{ background: accent }}
          />
          {logoNode}
        </div>
      </div>
    </div>
  );
}
