import { NextRequest, NextResponse } from 'next/server';

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type ChatResponse = {
  reply: string;
  links: { label: string; href: string }[];
  suggestions: string[];
};

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = process.env.SUPPORT_CHAT_MODEL || 'google/gemini-2.5-flash';

function normalizeMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((m) => ({
      role: m?.role === 'assistant' || m?.role === 'system' ? m.role : 'user',
      content: typeof m?.content === 'string' ? m.content.trim() : '',
    }))
    .filter((m) => m.content.length > 0)
    .slice(-20);
}

function extractFacts(messages: ChatMessage[]) {
  const userText = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join('\n');

  const orderNumber =
    userText.match(/(?:order\s*(?:number|nr|#)?\s*[:#-]?\s*)([A-Z0-9-]{4,})/i)?.[1] ||
    userText.match(/#([0-9]{4,})/)?.[1] ||
    '';

  const paymentStatus =
    userText.match(/(?:payment\s*status|betaalstatus|paid|unpaid|failed|pending)[^\n]{0,80}/i)?.[0] || '';

  const name = userText.match(/(?:my name is|ik ben|this is)\s+([a-zA-Z\-']{2,})/i)?.[1] || '';

  return {
    hasOrderNumber: !!orderNumber,
    orderNumber,
    hasPaymentStatus: !!paymentStatus,
    paymentStatus,
    hasName: !!name,
    name,
  };
}

function suggestLinksAndPrompts(lastUserMessage: string): { links: ChatResponse['links']; suggestions: string[] } {
  const text = lastUserMessage.toLowerCase();

  const links: ChatResponse['links'] = [];
  if (text.includes('shopify') || text.includes('connect') || text.includes('integration')) {
    links.push({ label: 'Go to Integrations', href: '/dashboard/settings' });
  }
  if (text.includes('stock') || text.includes('inventory')) {
    links.push({ label: 'Open Stock Management', href: '/dashboard/stock' });
  }
  if (text.includes('ad') || text.includes('meta') || text.includes('roas')) {
    links.push({ label: 'Open Ad Monitoring', href: '/dashboard/ads' });
  }
  if (text.includes('support') || text.includes('customer service') || text.includes('gmail')) {
    links.push({ label: 'Open Intelli Support', href: '/dashboard/cs' });
  }

  const suggestions = [
    'Can you solve this without asking me to repeat details?',
    'What do you need from me to fix this now?',
    'Talk me through the next step like a real agent',
  ];

  return { links: links.slice(0, 2), suggestions };
}

function fallbackReply(lastMessage: string, facts: ReturnType<typeof extractFacts>): string {
  const t = lastMessage.toLowerCase();

  if (!lastMessage.trim()) {
    return 'I’m here with you. Tell me what happened and what outcome you want, and I’ll guide you step by step.';
  }

  if (t.includes('payment') || t.includes('betaal')) {
    if (facts.hasPaymentStatus) {
      return 'Got it - thanks, that payment status is clear. We don\'t need to repeat basics. I can help with next action immediately; if this is order-specific, share an order number only if you have it handy.';
    }
    return 'Understood. If this is about payment, tell me what you see (paid/pending/failed) and I’ll give the fastest next step.';
  }

  return 'You’re right - let’s keep this practical. I’ll use the details you already gave and only ask one follow-up if absolutely needed. What outcome do you want right now?';
}

async function generateConversationalReply(messages: ChatMessage[], facts: ReturnType<typeof extractFacts>): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const systemPrompt = `You are Ainomiq Support Assistant.

Goal: feel like a real, thoughtful support agent in conversation - not a rigid FAQ bot.

Critical behavior rules:
1) DO NOT repeat questions if user already shared the info earlier in this chat.
2) If user already gave name/payment status, acknowledge and move forward; do NOT ask same thing again.
3) Ask for order number ONLY when truly required for order-specific actions (shipping/refund/cancel/tracking).
4) For general guidance, avoid requesting unnecessary details.
5) Ask at most ONE follow-up question.
6) Be concise, actionable, human.
7) Never sound scripted. No generic filler.
8) If user frustration is visible, acknowledge it once and then solve.

Response format: plain text only, 3-8 short lines max.`;

  const factContext = `Known facts from current conversation:\n${JSON.stringify(facts, null, 2)}`;

  const llmMessages = [
    { role: 'system', content: systemPrompt },
    { role: 'system', content: factContext },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0.35,
        max_tokens: 350,
        messages: llmMessages,
      }),
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') return null;

    return content.trim();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const messages = normalizeMessages(body?.messages);
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content || '';

    const facts = extractFacts(messages);
    const generated = await generateConversationalReply(messages, facts);

    const reply = generated || fallbackReply(lastUserMessage, facts);
    const { links, suggestions } = suggestLinksAndPrompts(lastUserMessage);

    return NextResponse.json({
      reply,
      links,
      suggestions,
    } satisfies ChatResponse);
  } catch {
    return NextResponse.json({
      reply: 'Something went wrong on my side. Give me one line on your exact issue and I’ll handle it directly.',
      links: [{ label: 'Contact us', href: 'https://www.ainomiq.com/pages/book-a-call' }],
      suggestions: ['Describe the issue in one sentence', 'Tell me what outcome you want'],
    } satisfies ChatResponse);
  }
}
