"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Layers3,
  Link2,
  Loader2,
  MessageCircle,
  Package,
  Pencil,
  Play,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import AutomationWorkspaceLayout, {
  type AutomationNavItem,
} from "@/components/AutomationWorkspaceLayout";
import type {
  BriefEditDraft,
  BrandProfile,
  BrandReferenceLink,
  CatalogItem,
  ChatMessage,
  CreativeOsState,
  CreativeOsWorkspaceProps,
  CreativeTask,
  DeliveredEdit,
  LaunchItem,
  LaunchStatus,
  PerformanceRecord,
  Product,
  ProductPermission,
  ProductRole,
  ReviewItem,
  ReviewStatus,
  SourceCreative,
  SourceStatus,
  StrategyListField,
  TaskDraft,
  TaskStatus,
} from "../types";
import {
  CREATIVE_STYLE_OPTIONS,
  SOURCE_GROUP_VALUE_PREFIX,
  blankProduct,
  createInitialTaskDraft,
  emptyState,
} from "../types";
import {
  defaultDueDate,
  formatChatTime,
  formatDate,
  normalizeFutureDueDate,
  nextWeekdayDate,
  parseDateParts,
  MONTH_OPTIONS,
  WEEKDAY_OPTIONS,
} from "../lib/dates";
import {
  extractGoogleDriveId,
  isGoogleDriveFileLink,
  isGoogleDriveFolderLink,
  isGoogleHostedSource,
  isAinomiqStoredSource,
  librarySourceOptions,
  sourceLibraryUrl,
  sourceMatchesFolderUrl,
  sourceMatchesUrl,
} from "../lib/library-urls";
import {
  approvedSourceUsageCount,
  catalogScopeKey,
  sourceBelongsToProduct,
  sourceGroupKey,
  sourceGroupKeyFromValue,
  sourceGroupName,
  sourceGroupValue,
  sourceIsEditable,
  sourceMatchesGroupKey,
  sourceRootGroupKey,
  sourceRootGroupName,
  sourceStatusLabel,
} from "../lib/sources";
import { CreativeLibraryGroupBrowser } from "./library/CreativeLibraryGroupBrowser";
import { LibraryPreviewModal } from "./library/LibraryPreviewModal";
import { EditorEmptyBriefsCard } from "./editor/EditorEmptyBriefsCard";
import { EditorInfoPanel } from "./editor/EditorInfoPanel";
import {
  BrandKnowledgeCard,
} from "./editor/EditorKnowledgeCards";
import { EditorDeliveredCard, EditorTaskCard } from "./editor/EditorTaskCard";
import {
  cleanCompanyName,
  editorAssigneeValue,
  looksLikeEmail,
  normalizeEmail,
  resolveBriefAssignee,
  catalogDisplayName,
  createCatalogGroup,
  collectionUrlForProduct,
  inferProductFieldSuggestions,
  firstRealValue,
  listMatchesAiSuggestion,
  normalizeAiProductFields,
  textMatchesAiSuggestion,
} from "../lib/products";
import {
  appendStrategyNote,
  appendUniqueOption,
  hasStrategyNote,
  mergeNotesWithStrategyContext,
  optionsText,
  parseMultilineOptions,
  removeOption,
  removeStrategyNote,
  strategyContextLines,
} from "../lib/strategy";
import { buildCreativeOsAdName } from "../lib/ad-naming";
import {
  deliveryDraftLineCount,
  deliveryDraftLines,
  deliveryPreviewHelp,
  deliveryPreviewLabel,
  deliverySourceHelp,
  deliverySourceLabel,
  findDeliveredSource,
  findDeliveredSources,
  isReturningBrief,
  outputCountLabel,
  parseDeliveryLinks,
  sourceCreativeIdList,
  sourceUsedUrlList,
  taskChatRoomId,
  taskLegacyParticipantChatRoomId,
  taskParticipantChatRoomId,
  briefEditHasStructuralChanges,
  taskScheduleLabel,
  taskSourceLabel,
} from "../lib/tasks";
import {
  mergeCreativeOsState,
  mergeRemoteCreativeOsState,
  normalizeBrandDraftProfile,
  normalizeBrandProfile,
  normalizeBrandReferenceLinks,
  normalizeChatMessages,
  normalizeCreativeOsState,
  uniqueStrings,
} from "../lib/normalize";
import { StatCard, Metric } from "../_components/StatCard";
import {
  Input,
  Textarea,
  DueDateSelect,
  BriefFocusPanel,
  GridList,
} from "../_components/FormFields";
import { LiveSetupGuide } from "./shared/LiveSetupGuide";
import { PreviewCard } from "./shared/PreviewCard";
import { SectionTitle } from "./shared/SectionTitle";
import {
  AccessPersonCard,
  BrandReferenceLinksEditor,
  CardList,
  ChatPanel,
  MiniFlow,
  StrategyPicker,
  TagInput,
} from "./shared/WorkspaceWidgets";
import { BrandTab } from "./tabs/BrandTab";
import { ChatTab } from "./tabs/ChatTab";
import { LaunchTab } from "./tabs/LaunchTab";
import { LearningTab } from "./tabs/LearningTab";
import { LibraryTab } from "./tabs/LibraryTab";
import { PostBriefsTab } from "./tabs/PostBriefsTab";
import { ProductsTab } from "./tabs/ProductsTab";
import { CatalogPickerDialog } from "./products/CatalogPickerDialog";
import { ReviewTab } from "./tabs/ReviewTab";
import { SettingsTab } from "./tabs/SettingsTab";

export type { CreativeOsWorkspaceProps } from "../types";

function sourceNameFromUrl(value: string, fallback: string) {
  try {
    const url = new URL(value);
    const lastPathPart =
      url.pathname.split("/").filter(Boolean).pop() || url.hostname;
    return (
      decodeURIComponent(lastPathPart)
        .replace(/\.[a-z0-9]+$/i, "")
        .replace(/[-_]+/g, " ")
        .trim() || fallback
    );
  } catch {
    return fallback;
  }
}

function sourceTypeFromUrl(value: string): "image" | "video" {
  const clean = value.split("?")[0].toLowerCase();
  return /\.(mp4|mov|m4v|webm|mpeg|mpg)$/i.test(clean) ? "video" : "image";
}

function approvedCountForTask(state: CreativeOsState, taskId: string) {
  const editTaskIdById = new Map(
    state.deliveredEdits.map((edit) => [edit.id, edit.taskId]),
  );
  return state.launchItems.reduce(
    (count, item) =>
      editTaskIdById.get(item.deliveredEditId) === taskId ? count + 1 : count,
    0,
  );
}

function occupiedOutputCountForTask(state: CreativeOsState, taskId: string) {
  const taskEditIds = new Set(
    state.deliveredEdits
      .filter((edit) => edit.taskId === taskId)
      .map((edit) => edit.id),
  );
  const occupiedEditIds = new Set<string>();
  state.launchItems.forEach((item) => {
    if (taskEditIds.has(item.deliveredEditId)) {
      occupiedEditIds.add(item.deliveredEditId);
    }
  });
  state.reviews.forEach((review) => {
    if (
      review.status === "ready" &&
      taskEditIds.has(review.deliveredEditId)
    ) {
      occupiedEditIds.add(review.deliveredEditId);
    }
  });
  return occupiedEditIds.size;
}

function revisionFeedbackChatBody(params: {
  productName: string;
  task?: CreativeTask | null;
  review: ReviewItem;
  edit?: DeliveredEdit | null;
  feedback: string;
}) {
  const briefTitle =
    params.task?.brief ||
    params.review.briefSummary ||
    params.productName ||
    "Brief";
  const lines = [
    `Revision requested for: ${briefTitle}`,
    params.productName ? `Product: ${params.productName}` : "",
    params.review.angle ? `Angle: ${params.review.angle}` : "",
    params.review.hook ? `Hook: ${params.review.hook}` : "",
    params.edit?.previewUrl ? `Submitted ad: ${params.edit.previewUrl}` : "",
    "",
    "Feedback:",
    params.feedback,
  ];
  return lines
    .filter((line, index) => line || index === 5)
    .join("\n")
    .trim();
}

