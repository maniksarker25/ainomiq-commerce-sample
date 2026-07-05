import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

type CatalogItem = { id?: string; name?: string; url?: string; imageUrl?: string };
type ProductInput = {
  id?: string;
  name?: string;
  url?: string;
  imageUrl?: string;
  explanation?: string;
  sellingPoints?: string[];
  pains?: string[];
  personas?: string[];
  claimBoundaries?: string[];
  catalogItems?: CatalogItem[];
};

type BriefFillResult = {
  angle: string;
  hook: string;
  angles: string[];
  hooks: string[];
  notes: string;
  why: string;
};

function clean(value: unknown, max = 1200) {
  return String(value || '')
    .replace(/[\u2013\u2014]/g, ' - ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function safeJsonParse(raw: string): any {
  const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function safeUrl(value: unknown) {
  const raw = clean(value, 800);
  if (!/^https?:\/\//i.test(raw)) return '';
  try {
    const parsed = new URL(raw);
    return parsed.toString();
  } catch {
    return '';
  }
}

function rootUrl(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return '';
  }
}

async function fetchText(url: string, max = 9000) {
  if (!url) return '';
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; AinomiqCreativeOS/1.0; +https://app.ainomiq.com)',
        accept: 'text/html,application/json,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return '';
    const text = await response.text();
    const title = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
    const description = text.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]
      || text.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1]
      || '';
    const jsonLd = Array.from(text.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))
      .map(match => clean(match[1], 2500))
      .join(' ');
    return clean([title, description, jsonLd, text].join(' '), max);
  } catch {
    return '';
  }
}

