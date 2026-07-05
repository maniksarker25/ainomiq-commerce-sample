import { NextRequest } from 'next/server'
import { getEnv } from '@/lib/oauth-config'
import { validateOAuthState, upsertIntegration } from '@/lib/db'
import { verifyJwt, COOKIE_NAME } from '@/lib/jwt'
import { oauthRedirect } from '@/lib/oauth-redirect'

export const dynamic = 'force-dynamic'

const FALLBACK_RETURN_PATH = '/dashboard/settings'

function oauthReturnUrl(returnTo: string | undefined, providerOrError: { connected?: string; error?: string }) {
  const base = new URL(process.env.APP_BASE_URL?.trim() || 'https://app.ainomiq.com').origin
  const url = new URL(returnTo || FALLBACK_RETURN_PATH, base)
  if (url.origin !== base || !url.pathname.startsWith('/dashboard/')) {
    url.pathname = FALLBACK_RETURN_PATH
    url.search = ''
  }
  if (providerOrError.connected) url.searchParams.set('connected', providerOrError.connected)
  if (providerOrError.error) url.searchParams.set('error', providerOrError.error)
  return url.toString()
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const baseUrl = oauthReturnUrl(undefined, {})

  // Step 0: Check for OAuth error
  if (error) {
    return oauthRedirect(`${baseUrl}?error=${encodeURIComponent(error)}`)
  }

  // Step 1: Validate params
  if (!code || !state) {
    return oauthRedirect(`${baseUrl}?error=missing_params`)
  }

  // Step 1b: Verify logged-in user
  const jwtToken = request.cookies.get(COOKIE_NAME)?.value;
  const jwt = jwtToken ? await verifyJwt(jwtToken) : null;

  // Step 2: Validate state from database
  let stateData: { tenantId: string; provider: string; returnTo?: string } | null = null
  try {
    stateData = await validateOAuthState(state)
  } catch (err) {
    console.error('[Google OAuth] State validation error:', err)
    return oauthRedirect(`${baseUrl}?error=state_db_error`)
  }

  if (!stateData || !['google', 'google_drive', 'google_calendar'].includes(stateData.provider)) {
    console.error('[Google OAuth] Invalid state:', state, 'result:', stateData)
    return oauthRedirect(`${baseUrl}?error=invalid_state`)
  }

  // Step 2b: Verify logged-in user matches state's tenant
  if (jwt && jwt.email !== stateData.tenantId && jwt.tenantId !== stateData.tenantId) {
    console.error('[Google OAuth] Tenant mismatch: JWT', jwt.email, 'vs state', stateData.tenantId)
    return oauthRedirect(oauthReturnUrl(stateData.returnTo, { error: 'tenant_mismatch' }))
  }

  // Step 3: Exchange code for tokens
  let tokens: Record<string, unknown>
  try {
    const clientId = getEnv('GOOGLE_CLIENT_ID')
    const clientSecret = getEnv('GOOGLE_CLIENT_SECRET')
    const redirectUri = getEnv('GOOGLE_REDIRECT_URI')

    console.log('[Google OAuth] Exchanging code, redirect_uri:', redirectUri)

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    const tokenBody = await tokenRes.text()
    if (!tokenRes.ok) {
      console.error('[Google OAuth] Token exchange failed:', tokenRes.status, tokenBody)
      return oauthRedirect(oauthReturnUrl(stateData.returnTo, { error: 'token_exchange_failed' }))
    }
    tokens = JSON.parse(tokenBody)
    console.log('[Google OAuth] Token exchange success, has refresh_token:', !!tokens.refresh_token)
  } catch (err) {
    console.error('[Google OAuth] Token exchange error:', err)
    return oauthRedirect(oauthReturnUrl(stateData?.returnTo, { error: 'token_fetch_error' }))
  }

  // Step 4: Get user info
  let userEmail = ''
  let userId = ''
  try {
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    if (userRes.ok) {
      const userInfo = await userRes.json()
      userEmail = userInfo.email || ''
      userId = userInfo.id || ''
      console.log('[Google OAuth] User info:', userEmail)
    }
  } catch (err) {
    console.error('[Google OAuth] User info fetch error (non-fatal):', err)
  }

  // Step 5: Store integration in database
  try {
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + (tokens.expires_in as number) * 1000)
      : null

    await upsertIntegration(
      stateData.tenantId,
      stateData.provider,
      tokens.access_token as string,
      (tokens.refresh_token as string) || null,
      expiresAt,
      searchParams.get('scope') || null,
      userId,
      userEmail,
    )
    console.log('[Google OAuth] Integration stored for:', stateData.tenantId)
  } catch (err) {
    console.error('[Google OAuth] DB upsert error:', err)
    return oauthRedirect(oauthReturnUrl(stateData.returnTo, { error: 'db_store_error' }))
  }

  // Step 6: Redirect back to the page where OAuth was started
  return oauthRedirect(oauthReturnUrl(stateData.returnTo, { connected: stateData.provider }))
}
