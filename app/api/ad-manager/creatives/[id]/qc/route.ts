import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { updateCreativeQcStatus } from '@/lib/ad-manager/db';

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
    const creative = await updateCreativeQcStatus(tenantId, id, {
      status: body.status,
      reviewer: body.actor || tenantId,
      feedback: body.feedback,
      rejectionReason: body.rejection_reason,
      finalAssetUrl: body.final_asset_url,
    });
    return Response.json({ creative });
  } catch (err) {
    console.error('[Ad Manager QC]', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Failed to update QC status' }, { status: 400 });
  }
}
