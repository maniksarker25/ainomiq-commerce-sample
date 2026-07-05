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
  catalogItems?: CatalogItem[];
};
type StrategyField = 'sellingPoints' | 'pains' | 'personas' | 'claimBoundaries';

type AutofillResult = {
  explanation: string;
  sellingPoints: string[];
  pains: string[];
  personas: string[];
  claimBoundaries: string[];
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

function uniq(items: string[], limit: number) {
  return Array.from(new Set(items.map(item => clean(item, 120)).filter(Boolean))).slice(0, limit);
}

function hasBadPersona(item: string, productName: string, catalogNames: string[]) {
  const text = clean(item, 200).toLowerCase();
  if (!text) return true;
  if (text.includes('catalog') || text.includes('buyer') && text.includes('signature')) return true;
  if (text.includes('linear') || text.includes('stellar') || text.includes('signature buyer')) return true;
  if (catalogNames.some(name => name && text.includes(name.toLowerCase()))) return true;
  if (productName && text.includes(productName.toLowerCase())) return true;
  return false;
}

function derivePersonas(name: string, text: string) {
  const joined = `${name} ${text}`.toLowerCase();
  const personas = [] as string[];
  if (/waist|gap|belt|jeans|fit|loose/.test(joined)) personas.push('Waist-gap fixer', 'Belt-hater', 'Jeans fit improver', 'Petite fit shopper', 'Outfit detail shopper');
  if (/stretch|comfort|soft|all day|all-day/.test(joined)) personas.push('Comfort-first buyer', 'All-day wear shopper', 'Practical wardrobe buyer', 'Fit-sensitive shopper', 'Easy-style shopper');
  if (/gift|present/.test(joined)) personas.push('Gift buyer', 'Quick gift shopper', 'Style gift buyer', 'Repeat buyer', 'Impulse buyer');
  if (/style|look|outfit|fashion/.test(joined)) personas.push('Style-led buyer', 'Trend-aware shopper', 'Outfit finisher', 'Look upgrader', 'Visual-first buyer');
  if (/problem|issue|fix|solve/.test(joined)) personas.push('Problem-aware shopper', 'Solution seeker', 'Frustrated fit shopper', 'Comparison shopper', 'Quick-decision buyer');
  if (!personas.length) personas.push('Problem-aware shopper', 'Comparison shopper', 'Style-led buyer', 'Quick-decision buyer', 'Product-aware shopper');
  return uniq(personas, 5);
}

function safeJsonParse(raw: string): any {
  const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function normalizeResult(value: any, fallbackName: string, productName: string, catalogNames: string[], pageText: string): AutofillResult {
  const cleanedPains = uniq(Array.isArray(value?.pains) ? value.pains : [], 5);
  const cleanedSellingPoints = uniq(Array.isArray(value?.sellingPoints) ? value.sellingPoints : [], 5);
  const rawPersonas = Array.isArray(value?.personas) ? value.personas : [];
  const filteredPersonas = uniq(rawPersonas.filter((item: string) => !hasBadPersona(item, productName, catalogNames)), 5);
  const personas = filteredPersonas.length >= 3 ? filteredPersonas : derivePersonas(productName, pageText);
  return {
    explanation: clean(value?.explanation, 260) || `Use ${fallbackName} as the hero product. Focus the ad on the clearest real customer problem and benefit found on the product page.`,
    sellingPoints: cleanedSellingPoints.length >= 5 ? cleanedSellingPoints : uniq(['Clear product benefit', 'Product photo as hero', 'Easy ad angle', 'Source-backed proof', 'Strong buying reason'], 5),
    pains: cleanedPains.length >= 5 ? cleanedPains : uniq(['Benefit unclear', 'Customer needs context fast', 'Generic creative underperforms', 'Product not obvious enough', 'Too much visual noise'], 5),
    personas,
    claimBoundaries: uniq(Array.isArray(value?.claimBoundaries) ? value.claimBoundaries : [], 5).length >= 5 ? uniq(Array.isArray(value?.claimBoundaries) ? value.claimBoundaries : [], 5) : uniq(['No unsupported claims', 'No guaranteed results', 'No fake urgency', 'Use source-backed facts only', 'Stay close to visible product proof'], 5),
    why: clean(value?.why, 300) || 'Filled from selected product page context, not generic editor instructions.',
  };
}

async function fetchPageText(url: string) {
  if (!/^https?:\/\//i.test(url)) return '';
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; AinomiqCreativeOS/1.0)',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) return '';
    const html = await response.text();
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
    const description = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]
      || html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1]
      || '';
    const productJson = Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))
      .map(match => clean(match[1], 4000))
      .join(' ');
    return clean([title, description, productJson, html].join(' '), 9000);
  } catch {
    return '';
  }
}

