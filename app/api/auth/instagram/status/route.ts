import { isDemoTenant } from '@/lib/demo';
import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { getIntegrationWithAliases } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let tenantId = '';

  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  if (isDemoTenant(tenantId)) {
    return Response.json({
      connected: true,
      username: 'demo_store',
      accountId: '17841400000000000',
      permissions: [
        'instagram_business_basic',
        'instagram_business_manage_messages',
        'instagram_business_manage_comments',
      ],
      connectedAt: '2026-02-15T10:20:00Z',
    });
  }

  const integration = await getIntegrationWithAliases(tenantId, 'instagram');
  if (!integration) {
    return Response.json({
      connected: false,
      username: null,
      accountId: null,
      permissions: [],
      connectedAt: null,
    });
  }

  // Verify token validity against Meta Graph API
  if (integration.access_token) {
    const verifyRes = await fetch(`https://graph.facebook.com/v21.0/me/permissions?access_token=${encodeURIComponent(integration.access_token as string)}`, { cache: 'no-store' })
    if (!verifyRes.ok) {
      const errorData = await verifyRes.json().catch(() => null)
      const { handleMetaApiError } = await import('@/lib/cs-social')
      const revoked = await handleMetaApiError(tenantId, errorData)
      if (revoked) {
        return Response.json({
          connected: false,
          username: null,
          accountId: null,
          permissions: [],
          connectedAt: null,
        });
      }
    }
  }

  const permissions = String(integration.scopes || '')
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);

  return Response.json({
    connected: true,
    username: integration.provider_email || integration.provider_account_id || null,
    accountId: integration.provider_account_id || null,
    permissions,
    connectedAt: integration.created_at || null,
  });
}
