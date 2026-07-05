/**
 * Voice Relay Server
 * Bridges Twilio Media Streams ↔ OpenAI Realtime API
 *
 * Usage: npx tsx scripts/voice-relay.ts
 * Requires: OPENAI_API_KEY in .env
 *
 * Flow:
 * 1. Twilio calls webhook → returns <Connect><Stream> pointing here
 * 2. Twilio streams raw audio (mulaw/8000) to this WebSocket
 * 3. This relays audio to OpenAI Realtime API
 * 4. OpenAI does STT → AI reasoning → TTS all in one stream
 * 5. We relay synthesized audio back to Twilio
 */

import { WebSocketServer, WebSocket } from "ws";
import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@libsql/client";
import {
  lookupOrderByNumberWithToken,
  searchCustomersWithToken,
} from "../lib/shopify-graphql";

config({ path: resolve(__dirname, "..", ".env") });

const PORT = parseInt(process.env.VOICE_RELAY_PORT || "8080", 10);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_REALTIME_URL =
  "wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview";

if (!OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY is required in .env");
  process.exit(1);
}

// ── Turso DB helper (for tenant config lookup) ──

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "",
  authToken: process.env.TURSO_AUTH_TOKEN || "",
});

async function getTenantConfig(
  tenantId: string,
  key: string,
): Promise<string | null> {
  try {
    const result = await db.execute({
      sql: "SELECT value FROM tenant_config WHERE tenant_id = ? AND key = ?",
      args: [tenantId, key],
    });
    return (result.rows[0]?.value as string) || null;
  } catch {
    return null;
  }
}

async function findTenantByTwilioNumber(
  phoneNumber: string,
): Promise<string | null> {
  try {
    const result = await db.execute({
      sql: `SELECT tenant_id FROM tenant_config WHERE key = 'cs_twilio_provisioning' AND value LIKE ?`,
      args: [`%${phoneNumber}%`],
    });
    return (result.rows[0]?.tenant_id as string) || null;
  } catch {
    return null;
  }
}

// ── Voice profile builder ──

type VoiceProfile = {
  tenantId: string;
  brandName: string;
  language: string;
  tone: string;
  policies: { type: string; title: string; content: string }[];
  faq: string[];
  shippingCosts: string | null;
  hardRules: string | null;
  shopifyConnected: boolean;
};

