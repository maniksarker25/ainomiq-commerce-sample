import { getTenantConfigWithAliases } from './db';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export type SocialMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type GenerateSocialAIReplyArgs = {
  tenantId: string;
  senderId: string;
  senderUsername?: string | null;
  lastMessage: string;
  threadHistory?: SocialMessage[];
  platform?: 'instagram' | 'facebook' | 'messenger';
};

export async function generateSocialAIReply(args: GenerateSocialAIReplyArgs): Promise<{ reply: string; shouldEscalate: boolean } | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn('[CS AI] OPENROUTER_API_KEY is not configured');
    return null;
  }

  const { tenantId, senderId, senderUsername, lastMessage, threadHistory = [], platform = 'instagram' } = args;

  // Retrieve onboarding data and bot config
  const onboardingRaw = await getTenantConfigWithAliases(tenantId, 'cs_onboarding_data');
  const botConfigRaw = await getTenantConfigWithAliases(tenantId, 'cs_bot_config');

  let onboarding: any = {};
  let botConfig: any = {};

  try {
    if (onboardingRaw) onboarding = JSON.parse(onboardingRaw);
  } catch (err) {
    console.error('[CS AI] Failed to parse cs_onboarding_data:', err);
  }

  try {
    if (botConfigRaw) botConfig = JSON.parse(botConfigRaw);
  } catch (err) {
    console.error('[CS AI] Failed to parse cs_bot_config:', err);
  }

  // Extract variables safely
  const brandVoice = onboarding.brandVoice;
  const emailSetup = onboarding.emailSetup;
  const policies = onboarding.policies || onboarding.result?.policies || [];
  const faq = onboarding.faq || onboarding.result?.faq || [];
  const shippingCosts = onboarding.shippingCosts || onboarding.result?.shippingCosts || '';
  const storeName = onboarding.storeInfo?.name || 'our store';
  const language = onboarding.storeInfo?.language || 'English';

  const policyText = policies
    .slice(0, 6)
    .map((p: any) => `[${p.type || 'general'}] ${(p.content || p.title || '').slice(0, 300)}`)
    .join('\n');

  const faqText = (Array.isArray(faq) ? faq : []).slice(0, 15).join('\n');

  const productSnippet = (onboarding.products || onboarding.result?.products || [])
    .slice(0, 10)
    .map((p: any) => `${p.title}${p.price ? ` (${p.price})` : ''}`)
    .join(', ');

  const escalationRules = emailSetup?.escalationRules || botConfig?.escalation_rules || 'Escalate when uncertain or when customer is upset.';
  const hardRules = botConfig?.hard_rules || '';

  // Social specific rules: short, conversational, max 2 sentences, direct.
  const systemPrompt = `You are the Intelli Support AI assistant for the brand "${storeName}".
You respond to customer messages on ${platform} (${platform === 'instagram' ? 'Instagram comments/DMs' : 'Facebook Messenger/Comments'}).

LANGUAGE: Reply in ${language}. If the customer writes in a different language, reply in their language.
TONE: ${brandVoice?.tone || 'Friendly and professional'}
${brandVoice?.dos?.length ? `DO: ${brandVoice.dos.join('; ')}` : ''}
${brandVoice?.donts?.length ? `DON'T: ${brandVoice.donts.join('; ')}` : ''}
${hardRules ? `HARD RULES: ${hardRules}` : ''}

STORE POLICIES:
${policyText || 'Standard store policies.'}

SHIPPING: ${shippingCosts || 'Standard shipping rates.'}

FAQ:
${faqText || 'No FAQ available.'}

PRODUCTS (sample): ${productSnippet || 'Not available'}

ESCALATION RULES:
${escalationRules}

INSTRUCTIONS:
1. Keep replies extremely concise, natural, and conversational (max 2 sentences, 40 words). This is for a chat/comment interface.
2. Read the customer message carefully.
3. If this requires escalation per the rules above or if the customer is demanding a human, respond with EXACTLY: [ESCALATE] followed by a brief reason why.
4. Otherwise, write a helpful, direct response. Use the store policies, FAQ, and catalog.
5. Do NOT include email signatures, subject lines, headers, or generic greetings.
6. Do NOT mention you are an AI or bot.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...threadHistory.slice(-8).map(m => ({
        role: m.role === 'user' ? 'user' as const : 'assistant' as const,
        content: m.content,
      })),
      { role: 'user', content: lastMessage },
    ];

    let res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3.1-flash-lite-preview',
        temperature: 0.4,
        messages: formattedMessages,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`[CS AI] Primary model failed with status ${res.status}. Retrying with free model router openrouter/free...`);
      res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openrouter/free',
          temperature: 0.4,
          messages: formattedMessages,
        }),
        signal: controller.signal,
      });
    }

    clearTimeout(timeout);

    if (!res.ok) {
      console.error('[CS AI] OpenRouter error (primary & fallback failed):', res.status);
      const fallbackText = pickRegexFallbackReply(lastMessage);
      const shouldEscalate = /\b(help|agent|human|escalat|mens|issue|probleem)\b/i.test(lastMessage);
      return { reply: fallbackText, shouldEscalate };
    }

    const data = await res.json();
    const text = (data?.choices?.[0]?.message?.content || '').trim();
    if (!text) {
      const fallbackText = pickRegexFallbackReply(lastMessage);
      const shouldEscalate = /\b(help|agent|human|escalat|mens|issue|probleem)\b/i.test(lastMessage);
      return { reply: fallbackText, shouldEscalate };
    }

    if (text.startsWith('[ESCALATE]')) {
      return { reply: text, shouldEscalate: true };
    }

    return { reply: text, shouldEscalate: false };
  } catch (err) {
    console.error('[CS AI] Error generating AI reply:', err);
    const fallbackText = pickRegexFallbackReply(lastMessage);
    const shouldEscalate = /\b(help|agent|human|escalat|mens|issue|probleem)\b/i.test(lastMessage);
    return { reply: fallbackText, shouldEscalate };
  }
}

function pickRegexFallbackReply(lastMessage: string): string {
  const lower = (lastMessage || '').toLowerCase();
  
  if (/\b(help|probleem|issue|broken|kapot|agent|human|mens)\b/i.test(lower)) {
    return "I want to make sure you get the best help possible. Let me connect you with a human agent who can assist further. They'll be with you shortly.";
  }
  if (/\b(order|bestelling|track|shipping|bezorg)\b/i.test(lower)) {
    return "I'd be happy to help with your order! Could you share your order number so I can look it up?";
  }
  if (/\b(return|retour|refund|terugsturen|ruil)\b/i.test(lower)) {
    return "I understand you'd like to return an item. I can help with that! Could you share your order number and the reason for the return?";
  }
  if (/\b(hi|hey|hello|hoi|hallo)\b/i.test(lower)) {
    return 'Hey! Thanks for reaching out. How can we help you today?';
  }
  return "Thanks for your message. I'm looking into this for you. Give me just a moment.";
}
