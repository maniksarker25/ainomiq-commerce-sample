import {
  getContentImageModel,
  primaryImageProviderForContentModel,
} from "@/lib/content-image-models";

export type AgentDraft = {
  title: string;
  type: string;
  content: string;
  image_url?: string | null;
  image_error?: string | null;
  visual_prompt?: string | null;
};

export type ProductCatalogItem = {
  title?: string;
  price?: string;
  image_url?: string | null;
  url?: string;
  available?: boolean;
  variants?: unknown[];
};

export type AgentChatResult = {
  reply: string;
  needs_clarification: boolean;
  questions: string[];
  drafts: AgentDraft[];
  ideas: Array<{ title: string; angle: string; channel: string }>;
};

function clean(value: unknown, max = 4000) {
  return String(value || "")
    .trim()
    .slice(0, max);
}

export function cleanModelText(value: unknown, max = 4000) {
  return clean(value, max).replace(/[\u2014\u2013]/g, " - ");
}

export function normalizeMessages(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input
    .map((item): { role: "user" | "assistant"; content: string } => ({
      role: item?.role === "user" ? "user" : "assistant",
      content: clean(item?.content || item?.text, 1600),
    }))
    .filter((item) => item.content)
    .slice(-16);
}

function safeJsonParse(raw: string) {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    /* continue */
  }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

export function extractStreamingReply(buffer: string) {
  const match = buffer.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)/);
  if (!match) return "";
  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return match[1]
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
}

function fallbackReply(
  message: string,
  config: Record<string, unknown>,
  brandProfile: Record<string, unknown>,
): AgentChatResult {
  const brand = config?.brand_name || brandProfile?.brand_name || "this brand";
  return {
    reply: `I need the OpenAI model to answer properly. The ${brand} context is loaded, but the model call is unavailable right now.`,
    needs_clarification: false,
    questions: [],
    drafts: [],
    ideas: [],
  };
}

function compact(value: unknown, fallback: string) {
  return clean(value, 500) || fallback;
}

type AgentIntent = {
  asset_type: string;
  requires_images: boolean;
};

type ContextScorecard = {
  product_focus: string | null;
  target_audience: string | null;
  vibe_art_style: string | null;
  core_message: string | null;
  missing_non_core: Array<
    "product_focus" | "target_audience" | "vibe_art_style"
  >;
  needs_clarification: boolean;
  questions: string[];
};

function agentSystemPrompt() {
  return `You are the Ainomiq Content Studio inside app.ainomiq.com.

You must use the synced tenant data below: site scrape, Brand Data, Content Studio config, analysis, and training notes.

Rules:
- Generate exactly what the user asked for.
- Respect planning_mode. If planning_mode is true, return no drafts and provide strategic direction.
- Respect scorecard_gate and scorecard_summary from system context.
- If scorecard_gate is true, return needs_clarification true, include the provided questions, and return no drafts.
- If scorecard_gate is false, do not ask follow-up clarification questions. Use best assumptions from tenant context and user message, then generate output directly.
- Use intent_decision to decide output kind. If intent_decision.requires_images is true, every draft must include visual_prompt.
- For carousel/slideshow output, keep one coherent story across slides.
- Never invent products or hard business facts.
- Keep response concise, practical, and ready to use.
- No markdown code fences.
- Never use em dash or en dash. Use normal punctuation or ' - '.

Return JSON only in this shape:
{
  "reply": "short natural answer",
  "needs_clarification": false,
  "questions": ["question 1", "question 2"],
  "drafts": [
    {
      "title":"short output name",
      "type":"Design Template|Carousel Slide|Instagram Post|Ad Copy|Hook List",
      "content":"ready to use content",
      "visual_prompt":"high quality image prompt for async generation"
    }
  ],
  "ideas": [{"title":"...", "angle":"...", "channel":"..."}]
}`;
}

