"use client";

import type { ComponentProps } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function CreativeOsCard({
  className,
  ...props
}: ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn("rounded-2xl shadow-none ring-primary/10", className)}
      {...props}
    />
  );
}
