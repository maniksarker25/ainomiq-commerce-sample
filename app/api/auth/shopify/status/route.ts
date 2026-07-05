import { isDemoTenant, DEMO_INTEGRATION_STATUS } from '@/lib/demo'
import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'

import { getIntegrationWithAliases, resolveCanonicalTenantId } from '@/lib/db'

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenant_id')?.trim() || ''

  if (tenantId && isDemoTenant(tenantId)) {
    return Response.json(DEMO_INTEGRATION_STATUS['shopify'] || { connected: false })
  }

  if (!tenantId) {
    return Response.json({ connected: false })
  }

  const canonical = await resolveCanonicalTenantId(tenantId)
  const integration = await getIntegrationWithAliases(canonical, 'shopify')
  if (!integration) {
    return Response.json({ connected: false })
  }

  return Response.json({
    connected: true,
    shop: integration.provider_account_id,
    email: integration.provider_email,
    connectedAt: integration.created_at,
  })
}
