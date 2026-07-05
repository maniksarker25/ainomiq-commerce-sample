import { NextRequest } from 'next/server';
import { getKlaviyoTokenAndFetch, KlaviyoError } from '@/lib/klaviyo';
import { isDemoTenant } from '@/lib/demo';
import { getDemoEmailCampaigns } from '@/lib/demo-data';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  if (isDemoTenant(tenantId)) {
    return Response.json(getDemoEmailCampaigns());
  }

  try {
    const data = await getKlaviyoTokenAndFetch(
      tenantId,
      '/campaigns/?fields[campaign]=name,status,created_at,updated_at,send_time&sort=-created_at',
    );

    const campaigns = (data.data || []).map((campaign: {
      id: string;
      attributes: {
        name: string;
        status: string;
        created_at: string;
        updated_at: string;
        send_time: string | null;
      };
    }) => ({
      id: campaign.id,
      name: campaign.attributes.name,
      status: campaign.attributes.status,
      createdAt: campaign.attributes.created_at,
      updatedAt: campaign.attributes.updated_at,
      sendTime: campaign.attributes.send_time,
    }));

    return Response.json({ campaigns });
  } catch (err) {
    if (err instanceof KlaviyoError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error('[Email Campaigns]', err);
    return Response.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}
