import { NextRequest } from 'next/server';
import { verifyJwt, COOKIE_NAME } from './jwt';

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Validates JWT and ensures the requested tenant_id matches the authenticated user.
 *
 * **Tenant isolation:** This function does not query the database. Callers must use the **returned**
 * `tenantId` for every downstream `tenant_id` filter (SQL, `getTenantConfig`, token stores, etc.).
 * Do not re-read `tenant_id` from the query string or JSON body after auth; that value is attacker
 * controlled until this check runs, and duplicating it risks drift from what was authorized.
 *
 * Resolution order for the tenant id to validate: `bodyTenantId` if provided, else `tenant_id` query param.
 */
export async function requireAuth(request: NextRequest, bodyTenantId?: string): Promise<string> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    throw new AuthError('Unauthorized', 401);
  }

  const jwt = await verifyJwt(token);
  if (!jwt) {
    throw new AuthError('Unauthorized', 401);
  }

  // Get tenant_id from query params (GET) or body (POST)
  const tenantId = bodyTenantId || request.nextUrl.searchParams.get('tenant_id');

  if (!tenantId) {
    throw new AuthError('Missing tenant_id', 400);
  }

  // Ensure user can only access their own data
  if (jwt.email !== tenantId && jwt.tenantId !== tenantId) {
    throw new AuthError('Forbidden', 403);
  }

  return tenantId;
}

/**
 * Helper to handle AuthError in route handlers
 */
export function handleAuthError(err: unknown) {
  if (err instanceof AuthError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  throw err;
}
