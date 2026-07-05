import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { getMetaToken, metaFetch, MetaError } from '@/lib/meta';
import { createAdsetPlan, logAdManagerAudit } from '@/lib/ad-manager/db';
import {
  adsetDefaultsForObjective,
  buildTargeting,
  countriesFromMarkets,
  hasUsableBidAmount,
  objectiveForMeta,
  type TemplateAdset,
} from '@/lib/ad-manager/meta-adset-defaults';

export const dynamic = 'force-dynamic';

type CatalogItem = { id?: string; name?: string; url?: string; imageUrl?: string | null };
type Persona = { id?: string; name?: string; angle?: string; hook?: string; overlay?: string; copy?: string; why?: string };
type ChatTemplateAdset = TemplateAdset & { id?: string; name?: string; campaign_id?: string; daily_budget?: string };
type CampaignBudgetTemplate = { id?: string; daily_budget?: string; lifetime_budget?: string; budget_remaining?: string; bid_strategy?: string; bid_amount?: string };
type MetaAudience = { id: string; name: string };
type AudienceTargetingSet = { inclusion: MetaAudience; exclusions: MetaAudience[]; label: string };

function clean(value: unknown, max = 240) {
  return String(value || '').trim().replace(/[\u2014\u2013]/g, ' - ').slice(0, max);
}

function cleanId(value: unknown) {
  return clean(value, 80).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'draft';
}

function parseBudgetCents(value: unknown, fallback = 2000) {
  const raw = String(value || '').replace(/[^0-9.,]/g, '').replace(',', '.');
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return fallback;
  return Math.max(Math.round(amount * 100), 100);
}

function bidStrategyNeedsAmount(strategy: unknown) {
  return ['TARGET_COST', 'LOWEST_COST_WITH_BID_CAP'].includes(String(strategy || '').trim().toUpperCase());
}

function normalizedBidAmount(value: unknown) {
  return hasUsableBidAmount(value) ? String(value).trim() : '';
}

function mergeBiddingAmount<T extends { bid_strategy?: string; bid_amount?: string } | null>(template: T, fallback?: { bid_strategy?: string; bid_amount?: string } | null): T {
  if (!template) return template;
  const strategy = String(template.bid_strategy || fallback?.bid_strategy || '').trim().toUpperCase();
  const bidAmount = normalizedBidAmount(template.bid_amount) || normalizedBidAmount(fallback?.bid_amount);
  return { ...template, bid_strategy: strategy || template.bid_strategy, ...(bidAmount ? { bid_amount: bidAmount } : {}) };
}

function completeBiddingDefaults(template?: { bid_strategy?: string; bid_amount?: string } | null) {
  const strategy = String(template?.bid_strategy || '').trim().toUpperCase();
  if (!strategy) return {};
  const needsBidAmount = bidStrategyNeedsAmount(strategy);
  if (needsBidAmount && !hasUsableBidAmount(template?.bid_amount)) return {};
  return {
    bid_strategy: strategy,
    ...(hasUsableBidAmount(template?.bid_amount) ? { bid_amount: String(template?.bid_amount).trim() } : {}),
  };
}

function withoutBiddingDefaults<T extends Record<string, unknown>>(defaults: T): T {
  const cleanDefaults = { ...defaults };
  delete cleanDefaults.bid_strategy;
  delete cleanDefaults.bid_amount;
  return cleanDefaults as T;
}

const CHAT_DEFAULT_COUNTRIES = ['NL'] as const;

function extractUrlFromText(value: unknown) {
  return clean(value, 4000).match(/https?:\/\/\S+/i)?.[0]?.replace(/[),.;]+$/, '') || '';
}

function extractBudgetFromText(value: unknown) {
  const text = clean(value, 4000).toLowerCase();
  const match = text.match(/(?:daily\s*)?budget[^0-9€$]{0,24}[€$]?\s*(\d+(?:[.,]\d{1,2})?)/i)
    || text.match(/[€$]\s*(\d+(?:[.,]\d{1,2})?)\s*(?:per\s*day|daily|\/day|a\s*day)/i)
    || text.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:euro|eur|€|dollar|usd|\$)\s*(?:per\s*day|daily|\/day|a\s*day)/i);
  return match?.[1] || '';
}

function extractBidAmountFromText(value: unknown) {
  const text = clean(value, 4000).toLowerCase();
  const match = text.match(/(?:bid cap|bid amount|target cost|target cpa|cpa)[^0-9€$]{0,32}[€$]?\s*(\d+(?:[.,]\d{1,2})?)/i)
    || text.match(/[€$]\s*(\d+(?:[.,]\d{1,2})?)\s*(?:bid cap|target cost|target cpa|cpa)/i);
  return match?.[1] || '';
}

