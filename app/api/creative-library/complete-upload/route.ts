import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { createCreativeLibraryAsset } from '@/lib/ad-manager/db';
import {
  buildCreativeAssetKey,
  getR2ConfigFromEnv,
  sanitizeCreativeFileName,
} from '@/lib/creative-library/storage';

export const dynamic = 'force-dynamic';

function tagsFromBody(value: unknown) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map(item => item.trim()).filter(Boolean);
  return [];
}

export async function POST(request: NextRequest) {
  let body: any;
  let tenantId: string;
  try {
    body = await request.json();
    tenantId = await requireAuth(request, body?.tenant_id);
  } catch (err) {
    return handleAuthError(err);
  }

  try {
    const assetId = String(body?.asset_id || body?.assetId || '').trim();
    const fileName = sanitizeCreativeFileName(String(body?.file_name || body?.fileName || '').trim());
    const key = String(body?.key || '').trim();
    if (!assetId || !fileName || !key) {
      return Response.json({ error: 'asset_id, key and file_name are required' }, { status: 400 });
    }

    const expectedKey = buildCreativeAssetKey({ tenantId, assetId, fileName, variant: 'original' });
    if (key !== expectedKey) {
      return Response.json({ error: 'Upload key does not match this tenant and asset' }, { status: 400 });
    }

    const config = getR2ConfigFromEnv();
    const assetUrl = `${config.publicBaseUrl.replace(/\/+$/, '')}/${key}`;
    const type = body?.type === 'video' || String(body?.mime_type || body?.mimeType || '').startsWith('video/') ? 'video' : 'image';

    const asset = await createCreativeLibraryAsset(tenantId, {
      name: String(body?.name || fileName).trim(),
      type,
      status: body?.status === 'needs_review' ? 'needs_review' : 'ready',
      sourceType: 'upload',
      assetUrl,
      thumbnailUrl: body?.thumbnail_url || body?.thumbnailUrl || (type === 'image' ? assetUrl : null),
      fileName,
      mimeType: body?.mime_type || body?.mimeType || null,
      fileSize: Number.isFinite(body?.file_size) ? Number(body.file_size) : Number.isFinite(body?.fileSize) ? Number(body.fileSize) : null,
      width: Number.isFinite(body?.width) ? Number(body.width) : null,
      height: Number.isFinite(body?.height) ? Number(body.height) : null,
      durationSeconds: Number.isFinite(body?.duration_seconds) ? Number(body.duration_seconds) : Number.isFinite(body?.durationSeconds) ? Number(body.durationSeconds) : null,
      ratio: body?.ratio || 'unknown',
      productId: body?.product_id || body?.productId || null,
      productName: body?.product_name || body?.productName || null,
      productUrl: body?.product_url || body?.productUrl || null,
      personaId: body?.persona_id || body?.personaId || null,
      personaName: body?.persona_name || body?.personaName || null,
      campaignId: body?.campaign_id || body?.campaignId || null,
      tags: tagsFromBody(body?.tags),
      notes: body?.notes || null,
      copyHint: body?.copy_hint || body?.copyHint || null,
      landingPageUrl: body?.landing_page_url || body?.landingPageUrl || null,
      actor: body?.actor || tenantId,
    });

    return Response.json({ asset });
  } catch (err) {
    console.error('[Creative Library Complete Upload]', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Could not complete upload' }, { status: 400 });
  }
}
