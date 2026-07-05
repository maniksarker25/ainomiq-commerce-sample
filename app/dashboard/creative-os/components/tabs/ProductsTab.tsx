"use client";

import { Layers3, Loader2, Package, Plus, Trash2, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { CreativeOsCard } from "../../_components/CreativeOsCard";
import { MagicButton } from "../../_components/MagicButton";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Input, Textarea } from "../../_components/FormFields";
import { PreviewCard } from "../shared/PreviewCard";
import { SectionTitle } from "../shared/SectionTitle";
import { CardList, TagInput } from "../shared/WorkspaceWidgets";
import { catalogDisplayName } from "../../lib/products";
import type { ProductsTabProps } from "./types";

function SaveStatusBadge({
  status,
}: {
  status: ProductsTabProps["saveStatus"];
}) {
  const label =
    status === "saving"
      ? "Saving..."
      : status === "saved"
        ? "Saved"
        : status === "error"
          ? "Save failed"
          : "Saved";

  return (
    <Badge
      variant={
        status === "error"
          ? "destructive"
          : status === "saving"
            ? "secondary"
            : "outline"
      }
      className="h-9 shrink-0 px-3 text-xs font-semibold"
    >
      {status === "saving" ? (
        <Loader2 size={13} className="animate-spin" />
      ) : null}
      {label}
    </Badge>
  );
}

