import { NextRequest } from 'next/server';
import {
  getCsEnabledTenants,
  getTenantConfig,
  isCsEmailProcessed,
  logCsEmail,
  setCsLastProcessedTime,
} from '@/lib/db';
import { isAutoReplyEnabled } from '@/lib/cs-auto-reply-server';
import {
  getGmailTokenAndFetch,
  parseEmailHeaders,
  parseEmailBody,
  GmailError,
} from '@/lib/gmail';
import { fetchOrders } from '@/lib/shopify-graphql';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// ─── Types ───────────────────────────────────────────────────────

type OnboardingData = {
  storeUrl?: string;
  storeInfo?: { name?: string; description?: string; language?: string; currency?: string };
  contact?: { email?: string; phone?: string };
  products?: Array<{ title: string; price?: string }>;
  policies?: Array<{ type?: string; title?: string; content?: string }>;
  faq?: string[];
  shippingCosts?: string | null;
  emailSetup?: {
    supportEmails?: string[];
    escalationName?: string;
    escalationEmail?: string;
    escalationRules?: string;
    internalLang?: string;
  };
  brandVoice?: {
    tone?: string;
    languageHandling?: string;
    emailSignature?: string;
    dos?: string[];
    donts?: string[];
  };
  // scrape result can also be nested under result
  result?: {
    policies?: Array<{ type?: string; title?: string; content?: string }>;
    faq?: string[];
    shippingCosts?: string | null;
    products?: Array<{ title: string; price?: string }>;
  };
};

type BotConfig = {
  schedule?: { start_at?: string; status?: string; mode?: string };
  hard_rules?: string;
  escalation_contact?: string;
};

// ─── Auth ────────────────────────────────────────────────────────

function verifyCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // No secret configured = allow (dev)

  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) return true;

  // Vercel Cron sends this header automatically
  const vercelCron = request.headers.get('x-vercel-cron');
  if (vercelCron) return true;

  return false;
}

// ─── Helpers ─────────────────────────────────────────────────────

function extractSenderEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).trim().toLowerCase();
}

function isAutoReplyOrNoreply(from: string, headers: Record<string, string>): boolean {
  const email = extractSenderEmail(from).toLowerCase();
  if (/noreply|no-reply|mailer-daemon|postmaster|notifications?@/.test(email)) return true;

  // Check auto-submitted header
  const autoSubmitted = (headers['auto-submitted'] || '').toLowerCase();
  if (autoSubmitted && autoSubmitted !== 'no') return true;

  // Check X-Auto-Response-Suppress
  const suppress = headers['x-auto-response-suppress'] || '';
  if (suppress) return true;

  return false;
}

function isSupportEmail(from: string, supportEmails: string[]): boolean {
  const sender = extractSenderEmail(from);
  return supportEmails.some(e => e.toLowerCase() === sender);
}

function mapLanguage(lang: string | undefined): string {
  const l = (lang || 'english').toLowerCase();
  if (l.includes('dutch') || l === 'nl') return 'Dutch';
  if (l.includes('german') || l === 'de') return 'German';
  if (l.includes('french') || l === 'fr') return 'French';
  if (l.includes('spanish') || l === 'es') return 'Spanish';
  return 'English';
}

// ─── Order Lookup ────────────────────────────────────────────────

