"use client";

import Link from "next/link";
import {
  Activity,
  CalendarDays,
  FolderOpen,
  Package,
} from "lucide-react";
import type { Campaign, CampaignInsights, ContentLibrary, MetaStatus, Overview, ProductFolder } from "../types";
import { formatCurrency } from "../utils";
import { EmptyState, LoadingState, Metric } from "../components/CoreUI";
import { StatCard } from "../_components/StatCard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AdsManagerTabProps = {
  activeCampaigns: Campaign[];
  campaignDays: number;
  onCampaignDaysChange: (days: number) => void;
  campaignDateLabel: string;
  campaignInsights: CampaignInsights | null;
  campaignInsightsLoading: boolean;
  contentLibrary: ContentLibrary | null;
  contentLibraryLoading: boolean;
  overview: Overview | null;
  productCatalogItems: ProductFolder[];
  selectedCampaignId: string;
  onSelectCampaign: (campaignId: string) => void;
  selectedProductIds: string[];
  onSelectProduct: (productId: string) => void;
  personaCountForProduct: (item: ProductFolder) => number;
  brandDataScanHref: string;
  metaStatus: MetaStatus | null;
};

export default function AdsManagerTab({
  activeCampaigns,
  campaignDays,
  onCampaignDaysChange,
  campaignDateLabel,
  campaignInsights,
  campaignInsightsLoading,
  contentLibrary,
  contentLibraryLoading,
  overview,
  productCatalogItems,
  selectedCampaignId,
  onSelectCampaign,
  selectedProductIds,
  onSelectProduct,
  personaCountForProduct,
  brandDataScanHref,
  metaStatus,
}: AdsManagerTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Active campaigns" value={activeCampaigns.length} />
        <StatCard
          label={campaignDays === 1 ? "Today spend" : `${campaignDays} day spend`}
          value={formatCurrency(campaignInsights?.totalSpend || 0)}
        />
        <StatCard
          label="New content assets"
          value={contentLibrary?.totals.new.total || 0}
        />
        <StatCard
          label="Draft batches"
          value={overview?.counts.ad_creative_batches || 0}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="gap-0 py-0 xl:col-span-2">
          <CardHeader className="space-y-0 border-b p-0">
            <div className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Activity className="size-4 text-primary" />
                Active campaigns
              </CardTitle>
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-muted-foreground" />
                <span className="hidden text-sm text-muted-foreground sm:inline">
                  {campaignDateLabel}
                </span>
                <Select
                  value={String(campaignDays)}
                  onValueChange={(value) => onCampaignDaysChange(Number(value))}
                >
                  <SelectTrigger className="h-9 w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Today</SelectItem>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="14">Last 14 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            {campaignInsightsLoading ? (
              <LoadingState text="Loading active campaigns..." />
            ) : activeCampaigns.length ? (
              <div className="space-y-3">
                {activeCampaigns.slice(0, 6).map((campaign) => (
                  <button
                    key={campaign.id}
                    type="button"
                    onClick={() => onSelectCampaign(campaign.id)}
                    className={cn(
                      "w-full rounded-xl border p-4 text-left transition-colors",
                      selectedCampaignId === campaign.id
                        ? "border-primary/30 bg-primary/5"
                        : "border-border/60 bg-background hover:bg-muted/40",
                    )}
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground">
                          {campaign.name}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {campaign.status} | {campaign.objective || "No objective"}
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-3 text-right text-xs text-muted-foreground">
                        <Metric label="Spend" value={formatCurrency(campaign.spend)} />
                        <Metric label="ROAS" value={`${campaign.roas.toFixed(2)}x`} />
                        <Metric label="Purchases" value={campaign.purchases} />
                        <Metric label="Clicks" value={campaign.clicks} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                text={
                  metaStatus?.connected
                    ? "No active campaigns found. Paused campaigns are hidden here."
                    : "Connect Meta to show active campaigns here."
                }
              />
            )}
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="space-y-0 border-b p-0">
            <CardTitle className="flex items-center gap-2 px-5 py-4 text-base font-semibold">
              <FolderOpen className="size-4 text-primary" />
              Assets
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {contentLibraryLoading || contentLibrary === null ? (
              <LoadingState text="Loading product content..." />
            ) : productCatalogItems.length ? (
              <ScrollArea className="h-[520px] pr-2">
                <div className="space-y-2">
                  {productCatalogItems.map((folder) => (
                    <button
                      key={folder.id}
                      type="button"
                      onClick={() => onSelectProduct(folder.id)}
                      className={cn(
                        "w-full rounded-xl border px-3 py-3 text-left transition-colors",
                        selectedProductIds.includes(folder.id)
                          ? "border-primary/30 bg-primary/5"
                          : "border-border/60 bg-background hover:bg-muted/40",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-12 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted/30">
                          {folder.imageUrl ? (
                            <img
                              src={folder.imageUrl}
                              alt={folder.name}
                              className="size-full object-cover"
                            />
                          ) : (
                            <div className="flex size-full items-center justify-center text-muted-foreground/50">
                              <Package className="size-4" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-foreground">
                            {folder.name}
                          </div>
                          {folder.drive?.available ||
                          personaCountForProduct(folder) > 0 ? (
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              {folder.drive?.available ? (
                                <span>
                                  Library {folder.drive.images} photos,{" "}
                                  {folder.drive.videos} videos
                                </span>
                              ) : null}
                              {personaCountForProduct(folder) > 0 ? (
                                <Badge variant="secondary" className="text-[10px]">
                                  {personaCountForProduct(folder)} Personas
                                </Badge>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <EmptyState
                text="No scraped products found yet. Analyze the business in General Settings and every automation can use the detected products, collections and source content."
                actionHref={brandDataScanHref}
                actionLabel="Analyze business"
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="py-4">
        <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-semibold text-foreground">
              Setup status
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {metaStatus?.connected &&
              (metaStatus.accountIds?.length || metaStatus.accountId)
                ? `Meta connected with ${metaStatus.accountIds?.length || String(metaStatus.accountId || "").split(",").filter(Boolean).length} ad account${(metaStatus.accountIds?.length || 1) !== 1 ? "s" : ""}.`
                : "Connect Meta and select an ad account before publish jobs can be created."}
            </p>
          </div>
          <Button asChild className="shrink-0">
            <Link href="/dashboard/meta-setup?module=ads&next=/dashboard/ads">
              {metaStatus?.connected ? "Manage ad accounts" : "Set up Meta Ads"}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
