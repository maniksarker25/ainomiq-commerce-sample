/** Client-safe image billing estimates (no DB). */

import { getContentImageModel } from "./content-image-models";
import { CREDIT_COSTS } from "./credit-costs";

export function aiCreativeUnitsPerPipelineImage(modelId?: unknown): number {
  const model = getContentImageModel(modelId);
  return Math.max(1, Math.ceil(model.billableCredits));
}

export function estimatedAiCreativeNomiForImages(imageCount: number, modelId?: unknown) {
  const units = Math.max(0, Math.floor(imageCount)) * aiCreativeUnitsPerPipelineImage(modelId);
  return units * CREDIT_COSTS.ai_creative;
}
