import { NextRequest } from 'next/server';
import { getMetaTokenAndFetch, MetaError } from '@/lib/meta';
import { isDemoTenant } from '@/lib/demo';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

type MetaAdset = {
  id: string;
  name: string;
  status?: string;
  effective_status?: string;
  campaign_id?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  targeting?: unknown;
  promoted_object?: unknown;
  optimization_goal?: string;
  billing_event?: string;
  bid_strategy?: string;
  bid_amount?: string;
};

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  if (isDemoTenant(tenantId)) {
    return Response.json({ adsets: [] });
  }

  const campaignId = request.nextUrl.searchParams.get('campaign_id') || '';
  const fields = 'id,name,status,effective_status,campaign_id,daily_budget,lifetime_budget,targeting,promoted_object,optimization_goal,billing_event,bid_strategy,bid_amount';
  const path = campaignId
    ? `/${encodeURIComponent(campaignId)}/adsets?fields=${fields}&limit=100`
    : `/{ad_account_id}/adsets?fields=${fields}&effective_status=["ACTIVE","PAUSED"]&limit=100`;

  try {
    const data = await getMetaTokenAndFetch(tenantId, path);
    const adsets = (data.data || []).map((adset: MetaAdset) => ({
      id: adset.id,
      name: adset.name,
      status: adset.status,
      effectiveStatus: adset.effective_status || adset.status,
      campaign_id: adset.campaign_id,
      daily_budget: adset.daily_budget,
      lifetime_budget: adset.lifetime_budget,
      targeting: adset.targeting || {},
      promoted_object: adset.promoted_object || null,
      optimization_goal: adset.optimization_goal || null,
      billing_event: adset.billing_event || null,
      bid_strategy: adset.bid_strategy || null,
      bid_amount: adset.bid_amount || null,
    }));
    return Response.json({ adsets });
  } catch (err) {
    if (err instanceof MetaError) return Response.json({ error: err.message }, { status: err.status });
    console.error('[Meta Adsets]', err);
    return Response.json({ error: 'Failed to fetch Meta ad sets' }, { status: 500 });
  }
}
