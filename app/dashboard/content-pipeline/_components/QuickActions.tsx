"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { STARTER_IDEAS } from "../_lib/utils";
import { ProductCatalogItem } from "../_lib/types";

interface Props {
  productForGeneration: ProductCatalogItem | null;
  product: string;
  onSendMessage: (msg: string) => void;
}

export function QuickActions({ productForGeneration, product, onSendMessage }: Props) {
  return (
    <Card className="h-fit rounded-[20px] border-blue-100 shadow-sm sm:rounded-[28px]">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-lg font-bold text-gray-950 sm:text-xl">One-click starts</CardTitle>
        <CardDescription className="text-sm text-gray-600">
          Simple content angles for the selected product or catalog.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
        {STARTER_IDEAS.map((idea) => (
          <button
            key={idea.title}
            onClick={() =>
              onSendMessage(
                `Create 3 ready-to-use Instagram posts for ${productForGeneration?.title || product || "products from my catalog"}. Angle: ${idea.title}. ${idea.angle}`,
              )
            }
            className="w-full p-4 text-left transition-all border border-gray-100 rounded-2xl bg-gray-50/50 hover:bg-blue-50 hover:border-blue-200 group"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-bold text-gray-950 group-hover:text-blue-700 transition-colors">
                {idea.title}
              </div>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-blue-50 text-blue-700 border-blue-100">
                {idea.channel}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-gray-600 line-clamp-2">{idea.angle}</p>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
