import twilio from 'twilio';

export interface ChannelUpsellData {
  whatsappUpsell: boolean;
  phoneNumberUpsell: boolean;
  preferredCountry: string;
  numberType: 'local' | 'mobile';
  numberContains?: string;
  useExistingNumber?: boolean;
  existingPhoneNumber?: string;
  preferredLanguage?: string;
  voiceStyle?: 'friendly' | 'professional' | 'warm';
}

interface ProvisionResult {
  status: 'purchased' | 'configured_existing' | 'skipped' | 'failed';
  phoneNumber?: string;
  sid?: string;
  message: string;
  e164Prefix?: string;
}

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;
  const opts: Record<string, string> = {};
  if (process.env.TWILIO_REGION) { opts.region = process.env.TWILIO_REGION; opts.edge = 'dublin'; }
  return twilio(accountSid, authToken, opts);
}

function cleanCountryCode(input: string) {
  const normalized = (input || 'NL').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : 'NL';
}

function getCountryDialPrefix(country: string): string {
  const map: Record<string, string> = {
    NL: '+31',
    BE: '+32',
    DE: '+49',
    GB: '+44',
    US: '+1',
    FR: '+33',
    ES: '+34',
  };
  return map[country] || '+31';
}

function normalizeE164(input?: string): string {
  return (input || '').replace(/[\s().-]/g, '');
}

function sanitizeBaseUrl(input?: string): string {
  return (input || 'https://app.ainomiq.com').trim().replace(/\s+/g, '').replace(/\/+$/, '');
}

function getWebhookUrls() {
  const base = sanitizeBaseUrl(process.env.APP_BASE_URL);
  const voice = (process.env.TWILIO_VOICE_WEBHOOK_URL || `${base}/api/webhooks/twilio/voice`).trim().replace(/\s+/g, '');
  const voiceStatus = (process.env.TWILIO_VOICE_STATUS_WEBHOOK_URL || `${base}/api/webhooks/twilio/voice-status`).trim().replace(/\s+/g, '');
  const sms = (process.env.TWILIO_SMS_WEBHOOK_URL || `${base}/api/webhooks/twilio/sms`).trim().replace(/\s+/g, '');

  return { voice, voiceStatus, sms };
}

export async function provisionPhoneNumber(upsell: ChannelUpsellData): Promise<ProvisionResult> {
  if (!upsell.phoneNumberUpsell) {
    return { status: 'skipped', message: 'Phone number upsell not selected' };
  }

  const client = getTwilioClient();
  if (!client) {
    return { status: 'failed', message: 'Twilio credentials missing on server' };
  }

  const country = cleanCountryCode(upsell.preferredCountry);
  const contains = upsell.numberContains?.replace(/\s+/g, '');
  const hooks = getWebhookUrls();

  try {
    if (upsell.useExistingNumber && upsell.existingPhoneNumber) {
      const target = normalizeE164(upsell.existingPhoneNumber);
      const existing = await client.incomingPhoneNumbers.list({ phoneNumber: target, limit: 1 });

      if (!existing.length) {
        return {
          status: 'failed',
          message: `Existing number ${target} was not found in your Twilio account`,
        };
      }

      const current = existing[0];
      const updated = await client.incomingPhoneNumbers(current.sid).update({
        voiceUrl: hooks.voice,
        voiceMethod: 'POST',
        statusCallback: hooks.voiceStatus,
        statusCallbackMethod: 'POST',
        smsUrl: hooks.sms,
        smsMethod: 'POST',
      });

      return {
        status: 'configured_existing',
        phoneNumber: updated.phoneNumber,
        sid: updated.sid,
        e164Prefix: updated.phoneNumber?.startsWith('+')
          ? `+${updated.phoneNumber.replace('+', '').slice(0, 2)}`
          : getCountryDialPrefix(country),
        message: 'Existing number found and webhooks configured',
      };
    }

    const searchBase = client.availablePhoneNumbers(country);
    const list = upsell.numberType === 'mobile'
      ? await searchBase.mobile.list({
          smsEnabled: true,
          voiceEnabled: true,
          limit: 20,
          contains,
        })
      : await searchBase.local.list({
          smsEnabled: true,
          voiceEnabled: true,
          limit: 20,
          contains,
        });

    if (!list.length) {
      return { status: 'failed', message: `No ${upsell.numberType} numbers available for ${country}` };
    }

    const selected = list[0];

    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber: selected.phoneNumber,
      voiceUrl: hooks.voice,
      voiceMethod: 'POST',
      statusCallback: hooks.voiceStatus,
      statusCallbackMethod: 'POST',
      smsUrl: hooks.sms,
      smsMethod: 'POST',
    });

    return {
      status: 'purchased',
      phoneNumber: purchased.phoneNumber,
      sid: purchased.sid,
      e164Prefix: getCountryDialPrefix(country),
      message: 'Phone number purchased and webhooks configured',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Twilio provisioning error';
    return { status: 'failed', message };
  }
}

export function buildWhatsAppStatus(upsell: ChannelUpsellData) {
  if (!upsell.whatsappUpsell) {
    return { status: 'skipped', message: 'WhatsApp upsell not selected' };
  }
  return {
    status: 'pending_approval',
    language: upsell.preferredLanguage || 'English',
    voiceStyle: upsell.voiceStyle || 'friendly',
    message: 'WhatsApp Business onboarding required (display name + template review via Meta/Twilio).',
  };
}
