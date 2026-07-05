"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { Product } from "../../types";

export function PreviewCard({ product }: { product: Product }) {
  return (
    <Card className="shadow-none">
      <CardContent className="space-y-3 p-4">
        <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-muted">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name || "Product preview"}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="px-6 text-center text-sm text-muted-foreground">
              Add a product image URL to preview this product.
            </div>
          )}
        </div>
        <div>
          <div className="text-sm font-semibold text-foreground">
            {product.name || "New product"}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {product.explanation ||
              "Add product context to power briefs and reviews."}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {product.platforms.length ? (
            product.platforms.map((platform) => (
              <span
                key={platform}
                className="rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary"
              >
                {platform}
              </span>
            ))
          ) : (
            <span>No platforms selected yet.</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
