"use client";

import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  rows?: number;
  placeholder?: string;
};

export function BrandTextarea({
  label,
  value,
  onChange,
  maxLength = 1500,
  rows = 3,
  placeholder,
}: Props) {
  const count = value.length;
  const atLimit = count >= maxLength;
  const nearLimit = count >= maxLength * 0.9;

  return (
    <div className="space-y-2 md:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-xs font-semibold text-gray-700">{label}</Label>
        <span
          className={`text-[11px] font-semibold tabular-nums ${
            atLimit
              ? "text-red-600"
              : nearLimit
                ? "text-amber-600"
                : "text-gray-400"
          }`}
        >
          {count}/{maxLength}
        </span>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        className="min-h-[80px]"
      />
    </div>
  );
}