export default function CreativeOsWorkspace({
  tenantId,
  companyName = "",
  accessMode = "customer",
  userEmail = "",
  userName = "",
}: CreativeOsWorkspaceProps) {
  const isCreativeEditor = accessMode === "creative-editor";
  const canManageAccess = accessMode !== "creative-editor";
  const customerCompanyName = cleanCompanyName(companyName);
  const teamMemberLabel = customerCompanyName
    ? `Add ${customerCompanyName} team member`
    : "Add team member";
  const noTeamMembersText = customerCompanyName
    ? `No ${customerCompanyName} team members added yet. Add one when a specific editor should own the brief.`
    : "No team members added yet. Add one when a specific editor should own the brief.";
  const optionalTeamText = customerCompanyName
    ? `Optional. Add someone from ${customerCompanyName} only when a specific person should own this brief.`
    : "Optional. Add a team member only when a specific person should own this brief.";
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<CreativeOsState>(() =>
    emptyState(tenantId),
  );
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [briefScopeFilter, setBriefScopeFilter] = useState<string>("all");
  const [catalogPickerOpen, setCatalogPickerOpen] = useState(false);
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<string[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [sourceLinkRows, setSourceLinkRows] = useState([""]);
  const [sourceLinkError, setSourceLinkError] = useState("");
  const [sourceLinkStatus, setSourceLinkStatus] = useState("");
  const [libraryPreviewSourceId, setLibraryPreviewSourceId] = useState("");
  const [activeLibraryFolderKey, setActiveLibraryFolderKey] = useState("");
  const [readyAdRows, setReadyAdRows] = useState([""]);
  const [readyAdError, setReadyAdError] = useState("");
  const [deliveryDrafts, setDeliveryDrafts] = useState<
    Record<string, { previewUrl: string; sourceUsedUrl: string; adName?: string }>
  >({});
  const [deliveryUploadState, setDeliveryUploadState] = useState<
    Record<
      string,
      { status: "uploading" | "uploaded" | "error"; message?: string }
    >
  >({});
  const [reviewActionError, setReviewActionError] = useState("");
  const [revisionSendStatus, setRevisionSendStatus] = useState<
    Record<string, "sending" | "sent" | "error">
  >({});
  const [hiddenRevisionReviewIds, setHiddenRevisionReviewIds] = useState<
    string[]
  >([]);
  const [briefEditDrafts, setBriefEditDrafts] = useState<
    Record<string, BriefEditDraft>
  >({});
  const [selectedChatRoomId, setSelectedChatRoomId] = useState("");
  const [chatDrafts, setChatDrafts] = useState<Record<string, string>>({});
  const [chatReadAt, setChatReadAt] = useState<Record<string, string>>({});
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(() =>
    createInitialTaskDraft(),
  );
  const [selectedEditorIds, setSelectedEditorIds] = useState<string[]>([]);
  const [taskError, setTaskError] = useState("");
  const showBriefFieldError = useCallback((message: string) => {
    setTaskError(message);
    toast.error(message);
  }, []);
  const [briefCreateStatus, setBriefCreateStatus] = useState<
    "idle" | "creating" | "created"
  >("idle");
  const [briefAiStatus, setBriefAiStatus] = useState<
    "idle" | "filling" | "filled"
  >("idle");
  const [briefAiReason, setBriefAiReason] = useState("");
  const [editorDraft, setEditorDraft] = useState({
    userName: "",
    role: "editor" as ProductRole,
  });
  const [editorError, setEditorError] = useState("");
  const [editorInviteStatus, setEditorInviteStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [deletingInviteHistoryIds, setDeletingInviteHistoryIds] = useState<
    string[]
  >([]);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [guideStepIndex, setGuideStepIndex] = useState(0);
  const [brandFillStatus, setBrandFillStatus] = useState<
    "idle" | "filling" | "filled"
  >("idle");
  const [brandFillError, setBrandFillError] = useState("");
  const [aiFillStatus, setAiFillStatus] = useState<
    "idle" | "filling" | "filled"
  >("idle");
  const [aiFillError, setAiFillError] = useState("");
  const [aiFillReason, setAiFillReason] = useState("");
  const [strategyUpgradeField, setStrategyUpgradeField] =
    useState<StrategyListField | null>(null);
  const [strategyEnhanceField, setStrategyEnhanceField] =
    useState<StrategyListField | null>(null);
  const selectedBriefPersonas = useMemo(
    () =>
      strategyContextLines(taskDraft.notes)
        .filter((line) => /^target persona:/i.test(line))
        .map((line) => line.replace(/^target persona:\s*/i, "").trim())
        .filter(Boolean),
    [taskDraft.notes],
  );
  const selectedBriefAngles = useMemo(
    () => parseMultilineOptions(taskDraft.angles, "", 20).filter(Boolean),
    [taskDraft.angles],
  );
  const selectedBriefHooks = useMemo(
    () => parseMultilineOptions(taskDraft.hooks, "", 20).filter(Boolean),
    [taskDraft.hooks],
  );
  const selectedBriefStyles = useMemo(
    () => parseMultilineOptions(taskDraft.format, "", 20).filter(Boolean),
    [taskDraft.format],
  );
  const [editorTab, setEditorTab] = useState<
    "work" | "sources" | "delivered" | "chat" | "brand" | "info"
  >("work");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInFlight = useRef(false);
  const pendingSave = useRef(false);
  const latestStateRef = useRef(state);
  const loadedOnce = useRef(false);
  const protectedProductIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    loadedOnce.current = false;
    fetch(
      `/api/ad-manager/creative-os?tenant_id=${encodeURIComponent(tenantId)}`,
      { credentials: "same-origin", cache: "no-store" },
    )
      .then((res) =>
        res.ok
          ? res.json()
          : Promise.reject(new Error("Failed to load Creative OS")),
      )
      .then((data) => {
        if (cancelled) return;
        setState(normalizeCreativeOsState(data.state, tenantId));
        setCatalogProducts(
          Array.isArray(data.catalogProducts) ? data.catalogProducts : [],
        );
        loadedOnce.current = true;
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setState(emptyState(tenantId));
        loadedOnce.current = true;
        setReady(true);
        setSaveStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const runAutosave = useCallback(async () => {
    if (!ready || !loadedOnce.current) return;
    if (saveInFlight.current) {
      pendingSave.current = true;
      return;
    }

    saveInFlight.current = true;
    pendingSave.current = false;
    const submittedState = latestStateRef.current;
    const submittedStateJson = JSON.stringify(submittedState);

    try {
      const res = await fetch("/api/ad-manager/creative-os", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, state: submittedState }),
      });
      if (!res.ok) throw new Error("Save failed");
      const payload = await res.json().catch(() => null);
      if (payload?.state) {
        const remoteState = normalizeCreativeOsState(payload.state, tenantId);
        const remoteProductIds = new Set(
          remoteState.products.map((product) => product.id),
        );
        protectedProductIdsRef.current.forEach((productId) => {
          if (remoteProductIds.has(productId))
            protectedProductIdsRef.current.delete(productId);
        });
        setState((current) => {
          if (JSON.stringify(current) !== submittedStateJson) return current;
          const mergedState = mergeRemoteCreativeOsState(current, remoteState, [
            ...protectedProductIdsRef.current,
          ]);
          return JSON.stringify(current) === JSON.stringify(mergedState)
            ? current
            : mergedState;
        });
      }
      if (JSON.stringify(latestStateRef.current) === submittedStateJson) {
        setSaveStatus("saved");
      } else {
        pendingSave.current = true;
        setSaveStatus("saving");
      }
    } catch {
      if (JSON.stringify(latestStateRef.current) === submittedStateJson)
        setSaveStatus("error");
      else {
        pendingSave.current = true;
        setSaveStatus("saving");
      }
    } finally {
      saveInFlight.current = false;
      if (
        pendingSave.current &&
        JSON.stringify(latestStateRef.current) !== submittedStateJson
      ) {
        pendingSave.current = false;
        setTimeout(() => {
          void runAutosave();
        }, 0);
      }
    }
  }, [ready, tenantId]);

  useEffect(() => {
    if (!ready || !loadedOnce.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    pendingSave.current = true;
    setSaveStatus("saving");
    saveTimer.current = setTimeout(() => {
      void runAutosave();
    }, 700);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [ready, runAutosave, state]);

  const refreshCreativeOsState = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/ad-manager/creative-os?tenant_id=${encodeURIComponent(tenantId)}`,
        { credentials: "same-origin", cache: "no-store" },
      );
      if (!res.ok) return;
      const data = await res.json();
      const remoteState = normalizeCreativeOsState(data.state, tenantId);
      setState((current) => {
        const mergedState = mergeRemoteCreativeOsState(current, remoteState, [
          ...protectedProductIdsRef.current,
        ]);
        return JSON.stringify(current) === JSON.stringify(mergedState)
          ? current
          : mergedState;
      });
    } catch {
      // Keep the current UI state if a background refresh fails.
    }
  }, [tenantId]);

  useEffect(() => {
    const shouldLiveRefresh =
      state.activeSection === "access" ||
      state.activeSection === "chat" ||
      editorTab === "chat";
    if (!ready || !shouldLiveRefresh) return;
    const interval = window.setInterval(() => {
      void refreshCreativeOsState();
    }, 5000);
    const onFocus = () => {
      void refreshCreativeOsState();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [editorTab, ready, refreshCreativeOsState, state.activeSection]);

  const editorIdentity = normalizeEmail(userEmail || userName);
  const editorAssignedTasksAll = state.tasks.filter((task) => {
    const assignee = normalizeEmail(task.assignee);
    return (
      task.status !== "archived" &&
      assignee &&
      editorIdentity &&
      assignee === editorIdentity
    );
  });
  const editorAssignedProductIds = new Set(
    editorAssignedTasksAll.map((task) => task.productId).filter(Boolean),
  );
  const visibleProducts = isCreativeEditor
    ? state.products.filter((product) =>
        editorAssignedProductIds.has(product.id),
      )
    : state.products;
  const selectedProduct =
    visibleProducts.find((product) => product.id === state.activeProductId) ||
    visibleProducts[0] ||
    blankProduct(tenantId);
  const selectedProductIndex = Math.max(
    0,
    visibleProducts.findIndex((product) => product.id === selectedProduct.id),
  );
  const selectedProductLabel = catalogDisplayName(
    selectedProduct,
    selectedProductIndex,
  );
  const selectedCollectionUrl = collectionUrlForProduct(selectedProduct);
  const productFieldSuggestions = inferProductFieldSuggestions(selectedProduct);

  useEffect(() => {
    if (
      !selectedProduct.isCatalogGroup ||
      !selectedCollectionUrl ||
      selectedProduct.url === selectedCollectionUrl
    )
      return;
    if (!/\/products\//i.test(selectedProduct.url)) return;
    setState((current) => ({
      ...current,
      products: current.products.map((product) =>
        product.id === selectedProduct.id
          ? { ...product, url: selectedCollectionUrl }
          : product,
      ),
    }));
  }, [
    selectedProduct.id,
    selectedProduct.isCatalogGroup,
    selectedProduct.url,
    selectedCollectionUrl,
  ]);

  const productSources = state.sources.filter((source) =>
    sourceBelongsToProduct(source, selectedProduct),
  );
  const libraryPreviewSource = useMemo(
    () =>
      productSources.find((source) => source.id === libraryPreviewSourceId) ||
      null,
    [libraryPreviewSourceId, productSources],
  );
  const productTaskSources = productSources.filter(sourceIsEditable);
  const productSourceGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        name: string;
        importUrl?: string;
        backendFolderUrl?: string;
        isLegacy: boolean;
        sources: SourceCreative[];
      }
    >();
    for (const source of productSources) {
      const key = sourceGroupKey(source);
      const current = groups.get(key) || {
        key,
        name: sourceGroupName(source),
        importUrl: source.importUrl || source.originalAssetUrl,
        backendFolderUrl: sourceLibraryUrl(source) || undefined,
        isLegacy: !source.importName,
        sources: [],
      };
      current.sources.push(source);
      if (!current.importUrl && (source.importUrl || source.originalAssetUrl))
        current.importUrl = source.importUrl || source.originalAssetUrl;
      if (!current.backendFolderUrl && isAinomiqStoredSource(source))
        current.backendFolderUrl = source.backendFolderUrl || source.assetUrl;
      groups.set(key, current);
    }
    return Array.from(groups.values()).sort((a, b) => {
      const latestA = Math.max(
        ...a.sources.map(
          (source) => new Date(source.uploadedAt).getTime() || 0,
        ),
      );
      const latestB = Math.max(
        ...b.sources.map(
          (source) => new Date(source.uploadedAt).getTime() || 0,
        ),
      );
      return latestB - latestA;
    });
  }, [productSources]);
  const productTaskSourceIds = useMemo(
    () => new Set(productTaskSources.map((source) => source.id)),
    [productTaskSources],
  );
  const productTaskSourceGroups = useMemo(
    () =>
      productSourceGroups
        .map((group) => ({
          ...group,
          sources: group.sources.filter((source) =>
            productTaskSourceIds.has(source.id),
          ),
        }))
        .filter((group) => group.sources.length > 0),
    [productSourceGroups, productTaskSourceIds],
  );
  const productTaskSelectionGroups = productTaskSourceGroups;
  const sourceLinkValues = useMemo(
    () =>
      sourceLinkRows
        .flatMap((row) => row.split(/\n|,/))
        .map((row) => row.trim())
        .filter(Boolean),
    [sourceLinkRows],
  );
  const pendingSourceLinks = sourceLinkValues;
  const visibleProductIds = new Set(
    visibleProducts.map((product) => product.id),
  );
  const productTasks = state.tasks.filter(
    (task) =>
      task.productId === selectedProduct.id && task.status !== "archived",
  );
  const productBuildTasks = productTasks.filter(
    (task) => task.status !== "delivered",
  );
  const productFinishedTasks = productTasks.filter(
    (task) => task.status === "delivered",
  );
  const productDeletedTasks = state.tasks.filter(
    (task) =>
      task.productId === selectedProduct.id && task.status === "archived",
  );
  // Active briefs across every visible product/catalog, optionally filtered.
  const activeBriefTasks = state.tasks.filter(
    (task) =>
      visibleProductIds.has(task.productId) &&
      task.status !== "archived" &&
      task.status !== "delivered" &&
      (briefScopeFilter === "all" || task.productId === briefScopeFilter),
  );
  const productEdits = state.deliveredEdits.filter(
    (edit) => edit.productId === selectedProduct.id,
  );
  const productReviews = state.reviews.filter(
    (review) => review.productId === selectedProduct.id,
  );
  const productLaunchItems = state.launchItems.filter(
    (item) => item.productId === selectedProduct.id,
  );
  const productPerformance = state.performance.filter((item) =>
    productLaunchItems.some((launch) => launch.id === item.launchItemId),
  );
  const workspaceTasks = state.tasks.filter(
    (task) =>
      visibleProductIds.has(task.productId) && task.status !== "archived",
  );
  const workspaceEdits = state.deliveredEdits.filter((edit) =>
    visibleProductIds.has(edit.productId),
  );
  const workspaceReviews = state.reviews.filter((review) =>
    visibleProductIds.has(review.productId),
  );
  const workspaceLaunchItems = state.launchItems.filter((item) =>
    visibleProductIds.has(item.productId),
  );
  const workspacePerformance = state.performance.filter((item) =>
    workspaceLaunchItems.some((launch) => launch.id === item.launchItemId),
  );
  const productNameById = new Map(
    state.products.map((product, index) => [
      product.id,
      catalogDisplayName(product, index),
    ]),
  );
  const briefScopeProducts = visibleProducts.map((product) => ({
    id: product.id,
    name: productNameById.get(product.id) || product.name || "Product",
  }));
  const suggestedAdNameForTask = (
    task: CreativeTask,
    outputIndex = 1,
    source?: SourceCreative,
  ) => {
    const product = state.products.find((item) => item.id === task.productId);
    return buildCreativeOsAdName({
      template: product?.namingConvention,
      productName: productNameById.get(task.productId) || product?.name || "Product",
      sourceName:
        source?.importName ||
        source?.name ||
        task.sourceGroupName ||
        "Source",
      brief: task.brief,
      angle: task.angle,
      hook: task.hook,
      format: task.format,
      platform: product?.platforms?.[0] || "UGC",
      outputIndex,
      date: new Date(),
    });
  };
  const pendingPermissions = state.permissions.filter(
    (permission) => permission.status === "invited",
  );
  const acceptedPermissions = state.permissions.filter(
    (permission) => permission.status === "accepted",
  );
  const accessPermissionHistory = state.permissionHistory || [];
  const activeEditors = acceptedPermissions
    .filter(
      (permission) =>
        permission.role === "editor" || permission.role === "admin",
    )
    .filter((permission, index, permissions) => {
      const identity =
        normalizeEmail(permission.email || permission.userName) ||
        permission.id;
      return (
        permissions.findIndex(
          (item) =>
            (normalizeEmail(item.email || item.userName) || item.id) ===
            identity,
        ) === index
      );
    });
  const activeEditorIdKey = activeEditors
    .map((permission) => permission.id)
    .join("|");

  useEffect(() => {
    if (!libraryPreviewSourceId) return;
    if (productSources.some((source) => source.id === libraryPreviewSourceId))
      return;
    setLibraryPreviewSourceId("");
  }, [libraryPreviewSourceId, productSources]);

  const selectedEditorPermissions = activeEditors.filter((permission) =>
    selectedEditorIds.includes(permission.id),
  );
  const editorTaskScope = workspaceTasks.filter((task) => {
    const assignee = normalizeEmail(task.assignee);
    return assignee && editorIdentity && assignee === editorIdentity;
  });
  const editorReviews = workspaceReviews.filter((review) => {
    const editor = normalizeEmail(review.editor);
    return editor && editorIdentity && editor === editorIdentity;
  });
  const editorDeliveredEdits = workspaceEdits.filter((edit) => {
    const editor = normalizeEmail(edit.editor);
    return editor && editorIdentity && editor === editorIdentity;
  });
  const accessibleChatTasks = isCreativeEditor
    ? editorTaskScope
    : workspaceTasks;
  const chatRooms = useMemo(() => {
    const rooms = new Map<
      string,
      {
        id: string;
        title: string;
        description: string;
        tasks: CreativeTask[];
        assignees: string[];
        roomIds: string[];
        lastMessage?: ChatMessage;
      }
    >();
    for (const task of accessibleChatTasks) {
      const legacyRoomId = taskChatRoomId(task);
      const roomId = taskParticipantChatRoomId(task);
      const current = rooms.get(roomId) || {
        id: roomId,
        title: isCreativeEditor
          ? "Founder chat"
          : task.assignee || "Brief chat",
        description: "",
        tasks: [],
        assignees: [],
        roomIds: [roomId],
      };
      current.tasks.push(task);
      current.assignees = uniqueStrings(
        [...current.assignees, task.assignee].filter(Boolean),
      );
      current.roomIds = uniqueStrings([
        ...current.roomIds,
        legacyRoomId,
        taskLegacyParticipantChatRoomId(task),
        roomId,
      ]);
      current.title = isCreativeEditor
        ? current.assignees.length > 1
          ? "Brief team chat"
          : "Founder chat"
        : current.assignees.length > 1
          ? `${current.assignees.length} editors`
          : current.assignees[0] || task.brief || "Brief chat";
      current.description = `${current.tasks.length} brief${current.tasks.length === 1 ? "" : "s"}`;
      const allowedRoomIds = new Set(current.roomIds);
      const roomMessages = state.chatMessages.filter((message) =>
        allowedRoomIds.has(message.roomId),
      );
      current.lastMessage = roomMessages.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0];
      rooms.set(roomId, current);
    }
    return [...rooms.values()].sort((a, b) => {
      const latestA = a.lastMessage
        ? new Date(a.lastMessage.createdAt).getTime()
        : Math.max(
            ...a.tasks.map(
              (task) => new Date(task.dueDate || 0).getTime() || 0,
            ),
          );
      const latestB = b.lastMessage
        ? new Date(b.lastMessage.createdAt).getTime()
        : Math.max(
            ...b.tasks.map(
              (task) => new Date(task.dueDate || 0).getTime() || 0,
            ),
          );
      return latestB - latestA;
    });
  }, [accessibleChatTasks, isCreativeEditor, state.chatMessages]);
  const activeChatRoom =
    chatRooms.find((room) => room.id === selectedChatRoomId) ||
    chatRooms[0] ||
    null;
  const activeChatRoomIds = activeChatRoom
    ? new Set(activeChatRoom.roomIds)
    : null;
  const activeChatMessages = activeChatRoomIds
    ? state.chatMessages
        .filter((message) => activeChatRoomIds.has(message.roomId))
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        )
    : [];
  const activeChatLastMessageAt = useMemo(() => {
    if (!activeChatRoomIds) return 0;
    let latest = 0;
    for (const message of state.chatMessages) {
      if (!activeChatRoomIds.has(message.roomId)) continue;
      const timestamp = new Date(message.createdAt).getTime();
      if (!Number.isNaN(timestamp) && timestamp > latest) latest = timestamp;
    }
    return latest;
  }, [activeChatRoom?.id, state.chatMessages]);
  const currentChatIdentity = normalizeEmail(userEmail || userName || tenantId);
  const chatReadStorageKey = `creative-os-chat-read:${tenantId}:${currentChatIdentity || "unknown"}`;
  const chatIsOpen = state.activeSection === "chat" || editorTab === "chat";
  const chatNotificationCount = state.chatMessages.filter((message) => {
    if (normalizeEmail(message.authorEmail) === currentChatIdentity)
      return false;
    const room = chatRooms.find((item) =>
      item.roomIds.includes(message.roomId),
    );
    if (!room) return false;
    const readAt = chatReadAt[room.id];
    return (
      !readAt ||
      new Date(message.createdAt).getTime() > new Date(readAt).getTime()
    );
  }).length;
  const showChatNotificationBadge =
    chatNotificationCount > 0 &&
    state.activeSection !== "chat" &&
    editorTab !== "chat";

  useEffect(() => {
    if (!ready || !currentChatIdentity) return;
    try {
      const stored = window.localStorage.getItem(chatReadStorageKey);
      setChatReadAt(stored ? JSON.parse(stored) : {});
    } catch {
      setChatReadAt({});
    }
  }, [chatReadStorageKey, currentChatIdentity, ready]);

  useEffect(() => {
    if (!ready || !chatIsOpen || !activeChatRoom) return;
    const roomId = activeChatRoom.id;
    setChatReadAt((current) => {
      const readAt = activeChatLastMessageAt
        ? new Date(activeChatLastMessageAt).toISOString()
        : current[roomId] || new Date().toISOString();
      const currentReadAt = current[roomId];
      if (
        currentReadAt &&
        new Date(currentReadAt).getTime() >= new Date(readAt).getTime()
      ) {
        return current;
      }
      const next = { ...current, [roomId]: readAt };
      try {
        window.localStorage.setItem(chatReadStorageKey, JSON.stringify(next));
      } catch {
        // Local read state is best-effort; chat still works without storage.
      }
      return next;
    });
  }, [
    activeChatLastMessageAt,
    activeChatRoom?.id,
    chatIsOpen,
    chatReadStorageKey,
    ready,
  ]);

  const selectedSourceGroupKey = sourceGroupKeyFromValue(
    taskDraft.sourceCreativeId || "",
  );
  const selectedTaskSourceGroup = selectedSourceGroupKey
    ? productTaskSelectionGroups.find(
        (group) => group.key === selectedSourceGroupKey,
      ) || productTaskSelectionGroups[0]
    : !taskDraft.sourceCreativeId
      ? productTaskSelectionGroups[0]
      : undefined;
  const selectedTaskSource =
    selectedTaskSourceGroup?.sources[0] ||
    productTaskSources.find(
      (source) => source.id === taskDraft.sourceCreativeId,
    ) ||
    productTaskSources[0];
  const defaultAngle = firstRealValue(
    selectedProduct.sellingPoints,
    firstRealValue(selectedProduct.pains, "Product benefit"),
  );
  const hookSeed = firstRealValue(
    selectedProduct.pains,
    firstRealValue(
      selectedProduct.sellingPoints,
      "Make the product obvious fast",
    ),
  );
  const defaultHook =
    hookSeed === "Make the product obvious fast"
      ? hookSeed
      : `Solves ${hookSeed}`;
  const defaultInstructions = `Create clean ad concepts for ${selectedProduct.name || "this product"}. Use the selected product photo as the hero. Keep copy short, make the product benefit obvious and avoid unsupported claims.`;
  const systemInstalled =
    state.products.length > 0 &&
    state.sources.length > 0 &&
    state.tasks.length > 0;

  useEffect(() => {
    const activeIds = new Set(activeEditors.map((permission) => permission.id));
    setSelectedEditorIds((current) =>
      current.filter((id) => activeIds.has(id)),
    );
  }, [activeEditorIdKey]);

  const readyReviewCount = useMemo(
    () =>
      workspaceReviews.filter(
        (review) =>
          review.status === "ready" &&
          !hiddenRevisionReviewIds.includes(review.id) &&
          !["sending", "sent"].includes(revisionSendStatus[review.id] || ""),
      ).length,
    [hiddenRevisionReviewIds, revisionSendStatus, workspaceReviews],
  );

  const counts = useMemo(
    () => ({
      review: readyReviewCount,
      tasks: productTasks.filter((item) => item.status !== "delivered").length,
      launch: workspaceLaunchItems.filter(
        (item) => item.status === "ready" || item.status === "uploaded",
      ).length,
      sources: productSources.length,
      maxed: productSources.filter(
        (item) =>
          item.status === "maxed out" ||
          item.derivativeCount >= item.derivativeCap,
      ).length,
      winners: workspacePerformance.filter((item) => item.outcome === "winner")
        .length,
      losers: workspacePerformance.filter((item) => item.outcome === "loser")
        .length,
    }),
    [
      productSources,
      productTasks,
      readyReviewCount,
      workspaceLaunchItems,
      workspacePerformance,
    ],
  );
  const filteredCatalogProducts = useMemo(() => {
    const queryTokens = catalogSearch
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .map((token) => token.replace(/[^a-z0-9]/g, ""))
      .filter(Boolean);

    if (!queryTokens.length) return catalogProducts;

    return catalogProducts.filter((product) => {
      const productHandle =
        (product.url || "")
          .split("?")[0]
          .split("#")[0]
          .split("/")
          .filter(Boolean)
          .pop() || "";
      const searchTarget =
        `${product.name || ""} ${productHandle.replace(/[-_]+/g, " ")}`
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ");

      return queryTokens.every((token) => searchTarget.includes(token));
    });
  }, [catalogProducts, catalogSearch]);

  const sectionRefs = useRef<
    Record<CreativeOsState["activeSection"], HTMLDivElement | null>
  >({
    dashboard: null,
    setup: null,
    brand: null,
    sources: null,
    tasks: null,
    review: null,
    launch: null,
    learning: null,
    chat: null,
    access: null,
  });

  const setActiveSection = (section: CreativeOsState["activeSection"]) =>
    setState((current) =>
      current.activeSection === section
        ? current
        : { ...current, activeSection: section },
    );

  const openChatRoom = (roomId: string) => {
    const room = chatRooms.find(
      (item) => item.id === roomId || item.roomIds.includes(roomId),
    );
    setSelectedChatRoomId(room?.id || roomId);
    if (isCreativeEditor) setEditorTab("chat");
    else setActiveSection("chat");
  };

  useEffect(() => {
    if (!chatRooms.length) {
      if (selectedChatRoomId) setSelectedChatRoomId("");
      return;
    }
    const selectedIsValid = chatRooms.some(
      (room) =>
        room.id === selectedChatRoomId ||
        room.roomIds.includes(selectedChatRoomId),
    );
    if (!selectedChatRoomId || !selectedIsValid) {
      const fallbackRoomId = chatRooms[0].id;
      setSelectedChatRoomId((current) =>
        current === fallbackRoomId ? current : fallbackRoomId,
      );
    }
  }, [chatRooms, selectedChatRoomId]);

  const sendChatMessage = (roomId: string) => {
    const body = String(chatDrafts[roomId] || "").trim();
    const room = chatRooms.find((item) => item.id === roomId);
    const task = room?.tasks[0];
    if (!body || !room || !task) return;
    const now = new Date().toISOString();
    const message: ChatMessage = {
      id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      productId: task.productId,
      taskId: task.id,
      roomId,
      authorEmail: normalizeEmail(
        userEmail || userName || (isCreativeEditor ? task.assignee : tenantId),
      ),
      authorName:
        userName || userEmail || (isCreativeEditor ? "Editor" : "Founder"),
      authorRole: isCreativeEditor ? "editor" : "founder",
      body,
      createdAt: now,
    };
    setState((current) => {
      const next = {
        ...current,
        chatMessages: [...current.chatMessages, message],
      };
      latestStateRef.current = next;
      return next;
    });
    setChatDrafts((current) => ({ ...current, [roomId]: "" }));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    pendingSave.current = true;
    setSaveStatus("saving");
    setTimeout(() => {
      void runAutosave();
    }, 0);
  };

  const deleteChatMessage = (messageId: string) => {
    const id = String(messageId || "").trim();
    if (!id) return;
    setState((current) => {
      const next = {
        ...current,
        deletedChatMessageIds: uniqueStrings([
          ...(current.deletedChatMessageIds || []),
          id,
        ]),
        chatMessages: current.chatMessages.filter(
          (message) => message.id !== id,
        ),
      };
      latestStateRef.current = next;
      return next;
    });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    pendingSave.current = true;
    setSaveStatus("saving");
    setTimeout(() => {
      void runAutosave();
    }, 0);
  };

  const updateBrand = <Field extends keyof BrandProfile>(
    field: Field,
    value: BrandProfile[Field],
  ) => {
    setBrandFillError("");
    setState((current) => ({
      ...current,
      brand: {
        ...normalizeBrandDraftProfile(current.brand),
        [field]: value,
      },
    }));
  };

  const updateBrandReferenceLink = (
    id: string,
    field: "url" | "info",
    value: string,
  ) => {
    setBrandFillError("");
    setState((current) => {
      const brand = normalizeBrandDraftProfile(current.brand);
      const referenceLinks = normalizeBrandReferenceLinks(
        brand.referenceLinks,
        { keepEmpty: true, keepDraftSpacing: true },
      ).map((link) => (link.id === id ? { ...link, [field]: value } : link));
      return { ...current, brand: { ...brand, referenceLinks } };
    });
  };

  const addBrandReferenceLink = () => {
    setBrandFillError("");
    setState((current) => {
      const brand = normalizeBrandDraftProfile(current.brand);
      return {
        ...current,
        brand: {
          ...brand,
          referenceLinks: [
            ...normalizeBrandReferenceLinks(brand.referenceLinks, {
              keepEmpty: true,
              keepDraftSpacing: true,
            }),
            { id: `brand-reference-${Date.now()}`, url: "", info: "" },
          ],
        },
      };
    });
  };

  const removeBrandReferenceLink = (id: string) => {
    setBrandFillError("");
    setState((current) => {
      const brand = normalizeBrandDraftProfile(current.brand);
      const referenceLinks = normalizeBrandReferenceLinks(
        brand.referenceLinks,
        { keepEmpty: true, keepDraftSpacing: true },
      ).filter((link) => link.id !== id);
      return { ...current, brand: { ...brand, referenceLinks } };
    });
  };

  const magicFillBrand = async () => {
    if (brandFillStatus === "filling") return;
    setBrandFillStatus("filling");
    setBrandFillError("");
    try {
      const response = await fetch("/api/ad-manager/creative-os/brand-fill", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Magic Fill failed");
      const nextBrand = normalizeBrandProfile(data?.brand);
      setState((current) => ({
        ...current,
        brand: nextBrand,
      }));
      setBrandFillStatus("filled");
    } catch (error) {
      setBrandFillStatus("idle");
      setBrandFillError(
        error instanceof Error ? error.message : "Magic Fill failed",
      );
    }
  };

  const selectActiveProduct = (productId: string) => {
    if (productId !== state.activeProductId) {
      setTaskDraft((current) => ({ ...current, sourceCreativeId: "" }));
    }
    setState((current) => ({
      ...current,
      activeProductId: productId,
    }));
  };

  const updateProduct = (
    field: keyof Product,
    value: string | string[] | number,
  ) => {
    setAiFillStatus("idle");
    setAiFillError("");
    setAiFillReason("");
    setState((current) => ({
      ...current,
      products: current.products.map((product) =>
        product.id === selectedProduct.id
          ? { ...product, [field]: value }
          : product,
      ),
    }));
  };

  const aiFillProductFields = async () => {
    setAiFillStatus("filling");
    setAiFillError("");
    try {
      const response = await fetch("/api/ad-manager/creative-os/autofill", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, product: selectedProduct }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "AI fill failed");
      setState((current) => ({
        ...current,
        products: current.products.map((product) => {
          if (product.id !== selectedProduct.id) return product;
          return {
            ...product,
            explanation: data.explanation || product.explanation,
            sellingPoints: Array.isArray(data.sellingPoints)
              ? data.sellingPoints.slice(0, 8)
              : product.sellingPoints,
            pains: Array.isArray(data.pains)
              ? data.pains.slice(0, 8)
              : product.pains,
            personas: Array.isArray(data.personas)
              ? data.personas.slice(0, 8)
              : product.personas,
            claimBoundaries: Array.isArray(data.claimBoundaries)
              ? data.claimBoundaries.slice(0, 8)
              : product.claimBoundaries,
            platforms: product.platforms.length
              ? product.platforms
              : Array.isArray(data.platforms)
                ? data.platforms
                : inferProductFieldSuggestions(product).platforms,
          };
        }),
      }));
      setAiFillReason(
        typeof data.why === "string"
          ? data.why
          : "Filled from selected product page context.",
      );
      setAiFillStatus("filled");
    } catch (error) {
      setAiFillStatus("idle");
      setAiFillError(error instanceof Error ? error.message : "AI fill failed");
      setAiFillReason("");
    }
  };

  const upgradeStrategyList = async (field: StrategyListField) => {
    if (strategyUpgradeField) return;
    setStrategyUpgradeField(field);
    setAiFillError("");
    try {
      const response = await fetch("/api/ad-manager/creative-os/autofill", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, product: selectedProduct }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "AI upgrade failed");
      const nextItems = Array.isArray(data?.[field])
        ? data[field]
            .map((item: unknown) => String(item || "").trim())
            .filter(Boolean)
            .slice(0, 8)
        : [];
      if (!nextItems.length)
        throw new Error("AI did not return usable strategy items.");
      setState((current) => ({
        ...current,
        products: current.products.map((product) =>
          product.id === selectedProduct.id
            ? { ...product, [field]: nextItems }
            : product,
        ),
      }));
      setAiFillReason("Upgraded this strategy block from product context.");
      setAiFillStatus("filled");
    } catch (error) {
      setAiFillError(
        error instanceof Error ? error.message : "AI upgrade failed",
      );
      setAiFillReason("");
    } finally {
      setStrategyUpgradeField(null);
    }
  };

  const enhanceStrategyDraft = async (
    field: StrategyListField,
    input: string,
  ) => {
    const cleanInput = input.trim();
    if (!cleanInput || strategyEnhanceField) return cleanInput;
    setStrategyEnhanceField(field);
    setAiFillError("");
    try {
      const response = await fetch("/api/ad-manager/creative-os/autofill", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          product: selectedProduct,
          enhance: {
            field,
            input: cleanInput,
            currentItems: selectedProduct[field],
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "AI enhance failed");
      const item = typeof data?.item === "string" ? data.item.trim() : "";
      if (!item) throw new Error("AI did not return a usable enhanced item.");
      setAiFillReason(
        typeof data?.why === "string"
          ? data.why
          : "Enhanced this strategy item.",
      );
      setAiFillStatus("filled");
      return item;
    } catch (error) {
      setAiFillError(
        error instanceof Error ? error.message : "AI enhance failed",
      );
      setAiFillReason("");
      return cleanInput;
    } finally {
      setStrategyEnhanceField(null);
    }
  };

  const addManualProduct = () => {
    const product: Product = {
      ...blankProduct(tenantId),
      id: `product-${Date.now()}`,
    };
    protectedProductIdsRef.current.add(product.id);
    setState((current) => ({
      ...current,
      activeProductId: product.id,
      activeSection: "dashboard",
      products: [...current.products, product],
    }));
  };

  const deleteProduct = (productId: string) => {
    protectedProductIdsRef.current.delete(productId);
    setState((current) => {
      const products = current.products.filter(
        (product) => product.id !== productId,
      );
      const activeProductId =
        current.activeProductId === productId
          ? products[0]?.id || ""
          : current.activeProductId;
      return {
        ...current,
        activeProductId,
        activeSection: products.length ? current.activeSection : "setup",
        products,
        sources: current.sources.filter((item) => item.productId !== productId),
        tasks: current.tasks.filter((item) => item.productId !== productId),
        deliveredEdits: current.deliveredEdits.filter(
          (item) => item.productId !== productId,
        ),
        reviews: current.reviews.filter((item) => item.productId !== productId),
        launchItems: current.launchItems.filter(
          (item) => item.productId !== productId,
        ),
        permissions: current.permissions.filter(
          (item) => item.productId !== productId,
        ),
      };
    });
  };

  const openCatalogPicker = () => {
    if (!catalogProducts.length) {
      addManualProduct();
      return;
    }
    setSelectedCatalogIds([]);
    setCatalogSearch("");
    setCatalogPickerOpen(true);
  };

  const importCatalogProducts = (ids = selectedCatalogIds) => {
    setState((current) => {
      const selectedIds = new Set(ids);
      const alreadyAddedCatalogIds = new Set(
        current.products.flatMap(
          (product) =>
            product.catalogItems?.map((item) => item.id) || [product.id],
        ),
      );
      const incoming = catalogProducts.filter(
        (product) =>
          selectedIds.has(product.id) &&
          !alreadyAddedCatalogIds.has(product.id),
      );
      if (!incoming.length) return current;
      const importedProduct =
        incoming.length > 1 ? createCatalogGroup(incoming) : incoming[0];
      protectedProductIdsRef.current.add(importedProduct.id);
      return {
        ...current,
        activeProductId: importedProduct.id,
        activeSection: "dashboard",
        products: [...current.products, importedProduct],
      };
    });
    setCatalogPickerOpen(false);
  };

  const catalogProductAlreadyAdded = (productId: string) =>
    state.products.some(
      (item) =>
        item.id === productId ||
        item.catalogItems?.some((catalogItem) => catalogItem.id === productId),
    );

  const toggleCatalogProduct = (productId: string) => {
    setSelectedCatalogIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  };

  const updateSourceLinkRow = (index: number, value: string) => {
    setSourceLinkRows((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
    setSourceLinkError("");
    setSourceLinkStatus("");
  };

  const addSourceLinkRow = () => {
    setSourceLinkRows((current) => [...current, ""]);
    setSourceLinkError("");
    setSourceLinkStatus("");
  };

  const removeSourceLinkRow = (index: number) => {
    setSourceLinkRows((current) =>
      current.length <= 1
        ? [""]
        : current.filter((_, itemIndex) => itemIndex !== index),
    );
    setSourceLinkError("");
    setSourceLinkStatus("");
  };

  const deleteSourceGroup = (sourceIds: string[], groupName: string) => {
    const ids = new Set(sourceIds);
    const sourceInUse =
      state.tasks.some((task) => ids.has(task.sourceCreativeId)) ||
      state.reviews.some((review) =>
        sourceCreativeIdList(review).some((id) => ids.has(id)),
      ) ||
      state.launchItems.some((item) =>
        sourceCreativeIdList(item).some((id) => ids.has(id)),
      );
    if (
      sourceInUse &&
      !window.confirm(
        `This source group is connected to existing briefs or reviews. Delete ${groupName} anyway?`,
      )
    )
      return;
    setState((current) => ({
      ...current,
      deletedSourceIds: uniqueStrings([
        ...(current.deletedSourceIds || []),
        ...sourceIds,
      ]),
      sources: current.sources.filter((source) => !ids.has(source.id)),
    }));
  };

  const updateLibrarySourceStatus = (
    sourceId: string,
    nextStatus: "ready" | "do not use",
  ) => {
    setState((current) => ({
      ...current,
      sources: current.sources.map((source) => {
        if (source.id !== sourceId) return source;
        if (nextStatus === "do not use")
          return { ...source, status: "do not use" };
        const stillAssigned = current.tasks.some(
          (task) =>
            task.status !== "archived" &&
            (task.sourceCreativeId === source.id ||
              (task.sourceGroupKey &&
                sourceMatchesGroupKey(source, task.sourceGroupKey))),
        );
        const status: SourceStatus =
          source.derivativeCount >= source.derivativeCap
            ? "maxed out"
            : stillAssigned
              ? "assigned"
              : "available";
        return { ...source, status };
      }),
    }));
  };

  const closeTask = (taskId: string) => {
    setTaskError("");
    setState((current) => ({
      ...current,
      tasks: current.tasks.map((item) =>
        item.id === taskId
          ? {
              ...item,
              status: "delivered" as TaskStatus,
              sourceUsageLocked: true,
              deletedAt: undefined,
            }
          : item,
      ),
    }));
  };

  const deleteTask = (taskId: string) => {
    const linkedEditIds = state.deliveredEdits
      .filter((edit) => edit.taskId === taskId)
      .map((edit) => edit.id);
    const linkedLaunchIds = state.launchItems
      .filter((item) => linkedEditIds.includes(item.deliveredEditId))
      .map((item) => item.id);
    const hasLinkedWork =
      linkedEditIds.length > 0 || linkedLaunchIds.length > 0;
    if (
      hasLinkedWork &&
      !window.confirm(
        "This brief already has delivered or approved work connected to it. Delete the brief and connected review/launch items?",
      )
    )
      return;

    setState((current) => {
      const task = current.tasks.find((item) => item.id === taskId);
      const editIds = current.deliveredEdits
        .filter((edit) => edit.taskId === taskId)
        .map((edit) => edit.id);
      const launchIds = current.launchItems
        .filter((item) => editIds.includes(item.deliveredEditId))
        .map((item) => item.id);
      const nextTasks = current.tasks.map((item) =>
        item.id === taskId
          ? {
              ...item,
              status: "archived" as TaskStatus,
              sourceUsageLocked: Boolean(
                item.status === "delivered" ||
                editIds.length ||
                launchIds.length,
              ),
              deletedAt: new Date().toISOString(),
            }
          : item,
      );
      return {
        ...current,
        tasks: nextTasks,
        deletedTaskIds: (current.deletedTaskIds || []).filter(
          (id) => id !== taskId,
        ),
        deletedDeliveredEditIds: uniqueStrings([
          ...(current.deletedDeliveredEditIds || []),
          ...editIds,
        ]),
        deletedReviewIds: uniqueStrings([
          ...(current.deletedReviewIds || []),
          ...current.reviews
            .filter((review) => editIds.includes(review.deliveredEditId))
            .map((review) => review.id),
        ]),
        sources: task
          ? current.sources.map((source) => {
              const matchesTaskSource =
                source.id === task.sourceCreativeId ||
                (task.sourceGroupKey &&
                  sourceMatchesGroupKey(source, task.sourceGroupKey));
              if (!matchesTaskSource) return source;
              const assignedTaskIds = (source.assignedTaskIds || []).filter(
                (id) => id !== taskId,
              );
              const stillAssigned = nextTasks.some(
                (item) =>
                  (item.sourceCreativeId === source.id ||
                    (item.sourceGroupKey &&
                      sourceMatchesGroupKey(source, item.sourceGroupKey))) &&
                  item.status !== "archived",
              );
              return {
                ...source,
                assignedTaskIds,
                status:
                  source.status === "maxed out" ||
                  source.status === "do not use"
                    ? source.status
                    : stillAssigned || source.derivativeCount > 0
                      ? "assigned"
                      : "available",
              };
            })
          : current.sources,
        deliveredEdits: current.deliveredEdits.filter(
          (edit) => edit.taskId !== taskId,
        ),
        reviews: current.reviews.filter(
          (review) => !editIds.includes(review.deliveredEditId),
        ),
        launchItems: current.launchItems.filter(
          (item) => !editIds.includes(item.deliveredEditId),
        ),
        performance: current.performance.filter(
          (item) => !launchIds.includes(item.launchItemId),
        ),
      };
    });
  };

  const restoreTask = (taskId: string) => {
    setTaskError("");
    setState((current) => {
      const task = current.tasks.find((item) => item.id === taskId);
      if (!task) return current;
      const nextTasks = current.tasks.map((item) =>
        item.id === taskId
          ? {
              ...item,
              status: "assigned" as TaskStatus,
              deletedAt: undefined,
              sourceUsageLocked: false,
            }
          : item,
      );
      return {
        ...current,
        tasks: nextTasks,
        deletedTaskIds: (current.deletedTaskIds || []).filter(
          (id) => id !== taskId,
        ),
        sources: current.sources.map((source) => {
          const matchesTaskSource =
            source.id === task.sourceCreativeId ||
            (task.sourceGroupKey &&
              sourceMatchesGroupKey(source, task.sourceGroupKey));
          if (!matchesTaskSource) return source;
          const assignedTaskIds = Array.from(
            new Set([...(source.assignedTaskIds || []), taskId]),
          );
          return {
            ...source,
            assignedTaskIds,
            assignedAt: source.assignedAt || new Date().toISOString(),
            status:
              source.status === "maxed out" || source.status === "do not use"
                ? source.status
                : "assigned",
          };
        }),
      };
    });
  };

  const reopenTask = (taskId: string) => {
    setTaskError("");
    setState((current) => {
      const task = current.tasks.find((item) => item.id === taskId);
      if (!task) return current;
      const nextTasks = current.tasks.map((item) =>
        item.id === taskId
          ? {
              ...item,
              status: "in progress" as TaskStatus,
              deletedAt: undefined,
              sourceUsageLocked: false,
            }
          : item,
      );
      return {
        ...current,
        tasks: nextTasks,
        deletedTaskIds: (current.deletedTaskIds || []).filter(
          (id) => id !== taskId,
        ),
        sources: current.sources.map((source) => {
          const matchesTaskSource =
            source.id === task.sourceCreativeId ||
            (task.sourceGroupKey &&
              sourceMatchesGroupKey(source, task.sourceGroupKey));
          if (!matchesTaskSource) return source;
          const assignedTaskIds = Array.from(
            new Set([...(source.assignedTaskIds || []), taskId]),
          );
          return {
            ...source,
            assignedTaskIds,
            assignedAt: source.assignedAt || new Date().toISOString(),
            status:
              source.status === "maxed out" || source.status === "do not use"
                ? source.status
                : "assigned",
          };
        }),
      };
    });
    toast.success("Brief reopened for the editor");
  };

  const postponeTask = (taskId: string, days = 3) => {
    setTaskError("");
    setState((current) => {
      const task = current.tasks.find((item) => item.id === taskId);
      if (!task) return current;
      const baseDate = task.dueDate ? new Date(task.dueDate) : new Date();
      const safeBaseDate = Number.isNaN(baseDate.getTime())
        ? new Date()
        : baseDate;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const nextDate = new Date(
        safeBaseDate.getTime() < today.getTime() ? today : safeBaseDate,
      );
      nextDate.setDate(nextDate.getDate() + days);
      const nextDueDate = nextDate.toISOString().slice(0, 10);
      const nextTasks = current.tasks.map((item) =>
        item.id === taskId
          ? {
              ...item,
              dueDate:
                item.scheduleType === "returning" ? item.dueDate : nextDueDate,
              status: "in progress" as TaskStatus,
              deletedAt: undefined,
              sourceUsageLocked: false,
            }
          : item,
      );
      return {
        ...current,
        tasks: nextTasks,
        deletedTaskIds: (current.deletedTaskIds || []).filter(
          (id) => id !== taskId,
        ),
        sources: current.sources.map((source) => {
          const matchesTaskSource =
            source.id === task.sourceCreativeId ||
            (task.sourceGroupKey &&
              sourceMatchesGroupKey(source, task.sourceGroupKey));
          if (!matchesTaskSource) return source;
          const assignedTaskIds = Array.from(
            new Set([...(source.assignedTaskIds || []), taskId]),
          );
          return {
            ...source,
            assignedTaskIds,
            assignedAt: source.assignedAt || new Date().toISOString(),
            status:
              source.status === "maxed out" || source.status === "do not use"
                ? source.status
                : "assigned",
          };
        }),
      };
    });
    toast.success(`Brief postponed ${days} days and reopened`);
  };

  const permanentlyDeleteTask = (taskId: string) => {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;
    if (
      !window.confirm(
        `Permanently delete "${task.brief}"? This cannot be undone.`,
      )
    )
      return;
    setState((current) => {
      const taskToDelete = current.tasks.find((item) => item.id === taskId);
      const editIds = current.deliveredEdits
        .filter((edit) => edit.taskId === taskId)
        .map((edit) => edit.id);
      const launchIds = current.launchItems
        .filter((item) => editIds.includes(item.deliveredEditId))
        .map((item) => item.id);
      const roomIds = taskToDelete
        ? [
            taskChatRoomId(taskToDelete),
            taskLegacyParticipantChatRoomId(taskToDelete),
            taskParticipantChatRoomId(taskToDelete),
          ]
        : [];
      return {
        ...current,
        deletedTaskIds: uniqueStrings([
          ...(current.deletedTaskIds || []),
          taskId,
        ]),
        deletedDeliveredEditIds: uniqueStrings([
          ...(current.deletedDeliveredEditIds || []),
          ...editIds,
        ]),
        deletedReviewIds: uniqueStrings([
          ...(current.deletedReviewIds || []),
          ...current.reviews
            .filter((review) => editIds.includes(review.deliveredEditId))
            .map((review) => review.id),
        ]),
        tasks: current.tasks.filter((item) => item.id !== taskId),
        deliveredEdits: current.deliveredEdits.filter(
          (edit) => edit.taskId !== taskId,
        ),
        reviews: current.reviews.filter(
          (review) => !editIds.includes(review.deliveredEditId),
        ),
        launchItems: current.launchItems.filter(
          (item) => !editIds.includes(item.deliveredEditId),
        ),
        performance: current.performance.filter(
          (item) => !launchIds.includes(item.launchItemId),
        ),
        chatMessages: current.chatMessages.filter(
          (message) => !roomIds.includes(message.roomId),
        ),
      };
    });
  };

  const taskSourceDraftValue = (task: CreativeTask) =>
    task.sourceGroupKey
      ? sourceGroupValue(task.sourceGroupKey)
      : task.sourceCreativeId;

  const sourceLabelByDraftValue = (value: string) => {
    const groupKey = sourceGroupKeyFromValue(value);
    if (groupKey) {
      const group =
        productTaskSelectionGroups.find((item) => item.key === groupKey) ||
        productSourceGroups.find((item) => item.key === groupKey);
      return group?.name || "Source set";
    }
    const source = productSources.find((item) => item.id === value);
    return source?.name || "Source material";
  };

  const sourceDraftIsSameAssignment = (task: CreativeTask, value: string) => {
    const groupKey = sourceGroupKeyFromValue(value);
    if (groupKey)
      return Boolean(task.sourceGroupKey && groupKey === task.sourceGroupKey);
    return value === task.sourceCreativeId;
  };

  const sourceDraftIsAssignable = (task: CreativeTask, value: string) => {
    if (sourceDraftIsSameAssignment(task, value)) return true;
    const groupKey = sourceGroupKeyFromValue(value);
    if (groupKey) {
      const group = productTaskSelectionGroups.find(
        (item) => item.key === groupKey,
      );
      return Boolean(group?.sources.length);
    }
    const source = productTaskSources.find((item) => item.id === value);
    return Boolean(source);
  };

  const sourceDraftOptionExists = (value: string) => {
    const groupKey = sourceGroupKeyFromValue(value);
    if (groupKey)
      return productTaskSelectionGroups.some((item) => item.key === groupKey);
    return productTaskSources.some((item) => item.id === value);
  };

  const startEditingBrief = (task: CreativeTask) => {
    setTaskError("");
    setBriefEditDrafts({
      [task.id]: {
        brief: task.brief,
        sourceCreativeId: taskSourceDraftValue(task),
        assignee: task.assignee,
        angles: optionsText(task.angles, task.angle),
        hooks: optionsText(task.hooks, task.hook),
        format: task.format,
        outputCount: String(task.outputCount || 1),
        dueDate:
          task.scheduleType === "returning"
            ? defaultDueDate()
            : normalizeFutureDueDate(task.dueDate),
        scheduleType:
          task.scheduleType === "returning" ? "returning" : "one-time",
        recurrenceDay: task.recurrenceDay || "sunday",
        notes: task.notes || "",
      },
    });
  };

  const cancelEditingBrief = (taskId: string) => {
    setTaskError("");
    setBriefEditDrafts((current) => {
      const next = { ...current };
      delete next[taskId];
      return next;
    });
  };

  const updateBriefEditDraft = (
    taskId: string,
    patch: Partial<BriefEditDraft>,
  ) => {
    setBriefEditDrafts((current) =>
      current[taskId]
        ? { ...current, [taskId]: { ...current[taskId], ...patch } }
        : current,
    );
  };

  const saveEditedBrief = (taskId: string) => {
    const draft = briefEditDrafts[taskId];
    if (!draft) return;
    const sourceGroupKeyValue = sourceGroupKeyFromValue(draft.sourceCreativeId);
    const selectedGroup = sourceGroupKeyValue
      ? productTaskSelectionGroups.find(
          (group) => group.key === sourceGroupKeyValue,
        ) ||
        productSourceGroups.find((group) => group.key === sourceGroupKeyValue)
      : null;
    const selectedSource =
      selectedGroup?.sources[0] ||
      productSources.find((source) => source.id === draft.sourceCreativeId);
    if (!selectedSource) {
      showBriefFieldError("Choose source material before saving the brief.");
      return;
    }
    const previousTaskForValidation = state.tasks.find(
      (item) => item.id === taskId,
    );
    if (
      previousTaskForValidation &&
      !sourceDraftIsAssignable(
        previousTaskForValidation,
        draft.sourceCreativeId,
      )
    ) {
      showBriefFieldError(
        "This source is already Used or paused. Keep the current source or choose a Ready source.",
      );
      return;
    }
    if (!draft.brief.trim()) {
      showBriefFieldError("Brief name cannot be empty.");
      return;
    }
    if (!draft.angles.trim() || !draft.hooks.trim()) {
      showBriefFieldError("Add angles and hooks before saving the brief.");
      return;
    }
    const outputCount = Math.max(1, Number(draft.outputCount) || 1);
    const dueDate =
      draft.scheduleType === "returning"
        ? nextWeekdayDate(draft.recurrenceDay)
        : normalizeFutureDueDate(draft.dueDate);
    const nextAngles = parseMultilineOptions(draft.angles, "", 20);
    const nextHooks = parseMultilineOptions(draft.hooks, "", 20);
    const previousTaskForSave = state.tasks.find((item) => item.id === taskId);
    if (!previousTaskForSave) return;
    const structuralChange = briefEditHasStructuralChanges(
      previousTaskForSave,
      draft,
      selectedSource.id,
      selectedGroup?.key,
      activeEditors,
    );
    if (
      previousTaskForSave.status === "delivered" &&
      structuralChange &&
      !window.confirm(
        "This brief is finished. Reopening it will move it back to the editor queue. Continue?",
      )
    ) {
      return;
    }
    const resolvedAssignee = resolveBriefAssignee(
      draft.assignee,
      activeEditors,
    );
    const reopeningFinishedBrief =
      previousTaskForSave.status === "delivered" && structuralChange;
    setTaskError("");
    setState((current) => {
      const previousTask = current.tasks.find((item) => item.id === taskId);
      if (!previousTask) return current;
      const nextStatus: TaskStatus =
        previousTask.status === "delivered" && structuralChange
          ? "assigned"
          : previousTask.status;
      const nextTask: CreativeTask = {
        ...previousTask,
        brief: draft.brief.trim(),
        sourceCreativeId: selectedSource.id,
        sourceGroupKey: selectedGroup?.key,
        sourceGroupName: selectedGroup?.name,
        sourceGroupUrl: selectedGroup?.backendFolderUrl,
        angle: nextAngles[0] || draft.angles.trim(),
        hook: nextHooks[0] || draft.hooks.trim(),
        angles: nextAngles,
        hooks: nextHooks,
        format: draft.format.trim() || previousTask.format,
        outputCount,
        dueDate,
        scheduleType: draft.scheduleType,
        recurrenceFrequency:
          draft.scheduleType === "returning" ? "weekly" : undefined,
        recurrenceDay:
          draft.scheduleType === "returning" ? draft.recurrenceDay : undefined,
        notes: draft.notes.trim(),
        assignee: resolvedAssignee,
        status: nextStatus,
        sourceUsageLocked:
          nextStatus === "assigned" ? false : previousTask.sourceUsageLocked,
      };
      const nextTasks = current.tasks.map((item) =>
        item.id === taskId ? nextTask : item,
      );
      const nextSources = current.sources.map((source) => {
        const wasLinked =
          source.id === previousTask.sourceCreativeId ||
          (previousTask.sourceGroupKey &&
            sourceMatchesGroupKey(source, previousTask.sourceGroupKey));
        const isLinked =
          source.id === nextTask.sourceCreativeId ||
          (nextTask.sourceGroupKey &&
            sourceMatchesGroupKey(source, nextTask.sourceGroupKey));
        if (!wasLinked && !isLinked) return source;
        const assignedTaskIds = new Set(source.assignedTaskIds || []);
        if (wasLinked) assignedTaskIds.delete(taskId);
        if (isLinked) assignedTaskIds.add(taskId);
        const stillAssigned = nextTasks.some(
          (task) =>
            task.status !== "archived" &&
            (task.sourceCreativeId === source.id ||
              (task.sourceGroupKey &&
                sourceMatchesGroupKey(source, task.sourceGroupKey))),
        );
        const status: SourceStatus =
          source.status === "maxed out" || source.status === "do not use"
            ? source.status
            : stillAssigned || source.derivativeCount > 0
              ? "assigned"
              : "available";
        return {
          ...source,
          assignedTaskIds: [...assignedTaskIds],
          assignedAt: isLinked
            ? source.assignedAt || new Date().toISOString()
            : source.assignedAt,
          status,
        };
      });
      return {
        ...current,
        tasks: nextTasks,
        sources: nextSources,
      };
    });
    toast.success(
      reopeningFinishedBrief
        ? "Brief saved and reopened for the editor"
        : "Brief saved",
    );
    cancelEditingBrief(taskId);
  };

  const addSourceLinks = async () => {
    if (
      !state.products.some((product) => product.id === selectedProduct.id) ||
      !selectedProduct.name.trim()
    ) {
      setSourceLinkError(
        "Choose a product or product group before importing source material.",
      );
      setSourceLinkStatus("");
      setActiveSection("setup");
      return;
    }

    if (!sourceLinkValues.length) {
      setSourceLinkError(
        "Paste at least one source file or source-set link first.",
      );
      return;
    }

    const invalidLink = sourceLinkValues.find(
      (link) => !/^https?:\/\//i.test(link),
    );
    if (invalidLink) {
      setSourceLinkError("Source links must start with https://.");
      return;
    }

    setSourceLinkStatus("Saving external source references...");
    setSourceLinkError("");
    try {
      const now = new Date().toISOString();
      const importedSources: SourceCreative[] = pendingSourceLinks
        .map((link, index) => {
          const name = sourceNameFromUrl(
            link,
            `Library source ${productSources.length + index + 1}`,
          );
          return {
            id: `source-library-${Date.now()}-${index}`,
            productId: selectedProduct.id,
            catalogScopeKey: catalogScopeKey(selectedProduct),
            name,
            creator: "Ainomiq Library",
            uploadedAt: now,
            type: sourceTypeFromUrl(link),
            status: "available",
            derivativeCount: 0,
            derivativeCap: selectedProduct.defaultDerivativeCap || 5,
            quality: "new",
            assetUrl: link,
            importName: name,
            importUrl: link,
            importSourceUrl: link,
            sourceFolderPath: name,
            originalAssetUrl: link,
            backendFolderUrl: "",
            thumbnailUrl: "",
          } as SourceCreative;
        })
        .filter((source: SourceCreative) => source.assetUrl);

      if (!importedSources.length)
        throw new Error("No source links were saved.");
      let addedCount = 0;
      setState((current) => {
        const existingKeys = new Set(
          current.sources.flatMap((source) =>
            [
              source.assetUrl,
              source.importSourceUrl,
              source.backendFolderUrl,
            ].filter(Boolean),
          ),
        );
        const newSources = importedSources.filter((source) => {
          const keys = [
            source.assetUrl,
            source.importSourceUrl,
            source.backendFolderUrl,
          ].filter(Boolean);
          return keys.every((key) => !existingKeys.has(key));
        });
        addedCount = newSources.length;
        return {
          ...current,
          activeSection: "sources",
          sources: [...current.sources, ...newSources],
        };
      });
      setSourceLinkRows([""]);
      setSourceLinkStatus(
        addedCount
          ? `Saved ${addedCount} external source reference${addedCount === 1 ? "" : "s"}. Upload files to store them in the Ainomiq Library.`
          : "Those source links were already in this product source library.",
      );
    } catch (error) {
      setSourceLinkStatus("");
      setSourceLinkError(
        error instanceof Error ? error.message : "Could not save source files.",
      );
    }
  };

  const importDriveLinksToLibrary = async () => {
    if (
      !state.products.some((product) => product.id === selectedProduct.id) ||
      !selectedProduct.name.trim()
    ) {
      setSourceLinkError(
        "Choose a product or product group before importing source material.",
      );
      setSourceLinkStatus("");
      setActiveSection("setup");
      return;
    }

    if (!sourceLinkValues.length) {
      setSourceLinkError(
        "Paste at least one Google Drive file or folder link first.",
      );
      return;
    }

    const invalidLink = sourceLinkValues.find(
      (link) => !/^https:\/\/drive\.google\.com\//i.test(link),
    );
    if (invalidLink) {
      setSourceLinkError(
        "The Drive import option only accepts Google Drive file or folder links.",
      );
      return;
    }

    setSourceLinkError("");
    setSourceLinkStatus(
      `Importing ${sourceLinkValues.length} Drive link${sourceLinkValues.length === 1 ? "" : "s"} into the Ainomiq Library...`,
    );
    try {
      const response = await fetch(
        "/api/ad-manager/creative-os/drive-source-import",
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_id: tenantId,
            product_id: selectedProduct.id,
            product_name: selectedProduct.name || selectedProductLabel,
            product_url: selectedProduct.url,
            links: sourceLinkValues,
            max_files: 500,
            actor: userEmail || userName || tenantId,
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || "Could not import Google Drive sources.");
      const imported = Array.isArray(data.imported) ? data.imported : [];
      const now = new Date().toISOString();
      const importedSources: SourceCreative[] = imported
        .map((item: any, index: number) => {
          const assetUrl = String(
            item.assetUrl || item.backendFolderUrl || "",
          ).trim();
          const name = String(
            item.name ||
              item.importName ||
              `Library source ${productSources.length + index + 1}`,
          ).trim();
          return {
            id: `source-drive-import-${String(item.assetId || Date.now())}-${index}`,
            productId: selectedProduct.id,
            catalogScopeKey: catalogScopeKey(selectedProduct),
            name,
            creator: "Ainomiq Library Upload",
            uploadedAt: now,
            type: item.type === "video" ? "video" : "image",
            status: "available",
            derivativeCount: 0,
            derivativeCap: selectedProduct.defaultDerivativeCap || 5,
            quality: "new",
            assetUrl,
            importName: String(item.importName || name),
            importUrl: "",
            importSourceUrl: "",
            sourceFolderPath: String(
              item.sourceFolderPath || selectedProduct.name || "",
            ),
            originalAssetUrl: assetUrl,
            driveFileId: String(item.originalFileId || ""),
            originalDriveFileId: String(item.originalFileId || ""),
            backendFolderId: String(item.backendFolderId || item.assetId || ""),
            backendFolderUrl: assetUrl,
            thumbnailUrl: String(item.thumbnailUrl || ""),
          } as SourceCreative;
        })
        .filter((source: SourceCreative) => source.assetUrl);

      if (!importedSources.length)
        throw new Error(
          "No image or video files were imported from those Drive links.",
        );
      let addedCount = 0;
      setState((current) => {
        const existingKeys = new Set(
          current.sources.flatMap((source) =>
            [
              source.assetUrl,
              source.driveFileId,
              source.originalDriveFileId,
            ].filter(Boolean),
          ),
        );
        const newSources = importedSources.filter((source) => {
          const keys = [
            source.assetUrl,
            source.driveFileId,
            source.originalDriveFileId,
          ].filter(Boolean);
          return keys.every((key) => !existingKeys.has(key));
        });
        addedCount = newSources.length;
        return {
          ...current,
          activeSection: "sources",
          sources: [...current.sources, ...newSources],
        };
      });
      setSourceLinkRows([""]);
      setSourceLinkStatus(
        addedCount
          ? `Imported ${addedCount} file${addedCount === 1 ? "" : "s"} from Google Drive into the Ainomiq Library.`
          : "Those Drive files were already imported into this product source library.",
      );
    } catch (error) {
      setSourceLinkStatus("");
      setSourceLinkError(
        error instanceof Error
          ? error.message
          : "Could not import Google Drive sources.",
      );
    }
  };

  const uploadSourceFiles = async (files: FileList | null) => {
    const selectedFiles = Array.from(files || []);
    if (!selectedFiles.length) return;
    if (
      !state.products.some((product) => product.id === selectedProduct.id) ||
      !selectedProduct.name.trim()
    ) {
      setSourceLinkError(
        "Choose a product or product group before uploading source material.",
      );
      setSourceLinkStatus("");
      setActiveSection("setup");
      return;
    }

    setSourceLinkError("");
    setSourceLinkStatus(
      `Uploading ${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"} to the Ainomiq Library...`,
    );
    try {
      const uploadedSources: SourceCreative[] = [];
      for (const [index, file] of selectedFiles.entries()) {
        const uploadResponse = await fetch("/api/creative-library/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_id: tenantId,
            file_name: file.name,
            content_type: file.type || "application/octet-stream",
          }),
        });
        const uploadData = await uploadResponse.json().catch(() => ({}));
        if (!uploadResponse.ok)
          throw new Error(
            uploadData.error || `Could not prepare upload for ${file.name}.`,
          );

        const upload = uploadData.upload || {};
        if (!upload.upload_url || !upload.key || !upload.asset_id)
          throw new Error(`Upload could not start for ${file.name}.`);

        const storageHeaders =
          upload.headers && typeof upload.headers === "object"
            ? upload.headers
            : {
                "Content-Type":
                  upload.mime_type || file.type || "application/octet-stream",
              };
        const storageResponse = await fetch(upload.upload_url, {
          method: upload.method || "PUT",
          headers: storageHeaders,
          body: file,
        });
        if (!storageResponse.ok) {
          const storageError = await storageResponse.text().catch(() => "");
          throw new Error(
            `Could not upload ${file.name} to Ainomiq storage${storageError ? `: ${storageError.slice(0, 120)}` : "."}`,
          );
        }

        const completeResponse = await fetch(
          "/api/creative-library/complete-upload",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tenant_id: tenantId,
              asset_id: upload.asset_id,
              key: upload.key,
              file_name: upload.file_name || file.name,
              mime_type:
                upload.mime_type || file.type || "application/octet-stream",
              file_size: file.size,
              type:
                upload.type ||
                (file.type.startsWith("video/") ? "video" : "image"),
              product_id: selectedProduct.id,
              product_name: selectedProduct.name,
              product_url: selectedProduct.url,
              tags: ["creative-os-source"],
              status: "ready",
              actor: userEmail || userName || tenantId,
            }),
          },
        );
        const completeData = await completeResponse.json().catch(() => ({}));
        if (!completeResponse.ok)
          throw new Error(
            completeData.error || `Could not save ${file.name} in Ainomiq.`,
          );

        const assetUrl = String(
          completeData.asset?.asset_url || upload.asset_url || "",
        ).trim();
        if (!assetUrl)
          throw new Error(
            `Upload finished, but no Library URL was returned for ${file.name}.`,
          );
        const now = new Date().toISOString();
        const uploadedName = String(
          completeData.asset?.name || upload.file_name || file.name,
        );
        const rootFolder = selectedProduct.name.trim();
        uploadedSources.push({
          id: `source-upload-${upload.asset_id || Date.now()}-${index}`,
          productId: selectedProduct.id,
          catalogScopeKey: catalogScopeKey(selectedProduct),
          name: uploadedName,
          creator: "Ainomiq Library Upload",
          uploadedAt: now,
          type:
            upload.type === "video" || file.type.startsWith("video/")
              ? "video"
              : "image",
          status: "available",
          derivativeCount: 0,
          derivativeCap: selectedProduct.defaultDerivativeCap || 5,
          quality: "new",
          assetUrl,
          // Prefix with the selected product/catalog so every upload groups
          // under that one catalog folder instead of one card per file.
          importName: rootFolder
            ? `${rootFolder}/${uploadedName}`
            : uploadedName,
          importUrl: "",
          importSourceUrl: "",
          sourceFolderPath: rootFolder,
          originalAssetUrl: assetUrl,
          backendFolderUrl: assetUrl,
          thumbnailUrl: upload.type === "video" ? "" : assetUrl,
        });
      }

      setState((current) => ({
        ...current,
        activeSection: "sources",
        sources: [...current.sources, ...uploadedSources],
      }));
      setSourceLinkStatus(
        `Uploaded ${uploadedSources.length} file${uploadedSources.length === 1 ? "" : "s"} to the Ainomiq Library.`,
      );
    } catch (error) {
      setSourceLinkStatus("");
      setSourceLinkError(
        error instanceof Error
          ? error.message
          : "Could not upload source files.",
      );
    }
  };

  const inviteEditor = async () => {
    const value = editorDraft.userName.trim();
    if (!value) {
      setEditorError("Add an editor email first.");
      return;
    }
    if (value.includes("@") && !looksLikeEmail(value)) {
      setEditorError("Enter a valid email address.");
      return;
    }
    if (!looksLikeEmail(value)) {
      setEditorError("Creative OS access requires a real email invite.");
      return;
    }

    const email = normalizeEmail(value);
    const alreadyActive = acceptedPermissions.find(
      (permission) =>
        normalizeEmail(permission.email || permission.userName) === email,
    );
    if (alreadyActive?.status === "accepted") {
      setEditorError("Already has access.");
      return;
    }
    if (alreadyActive?.status === "invited") {
      setEditorError("Invite already sent. Use Resend invite if needed.");
      return;
    }

    setEditorInviteStatus("sending");
    setEditorError("");
    try {
      const response = await fetch("/api/ad-manager/creative-os/invites", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          product_id: selectedProduct.id,
          email,
          user_name: email,
          role: editorDraft.role,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Invite failed");
      const permission = payload?.permission;
      if (permission) {
        setState((current) => ({
          ...current,
          activeSection: "access",
          permissions: [
            ...current.permissions.filter((item) => item.id !== permission.id),
            permission,
          ],
        }));
      }
      setEditorDraft({ userName: "", role: "editor" });
      setEditorInviteStatus(
        payload?.emailDelivery === "failed" ? "error" : "sent",
      );
      if (payload?.warning) setEditorError(payload.warning);
      await refreshCreativeOsState();
    } catch (error) {
      setEditorInviteStatus("error");
      setEditorError(
        error instanceof Error ? error.message : "Failed to send invite.",
      );
    }
  };

  const respondToInvite = async (
    permissionId: string,
    response: "accepted" | "rejected",
  ) => {
    const permission = state.permissions.find(
      (item) => item.id === permissionId,
    );
    if (!permission) return;
    try {
      const apiResponse = await fetch(
        "/api/ad-manager/creative-os/invites/respond",
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            tenant_id: tenantId,
            token: permission.inviteToken,
            permission_id: permissionId,
            response,
          }),
        },
      );
      const payload = await apiResponse.json().catch(() => null);
      if (!apiResponse.ok)
        throw new Error(payload?.error || "Failed to update invite");
      const updatedPermission = payload?.permission;
      if (updatedPermission) {
        setState((current) => ({
          ...current,
          permissions: current.permissions.map((item) =>
            item.id === updatedPermission.id ? updatedPermission : item,
          ),
        }));
      }
    } catch (error) {
      setEditorError(
        error instanceof Error ? error.message : "Failed to update invite.",
      );
    }
  };

  const removeEditor = async (permissionId: string) => {
    const permission = state.permissions.find(
      (item) => item.id === permissionId,
    );
    // Always remove locally first for instant UI feedback.
    setState((current) => ({
      ...current,
      permissions: current.permissions.filter(
        (item) => item.id !== permissionId,
      ),
    }));
    if (!permission) return;
    try {
      const res = await fetch("/api/ad-manager/creative-os/invites", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          permission_id: permissionId,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || "Failed to remove invite");
      if (payload?.warning) setEditorError(payload.warning);
      await refreshCreativeOsState();
    } catch (error) {
      setEditorError(
        error instanceof Error ? error.message : "Failed to remove invite.",
      );
      await refreshCreativeOsState();
    }
  };

  const resendInvite = async (permissionId: string) => {
    setEditorError("");
    try {
      const res = await fetch("/api/ad-manager/creative-os/invites", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          permission_id: permissionId,
          action: "resend",
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || "Failed to resend invite");
      if (payload?.permission) {
        setState((current) => ({
          ...current,
          permissions: current.permissions.map((item) =>
            item.id === payload.permission.id ? payload.permission : item,
          ),
        }));
      }
      setEditorInviteStatus(
        payload?.emailDelivery === "failed" ? "error" : "sent",
      );
      if (payload?.warning) setEditorError(payload.warning);
      await refreshCreativeOsState();
    } catch (error) {
      setEditorInviteStatus("error");
      setEditorError(
        error instanceof Error ? error.message : "Failed to resend invite.",
      );
    }
  };

  const inviteAgain = async (permission: ProductPermission) => {
    const email = normalizeEmail(permission.email || permission.userName);
    if (!email || !looksLikeEmail(email)) {
      setEditorError("This history item has no valid email to invite again.");
      return;
    }

    setEditorInviteStatus("sending");
    setEditorError("");
    try {
      const response = await fetch("/api/ad-manager/creative-os/invites", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          product_id: permission.productId,
          email,
          user_name: email,
          role: permission.role,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Invite failed");
      if (payload?.permission) {
        setState((current) => ({
          ...current,
          activeSection: "access",
          permissions: [
            ...current.permissions.filter(
              (item) => item.id !== payload.permission.id,
            ),
            payload.permission,
          ],
          permissionHistory: (current.permissionHistory || []).filter(
            (item) =>
              item.id !== permission.id && item.id !== payload.permission.id,
          ),
        }));
      }
      setEditorDraft({ userName: "", role: "editor" });
      setEditorInviteStatus(
        payload?.emailDelivery === "failed" ? "error" : "sent",
      );
      if (payload?.warning) setEditorError(payload.warning);
      await refreshCreativeOsState();
    } catch (error) {
      setEditorInviteStatus("error");
      setEditorError(
        error instanceof Error ? error.message : "Failed to invite again.",
      );
    }
  };

  const deleteInviteHistory = async (permissionId: string) => {
    setEditorError("");
    setDeletingInviteHistoryIds((current) =>
      current.includes(permissionId) ? current : [...current, permissionId],
    );
    setState((current) => ({
      ...current,
      permissionHistory: (current.permissionHistory || []).filter(
        (item) => item.id !== permissionId,
      ),
    }));
    try {
      const res = await fetch("/api/ad-manager/creative-os/invites", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          permission_id: permissionId,
          delete_history: true,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(payload?.error || "Failed to delete invite history");
      await refreshCreativeOsState();
    } catch (error) {
      setEditorError(
        error instanceof Error
          ? error.message
          : "Failed to delete invite history.",
      );
      await refreshCreativeOsState();
    } finally {
      setDeletingInviteHistoryIds((current) =>
        current.filter((id) => id !== permissionId),
      );
    }
  };

  const aiFillBriefDraft = async () => {
    if (briefAiStatus === "filling") return;
    setBriefAiStatus("filling");
    setBriefAiReason("");
    setTaskError("");
    try {
      const response = await fetch("/api/ad-manager/creative-os/brief-fill", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          product: {
            ...selectedProduct,
            sellingPoints: [],
            pains: [],
            claimBoundaries: [],
          },
          format: taskDraft.format,
          sourceName:
            selectedTaskSourceGroup?.name || selectedTaskSource?.name || "",
          personas: selectedBriefPersonas,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "AI brief fill failed");
      setTaskDraft((current) => ({
        ...current,
        sourceCreativeId:
          current.sourceCreativeId ||
          (selectedTaskSourceGroup
            ? sourceGroupValue(selectedTaskSourceGroup.key)
            : selectedTaskSource?.id || ""),
        angle:
          typeof data?.angle === "string" && data.angle.trim()
            ? data.angle.trim()
            : current.angle,
        hook:
          typeof data?.hook === "string" && data.hook.trim()
            ? data.hook.trim()
            : current.hook,
        angles: Array.isArray(data?.angles)
          ? data.angles.filter(Boolean).join("\n")
          : typeof data?.angle === "string"
            ? data.angle
            : current.angles,
        hooks: Array.isArray(data?.hooks)
          ? data.hooks.filter(Boolean).join("\n")
          : typeof data?.hook === "string"
            ? data.hook
            : current.hooks,
        notes:
          typeof data?.notes === "string" && data.notes.trim()
            ? mergeNotesWithStrategyContext(current.notes, data.notes)
            : current.notes,
      }));
      setBriefAiReason(
        typeof data?.why === "string"
          ? data.why
          : "Filled from selected product evidence.",
      );
      setBriefAiStatus("filled");
    } catch (error) {
      setBriefAiStatus("idle");
      setTaskError(
        error instanceof Error ? error.message : "AI brief fill failed.",
      );
    }
  };

  const applyBriefStrategyPick = (
    kind: "reason" | "pain" | "persona" | "claim" | "hook" | "style",
    value: string,
  ) => {
    const cleanValue = value.trim();
    if (!cleanValue) return;
    setTaskDraft((current) => {
      if (kind === "hook") {
        const currentHooks = parseMultilineOptions(
          current.hooks,
          "",
          20,
        ).filter(Boolean);
        const alreadySelected = currentHooks.some(
          (option) => option.toLowerCase() === cleanValue.toLowerCase(),
        );
        const hooks = alreadySelected
          ? removeOption(current.hooks, cleanValue)
          : appendUniqueOption(current.hooks, cleanValue);
        return {
          ...current,
          hooks,
          hook:
            alreadySelected &&
            current.hook.toLowerCase() === cleanValue.toLowerCase()
              ? parseMultilineOptions(hooks, "", 1)[0] || ""
              : current.hook ||
                parseMultilineOptions(hooks, cleanValue, 1)[0] ||
                cleanValue,
        };
      }
      if (kind === "style") {
        const currentStyles = parseMultilineOptions(
          current.format,
          "",
          20,
        ).filter(Boolean);
        const alreadySelected = currentStyles.some(
          (option) => option.toLowerCase() === cleanValue.toLowerCase(),
        );
        const format = alreadySelected
          ? removeOption(current.format, cleanValue)
          : appendUniqueOption(current.format, cleanValue);
        return { ...current, format };
      }
      if (kind === "reason") {
        const currentAngles = parseMultilineOptions(
          current.angles,
          "",
          20,
        ).filter(Boolean);
        const alreadySelected = currentAngles.some(
          (option) => option.toLowerCase() === cleanValue.toLowerCase(),
        );
        const angles = alreadySelected
          ? removeOption(current.angles, cleanValue)
          : appendUniqueOption(current.angles, cleanValue);
        return {
          ...current,
          angles,
          angle:
            alreadySelected &&
            current.angle.toLowerCase() === cleanValue.toLowerCase()
              ? parseMultilineOptions(angles, "", 1)[0] || ""
              : current.angle ||
                parseMultilineOptions(angles, cleanValue, 1)[0] ||
                cleanValue,
        };
      }
      if (kind === "pain") {
        const hookValue = cleanValue.endsWith("?")
          ? cleanValue
          : `Solves: ${cleanValue}`;
        const currentHooks = parseMultilineOptions(
          current.hooks,
          "",
          20,
        ).filter(Boolean);
        const alreadySelected = currentHooks.some(
          (option) => option.toLowerCase() === hookValue.toLowerCase(),
        );
        const hooks = alreadySelected
          ? removeOption(current.hooks, hookValue)
          : appendUniqueOption(current.hooks, hookValue);
        return {
          ...current,
          hooks,
          hook:
            alreadySelected &&
            current.hook.toLowerCase() === hookValue.toLowerCase()
              ? parseMultilineOptions(hooks, "", 1)[0] || ""
              : current.hook ||
                parseMultilineOptions(hooks, hookValue, 1)[0] ||
                hookValue,
        };
      }
      if (kind === "persona") {
        const notes = hasStrategyNote(
          current.notes,
          "Target persona",
          cleanValue,
        )
          ? removeStrategyNote(current.notes, "Target persona", cleanValue)
          : appendStrategyNote(current.notes, "Target persona", cleanValue);
        return { ...current, notes };
      }
      const notes = hasStrategyNote(current.notes, "Claim boundary", cleanValue)
        ? removeStrategyNote(current.notes, "Claim boundary", cleanValue)
        : appendStrategyNote(current.notes, "Claim boundary", cleanValue);
      return { ...current, notes };
    });
    setTaskError("");
  };

  const prepareBriefDraft = (): TaskDraft | null => {
    const sourceCreativeId =
      taskDraft.sourceCreativeId ||
      (selectedTaskSourceGroup
        ? sourceGroupValue(selectedTaskSourceGroup.key)
        : selectedTaskSource?.id || "");
    if (!sourceCreativeId) {
      showBriefFieldError("Choose source material before posting the brief.");
      return null;
    }
    if (!taskDraft.angles.trim() && !taskDraft.angle.trim()) {
      showBriefFieldError("Add at least one angle before posting the brief.");
      return null;
    }
    if (!taskDraft.hooks.trim() && !taskDraft.hook.trim()) {
      showBriefFieldError("Add at least one hook before posting the brief.");
      return null;
    }
    const totalOutputs =
      (Number(taskDraft.videoCount) || 0) + (Number(taskDraft.photoCount) || 0);
    if (totalOutputs < 1) {
      showBriefFieldError(
        "Add at least one video or photo output before posting the brief.",
      );
      return null;
    }
    const dueDate =
      taskDraft.scheduleType === "returning"
        ? nextWeekdayDate(taskDraft.recurrenceDay)
        : normalizeFutureDueDate(taskDraft.dueDate);
    if (
      taskDraft.scheduleType === "returning" &&
      !taskDraft.recurrenceDay.trim()
    ) {
      showBriefFieldError("Choose a delivery day before posting a returning brief.");
      return null;
    }

    setTaskError("");
    return {
      ...taskDraft,
      briefName: taskDraft.briefName.trim(),
      sourceCreativeId,
      dueDate,
      angle:
        taskDraft.angle.trim() ||
        parseMultilineOptions(taskDraft.angles, "", 1)[0] ||
        "",
      hook:
        taskDraft.hook.trim() ||
        parseMultilineOptions(taskDraft.hooks, "", 1)[0] ||
        "",
      angles: taskDraft.angles.trim() || taskDraft.angle.trim(),
      hooks: taskDraft.hooks.trim() || taskDraft.hook.trim(),
      outputCount: String(totalOutputs),
      notes: taskDraft.notes.trim(),
    };
  };

  const checkBriefSourceAvailability = async (draft: TaskDraft) => {
    const groupKey = sourceGroupKeyFromValue(draft.sourceCreativeId);
    const selectedGroup = groupKey
      ? productTaskSelectionGroups.find((group) => group.key === groupKey)
      : null;
    const sourcesToCheck = selectedGroup?.sources?.length
      ? selectedGroup.sources
      : productTaskSources.filter(
          (source) => source.id === draft.sourceCreativeId,
        );
    if (!sourcesToCheck.length) {
      setTaskError(
        "Choose available source material before posting the brief.",
      );
      return false;
    }
    const missingLibraryFiles = sourcesToCheck.filter(
      (source) => !sourceLibraryUrl(source),
    );
    if (missingLibraryFiles.length) {
      const names = missingLibraryFiles
        .slice(0, 4)
        .map((source) => source.name || "Source material")
        .join(", ");
      showBriefFieldError(
        `Import source material into the Ainomiq Library before posting this brief: ${names}.`,
      );
      return false;
    }
    return true;
  };

  const postBriefDraft = async () => {
    if (briefCreateStatus === "creating") return;
    const prepared = prepareBriefDraft();
    if (!prepared) return;
    setBriefCreateStatus("creating");
    const sourceAvailable = await checkBriefSourceAvailability(prepared);
    if (!sourceAvailable) {
      setBriefCreateStatus("idle");
      return;
    }
    const created = createEditorTask(prepared);
    setBriefCreateStatus(created ? "created" : "idle");
    if (created) {
      toast.success("Brief posted");
      window.setTimeout(() => setBriefCreateStatus("idle"), 1200);
    }
  };

  const createEditorTask = (draftOverride?: TaskDraft) => {
    const draft = draftOverride || taskDraft;
    const groupKey = sourceGroupKeyFromValue(draft.sourceCreativeId);
    const selectedGroup = groupKey
      ? productTaskSelectionGroups.find((group) => group.key === groupKey)
      : null;
    const groupSources = selectedGroup?.sources || [];
    const existingSource =
      groupSources[0] ||
      productTaskSources.find((item) => item.id === draft.sourceCreativeId) ||
      productTaskSources[0];
    const source = existingSource;
    if (!source) {
      showBriefFieldError(
        productSources.length
          ? "All saved sources for this product are maxed out or marked do not use. Add a new source link first."
          : "Add source material to the Ainomiq Library before posting briefs.",
      );
      return false;
    }
    const assignee = draft.assignee.trim() || "Unassigned";
    const assignees = selectedEditorPermissions.length
      ? selectedEditorPermissions.map((permission) =>
          editorAssigneeValue(permission),
        )
      : [resolveBriefAssignee(assignee, activeEditors)];
    const angle = draft.angle.trim() || defaultAngle;
    const hook = draft.hook.trim() || defaultHook;
    const angles = parseMultilineOptions(draft.angles || draft.angle, angle, 8);
    const hooks = parseMultilineOptions(draft.hooks || draft.hook, hook, 10);
    const due =
      draft.scheduleType === "returning"
        ? nextWeekdayDate(draft.recurrenceDay)
        : normalizeFutureDueDate(draft.dueDate);
    const videoCount = Math.max(0, Number(draft.videoCount) || 0);
    const photoCount = Math.max(0, Number(draft.photoCount) || 0);
    const outputCount = Math.max(
      1,
      videoCount + photoCount || Number(draft.outputCount) || 1,
    );
    const brief =
      draft.briefName.trim() ||
      `${selectedProduct.name || "Product"} - ${angles[0]} - ${hooks[0]}`;
    const now = Date.now();
    const chatRoomId = `room-${now}`;
    const tasks: CreativeTask[] = assignees.map((assigneeName, index) => ({
      id: `task-${now}-${index}`,
      chatRoomId,
      productId: selectedProduct.id,
      sourceCreativeId: source.id,
      sourceGroupKey: selectedGroup?.key,
      sourceGroupName: selectedGroup?.name,
      sourceGroupUrl: selectedGroup?.backendFolderUrl,
      brief,
      angle: angles[0],
      hook: hooks[0],
      angles,
      hooks,
      format: draft.format.trim(),
      videoCount,
      videoFormat: draft.videoFormat,
      photoCount,
      photoFormat: draft.photoFormat,
      outputCount,
      dueDate: due,
      scheduleType: draft.scheduleType,
      recurrenceFrequency:
        draft.scheduleType === "returning"
          ? draft.recurrenceFrequency
          : undefined,
      recurrenceDay:
        draft.scheduleType === "returning" ? draft.recurrenceDay : undefined,
      notes: draft.notes.trim(),
      assignee: assigneeName,
      status: "assigned",
    }));
    setState((current) => ({
      ...current,
      activeSection: "tasks",
      sources: current.sources.map((item) => {
        const sourceIsSelected = selectedGroup
          ? selectedGroup.sources.some(
              (groupSource) => groupSource.id === item.id,
            )
          : item.id === source.id;
        if (!sourceIsSelected) return item;
        return {
          ...item,
          status:
            item.status === "maxed out" || item.status === "do not use"
              ? item.status
              : "assigned",
          assignedAt: item.assignedAt || new Date().toISOString(),
          assignedTaskIds: Array.from(
            new Set([
              ...(item.assignedTaskIds || []),
              ...tasks.map((task) => task.id),
            ]),
          ),
        };
      }),
      tasks: [...current.tasks, ...tasks],
    }));
    setTaskDraft(createInitialTaskDraft());
    setSelectedEditorIds([]);
    setTaskError("");
    return tasks[0]?.id || "";
  };

  const updateReadyAdRow = (index: number, value: string) => {
    setReadyAdRows((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
    setReadyAdError("");
  };

  const addReadyAdRow = () => {
    setReadyAdRows((current) => [...current, ""]);
    setReadyAdError("");
  };

  const removeReadyAdRow = (index: number) => {
    setReadyAdRows((current) =>
      current.length <= 1
        ? [""]
        : current.filter((_, itemIndex) => itemIndex !== index),
    );
    setReadyAdError("");
  };

  const updateDeliveryDraft = (
    taskId: string,
    field: "previewUrl" | "sourceUsedUrl" | "adName",
    value: string,
  ) => {
    setDeliveryDrafts((current) => ({
      ...current,
      [taskId]: {
        previewUrl: current[taskId]?.previewUrl || "",
        sourceUsedUrl: current[taskId]?.sourceUsedUrl || "",
        adName: current[taskId]?.adName || "",
        [field]: value,
      },
    }));
    setTaskError("");
  };

  const updateDeliveryDraftLine = (
    taskId: string,
    field: "previewUrl" | "sourceUsedUrl" | "adName",
    index: number,
    value: string,
  ) => {
    setDeliveryDrafts((current) => {
      const existing = current[taskId] || { previewUrl: "", sourceUsedUrl: "", adName: "" };
      const lines = String(existing[field] || "").split("\n");
      while (lines.length <= index) lines.push("");
      lines[index] = value;
      return {
        ...current,
        [taskId]: {
          ...existing,
          [field]: lines.join("\n"),
        },
      };
    });
    setTaskError("");
  };

  const deliveryUploadKey = (taskId: string, index = 0) => `${taskId}:${index}`;

  const uploadFinishedAdFile = async (
    taskId: string,
    file: File | undefined,
    index = 0,
  ) => {
    if (!file) return;
    const uploadKey = deliveryUploadKey(taskId, index);
    setTaskError("");
    setDeliveryUploadState((current) => ({
      ...current,
      [uploadKey]: {
        status: "uploading",
        message: `Uploading ${file.name} to Ainomiq...`,
      },
    }));

    try {
      const uploadResponse = await fetch("/api/creative-library/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          file_name: file.name,
          content_type: file.type || "application/octet-stream",
        }),
      });
      const uploadData = await uploadResponse.json().catch(() => ({}));
      if (!uploadResponse.ok)
        throw new Error(
          uploadData.error || `Could not prepare upload for ${file.name}.`,
        );

      const upload = uploadData.upload || {};
      if (!upload.upload_url || !upload.key || !upload.asset_id)
        throw new Error(`Upload could not start for ${file.name}.`);

      const storageHeaders =
        upload.headers && typeof upload.headers === "object"
          ? upload.headers
          : {
              "Content-Type":
                upload.mime_type || file.type || "application/octet-stream",
            };
      const storageResponse = await fetch(upload.upload_url, {
        method: upload.method || "PUT",
        headers: storageHeaders,
        body: file,
      });
      if (!storageResponse.ok) {
        const storageError = await storageResponse.text().catch(() => "");
        throw new Error(
          `Could not upload ${file.name} to Ainomiq storage${storageError ? `: ${storageError.slice(0, 120)}` : "."}`,
        );
      }

      const completeResponse = await fetch(
        "/api/creative-library/complete-upload",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_id: tenantId,
            asset_id: upload.asset_id,
            key: upload.key,
            file_name: upload.file_name || file.name,
            mime_type:
              upload.mime_type || file.type || "application/octet-stream",
            file_size: file.size,
            type:
              upload.type ||
              (file.type.startsWith("video/") ? "video" : "image"),
            product_id: selectedProduct.id,
            product_name: selectedProduct.name || "Finished ads",
            product_url: selectedProduct.url,
            tags: ["creative-os-delivery"],
            status: "ready",
            actor: userEmail || userName || tenantId,
          }),
        },
      );
      const completeData = await completeResponse.json().catch(() => ({}));
      if (!completeResponse.ok)
        throw new Error(
          completeData.error || `Could not save ${file.name} in Ainomiq.`,
        );

      const assetUrl = String(
        completeData.asset?.asset_url || upload.asset_url || "",
      ).trim();
      if (!assetUrl)
        throw new Error(
          `Upload finished, but no Ainomiq file URL was returned for ${file.name}.`,
        );

      const uploadedTask = state.tasks.find((task) => task.id === taskId);
      const uploadedTaskExpectedOutputs = Math.max(
        1,
        Number(uploadedTask?.outputCount) || 1,
      );
      if (
        uploadedTask &&
        (isReturningBrief(uploadedTask) || uploadedTaskExpectedOutputs > 1)
      ) {
        updateDeliveryDraftLine(taskId, "previewUrl", index, assetUrl);
      } else {
        updateDeliveryDraft(taskId, "previewUrl", assetUrl);
      }
      setDeliveryUploadState((current) => ({
        ...current,
        [uploadKey]: {
          status: "uploaded",
          message: `${file.name} uploaded to Ainomiq.`,
        },
      }));
    } catch (error) {
      setDeliveryUploadState((current) => ({
        ...current,
        [uploadKey]: {
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Could not upload finished ad.",
        },
      }));
    }
  };

  const uploadFinishedAdFiles = (
    taskId: string,
    files: File[],
    startIndex = 0,
    remainingSlots = files.length,
  ) => {
    const availableSlots = Math.max(0, remainingSlots - startIndex);
    const selectedFiles =
      availableSlots > 0 ? files.slice(0, availableSlots) : [];
    selectedFiles.forEach((file, offset) => {
      void uploadFinishedAdFile(taskId, file, startIndex + offset);
    });
    if (files.length > selectedFiles.length) {
      toast.info(
        `Only ${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"} fit in the remaining output slots.`,
      );
    }
  };

  const addDeliveryDraftLine = (taskId: string, maxCount: number) => {
    setDeliveryDrafts((current) => {
      const existing = current[taskId] || { previewUrl: "", sourceUsedUrl: "", adName: "" };
      const nextCount = Math.min(
        maxCount,
        deliveryDraftLineCount(existing) + 1,
      );
      return {
        ...current,
        [taskId]: {
          previewUrl: deliveryDraftLines(existing.previewUrl, nextCount).join(
            "\n",
          ),
          sourceUsedUrl: deliveryDraftLines(
            existing.sourceUsedUrl,
            nextCount,
          ).join("\n"),
        },
      };
    });
    setTaskError("");
  };

  const removeDeliveryDraftLine = (taskId: string, index: number) => {
    setDeliveryDrafts((current) => {
      const existing = current[taskId] || { previewUrl: "", sourceUsedUrl: "", adName: "" };
      const lineCount = deliveryDraftLineCount(existing);
      const nextCount = Math.max(1, lineCount - 1);
      const removeAt = Math.max(0, Math.min(index, lineCount - 1));
      const previewLines = deliveryDraftLines(
        existing.previewUrl,
        lineCount,
      ).filter((_, lineIndex) => lineIndex !== removeAt);
      const sourceLines = deliveryDraftLines(
        existing.sourceUsedUrl,
        lineCount,
      ).filter((_, lineIndex) => lineIndex !== removeAt);
      const adNameLines = deliveryDraftLines(
        existing.adName || "",
        lineCount,
      ).filter((_, lineIndex) => lineIndex !== removeAt);
      return {
        ...current,
        [taskId]: {
          previewUrl: deliveryDraftLines(
            previewLines.join("\n"),
            nextCount,
          ).join("\n"),
          sourceUsedUrl: deliveryDraftLines(
            sourceLines.join("\n"),
            nextCount,
          ).join("\n"),
          adName: deliveryDraftLines(adNameLines.join("\n"), nextCount).join(
            "\n",
          ),
        },
      };
    });
    setTaskError("");
  };

  const addReadyAdsToReview = () => {
    const links = readyAdRows
      .flatMap((item) => item.split(/\n|,/))
      .map((item) => item.trim())
      .filter(Boolean);

    if (!links.length) {
      setReadyAdError("Paste at least one ready ad link first.");
      return;
    }

    const invalidLink = links.find((link) => !/^https?:\/\//i.test(link));
    if (invalidLink) {
      setReadyAdError("Ready ad links must start with https://.");
      return;
    }
    setState((current) => {
      const existingUrls = new Set(
        current.deliveredEdits.map((edit) => edit.previewUrl),
      );
      const now = new Date().toISOString();
      const newEdits: DeliveredEdit[] = links
        .filter((link) => !existingUrls.has(link))
        .map((link, index) => {
          const cleanPath =
            link.split("?")[0].split("/").filter(Boolean).pop() ||
            `Ready ad ${productReviews.length + index + 1}`;
          const decodedName = decodeURIComponent(cleanPath).replace(
            /[-_]+/g,
            " ",
          );
          return {
            id: `ready-edit-${Date.now()}-${index}`,
            productId: selectedProduct.id,
            taskId: "ready-ad-link",
            sourceCreativeId: "ready-ad-link",
            editor: "Uploaded ready ad",
            angle: "Ready ad",
            hook: isGoogleHostedSource(decodedName)
              ? `Ready ad ${productReviews.length + index + 1}`
              : decodedName,
            briefSummary:
              "Ready ad link added directly for review. Not source material.",
            previewUrl: link,
            deliveredAt: now,
            status: "delivered",
          };
        });

      if (!newEdits.length) return current;

      const newReviews: ReviewItem[] = newEdits.map((edit) => ({
        id: `ready-review-${edit.id}`,
        deliveredEditId: edit.id,
        productId: edit.productId,
        sourceCreativeId: edit.sourceCreativeId,
        editor: edit.editor,
        angle: edit.angle,
        hook: edit.hook,
        briefSummary: edit.briefSummary,
        feedback: "",
        status: "ready",
      }));

      return {
        ...current,
        activeSection: "review",
        deliveredEdits: [...current.deliveredEdits, ...newEdits],
        reviews: [...current.reviews, ...newReviews],
      };
    });
    setReadyAdRows([""]);
    setReadyAdError("");
  };

  const markTaskDelivered = (taskId: string) => {
    const draft = deliveryDrafts[taskId] || {
      previewUrl: "",
      sourceUsedUrl: "",
      adName: "",
    };
    const taskForValidation = state.tasks.find((item) => item.id === taskId);
    const returning = taskForValidation
      ? isReturningBrief(taskForValidation)
      : false;
    const expectedOutputs = Math.max(
      1,
      Number(taskForValidation?.outputCount) || 1,
    );
    const multipleOutputs = returning || expectedOutputs > 1;
    const existingDeliveredCount = multipleOutputs
      ? occupiedOutputCountForTask(state, taskId)
      : 0;
    const remainingOutputs = Math.max(
      0,
      expectedOutputs - existingDeliveredCount,
    );
    const draftCount = multipleOutputs
      ? Math.min(deliveryDraftLineCount(draft), Math.max(1, remainingOutputs))
      : 1;
    const assignedTaskSources = taskForValidation
      ? taskForValidation.sourceGroupKey
        ? state.sources.filter((item) =>
            sourceMatchesGroupKey(item, taskForValidation.sourceGroupKey || ""),
          )
        : state.sources.filter(
            (item) => item.id === taskForValidation.sourceCreativeId,
          )
      : [];
    const defaultLibrarySourceUrls = librarySourceOptions(
      assignedTaskSources,
    ).map((option) => option.value);
    const parsedPreviewUrls = parseDeliveryLinks(draft.previewUrl);
    const parsedSourceUrls = parseDeliveryLinks(
      draft.sourceUsedUrl || defaultLibrarySourceUrls[0] || "",
    );
    const deliveryPairs = multipleOutputs
      ? deliveryDraftLines(draft.previewUrl, draftCount)
          .map((previewUrl, index) => ({
            previewUrl: previewUrl.trim(),
            adName:
              deliveryDraftLines(draft.adName || "", draftCount)[
                index
              ]?.trim() || "",
            sourceUsedUrls: parseDeliveryLinks(
              deliveryDraftLines(draft.sourceUsedUrl, draftCount)[index] ||
                defaultLibrarySourceUrls[0] ||
                "",
            ),
          }))
          .filter((pair) => pair.previewUrl || pair.sourceUsedUrls.length)
      : parsedPreviewUrls.map((previewUrl, index) => ({
          previewUrl,
          adName: draft.adName?.trim() || "",
          sourceUsedUrls:
            parsedPreviewUrls.length === 1
              ? parsedSourceUrls
              : parsedSourceUrls[index]
                ? [parsedSourceUrls[index]]
                : parsedSourceUrls.length === 1
                  ? [parsedSourceUrls[0]]
                  : [],
        }));
    const previewUrls = deliveryPairs.map((pair) => pair.previewUrl);
    const allSourceUsedUrls = deliveryPairs.flatMap(
      (pair) => pair.sourceUsedUrls,
    );
    if (multipleOutputs && remainingOutputs <= 0) {
      setTaskError(
        returning
          ? "This weekly brief already has all requested ads submitted."
          : "This brief already has all requested ads submitted.",
      );
      return;
    }
    if (multipleOutputs && deliveryPairs.length > remainingOutputs) {
      setTaskError(
        `Only ${remainingOutputs} ad${remainingOutputs === 1 ? "" : "s"} left for this brief.`,
      );
      return;
    }
    if (
      !previewUrls.length ||
      previewUrls.some((link) => !link || !/^https?:\/\//i.test(link))
    ) {
      setTaskError(
        multipleOutputs
          ? "Upload at least one finished ad file."
          : "Upload the finished ad file before requesting approval.",
      );
      return;
    }
    if (
      !allSourceUsedUrls.length ||
      deliveryPairs.some((pair) => !pair.sourceUsedUrls.length) ||
      allSourceUsedUrls.some((link) => !link || !/^https?:\/\//i.test(link))
    ) {
      setTaskError(
        multipleOutputs
          ? "Choose the Library file used for each ad you submit."
          : "Choose the Library file used before requesting approval.",
      );
      return;
    }
    if (taskForValidation) {
      const unmatchedSourceUrl = allSourceUsedUrls.find(
        (sourceUrl) =>
          !findDeliveredSource(taskForValidation, state.sources, sourceUrl),
      );
      if (unmatchedSourceUrl) {
        setTaskError(
          taskForValidation.sourceGroupKey
            ? "That Library file does not match this brief. Choose a file from the assigned Library folder."
            : "That Library file does not match the assigned Library file.",
        );
        return;
      }
    }
    setState((current) => {
      const task = current.tasks.find((item) => item.id === taskId);
      if (!task || task.status === "delivered" || task.status === "archived")
        return current;
      const returning = isReturningBrief(task);
      const expectedOutputs = Math.max(1, Number(task.outputCount) || 1);
      const multipleOutputs = returning || expectedOutputs > 1;
      const previewUrlsForTask = multipleOutputs ? previewUrls : [previewUrls[0]];
      const adNamesForTask = multipleOutputs
        ? deliveryPairs.map(
            (pair, index) =>
              pair.adName ||
              suggestedAdNameForTask(
                task,
                existingDeliveredCount + index + 1,
              ),
          )
        : [deliveryPairs[0]?.adName || suggestedAdNameForTask(task, 1)];
      const sourceUrlsForTask = multipleOutputs
        ? deliveryPairs.map((pair) => pair.sourceUsedUrls)
        : [deliveryPairs[0]?.sourceUsedUrls || []];
      const existingEdit = multipleOutputs
        ? null
        : current.deliveredEdits.find((item) => item.taskId === task.id);
      const existingReview = existingEdit
        ? current.reviews.find(
            (item) => item.deliveredEditId === existingEdit.id,
          )
        : null;
      if (existingEdit) {
        const sourceUrls = sourceUrlsForTask[0] || [];
        const sources = findDeliveredSources(task, current.sources, sourceUrls);
        const source = sources[0];
        if (!source) return current;
        const sourceIds = sources.map((item) => item.id);
        const nextTaskStatus: TaskStatus =
          approvedCountForTask(current, task.id) >= expectedOutputs
            ? "delivered"
            : "in progress";
        return {
          ...current,
          activeSection: canManageAccess ? "review" : current.activeSection,
          tasks: current.tasks.map((item) =>
            item.id === taskId ? { ...item, status: nextTaskStatus } : item,
          ),
          deliveredEdits: current.deliveredEdits.map((item) =>
            item.id === existingEdit.id
              ? {
                  ...item,
                  sourceCreativeId: source.id,
                  sourceCreativeIds: sourceIds,
                  previewUrl: previewUrlsForTask[0] || item.previewUrl,
                  adName: adNamesForTask[0] || item.adName,
                  sourceUsedUrl: sourceUrls[0],
                  sourceUsedUrls: sourceUrls,
                  outputCount: 1,
                }
              : item,
          ),
          reviews: existingReview
            ? current.reviews
            : [
                ...current.reviews,
                {
                  id: `review-${existingEdit.id}`,
                  deliveredEditId: existingEdit.id,
                  productId: task.productId,
                  sourceCreativeId: source.id,
                  sourceCreativeIds: sourceIds,
                  editor: task.assignee,
                  angle: task.angle,
                  hook: task.hook,
                  adName: adNamesForTask[0] || suggestedAdNameForTask(task, 1),
                  briefSummary: task.brief,
                  sourceUsedUrl: sourceUrls[0],
                  sourceUsedUrls: sourceUrls,
                  feedback: "",
                  status: "ready",
                },
              ],
        };
      }
      const deliveryStamp = Date.now();
      const deliveredAt = new Date().toISOString();
      const edits: DeliveredEdit[] = previewUrlsForTask
        .map((previewUrl, index) => {
          const sourceUrls =
            sourceUrlsForTask[index] || sourceUrlsForTask[0] || [];
          const sources = findDeliveredSources(
            task,
            current.sources,
            sourceUrls,
          );
          const source = sources[0];
          if (!source) return null;
          const sourceIds = sources.map((item) => item.id);
          const deliveredId = multipleOutputs
            ? `edit-${task.id}-${deliveryStamp}-${index}`
            : `edit-${task.id}`;
          return {
            id: deliveredId,
            productId: task.productId,
            taskId: task.id,
            sourceCreativeId: source.id,
            sourceCreativeIds: sourceIds,
            editor: task.assignee,
            angle: task.angle,
            hook: task.hook,
            adName:
              adNamesForTask[index] ||
              suggestedAdNameForTask(task, index + 1, source),
            briefSummary: multipleOutputs
              ? `${task.brief} - Output ${index + 1}/${previewUrlsForTask.length}`
              : task.brief,
            previewUrl,
            sourceUsedUrl: sourceUrls[0],
            sourceUsedUrls: sourceUrls,
            outputCount: 1,
            deliveredAt,
            status: "delivered" as const,
          };
        })
        .filter(Boolean) as DeliveredEdit[];
      if (!edits.length) return current;
      const nextTaskStatus: TaskStatus =
        approvedCountForTask(current, task.id) >= expectedOutputs
          ? "delivered"
          : "in progress";
      const reviews: ReviewItem[] = edits.map((edit) => ({
        id: `review-${edit.id}`,
        deliveredEditId: edit.id,
        productId: edit.productId,
        sourceCreativeId: edit.sourceCreativeId,
        sourceCreativeIds: sourceCreativeIdList(edit),
        editor: edit.editor,
        angle: edit.angle,
        hook: edit.hook,
        adName: edit.adName,
        briefSummary: edit.briefSummary,
        sourceUsedUrl: sourceUsedUrlList(edit)[0],
        sourceUsedUrls: sourceUsedUrlList(edit),
        feedback: "",
        status: "ready",
      }));
      return {
        ...current,
        activeSection: canManageAccess ? "review" : current.activeSection,
        tasks: current.tasks.map((item) =>
          item.id === taskId ? { ...item, status: nextTaskStatus } : item,
        ),
        deliveredEdits: [...current.deliveredEdits, ...edits],
        reviews: [...current.reviews, ...reviews],
      };
    });
    setDeliveryDrafts((current) => {
      const next = { ...current };
      delete next[taskId];
      return next;
    });
    if (isCreativeEditor && !returning) setEditorTab("delivered");
  };

  const approveReview = async (reviewId: string) => {
    setReviewActionError("");
    setState((current) => {
      const review = current.reviews.find((item) => item.id === reviewId);
      if (!review) return current;
      const edit = current.deliveredEdits.find(
        (item) => item.id === review.deliveredEditId,
      );
      const sourceIds = sourceCreativeIdList(review).length
        ? sourceCreativeIdList(review)
        : sourceCreativeIdList(edit);
      const sources = sourceIds
        .map((sourceId) => current.sources.find((item) => item.id === sourceId))
        .filter((source): source is SourceCreative => Boolean(source));
      const primarySource =
        sources[0] ||
        current.sources.find((item) => item.id === review.sourceCreativeId);
      if (
        current.launchItems.some(
          (item) => item.deliveredEditId === review.deliveredEditId,
        )
      ) {
        const hasRemainingReadyReviews = current.reviews.some(
          (item) => item.id !== reviewId && item.status === "ready",
        );
        const nextState: CreativeOsState = {
          ...current,
          activeSection: hasRemainingReadyReviews ? "review" : "launch",
          reviews: current.reviews.filter((item) => item.id !== reviewId),
          deletedReviewIds: uniqueStrings([
            ...(current.deletedReviewIds || []),
            reviewId,
          ]),
        };
        if (edit?.taskId) {
          nextState.tasks = nextState.tasks.map((task) => {
            if (task.id !== edit.taskId || task.status === "archived")
              return task;
            const expectedOutputs = Math.max(1, Number(task.outputCount) || 1);
            return approvedCountForTask(nextState, task.id) >= expectedOutputs
              ? { ...task, status: "delivered" as TaskStatus }
              : { ...task, status: "in progress" as TaskStatus };
          });
        }
        return nextState;
      }
      const launch: LaunchItem = {
        id: `launch-${review.deliveredEditId}`,
        productId: review.productId,
        sourceCreativeId: primarySource?.id || review.sourceCreativeId,
        sourceCreativeIds: sources.map((item) => item.id),
        deliveredEditId: review.deliveredEditId,
        sourceUsedUrl: sourceUsedUrlList(review).length
          ? sourceUsedUrlList(review)[0]
          : sourceUsedUrlList(edit)[0],
        sourceUsedUrls: sourceUsedUrlList(review).length
          ? sourceUsedUrlList(review)
          : sourceUsedUrlList(edit),
        approvedCreative: `${review.angle} - ${review.hook}`,
        recommendedAdName:
          review.adName ||
          edit?.adName ||
          `${productNameById.get(review.productId) || "Product"} - ${review.angle} - ${new Date().toISOString().slice(0, 10)}`,
        status: "ready",
      };
      const hasRemainingReadyReviews = current.reviews.some(
        (item) => item.id !== reviewId && item.status === "ready",
      );
      const nextState: CreativeOsState = {
        ...current,
        activeSection: hasRemainingReadyReviews ? "review" : "launch",
        reviews: current.reviews.filter((item) => item.id !== reviewId),
        deletedReviewIds: uniqueStrings([
          ...(current.deletedReviewIds || []),
          reviewId,
        ]),
        launchItems: [...current.launchItems, launch],
      };
      if (sources.length) {
        const updatedSources = new Map<string, SourceCreative>();
        sources.forEach((source) => {
          const nextUsageCount = approvedSourceUsageCount(nextState, source.id);
          updatedSources.set(source.id, {
            ...source,
            derivativeCount: nextUsageCount,
            status:
              nextUsageCount >= source.derivativeCap
                ? "maxed out"
                : nextUsageCount > 0
                  ? "assigned"
                  : "available",
          } as SourceCreative);
        });
        nextState.sources = nextState.sources.map(
          (item) => updatedSources.get(item.id) || item,
        );
      }
      if (edit?.taskId) {
        nextState.tasks = nextState.tasks.map((task) => {
          if (task.id !== edit.taskId || task.status === "archived")
            return task;
          const expectedOutputs = Math.max(1, Number(task.outputCount) || 1);
          return approvedCountForTask(nextState, task.id) >= expectedOutputs
            ? { ...task, status: "delivered" as TaskStatus }
            : { ...task, status: "in progress" as TaskStatus };
        });
      }
      return nextState;
    });
  };

  const rejectReview = (reviewId: string) => {
    setState((current) => {
      const review = current.reviews.find((item) => item.id === reviewId);
      const edit = review
        ? current.deliveredEdits.find(
            (item) => item.id === review.deliveredEditId,
          )
        : null;
      const task = edit
        ? current.tasks.find((item) => item.id === edit.taskId)
        : null;
      return {
        ...current,
        deletedDeliveredEditIds: edit
          ? uniqueStrings([...(current.deletedDeliveredEditIds || []), edit.id])
          : current.deletedDeliveredEditIds || [],
        deletedReviewIds: uniqueStrings([
          ...(current.deletedReviewIds || []),
          reviewId,
        ]),
        reviews: current.reviews.filter((item) => item.id !== reviewId),
        deliveredEdits: edit
          ? current.deliveredEdits.filter((item) => item.id !== edit.id)
          : current.deliveredEdits,
        tasks:
          task && task.status !== "archived"
            ? current.tasks.map((item) =>
                item.id === task.id
                  ? { ...item, status: "in progress" as TaskStatus }
                  : item,
              )
            : current.tasks,
      };
    });
  };

  const requestRevision = async (reviewId: string) => {
    const baseState = latestStateRef.current;
    const review = baseState.reviews.find((item) => item.id === reviewId);
    if (!review?.feedback.trim()) {
      setReviewActionError("Add feedback before sending a revision request.");
      setRevisionSendStatus((current) => ({ ...current, [reviewId]: "error" }));
      return;
    }
    const feedback = review.feedback.trim();
    setHiddenRevisionReviewIds((current) =>
      current.includes(reviewId) ? current : [...current, reviewId],
    );
    const revisionRequestId = `revision-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const revisionRequestedAt = new Date().toISOString();
    const edit = baseState.deliveredEdits.find(
      (item) => item.id === review.deliveredEditId,
    );
    const task = edit
      ? baseState.tasks.find((item) => item.id === edit.taskId)
      : null;
    const product = baseState.products.find(
      (item) =>
        item.id === (review.productId || edit?.productId || task?.productId),
    );
    const revisionChatMessage: ChatMessage | null = task
      ? {
          id: `chat-revision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          productId: task.productId,
          taskId: task.id,
          roomId: taskParticipantChatRoomId({
            ...task,
            assignee: task.assignee || review.editor,
          }),
          authorEmail: normalizeEmail(userEmail || userName || tenantId),
          authorName: userName || userEmail || "Founder",
          authorRole: "founder",
          body: revisionFeedbackChatBody({
            productName: product?.name || selectedProduct.name || "Product",
            task,
            review,
            edit,
            feedback,
          }),
          createdAt: revisionRequestedAt,
        }
      : null;
    setReviewActionError("");
    setRevisionSendStatus((current) => ({ ...current, [reviewId]: "sending" }));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const nextState: CreativeOsState = {
      ...baseState,
      deletedDeliveredEditIds: edit
        ? uniqueStrings([...(baseState.deletedDeliveredEditIds || []), edit.id])
        : baseState.deletedDeliveredEditIds || [],
      deletedReviewIds: uniqueStrings([
        ...(baseState.deletedReviewIds || []),
        reviewId,
      ]),
      reviews: baseState.reviews.filter((item) => item.id !== reviewId),
      deliveredEdits: edit
        ? baseState.deliveredEdits.filter((item) => item.id !== edit.id)
        : baseState.deliveredEdits,
      tasks: baseState.tasks.map((task) => {
        const currentReview = baseState.reviews.find(
          (item) => item.id === reviewId,
        );
        const edit = currentReview
          ? baseState.deliveredEdits.find(
              (item) => item.id === currentReview.deliveredEditId,
            )
          : null;
        return edit?.taskId === task.id && task.status !== "archived"
          ? { ...task, status: "in progress" as TaskStatus }
          : task;
      }),
      chatMessages: revisionChatMessage
        ? [...baseState.chatMessages, revisionChatMessage]
        : baseState.chatMessages,
    };
    latestStateRef.current = nextState;
    setState(nextState);

    try {
      for (
        let attempt = 0;
        attempt < 150 && saveInFlight.current;
        attempt += 1
      ) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (saveInFlight.current) throw new Error("Save is still busy");
      saveInFlight.current = true;
      pendingSave.current = false;
      setSaveStatus("saving");
      const response = await fetch("/api/ad-manager/creative-os", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, state: nextState }),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          errorText || `Revision feedback save failed (${response.status})`,
        );
      }
      setSaveStatus("saved");
      setRevisionSendStatus((current) => ({ ...current, [reviewId]: "sent" }));
    } catch (error) {
      console.warn("[Creative OS revision feedback failed]", error);
      setSaveStatus("error");
      setReviewActionError("Could not send revision feedback. Try again.");
      setRevisionSendStatus((current) => ({ ...current, [reviewId]: "error" }));
      setHiddenRevisionReviewIds((current) =>
        current.filter((id) => id !== reviewId),
      );
      latestStateRef.current = baseState;
      setState(baseState);
    } finally {
      saveInFlight.current = false;
      if (pendingSave.current) {
        pendingSave.current = false;
        setTimeout(() => {
          void runAutosave();
        }, 0);
      }
    }
  };

  const updateReviewFeedback = (reviewId: string, feedback: string) => {
    setRevisionSendStatus((current) => {
      if (!current[reviewId]) return current;
      const next = { ...current };
      delete next[reviewId];
      return next;
    });
    setState((current) => {
      const next = {
        ...current,
        reviews: current.reviews.map((item) =>
          item.id === reviewId ? { ...item, feedback } : item,
        ),
      };
      latestStateRef.current = next;
      return next;
    });
  };

  const updateLaunchStatus = (launchItemId: string, status: LaunchStatus) => {
    setState((current) => ({
      ...current,
      launchItems: current.launchItems.map((item) =>
        item.id === launchItemId ? { ...item, status } : item,
      ),
    }));
  };

  const moveLaunchItemBackToReview = (launchItemId: string) => {
    setState((current) => {
      const launchItem = current.launchItems.find(
        (item) => item.id === launchItemId,
      );
      if (!launchItem) return current;
      const edit = current.deliveredEdits.find(
        (item) => item.id === launchItem.deliveredEditId,
      );
      const review: ReviewItem = {
        id: `review-${launchItem.deliveredEditId}-${Date.now()}`,
        deliveredEditId: launchItem.deliveredEditId,
        productId: launchItem.productId || edit?.productId || "",
        sourceCreativeId: launchItem.sourceCreativeId || edit?.sourceCreativeId || "",
        sourceCreativeIds: launchItem.sourceCreativeIds?.length
          ? launchItem.sourceCreativeIds
          : edit?.sourceCreativeIds,
        editor: edit?.editor || "",
        angle: edit?.angle || launchItem.approvedCreative.split(" - ")[0] || "",
        hook:
          edit?.hook ||
          launchItem.approvedCreative.split(" - ").slice(1).join(" - ") ||
          launchItem.approvedCreative,
        adName: edit?.adName || launchItem.recommendedAdName,
        briefSummary: edit?.briefSummary || launchItem.recommendedAdName,
        sourceUsedUrl: launchItem.sourceUsedUrl || edit?.sourceUsedUrl,
        sourceUsedUrls: launchItem.sourceUsedUrls?.length
          ? launchItem.sourceUsedUrls
          : edit?.sourceUsedUrls,
        feedback: "",
        status: "ready" as ReviewStatus,
      };
      return {
        ...current,
        activeSection: "review",
        reviews: [...current.reviews, review],
        launchItems: current.launchItems.filter((item) => item.id !== launchItemId),
      };
    });
  };

  const guideSteps = useMemo(
    () => [
      {
        title: "Choose products",
        body: "Pick one product or product set first. Library sources are organized under those products.",
        action: "Open Products",
        done: state.products.length > 0,
        onClick: () => setActiveSection("dashboard"),
      },
      {
        title: "Choose source material",
        body: "Upload files or import source folders into the Ainomiq Library.",
        action: "Open Library",
        done: state.sources.length > 0,
        onClick: () => setActiveSection("sources"),
      },
      {
        title: "Build ad brief",
        body: "Turn product, sources and angle into one clear brief. Smart defaults fill the boring fields.",
        action: "Build brief",
        done: state.tasks.length > 0,
        onClick: () => setActiveSection("tasks"),
      },
      {
        title: "Review and launch",
        body: "Review like Filestage and Frame.io: visual approval first, then launch and learn from winners.",
        action: "Review ads",
        done: state.reviews.length > 0 || state.launchItems.length > 0,
        onClick: () => setActiveSection("review"),
      },
    ],
    [
      state.products.length,
      state.sources.length,
      state.tasks.length,
      state.reviews.length,
      state.launchItems.length,
    ],
  );

  useEffect(() => {
    const firstOpenStep = guideSteps.findIndex((step) => !step.done);
    const nextStepIndex = firstOpenStep >= 0 ? firstOpenStep : 0;
    setGuideStepIndex(nextStepIndex);
  }, [guideSteps]);

  const openGuideStep = (index: number) => {
    const boundedIndex = Math.max(0, Math.min(index, guideSteps.length - 1));
    setGuideStepIndex(boundedIndex);
    guideSteps[boundedIndex]?.onClick();
  };

  const openNextGuideStep = () => {
    const nextIndex = Math.min(guideStepIndex + 1, guideSteps.length - 1);
    openGuideStep(nextIndex);
  };

  const screenNav: AutomationNavItem[] = [
    {
      id: "products",
      label: "Products",
      icon: Package,
      active:
        state.activeSection === "dashboard" || state.activeSection === "setup",
      onClick: () => setActiveSection("setup"),
    },
    {
      id: "sources",
      label: "Library",
      icon: Archive,
      active: state.activeSection === "sources",
      onClick: () => setActiveSection("sources"),
    },
    {
      id: "brand",
      label: "Brand",
      icon: BookOpen,
      active: state.activeSection === "brand",
      onClick: () => setActiveSection("brand"),
    },
    {
      id: "tasks",
      label: "Post Briefs",
      icon: Target,
      active: state.activeSection === "tasks",
      onClick: () => setActiveSection("tasks"),
    },
    {
      id: "review",
      label: "Review Ads",
      icon: CheckCircle2,
      badge: counts.review || undefined,
      active: state.activeSection === "review",
      onClick: () => setActiveSection("review"),
    },
    {
      id: "launch",
      label: "Launch",
      icon: Sparkles,
      active: state.activeSection === "launch",
      onClick: () => setActiveSection("launch"),
    },
    {
      id: "learning",
      label: "Learning",
      icon: BarChart3,
      active: state.activeSection === "learning",
      onClick: () => setActiveSection("learning"),
    },
    {
      id: "chat",
      label: "Chat",
      icon: MessageCircle,
      badge: showChatNotificationBadge ? chatNotificationCount : undefined,
      active: state.activeSection === "chat",
      group: "settings",
      onClick: () => setActiveSection("chat"),
    },
    ...(canManageAccess
      ? [
          {
            id: "access",
            label: "Settings",
            icon: Settings,
            active: state.activeSection === "access",
            group: "settings",
            onClick: () => setActiveSection("access"),
          } as AutomationNavItem,
        ]
      : []),
  ];

  if (!ready) {
    return (
      <div className="p-6 text-sm bg-white border rounded-2xl border-slate-200 text-slate-500">
        Loading Creative OS...
      </div>
    );
  }

  if (isCreativeEditor) {
    const hasAssignedBriefs = editorAssignedTasksAll.length > 0;
    const editorView =
      hasAssignedBriefs || editorTab === "brand" || editorTab === "info"
        ? editorTab
        : "work";
    const scopedSourceIds = new Set(
      editorTaskScope.map((task) => task.sourceCreativeId).filter(Boolean),
    );
    const scopedGroupKeys = new Set(
      editorTaskScope.map((task) => task.sourceGroupKey).filter(Boolean),
    );
    const editorSources = productSources.filter(
      (source) =>
        scopedSourceIds.has(source.id) ||
        scopedGroupKeys.has(sourceGroupKey(source)) ||
        scopedGroupKeys.has(sourceRootGroupKey(source)),
    );
    const editorLibraryPreviewSource =
      editorSources.find((source) => source.id === libraryPreviewSourceId) ||
      null;
    const editorSourceGroups = Array.from(
      editorSources
        .reduce((groups, source) => {
          const rootName = sourceRootGroupName(source);
          const key = rootName
            ? sourceRootGroupKey(source)
            : sourceGroupKey(source);
          const name = rootName || sourceGroupName(source);
          const current = groups.get(key) || {
            key,
            name,
            importUrl:
              source.importUrl || source.originalAssetUrl || source.assetUrl,
            backendFolderUrl: sourceLibraryUrl(source) || undefined,
            isLegacy: !source.importName,
            sources: [] as SourceCreative[],
          };
          current.sources.push(source);
          if (
            !current.importUrl &&
            (source.importUrl || source.originalAssetUrl || source.assetUrl)
          )
            current.importUrl =
              source.importUrl || source.originalAssetUrl || source.assetUrl;
          if (!current.backendFolderUrl && isAinomiqStoredSource(source))
            current.backendFolderUrl =
              source.backendFolderUrl || source.assetUrl;
          groups.set(key, current);
          return groups;
        }, new Map<string, { key: string; name: string; importUrl?: string; backendFolderUrl?: string; isLegacy: boolean; sources: SourceCreative[] }>())
        .values(),
    );
    const editorWorkNav: AutomationNavItem[] = hasAssignedBriefs
      ? [
          {
            id: "work",
            label: "My ad tasks",
            icon: Target,
            active: editorTab === "work",
            onClick: () => setEditorTab("work"),
          },
          {
            id: "sources",
            label: "Library",
            icon: Archive,
            active: editorTab === "sources",
            onClick: () => setEditorTab("sources"),
          },
          {
            id: "delivered",
            label: "Submitted work",
            icon: CheckCircle2,
            active: editorTab === "delivered",
            onClick: () => setEditorTab("delivered"),
          },
        ]
      : [
          {
            id: "work",
            label: "My ad tasks",
            icon: Target,
            active: editorView === "work",
            onClick: () => setEditorTab("work"),
          },
        ];
    const editorNav: AutomationNavItem[] = [
      ...editorWorkNav,
      {
        id: "brand",
        label: "Brand",
        icon: BookOpen,
        active: editorTab === "brand",
        onClick: () => setEditorTab("brand"),
      },
      ...(hasAssignedBriefs
        ? [
            {
              id: "chat",
              label: "Chat",
              icon: MessageCircle,
              badge: showChatNotificationBadge
                ? chatNotificationCount
                : undefined,
              active: editorTab === "chat",
              group: "settings",
              onClick: () => setEditorTab("chat"),
            } as AutomationNavItem,
          ]
        : []),
      {
        id: "info",
        label: "Info",
        icon: CircleHelp,
        active: editorTab === "info",
        group: "settings",
        onClick: () => setEditorTab("info"),
      },
    ];

    return (
      <>
        <AutomationWorkspaceLayout
          items={editorNav}
          variant="shadcn"
          contentClassName="bg-background/85"
        >
          {editorView === "brand" ? (
            <BrandKnowledgeCard brand={state.brand} companyName={companyName} />
          ) : null}

          {editorView === "work" ? (
            <div className="space-y-3">
              {taskError ? (
                <Alert variant="destructive">
                  <AlertDescription>{taskError}</AlertDescription>
                </Alert>
              ) : null}
              {!hasAssignedBriefs ? <EditorEmptyBriefsCard /> : null}
              <GridList
                title="My ad tasks"
                subtitle="Only briefs assigned to your editor account are shown here."
                emptyText="No Creative OS briefs are assigned to this email yet."
                layout="wide"
                items={editorTaskScope.map((task) => {
                  const source = productSources.find(
                    (item) => item.id === task.sourceCreativeId,
                  );
                  const taskSources = task.sourceGroupKey
                    ? productSources.filter((item) =>
                        sourceMatchesGroupKey(item, task.sourceGroupKey || ""),
                      )
                    : source
                      ? [source]
                      : [];
                  const sourceOptions = librarySourceOptions(taskSources);
                  const storedTaskSource =
                    taskSources.find(isAinomiqStoredSource) ||
                    (source && isAinomiqStoredSource(source)
                      ? source
                      : undefined);
                  const taskSourceHref = storedTaskSource
                    ? sourceLibraryUrl(storedTaskSource)
                    : "";
                  const expectedOutputs = Math.max(
                    1,
                    Number(task.outputCount) || 1,
                  );
                  const submittedOutputs = occupiedOutputCountForTask(
                    state,
                    task.id,
                  );
                  const revisionReview = editorReviews.find((review) => {
                    const edit = productEdits.find(
                      (item) => item.id === review.deliveredEditId,
                    );
                    return (
                      review.status === "revision requested" &&
                      edit?.taskId === task.id
                    );
                  });
                  const remainingOutputs = Math.max(
                    0,
                    expectedOutputs - submittedOutputs,
                  );
                  const hasMultipleOutputs =
                    isReturningBrief(task) || expectedOutputs > 1;
                  const draftSlots = hasMultipleOutputs
                    ? Math.min(
                        Math.max(
                          1,
                          deliveryDraftLineCount(deliveryDrafts[task.id]),
                        ),
                        Math.max(1, remainingOutputs),
                      )
                    : 1;
                  const taskUploadInProgress = Object.entries(
                    deliveryUploadState,
                  ).some(
                    ([key, value]) =>
                      key.startsWith(`${task.id}:`) &&
                      value.status === "uploading",
                  );
                  return (
                    <EditorTaskCard
                      key={task.id}
                      task={task}
                      productName={selectedProduct.name || "Selected product"}
                      source={source}
                      taskSources={taskSources}
                      sourceOptions={sourceOptions}
                      taskSourceHref={taskSourceHref}
                      taskSourceLabelText={taskSourceLabel(task, source)}
                      expectedOutputs={expectedOutputs}
                      submittedOutputs={submittedOutputs}
                      remainingOutputs={remainingOutputs}
                      draftSlots={draftSlots}
                      revisionReview={revisionReview}
                      deliveryDraft={deliveryDrafts[task.id]}
                      suggestedAdName={(index = 1) =>
                        suggestedAdNameForTask(task, index, source)
                      }
                      deliveryUploadState={deliveryUploadState}
                      taskUploadInProgress={taskUploadInProgress}
                      deliveryUploadKey={deliveryUploadKey}
                      deliveryDraftLines={deliveryDraftLines}
                      onBrowseLibrary={() => setEditorTab("sources")}
                      onMarkDelivered={() => markTaskDelivered(task.id)}
                      onOpenChat={() => openChatRoom(taskChatRoomId(task))}
                      onUploadFinishedAd={(file, index) =>
                        uploadFinishedAdFile(task.id, file, index)
                      }
                      onUploadFinishedAds={(files, index) =>
                        uploadFinishedAdFiles(
                          task.id,
                          files,
                          index,
                          remainingOutputs,
                        )
                      }
                      onUpdateDeliveryDraft={(field, value) =>
                        updateDeliveryDraft(task.id, field, value)
                      }
                      onUpdateDeliveryDraftLine={(field, index, value) =>
                        updateDeliveryDraftLine(task.id, field, index, value)
                      }
                      onRemoveDeliveryDraftLine={(index) =>
                        removeDeliveryDraftLine(task.id, index)
                      }
                      onAddDeliveryDraftLine={() =>
                        addDeliveryDraftLine(task.id, remainingOutputs)
                      }
                    />
                  );
                })}
              />
            </div>
          ) : null}

          {editorView === "sources" ? (
            <div className="space-y-4">
              <SectionTitle
                title="Ainomiq Library"
                subtitle="Only source files assigned through your briefs are visible here."
              />
              {editorSourceGroups.length ? (
                <div className="space-y-3">
                  {editorSourceGroups.map((group) => (
                    <CreativeLibraryGroupBrowser
                      key={group.key}
                      group={group}
                      activeFolderKey={activeLibraryFolderKey}
                      onOpenFolder={setActiveLibraryFolderKey}
                      onPreviewSource={setLibraryPreviewSourceId}
                    />
                  ))}
                </div>
              ) : (
                <Alert className="border-dashed">
                  <AlertDescription>
                    No Library sources are connected to your assigned briefs yet.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : null}

          {editorView === "delivered" ? (
            <GridList
              title="Delivered work"
              subtitle="Your submitted work and review status."
              emptyText="Nothing delivered from this editor account yet."
              items={editorDeliveredEdits.map((edit) => {
                const review = editorReviews.find(
                  (item) => item.deliveredEditId === edit.id,
                );
                return (
                  <EditorDeliveredCard
                    key={edit.id}
                    previewUrl={edit.previewUrl}
                    title={edit.briefSummary}
                    deliveredAt={formatDate(edit.deliveredAt)}
                    status={review?.status || "delivered"}
                    feedback={review?.feedback}
                  />
                );
              })}
            />
          ) : null}

          {editorView === "chat" ? (
            <ChatPanel
              emptyText="No chat rooms yet. A chat appears when a brief is assigned."
              rooms={chatRooms}
              selectedRoomId={activeChatRoom?.id || ""}
              messages={activeChatMessages}
              currentUserEmail={editorIdentity}
              draft={activeChatRoom ? chatDrafts[activeChatRoom.id] || "" : ""}
              onSelectRoom={setSelectedChatRoomId}
              onDraftChange={(value) =>
                activeChatRoom &&
                setChatDrafts((current) => ({
                  ...current,
                  [activeChatRoom.id]: value,
                }))
              }
              onSend={() =>
                activeChatRoom && sendChatMessage(activeChatRoom.id)
              }
              onDeleteMessage={deleteChatMessage}
            />
          ) : null}

          {editorView === "info" ? <EditorInfoPanel /> : null}
        </AutomationWorkspaceLayout>

        {editorLibraryPreviewSource ? (
          <LibraryPreviewModal
            source={editorLibraryPreviewSource}
            onClose={() => setLibraryPreviewSourceId("")}
          />
        ) : null}
      </>
    );
  }

  return (
    <div className="space-y-6">
      {!systemInstalled ? (
        <LiveSetupGuide
          steps={guideSteps}
          activeIndex={guideStepIndex}
          onSelect={openGuideStep}
          onNext={openNextGuideStep}
        />
      ) : null}

      <AutomationWorkspaceLayout
        items={screenNav}
        variant="shadcn"
        contentClassName="bg-background/85"
      >
        {(state.activeSection === "dashboard" ||
          state.activeSection === "setup") && (
          <ProductsTab
            sectionRefs={sectionRefs}
            state={state}
            selectedProduct={selectedProduct}
            selectedProductLabel={selectedProductLabel}
            saveStatus={saveStatus}
            catalogProducts={catalogProducts}
            productFieldSuggestions={productFieldSuggestions}
            activeEditors={activeEditors}
            selectActiveProduct={selectActiveProduct}
            deleteProduct={deleteProduct}
            openCatalogPicker={openCatalogPicker}
            addManualProduct={addManualProduct}
            updateProduct={updateProduct}
            aiFillProductFields={aiFillProductFields}
            aiFillStatus={aiFillStatus}
            textMatchesAiSuggestion={textMatchesAiSuggestion}
            listMatchesAiSuggestion={listMatchesAiSuggestion}
            upgradeStrategyList={upgradeStrategyList}
            strategyUpgradeField={strategyUpgradeField}
            enhanceStrategyDraft={enhanceStrategyDraft}
            strategyEnhanceField={strategyEnhanceField}
          />
        )}

        {state.activeSection === "sources" && state.products.length ? (
          <LibraryTab
            sectionRefs={sectionRefs}
            productSources={productSources}
            productSourceGroups={productSourceGroups}
            sourceLinkRows={sourceLinkRows}
            sourceLinkError={sourceLinkError}
            sourceLinkStatus={sourceLinkStatus}
            sourceLinkValues={sourceLinkValues}
            activeLibraryFolderKey={activeLibraryFolderKey}
            updateSourceLinkRow={updateSourceLinkRow}
            addSourceLinkRow={addSourceLinkRow}
            removeSourceLinkRow={removeSourceLinkRow}
            addSourceLinks={addSourceLinks}
            importDriveLinksToLibrary={importDriveLinksToLibrary}
            uploadSourceFiles={uploadSourceFiles}
            setActiveLibraryFolderKey={setActiveLibraryFolderKey}
            setLibraryPreviewSourceId={setLibraryPreviewSourceId}
            deleteSourceGroup={deleteSourceGroup}
            updateLibrarySourceStatus={updateLibrarySourceStatus}
          />
        ) : null}

        {canManageAccess && state.activeSection === "brand" ? (
          <BrandTab
            sectionRefs={sectionRefs}
            brand={state.brand}
            companyName={companyName}
            brandFillStatus={brandFillStatus}
            brandFillError={brandFillError}
            magicFillBrand={magicFillBrand}
            updateBrand={updateBrand}
            addBrandReferenceLink={addBrandReferenceLink}
            updateBrandReferenceLink={updateBrandReferenceLink}
            removeBrandReferenceLink={removeBrandReferenceLink}
          />
        ) : null}

        {state.activeSection === "tasks" && (
          <PostBriefsTab
            sectionRefs={sectionRefs}
            state={state}
            selectedProduct={selectedProduct}
            taskDraft={taskDraft}
            setTaskDraft={setTaskDraft}
            productTaskSources={productTaskSources}
            productTaskSelectionGroups={productTaskSelectionGroups}
            productSources={productSources}
            selectedTaskSource={selectedTaskSource}
            selectedTaskSourceGroup={selectedTaskSourceGroup}
            activeEditors={activeEditors}
            selectedEditorIds={selectedEditorIds}
            setSelectedEditorIds={setSelectedEditorIds}
            selectedEditorPermissions={selectedEditorPermissions}
            canManageAccess={canManageAccess}
            teamMemberLabel={teamMemberLabel}
            optionalTeamText={optionalTeamText}
            selectedBriefPersonas={selectedBriefPersonas}
            refreshBriefPersonas={() => upgradeStrategyList("personas")}
            briefPersonasRefreshing={strategyUpgradeField === "personas"}
            selectedBriefAngles={selectedBriefAngles}
            refreshBriefAngles={() => upgradeStrategyList("sellingPoints")}
            briefAnglesRefreshing={strategyUpgradeField === "sellingPoints"}
            selectedBriefHooks={selectedBriefHooks}
            refreshBriefHooks={() => upgradeStrategyList("pains")}
            briefHooksRefreshing={strategyUpgradeField === "pains"}
            briefStyleOptions={CREATIVE_STYLE_OPTIONS}
            selectedBriefStyles={selectedBriefStyles}
            applyBriefStrategyPick={applyBriefStrategyPick}
            setActiveSection={setActiveSection}
            aiFillBriefDraft={aiFillBriefDraft}
            briefAiStatus={briefAiStatus}
            briefAiReason={briefAiReason}
            defaultAngle={defaultAngle}
            defaultHook={defaultHook}
            taskError={taskError}
            postBriefDraft={postBriefDraft}
            briefCreateStatus={briefCreateStatus}
            productBuildTasks={productBuildTasks}
            activeBriefTasks={activeBriefTasks}
            briefScopeFilter={briefScopeFilter}
            setBriefScopeFilter={setBriefScopeFilter}
            briefScopeProducts={briefScopeProducts}
            workspaceSources={state.sources}
            productNameById={productNameById}
            productFinishedTasks={productFinishedTasks}
            productDeletedTasks={productDeletedTasks}
            productEdits={productEdits}
            briefEditDrafts={briefEditDrafts}
            selectActiveProduct={selectActiveProduct}
            openCatalogPicker={openCatalogPicker}
            saveEditedBrief={saveEditedBrief}
            cancelEditingBrief={cancelEditingBrief}
            updateBriefEditDraft={updateBriefEditDraft}
            startEditingBrief={startEditingBrief}
            openChatRoom={openChatRoom}
            closeTask={closeTask}
            deleteTask={deleteTask}
            reopenTask={reopenTask}
            postponeTask={postponeTask}
            restoreTask={restoreTask}
            permanentlyDeleteTask={permanentlyDeleteTask}
            sourceDraftOptionExists={sourceDraftOptionExists}
            sourceLabelByDraftValue={sourceLabelByDraftValue}
          />
        )}

        {state.activeSection === "chat" && (
          <ChatTab
            sectionRefs={sectionRefs}
            chatRooms={chatRooms}
            activeChatRoom={activeChatRoom}
            activeChatMessages={activeChatMessages}
            userEmail={userEmail}
            tenantId={tenantId}
            chatDrafts={chatDrafts}
            setSelectedChatRoomId={setSelectedChatRoomId}
            setChatDrafts={setChatDrafts}
            sendChatMessage={sendChatMessage}
            deleteChatMessage={deleteChatMessage}
          />
        )}

        {state.activeSection === "review" && (
          <ReviewTab
            sectionRefs={sectionRefs}
            state={state}
            readyAdRows={readyAdRows}
            readyAdError={readyAdError}
            reviewActionError={reviewActionError}
            workspaceReviews={workspaceReviews}
            workspaceEdits={workspaceEdits}
            productNameById={productNameById}
            revisionSendStatus={revisionSendStatus}
            hiddenRevisionReviewIds={hiddenRevisionReviewIds}
            updateReadyAdRow={updateReadyAdRow}
            addReadyAdRow={addReadyAdRow}
            removeReadyAdRow={removeReadyAdRow}
            addReadyAdsToReview={addReadyAdsToReview}
            updateReviewFeedback={updateReviewFeedback}
            approveReview={approveReview}
            requestRevision={requestRevision}
            rejectReview={rejectReview}
          />
        )}

        {state.activeSection === "launch" && (
          <LaunchTab
            sectionRefs={sectionRefs}
            tenantId={tenantId}
            workspaceLaunchItems={workspaceLaunchItems}
            workspaceEdits={workspaceEdits}
            workspaceProducts={state.products}
            workspaceSources={state.sources}
            workspaceTasks={state.tasks}
            productNameById={productNameById}
            updateLaunchStatus={updateLaunchStatus}
            updateLaunchItem={(launchId, patch) =>
              setState((current) => ({
                ...current,
                launchItems: current.launchItems.map((item) =>
                  item.id === launchId ? { ...item, ...patch } : item,
                ),
              }))
            }
            moveLaunchItemBackToReview={moveLaunchItemBackToReview}
          />
        )}

        {state.activeSection === "learning" && (
          <LearningTab
            sectionRefs={sectionRefs}
            workspacePerformance={workspacePerformance}
          />
        )}

        {canManageAccess && state.activeSection === "access" && (
          <SettingsTab
            sectionRefs={sectionRefs}
            editorDraft={editorDraft}
            setEditorDraft={setEditorDraft}
            editorError={editorError}
            setEditorError={setEditorError}
            editorInviteStatus={editorInviteStatus}
            inviteEditor={inviteEditor}
            acceptedPermissions={acceptedPermissions}
            pendingPermissions={pendingPermissions}
            accessPermissionHistory={accessPermissionHistory}
            deletingInviteHistoryIds={deletingInviteHistoryIds}
            removeEditor={removeEditor}
            resendInvite={resendInvite}
            inviteAgain={inviteAgain}
            deleteInviteHistory={deleteInviteHistory}
          />
        )}
      </AutomationWorkspaceLayout>

      {libraryPreviewSource ? (
        <LibraryPreviewModal
          source={libraryPreviewSource}
          onClose={() => setLibraryPreviewSourceId("")}
        />
      ) : null}

      <CatalogPickerDialog
        open={catalogPickerOpen}
        onOpenChange={setCatalogPickerOpen}
        products={filteredCatalogProducts}
        selectedIds={selectedCatalogIds}
        search={catalogSearch}
        onSearchChange={setCatalogSearch}
        onToggleProduct={toggleCatalogProduct}
        onSelectAllVisible={() =>
          setSelectedCatalogIds(
            filteredCatalogProducts
              .filter((product) => !catalogProductAlreadyAdded(product.id))
              .map((product) => product.id),
          )
        }
        onClearSelection={() => setSelectedCatalogIds([])}
        isAlreadyAdded={catalogProductAlreadyAdded}
        onImport={() => importCatalogProducts()}
      />
    </div>
  );
}