export function ProductsTab(props: ProductsTabProps) {
  const {
    sectionRefs,
    state,
    selectedProduct,
    selectedProductLabel,
    saveStatus,
    catalogProducts,
    productFieldSuggestions,
    activeEditors,
    selectActiveProduct,
    deleteProduct,
    openCatalogPicker,
    addManualProduct,
    updateProduct,
    aiFillProductFields,
    aiFillStatus,
    textMatchesAiSuggestion,
    listMatchesAiSuggestion,
    upgradeStrategyList,
    strategyUpgradeField,
    enhanceStrategyDraft,
    strategyEnhanceField,
  } = props;

  return (
    <>
      <div
        ref={(el) => {
          sectionRefs.current.dashboard = el;
        }}
      >
        <CreativeOsCard>
        <CardContent className="space-y-4 p-4 md:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-3xl space-y-2">
              <Badge variant="secondary" className="gap-1.5 px-3 py-1">
                <Layers3 size={14} />
                Product set
              </Badge>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                  Product setup
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick the product set, add the context, then connect Library
                  sources.
                </p>
              </div>
            </div>

            <div className="flex min-w-0 flex-wrap items-end gap-2 xl:min-w-[520px] xl:justify-end">
              {state.products.length ? (
                <div className="min-w-[280px] flex-1 space-y-1.5">
                  <Label className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                    Active product set
                  </Label>
                  <Select
                    value={selectedProduct.id}
                    onValueChange={selectActiveProduct}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select product set" />
                    </SelectTrigger>
                    <SelectContent>
                      {state.products.map((product, productIndex) => (
                        <SelectItem key={product.id} value={product.id}>
                          {catalogDisplayName(product, productIndex)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {state.products.length ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  aria-label={`Delete ${selectedProductLabel}`}
                  onClick={() => deleteProduct(selectedProduct.id)}
                >
                  <Trash2 size={16} />
                </Button>
              ) : null}

              <Button type="button" variant="secondary" onClick={openCatalogPicker}>
                <Package size={16} />
                Choose products
              </Button>

              {!catalogProducts.length ? (
                <Button type="button" variant="outline" onClick={addManualProduct}>
                  <Plus size={16} />
                  Add manually
                </Button>
              ) : null}

              <SaveStatusBadge status={saveStatus} />
            </div>
          </div>
        </CardContent>
        </CreativeOsCard>
      </div>

      <div
        ref={(el) => {
          sectionRefs.current.setup = el;
        }}
        className="mt-4 space-y-4"
      >
        {state.products.length ? (
          <CreativeOsCard className="min-w-0">
            <CardContent className="min-w-0 space-y-4 p-3 sm:p-4 md:p-5">
              <SectionTitle
                title={
                  selectedProduct.isCatalogGroup
                    ? "Product set details"
                    : "Product details"
                }
                subtitle="Context editors and AI use for briefs."
                action={
                  <MagicButton
                    onClick={aiFillProductFields}
                    loading={aiFillStatus === "filling"}
                  >
                    {aiFillStatus === "filling"
                      ? "Magic filling..."
                      : aiFillStatus === "filled"
                        ? "Magic filled"
                        : "Magic Fill"}
                  </MagicButton>
                }
              />

              {selectedProduct.isCatalogGroup ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    label="Product set name"
                    value={selectedProduct.name}
                    placeholder={selectedProductLabel}
                    onChange={(e) => updateProduct("name", e.target.value)}
                  />
                  <Input
                    label="Collection URL"
                    value={selectedProduct.url}
                    onChange={(e) => updateProduct("url", e.target.value)}
                  />
                  <Input
                    label="Naming convention"
                    value={selectedProduct.namingConvention}
                    onChange={(e) =>
                      updateProduct("namingConvention", e.target.value)
                    }
                  />
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    label="Product name"
                    value={selectedProduct.name}
                    onChange={(e) => updateProduct("name", e.target.value)}
                  />
                  <Input
                    label="Product URL"
                    value={selectedProduct.url}
                    onChange={(e) => updateProduct("url", e.target.value)}
                  />
                  <Input
                    label="Product image"
                    value={selectedProduct.imageUrl}
                    onChange={(e) =>
                      updateProduct("imageUrl", e.target.value)
                    }
                  />
                  <Input
                    label="Naming convention"
                    value={selectedProduct.namingConvention}
                    onChange={(e) =>
                      updateProduct("namingConvention", e.target.value)
                    }
                  />
                </div>
              )}

              {selectedProduct.isCatalogGroup &&
              selectedProduct.catalogItems?.length ? (
                <Alert className="border-primary/15 bg-primary/5">
                  <AlertTitle>{selectedProductLabel}</AlertTitle>
                  <AlertDescription>
                    {selectedProduct.catalogItems.length} products in this set.
                    Product links stay attached below.
                  </AlertDescription>
                  <div className="col-start-2 mt-3 flex flex-wrap gap-2">
                    {selectedProduct.catalogItems.map((item) =>
                      item.url ? (
                        <Badge key={item.id} variant="outline" asChild>
                          <a href={item.url} target="_blank" rel="noreferrer">
                            {item.name || "Catalog product"}
                          </a>
                        </Badge>
                      ) : (
                        <Badge key={item.id} variant="outline">
                          {item.name || "Catalog product"}
                        </Badge>
                      ),
                    )}
                  </div>
                </Alert>
              ) : null}

              <Textarea
                label="Product summary"
                value={selectedProduct.explanation}
                muted={textMatchesAiSuggestion(
                  selectedProduct.explanation,
                  productFieldSuggestions.explanation,
                )}
                placeholder={productFieldSuggestions.explanation}
                onChange={(e) => updateProduct("explanation", e.target.value)}
              />

              <div className="min-w-0 space-y-3 border-t border-border/60 pt-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">
                      Personas
                    </div>
                    <p className="mt-1 max-w-2xl text-xs font-medium leading-5 text-muted-foreground">
                      Who the ads are for.
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    Auto-saved
                  </Badge>
                </div>
                <TagInput
                  variant="embedded"
                  title="Who is it for?"
                  description="Create, edit or remove the personas you want to brief against."
                  items={selectedProduct.personas}
                  muted={listMatchesAiSuggestion(
                    selectedProduct.personas,
                    productFieldSuggestions.personas,
                  )}
                  placeholder={productFieldSuggestions.personas.join(", ")}
                  onChange={(items) => updateProduct("personas", items)}
                  onUpgrade={() => upgradeStrategyList("personas")}
                  isUpgrading={strategyUpgradeField === "personas"}
                  onEnhanceDraft={(input) =>
                    enhanceStrategyDraft("personas", input)
                  }
                  isEnhancing={strategyEnhanceField === "personas"}
                />
              </div>

              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                <Input
                  label="Default derivative cap"
                  value={String(selectedProduct.defaultDerivativeCap)}
                  onChange={(e) =>
                    updateProduct(
                      "defaultDerivativeCap",
                      Number(e.target.value) || 0,
                    )
                  }
                  help="How many approved ads one raw source file can create before Creative OS removes it from available source material. Example: 5 means the file is used for max 5 approved outputs."
                />
                <Input
                  label="Preferred platforms"
                  value={selectedProduct.platforms.join(", ")}
                  onChange={(e) =>
                    updateProduct(
                      "platforms",
                      e.target.value
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <PreviewCard product={selectedProduct} />
                <CardList
                  title="Active access"
                  icon={Users}
                  items={activeEditors.map(
                    (permission) =>
                      `${permission.email || permission.userName} - ${permission.role}`,
                  )}
                  emptyText="No active editors yet. Accepted team members appear here."
                />
              </div>
            </CardContent>
          </CreativeOsCard>
        ) : (
          <CreativeOsCard className="min-w-0">
            <CardContent className="min-w-0 space-y-4 p-3 sm:p-4 md:p-5">
              <SectionTitle
                title="No product selected yet"
                subtitle="Choose one product or a product group first. Ainomiq Library sources are organized per product workspace."
              />

              <Alert className="border-dashed">
                <AlertDescription>
                  After the product is selected, add the raw source material
                  editors should work from.
                </AlertDescription>
              </Alert>

              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={openCatalogPicker}>
                  <Package size={16} />
                  Choose product
                </Button>
                <Button type="button" variant="outline" onClick={addManualProduct}>
                  <Plus size={16} />
                  Add manually
                </Button>
              </div>

              <Separator />

              <CardList
                title="Active access"
                icon={Users}
                items={[]}
                emptyText="No active editors yet. Connect sources first, then invite editors when work is ready."
              />
            </CardContent>
          </CreativeOsCard>
        )}
      </div>
    </>
  );
}
