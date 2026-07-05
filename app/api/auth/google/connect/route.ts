import { NextRequest } from 'next/server'
import { getEnv } from '@/lib/oauth-config'
import { createOAuthState, upsertIntegration } from '@/lib/db'
import { isDemoTenant } from '@/lib/demo'
import { verifyJwt, COOKIE_NAME } from '@/lib/jwt'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

function safeDashboardReturnTo(request: NextRequest) {
  const fallback = '/dashboard/settings';
  const explicit = request.nextUrl.searchParams.get('return_to') || request.nextUrl.searchParams.get('returnTo');
  const referer = request.headers.get('referer') || '';
  const candidate = explicit || referer;

  if (!candidate) return fallback;

  try {
    const url = new URL(candidate, request.nextUrl.origin);
    if (url.origin !== request.nextUrl.origin) return fallback;
    if (!url.pathname.startsWith('/dashboard/')) return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}

export async function GET(request: NextRequest) {
  // Authenticate: verify JWT cookie and use the authenticated tenant
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return new Response('Unauthorized', { status: 401 });
  const jwt = await verifyJwt(token);
  if (!jwt) return new Response('Unauthorized', { status: 401 });

  const tenantId = jwt.email as string;
  if (!tenantId) return new Response('Missing tenant', { status: 400 });

  const service = (request.nextUrl.searchParams.get('service') || 'gmail').toLowerCase();
  const provider = service === 'drive' || service === 'google_drive' ? 'google_drive' : 'google';
  const returnTo = safeDashboardReturnTo(request);
  const scope = provider === 'google_drive'
    ? 'openid email profile https://www.googleapis.com/auth/drive'
    : 'openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify';

  // Demo tenant: fake instant connect
  if (isDemoTenant(tenantId)) {
    await upsertIntegration(tenantId, provider, 'demo-token', null, null, scope, null, 'support@demo-store.com');
    const base = request.nextUrl.origin || 'https://app.ainomiq.com';
    const redirectUrl = new URL(returnTo, base);
    redirectUrl.searchParams.set('connected', provider);
    return Response.redirect(redirectUrl);
  }

  try {
    const state = randomBytes(16).toString('hex')
    await createOAuthState(state, tenantId, provider, undefined, returnTo)

    const params = new URLSearchParams({
      client_id: getEnv('GOOGLE_CLIENT_ID'),
      redirect_uri: getEnv('GOOGLE_REDIRECT_URI'),
      response_type: 'code',
      scope,
      state,
      access_type: 'offline',
      prompt: 'consent',
    })

    return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
  } catch (err) {
    console.error('[Google Connect] Error:', err)
    return new Response('Failed to initiate OAuth', { status: 500 })
  }
}
