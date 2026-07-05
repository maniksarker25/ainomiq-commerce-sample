"use client";

import Link from "next/link";
import { Image as ImageIcon } from "lucide-react";
import type {
  CreativeAssetForm,
  DbRow,
  PersonaSuggestion,
  ProductFolder,
  StagedGeneratedCreative,
} from "../../types";
import { getCreativePreview } from "../../lib/creative-preview";
import { productMatchKeys } from "../../utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type SavedPersonaSuggestion = PersonaSuggestion & { productKeys: string[] };

type LogicAdsModalsProps = {
  openedGeneratedCreative: StagedGeneratedCreative | null;
  onCloseGeneratedCreative: () => void;
  openedCreative: DbRow | null;
  onCloseCreative: () => void;
  assetModalOpen: boolean;
  onCloseAssetModal: () => void;
  editingAssetId: string | null;
  assetForm: CreativeAssetForm;
  onAssetFormChange: (
    updater: (current: CreativeAssetForm) => CreativeAssetForm,
  ) => void;
  productCatalogItems: ProductFolder[];
  savedPersonaSuggestions: SavedPersonaSuggestion[];
  assetSaveBusy: boolean;
  onSaveCreativeAsset: () => void;
};

export function LogicAdsModals({
  openedGeneratedCreative,
  onCloseGeneratedCreative,
  openedCreative,
  onCloseCreative,
  assetModalOpen,
  onCloseAssetModal,
  editingAssetId,
  assetForm,
  onAssetFormChange,
  productCatalogItems,
  savedPersonaSuggestions,
  assetSaveBusy,
  onSaveCreativeAsset,
}: LogicAdsModalsProps) {
  const generatedImageUrl = openedGeneratedCreative
    ? String(
        openedGeneratedCreative.asset_url ||
          openedGeneratedCreative.final_asset_url ||
          "",
      )
    : "";
  const generatedTitle = openedGeneratedCreative
    ? String(openedGeneratedCreative.title || "Generated image")
    : "";
  const creativePreview = openedCreative
    ? getCreativePreview(openedCreative)
    : null;

  return (
    <>
      <Dialog
        open={Boolean(openedGeneratedCreative)}
        onOpenChange={(open) => {
          if (!open) onCloseGeneratedCreative();
        }}
      >
        <DialogContent className="flex max-h-[94vh] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="truncate text-base">
              {generatedTitle}
            </DialogTitle>
            <DialogDescription>
              Generated preview — not saved yet
            </DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[78vh] items-center justify-center bg-muted/30 p-6">
            {generatedImageUrl ? (
              <img
                src={generatedImageUrl}
                alt={generatedTitle}
                className="max-h-[74vh] w-auto max-w-full object-contain"
              />
            ) : (
              <ImageIcon className="size-9 text-muted-foreground/40" />
            )}
          </div>
          <DialogFooter className="flex-col gap-3 border-t px-5 py-4 sm:flex-row sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Send feedback in the composer below the previews to regenerate.
            </p>
            {generatedImageUrl ? (
              <Button size="sm" variant="outline" asChild>
                <Link href={generatedImageUrl} target="_blank" rel="noreferrer">
                  Open original
                </Link>
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(openedCreative && creativePreview)}
        onOpenChange={(open) => {
          if (!open) onCloseCreative();
        }}
      >
        <DialogContent className="flex max-h-[94vh] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
          {creativePreview ? (
            <>
              <DialogHeader className="border-b px-5 py-4">
                <DialogTitle className="truncate text-base">
                  {creativePreview.title}
                </DialogTitle>
                <DialogDescription>{creativePreview.source}</DialogDescription>
              </DialogHeader>
              <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="flex max-h-[78vh] items-center justify-center bg-muted/30 p-6">
                  {creativePreview.imageUrl ? (
                    <img
                      src={creativePreview.imageUrl}
                      alt={creativePreview.title}
                      className="max-h-[74vh] w-auto max-w-full rounded-2xl object-contain"
                    />
                  ) : (
                    <ImageIcon className="size-9 text-muted-foreground/40" />
                  )}
                </div>
                <div className="space-y-4 border-l p-5 text-sm">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Product
                    </div>
                    <div className="mt-1 font-semibold">
                      {creativePreview.productName || "No product linked"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Persona
                    </div>
                    <div className="mt-1 font-semibold">
                      {creativePreview.personaName || "No persona selected"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Media
                    </div>
                    <div className="mt-1 font-semibold">
                      {creativePreview.mediaType} · {creativePreview.ratio}
                    </div>
                  </div>
                  {creativePreview.imageUrl ? (
                    <Button size="sm" variant="outline" asChild>
                      <Link
                        href={creativePreview.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open original
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={assetModalOpen}
        onOpenChange={(open) => {
          if (!open) onCloseAssetModal();
        }}
      >
        <DialogContent className="flex max-h-[min(92vh,900px)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b px-5 py-4">
            <DialogTitle>
              {editingAssetId ? "Edit creative" : "Add creative"}
            </DialogTitle>
            <DialogDescription>
              Save a brand-owned image or video asset and connect it to a product and
              persona.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="grid gap-4 p-5 md:grid-cols-2">
              <Alert className="md:col-span-2">
                <AlertDescription>
                  File upload storage is being connected. Use a public image or
                  video URL for now.
                </AlertDescription>
              </Alert>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="asset-url">Asset URL</Label>
                <Input
                  id="asset-url"
                  value={assetForm.asset_url}
                  onChange={(event) =>
                    onAssetFormChange((current) => ({
                      ...current,
                      asset_url: event.target.value,
                    }))
                  }
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-name">Name</Label>
                <Input
                  id="asset-name"
                  value={assetForm.name}
                  onChange={(event) =>
                    onAssetFormChange((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={assetForm.type}
                  onValueChange={(value) =>
                    onAssetFormChange((current) => ({
                      ...current,
                      type: value as "image" | "video",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ratio</Label>
                <Select
                  value={assetForm.ratio}
                  onValueChange={(value) =>
                    onAssetFormChange((current) => ({
                      ...current,
                      ratio: value as CreativeAssetForm["ratio"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["4:5", "9:16", "1:1", "16:9", "unknown"].map((ratio) => (
                      <SelectItem key={ratio} value={ratio}>
                        {ratio}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={assetForm.status}
                  onValueChange={(value) =>
                    onAssetFormChange((current) => ({
                      ...current,
                      status: value as CreativeAssetForm["status"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ready">Ready</SelectItem>
                    <SelectItem value="needs_review">Needs review</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Product</Label>
                <Select
                  value={assetForm.product_id || "none"}
                  onValueChange={(value) =>
                    onAssetFormChange((current) => ({
                      ...current,
                      product_id: value === "none" ? "" : value,
                      persona_id: "",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No product" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No product</SelectItem>
                    {productCatalogItems.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Persona</Label>
                <Select
                  value={assetForm.persona_id || "none"}
                  onValueChange={(value) =>
                    onAssetFormChange((current) => ({
                      ...current,
                      persona_id: value === "none" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No persona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No persona</SelectItem>
                    {savedPersonaSuggestions
                      .filter((persona) => {
                        if (!assetForm.product_id) return true;
                        const product = productCatalogItems.find(
                          (item) => item.id === assetForm.product_id,
                        );
                        const keys = product ? productMatchKeys(product) : [];
                        return (
                          !keys.length ||
                          persona.productKeys.some((key) => keys.includes(key))
                        );
                      })
                      .map((persona) => (
                        <SelectItem key={persona.id} value={persona.id}>
                          {persona.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {assetForm.product_id &&
                !savedPersonaSuggestions.some((persona) =>
                  persona.productKeys.some((key) =>
                    productMatchKeys(
                      productCatalogItems.find(
                        (item) => item.id === assetForm.product_id,
                      ) as ProductFolder,
                    ).includes(key),
                  ),
                ) ? (
                  <p className="text-xs text-amber-700">
                    Build personas for this product first, or save this creative
                    without a persona.
                  </p>
                ) : null}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="asset-tags">Tags</Label>
                <Input
                  id="asset-tags"
                  value={assetForm.tags}
                  onChange={(event) =>
                    onAssetFormChange((current) => ({
                      ...current,
                      tags: event.target.value,
                    }))
                  }
                  placeholder="ugc, hook, testimonial"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="asset-copy-hint">Copy hint</Label>
                <Input
                  id="asset-copy-hint"
                  value={assetForm.copy_hint}
                  onChange={(event) =>
                    onAssetFormChange((current) => ({
                      ...current,
                      copy_hint: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="asset-landing">Landing page URL</Label>
                <Input
                  id="asset-landing"
                  value={assetForm.landing_page_url}
                  onChange={(event) =>
                    onAssetFormChange((current) => ({
                      ...current,
                      landing_page_url: event.target.value,
                    }))
                  }
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="asset-notes">Notes</Label>
                <Textarea
                  id="asset-notes"
                  value={assetForm.notes}
                  onChange={(event) =>
                    onAssetFormChange((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  rows={3}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="mx-0 mb-0 shrink-0 border-t bg-background px-5 py-4">
            <Button variant="outline" onClick={onCloseAssetModal}>
              Cancel
            </Button>
            <Button
              disabled={
                assetSaveBusy ||
                !assetForm.name.trim() ||
                !assetForm.asset_url.trim()
              }
              onClick={onSaveCreativeAsset}
            >
              {assetSaveBusy ? "Saving…" : "Save creative"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
