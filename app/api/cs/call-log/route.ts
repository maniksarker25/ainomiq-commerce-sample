import { NextRequest } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth-guard";
import { getCsCallTranscript, initDb } from "@/lib/db";
import { createClient } from '@libsql/client/web';

export const dynamic = "force-dynamic";

/**
 * GET /api/cs/call-log?tenant_id=...&call_sid=...
 * Returns the full transcript/event log for a specific call.
 * If no call_sid is provided, returns recent calls.
 */
export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  const callSid = request.nextUrl.searchParams.get("call_sid");

  if (callSid) {
    const events = await getCsCallTranscript(tenantId, callSid);
    return Response.json({ callSid, events: events || [] });
  }

  // No call_sid - return recent call SIDs
  await initDb();
  const db = createClient({
    url: (process.env.TURSO_DATABASE_URL || "file:local.db").trim(),
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const result = await db.execute({
    sql: `SELECT DISTINCT call_sid, MIN(created_at) as started_at, MAX(created_at) as last_event 
          FROM cs_call_events 
          WHERE tenant_id = ? 
          GROUP BY call_sid 
          ORDER BY started_at DESC 
          LIMIT 20`,
    args: [tenantId],
  });

  return Response.json({
    calls: result.rows.map((r: any) => ({
      callSid: r.call_sid,
      startedAt: r.started_at,
      lastEvent: r.last_event,
    })),
  });
}
