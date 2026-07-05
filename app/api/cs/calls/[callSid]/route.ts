import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { getCsCallTranscript } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ callSid: string }> }
) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  const { callSid } = await params;
  if (!callSid) return Response.json({ error: 'Missing callSid' }, { status: 400 });

  try {
    const rows = await getCsCallTranscript(tenantId, callSid);
    const transcript = rows.map((r: any) => ({
      speaker: r.speaker,
      message: r.message,
      createdAt: r.created_at,
    }));

    return Response.json({ transcript });
  } catch (err) {
    console.error('[CS Call Transcript] Error:', err);
    return Response.json({ error: 'Failed to load transcript' }, { status: 500 });
  }
}
