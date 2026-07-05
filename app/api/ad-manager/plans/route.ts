import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { createAdsetPlan, listAdsetPlans } from '@/lib/ad-manager/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  try {
    return Response.json({ plans: await listAdsetPlans(tenantId, { limit: 100 }) });
  } catch (err) {
    console.error('[Ad Manager Plans]', err);
    return Response.json({ error: 'Failed to load plans' }, { status: 500 });
  }
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
    const plan = await createAdsetPlan(tenantId, {
      name: body.name || 'Draft adset plan',
      batchId: body.batch_id || null,
      campaignRefId: body.campaign_ref_id || null,
      planJson: body.plan_json || { adsets: [] },
      reasoning: body.reasoning || 'Draft placeholder plan from dashboard.',
      createdBy: body.actor || tenantId,
    });
    return Response.json({ plan });
  } catch (err) {
    console.error('[Ad Manager Create Plan]', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Failed to create plan' }, { status: 500 });
  }
}
