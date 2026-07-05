import { NextRequest } from 'next/server';
import { isDemoTenant } from '@/lib/demo';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { resolveFacebookPage, handleMetaApiError } from '@/lib/cs-social';
import {
  getPageWebhookSubscriptionStatus,
  isMetaAppSecretConfigured,
  isMetaWebhookVerifyTokenConfigured,
} from '@/lib/meta-webhooks';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  const verifyTokenConfigured = isMetaWebhookVerifyTokenConfigured();
  const appSecretConfigured = isMetaAppSecretConfigured();

  if (isDemoTenant(tenantId)) {
    return Response.json({
      connected: true,
      pageId: 'demo-page',
      pageName: 'Demo Page',
      subscribed: true,
      appSubscribed: true,
      subscribedFields: ['messages', 'feed'],
      missingFields: [],
      verifyTokenConfigured: true,
      appSecretConfigured: true,
    });
  }

  const page = await resolveFacebookPage(tenantId);
  if (!page?.accessToken || !page.pageId) {
    return Response.json({
      connected: false,
      subscribed: false,
      appSubscribed: false,
      subscribedFields: [],
      missingFields: [],
      verifyTokenConfigured,
      appSecretConfigured,
      error:
        'No Facebook Page found. Connect Facebook Messaging from Support Settings.',
    });
  }

  const status = await getPageWebhookSubscriptionStatus(
    page.pageId,
    page.accessToken,
  );

  if (status.rawError) {
    const revoked = await handleMetaApiError(tenantId, { error: status.rawError });
    if (revoked) {
      return Response.json({
        connected: false,
        subscribed: false,
        appSubscribed: false,
        subscribedFields: [],
        missingFields: [],
        verifyTokenConfigured,
        appSecretConfigured,
        error: 'Meta session expired or revoked. Please connect Meta again.',
        revoked: true,
      });
    }
  }

  return Response.json({
    connected: true,
    pageId: page.pageId,
    pageName: page.pageName,
    subscribed: status.ok,
    appSubscribed: status.appSubscribed,
    subscribedFields: status.subscribedFields,
    missingFields: status.missingFields,
    verifyTokenConfigured,
    appSecretConfigured,
    error: status.error,
  });
}