function buildAgentContext(
  config: Record<string, unknown>,
  brandProfile: Record<string, unknown>,
  productCatalog: ProductCatalogItem[],
  selectedProduct: ProductCatalogItem | null,
) {
  return {
    content_pipeline_config: {
      brand_name: config?.brand_name,
      brand_voice: config?.brand_voice,
      target_audience: config?.target_audience,
      product_focus: config?.product_focus,
      content_source: config?.content_source,
      output_types: config?.output_types,
      publish_platforms: config?.publish_platforms,
      training_notes: config?.training_notes || [],
      company_intake: config?.company_intake,
      company_analysis: config?.company_analysis,
    },
    synced_site_scrape_brand_profile: {
      brand_name: brandProfile?.brand_name,
      website: brandProfile?.website,
      what_you_sell: brandProfile?.what_you_sell,
      ideal_customer: brandProfile?.ideal_customer,
      customer_problem: brandProfile?.customer_problem,
      main_offer: brandProfile?.main_offer,
      proof_points: brandProfile?.proof_points,
      brand_purpose: brandProfile?.brand_purpose,
      brand_tone: brandProfile?.brand_tone,
      visual_style: brandProfile?.visual_style,
      content_goals: brandProfile?.content_goals,
      analysis: brandProfile?.analysis,
      source_summary: brandProfile?.source_summary,
      product_catalog: productCatalog.slice(0, 24),
      selected_product: selectedProduct || null,
      updated_at: brandProfile?.updated_at,
    },
  };
}

function isVagueCoreMessage(text: string) {
  if (!text.trim()) return true;
  if (text.trim().split(/\s+/).length < 3) return true;
  return /^(hi|hello|hey|help|start|go|okay|ok|sure|yo|test)\b/i.test(
    text.trim(),
  );
}

function extractCoreMessage(message: string) {
  const normalized = cleanModelText(message, 260);
  if (isVagueCoreMessage(normalized)) return null;
  return normalized;
}

function fallbackDimension(value: unknown, max = 220): string | null {
  const v = cleanModelText(value, max);
  return v || null;
}

function buildContextScorecard(
  message: string,
  config: Record<string, unknown>,
  brandProfile: Record<string, unknown>,
  selectedProduct: ProductCatalogItem | null,
): ContextScorecard {
  const productFocus =
    fallbackDimension(selectedProduct?.title) ||
    fallbackDimension(config?.product_focus) ||
    fallbackDimension(brandProfile?.main_offer) ||
    fallbackDimension(brandProfile?.what_you_sell);

  const targetAudience =
    fallbackDimension(config?.target_audience) ||
    fallbackDimension(brandProfile?.ideal_customer);

  const vibeArtStyle =
    fallbackDimension(brandProfile?.visual_style) ||
    fallbackDimension(config?.brand_voice) ||
    fallbackDimension(brandProfile?.brand_tone);

  const coreMessage = extractCoreMessage(message);

  const missingNonCore: Array<
    "product_focus" | "target_audience" | "vibe_art_style"
  > = [];
  if (!productFocus) missingNonCore.push("product_focus");
  if (!targetAudience) missingNonCore.push("target_audience");
  if (!vibeArtStyle) missingNonCore.push("vibe_art_style");

  const needsClarification = !coreMessage || missingNonCore.length >= 2;
  const questions: string[] = [];

  if (!coreMessage) {
    questions.push(
      "What is the single core message you want this post to communicate?",
    );
  }
  if (missingNonCore.includes("product_focus")) {
    questions.push(
      "Which product, offer, or service should this content focus on?",
    );
  }
  if (missingNonCore.includes("target_audience")) {
    questions.push("Who is the target audience for this content?");
  }
  if (missingNonCore.includes("vibe_art_style")) {
    questions.push(
      "What vibe or art style should the visual direction follow?",
    );
  }

  return {
    product_focus: productFocus,
    target_audience: targetAudience,
    vibe_art_style: vibeArtStyle,
    core_message: coreMessage,
    missing_non_core: missingNonCore,
    needs_clarification: needsClarification,
    questions: questions.slice(0, 3),
  };
}

