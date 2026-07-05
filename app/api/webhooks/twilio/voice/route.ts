import { NextRequest } from 'next/server';
import { addCsCallEvent, findTenantByShopifyShop, findTenantByTwilioNumber, getCsCallTranscript, getLatestCallerName, getTenantConfig } from '@/lib/db';
import { lookupOrderByNumberVoice } from '@/lib/shopify-graphql';
import { createTtsToken, buildTtsPlayUrl } from '@/lib/cs-tts';

export const dynamic = 'force-dynamic';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

type RuntimeConfig = { language?: string; voiceStyle?: string };
type Policy = { type?: 'returns' | 'shipping' | 'privacy' | 'terms'; title?: string; content?: string };
type OnboardingData = {
  policies?: Policy[];
  faq?: string[];
  shippingCosts?: string | null;
  storeInfo?: { name?: string; description?: string };
  result?: { policies?: Policy[]; faq?: string[]; shippingCosts?: string | null };
};
type BotConfig = { hard_rules?: string };
type Stage = 'general' | 'await_order_number';

type VoiceProfile = {
  tenantId: string | null;
  lang: 'nl-NL' | 'en-GB' | 'en-US' | 'de-DE' | 'fr-FR' | 'es-ES';
  voiceStyle: 'friendly' | 'professional' | 'warm';
  agentName: string;
  brandName: string;
  shippingCosts: string | null;
  faq: string[];
  policies: Policy[];
  hardRules: string | null;
};

type ShopifyOrder = {
  name?: string;
  order_number?: number;
  fulfillment_status?: string | null;
  financial_status?: string | null;
  cancelled_at?: string | null;
  current_total_price?: string;
  currency?: string;
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
  } | null;
};

type Intent = 'identity' | 'human' | 'order_status' | 'payment' | 'greeting' | 'fallback';

