"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type PillTabItem<T extends string = string> = {
  id: T;
  label: string;
  /** Shown below `sm` when horizontal space is tight */
  shortLabel?: string;
  icon?: LucideIcon;
  badge?: number;
};

type PillTabBarProps<T extends string> = {
  tabs: PillTabItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
  ariaLabel?: string;
  className?: string;
};

export function PillTabBar<T extends string>({
  tabs,
  activeId,
  onChange,
  ariaLabel = "Sections",
  className,
}: PillTabBarProps<T>) {
  return (
    <div
      className={cn(
        "mb-6 flex w-full min-w-0 snap-x snap-proximity gap-1 overflow-x-auto overscroll-x-contain rounded-xl p-1 sm:mb-8 max-w-min",
        "[-webkit-overflow-scrolling:touch] scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      style={{ background: "#f0f3f9" }}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => {
        const active = activeId === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex min-h-[40px] shrink-0 snap-start items-center justify-center gap-1.5 rounded-lg border-0 px-3 py-2 text-xs font-medium transition-all",
              "sm:gap-2 sm:px-5 sm:text-sm",
              active
                ? "bg-white text-[var(--ai-blue)] shadow-[0_4px_12px_rgba(0,0,0,0.05)]"
                : "bg-transparent text-[var(--ai-text-muted)]",
              active ? "cursor-default" : "cursor-pointer",
            )}
          >
            {Icon ? <Icon className="w-4 h-4 shrink-0" aria-hidden /> : null}
            <span className="whitespace-nowrap">
              {tab.shortLabel ? (
                <>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </>
              ) : (
                tab.label
              )}
            </span>
            {typeof tab.badge === "number" && tab.badge > 0 ? (
              <span
                className={cn(
                  "ml-0.5 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md px-1.5 text-[10px] font-bold",
                  active
                    ? "bg-blue-500/10 text-[var(--ai-blue)]"
                    : "bg-black/[0.06] text-[var(--ai-text-muted)]",
                )}
              >
                {tab.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
