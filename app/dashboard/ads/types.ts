import { BarChart3, Wand2, Gauge, ImageIcon, Eye, ClipboardCheck, Settings } from 'lucide-react';

export const MAX_ADS_PER_AD_SET = 50;
export const MAX_CREATIVES_PER_BATCH = 150;

export type DbRow = Record<string, string | number | null>;

export type Overview = {
  counts: Record<string, number>;
  latestBatches: DbRow[];
  latestCreatives: DbRow[];
  latestCopyVariants: DbRow[];
  latestDestinations: DbRow[];
  latestPersonas: DbRow[];
  creativeLibraryAssets: CreativeLibraryAsset[];
  latestTemplates: DbRow[];
  draftPlans: DbRow[];
  openRecommendations: DbRow[];
  latestPublishJobs?: any[];
  publishGate: { allowed: boolean; blockers: string[] };
};

export type StagedGeneratedCreative = {
  id?: string;
  asset_url?: string;
  final_asset_url?: string;
  format?: string;
  media_type?: string;
  source?: string;
  product_id?: string | null;
  product_name?: string;
  persona_id?: string;
  persona_name?: string;
  title?: string;
  metadata?: Record<string, unknown>;
  source_asset_refs?: Record<string, unknown>;
  copy?: Record<string, unknown>;
};

export type MetaStatus = {
  connected: boolean;
  accountId?: string;
  accountIds?: string[];
  email?: string;
};

export type Campaign = {
  id: string;
  name: string;
  status: string;
  effective_status?: string;
  objective?: string;
  spend: number;
  reach?: number;
  impressions: number;
  clicks: number;
  cpc?: number;
  cpm?: number;
  ctr?: number;
  frequency?: number;
  purchases: number;
  purchaseValue: number;
  roas: number;
};

export type CampaignInsights = {
  campaigns: Campaign[];
  totalSpend: number;
  totalImpressions: number;
  totalPurchases: number;
};

export type MetaAdPerformance = {
  id: string;
  name: string;
  persona?: string;
  status?: string;
  spend: number;
  revenue?: number;
  roas: number;
  cpa: number;
  ctr: number;
  cpc: number;
  cpm?: number;
  impressions?: number;
  clicks?: number;
  purchases: number;
  frequency: number;
  verdict?: 'KILL' | 'SCALE' | string | null;
};

export type MetaAdset = {
  id: string;
  name: string;
  status?: string;
  campaign_id?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  targeting?: Record<string, unknown>;
  promoted_object?: Record<string, unknown> | null;
  optimization_goal?: string | null;
  billing_event?: string | null;
  bid_strategy?: string | null;
  bid_amount?: string | null;
};

export type ProductFolder = {
  id: string;
  type?: string;
  name: string;
  url: string;
  imageUrl?: string | null;
  price?: string;
  source?: string;
  productCount?: number | null;
  new: { images: number; videos: number; total: number };
  used: { images: number; videos: number; total: number };
  matchPath?: string;
  drive?: { available: boolean; folderId?: string; url?: string; photoFolderId?: string | null; photoFolderUrl?: string | null; videoFolderId?: string | null; videoFolderUrl?: string | null; images: number; videos: number; total: number; manual?: boolean };
};

export type ContentLibrary = {
  totals: { new: { total: number; images: number; videos: number }; used: { total: number; images: number; videos: number } };
  folders: ProductFolder[];
  collections?: ProductFolder[];
  sources?: { brand_scrape?: { connected: boolean; scraped_at?: string | null; products: number; collections: number }; google_drive?: { connected: boolean; error?: string | null; root_url?: string; root_folder_count?: number; new_root_url?: string; used_root_url?: string } };
  needs_brand_scrape?: boolean;
};

export type BillingPlan = {
  id: 'launch' | 'growth' | 'scale';
  name: string;
  price: number;
  monthlyCredits: number;
  logicChat: boolean;
  description: string;
};

export type CreditAccount = {
  plan: BillingPlan['id'];
  balance: number;
  ledger: Array<{ id: string; at: string; type: string; amount: number; balance_after: number; label: string }>;
};

export type TopUpPack = { id: string; credits: number; price: number };

export type PersonaSuggestion = {
  id: string;
  name: string;
  basedOn: string;
  angle: string;
  hook: string;
  overlay: string;
  copy: string;
  why: string;
  trigger?: string;
  objection?: string;
  proof_needed?: string;
};

export type StrategistSuggestion = PersonaSuggestion & {
  trigger?: string;
  objection?: string;
  proof_needed?: string;
};

