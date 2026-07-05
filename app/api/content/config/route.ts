import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import { addTenantModule, getTenantConfig, setTenantConfig } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { getContentImageModel } from '@/lib/content-image-models';
import {
  contentPipelineConfigSchema,
  DEFAULT_CONTENT_PIPELINE_BRAND_VOICE,
  sanitizeContentPipelineOutputTypes,
} from '@/lib/content-pipeline-config-schema';
import { apiSuccess, badRequest, ErrorCode, withErrorHandler, handleStructuredAuthError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';
const CONFIG_KEY = 'content_pipeline_config';
function cleanConfig(input: any, existing?: any) {
  const outputTypesSource =
    Array.isArray(input.output_types) && input.output_types.length > 0
      ? input.output_types
      : existing?.output_types;
  const output_types = sanitizeContentPipelineOutputTypes(outputTypesSource);
  const selectedImageModel = getContentImageModel(input.ai_image_model || existing?.ai_image_model);
  const brandFromInput = String(input.brand_voice ?? '').trim().slice(0, 2000);
  const brandFromExisting = String(existing?.brand_voice ?? '').trim().slice(0, 2000);
  const brand_voice =
    brandFromInput || brandFromExisting || DEFAULT_CONTENT_PIPELINE_BRAND_VOICE;
  const trainingSource = Array.isArray(input.training_notes)
    ? input.training_notes
    : existing?.training_notes;
  const training_notes = Array.isArray(trainingSource)
    ? trainingSource.slice(-30).filter((n: unknown) => n !== null && typeof n === 'object')
    : [];
  const modeCandidate = String(input.content_generation_mode || existing?.content_generation_mode || 'source_material').trim();
  const content_generation_mode = modeCandidate === 'ai_images' ? 'ai_images' : 'source_material';
  return {
    brand_name: String(input.brand_name || '').trim().slice(0, 120),
    content_source: String(input.content_source || '').trim().slice(0, 1000),
    content_generation_mode,
    ai_image_model: selectedImageModel.id,
    ai_image_provider: selectedImageModel.provider,
    ai_image_provider_model: selectedImageModel.providerModel,
    ai_image_base_credits_per_image: selectedImageModel.baseCredits,
    ai_image_margin_multiplier: selectedImageModel.marginMultiplier,
    ai_image_credits_per_image: selectedImageModel.billableCredits,
    output_types,
    brand_voice,
    target_audience: String(input.target_audience || '').trim().slice(0, 500),
    product_focus: String(input.product_focus || '').trim().slice(0, 500),
    agent_webhook_url: String(input.agent_webhook_url || '').trim().slice(0, 1000),
    company_intake: input.company_intake && typeof input.company_intake === 'object' ? input.company_intake : existing?.company_intake || null,
    company_analysis: input.company_analysis && typeof input.company_analysis === 'object' ? input.company_analysis : existing?.company_analysis || null,
    training_notes,
    publish_platforms: (() => {
      if (!Array.isArray(input.publish_platforms)) return ['instagram'];
      const p = input.publish_platforms
        .map(String)
        .filter((platform: string) => ['instagram', 'facebook'].includes(platform))
        .slice(0, 4);
      return p.length > 0 ? p : ['instagram'];
    })(),
    publishing_enabled: input.publishing_enabled !== false,
    publish_timezone: String(
      input.publish_timezone || existing?.publish_timezone || 'Europe/Amsterdam',
    )
      .trim()
      .slice(0, 80),
    posting_addon_mode: String(input.posting_addon_mode || 'free_beta').trim().slice(0, 80),
    agent_token: existing?.agent_token || `acp_${randomUUID().replace(/-/g, '')}`,
    status: 'active',
    updated_at: new Date().toISOString(),
  };
}

export const GET = withErrorHandler(async (request: NextRequest) => {
  let tenantId: string;
  try { tenantId = await requireAuth(request); } catch (err) { return handleStructuredAuthError(err); }

  const raw = await getTenantConfig(tenantId, CONFIG_KEY);
  if (!raw) return apiSuccess({ config: null });

  try {
    return apiSuccess({ config: JSON.parse(raw) });
  } catch {
    return apiSuccess({ config: null });
  }
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  let body: any;
  try { body = await request.json(); } catch { return badRequest('Invalid JSON body. Please send valid JSON.', ErrorCode.INVALID_JSON); }

  let tenantId: string;
  try { tenantId = await requireAuth(request, body.tenant_id); } catch (err) { return handleStructuredAuthError(err); }

  const existingRaw = await getTenantConfig(tenantId, CONFIG_KEY);
  let existing: any = null;
  try { existing = existingRaw ? JSON.parse(existingRaw) : null; } catch {}

  const config = cleanConfig(body, existing);
  const parsed = contentPipelineConfigSchema.safeParse(config);
  if (!parsed.success) {
    return badRequest(
      'Invalid configuration. Check the highlighted fields and try again.',
      ErrorCode.VALIDATION_ERROR,
      { details: parsed.error.flatten().fieldErrors },
    );
  }

  await setTenantConfig(tenantId, CONFIG_KEY, JSON.stringify(parsed.data));
  await addTenantModule(tenantId, 'content');
  return apiSuccess({ config: parsed.data });
});
