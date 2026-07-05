import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { getTenantConfig } from "@/lib/db";
import {
  normalizeMessages,
  streamCallAgentModel,
  type ProductCatalogItem,
} from "@/lib/content-agent-core";
import { requireCredits, spendCredits } from "@/lib/credits";

import {
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
const BRAND_PROFILE_KEY = "brand_profile";

function clean(value: unknown, max = 4000) {
  return String(value || "")
    .trim()
    .slice(0, max);
}

function sseEncode(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
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

  const message = clean(body.message, 1600);
  if (!message)
    return badRequest("Message is required.", ErrorCode.MISSING_FIELD);

  const [configRaw, brandRaw] = await Promise.all([
    getTenantConfig(tenantId, CONTENT_CONFIG_KEY),
    getTenantConfig(tenantId, BRAND_PROFILE_KEY),
  ]);
  let config: Record<string, unknown> = {};
  let brandProfile: Record<string, unknown> = {};
  try {
    config = configRaw ? JSON.parse(configRaw) : {};
  } catch {
    /* empty */
  }
  try {
    brandProfile = brandRaw ? JSON.parse(brandRaw) : {};
  } catch {
    /* empty */
  }

  const history = normalizeMessages(body.history);
  const planningMode = body.planning_mode === true;
  const outputMode =
    clean(body.output_mode, 40) === "carousel" ? "carousel" : "auto";
  const selectedProduct =
    body.selected_product && typeof body.selected_product === "object"
      ? (body.selected_product as ProductCatalogItem)
      : null;
  const productCatalog = Array.isArray(body.product_catalog)
    ? (body.product_catalog.slice(0, 36) as ProductCatalogItem[])
    : Array.isArray(
          (brandProfile?.source_summary as Record<string, unknown>)
            ?.product_catalog,
        )
      ? (
          (brandProfile.source_summary as Record<string, unknown>)
            .product_catalog as ProductCatalogItem[]
        ).slice(0, 36)
      : [];

  try {
    await requireCredits(tenantId, "ai_copy", 2);
  } catch (err) {
    const creditResponse = handleContentCreditError(err);
    if (creditResponse) return creditResponse;
    return apiError(
      "Could not verify credits. Please try again.",
      ErrorCode.CREDIT_ERROR,
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseEncode(event, data)));
      };

      try {
        send("phase", { phase: "thinking" });

        let result = await streamCallAgentModel(
          message,
          history,
          config,
          brandProfile,
          planningMode,
          outputMode,
          selectedProduct,
          productCatalog,
          (reply) => send("delta", { reply }),
        );

        await spendCredits(tenantId, "ai_copy", 2, "Content agent chat");

        send("complete", {
          model:
            process.env.CONTENT_AGENT_MODEL ||
            process.env.OPENAI_TEXT_MODEL ||
            "gpt-4o-mini",
          context_loaded: {
            content_config: Boolean(configRaw),
            brand_profile: Boolean(brandRaw),
            site_scrape: Boolean(
              brandProfile?.source_summary || brandProfile?.analysis,
            ),
            training_notes: Array.isArray(config?.training_notes)
              ? config.training_notes.length
              : 0,
          },
          ...result,
        });
      } catch (err) {
        console.error("[content/agent-chat/stream]", err);
        const creditResponse = handleContentCreditError(err);
        if (creditResponse) {
          const payload = await creditResponse.json().catch(() => ({}));
          send("error", payload);
        } else {
          send("error", {
            error: err instanceof Error ? err.message : "Agent chat failed.",
            code: ErrorCode.INTERNAL_ERROR,
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});