async function buildVoiceProfile(tenantId: string): Promise<VoiceProfile> {
  const [onboardingRaw, botConfigRaw, brandVoiceRaw, shopifyRaw] =
    await Promise.all([
      getTenantConfig(tenantId, "cs_onboarding_data"),
      getTenantConfig(tenantId, "cs_bot_config"),
      getTenantConfig(tenantId, "cs_brand_voice"),
      getTenantConfig(tenantId, "shopify"),
    ]);

  let onboarding: any = null;
  let botConfig: any = null;
  let brandVoice: any = null;

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

// ── Shopify order lookup (for function calling) ──

async function lookupShopifyOrder(
  tenantId: string,
  orderNumber: string,
): Promise<string> {
  try {
    const tokenRaw = await getTenantConfig(tenantId, "shopify");
    if (!tokenRaw) return JSON.stringify({ error: "Shopify not connected" });
    const { access_token, shop } = JSON.parse(tokenRaw);
    if (!access_token || !shop)
      return JSON.stringify({ error: "Invalid Shopify config" });

    const order = await lookupOrderByNumberWithToken(access_token, shop, orderNumber);
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
    return JSON.stringify({
      error: `Lookup failed: ${(err as Error).message}`,
    });
  }
}

async function searchShopifyCustomer(
  tenantId: string,
  query: string,
): Promise<string> {
  try {
    const tokenRaw = await getTenantConfig(tenantId, "shopify");
    if (!tokenRaw) return JSON.stringify({ error: "Shopify not connected" });
    const { access_token, shop } = JSON.parse(tokenRaw);

    const { customers } = await searchCustomersWithToken(access_token, shop, query, 3);

    return JSON.stringify(
      (customers || []).map((c) => ({
        name: `${c.first_name || ""} ${c.last_name || ""}`.trim(),
        email: c.email,
        orders_count: c.orders_count,
        total_spent: c.total_spent,
      })),
    );
  } catch (err) {
    return JSON.stringify({
      error: `Search failed: ${(err as Error).message}`,
    });
  }
}

// ── System prompt builder ──

function buildSystemInstructions(profile: VoiceProfile): string {
  const policyText = profile.policies
    .map((p) => `${p.title || p.type}: ${(p.content || "").slice(0, 300)}`)
    .join("\n");

  const faqText = profile.faq.slice(0, 10).join("\n");

  return `You are ${profile.brandName} Customer Care, a phone support AI agent.

PERSONALITY:
- Tone: ${profile.tone}
- Be warm, concise, and human. This is a phone call, not a chat.
- Keep responses to 1-3 short sentences. People are listening, not reading.
- If the customer is upset, acknowledge their emotion first before solving.

LANGUAGE:
- ${profile.language}
- If the language rules say "Always Dutch", speak Dutch even if the customer speaks English.

CAPABILITIES:
- You can look up orders by order number using the lookup_order tool.
- You can search for customers by name or email using the search_customer tool.
- When a customer asks about an order, ask for their order number and use the tool.
- When you get results, summarize them naturally in speech.

STORE POLICIES:
${policyText || "No policies available."}

SHIPPING COSTS: ${profile.shippingCosts || "Unknown"}

FAQ:
${faqText || "No FAQ available."}

${profile.hardRules ? `HARD RULES:\n${profile.hardRules}` : ""}

IMPORTANT:
- Never mention you are an AI, Ainomiq, or OpenAI.
- Never fabricate order numbers, tracking codes, or data you haven't looked up.
- If you can't help, offer to connect to a human specialist.
- Start the conversation with a brief, warm greeting in the appropriate language.`;
}

// ── OpenAI Realtime tools definition ──

function getTools(profile: VoiceProfile) {
  const tools: any[] = [];

  if (profile.shopifyConnected) {
    tools.push({
      type: "function",
      name: "lookup_order",
      description:
        "Look up a Shopify order by order number. Returns order status, fulfillment, tracking, and customer info.",
      parameters: {
        type: "object",
        properties: {
          order_number: {
            type: "string",
            description: 'The order number (just digits, e.g. "1042")',
          },
        },
        required: ["order_number"],
      },
    });

    tools.push({
      type: "function",
      name: "search_customer",
      description: "Search for a customer by name or email address.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Customer name or email to search for",
          },
        },
        required: ["query"],
      },
    });
  }

  return tools;
}

// ── WebSocket server ──

const wss = new WebSocketServer({ port: PORT });
console.log(`🎙️  Voice relay running on ws://localhost:${PORT}`);

