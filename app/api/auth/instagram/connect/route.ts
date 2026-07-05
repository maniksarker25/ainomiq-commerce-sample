import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'

import type { MetaConnectIntent } from '@/lib/meta-oauth'

const ALLOWED_INTENTS: MetaConnectIntent[] = ['content', 'messaging', 'posting']

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenant_id')
  if (!tenantId) return new Response('Missing tenant_id', { status: 400 })

  const intentParam = request.nextUrl.searchParams.get('intent')?.trim() || 'content'
  const intent = ALLOWED_INTENTS.includes(intentParam as MetaConnectIntent)
    ? intentParam
    : 'content'
  const returnTo = request.nextUrl.searchParams.get('return_to')?.trim()
    || request.nextUrl.searchParams.get('returnTo')?.trim()
    || null

  const base = request.nextUrl.origin || process.env.APP_BASE_URL?.trim() || 'https://app.ainomiq.com'
  const params = new URLSearchParams({
    tenant_id: tenantId,
    intent,
    force: '1',
    platform: 'instagram',
  })
  if (returnTo) params.set('return_to', returnTo)

  return Response.redirect(`${base}/api/auth/meta/connect?${params.toString()}`)
}
