import { aiCreativeUnitsPerPipelineImage } from './content-image-billing';
import { CREDIT_COSTS, requireCredits, spendCredits } from './credits';

/**
 * Nomi charged per `ai_creative` unit (same constant as `/api/billing/credits` and Logic Ads).
 */
export const NOMI_PER_AI_CREATIVE_UNIT = CREDIT_COSTS.ai_creative;

export { aiCreativeUnitsPerPipelineImage, estimatedAiCreativeNomiForImages } from './content-image-billing';

/** Balance check only (no debit). Pair with `spendAiCreativeForContentStudio` after images succeed. */
export async function requireAiCreativeForContentStudio(tenantId: string, imageCount: number, modelId?: unknown) {
  const units = Math.max(0, Math.floor(imageCount)) * aiCreativeUnitsPerPipelineImage(modelId);
  if (units <= 0) return null;
  return requireCredits(tenantId, 'ai_creative', units);
}

export async function spendAiCreativeForContentStudio(
  tenantId: string,
  imageCount: number,
  label: string,
  meta?: Record<string, unknown>,
) {
  const units = Math.max(0, Math.floor(imageCount));
  if (units <= 0) return null;
  return spendCredits(tenantId, 'ai_creative', units, label, meta);
}
