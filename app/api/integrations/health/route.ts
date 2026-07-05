import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { getIntegrations } from '@/lib/db';
import { isDemoTenant, DEMO_INTEGRATION_STATUS } from '@/lib/demo';

export const dynamic = 'force-dynamic';

interface IntegrationHealth {
  provider: string;
  connected: boolean;
  tokenStatus: 'healthy' | 'expiring_soon' | 'expired' | 'unknown';
  expiresAt: string | null;
  daysUntilExpiry: number | null;
  action: string | null;
}

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  if (isDemoTenant(tenantId)) {
    const health: IntegrationHealth[] = Object.keys(DEMO_INTEGRATION_STATUS).map(provider => ({
      provider,
      connected: true,
      tokenStatus: 'healthy' as const,
      expiresAt: null,
      daysUntilExpiry: null,
      action: null,
    }));
    return Response.json({ health, overall: 'healthy' });
  }

  const integrations = await getIntegrations(tenantId);
  const health: IntegrationHealth[] = [];
  const now = Date.now();

  for (const integration of integrations) {
    const provider = integration.provider as string;
    const expiresAt = integration.token_expires_at as string | null;
    const accessToken = integration.access_token as string | null;

    let tokenStatus: IntegrationHealth['tokenStatus'] = 'unknown';
    let daysUntilExpiry: number | null = null;
    let action: string | null = null;

    if (!accessToken) {
      tokenStatus = 'expired';
      action = 'Reconnect required';
    } else if (expiresAt) {
      const expiry = new Date(expiresAt).getTime();
      daysUntilExpiry = Math.round((expiry - now) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry <= 0) {
        tokenStatus = 'expired';
        action = 'Reconnect required - token has expired';
      } else if (daysUntilExpiry <= 7) {
        tokenStatus = 'expiring_soon';
        action = `Token expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'} - will auto-refresh on next use`;
      } else {
        tokenStatus = 'healthy';
      }
    } else {
      // No expiry = permanent token (system user tokens, Shopify access tokens)
      tokenStatus = 'healthy';
    }

    health.push({
      provider,
      connected: !!accessToken,
      tokenStatus,
      expiresAt,
      daysUntilExpiry,
      action,
    });
  }

  const overall = health.some(h => h.tokenStatus === 'expired')
    ? 'action_required'
    : health.some(h => h.tokenStatus === 'expiring_soon')
    ? 'warning'
    : 'healthy';

  return Response.json({ health, overall });
}
