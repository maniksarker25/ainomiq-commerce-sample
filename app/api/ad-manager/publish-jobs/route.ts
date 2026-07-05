import { NextRequest, after } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { createPublishJob, listPublishJobs, getPublishJob } from '@/lib/ad-manager/db';
import { publishJobToMeta } from '@/lib/ad-manager/publisher';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function schedulePublish(tenantId: string, jobId: string) {
  after(async () => {
    try {
      await publishJobToMeta(tenantId, jobId);
    } catch (err) {
      console.error('[Ad Manager Publish Jobs] background publish failed:', err);
    }
  });
}

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  try {
    return Response.json({ publish_jobs: await listPublishJobs(tenantId) });
  } catch (err) {
    console.error('[Ad Manager Publish Jobs]', err);
    return Response.json({ error: 'Failed to load publish jobs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: any;
  let tenantId: string;
  try {
    body = await request.json();
    tenantId = await requireAuth(request, body.tenant_id);
  } catch (err) {
    return handleAuthError(err);
  }

  try {
    if (body.retry_job_id) {
      const jobId = String(body.retry_job_id);
      const job = await getPublishJob(tenantId, jobId);
      if (!job) {
        return Response.json({ error: 'Publish job not found' }, { status: 404 });
      }

      await db.execute({
        sql: `UPDATE ad_publish_jobs SET status = 'ready', error = null, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?`,
        args: [tenantId, jobId],
      });

      await db.execute({
        sql: `UPDATE ad_publish_items SET status = 'queued', error = null, updated_at = datetime('now') WHERE tenant_id = ? AND publish_job_id = ? AND status = 'failed'`,
        args: [tenantId, jobId],
      });

      schedulePublish(tenantId, jobId);
      return Response.json(
        {
          created: true,
          queued: true,
          job: await getPublishJob(tenantId, jobId),
          message: 'Retry queued. Track per-ad progress in Publish status.',
        },
        { status: 202 },
      );
    }

    const result = await createPublishJob(tenantId, body.plan_id, body.actor || tenantId);
    if (result.created && result.job) {
      const jobId = String(result.job.id);
      schedulePublish(tenantId, jobId);
      return Response.json(
        {
          ...result,
          queued: true,
          message: 'Publish job queued. Track per-ad progress in Publish status.',
        },
        { status: 202 },
      );
    }
    return Response.json(result, { status: 409 });
  } catch (err) {
    console.error('[Ad Manager Create Publish Job]', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Failed to create publish job' }, { status: 400 });
  }
}
