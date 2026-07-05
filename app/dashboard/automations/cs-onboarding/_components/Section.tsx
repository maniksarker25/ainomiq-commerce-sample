"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";


export function Section({
  title,
  icon,
  count,
  children,
  muted,
}: {
  title: string;
  icon?: React.ReactNode;
  count?: number;
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border ${muted ? "border-dashed border-gray-200 bg-gray-50/50" : "border-gray-200 bg-white"}`}
    >
      <div className="px-5 py-3.5 flex items-center gap-2.5">
        {icon && <span className="text-gray-400">{icon}</span>}
        <h3 className="text-[13px] font-semibold text-gray-900 flex-1">
          {title}
        </h3>
        {count !== undefined && (
          <span
            className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${count > 0 ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-400"}`}
          >
            {count}
          </span>
        )}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </div>
  );
}
