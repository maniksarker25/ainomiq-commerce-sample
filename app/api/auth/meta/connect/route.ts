import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'

import { getEnv } from '@/lib/oauth-config'
import { createOAuthState, upsertIntegration } from '@/lib/db'
import { isDemoTenant } from '@/lib/demo'
import { randomBytes } from 'crypto'

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenant_id')
  if (!tenantId) return new Response('Missing tenant_id', { status: 400 })

  // Demo tenant: fake instant connect
  if (isDemoTenant(tenantId)) {
    await upsertIntegration(tenantId, 'meta', 'demo-token', null, null, 'ads_read,ads_management,read_insights', 'act_demo123456', 'demo@demo-store.com');
    const base = request.nextUrl.origin || 'https://app.ainomiq.com';
    return Response.redirect(`${base}/dashboard/settings`);
  }

  const intent = request.nextUrl.searchParams.get('intent')
  const isContentConnect = intent === 'content' || intent === 'messaging' || intent === 'posting'
  const requestedPlatform = (request.nextUrl.searchParams.get('platform') || '').toLowerCase()
  const contentPlatform = ['instagram', 'facebook', 'both'].includes(requestedPlatform) ? requestedPlatform : 'both'
  const contentIntent = ['messaging', 'posting'].includes(intent || '') ? intent : 'content'
  const returnTo = request.nextUrl.searchParams.get('return_to')?.trim() || null
  const state = randomBytes(16).toString('hex')
  await createOAuthState(
    state,
    tenantId,
    isContentConnect ? `meta_content_${contentPlatform}_${contentIntent}` : 'meta',
    undefined,
    returnTo,
  )

  let requestedScopes = '';
  if (intent === 'messaging') {
    requestedScopes = 'pages_show_list,pages_manage_metadata,pages_read_engagement,pages_messaging,instagram_basic,instagram_manage_comments,instagram_manage_messages,business_management,pages_read_user_content,pages_manage_engagement';
  } else if (intent === 'posting') {
    requestedScopes = 'pages_show_list,pages_manage_metadata,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_manage_comments,instagram_content_publish,business_management,pages_read_user_content,pages_manage_engagement';
  } else if (isContentConnect) {
    requestedScopes = 'pages_show_list,pages_manage_metadata,pages_read_engagement,pages_messaging,pages_manage_posts,instagram_basic,instagram_manage_comments,instagram_manage_messages,instagram_content_publish,business_management,pages_read_user_content,pages_manage_engagement';
  } else {
    requestedScopes = 'ads_read,ads_management,read_insights,pages_read_engagement,business_management';
  }

  const params = new URLSearchParams({
    client_id: getEnv('META_APP_ID'),
    redirect_uri: getEnv('META_REDIRECT_URI'),
    response_type: 'code',
    scope: requestedScopes,
    state,
  })

  if (isContentConnect) {
    params.set('auth_type', 'rerequest')
    params.set('enable_profile_selector', 'true')
  }

  // Use client-side redirect to avoid Chrome Safe Browsing flag
  const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`
  return new Response(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${authUrl}"><title>Redirecting...</title></head><body style="background:#f5f7fb;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><div style="text-align:center"><div style="width:24px;height:24px;border:2px solid #e2e6ef;border-top-color:#3b82f6;border-radius:50%;animation:s .6s linear infinite;margin:0 auto 12px"></div><p style="color:#6b7280;font-size:14px">${isContentConnect ? 'Connecting Instagram and Facebook...' : 'Connecting to Meta...'}</p></div><style>@keyframes s{to{transform:rotate(360deg)}}</style><script>window.location.href="${authUrl}"</script></body></html>`, {
    headers: { 'Content-Type': 'text/html' },
  })
}
