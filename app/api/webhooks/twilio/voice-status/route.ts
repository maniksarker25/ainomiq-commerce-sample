import { NextRequest } from 'next/server';
import { findTenantByTwilioNumber, upsertCsCall, getTenantConfig } from '@/lib/db';
import { getGmailTokenAndFetch } from '@/lib/gmail';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const form = await request.formData();

  const callSid = String(form.get('CallSid') || '').trim();
  const from = String(form.get('From') || '').trim();
  const to = String(form.get('To') || '').trim();
  const direction = String(form.get('Direction') || '').trim();
  const callStatus = String(form.get('CallStatus') || '').trim();
  const duration = Number(form.get('CallDuration') || 0);
  const recordingUrl = String(form.get('RecordingUrl') || '').trim();

  if (!callSid || !to) return Response.json({ ok: true });

  const tenantId = await findTenantByTwilioNumber(to);
  if (!tenantId) {
    console.log('[Twilio Voice Status] Unknown tenant for number:', to);
    return Response.json({ ok: true });
  }

  await upsertCsCall({
    tenantId,
    callSid,
    fromNumber: from,
    toNumber: to,
    direction,
    callStatus,
    durationSec: Number.isFinite(duration) ? duration : 0,
    recordingUrl: recordingUrl || undefined,
  });

  // Send simple call report email when call is completed
  if (callStatus === 'completed') {
    try {
      const escalationContact = await getTenantConfig(tenantId, 'cs_escalation_contact');
      const fallbackTo = escalationContact || tenantId;
      const subject = `Call report - ${from || 'Unknown caller'} - ${to}`;
      const body = [
        `Call report`,
        ``,
        `Tenant: ${tenantId}`,
        `Call SID: ${callSid}`,
        `From: ${from}`,
        `To: ${to}`,
        `Status: ${callStatus}`,
        `Duration: ${Number.isFinite(duration) ? duration : 0}s`,
        recordingUrl ? `Recording: ${recordingUrl}` : 'Recording: (none)',
      ].join('\n');

      const raw = Buffer.from(
        [
          `To: ${fallbackTo}`,
          `Subject: ${subject}`,
          `Content-Type: text/plain; charset=utf-8`,
          `MIME-Version: 1.0`,
          ``,
          body,
        ].join('\r\n')
      ).toString('base64url');

      await getGmailTokenAndFetch(tenantId, '/messages/send', {
        method: 'POST',
        body: JSON.stringify({ raw }),
      });
    } catch (err) {
      console.error('[Twilio Voice Status] Failed sending call report email:', err);
    }
  }

  return Response.json({ ok: true });
}
