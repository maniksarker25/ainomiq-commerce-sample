import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { creditErrorResponse, spendCredits } from '@/lib/credits';

export const dynamic = 'force-dynamic';

function cleanText(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function slug(value: unknown) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 72);
}

function clampCount(value: unknown) {
  const count = Number(value);
  if (!Number.isFinite(count)) return 4;
  return Math.min(Math.max(Math.round(count), 1), 6);
}

function firstSelectedProduct(body: any) {
  const selected = Array.isArray(body.selected_products) && body.selected_products.length
    ? body.selected_products[0]
    : body.selected_product;
  return selected && typeof selected === 'object' ? selected : null;
}

function productNameFrom(body: any) {
  const selected = firstSelectedProduct(body);
  return cleanText(body.product_name) || cleanText(selected?.name) || cleanText(body.product_url) || 'Selected product';
}

function buildPersonaSeed(productName: string, productDescription: string) {
  const context = productDescription || `${productName} product page and catalog context`;
  return [
    {
      code: 'problem-aware',
      name: 'Problem-aware buyer',
      situation: 'They notice a repeated problem and want a practical fix before buying.',
      problem: `They are not sure ${productName} will solve the real daily-use problem.`,
      desire: 'A clear before-and-after reason to click.',
      trigger: 'A visual moment showing the problem in use.',
      angle: `Show the exact problem ${productName} solves`,
      hook: 'Still dealing with this?',
      overlay: `The simple fix for ${productName}`,
      copy: `Call out the problem, show ${productName} solving it fast, then invite them to see the product.`,
      proof: ['Before and after visual', 'Clear product use case', 'Simple benefit proof'],
    },
    {
      code: 'style-led',
      name: 'Style-led shopper',
      situation: 'They browse visually and click when the product feels like an easy upgrade.',
      problem: `They need to imagine how ${productName} fits their style.`,
      desire: 'A product that feels instantly more polished.',
      trigger: 'A clean lifestyle or outfit-led visual.',
      angle: `Make ${productName} feel like the easiest style upgrade`,
      hook: 'Small detail. Big difference.',
      overlay: `${productName} makes the look`,
      copy: `Lead with the visual transformation and position ${productName} as an easy upgrade.`,
      proof: ['Lifestyle image', 'Close-up detail', 'Style context'],
    },
    {
      code: 'proof-seeker',
      name: 'Proof seeker',
      situation: 'They like the product but need enough clarity to trust the click.',
      problem: `They are unsure why ${productName} is worth choosing now.`,
      desire: 'Specific product reasons and low-pressure proof.',
      trigger: 'A concise list of benefits or social proof.',
      angle: `Explain why ${productName} is worth clicking now`,
      hook: 'Why people choose this one',
      overlay: `See why ${productName} works`,
      copy: `Use clear benefits from the source page and keep the CTA low-pressure.`,
      proof: ['Benefit list', 'Review or quality cue', 'Shipping or guarantee cue'],
    },
    {
      code: 'impulse-clicker',
      name: 'Impulse clicker',
      situation: 'They are mobile-first and respond to fast, obvious desire.',
      problem: `They will scroll past ${productName} unless the value is instant.`,
      desire: 'A quick reason to want it now.',
      trigger: 'A first-second product payoff.',
      angle: `Make ${productName} feel instantly useful and easy to want`,
      hook: 'This is the detail you notice first',
      overlay: `Instant upgrade with ${productName}`,
      copy: 'Keep the message short, visual and action-led.',
      proof: ['Strong first frame', 'Simple CTA', 'Visible product benefit'],
    },
    {
      code: 'collection-browser',
      name: 'Collection browser',
      situation: 'They want to compare options before picking one.',
      problem: `They need help finding the right ${productName} option.`,
      desire: 'A guided browsing reason.',
      trigger: 'A product set or collection angle.',
      angle: `Show how ${productName} fits into a broader product story`,
      hook: 'Find the one that fits your style',
      overlay: `Explore ${productName}`,
      copy: 'Invite the customer to browse with a clean benefit-led reason to click.',
      proof: ['Collection variety', 'Multiple styles', 'Product comparison'],
    },
    {
      code: 'before-after',
      name: 'Before and after buyer',
      situation: 'They need to see the transformation immediately.',
      problem: `They do not yet see the difference ${productName} makes.`,
      desire: 'A visible change that feels obvious.',
      trigger: 'A contrast creative.',
      angle: `Show the moment before ${productName} and the better moment after`,
      hook: 'Before this. After this.',
      overlay: 'The change is obvious',
      copy: 'Frame the creative around contrast: old situation first, improved result second.',
      proof: ['Before state', 'After state', 'Side-by-side visual'],
    },
  ].map(item => ({ ...item, context }));
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

  try {
    const selected = firstSelectedProduct(body);
    const selectedProducts = Array.isArray(body.selected_products) ? body.selected_products : (selected ? [selected] : []);
    const productName = productNameFrom(body);
    const productDescription = cleanText(body.product_description || body.persona_prompt);
    const productUrl = cleanText(body.product_url || selected?.url);
    const count = clampCount(body.persona_count);
    await spendCredits(tenantId, 'ai_personas', 1, `Build ${count} ad personas`, { persona_count: count });
    const productKey = slug(selected?.id || selected?.url || productUrl || productName);
    const seeds = buildPersonaSeed(productName, productDescription).slice(0, count);
    const personas = seeds.map((seed, index) => ({
      id: `${productKey || 'product'}-${seed.code}`,
      code: `${productKey || 'product'}-${seed.code}`,
      name: seed.name,
      buying_situation: seed.situation,
      job_to_be_done: `Find out if ${productName} is right for them and worth clicking through.`,
      core_problem: seed.problem,
      desire: seed.desire,
      trigger: seed.trigger,
      objections: ['Will this work for me?', 'Is it worth the price?', 'Can I trust the store?'],
      proof_needed: seed.proof,
      search_intent: [productName, seed.angle, productDescription].filter(Boolean).slice(0, 3),
      angle: seed.angle,
      hook: seed.hook,
      overlay: seed.overlay,
      copy_direction: seed.copy,
      targeting_notes: `Use this as buying-reason ad set ${index + 1}. Keep creative and copy tied to: ${seed.context}.`,
      why_it_fits: `Built from ${productName}${productDescription ? ` and the supplied product context` : ''}.`,
    }));

    return Response.json({
      ok: true,
      saved: 0,
      auto_saved: false,
      product_key: productKey,
      selected_product: selected,
      selected_products: selectedProducts,
      summary: `Built ${personas.length} buying-reason personas for ${productName}.`,
      research_basis: [
        productName,
        productDescription || 'Catalog/product context',
        productUrl || '',
      ].filter(Boolean),
      product_use: productDescription || `Customer is considering ${productName}.`,
      customer_issues: Array.from(new Set(personas.map(persona => persona.core_problem))),
      purchase_motivations: Array.from(new Set(personas.map(persona => persona.desire))),
      scrape: { attempted: false, ok: false, products: selectedProducts.length, faq: 0, policies: 0 },
      personas,
    });
  } catch (err) {
    const creditResponse = creditErrorResponse(err);
    if (creditResponse) return creditResponse;
    console.error('[Ad Manager Build Personas]', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Failed to build personas' }, { status: 400 });
  }
}