export type PersonaBuildResult = {
  ok: boolean;
  saved: number;
  auto_saved?: boolean;
  product_key?: string;
  selected_product?: Partial<ProductFolder> | null;
  selected_products?: Partial<ProductFolder>[];
  summary: string;
  research_basis: string[];
  product_use: string;
  customer_issues: string[];
  purchase_motivations: string[];
  scrape: { attempted: boolean; ok: boolean; error?: string; products: number; faq: number; policies: number };
  personas: Array<{
    id: string;
    code: string;
    name: string;
    buying_situation: string;
    job_to_be_done: string;
    core_problem: string;
    desire: string;
    trigger: string;
    objections: string[];
    proof_needed: string[];
    search_intent: string[];
    angle: string;
    hook: string;
    overlay: string;
    copy_direction: string;
    targeting_notes: string;
    why_it_fits: string;
  }>;
};

export type StrategistResponse = {
  reply: string;
  needs_clarification: boolean;
  questions: string[];
  personas: StrategistSuggestion[];
  ad_ideas: Array<{ title: string; angle: string; format: string; first_frame: string; cta: string }>;
  campaign_recommendation: { best_next_step: string; test_plan: string; avoid_for_now: string; success_metric: string } | null;
  creation_plan?: { ready: boolean; summary: string; inclusions?: string[]; exclusions?: string[]; targeting_reference?: string; create_scope?: 'campaign' | 'adsets' | 'draft_only' } | null;
};

export type ChatCreateResponse = {
  gate?: 'missing_campaign_settings';
  error?: string;
  questions?: string[];
  message?: string;
  campaign?: { id: string; name: string; created: boolean };
  adsets?: Array<{ id: string; name: string }>;
};

export type StrategistChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  result?: StrategistResponse;
  campaignOptions?: Campaign[];
  productOptions?: ProductFolder[];
  landingOptions?: Array<{ label: string; url: string }>;
  quickReplies?: string[];
  campaignResumePrompt?: string;
  accessAction?: { label: string; url: string };
  errorDetail?: string;
};

