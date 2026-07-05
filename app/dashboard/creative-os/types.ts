import { defaultDueDate } from "./lib/dates";

export type CreativeOsWorkspaceProps = {
  tenantId: string;
  companyName?: string;
  accessMode?: "customer" | "creative-editor";
  userEmail?: string;
  userName?: string;
};

export type ProductRole = "admin" | "reviewer" | "editor" | "viewer";
export type SourceStatus = "available" | "assigned" | "maxed out" | "do not use";
export type TaskStatus = "assigned" | "in progress" | "delivered" | "archived";
export type ReviewStatus = "ready" | "revision requested" | "rejected";
export type LaunchStatus =
  | "ready"
  | "uploaded"
  | "live"
  | "winner"
  | "loser"
  | "archived";

export type CatalogItem = {
  id: string;
  name: string;
  url: string;
  imageUrl: string;
};

export type Product = {
  id: string;
  name: string;
  url: string;
  imageUrl: string;
  explanation: string;
  sellingPoints: string[];
  pains: string[];
  personas: string[];
  claimBoundaries: string[];
  defaultDerivativeCap: number;
  platforms: string[];
  namingConvention: string;
  createdAt: string;
  isCatalogGroup?: boolean;
  catalogItems?: CatalogItem[];
};

export type StrategyListField =
  | "sellingPoints"
  | "pains"
  | "personas"
  | "claimBoundaries";

export type SourceCreative = {
  id: string;
  productId: string;
  catalogScopeKey?: string;
  name: string;
  importName?: string;
  importUrl?: string;
  importSourceUrl?: string;
  sourceFolderPath?: string;
  creator: string;
  uploadedAt: string;
  type: "image" | "video";
  status: SourceStatus;
  derivativeCount: number;
  derivativeCap: number;
  quality: string;
  assetUrl: string;
  originalAssetUrl?: string;
  driveFileId?: string;
  originalDriveFileId?: string;
  backendFolderId?: string;
  backendFolderUrl?: string;
  thumbnailUrl?: string;
  assignedAt?: string;
  assignedTaskIds?: string[];
  movedToUsedAt?: string;
  archiveError?: string;
};

export type CreativeTask = {
  id: string;
  productId: string;
  sourceCreativeId: string;
  sourceGroupKey?: string;
  sourceGroupName?: string;
  sourceGroupUrl?: string;
  brief: string;
  angle: string;
  hook: string;
  angles?: string[];
  hooks?: string[];
  format: string;
  videoCount?: number;
  videoFormat?: string;
  photoCount?: number;
  photoFormat?: string;
  outputCount: number;
  dueDate: string;
  scheduleType?: "one-time" | "returning";
  recurrenceFrequency?: "weekly";
  recurrenceDay?: string;
  notes: string;
  assignee: string;
  status: TaskStatus;
  deletedAt?: string;
  sourceUsageLocked?: boolean;
  chatRoomId?: string;
};

export type DeliveredEdit = {
  id: string;
  productId: string;
  taskId: string;
  sourceCreativeId: string;
  sourceCreativeIds?: string[];
  editor: string;
  angle: string;
  hook: string;
  adName?: string;
  briefSummary: string;
  previewUrl: string;
  sourceUsedUrl?: string;
  sourceUsedUrls?: string[];
  outputCount?: number;
  deliveredAt: string;
  status: "delivered";
};

export type ReviewItem = {
  id: string;
  deliveredEditId: string;
  productId: string;
  sourceCreativeId: string;
  sourceCreativeIds?: string[];
  editor: string;
  angle: string;
  hook: string;
  adName?: string;
  briefSummary: string;
  sourceUsedUrl?: string;
  sourceUsedUrls?: string[];
  feedback: string;
  status: ReviewStatus;
  revisionRequestId?: string;
  revisionRequestedAt?: string;
};

export type LaunchItem = {
  id: string;
  productId: string;
  sourceCreativeId: string;
  sourceCreativeIds?: string[];
  deliveredEditId: string;
  sourceUsedUrl?: string;
  sourceUsedUrls?: string[];
  approvedCreative: string;
  recommendedAdName: string;
  status: LaunchStatus;
  metaCampaignId?: string;
  metaAdsetId?: string;
  metaCreativeId?: string;
  metaAdId?: string;
  metaLaunchUrl?: string;
  launchedAt?: string;
  launchError?: string;
};

export type PerformanceRecord = {
  id: string;
  launchItemId: string;
  spend: number;
  cpa: number;
  roas: number;
  ctr: number;
  hookRate: number;
  holdRate: number;
  purchases: number;
  outcome: "winner" | "loser" | "pending";
};

export type ChatMessage = {
  id: string;
  productId: string;
  taskId: string;
  roomId: string;
  authorEmail: string;
  authorName: string;
  authorRole: "founder" | "editor";
  body: string;
  createdAt: string;
};

export type ProductPermission = {
  id: string;
  productId: string;
  userName: string;
  role: ProductRole;
  email?: string;
  status: "invited" | "accepted" | "rejected" | "revoked" | "expired";
  invitedAt?: string;
  respondedAt?: string;
  revokedAt?: string;
  inviteToken?: string;
  inviteSentAt?: string;
  expiresAt?: string;
  lastEmailError?: string;
};

