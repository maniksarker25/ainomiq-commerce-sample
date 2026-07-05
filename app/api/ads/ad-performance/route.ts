import { NextRequest } from 'next/server';
import { getMetaTokenAndFetch, MetaError } from '@/lib/meta';
import { validateTenantId, checkRateLimit, ValidationError } from '@/lib/validate-tenant';
import { getDatePresetInline } from '@/lib/ads-helpers';
import { isDemoTenant } from '@/lib/demo';
import { getDemoAdsAdPerformance } from '@/lib/demo-data';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

function detectPersona(adName: string): string {
  const upper = adName.toUpperCase();
  if (upper.includes('CLEAN') || upper.includes('AESTHETIC')) return 'CLEAN';
  if (upper.includes('HUMOR')) return 'HUMOR';
  if (upper.includes('COMFORT')) return 'COMFORT';
  if (upper.includes('FOMO')) return 'FOMO';
  return 'OTHER';
}

// Kill/Scale thresholds
const BREAK_EVEN_ROAS = 1.44;
const KILL_CPA = 25;
const KILL_SPEND_MIN = 30;
const KILL_CPA_SPEND_MIN = 50;
const KILL_ZERO_PURCHASE_SPEND = 25;
const SCALE_ROAS_MIN = 2.0;
const SCALE_SPEND_MIN = 50;
const SCALE_ROAS_HIGH = 2.5;
const SCALE_PURCHASES_MIN = 5;

function findPurchaseMetric(items: Array<{ action_type: string; value: string }> = []) {
  return items.find(item =>
    ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase'].includes(item.action_type)
  );
}

function getAdVerdict(spend: number, roas: number, cpa: number, purchases: number): string | null {
  // Kill conditions
  if (spend >= KILL_SPEND_MIN && roas < 1.0) return 'KILL';
  if (spend >= KILL_CPA_SPEND_MIN && cpa > KILL_CPA) return 'KILL';
  if (spend >= KILL_ZERO_PURCHASE_SPEND && purchases === 0) return 'KILL';
  // Scale conditions
  if (spend >= SCALE_SPEND_MIN && roas >= SCALE_ROAS_MIN) return 'SCALE';
  if (roas >= SCALE_ROAS_HIGH && purchases >= SCALE_PURCHASES_MIN) return 'SCALE';
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
    return Response.json(getDemoAdsAdPerformance());
  }

  try {
    const data = await getMetaTokenAndFetch(
      tenantId,
      `/{ad_account_id}/ads?fields=name,status,insights.${getDatePresetInline(request)}{spend,actions,action_values,purchase_roas,impressions,clicks,ctr,cpc,cpm,frequency}&effective_status=["ACTIVE","PAUSED"]&limit=200`,
    );

    const ads = (data.data || []).map((ad: {
      id: string;
      name: string;
      status: string;
      insights?: { data?: Array<{
        spend?: string;
        actions?: Array<{ action_type: string; value: string }>;
        action_values?: Array<{ action_type: string; value: string }>;
        purchase_roas?: Array<{ value: string }>;
        impressions?: string;
        clicks?: string;
        ctr?: string;
        cpc?: string;
        cpm?: string;
        frequency?: string;
      }> };
    }) => {
      const insights = ad.insights?.data?.[0];
      const spend = parseFloat(insights?.spend || '0');

      const purchaseAction = findPurchaseMetric(insights?.actions || []);
      const purchases = purchaseAction ? parseInt(purchaseAction.value) : 0;

      const revenueAction = findPurchaseMetric(insights?.action_values || []);
      const revenue = revenueAction ? parseFloat(revenueAction.value) : 0;

      const roas = insights?.purchase_roas?.[0]?.value
        ? parseFloat(insights.purchase_roas[0].value)
        : (spend > 0 ? revenue / spend : 0);

      const cpa = purchases > 0 ? spend / purchases : 0;
      const ctr = parseFloat(insights?.ctr || '0');
      const cpc = parseFloat(insights?.cpc || '0');
      const cpm = parseFloat(insights?.cpm || '0');
      const impressions = parseInt(insights?.impressions || '0');
      const clicks = parseInt(insights?.clicks || '0');
      const frequency = parseFloat(insights?.frequency || '0');

      const persona = detectPersona(ad.name || '');
      const verdict = getAdVerdict(spend, roas, cpa, purchases);

      return {
        id: ad.id,
        name: ad.name,
        persona,
        status: ad.status,
        spend,
        revenue,
        roas: parseFloat(roas.toFixed(2)),
        cpa: parseFloat(cpa.toFixed(2)),
        ctr: parseFloat(ctr.toFixed(2)),
        cpc: parseFloat(cpc.toFixed(2)),
        cpm: parseFloat(cpm.toFixed(2)),
        impressions,
        clicks,
        purchases,
        frequency: parseFloat(frequency.toFixed(2)),
        verdict,
      };
    });

    // Sort by spend descending
    ads.sort((a: { spend: number }, b: { spend: number }) => b.spend - a.spend);

    return Response.json({ ads });
  } catch (err) {
    if (err instanceof MetaError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error('[Ads Ad Performance]', err);
    return Response.json({ error: 'Failed to fetch ad performance' }, { status: 500 });
  }
}
