import { NextRequest } from 'next/server';
import { initDb } from '@/lib/db';
import { createClient } from '@libsql/client/web';
import { validateTenantId, checkRateLimit, ValidationError } from '@/lib/validate-tenant';
import { verifyJwt, COOKIE_NAME } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

const db = createClient({
  url: (process.env.TURSO_DATABASE_URL || 'file:local.db').trim(),
  authToken: process.env.TURSO_AUTH_TOKEN?.trim(),
});

export async function GET(request: NextRequest) {
  // Verify JWT - user can only export their own data
  const jwtToken = request.cookies.get(COOKIE_NAME)?.value;
  if (!jwtToken) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const jwt = await verifyJwt(jwtToken);
  if (!jwt) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let tenantId: string;
  try {
    tenantId = validateTenantId(request);
    checkRateLimit(tenantId, 'account/export');
  } catch (err) {
    if (err instanceof ValidationError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  // Prevent accessing someone else's data
  if (jwt.email !== tenantId && jwt.tenantId !== tenantId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await initDb();

    // Fetch all data for this tenant
    const [tenantData, integrationsData, configData, changeRequestsData] = await Promise.all([
      db.execute({ sql: 'SELECT id, name, email, created_at FROM tenants WHERE email = ?', args: [tenantId] }),
      db.execute({ sql: 'SELECT provider, provider_email, status, created_at, updated_at FROM integrations WHERE tenant_id = ?', args: [tenantId] }),
      db.execute({ sql: 'SELECT config_key, config_value, updated_at FROM tenant_config WHERE tenant_id = ?', args: [tenantId] }),
      db.execute({ sql: 'SELECT section, changes, status, created_at FROM change_requests WHERE tenant_id = ?', args: [tenantId] }).catch(() => ({ rows: [] })),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      tenant: tenantData.rows[0] || null,
      integrations: integrationsData.rows,
      configuration: configData.rows,
      change_requests: changeRequestsData.rows,
    };

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="ainomiq-data-export-${Date.now()}.json"`,
      },
    });
  } catch (err) {
    console.error('[Account Export]', err);
    return Response.json({ error: 'Failed to export data' }, { status: 500 });
  }
}
