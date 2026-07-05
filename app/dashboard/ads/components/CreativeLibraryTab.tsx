"use client";

import { Archive, FolderOpen, Pencil, Search, Upload } from "lucide-react";
import type {
  CreativeLibraryAsset,
  PersonaSuggestion,
  ProductFolder,
} from "../types";
import { ratioClass } from "../lib/creative-preview";
import { EmptyState, Panel } from "./CoreUI";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type CreativeLibraryTabProps = {
  productCatalogItems: ProductFolder[];
  savedPersonaSuggestions: PersonaSuggestion[];
  creativeLibraryAssets: CreativeLibraryAsset[];
  filteredCreativeLibraryAssets: CreativeLibraryAsset[];
  assetSearchQuery: string;
  onAssetSearchQueryChange: (value: string) => void;
  assetProductFilter: string;
  onAssetProductFilterChange: (value: string) => void;
  assetPersonaFilter: string;
  onAssetPersonaFilterChange: (value: string) => void;
  assetTypeFilter: "all" | "image" | "video";
  onAssetTypeFilterChange: (value: "all" | "image" | "video") => void;
  assetRatioFilter: string;
  onAssetRatioFilterChange: (value: string) => void;
  assetStatusFilter: "ready" | "needs_review" | "archived";
  onAssetStatusFilterChange: (
    value: "ready" | "needs_review" | "archived",
  ) => void;
  pendingArchiveAssetId: string | null;
  onPendingArchiveAssetIdChange: (value: string | null) => void;
  archiveBusy: boolean;
  onOpenAddCreativeModal: () => void;
  onOpenEditCreativeModal: (asset: CreativeLibraryAsset) => void;
  onArchiveAsset: (assetId: string) => void;
};

function statusBadgeClass(status: CreativeLibraryAsset["status"]) {
  if (status === "ready") return "bg-emerald-50 text-emerald-700 hover:bg-emerald-50";
  if (status === "needs_review")
    return "bg-amber-50 text-amber-700 hover:bg-amber-50";
  return "bg-muted text-muted-foreground hover:bg-muted";
}

export default function CreativeLibraryTab({
  productCatalogItems,
  savedPersonaSuggestions,
  creativeLibraryAssets,
  filteredCreativeLibraryAssets,
  assetSearchQuery,
  onAssetSearchQueryChange,
  assetProductFilter,
  onAssetProductFilterChange,
  assetPersonaFilter,
  onAssetPersonaFilterChange,
  assetTypeFilter,
  onAssetTypeFilterChange,
  assetRatioFilter,
  onAssetRatioFilterChange,
  assetStatusFilter,
  onAssetStatusFilterChange,
  pendingArchiveAssetId,
  onPendingArchiveAssetIdChange,
  archiveBusy,
  onOpenAddCreativeModal,
  onOpenEditCreativeModal,
  onArchiveAsset,
}: CreativeLibraryTabProps) {
  return (
    <Panel title="Creative Library">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Store brand-owned image and video assets, connect them to products and
              personas, then use them when building ad sets.
            </p>
            <Alert className="mt-3">
              <AlertDescription>
                Upload storage is being connected. URL-based creative saving is
                ready now and does not store large files in the database.
              </AlertDescription>
            </Alert>
          </div>
          <Button onClick={onOpenAddCreativeModal}>
            <Upload className="size-4" />
            Add creative
          </Button>
        </div>

        <Card className="shadow-none">
          <CardContent className="grid gap-3 pt-6 md:grid-cols-6">
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={assetSearchQuery}
                onChange={(event) =>
                  onAssetSearchQueryChange(event.target.value)
                }
                placeholder="Search by name..."
                className="pl-9"
              />
            </div>
            <Select
              value={assetProductFilter}
              onValueChange={onAssetProductFilterChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="All products" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All products</SelectItem>
                {productCatalogItems.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={assetPersonaFilter}
              onValueChange={onAssetPersonaFilterChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="All personas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All personas</SelectItem>
                {savedPersonaSuggestions.map((persona) => (
                  <SelectItem key={persona.id} value={persona.id}>
                    {persona.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={assetTypeFilter}
              onValueChange={(value) =>
                onAssetTypeFilterChange(value as "all" | "image" | "video")
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="image">Images</SelectItem>
                <SelectItem value="video">Videos</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={assetRatioFilter}
              onValueChange={onAssetRatioFilterChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="All ratios" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ratios</SelectItem>
                {["4:5", "9:16", "1:1", "16:9", "unknown"].map((ratio) => (
                  <SelectItem key={ratio} value={ratio}>
                    {ratio}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={assetStatusFilter}
              onValueChange={(value) =>
                onAssetStatusFilterChange(
                  value as "ready" | "needs_review" | "archived",
                )
              }
            >
              <SelectTrigger className="md:col-span-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="needs_review">Needs review</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {!creativeLibraryAssets.length ? (
          <Card className="border-dashed shadow-none">
            <CardContent className="flex flex-col items-center px-6 py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FolderOpen className="size-5" />
              </div>
              <h4 className="mt-4 font-semibold">No creatives saved yet.</h4>
              <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                Add brand-owned image or video assets, then connect them to a
                product and persona.
              </p>
              <Button className="mt-4" onClick={onOpenAddCreativeModal}>
                Add creative
              </Button>
            </CardContent>
          </Card>
        ) : filteredCreativeLibraryAssets.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredCreativeLibraryAssets.map((asset) => (
              <Card key={asset.id} className="overflow-hidden shadow-none">
                <div className={cn(ratioClass(asset.ratio), "bg-muted/30")}>
                  {asset.type === "video" ? (
                    <video
                      src={asset.asset_url}
                      poster={asset.thumbnail_url || undefined}
                      controls
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <img
                      src={asset.thumbnail_url || asset.asset_url}
                      alt={asset.name}
                      className="h-full w-full object-contain"
                    />
                  )}
                </div>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{asset.name}</div>
                      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {asset.type} · {asset.ratio}
                      </div>
                    </div>
                    <Badge className={statusBadgeClass(asset.status)}>
                      {asset.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="grid gap-2 text-xs text-muted-foreground">
                    <div>
                      <span className="font-medium text-foreground">
                        Product:
                      </span>{" "}
                      {asset.product_name || "Not assigned"}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">
                        Persona:
                      </span>{" "}
                      {asset.persona_name || "Product-level creative"}
                    </div>
                  </div>
                  {pendingArchiveAssetId === asset.id ? (
                    <Alert variant="destructive" className="py-3">
                      <AlertDescription className="space-y-2">
                        <div className="font-medium">Archive this creative?</div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onPendingArchiveAssetIdChange(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={archiveBusy}
                            onClick={() => onArchiveAsset(asset.id)}
                          >
                            Archive
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onOpenEditCreativeModal(asset)}
                      >
                        <Pencil className="size-3.5" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onPendingArchiveAssetIdChange(asset.id)}
                      >
                        <Archive className="size-3.5" />
                        Archive
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState text="No creatives match these filters." />
        )}
      </div>
    </Panel>
  );
}
