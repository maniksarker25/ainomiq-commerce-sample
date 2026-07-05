import { NextRequest } from 'next/server';
import { getKlaviyoTokenAndFetch, KlaviyoError } from '@/lib/klaviyo';
import { isDemoTenant } from '@/lib/demo';
import { getDemoEmailFlows } from '@/lib/demo-data';
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
    return Response.json(getDemoEmailFlows());
  }

  try {
    const data = await getKlaviyoTokenAndFetch(
      tenantId,
      '/flows/?fields[flow]=name,status,created,updated,trigger_type',
    );

    const flows = (data.data || []).map((flow: {
      id: string;
      attributes: {
        name: string;
        status: string;
        created: string;
        updated: string;
        trigger_type: string;
      };
    }) => ({
      id: flow.id,
      name: flow.attributes.name,
      status: flow.attributes.status,
      triggerType: flow.attributes.trigger_type,
      created: flow.attributes.created,
      updated: flow.attributes.updated,
    }));

    return Response.json({ flows });
  } catch (err) {
    if (err instanceof KlaviyoError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error('[Email Flows]', err);
    return Response.json({ error: 'Failed to fetch flows' }, { status: 500 });
  }
}
