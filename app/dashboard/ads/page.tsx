"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Eye,
  FileText,
  FolderOpen,
  Gauge,
  Image as ImageIcon,
  Layers3,
  Link2,
  MoreHorizontal,
  Package,
  Pencil,
  Play,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Upload,
  Users,
  Wand2,
  X,
} from "lucide-react";
import AppSettingsPanel from "@/components/AppSettingsPanel";
import AutomationWorkspaceLayout, {
  type AutomationNavItem,
} from "@/components/AutomationWorkspaceLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchSession, getSession, type Session } from "@/lib/session";
import { useDismissableLayer } from "@/hooks/useDismissableLayer";

import {
  type Campaign,
  type MetaAdPerformance,
  type DbRow,
  type CreativeLibraryAsset,
  type ProductFolder,
  type PersonaSuggestion,
  type Overview,
  type StagedGeneratedCreative,
  type MetaStatus,
  type BillingPlan,
  type TopUpPack,
  type CreditAccount,
  type TemplateElement,
  type CreativeAssetForm,
  type MetaAdset,
  type PersonaBuildResult,
  type StrategistChatMessage,
  type SafeZonePreset,
  type TemplateElementType,
  type CampaignInsights,
  type StrategistResponse,
  type StrategistSuggestion,
  type ChatCreateResponse,
  resultTabs,
  countLabels,
  createFlowTabs,
  creativesTabs,
  postAdsTabs,
  createAdsMenuItems,
  tabs,
  hiddenTabData,
  MAX_ADS_PER_AD_SET,
  MAX_CREATIVES_PER_BATCH,
  TEMPLATE_FONT_FAMILIES,
  TEMPLATE_FONT_WEIGHTS,
  SAFE_ZONE_PRESETS,
  DEFAULT_TEMPLATE_ELEMENTS,
  STRATEGIST_WELCOME_MESSAGE,
  ContentLibrary,
  BATCH_PROGRESS_STEPS,
  PERSONA_READING_SOURCES,
} from "./types";

import {
  nomiText,
  readableTemplateTextColor,
  clientSlug,
  productMatchKeys,
  safePersonaRules,
  createChatSessionId,
  getAmsterdamDateKey,
  sanitizeChatText,
  safeStoredMessages,
  formatTemplateSummary,
  formatCurrency,
  parseDbJson,
  parseAssetTags,
  apiGet,
  apiPost,
  apiDelete,
} from "./utils";

import {
  Panel,
  LoadingState,
  EmptyState,
  Metric,
  MetricCard,
  Banner,
  InfoBlock,
  MiniList,
  Gate,
  InstagramGlyph,
} from "./components/CoreUI";

import {
  PlanSummary,
  formatLocalDateTime,
  formatFieldValue,
  BatchList,
  RowList,
  recommendationLabel,
  RecommendationList,
  SplitLists,
  PublishJobTracker,
} from "./components/ReviewComponents";

import AdsManagerTab from "./components/AdsManagerTab";
import RecommendationsTab from "./components/RecommendationsTab";
import MyCreativesTab from "./components/MyCreativesTab";
import CreativeLibraryTab from "./components/CreativeLibraryTab";
import PersonasTab from "./components/PersonasTab";
import GenerateTab from "./components/GenerateTab";
import ChatPostAdsTab from "./components/ChatPostAdsTab";
import TemplatesTab from "./components/TemplatesTab";
import ResultsTab from "./components/ResultsTab";
import { LogicAdsModals } from "./components/modals/LogicAdsModals";
import { LogicSubNav } from "./_components/LogicSubNav";
import { LogicWorkspaceToolbar } from "./_components/LogicWorkspaceToolbar";
import {
  buildLogicActionCards,
  groupLogicActionCards,
} from "./lib/logic-actions";
import { getCreativePreview, ratioClass } from "./lib/creative-preview";
const ALLOWED_LOGIC_ADS_TABS = new Set([
  "ads-manager",
  "chat",
  "recommendations",
  "create-ads",
  "generate",
  "creatives",
  "post-ads",
  "personas",
  "review",
  "copy-url",
  "adset-plan",
  "approval",
  "publish",
  "performance",
  "settings",
]);

function emptyCreativeAssetForm(
  product?: ProductFolder | null,
): CreativeAssetForm {
  return {
    name: "",
    type: "image",
    status: "ready",
    source_type: "url",
    asset_url: "",
    ratio: "4:5",
    product_id: product?.id || "",
    persona_id: "",
    tags: "",
    notes: "",
    copy_hint: "",
    landing_page_url: product?.url || "",
  };
}

function getPlanCreativeIds(plan?: DbRow) {
  const parsed = parseDbJson(plan?.plan_json);
  const ids = new Set<string>();
  const add = (value: unknown) => {
    const id = String(value || "").trim();
    if (id) ids.add(id);
  };
  if (Array.isArray(parsed?.adsets)) {
    for (const adset of parsed.adsets) {
      if (Array.isArray(adset?.ads)) {
        for (const ad of adset.ads) add(ad?.creative_id || ad?.creativeId);
      }
    }
  }
  if (Array.isArray(parsed?.ads)) {
    for (const ad of parsed.ads) add(ad?.creative_id || ad?.creativeId);
  }
  return Array.from(ids);
}