function xmlEscape(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function mapPreferredLanguageToTwilio(lang?: string): VoiceProfile['lang'] {
  const value = (lang || '').toLowerCase();
  if (value.includes('dutch') || value === 'nl') return 'nl-NL';
  if (value.includes('german') || value === 'de') return 'de-DE';
  if (value.includes('french') || value === 'fr') return 'fr-FR';
  if (value.includes('spanish') || value === 'es') return 'es-ES';
  if (value.includes('english us') || value === 'en-us') return 'en-US';
  return 'en-GB';
}

function detectLanguageFromSpeech(_text: string): VoiceProfile['lang'] {
  // Pim asked to keep everything in English for now.
  return 'en-GB';
}

function selectVoice(_lang: VoiceProfile['lang']) {
  // Legacy: kept for fallback <Say> if TTS token creation fails
  return 'alice';
}

function openingLine(lang: VoiceProfile['lang'], brandName: string): string {
  if (lang === 'nl-NL') {
    return `Hoi, je spreekt met ${brandName}. Waarmee kan ik je helpen?`;
  }
  return `Hi, you're speaking with ${brandName}. How can I help you?`;
}

function detectIntent(text: string): Intent {
  const t = (text || '').toLowerCase().trim();

  if ([
    'who are you', 'what is your name', 'who am i speaking with',
    'wie ben je', 'wat is je naam', 'met wie spreek ik', 'wie spreek ik', 'voor wie werk je'
  ].some(k => t.includes(k))) {
    return 'identity';
  }

  if ([
    'human', 'specialist', 'manager', 'agent', 'real person',
    'medewerker', 'persoon', 'echte persoon', 'doorverbinden', 'doorverbond'
  ].some(k => t.includes(k))) {
    return 'human';
  }

  if ([
    'order', 'ordernummer', 'bestelling', 'order status', 'where is my order',
    'waar is mijn bestelling', 'track', 'tracking', '#'
  ].some(k => t.includes(k))) {
    return 'order_status';
  }

  if ([
    'payment status', 'payment', 'betaalstatus', 'betaling', 'paid', 'pending', 'failed', 'refund'
  ].some(k => t.includes(k))) {
    return 'payment';
  }

  const isGreetingOnly = /^(hey|hi|hello|yo|hallo|hoi|goedemorgen|goedemiddag|goedenavond)[!. ]*$/i.test(t);
  if (isGreetingOnly) return 'greeting';

  return 'fallback';
}

function normalizeDigitWords(text: string): string {
  const map: Record<string, string> = {
    zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
    nul: '0', een: '1', twee: '2', drie: '3', vier: '4', vijf: '5', zes: '6', zeven: '7', acht: '8', negen: '9',
  };
  const tokens = text.toLowerCase().split(/[^a-z0-9#]+/).filter(Boolean);
  const digits: string[] = [];
  for (const t of tokens) {
    if (/^\d+$/.test(t)) digits.push(t);
    else if (map[t] !== undefined) digits.push(map[t]);
  }
  return digits.join('');
}

function extractOrderNumber(text: string): string | null {
  const t = (text || '').toLowerCase();
  const explicit = t.match(/(?:order|ordernummer|bestelling|#)\s*#?\s*(\d{3,8})/i);
  if (explicit?.[1]) return explicit[1];

  const hash = t.match(/#\s*(\d{3,8})/);
  if (hash?.[1]) return hash[1];

  const normalized = normalizeDigitWords(t);
  if (normalized.length >= 3 && normalized.length <= 8) return normalized;

  return null;
}

async function lookupOrderByNumber(tenantId: string, orderNumber: string): Promise<ShopifyOrder | null> {
  try {
    const order = await lookupOrderByNumberVoice(tenantId, orderNumber);
    if (!order) return null;

    return {
      name: order.name,
      order_number: order.order_number,
      fulfillment_status: order.fulfillment_status,
      financial_status: order.financial_status,
      cancelled_at: order.cancelled_at,
      current_total_price: order.current_total_price,
      currency: order.currency,
      customer: order.customer
        ? {
            first_name: order.customer.first_name ?? null,
            last_name: order.customer.last_name ?? null,
          }
        : null,
    };
  } catch {
    return null;
  }
}

function customerName(order: ShopifyOrder): string {
  const first = (order.customer?.first_name || '').trim();
  const last = (order.customer?.last_name || '').trim();
  const full = `${first} ${last}`.trim();
  return full || first || '';
}

function financialStatusSnippet(lang: VoiceProfile['lang'], financialRaw: string): string {
  const financial = (financialRaw || '').toLowerCase();
  const healthy = ['paid', 'authorized'];
  if (!financial || healthy.includes(financial)) return '';

  if (lang === 'nl-NL') return ` Betaalstatus is ${financial}.`;
  return ` Payment status is ${financial}.`;
}

function latestMarkerValue(rows: any[], marker: string): string | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const msg = String(rows[i]?.message || '');
    if (msg.startsWith(marker)) return msg.slice(marker.length).trim() || null;
  }
  return null;
}

function formatOrderReply(lang: VoiceProfile['lang'], order: ShopifyOrder): string {
  const orderName = order.name || `#${order.order_number || ''}`;
  const cancelled = Boolean(order.cancelled_at);
  const fulfillment = (order.fulfillment_status || 'unfulfilled').toLowerCase();
  const financial = (order.financial_status || 'pending').toLowerCase();
  const name = customerName(order);
  const prefixNl = name ? `${name}, ` : '';
  const prefixEn = name ? `${name}, ` : '';

  if (lang === 'nl-NL') {
    const pay = financialStatusSnippet(lang, financial);
    if (cancelled) return `${prefixNl}ik heb bestelling ${orderName} gevonden. Deze is geannuleerd. Wil je dat ik direct een specialist inschakel?`;
    if (fulfillment === 'fulfilled') return `${prefixNl}ik heb ${orderName} gevonden. Deze is verzonden.${pay}`;
    if (fulfillment === 'partial') return `${prefixNl}ik heb ${orderName} gevonden. Deze is deels verzonden.${pay}`;
    return `${prefixNl}ik heb ${orderName} gevonden. Deze staat nog in verwerking.${pay}`;
  }

  const pay = financialStatusSnippet(lang, financial);
  if (cancelled) return `${prefixEn}I found order ${orderName}. It is cancelled. Do you want me to bring in a specialist immediately?`;
  if (fulfillment === 'fulfilled') return `${prefixEn}I found ${orderName}. It has been shipped.${pay}`;
  if (fulfillment === 'partial') return `${prefixEn}I found ${orderName}. It is partially fulfilled.${pay}`;
  return `${prefixEn}I found ${orderName}. It is still being processed.${pay}`;
}

function compactPolicy(profile: VoiceProfile): string {
  const shipping = profile.policies.find(p => p.type === 'shipping');
  const returns = profile.policies.find(p => p.type === 'returns');
  const shippingTxt = (shipping?.content || shipping?.title || '').replace(/\s+/g, ' ').slice(0, 250);
  const returnsTxt = (returns?.content || returns?.title || '').replace(/\s+/g, ' ').slice(0, 250);
  return `ShippingPolicy: ${shippingTxt || 'n/a'}\nReturnsPolicy: ${returnsTxt || 'n/a'}\nShippingCosts: ${profile.shippingCosts || 'n/a'}`;
}

async function generateAIReply(args: {
  profile: VoiceProfile;
  speech: string;
  callSid: string;
  orderHint?: ShopifyOrder | null;
}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const historyRows = args.profile.tenantId && args.callSid
    ? await getCsCallTranscript(args.profile.tenantId, args.callSid)
    : [];

  const history = (historyRows || []).filter((r: any) => r.speaker === 'caller' || r.speaker === 'agent').slice(-12).map((r: any) => `${r.speaker === 'caller' ? 'Customer' : 'You'}: ${r.message}`).join('\n');
  const faqText = args.profile.faq.slice(0, 10).join(' | ');
  const orderText = args.orderHint ? JSON.stringify(args.orderHint) : 'none';

  const systemPrompt = `You are ${args.profile.agentName} phone customer support.
- Never mention Ainomiq.
- Respond directly to what the caller just said; do not ignore intent.
- Be conversational and natural, not scripted.
- Max 2 short spoken sentences (suitable for voice).
- If customer is upset, acknowledge emotion first.
- If uncertain, ask one clarifying question.
- If the caller asks who they are speaking with, say ${args.profile.agentName}.
- If the caller asks for a human/specialist, confirm transfer immediately.
- Respect these hard rules: ${args.profile.hardRules || 'standard customer support policy'}

Context:
${compactPolicy(args.profile)}
FAQ snippets: ${faqText || 'n/a'}
Current order lookup: ${orderText}
Recent call transcript:
${history || 'none'}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        temperature: 0.5,
        messages: [
          { role: 'system', content: systemPrompt },
          ...(historyRows || []).filter((r: any) => r.speaker === 'caller' || r.speaker === 'agent').slice(-8).map((r: any) => ({
            role: r.speaker === 'caller' ? 'user' as const : 'assistant' as const,
            content: r.message as string,
          })),
          { role: 'user', content: args.speech },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch {
    return null;
  }
}

async function twimlGather(params: {
  lang: VoiceProfile['lang'];
  voice: string;
  sayText: string;
  repromptText: string;
  fallbackText: string;
  nextStage: Stage;
}) {
  const { lang, voice, sayText, repromptText, fallbackText, nextStage } = params;
  const actionUrl = `/api/webhooks/twilio/voice?stage=${encodeURIComponent(nextStage)}`;

  // Try to generate TTS audio via OpenAI; fall back to <Say> if it fails
  try {
    const [mainToken, repromptToken, fallbackToken] = await Promise.all([
      createTtsToken(sayText, lang),
      createTtsToken(repromptText, lang),
      createTtsToken(fallbackText, lang),
    ]);
    const mainUrl = buildTtsPlayUrl(mainToken);
    const repromptUrl = buildTtsPlayUrl(repromptToken);
    const fallbackUrl = buildTtsPlayUrl(fallbackToken);

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" language="${lang}" method="POST" action="${actionUrl}" timeout="5" speechTimeout="auto" enhanced="true">
    <Play>${xmlEscape(mainUrl)}</Play>
    <Pause length="1"/>
    <Play>${xmlEscape(repromptUrl)}</Play>
  </Gather>
  <Play>${xmlEscape(fallbackUrl)}</Play>
</Response>`;
  } catch (err) {
    console.error('[Voice] TTS token failed, falling back to <Say>:', err);
    // Fallback to Twilio TTS
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" language="${lang}" method="POST" action="${actionUrl}" timeout="5" speechTimeout="auto" enhanced="true">
    <Say language="${lang}" voice="${voice}">${xmlEscape(sayText)}</Say>
    <Pause length="1"/>
    <Say language="${lang}" voice="${voice}">${xmlEscape(repromptText)}</Say>
  </Gather>
  <Say language="${lang}" voice="${voice}">${xmlEscape(fallbackText)}</Say>
</Response>`;
  }
}


function handlePaymentIntent(lang: VoiceProfile['lang'], speech: string, knownOrderNumber: string | null): { text: string; nextStage: Stage } {
  const t = (speech || '').toLowerCase();
  const hasIssueHint = [
    'refund', 'chargeback', 'double', 'twice', 'not received', 'failed', 'mislukt', 'terugbetaling', 'probleem', 'error', 'fout'
  ].some(k => t.includes(k));

  if (!hasIssueHint) {
    return {
      text: 'Clear, payment status noted. No further action needed from your side. What would you like me to handle next?',
      nextStage: 'general',
    };
  }

  if (!knownOrderNumber) {
    return {
      text: 'Understood. For a payment issue I need your order number so I can check this directly.',
      nextStage: 'await_order_number',
    };
  }

  return {
    text: `Great, I will include payment checks directly for order ${knownOrderNumber}.`,
    nextStage: 'general',
  };
}

function repromptForIntent(_lang: VoiceProfile['lang'], intent: Intent, nextStage: Stage) {
  if (nextStage === 'await_order_number' || intent === 'order_status') {
    return 'Please say only your order number now, for example hashtag 4821.';
  }

  if (intent === 'greeting') {
    return 'How can I help: order status, return, or shipping?';
  }

  return 'Can I solve anything else for you?';
}

function normalizeE164Like(n: string): string {
  return (n || '').replace(/[^\d+]/g, '').trim();
}

async function getTenantVoiceProfile(toNumber: string, speech: string): Promise<VoiceProfile> {
  const fallbackLang = detectLanguageFromSpeech(speech);
  const defaults: VoiceProfile = {
    tenantId: null,
    lang: fallbackLang,
    voiceStyle: 'warm',
    agentName: 'Customer Care',
    brandName: 'our company',
    shippingCosts: null,
    faq: [],
    policies: [],
    hardRules: null,
  };

  if (!toNumber) return defaults;

  const normalizedTo = normalizeE164Like(toNumber);
  const bjPhone = normalizeE164Like(process.env.BJ_PHONE_NUMBER || '+3197010251436');

  let tenantId: string | null = null;

  // Hard bind for Billie Jeans phone agent.
  if (normalizedTo === bjPhone) {
    tenantId = 'pimsmit@billiejeans.eu';
  }

  if (!tenantId) {
    tenantId = await findTenantByTwilioNumber(toNumber);
  }

  // Fallback for manual Shopify credential method:
  // map configured shop domain to tenant even if Twilio provisioning is not yet linked.
  if (!tenantId) {
    const shopFromEnv = (process.env.SHOPIFY_STORE_DOMAIN || process.env.SHOPIFY_SHOP_DOMAIN || '').trim().toLowerCase();
    if (shopFromEnv) {
      tenantId = await findTenantByShopifyShop(shopFromEnv);
    }
  }

  if (!tenantId) return defaults;

  const [runtimeRaw, onboardingRaw, botConfigRaw] = await Promise.all([
    getTenantConfig(tenantId, 'cs_runtime_config'),
    getTenantConfig(tenantId, 'cs_onboarding_data'),
    getTenantConfig(tenantId, 'cs_bot_config'),
  ]);

  let runtime: RuntimeConfig | null = null;
  let onboarding: OnboardingData | null = null;
  let botConfig: BotConfig | null = null;

  if (runtimeRaw) { try { runtime = JSON.parse(runtimeRaw) as RuntimeConfig; } catch { runtime = null; } }
  if (onboardingRaw) { try { onboarding = JSON.parse(onboardingRaw) as OnboardingData; } catch { onboarding = null; } }
  if (botConfigRaw) { try { botConfig = JSON.parse(botConfigRaw) as BotConfig; } catch { botConfig = null; } }

  const policies = onboarding?.policies || onboarding?.result?.policies || [];
  const faq = onboarding?.faq || onboarding?.result?.faq || [];
  const shippingCosts = onboarding?.shippingCosts || onboarding?.result?.shippingCosts || null;
  const storeName = onboarding?.storeInfo?.name || '';

  return {
    tenantId,
    lang: runtime?.language ? mapPreferredLanguageToTwilio(runtime.language) : defaults.lang,
    voiceStyle: (runtime?.voiceStyle as VoiceProfile['voiceStyle']) || defaults.voiceStyle,
    agentName: storeName ? `${storeName} Customer Care` : defaults.agentName,
    brandName: storeName || defaults.brandName,
    shippingCosts,
    faq: Array.isArray(faq) ? faq.slice(0, 25) : [],
    policies: Array.isArray(policies) ? policies.slice(0, 25) : [],
    hardRules: botConfig?.hard_rules || null,
  };
}

export async function POST(request: NextRequest) {
  const VOICE_RELAY_URL = process.env.VOICE_RELAY_URL; // e.g. wss://ainomiq-voice-relay.up.railway.app

  // ── Realtime API mode: <Connect><Stream> to WebSocket relay ──
  if (VOICE_RELAY_URL) {
    const form = await request.formData();
    const toNumber = String(form.get('To') || '').trim();
    const callSid = String(form.get('CallSid') || '').trim();
    const fromNumber = String(form.get('From') || '').trim();

    // Resolve tenant so the relay knows which brand/config to load
    const normalizedTo = normalizeE164Like(toNumber);
    const bjPhone = normalizeE164Like(process.env.BJ_PHONE_NUMBER || '+3197010251436');
    let tenantId: string | null = null;
    if (normalizedTo === bjPhone) {
      tenantId = 'pimsmit@billiejeans.eu';
    }
    if (!tenantId) {
      tenantId = await findTenantByTwilioNumber(toNumber);
    }

    console.log(`[Voice] Realtime mode → ${VOICE_RELAY_URL} (call: ${callSid}, tenant: ${tenantId || 'unknown'})`);

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${xmlEscape(VOICE_RELAY_URL)}">
      <Parameter name="called" value="${xmlEscape(toNumber)}" />
      <Parameter name="caller" value="${xmlEscape(fromNumber)}" />
      <Parameter name="callSid" value="${xmlEscape(callSid)}" />
      <Parameter name="tenantId" value="${xmlEscape(tenantId || '')}" />
    </Stream>
  </Connect>
</Response>`;

    return new Response(twiml, { status: 200, headers: { 'Content-Type': 'text/xml; charset=utf-8' } });
  }

  // ── Fallback: TwiML Gather (Twilio STT) + Play (OpenAI TTS) ──
  const form = await request.formData();
  const speech = String(form.get('SpeechResult') || '').trim();
  const toNumber = String(form.get('To') || '').trim();
  const callSid = String(form.get('CallSid') || '').trim();

  const stageParam = (request.nextUrl.searchParams.get('stage') || 'general') as Stage;
  const currentStage: Stage = stageParam === 'await_order_number' ? 'await_order_number' : 'general';

  const profile = await getTenantVoiceProfile(toNumber, speech);
  const lang = profile.lang;
  const voice = selectVoice(lang);

  const noInputFallback = 'I cannot hear you clearly. I will now connect you with a specialist for immediate help.';

  if (!speech) {
    const twiml = await twimlGather({
      lang,
      voice,
      sayText: openingLine(lang, profile.brandName),
      repromptText: lang === 'nl-NL'
        ? 'Ben je er nog?'
        : 'Are you still there?',
      fallbackText: noInputFallback,
      nextStage: 'general',
    });
    return new Response(twiml, { status: 200, headers: { 'Content-Type': 'text/xml; charset=utf-8' } });
  }

  const intent = currentStage === 'await_order_number' ? 'order_status' : detectIntent(speech);
  let text = '';
  let nextStage: Stage = 'general';
  let orderHint: ShopifyOrder | null = null;
  let knownCallerName: string | null = null;
  let knownOrderNumber: string | null = null;

  if (profile.tenantId && callSid) {
    knownCallerName = await getLatestCallerName(profile.tenantId, callSid);
    const transcriptRows = await getCsCallTranscript(profile.tenantId, callSid);
    knownOrderNumber = latestMarkerValue(transcriptRows || [], 'order_number:');
  }

  if (intent === 'identity') {
    text = lang === 'nl-NL'
      ? `Ik ben ${profile.agentName}. Vertel me je vraag, dan help ik je persoonlijk verder.`
      : `I am ${profile.agentName}. Tell me what is happening and I will personally help you.`;
  } else if (intent === 'human') {
    text = lang === 'nl-NL'
      ? `Helemaal goed, ik verbind je direct met een specialist van ${profile.brandName}.`
      : `Of course, I will connect you directly to a ${profile.brandName} specialist.`;
  } else if (intent === 'greeting') {
    text = 'Hey, thanks for calling. How can I help you now?';
  } else if (intent === 'order_status' || intent === 'payment') {
    const extractedOrderNumber = extractOrderNumber(speech);
    if (extractedOrderNumber && profile.tenantId && callSid) {
      await addCsCallEvent({ tenantId: profile.tenantId, callSid, speaker: 'system', message: `order_number:${extractedOrderNumber}` });
      knownOrderNumber = extractedOrderNumber;
    }

    if (intent === 'payment') {
      const paymentHandled = handlePaymentIntent(lang, speech, knownOrderNumber);
      text = paymentHandled.text;
      nextStage = paymentHandled.nextStage;
    }

    const orderNumber = extractedOrderNumber || knownOrderNumber;
    const tenantId = profile.tenantId;

    if (!text && !orderNumber) {
      text = 'I can help right away. I only still need your order number to check this concretely.';
      nextStage = 'await_order_number';
    } else if (!text && !tenantId) {
      text = 'I do not see a connected store for this number yet. Connect the store in Settings and try again, or say specialist.';
    } else if (!text) {
      try {
        orderHint = await lookupOrderByNumber(tenantId as string, orderNumber as string);
      } catch (err) {
        console.error('[Voice] Shopify lookup error:', err);
      }

      if (orderHint) {
        text = formatOrderReply(lang, orderHint);
        if (tenantId && callSid && orderNumber) {
          await addCsCallEvent({ tenantId, callSid, speaker: 'system', message: `order_number:${orderNumber}` });
          knownOrderNumber = orderNumber;
        }
        const detectedName = customerName(orderHint);
        if (detectedName && tenantId && callSid) {
          await addCsCallEvent({ tenantId, callSid, speaker: 'system', message: `customer_name:${detectedName}` });
          knownCallerName = detectedName;
        }
      } else {
        text = `I still cannot find order ${orderNumber} in our systems. Please repeat the number, or say specialist.`;
        nextStage = 'await_order_number';
      }
    }
  }

  if (!text) {
    const aiReply = await generateAIReply({ profile, speech, callSid, orderHint });
    text = aiReply || 'Thanks for explaining. I will help you directly with this. Is this about an order, return, or shipping?';
  }

  if (knownCallerName && intent !== 'order_status') {
    const prefix = `${knownCallerName}, `;
    if (!text.toLowerCase().startsWith(knownCallerName.toLowerCase())) {
      text = `${prefix}${text.charAt(0).toLowerCase()}${text.slice(1)}`;
    }
  }

  if (profile.tenantId && callSid) {
    await addCsCallEvent({ tenantId: profile.tenantId, callSid, speaker: 'caller', message: speech });
    await addCsCallEvent({ tenantId: profile.tenantId, callSid, speaker: 'agent', message: text });
  }

  const reprompt = repromptForIntent(lang, intent, nextStage);

  const twiml = await twimlGather({
    lang,
    voice,
    sayText: text,
    repromptText: reprompt,
    fallbackText: noInputFallback,
    nextStage,
  });

  return new Response(twiml, { status: 200, headers: { 'Content-Type': 'text/xml; charset=utf-8' } });
}
