import { NextRequest } from 'next/server';
import { isDemoTenant } from '@/lib/demo';
import { getDemoCsEmails } from '@/lib/demo-data';
import { getGmailTokenAndFetch, parseEmailHeaders, GmailError } from '@/lib/gmail';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';

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
  const days = daysParam ? parseInt(daysParam, 10) : 7;
  const sinceParam = request.nextUrl.searchParams.get('since');

  if (isDemoTenant(tenantId)) {
    return Response.json(getDemoCsEmails());
  }

  try {
    const afterDate = sinceParam || formatDateForGmail(days);
    const listRes = await getGmailTokenAndFetch(
      tenantId,
      `/messages?q=in:inbox after:${afterDate}&maxResults=50`
    );

    const messageStubs = listRes.messages || [];
    if (messageStubs.length === 0) {
      return Response.json({ emails: [], total: 0 });
    }

    // Fetch label names for ID→name mapping
    const labelsRes = await getGmailTokenAndFetch(tenantId, '/labels');
    const labelMap: Record<string, string> = {};
    for (const l of (labelsRes.labels || [])) {
      labelMap[l.id] = l.name;
    }

    // Fetch each message individually (Gmail has no batch endpoint via REST)
    const emails = await Promise.all(
      messageStubs.slice(0, 50).map(async (stub: { id: string }) => {
        try {
          const msg = await getGmailTokenAndFetch(
            tenantId,
            `/messages/${stub.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Delivered-To`
          );
          const parsed = parseEmailHeaders(msg);
          // Resolve label IDs to names
          parsed.labels = parsed.labels.map((id: string) => labelMap[id] || id);
          return parsed;
        } catch {
          return null;
        }
      })
    );

    const validEmails = emails.filter(Boolean);
    return Response.json({ emails: validEmails, total: validEmails.length });
  } catch (err) {
    if (err instanceof GmailError && err.status === 401) {
      return Response.json({
        error: 'Google token expired. Please reconnect your Google account in Settings.',
      });
    }
    console.error('[CS emails] Error:', err);
    return Response.json({ error: 'Failed to fetch emails' }, { status: 500 });
  }
}
