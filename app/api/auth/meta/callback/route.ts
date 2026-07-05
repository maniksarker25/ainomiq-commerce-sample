import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
export const dynamic = 'force-dynamic'

import { getEnv } from '@/lib/oauth-config'
import { addTenantModule, getTenantConfig, setTenantConfig, validateOAuthState, upsertIntegration, getIntegration, storeMetaFacebookUserId } from '@/lib/db'
import { exchangeMetaToken } from '@/lib/meta'
import { brandProfileToAnalysis, brandProfileToIntake } from '@/lib/brand-profile'
import { subscribePageToAppWebhooks } from '@/lib/meta-webhooks'
import {
  type MetaConnectIntent,
  META_RETURN_PATHS,
  META_SETTINGS_CONNECTED_PARAM,
  isMetaSettingsReturn,
  metaConnectSuccessPath,
  metaContentErrorRedirect,
  metaSettingsOAuthReturn,
  safeMetaDashboardReturn,
} from '@/lib/meta-oauth'

async function ensureContentPipelineConfig(tenantId: string) {
  const existing = await getTenantConfig(tenantId, 'content_pipeline_config')
  if (existing) return

  const brandRaw = await getTenantConfig(tenantId, 'brand_profile')
  let brandProfile: any = null
  try { brandProfile = brandRaw ? JSON.parse(brandRaw) : null } catch {}

  const intake = brandProfileToIntake(brandProfile)
  const analysis = brandProfileToAnalysis(brandProfile)
  const now = new Date().toISOString()
  await setTenantConfig(tenantId, 'content_pipeline_config', JSON.stringify({
    brand_name: intake.brand_name || brandProfile?.brand_name || '',
    content_source: '',
    content_generation_mode: 'source_material',
    ai_image_model: 'openai/gpt-image-2',
    ai_image_provider: 'openai',
    ai_image_provider_model: 'gpt-image-2',
    ai_image_base_credits_per_image: 1,
    ai_image_margin_multiplier: 1,
    ai_image_credits_per_image: 1,
    output_types: analysis?.recommended_outputs?.length ? analysis.recommended_outputs : ['instagram_caption', 'ad_copy'],
    brand_voice: analysis?.brand_voice || intake.brand_tone || 'Clear, practical, confident, no corporate fluff.',
    target_audience: analysis?.target_audience || intake.ideal_customer || '',
    product_focus: analysis?.product_focus || intake.main_offer || intake.what_you_sell || '',
    agent_webhook_url: '',
    company_intake: intake,
    company_analysis: analysis,
    training_notes: [],
    publish_platforms: ['instagram'],
    publishing_enabled: true,
    posting_addon_mode: 'free_beta',
    status: 'active',
    updated_at: now,
  }))
}

/**
 * Robust redirect helper that detects localhost, forces standard non-secure HTTP for localhost,
 * and cleanly strips Facebook's sticky `#_=_` redirect suffix fragment.
 */
