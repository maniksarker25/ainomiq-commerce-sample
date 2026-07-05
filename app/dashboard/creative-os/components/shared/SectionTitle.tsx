"use client";

import type { ReactNode } from "react";
import { SectionHeader } from "@/app/dashboard/ads/_components/SectionHeader";

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <SectionHeader title={title} description={subtitle} action={action} />
  );
}
