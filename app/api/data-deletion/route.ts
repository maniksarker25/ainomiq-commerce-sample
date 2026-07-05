import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';

import { getEnv } from '@/lib/oauth-config';
import {
  findTenantIdsByMetaFacebookUserId,
  purgeMetaUserData,
} from '@/lib/db';
import { parseMetaSignedRequest } from '@/lib/meta-signed-request';

export const dynamic = 'force-dynamic';

function dataDeletionStatusUrl(): string {
  const base = (
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://app.ainomiq.com'
  )
    .trim()
    .replace(/\/$/, '');
  return `${base}/data-deletion`;
}

export async function POST(request: NextRequest) {
  let signedRequest = '';

  try {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const body = await request.text();
      signedRequest = new URLSearchParams(body).get('signed_request') || '';
    } else if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      signedRequest = String(form.get('signed_request') || '');
    } else {
      const form = await request.formData().catch(() => null);
      signedRequest = form
        ? String(form.get('signed_request') || '')
        : '';
    }
  } catch (err) {
    console.error('[Data Deletion] Failed to parse request body:', err);
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!signedRequest) {
    return Response.json({ error: 'Missing signed_request' }, { status: 400 });
  }

  const payload = parseMetaSignedRequest(signedRequest, getEnv('META_APP_SECRET'));
  if (!payload) {
    return Response.json({ error: 'Invalid signed_request' }, { status: 403 });
  }

  const facebookUserId = String(payload.user_id || '').trim();
  const confirmationCode = randomUUID();

  if (facebookUserId) {
    const tenantIds = await findTenantIdsByMetaFacebookUserId(facebookUserId);
    for (const tenantId of tenantIds) {
      try {
        await purgeMetaUserData(tenantId);
        console.log(
          `[Data Deletion] Purged Meta data for tenant ${tenantId} (FB user ${facebookUserId})`,
        );
      } catch (err) {
        console.error(
          `[Data Deletion] Failed to purge tenant ${tenantId}:`,
          err,
        );
      }
    }
    if (tenantIds.length === 0) {
      console.log(
        `[Data Deletion] No tenant mapped to FB user ${facebookUserId}`,
      );
    }
  }

  return Response.json({
    url: dataDeletionStatusUrl(),
    confirmation_code: confirmationCode,
  });
}
