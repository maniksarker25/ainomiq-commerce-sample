import { NextRequest } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth-guard";
import { getIntegration } from "@/lib/db";
import { ShopifyError } from "@/lib/shopify";
import {
  fetchOrderFulfillments,
  fetchOrders,
  searchCustomers,
} from "@/lib/shopify-graphql";

export const dynamic = "force-dynamic";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "xiaomi/mimo-v2-pro";

type Policy = { title?: string; url?: string; content?: string };
type Product = { title?: string; url?: string };
type AgentStep = {
  step: string;
  category?: string;
  reasoning?: string;
  lookup?: string[];
  sources?: string[];
  found?: number;
  toolCalls?: { tool: string; query?: string; result?: string }[];
  model?: string;
};

async function aiCall(
  apiKey: string,
  system: string,
  user: string,
  opts: { temperature?: number; json?: boolean; signal?: AbortSignal } = {},
): Promise<string | null> {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: opts.temperature ?? 0.4,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: opts.signal,
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

// ─── Shopify tool functions (called server-side) ─────────────────

async function shopifySearchOrders(
  tenantId: string,
  query: string,
): Promise<string> {
  try {
    const param = query.includes("@")
      ? `email:${query}`
      : `name:${query}`;
    const data = await fetchOrders(tenantId, { query: param, first: 3 });
    const orders = (data.orders || []).map((o: any) => ({
      name: o.name,
      email: o.email,
      date: o.created_at?.split("T")[0],
      status: o.financial_status,
      fulfillment: o.fulfillment_status || "unfulfilled",
      total: `${o.currency} ${o.total_price}`,
      items: (o.line_items || [])
        .slice(0, 5)
        .map((li: any) => `${li.quantity}x ${li.title}`)
        .join(", "),
      tracking: (o.fulfillments || []).map((f: any) => ({
        status: f.status,
        trackingNumber: f.tracking_number,
        trackingUrl: f.tracking_url,
        company: f.tracking_company,
      })),
      shippingCity: o.shipping_address?.city,
    }));
    return orders.length
      ? JSON.stringify(orders, null, 2)
      : "No orders found for this query.";
  } catch (err) {
    return `Error: ${err instanceof ShopifyError ? err.message : "Failed to search orders"}`;
  }
}

async function shopifySearchCustomers(
  tenantId: string,
  query: string,
): Promise<string> {
  try {
    const data = await searchCustomers(tenantId, query, 3);
    const customers = (data.customers || []).map((c: any) => ({
      name: `${c.first_name} ${c.last_name}`.trim(),
      email: c.email,
      phone: c.phone,
      ordersCount: c.orders_count,
      totalSpent: c.total_spent,
      memberSince: c.created_at?.split("T")[0],
      tags: c.tags,
      note: c.note,
    }));
    return customers.length
      ? JSON.stringify(customers, null, 2)
      : "No customers found for this query.";
  } catch (err) {
    return `Error: ${err instanceof ShopifyError ? err.message : "Failed to search customers"}`;
  }
}

async function shopifyGetTracking(
  tenantId: string,
  orderId: string,
): Promise<string> {
  try {
    const data = await fetchOrderFulfillments(tenantId, orderId);
    const fulfillments = (data.fulfillments || []).map((f: any) => ({
      status: f.status,
      shipmentStatus: f.shipment_status,
      trackingNumber: f.tracking_number,
      trackingUrl: f.tracking_url,
      company: f.tracking_company,
      createdAt: f.created_at?.split("T")[0],
      items: (f.line_items || []).map((li: any) => li.title),
    }));
    return fulfillments.length
      ? JSON.stringify(fulfillments, null, 2)
      : "No fulfillments found for this order.";
  } catch (err) {
    return `Error: ${err instanceof ShopifyError ? err.message : "Failed to fetch tracking"}`;
  }
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
  if (!apiKey) {
    return Response.json(
      { error: "AI service not configured" },
      { status: 503 },
    );
  }

  const {
    tone,
    languageHandling,
    emailSignature,
    dos,
    donts,
    storeName,
    storeUrl,
    storeDescription,
    platform,
    products,
    policies,
    faq,
    analyzedSubjects,
    previousQuestions,
  } = body;

  if (!tone || !emailSignature) {
    return Response.json(
      { error: "Missing brand voice settings" },
      { status: 400 },
    );
  }

  const toneLabels: Record<string, string> = {
    casual: "casual and friendly",
    professional: "professional and polished",
    enthusiastic: "enthusiastic and upbeat",
    empathetic: "empathetic and warm",
    concise: "concise and direct",
  };

  const dosText =
    Array.isArray(dos) && dos.length
      ? `\nDo's:\n${dos.map((d: string) => `- ${d}`).join("\n")}`
      : "";
  const dontsText =
    Array.isArray(donts) && donts.length
      ? `\nDon'ts:\n${donts.map((d: string) => `- ${d}`).join("\n")}`
      : "";

  // Build concise business summary
  const summaryParts: string[] = [];
  if (storeName) summaryParts.push(`Business: ${storeName}`);
  if (storeDescription) summaryParts.push(`Description: ${storeDescription}`);
  const productList = Array.isArray(products)
    ? (products.slice(0, 10) as Product[])
    : [];
  const policyList = Array.isArray(policies) ? (policies as Policy[]) : [];
  const faqList = Array.isArray(faq) ? (faq.slice(0, 5) as string[]) : [];
  if (productList.length)
    summaryParts.push(
      `Products: ${productList
        .map((p) => p.title)
        .filter(Boolean)
        .join(", ")}`,
    );
  if (policyList.length)
    summaryParts.push(
      `Policies: ${policyList
        .map((p) => p.title)
        .filter(Boolean)
        .join(", ")}`,
    );
  if (faqList.length) summaryParts.push(`FAQ: ${faqList.join("; ")}`);
  if (Array.isArray(analyzedSubjects) && analyzedSubjects.length) {
    summaryParts.push(
      `Recent customer email subjects: ${analyzedSubjects.slice(0, 8).join(", ")}`,
    );
  }
  const businessSummary = summaryParts.join("\n");

  // Known URLs
  const knownPages: string[] = [];
  if (storeUrl) knownPages.push(storeUrl);
  for (const p of productList) {
    if (p.url) knownPages.push(`${p.title}: ${p.url}`);
  }
  for (const p of policyList) {
    if (p.url) knownPages.push(`${p.title}: ${p.url}`);
  }
  const knownPagesText = knownPages.length
    ? `\nKNOWN URLS (only these exist):\n${knownPages.join("\n")}`
    : "";

  // Avoid repeating questions
  const avoidText =
    Array.isArray(previousQuestions) && previousQuestions.length
      ? `\nDo NOT repeat these previous questions:\n${previousQuestions.map((q: string) => `- ${q}`).join("\n")}`
      : "";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  const sig = controller.signal;

  // Check if Shopify is connected (server-side, no extra frontend round-trip)
  let shopifyConnected = false;
  if (platform === "shopify") {
    try {
      const integration = await getIntegration(tenantId, "shopify");
      shopifyConnected = !!integration?.access_token;
    } catch {
      /* not connected */
    }
  }

  // Build available tools list for triage
  const availableTools = [
    '"policies" - Full text of store policies (returns, shipping, privacy, terms)',
    '"products" - Product catalog with names, prices, and URLs',
    '"faq" - FAQ answers from the website',
  ];
  if (shopifyConnected) {
    availableTools.push(
      '"shopify_orders" - Search real Shopify orders by customer email or order number (e.g. #1001). Returns order status, items, shipping, tracking.',
      '"shopify_customers" - Search real Shopify customer profiles by email or name. Returns order history, total spent, tags.',
      '"shopify_tracking" - Get tracking/fulfillment details for a specific order.',
    );
  }

  try {
    // ──────────────────────────────────────────────
    // AGENT STEP 1: Generate a realistic customer email
    // ──────────────────────────────────────────────
    const shopifyQuestionHint = shopifyConnected
      ? `\nThis is a Shopify webshop. Include Shopify-typical questions: order status ("waar is mijn bestelling?"), tracking, returns, wrong items, payment issues, discount codes, etc. You can reference specific products from the product list.`
      : "";

    const questionPrompt = `You generate realistic customer service emails for ${storeName || "a business"}.

${businessSummary}
${shopifyQuestionHint}

Language: ${languageHandling || "Match the business language."}
${avoidText}

RULES:
- You may reference products from the product list above by name.
- NEVER invent entity names, locations, or features not listed in the context.
- Vary the type each time: order questions, returns, product questions, complaints, account issues, shipping delays, etc.
- Make it realistic - include plausible details like "ik heb vorige week besteld" or "ik wacht al 5 dagen".

Return JSON: { "from": "Full Name", "subject": "Subject", "body": "2-4 sentence email" }`;

    const questionRaw = await aiCall(
      apiKey,
      questionPrompt,
      "Generate a customer email.",
      {
        temperature: 0.8,
        json: true,
        signal: sig,
      },
    );
    if (!questionRaw)
      return Response.json(
        { error: "AI: question generation failed" },
        { status: 502 },
      );

    let question: { from: string; subject: string; body: string };
    try {
      question = JSON.parse(questionRaw);
      if (!question.from || !question.subject || !question.body)
        throw new Error();
    } catch {
      return Response.json(
        { error: "AI: invalid question format" },
        { status: 502 },
      );
    }

    const customerEmail = `From: ${question.from}\nSubject: ${question.subject}\n\n${question.body}`;

    // ──────────────────────────────────────────────
    // AGENT STEP 2: Triage - classify & decide what to look up
    // ──────────────────────────────────────────────
    const triagePrompt = `You are the triage step of a customer service agent for ${storeName || "a company"}.

${businessSummary}

Available tools:
${availableTools.map((t) => `- ${t}`).join("\n")}

Analyze the customer email and decide:
1. What is the issue category? (account, order, product_question, complaint, policy_question, shipping, return, general, other)
2. Which tools would you use? Pick from the available tools list.
3. For each Shopify tool, what search query would you use? Extract the customer's email or name from the email.
4. Brief reasoning (1 sentence).

Return JSON:
{
  "category": "order",
  "lookup": ["shopify_orders", "policies"],
  "queries": { "shopify_orders": "customer@email.com", "shopify_customers": "John Doe" },
  "reasoning": "Customer is asking about their order status, need to look it up."
}`;

    const triageRaw = await aiCall(apiKey, triagePrompt, customerEmail, {
      temperature: 0.2,
      json: true,
      signal: sig,
    });

    let triage = {
      category: "general",
      lookup: [] as string[],
      queries: {} as Record<string, string>,
      reasoning: "",
    };
    if (triageRaw) {
      try {
        const parsed = JSON.parse(triageRaw);
        triage = {
          category: parsed.category || "general",
          lookup: Array.isArray(parsed.lookup) ? parsed.lookup : [],
          queries:
            typeof parsed.queries === "object" && parsed.queries
              ? parsed.queries
              : {},
          reasoning: parsed.reasoning || "",
        };
      } catch {
        /* use defaults */
      }
    }

    // ──────────────────────────────────────────────
    // AGENT STEP 3: Execute tool calls
    // ──────────────────────────────────────────────
    const lookedUp: string[] = [];
    const toolCalls: { tool: string; query?: string; result: string }[] = [];

    // Static data sources
    if (triage.lookup.includes("policies") && policyList.length) {
      const policyText = policyList
        .map((p) => {
          const snippet = p.content
            ? p.content.slice(0, 500)
            : "(no content available)";
          return `## ${p.title}${p.url ? ` - ${p.url}` : ""}\n${snippet}`;
        })
        .join("\n\n");
      lookedUp.push(`[POLICY LOOKUP]\n${policyText}`);
      toolCalls.push({
        tool: "policies",
        result: `${policyList.length} policies loaded`,
      });
    }

    if (triage.lookup.includes("products") && productList.length) {
      const prodText = productList
        .map((p) => `- ${p.title}${p.url ? ` → ${p.url}` : ""}`)
        .join("\n");
      lookedUp.push(`[PRODUCT CATALOG]\n${prodText}`);
      toolCalls.push({
        tool: "products",
        result: `${productList.length} products loaded`,
      });
    }

    if (triage.lookup.includes("faq") && faqList.length) {
      lookedUp.push(`[FAQ]\n${faqList.map((f) => `- ${f}`).join("\n")}`);
      toolCalls.push({
        tool: "faq",
        result: `${faqList.length} FAQ items loaded`,
      });
    }

    // Shopify tool calls (real API calls!)
    if (shopifyConnected) {
      if (triage.lookup.includes("shopify_orders")) {
        const query = triage.queries.shopify_orders || question.from;
        const result = await shopifySearchOrders(tenantId, query);
        lookedUp.push(`[SHOPIFY ORDER SEARCH: "${query}"]\n${result}`);
        toolCalls.push({
          tool: "shopify_orders",
          query,
          result: result.startsWith("Error") ? result : "Orders found",
        });
      }

      if (triage.lookup.includes("shopify_customers")) {
        const query = triage.queries.shopify_customers || question.from;
        const result = await shopifySearchCustomers(tenantId, query);
        lookedUp.push(`[SHOPIFY CUSTOMER SEARCH: "${query}"]\n${result}`);
        toolCalls.push({
          tool: "shopify_customers",
          query,
          result: result.startsWith("Error") ? result : "Customers found",
        });
      }

      if (triage.lookup.includes("shopify_tracking")) {
        const orderId = triage.queries.shopify_tracking || "";
        if (orderId) {
          const result = await shopifyGetTracking(tenantId, orderId);
          lookedUp.push(`[SHOPIFY TRACKING: order ${orderId}]\n${result}`);
          toolCalls.push({
            tool: "shopify_tracking",
            query: orderId,
            result: result.startsWith("Error") ? result : "Tracking loaded",
          });
        }
      }
    }

    // If no Shopify data was found and it's an order question, simulate plausible data
    const hasShopifyData = toolCalls.some(
      (tc) =>
        tc.tool.startsWith("shopify_") &&
        !tc.result.startsWith("Error") &&
        tc.result !== "No orders found for this query.",
    );
    if (
      !hasShopifyData &&
      shopifyConnected &&
      ["order", "shipping", "return"].includes(triage.category)
    ) {
      lookedUp.push(
        `[SIMULATED ORDER DATA]\nNote: No matching real orders found. Simulate a plausible response as if you found the order.`,
      );
    }

    const lookupResults = lookedUp.length
      ? `\n\nTool call results:\n\n${lookedUp.join("\n\n")}`
      : "\n\nNo tools were called.";

    // ──────────────────────────────────────────────
    // AGENT STEP 4: Compose the reply with full context
    // ──────────────────────────────────────────────
    const replyPrompt = `You are a customer service AI agent for ${storeName || "this company"}. You have triaged the email and executed tool calls. Now write the reply based on what you found.

Triage: Category "${triage.category}" - ${triage.reasoning}
${lookupResults}
${knownPagesText}

Tone: ${toneLabels[tone] || tone}
Language rules: ${languageHandling || "Respond in the customer's language."}
${dosText}${dontsText}

RULES:
- Follow language rules STRICTLY.
- You may ONLY use URLs from the KNOWN URLS list. NEVER invent URLs.
- If Shopify data was found, use the REAL data in your reply: reference actual order numbers, product names, tracking numbers, and status from the tool results.
- If Shopify returned a tracking URL, include it in the reply.
- If no real data was found (simulated), act as if you looked it up and give a realistic but generic response.
- Reference specific policy details if policy text was looked up.
- Be specific and actionable - a real CS reply, not a vague "we'll look into it".

Return JSON:
{
  "thinking": "1-2 sentences: what the tools returned and what action you're taking",
  "reply": "The email reply body"
}

The reply MUST end with exactly this signature (do NOT add your own greeting/sign-off - the signature already has the closing):
${emailSignature}`;

    const replyRaw = await aiCall(apiKey, replyPrompt, customerEmail, {
      temperature: 0.4,
      json: true,
      signal: sig,
    });

    if (!replyRaw)
      return Response.json(
        { error: "AI: reply generation failed" },
        { status: 502 },
      );

    let reply: string;
    let thinking: string | undefined;
    try {
      const parsed = JSON.parse(replyRaw);
      reply = parsed.reply;
      thinking = parsed.thinking;
      if (!reply) throw new Error();
    } catch {
      reply = replyRaw;
    }

    const agentSteps: AgentStep[] = [
      {
        step: "triage",
        category: triage.category,
        reasoning: triage.reasoning,
        lookup: triage.lookup,
      },
      {
        step: "lookup",
        sources: triage.lookup,
        found: lookedUp.length,
        toolCalls,
      },
      { step: "reply", model: MODEL },
    ];

    return Response.json({
      question: {
        from: question.from,
        subject: question.subject,
        body: question.body,
      },
      reply,
      thinking,
      agentSteps,
    });
  } catch (err) {
    console.error("[Preview Agent] Error:", err);
    return Response.json(
      { error: "Failed to generate preview" },
      { status: 500 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
