import { NextRequest } from 'next/server';
import { isDemoTenant } from '@/lib/demo';
import { getDemoCsSendAs } from '@/lib/demo-data';
import { getGmailTokenAndFetch, GmailError } from '@/lib/gmail';
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
    return Response.json(getDemoCsSendAs());
  }

  try {
    const res = await getGmailTokenAndFetch(tenantId, '/settings/sendAs');
    const sendAs = (res.sendAs || []).map((s: any) => ({
      email: s.sendAsEmail,
      name: s.displayName || '',
      isDefault: s.isDefault || false,
      isPrimary: s.isPrimary || false,
    }));

    return Response.json({ sendAs });
  } catch (err) {
    if (err instanceof GmailError && err.status === 401) {
      return Response.json({
        error: 'Google token expired. Please reconnect your Google account in Settings.',
      });
    }
    console.error('[CS sendAs] Error:', err);
    return Response.json({ sendAs: [] });
  }
}
