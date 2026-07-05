import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { ChatRoomView } from "../shared/WorkspaceWidgets";
import type {
  BrandProfile,
  BriefEditDraft,
  ChatMessage,
  CreativeOsState,
  CreativeTask,
  DeliveredEdit,
  LaunchItem,
  LaunchStatus,
  PerformanceRecord,
  Product,
  ProductPermission,
  ProductRole,
  ReviewItem,
  SourceCreative,
  TaskDraft,
} from "../../types";

export type SectionRefsHandle = MutableRefObject<
  Record<CreativeOsState["activeSection"], HTMLDivElement | null>
>;

export type ProductsTabProps = {
  sectionRefs: SectionRefsHandle;
  state: CreativeOsState;
  selectedProduct: Product;
  selectedProductLabel: string;
  saveStatus: string;
  catalogProducts: Product[];
  productFieldSuggestions: ReturnType<
    typeof import("../../lib/products").inferProductFieldSuggestions
  >;
  activeEditors: ProductPermission[];
  selectActiveProduct: (productId: string) => void;
  deleteProduct: (productId: string) => void;
  openCatalogPicker: () => void;
  addManualProduct: () => void;
  updateProduct: (
    field: keyof Product,
    value: string | string[] | number,
  ) => void;
  aiFillProductFields: () => void;
  aiFillStatus: string;
  textMatchesAiSuggestion: (value: string, suggestion: string) => boolean;
  listMatchesAiSuggestion: (items: string[], suggestions: string[]) => boolean;
  upgradeStrategyList: (field: import("../../types").StrategyListField) => void;
  strategyUpgradeField: import("../../types").StrategyListField | null;
  enhanceStrategyDraft: (
    field: import("../../types").StrategyListField,
    input: string,
  ) => Promise<string>;
  strategyEnhanceField: import("../../types").StrategyListField | null;
};

export type LibraryTabProps = {
  sectionRefs: SectionRefsHandle;
  productSources: SourceCreative[];
  productSourceGroups: Array<{
    key: string;
    name: string;
    importUrl?: string;
    backendFolderUrl?: string;
    isLegacy: boolean;
    sources: SourceCreative[];
  }>;
  sourceLinkRows: string[];
  sourceLinkError: string;
  sourceLinkStatus: string;
  sourceLinkValues: string[];
  activeLibraryFolderKey: string;
  updateSourceLinkRow: (index: number, value: string) => void;
  addSourceLinkRow: () => void;
  removeSourceLinkRow: (index: number) => void;
  addSourceLinks: () => void;
  importDriveLinksToLibrary: () => void | Promise<void>;
  uploadSourceFiles: (files: FileList | null) => void | Promise<void>;
  setActiveLibraryFolderKey: (key: string) => void;
  setLibraryPreviewSourceId: (id: string) => void;
  deleteSourceGroup: (sourceIds: string[], groupName: string) => void;
  updateLibrarySourceStatus: (
    sourceId: string,
    nextStatus: "ready" | "do not use",
  ) => void;
};

export type BrandTabProps = {
  sectionRefs: SectionRefsHandle;
  brand: BrandProfile;
  companyName: string;
  brandFillStatus: string;
  brandFillError: string;
  magicFillBrand: () => void;
  updateBrand: <K extends keyof BrandProfile>(
    field: K,
    value: BrandProfile[K],
  ) => void;
  addBrandReferenceLink: () => void;
  updateBrandReferenceLink: (
    id: string,
    field: "url" | "info",
    value: string,
  ) => void;
  removeBrandReferenceLink: (id: string) => void;
};

