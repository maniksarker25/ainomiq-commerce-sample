// Webshop scraper - extracts store data from any webshop URL
// Used by: CS onboarding flow

export interface ProductVariant {
  title: string;
  price: string;
  compareAtPrice: string | null;
  sku: string | null;
  available: boolean;
  options: Record<string, string>;
}

export interface MarketPricing {
  currency: string;
  variants: Array<{ title: string; price: string; compareAtPrice: string | null }>;
}

export interface AvailableMarket {
  country: string;
  name: string;
  currency: string;
}

export interface ScrapedProduct {
  title: string;
  price: string;
  image: string | null;
  url: string;
  variants: ProductVariant[];
  marketPrices: MarketPricing[];
}

export interface ScrapedPolicy {
  type: 'returns' | 'shipping' | 'privacy' | 'terms';
  title: string;
  content: string;
  url: string | null;
}

export interface ScrapedContact {
  email: string | null;
  phone: string | null;
  address: string | null;
  emailProvider: string | null;
  mxProvider: string | null;
}

export interface ScrapedStoreInfo {
  name: string | null;
  description: string | null;
  logo: string | null;
  favicon: string | null;
  currency: string | null;
  language: string | null;
  languages: string[];
}

/**
 * Raw webshop snapshot from `scrapeWebshop`. Use this when typing tenant
 * `brand_profile` fields that embed the full crawl (e.g. raw JSON next to AI drafts).
 * Same member layout as {@link ScrapeResult}.
 */
export interface BrandProfileSiteScrape {
  platform: string;
  storeUrl: string;
  storeInfo: ScrapedStoreInfo;
  contact: ScrapedContact;
  products: ScrapedProduct[];
  policies: ScrapedPolicy[];
  shippingCosts: string | null;
  faq: string[];
  availableMarkets: AvailableMarket[];
}

/** Complete payload returned when scrape progress reaches `complete`. */
export interface ScrapeResult extends BrandProfileSiteScrape {}

export type ScrapeStep =
  | { step: 'detecting'; message: 'Detecting platform...' }
  | { step: 'store-info'; message: 'Extracting store information...' }
  | { step: 'products'; message: 'Scraping products...' }
  | { step: 'policies'; message: 'Extracting policies...' }
  | { step: 'contact'; message: 'Finding contact information...' }
  | { step: 'complete'; message: 'Done!'; data: ScrapeResult };

// Normalise URL to have protocol
function normalizeUrl(input: string): string {
  let url = input.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  return url;
}

// Fetch HTML of a page, return empty string on error
async function fetchPage(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AinomiqBot/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  }
}

// Detect platform from HTML and response headers
export function detectPlatform(html: string, url: string): string {
  const lower = html.toLowerCase();
  if (lower.includes('shopify') || lower.includes('cdn.shopify.com') || lower.includes('myshopify.com'))
    return 'shopify';
  if (lower.includes('woocommerce') || lower.includes('wc-block') || lower.includes('wp-content'))
    return 'woocommerce';
  if (lower.includes('magento') || lower.includes('mage-')) return 'magento';
  if (lower.includes('prestashop') || lower.includes('/modules/presta')) return 'prestashop';
  if (lower.includes('bigcommerce')) return 'bigcommerce';
  if (lower.includes('lightspeed') || lower.includes('seoshop')) return 'lightspeed';
  if (lower.includes('squarespace')) return 'squarespace';
  if (lower.includes('wix.com') || lower.includes('wixsite')) return 'wix';
  if (lower.includes('/_next/') || lower.includes('__next')) return 'nextjs';
  if (lower.includes('/_nuxt/') || lower.includes('__nuxt')) return 'nuxt';
  return 'unknown';
}

// Extract meta content by name or property
function metaContent(html: string, attr: string): string | null {
  // Match <meta name="..." content="..."> or <meta property="..." content="...">
  const re = new RegExp(
    `<meta[^>]*(?:name|property)=["']${attr}["'][^>]*content=["']([^"']*)["']`,
    'i',
  );
  const m = html.match(re);
  if (m) return m[1];
  // Also try reversed order (content before name)
  const re2 = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${attr}["']`,
    'i',
  );
  const m2 = html.match(re2);
  return m2 ? m2[1] : null;
}

