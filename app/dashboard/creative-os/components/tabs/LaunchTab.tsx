"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  ExternalLink,
  RadioTower,
  Rocket,
  Send,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GridList } from "../../_components/FormFields";
import { SubmittedAdPreview } from "../shared/MediaPreview";
import type { LaunchTabProps } from "@/app/dashboard/creative-os/components/tabs/types";
import type { CreativeTask, DeliveredEdit, LaunchItem, Product, SourceCreative } from "../../types";

type CampaignFilter = "all" | "active" | "paused";
type LaunchStatusFilter = "all" | "ready" | "uploaded" | "live";
type CampaignOption = {
  id: string;
  name: string;
  status?: string;
  effectiveStatus?: string;
  objective?: string;
  dailyBudget?: string | null;
  lifetimeBudget?: string | null;
  startTime?: string | null;
};
type AdsetOption = { id: string; name: string; campaign_id?: string; status?: string; effectiveStatus?: string };
type LaunchDraft = {
  campaignMode: "existing" | "new";
  campaignId: string;
  campaignName: string;
  adsetMode: "existing" | "new";
  adsetId: string;
  targetingSourceAdsetId: string;
  adsetName: string;
  landingPageUrl: string;
  dailyBudget: string;
  startTime: string;
  markets: string;
  adName: string;
  primaryText: string;
  headline: string;
  cta: string;
};
type LaunchCopyOverride = {
  adName: string;
  primaryText: string;
  headline: string;
};
type LaunchCopyMode = "same" | "per-ad";

const REQUEST_TIMEOUT_MS = 12000;

function defaultLocalStartTime() {
  const date = new Date(Date.now() + 30 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 16);
}

function launchStatusBadgeClass(status: string) {
  if (status === "live") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "uploaded") return "border-primary/15 bg-primary/10 text-primary";
  if (status === "archived") return "bg-muted text-muted-foreground";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function sourceLabel(source: SourceCreative | undefined, fallback = "") {
  if (source?.name) return source.name;
  if (source?.importName) return source.importName;
  if (fallback) return "Library source";
  return "Library file";
}

function findSourceForUrl(sources: SourceCreative[], value = "") {
  const cleanValue = value.trim();
  if (!cleanValue) return undefined;
  return sources.find(
    (source) =>
      source.assetUrl === cleanValue ||
      source.originalAssetUrl === cleanValue ||
      source.importUrl === cleanValue ||
      source.importSourceUrl === cleanValue,
  );
}

function launchSourceUrls(item: LaunchItem) {
  return item.sourceUsedUrls?.length
    ? item.sourceUsedUrls
    : item.sourceUsedUrl
      ? [item.sourceUsedUrl]
      : [];
}

function launchItemContext(
  item: LaunchItem,
  edits: DeliveredEdit[],
  tasks: CreativeTask[],
  products: Product[],
  sources: SourceCreative[],
  productNameById: Map<string, string>,
) {
  const edit = edits.find((candidate) => candidate.id === item.deliveredEditId);
  const task = edit
    ? tasks.find((candidate) => candidate.id === edit.taskId)
    : undefined;
  const sourceUrls = launchSourceUrls(item);
  const fallbackSource = sources.find((source) => source.id === item.sourceCreativeId);
  const usedSources = sourceUrls
    .map((url) => findSourceForUrl(sources, url))
    .filter(Boolean) as SourceCreative[];
  const primarySource = usedSources[0] || fallbackSource;
  const product = products.find((candidate) => candidate.id === item.productId || candidate.id === edit?.productId);
  const productName = productNameById.get(item.productId) || "Product";
  const previewUrl = edit?.previewUrl || item.approvedCreative;
  const briefTitle = task?.brief || edit?.briefSummary || item.recommendedAdName;
  const briefDetails = [
    task?.sourceGroupName || primarySource?.importName || primarySource?.name,
    task?.format,
    task?.outputCount ? `${task.outputCount} output${task.outputCount === 1 ? "" : "s"}` : "",
  ]
    .filter(Boolean)
    .join(" - ");

  return { edit, task, product, sourceUrls, primarySource, productName, previewUrl, briefTitle, briefDetails };
}

function defaultDraft(
  item: LaunchItem,
  context: ReturnType<typeof launchItemContext>,
): LaunchDraft {
  return {
    campaignMode: "existing",
    campaignId: "",
    campaignName: `${context.productName} Creative OS`,
    adsetMode: "existing",
    adsetId: "",
    targetingSourceAdsetId: "",
    adsetName: context.briefTitle,
    landingPageUrl: context.product?.url || "",
    dailyBudget: "20",
    startTime: defaultLocalStartTime(),
    markets: "NL",
    adName: context.briefTitle,
    primaryText: item.approvedCreative,
    headline: context.briefTitle,
    cta: "LEARN_MORE",
  };
}

function defaultLaunchCopy(item: LaunchItem, context: ReturnType<typeof launchItemContext>): LaunchCopyOverride {
  return {
    adName: context.briefTitle,
    primaryText: item.approvedCreative,
    headline: context.briefTitle,
  };
}

function FieldLabel({ children }: { children: string }) {
  return <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{children}</label>;
}

function campaignStatusValue(campaign: CampaignOption) {
  return String(campaign.effectiveStatus || campaign.status || "").toUpperCase();
}

function campaignUsesCampaignBudget(campaign?: CampaignOption) {
  return Boolean(campaign?.dailyBudget || campaign?.lifetimeBudget);
}

function campaignBudgetLabel(campaign?: CampaignOption) {
  if (!campaign) return "Campaign budget controls spend";
  if (campaign.dailyBudget) return `Campaign budget controls spend: ${campaign.dailyBudget}/day`;
  if (campaign.lifetimeBudget) return `Campaign lifetime budget controls spend: ${campaign.lifetimeBudget}`;
  return "Campaign budget controls spend";
}

function campaignMatchesFilter(campaign: CampaignOption, filter: CampaignFilter) {
  const status = campaignStatusValue(campaign);
  if (filter === "active") return status === "ACTIVE";
  if (filter === "paused") return status === "PAUSED";
  return true;
}

function adsetStatusValue(adset: AdsetOption) {
  return String(adset.effectiveStatus || adset.status || "").toUpperCase();
}

function isLiveAdset(adset: AdsetOption) {
  return adsetStatusValue(adset) === "ACTIVE";
}

function launchFilterCardClass(active: boolean) {
  return `shadow-none transition ${
    active ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20" : "hover:border-primary/25"
  }`;
}

async function fetchJsonWithTimeout(url: string, message: string) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || message);
    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`${message}. Meta is taking too long; try New campaign or retry.`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function launchErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Could not create ad in Meta";
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "Meta launch request disconnected before Creative OS got the result. Refresh Ads Manager and retry; if an empty ad set was created, choose that existing ad set instead of creating another new one.";
  }
  return message;
}

