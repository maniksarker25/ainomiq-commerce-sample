import { z } from 'zod';
import { CONTENT_IMAGE_MODELS } from './content-image-models';

/** How text vs image assets are sourced for generation (Content Studio “mode”). */
export const contentGenerationModeSchema = z.enum(['source_material', 'ai_images']);
export type ContentGenerationMode = z.infer<typeof contentGenerationModeSchema>;

/** Output slots the pipeline may generate (aligned with dashboard + generator). */
export const CONTENT_PIPELINE_OUTPUT_TYPES = [
  'instagram_caption',
  'ad_copy',
  'email_snippet',
  'content_calendar',
] as const;

export const contentPipelineOutputTypeSchema = z.enum(CONTENT_PIPELINE_OUTPUT_TYPES);
export type ContentPipelineOutputType = z.infer<typeof contentPipelineOutputTypeSchema>;

const aiImageModelIds = CONTENT_IMAGE_MODELS.map((m) => m.id) as [string, ...string[]];

/** Must match a configured Content Studio image model id. */
export const contentPipelineAiImageModelIdSchema = z.enum(aiImageModelIds);
export type ContentPipelineAiImageModelId = z.infer<typeof contentPipelineAiImageModelIdSchema>;

export const contentPipelinePublishPlatformSchema = z.enum(['instagram', 'facebook']);

/** Default voice line when none is provided (matches Meta callback / Content Studio defaults). */
export const DEFAULT_CONTENT_PIPELINE_BRAND_VOICE =
  'Clear, practical, confident, no corporate fluff.';

const outputTypeSet = new Set<string>(CONTENT_PIPELINE_OUTPUT_TYPES);

/** Keep only known output type ids, preserve order, dedupe. */
export function sanitizeContentPipelineOutputTypes(value: unknown): ContentPipelineOutputType[] {
  const raw = Array.isArray(value) && value.length > 0 ? value.map(String) : [...CONTENT_PIPELINE_OUTPUT_TYPES.slice(0, 2)];
  const filtered = raw.filter((id): id is ContentPipelineOutputType => outputTypeSet.has(id));
  const deduped: ContentPipelineOutputType[] = [];
  const seen = new Set<string>();
  for (const id of filtered) {
    if (seen.has(id)) continue;
    seen.add(id);
    deduped.push(id);
  }
  return deduped.length > 0 ? deduped.slice(0, 8) : ['instagram_caption', 'ad_copy'];
}

/**
 * Stored `tenant_config.content_pipeline_config` JSON.
 * - `output_types`: only known pipeline output keys, 1–8 unique entries.
 * - `brand_voice`: non-empty after trim, max length aligned with `/api/content/config` cleaning.
 * - `content_generation_mode`: `source_material` | `ai_images`.
 * - `ai_image_model`: must be one of the ids from `CONTENT_IMAGE_MODELS`.
 *
 * Unknown keys are preserved via `.passthrough()` for forward-compatible reads.
 */
export const contentPipelineConfigSchema = z
  .object({
    brand_name: z.string().max(120).optional(),
    content_source: z.string().max(1000).optional(),
    content_generation_mode: contentGenerationModeSchema,
    ai_image_model: contentPipelineAiImageModelIdSchema,
    ai_image_provider: z.enum(['openai', 'google']).optional(),
    ai_image_provider_model: z.string().max(120).optional(),
    ai_image_base_credits_per_image: z.number().nonnegative().optional(),
    ai_image_margin_multiplier: z.number().positive().optional(),
    ai_image_credits_per_image: z.number().nonnegative().optional(),
    output_types: z
      .array(contentPipelineOutputTypeSchema)
      .min(1, 'Select at least one output type')
      .max(8)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: 'output_types must not contain duplicates',
      }),
    brand_voice: z
      .string()
      .max(2000)
      .transform((s) => s.trim())
      .refine((s) => s.length > 0, { message: 'brand_voice cannot be empty' }),
    target_audience: z.string().max(500).optional(),
    product_focus: z.string().max(500).optional(),
    agent_webhook_url: z.string().max(1000).optional(),
    company_intake: z.unknown().optional().nullable(),
    company_analysis: z.unknown().optional().nullable(),
    // Stored notes may be legacy shapes; do not require strict { note, created_at }.
    training_notes: z.array(z.unknown()).max(500).optional(),
    publish_platforms: z.array(contentPipelinePublishPlatformSchema).max(4).optional(),
    publishing_enabled: z.boolean().optional(),
    publish_timezone: z.string().max(80).optional(),
    posting_addon_mode: z.string().max(80).optional(),
    agent_token: z.string().max(200).optional(),
    status: z.enum(['active', 'draft', 'paused']).optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export type ContentPipelineConfig = z.infer<typeof contentPipelineConfigSchema>;

export function parseContentPipelineConfig(raw: unknown) {
  return contentPipelineConfigSchema.safeParse(raw);
}