function inferBidAmountCents(body: any, chatContext: string, dailyBudget: number | null, campaignBudget: number) {
  const explicit = extractBidAmountFromText(`${chatContext} ${body.confirmation || ''} ${JSON.stringify(body.strategist_result || {})}`);
  if (explicit) return parseBudgetCents(explicit, 1800);
  const budgetBased = dailyBudget || campaignBudget || 0;
  if (budgetBased > 0) return Math.min(Math.max(Math.round(budgetBased * 0.2), 500), 3000);
  return 1800;
}

function extractMarketsFromText(value: unknown) {
  const text = clean(value, 4000).toLowerCase();
  const marketWords = ['netherlands', 'nederland', 'nl', 'belgium', 'belgie', 'be', 'germany', 'duitsland', 'de', 'france', 'frankrijk', 'fr', 'spain', 'es', 'italy', 'it', 'europe', 'worldwide'];
  const found = marketWords.filter(word => new RegExp(`(^|[^a-z])${word}([^a-z]|$)`, 'i').test(text));
  return found.join(', ');
}

async function getAdsetTemplate(token: string, adsetId: string): Promise<ChatTemplateAdset | null> {
  if (!adsetId) return null;
  try {
    const fields = 'id,name,campaign_id,daily_budget,targeting,promoted_object,optimization_goal,billing_event,bid_strategy,bid_amount';
    const data = await metaFetch(token, `/${encodeURIComponent(adsetId)}?fields=${fields}`);
    return data || null;
  } catch (err) {
    console.error('[ad-manager/chat-create] Failed to fetch selected ad set delivery template:', err);
    return null;
  }
}

async function getCampaignDeliveryTemplate(token: string, campaignId: string): Promise<ChatTemplateAdset | null> {
  if (!campaignId) return null;
  try {
    const fields = 'id,name,campaign_id,daily_budget,targeting,promoted_object,optimization_goal,billing_event,bid_strategy,bid_amount';
    const data = await metaFetch(token, `/${encodeURIComponent(campaignId)}/adsets?fields=${fields}&limit=50`);
    const adsets = Array.isArray(data?.data) ? data.data : [];
    const completeBidTemplate = adsets.find((item: ChatTemplateAdset) => bidStrategyNeedsAmount(item?.bid_strategy) && hasUsableBidAmount(item?.bid_amount));
    const withTargeting = adsets.find((item: ChatTemplateAdset) => item?.targeting && Object.keys(item.targeting).length);
    const first = adsets[0] || null;
    return mergeBiddingAmount(withTargeting || first, completeBidTemplate) || null;
  } catch (err) {
    console.error('[ad-manager/chat-create] Failed to fetch campaign delivery template:', err);
    return null;
  }
}

async function getCampaignBudgetTemplate(token: string, campaignId: string): Promise<CampaignBudgetTemplate | null> {
  if (!campaignId) return null;
  try {
    const data = await metaFetch(token, `/${encodeURIComponent(campaignId)}?fields=id,daily_budget,lifetime_budget,budget_remaining,bid_strategy,bid_amount`);
    return data || null;
  } catch (err) {
    console.error('[ad-manager/chat-create] Failed to fetch campaign budget template:', err);
    return null;
  }
}

function isBidAmountMetaError(err: unknown) {
  const text = err instanceof Error ? err.message : String(err || '');
  return /Bid Amount Required|bid_amount|bid cap|target cost|TARGET_COST|LOWEST_COST_WITH_BID_CAP/i.test(text);
}

function isCampaignBudgetMetaError(err: unknown) {
  const text = err instanceof Error ? err.message : String(err || '');
  return /ad set budget or a campaign budget|Can'?t Set Ad Set and Campaign Budget/i.test(text);
}

function isAdsetBudgetSharingMetaError(err: unknown) {
  const text = err instanceof Error ? err.message : String(err || '');
  return /is_adset_budget_sharing_enabled|adset_budget_sharing/i.test(text);
}

