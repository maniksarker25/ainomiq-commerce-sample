import { NextRequest } from 'next/server';
import { getKlaviyoTokenAndFetch, KlaviyoError } from '@/lib/klaviyo';
import { isDemoTenant } from '@/lib/demo';
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
    return Response.json({
      subscribers: 12847,
      activeFlows: 6,
      avgOpenRate: 42.3,
      avgClickRate: 3.8,
      recentCampaigns: [
        { name: 'Spring Collection Launch', status: 'sent', sentAt: '2026-03-01' },
        { name: 'Weekend Flash Sale - 20% Off', status: 'sent', sentAt: '2026-03-01' },
        { name: 'International Women\'s Day', status: 'scheduled', sentAt: '2026-03-08' },
      ],
    });
  }

  try {
    // Fetch profiles count and flows count in parallel with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    let profilesData, flowsData;
    try {
      [profilesData, flowsData] = await Promise.all([
        getKlaviyoTokenAndFetch(tenantId, '/profiles/?page[size]=1', { signal: controller.signal }),
        getKlaviyoTokenAndFetch(tenantId, '/flows/?fields[flow]=status', { signal: controller.signal }),
      ]);
    } finally {
      clearTimeout(timeout);
    }

    // Subscriber count from total profiles
    const subscribers = profilesData.meta?.total || profilesData.data?.length || 0;

    // Active flows count
    const activeFlows = (flowsData.data || []).filter(
      (f: { attributes: { status: string } }) => f.attributes.status === 'live'
    ).length;

    // Fetch recent campaigns (max 3)
    const campaignsData = await getKlaviyoTokenAndFetch(
      tenantId,
      '/campaigns/?fields[campaign]=name,status,send_at&filter=equals(status,"sent")&page[size]=3&sort=-created_at',
    );

    const recentCampaigns = (campaignsData.data || []).slice(0, 3).map((c: any) => ({
      name: c.attributes.name || 'Untitled',
      status: c.attributes.status,
      sentAt: c.attributes.send_at ? c.attributes.send_at.substring(0, 10) : null,
    }));

    // For now, placeholder rates. Could fetch metrics per campaign later.
    return Response.json({
      subscribers,
      activeFlows,
      avgOpenRate: 0,
      avgClickRate: 0,
      recentCampaigns,
    });
  } catch (err) {
    if (err instanceof KlaviyoError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof Error && err.name === 'AbortError') {
      return Response.json({ error: 'Request timeout' }, { status: 504 });
    }
    console.error('[Email Summary]', err);
    return Response.json({ error: 'Failed to fetch email summary' }, { status: 500 });
  }
}
