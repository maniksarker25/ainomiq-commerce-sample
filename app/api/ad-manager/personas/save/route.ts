import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { upsertPersona } from '@/lib/ad-manager/db';

export const dynamic = 'force-dynamic';

function cleanText(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function slug(value: unknown) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 96);
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
    const persona = body.persona && typeof body.persona === 'object' ? body.persona : {};
    const selectedProduct = body.selected_product && typeof body.selected_product === 'object' ? body.selected_product : null;
    const selectedProducts = Array.isArray(body.selected_products) ? body.selected_products : [];
    const code = slug(persona.code || persona.id || persona.name);
    const name = cleanText(persona.name);
    const productKey = cleanText(body.product_key) || slug(selectedProduct?.id || selectedProduct?.url || selectedProduct?.name);
    const saved = await upsertPersona(tenantId, {
      code,
      name,
      description: cleanText(persona.buying_situation || persona.job_to_be_done || persona.why_it_fits),
      angle: cleanText(persona.angle),
      performanceSummary: cleanText(persona.why_it_fits),
      targetingRules: {
        product_key: productKey,
        product_id: cleanText(selectedProduct?.id),
        product_name: cleanText(selectedProduct?.name),
        product_url: cleanText(selectedProduct?.url),
        product_ids: selectedProducts.map((item: any) => cleanText(item?.id)).filter(Boolean),
        product_names: selectedProducts.map((item: any) => cleanText(item?.name)).filter(Boolean),
        product_urls: selectedProducts.map((item: any) => cleanText(item?.url)).filter(Boolean),
        buying_situation: cleanText(persona.buying_situation),
        job_to_be_done: cleanText(persona.job_to_be_done),
        core_problem: cleanText(persona.core_problem),
        desire: cleanText(persona.desire),
        trigger: cleanText(persona.trigger),
        objections: Array.isArray(persona.objections) ? persona.objections.map(cleanText).filter(Boolean) : [],
        proof_needed: Array.isArray(persona.proof_needed) ? persona.proof_needed.map(cleanText).filter(Boolean) : [],
        search_intent: Array.isArray(persona.search_intent) ? persona.search_intent.map(cleanText).filter(Boolean) : [],
        hook: cleanText(persona.hook),
        overlay: cleanText(persona.overlay),
        copy_direction: cleanText(persona.copy_direction),
        targeting_notes: cleanText(persona.targeting_notes),
      },
      actor: tenantId,
    });
    return Response.json({ persona: saved });
  } catch (err) {
    console.error('[Ad Manager Save Persona]', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Failed to save persona' }, { status: 400 });
  }
}
