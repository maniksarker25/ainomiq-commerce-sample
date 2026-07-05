import { NextRequest } from 'next/server';
import { validateTenantId, checkRateLimit, ValidationError } from '@/lib/validate-tenant';
import { getMetaTokenAndFetch, MetaError } from '@/lib/meta';
import { getAssetLibraryStats } from '@/lib/asset-library';
import { isDemoTenant } from '@/lib/demo';
import { getDemoAdsAgentStatus } from '@/lib/demo-data';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

const BREAK_EVEN_ROAS = 1.44;

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  if (isDemoTenant(tenantId)) {
    return Response.json(getDemoAdsAgentStatus());
  }

  try {
    // Fetch live data from both Meta and Ainomiq Library in parallel
    const [library, metaData] = await Promise.all([
      getAssetLibraryStats(tenantId),
      getMetaTokenAndFetch(
        tenantId,
        '/{ad_account_id}/ads?fields=name,status,effective_status,insights.date_preset(last_7d){spend,actions,action_values,purchase_roas,frequency}&effective_status=["ACTIVE","PAUSED"]&limit=200',
      ).catch(() => ({ data: [] })),
    ]);

    const ads = metaData.data || [];
    let totalAds = 0;
    let activeAds = 0;
    let pausedAds = 0;
    let killedCount = 0;
    let fatigueCount = 0;
    let championsCount = 0;

    for (const ad of ads) {
      totalAds++;
      const status = ad.effective_status;
      if (status === 'ACTIVE') activeAds++;
      if (status === 'PAUSED') {
        pausedAds++;
        killedCount++; // paused = killed by agent or manual
      }

      const insights = ad.insights?.data?.[0];
      if (insights) {
        // Fatigued: frequency > 3.0
        const freq = parseFloat(insights.frequency || '0');
        if (freq > 3.0) fatigueCount++;

        // Champions: ROAS > break-even
        const roas = insights.purchase_roas?.[0]?.value
          ? parseFloat(insights.purchase_roas[0].value)
          : 0;
        if (roas >= BREAK_EVEN_ROAS && parseFloat(insights.spend || '0') > 10) {
          championsCount++;
        }
      }
    }

    return Response.json({
      lastBatch: null,
      contentStats: {
        totalAds,
        activeAds,
        contentUsed: library.used.total,
        contentInQueue: library.new.total,
        newImages: library.new.images,
        newVideos: library.new.videos,
        usedImages: library.used.images,
        usedVideos: library.used.videos,
        killedCount,
        fatigueAlertCount: fatigueCount,
        championsCount,
        libraryUpdated: library.updatedAt,
      },
      schedule: {
        monday: 'Generate new batch',
        wednesday: 'Midweek check',
        friday: 'Kill / Scale',
        sunday: 'Weekly report',
      },
    });
  } catch (err) {
    if (err instanceof MetaError) {
      // If Meta fails, still try the Ainomiq Library
      try {
        const library = await getAssetLibraryStats(tenantId);
        return Response.json({
          lastBatch: null,
          contentStats: {
            totalAds: 0, activeAds: 0,
            contentUsed: library.used.total, contentInQueue: library.new.total,
            newImages: library.new.images, newVideos: library.new.videos,
            usedImages: library.used.images, usedVideos: library.used.videos,
            killedCount: 0, fatigueAlertCount: 0, championsCount: 0,
            libraryUpdated: library.updatedAt,
          },
          schedule: { monday: 'Generate new batch', wednesday: 'Midweek check', friday: 'Kill / Scale', sunday: 'Weekly report' },
          metaError: err.message,
        });
      } catch { /* fall through */ }
    }
    console.error('[Ads Agent Status]', err);
    return Response.json({ error: 'Failed to fetch agent status' }, { status: 500 });
  }
}
