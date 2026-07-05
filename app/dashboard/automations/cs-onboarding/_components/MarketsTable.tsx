"use client";

import { useState } from "react";
import type { AvailableMarket } from "@/lib/scraper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";


export function MarketsTable({ markets }: { markets: AvailableMarket[] }) {
  const [expanded, setExpanded] = useState(false);
  // Group by currency
  const byCurrency = new Map<string, AvailableMarket[]>();
  for (const m of markets) {
    const list = byCurrency.get(m.currency) || [];
    list.push(m);
    byCurrency.set(m.currency, list);
  }
  const currencies = Array.from(byCurrency.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  const visible = expanded ? currencies : currencies.slice(0, 4);

  return (
    <div className="space-y-3">
      {visible.map(([currency, countries]) => (
        <div key={currency}>
          <p className="text-xs font-medium text-gray-900 mb-1">
            {currency}{" "}
            <span className="text-gray-400 font-normal">
              · {countries.length}{" "}
              {countries.length === 1 ? "country" : "countries"}
            </span>
          </p>
          <div className="flex flex-wrap gap-1">
            {countries.map((c) => (
              <span
                key={c.country}
                className="text-[11px] bg-gray-50 text-gray-600 px-1.5 py-0.5 rounded"
                title={c.name}
              >
                {c.country}
              </span>
            ))}
          </div>
        </div>
      ))}
      {currencies.length > 4 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          {expanded ? "Show less" : `Show all ${currencies.length} currencies`}
        </button>
      )}
    </div>
  );
}
