import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { getCsCalls } from '@/lib/db';

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

  try {
    const rows = await getCsCalls(tenantId, days);
    const calls = rows.map((r: any) => ({
      callSid: r.call_sid,
      from: r.from_number || '',
      to: r.to_number || '',
      direction: r.direction || '',
      status: r.call_status || '',
      durationSec: Number(r.duration_sec || 0),
      recordingUrl: r.recording_url || '',
      createdAt: r.created_at,
    }));

    return Response.json({ calls });
  } catch (err) {
    console.error('[CS Calls] Error:', err);
    return Response.json({ error: 'Failed to load calls' }, { status: 500 });
  }
}
