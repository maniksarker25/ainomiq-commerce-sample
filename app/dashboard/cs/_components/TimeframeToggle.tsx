"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

const TIMEFRAMES = [
  { label: "Today", value: 0 },
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
] as const;

type TimeframeToggleProps = {
  value: number;
  onChange: (value: number) => void;
  className?: string;
};

export function TimeframeToggle({
  value,
  onChange,
  className,
}: TimeframeToggleProps) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={String(value)}
      onValueChange={(next) => {
        if (next) onChange(Number(next));
      }}
      className={cn("flex-wrap", className)}
    >
      {TIMEFRAMES.map((tf) => (
        <ToggleGroupItem
          key={tf.value}
          value={String(tf.value)}
          aria-label={tf.label}
          className="px-3 text-xs sm:text-sm"
        >
          {tf.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
