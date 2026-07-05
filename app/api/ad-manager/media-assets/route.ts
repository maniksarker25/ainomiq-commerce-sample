import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { createCreativeLibraryAsset, listCreativeLibraryAssets } from '@/lib/ad-manager/db';

export const dynamic = 'force-dynamic';

function assetInputFromBody(body: any) {
  return {
    name: body.name || '',
    type: body.type === 'video' ? 'video' as const : 'image' as const,
    status: body.status,
    sourceType: body.source_type || body.sourceType,
    assetUrl: body.asset_url || body.assetUrl || '',
    thumbnailUrl: body.thumbnail_url || body.thumbnailUrl || null,
    fileName: body.file_name || body.fileName || null,
    mimeType: body.mime_type || body.mimeType || null,
    fileSize: body.file_size ?? body.fileSize ?? null,
    width: body.width ?? null,
    height: body.height ?? null,
    durationSeconds: body.duration_seconds ?? body.durationSeconds ?? null,
    ratio: body.ratio,
    productId: body.product_id || body.productId || null,
    productName: body.product_name || body.productName || null,
    productUrl: body.product_url || body.productUrl || null,
    personaId: body.persona_id || body.personaId || null,
    personaName: body.persona_name || body.personaName || null,
    campaignId: body.campaign_id || body.campaignId || null,
    tags: Array.isArray(body.tags) ? body.tags : [],
    notes: body.notes || null,
    copyHint: body.copy_hint || body.copyHint || null,
    landingPageUrl: body.landing_page_url || body.landingPageUrl || null,
    actor: body.actor,
  };
}

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  try {
    const includeArchived = request.nextUrl.searchParams.get('include_archived') === '1';
    return Response.json({ assets: await listCreativeLibraryAssets(tenantId, { includeArchived, limit: 200 }) });
  } catch (err) {
    console.error('[Ad Manager Media Assets]', err);
    return Response.json({ error: 'Failed to load media assets' }, { status: 500 });
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
    const asset = await createCreativeLibraryAsset(tenantId, assetInputFromBody(body));
    return Response.json({ asset });
  } catch (err) {
    console.error('[Ad Manager Create Media Asset]', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Failed to create media asset' }, { status: 400 });
  }
}
