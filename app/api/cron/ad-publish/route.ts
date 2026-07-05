import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyCronAuth } from '@/lib/cron-auth';
import { publishJobToMeta } from '@/lib/ad-manager/publisher';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    // Find jobs that are either:
    // 1. 'ready' (queued by user, and need publishing)
    // 2. stuck 'publishing' (started more than 15 minutes ago)
    const pendingJobs = await db.execute({
      sql: `SELECT id, tenant_id, status, created_at, started_at
            FROM ad_publish_jobs
            WHERE status = 'ready'
               OR (status = 'publishing' AND started_at < datetime('now', '-15 minutes'))
            ORDER BY created_at ASC
            LIMIT 5`,
    });

    console.log(`[Ad Publish Cron] Found ${pendingJobs.rows.length} pending publish jobs.`);

    const results: Record<string, { success: boolean; message?: string; error?: string }> = {};

    for (const row of pendingJobs.rows) {
      const jobId = String(row.id);
      const tenantId = String(row.tenant_id);

      try {
        console.log(`[Ad Publish Cron] Processing job ${jobId} for tenant ${tenantId}`);
        const res = await publishJobToMeta(tenantId, jobId);
        results[jobId] = res;
      } catch (err: any) {
        console.error(`[Ad Publish Cron] Failed to process job ${jobId}:`, err);
        results[jobId] = {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    return Response.json({
      ok: true,
      processed: pendingJobs.rows.length,
      durationMs: Date.now() - startTime,
      results,
    });
  } catch (err: any) {
    console.error('[Ad Publish Cron] Fatal error:', err);
    return Response.json({ error: 'Internal error', details: err?.message }, { status: 500 });
  }
}
