import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { getGmailToken, gmailFetch, GmailError } from '@/lib/gmail';
import { getIntegration } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  // Check if google is connected
  const integration = await getIntegration(tenantId, 'google');
  if (!integration || integration.status === 'revoked') {
    return Response.json({ connected: false });
  }

  try {
    const token = await getGmailToken(tenantId);

    // Fetch profile and labels in parallel
    const [profile, labelsRes] = await Promise.all([
      gmailFetch(token, '/profile'),
      gmailFetch(token, '/labels'),
    ]);

    // Extract useful labels (skip system internals)
    const systemLabels = new Set([
      'CHAT', 'IMPORTANT', 'CATEGORY_PERSONAL', 'CATEGORY_SOCIAL',
      'CATEGORY_UPDATES', 'CATEGORY_FORUMS', 'CATEGORY_PROMOTIONS',
      'STARRED', 'UNREAD',
    ]);

    const labels = (labelsRes.labels || [])
      .filter((l: { id: string; type: string }) =>
        l.type === 'user' || (!systemLabels.has(l.id) && ['INBOX', 'SENT', 'DRAFT', 'TRASH', 'SPAM'].includes(l.id) === false)
      )
      .map((l: { id: string; name: string; type: string }) => ({
        id: l.id,
        name: l.name,
        type: l.type,
      }));

    // Get send-as aliases (different email addresses the user can send from)
    let sendAsEmails: string[] = [];
    try {
      const sendAs = await gmailFetch(token, '/settings/sendAs');
      sendAsEmails = (sendAs.sendAs || []).map((s: { sendAsEmail: string }) => s.sendAsEmail);
    } catch {
      // settings/sendAs may fail without full permissions, fallback to profile email
      sendAsEmails = [profile.emailAddress];
    }

    return Response.json({
      connected: true,
      email: profile.emailAddress,
      messagesTotal: profile.messagesTotal,
      threadsTotal: profile.threadsTotal,
      sendAsEmails,
      labels,
    });
  } catch (err) {
    if (err instanceof GmailError && err.status === 401) {
      return Response.json({ connected: false, error: 'Token expired. Please reconnect.' });
    }
    console.error('[email-info] Error:', err);
    return Response.json({ error: 'Failed to fetch email info' }, { status: 500 });
  }
}
