import { NextRequest } from 'next/server';
import { isDemoTenant } from '@/lib/demo';
import { getDemoCsStats } from '@/lib/demo-data';
import { getGmailTokenAndFetch, GmailError } from '@/lib/gmail';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { getTenantConfig, countCsCalls } from '@/lib/db';

export const dynamic = 'force-dynamic';

function formatDateForGmail(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  const daysParam = request.nextUrl.searchParams.get('days');
  const sinceParam = request.nextUrl.searchParams.get('since'); // YYYY/MM/DD from client timezone
  const days = daysParam ? parseInt(daysParam, 10) : 7;

  if (isDemoTenant(tenantId)) {
    return Response.json(getDemoCsStats());
  }

  try {
    const afterDate = sinceParam || formatDateForGmail(days);
    const todayDate = formatDateForGmail(0);

    // Count messages by paginating through IDs (more accurate than resultSizeEstimate)
    async function countMessages(query: string): Promise<number> {
      let count = 0;
      let pageToken: string | undefined;
      do {
        const url = `/messages?q=${encodeURIComponent(query)}&maxResults=100${pageToken ? `&pageToken=${pageToken}` : ''}`;
        const res = await getGmailTokenAndFetch(tenantId, url);
        count += (res.messages || []).length;
        pageToken = res.nextPageToken;
        if (count >= 500) break; // Safety limit
      } while (pageToken);
      return count;
    }

    const [received, handled, sentToday, unread] = await Promise.all([
      countMessages(`in:inbox after:${afterDate}`),
      countMessages(`in:sent after:${afterDate}`),
      countMessages(`in:sent after:${todayDate}`),
      countMessages(`in:inbox is:unread after:${afterDate}`),
    ]);

    // Escalated (AINOMIQ_ESCALATED label)
    let escalated = 0;
    try {
      const labels = await getGmailTokenAndFetch(tenantId, '/labels');
      const escLabel = labels.labels?.find((l: { name: string }) =>
        l.name === 'AINOMIQ_ESCALATED' || l.name.toLowerCase().includes('escalat')
      );
      if (escLabel) {
        escalated = await countMessages(`label:${escLabel.name} after:${afterDate}`);
      }
    } catch { /* non-critical */ }

    // Avg response time estimate: use 2h as default, we'd need thread analysis for real calc
    const avgResponseTime = handled > 0 ? '~2h' : '-';

    let calls = 0;
    try {
      const realCalls = await countCsCalls(tenantId, days || 7);
      if (realCalls > 0) {
        calls = realCalls;
      } else {
        const runtimeRaw = await getTenantConfig(tenantId, 'cs_runtime_config');
        if (runtimeRaw) {
          const runtime = JSON.parse(runtimeRaw) as { expectedVolume?: { callsPerMonth?: number } };
          const monthly = Number(runtime?.expectedVolume?.callsPerMonth || 0);
          calls = Math.max(0, Math.round((monthly / 30) * (days || 7)));
        }
      }
    } catch {
      calls = 0;
    }

    return Response.json({
      received,
      unread,
      handled,
      sentToday,
      escalated,
      avgResponseTime,
      calls,
    });
  } catch (err) {
    if (err instanceof GmailError && err.status === 401) {
      return Response.json({
        error: 'Google token expired. Please reconnect your Google account in Settings.',
      });
    }
    console.error('[CS stats] Error:', err);
    return Response.json({
      received: 0, unread: 0, handled: 0, sentToday: 0, escalated: 0, avgResponseTime: '-', calls: 0,
    });
  }
}
