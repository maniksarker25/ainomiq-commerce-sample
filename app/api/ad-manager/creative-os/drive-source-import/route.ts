import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { importDriveLinksToAinomiqLibrary } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

function driveImportErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (/invalid authentication credentials|expected oauth 2 access token|invalid_grant|unauthorized|token/i.test(message)) {
    return 'Google Drive connection expired or was revoked. Reconnect Google Drive in Settings, then import this folder again.';
  }
  return message || 'Could not import Drive sources';
}

export async function POST(request: NextRequest) {
  let body: { tenant_id?: string; product_id?: string; links?: unknown; product_name?: string; product_url?: string; max_files?: number; actor?: string } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  let tenantId: string;
  try {
    tenantId = await requireAuth(request, body.tenant_id);
  } catch (err) {
    return handleAuthError(err);
  }

  const links = Array.isArray(body.links)
    ? body.links.map(link => String(link || '').trim()).filter(Boolean)
    : [];
  if (!links.length) return Response.json({ error: 'Paste at least one Google Drive file or folder link.' }, { status: 400 });
  if (links.length > 20) return Response.json({ error: 'Import 20 Drive links or fewer at once.' }, { status: 400 });
  const invalidLink = links.find(link => !/^https:\/\/drive\.google\.com\//i.test(link));
  if (invalidLink) return Response.json({ error: 'Only Google Drive file or folder links can be imported as sources.' }, { status: 400 });

  try {
    const result = await importDriveLinksToAinomiqLibrary(tenantId, links, {
      productId: String(body.product_id || '').trim(),
      productName: String(body.product_name || 'Creative Sources'),
      productUrl: String(body.product_url || '').trim(),
      maxFiles: Math.min(Number(body.max_files) || 500, 500),
      actor: String(body.actor || '').trim() || tenantId,
    });
    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error('[Creative OS Drive to Library import]', err);
    return Response.json({ error: driveImportErrorMessage(err) }, { status: 400 });
  }
}
