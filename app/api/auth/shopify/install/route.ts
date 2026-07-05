import { NextRequest } from 'next/server'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

import { getEnv, SHOPIFY_ACCESS_SCOPES_STRING } from '@/lib/oauth-config'
import { createOAuthState } from '@/lib/db'
import {
  SHOPIFY_INSTALL_PENDING_TENANT,
  SHOPIFY_INSTALL_RETURN_PREFIX,
} from '@/lib/shopify-oauth-constants'
import { verifyShopifyInstallHmac } from '@/lib/shopify-install-hmac'

/**
 * App Store / Shopify-initiated install: verify HMAC, then redirect to Shopify OAuth
 * before any Ainomiq UI (see Shopify App Store requirement: authenticate immediately after install).
 */
export async function GET(request: NextRequest) {
  if (!(await verifyShopifyInstallHmac(request.nextUrl.searchParams))) {
    return new Response('Invalid or missing Shopify install signature', { status: 400 })
  }

  const shop = request.nextUrl.searchParams.get('shop')?.trim().toLowerCase()
  if (!shop || !shop.endsWith('.myshopify.com')) {
    return new Response('Invalid shop parameter', { status: 400 })
  }

  const state = randomBytes(16).toString('hex')
  await createOAuthState(state, SHOPIFY_INSTALL_PENDING_TENANT, 'shopify', undefined, `${SHOPIFY_INSTALL_RETURN_PREFIX}${shop}`)

  const redirectUri = getEnv('SHOPIFY_REDIRECT_URI')
  const scopes = SHOPIFY_ACCESS_SCOPES_STRING
  const authUrl =
    `https://${shop}/admin/oauth/authorize?client_id=${encodeURIComponent(getEnv('SHOPIFY_CLIENT_ID'))}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`

  return Response.redirect(authUrl)
}
