import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { getTenantConfig } from '@/lib/db';
import { brandProfileToAnalysis, type BrandProfile as StoredBrandProfile } from '@/lib/brand-profile';

export const dynamic = 'force-dynamic';

type CreativeOsBrandProfile = {
  name: string;
  story: string;
  voice: string;
  instructions: string;
  doNotSay: string;
  referenceLinks: CreativeOsBrandReferenceLink[];
};

type CreativeOsBrandReferenceLink = {
  id: string;
  url: string;
  info: string;
};

function clean(value: unknown, max = 1400) {
  return String(value || '')
    .replace(/[\u2013\u2014]/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function lines(values: unknown[], maxItems = 8) {
  return values
    .flatMap(value => Array.isArray(value) ? value : [value])
    .map(value => clean(value, 260))
    .filter(Boolean)
    .slice(0, maxItems)
    .map(value => `- ${value}`)
    .join('\n');
}

function safeJsonParse(value: string): any {
  try { return JSON.parse(value); } catch { return null; }
}

function normalizeResult(value: any, fallback: CreativeOsBrandProfile): CreativeOsBrandProfile {
  return {
    name: clean(value?.name, 120) || fallback.name,
    story: clean(value?.story, 1400) || fallback.story,
    voice: clean(value?.voice, 1000) || fallback.voice,
    instructions: clean(value?.instructions, 1400) || fallback.instructions,
    doNotSay: clean(value?.doNotSay, 1400) || fallback.doNotSay,
    referenceLinks: normalizeReferenceLinks(value?.referenceLinks).length ? normalizeReferenceLinks(value?.referenceLinks) : fallback.referenceLinks,
  };
}

function normalizeReferenceLinks(input: unknown): CreativeOsBrandReferenceLink[] {
  const items = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(/\n|,/).map(url => ({ url }))
      : [];
  return items
    .map((item, index) => {
      const candidate = item && typeof item === 'object' ? item as Partial<CreativeOsBrandReferenceLink> & { note?: string; description?: string } : {};
      const url = clean(candidate.url, 1000);
      const info = clean(candidate.info || candidate.note || candidate.description, 1000);
      return {
        id: typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id.trim().slice(0, 120) : `brand-reference-${index}-${url.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32) || 'link'}`,
        url,
        info,
      };
    })
    .filter(item => item.url || item.info)
    .slice(0, 30);
}

function buildFallback(profile: StoredBrandProfile): CreativeOsBrandProfile {
  const summary = profile.source_summary || {};
  const analysis = brandProfileToAnalysis(profile) || {};
  const topProducts = Array.isArray(summary.top_products) ? summary.top_products : [];
  const productCatalog = Array.isArray(summary.product_catalog) ? summary.product_catalog : [];
  const collectionCatalog = Array.isArray(summary.collection_catalog) ? summary.collection_catalog : [];
  const productNames = [...topProducts, ...productCatalog].map((product: any) => clean(product?.title || product?.name, 120)).filter(Boolean);
  const keyPages = Array.isArray(summary.key_pages) ? summary.key_pages.map((page: any) => clean(page, 500)).filter(Boolean) : [];
  const purposeClues = Array.isArray(summary.purpose_clues) ? summary.purpose_clues : [];
  const technologies = Array.isArray(summary.technologies) ? summary.technologies : [];

  const story = [
    clean(analysis.summary, 500),
    clean(analysis.positioning, 500),
    clean(profile.brand_purpose, 500),
    clean(profile.what_you_sell, 500) ? `What they sell: ${clean(profile.what_you_sell, 500)}` : '',
    clean(profile.ideal_customer, 500) ? `Customer: ${clean(profile.ideal_customer, 500)}` : '',
    clean(summary.site_description, 500),
  ].filter(Boolean).join('\n\n');

  const instructions = [
    clean(profile.content_goals, 500),
    clean(analysis.content_goals, 500),
    productNames.length ? `Use real products and catalog context. Main scraped products: ${productNames.slice(0, 12).join(', ')}.` : '',
    purposeClues.length ? `Recurring site themes:\n${lines(purposeClues, 6)}` : '',
    collectionCatalog.length ? `Collections found:\n${lines(collectionCatalog.map((item: any) => item?.title || item?.url), 6)}` : '',
  ].filter(Boolean).join('\n\n') || 'Use the scraped website, product catalog and selected brief context. Keep every claim source-backed and practical for editors.';

  const doNotSay = [
    clean(profile.customer_problem, 500) ? `Do not ignore the real customer problem: ${clean(profile.customer_problem, 500)}` : '',
    clean(profile.competitors, 500) ? `Avoid unsupported competitor claims. Known comparison context: ${clean(profile.competitors, 500)}` : '',
    'Do not invent guarantees, discounts, medical/performance claims or product features that are not visible on the site or product page.',
    'Do not use vague hype when a concrete product benefit is available.',
  ].filter(Boolean).join('\n\n');

  const referenceLinks = normalizeReferenceLinks([
    { url: clean(profile.website, 500), info: 'Main brand website' },
    ...keyPages.slice(0, 10).map((url: string) => ({ url, info: 'Key scraped site page' })),
    ...topProducts.map((product: any) => ({ url: clean(product?.url, 500), info: clean(product?.title || product?.name, 180) || 'Scraped product page' })).filter(item => item.url).slice(0, 10),
  ]);

  return {
    name: clean(profile.brand_name || summary.site_title || '', 120),
    story: story || 'Brand context is loaded from the saved site scrape. Review this field and add founder-specific nuance if needed.',
    voice: clean(profile.brand_tone || profile.visual_style || analysis.brand_voice, 1000) || `Clear, specific, product-led and source-backed.${technologies.length ? ` Backend site signals include: ${technologies.slice(0, 6).join(', ')}.` : ''}`,
    instructions,
    doNotSay,
    referenceLinks,
  };
}

export async function POST(request: NextRequest) {
  let body: { tenant_id?: string } = {};
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  let tenantId = '';
  try {
    tenantId = await requireAuth(request, body.tenant_id);
  } catch (err) {
    return handleAuthError(err);
  }

  const raw = await getTenantConfig(tenantId, 'brand_profile');
  const profile = raw ? safeJsonParse(raw) as StoredBrandProfile | null : null;
  if (!profile) return Response.json({ error: 'No scraped brand profile found. Connect or scrape the brand site in Settings first.' }, { status: 404 });

  const fallback = buildFallback(profile);
  if (!process.env.OPENAI_API_KEY) return Response.json({ ok: true, source: 'scraped_brand_profile', brand: fallback });

  const prompt = `Turn this saved website/brand scrape into practical Creative OS brand context for ad editors.
Use only the data in the JSON. Do not invent legal claims, guarantees, discounts, audience facts, or product features.
Return strict JSON with:
{
  "name": "brand name",
  "story": "short practical brand story for editors",
  "voice": "how editors should write and feel",
  "instructions": "actionable creative rules for every brief",
  "doNotSay": "claims, words, offers, visual directions or assumptions to avoid",
  "referenceLinks": [{"url": "https://example.com/page", "info": "why this link matters for editors"}]
}

Saved brand scrape:
${JSON.stringify(profile).slice(0, 18000)}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
        temperature: 0.15,
        messages: [
          { role: 'system', content: 'You are a precise e-commerce brand strategist. Output only source-grounded JSON.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (!response.ok) return Response.json({ ok: true, source: 'scraped_brand_profile', brand: fallback });
    const data = await response.json();
    const parsed = safeJsonParse(data?.choices?.[0]?.message?.content || '');
    return Response.json({ ok: true, source: 'scraped_brand_profile_ai', brand: normalizeResult(parsed, fallback) });
  } catch {
    return Response.json({ ok: true, source: 'scraped_brand_profile', brand: fallback });
  }
}
