"use client";

import {
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Package,
  Search,
  Trash2,
} from "lucide-react";
import type {
  DbRow,
  Overview,
  PersonaBuildResult,
  ProductFolder,
} from "../types";
import { PERSONA_READING_SOURCES } from "../types";
import { EmptyState, InfoBlock, Panel } from "./CoreUI";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

type PersonasTabProps = {
  overview: Overview | null;
  personaProductMode: "catalog" | "custom";
  onPersonaProductModeChange: (mode: "catalog" | "custom") => void;
  personaSelectedProductIds: string[];
  onTogglePersonaProduct: (productId: string) => void;
  catalogSearchQuery: string;
  onCatalogSearchQueryChange: (value: string) => void;
  catalogSearchTerm: string;
  visibleCatalogItems: ProductFolder[];
  productCatalogItems: ProductFolder[];
  catalogLoading: boolean;
  brandDataScanHref: string;
  personaProductInput: string;
  onPersonaProductInputChange: (value: string) => void;
  personaProductDescription: string;
  onPersonaProductDescriptionChange: (value: string) => void;
  personaCount: number;
  onPersonaCountChange: (count: number) => void;
  personaBuildNeedsMoreNomi: boolean;
  personaBuildNomiCost: number;
  nomiBalance: number;
  onBuildPersonas: () => void;
  personaBuildLoading: boolean;
  personaReadingLabel: string;
  personaReadingText: string;
  personaReadingIndex: number;
  personaBuildError: string | null;
  personaBuildResult: PersonaBuildResult | null;
  expandedBuiltPersonaId: string | null;
  onExpandedBuiltPersonaIdChange: (id: string | null) => void;
  savedBuiltPersonaIds: string[];
  savingBuiltPersonaId: string | null;
  onSaveBuiltPersona: (persona: PersonaBuildResult["personas"][number]) => void;
  expandedGalleryPersonaId: string | null;
  onExpandedGalleryPersonaIdChange: (id: string | null) => void;
  pendingDeletePersonaId: string | null;
  onPendingDeletePersonaIdChange: (id: string | null) => void;
  personaDeleteError: string | null;
  onPersonaDeleteErrorChange: (error: string | null) => void;
  deletingPersonaId: string | null;
  onConfirmDeletePersona: (personaId: string) => void;
  onCancelDeletePersona: () => void;
  connectedProductLabelForPersona: (row: DbRow) => string;
  onGoToGenerate: () => void;
};

