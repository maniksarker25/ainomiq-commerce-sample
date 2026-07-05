import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  className?: string;
  children?: ReactNode;
};

export function EmptyState({
  message,
  actionLabel,
  onAction,
  actionHref,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-4 py-10 text-center",
        className,
      )}
    >
      <p className="text-sm text-muted-foreground">{message}</p>
      {children}
      {actionLabel && actionHref ? (
        <Button asChild variant="outline" size="sm" className="mt-4">
          <a href={actionHref}>{actionLabel}</a>
        </Button>
      ) : null}
      {actionLabel && onAction && !actionHref ? (
        <Button variant="outline" size="sm" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
