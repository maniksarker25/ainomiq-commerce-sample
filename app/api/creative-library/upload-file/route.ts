import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { createCreativeLibraryAsset } from '@/lib/ad-manager/db';
import { uploadBufferToCreativeLibraryStorage } from '@/lib/creative-library/storage';

export const dynamic = 'force-dynamic';

function tagsFromValue(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return [];
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

export async function POST(request: NextRequest) {
  let form: FormData;
  let tenantId: string;
  try {
    form = await request.formData();
    tenantId = await requireAuth(request, String(form.get('tenant_id') || ''));
  } catch (err) {
    return handleAuthError(err);
  }

  try {
    const file = form.get('file');
    if (!(file instanceof File)) return Response.json({ error: 'file is required' }, { status: 400 });

    const body = await file.arrayBuffer();
    const plan = await uploadBufferToCreativeLibraryStorage({
      tenantId,
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      body,
    });
    const type = plan.type;
    const asset = await createCreativeLibraryAsset(tenantId, {
      name: String(form.get('name') || file.name || plan.fileName).trim(),
      type,
      status: form.get('status') === 'needs_review' ? 'needs_review' : 'ready',
      sourceType: 'upload',
      assetUrl: plan.publicUrl,
      thumbnailUrl: type === 'image' ? plan.publicUrl : null,
      fileName: plan.fileName,
      mimeType: plan.contentType,
      fileSize: file.size,
      ratio: 'unknown',
      productId: String(form.get('product_id') || '') || null,
      productName: String(form.get('product_name') || '') || null,
      productUrl: String(form.get('product_url') || '') || null,
      tags: tagsFromValue(form.get('tags')),
      actor: String(form.get('actor') || tenantId),
    });

    return Response.json({ asset, upload: { asset_id: plan.assetId, asset_url: plan.publicUrl, file_name: plan.fileName, mime_type: plan.contentType, type } });
  } catch (err) {
    console.error('[Creative Library Upload File]', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Could not upload file' }, { status: 400 });
  }
}