async function decideGenerationIntent(
  message: string,
  history: ReturnType<typeof normalizeMessages>,
): Promise<AgentIntent> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      asset_type: "social_post",
      requires_images: /\b(image|photo|visual|carousel|slideshow|post)\b/i.test(
        message,
      ),
    };
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: agentModelId(),
      temperature: 0,
      tool_choice: "required",
      tools: [
        {
          type: "function",
          function: {
            name: "generate_social_media_assets",
            description:
              "Classify the user request and decide if the requested output requires generated visuals.",
            parameters: {
              type: "object",
              additionalProperties: false,
              properties: {
                asset_type: {
                  type: "string",
                  description:
                    "Requested output type such as instagram_post, carousel, ad_copy, template, or concept.",
                },
                requires_images: {
                  type: "boolean",
                  description:
                    "True when generated image assets are needed for best output quality.",
                },
              },
              required: ["asset_type", "requires_images"],
            },
          },
        },
      ],
      messages: [
        {
          role: "system",
          content:
            "Call the tool once. Determine whether this request should produce social assets and whether images are required.",
        },
        ...history
          .slice(-8)
          .map((item) => ({ role: item.role, content: item.content })),
        { role: "user", content: message },
      ],
    }),
  });

  if (!res.ok) {
    return {
      asset_type: "social_post",
      requires_images: /\b(image|photo|visual|carousel|slideshow|post)\b/i.test(
        message,
      ),
    };
  }

  const data = await res.json().catch(() => ({}));
  const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
  const args =
    safeJsonParse(String(toolCall?.function?.arguments || "{}")) || {};

  return {
    asset_type: clean(args.asset_type, 80) || "social_post",
    requires_images: args.requires_images === true,
  };
}

function isExplicitGenerationRequest(message: string) {
  return /(make|create|generate|write|build|draft|post|carousel|slideshow|caption|ad|template|hook|visual|image|photo|design)\b/i.test(
    cleanModelText(message, 400).toLowerCase(),
  );
}

function isDoItNowSignal(message: string) {
  return /(just do it|do it now|no just do it|no questions|skip questions|you decide|your choice|anything works|surprise me|no preference|whatever works|just make it|just generate|stop asking|nothing specific)/i.test(
    cleanModelText(message, 400).toLowerCase(),
  );
}

function hasPriorClarificationAttempt(
  history: ReturnType<typeof normalizeMessages>,
) {
  const clarificationMarkers = [
    "i need a bit more context before i generate drafts",
    "what is the single core message",
    "which product, offer, or service should this content focus on",
    "who is the target audience for this content",
    "what vibe or art style should the visual direction follow",
    "i need to clarify",
  ];

  return history.some((item) => {
    if (item.role !== "assistant") return false;
    const text = cleanModelText(item.content, 500).toLowerCase();
    return clarificationMarkers.some((marker) => text.includes(marker));
  });
}

function shouldUseScorecardGate(
  message: string,
  planningMode: boolean,
  intent: AgentIntent,
) {
  if (planningMode) return false;

  const normalized = cleanModelText(message, 400).toLowerCase();
  const words = normalized.split(/\s+/).filter(Boolean);
  const isGreetingOnly =
    words.length <= 8 &&
    /^(hi|hello|hey|yo|good morning|good afternoon|good evening|how are you|thanks|thank you|ok|okay|sure|lets go|let's go|start)\b/.test(
      normalized,
    );

  if (isGreetingOnly) return false;

  if (isDoItNowSignal(normalized)) return false;

  const explicitGenerationRequest = isExplicitGenerationRequest(normalized);

  const conversationalAssetTypes = new Set([
    "chat",
    "conversation",
    "concept",
    "qa",
    "smalltalk",
  ]);
  const assetType = clean(intent.asset_type, 60).toLowerCase();
  const semanticGenerationRequest =
    !conversationalAssetTypes.has(assetType) || intent.requires_images;

  // Usability-first behavior:
  // if user explicitly asks to generate, draft immediately and avoid clarification loops.
  if (explicitGenerationRequest) return false;

  // Keep gate only for vague/non-explicit requests that still look asset-related.
  return semanticGenerationRequest;
}

