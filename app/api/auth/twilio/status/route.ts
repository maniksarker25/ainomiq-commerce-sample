import { NextRequest } from 'next/server';
import twilio from 'twilio';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { getTenantConfig, setTenantConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';

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

function normalize(input?: string): string {
  return (input || '').trim().replace(/\s+/g, '');
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireAuth(request);

    const raw = await getTenantConfig(tenantId, 'cs_twilio_provisioning');
    if (raw) {
      const parsed = JSON.parse(raw) as {
        phone?: { phoneNumber?: string; status?: string };
        runtime?: { number?: string };
      };

      const number = parsed?.phone?.phoneNumber || parsed?.runtime?.number || '';
      const connected = Boolean(number);

      if (connected) {
        return Response.json({
          connected,
          number,
          status: parsed?.phone?.status || 'configured',
          source: 'tenant_config',
        });
      }
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      return Response.json({ connected: false, reason: 'missing_twilio_credentials' });
    }

    const client = twilio(accountSid, authToken,
      process.env.TWILIO_REGION ? { region: process.env.TWILIO_REGION, edge: 'dublin' } : {}
    );
    const numbers = await client.incomingPhoneNumbers.list({ limit: 20 });
    if (!numbers.length) {
      return Response.json({ connected: false, reason: 'no_numbers_in_account' });
    }

    const hooks = getWebhookUrls();
    const expectedVoice = normalize(hooks.voice);
    const expectedStatus = normalize(hooks.voiceStatus);

    const matched = numbers.find((n) => {
      const voice = normalize(n.voiceUrl || undefined);
      const status = normalize(n.statusCallback || undefined);
      return voice === expectedVoice && status === expectedStatus;
    }) || numbers[0];

    const number = matched.phoneNumber || '';
    const connected = Boolean(number);

    if (!connected) {
      return Response.json({ connected: false, reason: 'number_not_resolved' });
    }

    // Auto-configure webhooks if not set
    const currentVoice = normalize(matched.voiceUrl || undefined);
    if (currentVoice !== expectedVoice && matched.sid) {
      try {
        await client.incomingPhoneNumbers(matched.sid).update({
          voiceUrl: hooks.voice,
          voiceMethod: 'POST',
          statusCallback: hooks.voiceStatus,
          statusCallbackMethod: 'POST',
          smsUrl: hooks.sms,
          smsMethod: 'POST',
        });
      } catch (e) {
        console.error('[Twilio Status] Failed to auto-configure webhooks:', e);
      }
    }

    const twilioProvisioning = {
      requestedAt: new Date().toISOString(),
      phone: {
        status: 'configured_existing',
        phoneNumber: number,
        sid: matched.sid,
        message: 'Detected from Twilio account and synchronized',
      },
      runtime: {
        number,
      },
    };

    await setTenantConfig(tenantId, 'cs_twilio_provisioning', JSON.stringify(twilioProvisioning));

    const runtimeRaw = await getTenantConfig(tenantId, 'cs_runtime_config');
    if (!runtimeRaw) {
      await setTenantConfig(tenantId, 'cs_runtime_config', JSON.stringify({
        number,
        language: 'English',
        voiceStyle: 'friendly',
      }));
    }

    return Response.json({
      connected: true,
      number,
      status: 'configured_existing',
      source: 'twilio_autodiscovery',
      matchedWebhook: normalize(matched.voiceUrl || undefined) === expectedVoice,
    });
  } catch (err) {
    try {
      return handleAuthError(err);
    } catch {
      return Response.json({ connected: false });
    }
  }
}
