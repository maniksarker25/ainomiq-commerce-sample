/**
 * Ainomiq Voice Relay Server
 * Bridges Twilio Media Streams ↔ OpenAI Realtime API
 *
 * Deploy on Railway/Render/Fly.io - anywhere WebSockets work.
 * Required env vars: OPENAI_API_KEY, TURSO_DATABASE_URL, TURSO_AUTH_TOKEN
 */

import { WebSocketServer, WebSocket } from "ws";
import { createClient } from "@libsql/client";
import { createServer } from "http";
import {
  lookupOrderByNumber,
  searchCustomers,
} from "../lib/shopify-admin-graphql.mjs";

const PORT = parseInt(process.env.PORT || "8080", 10);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_REALTIME_URL =
  "wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview";

if (!OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is required");
  process.exit(1);
}

// ── DB ──

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "",
  authToken: process.env.TURSO_AUTH_TOKEN || "",
});

async function getTenantConfig(tenantId, key) {
  try {
    const result = await db.execute({
      sql: "SELECT value FROM tenant_config WHERE tenant_id = ? AND config_key = ?",
      args: [tenantId, key],
    });
    return result.rows[0]?.value || null;
  } catch {
    return null;
  }
}

async function addCsCallEvent(tenantId, callSid, speaker, message) {
  try {
    await db.execute({
      sql: `INSERT INTO cs_call_events (tenant_id, call_sid, speaker, message, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
      args: [tenantId, callSid, speaker, message],
    });
  } catch (err) {
    console.error("[DB] addCsCallEvent error:", err.message);
  }
}

async function findTenantByTwilioNumber(phoneNumber) {
  try {
    const result = await db.execute({
      sql: `SELECT tenant_id FROM tenant_config WHERE config_key = 'cs_twilio_provisioning' AND value LIKE ?`,
      args: [`%${phoneNumber}%`],
    });
    return result.rows[0]?.tenant_id || null;
  } catch {
    return null;
  }
}

// ── Voice profile ──

async function buildVoiceProfile(tenantId) {
  const [onboardingRaw, botConfigRaw, brandVoiceRaw, shopifyRaw] =
    await Promise.all([
      getTenantConfig(tenantId, "cs_onboarding_data"),
      getTenantConfig(tenantId, "cs_bot_config"),
      getTenantConfig(tenantId, "cs_brand_voice"),
      getTenantConfig(tenantId, "shopify"),
    ]);

  let onboarding = null,
    botConfig = null,
    brandVoice = null;
  try {
    if (onboardingRaw) onboarding = JSON.parse(onboardingRaw);
  } catch {}
  try {
    if (botConfigRaw) botConfig = JSON.parse(botConfigRaw);
  } catch {}
  try {
    if (brandVoiceRaw) brandVoice = JSON.parse(brandVoiceRaw);
  } catch {}

  const policies = onboarding?.policies || onboarding?.result?.policies || [];
  const faq = onboarding?.faq || onboarding?.result?.faq || [];
  const shippingCosts =
    onboarding?.shippingCosts || onboarding?.result?.shippingCosts || null;
  const storeName = onboarding?.storeInfo?.name || "";

  return {
    tenantId,
    brandName: storeName || "Customer Care",
    language: brandVoice?.languageHandling || "Dutch",
    tone: brandVoice?.tone || "friendly",
    policies: Array.isArray(policies) ? policies.slice(0, 10) : [],
    faq: Array.isArray(faq) ? faq.slice(0, 15) : [],
    shippingCosts,
    hardRules: botConfig?.hard_rules || null,
    shopifyConnected: !!shopifyRaw,
  };
}

// ── Shopify tools ──

async function lookupShopifyOrder(tenantId, orderNumber) {
  try {
    const tokenRaw = await getTenantConfig(tenantId, "shopify");
    if (!tokenRaw) return JSON.stringify({ error: "Shopify not connected" });
    const { access_token, shop } = JSON.parse(tokenRaw);
    if (!access_token || !shop)
      return JSON.stringify({ error: "Invalid Shopify config" });

    const order = await lookupOrderByNumber(access_token, shop, orderNumber);
    if (!order)
      return JSON.stringify({ error: `Order #${orderNumber} not found` });

    return JSON.stringify({
      order_name: order.name,
      status: order.fulfillment_status || "unfulfilled",
      financial_status: order.financial_status,
      cancelled: !!order.cancelled_at,
      total: `${order.current_total_price} ${order.currency}`,
      customer_name:
        `${order.customer?.first_name || ""} ${order.customer?.last_name || ""}`.trim(),
      created_at: order.created_at,
      tracking: order.fulfillments?.[0]?.tracking_number || null,
      tracking_url: order.fulfillments?.[0]?.tracking_url || null,
    });
  } catch (err) {
    return JSON.stringify({ error: `Lookup failed: ${err.message}` });
  }
}

async function searchShopifyCustomer(tenantId, query) {
  try {
    const tokenRaw = await getTenantConfig(tenantId, "shopify");
    if (!tokenRaw) return JSON.stringify({ error: "Shopify not connected" });
    const { access_token, shop } = JSON.parse(tokenRaw);

    const customers = await searchCustomers(access_token, shop, query, 3);

    return JSON.stringify(
      (customers || []).map((c) => ({
        name: `${c.first_name || ""} ${c.last_name || ""}`.trim(),
        email: c.email,
        orders_count: c.orders_count,
        total_spent: c.total_spent,
      })),
    );
  } catch (err) {
    return JSON.stringify({ error: `Search failed: ${err.message}` });
  }
}

// ── System prompt ──

function buildSystemInstructions(profile) {
  const policyText = profile.policies
    .map((p) => `${p.title || p.type}: ${(p.content || "").slice(0, 300)}`)
    .join("\n");
  const faqText = profile.faq.slice(0, 10).join("\n");

  return `You are ${profile.brandName} Customer Care, a phone support AI agent.

PERSONALITY:
- Tone: ${profile.tone}
- Be warm, concise, and human. This is a PHONE call - speak naturally.
- Keep responses to 1-3 short sentences max.
- If the customer is upset, acknowledge their emotion first.

LANGUAGE:
- ${profile.language}
- If the language rules say "Always Dutch", speak Dutch even if the customer speaks English.

CAPABILITIES:
- You can look up orders by number using the lookup_order tool.
- You can search for customers by name or email using search_customer.
- When a customer asks about an order, ask for their order number and use the tool.
- Summarize tool results naturally - don't read out raw data.

STORE POLICIES:
${policyText || "No policies loaded."}

SHIPPING COSTS: ${profile.shippingCosts || "Unknown"}

FAQ:
${faqText || "No FAQ loaded."}

${profile.hardRules ? `HARD RULES:\n${profile.hardRules}` : ""}

CRITICAL:
- Never mention AI, Ainomiq, or OpenAI.
- Never fabricate data you haven't looked up.
- If you can't help, offer to connect to a human specialist.
- Start with a brief warm greeting.`;
}

// ── Tool definitions ──

function getTools(profile) {
  if (!profile.shopifyConnected) return [];
  return [
    {
      type: "function",
      name: "lookup_order",
      description:
        "Look up a Shopify order by order number. Returns status, tracking, customer info.",
      parameters: {
        type: "object",
        properties: {
          order_number: {
            type: "string",
            description: 'Order number (digits only, e.g. "1042")',
          },
        },
        required: ["order_number"],
      },
    },
    {
      type: "function",
      name: "search_customer",
      description: "Search for a customer by name or email.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Customer name or email" },
        },
        required: ["query"],
      },
    },
  ];
}

