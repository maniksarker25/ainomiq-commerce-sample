import { NextRequest } from 'next/server';
import { getMetaTokenAndFetch, MetaError } from '@/lib/meta';
import { validateTenantId, checkRateLimit, ValidationError } from '@/lib/validate-tenant';
import { getDateParam } from '@/lib/ads-helpers';
import { isDemoTenant } from '@/lib/demo';
import { getDemoAdsStats } from '@/lib/demo-data';
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
    return Response.json(getDemoAdsStats());
  }

  try {
    const data = await getMetaTokenAndFetch(
      tenantId,
      `/{ad_account_id}/insights?fields=spend,impressions,clicks,cpc,actions,action_values,purchase_roas&date_preset=${getDateParam(request)}`,
    );

    const insights = data.data?.[0];
    if (!insights) {
      return Response.json({
        totalSpend: '0.00',
        roas: '0.00',
        totalPurchases: 0,
        avgCpc: '0.00',
      });
    }

    // Extract purchases from actions array
    const purchaseAction = (insights.actions || []).find(
      (a: { action_type: string }) => a.action_type === 'purchase' || a.action_type === 'omni_purchase'
    );
    const totalPurchases = purchaseAction ? parseInt(purchaseAction.value) : 0;

    // ROAS
    const roasData = insights.purchase_roas;
    const roas = roasData?.[0]?.value
      ? parseFloat(roasData[0].value).toFixed(2)
      : '0.00';

    return Response.json({
      totalSpend: parseFloat(insights.spend || '0').toFixed(2),
      roas,
      totalPurchases,
      avgCpc: parseFloat(insights.cpc || '0').toFixed(2),
    });
  } catch (err) {
    if (err instanceof MetaError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error('[Ads Stats]', err);
    return Response.json({ error: 'Failed to fetch ad stats' }, { status: 500 });
  }
}
