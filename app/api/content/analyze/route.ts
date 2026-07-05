import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { getTenantConfig, setTenantConfig } from '@/lib/db';
import { apiSuccess, badRequest, apiError, ErrorCode, withErrorHandler, handleStructuredAuthError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';
const CONFIG_KEY = 'content_pipeline_config';
const BRAND_PROFILE_KEY = 'brand_profile';

type Intake = {
  brand_name?: string;
  website?: string;
  what_you_sell?: string;
  ideal_customer?: string;
  customer_problem?: string;
  main_offer?: string;
  proof_points?: string;
  competitors?: string;
  brand_tone?: string;
  content_goals?: string;
};

function clean(value: any, max = 800) {
  return String(value || '').trim().slice(0, max);
}

function splitIdeas(value: string, fallback: string[]) {
  const parts = value
    .split(/[\n,;.]+/)
    .map(part => part.trim())
    .filter(Boolean)
    .slice(0, 5);
  return parts.length ? parts : fallback;
}

function fallbackAnalysis(intake: Intake) {
  const brand = clean(intake.brand_name, 120) || 'Your brand';
  const offer = clean(intake.main_offer || intake.what_you_sell, 500) || 'the core offer';
  const customer = clean(intake.ideal_customer, 500) || 'your best-fit customers';
  const problem = clean(intake.customer_problem, 500) || 'the main customer problem';
  const tone = clean(intake.brand_tone, 500) || 'clear, useful, confident, and practical';
  const goals = clean(intake.content_goals, 500) || 'generate demand, educate customers, and create posts your team can publish';
  const proof = clean(intake.proof_points, 700);

  const pillars = [
    `Problem education - show how ${problem} costs time, money, or momentum`,
    `Offer clarity - explain how ${offer} helps ${customer}`,
    `Proof and trust - turn ${proof || 'results, examples, customer stories, and process proof'} into repeatable content`,
    `Action posts - convert interest into demos, messages, purchases, or setup steps`,
  ];

  const products = splitIdeas(clean(intake.what_you_sell, 700), [offer]);
  const missing = [
    !intake.website ? 'Website URL is missing' : '',
    !intake.proof_points ? 'Proof points are missing' : '',
    !intake.competitors ? 'Competitors or alternatives are missing' : '',
  ].filter(Boolean);

  return {
    summary: `${brand} sells ${offer} to ${customer}. The content system should focus on ${problem}, then turn that into clear posts, ads, and publishing-ready assets.`,
    positioning: `${brand} should sound ${tone}. The strongest angle is helping ${customer} move from ${problem} to a simpler outcome with ${offer}.`,
    target_audience: customer,
    product_focus: offer,
    brand_voice: tone,
    content_goals: goals,
    content_pillars: pillars,
    products,
    recommended_outputs: ['instagram_caption', 'ad_copy', 'email_snippet', 'content_calendar'],
    missing_inputs: missing,
    model: 'fallback',
    analyzed_at: new Date().toISOString(),
  };
}

async function aiAnalysis(intake: Intake) {
  if (!process.env.OPENAI_API_KEY) return fallbackAnalysis(intake);

  const prompt = `Analyze this company intake for a content automation app. Return only valid JSON with keys: summary, positioning, target_audience, product_focus, brand_voice, content_goals, content_pillars, products, recommended_outputs, missing_inputs. Use concise business language. No markdown.\n\nIntake:\n${JSON.stringify(intake, null, 2)}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.CONTENT_ANALYSIS_MODEL || 'gpt-4o-mini',
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are an ecommerce content strategist. Extract useful context and never invent hard business facts that are not in the intake.' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!res.ok) {
      console.error('[content/analyze] OpenAI returned', res.status);
      throw new Error(`OpenAI returned ${res.status}`);
    }
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    const fallback = fallbackAnalysis(intake);
    return {
      ...fallback,
      ...parsed,
      content_pillars: Array.isArray(parsed.content_pillars) ? parsed.content_pillars.slice(0, 6) : fallback.content_pillars,
      products: Array.isArray(parsed.products) ? parsed.products.slice(0, 8) : fallback.products,
      recommended_outputs: Array.isArray(parsed.recommended_outputs) ? parsed.recommended_outputs : fallback.recommended_outputs,
      missing_inputs: Array.isArray(parsed.missing_inputs) ? parsed.missing_inputs : fallback.missing_inputs,
      model: process.env.CONTENT_ANALYSIS_MODEL || 'gpt-4o-mini',
      analyzed_at: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[content/analyze] AI analysis failed, using fallback:', err);
    return fallbackAnalysis(intake);
  }
}

export const POST = withErrorHandler(async (request: NextRequest) => {
  let body: any;
  try { body = await request.json(); } catch { return badRequest('Invalid JSON body.', ErrorCode.INVALID_JSON); }

  let tenantId = '';
  try { tenantId = await requireAuth(request, body.tenant_id); } catch (err) { return handleStructuredAuthError(err); }

  const intake: Intake = {
    brand_name: clean(body.brand_name, 120),
    website: clean(body.website, 500),
    what_you_sell: clean(body.what_you_sell, 1000),
    ideal_customer: clean(body.ideal_customer, 1000),
    customer_problem: clean(body.customer_problem, 1000),
    main_offer: clean(body.main_offer, 1000),
    proof_points: clean(body.proof_points, 1000),
    competitors: clean(body.competitors, 1000),
    brand_tone: clean(body.brand_tone, 1000),
    content_goals: clean(body.content_goals, 1000),
  };

  const analysis = await aiAnalysis(intake);

  let existing: any = {};
  try {
    const existingRaw = await getTenantConfig(tenantId, CONFIG_KEY);
    existing = existingRaw ? JSON.parse(existingRaw) : {};
  } catch {}

  const nextConfig = {
    ...existing,
    brand_name: intake.brand_name || existing.brand_name || '',
    target_audience: analysis.target_audience,
    product_focus: analysis.product_focus,
    brand_voice: analysis.brand_voice,
    output_types: analysis.recommended_outputs,
    company_intake: intake,
    company_analysis: analysis,
    status: existing.status || 'draft',
    updated_at: new Date().toISOString(),
  };

  let existingBrand: any = {};
  try {
    const existingBrandRaw = await getTenantConfig(tenantId, BRAND_PROFILE_KEY);
    existingBrand = existingBrandRaw ? JSON.parse(existingBrandRaw) : {};
  } catch {}

  const brandProfile = {
    ...existingBrand,
    ...intake,
    analysis,
    status: intake.brand_name ? 'ready' : 'draft',
    updated_at: new Date().toISOString(),
  };

  await setTenantConfig(tenantId, CONFIG_KEY, JSON.stringify(nextConfig));
  await setTenantConfig(tenantId, BRAND_PROFILE_KEY, JSON.stringify(brandProfile));

  return apiSuccess({ intake, analysis, config: nextConfig, brand_profile: brandProfile });
});
