import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { approveAdsetPlan } from '@/lib/ad-manager/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let body: any;
  let tenantId: string;
  try {
    body = await request.json();
    tenantId = await requireAuth(request, body.tenant_id);
  } catch (err) {
    return handleAuthError(err);
  }

  try {
    const { id } = await params;
    return Response.json({ plan: await approveAdsetPlan(tenantId, id, body.actor || tenantId) });
  } catch (err) {
    console.error('[Ad Manager Approve Plan]', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Failed to approve plan' }, { status: 400 });
  }
}
