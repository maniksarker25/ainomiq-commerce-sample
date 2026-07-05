"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Loader2,
  Package,
  Search,
  Sparkles,
} from "lucide-react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type {
  Campaign,
  MetaAdset,
  PersonaSuggestion,
  ProductFolder,
  StrategistResponse,
} from "../types";
import { BATCH_PROGRESS_STEPS, MAX_ADS_PER_AD_SET, MAX_CREATIVES_PER_BATCH } from "../types";
import { SectionHeader } from "../_components/SectionHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

const FLOW_STEPS = ["Campaign", "Product", "Buying reasons", "Ad slots", "Review"] as const;
const RATIO_OPTIONS = ["4:5", "9:16", "1:1", "16:9"] as const;

export type PostAdsFormPanelProps = {
  hasBrandScrape: boolean;
  brandDataScanHref: string;
  campaignMode: "existing" | "new";
  onCampaignModeChange: Dispatch<SetStateAction<"existing" | "new">>;
  selectedCampaignId: string;
  onSelectedCampaignIdChange: Dispatch<SetStateAction<string>>;
  activeCampaigns: Campaign[];
  newCampaignName: string;
  onNewCampaignNameChange: Dispatch<SetStateAction<string>>;
  newCampaignObjective: string;
  onNewCampaignObjectiveChange: Dispatch<SetStateAction<string>>;
  newCampaignBuyingType: string;
  onNewCampaignBuyingTypeChange: Dispatch<SetStateAction<string>>;
  newCampaignStatus: string;
  onNewCampaignStatusChange: Dispatch<SetStateAction<string>>;
  newCampaignBudgetMode: "campaign" | "adset";
  onNewCampaignBudgetModeChange: Dispatch<SetStateAction<"campaign" | "adset">>;
  newCampaignBudgetType: "daily" | "lifetime";
  onNewCampaignBudgetTypeChange: Dispatch<SetStateAction<"daily" | "lifetime">>;
  newCampaignBudget: string;
  onNewCampaignBudgetChange: Dispatch<SetStateAction<string>>;
  newCampaignBidStrategy: string;
  onNewCampaignBidStrategyChange: Dispatch<SetStateAction<string>>;
  newCampaignOptimizationGoal: string;
  onNewCampaignOptimizationGoalChange: Dispatch<SetStateAction<string>>;
  newCampaignBidAmount: string;
  onNewCampaignBidAmountChange: Dispatch<SetStateAction<string>>;
  newCampaignSpendLimit: string;
  onNewCampaignSpendLimitChange: Dispatch<SetStateAction<string>>;
  newCampaignStartDate: string;
  onNewCampaignStartDateChange: Dispatch<SetStateAction<string>>;
  newCampaignEndDate: string;
  onNewCampaignEndDateChange: Dispatch<SetStateAction<string>>;
  newCampaignAttribution: string;
  onNewCampaignAttributionChange: Dispatch<SetStateAction<string>>;
  newCampaignSpecialAdCategory: string;
  onNewCampaignSpecialAdCategoryChange: Dispatch<SetStateAction<string>>;
  newCampaignMarkets: string;
  onNewCampaignMarketsChange: Dispatch<SetStateAction<string>>;
  newCampaignAbTest: boolean;
  onNewCampaignAbTestChange: Dispatch<SetStateAction<boolean>>;
  draftGoal: string;
  onDraftGoalChange: Dispatch<SetStateAction<string>>;
  mediaFormatLabel: string;
  creativeMediaTypes: string[];
  onCreativeMediaTypeSelection: (value: string) => void;
  creativeAspectRatio: string;
  onUpdateTemplateFormat: (ratio: string) => void;
  catalogSearchQuery: string;
  onCatalogSearchQueryChange: Dispatch<SetStateAction<string>>;
  visibleCatalogItems: ProductFolder[];
  selectedProductIds: string[];
  onToggleProduct: (productId: string) => void;
  selectedCatalogCount: number;
  selectedCatalogLabel: string;
  hasLinkedDriveContent: (item: ProductFolder) => boolean;
  personaCountForProduct: (item: ProductFolder) => number;
  catalogSearchTerm: string;
  targetingMode: "custom" | "copy";
  onTargetingModeChange: Dispatch<SetStateAction<"custom" | "copy">>;
  selectedTemplateAdsetId: string;
  onSelectedTemplateAdsetIdChange: Dispatch<SetStateAction<string>>;
  adsetsLoading: boolean;
  existingAdsets: MetaAdset[];
  adsetsError: string | null;
  selectedTemplateAdset: MetaAdset | null | undefined;
  customTargetCountries: string;
  onCustomTargetCountriesChange: Dispatch<SetStateAction<string>>;
  customTargetAgeMin: number;
  onCustomTargetAgeMinChange: Dispatch<SetStateAction<number>>;
  customTargetAgeMax: number;
  onCustomTargetAgeMaxChange: Dispatch<SetStateAction<number>>;
  customTargetGender: "all" | "women" | "men";
  onCustomTargetGenderChange: Dispatch<SetStateAction<"all" | "women" | "men">>;
  selectedPersonaPool: PersonaSuggestion[];
  adsPerAdSet: number;
  onAdsPerAdSetChange: Dispatch<SetStateAction<number>>;
  adSetCount: number;
  requestedCreativeCount: number;
  displayedPersonaSuggestions: PersonaSuggestion[];
  effectiveSelectedPersonaIds: string[];
  onSelectPersona: (personaId: string) => void;
  onOpenPersonasTab: () => void;
  strategistResult: StrategistResponse | null;
  busy: string | null;
  hasCampaignContext: boolean;
  onBuildBatch: () => void;
  batchProgressStep: number;
  latestCreatedBatch: { id: string; name: string; count: number } | null;
  onOpenReviewTab: () => void;
};

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default function PostAdsFormPanel({
  hasBrandScrape,
  brandDataScanHref,
  campaignMode,
  onCampaignModeChange,
  selectedCampaignId,
  onSelectedCampaignIdChange,
  activeCampaigns,
  newCampaignName,
  onNewCampaignNameChange,
  newCampaignObjective,
  onNewCampaignObjectiveChange,
  newCampaignBuyingType,
  onNewCampaignBuyingTypeChange,
  newCampaignStatus,
  onNewCampaignStatusChange,
  newCampaignBudgetMode,
  onNewCampaignBudgetModeChange,
  newCampaignBudgetType,
  onNewCampaignBudgetTypeChange,
  newCampaignBudget,
  onNewCampaignBudgetChange,
  newCampaignBidStrategy,
  onNewCampaignBidStrategyChange,
  newCampaignOptimizationGoal,
  onNewCampaignOptimizationGoalChange,
  newCampaignBidAmount,
  onNewCampaignBidAmountChange,
  newCampaignSpendLimit,
  onNewCampaignSpendLimitChange,
  newCampaignStartDate,
  onNewCampaignStartDateChange,
  newCampaignEndDate,
  onNewCampaignEndDateChange,
  newCampaignAttribution,
  onNewCampaignAttributionChange,
  newCampaignSpecialAdCategory,
  onNewCampaignSpecialAdCategoryChange,
  newCampaignMarkets,
  onNewCampaignMarketsChange,
  newCampaignAbTest,
  onNewCampaignAbTestChange,
  draftGoal,
  onDraftGoalChange,
  mediaFormatLabel,
  creativeMediaTypes,
  onCreativeMediaTypeSelection,
  creativeAspectRatio,
  onUpdateTemplateFormat,
  catalogSearchQuery,
  onCatalogSearchQueryChange,
  visibleCatalogItems,
  selectedProductIds,
  onToggleProduct,
  selectedCatalogCount,
  selectedCatalogLabel,
  hasLinkedDriveContent,
  personaCountForProduct,
  catalogSearchTerm,
  targetingMode,
  onTargetingModeChange,
  selectedTemplateAdsetId,
  onSelectedTemplateAdsetIdChange,
  adsetsLoading,
  existingAdsets,
  adsetsError,
  selectedTemplateAdset,
  customTargetCountries,
  onCustomTargetCountriesChange,
  customTargetAgeMin,
  onCustomTargetAgeMinChange,
  customTargetAgeMax,
  onCustomTargetAgeMaxChange,
  customTargetGender,
  onCustomTargetGenderChange,
  selectedPersonaPool,
  adsPerAdSet,
  onAdsPerAdSetChange,
  adSetCount,
  requestedCreativeCount,
  displayedPersonaSuggestions,
  effectiveSelectedPersonaIds,
  onSelectPersona,
  onOpenPersonasTab,
  strategistResult,
  busy,
  hasCampaignContext,
  onBuildBatch,
  batchProgressStep,
  latestCreatedBatch,
  onOpenReviewTab,
}: PostAdsFormPanelProps) {
  const buildDisabled =
    Boolean(busy) ||
    !selectedCatalogCount ||
    !hasCampaignContext ||
    !selectedPersonaPool.length ||
    (targetingMode === "copy" && !selectedTemplateAdset);

  const adsetPlaceholder = adsetsLoading
    ? "Loading Meta ad sets..."
    : existingAdsets.length
      ? "Choose an existing ad set"
      : adsetsError
        ? "Meta ad sets temporarily unavailable"
        : selectedCampaignId
          ? "No ad sets found for this campaign"
          : "Choose an existing ad set";

  return (
    <div className="flex flex-col gap-4">
      {!hasBrandScrape ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-950">
          <AlertTitle>Brand Data scan needed</AlertTitle>
          <AlertDescription>
            Analyze the business in General Settings first. This loads products, collections and source content before ad creation starts.
          </AlertDescription>
          <Button asChild size="sm" className="mt-3">
            <Link href={brandDataScanHref}>Analyze business</Link>
          </Button>
        </Alert>
      ) : null}

      <Card className="gap-0 overflow-hidden shadow-none">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5" />
            Guided post ads setup
          </div>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-5">
            {FLOW_STEPS.map((step, index) => (
              <div
                key={step}
                className="rounded-xl border border-primary/10 bg-primary/5 px-3 py-2.5"
              >
                <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                  Step {index + 1}
                </div>
                <div className="mt-0.5 text-sm font-semibold text-foreground">{step}</div>
              </div>
            ))}
          </div>
        </CardContent>
        <Separator />
        <CardContent className="space-y-4 p-4">
          <SectionHeader
            title="Campaign mode"
            description="Choose the campaign where these new ad sets belong, or draft a new campaign for review."
            action={
              <ToggleGroup
                type="single"
                value={campaignMode}
                onValueChange={(value) => {
                  if (value === "existing" || value === "new") onCampaignModeChange(value);
                }}
                className="grid w-full min-w-[240px] grid-cols-2 rounded-xl bg-muted p-1"
              >
                <ToggleGroupItem
                  value="existing"
                  className="rounded-lg text-xs data-[state=on]:bg-background data-[state=on]:text-primary data-[state=on]:shadow-sm"
                >
                  Existing campaign
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="new"
                  className="rounded-lg text-xs data-[state=on]:bg-background data-[state=on]:text-primary data-[state=on]:shadow-sm"
                >
                  New campaign
                </ToggleGroupItem>
              </ToggleGroup>
            }
          />

          {campaignMode === "existing" ? (
            <Field label="Use campaign context" hint="Pick the campaign this creative should be based on.">
              <Select value={selectedCampaignId || undefined} onValueChange={onSelectedCampaignIdChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an active campaign" />
                </SelectTrigger>
                <SelectContent>
                  {activeCampaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <div className="space-y-4">
              <Alert className="border-primary/15 bg-primary/5">
                <AlertDescription className="text-primary">
                  New campaign uses Meta campaign settings. The campaign stays paused until review.
                </AlertDescription>
              </Alert>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Field label="Campaign name">
                  <Input
                    value={newCampaignName}
                    onChange={(event) => onNewCampaignNameChange(event.target.value)}
                    placeholder="Summer launch campaign"
                  />
                </Field>
                <Field label="Objective">
                  <Select value={newCampaignObjective} onValueChange={onNewCampaignObjectiveChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OUTCOME_SALES">Sales</SelectItem>
                      <SelectItem value="OUTCOME_LEADS">Leads</SelectItem>
                      <SelectItem value="OUTCOME_TRAFFIC">Traffic</SelectItem>
                      <SelectItem value="OUTCOME_ENGAGEMENT">Engagement</SelectItem>
                      <SelectItem value="OUTCOME_AWARENESS">Awareness</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Buying type">
                  <Select value={newCampaignBuyingType} onValueChange={onNewCampaignBuyingTypeChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AUCTION">Auction</SelectItem>
                      <SelectItem value="RESERVED">Reservation</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Campaign status">
                  <Select value={newCampaignStatus} onValueChange={onNewCampaignStatusChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PAUSED">Paused</SelectItem>
                      <SelectItem value="ACTIVE">Active after approval</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Budget level">
                  <Select
                    value={newCampaignBudgetMode}
                    onValueChange={(value) => {
                      if (value === "campaign" || value === "adset") onNewCampaignBudgetModeChange(value);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="campaign">Campaign budget</SelectItem>
                      <SelectItem value="adset">Ad set budget</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Budget type">
                  <Select
                    value={newCampaignBudgetType}
                    onValueChange={(value) => {
                      if (value === "daily" || value === "lifetime") onNewCampaignBudgetTypeChange(value);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily budget</SelectItem>
                      <SelectItem value="lifetime">Lifetime budget</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Budget amount">
                  <Input
                    value={newCampaignBudget}
                    onChange={(event) => onNewCampaignBudgetChange(event.target.value)}
                    placeholder="20"
                  />
                </Field>
                <Field label="Bid strategy">
                  <Select value={newCampaignBidStrategy} onValueChange={onNewCampaignBidStrategyChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOWEST_COST_WITHOUT_CAP">Highest volume</SelectItem>
                      <SelectItem value="LOWEST_COST_WITH_BID_CAP">Bid cap</SelectItem>
                      <SelectItem value="COST_CAP">Cost per result goal</SelectItem>
                      <SelectItem value="LOWEST_COST_WITH_MIN_ROAS">ROAS goal</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Optimization goal">
                  <Select value={newCampaignOptimizationGoal} onValueChange={onNewCampaignOptimizationGoalChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OFFSITE_CONVERSIONS">Website conversions</SelectItem>
                      <SelectItem value="VALUE">Conversion value</SelectItem>
                      <SelectItem value="LINK_CLICKS">Link clicks</SelectItem>
                      <SelectItem value="REACH">Reach</SelectItem>
                      <SelectItem value="IMPRESSIONS">Impressions</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Bid control amount">
                  <Input
                    value={newCampaignBidAmount}
                    onChange={(event) => onNewCampaignBidAmountChange(event.target.value)}
                    placeholder="Only for bid cap, cost goal or ROAS goal"
                  />
                </Field>
                <Field label="Campaign spend limit">
                  <Input
                    value={newCampaignSpendLimit}
                    onChange={(event) => onNewCampaignSpendLimitChange(event.target.value)}
                    placeholder="Optional limit"
                  />
                </Field>
                <Field label="Start date">
                  <Input
                    type="date"
                    value={newCampaignStartDate}
                    onChange={(event) => onNewCampaignStartDateChange(event.target.value)}
                  />
                </Field>
                <Field label="End date">
                  <Input
                    type="date"
                    value={newCampaignEndDate}
                    onChange={(event) => onNewCampaignEndDateChange(event.target.value)}
                  />
                </Field>
                <Field label="Attribution">
                  <Select value={newCampaignAttribution} onValueChange={onNewCampaignAttributionChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7d_click_1d_view">7 day click or 1 day view</SelectItem>
                      <SelectItem value="7d_click">7 day click</SelectItem>
                      <SelectItem value="1d_click">1 day click</SelectItem>
                      <SelectItem value="1d_click_1d_view">1 day click or 1 day view</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Special ad category">
                  <Select value={newCampaignSpecialAdCategory} onValueChange={onNewCampaignSpecialAdCategoryChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">None</SelectItem>
                      <SelectItem value="EMPLOYMENT">Employment</SelectItem>
                      <SelectItem value="HOUSING">Housing</SelectItem>
                      <SelectItem value="CREDIT">Credit</SelectItem>
                      <SelectItem value="ISSUES_ELECTIONS_POLITICS">Social issues, elections or politics</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Markets">
                  <Input
                    value={newCampaignMarkets}
                    onChange={(event) => onNewCampaignMarketsChange(event.target.value)}
                    placeholder="Netherlands, Belgium"
                  />
                </Field>
                <label className="flex items-center gap-3 rounded-xl border px-3 py-3 text-sm font-medium">
                  <Checkbox
                    checked={newCampaignAbTest}
                    onCheckedChange={(checked) => onNewCampaignAbTestChange(checked === true)}
                  />
                  Create as A/B test campaign
                </label>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Field
        label="Package name / goal"
        hint="Name what you want to test. Media is attached or generated later in Review."
      >
        <Input
          value={draftGoal}
          onChange={(event) => onDraftGoalChange(event.target.value)}
          placeholder="Creative test goal"
        />
      </Field>

      <Card className="shadow-none">
        <CardContent className="space-y-4 p-4">
          <SectionHeader
            title="Format"
            description="Set the ad slots you want to create. Final media is added later in Review."
            action={<Badge variant="secondary">{mediaFormatLabel}</Badge>}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Ad type">
              <Select
                value={creativeMediaTypes.length > 1 ? "photo_video" : creativeMediaTypes[0]}
                onValueChange={onCreativeMediaTypeSelection}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="photo_video">Photo + Video</SelectItem>
                  <SelectItem value="photo">Photo only</SelectItem>
                  <SelectItem value="video">Video only</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="space-y-2">
              <Label>Ratio</Label>
              <ToggleGroup
                type="single"
                value={creativeAspectRatio}
                onValueChange={(value) => value && onUpdateTemplateFormat(value)}
                className="grid w-full grid-cols-4 rounded-xl bg-muted p-1"
              >
                {RATIO_OPTIONS.map((ratio) => (
                  <ToggleGroupItem
                    key={ratio}
                    value={ratio}
                    className="rounded-lg text-xs data-[state=on]:bg-background data-[state=on]:text-primary data-[state=on]:shadow-sm"
                  >
                    {ratio}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardContent className="space-y-4 p-4">
          <SectionHeader
            title="Catalog source"
            description="Choose one or multiple exact products from Brand Data."
          />
          <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-sm">
            <span className="font-semibold">Product selection</span>
            <span className="text-muted-foreground">
              {selectedCatalogCount ? selectedCatalogLabel : "Nothing selected"}
            </span>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={catalogSearchQuery}
              onChange={(event) => onCatalogSearchQueryChange(event.target.value)}
              placeholder="Search products..."
              className="pl-9"
            />
          </div>
          {visibleCatalogItems.length ? (
            <ScrollArea className="max-h-64">
              <div className="grid grid-cols-1 gap-2 pr-3 md:grid-cols-2">
                {visibleCatalogItems.map((item) => {
                  const isSelected = selectedProductIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onToggleProduct(item.id)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-3 text-left transition",
                        isSelected
                          ? "border-primary/30 bg-primary/5"
                          : "border-border bg-background hover:bg-muted/50",
                      )}
                    >
                      <div
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded border",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-transparent",
                        )}
                      >
                        <CheckCircle2 className="size-3.5" />
                      </div>
                      <div className="size-10 shrink-0 overflow-hidden rounded-lg border bg-muted">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="size-full object-cover" />
                        ) : (
                          <div className="flex size-full items-center justify-center text-muted-foreground/40">
                            <Package className="size-4" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{item.name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>Product</span>
                          {hasLinkedDriveContent(item) ? (
                            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
                              Library linked
                            </Badge>
                          ) : null}
                          {personaCountForProduct(item) > 0 ? (
                            <Badge variant="secondary" className="bg-primary/10 text-primary">
                              {personaCountForProduct(item)} Personas
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <Alert>
              <AlertDescription>
                {catalogSearchTerm
                  ? "No products match this search."
                  : "No products found in Brand Data yet."}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardContent className="space-y-4 p-4">
          <SectionHeader
            title="Ad set targeting"
            description="Choose custom targeting, or copy the targeting setup from an existing Meta ad set as a reference."
            action={
              <ToggleGroup
                type="single"
                value={targetingMode}
                onValueChange={(value) => {
                  if (value === "custom" || value === "copy") onTargetingModeChange(value);
                }}
                className="grid w-full min-w-[240px] grid-cols-2 rounded-xl bg-muted p-1"
              >
                <ToggleGroupItem
                  value="custom"
                  className="rounded-lg text-xs data-[state=on]:bg-background data-[state=on]:text-primary data-[state=on]:shadow-sm"
                >
                  Custom targeting
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="copy"
                  className="rounded-lg text-xs data-[state=on]:bg-background data-[state=on]:text-primary data-[state=on]:shadow-sm"
                >
                  Copy existing
                </ToggleGroupItem>
              </ToggleGroup>
            }
          />

          {targetingMode === "copy" ? (
            <Field
              label="Existing ad set reference"
              hint="The plan stores this ad set targeting as a reference. Nothing is published until review and approval pass."
            >
              <Select
                value={selectedTemplateAdsetId || undefined}
                onValueChange={onSelectedTemplateAdsetIdChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder={adsetPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {existingAdsets.map((adset) => (
                    <SelectItem key={adset.id} value={adset.id}>
                      {adset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {adsetsError ? (
                <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                  <AlertDescription>{adsetsError}</AlertDescription>
                </Alert>
              ) : null}
              {selectedTemplateAdset ? (
                <Alert className="border-primary/15 bg-primary/5">
                  <AlertDescription className="text-primary">
                    Targeting will be copied from the selected ad set and saved into the plan for review.
                  </AlertDescription>
                </Alert>
              ) : null}
            </Field>
          ) : (
            <div className="grid gap-3 md:grid-cols-4">
              <Field
                label="Countries"
                hint="Use country codes. This is saved into the ad set plan."
                className="md:col-span-2"
              >
                <Input
                  value={customTargetCountries}
                  onChange={(event) => onCustomTargetCountriesChange(event.target.value)}
                  placeholder="NL, BE, DE"
                />
              </Field>
              <Field label="Age">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    min={13}
                    max={65}
                    value={customTargetAgeMin}
                    onChange={(event) => onCustomTargetAgeMinChange(Number(event.target.value))}
                  />
                  <Input
                    type="number"
                    min={13}
                    max={65}
                    value={customTargetAgeMax}
                    onChange={(event) => onCustomTargetAgeMaxChange(Number(event.target.value))}
                  />
                </div>
              </Field>
              <Field label="Gender">
                <Select
                  value={customTargetGender}
                  onValueChange={(value) => {
                    if (value === "all" || value === "women" || value === "men") {
                      onCustomTargetGenderChange(value);
                    }
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="women">Women</SelectItem>
                    <SelectItem value="men">Men</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Alert className="md:col-span-4 border-primary/15 bg-primary/5">
                <AlertDescription className="text-primary">
                  Set who should see these ad sets. The buying reasons below decide what each ad says.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <SectionHeader
          title="Choose buying reasons"
          description="Each buying reason becomes one ad set. Personas create copy and creative variants inside that ad set."
          action={
            <Badge variant="secondary">{selectedPersonaPool.length || 0}/4 selected</Badge>
          }
        />

        <Card className="shadow-none">
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Label className="text-base">Ads per ad set</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Each selected buying reason becomes one ad set. Personas supply copy and creative variants inside that reason.
                </p>
              </div>
              <Input
                type="number"
                min={1}
                max={MAX_ADS_PER_AD_SET}
                value={adsPerAdSet}
                onChange={(event) => {
                  const value = Number(event.target.value || 1);
                  onAdsPerAdSetChange(Math.min(Math.max(value, 1), MAX_ADS_PER_AD_SET));
                }}
                className="w-full sm:w-40"
              />
            </div>
            <Alert className="border-primary/15 bg-primary/5">
              <AlertDescription className="text-primary">
                Current plan: {adSetCount} ad set{adSetCount === 1 ? "" : "s"} × {adsPerAdSet} ad
                {adsPerAdSet === 1 ? "" : "s"} = {requestedCreativeCount} creative
                {requestedCreativeCount === 1 ? "" : "s"}. Max {MAX_ADS_PER_AD_SET} ads per ad set
                {requestedCreativeCount > MAX_CREATIVES_PER_BATCH
                  ? ` and ${MAX_CREATIVES_PER_BATCH} creatives per batch`
                  : ""}
                .
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {displayedPersonaSuggestions.length ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {displayedPersonaSuggestions.slice(0, 4).map((persona, index) => {
              const isSelected = effectiveSelectedPersonaIds.includes(persona.id);
              return (
                <button
                  key={persona.id}
                  type="button"
                  onClick={() => onSelectPersona(persona.id)}
                  className={cn(
                    "rounded-xl border p-4 text-left transition",
                    isSelected
                      ? "border-primary/30 bg-primary/5 ring-1 ring-primary/10"
                      : "border-border bg-background hover:bg-muted/50",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold uppercase tracking-wide text-primary">
                        Buying reason {index + 1}
                      </div>
                      <div className="mt-1 font-semibold">{persona.name}</div>
                    </div>
                    <Badge variant={isSelected ? "default" : "secondary"}>
                      {isSelected ? "Use" : "Pick"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{persona.why}</p>
                </button>
              );
            })}
          </div>
        ) : (
          <Alert className="border-primary/15 bg-primary/5">
            <AlertTitle>No saved personas for this product yet</AlertTitle>
            <AlertDescription>
              Create personas for the selected product first. They will be saved to this user account and appear here automatically.
            </AlertDescription>
            <Button size="sm" className="mt-3" onClick={onOpenPersonasTab}>
              Make new personas
            </Button>
          </Alert>
        )}
      </div>

      {strategistResult?.ad_ideas?.length ? (
        <div className="space-y-3">
          <Label className="text-base">Strategist ad ideas</Label>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {strategistResult.ad_ideas.map((idea) => (
              <Card key={idea.title} className="shadow-none">
                <CardContent className="p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {idea.format}
                  </div>
                  <div className="mt-2 font-semibold">{idea.title}</div>
                  <div className="mt-2 text-sm text-muted-foreground">{idea.angle}</div>
                  <div className="mt-2 text-xs text-muted-foreground">First frame: {idea.first_frame}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      <Card className="gap-0 overflow-hidden shadow-none">
        <CardFooter className="flex flex-col items-stretch gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Build ad package</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {adSetCount} ad set{adSetCount === 1 ? "" : "s"} × {adsPerAdSet} ad
              {adsPerAdSet === 1 ? "" : "s"} = {requestedCreativeCount} creative
              {requestedCreativeCount === 1 ? "" : "s"}
            </p>
          </div>
          <Button disabled={buildDisabled} onClick={onBuildBatch} className="w-full sm:w-auto">
            {busy === "batch" ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {BATCH_PROGRESS_STEPS[batchProgressStep]}
              </>
            ) : (
              `Build ${adSetCount} ad set${adSetCount === 1 ? "" : "s"}`
            )}
          </Button>
        </CardFooter>

        {busy === "batch" ? (
          <>
            <Separator />
            <CardContent className="flex flex-wrap gap-2 p-4">
              {BATCH_PROGRESS_STEPS.map((step, index) => {
                const active = index === batchProgressStep;
                const done = index < batchProgressStep;
                return (
                  <Badge
                    key={step}
                    variant={active ? "default" : done ? "secondary" : "outline"}
                    className={cn(!active && !done && "text-muted-foreground")}
                  >
                    {done ? "Done" : active ? "Now" : "Next"} · {step}
                  </Badge>
                );
              })}
            </CardContent>
          </>
        ) : null}
      </Card>

      {latestCreatedBatch && busy !== "batch" ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-950">
          <AlertTitle>Ad package ready</AlertTitle>
          <AlertDescription>
            {latestCreatedBatch.name} is ready with {latestCreatedBatch.count} ad slots. Stay here to adjust the setup, or open Review to check the ads.
          </AlertDescription>
          <Button size="sm" className="mt-3" onClick={onOpenReviewTab}>
            Open Review
          </Button>
        </Alert>
      ) : null}
    </div>
  );
}
