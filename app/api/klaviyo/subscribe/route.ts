/**
 * POST /api/klaviyo/subscribe
 *
 * Add a contact to a Klaviyo list → triggers Newsletter Welcome Flow.
 *
 * Body:
 * {
 *   listId: string,   // Klaviyo list ID (get from /api/klaviyo/lists)
 *   profile: { email, firstName?, lastName?, phone? }
 * }
 */
import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { addProfileToList } from '@/lib/klaviyo-events';
import { KlaviyoError } from '@/lib/klaviyo';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  let body: {
    listId: string;
    profile: { email: string; firstName?: string; lastName?: string; phone?: string };
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { listId, profile } = body;

  if (!listId) return Response.json({ error: 'listId is required' }, { status: 400 });
  if (!profile?.email) return Response.json({ error: 'profile.email is required' }, { status: 400 });

  try {
    await addProfileToList(tenantId, listId, profile);
    return Response.json({ success: true, addedTo: listId });
  } catch (err) {
    if (err instanceof KlaviyoError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error('[Klaviyo Subscribe]', err);
    return Response.json({ error: 'Failed to subscribe profile' }, { status: 500 });
  }
}
