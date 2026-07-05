import { isDemoTenant, DEMO_INTEGRATION_STATUS } from '@/lib/demo'
import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'

import { getIntegrationWithAliases } from '@/lib/db'
import { requireAuth, handleAuthError } from '@/lib/auth-guard'

export async function GET(request: NextRequest) {
  let tenantId: string
  try {
    tenantId = await requireAuth(request)
  } catch (err) {
    return handleAuthError(err)
  }
  // Demo tenant - return fake connected status
  if (isDemoTenant(tenantId)) {
    return Response.json(DEMO_INTEGRATION_STATUS['google'] || { connected: false })
  }

  const service = (request.nextUrl.searchParams.get('service') || 'gmail').toLowerCase()
  const provider = service === 'drive' || service === 'google_drive' ? 'google_drive' : service === 'calendar' || service === 'google_calendar' ? 'google_calendar' : 'gmail'
  const integration = await getIntegrationWithAliases(tenantId, provider)
  const legacyGoogle = integration ? null : await getIntegrationWithAliases(tenantId, 'google')
  const legacyScopes = String(legacyGoogle?.scopes || '').toLowerCase()
  const legacyHasToken = Boolean(legacyGoogle?.access_token)
  const legacyMatchesService = service === 'drive' || service === 'google_drive'
    ? legacyScopes.includes('drive')
    : service === 'calendar' || service === 'google_calendar'
      ? legacyScopes.includes('calendar')
      : legacyScopes.includes('gmail') || legacyScopes.includes('mail.google') || legacyHasToken
  const resolvedIntegration = integration || (legacyMatchesService ? legacyGoogle : null)
  if (!resolvedIntegration) {
    return Response.json({ connected: false })
  }

  return Response.json({
    connected: true,
    email: resolvedIntegration.provider_email,
    connectedAt: resolvedIntegration.created_at,
    scopes: resolvedIntegration.scopes || '',
  })
}