function buildSecureLocalhostRedirect(targetPath: string, request: NextRequest) {
  const host = request.headers.get('host') || request.nextUrl.host || 'localhost:3001'
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1')
  
  // Force HTTP on localhost to prevent connection errors
  const proto = isLocalhost ? 'http' : (request.headers.get('x-forwarded-proto') || 'https')
  const origin = `${proto}://${host}`

  // Parse path and origin
  const targetUrl = new URL(targetPath, origin)

  // Clean Meta's sticky #_=_ fragment
  if (targetUrl.hash === '#_=_' || targetUrl.hash.includes('_=_')) {
    targetUrl.hash = ''
  }

  let finalUrlStr = targetUrl.toString()
  if (finalUrlStr.endsWith('#_=_')) {
    finalUrlStr = finalUrlStr.slice(0, -4)
  }

  // Force append empty hash '#' to overwrite Meta's sticky address bar fragment in the browser
  if (!finalUrlStr.includes('#')) {
    finalUrlStr += '#'
  }

  return NextResponse.redirect(new URL(finalUrlStr))
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return buildSecureLocalhostRedirect('/dashboard/settings?error=' + encodeURIComponent(error), request)
  }
  if (!code || !state) {
    return new Response('Missing code or state', { status: 400 })
  }

  const stateData = await validateOAuthState(state)
  if (!stateData || !(stateData.provider === 'meta' || stateData.provider.startsWith('meta_content'))) {
    return buildSecureLocalhostRedirect('/dashboard/settings?error=invalid_state', request)
  }

  try {
    const tokenRes = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?client_id=${getEnv('META_APP_ID')}&client_secret=${getEnv('META_APP_SECRET')}&redirect_uri=${encodeURIComponent(getEnv('META_REDIRECT_URI'))}&code=${code}`)
    if (!tokenRes.ok) {
      const tokenError = await tokenRes.text()
      console.error('Meta token exchange failed:', tokenRes.status, tokenError)
      return buildSecureLocalhostRedirect(`/dashboard/settings?error=token_exchange_failed&detail=${encodeURIComponent(tokenError.slice(0, 220))}`, request)
    }
    const shortLivedTokens = await tokenRes.json()

    // Get user info with short-lived token
    const meRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name,email&access_token=${shortLivedTokens.access_token}`)
    const me = meRes.ok ? await meRes.json() : {}

    if (me.id) {
      await storeMetaFacebookUserId(stateData.tenantId, String(me.id))
    }

    if (stateData.provider.startsWith('meta_content')) {
      const longTokenRes = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${getEnv('META_APP_ID')}&client_secret=${getEnv('META_APP_SECRET')}&fb_exchange_token=${shortLivedTokens.access_token}`)
      const longTokens = longTokenRes.ok ? await longTokenRes.json() : shortLivedTokens
      const userAccessToken = longTokens.access_token || shortLivedTokens.access_token
      const expiresAt = longTokens.expires_in ? new Date(Date.now() + longTokens.expires_in * 1000) : null

      const providerParts = stateData.provider.replace('meta_content_', '').split('_')
      const requestedPlatform = providerParts[0] || 'both'
      const requestedIntent = (providerParts[1] || 'content') as MetaConnectIntent
      const needsInstagram = requestedPlatform === 'instagram' || requestedPlatform === 'both' || requestedPlatform === 'meta_content'
      const needsFacebook = requestedPlatform === 'facebook' || requestedPlatform === 'both'

      const defaultReturnByIntent: Record<string, string> = {
        messaging: META_RETURN_PATHS.intelliSupport,
        posting: META_RETURN_PATHS.settings,
        content: META_RETURN_PATHS.contentStudio,
      }
      const returnPath = safeMetaDashboardReturn(
        stateData.returnTo?.trim(),
        defaultReturnByIntent[requestedIntent] || META_RETURN_PATHS.contentStudio,
      )

      // Determine the base scopes for this specific connection request
      let baseScopes = ''
      if (requestedIntent === 'messaging') {
        baseScopes = 'pages_show_list,pages_manage_metadata,pages_read_engagement,pages_messaging,instagram_basic,instagram_manage_comments,instagram_manage_messages,business_management,pages_read_user_content,pages_manage_engagement'
      } else if (requestedIntent === 'posting') {
        baseScopes = 'pages_show_list,pages_manage_metadata,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_manage_comments,instagram_content_publish,business_management,pages_read_user_content,pages_manage_engagement'
      } else {
        baseScopes = 'pages_show_list,pages_manage_metadata,pages_read_engagement,pages_messaging,pages_manage_posts,instagram_basic,instagram_manage_comments,instagram_manage_messages,instagram_content_publish,business_management,pages_read_user_content,pages_manage_engagement'
      }

      const paramScope = searchParams.get('scope')
      const initialScopes = paramScope || baseScopes

      // Merge with any existing active integrations scopes to keep previously authorized features
      const existingFb = await getIntegration(stateData.tenantId, 'facebook')
      const existingIg = await getIntegration(stateData.tenantId, 'instagram')
      const existingScopesStr = String(existingFb?.scopes || existingIg?.scopes || '')

      const mergeScopes = (existing: string, incoming: string) => {
        const existingSet = new Set((existing || '').split(',').map(s => s.trim()).filter(Boolean))
        const incomingSet = new Set(incoming.split(',').map(s => s.trim()).filter(Boolean))
        const merged = new Set([...existingSet, ...incomingSet])
        return Array.from(merged).join(',')
      }

      const scopes = mergeScopes(existingScopesStr, initialScopes)

      const pagesRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${userAccessToken}`)
      const pagesData = pagesRes.ok ? await pagesRes.json() : { data: [] }
      const page = pagesData.data?.[0] || null
      const pageToken = page?.access_token || userAccessToken
      let savedConnections = 0

      if (page) {
        await upsertIntegration(stateData.tenantId, 'facebook', pageToken, null, expiresAt, scopes, page.id || null, page.name || me.email || me.name || null)
        savedConnections += 1
      }

      const ig = page?.instagram_business_account || null
      if (ig?.id && page?.id) {
        const compositeAccountId = `${page.id}|${ig.id}`
        await upsertIntegration(
          stateData.tenantId,
          'instagram',
          pageToken,
          null,
          expiresAt,
          scopes,
          compositeAccountId,
          ig.username ? `@${ig.username}` : `IG ${ig.id}`,
        )
        savedConnections += 1
      } else if (ig?.id) {
        await upsertIntegration(stateData.tenantId, 'instagram', pageToken, null, expiresAt, scopes, ig.id, ig.username ? `@${ig.username}` : `IG ${ig.id}`)
        savedConnections += 1
      }

      if (page?.id && pageToken) {
        const sub = await subscribePageToAppWebhooks(page.id, pageToken)
        if (!sub.ok) {
          console.warn('[meta-content-callback] Page webhook subscribe:', sub.error)
        }
      }

      if (savedConnections === 0) {
        console.error('[meta-content-callback] No Page or Instagram account returned from /me/accounts:', JSON.stringify(pagesData))
        return buildSecureLocalhostRedirect(metaContentErrorRedirect(requestedIntent, 'meta_no_accounts', returnPath), request)
      }
      if (needsInstagram && !ig?.id) {
        console.error('[meta-content-callback] Facebook Page connected, but no Instagram business account was returned:', JSON.stringify(pagesData))
        return buildSecureLocalhostRedirect(metaContentErrorRedirect(requestedIntent, 'meta_no_instagram', returnPath), request)
      }
      if (needsFacebook && !page) {
        console.error('[meta-content-callback] No Facebook Page returned from /me/accounts:', JSON.stringify(pagesData))
        return buildSecureLocalhostRedirect(metaContentErrorRedirect(requestedIntent, 'meta_no_facebook', returnPath), request)
      }

      if (requestedIntent === 'content' || requestedIntent === 'posting') {
        await addTenantModule(stateData.tenantId, 'content')
        await ensureContentPipelineConfig(stateData.tenantId)
      }
      if (requestedIntent === 'messaging') {
        await addTenantModule(stateData.tenantId, 'cs')
      }

      revalidatePath('/dashboard/settings')
      revalidatePath('/dashboard/automations/content-pipeline')
      revalidatePath('/dashboard/cs')
      revalidatePath('/dashboard/automations/cs-onboarding')

      if (isMetaSettingsReturn(returnPath)) {
        const connected =
          META_SETTINGS_CONNECTED_PARAM[requestedIntent as keyof typeof META_SETTINGS_CONNECTED_PARAM] || 'meta'
        return buildSecureLocalhostRedirect(metaSettingsOAuthReturn(returnPath, connected), request)
      }

      if (requestedIntent === 'messaging' || requestedIntent === 'content') {
        const successPath = metaConnectSuccessPath({
          intent: requestedIntent,
          provider: 'meta',
          returnTo: returnPath,
        })
        return buildSecureLocalhostRedirect(successPath, request)
      }

      const successPath = metaConnectSuccessPath({
        intent: 'content',
        provider: 'meta',
        returnTo: returnPath,
      })
      return buildSecureLocalhostRedirect(successPath, request)
    }

    // Exchange short-lived token for long-lived token (60 days) for Ads Manager
    // Store with null ad account. User will select in the next step.
    await exchangeMetaToken(
      stateData.tenantId,
      'meta',
      shortLivedTokens.access_token,
      searchParams.get('scope') || null,
      null, // ad account selected in next step
      me.email || me.name || null,
    )

    // Bust cache to let server components load the connected status
    revalidatePath('/dashboard/settings')
    revalidatePath('/dashboard/meta-setup')

    const returnTo = stateData.returnTo?.trim()
    if (returnTo && returnTo.startsWith('/dashboard/')) {
      const next = encodeURIComponent(returnTo)
      return buildSecureLocalhostRedirect(`/dashboard/meta-setup?next=${next}`, request)
    }

    // Redirect to selection workflow modal in general settings
    return buildSecureLocalhostRedirect('/dashboard/settings?select_ad_account=meta', request)
  } catch (err) {
    console.error('Meta OAuth callback error:', err)
    return buildSecureLocalhostRedirect('/dashboard/settings?error=oauth_failed', request)
  }
}