function parseAgentPayload(
  parsed: Record<string, unknown>,
  planningMode: boolean,
  intent: AgentIntent,
): AgentChatResult {
  const needsClarification = parsed.needs_clarification === true;
  const questions = Array.isArray(parsed.questions)
    ? parsed.questions
        .map((question: unknown) => cleanModelText(question, 240))
        .filter(Boolean)
        .slice(0, 3)
    : [];
  const drafts =
    planningMode || needsClarification
      ? []
      : Array.isArray(parsed.drafts)
        ? parsed.drafts
            .map((draft: Record<string, unknown>) => ({
              title: clean(draft.title, 140) || "Content post",
              type: clean(draft.type, 80) || "Post",
              content: cleanModelText(draft.content, 5000),
              visual_prompt: cleanModelText(draft.visual_prompt, 1200) || null,
            }))
            .filter((draft: AgentDraft) => draft.content)
        : [];
  const ideas = Array.isArray(parsed.ideas)
    ? parsed.ideas
        .map((idea: Record<string, unknown>) => ({
          title: clean(idea.title, 100),
          angle: clean(idea.angle, 280),
          channel: clean(idea.channel, 60),
        }))
        .filter((idea) => idea.title || idea.angle)
    : [];

  const normalizedDrafts = drafts.map((draft) =>
    intent.requires_images && !draft.visual_prompt
      ? {
          ...draft,
          visual_prompt: cleanModelText(
            `${draft.title}. ${draft.content}. Clean premium social visual, no text overlay, 4:5 composition, realistic lighting, product-focused scene.`,
            1200,
          ),
        }
      : draft,
  );

  return {
    reply:
      cleanModelText(parsed.reply, 1400) ||
      (needsClarification
        ? questions.join("\n")
        : "I used the synced Brand Data and prepared your draft output."),
    needs_clarification: needsClarification,
    questions,
    drafts: normalizedDrafts,
    ideas,
  };
}

function agentModelId() {
  return (
    process.env.CONTENT_AGENT_MODEL ||
    process.env.OPENAI_TEXT_MODEL ||
    process.env.CONTENT_TRAINING_MODEL ||
    "gpt-4o-mini"
  );
}

async function runAgentModel(
  message: string,
  history: ReturnType<typeof normalizeMessages>,
  config: Record<string, unknown>,
  brandProfile: Record<string, unknown>,
  planningMode: boolean,
  outputMode: string,
  selectedProduct: ProductCatalogItem | null,
  productCatalog: ProductCatalogItem[],
): Promise<AgentChatResult> {
  const intent = await decideGenerationIntent(message, history);
  const scorecard = buildContextScorecard(
    message,
    config,
    brandProfile,
    selectedProduct,
  );
  const userDoItNow =
    isDoItNowSignal(message) ||
    history.some(
      (item) => item.role === "user" && isDoItNowSignal(item.content),
    );
  const priorClarificationAttempt = hasPriorClarificationAttempt(history);

  const enforceScorecardGate =
    !userDoItNow &&
    !priorClarificationAttempt &&
    shouldUseScorecardGate(message, planningMode, intent);

  if (enforceScorecardGate && scorecard.needs_clarification) {
    return {
      reply: `I need a bit more context before I generate drafts. ${scorecard.questions.join(" ")}`,
      needs_clarification: true,
      questions: scorecard.questions,
      drafts: [],
      ideas: [],
    };
  }

  const context = buildAgentContext(
    config,
    brandProfile,
    productCatalog,
    selectedProduct || null,
  );

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: agentModelId(),
      temperature: 0.55,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: agentSystemPrompt() },
        {
          role: "system",
          content: `planning_mode: ${planningMode ? "true" : "false"}\noutput_mode: ${outputMode}\nintent_decision: ${JSON.stringify(intent)}\nscorecard_gate: ${enforceScorecardGate ? "true" : "false"}\nscorecard_summary: ${JSON.stringify(scorecard)}\nTenant synced context:\n${JSON.stringify(context, null, 2).slice(0, 18000)}`,
        },
        ...history.map((item) => ({ role: item.role, content: item.content })),
        { role: "user", content: message },
      ],
    }),
  });

  if (!res.ok) {
    console.error(
      "[content-agent] OpenAI failed:",
      res.status,
      await res.text().catch(() => ""),
    );
    return fallbackReply(message, config, brandProfile);
  }

  const data = await res.json().catch(() => ({}));
  const raw = clean(data?.choices?.[0]?.message?.content, 12000);
  const parsed = safeJsonParse(raw) || {};
  let result = parseAgentPayload(parsed, planningMode, intent);

  if (
    !enforceScorecardGate &&
    result.needs_clarification &&
    (isExplicitGenerationRequest(message) ||
      userDoItNow ||
      priorClarificationAttempt)
  ) {
    const retryRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: agentModelId(),
        temperature: 0.45,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: agentSystemPrompt() },
          {
            role: "system",
            content: `planning_mode: ${planningMode ? "true" : "false"}\noutput_mode: ${outputMode}\nintent_decision: ${JSON.stringify(intent)}\nscorecard_gate: false\nscorecard_summary: ${JSON.stringify(scorecard)}\nHard override: Do not ask any more clarification questions. Set needs_clarification to false and produce best-effort drafts now using assumptions from tenant context.\nTenant synced context:\n${JSON.stringify(context, null, 2).slice(0, 18000)}`,
          },
          ...history.map((item) => ({
            role: item.role,
            content: item.content,
          })),
          { role: "user", content: message },
        ],
      }),
    });

    if (retryRes.ok) {
      const retryData = await retryRes.json().catch(() => ({}));
      const retryRaw = clean(retryData?.choices?.[0]?.message?.content, 12000);
      const retryParsed = safeJsonParse(retryRaw) || {};
      result = parseAgentPayload(retryParsed, planningMode, intent);
    }

    if (result.needs_clarification) {
      result = {
        ...result,
        needs_clarification: false,
        questions: [],
        reply:
          result.reply ||
          "I made a best-effort first draft based on your message and brand context.",
      };
    }
  }

  return result;
}

