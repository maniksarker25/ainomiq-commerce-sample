"use client";

import { Package, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Product } from "../../types";

type CatalogPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  selectedIds: string[];
  search: string;
  onSearchChange: (value: string) => void;
  onToggleProduct: (productId: string) => void;
  onSelectAllVisible: () => void;
  onClearSelection: () => void;
  isAlreadyAdded: (productId: string) => boolean;
  onImport: () => void;
};

export function CatalogPickerDialog({
  open,
  onOpenChange,
  products,
  selectedIds,
  search,
  onSearchChange,
  onToggleProduct,
  onSelectAllVisible,
  onClearSelection,
  isAlreadyAdded,
  onImport,
}: CatalogPickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(90vh,820px)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
        showCloseButton={false}
      >
        <DialogHeader className="gap-3 border-b px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:text-left">
          <div className="space-y-1">
            <DialogTitle>Choose products from catalog</DialogTitle>
            <DialogDescription>
              Select one product or a group. Creative OS will manage them as a
              product set.
            </DialogDescription>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button type="button" variant="outline" size="sm" onClick={onSelectAllVisible}>
              Select all visible
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onClearSelection}>
              Clear
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search products"
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[min(50vh,420px)] pr-3">
            <div className="grid gap-3 md:grid-cols-2">
              {products.map((product) => {
                const selected = selectedIds.includes(product.id);
                const alreadyAdded = isAlreadyAdded(product.id);

                return (
                  <button
                    key={product.id}
                    type="button"
                    disabled={alreadyAdded}
                    onClick={() => onToggleProduct(product.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                      selected
                        ? "border-primary/30 bg-primary/5 ring-1 ring-primary/20"
                        : "border-border bg-card hover:bg-muted/40",
                    )}
                  >
                    <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="size-full object-cover"
                        />
                      ) : (
                        <Package className="size-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-foreground">
                        {product.name}
                      </div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        {alreadyAdded
                          ? "Already added"
                          : product.url || "Catalog product"}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "size-5 shrink-0 rounded-full border",
                        selected
                          ? "border-primary bg-primary"
                          : "border-input bg-background",
                      )}
                    />
                  </button>
                );
              })}
              {!products.length ? (
                <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground md:col-span-2">
                  No products found.
                </div>
              ) : null}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-3 sm:justify-between">
          <Badge variant="secondary">{selectedIds.length} selected</Badge>
          <Button
            type="button"
            disabled={!selectedIds.length}
            onClick={onImport}
          >
            Add selected products
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