function safeMetaErrorMessage(err: MetaError) {
  if (isBidAmountMetaError(err)) return 'Meta rejected the copied bid strategy. I removed bid cap and target cost from the create flow, so use a campaign daily budget and try again.';
  if (/permission|OAuthException|access token|requires.*permission|missing.*scope|ads_management|business_management/i.test(err.message)) return 'Meta access is missing or expired for this action. Reconnect Meta in Integrations, then I can create it.';
  if (/ad set budget or a campaign budget|Can'?t Set Ad Set and Campaign Budget/i.test(err.message)) return 'Meta says this campaign already uses campaign budget. I will retry without ad set budgets when you create again.';
  if (/is_adset_budget_sharing_enabled|adset_budget_sharing/i.test(err.message)) return 'Meta needs the ad set budget sharing setting for ABO. I set it explicitly and the create flow can retry.';
  if (/targeting|geo_locations|custom audience|No Meta Pixel|promoted_object|optimization_goal|billing_event/i.test(err.message)) return 'Meta needs one campaign setup detail before this can be created.';
  return 'Meta blocked the create request. I kept the exact detail below so it can be fixed without guessing.';
}

function promotedObjectPixelId(template: ChatTemplateAdset | null | undefined) {
  const promoted = template?.promoted_object as Record<string, any> | undefined;
  const value = promoted?.pixel_id || promoted?.pixel?.id;
  return clean(value, 80);
}

async function getFirstPixel(token: string, adAccountId: string, preferredPixelId?: string) {
  if (preferredPixelId) return { id: preferredPixelId, name: 'Campaign pixel' };
  const data = await metaFetch(token, `/${encodeURIComponent(adAccountId)}/adspixels?fields=id,name&limit=20`);
  const pixel = Array.isArray(data?.data) ? data.data[0] : null;
  return pixel?.id ? { id: String(pixel.id), name: clean(pixel.name, 120) } : null;
}

function websiteAudienceRule(pixelId: string, events: string[], retentionDays: number) {
  return JSON.stringify({
    inclusions: {
      operator: 'or',
      rules: events.map(event => ({
        event_sources: [{ id: pixelId, type: 'pixel' }],
        retention_seconds: retentionDays * 24 * 60 * 60,
        filter: { operator: 'and', filters: [{ field: 'event', operator: 'eq', value: event }] },
      })),
    },
  });
}

async function findAudienceByName(token: string, adAccountId: string, name: string): Promise<MetaAudience | null> {
  const data = await metaFetch(token, `/${encodeURIComponent(adAccountId)}/customaudiences?fields=id,name,subtype&limit=200`);
  const audience = Array.isArray(data?.data) ? data.data.find((item: any) => String(item?.name || '').toLowerCase() === name.toLowerCase()) : null;
  return audience?.id ? { id: String(audience.id), name: String(audience.name || name) } : null;
}

async function ensureWebsiteAudience(token: string, adAccountId: string, pixelId: string, name: string, events: string[], retentionDays: number): Promise<MetaAudience> {
  const existing = await findAudienceByName(token, adAccountId, name);
  if (existing) return existing;
  const createBody: Record<string, unknown> = {
      name,
      subtype: 'WEBSITE',
      description: `Logic Ads retargeting audience. Events: ${events.join(', ')}. Retention: ${retentionDays} days.`,
      retention_days: retentionDays,
      rule: websiteAudienceRule(pixelId, events, retentionDays),
      prefill: true,
  };
  let created;
  try {
    created = await metaFetch(token, `/${encodeURIComponent(adAccountId)}/customaudiences`, {
      method: 'POST',
      body: JSON.stringify(createBody),
    });
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err || '');
    if (!/subtype.*not supported|Invalid Parameter/i.test(text)) throw err;
    const fallbackBody = { ...createBody };
    delete fallbackBody.subtype;
    created = await metaFetch(token, `/${encodeURIComponent(adAccountId)}/customaudiences`, {
      method: 'POST',
      body: JSON.stringify(fallbackBody),
    });
  }
  if (!created?.id) throw new MetaError(`Meta did not return an id for custom audience ${name}`, 500);
  return { id: String(created.id), name };
}

async function buildSelfRetargetingAudienceSets(token: string, adAccountId: string, campaignName: string, template?: ChatTemplateAdset | null): Promise<AudienceTargetingSet[]> {
  const pixel = await getFirstPixel(token, adAccountId, promotedObjectPixelId(template));
  if (!pixel) throw new MetaError('No Meta Pixel found for this ad account. Connect/select the pixel before I can create website retargeting audiences.', 422);
  const prefix = clean(campaignName || 'Logic Ads RET', 80);
  const purchasers = await ensureWebsiteAudience(token, adAccountId, pixel.id, `${prefix} - Purchasers 180d`, ['Purchase'], 180);
  const checkout = await ensureWebsiteAudience(token, adAccountId, pixel.id, `${prefix} - Initiate Checkout 30d`, ['InitiateCheckout'], 30);
  const cart = await ensureWebsiteAudience(token, adAccountId, pixel.id, `${prefix} - Add To Cart 30d`, ['AddToCart'], 30);
  const viewers = await ensureWebsiteAudience(token, adAccountId, pixel.id, `${prefix} - Product Viewers 30d`, ['ViewContent'], 30);
  return [
    { label: 'Product viewers 30d', inclusion: viewers, exclusions: [cart, checkout, purchasers] },
    { label: 'Add to cart 30d', inclusion: cart, exclusions: [checkout, purchasers] },
    { label: 'Initiate checkout 30d', inclusion: checkout, exclusions: [purchasers] },
  ];
}