async function fetchShopifyCatalog(url: string, productName: string) {
  const root = rootUrl(url);
  if (!root) return '';
  try {
    const response = await fetch(`${root}/products.json?limit=80`, {
      cache: 'no-store',
      headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 (compatible; AinomiqCreativeOS/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return '';
    const data = await response.json();
    const products = Array.isArray(data?.products) ? data.products : [];
    const nameTokens = clean(productName, 120).toLowerCase().split(/\s+/).filter(token => token.length > 2);
    const matches = products
      .filter((product: any) => {
        const title = clean(product?.title, 160).toLowerCase();
        return !nameTokens.length || nameTokens.some(token => title.includes(token));
      })
      .slice(0, 8)
      .map((product: any) => ({
        title: clean(product?.title, 180),
        type: clean(product?.product_type, 100),
        tags: Array.isArray(product?.tags) ? product.tags.slice(0, 12) : [],
        body: clean(product?.body_html, 800),
      }));
    return clean(JSON.stringify(matches), 5000);
  } catch {
    return '';
  }
}

async function fetchSearchSnippets(productName: string, url: string) {
  const root = rootUrl(url);
  if (!productName || !root) return '';
  const domain = new URL(root).hostname.replace(/^www\./, '');
  const query = encodeURIComponent(`"${productName}" ${domain} reviews OR product`);
  try {
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
      cache: 'no-store',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; AinomiqCreativeOS/1.0)', accept: 'text/html' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return '';
    return clean(await response.text(), 5000);
  } catch {
    return '';
  }
}

function productItems(product: ProductInput) {
  const items = product.catalogItems?.length ? product.catalogItems : [{ name: product.name, url: product.url, imageUrl: product.imageUrl }];
  return items.slice(0, 6).map(item => ({
    name: clean(item.name || product.name, 160),
    url: safeUrl(item.url || product.url),
    imageUrl: clean(item.imageUrl || product.imageUrl, 800),
  })).filter(item => item.name || item.url);
}

function personaContextLine(personas: string[]) {
  const cleaned = personas.map(persona => clean(persona, 90)).filter(Boolean);
  if (!cleaned.length) return '';
  if (cleaned.length === 1) return cleaned[0];
  return cleaned.slice(0, 3).join(' + ');
}

function personaMentionsGift(personas: string[]) {
  return personas.some(persona => /gift|present|surprise|for someone|perfect gift|birthday|christmas|holiday/i.test(clean(persona, 140)));
}

function ensureGiftPersonaBrief(result: BriefFillResult, giftIntent: boolean): BriefFillResult {
  if (!giftIntent) return result;
  const giftHooks = [
    'Looking for a gift?',
    'Need a useful gift for someone who wears jeans?',
    'Want a small gift they will actually use?',
  ];
  const hasGiftHook = result.hooks.some(hook => /gift|present|someone/i.test(hook));
  const hooks = hasGiftHook ? result.hooks : [...giftHooks, ...result.hooks].slice(0, 10);
  return {
    ...result,
    hook: /gift|present|someone/i.test(result.hook) ? result.hook : hooks[0],
    angles: result.angles.some(angle => /gift|present|someone/i.test(angle))
      ? result.angles
      : [
          'Giftable fix for loose jeans without belt bulk',
          'Small practical gift for someone who wears jeans',
          ...result.angles,
        ].slice(0, 8),
    hooks,
    notes: `${result.notes} For gift personas, open with the gifting moment before moving into the waist-fit problem.`,
  };
}

function fallbackBrief(product: ProductInput, sourceText: string, personas: string[] = []): BriefFillResult {
  const name = clean(product.name || product.catalogItems?.[0]?.name || 'Selected product', 90);
  const personaLine = personaContextLine(personas);
  const giftIntent = personaMentionsGift(personas);
  const text = `${name} ${sourceText} ${(product.sellingPoints || []).join(' ')} ${(product.pains || []).join(' ')}`.toLowerCase();
  if (/waist|gap|jeans|belt|pin|loose|fit/.test(text)) {
    return ensureGiftPersonaBrief({
      angle: giftIntent ? 'Giftable fix for loose jeans' : 'Waist gap fix without belt bulk',
      hook: giftIntent
        ? 'Looking for a gift?'
        : personaLine ? `${personaLine}: loose at the waist?` : 'Your jeans can fit cleaner in seconds',
      angles: [
        ...(giftIntent ? [
          'Giftable fix for a loose waist without adding belt bulk',
          'Practical denim gift for someone who skips bulky belts',
        ] : []),
        'Fix the waist gap without adding belt bulk',
        'Keep favorite jeans in rotation when the waist feels loose',
        'Clean up the waistband while keeping the outfit minimal',
        'Tighten jeans that fit everywhere except the waist',
        'Use a flat clip instead of a bulky belt workaround',
      ],
      hooks: [
        ...(giftIntent ? [
          'Looking for a gift?',
          'Need a useful gift for someone who wears jeans?',
        ] : []),
        personaLine && !giftIntent ? 'Jeans loose at the waist again?' : 'Your jeans can fit cleaner in seconds',
        'Love the jeans, hate the waistband gap?',
        'Skip the belt bulk on your best jeans.',
        'When the jeans work everywhere except the waist.',
        'A cleaner waistline without adding a belt.',
      ],
      notes: personaLine
        ? `Write for ${personaLine}. Show the selected product on real jeans and connect the waist-gap problem to that person's styling situation. Do not promise a perfect fit for every body.`
        : 'Show the selected product on real jeans. Focus on waist gap, cleaner fit and avoiding bulky belts. Do not promise a perfect fit for every body.',
      why: personaLine
        ? `Built from selected persona "${personaLine}" plus jeans, waist, belt and fit signals found in product context.`
        : 'Built from jeans, waist, belt and fit signals found in the selected product context.',
    }, giftIntent);
  }
  const point = clean(product.sellingPoints?.[0] || product.explanation || name, 80);
  const pain = clean(product.pains?.[0] || 'Customer needs the product benefit fast', 80);
  return ensureGiftPersonaBrief({
    angle: point || `Why ${name} is useful`,
    hook: giftIntent ? 'Looking for a gift?' : pain.includes('Customer needs') ? `Make ${name} obvious in 3 seconds` : pain,
    angles: [
      ...(giftIntent ? [`Giftable ${name} for someone hard to buy for`] : []),
      point || `Why ${name} is useful`,
      personaLine ? `Show ${name} in a ${personaLine.toLowerCase()} moment` : `Show ${name} in use`,
      'Problem-solution close-up',
      'Product benefit demonstration',
      'Simple before context',
    ],
    hooks: [
      ...(giftIntent ? ['Looking for a gift?', 'Need a useful gift idea?'] : []),
      pain.includes('Customer needs') ? `Make ${name} obvious in 3 seconds` : pain,
      personaLine ? `For ${personaLine}, this is the moment.` : `Here is what ${name} changes`,
      'Show the problem before the product.',
      'Make the benefit visible fast.',
      'Keep the product as the hero.',
    ],
    notes: personaLine
      ? `Use the selected product as the visual hero, but write the concept for ${personaLine}. Keep the promise source-backed and avoid claims not present in the product context.`
      : 'Use the selected product as the visual hero. Keep the promise source-backed and avoid claims not present in the product context.',
    why: personaLine
      ? `Product page text was limited, so the brief used selected persona "${personaLine}" conservatively with source-safe product context.`
      : 'Product page text was limited, so the brief stayed conservative and source-safe.',
  }, giftIntent);
}

function normalizeList(value: unknown, fallback: string[], max: number) {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/\n|;/) : [];
  const cleaned = raw.map(item => clean(item, 150)).filter(Boolean);
  return Array.from(new Set(cleaned.length ? cleaned : fallback)).slice(0, max);
}

function stripPersonaPrefix(value: string, personas: string[]) {
  let next = clean(value, 150);
  for (const persona of personas) {
    const label = clean(persona, 90).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!label) continue;
    next = next.replace(new RegExp(`^${label}\\s*[:\\-]\\s*`, 'i'), '').trim();
  }
  return next;
}

