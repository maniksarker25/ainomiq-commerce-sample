import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { archivePersona } from '@/lib/ad-manager/db';

export const dynamic = 'force-dynamic';

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
    return Response.json(await archivePersona(tenantId, id, tenantId));
  } catch (err) {
    if (err instanceof Error && /not found/i.test(err.message)) {
      return Response.json({ ok: true, id, already_removed: true });
    }
    console.error('[Ad Manager Archive Persona]', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Failed to delete persona' }, { status: 400 });
  }
}