function extractStoreInfo(html: string, url: string): ScrapedStoreInfo {
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || null;
  const description = metaContent(html, 'description') || metaContent(html, 'og:description');
  const rawLogo = metaContent(html, 'og:image');
  let logo = rawLogo;
  if (logo) {
    if (logo.startsWith('//')) logo = 'https:' + logo;
    else if (!logo.startsWith('http')) {
      const baseOrigin = new URL(url).origin;
      logo = logo.startsWith('/') ? `${baseOrigin}${logo}` : `${baseOrigin}/${logo}`;
    }
  }
  // Extract favicon: try <link rel="icon">, <link rel="shortcut icon">, then fallback
  const faviconMatch = html.match(/<link[^>]*rel=["'](?:shortcut\s+)?icon["'][^>]*href=["']([^"']+)["']/i)
    || html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut\s+)?icon["']/i)
    || html.match(/<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i);
  const baseOrigin = new URL(url).origin;
  let favicon: string | null = faviconMatch?.[1] || null;
  if (favicon) {
    if (favicon.startsWith('//')) favicon = 'https:' + favicon;
    else if (!favicon.startsWith('http')) favicon = favicon.startsWith('/') ? `${baseOrigin}${favicon}` : `${baseOrigin}/${favicon}`;
  }
  // Use Google's favicon service as fallback when the site does not expose one.
  const domain = new URL(url).hostname;
  if (!favicon) favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
  // Try to detect currency from html
  const currencyMatch = html.match(/["']currency["']\s*:\s*["']([A-Z]{3})["']/i)
    || html.match(/data-currency=["']([A-Z]{3})["']/i);
  const langMatch = html.match(/<html[^>]*lang=["']([^"']+)["']/i);

  // Detect all available languages from hreflang tags
  const hreflangMatches = html.matchAll(/<link[^>]*hreflang=["']([^"']+)["'][^>]*/gi);
  const langSet = new Set<string>();
  if (langMatch?.[1]) langSet.add(langMatch[1].split('-')[0].toLowerCase());
  for (const m of hreflangMatches) {
    const code = m[1].toLowerCase();
    if (code !== 'x-default') langSet.add(code.split('-')[0]);
  }

  return {
    name: metaContent(html, 'og:site_name') || title?.split(/[|\-\u2013]/)[0]?.trim() || null,
    description: description?.slice(0, 300) || null,
    logo,
    favicon,
    currency: currencyMatch?.[1] || null,
    language: langMatch?.[1] || null,
    languages: [...langSet],
  };
}

function extractContact(html: string): ScrapedContact {
  // Email: look for mailto: or common email patterns
  const emailMatch = html.match(/mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i)
    || html.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);

  // Phone: look for tel: or common phone patterns
  const phoneMatch = html.match(/tel:([+0-9\s\-().]+)/i)
    || html.match(/((?:\+\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4})/);

  // Address: look for structured data
  const addressMatch = html.match(/"streetAddress"\s*:\s*"([^"]+)"/i);

  return {
    email: emailMatch?.[1]?.trim() || null,
    phone: phoneMatch?.[1]?.trim() || null,
    address: addressMatch?.[1] || null,
    emailProvider: null,
    mxProvider: null,
  };
}

// Detect email provider by querying MX + TXT/SPF records via DNS-over-HTTPS
// Checks MX first, then SPF. If MX points to a hosting/ISP provider but SPF
// includes Google/Microsoft, prefer Google/Microsoft (common setup: hosting DNS
// with Google Workspace for actual email).
// MX host patterns → friendly provider name + whether it's a dedicated email provider
const MX_PROVIDER_PATTERNS: Array<{ pattern: RegExp; name: string; dedicated?: boolean }> = [
  { pattern: /\.google\.com$|\.googlemail\.com$|smtp\.google/i, name: 'Google Workspace', dedicated: true },
  { pattern: /outlook\.com|office365|microsoft/i, name: 'Microsoft 365', dedicated: true },
  { pattern: /yahoodns|yahoo\.com/i, name: 'Yahoo Mail', dedicated: true },
  { pattern: /zoho\.(com|eu)/i, name: 'Zoho Mail', dedicated: true },
  { pattern: /icloud|me\.com/i, name: 'iCloud Mail', dedicated: true },
  { pattern: /fastmail/i, name: 'Fastmail', dedicated: true },
  { pattern: /protonmail|proton\.me/i, name: 'ProtonMail', dedicated: true },
  { pattern: /titan\.email|titanmail/i, name: 'Titan Email', dedicated: true },
  { pattern: /privateemail\.com/i, name: 'Namecheap Private Email' },
  { pattern: /transip/i, name: 'TransIP' },
  { pattern: /hostnet\.nl/i, name: 'Hostnet' },
  { pattern: /one\.com/i, name: 'one.com' },
  { pattern: /hostinger/i, name: 'Hostinger' },
  { pattern: /mimecast/i, name: 'Mimecast' },
  { pattern: /ziggo\.nl/i, name: 'Ziggo' },
  { pattern: /kpnmail|kpn\.com/i, name: 'KPN' },
  { pattern: /strato\.(de|com)/i, name: 'Strato' },
  { pattern: /ovh\.(com|net)/i, name: 'OVH' },
  { pattern: /ionos|1and1/i, name: 'IONOS' },
  { pattern: /namecheap/i, name: 'Namecheap' },
];

async function detectEmailProvider(email: string): Promise<{ provider: string; mxProvider: string | null } | null> {
  try {
    const domain = email.split('@')[1];
    if (!domain) return null;
    const encodedDomain = encodeURIComponent(domain);

    // Well-known consumer domains
    if (domain === 'gmail.com' || domain === 'googlemail.com') return { provider: 'Google Workspace', mxProvider: null };
    if (['outlook.com', 'hotmail.com', 'live.com'].includes(domain)) return { provider: 'Microsoft 365', mxProvider: null };
    if (domain.endsWith('yahoo.com') || domain === 'yahoo.co.uk') return { provider: 'Yahoo Mail', mxProvider: null };

    const [mxRes, txtRes] = await Promise.all([
      fetch(`https://cloudflare-dns.com/dns-query?name=${encodedDomain}&type=MX`, {
        headers: { Accept: 'application/dns-json' },
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`https://cloudflare-dns.com/dns-query?name=${encodedDomain}&type=TXT`, {
        headers: { Accept: 'application/dns-json' },
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    // 1. Check MX records
    let mxMatch: { name: string; dedicated?: boolean } | null = null;
    if (mxRes.ok) {
      const mxData = await mxRes.json();
      const mxHosts = (mxData.Answer || [])
        .filter((r: any) => r.type === 15)
        .map((r: any) => {
          const parts = (r.data || '').split(/\s+/);
          return (parts[1] || parts[0] || '').replace(/\.$/, '').toLowerCase();
        });
      const mxJoined = mxHosts.join(' ');
      for (const { pattern, name, dedicated } of MX_PROVIDER_PATTERNS) {
        if (pattern.test(mxJoined)) { mxMatch = { name, dedicated }; break; }
      }
    }

    // If MX points to a dedicated email provider (Google, Microsoft, etc.), trust it
    if (mxMatch?.dedicated) return { provider: mxMatch.name, mxProvider: null };

    // 2. Check SPF - if MX is a hosting/ISP provider, SPF with Google/Microsoft
    //    means they use that for actual email (common: Hostnet DNS + Google Workspace)
    let spfProvider: string | null = null;
    if (txtRes.ok) {
      const txtData = await txtRes.json();
      const spfRecords = (txtData.Answer || [])
        .filter((r: any) => r.type === 16)
        .map((r: any) => (r.data || '').replace(/^"|"$/g, '').toLowerCase())
        .filter((t: string) => t.startsWith('v=spf1'));
      const spf = spfRecords.join(' ');
      if (spf.includes('include:_spf.google.com')) spfProvider = 'Google Workspace';
      else if (spf.includes('include:spf.protection.outlook.com')) spfProvider = 'Microsoft 365';
    }

    // SPF overrides hosting/ISP MX match (e.g. Hostnet MX + Google SPF → Google)
    // but keep the hosting provider as secondary info
    if (spfProvider) return { provider: spfProvider, mxProvider: mxMatch?.name || null };

    // Fall back to hosting provider from MX
    if (mxMatch) return { provider: mxMatch.name, mxProvider: null };

    return { provider: 'other', mxProvider: null };
  } catch {
    return null;
  }
}

// Extract storefrontAccessToken from Shopify inline JS
function extractStorefrontToken(html: string): string | null {
  const match = html.match(/storefrontAccessToken["']\s*:\s*["']([a-f0-9]{32,})["']/i);
  return match?.[1] || null;
}

// Use Shopify Storefront API to discover available markets (countries + currencies)
interface ShopifyMarketCountry {
  isoCode: string;
  name: string;
  currency: string;
}

async function discoverShopifyMarkets(
  domain: string,
  token: string,
): Promise<ShopifyMarketCountry[]> {
  try {
    const query = `{
      localization {
        availableCountries {
          isoCode
          name
          currency { isoCode }
        }
      }
    }`;
    const res = await fetch(`https://${domain}/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': token,
      },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const countries = data?.data?.localization?.availableCountries || [];
    return countries.map((c: any) => ({
      isoCode: c.isoCode,
      name: c.name,
      currency: c.currency?.isoCode || '',
    }));
  } catch {
    return [];
  }
}

// Group countries by unique currency, picking one representative per currency
function getUniqueCurrencyMarkets(
  countries: ShopifyMarketCountry[],
  defaultCurrency: string | null,
): ShopifyMarketCountry[] {
  const seen = new Set<string>();
  // Skip the default currency (we already have those prices from /products.json)
  if (defaultCurrency) seen.add(defaultCurrency.toUpperCase());
  const result: ShopifyMarketCountry[] = [];
  for (const c of countries) {
    const cur = c.currency.toUpperCase();
    if (!cur || seen.has(cur)) continue;
    seen.add(cur);
    result.push(c);
  }
  return result;
}

// Fetch product prices for a specific country via Storefront API @inContext
async function fetchStorefrontPricesForCountry(
  domain: string,
  token: string,
  countryCode: string,
): Promise<{
  currency: string;
  products: Array<{
    title: string;
    variants: Array<{ title: string; price: string; compareAtPrice: string | null }>;
  }>;
}> {
  const allProducts: Array<{
    title: string;
    variants: Array<{ title: string; price: string; compareAtPrice: string | null }>;
  }> = [];
  let currency = '';
  let cursor: string | null = null;
  try {
    while (true) {
      const afterClause: string = cursor ? `, after: "${cursor}"` : '';
      const query: string = `query @inContext(country: ${countryCode}) {
        products(first: 250${afterClause}) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              title
              variants(first: 100) {
                edges {
                  node {
                    title
                    price { amount currencyCode }
                    compareAtPrice { amount currencyCode }
                  }
                }
              }
            }
          }
        }
      }`;
      const res: Response = await fetch(`https://${domain}/api/2024-01/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': token,
        },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) break;
      const data: any = await res.json();
      const edges = data?.data?.products?.edges || [];
      if (edges.length === 0) break;
      for (const edge of edges) {
        const node = edge.node;
        const variants = (node.variants?.edges || []).map((ve: any) => {
          const v = ve.node;
          if (!currency && v.price?.currencyCode) currency = v.price.currencyCode;
          return {
            title: v.title || 'Default',
            price: v.price?.amount || '',
            compareAtPrice: v.compareAtPrice?.amount || null,
          };
        });
        allProducts.push({ title: node.title || '', variants });
      }
      const pageInfo: any = data?.data?.products?.pageInfo;
      if (!pageInfo?.hasNextPage) break;
      cursor = pageInfo.endCursor;
    }
  } catch { /* stop on error */ }
  return { currency, products: allProducts };
}

// Extract products from Shopify JSON (paginate to get all, include all variants)
// Then enrich with per-market pricing via Storefront API
async function scrapeShopifyProducts(baseUrl: string, homepageHtml: string): Promise<{ products: ScrapedProduct[]; availableMarkets: AvailableMarket[] }> {
  const all: ScrapedProduct[] = [];
  let page = 1;
  try {
    while (true) {
      const res = await fetch(`${baseUrl}/products.json?limit=250&page=${page}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; AinomiqBot/1.0)' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) break;
      const data = await res.json();
      const products = data.products || [];
      if (products.length === 0) break;
      for (const p of products) {
        const variants: ProductVariant[] = (p.variants || []).map((v: any) => {
          const options: Record<string, string> = {};
          if (p.options) {
            for (let i = 0; i < p.options.length; i++) {
              const optName = p.options[i]?.name;
              const optVal = v[`option${i + 1}`];
              if (optName && optVal) options[optName] = optVal;
            }
          }
          return {
            title: v.title || 'Default',
            price: v.price || '',
            compareAtPrice: v.compare_at_price || null,
            sku: v.sku || null,
            available: v.available ?? true,
            options,
          };
        });
        all.push({
          title: p.title || '',
          price: variants[0]?.price || '',
          image: p.images?.[0]?.src || null,
          url: `${baseUrl}/products/${p.handle}`,
          variants,
          marketPrices: [],
        });
      }
      if (products.length < 250) break;
      page++;
    }
  } catch { /* stop on error */ }

  // Detect available markets via Storefront API and fetch regional pricing
  const sfToken = extractStorefrontToken(homepageHtml);
  const availableMarkets: AvailableMarket[] = [];
  if (sfToken && all.length > 0) {
    const domain = new URL(baseUrl).hostname;
    const allCountries = await discoverShopifyMarkets(domain, sfToken);
    // Store all markets for the full list
    for (const c of allCountries) {
      availableMarkets.push({ country: c.isoCode, name: c.name, currency: c.currency });
    }
    // Get the default currency from /products.json prices (already in `all`)
    const defaultCurrency = all[0]?.variants[0]?.price
      ? (homepageHtml.match(/["']currency["']\s*:\s*["']([A-Z]{3})["']/i)?.[1] || null)
      : null;
    const uniqueMarkets = getUniqueCurrencyMarkets(allCountries, defaultCurrency);

    // Fetch pricing for each unique currency (max 10 to avoid rate limits)
    for (const market of uniqueMarkets.slice(0, 10)) {
      const regional = await fetchStorefrontPricesForCountry(domain, sfToken, market.isoCode);
      if (regional.products.length === 0) continue;
      // Match regional prices to our products by title
      for (const product of all) {
        const match = regional.products.find(rp => rp.title === product.title);
        if (match && match.variants.length > 0) {
          product.marketPrices.push({
            currency: regional.currency || market.currency,
            variants: match.variants,
          });
        }
      }
    }
  }

  return { products: all, availableMarkets };
}

// Fallback: extract products from HTML using structured data
function scrapeProductsFromHtml(html: string, baseUrl: string): ScrapedProduct[] {
  const products: ScrapedProduct[] = [];
  // JSON-LD Product data
  const jsonLdBlocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of jsonLdBlocks) {
    try {
      const content = block.replace(/<\/?script[^>]*>/gi, '');
      const data = JSON.parse(content);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item['@type'] === 'Product' || item['@type'] === 'ItemList') {
          if (item['@type'] === 'Product') {
            const offers = Array.isArray(item.offers) ? item.offers : item.offers ? [item.offers] : [];
            const variants: ProductVariant[] = offers.map((o: any) => ({
              title: o.name || 'Default',
              price: o.price || '',
              compareAtPrice: null,
              sku: o.sku || null,
              available: o.availability?.includes('InStock') ?? true,
              options: {},
            }));
            products.push({
              title: item.name || '',
              price: offers[0]?.price || '',
              image: typeof item.image === 'string' ? item.image : item.image?.[0] || null,
              url: item.url || baseUrl,
              variants: variants.length > 0 ? variants : [{ title: 'Default', price: offers[0]?.price || '', compareAtPrice: null, sku: null, available: true, options: {} }],
              marketPrices: [],
            });
          }
          if (item.itemListElement) {
            for (const el of item.itemListElement) {
              if (el.item?.name) {
                products.push({
                  title: el.item.name,
                  price: '',
                  image: el.item.image || null,
                  url: el.item.url || baseUrl,
                  variants: [{ title: 'Default', price: '', compareAtPrice: null, sku: null, available: true, options: {} }],
                  marketPrices: [],
                });
              }
            }
          }
        }
      }
    } catch { /* skip malformed JSON-LD */ }
  }
  return products;
}

// Extract policies by crawling common policy page paths
async function scrapePolicies(baseUrl: string, html: string): Promise<ScrapedPolicy[]> {
  const policies: ScrapedPolicy[] = [];
  const paths: Array<{ type: ScrapedPolicy['type']; paths: string[] }> = [
    { type: 'returns', paths: ['/policies/refund-policy', '/pages/returns', '/pages/return-policy', '/retourbeleid', '/pages/retourbeleid', '/refund-policy'] },
    { type: 'shipping', paths: ['/policies/shipping-policy', '/pages/shipping', '/pages/shipping-policy', '/pages/verzending', '/shipping-policy'] },
    { type: 'privacy', paths: ['/policies/privacy-policy', '/pages/privacy', '/pages/privacy-policy', '/privacy-policy'] },
    { type: 'terms', paths: ['/policies/terms-of-service', '/pages/terms', '/pages/terms-of-service', '/terms-of-service'] },
  ];

  // Also find policy links from the page itself
  const linkMatches = html.matchAll(/href=["']([^"']*(?:policy|return|refund|shipping|verzend|privacy|terms|voorwaarden)[^"']*)["']/gi);
  const foundLinks = new Set<string>();
  for (const m of linkMatches) {
    try {
      const href = m[1];
      if (href.startsWith('http')) foundLinks.add(href);
      else if (href.startsWith('/')) foundLinks.add(baseUrl + href);
    } catch { /* skip bad URLs */ }
  }

  for (const { type, paths: tryPaths } of policies.length < 4 ? paths : []) {
    let found = false;
    for (const path of tryPaths) {
      if (found) break;
      const fullUrl = baseUrl + path;
      const pageHtml = await fetchPage(fullUrl);
      if (!pageHtml || pageHtml.length < 200) continue;
      // Extract main content; try <article>, <main>, or class="page-content"
      const contentMatch = pageHtml.match(/<(?:article|main)[^>]*>([\s\S]*?)<\/(?:article|main)>/i)
        || pageHtml.match(/class=["'][^"']*(?:page-content|rte|entry-content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
      const rawContent = contentMatch?.[1] || '';
      // Strip HTML tags, collapse whitespace
      const text = rawContent
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#\d+;/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 2000);
      if (text.length > 50) {
        policies.push({ type, title: type.charAt(0).toUpperCase() + type.slice(1) + ' Policy', content: text, url: fullUrl });
        found = true;
      }
    }
  }

  return policies;
}

// Extract shipping costs from shipping policy text
function extractShippingCosts(policies: ScrapedPolicy[]): string | null {
  const shipping = policies.find(p => p.type === 'shipping');
  if (!shipping) return null;
  // Look for price patterns like €5.95, $4.99, free shipping, etc.
  const priceMatches = shipping.content.match(/(?:€|EUR|\$|USD|£|GBP)\s?\d+[.,]?\d{0,2}/gi)
    || shipping.content.match(/\b\d+[.,]\d{2}\b/g);
  const freeMatch = shipping.content.match(/(?:free|gratis|kostenlos)\s*(?:shipping|verzending|delivery|levering)/i);
  if (freeMatch) return 'Free shipping available';
  if (priceMatches) return priceMatches.slice(0, 3).join(', ');
  return null;
}

// Extract FAQ items from common FAQ page patterns
function extractFaqFromHtml(html: string): string[] {
  const faqs: string[] = [];
  // JSON-LD FAQPage
  const jsonLdBlocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of jsonLdBlocks) {
    try {
      const content = block.replace(/<\/?script[^>]*>/gi, '');
      const data = JSON.parse(content);
      if (data['@type'] === 'FAQPage' && data.mainEntity) {
        for (const q of data.mainEntity) {
          if (q.name) faqs.push(q.name);
        }
      }
    } catch { /* skip */ }
  }
  return faqs.slice(0, 20);
}

// Main scrape function - yields progress steps via callback
export async function scrapeWebshop(
  rawUrl: string,
  onProgress: (step: ScrapeStep) => void,
): Promise<ScrapeResult> {
  const baseUrl = normalizeUrl(rawUrl);

  // Step 1: Detect platform
  onProgress({ step: 'detecting', message: 'Detecting platform...' });
  const homepageHtml = await fetchPage(baseUrl);
  const platform = detectPlatform(homepageHtml, baseUrl);

  // Step 2: Store info
  onProgress({ step: 'store-info', message: 'Extracting store information...' });
  const storeInfo = extractStoreInfo(homepageHtml, baseUrl);
  const contact = extractContact(homepageHtml);

  // Step 3: Products
  onProgress({ step: 'products', message: 'Scraping products...' });
  let products: ScrapedProduct[] = [];
  let availableMarkets: AvailableMarket[] = [];
  if (platform === 'shopify') {
    const shopifyResult = await scrapeShopifyProducts(baseUrl, homepageHtml);
    products = shopifyResult.products;
    availableMarkets = shopifyResult.availableMarkets;
  }
  if (products.length === 0) {
    products = scrapeProductsFromHtml(homepageHtml, baseUrl);
  }
  // If still no products, try /collections/all for Shopify
  if (products.length === 0 && platform === 'shopify') {
    const collectionsHtml = await fetchPage(`${baseUrl}/collections/all`);
    products = scrapeProductsFromHtml(collectionsHtml, baseUrl);
  }

  // Step 4: Policies
  onProgress({ step: 'policies', message: 'Extracting policies...' });
  const policies = await scrapePolicies(baseUrl, homepageHtml);
  const shippingCosts = extractShippingCosts(policies);

  // Step 5: Contact + FAQ
  onProgress({ step: 'contact', message: 'Finding contact information...' });
  // Try contact page for more info
  const contactPageHtml = await fetchPage(`${baseUrl}/pages/contact`)
    || await fetchPage(`${baseUrl}/contact`);
  if (contactPageHtml) {
    const pageContact = extractContact(contactPageHtml);
    if (!contact.email && pageContact.email) contact.email = pageContact.email;
    if (!contact.phone && pageContact.phone) contact.phone = pageContact.phone;
    if (!contact.address && pageContact.address) contact.address = pageContact.address;
  }
  // Detect email provider via MX records
  if (contact.email) {
    const detected = await detectEmailProvider(contact.email);
    if (detected) {
      contact.emailProvider = detected.provider;
      contact.mxProvider = detected.mxProvider;
    }
  }
  const faq = extractFaqFromHtml(homepageHtml);

  const result: ScrapeResult = {
    platform,
    storeUrl: baseUrl,
    storeInfo,
    contact,
    products,
    policies,
    shippingCosts,
    faq,
    availableMarkets,
  };

  onProgress({ step: 'complete', message: 'Done!', data: result });
  return result;
}