export type BrandProfile = {
  name: string;
  story: string;
  voice: string;
  instructions: string;
  doNotSay: string;
  referenceLinks: BrandReferenceLink[];
};

export type BrandReferenceLink = {
  id: string;
  url: string;
  info: string;
};

export type SetupGuideStep = {
  title: string;
  body: string;
  action: string;
  done: boolean;
  onClick: () => void;
};

export type CreativeOsState = {
  activeProductId: string;
  activeSection:
    | "dashboard"
    | "setup"
    | "brand"
    | "sources"
    | "tasks"
    | "review"
    | "launch"
    | "learning"
    | "chat"
    | "access";
  brand: BrandProfile;
  products: Product[];
  sources: SourceCreative[];
  tasks: CreativeTask[];
  deletedTaskIds?: string[];
  deletedSourceIds?: string[];
  deletedDeliveredEditIds?: string[];
  deletedReviewIds?: string[];
  deletedChatMessageIds?: string[];
  deliveredEdits: DeliveredEdit[];
  reviews: ReviewItem[];
  launchItems: LaunchItem[];
  performance: PerformanceRecord[];
  permissions: ProductPermission[];
  permissionHistory?: ProductPermission[];
  chatMessages: ChatMessage[];
};

export const emptyBrandProfile = (): BrandProfile => ({
  name: "",
  story: "",
  voice: "",
  instructions: "",
  doNotSay: "",
  referenceLinks: [],
});

export const blankProduct = (tenantId: string): Product => ({
  id: `product-${tenantId || "default"}-1`,
  name: "",
  url: "",
  imageUrl: "",
  explanation: "",
  sellingPoints: [],
  pains: [],
  personas: [],
  claimBoundaries: [],
  defaultDerivativeCap: 5,
  platforms: [],
  namingConvention: "product-source-edit-platform",
  createdAt: new Date().toISOString(),
});

export const emptyState = (_tenantId: string): CreativeOsState => ({
  activeProductId: "",
  activeSection: "dashboard",
  brand: emptyBrandProfile(),
  products: [] as Product[],
  sources: [],
  tasks: [],
  deletedTaskIds: [],
  deletedSourceIds: [],
  deletedDeliveredEditIds: [],
  deletedReviewIds: [],
  deletedChatMessageIds: [],
  deliveredEdits: [],
  reviews: [],
  launchItems: [],
  performance: [],
  permissions: [],
  chatMessages: [],
});

export const CREATIVE_FORMAT_OPTIONS = [
  "4:5 image ad",
  "4:5 video ad",
  "9:16 image ad",
  "9:16 video ad",
  "1:1 image ad",
  "1:1 video ad",
  "Carousel ad",
  "UGC script",
  "Static concept set",
];

// Creative styles (the treatment/angle of the ad), picked in the brief.
export const CREATIVE_STYLE_OPTIONS = [
  "UGC (AI & REAL)",
  "Founder",
  "Statistics",
  "Aesthetic",
  "Testimonial",
  "Problem / Solution",
  "Unboxing",
  "Lifestyle",
];

// Real output formats (aspect ratios) chosen per video and per photo.
export const OUTPUT_FORMAT_OPTIONS = ["9:16", "4:5", "1:1"];

export {
  DUE_DATE_OPTION_DAYS,
  MONTH_OPTIONS,
  WEEKDAY_OPTIONS,
} from "./lib/dates";

export const SOURCE_GROUP_VALUE_PREFIX = "source-group::";

export const GENERIC_SOURCE_TOKENS = new Set([
  "billie",
  "jeans",
  "source",
  "sources",
  "drive",
  "folder",
  "creative",
  "ugc",
  "raw",
  "video",
  "videos",
  "photo",
  "photos",
  "content",
  "ads",
  "ad",
  "edit",
  "edits",
  "ready",
  "to",
  "for",
  "the",
  "and",
  "new",
]);

export const INITIAL_TASK_DRAFT = {
  briefName: "",
  sourceCreativeId: "",
  assignee: "",
  angle: "",
  hook: "",
  angles: "",
  hooks: "",
  format: "",
  videoCount: "0",
  videoFormat: "9:16",
  photoCount: "3",
  photoFormat: "4:5",
  outputCount: "3",
  dueDate: defaultDueDate(),
  scheduleType: "one-time" as "one-time" | "returning",
  recurrenceFrequency: "weekly" as "weekly",
  recurrenceDay: "sunday",
  notes: "",
};

export type TaskDraft = typeof INITIAL_TASK_DRAFT;

export type BriefEditDraft = {
  brief: string;
  sourceCreativeId: string;
  assignee: string;
  angles: string;
  hooks: string;
  format: string;
  outputCount: string;
  dueDate: string;
  scheduleType: "one-time" | "returning";
  recurrenceDay: string;
  notes: string;
};

export function createInitialTaskDraft(): TaskDraft {
  return {
    ...INITIAL_TASK_DRAFT,
    dueDate: defaultDueDate(),
  };
}