function productContext(product: ProductInput) {
  const items = product.catalogItems?.length ? product.catalogItems : [{ name: product.name, url: product.url, imageUrl: product.imageUrl }];
  return items.slice(0, 6).map(item => ({
    name: clean(item.name, 160),
    url: clean(item.url, 600),
    imageUrl: clean(item.imageUrl, 600),
  })).filter(item => item.name || item.url);
}

function fallbackFromProduct(product: ProductInput, pages: string[]): AutofillResult {
  const name = clean(product.name || product.catalogItems?.[0]?.name || 'selected product', 80);
  const joined = pages.join(' ').toLowerCase();
  const waistGap = /waist|gap|jeans|belt|fit|loose|pin/.test(joined + ' ' + name.toLowerCase());
  if (waistGap) {
    return {
      explanation: `${name} helps make jeans fit cleaner without a bulky belt. Use the selected product photos and focus on the waist-gap fix.`,
      sellingPoints: ['Fixes waist gap', 'No bulky belt needed', 'Keeps jeans looking fitted', 'Small styling accessory', 'Easy outfit upgrade'],
      pains: ['Jeans gap at the waist', 'Belt looks bulky', 'Jeans feel loose', 'Outfit shape looks messy', 'Hard to get a clean fit'],
      personas: ['Waist-gap fixer', 'Jeans outfit shopper', 'Petite fit shopper', 'Festival outfit buyer', 'Trend-led styling buyer'],
      claimBoundaries: ['No guaranteed fit', 'No body-shaming', 'No medical claims', 'No fake urgency', 'Only show visible styling benefits'],
      why: 'Detected jeans/waist/belt context from the selected product page and catalog names.',
    };
  }
  return {
    explanation: `Use ${name} as the hero product. Focus on the clearest visible product benefit from the selected page.`,
    sellingPoints: ['Visible product benefit', 'Clear product photo', 'Simple buying reason', 'Easy ad angle', 'Product-led creative'],
    pains: ['Benefit is unclear', 'Customer needs context fast', 'Generic creative underperforms', 'Product not obvious enough', 'Too much visual noise'],
    personas: derivePersonas(name, joined),
    claimBoundaries: ['No unsupported claims', 'No guaranteed results', 'No fake urgency', 'Use source-backed facts only', 'Stay close to visible product proof'],
    why: 'Product page text was limited, so the fill stayed conservative and source-safe.',
  };
}

function strategyFieldLabel(field: StrategyField) {
  if (field === 'sellingPoints') return 'buying reason / ad angle';
  if (field === 'pains') return 'customer problem / hook idea';
  if (field === 'personas') return 'target persona label';
  return 'claim rule';
}

function fallbackEnhance(field: StrategyField, input: string, product: ProductInput, pages: string[]) {
  const text = clean(input, 120);
  const productName = clean(product.name || product.catalogItems?.[0]?.name || 'this product', 80);
  const joined = `${productName} ${pages.join(' ')} ${text}`.toLowerCase();
  if (!text) return '';
  if (/waist|gap|belt|jeans|loose|fit/.test(joined)) {
    if (field === 'sellingPoints') return 'Fixes waist gap without needing a bulky belt';
    if (field === 'pains') return 'Waist gap in jeans that makes the fit feel loose';
    if (field === 'personas') return 'Jeans wearer with a waist gap';
    return 'Only claim one-click tightening for jeans and waistband use as stated';
  }
  if (field === 'sellingPoints') return `${text} as a clear buying reason for ${productName}`;
  if (field === 'pains') return `${text} as a specific customer problem to solve`;
  if (field === 'personas') return text.length > 24 ? text : `${text} shopper`;
  return text.toLowerCase().startsWith('do not') ? text : `Do not claim ${text} unless supported by the source page`;
}

