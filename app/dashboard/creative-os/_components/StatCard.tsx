"use client";

import type { ComponentType } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  note,
  icon: Icon,
  className,
}: {
  label: string;
  value: string | number;
  note?: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  className?: string;
}) {
  return (
    <Card className={cn("border-primary/15 bg-primary/5 shadow-none", className)}>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{value}</div>
          {note ? (
            <div className="mt-1 text-sm text-muted-foreground">{note}</div>
          ) : null}
        </div>
        <div className="rounded-xl bg-primary/10 p-2 text-primary">
          <Icon size={18} />
        </div>
      </CardContent>
    </Card>
  );
}

export function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold text-foreground">{value}</div>
    </div>
  );
}