function targetingWithAudiences(base: Record<string, unknown>, set?: AudienceTargetingSet | null) {
  if (!set) return base;
  return {
    ...base,
    custom_audiences: [{ id: set.inclusion.id }],
    excluded_custom_audiences: set.exclusions.map(audience => ({ id: audience.id })),
  };
}

async function createMetaAdset(token: string, adAccountId: string, body: Record<string, unknown>, fallbackBidAmount?: number) {
  try {
    return await metaFetch(token, `/${encodeURIComponent(adAccountId)}/adsets`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch (err) {
    if (isCampaignBudgetMetaError(err)) {
      const retryBody = { ...body };
      delete retryBody.daily_budget;
      delete retryBody.lifetime_budget;
      retryBody.is_adset_budget_sharing_enabled = true;
      return metaFetch(token, `/${encodeURIComponent(adAccountId)}/adsets`, {
        method: 'POST',
        body: JSON.stringify(retryBody),
      });
    }
    if (isAdsetBudgetSharingMetaError(err)) {
      const retryBody = {
        ...body,
        is_adset_budget_sharing_enabled: Boolean(!body.daily_budget && !body.lifetime_budget),
      };
      return metaFetch(token, `/${encodeURIComponent(adAccountId)}/adsets`, {
        method: 'POST',
        body: JSON.stringify(retryBody),
      });
    }
    if (!isBidAmountMetaError(err)) throw err;
    const retryBody = { ...body };
    delete retryBody.bid_strategy;
    if (fallbackBidAmount && !hasUsableBidAmount(retryBody.bid_amount)) retryBody.bid_amount = fallbackBidAmount;
    else if (!fallbackBidAmount) delete retryBody.bid_amount;
    return metaFetch(token, `/${encodeURIComponent(adAccountId)}/adsets`, {
      method: 'POST',
      body: JSON.stringify(retryBody),
    });
  }
}

function campaignUsesCampaignBudget(campaign: CampaignBudgetTemplate | null | undefined) {
  return Boolean(campaign?.daily_budget || campaign?.lifetime_budget);
}

function buildAdsetName(persona: Persona, item: CatalogItem, index: number) {
  const personaName = clean(persona?.name, 80) || `Angle ${index + 1}`;
  const productName = clean(item?.name, 80) || 'Selected products';
  return `${personaName} - ${productName}`.slice(0, 400);
}

function latestAssistantContext(history: Array<{ role?: string; content?: string }>) {
  return history
    .filter(item => item?.role === 'assistant' || item?.role === 'user')
    .slice(-60)
    .map(item => `${item.role}: ${clean(item.content, 1200)}`)
    .join('\n');
}

function wantsRetargetingSetup(body: any, chatContext: string) {
  const combined = `${chatContext} ${body.confirmation || ''} ${body.draft_goal || ''} ${JSON.stringify(body.strategist_result || {})}`.toLowerCase();
  return /\b(ret|retarget|retargeting|visitor|visitors|add to cart|atc|checkout|ic|exited checkout|warm audience|custom audience)\b/i.test(combined);
}

function wantsSelfBuiltRetargeting(body: any, chatContext: string) {
  if (body.self_built_retargeting === true) return true;
  const combined = `${chatContext} ${body.confirmation || ''} ${body.draft_goal || ''} ${JSON.stringify(body.strategist_result || {})}`.toLowerCase();
  return /make (the )?audiences? (yourself|myself)|build (the )?audiences?|create (the )?audiences?|audiences? yourself|self-built|self built|maak (de )?(audiences?|doelgroepen?)|audiences? zelf|doelgroepen? zelf|zelf (maken|aanmaken|bouwen)|moet je (dus )?zelf|mot je (dus )?zelf|jij (moet|mot).*zelf|don'?t copy (any )?(settings|targeting|audiences?)|dont copy (any )?(settings|targeting|audiences?)|only copy (the )?(countries|geo)|copy (the )?(countries|geo) only/i.test(combined);
}

function inferCatalogItemsFromChat(catalogItems: CatalogItem[], chatContext: string, destinationUrl: string) {
  if (catalogItems.length) return catalogItems;
  const combined = chatContext.toLowerCase();
  if (/jeans\s*pins|billie\s*jeans\s*pins|all\s+.*pins|pins\s+variations/.test(combined)) {
    return [{
      id: 'chat-jeans-pins',
      name: 'Jeans Pins',
      url: destinationUrl || 'https://billiejeansclo.com/collections/billie-jeans-pins',
    }];
  }
  return catalogItems;
}

function inferMarketsFromCampaignContext(selectedCampaign: any, campaignName: string, chatContext: string) {
  const combined = `${campaignName} ${selectedCampaign?.name || ''} ${chatContext}`.toLowerCase();
  if (/worldwide|\bww\b|wereldwijd/.test(combined)) return 'worldwide';
  return '';
}

function needsConcreteGeoTemplate(markets: unknown, template: ChatTemplateAdset | null | undefined) {
  return /^worldwide$/i.test(clean(markets, 40)) && !template?.targeting?.geo_locations;
}

function geoOnlyTargeting(template: ChatTemplateAdset | null | undefined, markets: unknown) {
  const geo = template?.targeting?.geo_locations;
  const excludedGeo = template?.targeting?.excluded_geo_locations;
  if (geo || excludedGeo) {
    const marketCountries = countriesFromMarkets(markets);
    return {
      geo_locations: geo || { countries: marketCountries.length ? marketCountries : [...CHAT_DEFAULT_COUNTRIES] },
      ...(excludedGeo ? { excluded_geo_locations: excludedGeo } : {}),
      age_min: Number(template?.targeting?.age_min) || 18,
      age_max: Number(template?.targeting?.age_max) || 65,
    };
  }
  return buildTargeting(null, markets, { defaultCountries: [...CHAT_DEFAULT_COUNTRIES] });
}

function inferChatPersonas(body: any, chatContext: string): Persona[] {
  const provided = Array.isArray(body.personas) && body.personas.length ? body.personas.slice(0, 12) : [];
  const wantsRetargeting = wantsRetargetingSetup(body, chatContext);
  const combined = `${chatContext} ${JSON.stringify(body.strategist_result || {})}`.toLowerCase();
  const wantsThree = /\b3\b|three|drie|visitors?.*add to cart.*checkout|warm.*atc.*ic/i.test(combined);
  if (wantsRetargeting && (wantsThree || provided.length < 3)) {
    return [
      { id: 'warm-visitors-30d', name: 'Warm visitors 30d', angle: 'Website visitors and product viewers, excluding higher intent and purchasers' },
      { id: 'add-to-cart-14d', name: 'Add to cart 14d', angle: 'Cart abandoners, excluding checkout starters and purchasers' },
      { id: 'initiate-checkout-14d', name: 'Initiate checkout 14d', angle: 'Checkout abandoners, excluding purchasers' },
    ];
  }
  return provided.length ? provided : [{ id: 'chat-angle', name: 'Chat angle', angle: clean(body.draft_goal, 160) }];
}

function budgetLevelFromText(value: unknown): 'campaign' | 'adset' | '' {
  const text = clean(value, 6000).toLowerCase();
  if (/\babo\b|ad\s*set\s*budget|adset\s*budget|budget\s*per\s*ad\s*set|per\s*ad\s*set/.test(text)) return 'adset';
  if (/\bcbo\b|campaign\s*budget|campaign-level\s*budget|campaign\s*level\s*budget|budget\s*at\s*campaign/.test(text)) return 'campaign';
  return '';
}

function requestedBudgetLevel(body: any, campaignName: string, chatContext: string): 'campaign' | 'adset' | '' {
  return budgetLevelFromText(`${campaignName} ${body.confirmation || ''} ${body.campaign_context_label || ''} ${body.budget_level || ''} ${body.budget_type || ''} ${chatContext} ${JSON.stringify(body.strategist_result || {})}`);
}

function wantsCampaignBudget(body: any, campaignMode: string, campaignName: string, chatContext: string, referenceBudget?: CampaignBudgetTemplate | null) {
  const requested = requestedBudgetLevel(body, campaignName, chatContext);
  if (campaignMode === 'new' && requested) return requested === 'campaign';
  return campaignUsesCampaignBudget(referenceBudget);
}

function hasTargeting(template?: ChatTemplateAdset | null) {
  return Boolean(template?.targeting && Object.keys(template.targeting).length);
}

function missingSettingsGate(questions: string[]) {
  return Response.json({
    gate: 'missing_campaign_settings',
    error: `I need ${questions.length === 1 ? 'one setting' : 'a few settings'} before I can create this safely: ${questions.join(' ')}`,
    questions,
  }, { status: 422 });
}

export async function POST(request: NextRequest) {
  let body: any;
  let tenantId: string;
  try {
    body = await request.json();
    tenantId = await requireAuth(request, body.tenant_id);
  } catch (err) {
    return handleAuthError(err);
  }

  const confirmation = clean(body.confirmation, 200).toLowerCase();
  if (!/(^|\s)(ok|okay|oke|maak|create|build|start|run)(\s|!|$)/.test(confirmation)) {
    return Response.json({ error: 'Explicit create confirmation is required.' }, { status: 400 });
  }

  const providedCatalogItems: CatalogItem[] = Array.isArray(body.selected_catalog_items) ? body.selected_catalog_items.slice(0, 20) : [];
  const templateAdset: ChatTemplateAdset | null = body.selected_adset_template || null;
  const campaignMode = clean(body.campaign_mode, 40) === 'new' ? 'new' : 'existing';
  const newCampaign = body.new_campaign || {};
  const selectedCampaign = body.selected_campaign || null;
  const inferredCampaignName = clean(body.inferred_campaign_name, 220);
  const campaignName = campaignMode === 'new' ? clean(newCampaign.name || inferredCampaignName, 220) : clean(selectedCampaign?.name || body.campaign_context_label, 220);
  const objective = campaignMode === 'new' ? objectiveForMeta(newCampaign.objective || selectedCampaign?.objective) : objectiveForMeta(selectedCampaign?.objective || newCampaign.objective);
  const chatContext = latestAssistantContext(Array.isArray(body.history) ? body.history : []);
  const personas = inferChatPersonas(body, chatContext);
  const destinationUrl = clean(body.destination_url, 1000) || extractUrlFromText(chatContext);
  const catalogItems = inferCatalogItemsFromChat(providedCatalogItems, chatContext, destinationUrl);
  const selfBuiltRetargeting = wantsSelfBuiltRetargeting(body, chatContext);
  const chatBudget = extractBudgetFromText(chatContext);
  const chatMarkets = extractMarketsFromText(chatContext);
  const resolvedDailyBudget = newCampaign.daily_budget || body.daily_budget || chatBudget;
  const resolvedMarkets = newCampaign.markets || body.markets || chatMarkets || inferMarketsFromCampaignContext(selectedCampaign, campaignName, chatContext);
  const newCampaignBudgetLevel = requestedBudgetLevel(body, campaignName, chatContext);

  const preflightQuestions: string[] = [];
  if (!catalogItems.length) preflightQuestions.push('Which product or catalog should this campaign use?');
  if (!destinationUrl) preflightQuestions.push('Which landing page URL should the ads use?');
  if (campaignMode === 'new' && !campaignName) preflightQuestions.push('What should the new campaign name be?');
  if (campaignMode === 'new' && !newCampaignBudgetLevel) preflightQuestions.push('Should this use CBO with one campaign daily budget, or ABO with daily budgets per ad set?');
  if (campaignMode === 'new' && !clean(resolvedDailyBudget, 40)) preflightQuestions.push('What daily budget should I use?');
  if (campaignMode === 'new' && !hasTargeting(templateAdset) && !clean(resolvedMarkets, 200)) preflightQuestions.push('Which countries or markets should I target?');
  if (wantsRetargetingSetup(body, chatContext) && !selfBuiltRetargeting && !hasTargeting(templateAdset)) preflightQuestions.push('Which existing retargeting ad set or custom audience should I copy?');
  if (campaignMode === 'existing' && !clean(selectedCampaign?.id, 80)) preflightQuestions.push('Which existing campaign should I use as the setup reference?');
  if (!personas.length) preflightQuestions.push('How many ad sets or angles should I create?');
  if (preflightQuestions.length) return missingSettingsGate(preflightQuestions.slice(0, 4));

  try {
    const { token, adAccountId } = await getMetaToken(tenantId);
    const referenceCampaignId = clean(selectedCampaign?.id, 80);
    let campaignId = campaignMode === 'new' ? '' : referenceCampaignId;
    let createdCampaign: any = null;
    const fetchedSelectedTemplate = templateAdset?.id ? await getAdsetTemplate(token, clean(templateAdset.id, 80)) : null;
    const fetchedCampaignTemplate = referenceCampaignId ? await getCampaignDeliveryTemplate(token, referenceCampaignId) : null;
    const referenceDeliveryTemplate = mergeBiddingAmount(
      templateAdset ? { ...templateAdset, ...(fetchedSelectedTemplate || {}) } : fetchedCampaignTemplate,
      fetchedSelectedTemplate || fetchedCampaignTemplate,
    );
    const referenceCampaignBudget = referenceCampaignId ? mergeBiddingAmount(await getCampaignBudgetTemplate(token, referenceCampaignId), referenceDeliveryTemplate) : null;
    const createAsCampaignBudget = wantsCampaignBudget(body, campaignMode, campaignName, chatContext, referenceCampaignBudget);
    const campaignBudget = parseBudgetCents(resolvedDailyBudget || referenceCampaignBudget?.daily_budget, 2000);

    if (campaignMode === 'new') {
      const campaignBody: Record<string, unknown> = {
        name: campaignName,
        objective,
        status: 'PAUSED',
        special_ad_categories: [],
        buying_type: 'AUCTION',
      };
      if (createAsCampaignBudget) campaignBody.daily_budget = campaignBudget;
      createdCampaign = await metaFetch(token, `/${encodeURIComponent(adAccountId)}/campaigns`, {
        method: 'POST',
        body: JSON.stringify(campaignBody),
      });
      campaignId = clean(createdCampaign?.id, 80);
    }

    if (!campaignId) return Response.json({ error: 'Choose an existing campaign or provide a new campaign name first.' }, { status: 400 });

    const campaignDeliveryTemplate = referenceDeliveryTemplate || await getCampaignDeliveryTemplate(token, campaignId);
    const campaignBudgetTemplate = campaignMode === 'new' ? (createAsCampaignBudget ? { id: campaignId, daily_budget: String(campaignBudget) } : null) : (referenceCampaignBudget || await getCampaignBudgetTemplate(token, campaignId));
    const deliveryQuestions: string[] = [];
    const requestedRetargeting = wantsRetargetingSetup(body, chatContext);
    if (requestedRetargeting && !selfBuiltRetargeting && !hasTargeting(campaignDeliveryTemplate)) deliveryQuestions.push('Which existing retargeting ad set or custom audience should I copy?');
    if (needsConcreteGeoTemplate(resolvedMarkets, campaignDeliveryTemplate)) deliveryQuestions.push('Which planned ad set should I copy the worldwide country/exclusion list from?');
    if (!hasTargeting(campaignDeliveryTemplate) && !clean(resolvedMarkets, 200)) deliveryQuestions.push('Which countries or markets should I target?');
    if (campaignMode === 'new' && !clean(resolvedDailyBudget, 40)) deliveryQuestions.push('What daily budget should I use?');
    if (deliveryQuestions.length) return missingSettingsGate(deliveryQuestions.slice(0, 4));
    const useCampaignBudget = createAsCampaignBudget || campaignUsesCampaignBudget(campaignBudgetTemplate);
    const dailyBudget = useCampaignBudget ? null : parseBudgetCents(resolvedDailyBudget || campaignDeliveryTemplate?.daily_budget, 2000);
    const baseTargeting = selfBuiltRetargeting
      ? geoOnlyTargeting(campaignDeliveryTemplate, resolvedMarkets)
      : buildTargeting(campaignDeliveryTemplate, resolvedMarkets, { defaultCountries: [...CHAT_DEFAULT_COUNTRIES] });
    if (!baseTargeting) {
      return missingSettingsGate(['Which countries or markets should I target?']);
    }
    const retargetingAudienceSets = requestedRetargeting && selfBuiltRetargeting ? await buildSelfRetargetingAudienceSets(token, adAccountId, campaignName, campaignDeliveryTemplate) : [];
    const biddingSource = mergeBiddingAmount(campaignBudgetTemplate, campaignDeliveryTemplate) || campaignDeliveryTemplate;
    const explicitBidAmount = extractBidAmountFromText(`${chatContext} ${body.confirmation || ''} ${JSON.stringify(body.strategist_result || {})}`);
    const shouldUseAdsetBidding = !useCampaignBudget || Boolean(explicitBidAmount);
    const fallbackBidAmount = shouldUseAdsetBidding && bidStrategyNeedsAmount(biddingSource?.bid_strategy) && !hasUsableBidAmount(biddingSource?.bid_amount)
      ? inferBidAmountCents(body, chatContext, dailyBudget, campaignBudget)
      : undefined;
    const deliveryDefaults = adsetDefaultsForObjective(objective, campaignDeliveryTemplate);
    const adsetDefaults = shouldUseAdsetBidding ? {
      ...deliveryDefaults,
      ...completeBiddingDefaults(biddingSource),
      ...(fallbackBidAmount ? { bid_amount: fallbackBidAmount } : {}),
    } : withoutBiddingDefaults(deliveryDefaults);

    const itemPool = catalogItems;
    const createdAdsets = [];
    for (let index = 0; index < personas.length; index += 1) {
      const persona = personas[index] || {};
      const item = itemPool[index % itemPool.length] || itemPool[0];
      const adsetName = buildAdsetName(persona, item, index);
      const createBody: Record<string, unknown> = {
        name: adsetName,
        campaign_id: campaignId,
        status: 'PAUSED',
        is_adset_budget_sharing_enabled: useCampaignBudget,
        targeting: targetingWithAudiences(baseTargeting, retargetingAudienceSets[index % Math.max(1, retargetingAudienceSets.length)] || null),
        ...adsetDefaults,
      };
      if (dailyBudget) {
        createBody.daily_budget = dailyBudget;
        createBody.is_adset_budget_sharing_enabled = false;
      }
      const adset = await createMetaAdset(token, adAccountId, createBody, fallbackBidAmount);
      createdAdsets.push({
        id: adset?.id,
        name: adsetName,
        campaign_id: campaignId,
        status: 'PAUSED',
        product: item,
        persona,
        targeting_source: selfBuiltRetargeting ? 'self_built_custom_audiences' : templateAdset?.targeting ? 'copied_existing_adset' : 'chat_default',
        custom_audience: retargetingAudienceSets[index % Math.max(1, retargetingAudienceSets.length)] || null,
        chat_notes: chatContext,
      });
    }

    const plan = await createAdsetPlan(tenantId, {
      name: `${campaignName} chat-created ad sets`,
      campaignRefId: campaignId,
      planJson: {
        source: 'logic_ads_chat_create',
        confirmation,
        campaign: { id: campaignId, name: campaignName, mode: campaignMode, objective, created: Boolean(createdCampaign) },
        adsets: JSON.parse(JSON.stringify(createdAdsets)),
        selected_catalog_items: JSON.parse(JSON.stringify(catalogItems)),
        strategist_result: JSON.parse(JSON.stringify(body.strategist_result || null)),
        chat_context: chatContext,
        targeting_template_adset: JSON.parse(JSON.stringify(campaignDeliveryTemplate || null)),
        campaign_budget_template: JSON.parse(JSON.stringify(campaignBudgetTemplate || null)),
        budget_level: useCampaignBudget ? 'campaign' : 'adset',
        custom_audience_sets: JSON.parse(JSON.stringify(retargetingAudienceSets)),
      } as any,
      reasoning: 'Created in Meta from explicit Logic Ads chat confirmation. Campaign and ad sets are paused by default for safety.',
      createdBy: tenantId,
    });

    await logAdManagerAudit({
      tenantId,
      actor: tenantId,
      action: 'logic_ads_chat_create_meta_adsets',
      entityType: 'meta_campaign',
      entityId: campaignId,
      after: { campaignId, createdCampaign, createdAdsets, planId: plan?.id },
      reason: confirmation,
    });

    return Response.json({
      ok: true,
      campaign: { id: campaignId, name: campaignName, created: Boolean(createdCampaign), status: 'PAUSED' },
      adsets: createdAdsets,
      plan,
      message: `Created ${createdAdsets.length} paused ad set${createdAdsets.length === 1 ? '' : 's'} in ${campaignName}.`,
    });
  } catch (err) {
    if (err instanceof MetaError) {
      if (isAdsetBudgetSharingMetaError(err)) {
        return Response.json({
          error: 'Meta needs the ad set budget sharing setting for ABO. I set it explicitly and the create flow can retry.',
          detail: clean(err.message, 1200),
          questions: [],
        }, { status: 422 });
      }
      if (isBidAmountMetaError(err)) {
        return Response.json({
          error: 'Meta rejected the copied bid strategy. I removed bid cap and target cost from the create flow, so use a campaign daily budget and try again.',
          detail: clean(err.message, 1200),
          questions: [],
        }, { status: 422 });
      }
      return Response.json({ error: safeMetaErrorMessage(err), detail: clean(err.message, 1200) }, { status: err.status });
    }
    console.error('[ad-manager/chat-create]', err);
    const detail = err instanceof Error ? err.message : 'Failed to create campaign or ad sets in Meta';
    return Response.json({ error: 'Create failed before Meta confirmed anything. I kept the exact detail below.', detail: clean(detail, 1200) }, { status: 500 });
  }
}
