import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { selectCopyVariant } from '@/lib/ad-manager/db';

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
    return Response.json({ copy: await selectCopyVariant(tenantId, id) });
  } catch (err) {
    console.error('[Ad Manager Select Copy]', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Failed to select copy variant' }, { status: 400 });
  }
}
