import { NextRequest } from 'next/server';
import { getContentPublishingTenants, getTenantConfig } from '@/lib/db';
import { verifyCronAuth } from '@/lib/cron-auth';
import {
  CONTENT_PIPELINE_CONFIG_KEY,
  parseContentPipelinePublishConfig,
  processTenantScheduledPosts,
} from '@/lib/content-studio-schedule';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    const tenants = await getContentPublishingTenants();
    console.log(`[Content Publish Cron] Processing ${tenants.length} tenants`);

    const results: Record<
      string,
      { due: number; published: number; failed: number; skipped: number }
    > = {};

    for (const tenantId of tenants) {
      try {
        const raw = await getTenantConfig(tenantId, CONTENT_PIPELINE_CONFIG_KEY);
        const pipelineConfig = parseContentPipelinePublishConfig(raw);
        if (!pipelineConfig) {
          results[tenantId] = { due: 0, published: 0, failed: 0, skipped: 1 };
          continue;
        }
        results[tenantId] = await processTenantScheduledPosts(tenantId, pipelineConfig);
      } catch (err) {
        console.error(`[Content Publish Cron] Tenant ${tenantId} failed:`, err);
        results[tenantId] = { due: 0, published: 0, failed: 1, skipped: 0 };
      }
    }

    const published = Object.values(results).reduce((sum, row) => sum + row.published, 0);
    const failed = Object.values(results).reduce((sum, row) => sum + row.failed, 0);
    const due = Object.values(results).reduce((sum, row) => sum + row.due, 0);

    console.log(
      `[Content Publish Cron] Done in ${Date.now() - startTime}ms - due: ${due}, published: ${published}, failed: ${failed}`,
    );

    return Response.json({
      ok: true,
      tenants: tenants.length,
      due,
      published,
      failed,
      durationMs: Date.now() - startTime,
      details: results,
    });
  } catch (err) {
    console.error('[Content Publish Cron] Fatal error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
