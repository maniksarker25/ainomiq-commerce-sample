"use client";

import type { LucideIcon } from "lucide-react";
import { PillTabBar } from "@/components/PillTabBar";

type LogicSubNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

type LogicSubNavProps = {
  items: LogicSubNavItem[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel: string;
};

export function LogicSubNav({
  items,
  activeId,
  onChange,
  ariaLabel,
}: LogicSubNavProps) {
  return (
    <PillTabBar
      tabs={items.map((item) => ({
        id: item.id,
        label: item.label,
        icon: item.icon,
      }))}
      activeId={activeId}
      onChange={onChange}
      ariaLabel={ariaLabel}
    />
  );
}