export async function callAgentModel(
  message: string,
  history: ReturnType<typeof normalizeMessages>,
  config: Record<string, unknown>,
  brandProfile: Record<string, unknown>,
  planningMode = false,
  outputMode = "auto",
  selectedProduct?: ProductCatalogItem | null,
  productCatalog: ProductCatalogItem[] = [],
): Promise<AgentChatResult> {
  if (!process.env.OPENAI_API_KEY)
    return fallbackReply(message, config, brandProfile);
  return runAgentModel(
    message,
    history,
    config,
    brandProfile,
    planningMode,
    outputMode,
    selectedProduct || null,
    productCatalog,
  );
}

export async function streamCallAgentModel(
  message: string,
  history: ReturnType<typeof normalizeMessages>,
  config: Record<string, unknown>,
  brandProfile: Record<string, unknown>,
  planningMode: boolean,
  outputMode: string,
  selectedProduct: ProductCatalogItem | null,
  productCatalog: ProductCatalogItem[],
  onDelta: (replyPreview: string) => void,
): Promise<AgentChatResult> {
  const result = await callAgentModel(
    message,
    history,
    config,
    brandProfile,
    planningMode,
    outputMode,
    selectedProduct,
    productCatalog,
  );
  onDelta(result.reply);
  return result;
}

function visualPromptForDraft(
  draft: AgentDraft,
  config: Record<string, unknown>,
  brandProfile: Record<string, unknown>,
  selectedProduct?: ProductCatalogItem | null,
) {
  const brand = compact(
    config?.brand_name || brandProfile?.brand_name,
    "the brand",
  );
  const audience = compact(
    config?.target_audience || brandProfile?.ideal_customer,
    "the target audience",
  );
  const focus = compact(
    selectedProduct?.title ||
      config?.product_focus ||
      brandProfile?.main_offer ||
      brandProfile?.what_you_sell,
    "the offer",
  );
  const voice = compact(
    config?.brand_voice ||
      brandProfile?.brand_tone ||
      brandProfile?.visual_style,
    "clean, modern, premium",
  );

  return `Create a finished visual social media image template for ${brand}.

Template title: ${draft.title}
Post idea/caption: ${draft.content}
Product or offer: ${focus}
${selectedProduct?.price ? `Product price context: ${selectedProduct.price}` : ""}
Audience: ${audience}
Brand style: ${voice}

Make this a clean background visual for a designed social post template, not a finished poster with embedded copy.
Use realistic product/lifestyle photography or premium abstract brand visuals with strong composition, realistic lighting, clean spacing, and enough negative space for a separate HTML text overlay.
Do not include any text, letters, logos, watermarks, fake metrics, dashboards, UI screenshots, broken hands, distorted screens, emojis, clutter, or random brand marks.`;
}

