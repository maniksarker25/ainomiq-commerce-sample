import { isDemoTenant, DEMO_INTEGRATION_STATUS } from '@/lib/demo'
import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'

import { getIntegrationWithAliases } from '@/lib/db'

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenant_id')

  if (tenantId && isDemoTenant(tenantId)) {
    return Response.json(DEMO_INTEGRATION_STATUS['meta'] || { connected: false })
  }

  if (!tenantId) {
    return Response.json({ connected: false })
  }

  const integration = await getIntegrationWithAliases(tenantId, 'meta')
  if (!integration?.access_token) {
    return Response.json({ connected: false })
  }

  // Verify token validity against Meta Graph API
  const verifyRes = await fetch(`https://graph.facebook.com/v21.0/me/permissions?access_token=${encodeURIComponent(integration.access_token as string)}`, { cache: 'no-store' })
  if (!verifyRes.ok) {
    const errorData = await verifyRes.json().catch(() => null)
    const { handleMetaApiError } = await import('@/lib/cs-social')
    const revoked = await handleMetaApiError(tenantId, errorData)
    if (revoked) {
      return Response.json({ connected: false })
    }
  }

  const rawAccountId = (integration.provider_account_id as string) || ''
  const accountIds = rawAccountId.split(',').map((s: string) => s.trim()).filter(Boolean)
  return Response.json({
    connected: true,
    accountName: integration.provider_email,
    email: integration.provider_email,
    accountId: rawAccountId,
    accountIds,
    connectedAt: integration.created_at,
  })
}