wss.on("connection", (twilioWs: WebSocket, req) => {
  console.log(`[Relay] New Twilio connection from ${req.socket.remoteAddress}`);

  let streamSid: string | null = null;
  let callSid: string | null = null;
  let tenantId: string | null = null;
  let openaiWs: WebSocket | null = null;
  let profile: VoiceProfile | null = null;

  // Connect to OpenAI Realtime
  function connectOpenAI() {
    const ws = new WebSocket(OPENAI_REALTIME_URL, {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1",
      },
    });

    ws.on("open", () => {
      console.log("[OpenAI] Connected to Realtime API");
    });

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

    ws.on("error", (err) => {
      console.error("[OpenAI] Error:", err.message);
    });

    return ws;
  }

  async function handleOpenAIEvent(event: any) {
    switch (event.type) {
      case "session.created":
        console.log("[OpenAI] Session created");
        break;

      case "session.updated":
        console.log("[OpenAI] Session configured");
        break;

      case "response.audio.delta":
        // Relay audio from OpenAI back to Twilio
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

      case "response.audio_transcript.delta":
        // Agent is speaking - log for transcript
        break;

      case "response.audio_transcript.done":
        if (event.transcript) {
          console.log(`[Agent] ${event.transcript}`);
        }
        break;

      case "input_audio_buffer.speech_started":
        console.log("[Caller] Speaking...");
        // Interrupt any current response
        if (openaiWs?.readyState === WebSocket.OPEN) {
          openaiWs.send(JSON.stringify({ type: "response.cancel" }));
        }
        // Clear Twilio's audio buffer to stop playback
        if (streamSid) {
          twilioWs.send(JSON.stringify({ event: "clear", streamSid }));
        }
        break;

      case "conversation.item.input_audio_transcription.completed":
        if (event.transcript) {
          console.log(`[Caller] "${event.transcript}"`);
        }
        break;

      case "response.function_call_arguments.done":
        // Handle tool calls
        await handleToolCall(event);
        break;

      case "response.done":
        // Response complete
        break;

      case "error":
        console.error("[OpenAI] Error event:", event.error);
        break;
    }
  }

  async function handleToolCall(event: any) {
    const { name, arguments: argsStr, call_id } = event;
    if (!tenantId || !call_id) return;

    console.log(`[Tool] ${name}(${argsStr})`);

    let result: string;
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
      result = JSON.stringify({
        error: `Tool execution failed: ${(err as Error).message}`,
      });
    }

    console.log(`[Tool] Result: ${result.slice(0, 200)}`);

    // Send function result back to OpenAI
    if (openaiWs?.readyState === WebSocket.OPEN) {
      openaiWs.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id,
            output: result,
          },
        }),
      );

      // Trigger a new response after providing tool output
      openaiWs.send(JSON.stringify({ type: "response.create" }));
    }
  }

  async function configureSession() {
    if (!openaiWs || openaiWs.readyState !== WebSocket.OPEN || !profile) return;

    const tools = getTools(profile);
    const instructions = buildSystemInstructions(profile);

    openaiWs.send(
      JSON.stringify({
        type: "session.update",
        session: {
          modalities: ["text", "audio"],
          instructions,
          voice: "coral", // warm female voice
          input_audio_format: "g711_ulaw",
          output_audio_format: "g711_ulaw",
          input_audio_transcription: { model: "whisper-1" },
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500,
          },
          tools,
        },
      }),
    );

    console.log(
      `[Session] Configured for ${profile.brandName} (${profile.language}, tools: ${tools.length})`,
    );
  }

  // Handle Twilio messages
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
          const calledNumber =
            msg.start.customParameters?.called || msg.start.to || "";
          const paramTenantId = msg.start.customParameters?.tenantId || "";

          console.log(
            `[Twilio] Stream started: ${streamSid}, call: ${callSid}`,
          );

          // Resolve tenant
          if (paramTenantId) {
            tenantId = paramTenantId;
          } else if (calledNumber) {
            tenantId = await findTenantByTwilioNumber(calledNumber);
          }

          // Fallback to hardcoded tenant
          if (!tenantId) {
            tenantId = "pimsmit@billiejeans.eu";
          }

          console.log(`[Tenant] Resolved: ${tenantId}`);

          // Build voice profile
          profile = await buildVoiceProfile(tenantId);

          // Connect to OpenAI
          openaiWs = connectOpenAI();
          openaiWs.on("open", () => configureSession());
          break;

        case "media":
          // Forward audio from Twilio to OpenAI
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
          if (openaiWs?.readyState === WebSocket.OPEN) {
            openaiWs.close();
          }
          break;
      }
    } catch (err) {
      console.error("[Twilio] Message error:", err);
    }
  });

  twilioWs.on("close", () => {
    console.log("[Twilio] Connection closed");
    if (openaiWs?.readyState === WebSocket.OPEN) {
      openaiWs.close();
    }
  });

  twilioWs.on("error", (err) => {
    console.error("[Twilio] Error:", err.message);
  });
});
