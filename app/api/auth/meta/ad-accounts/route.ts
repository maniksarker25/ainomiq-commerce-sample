import { NextRequest } from 'next/server';
import { validateTenantId, checkRateLimit, ValidationError } from '@/lib/validate-tenant';
import { getIntegration } from '@/lib/db';
import { MetaError, metaFetch } from '@/lib/meta';
import { isDemoTenant } from '@/lib/demo';
import { getDemoAdsAdAccounts } from '@/lib/demo-data';

export const dynamic = 'force-dynamic';

/**
 * GET: List all ad accounts the user has access to.
 * Called after OAuth to let user pick which ad account to use.
 */
export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = validateTenantId(request);
    checkRateLimit(tenantId, 'meta/ad-accounts');
  } catch (err) {
    if (err instanceof ValidationError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  if (isDemoTenant(tenantId)) {
    return Response.json(getDemoAdsAdAccounts());
  }

  try {
    const integration = await getIntegration(tenantId, 'meta');
    if (!integration) {
      return Response.json({ error: 'Meta not connected' }, { status: 401 });
    }

    const token = integration.access_token as string;

    // Fetch all ad accounts the user has access to
    const data = await metaFetch(token, '/me/adaccounts?fields=id,name,account_id,account_status,currency,business_name,timezone_name&limit=50');

    const accounts = (data.data || []).map((acc: {
      id: string;
      name: string;
      account_id: string;
      account_status: number;
      currency: string;
      business_name?: string;
      timezone_name?: string;
    }) => ({
      id: acc.id, // act_XXXXX format
      name: acc.name,
      accountId: acc.account_id,
      status: acc.account_status === 1 ? 'active' : acc.account_status === 2 ? 'disabled' : 'other',
      currency: acc.currency,
      businessName: acc.business_name || null,
      timezone: acc.timezone_name || null,
    }));

    return Response.json({ accounts });
  } catch (err) {
    if (err instanceof MetaError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error('[Meta Ad Accounts]', err);
    return Response.json({ error: 'Failed to fetch ad accounts' }, { status: 500 });
  }
}
