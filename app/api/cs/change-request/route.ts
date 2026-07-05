import { NextRequest } from 'next/server';
import { getGmailTokenAndFetch, GmailError } from '@/lib/gmail';
import { initDb } from '@/lib/db';
import { createClient } from '@libsql/client/web';
import { isDemoTenant } from '@/lib/demo';
import { verifyJwt, COOKIE_NAME } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

const db = createClient({
  url: (process.env.TURSO_DATABASE_URL || 'file:local.db').trim(),
  authToken: process.env.TURSO_AUTH_TOKEN?.trim(),
});

export async function POST(request: NextRequest) {
  // Verify JWT
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const jwt = await verifyJwt(token);
  if (!jwt) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { tenant_id, section, changes } = body;

  if (!tenant_id || !section || !changes) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Verify tenant matches JWT
  if (jwt.email !== tenant_id && jwt.tenantId !== tenant_id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Demo tenant: fake submission
  if (isDemoTenant(tenant_id)) {
    return Response.json({ success: true, message: 'Change request submitted (demo)' });
  }

  try {
    await initDb();

    // Create change_requests table if needed
    await db.execute(`CREATE TABLE IF NOT EXISTS change_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL,
      section TEXT NOT NULL,
      changes TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Store the request
    await db.execute({
      sql: 'INSERT INTO change_requests (tenant_id, section, changes) VALUES (?, ?, ?)',
      args: [tenant_id, section, changes],
    });

    // Send email to info@ainomiq.com via client's connected Gmail
    try {
      const subject = `Change Request: ${section}`;
      const emailBody = [
        `Customer: ${tenant_id}`,
        `Section: ${section}`,
        ``,
        `Requested changes:`,
        changes,
        ``,
        `---`,
        `Sent from Ainomiq Dashboard`,
      ].join('\n');

      const raw = Buffer.from(
        [
          `To: info@ainomiq.com`,
          `Subject: ${subject}`,
          `Content-Type: text/plain; charset=utf-8`,
          `MIME-Version: 1.0`,
          ``,
          emailBody,
        ].join('\r\n')
      ).toString('base64url');

      await getGmailTokenAndFetch(tenant_id, '/messages/send', {
        method: 'POST',
        body: JSON.stringify({ raw }),
      });
    } catch (emailErr) {
      // Email send failed but request is stored - not critical
      console.error('[Change Request] Email send failed:', emailErr);
    }

    return Response.json({ success: true, message: 'Change request submitted' });
  } catch (err) {
    if (err instanceof GmailError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error('[Change Request]', err);
    return Response.json({ error: 'Failed to submit request' }, { status: 500 });
  }
}
