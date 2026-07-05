import { isDemoTenant } from '@/lib/demo'
import { NextRequest } from 'next/server'
import { verifyJwt, COOKIE_NAME } from '@/lib/jwt'
export const dynamic = 'force-dynamic'

import {
  disconnectIntegration,
  getIntegration,
  updateIntegrationScopes,
  purgeMetaCachedData,
  revokeMetaAccess,
} from '@/lib/db'

function removeScopes(existingScopesStr: string, scopesToRemove: string[]): string {
  const current = existingScopesStr.split(',').map(s => s.trim()).filter(Boolean);
  const remaining = current.filter(s => !scopesToRemove.includes(s));
  return remaining.join(',');
}

async function fullMetaDisconnect(tenantId: string) {
  await revokeMetaAccess(tenantId);
  await purgeMetaCachedData(tenantId);
  await Promise.all([
    disconnectIntegration(tenantId, 'meta'),
    disconnectIntegration(tenantId, 'facebook'),
    disconnectIntegration(tenantId, 'instagram'),
  ]);
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const jwt = await verifyJwt(token)
  if (!jwt) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { tenant_id, provider } = await request.json()
  if (!tenant_id) return Response.json({ error: 'Missing tenant_id' }, { status: 400 })

  if (jwt.email !== tenant_id && jwt.tenantId !== tenant_id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (isDemoTenant(tenant_id)) {
    return Response.json({ disconnected: true })
  }

  const MESSAGING_SCOPES = ['pages_messaging', 'instagram_manage_messages', 'pages_read_user_content', 'pages_manage_engagement']
  const POSTING_SCOPES = ['pages_manage_posts', 'instagram_content_publish']

  if (provider === 'meta_ads' || provider === 'meta') {
    const activeFb = await getIntegration(tenant_id, 'facebook')
    const activeIg = await getIntegration(tenant_id, 'instagram')
    if (!activeFb && !activeIg) {
      await fullMetaDisconnect(tenant_id)
    } else {
      await disconnectIntegration(tenant_id, 'meta')
    }
  } else if (provider === 'meta_messaging') {
    const activeFb = await getIntegration(tenant_id, 'facebook')
    const activeIg = await getIntegration(tenant_id, 'instagram')
    const fbScopes = String(activeFb?.scopes || '')
    const igScopes = String(activeIg?.scopes || '')
    
    const hasPosting = fbScopes.toLowerCase().includes('pages_manage_posts') || 
                      fbScopes.toLowerCase().includes('instagram_content_publish') ||
                      igScopes.toLowerCase().includes('pages_manage_posts') ||
                      igScopes.toLowerCase().includes('instagram_content_publish')

    if (hasPosting) {
      if (activeFb) {
        const remainingFb = removeScopes(fbScopes, MESSAGING_SCOPES)
        await updateIntegrationScopes(tenant_id, 'facebook', remainingFb)
      }
      if (activeIg) {
        const remainingIg = removeScopes(igScopes, MESSAGING_SCOPES)
        await updateIntegrationScopes(tenant_id, 'instagram', remainingIg)
      }
    } else {
      const activeMeta = await getIntegration(tenant_id, 'meta')
      if (!activeMeta) {
        await fullMetaDisconnect(tenant_id)
      } else {
        await revokeMetaAccess(tenant_id)
        await purgeMetaCachedData(tenant_id)
        await Promise.all([
          disconnectIntegration(tenant_id, 'facebook'),
          disconnectIntegration(tenant_id, 'instagram'),
        ])
      }
    }
  } else if (provider === 'meta_posting') {
    const activeFb = await getIntegration(tenant_id, 'facebook')
    const activeIg = await getIntegration(tenant_id, 'instagram')
    const fbScopes = String(activeFb?.scopes || '')
    const igScopes = String(activeIg?.scopes || '')
    
    const hasMessaging = fbScopes.toLowerCase().includes('pages_messaging') || 
                        fbScopes.toLowerCase().includes('instagram_manage_messages') ||
                        igScopes.toLowerCase().includes('pages_messaging') ||
                        igScopes.toLowerCase().includes('instagram_manage_messages')

    if (hasMessaging) {
      if (activeFb) {
        const remainingFb = removeScopes(fbScopes, POSTING_SCOPES)
        await updateIntegrationScopes(tenant_id, 'facebook', remainingFb)
      }
      if (activeIg) {
        const remainingIg = removeScopes(igScopes, POSTING_SCOPES)
        await updateIntegrationScopes(tenant_id, 'instagram', remainingIg)
      }
    } else {
      const activeMeta = await getIntegration(tenant_id, 'meta')
      if (!activeMeta) {
        await fullMetaDisconnect(tenant_id)
      } else {
        await revokeMetaAccess(tenant_id)
        await purgeMetaCachedData(tenant_id)
        await Promise.all([
          disconnectIntegration(tenant_id, 'facebook'),
          disconnectIntegration(tenant_id, 'instagram'),
        ])
      }
    }
  } else {
    await fullMetaDisconnect(tenant_id)
  }

  return Response.json({ disconnected: true })
}
