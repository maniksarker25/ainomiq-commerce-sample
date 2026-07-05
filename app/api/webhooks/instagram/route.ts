import { NextRequest, NextResponse } from "next/server";
import {
  findTenantIdByIgAccountId,
  findTenantIdByMetaPageId,
  upsertIgComment,
  upsertIgMessage,
  db,
  getTenantEmailAliases,
} from "@/lib/db";
import {
  getMetaWebhookVerifyToken,
  verifyMetaWebhookSignature,
} from "@/lib/meta-webhooks";
import { sendInstagramDm, sendFacebookMessengerDm } from "@/lib/cs-social";
import { generateSocialAIReply } from "@/lib/cs-ai";
import { isAutoReplyEnabled } from "@/lib/cs-auto-reply-server";

function pickAutoReplyText(text: string): string | null {
  const lower = (text || "").toLowerCase();
  if (!lower.trim()) return null;
  if (/\b(hi|hey|hello|hoi|hallo)\b/i.test(lower)) {
    return "Hey! Thanks for reaching out. How can we help you today?";
  }
  if (/\b(order|track|shipping)\b/i.test(lower)) {
    return "I'd be happy to help with your order. Could you share your order number?";
  }
  return "Thanks for your message. Our team will get back to you shortly.";
}

async function maybeAutoReplyDm(
  tenantId: string,
  senderId: string,
  lastMessage: string,
  platform: "instagram" | "facebook",
) {
  const channel = platform === "facebook" ? "facebook" : "instagram";
  const enabled = await isAutoReplyEnabled(tenantId, channel);
  if (!enabled) {
    console.log(
      `[webhook] Auto-reply skipped (${channel}) tenant=${tenantId} sender=${senderId}`,
    );
    return;
  }
  if (process.env.META_WEBHOOK_AUTO_REPLY === "0") return;

  // 1. Fetch thread history from SQLite
  let threadHistory: Array<{ role: "user" | "assistant"; content: string }> =
    [];
  try {
    const aliases = await getTenantEmailAliases(tenantId);
    const placeholders = aliases.map(() => "?").join(",");
    const historyRes = await db.execute({
      sql: `SELECT message_text, direction FROM ig_messages 
            WHERE tenant_id IN (${placeholders}) AND (sender_id = ? OR recipient_id = ?) 
            ORDER BY timestamp DESC LIMIT 8`,
      args: [...aliases, senderId, senderId],
    });
    threadHistory = historyRes.rows
      .map((r) => ({
        role: (r.direction === "inbound" ? "user" : "assistant") as
          | "user"
          | "assistant",
        content: String(r.message_text || ""),
      }))
      .reverse();
  } catch (err) {
    console.error("[webhook] Thread history fetch error:", err);
  }

  // 2. Generate AI reply
  let reply = "";
  let shouldEscalate = false;

  const aiResult = await generateSocialAIReply({
    tenantId,
    senderId,
    lastMessage,
    threadHistory,
    platform: platform === "facebook" ? "facebook" : "instagram",
  });

  if (aiResult) {
    reply = aiResult.reply;
    shouldEscalate = aiResult.shouldEscalate;
  } else {
    // Fallback to static text
    reply =
      pickAutoReplyText(lastMessage) ||
      "Thanks for your message. Our team will get back to you shortly.";
    if (/\b(help|agent|human|escalat|mens)\b/i.test(lastMessage)) {
      shouldEscalate = true;
    }
  }

  // 3. Process escalation
  if (shouldEscalate) {
    reply = reply.replace(/^\[ESCALATE\]\s*/i, "").trim();
    if (!reply) {
      reply =
        "I want to make sure you get the best help possible. Let me connect you with a human agent who can assist further. They'll be with you shortly.";
    }

    try {
      const aliases = await getTenantEmailAliases(tenantId);
      const placeholders = aliases.map(() => "?").join(",");
      await db.execute({
        sql: `UPDATE ig_messages SET status = 'escalated' WHERE tenant_id IN (${placeholders}) AND (sender_id = ? OR recipient_id = ?)`,
        args: [...aliases, senderId, senderId],
      });
    } catch (err) {
      console.error("[webhook] Failed to update escalation status:", err);
    }
  }

  try {
    if (platform === "facebook") {
      await sendFacebookMessengerDm(tenantId, {
        recipientId: senderId,
        message: reply,
      });
    } else {
      await sendInstagramDm(tenantId, { recipientId: senderId, message: reply });
    }
  } catch (err) {
    console.error("[webhook] auto-reply failed:", err);
  }
}

