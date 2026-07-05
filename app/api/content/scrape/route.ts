import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { getTenantConfig, setTenantConfig } from '@/lib/db';
import { scrapeWebshop, type ScrapeResult } from '@/lib/scraper';
import { apiSuccess, badRequest, apiError, ErrorCode, withErrorHandler, handleStructuredAuthError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const BRAND_PROFILE_KEY = 'brand_profile';

type IntakeDraft = {
  brand_name: string;
  website: string;
  what_you_sell: string;
  ideal_customer: string;
  customer_problem: string;
  main_offer: string;
  proof_points: string;
  competitors: string;
  brand_tone: string;
  content_goals: string;
};

function clean(value: any, max = 1200) {
  return String(value || '').trim().slice(0, max);
}

function normalizeUrl(input: string) {
  const value = input.trim();
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}


function absoluteUrl(base: string, href: string) {
  try { return new URL(href, base).toString(); } catch { return href; }
}

function uniqueUrls(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean)));
}

function assetKey(value: string) {
  try {
    const url = new URL(value);
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return String(value || '').split(/[?#]/)[0].replace(/\/$/, '').toLowerCase();
  }
}

function dedupeAgainst(values: string[], blocked: string[]) {
  const blockedKeys = new Set(blocked.map(assetKey));
  const seen = new Set<string>();
  return values.filter(value => {
    const key = assetKey(value);
    if (!key || blockedKeys.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractAttr(tag: string, attr: string) {
  return tag.match(new RegExp(`${attr}=["']([^"']+)["']`, 'i'))?.[1] || '';
}

function srcsetUrls(srcset: string, base: string) {
  return srcset.split(',').map(part => part.trim().split(/\s+/)[0]).filter(Boolean).map(src => absoluteUrl(base, src));
}

function looseLogoUrls(html: string, base: string) {
  const matches = [
    ...Array.from(html.matchAll(/["'\(\s]((?:https?:)?\/\/[^"'\)\s]*(?:logo|wordmark)[^"'\)\s]*\.(?:png|svg|webp|jpe?g))/gi)).map(m => m[1]),
    ...Array.from(html.matchAll(/["'\(\s](\/[^"'\)\s]*(?:logo|wordmark)[^"'\)\s]*\.(?:png|svg|webp|jpe?g))/gi)).map(m => m[1]),
  ];
  return uniqueUrls(matches.map(url => absoluteUrl(base, url.replace(/&amp;/g, '&'))));
}

function detectBrandAssets(html: string, finalUrl: string) {
  const origin = new URL(finalUrl).origin;
  const domain = new URL(finalUrl).hostname;
  const relIcons = Array.from(html.matchAll(/<link[^>]*rel=["'][^"']*(?:icon|apple-touch-icon|mask-icon)[^"']*["'][^>]*href=["']([^"']+)["']/gi)).map(m => absoluteUrl(finalUrl, m[1]));
  const hrefFirstIcons = Array.from(html.matchAll(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["'][^"']*(?:icon|apple-touch-icon|mask-icon)[^"']*["']/gi)).map(m => absoluteUrl(finalUrl, m[1]));
  const jsonLdLogos = Array.from(html.matchAll(/["']logo["']\s*:\s*["']([^"']+)["']/gi)).map(m => absoluteUrl(finalUrl, m[1]));
  const ogImage = html.match(/<meta[^>]*(?:property|name)=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1];
  const logoImages: string[] = [];
  const broadLogoImages: string[] = [];
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const src = extractAttr(tag, 'src');
    const srcset = extractAttr(tag, 'srcset');
    const descriptor = `${extractAttr(tag, 'alt')} ${extractAttr(tag, 'class')} ${extractAttr(tag, 'id')} ${extractAttr(tag, 'title')} ${extractAttr(tag, 'aria-label')}`.toLowerCase();
    const urls = uniqueUrls([src ? absoluteUrl(finalUrl, src) : '', ...srcsetUrls(srcset, finalUrl)]);
    if (!urls.length) continue;
    if (/logo|wordmark|brand|header__heading|site-header|navbar|nav-logo/.test(descriptor)) logoImages.push(...urls);
    else if (/logo|wordmark|brand/.test(urls.join(' ').toLowerCase())) broadLogoImages.push(...urls);
  }
  const discoveredIcons = uniqueUrls([
    ...relIcons,
    ...hrefFirstIcons,
  ]);
  const iconCandidates = (discoveredIcons.length ? discoveredIcons : [`${origin}/favicon.ico`]).slice(0, 4);
  const rawLogoCandidates = uniqueUrls([
    ...logoImages,
    ...jsonLdLogos,
    ...broadLogoImages,
    ...looseLogoUrls(html, finalUrl),
    ogImage ? absoluteUrl(finalUrl, ogImage) : '',
  ]);
  const logoCandidates = dedupeAgainst(rawLogoCandidates, iconCandidates).slice(0, 8);
  return { logoCandidates, iconCandidates };
}

async function collectBrandAssets(url: string) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AinomiqBot/1.0)', Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    });
    const html = res.ok ? await res.text() : '';
    return detectBrandAssets(html, res.url || url);
  } catch {
    return { logoCandidates: [], iconCandidates: [] };
  }
}

function productSummary(scrape: ScrapeResult) {
  return scrape.products
    .slice(0, 8)
    .map((product) => {
      const price = product.price ? ` (${product.price})` : '';
      return `${product.title}${price}`;
    })
    .join(', ');
}

function policyProof(scrape: ScrapeResult) {
  const pieces = [
    scrape.shippingCosts ? `Shipping: ${scrape.shippingCosts}` : '',
    scrape.policies.find((p) => p.type === 'returns')?.content ? `Returns policy found` : '',
    scrape.contact.email ? `Contact email: ${scrape.contact.email}` : '',
    scrape.availableMarkets.length ? `Markets: ${scrape.availableMarkets.slice(0, 5).map((m) => m.name || m.country).join(', ')}` : '',
  ].filter(Boolean);
  return pieces.join('. ');
}

function productCatalog(scrape: ScrapeResult) {
  return scrape.products.slice(0, 36).map((product) => ({
    title: clean(product.title, 180),
    price: clean(product.price, 80),
    image_url: clean(product.image, 1200) || null,
    url: clean(product.url, 1200),
    available: product.variants.some((variant) => variant.available !== false),
    variants: product.variants.slice(0, 8).map((variant) => ({
      title: clean(variant.title, 120),
      price: clean(variant.price, 80),
      available: variant.available !== false,
      options: variant.options || {},
    })),
  })).filter((product) => product.title);
}

function productFocusFromCatalog(catalog: ReturnType<typeof productCatalog>) {
  return catalog
    .slice(0, 8)
    .map((product) => `${product.title}${product.price ? ` (${product.price})` : ''}`)
    .join(', ');
}

function fallbackDraft(url: string, scrape: ScrapeResult): IntakeDraft {
  const name = scrape.storeInfo.name || new URL(url).hostname.replace(/^www\./, '');
  const products = productSummary(scrape);
  const description = scrape.storeInfo.description || '';
  return {
    brand_name: name,
    website: url,
    what_you_sell: products || description || 'Products from the website',
    ideal_customer: scrape.storeInfo.language ? `Website visitors and customers in language ${scrape.storeInfo.language}` : 'Customers found from the website positioning',
    customer_problem: description || 'Customer problem needs confirmation after website scan',
    main_offer: products.split(', ').slice(0, 3).join(', ') || description || 'Main offer needs confirmation',
    proof_points: policyProof(scrape) || 'Proof points need confirmation',
    competitors: '',
    brand_tone: 'Clear, practical, brand-led, and conversion focused',
    content_goals: 'Generate publishing-ready social content, ads, email snippets, and content ideas based on the website',
  };
}

async function aiDraft(url: string, scrape: ScrapeResult): Promise<IntakeDraft> {
  const fallback = fallbackDraft(url, scrape);
  if (!process.env.OPENAI_API_KEY) return fallback;

  const compactScrape = {
    url,
    platform: scrape.platform,
    storeInfo: scrape.storeInfo,
    products: scrape.products.slice(0, 12).map((p) => ({ title: p.title, price: p.price, url: p.url })),
    policies: scrape.policies.map((p) => ({ type: p.type, title: p.title, content: p.content.slice(0, 600) })),
    shippingCosts: scrape.shippingCosts,
    faq: scrape.faq.slice(0, 12),
    markets: scrape.availableMarkets.slice(0, 8),
  };

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.CONTENT_ANALYSIS_MODEL || 'gpt-4o-mini',
        temperature: 0.25,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You convert website scrape data into an onboarding intake draft. Return only JSON. Do not invent hard facts. If unknown, write that it needs confirmation.' },
          { role: 'user', content: `Create JSON with these exact keys: brand_name, website, what_you_sell, ideal_customer, customer_problem, main_offer, proof_points, competitors, brand_tone, content_goals. Use concise useful text. Scrape data:\n${JSON.stringify(compactScrape, null, 2)}` },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI returned ${res.status}`);
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    return {
      brand_name: clean(parsed.brand_name) || fallback.brand_name,
      website: url,
      what_you_sell: clean(parsed.what_you_sell) || fallback.what_you_sell,
      ideal_customer: clean(parsed.ideal_customer) || fallback.ideal_customer,
      customer_problem: clean(parsed.customer_problem) || fallback.customer_problem,
      main_offer: clean(parsed.main_offer) || fallback.main_offer,
      proof_points: clean(parsed.proof_points) || fallback.proof_points,
      competitors: clean(parsed.competitors) || fallback.competitors,
      brand_tone: clean(parsed.brand_tone) || fallback.brand_tone,
      content_goals: clean(parsed.content_goals) || fallback.content_goals,
    };
  } catch (err) {
    console.error('[content/scrape] AI draft failed:', err);
    return fallback;
  }
}

export const POST = withErrorHandler(async (request: NextRequest) => {
  let body: any;
  try { body = await request.json(); } catch { return badRequest('Invalid JSON body.', ErrorCode.INVALID_JSON); }

  let tenantId = '';
  try { tenantId = await requireAuth(request, body.tenant_id); } catch (err) { return handleStructuredAuthError(err); }

  const rawUrl = clean(body.website || body.url, 500);
  if (!rawUrl) return badRequest('Website URL is required.', ErrorCode.MISSING_FIELD);

  let url = '';
  try { url = normalizeUrl(rawUrl); new URL(url); } catch { return badRequest('Invalid website URL. Please enter a valid URL like https://example.com.', ErrorCode.VALIDATION_ERROR); }

  let scrape: ScrapeResult;
  let brandAssets: { logoCandidates: string[]; iconCandidates: string[] };
  try {
    let finalStep: any = null;
    [scrape, brandAssets] = await Promise.all([
      scrapeWebshop(url, (step) => { finalStep = step; }),
      collectBrandAssets(url),
    ]);
  } catch (err) {
    console.error('[content/scrape] Scrape failed:', err);
    return apiError(
      'Could not scrape the website. The site may be blocking automated requests or is temporarily down.',
      ErrorCode.SCRAPE_ERROR,
    );
  }

  const draft = await aiDraft(url, scrape);
  const iconCandidates = uniqueUrls([scrape.storeInfo.favicon, ...brandAssets.iconCandidates]);
  const logoCandidates = dedupeAgainst(uniqueUrls([scrape.storeInfo.logo, ...brandAssets.logoCandidates]), iconCandidates);
  const sourceIcon = iconCandidates[0] || null;
  const sourceLogo = logoCandidates[0] || null;
  const catalog = productCatalog(scrape);
  const scrapeSummary = { platform: scrape.platform, products: scrape.products.length, product_catalog: catalog, top_products: productFocusFromCatalog(catalog), policies: scrape.policies.length, logo: sourceLogo, icon: sourceIcon, favicon: sourceIcon, logo_candidates: logoCandidates, icon_candidates: iconCandidates, scraped_at: new Date().toISOString() };
  const existingRaw = await getTenantConfig(tenantId, BRAND_PROFILE_KEY);
  let existing: any = {};
  try { existing = existingRaw ? JSON.parse(existingRaw) : {}; } catch {}
  const existingIcon = clean(existing.icon_url, 50000);
  const existingFullLogo = clean(existing.full_logo_url || existing.logo_url, 50000);
  const safeIcon = existingIcon || sourceIcon || '';
  const safeFullLogo = existingFullLogo && assetKey(existingFullLogo) !== assetKey(safeIcon) ? existingFullLogo : sourceLogo || '';
  const brandProfile = { ...existing, ...draft, logo_url: safeFullLogo, full_logo_url: safeFullLogo, icon_url: safeIcon, source_summary: scrapeSummary, status: 'ready', updated_at: new Date().toISOString() };
  await setTenantConfig(tenantId, BRAND_PROFILE_KEY, JSON.stringify(brandProfile));

  return apiSuccess({ draft, brand_profile: brandProfile, scrape_summary: scrapeSummary });
});
