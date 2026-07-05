import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { createTemplate, listTemplates } from '@/lib/ad-manager/db';

export const dynamic = 'force-dynamic';

function cleanText(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function cleanStringArray(value: unknown) {
  if (Array.isArray(value)) return value.map(item => cleanText(item)).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map(item => item.trim()).filter(Boolean);
  return [];
}

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  try {
    return Response.json({ templates: await listTemplates(tenantId, { limit: 100 }) });
  } catch (err) {
    console.error('[Ad Manager Templates]', err);
    return Response.json({ error: 'Failed to load templates' }, { status: 500 });
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
    const template = await createTemplate(tenantId, {
      name: cleanText(body.name),
      kind: cleanText(body.kind) || 'image',
      formatSupport: cleanStringArray(body.format_support || body.formatSupport),
      renderer: cleanText(body.renderer) || 'visual_template_builder',
      designJson: body.design_json && typeof body.design_json === 'object' ? body.design_json : {},
      status: body.status === 'archived' ? 'archived' : 'active',
      actor: tenantId,
    });
    return Response.json({ template });
  } catch (err) {
    console.error('[Ad Manager Create Template]', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Failed to save template' }, { status: 400 });
  }
}
