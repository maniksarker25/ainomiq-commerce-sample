"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type CreativeOsStatusTone =
  | "active"
  | "invited"
  | "delivered"
  | "revision"
  | "draft"
  | "neutral";

const toneClass: Record<CreativeOsStatusTone, string> = {
  active: "border-green-200 bg-green-50 text-green-700",
  invited: "border-primary/20 bg-primary/5 text-primary",
  delivered: "border-green-200 bg-green-50 text-green-700",
  revision: "border-amber-200 bg-amber-50 text-amber-700",
  draft: "border-border bg-muted/50 text-muted-foreground",
  neutral: "border-border bg-muted/40 text-muted-foreground",
};

export function StatusBadge({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: CreativeOsStatusTone;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
        toneClass[tone],
        className,
      )}
    >
      {label}
    </Badge>
  );
}

/** Map common task status strings to badge tones. */
export function taskStatusTone(status: string): CreativeOsStatusTone {
  const normalized = status.trim().toLowerCase();
  if (normalized === "delivered") return "delivered";
  if (normalized.includes("revision")) return "revision";
  if (normalized === "draft") return "draft";
  if (normalized === "active" || normalized === "assigned") return "invited";
  return "invited";
}