function looksLikeClaimRule(item: string) {
  return /^(do not|don't|never|avoid|only claim|only say|no guaranteed|no unsupported|must not)\b/i.test(item.trim());
}

function normalizeEnhancedItem(field: StrategyField, item: string, fallbackItem: string) {
  const cleaned = clean(item, 160);
  if (!cleaned) return fallbackItem;
  if (field !== 'claimBoundaries' && looksLikeClaimRule(cleaned)) return fallbackItem;
  if (field === 'claimBoundaries') {
    if (/^(do not|don't|never|avoid|only claim|only say|no )\b/i.test(cleaned)) return cleaned;
    return `Do not claim ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)} unless supported by the source page`;
  }
  return cleaned.replace(/^(buying reason|angle|hook|persona):\s*/i, '').trim() || fallbackItem;
}

export async function POST(request: NextRequest) {
  let body: { tenant_id?: string; product?: ProductInput; enhance?: { field?: StrategyField; input?: string; currentItems?: string[] } } = {};
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  try { await requireAuth(request, body.tenant_id); } catch (err) { return handleAuthError(err); }

  const product = body.product || {};
  const contextItems = productContext(product);
  if (!contextItems.length) return Response.json({ error: 'Select a catalog product first.' }, { status: 400 });

  const pageTexts = await Promise.all(contextItems.map(item => item.url ? fetchPageText(item.url) : Promise.resolve('')));
  const sourceContext = contextItems.map((item, index) => ({ ...item, pageText: pageTexts[index] || '' }));
  const fallback = fallbackFromProduct(product, pageTexts);
  const productName = clean(product.name || contextItems[0]?.name || 'selected product', 80);
  const catalogNames = uniq(contextItems.map(item => item.name), 8);
  const combinedPageText = pageTexts.join(' ');

  if (body.enhance?.field && body.enhance?.input) {
    const field = body.enhance.field;
    const rawInput = clean(body.enhance.input, 180);
    const fallbackItem = fallbackEnhance(field, rawInput, product, pageTexts);
    if (!process.env.OPENAI_API_KEY) return Response.json({ ok: true, source: 'enhance_fallback', item: fallbackItem, why: 'Enhanced conservatively from product context.' });

    const enhancePrompt = `Rewrite one rough Creative OS strategy item into one stronger, product-specific item.

Field type: ${strategyFieldLabel(field)}
Rough input: "${rawInput}"
Existing items to avoid duplicating: ${JSON.stringify((body.enhance.currentItems || []).slice(0, 12))}

Hard field rules:
- If field type is buying reason / ad angle, write a positive reason someone would buy. Never output "Do not...", "Only claim...", "Only say...", or any claim-rule wording.
- If field type is customer problem / hook idea, write the customer's problem/pain. Never output a claim rule.
- If field type is target persona label, write a short shopper/persona label. Never output a claim rule.
- If field type is claim rule, write a safety rule that starts with "Do not..." or "Only...".

General rules:
- Return exactly one item, not a list.
- Keep it short enough for a strategy row.
- Make it specific to the product context.
- Stay source-safe: no guarantees, fake discounts, unsupported durability/comfort/medical/performance claims.

Product context:
${JSON.stringify(sourceContext).slice(0, 12000)}

Return strict JSON: {"item":"...","why":"..."}`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
          temperature: 0.2,
          messages: [
            { role: 'system', content: 'You rewrite rough e-commerce creative strategy notes into one source-safe JSON item.' },
            { role: 'user', content: enhancePrompt },
          ],
          response_format: { type: 'json_object' },
        }),
      });
      if (!response.ok) return Response.json({ ok: true, source: 'enhance_fallback', item: fallbackItem, why: 'Enhanced conservatively from product context.' });
      const data = await response.json();
      const parsed = safeJsonParse(data?.choices?.[0]?.message?.content || '');
      const item = normalizeEnhancedItem(field, parsed?.item, fallbackItem);
      return Response.json({ ok: true, source: 'enhance_ai', item, why: clean(parsed?.why, 220) || 'Enhanced from product context.' });
    } catch {
      return Response.json({ ok: true, source: 'enhance_fallback', item: fallbackItem, why: 'Enhanced conservatively from product context.' });
    }
  }

  if (!process.env.OPENAI_API_KEY) return Response.json({ ok: true, source: 'page_fallback', ...fallback });

  const prompt = `You fill Creative OS product context fields for an e-commerce ad builder. Use ONLY selected catalog product names, URLs, images and fetched product page text. Do not use generic editor workflow language. Do not turn product names into personas. If the product is jeans pins / waist-gap accessory, mention waist gap, bulky belts, loose jeans, cleaner fit when supported by source text or product name.

Return strict JSON:
{
  "explanation": "max 2 short sentences about what the product does for the customer",
  "sellingPoints": ["exactly 5 concrete buying reasons"],
  "pains": ["exactly 5 real customer pains"],
  "personas": ["exactly 5 specific shopper/persona labels, not product names"],
  "claimBoundaries": ["exactly 5 safe claim rules"],
  "why": "1 short sentence explaining what you used and why these fields were filled"
}

Selected product context:
${JSON.stringify(sourceContext).slice(0, 14000)}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: 'You are a precise e-commerce creative strategist. Output only source-grounded JSON.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (!response.ok) return Response.json({ ok: true, source: 'page_fallback', ...fallback });
    const data = await response.json();
    const parsed = safeJsonParse(data?.choices?.[0]?.message?.content || '');
    const normalized = normalizeResult(parsed, productName, productName, catalogNames, combinedPageText);
    return Response.json({ ok: true, source: 'product_pages_ai', ...normalized });
  } catch {
    return Response.json({ ok: true, source: 'page_fallback', ...fallback });
  }
}
