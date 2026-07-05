import { NextRequest } from 'next/server';
import twilio from 'twilio';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { getTenantConfig, setTenantConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';

const CACHE_KEY = 'cs_voip_credentials';

interface VoipCredentials {
  apiKeySid: string;
  apiKeySecret: string;
  twimlAppSid: string;
  createdAt: string;
}

function getClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;
  return { client: twilio(accountSid, authToken,
    process.env.TWILIO_REGION ? { region: process.env.TWILIO_REGION, edge: 'dublin' } : {}
  ), accountSid };
}

function sanitizeBaseUrl(input?: string): string {
  return (input || 'https://app.ainomiq.com').trim().replace(/\s+/g, '').replace(/\/+$/, '');
}

async function getOrCreateCredentials(tenantId: string): Promise<VoipCredentials | null> {
  // Check cached credentials
  const raw = await getTenantConfig(tenantId, CACHE_KEY);
  if (raw) {
    try {
      const creds = JSON.parse(raw) as VoipCredentials;
      if (creds.apiKeySid && creds.apiKeySecret && creds.twimlAppSid) {
        return creds;
      }
    } catch { /* re-create */ }
  }

  const setup = getClient();
  if (!setup) return null;
  const { client } = setup;

  const base = sanitizeBaseUrl(process.env.APP_BASE_URL);
  const voiceUrl = `${base}/api/webhooks/twilio/voice`;
  const statusUrl = `${base}/api/webhooks/twilio/voice-status`;

  // Create TwiML App pointing to the same voice webhook
  const app = await client.applications.create({
    friendlyName: `Ainomiq VoIP Test – ${tenantId.slice(0, 20)}`,
    voiceUrl,
    voiceMethod: 'POST',
    statusCallback: statusUrl,
    statusCallbackMethod: 'POST',
  });

  // Create API Key for signing Access Tokens
  const key = await client.newKeys.create({
    friendlyName: `Ainomiq VoIP Key – ${tenantId.slice(0, 20)}`,
  });

  const creds: VoipCredentials = {
    apiKeySid: key.sid,
    apiKeySecret: key.secret,
    twimlAppSid: app.sid,
    createdAt: new Date().toISOString(),
  };

  await setTenantConfig(tenantId, CACHE_KEY, JSON.stringify(creds));
  return creds;
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireAuth(request);

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    if (!accountSid) {
      return Response.json({ error: 'Twilio not configured' }, { status: 500 });
    }

    const creds = await getOrCreateCredentials(tenantId);
    if (!creds) {
      return Response.json({ error: 'Failed to create VoIP credentials' }, { status: 500 });
    }

    // Look up the tenant's Twilio phone number
    const provRaw = await getTenantConfig(tenantId, 'cs_twilio_provisioning');
    let twilioNumber = '';
    if (provRaw) {
      try {
        const prov = JSON.parse(provRaw);
        twilioNumber = prov?.phone?.phoneNumber || prov?.runtime?.number || '';
      } catch { /* ignore */ }
    }

    // Generate Access Token with VoiceGrant
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const token = new AccessToken(
      accountSid,
      creds.apiKeySid,
      creds.apiKeySecret,
      {
        identity: `user-${tenantId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)}`,
        ...(process.env.TWILIO_REGION ? { region: process.env.TWILIO_REGION } : {}),
      }
    );

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: creds.twimlAppSid,
      incomingAllow: false, // we only need outbound for testing
    });

    token.addGrant(voiceGrant);

    return Response.json({
      token: token.toJwt(),
      identity: (token as any).identity,
      twilioNumber,
      region: process.env.TWILIO_REGION || null,
    });
  } catch (err) {
    try {
      return handleAuthError(err);
    } catch {
      console.error('[VoIP Token] Error:', err);
      return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
}