function normalizeBrief(value: any, fallback: BriefFillResult, personas: string[] = []): BriefFillResult {
  const giftIntent = personaMentionsGift(personas);
  const angles = normalizeList(value?.angles, fallback.angles || [fallback.angle], 8).map(item => stripPersonaPrefix(item, personas)).filter(Boolean);
  const hooks = normalizeList(value?.hooks, fallback.hooks || [fallback.hook], 10).map(item => stripPersonaPrefix(item, personas)).filter(Boolean);
  return ensureGiftPersonaBrief({
    angle: stripPersonaPrefix(clean(value?.angle, 100), personas) || angles[0] || fallback.angle,
    hook: stripPersonaPrefix(clean(value?.hook, 120), personas) || hooks[0] || fallback.hook,
    angles,
    hooks,
    notes: clean(value?.notes, 420) || fallback.notes,
    why: clean(value?.why, 260) || fallback.why,
  }, giftIntent);
}

export async function POST(request: NextRequest) {
  let body: { tenant_id?: string; product?: ProductInput; format?: string; sourceName?: string; mode?: string; angles?: string[]; hooks?: string[]; personas?: string[] } = {};
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  try { await requireAuth(request, body.tenant_id); } catch (err) { return handleAuthError(err); }

  const product = body.product || {};
  const items = productItems(product);
  if (!items.length) return Response.json({ error: 'Select a product first.' }, { status: 400 });

  const pageTexts = await Promise.all(items.map(item => item.url ? fetchText(item.url) : Promise.resolve('')));
  const homeTexts = await Promise.all(Array.from(new Set(items.map(item => rootUrl(item.url)).filter(Boolean))).slice(0, 2).map(url => fetchText(url, 4000)));
  const shopifyTexts = await Promise.all(items.map(item => item.url ? fetchShopifyCatalog(item.url, item.name || clean(product.name, 120)) : Promise.resolve('')));
  const searchTexts = await Promise.all(items.slice(0, 2).map(item => item.url ? fetchSearchSnippets(item.name || clean(product.name, 120), item.url) : Promise.resolve('')));
  const sourceText = [...pageTexts, ...homeTexts, ...shopifyTexts, ...searchTexts].join(' ');
  const selectedPersonas = Array.isArray(body.personas) ? body.personas.slice(0, 8).map(item => clean(item, 120)).filter(Boolean) : [];
  const fallback = fallbackBrief(product, sourceText, selectedPersonas);

  if (!process.env.OPENAI_API_KEY) return Response.json({ ok: true, source: 'scrape_fallback', ...fallback });

  const context = {
    selectedProduct: {
      name: clean(product.name, 160),
      explanation: clean(product.explanation, 400),
      sellingPoints: Array.isArray(product.sellingPoints) ? product.sellingPoints.slice(0, 8).map(item => clean(item, 120)) : [],
      pains: Array.isArray(product.pains) ? product.pains.slice(0, 8).map(item => clean(item, 120)) : [],
      personas: Array.isArray(product.personas) ? product.personas.slice(0, 8).map(item => clean(item, 120)) : [],
      claimBoundaries: Array.isArray(product.claimBoundaries) ? product.claimBoundaries.slice(0, 8).map(item => clean(item, 120)) : [],
    },
    selectedPersonas,
    selectedItems: items.map((item, index) => ({
      ...item,
      pageText: pageTexts[index] || '',
      shopifyCatalogMatch: shopifyTexts[index] || '',
    })),
    homepageText: homeTexts.join(' '),
    publicSearchSnippets: searchTexts.join(' '),
    requestedFormat: clean(body.format, 80),
    selectedSourceName: clean(body.sourceName, 140),
    requestedMode: body.mode === 'notes' ? 'notes' : 'full_brief',
    currentAngles: Array.isArray(body.angles) ? body.angles.slice(0, 8).map(item => clean(item, 120)).filter(Boolean) : [],
    currentHooks: Array.isArray(body.hooks) ? body.hooks.slice(0, 10).map(item => clean(item, 120)).filter(Boolean) : [],
  };

  const prompt = `Fill one Creative OS ad brief. Return only JSON:
{
  "angle": "one specific product-backed angle, max 12 words",
  "hook": "one concrete first-line hook, max 14 words",
  "angles": ["6-8 distinct persona-led creative directions"],
  "hooks": ["8-10 concrete first-line hooks editors can actually use"],
  "notes": "short production notes, max 3 sentences",
  "why": "what evidence you used, max 1 sentence"
}

Rules:
- No generic marketing bullshit.
- Base angle and hook on selected product evidence: product page, homepage, Shopify catalog match, and public search snippets.
- If evidence is thin, say less and stay conservative.
- Do not invent discounts, guarantees, medical claims, review counts, shipping claims, or before/after results.
- If selected product is jeans pins / waist gap accessory, prioritize real angles around waist gap, loose jeans, bulky belts, cleaner fit, outfit styling.
- If selectedPersonas are provided, the selected persona is the brief lens, not a side note.
- If selectedPersonas are provided, ignore unselected personas from selectedProduct.personas. Do not blend in other catalog personas.
- With selectedPersonas, every angle and hook must clearly connect the product benefit to that person's situation, taste, problem, or buying reason.
- With selectedPersonas, do not output broad product-only angles like "one-click waistband tightening" unless the line also says why that persona cares.
- Do not prefix lines with the persona name. Bad: "Jeans wearer with a waist gap: ...". Good: "Fix the waist gap without adding belt bulk".
- Each angle must be a clean, standalone creative direction. It should not be a long sentence, and it must not be cut off.
- For multiple selectedPersonas, cover the personas across the list instead of writing one generic list for everyone.
- Write angles as brief directions for the editor: problem/desire + source-backed product role, informed by the persona.
- Write hooks as ad openings that sound like they are speaking to that persona.
- If the selected persona mentions waist gap, loose waist, or jeans fit, every angle must mention waist gap, loose waist, waistband, jeans fit, or belt bulk. Do not write subtle-accessory/minimal-style angles unless that selected persona explicitly asks for subtle accessories or minimalist styling.
- If the selected persona mentions gift, present, buying for someone, or looking for the perfect gift, lead with the gifting job-to-be-done before the product feature. Hooks should sound like gift-searcher openings, e.g. "Looking for a gift?" or "Need a useful gift for someone who wears jeans?".
- For gift personas, angles should position the product as a small, useful, source-backed gift, then connect it to the actual product problem. Do not only write wearer-problem hooks.
- Bad angle for waist-gap persona: "Use a minimal accessory instead of a bulky belt". Better: "Fix the waist gap without adding belt bulk".
- Make the hook usable as ad opening copy, not a label.
- If requestedMode is "notes", prioritize the notes field and write editor-ready extra brief direction based on the current angles/hooks. Still return all JSON keys.

Context:
${JSON.stringify(context).slice(0, 18000)}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
        temperature: 0.15,
        messages: [
          { role: 'system', content: 'You are a source-grounded direct-response creative strategist. Output only valid JSON.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (!response.ok) return Response.json({ ok: true, source: 'scrape_fallback', ...fallback });
    const data = await response.json();
    const parsed = safeJsonParse(data?.choices?.[0]?.message?.content || '');
    return Response.json({ ok: true, source: 'scrape_ai', ...normalizeBrief(parsed, fallback, selectedPersonas) });
  } catch {
    return Response.json({ ok: true, source: 'scrape_fallback', ...fallback });
  }
}
