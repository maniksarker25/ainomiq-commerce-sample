/**
 * POST /api/klaviyo/track
 *
 * Fire a Klaviyo event for the authenticated tenant.
 * This is what triggers the Klaviyo flows.
 *
 * Body:
 * {
 *   eventName: "Project Accepted" | "Project Completed" | "Project Payment Confirmed" | "Form Submitted",
 *   profile: { email, firstName?, lastName?, phone?, properties? },
 *   properties?: { projectName?, projectValue?, ... },
 *   value?: number   (monetary, e.g. deal value in EUR)
 * }
 *
 * Flow mapping:
 *   "Project Accepted"          → Project Accepted Flow
 *   "Project Completed"         → Project Completed Flow
 *   "Project Payment Confirmed" → Project Payment Confirmed Flow
 *   "Form Submitted"            → Form Submitted - Price Shock Nurture
 */
import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { trackKlaviyoEvent, DuplicateEventError } from '@/lib/klaviyo-events';
import { KlaviyoError } from '@/lib/klaviyo';

export const dynamic = 'force-dynamic';

const ALLOWED_EVENTS = [
  'Project Accepted',
  'Project Completed',
  'Project Payment Confirmed',
  'Form Submitted',
  'Custom Solution Form Submitted',
  'Custom Solution Payment Received',
] as const;

type AllowedEvent = typeof ALLOWED_EVENTS[number];

export async function POST(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  let body: { tenant_id?: string;
    eventName: AllowedEvent;
    profile: {
      email: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      properties?: Record<string, unknown>;
    };
    properties?: Record<string, unknown>;
    value?: number;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { eventName, profile, properties, value } = body;

  if (!eventName || !ALLOWED_EVENTS.includes(eventName)) {
    return Response.json(
      { error: `Invalid eventName. Must be one of: ${ALLOWED_EVENTS.join(', ')}` },
      { status: 400 },
    );
  }

  if (!profile?.email) {
    return Response.json({ error: 'profile.email is required' }, { status: 400 });
  }

  try {
    await trackKlaviyoEvent(tenantId, {
      eventName,
      profile,
      properties,
      value,
    });
    return Response.json({ success: true, event: eventName });
  } catch (err) {
    if (err instanceof DuplicateEventError) {
      return Response.json(
        { error: 'duplicate', message: err.message },
        { status: 409 },
      );
    }
    if (err instanceof KlaviyoError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error('[Klaviyo Track]', err);
    return Response.json({ error: 'Failed to track event' }, { status: 500 });
  }
}
