import { NextRequest } from 'next/server';
import { getTenantConfig, setTenantConfig } from '@/lib/db';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { APP_DEFINITIONS, getDefaultAppSettings, sanitizeAppSettings, type AppSettings } from '@/lib/app-settings';

export const dynamic = 'force-dynamic';
const CONFIG_KEY = 'app_settings';

function parseSettings(raw: string | null): Record<string, AppSettings> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function withDefaults(settings: Record<string, AppSettings>) {
  const output: Record<string, AppSettings> = {};
  for (const app of APP_DEFINITIONS) {
    output[app.id] = { ...getDefaultAppSettings(app.id), ...(settings[app.id] || {}) };
  }
  for (const [appId, value] of Object.entries(settings)) {
    if (!output[appId]) output[appId] = { ...getDefaultAppSettings(appId), ...value };
  }
  return output;
}

export async function GET(request: NextRequest) {
  let tenantId: string;
  try { tenantId = await requireAuth(request); } catch (err) { return handleAuthError(err); }
  const appId = request.nextUrl.searchParams.get('app_id');
  const raw = await getTenantConfig(tenantId, CONFIG_KEY);
  const settings = withDefaults(parseSettings(raw));
  if (appId) return Response.json({ settings: settings[appId] || getDefaultAppSettings(appId) });
  return Response.json({ settings, apps: APP_DEFINITIONS });
}

export async function POST(request: NextRequest) {
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  let tenantId: string;
  try { tenantId = await requireAuth(request, body.tenant_id); } catch (err) { return handleAuthError(err); }

  const appId = String(body.app_id || '').trim();
  if (!appId) return Response.json({ error: 'Missing app_id' }, { status: 400 });

  const raw = await getTenantConfig(tenantId, CONFIG_KEY);
  const settings = parseSettings(raw);
  const next = sanitizeAppSettings(appId, body.settings || body, settings[appId] || null);
  settings[appId] = next;
  await setTenantConfig(tenantId, CONFIG_KEY, JSON.stringify(settings));
  return Response.json({ ok: true, settings: next });
}
