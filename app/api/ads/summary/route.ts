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
    return Response.json({
      totalSpend: 2847.32,
      roas: 3.41,
      purchases: 127,
      cpa: 22.42,
      cpc: 0.68,
      ctr: 2.27,
      ads: [
        { name: 'HUMOR - Spring Jeans Reel', roas: 3.76, spend: 342.10, purchases: 18 },
        { name: 'CLEAN - Minimal Lookbook', roas: 3.69, spend: 298.45, purchases: 14 },
        { name: 'COMFORT - Hoodie Lifestyle', roas: 3.48, spend: 274.80, purchases: 12 },
        { name: 'FOMO - Limited Drop Banner', roas: 3.30, spend: 256.30, purchases: 11 },
        { name: 'HUMOR - Cargo Pants TikTok', roas: 3.45, spend: 218.50, purchases: 10 },
      ],
    });
  }

  try {
    const data = await getMetaTokenAndFetch(
      tenantId,
      `/{ad_account_id}/insights?fields=spend,impressions,clicks,cpc,actions,action_values,purchase_roas&date_preset=${getDateParam(request)}`,
    );

    const insights = data.data?.[0];
    if (!insights) {
      return Response.json({
        totalSpend: 0,
        roas: 0,
        purchases: 0,
        cpa: 0,
        cpc: 0,
        ctr: 0,
        ads: [],
      });
    }

    // Extract purchases from actions array
    const purchaseAction = (insights.actions || []).find(
      (a: { action_type: string }) => a.action_type === 'purchase' || a.action_type === 'omni_purchase'
    );
    const purchases = purchaseAction ? parseInt(purchaseAction.value) : 0;

    // ROAS
    const roasData = insights.purchase_roas;
    const roas = roasData?.[0]?.value
      ? parseFloat(roasData[0].value).toFixed(2)
      : '0.00';

    // Calculate CPA (cost per purchase)
    const cpa = purchases > 0 ? parseFloat(insights.spend || '0') / purchases : 0;
    // CTR
    const ctr = insights.impressions && insights.clicks ? (insights.clicks / insights.impressions) * 100 : 0;

    // For now, return empty ads array. Later we can fetch actual ads.
    return Response.json({
      totalSpend: parseFloat(insights.spend || '0'),
      roas: parseFloat(roas),
      purchases,
      cpa: parseFloat(cpa.toFixed(2)),
      cpc: parseFloat(insights.cpc || '0'),
      ctr: parseFloat(ctr.toFixed(2)),
      ads: [],
    });
  } catch (err) {
    if (err instanceof MetaError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error('[Ads Summary]', err);
    return Response.json({ error: 'Failed to fetch ad summary' }, { status: 500 });
  }
}