function stockVisualForDraft(
  draft: AgentDraft,
  config: Record<string, unknown>,
  brandProfile: Record<string, unknown>,
) {
  const text =
    `${draft.title} ${draft.content} ${config?.product_focus || ""} ${brandProfile?.what_you_sell || ""} ${brandProfile?.visual_style || ""}`.toLowerCase();
  const images = [
    {
      terms: [
        "customer support",
        "support",
        "service",
        "helpdesk",
        "chat",
        "inbox",
      ],
      url: "https://images.unsplash.com/photo-1553484771-371a605b060b?auto=format&fit=crop&w=1200&q=85",
    },
    {
      terms: ["ecommerce", "commerce", "shopify", "store", "order", "checkout"],
      url: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=85",
    },
    {
      terms: ["automation", "workflow", "manual", "process", "system"],
      url: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=85",
    },
    {
      terms: ["analytics", "performance", "dashboard", "data", "growth"],
      url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=85",
    },
    {
      terms: ["email", "retention", "marketing", "campaign"],
      url: "https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=1200&q=85",
    },
    {
      terms: ["inventory", "stock", "warehouse", "fulfillment"],
      url: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=85",
    },
    {
      terms: ["proof", "review", "customer", "testimonial"],
      url: "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=1200&q=85",
    },
    {
      terms: ["feature", "module", "integration", "plug"],
      url: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=85",
    },
  ];
  const match =
    images.find((item) => item.terms.some((term) => text.includes(term))) ||
    images[2];
  const seed = encodeURIComponent(
    clean(
      `${draft.title} ${config?.brand_name || brandProfile?.brand_name || "brand"}`,
      80,
    ),
  );
  return `${match.url}&ixid=ainomiq-${seed}`;
}

export async function generateImageFromVisualPrompt(
  visualPrompt: string,
  imageModelId: string,
) {
  const prompt = cleanModelText(visualPrompt, 2400);
  if (!prompt) {
    return {
      image_url: null as string | null,
      image_error: "Visual prompt is required.",
    };
  }

  const imageModel = getContentImageModel(imageModelId);
  const primary = primaryImageProviderForContentModel(imageModel.id);

  const generateWithOpenAi = async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey)
      return {
        image_url: null as string | null,
        image_error: "OpenAI not configured",
      };
    const useHigh = imageModel.id === "openai/gpt-image-2-high";
    const attempts = [
      {
        model: imageModel.providerModel || "gpt-image-2",
        quality: useHigh ? "high" : "medium",
      },
      { model: "gpt-image-1" },
    ];
    let lastError = "Image generation failed";

    for (const attempt of attempts) {
      const response = await fetch(
        "https://api.openai.com/v1/images/generations",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: attempt.model,
            prompt,
            size: "1024x1024",
            ...(attempt.quality ? { quality: attempt.quality } : {}),
          }),
        },
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        lastError = data?.error?.message || lastError;
        continue;
      }

      const b64 = data?.data?.[0]?.b64_json;
      if (b64)
        return { image_url: `data:image/png;base64,${b64}`, image_error: null };
      if (typeof data?.data?.[0]?.url === "string")
        return { image_url: data.data[0].url, image_error: null };
      lastError = "OpenAI returned no image";
    }

    return { image_url: null as string | null, image_error: lastError };
  };

  const generateWithGemini = async () => {
    const apiKey =
      process.env.GOOGLE_GEMINI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY;
    if (!apiKey)
      return {
        image_url: null as string | null,
        image_error: "Gemini not configured",
      };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      },
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      return {
        image_url: null as string | null,
        image_error: data?.error?.message || "Gemini image generation failed",
      };
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(
      (part: Record<string, unknown>) => part?.inlineData || part?.inline_data,
    );
    const inline = (imagePart?.inlineData || imagePart?.inline_data) as
      | { data?: string; mimeType?: string; mime_type?: string }
      | undefined;
    if (!inline?.data)
      return {
        image_url: null as string | null,
        image_error: "Gemini returned no image",
      };
    const mimeType = inline.mimeType || inline.mime_type || "image/png";
    return {
      image_url: `data:${mimeType};base64,${inline.data}`,
      image_error: null,
    };
  };

  if (primary === "google") {
    const googleResult = await generateWithGemini();
    if (googleResult.image_url) return googleResult;
    const openAiResult = await generateWithOpenAi();
    if (openAiResult.image_url) return openAiResult;
    return {
      image_url: null,
      image_error:
        [googleResult.image_error, openAiResult.image_error]
          .filter(Boolean)
          .join(" · ") || "Image generation failed",
    };
  }

  const openAiResult = await generateWithOpenAi();
  if (openAiResult.image_url) return openAiResult;
  const googleResult = await generateWithGemini();
  if (googleResult.image_url) return googleResult;
  return {
    image_url: null,
    image_error:
      [openAiResult.image_error, googleResult.image_error]
        .filter(Boolean)
        .join(" · ") || "Image generation failed",
  };
}

