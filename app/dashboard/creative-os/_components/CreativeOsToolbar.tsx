"use client";

import type { ReactNode } from "react";
import { SectionHeader } from "@/app/dashboard/ads/_components/SectionHeader";
import { Button } from "@/components/ui/button";

type CreativeOsToolbarProps = {
  title: string;
  description: string;
  refreshLabel?: string;
  onRefresh?: () => void;
  action?: ReactNode;
};

export function CreativeOsToolbar({
  title,
  description,
  refreshLabel = "Refresh",
  onRefresh,
  action,
}: CreativeOsToolbarProps) {
  return (
    <SectionHeader
      className="mb-6"
      title={title}
      description={description}
      action={
        action ??
        (onRefresh ? (
          <Button variant="outline" size="sm" onClick={onRefresh}>
            {refreshLabel}
          </Button>
        ) : null)
      }
    />
  );
}
