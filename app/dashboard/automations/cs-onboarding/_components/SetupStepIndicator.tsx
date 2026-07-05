"use client";

import { Check } from "lucide-react";
import { SETUP_STEPS } from "../_lib/types";

export function SetupStepIndicator({
  current,
  platform,
}: {
  current: string;
  platform?: string;
}) {
  const steps = SETUP_STEPS.filter(
    (s) =>
      !("conditional" in s && s.conditional) ||
      (s.key === "shopify-connect" && platform === "shopify"),
  );
  return (
    <div className="mb-8 flex items-center gap-2 overflow-x-auto pb-1">
      {steps.map((s, i) => {
        const isCurrent = s.key === current;
        const isDone = steps.findIndex((ss) => ss.key === current) > i;
        return (
          <div key={s.key} className="flex shrink-0 items-center gap-2">
            {i > 0 && (
              <div
                className={`h-px w-8 ${isDone ? "bg-primary" : "bg-border"}`}
              />
            )}
            <div className="flex items-center gap-1.5">
              <div
                className={`flex size-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                  isDone
                    ? "bg-primary text-primary-foreground"
                    : isCurrent
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {isDone ? <Check className="size-3" /> : i + 1}
              </div>
              <span
                className={`text-xs ${isCurrent || isDone ? "font-medium text-foreground" : "text-muted-foreground"}`}
              >
                {s.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