export default function AiAdManagerPage() {
  const [session, setSession] = useState<Session | null>(() => getSession());
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [retryBusyId, setRetryBusyId] = useState<string | null>(null);
  const [imageGenerationLoading, setImageGenerationLoading] = useState(false);
  const [imageGenerationLoadingPreview, setImageGenerationLoadingPreview] =
    useState<{ aspectRatio: string; count: number; prompt: string } | null>(
      null,
    );
  const [stagedGeneratedCreatives, setStagedGeneratedCreatives] = useState<
    StagedGeneratedCreative[]
  >([]);
  const [stagedFeedback, setStagedFeedback] = useState("");
  const [openedGeneratedCreative, setOpenedGeneratedCreative] =
    useState<StagedGeneratedCreative | null>(null);
  const [savingStagedCreatives, setSavingStagedCreatives] = useState(false);
  const [batchProgressStep, setBatchProgressStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("ads-manager");
  const [showAssetManager, setShowAssetManager] = useState(false);
  const [selectedReviewBatchId, setSelectedReviewBatchId] =
    useState<string>("");
  const [latestCreatedBatch, setLatestCreatedBatch] = useState<{
    id: string;
    name: string;
    count: number;
  } | null>(null);
  const [reviewDraftPickerId, setReviewDraftPickerId] = useState<string>("");
  const [pendingDeleteReviewBatchId, setPendingDeleteReviewBatchId] = useState<
    string | null
  >(null);
  const [destinationUrl, setDestinationUrl] = useState("");
  const [metaStatus, setMetaStatus] = useState<MetaStatus | null>(null);
  const [campaignInsights, setCampaignInsights] =
    useState<CampaignInsights | null>(null);
  const [campaignInsightsLoading, setCampaignInsightsLoading] = useState(false);
  const [adPerformance, setAdPerformance] = useState<MetaAdPerformance[]>([]);
  const [dismissedLogicActionIds, setDismissedLogicActionIds] = useState<
    Set<string>
  >(() => new Set());
  const [showDismissedLogicActions, setShowDismissedLogicActions] =
    useState(false);
  const [contentLibrary, setContentLibrary] = useState<ContentLibrary | null>(
    null,
  );
  const [contentLibraryLoading, setContentLibraryLoading] = useState(true);
  const [creditAccount, setCreditAccount] = useState<CreditAccount | null>(
    null,
  );
  const [billingPlans, setBillingPlans] = useState<BillingPlan[]>([]);
  const [topUpPacks, setTopUpPacks] = useState<TopUpPack[]>([]);
  const [creditCosts, setCreditCosts] = useState<Record<string, number>>({});
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingBusy, setBillingBusy] = useState("");
  const [billingMessage, setBillingMessage] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [personaSelectedProductIds, setPersonaSelectedProductIds] = useState<
    string[]
  >([]);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState("");
  const [campaignMode, setCampaignMode] = useState<"existing" | "new">(
    "existing",
  );
  const [selectedCampaignId, setSelectedCampaignId] = useState("");

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newCampaignObjective, setNewCampaignObjective] =
    useState("OUTCOME_SALES");
  const [newCampaignBudget, setNewCampaignBudget] = useState("20");
  const [newCampaignBudgetMode, setNewCampaignBudgetMode] = useState<
    "campaign" | "adset"
  >("campaign");
  const [newCampaignBudgetType, setNewCampaignBudgetType] = useState<
    "daily" | "lifetime"
  >("daily");
  const [newCampaignBidStrategy, setNewCampaignBidStrategy] = useState(
    "LOWEST_COST_WITHOUT_CAP",
  );
  const [newCampaignBidAmount, setNewCampaignBidAmount] = useState("");
  const [newCampaignSpendLimit, setNewCampaignSpendLimit] = useState("");
  const [newCampaignStartDate, setNewCampaignStartDate] = useState("");
  const [newCampaignEndDate, setNewCampaignEndDate] = useState("");
  const [newCampaignAbTest, setNewCampaignAbTest] = useState(false);
  const [newCampaignStatus, setNewCampaignStatus] = useState("PAUSED");
  const [newCampaignSpecialAdCategory, setNewCampaignSpecialAdCategory] =
    useState("NONE");
  const [newCampaignAttribution, setNewCampaignAttribution] =
    useState("7d_click_1d_view");
  const [newCampaignOptimizationGoal, setNewCampaignOptimizationGoal] =
    useState("OFFSITE_CONVERSIONS");
  const [newCampaignBuyingType, setNewCampaignBuyingType] = useState("AUCTION");
  const [newCampaignMarkets, setNewCampaignMarkets] = useState("Netherlands");
  const [selectedPersonaId, setSelectedPersonaId] = useState("");
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>([]);
  const [expandedBuiltPersonaId, setExpandedBuiltPersonaId] = useState<
    string | null
  >(null);
  const [expandedGalleryPersonaId, setExpandedGalleryPersonaId] = useState<
    string | null
  >(null);
  const [pendingDeletePersonaId, setPendingDeletePersonaId] = useState<
    string | null
  >(null);
  const [deletingPersonaId, setDeletingPersonaId] = useState<string | null>(
    null,
  );
  const [personaDeleteError, setPersonaDeleteError] = useState<string | null>(
    null,
  );
  const [pendingDeleteCreativeId, setPendingDeleteCreativeId] = useState<
    string | null
  >(null);
  const [deletingCreativeId, setDeletingCreativeId] = useState<string | null>(
    null,
  );
  const [creativeDeleteError, setCreativeDeleteError] = useState<string | null>(
    null,
  );
  const [creativeSelectMode, setCreativeSelectMode] = useState(false);
  const [selectedCreativeIds, setSelectedCreativeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [pendingBulkDeleteCreatives, setPendingBulkDeleteCreatives] =
    useState(false);
  const [bulkDeletingCreatives, setBulkDeletingCreatives] = useState(false);
  const [bulkCreativeDeleteError, setBulkCreativeDeleteError] = useState<
    string | null
  >(null);
  const [openedCreative, setOpenedCreative] = useState<DbRow | null>(null);
  const [personaProductMode, setPersonaProductMode] = useState<
    "catalog" | "custom"
  >("catalog");
  const [personaProductInput, setPersonaProductInput] = useState("");
  const [personaProductDescription, setPersonaProductDescription] =
    useState("");
  const [personaCount, setPersonaCount] = useState(4);
  const [personaBuildLoading, setPersonaBuildLoading] = useState(false);
  const [personaReadingIndex, setPersonaReadingIndex] = useState(0);
  const [personaReadingText, setPersonaReadingText] = useState("");
  const [personaReadingLabel, setPersonaReadingLabel] = useState("Reading");
  const [personaBuildError, setPersonaBuildError] = useState<string | null>(
    null,
  );
  const [personaBuildResult, setPersonaBuildResult] =
    useState<PersonaBuildResult | null>(null);
  const [savedBuiltPersonaIds, setSavedBuiltPersonaIds] = useState<string[]>(
    [],
  );
  const [savingBuiltPersonaId, setSavingBuiltPersonaId] = useState<
    string | null
  >(null);
  const [draftGoal, setDraftGoal] = useState("New Meta creative test");
  const [imageGenerationPrompt, setImageGenerationPrompt] = useState("");
  const [imageGenerationModel, setImageGenerationModel] = useState<
    "nano-banana" | "chatgpt-image"
  >("chatgpt-image");
  const [imageGenerationReferenceSource, setImageGenerationReferenceSource] =
    useState<"product" | "upload">("product");
  const [imageGenerationReferenceName, setImageGenerationReferenceName] =
    useState("");
  const [imageGenerationReferenceDataUrl, setImageGenerationReferenceDataUrl] =
    useState("");
  const [contentSource, setContentSource] = useState<
    "review_later" | "library" | "drive" | "ai"
  >("review_later");
  const [creativeMediaTypes, setCreativeMediaTypes] = useState<
    ("photo" | "video")[]
  >(["photo", "video"]);
  const [creativeAspectRatio, setCreativeAspectRatio] = useState("4:5");
  const [assetSearchQuery, setAssetSearchQuery] = useState("");
  const [assetProductFilter, setAssetProductFilter] = useState("all");
  const [assetPersonaFilter, setAssetPersonaFilter] = useState("all");
  const [assetTypeFilter, setAssetTypeFilter] = useState<
    "all" | "image" | "video"
  >("all");
  const [assetRatioFilter, setAssetRatioFilter] = useState("all");
  const [assetStatusFilter, setAssetStatusFilter] = useState<
    "ready" | "needs_review" | "archived"
  >("ready");
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [pendingArchiveAssetId, setPendingArchiveAssetId] = useState<
    string | null
  >(null);
  const [selectedAssetIdsByPersona, setSelectedAssetIdsByPersona] = useState<
    Record<string, string[]>
  >({});
  const [assetForm, setAssetForm] = useState<CreativeAssetForm>(() =>
    emptyCreativeAssetForm(),
  );
  const [templateSafeZonesEnabled, setTemplateSafeZonesEnabled] =
    useState(false);
  const [templateSafeZoneId, setTemplateSafeZoneId] = useState("feed_4x5");
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [templateName, setTemplateName] = useState("Clean product spotlight");
  const [templateHeadline, setTemplateHeadline] = useState(
    "Short benefit headline",
  );
  const [templateStyle, setTemplateStyle] = useState("Premium clean");
  const [templateAccent, setTemplateAccent] = useState("#2563eb");
  const [templateElements, setTemplateElements] = useState<TemplateElement[]>(
    DEFAULT_TEMPLATE_ELEMENTS,
  );
  const [selectedTemplateElementId, setSelectedTemplateElementId] =
    useState("headline");
  const [templateGuides, setTemplateGuides] = useState({
    vertical: false,
    horizontal: false,
  });
  const [creativeCount, setCreativeCount] = useState(1);
  const [adsPerAdSet, setAdsPerAdSet] = useState(3);
  const [campaignDays, setCampaignDays] = useState(30);
  const [existingAdsets, setExistingAdsets] = useState<MetaAdset[]>([]);
  const [adsetsLoading, setAdsetsLoading] = useState(false);
  const [adsetsError, setAdsetsError] = useState("");
  const [targetingMode, setTargetingMode] = useState<"custom" | "copy">(
    "custom",
  );
  const [customTargetCountries, setCustomTargetCountries] = useState("NL");
  const [customTargetAgeMin, setCustomTargetAgeMin] = useState(18);
  const [customTargetAgeMax, setCustomTargetAgeMax] = useState(65);
  const [customTargetGender, setCustomTargetGender] = useState<
    "all" | "women" | "men"
  >("all");
  const [selectedTemplateAdsetId, setSelectedTemplateAdsetId] = useState("");
  const [driveLinkDrafts, setDriveLinkDrafts] = useState<
    Record<string, { photoUrl: string; videoUrl: string }>
  >({});
  const [savingDriveLink, setSavingDriveLink] = useState<string | null>(null);
  const [expandedDriveLinkProductId, setExpandedDriveLinkProductId] =
    useState("");
  const [driveRootUrlDraft, setDriveRootUrlDraft] = useState("");
  const [savingDriveRoot, setSavingDriveRoot] = useState(false);
  const [driveRootStatus, setDriveRootStatus] = useState<{
    tone: "info" | "success" | "error";
    text: string;
  } | null>(null);
  const [strategistPrompt, setStrategistPrompt] = useState("");
  const [strategistLoading, setStrategistLoading] = useState(false);
  const [strategistCreating, setStrategistCreating] = useState(false);
  const [strategistError, setStrategistError] = useState<string | null>(null);
  const [strategistResult, setStrategistResult] =
    useState<StrategistResponse | null>(null);
  const [stickyStrategistCampaign, setStickyStrategistCampaign] =
    useState<Campaign | null>(null);
  const [strategistMessages, setStrategistMessages] = useState<
    StrategistChatMessage[]
  >([STRATEGIST_WELCOME_MESSAGE]);
  const [chatStorageReady, setChatStorageReady] = useState(false);
  const [strategistSessionId, setStrategistSessionId] = useState("");
  const strategistListRef = useRef<HTMLDivElement | null>(null);
  const strategistScrollTargetRef = useRef<HTMLDivElement | null>(null);
  const templateCanvasRef = useRef<HTMLDivElement | null>(null);
  const templateDragRef = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    elementX: number;
    elementY: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    fetchSession().then((fresh) => {
      if (fresh) setSession(fresh);
    });
  }, []);

  useEffect(() => {
    if (busy !== "batch") {
      setBatchProgressStep(0);
      return;
    }
    const timer = window.setInterval(() => {
      setBatchProgressStep(
        (current) => (current + 1) % BATCH_PROGRESS_STEPS.length,
      );
    }, 1200);
    return () => window.clearInterval(timer);
  }, [busy]);

  const skipAssetManagerResetRef = useRef(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedTab = params.get("tab");
    const openAssets = params.get("assets") === "1";
    const tabAliases: Record<string, string> = {
      build: "generate",
      "create-ads": "generate",
      creatives: "creatives",
      copy: "copy-url",
      plan: "adset-plan",
      approve: "approval",
      loop: "performance",
      templates: "chat",
      "creative-library": "generate",
      "ad-library": "creatives",
      brands: "creatives",
      "saved-inspirations": "creatives",
    };
    const resolvedTab = requestedTab
      ? tabAliases[requestedTab] || requestedTab
      : "";
    if (resolvedTab && ALLOWED_LOGIC_ADS_TABS.has(resolvedTab)) {
      setActiveTab(resolvedTab);
      if (openAssets || requestedTab === "creative-library") {
        setShowAssetManager(true);
      }
      return;
    }
    if (requestedTab) {
      setActiveTab("creatives");
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("tab", "creatives");
      nextUrl.searchParams.delete("assets");
      window.history.replaceState({}, "", nextUrl.toString());
    }
  }, []);

  useEffect(() => {
    if (skipAssetManagerResetRef.current) {
      skipAssetManagerResetRef.current = false;
      return;
    }
    if (activeTab !== "generate") setShowAssetManager(false);
  }, [activeTab]);

  const tenantId = session?.tenantId || session?.email || "";

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  useEffect(() => {
    if (!personaBuildLoading) {
      setPersonaReadingText("");
      setPersonaReadingIndex(0);
      setPersonaReadingLabel("Reading");
      return;
    }
    let sourceIndex = 0;
    let charIndex = 0;
    let pauseTicks = 0;
    let buildingTicks = 0;
    const tick = window.setInterval(() => {
      const source = PERSONA_READING_SOURCES[sourceIndex];
      setPersonaReadingIndex(sourceIndex);
      if (charIndex <= source.length) {
        setPersonaReadingLabel("Reading");
        setPersonaReadingText(source.slice(0, charIndex));
        charIndex += 1;
        return;
      }
      pauseTicks += 1;
      if (sourceIndex < PERSONA_READING_SOURCES.length - 1) {
        if (pauseTicks > 14) {
          sourceIndex += 1;
          charIndex = 0;
          pauseTicks = 0;
        }
        return;
      }
      if (pauseTicks <= 14) return;
      buildingTicks += 1;
      setPersonaReadingLabel("Building");
      setPersonaReadingText(`personas${".".repeat(buildingTicks % 4)}`);
    }, 90);
    return () => window.clearInterval(tick);
  }, [personaBuildLoading]);

  useEffect(() => {
    if (!tenantId) return;
    const sessionKey = `logic_ads_chat_session:${tenantId}`;
    const messagesKey = `logic_ads_chat_messages:${tenantId}`;
    const existingSessionId =
      localStorage.getItem(sessionKey) || createChatSessionId(tenantId);
    localStorage.setItem(sessionKey, existingSessionId);
    setStrategistSessionId(existingSessionId);
    const storedMessages = safeStoredMessages(
      localStorage.getItem(messagesKey),
    );
    if (storedMessages) setStrategistMessages(storedMessages);
    setChatStorageReady(true);
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId || !chatStorageReady) return;
    const messagesKey = `logic_ads_chat_messages:${tenantId}`;
    localStorage.setItem(
      messagesKey,
      JSON.stringify(strategistMessages.slice(-80)),
    );
  }, [chatStorageReady, strategistMessages, tenantId]);

  const loadOverview = useCallback(
    async (options: { showLoading?: boolean } = {}) => {
      if (!tenantId) return;
      const showLoading = options.showLoading !== false;
      if (showLoading) setLoading(true);
      try {
        const data = await apiGet<Overview>(
          `/api/ad-manager/overview?tenant_id=${encodeURIComponent(tenantId)}`,
        );
        setOverview(data);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load Logic Ads",
        );
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [tenantId],
  );

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const handleRetryPublish = useCallback(
    async (jobId: string) => {
      setRetryBusyId(jobId);
      try {
        const result = await apiPost<{
          created: boolean;
          error?: string;
          message?: string;
        }>("/api/ad-manager/publish-jobs", {
          tenant_id: tenantId,
          retry_job_id: jobId,
        });
        if (result.created) {
          setNotice(
            result.message ||
              "Publishing retry queued. Watch Publish status for per-ad results.",
          );
          void loadOverview({ showLoading: false });
        } else {
          setError(result.error || "Publishing retry failed.");
        }
      } catch (err: any) {
        console.error(err);
        setError(
          err instanceof Error ? err.message : "Failed to retry publishing",
        );
      } finally {
        setRetryBusyId(null);
      }
    },
    [tenantId, loadOverview],
  );

  // Poll overview when publishing is active
  useEffect(() => {
    const activeJobs = overview?.latestPublishJobs || [];
    const hasActivePublishing = activeJobs.some(
      (job: any) =>
        job.status === "publishing" ||
        job.status === "ready" ||
        (Array.isArray(job.items) &&
          job.items.some(
            (item: any) =>
              item.status === "publishing" || item.status === "queued",
          )),
    );

    if (!hasActivePublishing) return;

    const interval = window.setInterval(() => {
      void loadOverview({ showLoading: false });
    }, 4000);

    return () => window.clearInterval(interval);
  }, [overview?.latestPublishJobs, loadOverview]);

  const loadBilling = useCallback(async () => {
    if (!tenantId) return;
    setBillingLoading(true);
    try {
      const res = await fetch(
        `/api/billing/credits?tenant_id=${encodeURIComponent(tenantId)}`,
        { cache: "no-store" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.error || "Could not load Logic Ads Nomi's");
      setCreditAccount(data.account || null);
      setBillingPlans(Array.isArray(data.plans) ? data.plans : []);
      setTopUpPacks(Array.isArray(data.topUps) ? data.topUps : []);
      setCreditCosts(data.costs || {});
      setBillingMessage("");
    } catch (err) {
      setBillingMessage(
        err instanceof Error
          ? nomiText(err.message)
          : "Could not load Logic Ads Nomi's",
      );
    } finally {
      setBillingLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadBilling();
  }, [loadBilling]);

  useEffect(() => {
    if (!billingMessage) return;
    const timer = window.setTimeout(() => setBillingMessage(""), 5000);
    return () => window.clearTimeout(timer);
  }, [billingMessage]);

  const postBillingAction = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!tenantId) return;
      setBillingBusy(
        String(
          payload.plan_id || payload.pack_id || payload.action || "billing",
        ),
      );
      setBillingMessage("");
      try {
        const res = await fetch("/api/billing/credits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenant_id: tenantId, ...payload }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(data.error || "Could not update Logic Ads Nomi's");
        setCreditAccount(data.account || null);
        setBillingPlans(Array.isArray(data.plans) ? data.plans : billingPlans);
        setTopUpPacks(Array.isArray(data.topUps) ? data.topUps : topUpPacks);
        setCreditCosts(data.costs || creditCosts);
        if (payload.action === "top_up" && data.top_up?.credits) {
          setBillingMessage(
            `${data.top_up.credits} Nomi's added instantly. Payment connection comes later.`,
          );
        } else {
          setBillingMessage("Logic Ads Nomi's updated.");
        }
      } catch (err) {
        setBillingMessage(
          err instanceof Error
            ? nomiText(err.message)
            : "Could not update Logic Ads Nomi's",
        );
      } finally {
        setBillingBusy("");
      }
    },
    [billingPlans, creditCosts, tenantId, topUpPacks],
  );


  useEffect(() => {
    if (!tenantId) return;
    fetch(`/api/auth/meta/status?tenant_id=${encodeURIComponent(tenantId)}`, {
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : { connected: false }))
      .then(setMetaStatus)
      .catch(() => setMetaStatus({ connected: false }));

    setContentLibraryLoading(true);
    fetch(
      `/api/ads/content-library?tenant_id=${encodeURIComponent(tenantId)}`,
      { cache: "no-store" },
    )
      .then((res) =>
        res.ok
          ? res.json()
          : {
              totals: {
                new: { total: 0, images: 0, videos: 0 },
                used: { total: 0, images: 0, videos: 0 },
              },
              folders: [],
            },
      )
      .then(setContentLibrary)
      .catch(() =>
        setContentLibrary({
          totals: {
            new: { total: 0, images: 0, videos: 0 },
            used: { total: 0, images: 0, videos: 0 },
          },
          folders: [],
        }),
      )
      .finally(() => setContentLibraryLoading(false));
  }, [tenantId]);

  useEffect(() => {
    if (!contentLibrary?.folders?.length) return;
    setDriveLinkDrafts((current) => {
      const next = { ...current };
      for (const folder of contentLibrary.folders) {
        const savedPhotoUrl = folder.drive?.photoFolderUrl?.includes(
          "drive.google.com",
        )
          ? ""
          : folder.drive?.photoFolderUrl || "";
        const savedVideoUrl = folder.drive?.videoFolderUrl?.includes(
          "drive.google.com",
        )
          ? ""
          : folder.drive?.videoFolderUrl || "";
        const existing = next[folder.id];
        if (!existing || savedPhotoUrl || savedVideoUrl) {
          next[folder.id] = {
            photoUrl: savedPhotoUrl || existing?.photoUrl || "",
            videoUrl: savedVideoUrl || existing?.videoUrl || "",
          };
        }
      }
      return next;
    });
  }, [contentLibrary]);

  useEffect(() => {
    const rootUrl = contentLibrary?.sources?.google_drive?.root_url || "";
    setDriveRootUrlDraft(
      (current) =>
        current || (rootUrl.includes("drive.google.com") ? "" : rootUrl),
    );
  }, [contentLibrary?.sources?.google_drive?.root_url]);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    setAdsetsLoading(true);
    setAdsetsError("");
    const campaignQuery = selectedCampaignId
      ? `&campaign_id=${encodeURIComponent(selectedCampaignId)}`
      : "";
    fetch(
      `/api/ads/adsets?tenant_id=${encodeURIComponent(tenantId)}${campaignQuery}`,
      { cache: "no-store" },
    )
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(data.error || "Could not load Meta ad sets");
        return data;
      })
      .then((data) => {
        if (!cancelled) {
          setExistingAdsets(Array.isArray(data.adsets) ? data.adsets : []);
          setAdsetsError(typeof data.warning === "string" ? data.warning : "");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setExistingAdsets([]);
          setAdsetsError(
            err instanceof Error ? err.message : "Could not load Meta ad sets",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setAdsetsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId, selectedCampaignId]);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    setCampaignInsightsLoading(true);
    Promise.all([
      fetch(
        `/api/ads/campaign-insights?tenant_id=${encodeURIComponent(tenantId)}&days=${campaignDays}`,
        { cache: "no-store" },
      )
        .then((res) =>
          res.ok
            ? res.json()
            : {
                campaigns: [],
                totalSpend: 0,
                totalImpressions: 0,
                totalPurchases: 0,
              },
        )
        .catch(() => ({
          campaigns: [],
          totalSpend: 0,
          totalImpressions: 0,
          totalPurchases: 0,
        })),
      fetch(
        `/api/ads/ad-performance?tenant_id=${encodeURIComponent(tenantId)}&days=${campaignDays}`,
        { cache: "no-store" },
      )
        .then((res) => (res.ok ? res.json() : { ads: [] }))
        .catch(() => ({ ads: [] })),
    ])
      .then(([campaignData, adData]) => {
        if (!cancelled) {
          setCampaignInsights(campaignData);
          setAdPerformance(Array.isArray(adData.ads) ? adData.ads : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCampaignInsights({
            campaigns: [],
            totalSpend: 0,
            totalImpressions: 0,
            totalPurchases: 0,
          });
          setAdPerformance([]);
        }
      })
      .finally(() => {
        if (!cancelled) setCampaignInsightsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId, campaignDays]);

  const activeTabData = useMemo(() => {
    if (creativesTabs.includes(activeTab))
      return tabs.find((tab) => tab.id === "creatives") || tabs[0];
    if (createFlowTabs.includes(activeTab))
      return tabs.find((tab) => tab.id === "create-ads") || tabs[0];
    return (
      tabs.find((tab) => tab.id === activeTab) ||
      hiddenTabData.find((tab) => tab.id === activeTab) ||
      tabs[0]
    );
  }, [activeTab]);
  const firstCreative = overview?.latestCreatives[0];
  const reviewCreatives = useMemo(() => {
    const creatives = overview?.latestCreatives || [];
    if (!selectedReviewBatchId) return creatives;
    return creatives.filter(
      (creative) => String(creative.batch_id || "") === selectedReviewBatchId,
    );
  }, [overview?.latestCreatives, selectedReviewBatchId]);
  const selectedReviewBatch = useMemo(() => {
    if (!selectedReviewBatchId) return null;
    return (
      (overview?.latestBatches || []).find(
        (batch) => String(batch.id) === selectedReviewBatchId,
      ) || null
    );
  }, [overview?.latestBatches, selectedReviewBatchId]);
  const reviewDraftOptions = overview?.latestBatches || [];
  const reviewDraftPickerBatch =
    reviewDraftOptions.find(
      (batch) => String(batch.id) === reviewDraftPickerId,
    ) || null;
  const firstPlan = overview?.draftPlans[0];
  const planCreativeIds = useMemo(
    () => getPlanCreativeIds(firstPlan),
    [firstPlan],
  );
  const planCreatives = useMemo(() => {
    if (!planCreativeIds.length) return overview?.latestCreatives || [];
    const wanted = new Set(planCreativeIds);
    return (overview?.latestCreatives || []).filter((creative) =>
      wanted.has(String(creative.id)),
    );
  }, [overview?.latestCreatives, planCreativeIds]);
  const publishBlockers = overview?.publishGate?.blockers || [];
  const copyDestinationBlockers = publishBlockers.filter((blocker) =>
    /selected copy|destination url/i.test(blocker),
  );
  const planApprovalBlocked = copyDestinationBlockers.length > 0;
  const activeCampaigns = (campaignInsights?.campaigns || []).filter(
    (campaign) =>
      (campaign.effective_status || campaign.status || "").toUpperCase() ===
      "ACTIVE",
  );
  const allCatalogItems = contentLibrary?.folders || [];
  const autoMatchedDriveFolders = allCatalogItems.filter(
    (folder) => folder.source === "google_drive",
  );
  const autoMatchedDriveIssues = autoMatchedDriveFolders
    .map((folder) => ({ folder, issues: getDriveLinkIssues(folder) }))
    .filter((item) => item.issues.length > 0);
  const productCatalogItems = allCatalogItems.filter(
    (folder) =>
      folder.type !== "collection" && folder.source !== "google_drive",
  );
  const catalogSearchTerm = catalogSearchQuery.trim().toLowerCase();
  const catalogSearchTokens = catalogSearchTerm
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const visibleCatalogItems = productCatalogItems.filter((item) => {
    if (!catalogSearchTokens.length) return true;

    const rawUrl = item.url || "";
    const urlSlug =
      rawUrl.split("?")[0].split("#")[0].split("/").filter(Boolean).pop() || "";

    const haystack = `${item.name || ""} ${urlSlug}`.toLowerCase();
    return catalogSearchTokens.every((token) => haystack.includes(token));
  });
  const contentLinkItems = visibleCatalogItems;
  const linkedDriveProductCount = productCatalogItems.filter(
    (item) =>
      item.drive?.available ||
      item.drive?.manual ||
      item.drive?.photoFolderUrl ||
      item.drive?.videoFolderUrl,
  ).length;
  const missingDriveProductCount = Math.max(
    productCatalogItems.length - linkedDriveProductCount,
    0,
  );
  const visibleContentLinkItems = contentLinkItems.slice(0, 12);
  const hiddenContentLinkItemCount = Math.max(
    contentLinkItems.length - visibleContentLinkItems.length,
    0,
  );
  const selectedProducts = productCatalogItems.filter((folder) =>
    selectedProductIds.includes(folder.id),
  );
  const selectedCatalogItems = selectedProducts;
  const selectedProduct = selectedCatalogItems[0];
  const personaSelectedProducts = productCatalogItems.filter((folder) =>
    personaSelectedProductIds.includes(folder.id),
  );
  const personaSelectedCatalogItems = personaSelectedProducts;
  const selectedCatalogLabel =
    selectedProducts.length === 1
      ? selectedProducts[0].name
      : `${selectedProducts.length} products selected`;
  const selectedCatalogCount = selectedProducts.length;
  const imageGenerationReferenceItems = selectedCatalogItems.length
    ? selectedCatalogItems
    : imageGenerationReferenceSource === "product"
      ? productCatalogItems.slice(0, 8)
      : [];
  const imageGenerationReferenceLabel = selectedCatalogItems.length
    ? selectedCatalogLabel
    : "Product data";
  const imageGenerationCount = Math.min(
    5,
    Math.max(1, Number(creativeCount) || 1),
  );
  const imageGenerationNomiCostPerImage = Math.max(
    1,
    Number(creditCosts.ai_creative) || 8,
  );
  const imageGenerationNomiCostTotal =
    imageGenerationCount * imageGenerationNomiCostPerImage;
  const nomiBalance = Math.max(0, Number(creditAccount?.balance) || 0);
  const imageGenerationNeedsMoreNomi =
    Boolean(creditAccount) && nomiBalance < imageGenerationNomiCostTotal;
  const logicChatNomiCost = Math.max(1, Number(creditCosts.logic_chat) || 3);
  const logicChatUsesNomi = creditAccount?.plan === "launch";
  const logicChatNeedsMoreNomi = Boolean(
    logicChatUsesNomi && creditAccount && nomiBalance < logicChatNomiCost,
  );
  const personaBuildNomiCost = Math.max(
    1,
    Number(creditCosts.ai_personas) || 2,
  );
  const personaBuildNeedsMoreNomi = Boolean(
    creditAccount && nomiBalance < personaBuildNomiCost,
  );
  const driveScanNomiCost = Math.max(1, Number(creditCosts.drive_scan) || 2);
  const driveScanNeedsMoreNomi = Boolean(
    creditAccount && nomiBalance < driveScanNomiCost,
  );
  const selectedCampaign =
    campaignMode === "existing"
      ? campaignInsights?.campaigns.find(
          (campaign) => String(campaign.id) === String(selectedCampaignId),
        )
      : undefined;
  const selectedTemplateAdset = existingAdsets.find(
    (adset) => adset.id === selectedTemplateAdsetId,
  );
  const customTargetingJson = useMemo(() => {
    const countries = customTargetCountries
      .split(",")
      .map((country) => country.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 25);
    const ageMin = Math.max(13, Math.min(65, Number(customTargetAgeMin) || 18));
    const ageMax = Math.max(
      ageMin,
      Math.min(65, Number(customTargetAgeMax) || 65),
    );
    const targeting: Record<string, unknown> = {
      geo_locations: { countries: countries.length ? countries : ["NL"] },
      age_min: ageMin,
      age_max: ageMax,
    };
    if (customTargetGender === "women") targeting.genders = [2];
    if (customTargetGender === "men") targeting.genders = [1];
    return targeting;
  }, [
    customTargetAgeMax,
    customTargetAgeMin,
    customTargetCountries,
    customTargetGender,
  ]);
  const selectedTargetingJson =
    targetingMode === "copy" && selectedTemplateAdset?.targeting
      ? selectedTemplateAdset.targeting
      : customTargetingJson;
  const selectedCampaignContext =
    campaignMode === "existing" && selectedCampaignId
      ? selectedCampaign || {
          id: selectedCampaignId,
          name: selectedCampaignId,
          status: "selected",
          objective: undefined,
          spend: 0,
          impressions: 0,
          clicks: 0,
          purchases: 0,
          purchaseValue: 0,
          roas: 0,
        }
      : undefined;
  const activeStrategistCampaignContext =
    selectedCampaignContext || stickyStrategistCampaign || undefined;
  const campaignContextLabel =
    campaignMode === "existing"
      ? activeStrategistCampaignContext?.name || ""
      : newCampaignName.trim() || "New campaign draft";
  const hasCampaignContext =
    campaignMode === "existing"
      ? Boolean(selectedCampaignId || activeStrategistCampaignContext)
      : Boolean(newCampaignName.trim());
  const newCampaignDraft = useMemo(
    () => ({
      name: newCampaignName.trim(),
      objective: newCampaignObjective,
      buying_type: newCampaignBuyingType,
      budget_mode: newCampaignBudgetMode,
      budget_type: newCampaignBudgetType,
      budget_amount: newCampaignBudget,
      daily_budget: newCampaignBudgetType === "daily" ? newCampaignBudget : "",
      lifetime_budget:
        newCampaignBudgetType === "lifetime" ? newCampaignBudget : "",
      bid_strategy: newCampaignBidStrategy,
      bid_amount: newCampaignBidAmount,
      campaign_spend_limit: newCampaignSpendLimit,
      start_time: newCampaignStartDate,
      end_time: newCampaignEndDate,
      ab_test: newCampaignAbTest,
      status: newCampaignStatus,
      special_ad_category: newCampaignSpecialAdCategory,
      special_ad_categories:
        newCampaignSpecialAdCategory === "NONE"
          ? []
          : [newCampaignSpecialAdCategory],
      attribution_setting: newCampaignAttribution,
      optimization_goal: newCampaignOptimizationGoal,
      markets: newCampaignMarkets,
    }),
    [
      newCampaignAbTest,
      newCampaignAttribution,
      newCampaignBidAmount,
      newCampaignBidStrategy,
      newCampaignBudget,
      newCampaignBudgetMode,
      newCampaignBudgetType,
      newCampaignBuyingType,
      newCampaignEndDate,
      newCampaignMarkets,
      newCampaignObjective,
      newCampaignOptimizationGoal,
      newCampaignSpecialAdCategory,
      newCampaignSpendLimit,
      newCampaignStartDate,
      newCampaignStatus,
      newCampaignName,
    ],
  );
  const hasLinkedDriveContent = (item: ProductFolder) =>
    Boolean(
      item.drive?.available ||
      item.drive?.total ||
      (item.source === "google_drive" && item.new?.total > 0),
    );
  const driveReadyItems = selectedCatalogItems.filter(hasLinkedDriveContent);
  const driveMissingItems = selectedCatalogItems.filter(
    (item) => !hasLinkedDriveContent(item),
  );
  const driveReadyForSelection =
    selectedCatalogItems.length > 0 &&
    driveReadyItems.length === selectedCatalogItems.length;
  const driveStatusText = !selectedCatalogItems.length
    ? "Select products or a collection first. The system will check whether source content is linked."
    : driveReadyForSelection
      ? `Product selection ready: ${driveReadyItems.length} selected item${driveReadyItems.length === 1 ? "" : "s"} linked with usable source photo/video content.`
      : `${driveMissingItems.length} selected ${driveMissingItems.length === 1 ? "item has" : "items have"} no linked source content: ${driveMissingItems
          .slice(0, 3)
          .map((item) => item.name)
          .join(
            ", ",
          )}${driveMissingItems.length > 3 ? ` +${driveMissingItems.length - 3} more` : ""}. Use AI generation or connect/match source folders.`;
  const googleDriveSource = contentLibrary?.sources?.google_drive;
  const googleDriveConnected = Boolean(googleDriveSource?.connected);
  const contentSourceLabel =
    contentSource === "review_later"
      ? "Add media in review"
      : contentSource === "library"
        ? "Use Creative Library"
        : contentSource === "drive"
          ? "Use Library content"
          : "Generate with AI";
  const hasBrandScrape =
    contentLibraryLoading ||
    contentLibrary === null ||
    Boolean(contentLibrary?.sources?.brand_scrape?.connected);
  const brandDataScanHref =
    "/dashboard/settings?tab=brand-data&action=scan#brand-data-scanner";
  const personaSuggestions = useMemo(
    () => buildPersonaSuggestions(selectedProduct, selectedCampaign),
    [selectedProduct, selectedCampaign],
  );
  const strategistPersonas = strategistResult?.personas?.length
    ? strategistResult.personas
    : [];
  const builtPersonaSuggestions = personaBuildResult?.personas?.length
    ? personaBuildResult.personas.map((persona) => ({
        id: persona.id,
        name: persona.name,
        basedOn: "Build personas research",
        angle: persona.angle,
        hook: persona.hook,
        overlay: persona.overlay,
        copy: persona.copy_direction,
        why: persona.why_it_fits,
        trigger: persona.trigger,
        objection: persona.objections.join(", "),
        proof_needed: persona.proof_needed.join(", "),
      }))
    : [];
  const selectedPersonaProductKeys =
    selectedCatalogItems.flatMap(productMatchKeys);
  const savedPersonaSuggestions = (overview?.latestPersonas || []).map(
    (row) => {
      const rules = safePersonaRules(row.targeting_rules);
      return {
        id: String(row.id),
        name: String(row.name || "Saved persona"),
        basedOn: String(rules.product_name || row.code || "Persona Gallery"),
        angle: String(row.angle || ""),
        hook: String(rules.trigger || row.angle || "Saved persona angle"),
        overlay: String(row.angle || ""),
        copy: "",
        why: "Saved angle for this product. Select it to create one buying-reason ad set.",
        trigger: String(rules.trigger || ""),
        objection: Array.isArray(rules.objections)
          ? rules.objections.join(", ")
          : String(rules.objections || ""),
        proof_needed: Array.isArray(rules.proof_needed)
          ? rules.proof_needed.join(", ")
          : String(rules.proof_needed || ""),
        productKeys: [
          rules.product_key,
          rules.product_id,
          rules.product_name,
          rules.product_url,
          ...(Array.isArray(rules.product_ids) ? rules.product_ids : []),
          ...(Array.isArray(rules.product_names) ? rules.product_names : []),
          ...(Array.isArray(rules.product_urls) ? rules.product_urls : []),
        ]
          .map(clientSlug)
          .filter(Boolean),
      };
    },
  );
  const productMatchedPersonaSuggestions = selectedPersonaProductKeys.length
    ? savedPersonaSuggestions.filter((persona) =>
        persona.productKeys.some((key) =>
          selectedPersonaProductKeys.includes(key),
        ),
      )
    : [];
  function personaCountForProduct(item: ProductFolder) {
    const keys = productMatchKeys(item);
    if (!keys.length) return 0;
    return savedPersonaSuggestions.filter((persona) =>
      persona.productKeys.some((key) => keys.includes(key)),
    ).length;
  }
  function connectedProductCountForPersona(row: DbRow) {
    const rules = safePersonaRules(row.targeting_rules);
    const ids = Array.isArray(rules.product_ids)
      ? rules.product_ids.map(clientSlug).filter(Boolean)
      : [];
    const names = Array.isArray(rules.product_names)
      ? rules.product_names.map(clientSlug).filter(Boolean)
      : [];
    const urls = Array.isArray(rules.product_urls)
      ? rules.product_urls.map(clientSlug).filter(Boolean)
      : [];
    const linkedCount = Math.max(
      new Set(ids).size,
      new Set(names).size,
      new Set(urls).size,
    );
    if (linkedCount) return linkedCount;
    return [rules.product_id, rules.product_name, rules.product_url].some(
      Boolean,
    )
      ? 1
      : 0;
  }
  function connectedProductLabelForPersona(row: DbRow) {
    const count = connectedProductCountForPersona(row);
    return `${count} product${count === 1 ? "" : "s"} connected`;
  }
  const displayedPersonaSuggestions = strategistPersonas.length
    ? strategistPersonas
    : activeTab === "post-ads"
      ? productMatchedPersonaSuggestions.length
        ? productMatchedPersonaSuggestions
        : savedPersonaSuggestions
      : builtPersonaSuggestions.length
        ? builtPersonaSuggestions
        : savedPersonaSuggestions.length
          ? savedPersonaSuggestions
          : personaSuggestions;
  const selectedPersonaIdsForUse = selectedPersonaIds
    .filter((id) =>
      displayedPersonaSuggestions.some((persona) => persona.id === id),
    )
    .slice(0, 4);
  const selectedPersona =
    displayedPersonaSuggestions.find(
      (persona) =>
        persona.id === (selectedPersonaIdsForUse[0] || selectedPersonaId),
    ) || displayedPersonaSuggestions[0];
  const effectiveSelectedPersonaIds = selectedPersonaIdsForUse.length
    ? selectedPersonaIdsForUse
    : selectedPersona?.id
      ? [selectedPersona.id]
      : [];
  const selectedPersonaPool = useMemo(() => {
    const chosen = effectiveSelectedPersonaIds
      .map((id) =>
        displayedPersonaSuggestions.find((persona) => persona.id === id),
      )
      .filter(Boolean) as StrategistSuggestion[];
    const fallback = selectedPersona ? [selectedPersona] : [];
    return (chosen.length ? chosen : fallback).slice(0, 4);
  }, [
    displayedPersonaSuggestions,
    selectedPersona,
    effectiveSelectedPersonaIds,
  ]);
  const savedTemplates = useMemo(
    () => (overview?.latestTemplates || []) as DbRow[],
    [overview],
  );
  const selectedTemplates: DbRow[] = [];
  const selectedTemplateLabel = "Coming soon";
  const creativeLibraryAssets = useMemo(
    () => (overview?.creativeLibraryAssets || []) as CreativeLibraryAsset[],
    [overview],
  );
  const activeCreativeLibraryAssets = creativeLibraryAssets.filter(
    (asset) => asset.status !== "archived",
  );
  const filteredCreativeLibraryAssets = useMemo(() => {
    const term = assetSearchQuery.trim().toLowerCase();
    return creativeLibraryAssets.filter((asset) => {
      if (assetStatusFilter !== asset.status) return false;
      if (assetTypeFilter !== "all" && asset.type !== assetTypeFilter)
        return false;
      if (assetRatioFilter !== "all" && asset.ratio !== assetRatioFilter)
        return false;
      if (
        assetProductFilter !== "all" &&
        String(asset.product_id || "") !== assetProductFilter
      )
        return false;
      if (
        assetPersonaFilter !== "all" &&
        String(asset.persona_id || "") !== assetPersonaFilter
      )
        return false;
      if (!term) return true;
      return [
        asset.name,
        asset.product_name || "",
        asset.persona_name || "",
        asset.notes || "",
        parseAssetTags(asset.tags).join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [
    assetPersonaFilter,
    assetProductFilter,
    assetRatioFilter,
    assetSearchQuery,
    assetStatusFilter,
    assetTypeFilter,
    creativeLibraryAssets,
  ]);
  const creativeMediaType = creativeMediaTypes[0] || "photo";
  const requestedCreativeFormats = creativeMediaTypes.map(
    (type) => `${type}_${creativeAspectRatio.replace(":", "x")}`,
  );
  const mediaFormatLabel = `${creativeMediaTypes.map((type) => (type === "video" ? "Video" : "Photo")).join(" + ")} ${creativeAspectRatio}`;
  const requestedCreativeFormat =
    requestedCreativeFormats[0] ||
    `photo_${creativeAspectRatio.replace(":", "x")}`;
  const adSetCount = selectedPersonaPool.length || creativeCount;
  const requestedCreativeCount = Math.max(adSetCount * adsPerAdSet, 1);
  const totalCreativeCount = Math.min(
    requestedCreativeCount,
    MAX_CREATIVES_PER_BATCH,
  );
  const libraryAssetsForPersona = useCallback(
    (persona: StrategistSuggestion) => {
      const personaId = String(persona.id || "");
      const selectedProductIdSet = new Set(selectedProductIds);
      const exact = activeCreativeLibraryAssets.filter((asset) => {
        const productMatches =
          !selectedProductIdSet.size ||
          !asset.product_id ||
          selectedProductIdSet.has(String(asset.product_id));
        return (
          productMatches &&
          String(asset.persona_id || "") === personaId &&
          asset.status === "ready"
        );
      });
      const productLevel = activeCreativeLibraryAssets.filter((asset) => {
        const productMatches =
          !selectedProductIdSet.size ||
          !asset.product_id ||
          selectedProductIdSet.has(String(asset.product_id));
        return productMatches && !asset.persona_id && asset.status === "ready";
      });
      return { exact, productLevel, all: [...exact, ...productLevel] };
    },
    [activeCreativeLibraryAssets, selectedProductIds],
  );
  const selectedLibraryAssetsByPersona = useMemo(() => {
    const next: Record<string, CreativeLibraryAsset[]> = {};
    for (const persona of selectedPersonaPool) {
      const personaId = String(persona.id || "");
      next[personaId] = (selectedAssetIdsByPersona[personaId] || [])
        .map((id) =>
          activeCreativeLibraryAssets.find((asset) => String(asset.id) === id),
        )
        .filter(Boolean) as CreativeLibraryAsset[];
    }
    return next;
  }, [
    activeCreativeLibraryAssets,
    selectedAssetIdsByPersona,
    selectedPersonaPool,
  ]);
  const selectedAssetRequirementWarnings = useMemo(() => {
    return selectedPersonaPool.flatMap((persona) => {
      const count =
        selectedLibraryAssetsByPersona[String(persona.id || "")]?.length || 0;
      if (count >= adsPerAdSet) return [];
      return [
        `${persona.name} needs ${adsPerAdSet - count} more creative${adsPerAdSet - count === 1 ? "" : "s"} or a lower ads per ad set value.`,
      ];
    });
  }, [adsPerAdSet, selectedLibraryAssetsByPersona, selectedPersonaPool]);
  const libraryBuildReady =
    contentSource === "library" &&
    selectedPersonaPool.length > 0 &&
    selectedAssetRequirementWarnings.length === 0;
  const activeSafeZone =
    SAFE_ZONE_PRESETS.find((zone) => zone.id === templateSafeZoneId) ||
    SAFE_ZONE_PRESETS.find((zone) => zone.ratio === creativeAspectRatio) ||
    SAFE_ZONE_PRESETS[0];
  const ratioValue = (ratio: string) => {
    const [width, height] = ratio.split(":").map(Number);
    return width && height ? width / height : 1;
  };
  const placementCropFor = (zone: SafeZonePreset, canvasFormat: string) => {
    const canvasRatio = ratioValue(canvasFormat);
    const placementRatio = ratioValue(zone.ratio);
    if (Math.abs(canvasRatio - placementRatio) < 0.001)
      return { top: 0, right: 0, bottom: 0, left: 0, width: 100, height: 100 };
    if (placementRatio > canvasRatio) {
      const height = (canvasRatio / placementRatio) * 100;
      const top = (100 - height) / 2;
      return {
        top,
        right: 0,
        bottom: 100 - top - height,
        left: 0,
        width: 100,
        height,
      };
    }
    const width = (placementRatio / canvasRatio) * 100;
    const left = (100 - width) / 2;
    return {
      top: 0,
      right: 100 - left - width,
      bottom: 0,
      left,
      width,
      height: 100,
    };
  };
  const safeAreaFor = (zone: SafeZonePreset, canvasFormat: string) => {
    const crop = placementCropFor(zone, canvasFormat);
    return {
      top: crop.top + (crop.height * zone.top) / 100,
      right: crop.right + (crop.width * zone.right) / 100,
      bottom: crop.bottom + (crop.height * zone.bottom) / 100,
      left: crop.left + (crop.width * zone.left) / 100,
    };
  };
  const activePlacementCrop = placementCropFor(
    activeSafeZone,
    creativeAspectRatio,
  );
  const activeSafeArea = safeAreaFor(activeSafeZone, creativeAspectRatio);
  const activeSafeZoneLabel =
    activeSafeZone.ratio === creativeAspectRatio
      ? activeSafeZone.source
      : `Showing the ${activeSafeZone.label} crop inside ${mediaFormatLabel}. Keep text inside blue.`;
  const templatePreviewRatioClass =
    creativeAspectRatio === "9:16"
      ? "aspect-9/16"
      : creativeAspectRatio === "1:1"
        ? "aspect-square"
        : creativeAspectRatio === "16:9"
          ? "aspect-video"
          : "aspect-4/5";
  const selectedTemplateElement =
    templateElements.find(
      (element) => element.id === selectedTemplateElementId,
    ) ||
    templateElements[0] ||
    null;
  const selectedProductMediaUrl = selectedProduct?.imageUrl || "";
  const selectedElementMediaUrl =
    selectedTemplateElement?.type === "media"
      ? selectedTemplateElement.src || selectedProductMediaUrl
      : "";
  const campaignDateLabel = getDateRangeLabel(campaignDays);
  const campaignSignal = useMemo(() => {
    if (!selectedCampaign)
      return campaignMode === "new"
        ? {
            summary: `New campaign draft: ${newCampaignObjective}, budget ${newCampaignBudget || "not set"}, markets ${newCampaignMarkets || "not set"}.`,
            metric: "New campaign draft",
          }
        : {
            summary: selectedCampaignId
              ? `Selected campaign id: ${selectedCampaignId}. Metrics are still loading or unavailable.`
              : "No campaign selected yet.",
            metric: selectedCampaignId
              ? "Selected campaign"
              : "No campaign selected",
          };
    const ctr =
      selectedCampaign.impressions > 0
        ? `${((selectedCampaign.clicks / selectedCampaign.impressions) * 100).toFixed(2)}% CTR`
        : "CTR unavailable";
    const cpa =
      selectedCampaign.purchases > 0
        ? `CPA ${formatCurrency(selectedCampaign.spend / selectedCampaign.purchases)}`
        : "CPA unavailable";
    const roas = Number.isFinite(selectedCampaign.roas)
      ? `ROAS ${selectedCampaign.roas.toFixed(2)}x`
      : "ROAS unavailable";
    const purchases = `${selectedCampaign.purchases || 0} purchases`;
    const spend = `Spend ${formatCurrency(selectedCampaign.spend || 0)}`;
    const metric =
      selectedCampaign.purchases > 0 ? `${roas}, ${cpa}` : `${ctr}, ${spend}`;
    return {
      summary: `${selectedCampaign.name}: ${selectedCampaign.status || "unknown status"}, ${selectedCampaign.objective || "objective unknown"}, ${spend}, ${purchases}, ${roas}, ${ctr}, ${cpa}.`,
      metric,
      ctr,
      cpa,
      roas,
      purchases,
      spend,
    };
  }, [
    campaignMode,
    newCampaignBudget,
    newCampaignMarkets,
    newCampaignObjective,
    selectedCampaign,
    selectedCampaignId,
  ]);
  const logicActionCards = useMemo(
    () =>
      buildLogicActionCards({
        campaigns: campaignInsights?.campaigns || [],
        ads: adPerformance,
        recommendations: overview?.openRecommendations || [],
        creativeAssets: creativeLibraryAssets,
        latestCreatives: overview?.latestCreatives || [],
        productCount: productCatalogItems.length,
        metaConnected: Boolean(metaStatus?.connected),
        googleDriveConnected,
      }),
    [
      adPerformance,
      campaignInsights,
      creativeLibraryAssets,
      googleDriveConnected,
      metaStatus?.connected,
      overview,
      productCatalogItems.length,
    ],
  );
  const logicActionDayKey = useMemo(() => getAmsterdamDateKey(), []);
  const logicActionStorageKey = tenantId
    ? `logic_ads_dismissed_actions:${tenantId}:${logicActionDayKey}:${campaignDays}`
    : "";
  const visibleLogicActionCards = useMemo(
    () =>
      showDismissedLogicActions
        ? logicActionCards
        : logicActionCards.filter(
            (card) => !dismissedLogicActionIds.has(card.id),
          ),
    [dismissedLogicActionIds, logicActionCards, showDismissedLogicActions],
  );
  const logicActionGroups = useMemo(
    () => groupLogicActionCards(visibleLogicActionCards),
    [visibleLogicActionCards],
  );
  const dismissedLogicActionCount = logicActionCards.filter((card) =>
    dismissedLogicActionIds.has(card.id),
  ).length;
  const [expandedLogicActionGroups, setExpandedLogicActionGroups] = useState<
    Set<string>
  >(() => new Set());

  useEffect(() => {
    if (!logicActionStorageKey) {
      setDismissedLogicActionIds(new Set());
      return;
    }
    try {
      const saved = JSON.parse(
        window.localStorage.getItem(logicActionStorageKey) || "[]",
      );
      const currentIds = new Set(logicActionCards.map((card) => card.id));
      const valid = Array.isArray(saved)
        ? saved.filter((id) => currentIds.has(String(id))).map(String)
        : [];
      setDismissedLogicActionIds(new Set(valid));
    } catch {
      setDismissedLogicActionIds(new Set());
    }
  }, [logicActionCards, logicActionStorageKey]);

  const dismissLogicActionForToday = useCallback(
    (id: string) => {
      if (!logicActionStorageKey) return;
      setDismissedLogicActionIds((current) => {
        const next = new Set(current);
        next.add(id);
        try {
          window.localStorage.setItem(
            logicActionStorageKey,
            JSON.stringify(Array.from(next)),
          );
        } catch {}
        return next;
      });
    },
    [logicActionStorageKey],
  );

  const restoreLogicActionsForToday = useCallback(() => {
    if (!logicActionStorageKey) return;
    setDismissedLogicActionIds(new Set());
    setShowDismissedLogicActions(false);
    try {
      window.localStorage.removeItem(logicActionStorageKey);
    } catch {}
  }, [logicActionStorageKey]);

  useEffect(() => {
    setExpandedLogicActionGroups((current) => {
      const available = new Set(logicActionGroups.map((group) => group.id));
      const next = new Set(
        Array.from(current).filter((id) => available.has(id)),
      );
      if (!next.size && logicActionGroups[0]) next.add(logicActionGroups[0].id);
      return next;
    });
  }, [logicActionGroups]);

  const toggleLogicActionGroup = useCallback((id: string) => {
    setExpandedLogicActionGroups((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    const container = strategistListRef.current;
    const target = strategistScrollTargetRef.current;
    if (!container || !target) return;
    const targetTop = target.offsetTop - container.offsetTop;
    container.scrollTo({
      top: Math.max(targetTop - 12, 0),
      behavior: "smooth",
    });
  }, [strategistMessages, strategistLoading, strategistCreating]);

  const strategistQuickPrompts = [
    "How did my ads perform this week compared to last week?",
    "Which ad creatives are driving the highest conversions?",
    "Where is my Meta Ads budget being wasted?",
    "Which campaigns and ads give the highest returns?",
    "Are there sudden performance drops I should worry about?",
    "Which ads are showing fatigue and need refreshing?",
  ];

  function isCampaignSetupIntent(value: string) {
    return (
      /\b(start|create|make|build|setup|launch|new)\b[\s\S]{0,80}\b(campaign|campagne|ad\s*sets?|ads?)\b/i.test(
        value,
      ) ||
      /\b(campaign|campagne)\b[\s\S]{0,80}\b(start|create|make|build|setup|launch|new)\b/i.test(
        value,
      )
    );
  }

  function landingOptionsFor(items: ProductFolder[]) {
    const options = items
      .map((item) => ({ label: item.name, url: item.url }))
      .filter((option) => option.url)
      .slice(0, 6);
    if (destinationUrl.trim())
      options.unshift({
        label: "Current landing page",
        url: destinationUrl.trim(),
      });
    return options;
  }

  function extractUrl(value: string) {
    return value.match(/https?:\/\/\S+/i)?.[0]?.replace(/[),.;]+$/, "") || "";
  }

  function createMissingSettingsMessage(questions: string[]) {
    const cleanQuestions = questions.filter(Boolean).slice(0, 4);
    if (!cleanQuestions.length)
      return "I need a bit more setup context before I can create this safely.";
    return `I need these settings before I can create this safely:\n${cleanQuestions.map((question) => `- ${question}`).join("\n")}`;
  }

  async function buildPersonas() {
    if (!tenantId) return;
    const selectedItems =
      personaProductMode === "catalog" ? personaSelectedCatalogItems : [];
    const selected = selectedItems[0] || null;
    const rawInput = personaProductInput.trim();
    const productUrl =
      personaProductMode === "custom"
        ? extractUrl(rawInput)
        : selectedItems.find((item) => item.url)?.url || "";
    const productName =
      personaProductMode === "custom"
        ? rawInput && !extractUrl(rawInput)
          ? rawInput
          : ""
        : selectedItems
            .map((item) => item.name)
            .filter(Boolean)
            .join(", ");
    if (personaProductMode === "catalog" && !selectedItems.length) {
      setPersonaBuildError(
        "Choose one or more products from your scraped catalog first, or switch to Custom product.",
      );
      return;
    }
    if (
      personaProductMode === "custom" &&
      !productName &&
      !productUrl &&
      !personaProductDescription.trim()
    ) {
      setPersonaBuildError(
        "Enter a product name, product URL or short product description first.",
      );
      return;
    }
    if (personaBuildNeedsMoreNomi) {
      setPersonaBuildError(
        `Not enough Nomi's. Persona build needs ${personaBuildNomiCost} Nomi's and you have ${nomiBalance}.`,
      );
      return;
    }
    setPersonaBuildLoading(true);
    setPersonaBuildError(null);
    setPersonaBuildResult(null);
    setSavedBuiltPersonaIds([]);
    setExpandedBuiltPersonaId(null);
    try {
      const res = await apiPost<PersonaBuildResult>(
        "/api/ad-manager/personas/build",
        {
          tenant_id: tenantId,
          product_name: productName,
          product_url: productUrl,
          product_description: personaProductDescription.trim(),
          persona_prompt: personaProductDescription.trim(),
          persona_count: personaCount,
          selected_product: selected
            ? {
                id: selected.id,
                name: selected.name,
                type: selected.type,
                url: selected.url,
                imageUrl: selected.imageUrl,
                price: selected.price,
                source: selected.source,
              }
            : null,
          selected_products: selectedItems.map((item) => ({
            id: item.id,
            name: item.name,
            type: item.type,
            url: item.url,
            imageUrl: item.imageUrl,
            price: item.price,
            source: item.source,
          })),
        },
      );
      setPersonaBuildResult(res);
      setSavedBuiltPersonaIds([]);
      setNotice(
        `Built ${res.personas.length} persona${res.personas.length === 1 ? "" : "s"}. Review and save the ones you want.`,
      );
      const firstPersonaId = res.personas[0]?.id || "";
      if (firstPersonaId) {
        setSelectedPersonaId(firstPersonaId);
        setSelectedPersonaIds([firstPersonaId]);
      }
      setExpandedBuiltPersonaId(null);
      setPersonaBuildLoading(false);
      void loadBilling();
      loadOverview().catch(() => undefined);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Persona build failed";
      setPersonaBuildError(message);
      setPersonaBuildLoading(false);
    }
  }

  async function saveBuiltPersona(
    persona: PersonaBuildResult["personas"][number],
  ) {
    if (!personaBuildResult) return;
    setPersonaBuildError(null);
    setSavingBuiltPersonaId(persona.id);
    try {
      await apiPost("/api/ad-manager/personas/save", {
        tenant_id: tenantId,
        persona,
        product_key: personaBuildResult.product_key,
        selected_product: personaBuildResult.selected_product,
        selected_products: personaBuildResult.selected_products || [],
      });
      setSavedBuiltPersonaIds((current) =>
        current.includes(persona.id) ? current : [...current, persona.id],
      );
      setNotice(`Saved ${persona.name} to Persona Gallery.`);
      void loadOverview({ showLoading: false });
    } catch (err) {
      setPersonaBuildError(
        err instanceof Error ? err.message : "Could not save persona",
      );
    } finally {
      setSavingBuiltPersonaId(null);
    }
  }

  async function deleteGalleryPersona(personaId: string) {
    setPersonaDeleteError(null);
    setDeletingPersonaId(personaId);
    try {
      await apiDelete(`/api/ad-manager/personas/${personaId}`);
      setOverview((current) =>
        current
          ? {
              ...current,
              counts: {
                ...current.counts,
                ad_personas: Math.max(
                  0,
                  Number(current.counts.ad_personas || 0) - 1,
                ),
              },
              latestPersonas: current.latestPersonas.filter(
                (row) => String(row.id) !== personaId,
              ),
            }
          : current,
      );
      setSelectedPersonaIds((current) =>
        current.filter((id) => id !== personaId),
      );
      if (selectedPersonaId === personaId) setSelectedPersonaId("");
      if (expandedGalleryPersonaId === personaId)
        setExpandedGalleryPersonaId(null);
      setPendingDeletePersonaId(null);
      void loadOverview({ showLoading: false });
    } catch (err) {
      setPersonaDeleteError(
        err instanceof Error ? err.message : "Could not delete persona",
      );
    } finally {
      setDeletingPersonaId(null);
    }
  }

  async function saveStagedGeneratedCreatives() {
    if (!stagedGeneratedCreatives.length) return;
    setSavingStagedCreatives(true);
    setError(null);
    setNotice(null);
    try {
      const savedPackage = await apiPost<{
        batch?: DbRow;
        creatives?: DbRow[];
      }>("/api/ad-manager/batches", {
        tenant_id: tenantId,
        product_id: selectedProduct?.id,
        name: `${imageGenerationReferenceLabel || "Product"} saved generated images ${new Date().toLocaleDateString()}`,
        requested_formats: requestedCreativeFormats,
        template_ids: [],
        auto_create_package: true,
        generation_params: {
          source: "dashboard_generate_images_saved",
          content_source: "staged_ai",
          media_workflow: "save_after_generate_review",
          product_name: imageGenerationReferenceLabel,
          product_folder_id: selectedProduct?.id,
          product_folder_url: selectedProduct?.url,
          goal: imageGenerationPrompt,
          creative_aspect_ratio: creativeAspectRatio,
          requested_format: `photo_${creativeAspectRatio.replace(":", "x")}`,
          campaign_mode: "draft",
          campaign_name: "Saved generated image draft",
          destination_url: selectedProduct?.url || "",
          staged_assets: stagedGeneratedCreatives,
        },
      });
      const nextBatchId = String(savedPackage?.batch?.id || "");
      if (nextBatchId) {
        setLatestCreatedBatch({
          id: nextBatchId,
          name: String(
            savedPackage?.batch?.name || "Saved generated image batch",
          ),
          count: Array.isArray(savedPackage?.creatives)
            ? savedPackage.creatives.length
            : stagedGeneratedCreatives.length,
        });
      }
      setStagedGeneratedCreatives([]);
      setStagedFeedback("");
      await loadOverview();
      setNotice("Saved to My Creatives.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save generated images",
      );
    } finally {
      setSavingStagedCreatives(false);
    }
  }

  function generateImages() {
    const revisionMode =
      stagedGeneratedCreatives.length > 0 && stagedFeedback.trim().length > 0;
    const basePrompt = imageGenerationPrompt.trim();
    const feedbackPrompt = stagedFeedback.trim();
    const effectivePrompt = basePrompt;
    if (busy || !effectivePrompt) return;
    const startedAt = Date.now();
    if (!revisionMode) setImageGenerationPrompt(effectivePrompt);
    setImageGenerationLoading(true);
    setImageGenerationLoadingPreview({
      aspectRatio: creativeAspectRatio,
      count: imageGenerationCount,
      prompt: revisionMode ? feedbackPrompt : effectivePrompt,
    });
    setBusy("image-generate");
    setError(null);
    setNotice(null);
    void (async () => {
      try {
        const personaPool = selectedPersonaIdsForUse.length
          ? selectedPersonaPool
          : [];
        const generatedStage = await apiPost<{
          staged_creatives?: StagedGeneratedCreative[];
        }>("/api/ad-manager/batches", {
          tenant_id: tenantId,
          product_id: selectedProduct?.id,
          stage_only: true,
          generation_params: {
            source: "dashboard_generate_images",
            content_source: "ai",
            media_workflow: "ai_image_generation_stage_only",
            image_generation_model: imageGenerationModel,
            revision_mode: revisionMode,
            iteration_feedback: revisionMode ? feedbackPrompt : "",
            previous_staged_assets: revisionMode
              ? stagedGeneratedCreatives.slice(0, 1).map((creative) => ({
                  id: creative.id,
                  title: creative.title,
                  asset_url:
                    imageGenerationModel === "nano-banana"
                      ? creative.asset_url
                      : "",
                  final_asset_url:
                    imageGenerationModel === "nano-banana"
                      ? creative.final_asset_url
                      : "",
                  metadata: creative.metadata,
                  prompt: (
                    creative.metadata?.image_generation as
                      | { prompt?: string }
                      | undefined
                  )?.prompt,
                }))
              : [],
            reference_source: imageGenerationReferenceSource,
            reference_image_name: imageGenerationReferenceName,
            reference_image_data_url: imageGenerationReferenceDataUrl,
            product_name: imageGenerationReferenceLabel,
            product_folder_id: selectedProduct?.id,
            product_folder_url: selectedProduct?.url,
            selected_catalog_items: imageGenerationReferenceItems.map(
              (item) => ({
                id: item.id,
                name: item.name,
                type: item.type,
                url: item.url,
                imageUrl: item.imageUrl,
                price: item.price,
                drive: item.drive,
                new: item.new,
                source: item.source,
              }),
            ),
            persona_suggestions: personaPool,
            goal: effectivePrompt,
            ad_idea: effectivePrompt,
            hook: effectivePrompt,
            creative_media_type: "photo",
            creative_media_types: ["photo"],
            creative_aspect_ratio: creativeAspectRatio,
            requested_format: `photo_${creativeAspectRatio.replace(":", "x")}`,
            creative_count: imageGenerationCount,
            ads_per_adset: imageGenerationCount,
            campaign_mode: "draft",
            campaign_name: "Generated image draft",
            destination_url: selectedProduct?.url || "",
            selected_template_ids: [],
            selected_templates: [],
          },
        });
        const staged = Array.isArray(generatedStage?.staged_creatives)
          ? generatedStage.staged_creatives
          : [];
        setStagedGeneratedCreatives(staged);
        setStagedFeedback("");
        setNotice(
          staged.length
            ? revisionMode
              ? "Changes applied. Review the new revision, or send another change."
              : "Images generated. Click an image to preview it, or send feedback in the same composer."
            : "No images were generated.",
        );
        if (staged.length) void loadBilling();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Image generation failed",
        );
      } finally {
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, 900 - elapsed);
        window.setTimeout(() => {
          setBusy(null);
          setImageGenerationLoading(false);
          setImageGenerationLoadingPreview(null);
        }, remaining);
      }
    })();
  }

  function clampTemplateValue(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
  }

  function clampElementToCanvas(element: TemplateElement) {
    const width = clampTemplateValue(element.width, 4, 100);
    const height = clampTemplateValue(element.height, 4, 100);
    return {
      ...element,
      width,
      height,
      x: clampTemplateValue(element.x, 0, 100 - width),
      y: clampTemplateValue(element.y, 0, 100 - height),
    };
  }

  function updateTemplateElement(id: string, patch: Partial<TemplateElement>) {
    setTemplateElements((current) =>
      current.map((element) =>
        element.id === id
          ? clampElementToCanvas({ ...element, ...patch })
          : element,
      ),
    );
  }

  function updateTemplateSafeZone(zone: SafeZonePreset) {
    setTemplateSafeZoneId(zone.id);
  }

  function updateTemplateFormat(ratio: string) {
    setCreativeAspectRatio(ratio);
    const defaultZone =
      SAFE_ZONE_PRESETS.find(
        (zone) =>
          zone.ratio === ratio &&
          (ratio !== "9:16" || zone.id === "reels_9x16"),
      ) || SAFE_ZONE_PRESETS.find((zone) => zone.ratio === ratio);
    if (defaultZone) updateTemplateSafeZone(defaultZone);
  }

  function setTemplateSafeZonesActive(enabled: boolean) {
    setTemplateSafeZonesEnabled(enabled);
  }

  function setCreativeMediaTypeSelection(value: string) {
    if (value === "photo_video") {
      setCreativeMediaTypes(["photo", "video"]);
      return;
    }
    if (value === "video") {
      setCreativeMediaTypes(["video"]);
      return;
    }
    setCreativeMediaTypes(["photo"]);
  }

  function addTemplateElement(type: TemplateElementType) {
    const id = `${type}-${Date.now()}`;
    const next: TemplateElement =
      type === "logo"
        ? {
            id,
            type,
            label: "Logo",
            text: "Logo",
            x: 6,
            y: 5,
            width: 24,
            height: 9,
            fontSize: 14,
            fontWeight: "800",
            fontFamily: "Inter",
            color: "#111827",
            background: "#ffffff",
            src: "",
          }
        : type === "media"
          ? {
              id,
              type,
              label: "Media slot",
              text: "",
              x: 10,
              y: 18,
              width: 80,
              height: 46,
              fontSize: 14,
              fontWeight: "700",
              fontFamily: "Inter",
              color: "#6b7280",
              background: "rgba(255,255,255,0.70)",
            }
          : type === "cta"
            ? {
                id,
                type,
                label: "CTA",
                text: "Shop now",
                x: 8,
                y: 86,
                width: 32,
                height: 8,
                fontSize: 14,
                fontWeight: "800",
                fontFamily: "Inter",
                color: "dynamic",
                background: templateAccent,
              }
            : {
                id,
                type,
                label: "Text",
                text: "New text",
                x: 8,
                y: 68,
                width: 84,
                height: 10,
                fontSize: 24,
                fontWeight: "900",
                fontFamily: "Inter",
                color: "dynamic",
                background: "transparent",
              };
    setTemplateElements((current) => [...current, clampElementToCanvas(next)]);
    setSelectedTemplateElementId(id);
  }

  function removeTemplateElement(id: string) {
    if (templateElements.length <= 1) return;
    setTemplateElements((current) =>
      current.filter((element) => element.id !== id),
    );
    setSelectedTemplateElementId((current) =>
      current === id
        ? templateElements.find((element) => element.id !== id)?.id || ""
        : current,
    );
  }

  function uploadTemplateLogo(
    event: ChangeEvent<HTMLInputElement>,
    id: string,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Upload an image file for the logo.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Logo file is too large. Use an image under 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateTemplateElement(id, { src: String(reader.result || ""), text: "" });
      setError(null);
    };
    reader.onerror = () =>
      setError("Logo upload failed. Try a different image.");
    reader.readAsDataURL(file);
  }

  function startTemplateDrag(
    event: ReactPointerEvent<HTMLDivElement>,
    element: TemplateElement,
  ) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedTemplateElementId(element.id);
    templateDragRef.current = {
      id: element.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      elementX: element.x,
      elementY: element.y,
      width: element.width,
      height: element.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveTemplateDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = templateDragRef.current;
    const canvas = templateCanvasRef.current;
    if (!drag || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const snapThreshold = 2;
    const rawX =
      drag.elementX + ((event.clientX - drag.startX) / rect.width) * 100;
    const rawY =
      drag.elementY + ((event.clientY - drag.startY) / rect.height) * 100;
    const rawCenterX = rawX + drag.width / 2;
    const rawCenterY = rawY + drag.height / 2;
    const snapVertical = Math.abs(rawCenterX - 50) <= snapThreshold;
    const snapHorizontal = Math.abs(rawCenterY - 50) <= snapThreshold;
    const nextX = snapVertical ? 50 - drag.width / 2 : rawX;
    const nextY = snapHorizontal ? 50 - drag.height / 2 : rawY;
    setTemplateGuides({ vertical: snapVertical, horizontal: snapHorizontal });
    updateTemplateElement(drag.id, {
      x: clampTemplateValue(nextX, 0, 100 - drag.width),
      y: clampTemplateValue(nextY, 0, 100 - drag.height),
    });
  }

  function endTemplateDrag() {
    templateDragRef.current = null;
    setTemplateGuides({ vertical: false, horizontal: false });
  }

  async function saveTemplate() {
    const cleanName = templateName.trim();
    if (!cleanName) {
      setError("Give the template a name before saving it.");
      return;
    }
    const variableElements = templateElements.map((element) => ({
      id: element.id,
      type: element.type,
      role:
        element.type === "media"
          ? "product_media"
          : element.type === "text"
            ? "generated_text"
            : element.type === "cta"
              ? "generated_cta"
              : "fixed_logo",
      replace_on_generation: element.type !== "logo",
      locked_asset: element.type === "logo",
    }));
    await runAction("template", async () => {
      const res = await apiPost<{ template?: DbRow }>(
        "/api/ad-manager/templates",
        {
          tenant_id: tenantId,
          name: cleanName,
          kind:
            creativeMediaTypes.length > 1 ? "photo_video" : creativeMediaType,
          format_support: requestedCreativeFormats,
          renderer: "visual_template_builder",
          design_json: {
            aspect_ratio: creativeAspectRatio,
            media_type:
              creativeMediaTypes.length > 1 ? "photo_video" : creativeMediaType,
            media_types: creativeMediaTypes,
            headline: templateHeadline.trim(),
            style: templateStyle,
            accent: templateAccent,
            layout: "custom_canvas",
            safe_zone: templateSafeZonesEnabled
              ? {
                  ...activeSafeZone,
                  canvas_format: creativeAspectRatio,
                  placement_crop: activePlacementCrop,
                  effective_safe_area: activeSafeArea,
                }
              : null,
            safe_zones_enabled: templateSafeZonesEnabled,
            variable_contract: {
              summary:
                "Media, text and CTA elements are placeholders filled per generated ad. Logo elements are fixed brand assets and must not be replaced.",
              elements: variableElements,
            },
            elements: templateElements,
          },
        },
      );
      const id = String(res?.template?.id || "");
      if (id)
        setSelectedTemplateIds((current) =>
          current.includes(id) ? current : [...current, id],
        );
      void loadOverview({ showLoading: false });
      return `Template saved and selected: ${cleanName}.`;
    });
  }

  function questionsNeedCampaignOptions(questions: string[]) {
    return questions.some((question) =>
      /which existing campaign|existing campaign|setup reference|campaign should i use/i.test(
        question,
      ),
    );
  }

  function maybeAskForCampaignSetupInputs(
    finalPrompt: string,
    userMessage: StrategistChatMessage,
    effectiveProduct?: ProductFolder | null,
  ) {
    if (!isCampaignSetupIntent(finalPrompt)) return false;
    const effectiveItems = effectiveProduct
      ? [effectiveProduct]
      : selectedCatalogItems;
    if (!selectedCatalogCount && !effectiveProduct) {
      setStrategistMessages((current) => [
        ...current,
        userMessage,
        {
          id: `assistant-product-options-${Date.now()}`,
          role: "assistant",
          text: "I can start the campaign from here. First choose what product or catalog this campaign is for.",
          productOptions: productCatalogItems.slice(0, 8),
          quickReplies:
            productCatalogItems.length > 1
              ? ["Use all catalog products", "Recommend the best product first"]
              : ["Recommend the best product first"],
          campaignResumePrompt: finalPrompt,
        },
      ]);
      setStrategistPrompt("");
      return true;
    }
    if (!destinationUrl.trim()) {
      setStrategistMessages((current) => [
        ...current,
        userMessage,
        {
          id: `assistant-landing-options-${Date.now()}`,
          role: "assistant",
          text: "Product is clear. What landing page should the ads send traffic to?",
          landingOptions: landingOptionsFor(effectiveItems),
          quickReplies: ["Use the product page", "Ask me for a custom URL"],
          campaignResumePrompt: finalPrompt,
        },
      ]);
      setStrategistPrompt("");
      return true;
    }
    return false;
  }

  function normalizeCampaignMatchText(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function matchScore(name: string, text: string) {
    const normalizedName = normalizeCampaignMatchText(name);
    const normalizedText = normalizeCampaignMatchText(text);
    if (!normalizedName || !normalizedText) return 0;
    if (normalizedText.includes(normalizedName)) return 100;
    const stopWords = new Set([
      "campaign",
      "campagne",
      "the",
      "een",
      "met",
      "voor",
      "that",
      "this",
      "deze",
      "huidige",
      "current",
      "product",
      "catalog",
    ]);
    const nameTokens = normalizedName
      .split(" ")
      .filter((token) => token.length > 2 && !stopWords.has(token));
    if (!nameTokens.length) return 0;
    const matched = nameTokens.filter((token) =>
      normalizedText.includes(token),
    );
    const strongTokens = matched.filter((token) => token.length >= 4);
    const coverage = matched.length / nameTokens.length;
    return (
      strongTokens.length * 4 + matched.length + (coverage >= 0.65 ? 8 : 0)
    );
  }

  function campaignMatchScore(campaignName: string, text: string) {
    return matchScore(campaignName, text);
  }

  function resolveMentionedProduct(
    prompt: string,
    history: Array<{ role: string; content: string }>,
  ) {
    if (selectedCatalogItems.length || !productCatalogItems.length) return null;
    const combined = `${history
      .slice(-20)
      .map((item) => item.content || "")
      .join("\n")}\n${prompt}`;
    const scored = productCatalogItems
      .map((product) => ({
        product,
        score: matchScore(product.name, combined),
      }))
      .filter((item) => item.score >= 10)
      .sort((a, b) => b.score - a.score);
    if (!scored.length) return null;
    const top = scored[0];
    const tied = scored.filter((item) => top.score - item.score <= 4);
    return tied.length === 1 || top.score >= 100 ? top.product : null;
  }

  function promptHasExplicitCampaignReference(prompt: string) {
    const text = normalizeCampaignMatchText(prompt);
    return (
      /\b(campaign|campagne|cbo|abo|ret|test|worldwide|live|current|selected|geselecteerd|targeting|countries|landen)\b/i.test(
        text,
      ) || /\|/.test(prompt)
    );
  }

  function resolveMentionedCampaign(
    prompt: string,
    history: Array<{ role: string; content: string }>,
  ) {
    const campaigns = (campaignInsights?.campaigns || []).filter(
      (campaign) =>
        ["ACTIVE", "PAUSED", "active", "paused"].includes(campaign.status) ||
        campaign.status,
    );
    if (!campaigns.length || activeStrategistCampaignContext)
      return { match: null as Campaign | null, options: [] as Campaign[] };
    if (!promptHasExplicitCampaignReference(prompt))
      return { match: null as Campaign | null, options: [] as Campaign[] };

    const directScored = campaigns
      .map((campaign) => ({
        campaign,
        score: campaignMatchScore(campaign.name, prompt),
      }))
      .filter((item) => item.score >= 10)
      .sort((a, b) => b.score - a.score);

    if (directScored.length) {
      const directTopScore = directScored[0].score;
      const directOptions = directScored
        .filter((item) => directTopScore - item.score <= 4)
        .slice(0, 5)
        .map((item) => item.campaign);
      if (directOptions.length === 1 || directTopScore >= 100)
        return { match: directScored[0].campaign, options: [] as Campaign[] };
      return { match: null as Campaign | null, options: directOptions };
    }

    const latestHistory = history
      .slice(-4)
      .map((item) => item.content || "")
      .join("\n");
    const combined = `${latestHistory}\n${prompt}`;
    const scored = campaigns
      .map((campaign) => ({
        campaign,
        score: campaignMatchScore(campaign.name, combined),
      }))
      .filter((item) => item.score >= 18)
      .sort((a, b) => b.score - a.score);
    if (!scored.length)
      return { match: null as Campaign | null, options: [] as Campaign[] };
    const topScore = scored[0].score;
    if (topScore >= 100)
      return { match: scored[0].campaign, options: [] as Campaign[] };
    return { match: null as Campaign | null, options: [] as Campaign[] };
  }

  function messageHasCreateCta(message: StrategistChatMessage) {
    if (message.role !== "assistant") return false;
    if (message.result?.creation_plan?.summary)
      return message.result.creation_plan.ready === true;
    return /ready to create|say\s+oke\s+maak|click the button|create it in meta|create .*paused/i.test(
      message.text,
    );
  }

  function createPromptForMessage(message: StrategistChatMessage) {
    const scope = message.result?.creation_plan?.create_scope;
    if (scope === "adsets" || /ad\s*sets/i.test(message.text))
      return "Create the ad sets";
    return "Create the campaign";
  }

  function isCreateConfirmation(message: string) {
    const text = message
      .trim()
      .toLowerCase()
      .replace(/[`'",.!?]+/g, " ")
      .replace(/\s+/g, " ");
    const latestAssistant = [...strategistMessages]
      .reverse()
      .find((item) => item.role === "assistant");
    const latestReadyPlan =
      strategistResult?.creation_plan?.ready === true ||
      (latestAssistant ? messageHasCreateCta(latestAssistant) : false);
    if (
      latestReadyPlan &&
      /(^|\s)(maak|create|build|start|run)(\s|$)/i.test(text)
    )
      return true;
    if (
      latestReadyPlan &&
      /(^|\s)(oke|ok|okay)\s+(maak|create|build|start|run)(\s|$)/i.test(text)
    )
      return true;
    if (
      latestReadyPlan &&
      /(^|\s)(let s do it|lets do it|doe maar|go|confirmed)(\s|$)/i.test(text)
    )
      return true;
    if (latestReadyPlan && /^(oe\s+)?(oke|ok|okay)$/i.test(text)) return true;
    return false;
  }

  function wantsSelfBuiltAudiencesFromChat(
    history: Array<{ role: string; content: string }>,
    currentPrompt = "",
  ) {
    const combined = `${history
      .slice(-24)
      .map((item) => item.content || "")
      .join("\n")}\n${currentPrompt}`.toLowerCase();
    return /make (the )?audiences? (yourself|myself)|build (the )?audiences?|create (the )?audiences?|audiences? yourself|self-built|self built|maak (de )?(audiences?|doelgroepen?)|audiences? zelf|doelgroepen? zelf|zelf (maken|aanmaken|bouwen)|moet je (dus )?zelf|mot je (dus )?zelf|jij (moet|mot).*zelf|die (moet|mot) je (dus )?zelf/i.test(
      combined,
    );
  }

  function inferCampaignNameFromChat(
    history: Array<{ role: string; content: string }>,
    currentPrompt: string,
  ) {
    const combined = [
      ...history.map((item) => item.content || ""),
      currentPrompt,
    ].join("\n");
    const explicit = combined.match(
      /(?:campaign|campagne)\s*(?:name|naam)?\s*(?:is|=|:)?\s*([A-Z0-9][A-Z0-9 |_-]{10,160})/i,
    );
    const candidates = combined
      .split(/\n+/)
      .map((line) =>
        line
          .trim()
          .replace(/^[-•\s]+/, "")
          .replace(/[.]+$/, ""),
      )
      .filter((line) => line.length >= 12 && line.length <= 120)
      .filter((line) => /[A-Z]{2,}/.test(line) && /\|/.test(line));
    return (explicit?.[1] || candidates.at(-1) || "").trim();
  }

  function friendlyCreateError(raw: string) {
    const text = raw || "Create request failed";
    if (
      /Can't Set Ad Set and Campaign Budget|ad set budget or a campaign budget/i.test(
        text,
      )
    ) {
      return "Meta blocked this because the selected campaign already uses campaign budget. I will create the ad sets without separate ad set budgets, so the campaign budget stays in control.";
    }
    if (/is_adset_budget_sharing_enabled|adset_budget_sharing/i.test(text)) {
      return "Meta needed the ABO budget sharing setting. I set that explicitly now, so retry Create and I will send the corrected ad set budget payload.";
    }
    if (
      /Bid Amount Required|bid_amount|bid cap|target cost|TARGET_COST|LOWEST_COST_WITH_BID_CAP/i.test(
        text,
      )
    ) {
      return "I removed the copied bid cap/target cost. For CBO, use campaign daily budget and create the paused ad sets without ad set bid caps.";
    }
    if (
      /custom audience|No Meta Pixel|adspixels|website retargeting audiences/i.test(
        text,
      )
    ) {
      return "I need Meta Pixel/custom audience access to create those retargeting inclusions and exclusions. I kept the Meta error below so I can fix the exact missing source or permission.";
    }
    if (
      /permission|OAuthException|access token|requires.*permission|missing.*scope/i.test(
        text,
      )
    ) {
      return "Meta access is missing or expired for this action. Reconnect Meta in Integrations, then I can create it.";
    }
    if (/Choose an existing campaign|provide a new campaign name/i.test(text)) {
      return "I need the exact campaign first. Pick one from the campaign list or type the campaign name, then I can create it.";
    }
    return "Meta could not create this yet. I kept the technical error below so it can be fixed without guessing.";
  }

  function needsMetaAccess(raw: string) {
    return /No Meta Pixel|adspixels|permission|access token|requires.*permission|missing.*scope|ads_management|business_management/i.test(
      raw || "",
    );
  }

  async function executeStrategistCreate(
    finalPrompt: string,
    userMessage: StrategistChatMessage,
    history: Array<{ role: string; content: string }>,
  ) {
    if (!strategistResult && !displayedPersonaSuggestions.length) {
      setStrategistError(
        "Discuss the plan with Logic Ads first, then click Create or type create.",
      );
      setStrategistMessages((current) => [
        ...current,
        userMessage,
        {
          id: `assistant-create-missing-${Date.now()}`,
          role: "assistant",
          text: "Discuss the plan first, then click Create or type create and I will create it in the connected Meta ad account.",
        },
      ]);
      return;
    }
    const productFromChat = resolveMentionedProduct(finalPrompt, history);
    if (productFromChat) setSelectedProductIds([productFromChat.id]);
    const selectedItemsForCreate = selectedCatalogItems.length
      ? selectedCatalogItems
      : productFromChat
        ? [productFromChat]
        : [];
    setStrategistMessages((current) => [...current, userMessage]);
    setStrategistPrompt("");
    setStrategistCreating(true);
    setStrategistError(null);
    try {
      const res = await apiPost<ChatCreateResponse>(
        "/api/ad-manager/chat-create",
        {
          tenant_id: tenantId,
          session_id: strategistSessionId,
          confirmation: finalPrompt,
          history,
          selected_catalog_items: selectedItemsForCreate.map((item) => ({
            id: item.id,
            name: item.name,
            type: item.type,
            url: item.url,
            imageUrl: item.imageUrl,
            price: item.price,
            drive: item.drive,
            new: item.new,
          })),
          selected_campaign: activeStrategistCampaignContext
            ? {
                id: activeStrategistCampaignContext.id,
                name: activeStrategistCampaignContext.name,
                status: activeStrategistCampaignContext.status,
                objective: activeStrategistCampaignContext.objective,
                spend: activeStrategistCampaignContext.spend,
                impressions: activeStrategistCampaignContext.impressions,
                clicks: activeStrategistCampaignContext.clicks,
                roas: activeStrategistCampaignContext.roas,
                purchases: activeStrategistCampaignContext.purchases,
                purchaseValue: activeStrategistCampaignContext.purchaseValue,
              }
            : null,
          campaign_signal: campaignSignal,
          selected_adset_template: selectedTemplateAdset
            ? {
                id: selectedTemplateAdset.id,
                name: selectedTemplateAdset.name,
                campaign_id: selectedTemplateAdset.campaign_id,
                daily_budget: selectedTemplateAdset.daily_budget,
                targeting: selectedTemplateAdset.targeting,
                promoted_object: selectedTemplateAdset.promoted_object,
                optimization_goal: selectedTemplateAdset.optimization_goal,
                billing_event: selectedTemplateAdset.billing_event,
                bid_strategy: selectedTemplateAdset.bid_strategy,
                bid_amount: selectedTemplateAdset.bid_amount,
              }
            : null,
          self_built_retargeting: wantsSelfBuiltAudiencesFromChat(
            history,
            finalPrompt,
          ),
          targeting_mode: targetingMode,
          draft_goal: draftGoal,
          campaign_mode:
            strategistResult?.creation_plan?.create_scope === "campaign" &&
            campaignMode !== "new"
              ? "new"
              : campaignMode,
          inferred_campaign_name: inferCampaignNameFromChat(
            history,
            finalPrompt,
          ),
          new_campaign:
            strategistResult?.creation_plan?.create_scope === "campaign" ||
            campaignMode === "new"
              ? {
                  ...newCampaignDraft,
                  name:
                    newCampaignName.trim() ||
                    inferCampaignNameFromChat(history, finalPrompt),
                }
              : null,
          content_source: contentSource,
          destination_url: destinationUrl.trim() || extractUrl(finalPrompt),
          personas: selectedPersonaPool.length
            ? selectedPersonaPool
            : displayedPersonaSuggestions.slice(0, 4),
          strategist_result: strategistResult,
          campaign_context_label: campaignContextLabel,
        },
      );
      if (res.gate) {
        const questions = res.questions || (res.error ? [res.error] : []);
        const needsCampaignOptions = questionsNeedCampaignOptions(questions);
        const text =
          needsCampaignOptions && activeCampaigns.length
            ? "Choose the active campaign to use as setup reference."
            : createMissingSettingsMessage(questions);
        setStrategistMessages((current) => [
          ...current,
          {
            id: `assistant-create-gate-${Date.now()}`,
            role: "assistant",
            text,
            campaignOptions: needsCampaignOptions
              ? activeCampaigns.slice(0, 8)
              : undefined,
            campaignResumePrompt: finalPrompt,
          },
        ]);
        setStrategistError(null);
        return;
      }
      const text = `${res.message || "Created paused campaign setup in Meta."} Everything is paused by default so it can still be reviewed before spend starts.`;
      setStrategistMessages((current) => [
        ...current,
        { id: `assistant-created-${Date.now()}`, role: "assistant", text },
      ]);
      setNotice(text);
      await loadOverview();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Create request failed";
      const data = (
        err as Error & {
          data?: { error?: string; detail?: string; questions?: string[] };
        }
      ).data;
      const rawDetail = sanitizeChatText(data?.detail || message);
      const friendly = friendlyCreateError(data?.error || message);
      const questions = data?.questions || [];
      const needsCampaignOptions = questionsNeedCampaignOptions(questions);
      const text = questions.length
        ? `${friendly}\n\n${createMissingSettingsMessage(questions)}`
        : friendly;
      setStrategistError(null);
      setStrategistMessages((current) => [
        ...current,
        {
          id: `assistant-create-error-${Date.now()}`,
          role: "assistant",
          text,
          errorDetail:
            rawDetail && rawDetail !== friendly ? rawDetail : undefined,
          campaignOptions: needsCampaignOptions
            ? activeCampaigns.slice(0, 8)
            : undefined,
          quickReplies: needsCampaignOptions
            ? undefined
            : [
                "Choose CBO",
                "Choose ABO",
                "Pick another campaign",
                "Review setup first",
              ],
          campaignResumePrompt: finalPrompt,
          accessAction:
            needsMetaAccess(`${message} ${rawDetail}`) && tenantId
              ? {
                  label: "Give access",
                  url: `/api/auth/meta/connect?tenant_id=${encodeURIComponent(tenantId)}&intent=ads_access`,
                }
              : undefined,
        },
      ]);
    } finally {
      setStrategistCreating(false);
    }
  }

  async function askStrategist(prompt?: string) {
    if (!tenantId) return;
    const finalPrompt = (prompt || strategistPrompt).trim();
    if (!finalPrompt) {
      setStrategistError("Type a message first.");
      return;
    }
    if (logicChatNeedsMoreNomi) {
      setStrategistError(
        `Not enough Nomi's. Logic Chat needs ${logicChatNomiCost} Nomi's and you have ${nomiBalance}.`,
      );
      return;
    }
    const userMessage: StrategistChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: sanitizeChatText(finalPrompt),
    };
    const history = strategistMessages
      .filter((message) => message.id !== "welcome")
      .map((message) => ({ role: message.role, content: message.text }))
      .slice(-60);
    const latestAssistant = [...strategistMessages]
      .reverse()
      .find((message) => message.role === "assistant");
    const pastedUrl =
      finalPrompt.match(/https?:\/\/\S+/i)?.[0]?.replace(/[),.;]+$/, "") || "";
    if (
      pastedUrl &&
      latestAssistant?.text.toLowerCase().includes("landing page url")
    ) {
      setDestinationUrl(pastedUrl);
      setStrategistMessages((current) => [
        ...current,
        userMessage,
        {
          id: `assistant-campaign-mode-${Date.now()}`,
          role: "assistant",
          text: `Landing page set: ${pastedUrl}. Should this be a new campaign or should I use an existing campaign as the setup reference?`,
          campaignOptions: activeCampaigns.slice(0, 6),
          quickReplies: [
            "Create a new campaign draft",
            "Recommend setup from context",
          ],
          campaignResumePrompt:
            latestAssistant.campaignResumePrompt || "Start a campaign.",
        },
      ]);
      setStrategistPrompt("");
      return;
    }
    const productFromChat = resolveMentionedProduct(finalPrompt, history);
    if (productFromChat) setSelectedProductIds([productFromChat.id]);
    const selectedItemsForRequest = selectedCatalogItems.length
      ? selectedCatalogItems
      : productFromChat
        ? [productFromChat]
        : [];
    const mentionedCampaign = resolveMentionedCampaign(finalPrompt, history);
    const campaignForRequest =
      mentionedCampaign.match || activeStrategistCampaignContext;
    if (mentionedCampaign.match) {
      setSelectedCampaignId(mentionedCampaign.match.id);
      setStickyStrategistCampaign(mentionedCampaign.match);
    }
    if (!campaignForRequest && mentionedCampaign.options.length > 1) {
      setStrategistMessages((current) => [
        ...current,
        userMessage,
        {
          id: `assistant-campaign-options-${Date.now()}`,
          role: "assistant",
          text: "Which campaign do you mean? I found these active campaigns:",
          campaignOptions: mentionedCampaign.options,
          campaignResumePrompt: finalPrompt,
        },
      ]);
      setStrategistPrompt("");
      return;
    }
    if (isCreateConfirmation(finalPrompt)) {
      await executeStrategistCreate(finalPrompt, userMessage, history);
      return;
    }
    if (
      maybeAskForCampaignSetupInputs(finalPrompt, userMessage, productFromChat)
    )
      return;
    setStrategistMessages((current) => [...current, userMessage]);
    setStrategistPrompt("");
    setStrategistLoading(true);
    setStrategistError(null);
    try {
      const res = await apiPost<StrategistResponse>(
        "/api/ad-manager/strategist-chat",
        {
          tenant_id: tenantId,
          session_id: strategistSessionId,
          message: finalPrompt,
          history,
          selected_catalog_items: selectedItemsForRequest.map((item) => ({
            id: item.id,
            name: item.name,
            type: item.type,
            url: item.url,
            imageUrl: item.imageUrl,
            price: item.price,
            drive: item.drive,
            new: item.new,
          })),
          selected_campaign: campaignForRequest
            ? {
                id: campaignForRequest.id,
                name: campaignForRequest.name,
                status: campaignForRequest.status,
                objective: campaignForRequest.objective,
                spend: campaignForRequest.spend,
                impressions: campaignForRequest.impressions,
                clicks: campaignForRequest.clicks,
                roas: campaignForRequest.roas,
                purchases: campaignForRequest.purchases,
                purchaseValue: campaignForRequest.purchaseValue,
              }
            : null,
          available_campaigns: (campaignInsights?.campaigns || [])
            .slice(0, 25)
            .map((campaign) => ({
              id: campaign.id,
              name: campaign.name,
              status: campaign.status,
              objective: campaign.objective,
              spend: campaign.spend,
              purchases: campaign.purchases,
              roas: campaign.roas,
            })),
          campaign_signal: mentionedCampaign.match
            ? {
                summary: `Matched campaign from chat: ${mentionedCampaign.match.name}.`,
                metric: "Matched campaign",
              }
            : campaignSignal,
          selected_adset_template: selectedTemplateAdset
            ? {
                id: selectedTemplateAdset.id,
                name: selectedTemplateAdset.name,
                campaign_id: selectedTemplateAdset.campaign_id,
                daily_budget: selectedTemplateAdset.daily_budget,
                targeting: selectedTemplateAdset.targeting,
                promoted_object: selectedTemplateAdset.promoted_object,
                optimization_goal: selectedTemplateAdset.optimization_goal,
                billing_event: selectedTemplateAdset.billing_event,
                bid_strategy: selectedTemplateAdset.bid_strategy,
                bid_amount: selectedTemplateAdset.bid_amount,
              }
            : null,
          targeting_mode: targetingMode,
          draft_goal: draftGoal,
          campaign_mode: campaignMode,
          new_campaign: campaignMode === "new" ? newCampaignDraft : null,
          content_source: contentSource,
          destination_url: destinationUrl.trim(),
          creative_count: totalCreativeCount,
          ads_per_adset: adsPerAdSet,
          drive_ready_for_selection: driveReadyForSelection,
          campaign_context_label: campaignContextLabel,
          existing_personas: personaSuggestions,
        },
      );
      setStrategistResult(res);
      setStrategistMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: sanitizeChatText(res.reply),
          result: res,
        },
      ]);
      if (res.personas?.length) setSelectedPersonaId(res.personas[0].id);
      if (logicChatUsesNomi) void loadBilling();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Strategist request failed";
      setStrategistError(message);
      setStrategistMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          text: message,
        },
      ]);
    } finally {
      setStrategistLoading(false);
    }
  }

  function startNewChat() {
    if (!tenantId) return;
    const nextSessionId = createChatSessionId(tenantId);
    localStorage.setItem(`logic_ads_chat_session:${tenantId}`, nextSessionId);
    localStorage.setItem(
      `logic_ads_chat_messages:${tenantId}`,
      JSON.stringify([STRATEGIST_WELCOME_MESSAGE]),
    );
    setStrategistSessionId(nextSessionId);
    setStrategistMessages([STRATEGIST_WELCOME_MESSAGE]);
    setStrategistPrompt("");
    setStrategistResult(null);
    setStrategistError(null);
    setStickyStrategistCampaign(null);
  }

  function openAddCreativeModal() {
    setEditingAssetId(null);
    setAssetForm(emptyCreativeAssetForm(selectedProduct));
    setAssetModalOpen(true);
    setPendingArchiveAssetId(null);
  }

  function openEditCreativeModal(asset: CreativeLibraryAsset) {
    setEditingAssetId(String(asset.id));
    setAssetForm({
      id: String(asset.id),
      name: String(asset.name || ""),
      type: asset.type === "video" ? "video" : "image",
      status: asset.status || "ready",
      source_type: asset.source_type || "url",
      asset_url: String(asset.asset_url || ""),
      ratio: asset.ratio || "unknown",
      product_id: String(asset.product_id || ""),
      persona_id: String(asset.persona_id || ""),
      tags: parseAssetTags(asset.tags).join(", "),
      notes: String(asset.notes || ""),
      copy_hint: String(asset.copy_hint || ""),
      landing_page_url: String(asset.landing_page_url || ""),
    });
    setAssetModalOpen(true);
    setPendingArchiveAssetId(null);
  }

  async function saveCreativeAsset() {
    const product = productCatalogItems.find(
      (item) => item.id === assetForm.product_id,
    );
    const persona = savedPersonaSuggestions.find(
      (item) => item.id === assetForm.persona_id,
    );
    const payload = {
      tenant_id: tenantId,
      name: assetForm.name.trim(),
      type: assetForm.type,
      status: assetForm.status,
      source_type: assetForm.source_type,
      asset_url: assetForm.asset_url.trim(),
      ratio: assetForm.ratio,
      product_id: product?.id || null,
      product_name: product?.name || null,
      product_url: product?.url || null,
      persona_id: persona?.id || null,
      persona_name: persona?.name || null,
      tags: parseAssetTags(assetForm.tags),
      notes: assetForm.notes.trim() || null,
      copy_hint: assetForm.copy_hint.trim() || null,
      landing_page_url: assetForm.landing_page_url.trim() || null,
    };
    await runAction("asset-save", async () => {
      if (editingAssetId) {
        const res = await fetch(
          `/api/ad-manager/media-assets/${editingAssetId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(data.error || "Failed to update creative asset");
      } else {
        await apiPost("/api/ad-manager/media-assets", payload);
      }
      setAssetModalOpen(false);
      setEditingAssetId(null);
      setAssetForm(emptyCreativeAssetForm());
      return editingAssetId
        ? "Creative updated."
        : "Creative saved to the library.";
    });
  }

  function toggleAssetForPersona(personaId: string, assetId: string) {
    setSelectedAssetIdsByPersona((current) => {
      const existing = current[personaId] || [];
      const next = existing.includes(assetId)
        ? existing.filter((id) => id !== assetId)
        : [...existing, assetId];
      return { ...current, [personaId]: next };
    });
  }

  async function runAction(label: string, action: () => Promise<string>) {
    if (!tenantId) return;
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      const message = await action();
      setNotice(message);
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  async function saveDriveRootLink() {
    setSavingDriveRoot(true);
    setError(null);
    setNotice(null);
    setDriveRootStatus({
      tone: "info",
      text: "Scanning source root folder...",
    });
    try {
      if (!tenantId)
        throw new Error("Session not ready. Refresh the page and try again.");
      if (!driveRootUrlDraft.trim())
        throw new Error("Paste a source root folder link first.");
      if (driveScanNeedsMoreNomi)
        throw new Error(
          `Not enough Nomi's. Source scan needs ${driveScanNomiCost} Nomi's and you have ${nomiBalance}.`,
        );
      const res = await fetch("/api/ads/content-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          mode: "root",
          root_url: driveRootUrlDraft,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          data.error || `Source scan failed with HTTP ${res.status}`,
        );
      const freshRes = await fetch(
        `/api/ads/content-library?tenant_id=${encodeURIComponent(tenantId)}`,
        { cache: "no-store" },
      );
      const fresh = await freshRes.json().catch(() => null);
      if (!freshRes.ok || !fresh)
        throw new Error(
          fresh?.error || "Source root saved, but refresh failed",
        );
      setContentLibrary(fresh);
      const folderCount = data.folders || 0;
      const assetCount = data.assets || 0;
      if (!folderCount) {
        const message =
          "Source root folder scanned, but no matching product folders were found. Use a structure like Jeans / Photos / Product name and Jeans / Videos / Product name.";
        setDriveRootStatus({ tone: "error", text: message });
        setError(message);
      } else {
        const message = `Source scan complete. ${folderCount} product folders found, ${assetCount} total assets.`;
        setDriveRootStatus({ tone: "success", text: message });
        setNotice(message);
        void loadBilling();
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not scan source root folder";
      setDriveRootStatus({ tone: "error", text: message });
      setError(message);
    } finally {
      setSavingDriveRoot(false);
    }
  }

  async function saveDriveLinks(folder: ProductFolder) {
    if (!tenantId) return;
    const draft = driveLinkDrafts[folder.id] || { photoUrl: "", videoUrl: "" };
    setSavingDriveLink(folder.id);
    setError(null);
    setNotice(null);
    try {
      if ((draft.photoUrl || draft.videoUrl) && driveScanNeedsMoreNomi)
        throw new Error(
          `Not enough Nomi's. Source validation needs ${driveScanNomiCost} Nomi's and you have ${nomiBalance}.`,
        );
      const res = await fetch("/api/ads/content-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          catalog_id: folder.id,
          name: folder.name,
          type: folder.type || "product",
          photo_url: draft.photoUrl,
          video_url: draft.videoUrl,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save source links");
      const fresh = await fetch(
        `/api/ads/content-library?tenant_id=${encodeURIComponent(tenantId)}`,
        { cache: "no-store" },
      ).then((r) => r.json());
      setContentLibrary(fresh);
      setNotice("Source links saved.");
      if (draft.photoUrl || draft.videoUrl) void loadBilling();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save source links",
      );
    } finally {
      setSavingDriveLink(null);
    }
  }

  function buildAdBatch() {
    return runAction("batch", async () => {
      const createdPackage = await apiPost<{
        batch?: DbRow;
        creatives?: DbRow[];
        plan?: DbRow;
      }>("/api/ad-manager/batches", {
        tenant_id: tenantId,
        product_id: selectedProduct?.id,
        name: `${selectedCatalogLabel || "Catalog"} creative draft ${new Date().toLocaleDateString()}`,
        requested_formats: requestedCreativeFormats,
        template_ids: [],
        auto_create_package: true,
        generation_params: {
          source: "dashboard_generate_draft",
          catalog_type: "product",
          product_name: selectedCatalogLabel,
          product_folder_id: selectedProduct?.id,
          product_folder_url: selectedProduct?.url,
          selected_catalog_items: selectedCatalogItems.map((item) => ({
            id: item.id,
            name: item.name,
            type: item.type,
            url: item.url,
            imageUrl: item.imageUrl,
            price: item.price,
            drive: item.drive,
            new: item.new,
            source: item.source,
          })),
          selected_product_ids: selectedProducts.map((item) => item.id),
          campaign_mode: campaignMode,
          campaign_id: selectedCampaign?.id,
          campaign_name: campaignContextLabel,
          new_campaign:
            campaignMode === "new"
              ? { ...newCampaignDraft, status: "draft_pending_approval" }
              : null,
          persona: selectedPersona,
          persona_suggestions: selectedPersonaPool,
          ad_idea: selectedPersona?.angle,
          hook: selectedPersona?.hook,
          overlay: selectedPersona?.overlay,
          copy_direction: selectedPersona?.copy,
          goal: draftGoal,
          content_source: "review_later",
          media_workflow: "attach_or_generate_in_review",
          creative_asset_ids_by_persona: selectedAssetIdsByPersona,
          creative_media_type: creativeMediaType,
          creative_media_types: creativeMediaTypes,
          creative_aspect_ratio: creativeAspectRatio,
          requested_format: requestedCreativeFormat,
          selected_template_ids: [],
          selected_templates: selectedTemplates,
          creative_count: totalCreativeCount,
          ads_per_adset: adsPerAdSet,
          available_assets: {
            saved_assets: selectedLibraryAssetsByPersona,
            drive: selectedProduct?.drive,
            product_media: selectedProduct?.new,
          },
          targeting_source:
            targetingMode === "copy"
              ? "copied_existing_adset"
              : "custom_targeting",
          targeting_template: selectedTemplateAdset
            ? {
                id: selectedTemplateAdset.id,
                name: selectedTemplateAdset.name,
                campaign_id: selectedTemplateAdset.campaign_id || null,
              }
            : null,
          targeting_json: selectedTargetingJson,
        },
      });
      const nextBatchId = String(createdPackage?.batch?.id || "");
      if (nextBatchId) {
        setLatestCreatedBatch({
          id: nextBatchId,
          name: String(
            createdPackage?.batch?.name || draftGoal || "New ad package",
          ),
          count: Array.isArray(createdPackage?.creatives)
            ? createdPackage.creatives.length
            : totalCreativeCount,
        });
      }
      return campaignMode === "new"
        ? "New campaign ad package created. Review it below when you are ready."
        : "Campaign ad package created. Review it below when you are ready.";
    });
  }

  function deleteReviewBatch() {
    if (!pendingDeleteReviewBatchId) return Promise.resolve();
    return runAction(`delete-batch-${pendingDeleteReviewBatchId}`, async () => {
      await apiDelete(`/api/ad-manager/batches/${pendingDeleteReviewBatchId}`);
      if (selectedReviewBatchId === pendingDeleteReviewBatchId)
        setSelectedReviewBatchId("");
      setReviewDraftPickerId("");
      setPendingDeleteReviewBatchId(null);
      return "Draft deleted.";
    });
  }

  function runCreativeQc(
    creativeId: string | number,
    status: "approved" | "rejected",
  ) {
    return runAction(`qc-${status}-${creativeId}`, async () => {
      await apiPost(`/api/ad-manager/creatives/${creativeId}/qc`, {
        tenant_id: tenantId,
        status,
      });
      return status === "approved" ? "Creative approved." : "Creative deleted.";
    });
  }

  function createPlanCopy() {
    return runAction("copy", async () => {
      const targets = planCreatives.length
        ? planCreatives
        : firstCreative
          ? [firstCreative]
          : [];
      for (const creative of targets) {
        const preview = getCreativePreview(creative);
        await apiPost(`/api/ad-manager/creatives/${creative.id}/copy`, {
          tenant_id: tenantId,
          primary_text: String(
            preview.subtitle || "Clean product angle for a focused Meta ad.",
          ).slice(0, 124),
          headline: String(preview.title || "Product highlight").slice(0, 40),
          cta: "SHOP_NOW",
          selected: true,
        });
      }
      return `Selected copy created for ${targets.length} creative${targets.length === 1 ? "" : "s"}.`;
    });
  }

  function savePlanDestination() {
    return runAction("destination", async () => {
      const targets = planCreatives.length
        ? planCreatives
        : firstCreative
          ? [firstCreative]
          : [];
      for (const creative of targets) {
        await apiPost(`/api/ad-manager/creatives/${creative.id}/destination`, {
          tenant_id: tenantId,
          base_url: destinationUrl,
          utm_campaign: "ai_ad_manager",
        });
      }
      return `Destination URL validated and saved for ${targets.length} creative${targets.length === 1 ? "" : "s"}.`;
    });
  }

  function approvePlan() {
    if (!firstPlan) return Promise.resolve();
    return runAction("approve", async () => {
      await apiPost(`/api/ad-manager/plans/${firstPlan.id}/approve`, {
        tenant_id: tenantId,
      });
      return "Plan version approved.";
    });
  }

  function approvePlanCreatives() {
    return runAction("approve-creatives", async () => {
      for (const creative of planCreatives) {
        await apiPost(`/api/ad-manager/creatives/${creative.id}/qc`, {
          tenant_id: tenantId,
          status: "approved",
        });
      }
      return `Approved ${planCreatives.length} creative${planCreatives.length === 1 ? "" : "s"} in this plan.`;
    });
  }

  function runApprovedAds() {
    return runAction("run-ads", async () => {
      const result = await apiPost<{
        created: boolean;
        gate: { blockers: string[] };
      }>("/api/ad-manager/publish-jobs", {
        tenant_id: tenantId,
        plan_id: firstPlan?.id,
      });
      if (!result.created)
        return `Publish blocked: ${result.gate.blockers.join(" ")}`;
      return (
        (result as { message?: string }).message ||
        "Publish queued. Paused ads will appear in Meta Ads Manager as each item completes."
      );
    });
  }

  function renderRangeMetric(value: unknown) {
    if (!value || typeof value !== "object") return "";
    const lower = String((value as any).lower_bound || "").trim();
    const upper = String((value as any).upper_bound || "").trim();
    if (lower && upper) return `${lower} - ${upper}`;
    return lower || upper;
  }

  const logicAdsNavItems: AutomationNavItem[] = tabs
    .filter((tab) =>
      [
        "ads-manager",
        "chat",
        "recommendations",
        "create-ads",
        "creatives",
        "settings",
      ].includes(tab.id),
    )
    .map((tab) => ({
      id: tab.id,
      label: tab.label,
      icon: tab.icon,
      group: tab.id === "settings" ? "settings" : "primary",
      active:
        activeTab === tab.id ||
        (tab.id === "create-ads" && createFlowTabs.includes(activeTab)) ||
        (tab.id === "creatives" && creativesTabs.includes(activeTab)),
      onClick: () =>
        setActiveTab(
          tab.id === "create-ads" ? "generate" : tab.id,
        ),
    }));

  return (
    <div className="mx-auto w-full max-w-[1760px] space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground">
            <BarChart3 size={30} strokeWidth={1.8} className="text-primary" />
            Logic Ads
          </h1>
        </div>
      </div>

      {error && <Banner tone="error" text={error} />}
      {notice && <Banner tone="success" text={notice} />}

      <AutomationWorkspaceLayout items={logicAdsNavItems} variant="shadcn">
        <LogicWorkspaceToolbar
          title={activeTabData.label}
          description={activeTabData.description}
          refreshLabel={activeTab === "chat" ? "New chat" : "Refresh"}
          onRefresh={() =>
            activeTab === "chat" ? startNewChat() : void loadOverview()
          }
        />

        {loading && !overview ? (
          <div className="space-y-3">
            <Skeleton className="w-full h-10 max-w-md" />
            <Skeleton className="w-full h-48" />
            <Skeleton className="w-full h-48" />
          </div>
        ) : (
          <div className="space-y-6">
            {createFlowTabs.includes(activeTab) && (
              <LogicSubNav
                items={createAdsMenuItems.map((item) => ({
                  id: item.id,
                  label: item.label,
                  icon: item.icon,
                }))}
                activeId={
                  activeTab === "generate" || activeTab === "create-ads"
                    ? "generate"
                    : "post-ads"
                }
                onChange={setActiveTab}
                ariaLabel="Create ads sections"
              />
            )}

            {activeTab === "ads-manager" && (
              <AdsManagerTab
                activeCampaigns={activeCampaigns}
                campaignDays={campaignDays}
                onCampaignDaysChange={setCampaignDays}
                campaignDateLabel={campaignDateLabel}
                campaignInsights={campaignInsights}
                campaignInsightsLoading={campaignInsightsLoading}
                contentLibrary={contentLibrary}
                contentLibraryLoading={contentLibraryLoading}
                overview={overview}
                productCatalogItems={productCatalogItems}
                selectedCampaignId={selectedCampaignId}
                onSelectCampaign={setSelectedCampaignId}
                selectedProductIds={selectedProductIds}
                onSelectProduct={(productId) =>
                  setSelectedProductIds([productId])
                }
                personaCountForProduct={personaCountForProduct}
                brandDataScanHref={brandDataScanHref}
                metaStatus={metaStatus}
              />
            )}

            {activeTab === "recommendations" && (
              <RecommendationsTab
                logicActionCards={logicActionCards}
                campaignInsights={campaignInsights}
                campaignDateLabel={campaignDateLabel}
                visibleLogicActionCards={visibleLogicActionCards}
                logicActionGroups={logicActionGroups}
                expandedLogicActionGroups={expandedLogicActionGroups}
                dismissedLogicActionIds={dismissedLogicActionIds}
                dismissedLogicActionCount={dismissedLogicActionCount}
                showDismissedLogicActions={showDismissedLogicActions}
                onToggleShowDismissed={() =>
                  setShowDismissedLogicActions((value) => !value)
                }
                onRestoreDismissed={restoreLogicActionsForToday}
                onToggleGroup={toggleLogicActionGroup}
                onDismissAction={dismissLogicActionForToday}
                onTakeAction={(prompt) => {
                  setActiveTab("chat");
                  void askStrategist(prompt);
                }}
              />
            )}

            {activeTab === "creatives" && (
              <MyCreativesTab
                overview={overview}
                openActionCount={visibleLogicActionCards.length}
                creatives={overview?.latestCreatives || []}
                creativeSelectMode={creativeSelectMode}
                selectedCreativeIds={selectedCreativeIds}
                pendingBulkDeleteCreatives={pendingBulkDeleteCreatives}
                bulkCreativeDeleteError={bulkCreativeDeleteError}
                bulkDeletingCreatives={bulkDeletingCreatives}
                pendingDeleteCreativeId={pendingDeleteCreativeId}
                creativeDeleteError={creativeDeleteError}
                deletingCreativeId={deletingCreativeId}
                onToggleSelectMode={() => {
                  setCreativeSelectMode((current) => !current);
                  setPendingBulkDeleteCreatives(false);
                  setBulkCreativeDeleteError(null);
                  if (creativeSelectMode) setSelectedCreativeIds(new Set());
                }}
                onSelectAllVisible={() => {
                  const visibleIds = (overview?.latestCreatives || [])
                    .map((row) => String(row.id || ""))
                    .filter(Boolean);
                  const allVisibleSelected =
                    visibleIds.length > 0 &&
                    visibleIds.every((id) => selectedCreativeIds.has(id));
                  setSelectedCreativeIds(
                    allVisibleSelected ? new Set() : new Set(visibleIds),
                  );
                  setPendingBulkDeleteCreatives(false);
                  setBulkCreativeDeleteError(null);
                }}
                onStartBulkDelete={() => {
                  setPendingBulkDeleteCreatives(true);
                  setBulkCreativeDeleteError(null);
                }}
                onCancelBulkDelete={() => {
                  setPendingBulkDeleteCreatives(false);
                  setBulkCreativeDeleteError(null);
                }}
                onConfirmBulkDelete={async () => {
                  const ids = Array.from(selectedCreativeIds);
                  if (!ids.length) return;
                  setBulkDeletingCreatives(true);
                  setBulkCreativeDeleteError(null);
                  try {
                    await Promise.all(
                      ids.map((id) =>
                        apiDelete(`/api/ad-manager/creatives/${id}`),
                      ),
                    );
                    setOverview((current) =>
                      current
                        ? {
                            ...current,
                            counts: {
                              ...current.counts,
                              ad_creatives: Math.max(
                                0,
                                Number(current.counts.ad_creatives || 0) -
                                  ids.length,
                              ),
                            },
                            latestCreatives: current.latestCreatives.filter(
                              (row) => !selectedCreativeIds.has(String(row.id)),
                            ),
                          }
                        : current,
                    );
                    setSelectedCreativeIds(new Set());
                    setPendingBulkDeleteCreatives(false);
                    setCreativeSelectMode(false);
                    void loadOverview({ showLoading: false });
                  } catch (err) {
                    setBulkCreativeDeleteError(
                      err instanceof Error
                        ? err.message
                        : "Could not delete selected creatives",
                    );
                  } finally {
                    setBulkDeletingCreatives(false);
                  }
                }}
                onToggleCreativeSelection={(creativeId) => {
                  setSelectedCreativeIds((current) => {
                    const next = new Set(current);
                    if (next.has(creativeId)) next.delete(creativeId);
                    else next.add(creativeId);
                    return next;
                  });
                  setPendingBulkDeleteCreatives(false);
                  setBulkCreativeDeleteError(null);
                }}
                onOpenCreative={setOpenedCreative}
                onStartDeleteCreative={(creativeId) => {
                  setCreativeDeleteError(null);
                  setPendingDeleteCreativeId(creativeId);
                }}
                onCancelDeleteCreative={() => {
                  setPendingDeleteCreativeId(null);
                  setCreativeDeleteError(null);
                }}
                onConfirmDeleteCreative={async (creativeId) => {
                  setCreativeDeleteError(null);
                  setDeletingCreativeId(creativeId);
                  try {
                    await apiDelete(`/api/ad-manager/creatives/${creativeId}`);
                    setOverview((current) =>
                      current
                        ? {
                            ...current,
                            counts: {
                              ...current.counts,
                              ad_creatives: Math.max(
                                0,
                                Number(current.counts.ad_creatives || 0) - 1,
                              ),
                            },
                            latestCreatives: current.latestCreatives.filter(
                              (row) => String(row.id) !== creativeId,
                            ),
                          }
                        : current,
                    );
                    setSelectedCreativeIds((current) => {
                      const next = new Set(current);
                      next.delete(creativeId);
                      return next;
                    });
                    setPendingDeleteCreativeId(null);
                    void loadOverview({ showLoading: false });
                  } catch (err) {
                    setCreativeDeleteError(
                      err instanceof Error
                        ? err.message
                        : "Could not delete creative",
                    );
                  } finally {
                    setDeletingCreativeId(null);
                  }
                }}
              />
            )}

            {activeTab === "personas" && (
              <PersonasTab
                overview={overview}
                personaProductMode={personaProductMode}
                onPersonaProductModeChange={(mode) => {
                  setPersonaProductMode(mode);
                  setPersonaBuildError(null);
                }}
                personaSelectedProductIds={personaSelectedProductIds}
                onTogglePersonaProduct={(productId) => {
                  setPersonaSelectedProductIds((current) =>
                    current.includes(productId)
                      ? current.filter((id) => id !== productId)
                      : [...current, productId],
                  );
                  setPersonaBuildError(null);
                }}
                catalogSearchQuery={catalogSearchQuery}
                onCatalogSearchQueryChange={setCatalogSearchQuery}
                catalogSearchTerm={catalogSearchTerm}
                visibleCatalogItems={visibleCatalogItems}
                productCatalogItems={productCatalogItems}
                catalogLoading={
                  contentLibraryLoading || contentLibrary === null
                }
                brandDataScanHref={brandDataScanHref}
                personaProductInput={personaProductInput}
                onPersonaProductInputChange={setPersonaProductInput}
                personaProductDescription={personaProductDescription}
                onPersonaProductDescriptionChange={setPersonaProductDescription}
                personaCount={personaCount}
                onPersonaCountChange={setPersonaCount}
                personaBuildNeedsMoreNomi={personaBuildNeedsMoreNomi}
                personaBuildNomiCost={personaBuildNomiCost}
                nomiBalance={nomiBalance}
                onBuildPersonas={() => void buildPersonas()}
                personaBuildLoading={personaBuildLoading}
                personaReadingLabel={personaReadingLabel}
                personaReadingText={personaReadingText}
                personaReadingIndex={personaReadingIndex}
                personaBuildError={personaBuildError}
                personaBuildResult={personaBuildResult}
                expandedBuiltPersonaId={expandedBuiltPersonaId}
                onExpandedBuiltPersonaIdChange={setExpandedBuiltPersonaId}
                savedBuiltPersonaIds={savedBuiltPersonaIds}
                savingBuiltPersonaId={savingBuiltPersonaId}
                onSaveBuiltPersona={(persona) => void saveBuiltPersona(persona)}
                expandedGalleryPersonaId={expandedGalleryPersonaId}
                onExpandedGalleryPersonaIdChange={setExpandedGalleryPersonaId}
                pendingDeletePersonaId={pendingDeletePersonaId}
                onPendingDeletePersonaIdChange={setPendingDeletePersonaId}
                personaDeleteError={personaDeleteError}
                onPersonaDeleteErrorChange={setPersonaDeleteError}
                deletingPersonaId={deletingPersonaId}
                onConfirmDeletePersona={(personaId) =>
                  void deleteGalleryPersona(personaId)
                }
                onCancelDeletePersona={() => {
                  setPendingDeletePersonaId(null);
                  setPersonaDeleteError(null);
                }}
                connectedProductLabelForPersona={
                  connectedProductLabelForPersona
                }
                onGoToGenerate={() => {
                  setSelectedProductIds([]);
                  setActiveTab("generate");
                }}
              />
            )}

            {activeTab === "templates" && (
              <TemplatesTab
                templateName={templateName}
                onTemplateNameChange={setTemplateName}
                templateAccent={templateAccent}
                onTemplateAccentChange={setTemplateAccent}
                templateStyle={templateStyle}
                onTemplateStyleChange={setTemplateStyle}
                creativeMediaTypes={creativeMediaTypes}
                onCreativeMediaTypeSelection={setCreativeMediaTypeSelection}
                creativeAspectRatio={creativeAspectRatio}
                onUpdateTemplateFormat={updateTemplateFormat}
                mediaFormatLabel={mediaFormatLabel}
                onAddTemplateElement={addTemplateElement}
                templateCanvasRef={templateCanvasRef}
                onMoveTemplateDrag={moveTemplateDrag}
                onEndTemplateDrag={endTemplateDrag}
                templatePreviewRatioClass={templatePreviewRatioClass}
                templateSafeZonesEnabled={templateSafeZonesEnabled}
                onToggleTemplateSafeZones={setTemplateSafeZonesActive}
                activePlacementCrop={activePlacementCrop}
                activeSafeArea={activeSafeArea}
                activeSafeZoneLabel={activeSafeZoneLabel}
                templateGuides={templateGuides}
                templateElements={templateElements}
                selectedTemplateElementId={selectedTemplateElementId}
                onSelectTemplateElement={setSelectedTemplateElementId}
                selectedProductMediaUrl={selectedProductMediaUrl}
                onStartTemplateDrag={startTemplateDrag}
                selectedTemplateElement={selectedTemplateElement}
                onRemoveTemplateElement={removeTemplateElement}
                onUpdateTemplateElement={updateTemplateElement}
                onUploadTemplateLogo={uploadTemplateLogo}
                selectedElementMediaUrl={selectedElementMediaUrl}
                templateSafeZoneId={templateSafeZoneId}
                onUpdateTemplateSafeZone={updateTemplateSafeZone}
                onSaveTemplate={() => void saveTemplate()}
                templateBusy={busy === "template"}
                savedTemplates={savedTemplates}
                selectedTemplateIds={selectedTemplateIds}
                onToggleTemplateSelection={(templateId) =>
                  setSelectedTemplateIds((current) =>
                    current.includes(templateId)
                      ? current.filter((id) => id !== templateId)
                      : [...current, templateId],
                  )
                }
              />
            )}

            {activeTab === "generate" && (
              <>
                <GenerateTab
                  hasBrandScrape={hasBrandScrape}
                  brandDataScanHref={brandDataScanHref}
                  imageGenerationLoading={imageGenerationLoading}
                  imageGenerateBusy={busy === "image-generate"}
                  imageGenerationLoadingPreview={imageGenerationLoadingPreview}
                  stagedGeneratedCreatives={stagedGeneratedCreatives}
                  savingStagedCreatives={savingStagedCreatives}
                  onSaveStagedCreatives={() =>
                    void saveStagedGeneratedCreatives()
                  }
                  onDiscardStagedCreatives={() => {
                    setStagedGeneratedCreatives([]);
                    setStagedFeedback("");
                  }}
                  onOpenGeneratedCreative={setOpenedGeneratedCreative}
                  stagedFeedback={stagedFeedback}
                  onStagedFeedbackChange={setStagedFeedback}
                  imageGenerationPrompt={imageGenerationPrompt}
                  onImageGenerationPromptChange={setImageGenerationPrompt}
                  imageGenerationModel={imageGenerationModel}
                  onImageGenerationModelChange={setImageGenerationModel}
                  creativeAspectRatio={creativeAspectRatio}
                  onCreativeAspectRatioChange={updateTemplateFormat}
                  creativeCount={creativeCount}
                  onCreativeCountChange={setCreativeCount}
                  imageGenerationReferenceSource={imageGenerationReferenceSource}
                  onImageGenerationReferenceSourceChange={
                    setImageGenerationReferenceSource
                  }
                  imageGenerationReferenceName={imageGenerationReferenceName}
                  imageGenerationReferenceDataUrl={
                    imageGenerationReferenceDataUrl
                  }
                  onReferenceUpload={(name, dataUrl) => {
                    setImageGenerationReferenceSource("upload");
                    setImageGenerationReferenceName(name);
                    setImageGenerationReferenceDataUrl(dataUrl);
                  }}
                  onClearReferenceUpload={() => {
                    setImageGenerationReferenceName("");
                    setImageGenerationReferenceDataUrl("");
                  }}
                  productCatalogItems={productCatalogItems}
                  selectedProduct={selectedProduct}
                  onSelectProduct={(productId) =>
                    setSelectedProductIds([productId])
                  }
                  imageGenerationNeedsMoreNomi={imageGenerationNeedsMoreNomi}
                  imageGenerationNomiCostTotal={imageGenerationNomiCostTotal}
                  imageGenerationNomiCostPerImage={
                    imageGenerationNomiCostPerImage
                  }
                  imageGenerationCount={imageGenerationCount}
                  nomiBalance={nomiBalance}
                  generateDisabled={
                    Boolean(busy) ||
                    imageGenerationNeedsMoreNomi ||
                    (stagedGeneratedCreatives.length
                      ? !stagedFeedback.trim()
                      : !imageGenerationPrompt.trim())
                  }
                  onGenerateImages={generateImages}
                  creativeAssetCount={activeCreativeLibraryAssets.length}
                  showAssetManager={showAssetManager}
                  onToggleAssetManager={() =>
                    setShowAssetManager((value) => !value)
                  }
                />
                {showAssetManager ? (
                  <CreativeLibraryTab
                    productCatalogItems={productCatalogItems}
                    savedPersonaSuggestions={savedPersonaSuggestions}
                    creativeLibraryAssets={creativeLibraryAssets}
                    filteredCreativeLibraryAssets={filteredCreativeLibraryAssets}
                    assetSearchQuery={assetSearchQuery}
                    onAssetSearchQueryChange={setAssetSearchQuery}
                    assetProductFilter={assetProductFilter}
                    onAssetProductFilterChange={setAssetProductFilter}
                    assetPersonaFilter={assetPersonaFilter}
                    onAssetPersonaFilterChange={setAssetPersonaFilter}
                    assetTypeFilter={assetTypeFilter}
                    onAssetTypeFilterChange={setAssetTypeFilter}
                    assetRatioFilter={assetRatioFilter}
                    onAssetRatioFilterChange={setAssetRatioFilter}
                    assetStatusFilter={assetStatusFilter}
                    onAssetStatusFilterChange={setAssetStatusFilter}
                    pendingArchiveAssetId={pendingArchiveAssetId}
                    onPendingArchiveAssetIdChange={setPendingArchiveAssetId}
                    archiveBusy={Boolean(busy)}
                    onOpenAddCreativeModal={openAddCreativeModal}
                    onOpenEditCreativeModal={openEditCreativeModal}
                    onArchiveAsset={(assetId) =>
                      void runAction(`archive-asset-${assetId}`, async () => {
                        await apiDelete(
                          `/api/ad-manager/media-assets/${assetId}?tenant_id=${encodeURIComponent(tenantId)}`,
                        );
                        setPendingArchiveAssetId(null);
                        return "Creative archived.";
                      })
                    }
                  />
                ) : null}
              </>
            )}

            {(activeTab === "chat" || activeTab === "post-ads") && (
              <ChatPostAdsTab
                activeTab={activeTab === "chat" ? "chat" : "post-ads"}
                hasBrandScrape={hasBrandScrape}
                brandDataScanHref={brandDataScanHref}
                strategistListRef={strategistListRef}
                strategistScrollTargetRef={strategistScrollTargetRef}
                strategistMessages={strategistMessages}
                setStrategistMessages={setStrategistMessages}
                strategistLoading={strategistLoading}
                strategistCreating={strategistCreating}
                productCatalogItems={productCatalogItems}
                selectedCatalogItems={selectedCatalogItems}
                landingOptionsFor={landingOptionsFor}
                setSelectedProductIds={setSelectedProductIds}
                setDestinationUrl={setDestinationUrl}
                askStrategist={askStrategist}
                setCampaignMode={setCampaignMode}
                setSelectedCampaignId={setSelectedCampaignId}
                setStickyStrategistCampaign={setStickyStrategistCampaign}
                createPromptForMessage={createPromptForMessage}
                messageHasCreateCta={messageHasCreateCta}
                strategistQuickPrompts={strategistQuickPrompts}
                logicChatNeedsMoreNomi={logicChatNeedsMoreNomi}
                logicChatUsesNomi={logicChatUsesNomi}
                logicChatNomiCost={logicChatNomiCost}
                nomiBalance={nomiBalance}
                strategistPrompt={strategistPrompt}
                setStrategistPrompt={setStrategistPrompt}
                selectedCatalogCount={selectedCatalogCount}
                selectedCatalogLabel={selectedCatalogLabel}
                hasCampaignContext={hasCampaignContext}
                strategistError={strategistError}
                campaignMode={campaignMode}
                selectedCampaignId={selectedCampaignId}
                activeCampaigns={activeCampaigns}
                newCampaignName={newCampaignName}
                setNewCampaignName={setNewCampaignName}
                newCampaignObjective={newCampaignObjective}
                setNewCampaignObjective={setNewCampaignObjective}
                newCampaignBuyingType={newCampaignBuyingType}
                setNewCampaignBuyingType={setNewCampaignBuyingType}
                newCampaignStatus={newCampaignStatus}
                setNewCampaignStatus={setNewCampaignStatus}
                newCampaignBudgetMode={newCampaignBudgetMode}
                setNewCampaignBudgetMode={setNewCampaignBudgetMode}
                newCampaignBudgetType={newCampaignBudgetType}
                setNewCampaignBudgetType={setNewCampaignBudgetType}
                newCampaignBudget={newCampaignBudget}
                setNewCampaignBudget={setNewCampaignBudget}
                newCampaignBidStrategy={newCampaignBidStrategy}
                setNewCampaignBidStrategy={setNewCampaignBidStrategy}
                newCampaignOptimizationGoal={newCampaignOptimizationGoal}
                setNewCampaignOptimizationGoal={setNewCampaignOptimizationGoal}
                newCampaignBidAmount={newCampaignBidAmount}
                setNewCampaignBidAmount={setNewCampaignBidAmount}
                newCampaignSpendLimit={newCampaignSpendLimit}
                setNewCampaignSpendLimit={setNewCampaignSpendLimit}
                newCampaignStartDate={newCampaignStartDate}
                setNewCampaignStartDate={setNewCampaignStartDate}
                newCampaignEndDate={newCampaignEndDate}
                setNewCampaignEndDate={setNewCampaignEndDate}
                newCampaignAttribution={newCampaignAttribution}
                setNewCampaignAttribution={setNewCampaignAttribution}
                newCampaignSpecialAdCategory={newCampaignSpecialAdCategory}
                setNewCampaignSpecialAdCategory={
                  setNewCampaignSpecialAdCategory
                }
                newCampaignMarkets={newCampaignMarkets}
                setNewCampaignMarkets={setNewCampaignMarkets}
                newCampaignAbTest={newCampaignAbTest}
                setNewCampaignAbTest={setNewCampaignAbTest}
                draftGoal={draftGoal}
                setDraftGoal={setDraftGoal}
                mediaFormatLabel={mediaFormatLabel}
                creativeMediaTypes={creativeMediaTypes}
                setCreativeMediaTypeSelection={setCreativeMediaTypeSelection}
                creativeAspectRatio={creativeAspectRatio}
                updateTemplateFormat={updateTemplateFormat}
                catalogSearchQuery={catalogSearchQuery}
                setCatalogSearchQuery={setCatalogSearchQuery}
                visibleCatalogItems={visibleCatalogItems}
                selectedProductIds={selectedProductIds}
                hasLinkedDriveContent={hasLinkedDriveContent}
                personaCountForProduct={personaCountForProduct}
                catalogSearchTerm={catalogSearchTerm}
                targetingMode={targetingMode}
                setTargetingMode={setTargetingMode}
                selectedTemplateAdsetId={selectedTemplateAdsetId}
                setSelectedTemplateAdsetId={setSelectedTemplateAdsetId}
                adsetsLoading={adsetsLoading}
                existingAdsets={existingAdsets}
                adsetsError={adsetsError}
                selectedTemplateAdset={selectedTemplateAdset}
                customTargetCountries={customTargetCountries}
                setCustomTargetCountries={setCustomTargetCountries}
                customTargetAgeMin={customTargetAgeMin}
                setCustomTargetAgeMin={setCustomTargetAgeMin}
                customTargetAgeMax={customTargetAgeMax}
                setCustomTargetAgeMax={setCustomTargetAgeMax}
                customTargetGender={customTargetGender}
                setCustomTargetGender={setCustomTargetGender}
                selectedPersonaPool={selectedPersonaPool}
                adsPerAdSet={adsPerAdSet}
                setAdsPerAdSet={setAdsPerAdSet}
                adSetCount={adSetCount}
                requestedCreativeCount={requestedCreativeCount}
                displayedPersonaSuggestions={displayedPersonaSuggestions}
                effectiveSelectedPersonaIds={effectiveSelectedPersonaIds}
                setSelectedPersonaId={setSelectedPersonaId}
                setSelectedPersonaIds={setSelectedPersonaIds}
                onOpenPersonasTab={() => setActiveTab("personas")}
                strategistResult={strategistResult}
                busy={busy}
                onBuildBatch={() => void buildAdBatch()}
                batchProgressStep={batchProgressStep}
                latestCreatedBatch={latestCreatedBatch}
                onOpenReviewTab={() => setActiveTab("review")}
              />
            )}

            {resultTabs.includes(activeTab) && (
              <ResultsTab
                tenantId={tenantId}
                busy={busy}
                overview={overview}
                selectedReviewBatch={selectedReviewBatch}
                reviewDraftPickerId={reviewDraftPickerId}
                onReviewDraftPickerIdChange={(value) => {
                  setReviewDraftPickerId(value);
                  setPendingDeleteReviewBatchId(null);
                }}
                reviewDraftOptions={reviewDraftOptions}
                onOpenReviewDraft={() =>
                  setSelectedReviewBatchId(reviewDraftPickerId)
                }
                onRequestDeleteReviewDraft={() =>
                  setPendingDeleteReviewBatchId(reviewDraftPickerId)
                }
                pendingDeleteReviewBatchId={pendingDeleteReviewBatchId}
                reviewDraftPickerBatch={reviewDraftPickerBatch}
                onCancelDeleteReviewDraft={() =>
                  setPendingDeleteReviewBatchId(null)
                }
                onConfirmDeleteReviewDraft={() => void deleteReviewBatch()}
                selectedReviewBatchId={selectedReviewBatchId}
                onClearReviewBatchFilter={() => setSelectedReviewBatchId("")}
                reviewCreatives={reviewCreatives}
                onCreativeQc={(creativeId, status) =>
                  void runCreativeQc(creativeId, status)
                }
                planCreatives={planCreatives}
                firstCreative={firstCreative}
                onCreatePlanCopy={() => void createPlanCopy()}
                destinationUrl={destinationUrl}
                onDestinationUrlChange={setDestinationUrl}
                onSavePlanDestination={() => void savePlanDestination()}
                firstPlan={firstPlan}
                onContinueToCopyUrl={() => setActiveTab("copy-url")}
                planApprovalBlocked={planApprovalBlocked}
                copyDestinationBlockers={copyDestinationBlockers}
                onApprovePlan={() => void approvePlan()}
                onApprovePlanCreatives={() => void approvePlanCreatives()}
                onRunApprovedAds={() => void runApprovedAds()}
                onRetryPublish={handleRetryPublish}
                retryBusyId={retryBusyId}
              />
            )}

            {activeTab === "settings" && (
              <div className="space-y-4">
                <Panel title="Plans & Nomi's" clean>
                  <div className="p-5 ai-hero md:p-7">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_74%_42%,rgba(219,234,254,.55)_0%,rgba(239,246,255,.30)_38%,rgba(255,255,255,0)_74%),linear-gradient(115deg,#ffffff_0%,#fbfdff_54%,#eef7ff_100%)]" />
                    <div className="absolute -right-32 top-4 h-80 w-80 rounded-full bg-sky-100/30 blur-[80px]" />
                    <div className="relative grid gap-6 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
                      <div>
                        <h3 className="text-3xl font-black tracking-tight text-gray-950 md:text-5xl">
                          Nomi's power your AI work.
                        </h3>
                        <p className="max-w-2xl mt-3 text-sm font-medium leading-6 text-gray-600 md:text-base">
                          Nomi's are used only when Logic Ads spends real AI or
                          compute.
                        </p>
                      </div>
                      <div className="flex flex-col items-center justify-center gap-5 sm:flex-row lg:justify-end">
                        <div
                          className="relative w-56 h-56 nomi-coin-stage shrink-0 perspective-distant md:h-64 md:w-64"
                          aria-label="Floating 3D Nomi coin"
                        >
                          <div className="absolute inset-0 nomi-coin-float">
                            <div className="absolute inset-0 nomi-coin-turn">
                              <img
                                src="/logic-ads/nomi-coin-3d.png"
                                alt=""
                                className="relative object-contain w-full h-full"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="rounded-[24px] border border-white/80 bg-white/75 px-5 py-4 text-right shadow-[0_18px_50px_rgba(15,23,42,.08)] backdrop-blur">
                          <div className="text-xs font-black tracking-wide text-blue-600 uppercase">
                            Nomi balance
                          </div>
                          <div className="mt-1 text-5xl font-black tracking-tight text-gray-950">
                            {billingLoading
                              ? "..."
                              : (creditAccount?.balance ?? 0)}
                          </div>
                          <div className="mt-1 text-xs font-bold text-gray-500">
                            ready for this automation
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {billingMessage && (
                    <div className="px-4 py-3 text-sm font-semibold text-blue-800 border border-blue-100 rounded-xl bg-blue-50">
                      {billingMessage}
                    </div>
                  )}
                  <div className="grid gap-4 lg:grid-cols-3">
                    {billingPlans.map((plan) => {
                      const active = creditAccount?.plan === plan.id;
                      const isBusy = billingBusy === plan.id;
                      const planTone =
                        plan.id === "scale"
                          ? "from-gray-950 via-slate-900 to-blue-950 text-white"
                          : plan.id === "growth"
                            ? "from-blue-600 via-blue-500 to-cyan-400 text-white"
                            : "from-white via-blue-50 to-white text-gray-950";
                      return (
                        <div
                          key={plan.id}
                          className={`relative overflow-hidden rounded-[24px] border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(15,23,42,.10)] ${active ? "border-blue-300 ring-4 ring-blue-50" : "border-gray-200 bg-white"}`}
                        >
                          <div
                            className={`absolute inset-x-0 top-0 h-32 bg-linear-to-br ${planTone}`}
                          />
                          <div className="relative">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div
                                  className={`text-xs font-black uppercase tracking-wide ${plan.id === "launch" ? "text-blue-600" : "text-white/70"}`}
                                >
                                  Nomi pass
                                </div>
                                <div
                                  className={`mt-1 text-2xl font-black ${plan.id === "launch" ? "text-gray-950" : "text-white"}`}
                                >
                                  {plan.name}
                                </div>
                              </div>
                              {active && (
                                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-blue-700 shadow-sm">
                                  Current
                                </span>
                              )}
                            </div>
                            <div className="mt-8 rounded-[20px] border border-white/70 bg-white/90 p-4 shadow-[0_16px_45px_rgba(15,23,42,.08)] backdrop-blur">
                              <p className="text-sm font-semibold leading-5 text-gray-600 min-h-10">
                                {nomiText(plan.description)}
                              </p>
                              <div className="flex items-end gap-1 mt-5">
                                <span className="text-3xl font-black tracking-tight text-gray-950">
                                  EUR {plan.price}
                                </span>
                                <span className="pb-1 text-xs font-bold text-gray-500">
                                  /mo
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  postBillingAction({
                                    action: "set_plan",
                                    plan_id: plan.id,
                                  })
                                }
                                disabled={active || Boolean(billingBusy)}
                                className="mt-5 w-full rounded-2xl bg-gray-950 px-4 py-3 text-sm font-black text-white shadow-[0_14px_35px_rgba(15,23,42,.18)] hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
                              >
                                {isBusy
                                  ? "Updating..."
                                  : active
                                    ? "Active plan"
                                    : plan.price === 0
                                      ? "Switch to free"
                                      : "Choose plan"}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {!billingPlans.length && (
                      <div className="p-4 text-sm font-semibold text-gray-500 bg-white border border-gray-200 rounded-xl lg:col-span-3">
                        {billingLoading
                          ? "Loading plans..."
                          : "Plans are not available right now."}
                      </div>
                    )}
                  </div>
                  {billingPlans.length ? (
                    <div className="overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-sm">
                      <div className="px-5 py-4 border-b border-gray-100">
                        <div className="text-lg font-black text-gray-950">
                          Compare plans
                        </div>
                        <p className="mt-1 text-xs font-semibold text-gray-500">
                          What each Nomi pass opens inside Logic Ads.
                        </p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] border-collapse text-sm">
                          <thead>
                            <tr className="bg-gray-50/80">
                              <th className="w-[30%] px-5 py-4 text-left text-xs font-black uppercase tracking-wide text-gray-500">
                                Feature
                              </th>
                              {billingPlans.map((plan) => {
                                const tablePlanTone =
                                  plan.id === "scale"
                                    ? "bg-linear-to-br from-gray-950 via-slate-900 to-blue-950 text-white ring-slate-900/10"
                                    : plan.id === "growth"
                                      ? "bg-linear-to-br from-blue-600 via-blue-500 to-cyan-400 text-white ring-blue-200/60"
                                      : "bg-linear-to-br from-white via-blue-50 to-white text-gray-950 ring-blue-100";
                                return (
                                  <th
                                    key={plan.id}
                                    className="px-4 py-4 text-center"
                                  >
                                    <div
                                      className={`mx-auto inline-flex min-w-28 items-center justify-center rounded-2xl px-4 py-2 text-sm font-black shadow-[0_12px_30px_rgba(15,23,42,.08)] ring-1 ${tablePlanTone} ${plan.id === creditAccount?.plan ? "ring-4 ring-blue-100" : ""}`}
                                    >
                                      {plan.name}
                                    </div>
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              {
                                label: "Monthly Nomi's",
                                get: (plan: BillingPlan) =>
                                  `${plan.monthlyCredits}`,
                              },
                              {
                                label: "Actions",
                                get: (plan: BillingPlan) =>
                                  plan.id === "launch" ? "nomi" : "free",
                              },
                              {
                                label: "Logic Chat",
                                get: (plan: BillingPlan) =>
                                  plan.id === "growth" || plan.id === "scale"
                                    ? "free"
                                    : "nomi",
                              },
                              { label: "Create Ads", get: () => "nomi" },
                            ].map((row) => (
                              <tr
                                key={row.label}
                                className="border-t border-gray-100"
                              >
                                <td className="px-5 py-4 font-bold text-gray-900">
                                  {row.label}
                                </td>
                                {billingPlans.map((plan) => {
                                  const value = row.get(plan);
                                  return (
                                    <td
                                      key={plan.id}
                                      className="px-4 py-4 text-center"
                                    >
                                      {value === "nomi" ? (
                                        <span
                                          className="flex items-center justify-center w-12 h-12 mx-auto"
                                          aria-label="Nomi"
                                        >
                                          <img
                                            src="/logic-ads/nomi-coin-table.png"
                                            alt=""
                                            className="object-contain w-full h-full"
                                          />
                                        </span>
                                      ) : value === "free" ? (
                                        <span className="inline-flex justify-center px-3 py-1 text-xs font-black tracking-wide uppercase rounded-full min-w-16 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                                          Free
                                        </span>
                                      ) : (
                                        <span className="inline-flex justify-center px-3 py-1 text-sm font-black text-blue-700 rounded-full min-w-16 bg-blue-50 ring-1 ring-blue-100">
                                          {value}
                                        </span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                  <div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
                    <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-lg font-black text-gray-950">
                            Nomi costs
                          </div>
                          <p className="mt-1 text-xs font-semibold text-gray-500">
                            Only actions that create AI output or trigger heavy
                            compute spend Nomi's.
                          </p>
                        </div>
                        <span className="px-3 py-1 text-xs font-black text-white rounded-full bg-gray-950">
                          fair use
                        </span>
                      </div>
                      <div className="grid gap-3 mt-4 sm:grid-cols-2">
                        {[
                          [
                            "Create ads",
                            creditCosts.ai_creative,
                            "per generated AI visual",
                          ],
                          [
                            "AI personas",
                            creditCosts.ai_personas,
                            "per persona build",
                          ],
                          [
                            "Logic Chat",
                            creditCosts.logic_chat,
                            "per strategist reply on Launch",
                          ],
                          [
                            "Brand scrape",
                            creditCosts.brand_scan,
                            "per website scan",
                          ],
                          [
                            "Source scan",
                            creditCosts.drive_scan,
                            "per folder scan",
                          ],
                        ].map(([label, credits, detail]) => (
                          <div
                            key={String(label)}
                            className="px-4 py-3 border border-gray-100 shadow-sm rounded-2xl bg-linear-to-br from-gray-50 to-white"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-bold text-gray-900">
                                {label}
                              </span>
                              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-blue-700 shadow-sm">
                                {Number(credits || 0)} N
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-gray-500">
                              {detail}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-[24px] border border-blue-100 bg-[linear-gradient(145deg,#ffffff,#eff6ff)] p-5 shadow-sm">
                      <div className="text-lg font-black text-gray-950">
                        Buy Nomi's
                      </div>
                      <p className="mt-1 text-xs font-semibold text-gray-500">
                        Packs are added instantly for now. Payment connection
                        comes later.
                      </p>
                      <div className="mt-3 space-y-2">
                        {topUpPacks.map((pack) => (
                          <button
                            key={pack.id}
                            type="button"
                            onClick={() =>
                              postBillingAction({
                                action: "top_up",
                                pack_id: pack.id,
                              })
                            }
                            disabled={Boolean(billingBusy)}
                            className="flex items-center justify-between w-full px-4 py-3 text-left border border-white shadow-sm rounded-2xl bg-white/80 hover:border-blue-200 hover:bg-white disabled:opacity-60"
                          >
                            <span>
                              <span className="block text-sm font-black text-gray-950">
                                {pack.credits} Nomi's
                              </span>
                              <span className="text-xs font-semibold text-gray-500">
                                {billingBusy === pack.id
                                  ? "adding to balance..."
                                  : "instant automation balance"}
                              </span>
                            </span>
                            <span className="text-sm font-black text-blue-700">
                              EUR {pack.price}
                            </span>
                          </button>
                        ))}
                        {!topUpPacks.length && (
                          <div className="px-3 py-2 text-sm font-semibold text-gray-500 rounded-lg bg-gray-50">
                            No Nomi packs available.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-sm">
                    <div className="px-5 py-4 text-sm font-black border-b border-gray-100 text-gray-950">
                      Recent Nomi activity
                    </div>
                    {(creditAccount?.ledger || [])
                      .slice(-5)
                      .reverse()
                      .map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-100 last:border-b-0"
                        >
                          <div>
                            <div className="text-sm font-bold text-gray-900">
                              {nomiText(item.label)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(item.at).toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </div>
                          <div
                            className={`text-sm font-black ${item.amount >= 0 ? "text-emerald-600" : "text-gray-900"}`}
                          >
                            {item.amount > 0 ? "+" : ""}
                            {item.amount}
                          </div>
                        </div>
                      ))}
                    {!creditAccount?.ledger?.length && (
                      <div className="px-5 py-6 text-sm font-semibold text-gray-500">
                        No Nomi activity yet.
                      </div>
                    )}
                  </div>
                </Panel>
                <AppSettingsPanel
                  appId="ai-ad-manager"
                  appName="Logic Ads"
                  settingsName="Ad settings"
                  tenantId={tenantId}
                  directory="/dashboard/ads"
                  setupHref="/dashboard/meta-setup?module=ads&next=/dashboard/ads"
                  settingsHref="/dashboard/settings?tab=brand-data"
                  description="Manage campaign preferences, Meta setup and the shared Brand Data that feeds products, collections and content into this module."
                  integrations={[
                    {
                      provider: "meta",
                      label: "Meta Ads",
                      href: "/dashboard/meta-setup?module=ads&next=/dashboard/ads",
                      required: true,
                    },
                  ]}
                  compact
                />
                <Panel title="Catalog">
                  <div
                    className={`rounded-xl border p-4 text-sm mb-4 ${hasBrandScrape ? "border-blue-100 bg-blue-50 text-blue-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}
                  >
                    <div className="font-semibold">Product catalog source</div>
                    <p className="mt-1 text-blue-800">
                      Catalog starts from the central Brand Data scrape. It
                      should already contain products and collections. The
                      Ainomiq Library can add extra images and videos.
                    </p>
                    {!hasBrandScrape && (
                      <a
                        href={brandDataScanHref}
                        className="inline-flex px-3 py-2 mt-3 text-sm font-semibold text-white bg-blue-600 rounded-lg"
                      >
                        Analyze business
                      </a>
                    )}
                  </div>
                  {(contentLibrary?.sources?.brand_scrape ||
                    productCatalogItems.length > 0) && (
                    <div className="grid grid-cols-2 gap-3 mb-4 lg:grid-cols-4">
                      <MetricCard
                        label="Products"
                        value={
                          productCatalogItems.length ||
                          contentLibrary?.sources?.brand_scrape?.products ||
                          0
                        }
                      />
                      <MetricCard
                        label="Library linked"
                        value={linkedDriveProductCount}
                      />
                      <MetricCard
                        label="Need links"
                        value={missingDriveProductCount}
                      />
                      <MetricCard
                        label="Library assets"
                        value={contentLibrary?.totals?.new?.total || 0}
                      />
                    </div>
                  )}
                  <div className="p-4 mb-4 bg-white border border-gray-200 rounded-xl">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                      <label className="flex-1 space-y-2">
                        <span className="text-sm font-semibold text-gray-950">
                          Source root folder
                        </span>
                        <input
                          value={driveRootUrlDraft}
                          onChange={(event) =>
                            setDriveRootUrlDraft(event.target.value)
                          }
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                          placeholder="Paste one shared source folder link"
                        />
                      </label>
                      <div className="relative inline-flex group">
                        <div
                          className={`pointer-events-none absolute bottom-full right-0 z-30 mb-3 w-64 translate-y-1 rounded-2xl border bg-white p-3 text-left opacity-0 shadow-xl ring-1 transition duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 ${driveScanNeedsMoreNomi ? "border-red-100 shadow-red-950/10 ring-red-50" : "border-blue-100 shadow-blue-950/10 ring-blue-50"}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span
                              className={`text-xs font-black uppercase tracking-wide ${driveScanNeedsMoreNomi ? "text-red-600" : "text-blue-600"}`}
                            >
                              Source scan
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-black ring-1 ${driveScanNeedsMoreNomi ? "bg-red-50 text-red-700 ring-red-100" : "bg-blue-50 text-blue-700 ring-blue-100"}`}
                            >
                              {driveScanNomiCost} Nomi
                              {driveScanNomiCost === 1 ? "" : "'s"}
                            </span>
                          </div>
                          <p className="mt-2 text-xs font-semibold leading-5 text-gray-600">
                            Scans and matches the shared source root folder.
                          </p>
                          {driveScanNeedsMoreNomi ? (
                            <p className="mt-1 text-[11px] font-semibold text-red-600">
                              Balance {nomiBalance}. Need{" "}
                              {driveScanNomiCost - nomiBalance} more Nomi
                              {driveScanNomiCost - nomiBalance === 1
                                ? ""
                                : "'s"}
                              .
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => void saveDriveRootLink()}
                          disabled={savingDriveRoot || driveScanNeedsMoreNomi}
                          className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${driveScanNeedsMoreNomi ? "bg-gray-300" : "bg-blue-600 hover:bg-blue-700"}`}
                        >
                          {savingDriveRoot
                            ? "Scanning..."
                            : "Scan and auto-match"}
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      Share one root folder. Smart scan supports Product /
                      Photos / Videos, Category / Photos / Product, Category /
                      Videos / Product and standalone product folders.
                    </p>
                    {driveRootStatus && (
                      <div
                        className={`mt-3 rounded-lg border px-3 py-2 text-xs font-semibold ${driveRootStatus.tone === "error" ? "border-red-100 bg-red-50 text-red-800" : driveRootStatus.tone === "success" ? "border-green-100 bg-green-50 text-green-800" : "border-blue-100 bg-blue-50 text-blue-800"}`}
                      >
                        {driveRootStatus.text}
                      </div>
                    )}
                    {contentLibrary?.sources?.google_drive?.root_url && (
                      <div className="px-3 py-2 mt-3 text-xs font-semibold text-green-800 border border-green-100 rounded-lg bg-green-50">
                        Auto-match active:{" "}
                        {contentLibrary.sources.google_drive
                          .root_folder_count || 0}{" "}
                        source product folders found.
                      </div>
                    )}
                    {autoMatchedDriveIssues.length > 0 && (
                      <div className="p-3 mt-3 border rounded-lg border-amber-200 bg-amber-50">
                        <div className="text-xs font-bold tracking-wide uppercase text-amber-700">
                          Source link issues
                        </div>
                        <div className="grid gap-2 mt-2">
                          {autoMatchedDriveIssues
                            .slice(0, 8)
                            .map(({ folder, issues }) => (
                              <div
                                key={folder.id}
                                className="px-3 py-2 text-xs bg-white border rounded-lg border-amber-100"
                              >
                                <div className="font-semibold text-gray-900">
                                  {folder.name}
                                </div>
                                {folder.matchPath && (
                                  <div className="mt-1 text-gray-500">
                                    Matched path: {folder.matchPath}
                                  </div>
                                )}
                                <ul className="mt-2 space-y-1 text-amber-800">
                                  {issues.map((issue) => (
                                    <li key={issue}>{issue}</li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          {autoMatchedDriveIssues.length > 8 && (
                            <div className="text-xs font-semibold text-amber-700">
                              +{autoMatchedDriveIssues.length - 8} more folders
                              with link issues
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {(contentLibrary?.folders || []).length ? (
                    <div className="space-y-3">
                      <div className="p-4 bg-white border border-gray-200 rounded-xl">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <div className="text-sm font-black text-gray-950">
                              Products ({productCatalogItems.length})
                            </div>
                            <div className="mt-1 text-xs font-semibold text-gray-500">
                              Clean overview first. Open a product only when you
                              need to edit its source links.
                            </div>
                          </div>
                          <label className="flex items-center flex-1 min-w-0 gap-2 px-3 py-2 border border-gray-200 rounded-lg lg:max-w-sm">
                            <Search size={16} className="text-gray-400" />
                            <input
                              value={catalogSearchQuery}
                              onChange={(event) =>
                                setCatalogSearchQuery(event.target.value)
                              }
                              className="flex-1 min-w-0 text-sm outline-none"
                              placeholder="Search products..."
                            />
                          </label>
                        </div>
                      </div>
                      {visibleContentLinkItems.length > 0 && (
                        <div className="overflow-hidden bg-white border border-gray-200 divide-y divide-gray-100 rounded-xl">
                          {visibleContentLinkItems.map((folder) => {
                            const draft = driveLinkDrafts[folder.id] || {
                              photoUrl: folder.drive?.photoFolderUrl || "",
                              videoUrl: folder.drive?.videoFolderUrl || "",
                            };
                            const hasSavedDriveLinks = Boolean(
                              folder.drive?.manual ||
                              folder.drive?.photoFolderUrl ||
                              folder.drive?.videoFolderUrl,
                            );
                            const hasDraftLinks = Boolean(
                              draft.photoUrl.trim() || draft.videoUrl.trim(),
                            );
                            const isEmptyLinkedFolder =
                              hasSavedDriveLinks && !folder.drive?.available;
                            const isExpanded =
                              expandedDriveLinkProductId === folder.id;
                            const savedSummary = folder.drive?.available
                              ? `${folder.drive.images} photo${folder.drive.images === 1 ? "" : "s"}, ${folder.drive.videos} video${folder.drive.videos === 1 ? "" : "s"} linked`
                              : isEmptyLinkedFolder
                                ? "Source folder linked, but it is empty"
                                : "No source content linked yet";
                            return (
                              <div key={folder.id} className="p-4">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="font-semibold truncate text-gray-950">
                                        {folder.name}
                                      </div>
                                      {folder.source && (
                                        <span className="px-2 py-1 text-xs font-bold text-gray-600 bg-gray-100 rounded-full">
                                          {folder.source === "google_drive"
                                            ? "library"
                                            : folder.source}
                                        </span>
                                      )}
                                    </div>
                                    <div
                                      className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${folder.drive?.available ? "bg-green-50 text-green-700" : isEmptyLinkedFolder ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-600"}`}
                                    >
                                      {savedSummary}
                                    </div>
                                    {isEmptyLinkedFolder && (
                                      <div className="px-3 py-2 mt-2 text-xs font-semibold border rounded-lg border-amber-200 bg-amber-50 text-amber-800">
                                        Warning: this source folder has no
                                        usable photos or videos yet. Add content
                                        before using this product for ads.
                                      </div>
                                    )}
                                    {!isEmptyLinkedFolder &&
                                      hasDraftLinks &&
                                      !folder.drive?.available && (
                                        <div className="mt-2 text-xs text-gray-500">
                                          Save checks whether the linked folder
                                          contains content.
                                        </div>
                                      )}
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {folder.url && (
                                      <a
                                        href={folder.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="px-3 py-2 text-xs font-bold text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
                                      >
                                        Open product
                                      </a>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedDriveLinkProductId(
                                          isExpanded ? "" : folder.id,
                                        )
                                      }
                                      className="px-3 py-2 text-xs font-bold text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
                                    >
                                      {isExpanded
                                        ? "Close links"
                                        : "Edit source links"}
                                    </button>
                                  </div>
                                </div>
                                {isExpanded && (
                                  <div className="mt-4 grid grid-cols-1 gap-2 rounded-xl bg-gray-50 p-3 md:grid-cols-[1fr_1fr_auto]">
                                    <label className="space-y-1">
                                      <span className="text-xs font-semibold text-gray-600">
                                        Photo source link
                                      </span>
                                      <div className="flex gap-2">
                                        <input
                                          value={draft.photoUrl}
                                          onChange={(event) =>
                                            setDriveLinkDrafts((current) => ({
                                              ...current,
                                              [folder.id]: {
                                                ...(current[folder.id] || {
                                                  photoUrl: "",
                                                  videoUrl: "",
                                                }),
                                                photoUrl: event.target.value,
                                              },
                                            }))
                                          }
                                          className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-200 rounded-lg"
                                          placeholder="Paste photo folder link"
                                        />
                                      </div>
                                    </label>
                                    <label className="space-y-1">
                                      <span className="text-xs font-semibold text-gray-600">
                                        Video source link
                                      </span>
                                      <div className="flex gap-2">
                                        <input
                                          value={draft.videoUrl}
                                          onChange={(event) =>
                                            setDriveLinkDrafts((current) => ({
                                              ...current,
                                              [folder.id]: {
                                                ...(current[folder.id] || {
                                                  photoUrl: "",
                                                  videoUrl: "",
                                                }),
                                                videoUrl: event.target.value,
                                              },
                                            }))
                                          }
                                          className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-200 rounded-lg"
                                          placeholder="Paste video folder link"
                                        />
                                      </div>
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void saveDriveLinks(folder)
                                      }
                                      disabled={savingDriveLink === folder.id}
                                      className="self-end px-3 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg disabled:opacity-60"
                                    >
                                      {savingDriveLink === folder.id
                                        ? "Saving..."
                                        : "Save links"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {hiddenContentLinkItemCount > 0 && (
                        <div className="px-4 py-3 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl bg-gray-50">
                          Showing 12 products. {hiddenContentLinkItemCount} more
                          hidden by default. Use search to find a specific
                          product.
                        </div>
                      )}
                      {!contentLinkItems.length && (
                        <EmptyState
                          text={
                            catalogSearchTerm
                              ? "No products match this search."
                              : "No products found in Brand Data yet."
                          }
                        />
                      )}
                    </div>
                  ) : (
                    <EmptyState
                      text="No Catalog data yet. Analyze the business in General Settings so products and collections are loaded before campaign setup."
                      actionHref={brandDataScanHref}
                      actionLabel="Analyze business"
                    />
                  )}
                </Panel>
                <Panel title="Connected setup">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-950">
                        Meta Ads
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        {metaStatus?.connected &&
                        (metaStatus.accountIds?.length || metaStatus.accountId)
                          ? "Connected and ready for this automation."
                          : "Not set up yet. Connect Meta and select an ad account before this automation opens."}
                      </p>
                    </div>
                    <a
                      href="/dashboard/meta-setup?module=ads&next=/dashboard/ads"
                      className="px-4 py-2 text-sm font-semibold text-center text-white bg-blue-600 rounded-lg"
                    >
                      {metaStatus?.connected ? "Manage setup" : "Set Up"}
                    </a>
                  </div>
                </Panel>
              </div>
            )}
          </div>
        )}
      </AutomationWorkspaceLayout>
      <LogicAdsModals
        openedGeneratedCreative={openedGeneratedCreative}
        onCloseGeneratedCreative={() => setOpenedGeneratedCreative(null)}
        openedCreative={openedCreative}
        onCloseCreative={() => setOpenedCreative(null)}
        assetModalOpen={assetModalOpen}
        onCloseAssetModal={() => setAssetModalOpen(false)}
        editingAssetId={editingAssetId}
        assetForm={assetForm}
        onAssetFormChange={setAssetForm}
        productCatalogItems={productCatalogItems}
        savedPersonaSuggestions={savedPersonaSuggestions}
        assetSaveBusy={busy === "asset-save"}
        onSaveCreativeAsset={() => void saveCreativeAsset()}
      />
    </div>
  );
}

function getDriveLinkIssues(folder: ProductFolder) {
  const issues: string[] = [];
  const photoLinked = Boolean(
    folder.drive?.photoFolderUrl ||
    folder.drive?.photoFolderId ||
    folder.url ||
    (folder.new?.images || 0) > 0,
  );
  const videoLinked = Boolean(
    folder.drive?.videoFolderUrl ||
    folder.drive?.videoFolderId ||
    (folder.new?.videos || 0) > 0,
  );
  const photoHasFiles = (folder.drive?.images || folder.new?.images || 0) > 0;
  const videoHasFiles = (folder.drive?.videos || folder.new?.videos || 0) > 0;

  if (!photoLinked) {
    issues.push(
      "Photo not linked: no Photos or Images folder was found for this product.",
    );
  } else if (!photoHasFiles) {
    issues.push(
      "Photo not linked: the matched photo folder has no usable image files.",
    );
  }

  if (!videoLinked) {
    issues.push(
      "Video not linked: no Videos folder was found for this product.",
    );
  } else if (!videoHasFiles) {
    issues.push(
      "Video not linked: the matched video folder has no usable video files.",
    );
  }

  return issues;
}

function buildPersonaSuggestions(
  product?: ProductFolder,
  campaign?: Campaign,
): PersonaSuggestion[] {
  const productName = product?.name || "selected product";
  const itemType = "product";
  const performanceSignal =
    campaign && campaign.spend > 0
      ? `Campaign signal: ${formatCurrency(campaign.spend)} spend, ${campaign.roas.toFixed(2)}x ROAS, ${campaign.purchases} purchases`
      : "Campaign signal: no spend data loaded yet";

  return [
    {
      id: "problem-aware",
      name: "Problem-aware buyer",
      basedOn: `${itemType} pain point`,
      angle: `Show the exact problem ${productName} solves in daily use`,
      hook: `Still dealing with this?`,
      overlay: `The simple fix for ${productName}`,
      copy: `Call out the problem, show the product solving it fast, then ask them to try ${productName}. Keep it direct and practical.`,
      why: `Good when the ${itemType} has a clear before and after moment. ${performanceSignal}.`,
    },
    {
      id: "style-led",
      name: "Style-led shopper",
      basedOn: `${itemType} visual appeal`,
      angle: `Make ${productName} feel like the easiest style upgrade`,
      hook: `Small detail. Big difference.`,
      overlay: `${productName} makes the outfit`,
      copy: `Lead with the visual transformation, keep the copy short, and position ${productName} as an easy upgrade.`,
      why: `Good when scraped product images or collection pages are visually strong. ${performanceSignal}.`,
    },
    {
      id: "proof-seeker",
      name: "Proof seeker",
      basedOn: `${itemType} decision support`,
      angle: `Explain why ${productName} is worth clicking now`,
      hook: `Why people choose this one`,
      overlay: `See why ${productName} works`,
      copy: `Use clear benefits, simple proof points from the source page, and a low-pressure click to learn more.`,
      why: `Good when the customer needs clarity before buying or when the campaign needs more qualified clicks. ${performanceSignal}.`,
    },
    {
      id: "impulse-clicker",
      name: "Impulse clicker",
      basedOn: `${itemType} fast desire`,
      angle: `Make ${productName} feel instantly useful and easy to want`,
      hook: `This is the detail you notice first`,
      overlay: `Instant upgrade with ${productName}`,
      copy: `Keep the message short, visual and action-led. Make the click feel simple and low friction.`,
      why: `Good for fast mobile creative tests where the product benefit is visible in the first second. ${performanceSignal}.`,
    },
    {
      id: "collection-browser",
      name: "Collection browser",
      basedOn: `${itemType} exploration`,
      angle: `Show how ${productName} fits into a broader product or collection story`,
      hook: `Find the one that fits your style`,
      overlay: `Explore ${productName}`,
      copy: `Invite the customer to browse the selected collection or product set with a clean benefit-led reason to click.`,
      why: `Good when multiple products are selected or when the customer should compare styles before buying. ${performanceSignal}.`,
    },
    {
      id: "before-after",
      name: "Before and after buyer",
      basedOn: `${itemType} transformation`,
      angle: `Show the moment before ${productName} and the better moment after`,
      hook: `Before this. After this.`,
      overlay: `The change is obvious`,
      copy: `Frame the creative around contrast. Start with the pain or old situation, then show the improved result.`,
      why: `Good when Library visuals or generated visuals can show a strong transformation. ${performanceSignal}.`,
    },
    {
      id: "gift-finder",
      name: "Gift finder",
      basedOn: `${itemType} gifting`,
      angle: `Position ${productName} as a simple gift or add-on worth considering`,
      hook: `Easy to gift. Easy to love.`,
      overlay: `A small gift that feels useful`,
      copy: `Make the product feel thoughtful, simple and easy to add to cart without overexplaining.`,
      why: `Good when the product has broad appeal or works as an add-on. ${performanceSignal}.`,
    },
    {
      id: "skeptical-buyer",
      name: "Skeptical buyer",
      basedOn: `${itemType} objection handling`,
      angle: `Answer the main doubt someone may have before trying ${productName}`,
      hook: `Wondering if it actually works?`,
      overlay: `Simple, clear, no guesswork`,
      copy: `Use plain proof and a direct explanation. Remove uncertainty before asking for the click.`,
      why: `Good when the product needs clarity or the audience may not immediately understand it. ${performanceSignal}.`,
    },
  ];
}

function getDateRangeLabel(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days + 1);
  const format = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  if (days === 1) return `Today: ${format.format(end)}`;
  return `${format.format(start)} - ${format.format(end)}`;
}

