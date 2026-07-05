import { NextRequest } from 'next/server';
import { getMetaTokenAndFetch, MetaError } from '@/lib/meta';
import { isDemoTenant } from '@/lib/demo';
import { getDemoAdsCampaigns } from '@/lib/demo-data';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

function findPurchaseMetric(items: Array<{ action_type: string; value: string }> = []) {
  return items.find(item =>
    ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase'].includes(item.action_type)
  );
}

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  const days = parseInt(request.nextUrl.searchParams.get('days') || '7');
  const datePreset = days <= 1 ? 'today' : days <= 7 ? 'last_7d' : days <= 14 ? 'last_14d' : days <= 30 ? 'last_30d' : 'last_90d';

  if (isDemoTenant(tenantId)) {
    const demoCampaigns = getDemoAdsCampaigns().campaigns.map((campaign, index) => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      effective_status: campaign.status,
      objective: campaign.objective,
      spend: [1284.62, 634.18, 902.44, 431.77, 0][index] || 0,
      impressions: [84210, 39110, 60240, 28190, 0][index] || 0,
      reach: [51220, 22150, 41880, 17400, 0][index] || 0,
      clicks: [1872, 816, 1290, 522, 0][index] || 0,
      cpc: [0.69, 0.78, 0.70, 0.83, 0][index] || 0,
      cpm: [15.25, 16.22, 14.98, 15.32, 0][index] || 0,
      ctr: [2.22, 2.09, 2.14, 1.85, 0][index] || 0,
      frequency: [1.64, 1.77, 1.44, 1.62, 0][index] || 0,
      purchases: [82, 38, 55, 19, 0][index] || 0,
      purchaseValue: [3264.72, 1468.44, 2140.25, 719.81, 0][index] || 0,
      roas: [2.54, 2.32, 2.37, 1.67, 0][index] || 0,
    }));
    return Response.json({
      campaigns: demoCampaigns,
      totalSpend: demoCampaigns.reduce((sum, c) => sum + c.spend, 0),
      totalImpressions: demoCampaigns.reduce((sum, c) => sum + c.impressions, 0),
      totalPurchases: demoCampaigns.reduce((sum, c) => sum + c.purchases, 0),
    });
  }

  try {
    const campaignsData = await getMetaTokenAndFetch(
      tenantId,
      '/{ad_account_id}/campaigns?fields=name,status,effective_status,objective,daily_budget,lifetime_budget&effective_status=["ACTIVE","PAUSED"]&limit=50',
    );

    const campaigns = campaignsData.data || [];

    const insightsPromises = campaigns.map(async (c: { id: string; name: string; status: string; effective_status?: string; objective: string; daily_budget?: string; lifetime_budget?: string }) => {
      try {
        const insights = await getMetaTokenAndFetch(
          tenantId,
          `/${c.id}/insights?fields=spend,impressions,clicks,cpc,cpm,ctr,actions,action_values,purchase_roas,reach,frequency&date_preset=${datePreset}`,
        );
        const row = insights.data?.[0] || {};
        const purchases = findPurchaseMetric(row.actions || []);
        const purchaseValue = findPurchaseMetric(row.action_values || []);
        return {
          id: c.id, name: c.name, status: c.status, objective: c.objective,
          effective_status: c.effective_status || c.status,
          spend: parseFloat(row.spend || '0'),
          impressions: parseInt(row.impressions || '0'),
          reach: parseInt(row.reach || '0'),
          clicks: parseInt(row.clicks || '0'),
          cpc: parseFloat(row.cpc || '0'),
          cpm: parseFloat(row.cpm || '0'),
          ctr: parseFloat(row.ctr || '0'),
          frequency: parseFloat(row.frequency || '0'),
          purchases: purchases ? parseInt(purchases.value) : 0,
          purchaseValue: purchaseValue ? parseFloat(purchaseValue.value) : 0,
          roas: row.purchase_roas?.[0] ? parseFloat(row.purchase_roas[0].value) : 0,
        };
      } catch {
        return {
          id: c.id, name: c.name, status: c.status, objective: c.objective,
          effective_status: c.effective_status || c.status,
          spend: 0, impressions: 0, reach: 0, clicks: 0,
          cpc: 0, cpm: 0, ctr: 0, frequency: 0,
          purchases: 0, purchaseValue: 0, roas: 0,
        };
      }
    });

    const campaignInsights = await Promise.all(insightsPromises);
    campaignInsights.sort((a, b) => b.spend - a.spend);

    return Response.json({
      campaigns: campaignInsights,
      totalSpend: campaignInsights.reduce((sum, c) => sum + c.spend, 0),
      totalImpressions: campaignInsights.reduce((sum, c) => sum + c.impressions, 0),
      totalPurchases: campaignInsights.reduce((sum, c) => sum + c.purchases, 0),
    });
  } catch (err) {
    if (err instanceof MetaError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error('[Campaign Insights]', err);
    return Response.json({ error: 'Failed to fetch campaign insights' }, { status: 500 });
  }
}
