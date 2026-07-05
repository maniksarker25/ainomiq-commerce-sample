import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { addCredits, BILLING_PLANS, CREDIT_COSTS, getCreditAccount, setBillingPlan, type BillingPlanId } from '@/lib/credits';
import { SHOPIFY_CONNECTOR_FREE_NOTICE } from '@/lib/shopify-oauth';

export const dynamic = 'force-dynamic';

const TOP_UP_PACKS = [
  { id: 'small', credits: 100, price: 19 },
  { id: 'studio', credits: 500, price: 79 },
  { id: 'scale', credits: 1200, price: 169 },
];

export async function GET(request: NextRequest) {
  let tenantId: string;
  try { tenantId = await requireAuth(request); } catch (err) { return handleAuthError(err); }
  const account = await getCreditAccount(tenantId);
  return Response.json({
    account,
    plans: Object.values(BILLING_PLANS),
    costs: CREDIT_COSTS,
    topUps: TOP_UP_PACKS,
    billing_scope: 'ainomiq_platform_nomi',
    shopify_app_billing: 'free_connector',
    billing_notice: SHOPIFY_CONNECTOR_FREE_NOTICE,
  });
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

  const action = String(body.action || '').trim();
  if (action === 'set_plan') {
    const planId = String(body.plan_id || '') as BillingPlanId;
    if (!BILLING_PLANS[planId]) return Response.json({ error: 'Unknown plan' }, { status: 400 });
    const account = await setBillingPlan(tenantId, planId);
    return Response.json({ ok: true, account, plans: Object.values(BILLING_PLANS), costs: CREDIT_COSTS, topUps: TOP_UP_PACKS });
  }

  if (action === 'top_up') {
    const pack = TOP_UP_PACKS.find(item => item.id === String(body.pack_id || ''));
    if (!pack) return Response.json({ error: 'Unknown top-up pack' }, { status: 400 });
    const account = await addCredits(tenantId, pack.credits, `${pack.credits} Nomi top-up`);
    return Response.json({
      ok: true,
      pending_payment: false,
      account,
      pack,
      top_up: { credits: pack.credits, price: pack.price },
      plans: Object.values(BILLING_PLANS),
      costs: CREDIT_COSTS,
      topUps: TOP_UP_PACKS,
    });
  }

  return Response.json({ error: 'Unknown billing action' }, { status: 400 });
}