export type PostBriefsTabProps = {
  sectionRefs: SectionRefsHandle;
  state: CreativeOsState;
  selectedProduct: Product;
  taskDraft: TaskDraft;
  setTaskDraft: Dispatch<SetStateAction<TaskDraft>>;
  productTaskSources: SourceCreative[];
  productTaskSelectionGroups: LibraryTabProps["productSourceGroups"];
  productSources: SourceCreative[];
  selectedTaskSource?: SourceCreative;
  selectedTaskSourceGroup?: LibraryTabProps["productSourceGroups"][number];
  activeEditors: ProductPermission[];
  selectedEditorIds: string[];
  setSelectedEditorIds: Dispatch<SetStateAction<string[]>>;
  selectedEditorPermissions: ProductPermission[];
  canManageAccess: boolean;
  teamMemberLabel: string;
  optionalTeamText: string;
  selectedBriefPersonas: string[];
  refreshBriefPersonas: () => void;
  briefPersonasRefreshing: boolean;
  selectedBriefAngles: string[];
  refreshBriefAngles: () => void;
  briefAnglesRefreshing: boolean;
  selectedBriefHooks: string[];
  refreshBriefHooks: () => void;
  briefHooksRefreshing: boolean;
  briefStyleOptions: readonly string[];
  selectedBriefStyles: string[];
  applyBriefStrategyPick: (
    kind: "reason" | "pain" | "persona" | "claim" | "hook" | "style",
    value: string,
  ) => void;
  setActiveSection: (section: CreativeOsState["activeSection"]) => void;
  aiFillBriefDraft: () => void;
  briefAiStatus: string;
  briefAiReason: string;
  defaultAngle: string;
  defaultHook: string;
  taskError: string;
  postBriefDraft: () => void;
  briefCreateStatus: string;
  productBuildTasks: CreativeTask[];
  activeBriefTasks: CreativeTask[];
  briefScopeFilter: string;
  setBriefScopeFilter: (value: string) => void;
  briefScopeProducts: Array<{ id: string; name: string }>;
  workspaceSources: SourceCreative[];
  productNameById: Map<string, string>;
  productFinishedTasks: CreativeTask[];
  productDeletedTasks: CreativeTask[];
  productEdits: DeliveredEdit[];
  briefEditDrafts: Record<string, BriefEditDraft>;
  selectActiveProduct: (productId: string) => void;
  openCatalogPicker: () => void;
  saveEditedBrief: (taskId: string) => void;
  cancelEditingBrief: (taskId: string) => void;
  updateBriefEditDraft: (taskId: string, patch: Partial<BriefEditDraft>) => void;
  startEditingBrief: (task: CreativeTask) => void;
  openChatRoom: (roomId: string) => void;
  closeTask: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
  reopenTask: (taskId: string) => void;
  postponeTask: (taskId: string, days?: number) => void;
  restoreTask: (taskId: string) => void;
  permanentlyDeleteTask: (taskId: string) => void;
  sourceDraftOptionExists: (value: string) => boolean;
  sourceLabelByDraftValue: (value: string) => string;
};

export type ChatTabProps = {
  sectionRefs: SectionRefsHandle;
  chatRooms: ChatRoomView[];
  activeChatRoom: ChatRoomView | null | undefined;
  activeChatMessages: ChatMessage[];
  userEmail: string;
  tenantId: string;
  chatDrafts: Record<string, string>;
  setSelectedChatRoomId: (roomId: string) => void;
  setChatDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  sendChatMessage: (roomId: string) => void;
  deleteChatMessage: (messageId: string) => void;
};

export type ReviewTabProps = {
  sectionRefs: SectionRefsHandle;
  state: CreativeOsState;
  readyAdRows: string[];
  readyAdError: string;
  reviewActionError: string;
  workspaceReviews: ReviewItem[];
  workspaceEdits: DeliveredEdit[];
  productNameById: Map<string, string>;
  revisionSendStatus: Record<string, "sending" | "sent" | "error">;
  hiddenRevisionReviewIds: string[];
  updateReadyAdRow: (index: number, value: string) => void;
  addReadyAdRow: () => void;
  removeReadyAdRow: (index: number) => void;
  addReadyAdsToReview: () => void;
  updateReviewFeedback: (reviewId: string, feedback: string) => void;
  approveReview: (reviewId: string) => void;
  requestRevision: (reviewId: string) => void;
  rejectReview: (reviewId: string) => void;
};

export type LaunchTabProps = {
  sectionRefs: SectionRefsHandle;
  tenantId: string;
  workspaceLaunchItems: LaunchItem[];
  workspaceEdits: DeliveredEdit[];
  workspaceProducts: Product[];
  workspaceSources: SourceCreative[];
  workspaceTasks: CreativeTask[];
  productNameById: Map<string, string>;
  updateLaunchStatus: (launchId: string, status: LaunchStatus) => void;
  updateLaunchItem: (launchId: string, patch: Partial<LaunchItem>) => void;
  moveLaunchItemBackToReview: (launchId: string) => void;
};

export type LearningTabProps = {
  sectionRefs: SectionRefsHandle;
  workspacePerformance: PerformanceRecord[];
};

export type SettingsTabProps = {
  sectionRefs: SectionRefsHandle;
  editorDraft: { userName: string; role: ProductRole };
  setEditorDraft: Dispatch<
    SetStateAction<{ userName: string; role: ProductRole }>
  >;
  editorError: string;
  setEditorError: Dispatch<SetStateAction<string>>;
  editorInviteStatus: string;
  inviteEditor: () => void;
  acceptedPermissions: ProductPermission[];
  pendingPermissions: ProductPermission[];
  accessPermissionHistory: ProductPermission[];
  deletingInviteHistoryIds: string[];
  removeEditor: (permissionId: string) => void;
  resendInvite: (permissionId: string) => void;
  inviteAgain: (permission: ProductPermission) => void;
  deleteInviteHistory: (permissionId: string) => void;
};
