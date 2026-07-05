import { NextRequest } from 'next/server';
import { isDemoTenant } from '@/lib/demo';
import { getGmailTokenAndFetch, parseEmailHeaders, GmailError } from '@/lib/gmail';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

function formatDateForGmail(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
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
    const { getDemoCsEscalations } = await import('@/lib/demo-data');
    return Response.json(getDemoCsEscalations());
  }

  try {
    const afterDate = sinceParam || formatDateForGmail(days);

    // Find all emails with AINOMIQ_ESCALATED label
    const labelsRes = await getGmailTokenAndFetch(tenantId, '/labels');
    const escLabel = labelsRes.labels?.find((l: { name: string }) => l.name === 'AINOMIQ_ESCALATED');
    if (!escLabel) return Response.json({ escalations: [] });

    const listRes = await getGmailTokenAndFetch(
      tenantId,
      `/messages?q=label:${escLabel.name} after:${afterDate}&maxResults=20`
    );

    const messageStubs = listRes.messages || [];
    if (messageStubs.length === 0) return Response.json({ escalations: [] });

    // For each escalated email, find the corresponding escalation email in Sent
    const escalations = await Promise.all(
      messageStubs.slice(0, 20).map(async (stub: { id: string }) => {
        try {
          // Get the original email
          const msg = await getGmailTokenAndFetch(
            tenantId,
            `/messages/${stub.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`
          );
          const original = parseEmailHeaders(msg);

          // Get the thread to find the escalation email (sent by bot with "CS Escalation:" subject)
          const threadRes = await getGmailTokenAndFetch(tenantId, `/threads/${msg.threadId}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject`);
          let escalatedTo = 'Unknown';
          
          // Also check sent emails with "CS Escalation:" that reference this customer
          const fromName = original.from?.split('<')[0]?.trim() || '';
          const fromEmail = original.from?.match(/<(.+)>/)?.[1] || original.from || '';
          
          // Search for the escalation email in sent folder
          const searchQuery = `in:sent subject:"CS Escalation" "${fromEmail || fromName}" after:${afterDate}`;
          try {
            const sentRes = await getGmailTokenAndFetch(
              tenantId,
              `/messages?q=${encodeURIComponent(searchQuery)}&maxResults=1`
            );
            if (sentRes.messages?.length > 0) {
              const escMsg = await getGmailTokenAndFetch(
                tenantId,
                `/messages/${sentRes.messages[0].id}?format=full`
              );
              // Headers can be lowercase (to, from) or capitalized (To, From)
              const toHeader = escMsg.payload?.headers?.find((h: {name: string}) => h.name.toLowerCase() === 'to');
              if (toHeader) {
                escalatedTo = toHeader.value;
              }
            }
          } catch {
            // Fall back to thread-based detection
          }

          // Determine status: check if there's a reply after escalation
          const isUnread = msg.labelIds?.includes('UNREAD');

          return {
            id: original.id,
            subject: original.subject,
            from: original.from,
            date: original.date || new Date(parseInt(original.internalDate)).toISOString(),
            escalatedTo,
            status: isUnread ? 'waiting' : 'resolved',
            threadId: msg.threadId,
          };
        } catch {
          return null;
        }
      })
    );

    return Response.json({ escalations: escalations.filter(Boolean) });
  } catch (err) {
    if (err instanceof GmailError && err.status === 401) {
      return Response.json({ error: 'Google token expired' });
    }
    console.error('[CS escalations] Error:', err);
    return Response.json({ error: 'Failed to fetch escalations' }, { status: 500 });
  }
}
