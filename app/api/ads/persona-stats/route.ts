import { NextRequest } from 'next/server';
import { getMetaTokenAndFetch, MetaError } from '@/lib/meta';
import { validateTenantId, checkRateLimit, ValidationError } from '@/lib/validate-tenant';
import { getDatePresetInline } from '@/lib/ads-helpers';
import { isDemoTenant } from '@/lib/demo';
import { getDemoAdsPersonaStats } from '@/lib/demo-data';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

const PERSONAS = ['HUMOR', 'COMFORT', 'FOMO', 'CLEAN'] as const;

function detectPersona(adName: string): string | null {
  const upper = adName.toUpperCase();
  if (upper.includes('CLEAN') || upper.includes('AESTHETIC')) return 'CLEAN';
  if (upper.includes('HUMOR')) return 'HUMOR';
  if (upper.includes('COMFORT')) return 'COMFORT';
  if (upper.includes('FOMO')) return 'FOMO';
  return null;
}

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  if (isDemoTenant(tenantId)) {
    return Response.json(getDemoAdsPersonaStats());
  }

  try {
    const data = await getMetaTokenAndFetch(
      tenantId,
      `/{ad_account_id}/ads?fields=name,insights.${getDatePresetInline(request)}{spend,actions,action_values,purchase_roas,impressions,clicks}&effective_status=["ACTIVE","PAUSED"]&limit=200`,
    );

    const ads = data.data || [];

    const personaMap: Record<string, { spend: number; revenue: number; purchases: number; adCount: number }> = {};
    for (const p of PERSONAS) {
      personaMap[p] = { spend: 0, revenue: 0, purchases: 0, adCount: 0 };
    }

    for (const ad of ads) {
      const persona = detectPersona(ad.name || '');
      if (!persona) continue;

      const insights = ad.insights?.data?.[0];
      if (!insights) {
        personaMap[persona].adCount++;
        continue;
      }

      const spend = parseFloat(insights.spend || '0');
      const purchaseAction = (insights.actions || []).find(
        (a: { action_type: string }) => a.action_type === 'purchase' || a.action_type === 'omni_purchase'
      );
      const purchases = purchaseAction ? parseInt(purchaseAction.value) : 0;

      const revenueAction = (insights.action_values || []).find(
        (a: { action_type: string }) => a.action_type === 'purchase' || a.action_type === 'omni_purchase'
      );
      const revenue = revenueAction ? parseFloat(revenueAction.value) : 0;

      personaMap[persona].spend += spend;
      personaMap[persona].revenue += revenue;
      personaMap[persona].purchases += purchases;
      personaMap[persona].adCount++;
    }

    const result = PERSONAS.map((persona) => {
      const d = personaMap[persona];
      const roas = d.spend > 0 ? d.revenue / d.spend : 0;
      const cpa = d.purchases > 0 ? d.spend / d.purchases : 0;
      return {
        persona,
        spend: d.spend,
        revenue: d.revenue,
        purchases: d.purchases,
        roas: parseFloat(roas.toFixed(2)),
        cpa: parseFloat(cpa.toFixed(2)),
        adCount: d.adCount,
      };
    });

    return Response.json({ personas: result });
  } catch (err) {
    if (err instanceof MetaError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error('[Ads Persona Stats]', err);
    return Response.json({ error: 'Failed to fetch persona stats' }, { status: 500 });
  }
}
