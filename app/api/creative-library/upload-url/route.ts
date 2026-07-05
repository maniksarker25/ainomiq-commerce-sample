import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import {
  createCreativeAssetUploadPlan,
  createR2PresignedPutUrl,
  getR2ConfigFromEnv,
} from '@/lib/creative-library/storage';

export const dynamic = 'force-dynamic';

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
    const fileName = String(body?.file_name || body?.fileName || '').trim();
    if (!fileName) return Response.json({ error: 'File name is required' }, { status: 400 });

    const config = getR2ConfigFromEnv();
    const plan = createCreativeAssetUploadPlan({
      tenantId,
      fileName,
      contentType: body?.content_type || body?.contentType || null,
      publicBaseUrl: config.publicBaseUrl,
    });
    const uploadUrl = createR2PresignedPutUrl({ config, key: plan.key });

    return Response.json({
      upload: {
        asset_id: plan.assetId,
        key: plan.key,
        upload_url: uploadUrl,
        method: 'PUT',
        headers: { 'content-type': plan.contentType },
        asset_url: plan.publicUrl,
        file_name: plan.fileName,
        mime_type: plan.contentType,
        type: plan.type,
        expires_in: 900,
      },
    });
  } catch (err) {
    console.error('[Creative Library Upload URL]', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Could not create upload URL' }, { status: 500 });
  }
}
