import { NextRequest } from 'next/server';
import { getGmailTokenAndFetch, GmailError } from '@/lib/gmail';
import { isDemoTenant } from '@/lib/demo';
import { verifyJwt, COOKIE_NAME } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Verify JWT
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const jwt = await verifyJwt(token);
    if (!jwt) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { tenant_id, threadId, messageId, to, subject, body } = await request.json();

    if (!tenant_id || !threadId || !to || !body) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify tenant matches JWT
    if (jwt.email !== tenant_id && jwt.tenantId !== tenant_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Demo tenant: fake send
    if (isDemoTenant(tenant_id)) {
      return Response.json({ sent: true, messageId: 'demo-sent-' + Date.now() });
    }

    // First, try to get the real Message-ID header for proper threading
    let inReplyTo = '';
    let references = '';
    if (messageId) {
      try {
        const msg = await getGmailTokenAndFetch(
          tenant_id,
          `/messages/${messageId}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References`,
          { method: 'GET' }
        );
        const headers = msg.payload?.headers || [];
        const msgIdH = headers.find((h: { name: string }) => h.name.toLowerCase() === 'message-id');
        const refsH = headers.find((h: { name: string }) => h.name.toLowerCase() === 'references');
        if (msgIdH) {
          inReplyTo = msgIdH.value;
          references = refsH ? `${refsH.value} ${msgIdH.value}` : msgIdH.value;
        }
      } catch {
        // If we can't get headers, send without In-Reply-To
        console.warn('[CS Reply] Could not fetch message headers, sending without In-Reply-To');
      }
    }

    const lines = [
      `To: ${to}`,
      `Subject: ${subject?.startsWith('Re:') ? subject : `Re: ${subject || ''}`}`,
      ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`, `References: ${references}`] : []),
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      body,
    ];
    const raw = Buffer.from(lines.join('\r\n')).toString('base64url');

    const result = await getGmailTokenAndFetch(
      tenant_id,
      '/messages/send',
      {
        method: 'POST',
        body: JSON.stringify({ raw, threadId }),
      },
    );

    return Response.json({ sent: true, messageId: result.id });
  } catch (err) {
    if (err instanceof GmailError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error('[CS Reply]', err);
    return Response.json({ error: 'Failed to send reply' }, { status: 500 });
  }
}
