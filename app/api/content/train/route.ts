import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { getTenantConfig, setTenantConfig } from '@/lib/db';
import { apiSuccess, badRequest, apiError, ErrorCode, withErrorHandler, handleStructuredAuthError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';
const CONFIG_KEY = 'content_pipeline_config';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function clean(value: any, max = 1200) {
  return String(value || '').trim().slice(0, max);
}

function normalizeMessages(input: any): ChatMessage[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((m): ChatMessage => ({
      role: m?.role === 'assistant' ? 'assistant' : 'user',
      content: clean(m?.content, 1000),
    }))
    .filter((m) => m.content)
    .slice(-12);
}

function extractTrainingNote(text: string) {
  const lower = text.toLowerCase();
  const isRule = lower.includes('never') || lower.includes('always') || lower.includes('do not') || lower.includes("don't") || lower.includes('tone') || lower.includes('rule') || lower.includes('avoid');
  if (!isRule) return '';
  return text.length > 180 ? text.slice(0, 180) + '...' : text;
}

function limitedFallbackReply(message: string, config: any) {
  const brand = config?.brand_name || 'this brand';
  const lower = message.toLowerCase();
  if (lower.includes('order') || lower.includes('refund') || lower.includes('customer service')) {
    return `I can help train content rules for ${brand}, but I cannot handle orders, refunds, customer data, or support actions from this chat. Add the tone or content rule you want me to remember.`;
  }
  if (lower.includes('ad spend') || lower.includes('budget') || lower.includes('campaign')) {
    return `I can use campaign context for content angles, but I cannot change budgets or run ads. Tell me the messaging rule or audience insight to save.`;
  }
  return `Got it. I can train the content agent on voice, audience, offers, content rules, and publishing preferences. I will stay inside that scope and not take external actions.`;
}

async function aiReply(message: string, history: ChatMessage[], config: any) {
  if (!process.env.OPENAI_API_KEY) return limitedFallbackReply(message, config);

  const system = `You are the Ainomiq Content Studio training chatbot.

Allowed scope:
- Learn brand voice, audience, product/offer context, content pillars, content rules, publishing preferences.
- Help the user turn business context into safer content instructions.
- Suggest what to add to the brand profile.

Hard limits:
- Do not send messages, publish posts, change integrations, edit ads, process orders, view customer data, refund, access private systems, or claim external actions.
- If asked outside scope, refuse briefly and redirect to training the content agent.
- Ask at most one follow-up question.
- Be concise and practical.
- Never invent hard business facts. Only use profile/intake/chat facts.

Current content profile:
${JSON.stringify({
  brand_name: config?.brand_name,
  target_audience: config?.target_audience,
  product_focus: config?.product_focus,
  brand_voice: config?.brand_voice,
  company_analysis: config?.company_analysis,
  training_notes: config?.training_notes || [],
}, null, 2)}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.CONTENT_TRAINING_MODEL || 'gpt-4o-mini',
        temperature: 0.35,
        messages: [
          { role: 'system', content: system },
          ...history.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: message },
        ],
      }),
    });
    if (!res.ok) {
      console.error('[content/train] OpenAI returned', res.status);
      throw new Error(`AI model returned status ${res.status}. Training reply unavailable.`);
    }
    const data = await res.json();
    return clean(data.choices?.[0]?.message?.content, 1200) || limitedFallbackReply(message, config);
  } catch (err) {
    console.error('[content/train] AI reply failed:', err);
    return limitedFallbackReply(message, config);
  }
}

export const POST = withErrorHandler(async (request: NextRequest) => {
  let body: any;
  try { body = await request.json(); } catch { return badRequest('Invalid JSON body.', ErrorCode.INVALID_JSON); }

  let tenantId = '';
  try { tenantId = await requireAuth(request, body.tenant_id); } catch (err) { return handleStructuredAuthError(err); }

  const message = clean(body.message, 1000);
  if (!message) return badRequest('Message is required.', ErrorCode.MISSING_FIELD);

  let config: any = {};
  try {
    const raw = await getTenantConfig(tenantId, CONFIG_KEY);
    config = raw ? JSON.parse(raw) : {};
  } catch {
    console.error('[content/train] Failed to parse tenant config');
  }

  const history = normalizeMessages(body.history);
  const reply = await aiReply(message, history, config);

  const note = extractTrainingNote(message);
  const existingNotes = Array.isArray(config.training_notes) ? config.training_notes : [];
  const trainingNotes = note ? [...existingNotes, { note, created_at: new Date().toISOString() }].slice(-30) : existingNotes;

  const updated = {
    ...config,
    training_notes: trainingNotes,
    updated_at: new Date().toISOString(),
  };

  try {
    await setTenantConfig(tenantId, CONFIG_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('[content/train] Failed to save config:', err);
    return apiError('Training reply generated but failed to save. Please try again.', ErrorCode.TRAINING_FAILED);
  }

  return apiSuccess({ reply, saved_note: note || null, training_notes: trainingNotes });
});
