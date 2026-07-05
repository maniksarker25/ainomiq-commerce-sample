import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { archiveCreativeLibraryAsset, getCreativeLibraryAsset, updateCreativeLibraryAsset } from '@/lib/ad-manager/db';

export const dynamic = 'force-dynamic';

function assetPatchFromBody(body: any) {
  return {
    name: body.name,
    type: body.type,
    status: body.status,
    sourceType: body.source_type ?? body.sourceType,
    assetUrl: body.asset_url ?? body.assetUrl,
    thumbnailUrl: body.thumbnail_url ?? body.thumbnailUrl,
    fileName: body.file_name ?? body.fileName,
    mimeType: body.mime_type ?? body.mimeType,
    fileSize: body.file_size ?? body.fileSize,
    width: body.width,
    height: body.height,
    durationSeconds: body.duration_seconds ?? body.durationSeconds,
    ratio: body.ratio,
    productId: body.product_id ?? body.productId,
    productName: body.product_name ?? body.productName,
    productUrl: body.product_url ?? body.productUrl,
    personaId: body.persona_id ?? body.personaId,
    personaName: body.persona_name ?? body.personaName,
    campaignId: body.campaign_id ?? body.campaignId,
    tags: body.tags,
    notes: body.notes,
    copyHint: body.copy_hint ?? body.copyHint,
    landingPageUrl: body.landing_page_url ?? body.landingPageUrl,
    actor: body.actor,
  };
}

function errorStatus(err: unknown) {
  return err instanceof Error && /not found/i.test(err.message) ? 404 : 400;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  try {
    const { id } = await params;
    const asset = await getCreativeLibraryAsset(tenantId, id);
    if (!asset) return Response.json({ error: 'Creative asset not found' }, { status: 404 });
    return Response.json({ asset });
  } catch (err) {
    console.error('[Ad Manager Media Asset]', err);
    return Response.json({ error: 'Failed to load media asset' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const asset = await updateCreativeLibraryAsset(tenantId, id, assetPatchFromBody(body));
    return Response.json({ asset });
  } catch (err) {
    console.error('[Ad Manager Update Media Asset]', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Failed to update media asset' }, { status: errorStatus(err) });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let tenantId: string;
  let id = '';
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  try {
    ({ id } = await params);
    return Response.json(await archiveCreativeLibraryAsset(tenantId, id, tenantId));
  } catch (err) {
    if (err instanceof Error && /not found/i.test(err.message)) {
      return Response.json({ ok: true, id, already_removed: true });
    }
    console.error('[Ad Manager Archive Media Asset]', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Failed to archive media asset' }, { status: errorStatus(err) });
  }
}
