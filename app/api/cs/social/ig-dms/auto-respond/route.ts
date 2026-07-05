import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { isDemoTenant } from '@/lib/demo';
import { sendInstagramDm } from '@/lib/cs-social';
import { generateSocialAIReply } from '@/lib/cs-ai';
import { db, getTenantEmailAliases } from '@/lib/db';
import { isAutoReplyEnabled } from '@/lib/cs-auto-reply-server';

export const dynamic = 'force-dynamic';

const AUTO_RESPONSES: Record<string, string[]> = {
  greeting: [
    'Hey! Thanks for reaching out. How can we help you today?',
    'Hi there! Welcome to our support. What can we do for you?',
    'Hello! Thanks for your message. We are happy to help. What is on your mind?',
  ],
  order: [
    "I'd be happy to help with your order! Could you share your order number so I can look it up?",
    "Sure thing! Let me check that for you. Can you provide your order number?",
    "No problem! I'll look into that right away. What's your order number?",
  ],
  return: [
    "I understand you'd like to return an item. I can help with that! Could you share your order number and the reason for the return?",
    "Of course! Returns are easy. Just share your order number and I'll guide you through the process.",
  ],
  general: [
    "Thanks for your message. I'm looking into this for you. Give me just a moment.",
    'Got it! Let me check on that and get back to you shortly.',
    "Thanks for letting us know! I'll take care of this for you.",
    'Absolutely! Let me pull up the details for you. One moment please.',
  ],
  escalation: [
    "I want to make sure you get the best help possible. Let me connect you with a human agent who can assist further. They'll be with you shortly.",
    "This looks like something our support team should handle personally. I'm passing this to a human agent now. Hang tight.",
  ],
};

function pickResponse(lastMessage: string): { text: string; type: string } {
  const lower = (lastMessage || '').toLowerCase();

  if (/\b(hi|hey|hello|hoi|hallo)\b/i.test(lower)) {
    const arr = AUTO_RESPONSES.greeting;
    return { text: arr[Math.floor(Math.random() * arr.length)], type: 'greeting' };
  }
  if (/\b(order|bestelling|track|shipping|bezorg)\b/i.test(lower)) {
    const arr = AUTO_RESPONSES.order;
    return { text: arr[Math.floor(Math.random() * arr.length)], type: 'order' };
  }
  if (/\b(return|retour|refund|terugsturen|ruil)\b/i.test(lower)) {
    const arr = AUTO_RESPONSES.return;
    return { text: arr[Math.floor(Math.random() * arr.length)], type: 'return' };
  }
  if (/\b(help|probleem|issue|broken|kapot|agent|human|mens)\b/i.test(lower)) {
    const arr = AUTO_RESPONSES.escalation;
    return { text: arr[Math.floor(Math.random() * arr.length)], type: 'escalation' };
  }

  const arr = AUTO_RESPONSES.general;
  return { text: arr[Math.floor(Math.random() * arr.length)], type: 'general' };
}

export async function POST(request: NextRequest) {
  let body: {
    tenant_id?: string;
    conversation_id?: string;
    recipient_id?: string;
    last_message?: string;
  } = {};

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const conversationId = String(body.conversation_id || '').trim();
  const recipientId = String(body.recipient_id || '').trim();
  if (!conversationId && !recipientId) {
    return Response.json({ error: 'Missing conversation_id or recipient_id' }, { status: 400 });
  }

  let tenantId: string;
  try {
    tenantId = await requireAuth(request, body.tenant_id);
  } catch (err) {
    return handleAuthError(err);
  }

  const peerId = recipientId;
  const lastMessageText = body.last_message || '';

  if (isDemoTenant(tenantId)) {
    const { text: autoReply, type: responseType } = pickResponse(lastMessageText);
    return Response.json({
      ok: true,
      messageId: `demo-auto-${Date.now()}`,
      reply: autoReply,
      type: responseType,
      demo: true,
    });
  }

  const instagramAutoReplyEnabled = await isAutoReplyEnabled(tenantId, 'instagram');
  if (!instagramAutoReplyEnabled) {
    return Response.json(
      { error: 'Instagram auto-reply is disabled in settings' },
      { status: 403 },
    );
  }

  // 1. Fetch thread history from SQLite
  let threadHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  try {
    const aliases = await getTenantEmailAliases(tenantId);
    const placeholders = aliases.map(() => '?').join(',');
    const sql = conversationId
      ? `SELECT message_text, direction FROM ig_messages WHERE tenant_id IN (${placeholders}) AND conversation_id = ? ORDER BY timestamp DESC LIMIT 8`
      : `SELECT message_text, direction FROM ig_messages WHERE tenant_id IN (${placeholders}) AND (sender_id = ? OR recipient_id = ?) ORDER BY timestamp DESC LIMIT 8`;
    const args = conversationId ? [...aliases, conversationId] : [...aliases, peerId, peerId];

    const historyRes = await db.execute({ sql, args });
    threadHistory = historyRes.rows.map(r => ({
      role: (r.direction === 'inbound' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: String(r.message_text || ''),
    })).reverse();
  } catch (err) {
    console.error('[auto-respond] Thread history fetch error:', err);
  }

  // 2. Generate AI reply
  let autoReply = '';
  let shouldEscalate = false;
  let responseType = 'AI Onboarding Context';

  const aiResult = await generateSocialAIReply({
    tenantId,
    senderId: peerId,
    lastMessage: lastMessageText,
    threadHistory,
    platform: 'instagram',
  });

  if (aiResult) {
    autoReply = aiResult.reply;
    shouldEscalate = aiResult.shouldEscalate;
  } else {
    // Fallback to pattern matching
    const fallback = pickResponse(lastMessageText);
    autoReply = fallback.text;
    responseType = `Fallback: ${fallback.type}`;
    if (fallback.type === 'escalation') {
      shouldEscalate = true;
    }
  }

  // 3. Process escalation
  if (shouldEscalate) {
    autoReply = autoReply.replace(/^\[ESCALATE\]\s*/i, '').trim();
    if (!autoReply) {
      autoReply = "I want to make sure you get the best help possible. Let me connect you with a human agent who can assist further. They'll be with you shortly.";
    }
    responseType = 'escalation';

    try {
      const aliases = await getTenantEmailAliases(tenantId);
      const placeholders = aliases.map(() => '?').join(',');
      const updateSql = conversationId
        ? `UPDATE ig_messages SET status = 'escalated' WHERE tenant_id IN (${placeholders}) AND conversation_id = ?`
        : `UPDATE ig_messages SET status = 'escalated' WHERE tenant_id IN (${placeholders}) AND (sender_id = ? OR recipient_id = ?)`;
      const updateArgs = conversationId ? [...aliases, conversationId] : [...aliases, peerId, peerId];
      await db.execute({ sql: updateSql, args: updateArgs });
    } catch (err) {
      console.error('[auto-respond] Failed to update escalation status:', err);
    }
  }

  try {
    const result = await sendInstagramDm(tenantId, {
      conversationId: conversationId || undefined,
      recipientId: recipientId || undefined,
      message: autoReply,
    });

    return Response.json({
      ok: true,
      messageId: result.messageId,
      reply: autoReply,
      type: responseType,
      recipientId: result.recipientId,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Auto-respond failed';
    console.error('[auto-respond] Error:', msg);
    return Response.json({ error: msg }, { status: 502 });
  }
}

