import { isDemoTenant } from '@/lib/demo'
import { NextRequest } from 'next/server'
import { verifyJwt, COOKIE_NAME } from '@/lib/jwt'
export const dynamic = 'force-dynamic'

import { disconnectIntegration } from '@/lib/db'

export async function POST(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const jwt = await verifyJwt(token)
  if (!jwt) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { tenant_id, provider, service } = await request.json()
  if (!tenant_id) return Response.json({ error: 'Missing tenant_id' }, { status: 400 })

  if (jwt.email !== tenant_id && jwt.tenantId !== tenant_id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (isDemoTenant(tenant_id)) {
    return Response.json({ disconnected: true })
  }

  const requested = String(provider || service || 'google').toLowerCase()
  const targetProvider = requested === 'drive' || requested === 'google_drive'
    ? 'google_drive'
    : requested === 'gmail'
      ? 'google'
      : requested === 'google_calendar'
        ? 'google_calendar'
        : 'google'
  await disconnectIntegration(tenant_id, targetProvider)
  return Response.json({ disconnected: true })
}
