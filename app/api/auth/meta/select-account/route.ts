import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { checkRateLimit, ValidationError } from '@/lib/validate-tenant';
import { addTenantModule, getIntegration, upsertIntegration } from '@/lib/db';
import { isDemoTenant } from '@/lib/demo';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

/**
 * POST: Save the selected ad account ID for this tenant's Meta integration.
 */
export async function POST(request: NextRequest) {
  let tenantId: string;
  let body: { tenant_id?: string; adAccountId?: string; adAccountIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    tenantId = await requireAuth(
      request,
      body.tenant_id?.trim() || request.nextUrl.searchParams.get('tenant_id') || undefined,
    );
    checkRateLimit(tenantId, 'meta/select-account');
  } catch (err) {
    try { return handleAuthError(err); } catch {}
    if (err instanceof ValidationError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  // Demo tenant: fake success
  if (isDemoTenant(tenantId)) {
    await upsertIntegration(tenantId, 'meta', 'demo-token', null, null, 'ads_read,ads_management,read_insights', body.adAccountId || 'act_demo123456', 'demo@demo-store.com');
    await addTenantModule(tenantId, 'ads');
    return Response.json({ success: true, adAccountIds: body.adAccountIds || [body.adAccountId || 'act_demo123456'] });
  }

  try {
    // Support both single ID (string) and multiple IDs (array)
    const adAccountIds: string[] = Array.isArray(body.adAccountIds)
      ? body.adAccountIds
      : body.adAccountId
        ? [body.adAccountId]
        : [];

    if (adAccountIds.length === 0 || !adAccountIds.every((id: string) => id.startsWith('act_'))) {
      return Response.json({ error: 'Invalid ad account ID(s)' }, { status: 400 });
    }

    const integration = await getIntegration(tenantId, 'meta');

    if (!integration?.access_token) {
      console.error(`[Meta Select Account] No Meta Ads integration found for tenant: ${tenantId}`);
      return Response.json({ error: 'Meta Ads not connected. Connect Meta Ads from Settings first.' }, { status: 401 });
    }

    const storedValue = adAccountIds.join(',');

    await upsertIntegration(
      tenantId,
      'meta',
      integration.access_token as string,
      integration.refresh_token as string | null,
      integration.token_expires_at ? new Date(integration.token_expires_at as string) : null,
      integration.scopes as string | null,
      storedValue,
      integration.provider_email as string | null,
    );

    console.log(`[Meta Select Account] Successfully updated integration for tenant: ${tenantId}, adAccountIds: ${storedValue}`);

    await addTenantModule(tenantId, 'ads');

    // Bust the Next.js router cache so settings and dashboard load fresh database state
    revalidatePath('/dashboard/settings');

    return Response.json({ success: true, adAccountIds });
  } catch (err) {
    console.error('[Meta Select Account] Error saving account selection:', err);
    return Response.json({ error: 'Failed to save ad account selection' }, { status: 500 });
  }
}
