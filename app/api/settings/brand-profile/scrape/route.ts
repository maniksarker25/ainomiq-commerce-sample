import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { getTenantConfig } from '@/lib/db';
import { scrapeWebshop, type ScrapeResult } from '@/lib/scraper';
import { creditErrorResponse, requireCredits, spendCredits } from '@/lib/credits';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const BRAND_PROFILE_KEY = 'brand_profile';

type BrandProfileDraft = {
  brand_name: string;
  website: string;
  what_you_sell: string;
  ideal_customer: string;
  customer_problem: string;
  main_offer: string;
  proof_points: string;
  competitors: string;
  brand_purpose: string;
  brand_tone: string;
  visual_style: string;
  content_goals: string;
};

type SiteSignals = {
  title: string;
  description: string;
  technologies: string[];
  social_links: Record<string, string>;
  brand_colors: string[];
  purpose_clues: string[];
  page_count: number;
  key_pages: string[];
  body_summary: string;
  logo_candidates: string[];
  icon_candidates: string[];
};

function clean(value: any, max = 1000) {
  const text = String(value || '').trim();
  if (!text) return '';
  const lower = text.toLowerCase();
  const blocked = [
    'inferred - needs review',
    'needs confirmation',
    'need confirmation',
    'review and confirm',
    'to be confirmed',
    'not specified',
    'unknown',
    'n/a',
  ];
  if (blocked.some(marker => lower === marker || lower.includes(marker))) return '';
  return text.slice(0, max);
}

function normalizeWebsiteUrl(raw: string) {
  const trimmed = clean(raw, 500);
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function productSummary(scrape: ScrapeResult) {
  return scrape.products
    .slice(0, 12)
    .map(product => [product.title, product.price].filter(Boolean).join(' - '))
    .filter(Boolean)
    .join('\n');
}

function proofSummary(scrape: ScrapeResult) {
  return [
    scrape.shippingCosts ? `Shipping: ${scrape.shippingCosts}` : '',
    scrape.policies.find(policy => policy.type === 'returns')?.content ? 'Returns policy found' : '',
    scrape.contact.email ? `Contact email: ${scrape.contact.email}` : '',
    scrape.availableMarkets.length ? `Markets: ${scrape.availableMarkets.slice(0, 8).map(market => market.name || market.country).join(', ')}` : '',
    scrape.faq.length ? `FAQ items found: ${scrape.faq.length}` : '',
  ].filter(Boolean).join('\n');
}


function categoryFromScrape(scrape: ScrapeResult) {
  const text = [
    scrape.storeInfo.description,
    scrape.products.slice(0, 8).map(product => product.title).join(' '),
  ].filter(Boolean).join(' ').toLowerCase();
  if (/automation|ai|agent|workflow|customer support|support/i.test(text)) return 'AI automation and workflow software';
  if (/fashion|jeans|clothing|apparel|wear/i.test(text)) return 'fashion and apparel';
  if (/beauty|skin|cosmetic/i.test(text)) return 'beauty and personal care';
  if (/jewel|ring|necklace|bracelet/i.test(text)) return 'jewelry and accessories';
  if (/supplement|health|fitness/i.test(text)) return 'health and wellness';
  return scrape.platform === 'shopify' ? 'e-commerce products' : 'this category';
}

function inferredCustomer(scrape: ScrapeResult) {
  const category = categoryFromScrape(scrape);
  const markets = scrape.availableMarkets.slice(0, 4).map(market => market.name || market.country).filter(Boolean).join(', ');
  if (/AI automation/i.test(category)) return 'E-commerce and growth teams that want automated operations, faster execution, and less manual work.';
  return `Customers interested in ${category}${markets ? ` across ${markets}` : ''}.`;
}

function inferredProblem(scrape: ScrapeResult) {
  const category = categoryFromScrape(scrape);
  if (/AI automation/i.test(category)) return 'Manual workflows, slow execution, scattered tools, and repetitive operational work that blocks growth.';
  return `Finding the right ${category} with clear product information, trust signals, and an easy buying experience.`;
}

function inferredCompetitors(scrape: ScrapeResult) {
  const category = categoryFromScrape(scrape);
  if (/AI automation/i.test(category)) return 'Manual in-house workflows, freelancers or agencies, generic helpdesk/content tools, and custom automation platforms.';
  return `Other ${category} brands, marketplaces, local stores, and doing nothing or delaying the purchase.`;
}

function inferredContentGoals(scrape: ScrapeResult) {
  const category = categoryFromScrape(scrape);
  if (/AI automation/i.test(category)) return 'Explain the automation value, show concrete use cases, build trust, educate prospects, and turn website context into publish-ready posts, ads, and email snippets.';
  return `Turn scraped website, product, policy, and brand context into publish-ready content that explains the offer, answers objections, builds trust, and drives conversions for ${category}.`;
}

function absoluteUrl(base: string, href: string) {
  try { return new URL(href, base).toString(); } catch { return href; }
}

function uniqueUrls(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean)));
}

