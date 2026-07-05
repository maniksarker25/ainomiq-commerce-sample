import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { getTenantConfig } from "@/lib/db";
import { getContentImageModel } from "@/lib/content-image-models";
import { requireAiCreativeForContentStudio, spendAiCreativeForContentStudio } from "@/lib/ai-creative-billing";
import { generateImageFromVisualPrompt } from "@/lib/content-agent-core";
import { persistContentStudioImageUrl } from "@/lib/r2-media";
import {
  apiSuccess,
  badRequest,
  apiError,
  ErrorCode,
  withErrorHandler,
  handleStructuredAuthError,
  handleContentCreditError,
} from "@/lib/api-response";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const CONTENT_CONFIG_KEY = "content_pipeline_config";

function clean(value: unknown, max = 4000) {
  return String(value || "")
    .trim()
    .slice(0, max);
}

export const POST = withErrorHandler(async (request: NextRequest) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.", ErrorCode.INVALID_JSON);
  }

  let tenantId = "";
  try {
    tenantId = await requireAuth(request, body.tenant_id as string);
  } catch (err) {
    return handleStructuredAuthError(err);
  }

  const visualPrompt = clean(body.visual_prompt, 2400);
  if (!visualPrompt) {
    return badRequest("visual_prompt is required.", ErrorCode.MISSING_FIELD);
  }

  const configRaw = await getTenantConfig(tenantId, CONTENT_CONFIG_KEY);
  let config: Record<string, unknown> = {};
  try {
    config = configRaw ? JSON.parse(configRaw) : {};
  } catch {
    config = {};
  }

  const imageModel = getContentImageModel(body.ai_image_model ?? config?.ai_image_model);

  try {
    await requireAiCreativeForContentStudio(tenantId, 1, imageModel.id);
  } catch (err) {
    const creditResponse = handleContentCreditError(err);
    if (creditResponse) return creditResponse;
    return apiError("Not enough AI Creative credits for image generation.", ErrorCode.INSUFFICIENT_CREDITS, 402);
  }

  const generated = await generateImageFromVisualPrompt(visualPrompt, imageModel.id);

  const persistedUrl = await persistContentStudioImageUrl(
    generated.image_url || null,
    `content-studio/${tenantId}/async-image`,
  );
  const finalUrl = persistedUrl || generated.image_url || null;

  try {
    if (finalUrl) {
      await spendAiCreativeForContentStudio(
        tenantId,
        1,
        "Generate 1 Content Studio visual",
        { model: imageModel.id },
      );
    }
  } catch (err) {
    const creditResponse = handleContentCreditError(err);
    if (creditResponse) return creditResponse;
    return apiError("Failed to deduct AI Creative credits after generation.", ErrorCode.CREDIT_ERROR);
  }

  return apiSuccess({
    image_url: finalUrl,
    image_error: generated.image_error || (finalUrl ? null : "Image generation failed."),
    model: imageModel.id,
  });
});
