import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'

import { getEnv, SHOPIFY_ACCESS_SCOPES_STRING } from '@/lib/oauth-config'
import { createOAuthState, upsertIntegration, resolveCanonicalTenantId } from '@/lib/db'
import { isDemoTenant } from '@/lib/demo'
import { verifyJwt, COOKIE_NAME } from '@/lib/jwt'
import { shopifyOAuthSuccessUrl, SHOPIFY_RETURN_PATHS } from '@/lib/shopify-oauth'
import { resolveShopDomainForOAuth, safeShopifyReturnTo } from '@/lib/shopify-oauth-server'
import { randomBytes } from 'crypto'

export async function GET(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value
  const jwt = token ? await verifyJwt(token) : null

  const queryTenantId = request.nextUrl.searchParams.get('tenant_id')?.trim() || ''
  const tenantId = jwt
    ? (jwt.email === queryTenantId || jwt.tenantId === queryTenantId ? queryTenantId : jwt.email)
    : queryTenantId

  if (!tenantId) return new Response('Missing tenant_id', { status: 400 })

  const returnTo = safeShopifyReturnTo(request, SHOPIFY_RETURN_PATHS.settings)
  const shopParam = request.nextUrl.searchParams.get('shop')

  if (isDemoTenant(tenantId)) {
    await upsertIntegration(tenantId, 'shopify', 'demo-token', null, null, 'read_products,read_orders,read_inventory', 'demo-store.myshopify.com', 'demo@demo-store.com')
    const base = request.nextUrl.origin || 'https://app.ainomiq.com'
    return Response.redirect(shopifyOAuthSuccessUrl(returnTo, base))
  }

  const shopDomain = await resolveShopDomainForOAuth(tenantId, shopParam)
  if (!shopDomain) {
    const base = request.nextUrl.origin || 'https://app.ainomiq.com'
    const redirect = new URL('/dashboard/settings', base)
    redirect.searchParams.set('tab', 'integrations')
    redirect.searchParams.set('shopify_install_via', 'app_store')
    if (returnTo !== SHOPIFY_RETURN_PATHS.settings) {
      redirect.searchParams.set('return_to', returnTo)
    }
    return Response.redirect(redirect.toString())
  }

  const canonicalTenantId = await resolveCanonicalTenantId(tenantId)
  const state = randomBytes(16).toString('hex')
  await createOAuthState(state, canonicalTenantId, 'shopify', undefined, returnTo)

  const redirectUri = getEnv('SHOPIFY_REDIRECT_URI')
  const authUrl =
    `https://${shopDomain}/admin/oauth/authorize?client_id=${encodeURIComponent(getEnv('SHOPIFY_CLIENT_ID'))}` +
    `&scope=${encodeURIComponent(SHOPIFY_ACCESS_SCOPES_STRING)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`

  return Response.redirect(authUrl)
}