function extractOrderNumber(text: string): string | null {
  const patterns = [
    /(?:order|bestelling|ordernummer|commande)\s*#?\s*(\d{3,8})/i,
    /#\s*(\d{3,8})/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

async function lookupOrder(tenantId: string, orderNumber: string): Promise<string | null> {
  try {
    const data = await fetchOrders(tenantId, {
      query: `name:#${orderNumber}`,
      first: 5,
    });

    const order = data?.orders?.[0];
    if (!order) return null;

    const name = order.name || `#${orderNumber}`;
    const fulfillment = ((order.fulfillment_status as string) || 'unfulfilled').toLowerCase();
    const financial = ((order.financial_status as string) || 'pending').toLowerCase();
    const cancelled = Boolean(order.cancelled_at);
    const cust = order.customer as { first_name?: string; last_name?: string } | null;
    const custName = [cust?.first_name, cust?.last_name].filter(Boolean).join(' ');

    const parts = [`Order ${name}`];
    if (custName) parts.push(`Customer: ${custName}`);
    if (cancelled) {
      parts.push('Status: CANCELLED');
    } else {
      parts.push(`Fulfillment: ${fulfillment}`, `Payment: ${financial}`);
    }
    if (order.current_total_price) parts.push(`Total: ${order.currency || ''} ${order.current_total_price}`);

    return parts.join(' | ');
  } catch {
    return null;
  }
}

// ─── AI Reply Generation ────────────────────────────────────────

async function generateEmailReply(args: {
  onboarding: OnboardingData;
  botConfig: BotConfig | null;
  emailFrom: string;
  emailSubject: string;
  emailBody: string;
  orderContext: string | null;
  threadSnippets: string[];
}): Promise<{ reply: string; shouldEscalate: boolean } | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const { onboarding, botConfig, emailFrom, emailSubject, emailBody, orderContext, threadSnippets } = args;

  const brandVoice = onboarding.brandVoice;
  const emailSetup = onboarding.emailSetup;
  const policies = onboarding.policies || onboarding.result?.policies || [];
  const faq = onboarding.faq || onboarding.result?.faq || [];
  const shippingCosts = onboarding.shippingCosts || onboarding.result?.shippingCosts || '';
  const storeName = onboarding.storeInfo?.name || 'our store';
  const language = mapLanguage(emailSetup?.internalLang || onboarding.storeInfo?.language);

  const policyText = policies
    .slice(0, 6)
    .map(p => `[${p.type || 'general'}] ${(p.content || p.title || '').slice(0, 300)}`)
    .join('\n');

  const faqText = (Array.isArray(faq) ? faq : []).slice(0, 15).join('\n');

  const productSnippet = (onboarding.products || onboarding.result?.products || [])
    .slice(0, 10)
    .map(p => `${p.title}${p.price ? ` (${p.price})` : ''}`)
    .join(', ');

  const threadContext = threadSnippets.length > 0
    ? `Previous messages in this thread:\n${threadSnippets.join('\n---\n')}`
    : 'No previous thread context.';

  const escalationRules = emailSetup?.escalationRules || 'Escalate when uncertain or when customer is upset after 2 exchanges.';
  const hardRules = botConfig?.hard_rules || '';

  const systemPrompt = `You are the Intelli Support agent for ${storeName}.
You respond to customer emails professionally and helpfully.

LANGUAGE: Reply in ${language}. ${brandVoice?.languageHandling || 'If the customer writes in a different language, reply in their language.'}

TONE: ${brandVoice?.tone || 'Professional and friendly'}
${brandVoice?.dos?.length ? `DO: ${brandVoice.dos.join('; ')}` : ''}
${brandVoice?.donts?.length ? `DON'T: ${brandVoice.donts.join('; ')}` : ''}
${hardRules ? `HARD RULES: ${hardRules}` : ''}

STORE POLICIES:
${policyText || 'No specific policies provided.'}

SHIPPING: ${shippingCosts || 'Not specified'}

FAQ:
${faqText || 'No FAQ available.'}

PRODUCTS (sample): ${productSnippet || 'Not available'}

ESCALATION RULES:
${escalationRules}
Escalation contact: ${emailSetup?.escalationName || 'Support Lead'} <${emailSetup?.escalationEmail || ''}>

ORDER CONTEXT: ${orderContext || 'No order found in this email.'}

${threadContext}

EMAIL SIGNATURE:
${brandVoice?.emailSignature || storeName}

INSTRUCTIONS:
1. Read the customer email carefully.
2. If this requires escalation per the rules above, respond with EXACTLY: [ESCALATE] followed by a brief reason.
3. Otherwise, write a helpful, concise reply. Use the store policies, FAQ, and order context.
4. End with the email signature.
5. Do NOT include a subject line. Only the body text.
6. Do NOT mention you are an AI or bot.
7. Keep replies short and to the point (max 150 words).`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3.1-flash-lite-preview',
        temperature: 0.4,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `From: ${emailFrom}\nSubject: ${emailSubject}\n\n${emailBody.slice(0, 3000)}` },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error('[CS Email AI] OpenRouter error:', res.status);
      return null;
    }

    const data = await res.json();
    const text = (data?.choices?.[0]?.message?.content || '').trim();
    if (!text) return null;

    if (text.startsWith('[ESCALATE]')) {
      return { reply: text, shouldEscalate: true };
    }

    return { reply: text, shouldEscalate: false };
  } catch (err) {
    console.error('[CS Email AI] Error:', err);
    return null;
  }
}

// ─── Send Reply via Gmail ────────────────────────────────────────

async function sendGmailReply(tenantId: string, args: {
  to: string;
  subject: string;
  body: string;
  threadId: string;
  messageId: string;
}) {
  // Fetch the real Message-ID header for proper threading
  let inReplyTo = '';
  let references = '';
  try {
    const msg = await getGmailTokenAndFetch(
      tenantId,
      `/messages/${args.messageId}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References`,
      { method: 'GET' }
    );
    const headers = msg.payload?.headers || [];
    const msgIdH = headers.find((h: { name: string }) => h.name.toLowerCase() === 'message-id');
    const refsH = headers.find((h: { name: string }) => h.name.toLowerCase() === 'references');
    if (msgIdH) {
      inReplyTo = msgIdH.value;
      references = refsH ? `${refsH.value} ${msgIdH.value}` : msgIdH.value;
    }
  } catch {
    // Continue without threading headers
  }

  const lines = [
    `To: ${args.to}`,
    `Subject: ${args.subject.startsWith('Re:') ? args.subject : `Re: ${args.subject}`}`,
    ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`, `References: ${references}`] : []),
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    args.body,
  ];
  const raw = Buffer.from(lines.join('\r\n')).toString('base64url');

  const result = await getGmailTokenAndFetch(
    tenantId,
    '/messages/send',
    {
      method: 'POST',
      body: JSON.stringify({ raw, threadId: args.threadId }),
    },
  );

  return result;
}

