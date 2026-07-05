/**
 * GET /api/klaviyo/lists
 *
 * Returns all Klaviyo lists for the authenticated tenant.
 * Used to let the tenant select which list triggers the Newsletter Welcome Flow.
 */
import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { getKlaviyoLists } from '@/lib/klaviyo-events';
import { KlaviyoError } from '@/lib/klaviyo';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  try {
    const lists = await getKlaviyoLists(tenantId);
    return Response.json({ lists });
  } catch (err) {
    if (err instanceof KlaviyoError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error('[Klaviyo Lists]', err);
    return Response.json({ error: 'Failed to fetch lists' }, { status: 500 });
  }
}
