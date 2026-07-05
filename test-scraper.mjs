// Test the full scraper flow against billiejeansclo.com
const baseUrl = 'https://billiejeansclo.com';

async function test() {
  // 1. Fetch homepage
  console.log('1. Fetching homepage...');
  const html = await (await fetch(baseUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AinomiqBot/1.0)', Accept: 'text/html' },
  })).text();
  console.log('   HTML length:', html.length);

  // 2. Extract storefront token
  const tokenMatch = html.match(/storefrontAccessToken["']\s*:\s*["']([a-f0-9]{32,})["']/i);
  const sfToken = tokenMatch?.[1];
  console.log('2. Storefront token:', sfToken || 'NOT FOUND');

  // 3. Detect default currency
  const currMatch = html.match(/["']currency["']\s*:\s*["']([A-Z]{3})["']/i);
  const defaultCurrency = currMatch?.[1];
  console.log('3. Default currency:', defaultCurrency || 'NOT FOUND');

  // 4. Fetch products.json (first page)
  console.log('4. Fetching products.json...');
  const prodRes = await fetch(baseUrl + '/products.json?limit=250&page=1', {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; AinomiqBot/1.0)' },
  });
  const prodData = await prodRes.json();
  const products = prodData.products || [];
  console.log('   Products found:', products.length);
  if (products.length > 0) {
    console.log('   First product:', products[0].title, '-', products[0].variants?.[0]?.price);
    console.log('   Variants of first:', products[0].variants?.length);
  }

  // 5. Discover markets via Storefront API
  if (!sfToken) {
    console.log('No storefront token found, skipping market detection');
    return;
  }

  console.log('5. Discovering markets...');
  const domain = new URL(baseUrl).hostname;
  const locRes = await fetch(`https://${domain}/api/2024-01/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': sfToken },
    body: JSON.stringify({ query: '{ localization { availableCountries { isoCode currency { isoCode } } } }' }),
  });
  const locData = await locRes.json();
  const countries = locData?.data?.localization?.availableCountries || [];
  console.log('   Total countries:', countries.length);

  // Group by unique currency (skip default)
  const seen = new Set();
  if (defaultCurrency) seen.add(defaultCurrency);
  const unique = [];
  for (const c of countries) {
    const cur = c.currency?.isoCode;
    if (!cur || seen.has(cur)) continue;
    seen.add(cur);
    unique.push({ iso: c.isoCode, currency: cur });
  }
  console.log('   Unique non-default currencies:', unique.length);
  for (const u of unique) console.log('     ', u.iso, '->', u.currency);

  // 6. Fetch prices for each unique currency (just first product)
  console.log('6. Testing per-market prices (first product only)...');
  for (const market of unique) {
    const query = `query @inContext(country: ${market.iso}) { products(first: 1) { edges { node { title variants(first: 1) { edges { node { title price { amount currencyCode } } } } } } } }`;
    const priceRes = await fetch(`https://${domain}/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': sfToken },
      body: JSON.stringify({ query }),
    });
    const priceData = await priceRes.json();
    const p = priceData?.data?.products?.edges?.[0]?.node;
    const v = p?.variants?.edges?.[0]?.node;
    console.log(`   ${market.iso} (${market.currency}): ${v?.price?.amount || '?'} ${v?.price?.currencyCode || '?'}`);
  }

  console.log('\nDone!');
}

test().catch(console.error);
