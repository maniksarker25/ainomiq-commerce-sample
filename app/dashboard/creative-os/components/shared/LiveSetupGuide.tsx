"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SetupGuideStep } from "../../types";

export function LiveSetupGuide({
  steps,
  activeIndex,
  onSelect,
  onNext,
}: {
  steps: SetupGuideStep[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onNext: () => void;
}) {
  const activeStep = steps[activeIndex] || steps[0];
  const nextDisabled = activeIndex >= steps.length - 1;

  return (
    <Card className="rounded-3xl border-primary/15 bg-card shadow-sm">
      <CardContent className="p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Live setup demo
            </div>
            <h3 className="mt-2 text-xl font-bold tracking-tight text-foreground">
              Set up Creative OS step by step
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Follow the numbered guide. Each step opens the right place until
              the system is installed.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {steps.map((step, index) => (
              <button
                key={step.title}
                type="button"
                onClick={() => onSelect(index)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border text-sm font-bold transition-colors",
                  index === activeIndex
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : step.done
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-primary",
                )}
                aria-label={`Open setup step ${index + 1}`}
              >
                {step.done ? <CheckCircle2 size={16} /> : index + 1}
              </button>
            ))}
          </div>
        </div>

        <Card className="mt-4 border-border bg-muted/50 shadow-none">
          <CardContent className="p-4 md:flex md:items-center md:justify-between md:gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                  {activeIndex + 1}
                </span>
                {activeStep.title}
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {activeStep.body}
              </p>
            </div>
            <div className="mt-4 flex shrink-0 flex-wrap gap-2 md:mt-0">
              <Button type="button" onClick={activeStep.onClick}>
                {activeStep.action}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onNext}
                disabled={nextDisabled}
              >
                Next step
              </Button>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
