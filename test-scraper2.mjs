// Test policies and contact extraction for billiejeansclo.com
const baseUrl = 'https://billiejeansclo.com';

async function fetchPage(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AinomiqBot/1.0)', Accept: 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { status: res.status, html: '' };
    return { status: res.status, html: await res.text() };
  } catch (e) {
    return { status: 0, html: '' };
  }
}

async function test() {
  // 1. Test policy pages
  console.log('=== POLICIES ===');
  const policyPaths = [
    { type: 'returns', paths: ['/policies/refund-policy', '/pages/returns', '/pages/return-policy'] },
    { type: 'shipping', paths: ['/policies/shipping-policy', '/pages/shipping', '/pages/shipping-policy'] },
    { type: 'privacy', paths: ['/policies/privacy-policy', '/pages/privacy', '/pages/privacy-policy'] },
    { type: 'terms', paths: ['/policies/terms-of-service', '/pages/terms', '/pages/terms-of-service'] },
  ];

  for (const { type, paths } of policyPaths) {
    let found = false;
    for (const path of paths) {
      const { status, html } = await fetchPage(baseUrl + path);
      if (status === 200 && html.length > 200) {
        // Extract text content
        const contentMatch = html.match(/<(?:article|main)[^>]*>([\s\S]*?)<\/(?:article|main)>/i)
          || html.match(/class=["'][^"']*(?:page-content|rte|entry-content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
        const rawContent = contentMatch?.[1] || '';
        const text = rawContent
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        console.log(`${type}: FOUND at ${path} (${text.length} chars)`);
        if (text.length > 0) console.log(`  Preview: ${text.slice(0, 150)}...`);
        found = true;
        break;
      } else {
        console.log(`  ${path}: ${status}`);
      }
    }
    if (!found) console.log(`${type}: NOT FOUND`);
  }

  // 2. Test contact extraction
  console.log('\n=== CONTACT ===');
  const homepageRes = await fetchPage(baseUrl);
  const html = homepageRes.html;

  // Email
  const emailMatch = html.match(/mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i);
  console.log('Email from homepage:', emailMatch?.[1] || 'NOT FOUND');

  // Try contact page
  const contactRes = await fetchPage(baseUrl + '/pages/contact');
  if (contactRes.html) {
    const contactEmail = contactRes.html.match(/mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i);
    console.log('Email from /pages/contact:', contactEmail?.[1] || 'NOT FOUND');
    // Also try general email pattern
    const generalEmail = contactRes.html.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
    console.log('General email pattern:', generalEmail?.[1] || 'NOT FOUND');
  } else {
    console.log('Contact page: NOT FOUND');
  }

  // Phone
  const phoneMatch = html.match(/tel:([+0-9\s\-().]+)/i);
  console.log('Phone:', phoneMatch?.[1] || 'NOT FOUND');

  // Address
  const addressMatch = html.match(/"streetAddress"\s*:\s*"([^"]+)"/i);
  console.log('Address:', addressMatch?.[1] || 'NOT FOUND');

  // 3. Test FAQ
  console.log('\n=== FAQ ===');
  const jsonLdBlocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  console.log('JSON-LD blocks found:', jsonLdBlocks.length);
  for (const block of jsonLdBlocks) {
    try {
      const content = block.replace(/<\/?script[^>]*>/gi, '');
      const data = JSON.parse(content);
      console.log('  Type:', data['@type'] || 'unknown');
    } catch {}
  }

  console.log('\nDone!');
}

test().catch(console.error);
