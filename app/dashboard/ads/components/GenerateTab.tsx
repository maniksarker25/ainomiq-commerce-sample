"use client";

import Link from "next/link";
import { useRef } from "react";
import {
  CheckCircle2,
  ChevronDown,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Package,
  Send,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react";
import type { ProductFolder, StagedGeneratedCreative } from "../types";
import { SectionHeader } from "../_components/SectionHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const ASPECT_RATIOS = ["4:5", "9:16", "1:1", "16:9"] as const;
const IMAGE_COUNTS = [1, 2, 3, 4, 5] as const;

type GenerateTabProps = {
  hasBrandScrape: boolean;
  brandDataScanHref: string;
  imageGenerationLoading: boolean;
  imageGenerateBusy: boolean;
  imageGenerationLoadingPreview: {
    aspectRatio: string;
    count: number;
    prompt: string;
  } | null;
  stagedGeneratedCreatives: StagedGeneratedCreative[];
  savingStagedCreatives: boolean;
  onSaveStagedCreatives: () => void;
  onDiscardStagedCreatives: () => void;
  onOpenGeneratedCreative: (creative: StagedGeneratedCreative) => void;
  stagedFeedback: string;
  onStagedFeedbackChange: (value: string) => void;
  imageGenerationPrompt: string;
  onImageGenerationPromptChange: (value: string) => void;
  imageGenerationModel: "nano-banana" | "chatgpt-image";
  onImageGenerationModelChange: (
    value: "nano-banana" | "chatgpt-image",
  ) => void;
  creativeAspectRatio: string;
  onCreativeAspectRatioChange: (ratio: string) => void;
  creativeCount: number;
  onCreativeCountChange: (count: number) => void;
  imageGenerationReferenceSource: "product" | "upload";
  onImageGenerationReferenceSourceChange: (source: "product" | "upload") => void;
  imageGenerationReferenceName: string;
  imageGenerationReferenceDataUrl: string;
  onReferenceUpload: (name: string, dataUrl: string) => void;
  onClearReferenceUpload: () => void;
  productCatalogItems: ProductFolder[];
  selectedProduct: ProductFolder | null | undefined;
  onSelectProduct: (productId: string) => void;
  imageGenerationNeedsMoreNomi: boolean;
  imageGenerationNomiCostTotal: number;
  imageGenerationNomiCostPerImage: number;
  imageGenerationCount: number;
  nomiBalance: number;
  generateDisabled: boolean;
  onGenerateImages: () => void;
  creativeAssetCount: number;
  showAssetManager: boolean;
  onToggleAssetManager: () => void;
};

function PreviewEmptyState() {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl border border-primary/15 bg-primary/5 text-primary">
        <Wand2 className="size-5" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">
          Generated images appear here
        </p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Describe the visual you want, pick a product reference if needed, then
          generate. Review before saving to My Creatives.
        </p>
      </div>
    </div>
  );
}

