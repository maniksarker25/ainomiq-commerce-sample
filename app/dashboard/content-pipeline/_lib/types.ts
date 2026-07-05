import { LucideIcon } from "lucide-react";

export type ContentConfig = {
  brand_name?: string;
  content_source?: string;
  content_generation_mode?: "source_material" | "ai_images";
  ai_image_model?: string;
  ai_image_credits_per_image?: number;
  output_types?: string[];
  brand_voice?: string;
  target_audience?: string;
  product_focus?: string;
  publish_platforms?: string[];
  publishing_enabled?: boolean;
  publish_timezone?: string;
  status?: string;
  updated_at?: string;
};

export type BrandProfile = {
  brand_name?: string;
  brand_tone?: string;
  visual_style?: string;
  logo_url?: string;
  full_logo_url?: string;
  icon_url?: string;
  source_summary?: {
    brand_colors?: string[];
    logo?: string | null;
    icon?: string | null;
    favicon?: string | null;
    logo_candidates?: string[];
    icon_candidates?: string[];
    site_description?: string;
    products?: number;
    top_products?: string;
    product_catalog?: ProductCatalogItem[];
  };
};

export type ProductCatalogItem = {
  title: string;
  price?: string;
  image_url?: string | null;
  url?: string;
  available?: boolean;
  variants?: Array<{
    title?: string;
    price?: string;
    available?: boolean;
    options?: Record<string, string>;
  }>;
};

export type GeneratedOutput = {
  type: string;
  content: string;
  image_url?: string | null;
};

export type ChatMessage = {
  role: "agent" | "user";
  text: string;
  action?: { label: string; draftId?: string };
  needsClarification?: boolean;
  clarificationQuestions?: string[];
  streaming?: boolean;
};

export type CanvasElementId =
  | "image"
  | "headline"
  | "subline"
  | "extra"
  | "accent";

export type CanvasElement = {
  id: CanvasElementId;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
};

export type CanvasSize = { width: number; height: number };

export type ManualLayout = {
  headline: string;
  subline: string;
  caption: string;
  extraText: string;
  /** @deprecated Legacy combined text box; used for migration only */
  textX: number;
  textY: number;
  textW: number;
  imageX: number;
  imageY: number;
  imageW: number;
  imageH: number;
  headlineX?: number;
  headlineY?: number;
  headlineW?: number;
  headlineH?: number;
  sublineX?: number;
  sublineY?: number;
  sublineW?: number;
  sublineH?: number;
  extraX?: number;
  extraY?: number;
  extraW?: number;
  extraH?: number;
  accentX: number;
  accentY: number;
  accentW: number;
  accentH: number;
  showImage: boolean;
  showHeadline: boolean;
  showSubline: boolean;
  showExtraText: boolean;
  showAccent: boolean;
  showCaption: boolean;
};

export type Draft = {
  id: string;
  title: string;
  type: string;
  content: string;
  status: "Draft";
  imageUrl?: string | null;
  imageError?: string | null;
  visualPrompt?: string | null;
  templateId?: string;
  templateIndex?: number;
  hideLogo?: boolean;
  cleanAlign?: boolean;
  roundedFrames?: boolean;
  updatedAt?: string;
  manualLayout?: ManualLayout;
};

export type SavedTemplate = {
  id: string;
  title: string;
  content: string;
  styleIndex: number;
  purpose: string;
  createdAt: string;
  hideLogo?: boolean;
  cleanAlign?: boolean;
  roundedFrames?: boolean;
  updatedAt?: string;
  manualLayout?: ManualLayout;
  imageUrl?: string | null;
  imageError?: string | null;
};

export type PublishTarget = "Instagram" | "Facebook" | "Instagram + Facebook";

export type ScheduledPostStatus =
  | "Planned"
  | "Ready"
  | "Publishing"
  | "Published"
  | "Failed";

export type ScheduledPost = {
  id: string;
  date: string;
  time: string;
  platform: PublishTarget;
  status: ScheduledPostStatus;
  scheduledAt?: string;
  publishedAt?: string | null;
  permalink?: string | null;
  lastError?: string | null;
  attempts?: number;
  templateTitle: string;
  caption: string;
  draft: Draft;
};

export type Idea = { title: string; angle: string; channel: string };

export type MenuKey = "drafts" | "agent" | "feed" | "integrations" | "settings";

export type PlatformConnection = {
  connected?: boolean;
  username?: string | null;
  accountName?: string | null;
  connectedAt?: string | null;
};
