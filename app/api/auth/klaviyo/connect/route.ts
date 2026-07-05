import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'

import { getEnv } from '@/lib/oauth-config'
import { createOAuthState, upsertIntegration } from '@/lib/db'
import { isDemoTenant } from '@/lib/demo'
import { randomBytes, createHash } from 'crypto'

function generatePKCE() {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenant_id')
  if (!tenantId) return new Response('Missing tenant_id', { status: 400 })

  // Demo tenant: fake instant connect
  if (isDemoTenant(tenantId)) {
    await upsertIntegration(tenantId, 'klaviyo', 'demo-token', null, null, 'accounts:read campaigns:read flows:read metrics:read profiles:read', 'demo-klaviyo-account', 'demo@demo-store.com');
    const base = request.nextUrl.origin || 'https://app.ainomiq.com';
    return Response.redirect(`${base}/dashboard/settings`);
  }

  const { verifier, challenge } = generatePKCE()
  const state = randomBytes(16).toString('hex')
  
  // Store state + PKCE verifier for callback
  await createOAuthState(state, tenantId, 'klaviyo', verifier)

  const params = new URLSearchParams({
    client_id: getEnv('KLAVIYO_CLIENT_ID'),
    redirect_uri: getEnv('KLAVIYO_REDIRECT_URI'),
    response_type: 'code',
    scope: 'accounts:read campaigns:read flows:read metrics:read profiles:read profiles:write segments:read lists:read lists:write events:write',
    state,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  })

  return Response.redirect(`https://www.klaviyo.com/oauth/authorize?${params.toString()}`)
}
