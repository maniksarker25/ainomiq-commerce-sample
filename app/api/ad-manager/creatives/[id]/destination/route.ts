import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { upsertDestinationUrl } from '@/lib/ad-manager/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let body: any;
  let tenantId: string;
  try {
    body = await request.json();
    tenantId = await requireAuth(request, body.tenant_id);
  } catch (err) {
    return handleAuthError(err);
  }

  try {
    const { id } = await params;
    const destination = await upsertDestinationUrl(tenantId, {
      creativeId: id,
      baseUrl: body.base_url || '',
      utmSource: body.utm_source,
      utmMedium: body.utm_medium,
      utmCampaign: body.utm_campaign,
      utmContent: body.utm_content,
      utmTerm: body.utm_term,
    });
    return Response.json({ destination });
  } catch (err) {
    console.error('[Ad Manager Destination]', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Failed to save destination URL' }, { status: 400 });
  }
}
