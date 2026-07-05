/**
 * Klaviyo Event Tracking
 *
 * Sends events and profile upserts to Klaviyo on behalf of a tenant.
 * Uses the tenant's OAuth access token (requires events:write + profiles:write + lists:write scopes).
 *
 * Supported events (matching the live Klaviyo flows):
 *  - Project Accepted         → triggers "Project Accepted Flow"
 *  - Project Completed        → triggers "Project Completed Flow"
 *  - Project Payment Confirmed → triggers "Project Payment Confirmed Flow"
 *  - Form Submitted           → triggers "Form Submitted - Price Shock Nurture"
 *
 * Newsletter Welcome is list-based: add profile to list → flow fires automatically.
 */

import { getKlaviyoToken, klaviyoFetch, KlaviyoError } from "./klaviyo";
import { hasRecentEvent, logKlaviyoEvent } from "./db";

const KLAVIYO_API = "https://a.klaviyo.com/api";
const KLAVIYO_REVISION = "2024-02-15";

export class DuplicateEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateEventError";
  }
}

const EVENT_COOLDOWN_HOURS: Record<string, number> = {
  "Project Accepted": 24,
  "Project Completed": 24,
  "Project Payment Confirmed": 1,
  "Form Submitted": 48,
  "Custom Solution Form Submitted": 48,
  "Custom Solution Payment Received": 1,
};

export interface KlaviyoProfile {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  properties?: Record<string, unknown>;
}

export interface KlaviyoEventPayload {
  eventName: string;
  profile: KlaviyoProfile;
  properties?: Record<string, unknown>;
  value?: number; // monetary value (e.g. project value in EUR)
  time?: string; // ISO 8601 - defaults to now
}

/**
 * Track a Klaviyo event for a tenant.
 * This fires the matching flow trigger in Klaviyo.
 */
export async function trackKlaviyoEvent(
  tenantId: string,
  payload: KlaviyoEventPayload,
): Promise<void> {
  // Duplicate guard: check cooldown before sending
  const cooldownHours = EVENT_COOLDOWN_HOURS[payload.eventName] ?? 24;
  if (cooldownHours > 0) {
    const isDuplicate = await hasRecentEvent(
      tenantId,
      payload.profile.email,
      payload.eventName,
      cooldownHours,
    );
    if (isDuplicate) {
      throw new DuplicateEventError(
        `Event already sent to this address within cooldown window`,
      );
    }
  }

  const token = await getKlaviyoToken(tenantId);

  const body = {
    data: {
      type: "event",
      attributes: {
        metric: {
          data: {
            type: "metric",
            attributes: { name: payload.eventName },
          },
        },
        profile: {
          data: {
            type: "profile",
            attributes: {
              email: payload.profile.email,
              ...(payload.profile.firstName && {
                first_name: payload.profile.firstName,
              }),
              ...(payload.profile.lastName && {
                last_name: payload.profile.lastName,
              }),
              ...(payload.profile.phone && {
                phone_number: payload.profile.phone,
              }),
              ...(payload.profile.properties && {
                properties: payload.profile.properties,
              }),
            },
          },
        },
        properties: payload.properties || {},
        ...(payload.value !== undefined && { value: payload.value }),
        time: payload.time || new Date().toISOString(),
      },
    },
  };

  await klaviyoFetch(token, "/events/", {
    method: "POST",
    body: JSON.stringify(body),
  });

  // Log successful event for duplicate guard
  await logKlaviyoEvent(
    tenantId,
    payload.profile.email,
    payload.eventName,
    payload.properties ? JSON.stringify(payload.properties) : undefined,
  );
}

/**
 * Upsert a Klaviyo profile and add them to a list.
 * Used for the Newsletter Welcome Flow (list-triggered).
 */
export async function addProfileToList(
  tenantId: string,
  listId: string,
  profile: KlaviyoProfile,
): Promise<void> {
  const token = await getKlaviyoToken(tenantId);

  // Step 1: Upsert the profile
  const profileBody = {
    data: {
      type: "profile",
      attributes: {
        email: profile.email,
        ...(profile.firstName && { first_name: profile.firstName }),
        ...(profile.lastName && { last_name: profile.lastName }),
        ...(profile.phone && { phone_number: profile.phone }),
        ...(profile.properties && { properties: profile.properties }),
      },
    },
  };

  const profileRes = await klaviyoFetch(token, "/profiles/", {
    method: "POST",
    body: JSON.stringify(profileBody),
  }).catch(async (err: KlaviyoError) => {
    // 409 = profile already exists - get their ID via email lookup
    if (err.status === 409) {
      const lookup = await klaviyoFetch(
        token,
        `/profiles/?filter=equals(email,"${encodeURIComponent(profile.email)}")`,
      );
      return lookup.data?.[0] ? { data: lookup.data[0] } : null;
    }
    throw err;
  });

  const profileId = profileRes?.data?.id;
  if (!profileId) throw new Error("Could not resolve Klaviyo profile ID");

  // Step 2: Add profile to list
  await klaviyoFetch(token, `/lists/${listId}/relationships/profiles/`, {
    method: "POST",
    body: JSON.stringify({
      data: [{ type: "profile", id: profileId }],
    }),
  });
}

/**
 * Fetch all lists for a tenant (to let them pick the newsletter list).
 */
export async function getKlaviyoLists(
  tenantId: string,
): Promise<Array<{ id: string; name: string }>> {
  const data = await klaviyoFetch(
    await getKlaviyoToken(tenantId),
    "/lists/?fields[list]=name",
  );
  return (data.data || []).map(
    (l: { id: string; attributes: { name: string } }) => ({
      id: l.id,
      name: l.attributes.name,
    }),
  );
}
