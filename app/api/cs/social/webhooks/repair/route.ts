import { NextRequest } from "next/server";
import { isDemoTenant } from "@/lib/demo";
import { requireAuth, handleAuthError } from "@/lib/auth-guard";
import { resolveFacebookPage, handleMetaApiError } from "@/lib/cs-social";
import {
  getPageWebhookSubscriptionStatus,
  subscribePageToAppWebhooks,
} from "@/lib/meta-webhooks";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { tenant_id?: string } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let tenantId: string;
  try {
    tenantId = await requireAuth(request, body.tenant_id);
  } catch (err) {
    return handleAuthError(err);
  }

  if (isDemoTenant(tenantId)) {
    return Response.json({
      ok: true,
      subscribed: true,
      message: "Demo account - webhooks are simulated as active.",
    });
  }

  const page = await resolveFacebookPage(tenantId);
  if (!page?.accessToken || !page.pageId) {
    return Response.json(
      {
        ok: false,
        error:
          "No Facebook Page found. Connect Facebook Messaging from Support Settings.",
      },
      { status: 400 },
    );
  }

  const sub = await subscribePageToAppWebhooks(page.pageId, page.accessToken);
  if (!sub.ok) {
    if (sub.rawError) {
      const revoked = await handleMetaApiError(tenantId, {
        error: sub.rawError,
      });
      if (revoked) {
        return Response.json(
          {
            ok: false,
            revoked: true,
            error:
              "Meta session expired or revoked. Please connect Meta again.",
          },
          { status: 400 },
        );
      }
    }
    return Response.json(
      {
        ok: false,
        error: sub.error || "Webhook subscription failed",
      },
      { status: 502 },
    );
  }

  const status = await getPageWebhookSubscriptionStatus(
    page.pageId,
    page.accessToken,
  );

  if (status.rawError) {
    const revoked = await handleMetaApiError(tenantId, {
      error: status.rawError,
    });
    if (revoked) {
      return Response.json(
        {
          ok: false,
          revoked: true,
          error: "Meta session expired or revoked. Please connect Meta again.",
        },
        { status: 400 },
      );
    }
  }

  return Response.json({
    ok: status.ok,
    subscribed: status.ok,
    appSubscribed: status.appSubscribed,
    subscribedFields: status.subscribedFields,
    missingFields: status.missingFields,
    pageId: page.pageId,
    pageName: page.pageName,
    error: status.ok ? undefined : status.error,
    message: status.ok
      ? "Page webhooks are active for messages and feed events."
      : "Subscription was sent to Meta but some fields are still missing. Try again or reconnect Facebook.",
  });
}
