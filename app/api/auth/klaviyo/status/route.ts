import { isDemoTenant, DEMO_INTEGRATION_STATUS } from '@/lib/demo'
import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'

import { getIntegration } from '@/lib/db'

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenant_id')
  // Demo tenant - return fake connected status
  if (tenantId && isDemoTenant(tenantId)) {
    return Response.json(DEMO_INTEGRATION_STATUS['klaviyo'] || { connected: false })
  }

  if (!tenantId) {
    return Response.json({ connected: false })
  }

  const integration = await getIntegration(tenantId, 'klaviyo')
  if (!integration) {
    return Response.json({ connected: false })
  }

  return Response.json({
    connected: true,
    accountId: integration.provider_account_id,
    email: integration.provider_email,
    connectedAt: integration.created_at,
  })
}