function usableImageUrl(value: string) {
  const url = String(value || '').trim();
  if (!url) return false;
  if (/^data:image\//i.test(url)) return true;
  if (!/^https?:\/\//i.test(url)) return false;
  if (/google\.com\/s2\/favicons/i.test(url)) return false;
  return /\.(?:png|svg|webp|jpe?g|ico)(?:$|[?#])/i.test(url);
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

function preloadLogoUrls(html: string, base: string) {
  return uniqueUrls(Array.from(html.matchAll(/<link\b[^>]*>/gi)).flatMap(match => {
    const tag = match[0];
    const rel = extractAttr(tag, 'rel').toLowerCase();
    const as = extractAttr(tag, 'as').toLowerCase();
    const href = extractAttr(tag, 'href');
    const descriptor = `${href} ${extractAttr(tag, 'imagesrcset')}`.toLowerCase();
    if (!href || rel !== 'preload' || as !== 'image' || !/(logo|wordmark)/i.test(descriptor)) return [];
    return [absoluteUrl(base, href), ...srcsetUrls(extractAttr(tag, 'imagesrcset'), base)];
  }));
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
  ]).filter(usableImageUrl);
  const iconCandidates = (discoveredIcons.length ? discoveredIcons : [`${origin}/favicon.ico`]).slice(0, 4);
  const rawLogoCandidates = uniqueUrls([
    ...logoImages,
    ...preloadLogoUrls(html, finalUrl),
    ...jsonLdLogos,
    ...broadLogoImages,
    ...looseLogoUrls(html, finalUrl),
    ogImage ? absoluteUrl(finalUrl, ogImage) : '',
  ]).filter(usableImageUrl);
  const logoCandidates = dedupeAgainst(rawLogoCandidates, iconCandidates).slice(0, 8);
  return { logoCandidates, iconCandidates };
}

function textFromHtml(html: string, max = 3500) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function detectTechnologies(html: string) {
  const checks: Array<[string, RegExp]> = [
    ['Shopify', /cdn\.shopify\.com|myshopify\.com|Shopify\.theme|\/cart\/add/i],
    ['WooCommerce', /woocommerce|wc-block|wp-content\/plugins\/woocommerce/i],
    ['Klaviyo', /klaviyo|_learnq/i],
    ['Meta Pixel', /connect\.facebook\.net|fbq\(/i],
    ['Google Analytics', /googletagmanager\.com\/gtag|google-analytics\.com|G-[A-Z0-9]+/i],
    ['Google Tag Manager', /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]+/i],
    ['TikTok Pixel', /analytics\.tiktok\.com|ttq\./i],
    ['Pinterest Tag', /ct\.pinterest\.com|pintrk/i],
    ['Trustpilot', /trustpilot/i],
    ['Judge.me', /judge\.me|judgeme/i],
    ['Next.js', /__next|\/_next\//i],
    ['Wix', /wixstatic|wix\.com/i],
    ['Squarespace', /squarespace/i],
  ];
  return checks.filter(([, pattern]) => pattern.test(html)).map(([name]) => name);
}

function detectBrandColors(html: string) {
  const candidates = [
    ...Array.from(html.matchAll(/#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/gi)).map(m => m[0].toLowerCase()),
    ...Array.from(html.matchAll(/(?:background|color|border-color)[^:]*:\s*(rgb\([^)]*\)|rgba\([^)]*\))/gi)).map(m => m[1].replace(/\s+/g, '')),
    ...Array.from(html.matchAll(/theme-color["'][^>]*content=["']([^"']+)/gi)).map(m => m[1].trim()),
  ];
  const counts = new Map<string, number>();
  for (const color of candidates) {
    if (/^#(?:000|000000|fff|ffffff)$/i.test(color)) continue;
    counts.set(color, (counts.get(color) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([color]) => color)
    .slice(0, 8);
}

function detectPurposeClues(text: string) {
  const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  const purposeWords = /mission|purpose|about us|we believe|we help|our goal|our story|designed to|made to|created to|built for|so you can|because/i;
  return sentences.filter(sentence => purposeWords.test(sentence)).slice(0, 8);
}

async function collectSiteSignals(url: string): Promise<SiteSignals> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AinomiqBot/1.0)', Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    });
    const finalUrl = res.url || url;
    const origin = new URL(finalUrl).origin;
    const html = res.ok ? await res.text() : '';
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() || '';
    const description = html.match(/<meta[^>]*(?:name|property)=["'](?:description|og:description)["'][^>]*content=["']([^"']*)["']/i)?.[1]?.trim() || '';
    const body_summary = textFromHtml(html);
    const hrefs = Array.from(html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)).map(m => absoluteUrl(finalUrl, m[1]));
    const social_links: Record<string, string> = {};
    for (const href of hrefs) {
      if (/instagram\.com/i.test(href) && !social_links.instagram) social_links.instagram = href;
      if (/facebook\.com/i.test(href) && !social_links.facebook) social_links.facebook = href;
      if (/tiktok\.com/i.test(href) && !social_links.tiktok) social_links.tiktok = href;
      if (/youtube\.com/i.test(href) && !social_links.youtube) social_links.youtube = href;
      if (/linkedin\.com/i.test(href) && !social_links.linkedin) social_links.linkedin = href;
    }
    let sitemapUrls: string[] = [];
    try {
      const sitemapRes = await fetch(`${origin}/sitemap.xml`, { signal: AbortSignal.timeout(3500) });
      const sitemap = sitemapRes.ok ? await sitemapRes.text() : '';
      sitemapUrls = Array.from(sitemap.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)).map(m => m[1].replace(/&amp;/g, '&')).slice(0, 200);
    } catch {}
    const internal = Array.from(new Set([...hrefs, ...sitemapUrls].filter(link => {
      try { return new URL(link).origin === origin; } catch { return false; }
    })));
    const key_pages = internal.filter(link => /about|contact|faq|shipping|return|policy|privacy|terms|collections|products/i.test(link)).slice(0, 30);
    return {
      title,
      description,
      technologies: detectTechnologies(html),
      social_links,
      brand_colors: detectBrandColors(html),
      purpose_clues: detectPurposeClues(`${title}. ${description}. ${body_summary}`),
      page_count: Math.max(internal.length, sitemapUrls.length),
      key_pages,
      body_summary,
      logo_candidates: detectBrandAssets(html, finalUrl).logoCandidates,
      icon_candidates: detectBrandAssets(html, finalUrl).iconCandidates,
    };
  } catch {
    return { title: '', description: '', technologies: [], social_links: {}, brand_colors: [], purpose_clues: [], page_count: 0, key_pages: [], body_summary: '', logo_candidates: [], icon_candidates: [] };
  }
}

function confidenceScore(scrape: ScrapeResult) {
  let score = 20;
  if (scrape.storeInfo.name) score += 10;
  if (scrape.storeInfo.description) score += 10;
  if (scrape.products.length >= 3) score += 20;
  else if (scrape.products.length > 0) score += 10;
  if (scrape.policies.length >= 2) score += 15;
  else if (scrape.policies.length > 0) score += 8;
  if (scrape.faq.length > 0) score += 10;
  if (scrape.contact.email || scrape.contact.phone) score += 8;
  if (scrape.availableMarkets.length > 0) score += 7;
  return Math.min(98, score);
}

function fallbackDraft(url: string, scrape: ScrapeResult): BrandProfileDraft {
  const name = scrape.storeInfo.name || new URL(url).hostname.replace(/^www\./, '');
  const products = productSummary(scrape);
  const category = categoryFromScrape(scrape);
  return {
    brand_name: name,
    website: url,
    what_you_sell: products || scrape.storeInfo.description || `${name} operates in ${category}.`,
    ideal_customer: inferredCustomer(scrape),
    customer_problem: inferredProblem(scrape),
    main_offer: products.split('\n')[0] || scrape.storeInfo.description || `${name}'s primary ${category} offer.`,
    proof_points: proofSummary(scrape) || [scrape.storeInfo.description, products.split('\n').slice(0, 3).join('\n')].filter(Boolean).join('\n'),
    competitors: inferredCompetitors(scrape),
    brand_purpose: scrape.storeInfo.description || `${name} helps customers solve problems in ${category}.`,
    brand_tone: 'Clear, practical, confident, and conversion focused.',
    visual_style: 'Clean, modern, product-led visual style based on the scraped website.',
    content_goals: inferredContentGoals(scrape),
  };
}

async function aiDraft(url: string, scrape: ScrapeResult, siteSignals: SiteSignals): Promise<BrandProfileDraft> {
  const fallback = fallbackDraft(url, scrape);
  if (!process.env.OPENAI_API_KEY) return fallback;
  const compactScrape = {
    platform: scrape.platform,
    storeInfo: scrape.storeInfo,
    products: scrape.products.slice(0, 15).map(product => ({ title: product.title, price: product.price, url: product.url })),
    policies: scrape.policies.map(policy => ({ type: policy.type, title: policy.title, content: policy.content.slice(0, 700) })),
    shippingCosts: scrape.shippingCosts,
    faq: scrape.faq.slice(0, 15),
    markets: scrape.availableMarkets.slice(0, 10),
    contact: scrape.contact,
    siteSignals,
  };
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.CONTENT_ANALYSIS_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You turn website scrape data into a reusable brand profile for automation setup. Return only JSON. Use scraped facts first. When a field is not directly stated, infer the most useful likely value from products, copy, categories, policies, pages, and technology signals. Never return placeholders like unknown, needs review, needs confirmation, or inferred - needs review. Do not invent hard business facts such as exact partners, revenue, guarantees, or contracts.' },
          { role: 'user', content: `Create JSON with exact keys: brand_name, website, what_you_sell, ideal_customer, customer_problem, main_offer, proof_points, competitors, brand_purpose, brand_tone, visual_style, content_goals. Capture everything useful for future automations so the customer does not need to manually fill fields: offer, products, categories, audience clues, pain points, proof, logistics, policies, markets, contact, brand purpose, voice, visual style, competitors or alternatives, and content goals. Fill every key with useful concise text. Scrape data:\n${JSON.stringify(compactScrape, null, 2)}` },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI returned ${res.status}`);
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    return {
      brand_name: clean(parsed.brand_name, 120) || fallback.brand_name,
      website: clean(parsed.website, 500) || url,
      what_you_sell: clean(parsed.what_you_sell, 1500) || fallback.what_you_sell,
      ideal_customer: clean(parsed.ideal_customer, 1500) || fallback.ideal_customer,
      customer_problem: clean(parsed.customer_problem, 1500) || fallback.customer_problem,
      main_offer: clean(parsed.main_offer, 1500) || fallback.main_offer,
      proof_points: clean(parsed.proof_points, 1500) || fallback.proof_points,
      competitors: clean(parsed.competitors, 1000) || fallback.competitors,
      brand_purpose: clean(parsed.brand_purpose, 1200) || fallback.brand_purpose,
      brand_tone: clean(parsed.brand_tone, 1200) || fallback.brand_tone,
      visual_style: clean(parsed.visual_style, 1200) || fallback.visual_style,
      content_goals: clean(parsed.content_goals, 1200) || fallback.content_goals,
    };
  } catch (err) {
    console.error('[settings/brand-profile/scrape] AI draft failed:', err);
    return fallback;
  }
}

export async function POST(request: NextRequest) {
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  let tenantId = '';
  try { tenantId = await requireAuth(request, body.tenant_id); } catch (err) { return handleAuthError(err); }

  const url = normalizeWebsiteUrl(body.website);
  if (!url || !/^https?:\/\//i.test(url)) return Response.json({ error: 'Enter a valid website URL' }, { status: 400 });

  try {
    await requireCredits(tenantId, 'brand_scan', 1);
    let finalStep: any = null;
    const [scrape, siteSignals] = await Promise.all([
      scrapeWebshop(url, step => { finalStep = step; }),
      collectSiteSignals(url),
    ]);
    const generatedDraft = await aiDraft(url, scrape, siteSignals);
    const iconCandidates = uniqueUrls([scrape.storeInfo.favicon, ...siteSignals.icon_candidates]);
    const logoCandidates = dedupeAgainst(uniqueUrls([scrape.storeInfo.logo, ...siteSignals.logo_candidates]), iconCandidates);
    const sourceLogo = logoCandidates[0] || null;
    const sourceIcon = iconCandidates[0] || null;
    const sourceSummary = {
      platform: scrape.platform,
      products: scrape.products.length,
      policies: scrape.policies.length,
      faq: scrape.faq.length,
      markets: scrape.availableMarkets.length,
      contact: Boolean(scrape.contact.email || scrape.contact.phone || scrape.contact.address),
      technologies: siteSignals.technologies,
      brand_colors: siteSignals.brand_colors,
      logo: sourceLogo,
      icon: sourceIcon,
      favicon: sourceIcon,
      logo_candidates: logoCandidates,
      icon_candidates: iconCandidates,
      purpose_clues: siteSignals.purpose_clues,
      social_channels: Object.keys(siteSignals.social_links),
      social_links: siteSignals.social_links,
      page_count: siteSignals.page_count,
      key_pages: siteSignals.key_pages.slice(0, 12),
      top_products: scrape.products.slice(0, 8).map(product => ({ title: product.title, price: product.price, url: product.url })),
      contact_email: scrape.contact.email || '',
      contact_phone: scrape.contact.phone || '',
      site_title: siteSignals.title,
      site_description: siteSignals.description,
      confidence: confidenceScore(scrape),
      final_step: finalStep?.step || 'complete',
      scraped_at: new Date().toISOString(),
    };
    const existingRaw = await getTenantConfig(tenantId, BRAND_PROFILE_KEY);
    let existing: any = {};
    try { existing = existingRaw ? JSON.parse(existingRaw) : {}; } catch {}
    const existingIcon = clean(existing.icon_url, 50000);
    const existingFullLogo = clean(existing.full_logo_url || existing.logo_url, 50000);
    const safeIcon = existingIcon || sourceIcon || '';
    const safeFullLogo =
      existingFullLogo && assetKey(existingFullLogo) !== assetKey(safeIcon)
        ? existingFullLogo
        : sourceLogo || '';
    const brandDraft = {
      ...generatedDraft,
      logo_url: safeFullLogo,
      full_logo_url: safeFullLogo,
      icon_url: safeIcon,
      source_summary: sourceSummary,
      status: 'draft',
      website: url,
    };
    await spendCredits(tenantId, 'brand_scan', 1, 'Analyze business / Brand Data scan', { website: url });
    return Response.json({ ok: true, draft: brandDraft, source_summary: sourceSummary });
  } catch (err) {
    const creditResponse = creditErrorResponse(err);
    if (creditResponse) return creditResponse;
    throw err;
  }
}
