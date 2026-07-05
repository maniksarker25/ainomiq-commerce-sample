export type BrandProfile = {
  status?: string;
  brand_name?: string;
  website?: string;
  what_you_sell?: string;
  ideal_customer?: string;
  customer_problem?: string;
  main_offer?: string;
  proof_points?: string;
  competitors?: string;
  brand_purpose?: string;
  brand_tone?: string;
  visual_style?: string;
  content_goals?: string;
  analysis?: Record<string, any> | null;
  source_summary?: {
    platform?: string;
    products?: number;
    technologies?: string[];
    brand_colors?: string[];
    purpose_clues?: string[];
    top_products?: Array<{ title?: string; price?: string; url?: string }>;
    key_pages?: string[];
    site_title?: string;
    site_description?: string;
    confidence?: number;
    [key: string]: any;
  } | null;
  [key: string]: any;
};

export function isBrandProfileReady(profile: BrandProfile | null | undefined) {
  return Boolean(profile && (
    profile.status === 'ready' ||
    profile.source_summary ||
    clean(profile.brand_name) ||
    clean(profile.website) ||
    clean(profile.what_you_sell)
  ));
}

export function brandProfileToIntake(profile: BrandProfile | null | undefined) {
  const topProducts = profile?.source_summary?.top_products
    ?.map(product => [product.title, product.price].filter(Boolean).join(' '))
    .filter(Boolean)
    .slice(0, 6)
    .join(', ');

  return {
    brand_name: clean(profile?.brand_name),
    website: clean(profile?.website),
    what_you_sell: clean(profile?.what_you_sell) || topProducts,
    ideal_customer: clean(profile?.ideal_customer),
    customer_problem: clean(profile?.customer_problem),
    main_offer: clean(profile?.main_offer),
    proof_points: clean(profile?.proof_points),
    competitors: clean(profile?.competitors),
    brand_tone: clean(profile?.brand_tone),
    content_goals: clean(profile?.content_goals),
  };
}

export function brandProfileToAnalysis(profile: BrandProfile | null | undefined) {
  if (!isBrandProfileReady(profile)) return null;
  if (profile?.analysis && typeof profile.analysis === 'object') return profile.analysis;

  const intake = brandProfileToIntake(profile);
  const products = profile?.source_summary?.top_products
    ?.map(product => product.title)
    .filter(Boolean) as string[] | undefined;
  const purposeClues = profile?.source_summary?.purpose_clues?.filter(Boolean) || [];

  return {
    summary: [
      intake.brand_name || 'This brand',
      intake.what_you_sell ? `sells ${intake.what_you_sell}` : '',
      intake.ideal_customer ? `for ${intake.ideal_customer}` : '',
    ].filter(Boolean).join(' ') || profile?.source_summary?.site_description || 'Brand profile loaded from central Brand Data.',
    positioning: clean(profile?.brand_purpose) || purposeClues.slice(0, 2).join(' '),
    target_audience: intake.ideal_customer,
    product_focus: intake.what_you_sell,
    brand_voice: intake.brand_tone || clean(profile?.visual_style),
    content_goals: intake.content_goals,
    content_pillars: purposeClues.slice(0, 4),
    products: products || [],
    recommended_outputs: ['instagram_caption', 'ad_copy'],
    missing_inputs: [],
  };
}

export function clean(value: unknown) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  if (!trimmed || ['inferred - needs review', 'unknown', 'n/a', 'not specified'].includes(lower) || lower.includes('needs confirmation') || lower.includes('need confirmation') || lower.includes('review and confirm')) return '';
  return trimmed;
}