async function generateOpenAIImageForDraft(
  draft: AgentDraft,
  config: Record<string, unknown>,
  brandProfile: Record<string, unknown>,
  selectedProduct: ProductCatalogItem | null | undefined,
  imageModelId: string,
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey)
    return {
      image_url: null as string | null,
      image_error: "OpenAI not configured",
    };

  const imageModel = getContentImageModel(imageModelId);
  const useHigh = imageModel.id === "openai/gpt-image-2-high";
  const attempts = [
    {
      model: imageModel.providerModel || "gpt-image-2",
      quality: useHigh ? "high" : "medium",
    },
    { model: "gpt-image-1" },
  ];
  let lastError = "Image generation failed";

  for (const attempt of attempts) {
    const response = await fetch(
      "https://api.openai.com/v1/images/generations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: attempt.model,
          prompt: visualPromptForDraft(
            draft,
            config,
            brandProfile,
            selectedProduct,
          ),
          size: "1024x1024",
          ...(attempt.quality ? { quality: attempt.quality } : {}),
        }),
      },
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      lastError = data?.error?.message || lastError;
      continue;
    }
    const b64 = data?.data?.[0]?.b64_json;
    if (b64)
      return { image_url: `data:image/png;base64,${b64}`, image_error: null };
    if (typeof data?.data?.[0]?.url === "string")
      return { image_url: data.data[0].url, image_error: null };
    lastError = "OpenAI returned no image";
  }

  return { image_url: null, image_error: lastError };
}

async function generateGeminiImageForDraft(
  draft: AgentDraft,
  config: Record<string, unknown>,
  brandProfile: Record<string, unknown>,
  selectedProduct: ProductCatalogItem | null | undefined,
) {
  const apiKey =
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY;
  if (!apiKey)
    return {
      image_url: null as string | null,
      image_error: "Gemini not configured",
    };

  const prompt = visualPromptForDraft(
    draft,
    config,
    brandProfile,
    selectedProduct,
  );
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
    },
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    return {
      image_url: null,
      image_error: data?.error?.message || "Gemini image generation failed",
    };
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find(
    (part: Record<string, unknown>) => part?.inlineData || part?.inline_data,
  );
  const inline = (imagePart?.inlineData || imagePart?.inline_data) as
    | { data?: string; mimeType?: string; mime_type?: string }
    | undefined;
  if (!inline?.data)
    return { image_url: null, image_error: "Gemini returned no image" };
  const mimeType = inline.mimeType || inline.mime_type || "image/png";
  return {
    image_url: `data:${mimeType};base64,${inline.data}`,
    image_error: null,
  };
}

async function generateVisualForDraft(
  draft: AgentDraft,
  config: Record<string, unknown>,
  brandProfile: Record<string, unknown>,
  selectedProduct: ProductCatalogItem | null | undefined,
  imageModelId: string,
) {
  const stockFallback = stockVisualForDraft(draft, config, brandProfile);
  const primary = primaryImageProviderForContentModel(imageModelId);

  const tryOpenAI = () =>
    generateOpenAIImageForDraft(
      draft,
      config,
      brandProfile,
      selectedProduct,
      imageModelId,
    );
  const tryGemini = () =>
    generateGeminiImageForDraft(draft, config, brandProfile, selectedProduct);

  if (primary === "google") {
    const gemini = await tryGemini();
    if (gemini.image_url) return gemini;
    const openai = await tryOpenAI();
    if (openai.image_url) return openai;
    const err =
      [gemini.image_error, openai.image_error].filter(Boolean).join(" · ") ||
      "Image generation failed";
    return {
      image_url: stockFallback,
      image_error: `${err}. Matching stock image used.`,
    };
  }

  const openaiFirst = await tryOpenAI();
  if (openaiFirst.image_url) return openaiFirst;
  const geminiSecond = await tryGemini();
  if (geminiSecond.image_url) return geminiSecond;
  const err =
    [openaiFirst.image_error, geminiSecond.image_error]
      .filter(Boolean)
      .join(" · ") || "Image generation failed";
  return {
    image_url: stockFallback,
    image_error: `${err}. Matching stock image used.`,
  };
}

