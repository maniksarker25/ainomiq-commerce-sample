import type { LogicActionCard } from "../lib/logic-actions";
import { cn } from "@/lib/utils";

export function severityDotClass(severity: LogicActionCard["severity"]) {
  return cn(
    "size-2.5 shrink-0 rounded-full",
    severity === "critical" && "bg-red-500",
    severity === "warning" && "bg-amber-500",
    severity === "success" && "bg-green-500",
    severity === "info" && "bg-primary",
  );
}

export function severityBadgeClass(severity: LogicActionCard["severity"]) {
  return cn(
    "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
    severity === "critical" && "bg-red-50 text-red-700",
    severity === "warning" && "bg-amber-50 text-amber-700",
    severity === "success" && "bg-emerald-50 text-emerald-700",
    severity === "info" && "bg-primary/10 text-primary",
  );
}

export function severityCardClass(severity: LogicActionCard["severity"]) {
  return cn(
    "rounded-2xl border bg-background p-4 transition hover:-translate-y-0.5 hover:shadow-md",
    severity === "critical" &&
      "border-red-200 hover:border-red-300 hover:bg-red-50/40",
    severity === "warning" &&
      "border-amber-200 hover:border-amber-300 hover:bg-amber-50/40",
    severity === "success" &&
      "border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50/40",
    severity === "info" &&
      "border-border/60 hover:border-primary/30 hover:bg-primary/5",
  );
}

export function severityActionButtonClass(severity: LogicActionCard["severity"]) {
  return cn(
    severity === "critical" && "bg-red-600 hover:bg-red-700",
    severity === "warning" && "bg-amber-600 hover:bg-amber-700",
    severity === "success" && "bg-emerald-600 hover:bg-emerald-700",
    severity === "info" && "bg-primary hover:bg-primary/90",
  );
}

export function severityActionTextClass(severity: LogicActionCard["severity"]) {
  return cn(
    "text-xs font-semibold",
    severity === "critical" && "text-red-700",
    severity === "warning" && "text-amber-700",
    severity === "success" && "text-emerald-700",
    severity === "info" && "text-primary",
  );
}