export function LaunchTab(props: LaunchTabProps) {
  const {
    sectionRefs,
    tenantId,
    workspaceLaunchItems,
    workspaceEdits,
    workspaceProducts,
    workspaceSources,
    workspaceTasks,
    productNameById,
    updateLaunchStatus,
    updateLaunchItem,
    moveLaunchItemBackToReview,
  } = props;
  const [openLaunchId, setOpenLaunchId] = useState("");
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [adsets, setAdsets] = useState<AdsetOption[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [adsetsLoading, setAdsetsLoading] = useState(false);
  const [campaignsLoaded, setCampaignsLoaded] = useState(false);
  const [campaignsError, setCampaignsError] = useState("");
  const [adsetsError, setAdsetsError] = useState("");
  const [campaignFilter, setCampaignFilter] = useState<CampaignFilter>("active");
  const [launchStatusFilter, setLaunchStatusFilter] = useState<LaunchStatusFilter>("ready");
  const [launchBriefFilter, setLaunchBriefFilter] = useState("all");
  const [selectedLaunchIds, setSelectedLaunchIds] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, LaunchDraft>>({});
  const [launchCopyOverrides, setLaunchCopyOverrides] = useState<Record<string, LaunchCopyOverride>>({});
  const [launchCopyModeByLaunchId, setLaunchCopyModeByLaunchId] = useState<Record<string, LaunchCopyMode>>({});
  const [activeBatchCopyItemByLaunchId, setActiveBatchCopyItemByLaunchId] = useState<Record<string, string>>({});
  const [launchStatus, setLaunchStatus] = useState<Record<string, { status: "idle" | "loading" | "done" | "error"; message?: string }>>({});
  const [launchNotice, setLaunchNotice] = useState<{ status: "loading" | "done" | "error"; message: string; url?: string } | null>(null);
  const [aiCopyStatus, setAiCopyStatus] = useState<Record<string, { status: "idle" | "loading" | "done" | "error"; message?: string }>>({});

  const visibleLaunchItems = workspaceLaunchItems.filter((item) => item.status !== "archived");
  const readyCount = visibleLaunchItems.filter((item) => item.status === "ready").length;
  const uploadedCount = visibleLaunchItems.filter((item) => item.status === "uploaded").length;
  const liveCount = visibleLaunchItems.filter((item) => item.status === "live").length;
  const launchBriefOptions = useMemo(() => {
    const options = new Map<string, string>();
    visibleLaunchItems.forEach((item) => {
      const context = launchItemContext(item, workspaceEdits, workspaceTasks, workspaceProducts, workspaceSources, productNameById);
      const id = context.task?.id || item.deliveredEditId;
      if (!id) return;
      options.set(id, context.briefTitle);
    });
    return Array.from(options, ([id, label]) => ({ id, label }));
  }, [productNameById, visibleLaunchItems, workspaceEdits, workspaceProducts, workspaceSources, workspaceTasks]);
  const filteredLaunchItems = useMemo(
    () =>
      visibleLaunchItems.filter((item) => {
        if (launchStatusFilter !== "all" && item.status !== launchStatusFilter) return false;
        if (launchBriefFilter === "all") return true;
        const context = launchItemContext(item, workspaceEdits, workspaceTasks, workspaceProducts, workspaceSources, productNameById);
        return (context.task?.id || item.deliveredEditId) === launchBriefFilter;
      }),
    [
      launchBriefFilter,
      launchStatusFilter,
      productNameById,
      visibleLaunchItems,
      workspaceEdits,
      workspaceProducts,
      workspaceSources,
      workspaceTasks,
    ],
  );
  const filteredReadyIds = filteredLaunchItems.filter((item) => item.status === "ready").map((item) => item.id);
  const filteredUploadedIds = filteredLaunchItems.filter((item) => item.status === "uploaded").map((item) => item.id);
  const selectedCampaignId = openLaunchId ? drafts[openLaunchId]?.campaignId || "" : "";
  const selectedCampaignMode = openLaunchId ? drafts[openLaunchId]?.campaignMode || "" : "";
  const selectedReadyIds = selectedLaunchIds.filter((id) =>
    visibleLaunchItems.some((item) => item.id === id && item.status === "ready"),
  );
  const selectedVisibleReadyIds = selectedReadyIds.filter((id) => filteredReadyIds.includes(id));
  const selectedUploadedIds = selectedLaunchIds.filter((id) =>
    visibleLaunchItems.some((item) => item.id === id && item.status === "uploaded"),
  );
  const selectedVisibleUploadedIds = selectedUploadedIds.filter((id) =>
    filteredUploadedIds.includes(id),
  );
  const selectedLaunchCount = selectedReadyIds.length + selectedUploadedIds.length;
  const filteredCampaigns = useMemo(
    () => campaigns.filter((campaign) => campaignMatchesFilter(campaign, campaignFilter)),
    [campaignFilter, campaigns],
  );
  const campaignFilterCounts = useMemo(
    () => ({
      all: campaigns.length,
      active: campaigns.filter((campaign) => campaignMatchesFilter(campaign, "active")).length,
      paused: campaigns.filter((campaign) => campaignMatchesFilter(campaign, "paused")).length,
    }),
    [campaigns],
  );

  useEffect(() => {
    if (!openLaunchId || campaignsLoaded || campaignsLoading) return;
    setCampaignsLoading(true);
    setCampaignsError("");
    fetchJsonWithTimeout(`/api/ads/campaigns?tenant_id=${encodeURIComponent(tenantId)}`, "Could not load Meta campaigns")
      .then((data) => setCampaigns(Array.isArray(data.campaigns) ? data.campaigns : []))
      .then(() => setCampaignsLoaded(true))
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Could not load Meta campaigns";
        setCampaignsError(message);
        setLaunchStatus((current) => ({ ...current, [openLaunchId]: { status: "error", message } }));
      })
      .finally(() => setCampaignsLoading(false));
  }, [campaignsLoaded, campaignsLoading, openLaunchId, tenantId]);

  useEffect(() => {
    if (!openLaunchId || !selectedCampaignId || selectedCampaignMode !== "existing") return;
    setAdsetsLoading(true);
    setAdsetsError("");
    fetchJsonWithTimeout(`/api/ads/adsets?tenant_id=${encodeURIComponent(tenantId)}&campaign_id=${encodeURIComponent(selectedCampaignId)}`, "Could not load Meta ad sets")
      .then((data) => setAdsets(Array.isArray(data.adsets) ? data.adsets : []))
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Could not load Meta ad sets";
        setAdsetsError(message);
        setLaunchStatus((current) => ({ ...current, [openLaunchId]: { status: "error", message } }));
      })
      .finally(() => setAdsetsLoading(false));
  }, [openLaunchId, selectedCampaignId, selectedCampaignMode, tenantId]);

  const adsetsForCampaign = useMemo(
    () =>
      selectedCampaignId
        ? adsets.filter((adset) => !adset.campaign_id || adset.campaign_id === selectedCampaignId)
        : adsets,
    [adsets, selectedCampaignId],
  );

  useEffect(() => {
    if (!openLaunchId || !selectedCampaignId) return;
    const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId);
    if (!selectedCampaign || campaignMatchesFilter(selectedCampaign, campaignFilter)) return;
    patchDraft(openLaunchId, { campaignId: "", adsetId: "" });
  }, [campaignFilter, campaigns, openLaunchId, selectedCampaignId]);

  function openLauncher(item: LaunchItem, context: ReturnType<typeof launchItemContext>) {
    setOpenLaunchId((current) => (current === item.id ? "" : item.id));
    setDrafts((current) => ({
      ...current,
      [item.id]: current[item.id] || defaultDraft(item, context),
    }));
    setCampaignsError("");
    setAdsetsError("");
  }

  function toggleSelectedLaunch(item: LaunchItem) {
    if (!["ready", "uploaded"].includes(item.status)) return;
    setSelectedLaunchIds((current) =>
      current.includes(item.id)
        ? current.filter((id) => id !== item.id)
        : [...current, item.id],
    );
  }

  function setUploadedSelection(nextUploadedIds: string[]) {
    setSelectedLaunchIds((current) =>
      Array.from(
        new Set([
          ...current.filter((id) => !filteredUploadedIds.includes(id)),
          ...nextUploadedIds,
        ]),
      ),
    );
  }

  function moveSelectedUploadedBackToReady() {
    if (!selectedVisibleUploadedIds.length) return;
    selectedVisibleUploadedIds.forEach((id) =>
      updateLaunchItem(id, {
        status: "ready",
        metaCampaignId: "",
        metaAdsetId: "",
        metaCreativeId: "",
        metaAdId: "",
        metaLaunchUrl: "",
        launchedAt: "",
        launchError: "",
      }),
    );
    setSelectedLaunchIds((current) =>
      current.filter((id) => !selectedVisibleUploadedIds.includes(id)),
    );
    setLaunchNotice({
      status: "done",
      message: `Moved ${selectedVisibleUploadedIds.length} created ad${selectedVisibleUploadedIds.length === 1 ? "" : "s"} back to Ready.`,
    });
  }

  function markSelectedUploadedLive() {
    if (!selectedVisibleUploadedIds.length) return;
    selectedVisibleUploadedIds.forEach((id) => updateLaunchStatus(id, "live"));
    setSelectedLaunchIds((current) =>
      current.filter((id) => !selectedVisibleUploadedIds.includes(id)),
    );
    setLaunchNotice({
      status: "done",
      message: `Marked ${selectedVisibleUploadedIds.length} created ad${selectedVisibleUploadedIds.length === 1 ? "" : "s"} live.`,
    });
  }

  function patchDraft(launchId: string, patch: Partial<LaunchDraft>) {
    setDrafts((current) => ({
      ...current,
      [launchId]: { ...(current[launchId] || ({} as LaunchDraft)), ...patch },
    }));
  }

  function patchLaunchCopyOverride(launchId: string, fallback: LaunchCopyOverride, patch: Partial<LaunchCopyOverride>) {
    setLaunchCopyOverrides((current) => ({
      ...current,
      [launchId]: {
        ...(current[launchId] || fallback),
        ...patch,
      },
    }));
  }

  async function createInAdsManager(item: LaunchItem, launchItemIds = [item.id]) {
    const draft = drafts[item.id];
    if (!draft) return;
    const targetIds = launchItemIds.length ? launchItemIds : [item.id];
    const selectedCampaign = campaigns.find((campaign) => campaign.id === draft.campaignId);
    const usesCampaignBudget =
      draft.campaignMode === "existing" && campaignUsesCampaignBudget(selectedCampaign);
    const scheduledLaunch =
      draft.adsetMode === "new" &&
      Boolean(draft.startTime) &&
      new Date(draft.startTime).getTime() > Date.now() + 60 * 1000;
    const usesPerAdCopy = targetIds.length > 1 && (launchCopyModeByLaunchId[item.id] || "per-ad") === "per-ad";
    const itemOverrides = usesPerAdCopy
      ? Object.fromEntries(
          targetIds
            .map((id) => {
              const selectedItem = visibleLaunchItems.find((candidate) => candidate.id === id);
              if (!selectedItem) return null;
              const selectedContext = launchItemContext(selectedItem, workspaceEdits, workspaceTasks, workspaceProducts, workspaceSources, productNameById);
              return [id, launchCopyOverrides[id] || defaultLaunchCopy(selectedItem, selectedContext)] as const;
            })
            .filter(Boolean) as Array<readonly [string, LaunchCopyOverride]>,
        )
      : {};
    const loadingMessage = scheduledLaunch
      ? targetIds.length === 1
        ? "Creating scheduled ad in Meta Ads Manager..."
        : `Creating ${targetIds.length} scheduled ads in Meta Ads Manager...`
      : targetIds.length === 1
        ? "Creating paused ad in Meta Ads Manager..."
        : `Creating ${targetIds.length} paused ads in Meta Ads Manager...`;
    setLaunchStatus((current) => ({
      ...current,
      ...Object.fromEntries(targetIds.map((id) => [id, { status: "loading" as const, message: loadingMessage }])),
    }));
    setLaunchNotice({ status: "loading", message: loadingMessage });
    try {
      const response = await fetch("/api/ad-manager/creative-os/launch-to-meta", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          launch_item_id: item.id,
          launch_item_ids: targetIds,
          useItemCopy: usesPerAdCopy,
          itemOverrides,
          ...draft,
          campaignBudgetMode: usesCampaignBudget ? "campaign" : "adset",
          startTime: draft.startTime ? new Date(draft.startTime).toISOString() : "",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not create ad in Meta");
      const metaItems = Array.isArray(data.meta?.items) ? data.meta.items : [];
      if (metaItems.length) {
        metaItems.forEach((metaItem: Record<string, unknown>) => {
          const launchId = String(metaItem.launch_item_id || "");
          if (!launchId) return;
          updateLaunchItem(launchId, {
            status: "uploaded",
            metaCampaignId: data.meta?.campaign_id,
            metaAdsetId: data.meta?.adset_id,
            metaCreativeId: String(metaItem.creative_id || ""),
            metaAdId: String(metaItem.ad_id || ""),
            metaLaunchUrl: String(metaItem.ads_manager_url || data.meta?.ads_manager_url || ""),
            launchedAt: new Date().toISOString(),
            launchError: "",
          });
        });
      } else {
        updateLaunchItem(item.id, {
          status: "uploaded",
          metaCampaignId: data.meta?.campaign_id,
          metaAdsetId: data.meta?.adset_id,
          metaCreativeId: data.meta?.creative_id,
          metaAdId: data.meta?.ad_id,
          metaLaunchUrl: data.meta?.ads_manager_url,
          launchedAt: new Date().toISOString(),
          launchError: "",
        });
      }
      setSelectedLaunchIds((current) => current.filter((id) => !targetIds.includes(id)));
      const doneMessage = scheduledLaunch
        ? targetIds.length === 1
          ? "Created as scheduled in Meta Ads Manager."
          : `Created ${targetIds.length} scheduled ads in Meta Ads Manager.`
        : targetIds.length === 1
          ? "Created as a paused ad in Meta Ads Manager."
          : `Created ${targetIds.length} paused ads in Meta Ads Manager.`;
      setLaunchStatus((current) => ({
        ...current,
        ...Object.fromEntries(targetIds.map((id) => [id, { status: "done" as const, message: doneMessage }])),
      }));
      setLaunchNotice({
        status: "done",
        message: data.message || doneMessage,
        url: String(data.meta?.ads_manager_url || ""),
      });
    } catch (error) {
      const message = launchErrorMessage(error);
      targetIds.forEach((id) => updateLaunchItem(id, { launchError: message }));
      setLaunchStatus((current) => ({
        ...current,
        ...Object.fromEntries(targetIds.map((id) => [id, { status: "error" as const, message }])),
      }));
      setLaunchNotice({ status: "error", message });
    }
  }

  async function requestLaunchCopy(item: LaunchItem, context: ReturnType<typeof launchItemContext>) {
    const response = await fetch("/api/ad-manager/creative-os/launch-copy", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenant_id: tenantId,
        launchItem: item,
        edit: context.edit,
        task: context.task,
        product: context.product,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not write launch copy");
    return data as { primaryText: string; headline: string; source?: string };
  }

  async function fillLaunchCopy(item: LaunchItem, context: ReturnType<typeof launchItemContext>) {
    setAiCopyStatus((current) => ({
      ...current,
      [item.id]: { status: "loading", message: "Writing launch copy..." },
    }));
    try {
      const data = await requestLaunchCopy(item, context);
      patchDraft(item.id, {
        primaryText: data.primaryText,
        headline: data.headline,
      });
      setAiCopyStatus((current) => ({
        ...current,
        [item.id]: { status: "done", message: data.source === "ai" ? "AI copy filled." : "Copy filled from brief context." },
      }));
    } catch (error) {
      setAiCopyStatus((current) => ({
        ...current,
        [item.id]: {
          status: "error",
          message: error instanceof Error ? error.message : "Could not write launch copy",
        },
      }));
    }
  }

  async function fillSelectedLaunchCopies(ownerLaunchId: string, items: LaunchItem[]) {
    if (!items.length) return;
    setLaunchCopyModeByLaunchId((current) => ({ ...current, [ownerLaunchId]: "per-ad" }));
    setAiCopyStatus((current) => ({
      ...current,
      ...Object.fromEntries(items.map((item) => [item.id, { status: "loading" as const, message: "Writing per-ad copy..." }])),
    }));
    await Promise.all(
      items.map(async (selectedItem) => {
        const selectedContext = launchItemContext(selectedItem, workspaceEdits, workspaceTasks, workspaceProducts, workspaceSources, productNameById);
        try {
          const data = await requestLaunchCopy(selectedItem, selectedContext);
          patchLaunchCopyOverride(selectedItem.id, defaultLaunchCopy(selectedItem, selectedContext), {
            primaryText: data.primaryText,
            headline: data.headline,
          });
          setAiCopyStatus((current) => ({
            ...current,
            [selectedItem.id]: { status: "done", message: data.source === "ai" ? "AI copy filled." : "Copy filled from brief context." },
          }));
        } catch (error) {
          setAiCopyStatus((current) => ({
            ...current,
            [selectedItem.id]: {
              status: "error",
              message: error instanceof Error ? error.message : "Could not write launch copy",
            },
          }));
        }
      }),
    );
  }

  return (
    <div
      ref={(el) => {
        sectionRefs.current.launch = el;
      }}
      className="space-y-4"
    >
      <div>
        <div className="text-base font-bold text-foreground">Launch</div>
        <div className="mt-0.5 text-sm leading-5 text-muted-foreground">
          Create approved ads in Meta Ads Manager as scheduled or paused, then mark them live after publishing.
        </div>
      </div>

      {launchNotice ? (
        <Card className={`shadow-none ${launchNotice.status === "error" ? "border-destructive/20 bg-destructive/5" : launchNotice.status === "done" ? "border-emerald-200 bg-emerald-50" : "border-primary/20 bg-primary/5"}`}>
          <CardContent className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between">
            <div className={`text-sm font-bold ${launchNotice.status === "error" ? "text-destructive" : launchNotice.status === "done" ? "text-emerald-800" : "text-primary"}`}>
              {launchNotice.message}
            </div>
            <div className="flex flex-wrap gap-2">
              {launchNotice.url ? (
                <Button type="button" variant="outline" size="sm" asChild>
                  <a href={launchNotice.url} target="_blank" rel="noreferrer">
                    <ExternalLink size={15} />
                    Open created ads
                  </a>
                </Button>
              ) : null}
              <Button type="button" variant="ghost" size="sm" onClick={() => setLaunchNotice(null)}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <Card
          className={launchFilterCardClass(launchStatusFilter === "ready")}
          role="button"
          tabIndex={0}
          onClick={() => setLaunchStatusFilter("ready")}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") setLaunchStatusFilter("ready");
          }}
        >
          <CardContent className="flex cursor-pointer items-center gap-3 p-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <Rocket size={17} />
            </span>
            <div>
              <div className="text-xl font-bold text-foreground">{readyCount}</div>
              <div className="text-xs font-semibold text-muted-foreground">Ready to create</div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={launchFilterCardClass(launchStatusFilter === "uploaded")}
          role="button"
          tabIndex={0}
          onClick={() => setLaunchStatusFilter("uploaded")}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") setLaunchStatusFilter("uploaded");
          }}
        >
          <CardContent className="flex cursor-pointer items-center gap-3 p-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UploadCloud size={17} />
            </span>
            <div>
              <div className="text-xl font-bold text-foreground">{uploadedCount}</div>
              <div className="text-xs font-semibold text-muted-foreground">Created in Ads Manager</div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={launchFilterCardClass(launchStatusFilter === "live")}
          role="button"
          tabIndex={0}
          onClick={() => setLaunchStatusFilter("live")}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") setLaunchStatusFilter("live");
          }}
        >
          <CardContent className="flex cursor-pointer items-center gap-3 p-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <RadioTower size={17} />
            </span>
            <div>
              <div className="text-xl font-bold text-foreground">{liveCount}</div>
              <div className="text-xs font-semibold text-muted-foreground">Live</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none">
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="text-sm font-bold text-foreground">Filter launch library</div>
            <div className="flex flex-wrap gap-1 rounded-lg bg-muted/50 p-1">
              {([
                ["ready", "Ready", readyCount],
                ["uploaded", "Created", uploadedCount],
                ["live", "Live", liveCount],
                ["all", "All", visibleLaunchItems.length],
              ] as Array<[LaunchStatusFilter, string, number]>).map(([value, label, count]) => {
                const active = launchStatusFilter === value;
                return (
                  <button
                    key={value}
                    type="button"
                    className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
                      active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/70"
                    }`}
                    onClick={() => setLaunchStatusFilter(value)}
                  >
                    {label} ({count})
                  </button>
                );
              })}
            </div>
          </div>
          <div className="w-full space-y-1 lg:max-w-sm">
            <FieldLabel>Brief</FieldLabel>
            <select
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
              value={launchBriefFilter}
              onChange={(event) => setLaunchBriefFilter(event.target.value)}
            >
              <option value="all">All briefs</option>
              {launchBriefOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {filteredReadyIds.length > 0 || filteredUploadedIds.length > 0 ? (
        <Card className="sticky top-3 z-20 border-primary/20 bg-background/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <CardContent className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-bold text-foreground">
                {selectedLaunchCount} selected
              </div>
              <div className="mt-0.5 text-xs font-medium text-muted-foreground">
                {selectedReadyIds.length} ready for batch create · {selectedUploadedIds.length} created selected
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {filteredReadyIds.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSelectedLaunchIds(
                      selectedVisibleReadyIds.length === filteredReadyIds.length
                        ? selectedLaunchIds.filter((id) => !filteredReadyIds.includes(id))
                        : Array.from(new Set([...selectedLaunchIds, ...filteredReadyIds])),
                    )
                  }
                >
                  {selectedVisibleReadyIds.length === filteredReadyIds.length ? "Clear visible ready" : "Select all visible ready"}
                </Button>
              ) : null}
              {filteredUploadedIds.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setUploadedSelection(
                      selectedVisibleUploadedIds.length === filteredUploadedIds.length
                        ? []
                        : filteredUploadedIds,
                    )
                  }
                >
                  {selectedVisibleUploadedIds.length === filteredUploadedIds.length ? "Clear visible created" : "Select all visible created"}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!selectedLaunchCount}
                onClick={() => setSelectedLaunchIds([])}
              >
                Clear all
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!selectedVisibleUploadedIds.length}
                onClick={moveSelectedUploadedBackToReady}
              >
                Back to Ready
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!selectedVisibleUploadedIds.length}
                onClick={markSelectedUploadedLive}
              >
                <CheckCircle2 size={14} />
                Mark live
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <GridList
        title="Ready Launch Library"
        subtitle="Approved ads with the delivery file, product, brief, and Ads Manager setup."
        emptyText="No ads match these launch filters."
        layout="full"
        items={filteredLaunchItems.map((item) => {
          const context = launchItemContext(item, workspaceEdits, workspaceTasks, workspaceProducts, workspaceSources, productNameById);
          const draft = drafts[item.id] || defaultDraft(item, context);
          const itemLaunchStatus = launchStatus[item.id];
          const itemAiCopyStatus = aiCopyStatus[item.id];
          const setupOpen = openLaunchId === item.id;
          const selectedForBatch = selectedReadyIds.includes(item.id);
          const selectedForBulk = selectedLaunchIds.includes(item.id);
          const createIds = selectedForBatch && selectedReadyIds.length > 1 ? selectedReadyIds : [item.id];
          const selectedCampaign = campaigns.find((campaign) => campaign.id === draft.campaignId);
          const usesCampaignBudget = draft.campaignMode === "existing" && campaignUsesCampaignBudget(selectedCampaign);
          const usesCopiedTargeting = draft.adsetMode === "new" && Boolean(draft.targetingSourceAdsetId);
          const selectedBatchItems = createIds
            .map((id) => visibleLaunchItems.find((candidate) => candidate.id === id))
            .filter(Boolean) as LaunchItem[];
          const launchCopyMode = launchCopyModeByLaunchId[item.id] || "per-ad";
          const usesPerAdCopy = selectedBatchItems.length > 1 && launchCopyMode === "per-ad";
          const selectedCopyLoading = selectedBatchItems.some(
            (selectedItem) => aiCopyStatus[selectedItem.id]?.status === "loading",
          );
          const activeBatchCopyItemId = selectedBatchItems.some(
            (selectedItem) => selectedItem.id === activeBatchCopyItemByLaunchId[item.id],
          )
            ? activeBatchCopyItemByLaunchId[item.id]
            : selectedBatchItems[0]?.id || "";
          const activeBatchCopyItem = selectedBatchItems.find(
            (selectedItem) => selectedItem.id === activeBatchCopyItemId,
          );

          return (
            <Card key={item.id} className={`${setupOpen ? "overflow-visible" : "overflow-hidden"} rounded-2xl shadow-none ring-primary/10`}>
              <CardContent className="grid gap-4 p-4 lg:grid-cols-[240px_minmax(0,1fr)_auto] lg:items-start">
                <div className={`space-y-2 ${setupOpen ? "lg:sticky lg:top-20 lg:self-start" : ""}`}>
                  {["ready", "uploaded"].includes(item.status) ? (
                    <label className="flex items-center gap-2 rounded-xl border border-border/70 bg-background px-3 py-2 text-sm font-bold text-foreground">
                      <input
                        type="checkbox"
                        checked={selectedForBulk}
                        onChange={() => toggleSelectedLaunch(item)}
                        className="size-4 accent-primary"
                      />
                      {item.status === "ready" ? "Place in batch" : "Select created"}
                    </label>
                  ) : null}
                  <SubmittedAdPreview url={context.previewUrl} title={item.recommendedAdName} variant="launch" />
                </div>

                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-bold text-foreground">{context.briefTitle}</div>
                      <div className="mt-1 text-sm font-semibold text-muted-foreground">{context.productName}</div>
                    </div>
                    <Badge variant="outline" className={launchStatusBadgeClass(item.status)}>
                      {item.status}
                    </Badge>
                  </div>

                  <div className="rounded-xl border border-primary/15 bg-primary/5 p-3 text-sm">
                    <div className="text-xs font-bold uppercase tracking-wide text-primary">Brief</div>
                    <div className="mt-1 font-semibold leading-6 text-foreground">{context.briefTitle}</div>
                    {context.briefDetails ? (
                      <div className="mt-1 text-xs font-semibold text-muted-foreground">{context.briefDetails}</div>
                    ) : null}
                    {context.task?.notes ? (
                      <div className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{context.task.notes}</div>
                    ) : null}
                  </div>

                  <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                    <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                      <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Angle / hook</div>
                      <div className="mt-1 line-clamp-2 font-semibold text-foreground">{item.approvedCreative}</div>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                      <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Library source</div>
                      <div className="mt-1 line-clamp-2 font-semibold text-foreground">
                        {sourceLabel(context.primarySource, item.sourceCreativeId)}
                      </div>
                    </div>
                  </div>

                  {setupOpen ? (
                    <div className="rounded-xl border border-border bg-background p-3">
                      <div className="mb-3 text-sm font-bold text-foreground">Ads Manager setup</div>
                          {selectedBatchItems.length > 1 ? (
                            <div className="mb-3 rounded-xl border border-primary/15 bg-primary/5 p-3">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="text-xs font-bold uppercase tracking-wide text-primary">
                                    Selected ads in this launch
                                  </div>
                                  <div className="mt-1 text-xs font-semibold text-muted-foreground">
                                    Choose one shared copy set or write different Meta copy per ad.
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <div className="flex rounded-lg bg-background p-1 shadow-sm">
                                    {([
                                      ["same", "Same copy for all"],
                                      ["per-ad", "Different per ad"],
                                    ] as Array<[LaunchCopyMode, string]>).map(([value, label]) => (
                                      <button
                                        key={value}
                                        type="button"
                                        className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
                                          launchCopyMode === value
                                            ? "bg-primary text-primary-foreground shadow-sm"
                                            : "text-muted-foreground hover:bg-muted"
                                        }`}
                                        onClick={() =>
                                          setLaunchCopyModeByLaunchId((current) => ({ ...current, [item.id]: value }))
                                        }
                                      >
                                        {label}
                                      </button>
                                    ))}
                                  </div>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    disabled={selectedCopyLoading}
                                    onClick={() =>
                                      launchCopyMode === "same"
                                        ? void fillLaunchCopy(item, context)
                                        : void fillSelectedLaunchCopies(item.id, selectedBatchItems)
                                    }
                                  >
                                    <Sparkles size={14} />
                                    {selectedCopyLoading || itemAiCopyStatus?.status === "loading"
                                      ? "Writing..."
                                      : launchCopyMode === "same"
                                        ? "Fill all same"
                                        : "Fill all different"}
                                  </Button>
                                </div>
                              </div>
                              <div className="mt-3 rounded-xl border border-primary/10 bg-background p-2">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                    Batch cart ({selectedBatchItems.length} ads)
                                  </div>
                                  <Badge variant="outline">
                                    {usesPerAdCopy ? "Edit one ad at a time" : "Shared copy"}
                                  </Badge>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                  {selectedBatchItems.map((selectedItem, index) => {
                                    const selectedContext = launchItemContext(selectedItem, workspaceEdits, workspaceTasks, workspaceProducts, workspaceSources, productNameById);
                                    const selectedCopy = launchCopyOverrides[selectedItem.id] || defaultLaunchCopy(selectedItem, selectedContext);
                                    const active = selectedItem.id === activeBatchCopyItemId;
                                    return (
                                      <button
                                        key={selectedItem.id}
                                        type="button"
                                        className={`min-w-0 rounded-lg border px-3 py-2 text-left transition ${
                                          active && usesPerAdCopy
                                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                            : "border-border/70 bg-muted/20 hover:border-primary/30"
                                        }`}
                                        onClick={() =>
                                          setActiveBatchCopyItemByLaunchId((current) => ({ ...current, [item.id]: selectedItem.id }))
                                        }
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="text-xs font-bold text-muted-foreground">Ad {index + 1}</span>
                                          <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                                            {usesPerAdCopy && active ? "editing" : usesPerAdCopy ? "select" : "shared"}
                                          </span>
                                        </div>
                                        <div className="mt-1 truncate text-sm font-bold text-foreground">{selectedCopy.adName}</div>
                                        <div className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
                                          {selectedCopy.headline}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>

                                {usesPerAdCopy && activeBatchCopyItem ? (() => {
                                  const activeContext = launchItemContext(activeBatchCopyItem, workspaceEdits, workspaceTasks, workspaceProducts, workspaceSources, productNameById);
                                  const activeCopy = launchCopyOverrides[activeBatchCopyItem.id] || defaultLaunchCopy(activeBatchCopyItem, activeContext);
                                  const activeCopyStatus = aiCopyStatus[activeBatchCopyItem.id];
                                  const activeIndex = selectedBatchItems.findIndex((selectedItem) => selectedItem.id === activeBatchCopyItem.id) + 1;
                                  return (
                                    <div className="mt-3 rounded-lg border border-primary/15 bg-primary/5 p-3">
                                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                          <div className="text-xs font-bold text-muted-foreground">Editing Ad {activeIndex}</div>
                                          <div className="text-sm font-semibold text-foreground">{activeContext.briefTitle}</div>
                                        </div>
                                        <Badge variant="outline">Per-ad copy</Badge>
                                      </div>
                                      <div className="grid gap-2 md:grid-cols-2">
                                        <div className="space-y-1">
                                          <FieldLabel>Meta ad name</FieldLabel>
                                          <input
                                            className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                                            value={activeCopy.adName}
                                            onChange={(event) =>
                                              patchLaunchCopyOverride(activeBatchCopyItem.id, activeCopy, { adName: event.target.value })
                                            }
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <FieldLabel>Meta headline</FieldLabel>
                                          <input
                                            className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                                            value={activeCopy.headline}
                                            onChange={(event) =>
                                              patchLaunchCopyOverride(activeBatchCopyItem.id, activeCopy, { headline: event.target.value })
                                            }
                                          />
                                        </div>
                                        <div className="space-y-1 md:col-span-2">
                                          <FieldLabel>Primary text</FieldLabel>
                                          <textarea
                                            className="min-h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                                            value={activeCopy.primaryText}
                                            onChange={(event) =>
                                              patchLaunchCopyOverride(activeBatchCopyItem.id, activeCopy, { primaryText: event.target.value })
                                            }
                                          />
                                        </div>
                                        {activeCopyStatus?.message ? (
                                          <div className={`text-xs font-semibold md:col-span-2 ${activeCopyStatus.status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                                            {activeCopyStatus.message}
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                  );
                                })() : (
                                  <div className="mt-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs font-semibold leading-5 text-muted-foreground">
                                    All selected ads will use the shared Meta ad name, headline, primary text, and CTA below.
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : null}
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                          <FieldLabel>Campaign</FieldLabel>
                          <select
                            className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                            value={draft.campaignMode}
                            onChange={(event) => {
                              const campaignMode = event.target.value as "existing" | "new";
                              patchDraft(item.id, {
                                campaignMode,
                                campaignId: "",
                                adsetId: "",
                                targetingSourceAdsetId: "",
                                adsetMode: campaignMode === "new" ? "new" : draft.adsetMode,
                              });
                            }}
                          >
                            <option value="existing">Existing campaign</option>
                            <option value="new">New campaign</option>
                          </select>
                        </div>
                        {draft.campaignMode === "existing" ? (
                          <div className="space-y-1">
                            <FieldLabel>Choose campaign</FieldLabel>
                            <div className="flex flex-wrap gap-1 rounded-lg bg-muted/50 p-1">
                              {([
                                ["active", "Live", campaignFilterCounts.active],
                                ["paused", "Paused", campaignFilterCounts.paused],
                                ["all", "All", campaignFilterCounts.all],
                              ] as Array<[CampaignFilter, string, number]>).map(([value, label, count]) => {
                                const active = campaignFilter === value;
                                return (
                                  <button
                                    key={value}
                                    type="button"
                                    className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
                                      active
                                        ? "bg-background text-foreground shadow-sm"
                                        : "text-muted-foreground hover:bg-background/70"
                                    }`}
                                    onClick={() => setCampaignFilter(value as CampaignFilter)}
                                  >
                                    {label} {campaignsLoaded ? `(${count})` : ""}
                                  </button>
                                );
                              })}
                            </div>
                            <select
                              className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                              value={draft.campaignId}
                              onChange={(event) => patchDraft(item.id, { campaignId: event.target.value, adsetId: "", targetingSourceAdsetId: "" })}
                              disabled={campaignsLoading}
                            >
                              <option value="">
                                {campaignsLoading
                                  ? "Loading campaigns..."
                                  : filteredCampaigns.length
                                    ? "Select campaign"
                                    : `No ${campaignFilter === "active" ? "live" : campaignFilter} campaigns`}
                              </option>
                              {filteredCampaigns.map((campaign) => (
                                <option key={campaign.id} value={campaign.id}>
                                  {campaign.name} {campaignStatusValue(campaign) ? `- ${campaignStatusValue(campaign).toLowerCase()}` : ""}
                                </option>
                              ))}
                            </select>
                            {campaignsError ? (
                              <div className="text-xs font-semibold text-destructive">
                                {campaignsError}
                              </div>
                            ) : null}
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setCampaignsLoaded(false);
                                  setCampaigns([]);
                                  setCampaignsError("");
                                }}
                              >
                                Retry
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  patchDraft(item.id, {
                                    campaignMode: "new",
                                    campaignId: "",
                                    adsetMode: "new",
                                    adsetId: "",
                                    targetingSourceAdsetId: "",
                                  })
                                }
                              >
                                Use new campaign
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <FieldLabel>New campaign name</FieldLabel>
                            <input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={draft.campaignName} onChange={(event) => patchDraft(item.id, { campaignName: event.target.value })} />
                          </div>
                        )}

                        <div className="space-y-1">
                          <FieldLabel>Ad set</FieldLabel>
                          <select
                            className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                            value={draft.adsetMode}
                            onChange={(event) => patchDraft(item.id, { adsetMode: event.target.value as "existing" | "new", adsetId: "", targetingSourceAdsetId: "" })}
                          >
                            <option value="existing" disabled={draft.campaignMode === "new"}>Existing ad set</option>
                            <option value="new">New ad set</option>
                          </select>
                        </div>
                        {draft.adsetMode === "existing" ? (
                          <div className="space-y-1">
                            <FieldLabel>Choose ad set</FieldLabel>
                            <select
                              className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                              value={draft.adsetId}
                              onChange={(event) => patchDraft(item.id, { adsetId: event.target.value })}
                              disabled={adsetsLoading || !draft.campaignId}
                            >
                              <option value="">{adsetsLoading ? "Loading ad sets..." : "Select ad set"}</option>
                              {adsetsForCampaign.map((adset) => (
                                <option key={adset.id} value={adset.id}>{adset.name} {adsetStatusValue(adset) ? `- ${adsetStatusValue(adset).toLowerCase()}` : ""}</option>
                              ))}
                            </select>
                            {adsetsError ? (
                              <div className="text-xs font-semibold text-destructive">
                                {adsetsError}
                              </div>
                            ) : null}
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                patchDraft(item.id, {
                                  adsetMode: "new",
                                  adsetId: "",
                                  targetingSourceAdsetId: "",
                                })
                              }
                            >
                              Use new ad set
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="space-y-1">
                              <FieldLabel>New ad set name</FieldLabel>
                              <input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={draft.adsetName} onChange={(event) => patchDraft(item.id, { adsetName: event.target.value })} />
                            </div>
                            {draft.campaignMode === "existing" && draft.campaignId ? (
                              <div className="space-y-1">
                                <FieldLabel>Copy targeting from live ad set</FieldLabel>
                                <select
                                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                                  value={draft.targetingSourceAdsetId}
                                  onChange={(event) => patchDraft(item.id, { targetingSourceAdsetId: event.target.value })}
                                  disabled={adsetsLoading}
                                >
                                  <option value="">
                                    {adsetsLoading
                                      ? "Loading live ad sets..."
                                      : adsetsForCampaign.some(isLiveAdset)
                                        ? "Use default targeting"
                                        : "No live ad sets in this campaign"}
                                  </option>
                                  {adsetsForCampaign.filter(isLiveAdset).map((adset) => (
                                    <option key={adset.id} value={adset.id}>
                                      Same targeting as {adset.name}
                                    </option>
                                  ))}
                                </select>
                                <div className="text-xs font-medium leading-5 text-muted-foreground">
                                  Creates a new ad set with the selected live ad set targeting and delivery settings. Future start times become scheduled in Meta.
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )}

                        <div className="space-y-1">
                          <FieldLabel>Landing page</FieldLabel>
                          <input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" placeholder="https://..." value={draft.landingPageUrl} onChange={(event) => patchDraft(item.id, { landingPageUrl: event.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <FieldLabel>{usesCampaignBudget ? "Campaign budget" : "Budget/day"}</FieldLabel>
                            <input
                              className="h-10 w-full rounded-lg border bg-background px-3 text-sm disabled:bg-muted/50 disabled:text-muted-foreground"
                              value={usesCampaignBudget ? campaignBudgetLabel(selectedCampaign) : draft.dailyBudget}
                              onChange={(event) => patchDraft(item.id, { dailyBudget: event.target.value })}
                              disabled={usesCampaignBudget}
                            />
                            {usesCampaignBudget ? (
                              <div className="text-xs font-medium leading-5 text-muted-foreground">
                                Campaign budget controls spend. Creative OS will not set an ad set budget for this CBO campaign.
                              </div>
                            ) : null}
                          </div>
                          <div className="space-y-1">
                            <FieldLabel>{usesCopiedTargeting ? "Country targeting (copied)" : "Country targeting"}</FieldLabel>
                            <input
                              className="h-10 w-full rounded-lg border bg-background px-3 text-sm disabled:bg-muted/50 disabled:text-muted-foreground"
                              value={usesCopiedTargeting ? "Copied from selected live ad set" : draft.markets}
                              placeholder="NL, BE, DE"
                              onChange={(event) => patchDraft(item.id, { markets: event.target.value })}
                              disabled={usesCopiedTargeting}
                            />
                            <div className="text-xs font-medium leading-5 text-muted-foreground">
                              {usesCopiedTargeting
                                ? "Country targeting, ages, audiences and placements come from that ad set."
                                : "Countries for default Meta targeting. Use country codes like NL, BE, DE."}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1 md:col-span-2">
                          <FieldLabel>Start time</FieldLabel>
                          <input
                            type="datetime-local"
                            className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                            value={draft.startTime}
                            onChange={(event) => patchDraft(item.id, { startTime: event.target.value })}
                            disabled={draft.adsetMode !== "new"}
                          />
                          <div className="text-xs font-medium leading-5 text-muted-foreground">
                            Start time is set on new ad sets; a future start time becomes scheduled in Meta. Existing ad sets keep their current Meta schedule.
                          </div>
                        </div>

                        {selectedBatchItems.length <= 1 || !usesPerAdCopy ? (
                          <>
                            <div className="space-y-1 md:col-span-2">
                              <FieldLabel>Meta ad name</FieldLabel>
                              <input
                                className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                                value={draft.adName}
                                onChange={(event) => patchDraft(item.id, { adName: event.target.value })}
                              />
                            </div>

                            <div className="space-y-1 md:col-span-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <FieldLabel>Primary text</FieldLabel>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => void fillLaunchCopy(item, context)}
                                  disabled={itemAiCopyStatus?.status === "loading"}
                                >
                                  <Sparkles size={14} />
                                  {itemAiCopyStatus?.status === "loading" ? "Writing..." : "AI fill copy"}
                                </Button>
                              </div>
                              <textarea className="min-h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={draft.primaryText} onChange={(event) => patchDraft(item.id, { primaryText: event.target.value })} />
                              {itemAiCopyStatus?.message ? (
                                <div className={`text-xs font-semibold ${itemAiCopyStatus.status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                                  {itemAiCopyStatus.message}
                                </div>
                              ) : null}
                            </div>
                            <div className="space-y-1">
                              <FieldLabel>Meta headline</FieldLabel>
                              <input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={draft.headline} onChange={(event) => patchDraft(item.id, { headline: event.target.value })} />
                            </div>
                          </>
                        ) : (
                          <div className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary md:col-span-2">
                            Edit Meta ad names, primary text, and headlines per selected ad above, or switch to Same copy for all. CTA and Ads Manager setup stay shared for this batch.
                          </div>
                        )}
                        <div className="space-y-1">
                          <FieldLabel>CTA</FieldLabel>
                          <select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={draft.cta} onChange={(event) => patchDraft(item.id, { cta: event.target.value })}>
                            <option value="LEARN_MORE">Learn more</option>
                            <option value="SHOP_NOW">Shop now</option>
                            <option value="SIGN_UP">Sign up</option>
                            <option value="CONTACT_US">Contact us</option>
                          </select>
                        </div>
                      </div>

                      {itemLaunchStatus?.message ? (
                        <div className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${itemLaunchStatus.status === "error" ? "bg-destructive/10 text-destructive" : "bg-emerald-50 text-emerald-700"}`}>
                          {itemLaunchStatus.message}
                        </div>
                      ) : null}

                      <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-border/70 pt-3">
                        <Button
                          type="button"
                          size="sm"
                          className="min-w-44"
                          disabled={createIds.some((id) => launchStatus[id]?.status === "loading")}
                          onClick={() => void createInAdsManager(item, createIds)}
                        >
                          <UploadCloud size={15} />
                          {createIds.some((id) => launchStatus[id]?.status === "loading")
                            ? "Creating..."
                            : createIds.length > 1
                              ? `Launch from setup - Create ${createIds.length} selected ads`
                              : "Launch from setup"}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {context.previewUrl ? (
                      <Button type="button" variant="outline" size="sm" asChild>
                        <a href={context.previewUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} />Open ad</a>
                      </Button>
                    ) : null}
                    {item.metaLaunchUrl ? (
                      <Button type="button" variant="outline" size="sm" asChild>
                        <a href={item.metaLaunchUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} />Open in Ads Manager</a>
                      </Button>
                    ) : null}
                    {context.sourceUrls.length ? (
                      context.sourceUrls.map((url, index) => (
                        <Button key={`${item.id}-source-${url}`} type="button" variant="secondary" size="sm" asChild>
                          <a href={url} target="_blank" rel="noreferrer"><ExternalLink size={15} />Library file {context.sourceUrls.length > 1 ? index + 1 : ""}</a>
                        </Button>
                      ))
                    ) : context.primarySource?.assetUrl ? (
                      <Button type="button" variant="secondary" size="sm" asChild>
                        <a href={context.primarySource.assetUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} />Open Library file</a>
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 lg:w-44 lg:flex-col">
                  <Button type="button" size="sm" onClick={() => openLauncher(item, context)}>
                    <Send size={15} />
                    {setupOpen ? "Hide setup" : item.metaAdId ? "Create another" : "Create in Ads Manager"}
                  </Button>
                  {setupOpen ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={createIds.some((id) => launchStatus[id]?.status === "loading")}
                      onClick={() => void createInAdsManager(item, createIds)}
                    >
                      <UploadCloud size={15} />
                      {createIds.some((id) => launchStatus[id]?.status === "loading")
                        ? "Creating..."
                        : createIds.length > 1
                          ? `Create ${createIds.length} selected ads`
                          : "Create paused ad"}
                    </Button>
                  ) : null}
                  {item.status === "uploaded" ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => updateLaunchStatus(item.id, "live")}>
                      <CheckCircle2 size={15} />
                      Mark live
                    </Button>
                  ) : item.status === "live" ? (
                    <Button type="button" variant="outline" size="sm" disabled>
                      <RadioTower size={15} />
                      Live
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => moveLaunchItemBackToReview(item.id)}
                  >
                    Move back to review
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => updateLaunchStatus(item.id, "archived")}>
                    <Archive size={15} />
                    Archive
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      />
    </div>
  );
}
