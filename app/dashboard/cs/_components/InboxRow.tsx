"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type InboxRowProps = {
  selected?: boolean;
  unread?: boolean;
  onClick?: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  badges?: ReactNode;
  className?: string;
};

export function InboxRow({
  selected,
  unread,
  onClick,
  title,
  subtitle,
  meta,
  badges,
  className,
}: InboxRowProps) {
  const Comp = onClick ? "button" : "div";

  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-selected={onClick ? selected : undefined}
      className={cn(
        "w-full min-w-0 border-b border-border/60 px-4 py-3 text-left transition-colors last:border-b-0",
        onClick && "cursor-pointer hover:bg-muted/50",
        selected && "bg-primary/5 hover:bg-primary/5",
        className,
      )}
    >
      <div className="flex items-start gap-2 mb-1">
        {unread ? (
          <span
            className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
            aria-label="Unread"
          />
        ) : null}
        <div className="flex-1 min-w-0 text-sm font-medium wrap-break-word ">
          {title}
        </div>
        {meta ? (
          <div className="shrink-0 pt-0.5 text-[11px] text-muted-foreground">
            {meta}
          </div>
        ) : null}
      </div>
      {subtitle ? (
        <div
          className={cn(
            "min-w-0 wrap-break-word text-sm text-muted-foreground ",
            unread && "pl-4",
          )}
        >
          {subtitle}
        </div>
      ) : null}
      {badges ? (
        <div
          className={cn(
            "mt-2 flex flex-wrap items-center gap-1.5",
            unread && "pl-4",
          )}
        >
          {badges}
        </div>
      ) : null}
    </Comp>
  );
}
