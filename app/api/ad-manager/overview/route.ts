import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { getAdManagerOverview } from '@/lib/ad-manager/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  try {
    return Response.json(await getAdManagerOverview(tenantId));
  } catch (err) {
    console.error('[Ad Manager Overview]', err);
    return Response.json({ error: 'Failed to load Logic Ads overview' }, { status: 500 });
  }
}
