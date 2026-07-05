import { NextRequest } from 'next/server';
import { isDemoTenant } from '@/lib/demo';
import { getDemoCsEmailDetail } from '@/lib/demo-data';
import { getGmailTokenAndFetch, parseEmailHeaders, parseEmailBodyParts, GmailError } from '@/lib/gmail';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  const h = headers.find((h: { name: string }) => h.name.toLowerCase() === name.toLowerCase());
  return h?.value || '';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth check
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }
  const { id } = await params;

  if (isDemoTenant(tenantId)) {
    return Response.json(getDemoCsEmailDetail(id));
  }

  try {
    // Fetch full message
    const msg = await getGmailTokenAndFetch(tenantId, `/messages/${id}?format=full`);
    const parsed = parseEmailHeaders(msg);
    const { text, html } = parseEmailBodyParts(msg.payload);

    // Fetch thread for conversation view
    let thread: Array<{
      id: string;
      from: string;
      date: string;
      snippet: string;
      subject: string;
      isSent: boolean;
    }> = [];

    if (msg.threadId) {
      try {
        const threadRes = await getGmailTokenAndFetch(tenantId, `/threads/${msg.threadId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`);
        thread = (threadRes.messages || [])
          .filter((m: any) => m.id !== id) // exclude current message
          .map((m: any) => ({
            id: m.id,
            from: getHeader(m.payload.headers, 'From'),
            date: getHeader(m.payload.headers, 'Date'),
            snippet: m.snippet || '',
            subject: getHeader(m.payload.headers, 'Subject'),
            isSent: (m.labelIds || []).includes('SENT'),
          }));
      } catch {
        // Non-critical: thread fetch failed
      }
    }

    return Response.json({
      ...parsed,
      body: text,
      htmlBody: html,
      thread,
    });
  } catch (err) {
    if (err instanceof GmailError && err.status === 401) {
      return Response.json({
        error: 'Google token expired. Please reconnect your Google account in Settings.',
      });
    }
    console.error('[CS email detail] Error:', err);
    return Response.json({ error: 'Failed to fetch email' }, { status: 500 });
  }
}
