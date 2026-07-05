import { NextRequest } from 'next/server';
import { createClient } from '@libsql/client/web';
import { verifyJwt, COOKIE_NAME, createJwt, buildCookieHeader, clearCookieHeader } from '@/lib/jwt';
import { getLatestAcceptedInviteForEmail } from '@/lib/creative-os-invites';

export const dynamic = 'force-dynamic';

const db = createClient({
  url: (process.env.TURSO_DATABASE_URL || 'file:local.db').trim(),
  authToken: process.env.TURSO_AUTH_TOKEN?.trim(),
});

async function getFreshSessionConfig(email: string, tenantId?: string) {
  const ids = Array.from(new Set([email.toLowerCase().trim(), tenantId].filter(Boolean) as string[]));
  const placeholders = ids.map(() => '?').join(',');
  const result = await db.execute({
    sql: `SELECT tenant_id, config_key, config_value FROM tenant_config WHERE tenant_id IN (${placeholders}) AND config_key IN ('organization', 'modules')`,
    args: ids,
  });

  let organization = '';
  const moduleSet = new Set<string>();
  for (const row of result.rows) {
    const key = String(row.config_key || '');
    const value = String(row.config_value || '');
    if (key === 'organization') organization = value;
    if (key === 'modules') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) parsed.filter((m): m is string => typeof m === 'string').forEach(m => moduleSet.add(m));
      } catch {}
    }
  }
  return { organization, modules: Array.from(moduleSet) };
}

async function getAcceptedCreativeOsInvite(email: string) {
  try {
    const invite = await getLatestAcceptedInviteForEmail(email);
    return invite ? { tenantId: invite.tenantId } : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const noStoreHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  };
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return Response.json({ session: null }, { status: 401, headers: noStoreHeaders });
  }

  const payload = await verifyJwt(token);

  if (!payload) {
    return Response.json({ session: null }, { status: 401, headers: noStoreHeaders });
  }

  // Local/dev can run without a Turso DB or without tenant_config seeded.
  // In that case, keep the session usable and fall back to JWT payload modules.
  let fresh = { organization: '', modules: Array.isArray((payload as any)?.modules) ? (payload as any).modules : [] as string[] };
  try {
    fresh = await getFreshSessionConfig(payload.email, payload.tenantId);
  } catch {
    // ignore
  }
  const forceCreativeEditor = payload.accessMode === 'creative-editor';
  const acceptedInvite = (forceCreativeEditor || fresh.modules.length === 0) ? await getAcceptedCreativeOsInvite(payload.email) : null;
  if (forceCreativeEditor && !acceptedInvite) {
    const headers = new Headers();
    Object.entries(noStoreHeaders).forEach(([key, value]) => headers.set(key, value));
    headers.set('Set-Cookie', clearCookieHeader());
    return Response.json({ session: null, error: 'No Creative OS access found for this email.' }, {
      status: 401,
      headers,
    });
  }
  const isCreativeEditor = Boolean(acceptedInvite);
  const defaultModules = ['performance', 'ads', 'creative-os', 'stock', 'cs', 'content'];
  const session = {
    tenantId: acceptedInvite?.tenantId || payload.tenantId,
    email: payload.email,
    name: payload.name,
    organization: fresh.organization || (isCreativeEditor ? 'Creative OS' : ''),
    modules: isCreativeEditor 
      ? ['creative-os'] 
      : (fresh.modules && fresh.modules.length > 0 ? fresh.modules : defaultModules),
    accessMode: isCreativeEditor ? 'creative-editor' as const : 'customer' as const,
  };

  const refreshedToken = await createJwt(session);
  const headers = new Headers();
  Object.entries(noStoreHeaders).forEach(([key, value]) => headers.set(key, value));
  headers.set('Set-Cookie', buildCookieHeader(refreshedToken));

  return Response.json({
    session: {
      tenantId: session.tenantId,
      email: session.email,
      name: session.name,
      organization: session.organization,
      modules: session.modules,
      accessMode: session.accessMode,
    },
  }, {
    status: 200,
    headers,
  });
}
