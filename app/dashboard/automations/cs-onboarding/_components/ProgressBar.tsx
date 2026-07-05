"use client";

import { Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { STEPS } from "../_lib/types";

export function ProgressBar({ currentStep }: { currentStep: string }) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentStep);
  const pct =
    currentStep === "complete"
      ? 100
      : Math.max(0, ((currentIdx + 1) / STEPS.length) * 100);

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-2 flex justify-between">
        {STEPS.map((s, i) => {
          const done = currentStep === "complete" || i < currentIdx;
          const active = i === currentIdx;
          return (
            <div key={s.key} className="flex flex-1 flex-col items-center">
              <div
                className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ${
                  done
                    ? "bg-primary text-primary-foreground"
                    : active
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/15"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </div>
              <span
                className={`mt-1.5 text-center text-[11px] leading-tight ${done || active ? "font-medium text-foreground" : "text-muted-foreground"}`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
      <Progress value={pct} className="mt-3 h-1" />
    </div>
  );
}