// GET - Meta webhook verification challenge
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = getMetaWebhookVerifyToken();
  if (mode === "subscribe" && verifyToken && token === verifyToken) {
    console.log("[webhook] Instagram verification successful");
    return new NextResponse(challenge, { status: 200 });
  }

  if (mode === "subscribe" && !verifyToken) {
    console.warn(
      "[webhook] META_WEBHOOK_VERIFY_TOKEN is not set - cannot verify Meta subscription challenge",
    );
  }

  console.warn("[webhook] Instagram verification failed", { mode, token });
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// POST - Incoming webhook events (DMs, comments, etc.)
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  // Always verify the signature — there is no "dev bypass". A missing app
  // secret is a misconfiguration, not an excuse to accept unsigned events.
  if (!process.env.META_APP_SECRET) {
    console.error("[webhook] META_APP_SECRET not set — cannot verify Instagram webhook.");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  if (!signature) {
    console.warn("[webhook] Missing x-hub-signature-256 header");
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }
  if (!verifyMetaWebhookSignature(rawBody, signature)) {
    console.warn("[webhook] Invalid signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  try {
    const object = body.object as string | undefined;
    if (object !== "page" && object !== "instagram") {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const entries = (body.entry as Array<Record<string, unknown>>) || [];

    for (const entry of entries) {
      const pageOrIgId = String(entry.id || "");

      const messaging =
        (entry.messaging as Array<Record<string, unknown>>) || [];
      for (const event of messaging) {
        const message = event.message as Record<string, unknown> | undefined;
        if (!message || message.is_echo) continue;

        const senderId = String((event.sender as { id?: string })?.id || "");
        const recipientId = String(
          (event.recipient as { id?: string })?.id || "",
        );
        const mid = String(
          message.mid || message.id || `mid-${Date.now()}-${senderId}`,
        );
        const text = String(message.text || "");
        const ts = event.timestamp
          ? new Date(Number(event.timestamp)).toISOString()
          : new Date().toISOString();

        let tenantId =
          (await findTenantIdByMetaPageId(recipientId)) ||
          (await findTenantIdByMetaPageId(pageOrIgId)) ||
          (await findTenantIdByIgAccountId(recipientId)) ||
          (await findTenantIdByIgAccountId(pageOrIgId));

        if (!tenantId && senderId) {
          tenantId = await findTenantIdByMetaPageId(senderId);
        }

        if (!tenantId) {
          console.log("[webhook] No tenant for DM", {
            pageOrIgId,
            senderId,
            recipientId,
          });
          continue;
        }

        await upsertIgMessage({
          id: mid,
          tenantId,
          conversationId: null,
          senderId,
          recipientId,
          messageText: text,
          direction: "inbound",
          status: "unread",
          timestamp: ts,
        });

        if (senderId && text) {
          const platform =
            object === "page" ? ("facebook" as const) : ("instagram" as const);
          void maybeAutoReplyDm(tenantId, senderId, text, platform);
        }
      }

      const changes = (entry.changes as Array<Record<string, unknown>>) || [];
      for (const change of changes) {
        const field = String(change.field || "");
        if (field !== "feed" && field !== "comments") continue;

        const value = (change.value as Record<string, unknown>) || {};
        const item = String(value.item || "");
        if (item && item !== "comment") continue;

        const commentId = String(value.comment_id || value.id || "");
        if (!commentId) continue;

        const from = (value.from as { id?: string; name?: string }) || {};
        const senderId = String(from.id || "");
        const commentText = String(value.message || value.text || "");
        const media = value.media as { id?: string } | undefined;
        const postId = String(
          value.post_id || media?.id || value.parent_id || "unknown",
        );

        const tenantId =
          (await findTenantIdByMetaPageId(pageOrIgId)) ||
          (await findTenantIdByIgAccountId(pageOrIgId));

        if (!tenantId) {
          console.log("[webhook] No tenant for comment", {
            pageOrIgId,
            commentId,
          });
          continue;
        }

        await upsertIgComment({
          id: commentId,
          tenantId,
          postId,
          senderId,
          senderUsername: from.name || null,
          commentText,
          status: "unread",
        });
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("[webhook] Error processing Instagram event:", err);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