function PreviewLoadingState({
  aspectRatio,
  count,
  prompt,
}: {
  aspectRatio: string;
  count: number;
  prompt: string;
}) {
  const previewAspectRatio = aspectRatio.replace(":", " / ");

  return (
    <div className="space-y-4 p-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">
            Generating image{count === 1 ? "" : "s"}
          </p>
          <p className="mt-0.5 text-xs font-medium text-primary">
            {aspectRatio} preview loading
          </p>
        </div>
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
      <div className="flex justify-center">
        <div
          className="relative w-full max-w-md overflow-hidden rounded-2xl border border-primary/15 bg-background shadow-sm"
          style={{ aspectRatio: previewAspectRatio }}
        >
          <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-background to-primary/10" />
          <div className="absolute inset-0 animate-pulse bg-[linear-gradient(110deg,transparent,rgba(37,99,235,0.12),transparent)]" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-primary">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-xs font-semibold">Creating image</span>
            <span className="text-[11px] font-medium text-primary/80">
              {prompt ? "From your prompt" : "Working..."}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GenerateTab({
  hasBrandScrape,
  brandDataScanHref,
  imageGenerationLoading,
  imageGenerateBusy,
  imageGenerationLoadingPreview,
  stagedGeneratedCreatives,
  savingStagedCreatives,
  onSaveStagedCreatives,
  onDiscardStagedCreatives,
  onOpenGeneratedCreative,
  stagedFeedback,
  onStagedFeedbackChange,
  imageGenerationPrompt,
  onImageGenerationPromptChange,
  imageGenerationModel,
  onImageGenerationModelChange,
  creativeAspectRatio,
  onCreativeAspectRatioChange,
  creativeCount,
  onCreativeCountChange,
  imageGenerationReferenceSource,
  onImageGenerationReferenceSourceChange,
  imageGenerationReferenceName,
  imageGenerationReferenceDataUrl,
  onReferenceUpload,
  onClearReferenceUpload,
  productCatalogItems,
  selectedProduct,
  onSelectProduct,
  imageGenerationNeedsMoreNomi,
  imageGenerationNomiCostTotal,
  imageGenerationNomiCostPerImage,
  imageGenerationCount,
  nomiBalance,
  generateDisabled,
  onGenerateImages,
  creativeAssetCount,
  showAssetManager,
  onToggleAssetManager,
}: GenerateTabProps) {
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const previewBusy = imageGenerationLoading || imageGenerateBusy;
  const hasStaged = stagedGeneratedCreatives.length > 0;
  const composerValue = hasStaged ? stagedFeedback : imageGenerationPrompt;
  const onComposerChange = hasStaged
    ? onStagedFeedbackChange
    : onImageGenerationPromptChange;
  const loadingPreview = imageGenerationLoadingPreview || {
    aspectRatio: creativeAspectRatio,
    count: creativeCount,
    prompt: imageGenerationPrompt,
  };

  return (
    <div className="space-y-4">
      {!hasBrandScrape ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-950">
          <AlertTitle>Brand Data scan needed</AlertTitle>
          <AlertDescription>
            Analyze the business in General Settings first so generated images can
            use real products, colors and source content.
          </AlertDescription>
          <Button asChild size="sm" className="mt-3">
            <Link href={brandDataScanHref}>Analyze business</Link>
          </Button>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Brand assets</p>
          <p className="text-sm text-muted-foreground">
            Upload product photos and videos used as references in Create ads.
          </p>
        </div>
        <Button
          type="button"
          variant={showAssetManager ? "default" : "outline"}
          onClick={onToggleAssetManager}
        >
          <FolderOpen className="size-4" />
          {showAssetManager ? "Hide assets" : "Manage assets"}
          {creativeAssetCount > 0 ? ` (${creativeAssetCount})` : ""}
        </Button>
      </div>

      <Card className="gap-0 overflow-hidden shadow-none">
        <ScrollArea className="h-[min(520px,58vh)]">
          <div className="p-4">
            {previewBusy ? (
              <PreviewLoadingState
                aspectRatio={loadingPreview.aspectRatio}
                count={loadingPreview.count || creativeCount}
                prompt={loadingPreview.prompt}
              />
            ) : hasStaged ? (
              <div className="space-y-4">
                <SectionHeader
                  title="Generated images"
                  description="Review results, request changes below, then save only when ready."
                  action={
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={savingStagedCreatives}
                        onClick={onSaveStagedCreatives}
                      >
                        {savingStagedCreatives ? "Saving..." : "Save to My Creatives"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={savingStagedCreatives}
                        onClick={onDiscardStagedCreatives}
                      >
                        Discard
                      </Button>
                    </div>
                  }
                />
                <div className="grid gap-3 md:grid-cols-2">
                  {stagedGeneratedCreatives.map((creative, index) => {
                    const imageUrl = String(
                      creative.asset_url || creative.final_asset_url || "",
                    );
                    return (
                      <Card
                        key={String(creative.id || index)}
                        className="overflow-hidden border-primary/10 shadow-none"
                      >
                        <button
                          type="button"
                          onClick={() => onOpenGeneratedCreative(creative)}
                          className="mx-auto block w-full max-w-sm cursor-zoom-in bg-muted/20 text-left transition hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                          style={{
                            aspectRatio: creativeAspectRatio.replace(":", " / "),
                          }}
                          aria-label={`Open generated image ${index + 1}`}
                        >
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={String(creative.title || "Generated image")}
                              className="size-full bg-background object-contain"
                            />
                          ) : (
                            <div className="flex size-full items-center justify-center text-muted-foreground/40">
                              <ImageIcon className="size-6" />
                            </div>
                          )}
                        </button>
                        <CardContent className="p-3">
                          <div className="truncate text-sm font-semibold">
                            {String(
                              creative.title || `Generated image ${index + 1}`,
                            )}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Not saved yet — click image to open
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ) : (
              <PreviewEmptyState />
            )}
          </div>
        </ScrollArea>

        <Separator />

        <CardFooter className="flex flex-col items-stretch gap-4 p-4">
          {!hasStaged ? (
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5" />
              Describe the ad visual you want to generate
            </div>
          ) : null}

          <div className="rounded-2xl border bg-background p-2 shadow-sm">
            <Textarea
              value={composerValue}
              onChange={(event) => onComposerChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (!generateDisabled) onGenerateImages();
                }
              }}
              rows={hasStaged ? 2 : 3}
              className="min-h-20 resize-none border-0 bg-transparent px-2 py-2 text-base shadow-none focus-visible:ring-0"
              placeholder={
                hasStaged
                  ? "Send feedback or changes for these images"
                  : "Describe the image you want to create"
              }
            />

            <div className="mt-2 flex flex-wrap items-center gap-2 border-t px-1 pt-3">
              <Select
                value={imageGenerationModel}
                onValueChange={(value) =>
                  onImageGenerationModelChange(
                    value as "nano-banana" | "chatgpt-image",
                  )
                }
              >
                <SelectTrigger className="h-9 w-auto rounded-full px-3 text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chatgpt-image">
                    ChatGPT image model
                  </SelectItem>
                  <SelectItem value="nano-banana">Nano Banana</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={creativeAspectRatio}
                onValueChange={onCreativeAspectRatioChange}
              >
                <SelectTrigger className="h-9 w-auto rounded-full px-3 text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASPECT_RATIOS.map((ratio) => (
                    <SelectItem key={ratio} value={ratio}>
                      {ratio}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={String(creativeCount)}
                onValueChange={(value) =>
                  onCreativeCountChange(Number(value) || 1)
                }
              >
                <SelectTrigger className="h-9 w-auto rounded-full px-3 text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMAGE_COUNTS.map((amount) => (
                    <SelectItem key={amount} value={String(amount)}>
                      {amount} {amount === 1 ? "image" : "images"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <input
                ref={referenceInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    onReferenceUpload(file.name, String(reader.result || ""));
                  };
                  reader.readAsDataURL(file);
                }}
              />

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-full px-3 text-xs font-semibold"
                  >
                    {imageGenerationReferenceSource === "product"
                      ? "Product ref"
                      : "Upload ref"}
                    <ChevronDown className="size-3.5 text-primary" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-52 p-1.5">
                  {(["product", "upload"] as const).map((option) => (
                    <Button
                      key={option}
                      type="button"
                      variant={
                        imageGenerationReferenceSource === option
                          ? "default"
                          : "ghost"
                      }
                      size="sm"
                      className="w-full justify-start gap-2"
                      onClick={() => {
                        onImageGenerationReferenceSourceChange(option);
                        if (option === "product") onClearReferenceUpload();
                      }}
                    >
                      {option === "product" ? (
                        <Package className="size-4" />
                      ) : (
                        <ImageIcon className="size-4" />
                      )}
                      {option === "product" ? "Product" : "Upload"}
                    </Button>
                  ))}
                </PopoverContent>
              </Popover>

              {imageGenerationReferenceSource === "product" ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      title={selectedProduct?.name || "Select product"}
                      className="relative size-11 rounded-xl p-0"
                    >
                      {selectedProduct?.imageUrl ? (
                        <img
                          src={selectedProduct.imageUrl}
                          alt=""
                          className="size-full rounded-xl object-cover"
                        />
                      ) : (
                        <Package className="size-5 text-primary" />
                      )}
                      <span className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full border-2 border-background bg-primary text-[10px] font-bold leading-none text-primary-foreground">
                        +
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80 p-0">
                    <div className="border-b px-3 py-2">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Select product reference
                      </span>
                    </div>
                    <ScrollArea className="max-h-80">
                      <div className="p-1.5">
                        {productCatalogItems.map((item) => (
                          <Button
                            key={item.id}
                            type="button"
                            variant={
                              selectedProduct?.id === item.id
                                ? "default"
                                : "ghost"
                            }
                            className="h-auto w-full justify-start gap-3 px-2.5 py-2"
                            onClick={() => onSelectProduct(item.id)}
                          >
                            <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-primary/5">
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt=""
                                  className="size-full object-cover"
                                />
                              ) : (
                                <Package className="size-4 text-primary" />
                              )}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                              {item.name}
                            </span>
                            {selectedProduct?.id === item.id ? (
                              <CheckCircle2 className="size-4 shrink-0" />
                            ) : null}
                          </Button>
                        ))}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  title={imageGenerationReferenceName || "Upload image"}
                  className="relative size-11 rounded-xl p-0"
                  onClick={() => referenceInputRef.current?.click()}
                >
                  {imageGenerationReferenceDataUrl ? (
                    <img
                      src={imageGenerationReferenceDataUrl}
                      alt=""
                      className="size-full rounded-xl object-cover"
                    />
                  ) : (
                    <Upload className="size-5 text-primary" strokeWidth={1.9} />
                  )}
                  <span className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full border-2 border-background bg-primary text-[10px] font-bold leading-none text-primary-foreground">
                    +
                  </span>
                </Button>
              )}

              <div className="ml-auto flex items-center gap-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-8 px-2 text-xs",
                        imageGenerationNeedsMoreNomi
                          ? "text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      {imageGenerationNomiCostTotal} Nomi
                      {imageGenerationNomiCostTotal === 1 ? "" : "'s"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                        Create ads
                      </span>
                      <Badge
                        variant="secondary"
                        className={cn(
                          imageGenerationNeedsMoreNomi
                            ? "bg-destructive/10 text-destructive"
                            : "bg-primary/10 text-primary",
                        )}
                      >
                        {imageGenerationNomiCostTotal} Nomi
                        {imageGenerationNomiCostTotal === 1 ? "" : "'s"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {imageGenerationCount > 1
                        ? `${imageGenerationNomiCostPerImage} each × ${imageGenerationCount} images`
                        : "Per generated image"}
                    </p>
                    <p
                      className={cn(
                        "mt-2 text-xs font-medium",
                        imageGenerationNeedsMoreNomi
                          ? "text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      {imageGenerationNeedsMoreNomi
                        ? `Balance ${nomiBalance}. Need ${imageGenerationNomiCostTotal - nomiBalance} more Nomi${imageGenerationNomiCostTotal - nomiBalance === 1 ? "" : "'s"}.`
                        : "Charged after success."}
                    </p>
                  </PopoverContent>
                </Popover>
                <Button
                  type="button"
                  size="icon"
                  className="size-9 shrink-0 rounded-full"
                  disabled={generateDisabled}
                  onClick={onGenerateImages}
                  aria-label={
                    imageGenerationNeedsMoreNomi
                      ? `Not enough Nomi's. Generate images needs ${imageGenerationNomiCostTotal} Nomi's.`
                      : hasStaged
                        ? "Send feedback for revision"
                        : `Generate images, uses ${imageGenerationNomiCostTotal} Nomi${imageGenerationNomiCostTotal === 1 ? "" : "'s"}`
                  }
                >
                  {imageGenerateBusy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