// ── HTTP server + WebSocket upgrade ──

const server = createServer((req, res) => {
  // Health check endpoint for Railway/Render
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "ainomiq-voice-relay" }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

wss.on("connection", (twilioWs, req) => {
  console.log(`[Relay] New connection from ${req.socket.remoteAddress}`);

  let streamSid = null;
  let callSid = null;
  let tenantId = null;
  let openaiWs = null;
  let profile = null;

  function connectOpenAI() {
    const ws = new WebSocket(OPENAI_REALTIME_URL, {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1",
      },
    });

    ws.on("open", () => console.log("[OpenAI] Connected"));

    ws.on("message", async (data) => {
      try {
        const event = JSON.parse(data.toString());
        await handleOpenAIEvent(event);
      } catch (err) {
        console.error("[OpenAI] Parse error:", err);
      }
    });

    ws.on("close", (code, reason) => {
      console.log(`[OpenAI] Disconnected: ${code} ${reason}`);
      openaiWs = null;
    });

    ws.on("error", (err) => console.error("[OpenAI] Error:", err.message));

    return ws;
  }

  async function handleOpenAIEvent(event) {
    switch (event.type) {
      case "session.created":
        console.log("[OpenAI] Session created");
        break;

      case "session.updated":
        console.log("[OpenAI] Session configured");
        // Trigger the AI to speak the opening greeting
        if (openaiWs?.readyState === WebSocket.OPEN) {
          openaiWs.send(JSON.stringify({ type: "response.create" }));
        }
        break;

      case "response.audio.delta":
        // Relay audio back to Twilio
        if (event.delta && streamSid) {
          twilioWs.send(
            JSON.stringify({
              event: "media",
              streamSid,
              media: { payload: event.delta },
            }),
          );
        }
        break;

      case "response.audio_transcript.done":
        if (event.transcript) {
          console.log(`[Agent] ${event.transcript}`);
          // Log agent speech to DB
          if (tenantId && callSid) {
            addCsCallEvent(tenantId, callSid, "agent", event.transcript);
          }
        }
        break;

      case "input_audio_buffer.speech_started":
        console.log("[Caller] Speaking...");
        // Interrupt current response (barge-in)
        if (openaiWs?.readyState === WebSocket.OPEN) {
          openaiWs.send(JSON.stringify({ type: "response.cancel" }));
        }
        if (streamSid) {
          twilioWs.send(JSON.stringify({ event: "clear", streamSid }));
        }
        break;

      case "conversation.item.input_audio_transcription.completed":
        if (event.transcript) {
          console.log(`[Caller] "${event.transcript}"`);
          // Log caller speech to DB
          if (tenantId && callSid) {
            addCsCallEvent(tenantId, callSid, "caller", event.transcript);
          }
        }
        break;

      case "response.function_call_arguments.done":
        await handleToolCall(event);
        break;

      case "error":
        console.error("[OpenAI] Error:", event.error);
        break;
    }
  }

  async function handleToolCall(event) {
    const { name, arguments: argsStr, call_id } = event;
    if (!tenantId || !call_id) return;

    console.log(`[Tool] ${name}(${argsStr})`);
    let result;
    try {
      const args = JSON.parse(argsStr || "{}");
      if (name === "lookup_order") {
        result = await lookupShopifyOrder(tenantId, args.order_number);
      } else if (name === "search_customer") {
        result = await searchShopifyCustomer(tenantId, args.query);
      } else {
        result = JSON.stringify({ error: `Unknown tool: ${name}` });
      }
    } catch (err) {
      result = JSON.stringify({ error: `Tool failed: ${err.message}` });
    }

    console.log(`[Tool] Result: ${result.slice(0, 200)}`);

    if (openaiWs?.readyState === WebSocket.OPEN) {
      openaiWs.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: { type: "function_call_output", call_id, output: result },
        }),
      );
      openaiWs.send(JSON.stringify({ type: "response.create" }));
    }
  }

  async function configureSession() {
    if (!openaiWs || openaiWs.readyState !== WebSocket.OPEN || !profile) return;

    const tools = getTools(profile);
    openaiWs.send(
      JSON.stringify({
        type: "session.update",
        session: {
          modalities: ["text", "audio"],
          instructions: buildSystemInstructions(profile),
          voice: "coral",
          input_audio_format: "g711_ulaw",
          output_audio_format: "g711_ulaw",
          input_audio_transcription: { model: "whisper-1" },
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 600,
          },
          tools,
        },
      }),
    );

    console.log(
      `[Session] ${profile.brandName} (${profile.language}, ${tools.length} tools)`,
    );
  }

  // ── Twilio messages ──

  twilioWs.on("message", async (data) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.event) {
        case "connected":
          console.log("[Twilio] Stream connected");
          break;

        case "start":
          streamSid = msg.start.streamSid;
          callSid = msg.start.callSid;
          const calledNumber = msg.start.customParameters?.called || "";
          const paramTenantId = msg.start.customParameters?.tenantId || "";

          console.log(`[Twilio] Stream: ${streamSid}, Call: ${callSid}`);

          // Resolve tenant
          tenantId = paramTenantId || null;
          if (!tenantId && calledNumber) {
            tenantId = await findTenantByTwilioNumber(calledNumber);
          }
          if (!tenantId) tenantId = "pimsmit@billiejeans.eu"; // fallback

          console.log(`[Tenant] ${tenantId}`);

          profile = await buildVoiceProfile(tenantId);
          openaiWs = connectOpenAI();
          openaiWs.on("open", () => configureSession());
          break;

        case "media":
          // Forward caller audio to OpenAI
          if (openaiWs?.readyState === WebSocket.OPEN && msg.media?.payload) {
            openaiWs.send(
              JSON.stringify({
                type: "input_audio_buffer.append",
                audio: msg.media.payload,
              }),
            );
          }
          break;

        case "stop":
          console.log("[Twilio] Stream stopped");
          if (openaiWs?.readyState === WebSocket.OPEN) openaiWs.close();
          break;
      }
    } catch (err) {
      console.error("[Twilio] Error:", err);
    }
  });

  twilioWs.on("close", () => {
    console.log("[Relay] Connection closed");
    if (openaiWs?.readyState === WebSocket.OPEN) openaiWs.close();
  });

  twilioWs.on("error", (err) => console.error("[Relay] Error:", err.message));
});

server.listen(PORT, () => {
  console.log(`Voice relay running on port ${PORT}`);
});
