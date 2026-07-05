import { NextRequest } from 'next/server';
import { getTenantConfig } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { apiSuccess, withErrorHandler, handleStructuredAuthError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandler(async (request: NextRequest) => {
  let tenantId: string;
  try { tenantId = await requireAuth(request); } catch (err) { return handleStructuredAuthError(err); }

  const raw = await getTenantConfig(tenantId, 'content_pipeline_config');
  let config: any = null;
  try { config = raw ? JSON.parse(raw) : null; } catch {}

  return apiSuccess({
    active: Boolean(config?.status === 'active'),
    sourceConfigured: Boolean(config?.content_source || config?.content_generation_mode === 'ai_images'),
    contentGenerationMode: config?.content_generation_mode || 'source_material',
    imageGenerationModel: config?.ai_image_model || null,
    imageGenerationProvider: config?.ai_image_provider || null,
    imageProviderModel: config?.ai_image_provider_model || null,
    imageMarginMultiplier: config?.ai_image_margin_multiplier || null,
    imageCreditsPerImage: config?.ai_image_credits_per_image || null,
    outputTypes: config?.output_types || [],
    updatedAt: config?.updated_at || null,
  });
});