// ─── Forward/escalate to human ──────────────────────────────────

async function escalateEmail(tenantId: string, args: {
  originalFrom: string;
  originalSubject: string;
  originalBody: string;
  escalationEmail: string;
  escalationName: string;
  reason: string;
  threadId: string;
}) {
  const body = `--- Escalated by Intelli Support ---
Reason: ${args.reason}

Original from: ${args.originalFrom}
Subject: ${args.originalSubject}

${args.originalBody.slice(0, 5000)}`;

  const lines = [
    `To: ${args.escalationEmail}`,
    `Subject: [Escalation] ${args.originalSubject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    body,
  ];
  const raw = Buffer.from(lines.join('\r\n')).toString('base64url');

  await getGmailTokenAndFetch(
    tenantId,
    '/messages/send',
    {
      method: 'POST',
      body: JSON.stringify({ raw }),
    },
  );
}

// ─── Process one tenant ─────────────────────────────────────────

function isScheduledForFuture(botConfig: BotConfig | null): boolean {
  const startAt = botConfig?.schedule?.start_at;
  if (!startAt) return false;
  const ts = new Date(startAt).getTime();
  return Number.isFinite(ts) && ts > Date.now();
}

async function processTenant(tenantId: string): Promise<{ processed: number; replied: number; escalated: number; errors: number }> {
  const stats = { processed: 0, replied: 0, escalated: 0, errors: 0 };

  // Load onboarding data
  const [onboardingRaw, botConfigRaw] = await Promise.all([
    getTenantConfig(tenantId, 'cs_onboarding_data'),
    getTenantConfig(tenantId, 'cs_bot_config'),
  ]);

  if (!onboardingRaw) return stats;

  let onboarding: OnboardingData;
  let botConfig: BotConfig | null = null;
  try { onboarding = JSON.parse(onboardingRaw); } catch { return stats; }
  if (botConfigRaw) { try { botConfig = JSON.parse(botConfigRaw); } catch { /* ignore */ } }
  if (isScheduledForFuture(botConfig)) {
    console.log(`[CS Cron] Tenant ${tenantId}: scheduled for ${botConfig?.schedule?.start_at}, skipping until start time`);
    return stats;
  }

  const emailAutoReplyEnabled = await isAutoReplyEnabled(tenantId, 'email');
  if (!emailAutoReplyEnabled) {
    console.log(`[CS Cron] Tenant ${tenantId}: email auto-reply disabled, skipping`);
    return stats;
  }

  const supportEmails = onboarding.emailSetup?.supportEmails || [];
  const escalationEmail = onboarding.emailSetup?.escalationEmail || '';
  const escalationName = onboarding.emailSetup?.escalationName || 'Support Lead';

  // Find unread inbox emails from last 2 days
  const sinceDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const yyyy = sinceDate.getFullYear();
  const mm = String(sinceDate.getMonth() + 1).padStart(2, '0');
  const dd = String(sinceDate.getDate()).padStart(2, '0');

  let messageStubs: Array<{ id: string }>;
  try {
    const listRes = await getGmailTokenAndFetch(
      tenantId,
      `/messages?q=in:inbox is:unread after:${yyyy}/${mm}/${dd}&maxResults=20`
    );
    messageStubs = listRes.messages || [];
  } catch (err) {
    if (err instanceof GmailError && err.status === 401) {
      console.warn(`[CS Cron] Tenant ${tenantId}: Google token expired, skipping`);
    } else {
      console.error(`[CS Cron] Tenant ${tenantId}: Failed to list emails`, err);
    }
    stats.errors++;
    return stats;
  }

  if (messageStubs.length === 0) return stats;

  for (const stub of messageStubs) {
    try {
      // Skip already processed
      const alreadyProcessed = await isCsEmailProcessed(tenantId, stub.id);
      if (alreadyProcessed) continue;

      // Fetch full message
      const msg = await getGmailTokenAndFetch(tenantId, `/messages/${stub.id}?format=full`);
      const parsed = parseEmailHeaders(msg);
      const body = parseEmailBody(msg.payload);

      // Build headers map for auto-reply detection
      const headerMap: Record<string, string> = {};
      for (const h of (msg.payload?.headers || [])) {
        headerMap[h.name.toLowerCase()] = h.value;
      }

      // Skip auto-replies and noreply addresses
      if (isAutoReplyOrNoreply(parsed.from, headerMap)) {
        await logCsEmail({ tenantId, gmailMessageId: stub.id, threadId: parsed.threadId, fromEmail: extractSenderEmail(parsed.from), subject: parsed.subject, action: 'skipped' });
        stats.processed++;
        continue;
      }

      // Skip emails from ourselves (support emails)
      if (isSupportEmail(parsed.from, supportEmails)) {
        await logCsEmail({ tenantId, gmailMessageId: stub.id, threadId: parsed.threadId, fromEmail: extractSenderEmail(parsed.from), subject: parsed.subject, action: 'skipped' });
        stats.processed++;
        continue;
      }

      // Check for order number in email
      const orderNum = extractOrderNumber(`${parsed.subject} ${body}`);
      let orderContext: string | null = null;
      if (orderNum) {
        orderContext = await lookupOrder(tenantId, orderNum);
      }

      // Load thread context (previous messages)
      const threadSnippets: string[] = [];
      if (parsed.threadId) {
        try {
          const threadRes = await getGmailTokenAndFetch(
            tenantId,
            `/threads/${parsed.threadId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`
          );
          const msgs = (threadRes.messages || []).filter((m: { id: string }) => m.id !== stub.id);
          for (const m of msgs.slice(-4)) {
            const from = (m.payload?.headers || []).find((h: { name: string }) => h.name.toLowerCase() === 'from')?.value || '';
            threadSnippets.push(`From: ${from}\n${m.snippet || ''}`);
          }
        } catch {
          // Non-critical
        }
      }

      // Generate AI reply
      const aiResult = await generateEmailReply({
        onboarding,
        botConfig,
        emailFrom: parsed.from,
        emailSubject: parsed.subject,
        emailBody: body,
        orderContext,
        threadSnippets,
      });

      if (!aiResult) {
        await logCsEmail({ tenantId, gmailMessageId: stub.id, threadId: parsed.threadId, fromEmail: extractSenderEmail(parsed.from), subject: parsed.subject, action: 'skipped' });
        stats.errors++;
        continue;
      }

      if (aiResult.shouldEscalate) {
        // Escalate to human
        if (escalationEmail) {
          await escalateEmail(tenantId, {
            originalFrom: parsed.from,
            originalSubject: parsed.subject,
            originalBody: body,
            escalationEmail,
            escalationName,
            reason: aiResult.reply.replace('[ESCALATE]', '').trim(),
            threadId: parsed.threadId,
          });
        }
        await logCsEmail({ tenantId, gmailMessageId: stub.id, threadId: parsed.threadId, fromEmail: extractSenderEmail(parsed.from), subject: parsed.subject, action: 'escalated', aiReply: aiResult.reply });

        // Mark as read
        try {
          await getGmailTokenAndFetch(tenantId, `/messages/${stub.id}/modify`, {
            method: 'POST',
            body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
          });
        } catch { /* non-critical */ }

        stats.escalated++;
      } else {
        // Auto-reply
        const replyTo = extractSenderEmail(parsed.from);
        await sendGmailReply(tenantId, {
          to: replyTo,
          subject: parsed.subject,
          body: aiResult.reply,
          threadId: parsed.threadId,
          messageId: stub.id,
        });

        await logCsEmail({ tenantId, gmailMessageId: stub.id, threadId: parsed.threadId, fromEmail: replyTo, subject: parsed.subject, action: 'auto_replied', aiReply: aiResult.reply });

        // Mark as read
        try {
          await getGmailTokenAndFetch(tenantId, `/messages/${stub.id}/modify`, {
            method: 'POST',
            body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
          });
        } catch { /* non-critical */ }

        stats.replied++;
      }

      stats.processed++;
    } catch (err) {
      console.error(`[CS Cron] Tenant ${tenantId}, message ${stub.id}: Error`, err);
      stats.errors++;
    }
  }

  // Update last processed time
  await setCsLastProcessedTime(tenantId, new Date().toISOString());

  return stats;
}

// ─── Cron Endpoint ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    const tenants = await getCsEnabledTenants();
    console.log(`[CS Cron] Processing ${tenants.length} tenants`);

    const results: Record<string, { processed: number; replied: number; escalated: number; errors: number }> = {};

    for (const tenantId of tenants) {
      try {
        results[tenantId] = await processTenant(tenantId);
      } catch (err) {
        console.error(`[CS Cron] Tenant ${tenantId} failed:`, err);
        results[tenantId] = { processed: 0, replied: 0, escalated: 0, errors: 1 };
      }
    }

    const totalReplied = Object.values(results).reduce((sum, r) => sum + r.replied, 0);
    const totalEscalated = Object.values(results).reduce((sum, r) => sum + r.escalated, 0);
    const totalErrors = Object.values(results).reduce((sum, r) => sum + r.errors, 0);

    console.log(`[CS Cron] Done in ${Date.now() - startTime}ms - replied: ${totalReplied}, escalated: ${totalEscalated}, errors: ${totalErrors}`);

    return Response.json({
      ok: true,
      tenants: tenants.length,
      replied: totalReplied,
      escalated: totalEscalated,
      errors: totalErrors,
      durationMs: Date.now() - startTime,
      details: results,
    });
  } catch (err) {
    console.error('[CS Cron] Fatal error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
