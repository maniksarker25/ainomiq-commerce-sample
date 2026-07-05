import { NextRequest } from 'next/server';
import { verifyJwt, COOKIE_NAME } from '@/lib/jwt';
import { addTenantModule, getTenantConfigWithAliases, setTenantConfig } from '@/lib/db';
import { buildWhatsAppStatus, provisionPhoneNumber } from '@/lib/twilio';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token);
  if (!payload) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return Response.json({ error: 'Invalid data' }, { status: 400 });
  }

  const tenantId = payload.email;

  try {
    const payload = body as Record<string, unknown>;
    const channelUpsells = (payload.channelUpsells || null) as {
      whatsappUpsell?: boolean;
      phoneNumberUpsell?: boolean;
      preferredCountry?: string;
      numberType?: 'local' | 'mobile';
      numberContains?: string;
      useExistingNumber?: boolean;
      existingPhoneNumber?: string;
      preferredLanguage?: string;
      voiceStyle?: 'friendly' | 'professional' | 'warm';
      expectedMonthlyEmails?: number;
      expectedMonthlyMessages?: number;
      expectedMonthlyCalls?: number;
      botStartMode?: 'now' | 'scheduled';
      botStartAt?: string;
      botStartTimezone?: string;
    } | null;

    const brandVoice = (payload.brandVoice || null) as {
      tone?: string;
      languageHandling?: string;
      emailSignature?: string;
      signatureLogoUrl?: string;
      dos?: string[];
      donts?: string[];
      escalationName?: string;
      escalationEmail?: string;
      internalLang?: string;
      escalationRules?: string;
    } | null;
    const emailSetup = (payload.emailSetup || null) as { supportEmails?: string[]; replyFromEmail?: string } | null;

    const normalizedDos = Array.isArray(brandVoice?.dos) ? brandVoice.dos.filter(Boolean) : [];
    const normalizedDonts = Array.isArray(brandVoice?.donts) ? brandVoice.donts.filter(Boolean) : [];
    const escalationRules = String(brandVoice?.escalationRules || '').split('\n').map(rule => rule.replace(/^-\s*/, '').trim()).filter(Boolean);
    const supportEmails = Array.isArray(emailSetup?.supportEmails) ? emailSetup.supportEmails.filter(Boolean) : [];
    const existingConfigRaw = await getTenantConfigWithAliases(tenantId, 'cs_bot_config');
    let existingConfig: Record<string, any> = {};
    if (existingConfigRaw) {
      try {
        const parsed = JSON.parse(existingConfigRaw);
        if (parsed && typeof parsed === 'object') existingConfig = parsed;
      } catch {
        existingConfig = {};
      }
    }

    const existingSchedule = existingConfig.schedule && typeof existingConfig.schedule === 'object' ? existingConfig.schedule : {};
    const startAtRaw = typeof channelUpsells?.botStartAt === 'string' ? channelUpsells.botStartAt : '';
    const parsedStartAt = startAtRaw ? new Date(startAtRaw) : null;
    const startAt = parsedStartAt && !Number.isNaN(parsedStartAt.getTime()) ? parsedStartAt.toISOString() : new Date().toISOString();
    const schedule = {
      ...existingSchedule,
      mode: channelUpsells?.botStartMode === 'scheduled' ? 'scheduled' : 'now',
      start_at: startAt,
      timezone: channelUpsells?.botStartTimezone || existingSchedule.timezone || 'Europe/Amsterdam',
      active_hours: existingSchedule.active_hours || 'Always on after start time',
      frequency: existingSchedule.frequency || 'Every cron run',
      status: new Date(startAt).getTime() > Date.now() ? 'scheduled' : 'active',
    };

    const csBotConfig: Record<string, unknown> = {
      ...existingConfig,
      auto_reply: existingConfig.auto_reply && typeof existingConfig.auto_reply === 'object'
        ? existingConfig.auto_reply
        : { email: true, instagram: true, facebook: true },
      escalation_contact: brandVoice?.escalationEmail || existingConfig.escalation_contact || supportEmails[0] || null,
      escalation_name: brandVoice?.escalationName || existingConfig.escalation_name || null,
      support_emails: supportEmails.length ? supportEmails : (Array.isArray(existingConfig.support_emails) ? existingConfig.support_emails : []),
      reply_from_email: emailSetup?.replyFromEmail || existingConfig.reply_from_email || supportEmails[0] || null,
      disabled_send_as_emails: Array.isArray(existingConfig.disabled_send_as_emails) ? existingConfig.disabled_send_as_emails : [],
      ignored_recipient_emails: Array.isArray(existingConfig.ignored_recipient_emails) ? existingConfig.ignored_recipient_emails : [],
      vip: existingConfig.vip || null,
      safety: {
        ...(existingConfig.safety && typeof existingConfig.safety === 'object' ? existingConfig.safety : {}),
        mode: existingConfig.safety?.mode || 'draft_approval',
        hard_rules: normalizedDonts.length ? normalizedDonts : (existingConfig.safety?.hard_rules || []),
      },
      bot_scope: {
        ...(existingConfig.bot_scope && typeof existingConfig.bot_scope === 'object' ? existingConfig.bot_scope : {}),
        allowed: existingConfig.bot_scope?.allowed || ['Draft replies', 'Classify tickets', 'Answer product and policy questions'],
        auto_escalate: escalationRules.length ? escalationRules : (existingConfig.bot_scope?.auto_escalate || []),
      },
      schedule,
      fulfillment_email: existingConfig.fulfillment_email || null,
      tone: brandVoice?.tone || existingConfig.tone || null,
      language_handling: brandVoice?.languageHandling || existingConfig.language_handling || null,
      email_signature: brandVoice?.emailSignature || existingConfig.email_signature || null,
      signature_logo_url: brandVoice?.signatureLogoUrl || existingConfig.signature_logo_url || null,
      dos: normalizedDos.length ? normalizedDos : (Array.isArray(existingConfig.dos) ? existingConfig.dos : []),
      donts: normalizedDonts.length ? normalizedDonts : (Array.isArray(existingConfig.donts) ? existingConfig.donts : []),
      hard_rules: normalizedDonts.length ? normalizedDonts.join('\n') : (escalationRules.length ? escalationRules.join('\n') : (existingConfig.hard_rules || null)),
    };

    let twilioProvisioning: Record<string, unknown> | null = null;
    if (channelUpsells) {
      const upsellData = {
        whatsappUpsell: !!channelUpsells.whatsappUpsell,
        phoneNumberUpsell: !!channelUpsells.phoneNumberUpsell,
        preferredCountry: channelUpsells.preferredCountry || 'NL',
        numberType: channelUpsells.numberType || 'local',
        numberContains: channelUpsells.numberContains,
        useExistingNumber: !!channelUpsells.useExistingNumber,
        existingPhoneNumber: channelUpsells.existingPhoneNumber,
        preferredLanguage: channelUpsells.preferredLanguage || 'English',
        voiceStyle: channelUpsells.voiceStyle || 'friendly',
      };

      const expectedVolume = {
        emailsPerMonth: Math.max(0, Number(channelUpsells.expectedMonthlyEmails || 0)),
        messagesPerMonth: Math.max(0, Number(channelUpsells.expectedMonthlyMessages || 0)),
        callsPerMonth: Math.max(0, Number(channelUpsells.expectedMonthlyCalls || 0)),
      };

      const [phone, whatsapp] = await Promise.all([
        provisionPhoneNumber(upsellData),
        Promise.resolve(buildWhatsAppStatus(upsellData)),
      ]);

      const csRuntime = {
        language: upsellData.preferredLanguage,
        voiceStyle: upsellData.voiceStyle,
        country: upsellData.preferredCountry,
        numberType: upsellData.numberType,
        e164Prefix: phone.e164Prefix || null,
        number: phone.phoneNumber || null,
        expectedVolume,
        schedule,
      };

      twilioProvisioning = {
        requestedAt: new Date().toISOString(),
        phone,
        whatsapp,
        runtime: csRuntime,
      };
      await setTenantConfig(tenantId, 'cs_runtime_config', JSON.stringify(csRuntime));
      await setTenantConfig(tenantId, 'cs_twilio_provisioning', JSON.stringify(twilioProvisioning));
    }

    if (!channelUpsells) {
      const existingRuntimeRaw = await getTenantConfigWithAliases(tenantId, 'cs_runtime_config');
      if (existingRuntimeRaw) {
        try {
          const existingRuntime = JSON.parse(existingRuntimeRaw);
          if (existingRuntime && typeof existingRuntime === 'object') {
            await setTenantConfig(tenantId, 'cs_runtime_config', JSON.stringify({ ...existingRuntime, schedule }));
          }
        } catch {
          // Leave invalid existing runtime config untouched.
        }
      }
    }

    await setTenantConfig(tenantId, 'cs_bot_config', JSON.stringify(csBotConfig));
    await setTenantConfig(tenantId, 'cs_agent_schedule', JSON.stringify(schedule));

    // Store the full scrape result as CS onboarding data
    await setTenantConfig(tenantId, 'cs_onboarding_data', JSON.stringify(body));
    await setTenantConfig(tenantId, 'cs_onboarding_completed', 'true');
    await setTenantConfig(tenantId, 'cs_onboarding_date', new Date().toISOString());
    await addTenantModule(tenantId, 'cs');

    return Response.json({ success: true, twilioProvisioning });
  } catch (err) {
    console.error('[Onboarding Save]', err);
    return Response.json({ error: 'Failed to save onboarding data' }, { status: 500 });
  }
}
