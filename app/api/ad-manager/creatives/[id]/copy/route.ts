import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { createCopyVariant, listCopyVariants } from '@/lib/ad-manager/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  try {
    const { id } = await params;
    return Response.json({ copy_variants: await listCopyVariants(tenantId, { creativeId: id }) });
  } catch (err) {
    console.error('[Ad Manager Copy]', err);
    return Response.json({ error: 'Failed to load copy variants' }, { status: 500 });
  }
}

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
    const copy = await createCopyVariant(tenantId, {
      creativeId: id,
      primaryText: body.primary_text || '',
      headline: body.headline || '',
      cta: body.cta || 'SHOP_NOW',
      policyNotes: body.policy_notes,
      selected: Boolean(body.selected),
    });
    return Response.json({ copy });
  } catch (err) {
    console.error('[Ad Manager Create Copy]', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Failed to create copy variant' }, { status: 400 });
  }
}