export default function PersonasTab({
  overview,
  personaProductMode,
  onPersonaProductModeChange,
  personaSelectedProductIds,
  onTogglePersonaProduct,
  catalogSearchQuery,
  onCatalogSearchQueryChange,
  catalogSearchTerm,
  visibleCatalogItems,
  productCatalogItems,
  catalogLoading,
  brandDataScanHref,
  personaProductInput,
  onPersonaProductInputChange,
  personaProductDescription,
  onPersonaProductDescriptionChange,
  personaCount,
  onPersonaCountChange,
  personaBuildNeedsMoreNomi,
  personaBuildNomiCost,
  nomiBalance,
  onBuildPersonas,
  personaBuildLoading,
  personaReadingLabel,
  personaReadingText,
  personaReadingIndex,
  personaBuildError,
  personaBuildResult,
  expandedBuiltPersonaId,
  onExpandedBuiltPersonaIdChange,
  savedBuiltPersonaIds,
  savingBuiltPersonaId,
  onSaveBuiltPersona,
  expandedGalleryPersonaId,
  onExpandedGalleryPersonaIdChange,
  pendingDeletePersonaId,
  onPendingDeletePersonaIdChange,
  personaDeleteError,
  onPersonaDeleteErrorChange,
  deletingPersonaId,
  onConfirmDeletePersona,
  onCancelDeletePersona,
  connectedProductLabelForPersona,
  onGoToGenerate,
}: PersonasTabProps) {
  return (
    <Panel title="Persona builder">
      <div className="space-y-5">
        <Card className="shadow-none">
          <CardContent className="space-y-4 pt-6">
            <ToggleGroup
              type="single"
              value={personaProductMode}
              onValueChange={(value) => {
                if (value === "catalog" || value === "custom") {
                  onPersonaProductModeChange(value);
                }
              }}
              className="grid w-full grid-cols-2 rounded-xl bg-muted p-1"
            >
              <ToggleGroupItem
                value="catalog"
                className="rounded-lg data-[state=on]:bg-background data-[state=on]:text-primary data-[state=on]:shadow-sm"
              >
                Own catalog
              </ToggleGroupItem>
              <ToggleGroupItem
                value="custom"
                className="rounded-lg data-[state=on]:bg-background data-[state=on]:text-primary data-[state=on]:shadow-sm"
              >
                Custom product
              </ToggleGroupItem>
            </ToggleGroup>

            {personaProductMode === "catalog" ? (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <Label>Choose from scraped catalog</Label>
                  <Badge variant="secondary">
                    {personaSelectedProductIds.length
                      ? `${personaSelectedProductIds.length} selected`
                      : `${productCatalogItems.length} products`}
                  </Badge>
                </div>
                <div className="relative mt-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={catalogSearchQuery}
                    onChange={(event) =>
                      onCatalogSearchQueryChange(event.target.value)
                    }
                    placeholder="Search scraped catalog"
                    className="pl-9 pr-16"
                  />
                  {catalogSearchTerm ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 h-7 -translate-y-1/2 px-2 text-xs"
                      onClick={() => onCatalogSearchQueryChange("")}
                    >
                      Clear
                    </Button>
                  ) : null}
                </div>
                {catalogSearchTerm ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {visibleCatalogItems.length} matching product
                    {visibleCatalogItems.length === 1 ? "" : "s"}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-muted-foreground">
                  Select multiple products. Click again to remove.
                </p>
                {catalogLoading ? (
                  <Alert className="mt-3">
                    <Loader2 className="size-4 animate-spin" />
                    <AlertDescription>Loading scraped products...</AlertDescription>
                  </Alert>
                ) : productCatalogItems.length ? (
                  visibleCatalogItems.length ? (
                    <ScrollArea className="mt-3 max-h-72">
                      <div className="space-y-2 pr-3">
                        {visibleCatalogItems.map((item) => {
                          const isSelected = personaSelectedProductIds.includes(
                            item.id,
                          );
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => onTogglePersonaProduct(item.id)}
                              className={cn(
                                "w-full rounded-lg border p-3 text-left transition",
                                isSelected
                                  ? "border-primary/30 bg-primary/5"
                                  : "border-border bg-background hover:bg-muted/50",
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div className="size-12 shrink-0 overflow-hidden rounded-lg border bg-muted">
                                  {item.imageUrl ? (
                                    <img
                                      src={item.imageUrl}
                                      alt={item.name}
                                      className="size-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex size-full items-center justify-center text-muted-foreground/40">
                                      <Package className="size-4" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-semibold">
                                    {item.name}
                                  </div>
                                  <div className="mt-1 truncate text-xs text-muted-foreground">
                                    {item.url ||
                                      item.source ||
                                      "Scraped catalog product"}
                                  </div>
                                </div>
                                {isSelected ? (
                                  <CheckCircle2 className="size-4 shrink-0 text-primary" />
                                ) : null}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  ) : (
                    <EmptyState text="No products match this search." />
                  )
                ) : (
                  <EmptyState
                    text="No scraped products found yet. Analyze the business in General Settings, or switch to Custom product."
                    actionHref={brandDataScanHref}
                    actionLabel="Analyze business"
                  />
                )}
              </div>
            ) : (
              <div>
                <Label htmlFor="persona-product-input">
                  Product name or product URL
                </Label>
                <Input
                  id="persona-product-input"
                  value={personaProductInput}
                  onChange={(event) =>
                    onPersonaProductInputChange(event.target.value)
                  }
                  placeholder="Paste product URL or type product name"
                  className="mt-2"
                />
              </div>
            )}

            <div>
              <Label htmlFor="persona-description">
                Extra context or persona prompt
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Tell Logic Ads what kind of personas you want. Example: broad
                personas based on buying reasons, not demographics.
              </p>
              <Textarea
                id="persona-description"
                value={personaProductDescription}
                onChange={(event) =>
                  onPersonaProductDescriptionChange(event.target.value)
                }
                rows={4}
                className="mt-2"
                placeholder="Example: Build broad personas based on buying reasons. Focus on why someone buys, the situation they are in, objections, triggers and what proof they need."
              />
            </div>

            <div>
              <Label>Number of personas</Label>
              <ToggleGroup
                type="single"
                value={String(personaCount)}
                onValueChange={(value) => {
                  if (value) onPersonaCountChange(Number(value));
                }}
                className="mt-2 grid grid-cols-4 gap-2"
              >
                {[1, 2, 3, 4].map((count) => (
                  <ToggleGroupItem
                    key={count}
                    value={String(count)}
                    className="rounded-lg border data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  >
                    {count}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <div className="group relative inline-flex">
              <div
                className={cn(
                  "pointer-events-none absolute bottom-full left-0 z-30 mb-3 w-64 translate-y-1 rounded-2xl border bg-background p-3 text-left opacity-0 shadow-xl ring-1 transition duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100",
                  personaBuildNeedsMoreNomi
                    ? "border-destructive/20 ring-destructive/10"
                    : "border-primary/20 ring-primary/10",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={cn(
                      "text-xs font-semibold uppercase tracking-wide",
                      personaBuildNeedsMoreNomi
                        ? "text-destructive"
                        : "text-primary",
                    )}
                  >
                    Persona build
                  </span>
                  <Badge
                    variant={
                      personaBuildNeedsMoreNomi ? "destructive" : "secondary"
                    }
                  >
                    {personaBuildNomiCost} Nomi
                    {personaBuildNomiCost === 1 ? "" : "'s"}
                  </Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  One research run creates up to {personaCount} persona
                  {personaCount === 1 ? "" : "s"}.
                </p>
                {personaBuildNeedsMoreNomi ? (
                  <p className="mt-1 text-[11px] font-medium text-destructive">
                    Balance {nomiBalance}. Need{" "}
                    {personaBuildNomiCost - nomiBalance} more Nomi
                    {personaBuildNomiCost - nomiBalance === 1 ? "" : "'s"}.
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                onClick={onBuildPersonas}
                disabled={personaBuildLoading || personaBuildNeedsMoreNomi}
              >
                {personaBuildLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                {personaBuildLoading ? "Building personas..." : "Build personas"}
              </Button>
            </div>

            {personaBuildLoading ? (
              <Card className="border-primary/20 bg-linear-to-br from-primary/5 via-background to-muted/30 shadow-none">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                    <span className="size-2 shrink-0 animate-pulse rounded-full bg-primary" />
                    Public research
                  </div>
                  <div className="mt-3 rounded-xl border bg-background/80 px-3 py-3 font-mono text-sm shadow-inner">
                    {personaReadingLabel}:{" "}
                    <span className="text-primary">{personaReadingText}</span>
                    <span className="ml-0.5 inline-block h-4 w-1 translate-y-0.5 animate-pulse bg-primary" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {PERSONA_READING_SOURCES.map((source, index) => (
                      <Badge
                        key={source}
                        variant={
                          index <= personaReadingIndex ? "default" : "outline"
                        }
                      >
                        {source}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {personaBuildError ? (
              <Alert variant="destructive">
                <AlertDescription>{personaBuildError}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {personaBuildResult ? (
            <>
              <Card className="shadow-none">
                <CardContent className="pt-6">
                  <h3 className="font-semibold">Persona research</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {personaBuildResult.summary}
                  </p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-primary">
                    Review, then save personas one by one
                  </p>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">
                    {personaBuildResult.personas.length} persona
                    {personaBuildResult.personas.length === 1 ? "" : "s"}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    Save each persona after review
                  </span>
                </div>
                {personaBuildResult.personas
                  .slice(0, personaCount)
                  .map((persona, index) => {
                    const isOpen = expandedBuiltPersonaId === persona.id;
                    const isSaved = savedBuiltPersonaIds.includes(persona.id);
                    return (
                      <Card key={persona.id} className="shadow-none">
                        <div className="flex w-full items-center justify-between gap-3 px-4 py-3">
                          <button
                            type="button"
                            onClick={() =>
                              onExpandedBuiltPersonaIdChange(
                                isOpen ? null : persona.id,
                              )
                            }
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="text-xs font-semibold uppercase tracking-wide text-primary">
                              Buying reason {index + 1}
                            </div>
                            <div className="truncate font-semibold">
                              {persona.name}
                            </div>
                            <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                              {persona.angle}
                            </p>
                          </button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={
                              isSaved || savingBuiltPersonaId === persona.id
                            }
                            onClick={() => onSaveBuiltPersona(persona)}
                          >
                            {savingBuiltPersonaId === persona.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : null}
                            {isSaved
                              ? "Saved"
                              : savingBuiltPersonaId === persona.id
                                ? "Saving..."
                                : "Save"}
                          </Button>
                        </div>
                        {isOpen ? (
                          <CardContent className="border-t pt-4">
                            <p className="text-sm text-muted-foreground">
                              {persona.buying_situation}
                            </p>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <InfoBlock
                                label="Problem"
                                value={persona.core_problem}
                              />
                              <InfoBlock label="Desire" value={persona.desire} />
                              <InfoBlock
                                label="Trigger"
                                value={persona.trigger}
                              />
                              <InfoBlock
                                label="Proof needed"
                                value={persona.proof_needed.join(", ")}
                              />
                            </div>
                            <div className="mt-3 rounded-lg bg-primary/5 p-3 text-sm">
                              <div className="font-semibold">Ad angle</div>
                              <p className="mt-1">{persona.angle}</p>
                              <div className="mt-2 text-xs font-medium text-primary">
                                Hook: {persona.hook}
                              </div>
                            </div>
                          </CardContent>
                        ) : null}
                      </Card>
                    );
                  })}
              </div>
            </>
          ) : (
            <EmptyState text="Run Build personas to create saved persona angles for this product. They will be available for Create ads and Logic Ads strategy." />
          )}

          <Card className="shadow-none">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Persona Gallery</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Saved personas available for Create ads and Logic Ads.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button size="sm" onClick={onGoToGenerate}>
                    <ImageIcon className="size-3.5" />
                    Create ads
                  </Button>
                  <Badge variant="secondary">
                    {overview?.latestPersonas?.length || 0}
                  </Badge>
                </div>
              </div>
              {overview?.latestPersonas?.length ? (
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {overview.latestPersonas.map((persona) => {
                    const personaId = String(persona.id);
                    const isOpen = expandedGalleryPersonaId === personaId;
                    return (
                      <Card
                        key={personaId}
                        className={cn(
                          "cursor-pointer shadow-none transition",
                          isOpen && "border-primary/30 ring-1 ring-primary/10",
                        )}
                        onClick={() =>
                          onExpandedGalleryPersonaIdChange(
                            isOpen ? null : personaId,
                          )
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onExpandedGalleryPersonaIdChange(
                              isOpen ? null : personaId,
                            );
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="flex w-full items-center justify-between gap-3 p-3 text-left">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">
                              {String(persona.name || "Saved persona")}
                            </div>
                            <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              Saved persona angle for this product.
                            </div>
                            <Badge variant="secondary" className="mt-2">
                              {connectedProductLabelForPersona(persona)}
                            </Badge>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Delete persona"
                            className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={(event) => {
                              event.stopPropagation();
                              onPersonaDeleteErrorChange(null);
                              onPendingDeletePersonaIdChange(personaId);
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                        {pendingDeletePersonaId === personaId ? (
                          <Alert
                            variant="destructive"
                            className="mx-3 mb-3"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <AlertDescription className="space-y-3">
                              <div>
                                <div className="font-semibold">
                                  Delete this persona?
                                </div>
                                <p className="mt-1">
                                  This removes it from the Persona Gallery and
                                  Create ads selector.
                                </p>
                                {personaDeleteError ? (
                                  <p className="mt-2 rounded-lg bg-background px-2 py-1 text-xs">
                                    {personaDeleteError}
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={deletingPersonaId === personaId}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onConfirmDeletePersona(personaId);
                                  }}
                                >
                                  {deletingPersonaId === personaId
                                    ? "Deleting..."
                                    : "Delete persona"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={deletingPersonaId === personaId}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onCancelDeletePersona();
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </AlertDescription>
                          </Alert>
                        ) : null}
                        {isOpen ? (
                          <CardContent className="border-t pt-3 text-sm">
                            <Badge variant="secondary" className="mb-3">
                              {connectedProductLabelForPersona(persona)}
                            </Badge>
                            {persona.angle ? (
                              <div>
                                <div className="text-xs font-semibold uppercase tracking-wide text-primary">
                                  Ad angle
                                </div>
                                <p className="mt-1">{String(persona.angle)}</p>
                              </div>
                            ) : null}
                            <div className="mt-3 rounded-lg bg-primary/5 p-3">
                              <div className="text-xs font-semibold uppercase tracking-wide text-primary">
                                How to use
                              </div>
                              <p className="mt-1">
                                Select this persona in Create ads to create a
                                dedicated ad set.
                              </p>
                            </div>
                          </CardContent>
                        ) : null}
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <EmptyState text="No saved personas yet. Build personas above to save them to the gallery." />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Panel>
  );
}
