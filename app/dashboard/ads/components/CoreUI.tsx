import React from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  children,
  clean = false,
}: {
  title: string;
  children: React.ReactNode;
  clean?: boolean;
}) {
  if (clean) {
    return (
      <section className="space-y-4">
        {title ? (
          <h3 className="px-1 text-sm font-semibold text-foreground">{title}</h3>
        ) : null}
        {children}
      </section>
    );
  }

  return (
    <Card className="gap-4 py-4">
      {title ? (
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent className={title ? "pt-0" : undefined}>{children}</CardContent>
    </Card>
  );
}

export function LoadingState({ text }: { text: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <Skeleton className="size-5 rounded-full" />
        <p className="text-sm font-medium text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );
}

export function EmptyState({
  text,
  actionHref,
  actionLabel,
}: {
  text: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <Card className="border-dashed shadow-none">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-sm font-medium text-muted-foreground">{text}</p>
        {actionHref && actionLabel ? (
          <Button asChild size="sm">
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
        ) : null}
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
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

export function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <Card size="sm" className="gap-2 shadow-none">
      <CardHeader className="pb-0">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

export function Banner({
  tone,
  text,
}: {
  tone: "error" | "success";
  text: string;
}) {
  const isError = tone === "error";
  return (
    <Alert variant={isError ? "destructive" : "default"}>
      {isError ? (
        <AlertTriangle className="size-4" />
      ) : (
        <CheckCircle2 className="size-4" />
      )}
      <AlertDescription className="font-medium">{text}</AlertDescription>
    </Alert>
  );
}

export function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm text-foreground">{value || "Not found yet."}</div>
    </div>
  );
}

export function MiniList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {items.length ? (
        <ul className="mt-2 space-y-1 text-sm text-foreground">
          {items.slice(0, 5).map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      ) : (
        <div className="mt-2 text-sm text-muted-foreground">No signals yet.</div>
      )}
    </div>
  );
}

export function Gate({
  gate,
}: {
  gate?: { allowed: boolean; blockers: string[] };
}) {
  if (gate?.allowed) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <CheckCircle2 className="size-4" />
        Ready to prepare run job
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {(gate?.blockers || ["No publish gate state loaded."]).map((blocker) => (
        <li
          key={blocker}
          className="flex items-start gap-2 text-sm text-muted-foreground"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <span>{blocker}</span>
        </li>
      ))}
    </ul>
  );
}

export function InstagramGlyph({ className = "" }: { className?: string }) {
  return (
    <svg className={cn(className)} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  );
}
