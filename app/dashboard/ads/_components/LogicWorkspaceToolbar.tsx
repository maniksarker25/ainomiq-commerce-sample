"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "./SectionHeader";

type LogicWorkspaceToolbarProps = {
  title: string;
  description: string;
  refreshLabel: string;
  onRefresh: () => void;
  action?: ReactNode;
};

export function LogicWorkspaceToolbar({
  title,
  description,
  refreshLabel,
  onRefresh,
  action,
}: LogicWorkspaceToolbarProps) {
  return (
    <SectionHeader
      className="mb-6"
      title={title}
      description={description}
      action={
        action ?? (
          <Button variant="outline" size="sm" onClick={onRefresh}>
            {refreshLabel}
          </Button>
        )
      }
    />
  );
}
