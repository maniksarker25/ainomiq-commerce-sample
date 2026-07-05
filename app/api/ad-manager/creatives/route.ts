import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { listCreatives } from '@/lib/ad-manager/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  try {
    const batchId = request.nextUrl.searchParams.get('batch_id') || undefined;
    return Response.json({ creatives: await listCreatives(tenantId, { batchId, limit: 100 }) });
  } catch (err) {
    console.error('[Ad Manager Creatives]', err);
    return Response.json({ error: 'Failed to load creatives' }, { status: 500 });
  }
}
