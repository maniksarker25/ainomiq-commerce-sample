import { NextRequest } from 'next/server';
import { getMetaTokenAndFetch, MetaError } from '@/lib/meta';
import { validateTenantId, checkRateLimit, ValidationError } from '@/lib/validate-tenant';
import { isDemoTenant } from '@/lib/demo';
import { getDemoAdsInsights } from '@/lib/demo-data';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  if (isDemoTenant(tenantId)) {
    return Response.json(getDemoAdsInsights());
  }

  try {
    // Fetch 7-day and today insights in parallel
    const [weekData, todayData] = await Promise.all([
      getMetaTokenAndFetch(
        tenantId,
        '/{ad_account_id}/insights?fields=spend,impressions,clicks,cpc,cpm,ctr,actions,action_values,purchase_roas&date_preset=last_7d',
      ),
      getMetaTokenAndFetch(
        tenantId,
        '/{ad_account_id}/insights?fields=spend,impressions,clicks,cpc,cpm,ctr,actions,action_values,purchase_roas&date_preset=today',
      ),
    ]);

    return Response.json({
      week: weekData.data?.[0] || null,
      today: todayData.data?.[0] || null,
    });
  } catch (err) {
    if (err instanceof MetaError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error('[Ads Insights]', err);
    return Response.json({ error: 'Failed to fetch insights' }, { status: 500 });
  }
}