function svgDataUri(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function cohesiveBrandVisualForDraft(
  draft: AgentDraft,
  index: number,
  config: Record<string, unknown>,
  brandProfile: Record<string, unknown>,
) {
  const colors = Array.isArray(
    (brandProfile?.source_summary as Record<string, unknown>)?.brand_colors,
  )
    ? (
        (brandProfile.source_summary as Record<string, unknown>)
          .brand_colors as string[]
      ).filter((color: string) => /^#[0-9a-f]{6}$/i.test(color))
    : [];
  const primary = colors[0] || "#3b82f6";
  const dark = colors[1] || "#0f172a";
  const light = colors[2] || "#dbeafe";
  const offset = index * 34;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
    <defs>
      <linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.48" stop-color="${light}"/><stop offset="1" stop-color="${primary}" stop-opacity="0.55"/></linearGradient>
      <filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="20" stdDeviation="24" flood-color="#0f172a" flood-opacity="0.14"/></filter>
    </defs>
    <rect width="1200" height="900" fill="url(#g)"/>
    <circle cx="${930 - offset}" cy="${160 + offset / 2}" r="210" fill="${primary}" opacity="0.14"/>
    <circle cx="${180 + offset}" cy="${760 - offset / 3}" r="260" fill="${dark}" opacity="0.06"/>
    <g filter="url(#s)">
      <rect x="250" y="210" width="700" height="430" rx="44" fill="#ffffff" opacity="0.92"/>
      <rect x="310" y="280" width="180" height="70" rx="22" fill="${primary}" opacity="0.9"/>
      <rect x="530" y="280" width="170" height="70" rx="22" fill="${light}" opacity="0.95"/>
      <rect x="740" y="280" width="150" height="70" rx="22" fill="${dark}" opacity="0.88"/>
      <path d="M490 315 C520 315 505 315 530 315" stroke="${dark}" stroke-width="5" opacity="0.18" fill="none"/>
      <path d="M700 315 C725 315 715 315 740 315" stroke="${dark}" stroke-width="5" opacity="0.18" fill="none"/>
      <rect x="330" y="430" width="540" height="22" rx="11" fill="${dark}" opacity="0.12"/>
      <rect x="330" y="482" width="420" height="18" rx="9" fill="${primary}" opacity="0.22"/>
      <rect x="330" y="528" width="500" height="18" rx="9" fill="${dark}" opacity="0.08"/>
    </g>
    <path d="M80 ${150 + offset} C240 ${70 + offset} 350 ${250 - offset / 2} 520 ${160 + offset / 4} S890 ${70 + offset} 1120 ${170 + offset / 3}" stroke="${primary}" stroke-width="8" opacity="0.18" fill="none"/>
  </svg>`;
  return { image_url: svgDataUri(svg), image_error: null };
}

export async function attachVisualsToDrafts(
  drafts: AgentDraft[],
  config: Record<string, unknown>,
  brandProfile: Record<string, unknown>,
  imageCount = 3,
  outputMode = "auto",
  selectedProduct?: ProductCatalogItem | null,
  imageModelId?: string,
) {
  const count = Math.max(0, Math.min(8, imageCount, drafts.length));
  const resolvedModelId = getContentImageModel(
    imageModelId ?? config?.ai_image_model,
  ).id;
  if (selectedProduct?.image_url) {
    return drafts.map((draft, index) =>
      index < count
        ? {
            ...draft,
            image_url: selectedProduct.image_url || null,
            image_error: null,
          }
        : draft,
    );
  }
  if (outputMode === "carousel") {
    return drafts.map((draft, index) =>
      index < count
        ? {
            ...draft,
            ...cohesiveBrandVisualForDraft(draft, index, config, brandProfile),
          }
        : draft,
    );
  }
  const imageDrafts = drafts.slice(0, count);
  const visualResults = await Promise.all(
    imageDrafts.map((draft) =>
      generateVisualForDraft(
        draft,
        config,
        brandProfile,
        selectedProduct,
        resolvedModelId,
      ),
    ),
  );
  return drafts.map((draft, index) =>
    index < count ? { ...draft, ...visualResults[index] } : draft,
  );
}

export function countBillableGeneratedImages(
  drafts: AgentDraft[],
  billedSlots: number,
  outputMode: string,
) {
  const slice = drafts.slice(0, billedSlots);
  if (outputMode === "carousel") {
    return slice.filter((d) => d.image_url).length;
  }
  return slice.filter((d) => {
    const url = String(d.image_url || "");
    return Boolean(url) && !url.includes("images.unsplash.com");
  }).length;
}
