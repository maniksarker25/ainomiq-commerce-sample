import { NextRequest } from 'next/server';
import { getGmailTokenAndFetch, GmailError } from '@/lib/gmail';
import { isDemoTenant } from '@/lib/demo';
import { getDemoCsLabels } from '@/lib/demo-data';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  if (isDemoTenant(tenantId)) {
    return Response.json(getDemoCsLabels());
  }

  try {
    const data = await getGmailTokenAndFetch(tenantId, '/labels');

    const labels = (data.labels || []).map((label: { id: string; name: string; type: string }) => ({
      id: label.id,
      name: label.name,
      type: label.type,
    }));

    return Response.json({ labels });
  } catch (err) {
    if (err instanceof GmailError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error('[CS Labels]', err);
    return Response.json({ error: 'Failed to fetch labels' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: { tenant_id?: string; name?: string; color?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  let tenantId: string;
  try {
    tenantId = await requireAuth(request, body.tenant_id);
  } catch (err) {
    return handleAuthError(err);
  }

  const { name, color } = body;
  if (!name) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (isDemoTenant(tenantId)) {
    return Response.json({ label: { id: `demo-lbl-${Date.now()}`, name, type: 'user' } });
  }

  const gmailBody: Record<string, unknown> = {
    name,
    labelListVisibility: 'labelShow',
    messageListVisibility: 'show',
  };

  if (color) {
    gmailBody.color = color;
  }

  try {
    const result = await getGmailTokenAndFetch(
      tenantId,
      '/labels',
      {
        method: 'POST',
        body: JSON.stringify(gmailBody),
      },
    );

    return Response.json({ label: result });
  } catch (err) {
    if (err instanceof GmailError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error('[CS Labels Create]', err);
    return Response.json({ error: 'Failed to create label' }, { status: 500 });
  }
}
