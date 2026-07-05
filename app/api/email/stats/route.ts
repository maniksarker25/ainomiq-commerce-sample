import { NextRequest } from 'next/server';
import { getKlaviyoTokenAndFetch, KlaviyoError } from '@/lib/klaviyo';
import { isDemoTenant } from '@/lib/demo';
import { getDemoEmailStats } from '@/lib/demo-data';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  const daysParam = request.nextUrl.searchParams.get('days');
  const days = daysParam ? parseInt(daysParam, 10) : 7;

  if (isDemoTenant(tenantId)) {
    return Response.json(getDemoEmailStats(days));
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let profilesData, flowsData, metricsData;
    try {
      // Fetch profiles, flows, and metric ID in parallel
      [profilesData, flowsData, metricsData] = await Promise.all([
        getKlaviyoTokenAndFetch(tenantId, '/profiles/?page[size]=1', { signal: controller.signal }),
        getKlaviyoTokenAndFetch(tenantId, '/flows/?fields[flow]=status', { signal: controller.signal }),
        getKlaviyoTokenAndFetch(tenantId, '/metrics/?filter=equals(name,"Placed Order")&fields[metric]=name', { signal: controller.signal }).catch(() => ({ data: [] })),
      ]);
    } finally {
      clearTimeout(timeout);
    }

    // Subscriber count
    const totalSubscribers = profilesData.meta?.total || profilesData.data?.length || 0;

    // Active flows
    const activeFlows = (flowsData.data || []).filter(
      (f: { attributes: { status: string } }) => f.attributes.status === 'live'
    ).length;
    const totalFlows = (flowsData.data || []).length;

    // Revenue attribution via Metric Aggregates
    const emailRevenue = { total: 0, campaigns: 0, flows: 0, orders: 0 };
    const placedOrderMetric = metricsData.data?.[0];

    if (placedOrderMetric) {
      try {
        const now = new Date();
        const start = new Date(now.getTime() - days * 86400000);
        const aggregateData = await getKlaviyoTokenAndFetch(
          tenantId,
          '/metric-aggregates/',
          {
            method: 'POST',
            signal: controller.signal,
            body: JSON.stringify({
              data: {
                type: 'metric-aggregate',
                attributes: {
                  metric_id: placedOrderMetric.id,
                  measurements: ['sum_value', 'count'],
                  interval: 'day',
                  page_size: 500,
                  by: ['$attribution_type'],
                  filter: [
                    `greater-or-equal(datetime,${start.toISOString()})`,
                    `less-than(datetime,${now.toISOString()})`,
                  ],
                  timezone: 'UTC',
                },
              },
            }),
          }
        );

        for (const row of aggregateData.data?.attributes?.data || []) {
          const attrType = (row.dimensions?.[0] || '').toLowerCase();
          const revenue = (row.measurements?.sum_value || []).reduce((s: number, v: number) => s + v, 0);
          const count = (row.measurements?.count || []).reduce((s: number, v: number) => s + v, 0);

          if (attrType === 'campaign') {
            emailRevenue.campaigns += revenue;
          } else if (attrType === 'flow') {
            emailRevenue.flows += revenue;
          }
          emailRevenue.orders += count;
        }
        emailRevenue.total = emailRevenue.campaigns + emailRevenue.flows;
      } catch (revenueErr) {
        console.error('[Email Stats] Failed to fetch revenue metrics:', revenueErr);
      }
    }

    return Response.json({
      totalSubscribers,
      avgOpenRate: '0',
      avgClickRate: '0',
      activeFlows,
      totalFlows,
      emailRevenue,
    });
  } catch (err) {
    if (err instanceof KlaviyoError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof Error && err.name === 'AbortError') {
      return Response.json({ error: 'Request timeout' }, { status: 504 });
    }
    console.error('[Email Stats]', err);
    return Response.json({ error: 'Failed to fetch email stats' }, { status: 500 });
  }
}
