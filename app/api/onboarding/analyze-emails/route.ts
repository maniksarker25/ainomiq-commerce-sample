import { NextRequest } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth-guard";
import {
  getGmailToken,
  gmailFetch,
  parseEmailHeaders,
  parseEmailBody,
} from "@/lib/gmail";
import { fetchSentEmails } from "@/lib/imap";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function formatDateForGmail(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

// Strip HTML tags for cleaner AI input
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchEmailsViaGmail(tenantId: string) {
  const token = await getGmailToken(tenantId);

  const afterDate = formatDateForGmail(90);

  // Fetch threads first (best quality: inbound + reply)
  const listRes = await gmailFetch(
    token,
    `/threads?q=in:sent -in:draft -from:noreply -from:no-reply after:${afterDate}&maxResults=60`,
  );
  const threads = listRes.threads || [];

  // Get user's email to distinguish sent vs received
  const profileRes = await gmailFetch(token, "/profile").catch(() => null);
  const userEmail = (profileRes?.emailAddress || "").toLowerCase();

  const conversations: {
    subject: string;
    to: string;
    inbound: string;
    reply: string;
  }[] = [];

  for (const thread of threads.slice(0, 50)) {
    try {
      const threadData = await gmailFetch(
        token,
        `/threads/${thread.id}?format=full`,
      );
      const messages = threadData.messages || [];
      if (messages.length < 2) continue; // Skip single-message threads (not a conversation)

      // Find an inbound message and our reply
      let inboundMsg = null;
      let replyMsg = null;

      for (const msg of messages) {
        const headers = parseEmailHeaders(msg);
        const fromLower = (headers.from || "").toLowerCase();
        const isFromUs = userEmail && fromLower.includes(userEmail);

        if (!isFromUs && !inboundMsg) {
          inboundMsg = msg;
        } else if (isFromUs && inboundMsg && !replyMsg) {
          replyMsg = msg;
        }
      }

      if (!inboundMsg || !replyMsg) continue;

      const inboundHeaders = parseEmailHeaders(inboundMsg);
      const replyHeaders = parseEmailHeaders(replyMsg);

      let inboundBody = parseEmailBody(inboundMsg.payload);
      if (inboundBody.includes("<")) inboundBody = stripHtml(inboundBody);
      if (inboundBody.length > 800)
        inboundBody = inboundBody.slice(0, 800) + "...";

      let replyBody = parseEmailBody(replyMsg.payload);
      if (replyBody.includes("<")) replyBody = stripHtml(replyBody);
      if (replyBody.length > 1200) replyBody = replyBody.slice(0, 1200) + "...";

      if (replyBody.trim()) {
        const conv = {
          subject: replyHeaders.subject || inboundHeaders.subject,
          to: replyHeaders.to,
          inbound: inboundBody.trim(),
          reply: replyBody.trim(),
        };
        if (isRelevantConversation(conv)) {
          conversations.push(conv);
        }
      }
    } catch {
      // Skip individual thread errors
    }

    // Stop once we have enough
    if (conversations.length >= 15) break;
  }

  // Fallback: if thread-matching gives too few, analyze plain sent messages
  if (conversations.length >= 3) return dedup(conversations);

  try {
    const msgRes = await gmailFetch(
      token,
      `/messages?q=in:sent -in:draft -from:noreply -from:no-reply after:${afterDate}&maxResults=60`,
    );
    const messages = msgRes.messages || [];
    const sentOnly: Conversation[] = [];

    for (const msg of messages.slice(0, 60)) {
      try {
        const msgData = await gmailFetch(
          token,
          `/messages/${msg.id}?format=full`,
        );
        const headers = parseEmailHeaders(msgData);
        let replyBody = parseEmailBody(msgData.payload);
        if (replyBody.includes("<")) replyBody = stripHtml(replyBody);
        if (replyBody.length > 1200)
          replyBody = replyBody.slice(0, 1200) + "...";
        if (!replyBody.trim()) continue;

        const conv: Conversation = {
          subject: headers.subject || "(no subject)",
          to: headers.to || "",
          inbound: "",
          reply: replyBody.trim(),
        };
        if (isRelevantConversation(conv)) sentOnly.push(conv);
      } catch {
        // skip message
      }
      if (sentOnly.length >= 15) break;
    }

    if (sentOnly.length >= 3) return dedup(sentOnly);
  } catch {
    // ignore fallback fetch failures
  }

  return dedup(conversations);
}

async function fetchEmailsViaImap(creds: {
  imapHost: string;
  imapPort: string;
  imapUser: string;
  imapPassword: string;
}) {
  const raw = await fetchSentEmails(
    {
      host: creds.imapHost,
      port: parseInt(creds.imapPort, 10) || 993,
      user: creds.imapUser,
      password: creds.imapPassword,
    },
    100,
    90,
  );

  // IMAP can't easily fetch threads, so we return sent emails as reply-only conversations
  // Filter to prefer actual replies (Re: subjects)
  const replies = raw.filter((e) => /^re:/i.test(e.subject.trim()));
  const source = replies.length >= 3 ? replies : raw;

  return dedup(
    source
      .map((e) => ({
        subject: e.subject,
        to: e.to,
        inbound: "", // Not available via IMAP without thread matching
        reply: e.body.length > 1500 ? e.body.slice(0, 1500) + "..." : e.body,
      }))
      .filter(isRelevantConversation),
  );
}

interface Conversation {
  subject: string;
  to: string;
  inbound: string;
  reply: string;
}

// Filter out non-CS conversations (internal, vendor, billing, support tickets, newsletters)
// These pollute the brand voice analysis with irrelevant communication styles
const IRRELEVANT_SUBJECT_PATTERNS = [
  /\b(invoice|factuur|factur|payment|betaling)\b/i, // Billing / invoices
  /\b(suspension|suspended|verify.*account|account.*verif)/i, // Platform support tickets
  /\bsommatie\b/i, // Legal summons
  /\b(unsubscribe|uitschrijv|newsletter|nieuwsbrief)\b/i, // Newsletters
  /\b(cron|deploy|build|error|exception|staging|prod)\b/i, // Dev/ops
  /\b(artikelwijziging|seo|b2b.*aanvraag)\b/i, // Internal/vendor ops
];

const IRRELEVANT_RECIPIENT_PATTERNS = [
  /\b(zendesk|freshdesk|intercom|hubspot)\b/i, // Support platforms (we're the customer)
  /\b(twilio|stripe|vercel|github|aws|google|cloudflare)\b/i, // SaaS vendors
  /\bnoreply@|no-reply@/i, // Auto-replies
];

function isRelevantConversation(conv: Conversation): boolean {
  const subject = conv.subject || "";
  const to = conv.to || "";

  for (const pattern of IRRELEVANT_SUBJECT_PATTERNS) {
    if (pattern.test(subject)) return false;
  }
  for (const pattern of IRRELEVANT_RECIPIENT_PATTERNS) {
    if (pattern.test(to)) return false;
  }

  // Skip conversations where we're clearly the customer asking for support
  // (e.g., our email TO a vendor's support address)
  if (
    /support@|help@|info@.*\.(io|com|dev|app)\b/i.test(to) &&
    !/\.(nl|be|de|eu)\b/i.test(to)
  ) {
    return false;
  }

  return true;
}

// Dedup: keep only the most recent email per unique subject+recipient thread
function dedup(conversations: Conversation[]): Conversation[] {
  const seen = new Set<string>();
  return conversations.filter((c) => {
    // Normalize: strip Re:/Fw: prefixes, lowercase, trim
    const subjectNorm = (c.subject || "")
      .replace(/^(re|fw|fwd):\s*/gi, "")
      .trim()
      .toLowerCase();
    const toNorm = (c.to || "").split(",")[0].trim().toLowerCase();
    const key = `${subjectNorm}||${toNorm}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function detectLanguage(text: string): "nl" | "en" {
  const sample = text.toLowerCase();
  const dutchSignals = [
    " beste ",
    " hallo ",
    " groet",
    " vriendelijke groet",
    " bedankt",
    " alstublieft",
    " klant",
    " retour",
    " verzend",
    " vraag",
  ];
  const englishSignals = [
    " hello ",
    " hi ",
    " thanks",
    " kind regards",
    " best regards",
    " customer",
    " shipping",
    " return",
    " question",
  ];

  const nlScore = dutchSignals.reduce(
    (acc, token) => acc + (sample.includes(token) ? 1 : 0),
    0,
  );
  const enScore = englishSignals.reduce(
    (acc, token) => acc + (sample.includes(token) ? 1 : 0),
    0,
  );

  return nlScore > enScore ? "nl" : "en";
}

function extractSignature(reply: string): string {
  const lines = reply
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return "Kind regards,\nTeam Support";

  const lastLines = lines.slice(-6);
  const joined = lastLines.join("\n");

  const signoffMatchers = [
    /(?:kind regards|best regards|regards|cheers|met vriendelijke groet|vriendelijke groet|groeten|mvg)[\s\S]{0,200}$/i,
  ];

  for (const matcher of signoffMatchers) {
    const m = joined.match(matcher);
    if (m?.[0]) return m[0].trim();
  }

  return lines.slice(-2).join("\n");
}

function heuristicBrandVoice(conversations: Conversation[]) {
  const replies = conversations.map((c) => c.reply || "").filter(Boolean);
  const combined = replies.join("\n\n").toLowerCase();

  const exclamations = (combined.match(/!/g) || []).length;
  const apologies = (combined.match(/sorry|apolog/i) || []).length;
  const shortReplies = replies.filter((r) => r.length < 240).length;

  let tone:
    | "casual"
    | "professional"
    | "enthusiastic"
    | "empathetic"
    | "concise" = "professional";
  if (exclamations >= 8) tone = "enthusiastic";
  else if (apologies >= 3) tone = "empathetic";
  else if (shortReplies >= Math.ceil(replies.length * 0.6)) tone = "concise";

  const nlCount = replies.filter(
    (r) => detectLanguage(` ${r} `) === "nl",
  ).length;
  const enCount = replies.length - nlCount;
  const languageHandling =
    nlCount > 0 && enCount > 0
      ? "Respond in the customer's language. Default to English."
      : nlCount > enCount
        ? "Always respond in Dutch."
        : "Always respond in English.";

  const emailSignature = extractSignature(replies[0] || "");

  const dos = [
    "Acknowledge the customer question in the first sentence.",
    "Give clear next steps and timelines when applicable.",
    "Keep replies specific to the order or issue.",
  ];

  const donts = [
    "Do not promise actions you cannot verify.",
    "Do not use vague generic responses.",
    "Do not ignore customer frustration signals.",
  ];

  return { tone, languageHandling, emailSignature, dos, donts };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  let tenantId: string;
  try {
    tenantId = await requireAuth(request, body.tenant_id);
  } catch (err) {
    return handleAuthError(err);
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  const canUseAi = Boolean(apiKey);

  try {
    // Fetch emails via Gmail or IMAP based on connectionMethod
    let conversations: Conversation[];

    if (
      body.connectionMethod === "imap_smtp" &&
      body.imapHost &&
      body.imapUser &&
      body.imapPassword
    ) {
      conversations = await fetchEmailsViaImap({
        imapHost: body.imapHost,
        imapPort: body.imapPort || "993",
        imapUser: body.imapUser,
        imapPassword: body.imapPassword,
      });
    } else {
      conversations = await fetchEmailsViaGmail(tenantId);
    }

    if (conversations.length < 3) {
      return Response.json(
        {
          error: "Could not read enough email conversations. Please try again.",
        },
        { status: 400 },
      );
    }

    let brandVoice: {
      tone: string;
      languageHandling: string;
      emailSignature: string;
      dos: string[];
      donts: string[];
    };

    if (canUseAi && apiKey) {
      // 4. Build prompt for AI analysis - include both question and reply when available
      const emailSamples = conversations
        .map((e, i) => {
          let sample = `--- Conversation ${i + 1} ---\nSubject: ${e.subject}\nTo: ${e.to}`;
          if (e.inbound) sample += `\n\n[CUSTOMER MESSAGE]\n${e.inbound}`;
          sample += `\n\n[OUR REPLY]\n${e.reply}`;
          return sample;
        })
        .join("\n\n");

      const systemPrompt = `You are an expert at analyzing customer service email communication patterns. 
You will receive a set of customer service email conversations from a brand. Each conversation may contain the customer's incoming message and the brand's reply. Analyze the brand's writing style and extract brand voice characteristics.

Pay attention to:
- How the brand addresses different types of questions
- The tone and formality used in replies
- Language patterns (which language they respond in, when they switch)
- Sign-off style and signatures
- Patterns in how they handle different situations

Return a JSON object with exactly these fields:
{
  "tone": one of "casual", "professional", "enthusiastic", "empathetic", "concise",
  "languageHandling": a short instruction about what language(s) to respond in, based on the languages you see in the emails (e.g. "Always respond in Dutch" or "Respond in the customer's language. Default to English."),
  "emailSignature": the sign-off/signature used, with each line separated by \n (e.g. "Met vriendelijke groet,\nJohn Doe\nCustomer Support\nBrand Name"),
  "dos": array of 3-5 specific rules this brand follows (based on patterns you observe, e.g. "Always address the customer by first name", "Include order number in replies"),
  "donts": array of 3-5 things this brand avoids (based on patterns, e.g. "Never use overly formal language", "Don't use emoji")
}

Be specific and practical. Base your analysis on the actual patterns in the emails, not generic advice.`;

      const userPrompt = `Here are ${conversations.length} recent customer service conversations from this brand. Analyze the communication style:\n\n${emailSamples}`;

      // 5. Call OpenRouter with Gemini
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);

      try {
        const aiRes = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3.1-flash-lite-preview",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.3,
            response_format: { type: "json_object" },
          }),
          signal: controller.signal,
        });

        if (!aiRes.ok) {
          const errText = await aiRes.text().catch(() => "");
          console.error("[Analyze] OpenRouter error:", aiRes.status, errText);
          brandVoice = heuristicBrandVoice(conversations);
        } else {
          const aiData = await aiRes.json();
          const content = aiData.choices?.[0]?.message?.content;

          if (!content) {
            brandVoice = heuristicBrandVoice(conversations);
          } else {
            const parsed = JSON.parse(content);
            if (
              !parsed.tone ||
              !parsed.languageHandling ||
              !parsed.emailSignature
            ) {
              brandVoice = heuristicBrandVoice(conversations);
            } else {
              brandVoice = {
                tone: parsed.tone,
                languageHandling: parsed.languageHandling,
                emailSignature: parsed.emailSignature,
                dos: Array.isArray(parsed.dos) ? parsed.dos : [],
                donts: Array.isArray(parsed.donts) ? parsed.donts : [],
              };
            }
          }
        }
      } finally {
        clearTimeout(timeout);
      }
    } else {
      brandVoice = heuristicBrandVoice(conversations);
    }

    return Response.json({
      brandVoice,
      emailsAnalyzed: conversations.length,
      analyzedEmails: conversations.map((e) => ({
        subject: e.subject,
        to: e.to,
        hasInbound: !!e.inbound,
      })),
      usedFallback: !canUseAi,
    });
  } catch (err) {
    console.error("[Analyze] Error:", err);
    return Response.json(
      { error: "Failed to analyze emails" },
      { status: 500 },
    );
  }
}
