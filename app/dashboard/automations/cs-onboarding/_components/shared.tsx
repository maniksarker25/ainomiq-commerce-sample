"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { PROVIDER_LOGOS, PROVIDER_COLORS, PLATFORM_LOGOS } from "../_lib/types";
import { platformLabel } from "../_lib/helpers";

export function ProviderIcon({
  provider,
  size = 16,
}: {
  provider: string;
  size?: number;
}) {
  const [imgError, setImgError] = useState(false);
  const logoUrl = PROVIDER_LOGOS[provider];

  if (logoUrl && !imgError) {
    return (
      <img
        src={logoUrl}
        alt={provider}
        width={size}
        height={size}
        className="shrink-0 rounded-sm object-contain"
        onError={() => setImgError(true)}
      />
    );
  }

  // Fallback: colored circle with initial
  const name = provider
    .replace(/ (Mail|Email|Private Email|Workspace|\(Bridge\))$/i, "")
    .trim();
  const color =
    Object.entries(PROVIDER_COLORS).find(([k]) => name.includes(k))?.[1] ||
    "#6B7280";
  const initial = name.charAt(0).toUpperCase();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="shrink-0">
      <circle cx="12" cy="12" r="12" fill={color} />
      <text
        x="12"
        y="17"
        textAnchor="middle"
        fill="white"
        fontSize="13"
        fontWeight="bold"
        fontFamily="Arial,sans-serif"
      >
        {initial}
      </text>
    </svg>
  );
}

export function PlatformIcon({
  platform,
  size = 14,
}: {
  platform: string;
  size?: number;
}) {
  const [imgError, setImgError] = useState(false);
  const logoUrl = PLATFORM_LOGOS[platform];

  if (logoUrl && !imgError) {
    return (
      <img
        src={logoUrl}
        alt={platformLabel(platform)}
        width={size}
        height={size}
        className="shrink-0 rounded-sm object-contain"
        onError={() => setImgError(true)}
      />
    );
  }
  return null;
}

export function FormGroup({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="block text-sm font-medium text-gray-900 mb-1.5">
        {label} {required && <span className="text-gray-300">*</span>}
      </Label>
      {hint && <p className="text-xs text-gray-500 mb-2">{hint}</p>}
      {children}
    </div>
  );
}