export type CreativeLibraryAsset = {
  id: string;
  name: string;
  type: 'image' | 'video';
  status: 'ready' | 'needs_review' | 'archived';
  source_type: 'upload' | 'url' | 'drive' | 'external';
  asset_url: string;
  thumbnail_url?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  width?: number | null;
  height?: number | null;
  duration_seconds?: number | null;
  ratio: '4:5' | '9:16' | '1:1' | '16:9' | 'unknown';
  product_id?: string | null;
  product_name?: string | null;
  product_url?: string | null;
  persona_id?: string | null;
  persona_name?: string | null;
  campaign_id?: string | null;
  tags?: string | string[] | null;
  notes?: string | null;
  copy_hint?: string | null;
  landing_page_url?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CreativeAssetForm = {
  id?: string;
  name: string;
  type: 'image' | 'video';
  status: 'ready' | 'needs_review' | 'archived';
  source_type: 'url' | 'external' | 'drive' | 'upload';
  asset_url: string;
  ratio: '4:5' | '9:16' | '1:1' | '16:9' | 'unknown';
  product_id: string;
  persona_id: string;
  tags: string;
  notes: string;
  copy_hint: string;
  landing_page_url: string;
};

export type TemplateElementType = 'text' | 'media' | 'logo' | 'cta';

export type TemplateElement = {
  id: string;
  type: TemplateElementType;
  label: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight: string;
  fontFamily?: string;
  color: string;
  background: string;
  src?: string;
};

export type SafeZonePreset = {
  id: string;
  label: string;
  ratio: string;
  source: string;
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export const TEMPLATE_FONT_FAMILIES = ['Inter', 'Montserrat', 'Poppins', 'Playfair Display', 'Arial', 'Georgia'];
export const TEMPLATE_FONT_WEIGHTS = [
  { value: '400', label: 'Regular' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'Semi bold' },
  { value: '700', label: 'Bold' },
  { value: '800', label: 'Extra bold' },
  { value: '900', label: 'Black' },
];

export const SAFE_ZONE_PRESETS: SafeZonePreset[] = [
  { id: 'feed_4x5', label: 'Post 4:5', ratio: '4:5', source: 'Meta post crop and safe margin', top: 5, right: 5, bottom: 5, left: 5 },
  { id: 'feed_1x1', label: 'Post 1:1', ratio: '1:1', source: 'Meta post crop and safe margin', top: 5, right: 5, bottom: 5, left: 5 },
  { id: 'feed_16x9', label: 'Post 16:9', ratio: '16:9', source: 'Meta post crop and safe margin', top: 5, right: 5, bottom: 5, left: 5 },
  { id: 'stories_9x16', label: 'Stories 9:16', ratio: '9:16', source: 'Meta Stories title-safe: 250px top and 340px bottom on 1080x1920, plus side margin', top: 14, right: 6, bottom: 20, left: 6 },
  { id: 'reels_9x16', label: 'Reels 9:16', ratio: '9:16', source: 'Meta Reels UI-safe: top header, right action rail and lower caption controls', top: 14, right: 14, bottom: 35, left: 6 },
];

export const DEFAULT_TEMPLATE_ELEMENTS: TemplateElement[] = [
  { id: 'media', type: 'media', label: 'Product media', text: '', x: 6, y: 18, width: 88, height: 46, fontSize: 14, fontWeight: '700', fontFamily: 'Inter', color: '#6b7280', background: 'rgba(255,255,255,0.70)' },
  { id: 'headline', type: 'text', label: 'Headline', text: 'Short benefit headline', x: 6, y: 78, width: 88, height: 10, fontSize: 24, fontWeight: '900', fontFamily: 'Inter', color: 'dynamic', background: 'transparent' },
  { id: 'cta', type: 'cta', label: 'CTA', text: 'Shop now', x: 6, y: 90, width: 30, height: 8, fontSize: 14, fontWeight: '800', fontFamily: 'Inter', color: 'dynamic', background: '#2563eb' },
];

export const STRATEGIST_WELCOME_MESSAGE: StrategistChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: 'Tell me what you want to decide or create. If products or landing page are missing, I will ask and show clickable options.',
};

export const tabs = [
  { id: 'ads-manager', label: 'Ads Manager', icon: BarChart3, description: 'Campaign overview, spend, active campaigns, assets and Meta setup in one place.' },
  { id: 'chat', label: 'Logic Chat', icon: Wand2, description: 'Ask Logic Chat about spend, performance drops, winners, fatigue, creative direction and new ad structure.' },
  { id: 'recommendations', label: 'Actions', icon: Gauge, description: 'Prioritized AI action cards from your Meta performance, creatives, assets and setup state.' },
  { id: 'create-ads', label: 'Create ads', icon: ImageIcon, description: 'Create new ads or post ads from one guided workspace.' },
  { id: 'creatives', label: 'Creatives', icon: Eye, description: 'Your live and generated creatives.' },
  { id: 'generate', label: 'Generate', icon: Wand2, description: 'Generate ad images from products, brand assets and a short prompt.' },
  { id: 'review', label: 'Results', icon: ClipboardCheck, description: 'Review ads, copy, URLs, ad set plan, approvals, run jobs and performance loop in one place.' },
  { id: 'settings', label: 'Settings', icon: Settings, description: 'Manage Logic Ads module settings and connected Meta setup.' },
] as const;

export const hiddenTabData = [
  { id: 'post-ads', label: 'Post ads', icon: ImageIcon, description: 'Build campaign-ready ad sets and draft posts for review.' },
  { id: 'personas', label: 'Post ads', icon: ImageIcon, description: 'Build product personas as an input for the guided Post ads flow.' },
  { id: 'copy-url', label: 'Results', icon: ClipboardCheck, description: 'Review ads, copy, URLs, ad set plan, approvals, run jobs and performance loop in one place.' },
  { id: 'adset-plan', label: 'Results', icon: ClipboardCheck, description: 'Review ads, copy, URLs, ad set plan, approvals, run jobs and performance loop in one place.' },
  { id: 'approval', label: 'Results', icon: ClipboardCheck, description: 'Review ads, copy, URLs, ad set plan, approvals, run jobs and performance loop in one place.' },
  { id: 'publish', label: 'Results', icon: ClipboardCheck, description: 'Review ads, copy, URLs, ad set plan, approvals, run jobs and performance loop in one place.' },
  { id: 'performance', label: 'Results', icon: ClipboardCheck, description: 'Review ads, copy, URLs, ad set plan, approvals, run jobs and performance loop in one place.' },
] as const;

export const resultTabs = ['review', 'copy-url', 'adset-plan', 'approval', 'publish', 'performance'];
export const createFlowTabs = ['create-ads', 'generate', 'post-ads', 'personas'];
export const creativesTabs = ['creatives'];
export const postAdsTabs = ['post-ads', 'personas'];

export const createAdsMenuItems = [
  { id: 'generate', label: 'Create ads', detail: 'Generate new image ads from products.', icon: Wand2 },
  { id: 'post-ads', label: 'Post ads', detail: 'Build campaign-ready ad sets.', icon: ImageIcon },
] as const;

export const countLabels: Record<string, string> = {
  ad_products: 'Products',
  ad_personas: 'Personas',
  ad_hooks: 'Hooks',
  ad_templates: 'Templates',
  creative_library_assets: 'Creative Library',
  ad_creative_batches: 'Creative batches',
  ad_creatives: 'Creatives',
  ad_qc_events: 'QC events',
  ad_copy_variants: 'Copy variants',
  ad_destinations: 'Destinations',
  adset_plans: 'Ad set plans',
  ad_approvals: 'Approvals',
  ad_publish_jobs: 'Run jobs',
  ad_performance_snapshots: 'Performance snapshots',
  ad_recommendations: 'Recommendations',
};

export const PERSONA_READING_SOURCES = [
  'Reddit search',
  'web search signals',
  'Trustpilot page',
  'product scrape',
  'Brand Data',
  'persona strategy',
];

export const BATCH_PROGRESS_STEPS = [
  'Check campaign and product',
  'Choose buying reasons',
  'Write copy and plan media slots',
  'Prepare review package',
  'Build ad set plan',
];
