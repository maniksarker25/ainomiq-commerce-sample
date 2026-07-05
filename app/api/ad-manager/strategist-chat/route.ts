import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { getTenantConfig } from '@/lib/db';
import { creditErrorResponse, getCreditAccount, requireCredits, spendCredits } from '@/lib/credits';

export const dynamic = 'force-dynamic';

const BRAND_PROFILE_KEY = 'brand_profile';
const CONTENT_CONFIG_KEY = 'content_pipeline_config';

type ChatMessage = { role?: string; content?: string; text?: string };

function clean(value: unknown, max = 4000) {
  return String(value || '').trim().slice(0, max);
}

function cleanModelText(value: unknown, max = 4000) {
  return clean(value, max)
    .replace(/[\u2014\u2013]/g, ' - ')
    .replace(/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/gi, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/ {2,}/g, ' ')
    .trim();
}

function normalizeMessages(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input
    .map((item: ChatMessage) => ({
      role: item?.role === 'user' ? 'user' : 'assistant',
      content: clean(item?.content || item?.text, 1600),
    }))
    .filter(item => item.content)
    .slice(-60);
}

function safeJsonParse(raw: string) {
  const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

const MARKETING_OPERATOR_KNOWLEDGE = `
Core marketing strategy memory:
- Start with customer awareness: unaware, problem aware, solution aware, product aware, most aware. Match the hook to the awareness stage.
- The best ad is not a feature list. It is a sharp customer situation, a visible promise, proof, and one next action.
- For Meta, broad targeting usually works best when the creative clearly pre-qualifies the person. Persona testing should mostly happen through hook, first frame, visual, overlay, offer and copy.
- A useful persona is a buying situation, not a demographic label. It should include trigger, pain, desire, objection, proof needed, visual direction and CTA.
- Creative testing needs distinct angles, not tiny copy variants. Test problem, transformation, proof, comparison, style/desire, use-case, gifting/add-on, objection handling and urgency only when true.
- Good direct-response structure: Hook, problem or desire, product mechanism, proof or reason to believe, low-friction CTA.
- Good strategic answer: explain what to make, why it fits the product and campaign signal, what to test first, what not to test yet, and how to judge the result.
- If context is weak, ask up to 3 sharp questions before generating. If the user asks for advice, advise first. Do not immediately generate unless they ask to create.
- Never invent business facts. Use tenant Brand Data, selected products, campaign metrics and user-provided context. If missing, say what is missing.
- Output should be practical for an e-commerce operator: ready-to-use personas, hooks, overlays, copy directions, ad set logic and campaign direction.
- Avoid generic labels like stylish shopper unless tied to a real product reason and a concrete ad idea.
- Think like a senior Meta creative strategist: clear, blunt, specific, mobile-first, performance-aware.
`;

function questionAlreadyAnswered(question: string, context: { hasProducts: boolean; hasCampaign: boolean; hasSignal: boolean }) {
  const q = question.toLowerCase();
  if (context.hasProducts && /product|bundle|item|catalog/.test(q)) return true;
  if (context.hasCampaign && /campaign|prospecting|retargeting|catalog|advantage|cbo|objective/.test(q)) return true;
  if (context.hasSignal && /signal|sales|ctr|cpa|roas|fatigue|performance|metric/.test(q)) return true;
  return false;
}

function fallbackReply(message: string) {
  return {
    reply: `I can help with the strategy, but the AI strategist model is unavailable right now. Brief received: ${cleanModelText(message, 240)}`,
    needs_clarification: false,
    questions: [],
    personas: [],
    ad_ideas: [],
    campaign_recommendation: null,
  };
}

export async function POST(request: NextRequest) {
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  let tenantId: string;
  try { tenantId = await requireAuth(request, body.tenant_id); } catch (err) { return handleAuthError(err); }

  const message = clean(body.message, 2400);
  if (!message) return Response.json({ error: 'Missing message' }, { status: 400 });
  const creditAccount = await getCreditAccount(tenantId);
  const logicChatUsesNomi = creditAccount.plan === 'launch';
  try {
    if (logicChatUsesNomi) await requireCredits(tenantId, 'logic_chat', 1);
  } catch (err) {
    const creditResponse = creditErrorResponse(err);
    if (creditResponse) return creditResponse;
    throw err;
  }

  const [brandRaw, contentRaw] = await Promise.all([
    getTenantConfig(tenantId, BRAND_PROFILE_KEY),
    getTenantConfig(tenantId, CONTENT_CONFIG_KEY),
  ]);

  let brandProfile: any = {};
  let contentConfig: any = {};
  try { brandProfile = brandRaw ? JSON.parse(brandRaw) : {}; } catch {}
  try { contentConfig = contentRaw ? JSON.parse(contentRaw) : {}; } catch {}

  const history = normalizeMessages(body.history);
  const requestContext = {
    tenant: tenantId,
    selected_catalog_items: Array.isArray(body.selected_catalog_items) ? body.selected_catalog_items.slice(0, 12) : [],
    selected_campaign: body.selected_campaign || null,
    campaign_mode: clean(body.campaign_mode, 40),
    new_campaign: body.new_campaign || null,
    content_source: clean(body.content_source, 40),
    destination_url: clean(body.destination_url, 800),
    creative_count: Number(body.creative_count) || null,
    library_ready_for_selection: body.library_ready_for_selection === true,
    campaign_context_label: clean(body.campaign_context_label, 240),
    campaign_signal: body.campaign_signal || null,
    available_campaigns: Array.isArray(body.available_campaigns) ? body.available_campaigns.slice(0, 25) : [],
    selected_adset_template: body.selected_adset_template || null,
    targeting_mode: clean(body.targeting_mode, 40),
    draft_goal: clean(body.draft_goal, 240),
    chat_session_id: clean(body.session_id, 160),
    existing_persona_templates: Array.isArray(body.existing_personas) ? body.existing_personas.slice(0, 8) : [],
  };

  const knownContext = {
    hasProducts: requestContext.selected_catalog_items.length > 0,
    hasCampaign: Boolean(requestContext.selected_campaign || requestContext.campaign_mode === 'new'),
    hasSignal: Boolean(requestContext.campaign_signal || requestContext.selected_campaign),
    product_focus: requestContext.selected_catalog_items.map((item: any) => item?.name).filter(Boolean).slice(0, 12),
    campaign: requestContext.selected_campaign || requestContext.new_campaign || null,
    signal: requestContext.campaign_signal || null,
    source: requestContext.content_source,
    destination_url: requestContext.destination_url,
    creative_count: requestContext.creative_count,
  };

  const tenantContext = {
    known_context_summary: knownContext,
    brand_profile: {
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
    },
    content_config: {
      brand_name: contentConfig?.brand_name,
      brand_voice: contentConfig?.brand_voice,
      target_audience: contentConfig?.target_audience,
      product_focus: contentConfig?.product_focus,
      training_notes: contentConfig?.training_notes || [],
      company_analysis: contentConfig?.company_analysis,
    },
    ad_manager_request: requestContext,
  };

  if (!process.env.OPENAI_API_KEY) return Response.json({ ok: true, model: null, ...fallbackReply(message) });

  const system = `You are the Logic Ads strategist inside app.ainomiq.com.

You are not a hardcoded persona generator. You are a senior e-commerce and Meta ads strategist. Users explain thoughts, product purpose, campaign ideas, goals, uncertainty or messy context. You turn that into sharp marketing direction.

Rules:
- Use the tenant context, selected products, selected campaign, selected ad set template, page source and campaign signal first. Do not ask for facts already present in page context.
- If selected_catalog_items has one or more items, treat those as the product focus. If multiple products are selected, advise for the full selected product group unless the user asks to narrow it.
- The chat must work even when no products are selected. If the user wants to start/create/build a campaign and product or landing page is missing, ask only for the missing setup input instead of refusing. Keep the question concrete and suitable for clickable UI options.
- If destination_url exists, treat it as the landing page. If it is missing for a campaign creation request, ask what landing page traffic should go to before marking creation_plan ready.
- Do not mark creation_plan ready when required campaign settings are unknown. Ask for the missing setting instead: product/catalog, landing page, existing campaign or new campaign name, budget, markets, objective, targeting reference, content source, number of ad sets. For retargeting custom audiences, mark ready when the user either provides exact sources or explicitly tells Logic Ads to make the audiences itself.
- Never silently assume countries, budget, objective or retargeting audiences for campaign creation. If the page context does not provide them and the user did not say them, ask. If the user explicitly says to create/build/make the retargeting audiences yourself, do not ask for an existing audience to copy. Plan self-built website custom audiences with clean inclusions and exclusions.
- If selected_campaign exists, treat it as the campaign context. Infer prospecting or broad testing from campaign name, objective, targeting template and user wording when possible. Do not ask which campaign this is for.
- If available_campaigns exists and the user names a campaign, match it to the closest available campaign. Reply naturally like "I mean X" when the match is clear. Only ask the user to choose when multiple campaigns are genuinely plausible.
- If selected_adset_template exists, treat its targeting as the requested targeting reference when the user says same targeting as this, copy this targeting or similar.
- Track chat instructions as actionable build context: inclusions, exclusions, targeting references, product selections, campaign mode and campaign goal. If enough exists, describe what can be created after explicit confirmation.
- If campaign_signal exists, use it as the current performance signal. Do not ask whether the signal is sales, CTR, CPA or fatigue unless all metrics are unavailable.
- Only ask clarification questions when the missing input is truly not available in tenant context or page selections.
- If the user asks what fits or asks for advice, give strategic advice first.
- When enough context exists, produce specific persona/ad directions that are meaningfully different.
- Each persona must include: buying situation, trigger, objection, proof needed, angle, hook, overlay, copy direction and why.
- Keep copy customer-facing English. No emojis. No em dash.
- Be practical, concise and performance-aware.

Marketing operator knowledge:
${MARKETING_OPERATOR_KNOWLEDGE}

Return JSON only in this exact shape:
{
  "reply": "natural strategic answer",
  "needs_clarification": false,
  "questions": ["question 1"],
  "personas": [{"id":"slug","name":"Persona name","basedOn":"specific basis","angle":"ad angle","hook":"hook","overlay":"short overlay","copy":"copy direction","why":"why this fits","trigger":"buying trigger","objection":"main objection","proof_needed":"proof needed"}],
  "ad_ideas": [{"title":"idea","angle":"angle","format":"image or video or carousel","first_frame":"first frame","cta":"cta"}],
  "campaign_recommendation": {"best_next_step":"...","test_plan":"...","avoid_for_now":"...","success_metric":"..."},
  "creation_plan": {"ready": false, "summary": "what will be created after explicit confirmation", "inclusions": ["..."], "exclusions": ["..."], "targeting_reference": "...", "create_scope": "campaign"}
}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.AD_STRATEGIST_MODEL || process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
      temperature: 0.6,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'system', content: `Tenant and page context. This page context is authoritative and should not be re-asked:\n${JSON.stringify(tenantContext, null, 2).slice(0, 22000)}` },
        ...history,
        { role: 'user', content: message },
      ],
    }),
  });

  if (!res.ok) {
    console.error('[ad-manager/strategist-chat] OpenAI failed:', res.status, await res.text().catch(() => ''));
    return Response.json({ ok: true, model: process.env.AD_STRATEGIST_MODEL || process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini', ...fallbackReply(message) });
  }

  const data = await res.json();
  const parsed = safeJsonParse(clean(data?.choices?.[0]?.message?.content, 12000)) || {};
  const personas = Array.isArray(parsed.personas) ? parsed.personas.map((persona: any, index: number) => ({
    id: clean(persona.id, 80) || `strategist-${index + 1}`,
    name: cleanModelText(persona.name, 100) || `Strategist persona ${index + 1}`,
    basedOn: cleanModelText(persona.basedOn, 100) || 'Strategist insight',
    angle: cleanModelText(persona.angle, 280),
    hook: cleanModelText(persona.hook, 140),
    overlay: cleanModelText(persona.overlay, 140),
    copy: cleanModelText(persona.copy, 500),
    why: cleanModelText(persona.why, 500),
    trigger: cleanModelText(persona.trigger, 220),
    objection: cleanModelText(persona.objection, 220),
    proof_needed: cleanModelText(persona.proof_needed, 220),
  })).filter((persona: any) => persona.angle || persona.hook || persona.copy).slice(0, 8) : [];

  const questions = Array.isArray(parsed.questions)
    ? parsed.questions
      .map((q: any) => cleanModelText(q, 240))
      .filter(Boolean)
      .filter((q: string) => !questionAlreadyAnswered(q, knownContext))
      .slice(0, 3)
    : [];

  const rawReply = cleanModelText(parsed.reply, 1800) || 'I reviewed the campaign context and built a strategy direction.';
  if (logicChatUsesNomi) {
    try {
      await spendCredits(tenantId, 'logic_chat', 1, 'Logic Ads strategist chat');
    } catch (err) {
      const creditResponse = creditErrorResponse(err);
      if (creditResponse) return creditResponse;
      throw err;
    }
  }
  const parsedCreation = parsed.creation_plan && typeof parsed.creation_plan === 'object' ? parsed.creation_plan : null;
  const textHasCreateCta = /ready to create|say\s+oke\s+maak|create it in meta|paused campaign\/ad sets|paused campaign|paused ad sets/i.test(rawReply);
  const normalizedCreationPlan = parsedCreation ? {
    ready: parsedCreation.ready === true || textHasCreateCta,
    summary: cleanModelText(parsedCreation.summary, 500) || (textHasCreateCta ? 'Create the discussed Meta campaign or ad set structure after explicit confirmation.' : ''),
    inclusions: Array.isArray(parsedCreation.inclusions) ? parsedCreation.inclusions.map((item: any) => cleanModelText(item, 160)).filter(Boolean).slice(0, 12) : [],
    exclusions: Array.isArray(parsedCreation.exclusions) ? parsedCreation.exclusions.map((item: any) => cleanModelText(item, 160)).filter(Boolean).slice(0, 12) : [],
    targeting_reference: cleanModelText(parsedCreation.targeting_reference, 240),
    create_scope: ['campaign', 'adsets', 'draft_only'].includes(String(parsedCreation.create_scope)) ? String(parsedCreation.create_scope) : 'campaign',
  } : textHasCreateCta ? {
    ready: true,
    summary: 'Create the discussed Meta campaign or ad set structure after explicit confirmation.',
    inclusions: [],
    exclusions: [],
    targeting_reference: '',
    create_scope: 'campaign',
  } : null;

  return Response.json({
    ok: true,
    model: process.env.AD_STRATEGIST_MODEL || process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
    context_loaded: {
      brand_profile: Boolean(brandRaw),
      content_config: Boolean(contentRaw),
      selected_items: requestContext.selected_catalog_items.length,
      selected_campaign: Boolean(requestContext.selected_campaign),
    },
    reply: rawReply,
    needs_clarification: parsed.needs_clarification === true && questions.length > 0,
    questions,
    personas,
    ad_ideas: Array.isArray(parsed.ad_ideas) ? parsed.ad_ideas.map((idea: any) => ({
      title: cleanModelText(idea.title, 120),
      angle: cleanModelText(idea.angle, 320),
      format: cleanModelText(idea.format, 80),
      first_frame: cleanModelText(idea.first_frame, 220),
      cta: cleanModelText(idea.cta, 100),
    })).filter((idea: any) => idea.title || idea.angle).slice(0, 6) : [],
    campaign_recommendation: parsed.campaign_recommendation && typeof parsed.campaign_recommendation === 'object' ? {
      best_next_step: cleanModelText(parsed.campaign_recommendation.best_next_step, 300),
      test_plan: cleanModelText(parsed.campaign_recommendation.test_plan, 500),
      avoid_for_now: cleanModelText(parsed.campaign_recommendation.avoid_for_now, 300),
      success_metric: cleanModelText(parsed.campaign_recommendation.success_metric, 220),
    } : null,
    creation_plan: normalizedCreationPlan,
  });
}
