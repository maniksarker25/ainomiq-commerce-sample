import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import twilio from 'twilio';

export const dynamic = 'force-dynamic';

function normalizeE164(input?: string): string {
  return (input || '').replace(/[\s().-]/g, '');
}

function sanitizeBaseUrl(input?: string): string {
  return (input || 'https://app.ainomiq.com').trim().replace(/\s+/g, '').replace(/\/+$/, '');
}

function getWebhookUrls() {
  const base = sanitizeBaseUrl(process.env.APP_BASE_URL);
  return {
    voice: (process.env.TWILIO_VOICE_WEBHOOK_URL || `${base}/api/webhooks/twilio/voice`).trim().replace(/\s+/g, ''),
    voiceStatus: (process.env.TWILIO_VOICE_STATUS_WEBHOOK_URL || `${base}/api/webhooks/twilio/voice-status`).trim().replace(/\s+/g, ''),
    sms: (process.env.TWILIO_SMS_WEBHOOK_URL || `${base}/api/webhooks/twilio/sms`).trim().replace(/\s+/g, ''),
  };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  let tenantId: string;
  try {
    tenantId = await requireAuth(request, body.tenant_id);
  } catch (err) {
    return handleAuthError(err);
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    return Response.json({
      valid: false,
      error: 'Twilio credentials missing on server',
      tenantId,
    }, { status: 503 });
  }

  const number = normalizeE164(body.phoneNumber);
  if (!/^\+[1-9]\d{7,14}$/.test(number)) {
    return Response.json({ valid: false, error: 'Use E.164 format like +31612345678' }, { status: 400 });
  }

  try {
    const client = twilio(accountSid, authToken,
      process.env.TWILIO_REGION ? { region: process.env.TWILIO_REGION, edge: 'dublin' } : {}
    );
    const existing = await client.incomingPhoneNumbers.list({ phoneNumber: number, limit: 1 });

    if (!existing.length) {
      return Response.json({ valid: false, error: `Number ${number} is not found in this Twilio account` }, { status: 404 });
    }

    const current = existing[0];
    const hooks = getWebhookUrls();

    const updated = await client.incomingPhoneNumbers(current.sid).update({
      voiceUrl: hooks.voice,
      voiceMethod: 'POST',
      statusCallback: hooks.voiceStatus,
      statusCallbackMethod: 'POST',
      smsUrl: hooks.sms,
      smsMethod: 'POST',
    });

    return Response.json({
      valid: true,
      phoneNumber: updated.phoneNumber,
      sid: updated.sid,
      webhookStatus: 'updated',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown Twilio validation error';
    return Response.json({ valid: false, error: message }, { status: 500 });
  }
}
