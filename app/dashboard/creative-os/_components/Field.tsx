"use client";

import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function FieldLabel({
  label,
  help,
}: {
  label: string;
  help?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {help ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`${label} info`}
                className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground outline-none hover:text-primary focus-visible:text-primary"
              >
                <CircleHelp size={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-72 text-left">
              {help}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </div>
  );
}

export function Field({
  label,
  help,
  children,
  className,
}: {
  label: string;
  help?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      <FieldLabel label={label} help={help} />
      {children}
    </div>
  );
}
