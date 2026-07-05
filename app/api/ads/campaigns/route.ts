import { NextRequest } from 'next/server';
import { getMetaTokenAndFetch, MetaError } from '@/lib/meta';
import { validateTenantId, checkRateLimit, ValidationError } from '@/lib/validate-tenant';
import { isDemoTenant } from '@/lib/demo';
import { getDemoAdsCampaigns } from '@/lib/demo-data';
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
    return Response.json(getDemoAdsCampaigns());
  }

  try {
    const data = await getMetaTokenAndFetch(
      tenantId,
      '/{ad_account_id}/campaigns?fields=name,status,effective_status,objective,daily_budget,lifetime_budget,start_time&effective_status=["ACTIVE","PAUSED"]&limit=50',
    );

    const campaigns = (data.data || []).map((c: {
      id: string;
      name: string;
      status: string;
      effective_status?: string;
      objective: string;
      daily_budget?: string;
      lifetime_budget?: string;
      start_time?: string;
    }) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      effectiveStatus: c.effective_status || c.status,
      objective: c.objective,
      dailyBudget: c.daily_budget ? (parseInt(c.daily_budget) / 100).toFixed(2) : null,
      lifetimeBudget: c.lifetime_budget ? (parseInt(c.lifetime_budget) / 100).toFixed(2) : null,
      startTime: c.start_time || null,
    }));

    return Response.json({ campaigns });
  } catch (err) {
    if (err instanceof MetaError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error('[Ads Campaigns]', err);
    return Response.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}
