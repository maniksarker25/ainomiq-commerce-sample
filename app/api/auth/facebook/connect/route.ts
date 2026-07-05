import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'

import { getEnv } from '@/lib/oauth-config'
import { createOAuthState, upsertIntegration } from '@/lib/db'
import { isDemoTenant } from '@/lib/demo'
import { resolveAppBaseUrl } from '@/lib/oauth-return-url'
import { randomBytes } from 'crypto'

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenant_id')
  if (!tenantId) return new Response('Missing tenant_id', { status: 400 })

  if (isDemoTenant(tenantId)) {
    await upsertIntegration(tenantId, 'facebook', 'demo-token', null, null, 'pages_messaging', null, 'demo@demo-store.com')
    const base = request.nextUrl.origin || 'https://app.ainomiq.com'
    return Response.redirect(`${base}/dashboard/settings`)
  }

  const state = randomBytes(16).toString('hex')
  await createOAuthState(state, tenantId, 'facebook')

  const params = new URLSearchParams({
    client_id: getEnv('META_APP_ID'),
    redirect_uri: `${resolveAppBaseUrl(request)}/api/auth/facebook/callback`,
    response_type: 'code',
    scope: 'pages_messaging,pages_show_list,pages_manage_metadata,pages_read_engagement,pages_read_user_content,pages_manage_engagement',
    state,
  })

  const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`
  return new Response(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${authUrl}"><title>Redirecting...</title></head><body style="background:#f5f7fb;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><div style="text-align:center"><div style="width:24px;height:24px;border:2px solid #e2e6ef;border-top-color:#1877F2;border-radius:50%;animation:s .6s linear infinite;margin:0 auto 12px"></div><p style="color:#6b7280;font-size:14px">Connecting to Facebook...</p></div><style>@keyframes s{to{transform:rotate(360deg)}}</style><script>window.location.href="${authUrl}"</script></body></html>`, {
    headers: { 'Content-Type': 'text/html' },
  })
}
