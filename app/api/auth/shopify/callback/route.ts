import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
export const dynamic = 'force-dynamic'

import { getEnv } from '@/lib/oauth-config'
import {
  validateOAuthState,
  upsertIntegration,
  findTenantIdByShopifyShop,
  insertTenantForShopifyInstall,
  getTenantById,
  resolveCanonicalTenantId,
} from '@/lib/db'
import { oauthRedirect } from '@/lib/oauth-redirect'
import {
  SHOPIFY_INSTALL_PENDING_TENANT,
  isShopifyInstallReturnTo,
  shopFromInstallReturnTo,
} from '@/lib/shopify-oauth-constants'
import { shopifyOAuthSuccessUrl, SHOPIFY_RETURN_PATHS } from '@/lib/shopify-oauth'
import { fetchShopWithToken } from '@/lib/shopify-graphql'

import { createJwt, buildCookieHeader } from '@/lib/jwt'

const APP_BASE = process.env.APP_BASE_URL?.trim() || 'https://app.ainomiq.com'

function redirectWithSession(targetPath: string, token: string) {
  const url = new URL(targetPath.startsWith('http') ? targetPath : `${APP_BASE}${targetPath}`, APP_BASE)
  const res = NextResponse.redirect(url)
  res.headers.append('Set-Cookie', buildCookieHeader(token))
  return res
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const shop = searchParams.get('shop')

  if (!code || !state || !shop) {
    return new Response('Missing code, state, or shop', { status: 400 })
  }

  const stateData = await validateOAuthState(state)
  if (!stateData || stateData.provider !== 'shopify') {
    return oauthRedirect(`${APP_BASE}/dashboard/settings?error=invalid_state`)
  }

  const isInstallFlow =
    stateData.tenantId === SHOPIFY_INSTALL_PENDING_TENANT && isShopifyInstallReturnTo(stateData.returnTo)

  let tenantId = stateData.tenantId
  const returnTo = stateData.returnTo || SHOPIFY_RETURN_PATHS.performance

  try {
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: getEnv('SHOPIFY_CLIENT_ID'),
        client_secret: getEnv('SHOPIFY_CLIENT_SECRET'),
        code,
      }),
    })
    if (!tokenRes.ok) {
      console.error('Shopify token exchange failed:', await tokenRes.text())
      if (isInstallFlow) {
        return NextResponse.redirect(new URL('/login?error=token_exchange_failed', APP_BASE))
      }
      return oauthRedirect(`${APP_BASE}/dashboard/settings?error=token_exchange_failed`)
    }
    const tokens = (await tokenRes.json()) as { access_token: string; scope?: string }

    if (isInstallFlow) {
      const expectedShop = shopFromInstallReturnTo(stateData.returnTo!)
      if (expectedShop.toLowerCase() !== shop.toLowerCase()) {
        return NextResponse.redirect(new URL('/login?error=shop_mismatch', APP_BASE))
      }

      const existing = await findTenantIdByShopifyShop(shop)
      if (existing) {
        tenantId = existing
      } else {
        const id = crypto.randomUUID()
        let shopName = shop.replace(/\.myshopify\.com$/i, '')
        try {
          const body = await fetchShopWithToken(tokens.access_token, shop)
          if (body.shop?.name) shopName = body.shop.name
        } catch {
          // keep subdomain as display name
        }
        const subdomain = shop.replace(/\.myshopify\.com$/i, '')
        const emailSlug = `${subdomain}.${id.slice(0, 8)}`.toLowerCase().replace(/[^a-z0-9.]/g, '-')
        const email = `shopify.${emailSlug}@installed.ainomiq.com`
        await insertTenantForShopifyInstall({ id, name: shopName, email })
        tenantId = id
      }
    }

    const canonicalTenantId = isInstallFlow ? tenantId : await resolveCanonicalTenantId(tenantId)
    await upsertIntegration(canonicalTenantId, 'shopify', tokens.access_token, null, null, tokens.scope || null, shop, null)

    if (isInstallFlow) {
      const user = await getTenantById(tenantId)
      if (!user) {
        return NextResponse.redirect(new URL('/login?error=tenant_create_failed', APP_BASE))
      }
      const token = await createJwt({
        email: user.email,
        tenantId: user.id,
        name: user.name,
        organization: '',
        modules: [],
        accessMode: 'customer',
      })
      return redirectWithSession(shopifyOAuthSuccessUrl(SHOPIFY_RETURN_PATHS.performance, APP_BASE), token)
    }

    return oauthRedirect(shopifyOAuthSuccessUrl(returnTo, APP_BASE))
  } catch (err) {
    console.error('Shopify OAuth callback error:', err)
    if (isInstallFlow) {
      return NextResponse.redirect(new URL('/login?error=oauth_failed', APP_BASE))
    }
    return oauthRedirect(`${APP_BASE}/dashboard/performance?error=oauth_failed`)
  }
}
