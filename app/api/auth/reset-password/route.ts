import { NextRequest } from 'next/server';
import { createClient } from '@libsql/client/web';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const db = createClient({
  url: (process.env.TURSO_DATABASE_URL || 'file:local.db').trim(),
  authToken: process.env.TURSO_AUTH_TOKEN?.trim(),
});

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function auditLog(email: string, action: string, ip: string, success: boolean) {
  try {
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        action TEXT NOT NULL,
        ip TEXT,
        success INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      args: [],
    });
    await db.execute({
      sql: 'INSERT INTO audit_log (email, action, ip, success) VALUES (?, ?, ?, ?)',
      args: [email, action, ip, success ? 1 : 0],
    });
  } catch (err) {
    console.error('[AuditLog]', err);
  }
}

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') || 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return Response.json({ error: 'Token and password are required' }, { status: 400 });
    }

    if (password.length < 6) {
      return Response.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const ip = getClientIp(request);

    const result = await db.execute({
      sql: 'SELECT email, expires_at, used FROM reset_tokens WHERE token = ?',
      args: [token],
    });

    if (result.rows.length === 0) {
      return Response.json({ error: 'Invalid or expired reset link' }, { status: 400 });
    }

    const row = result.rows[0];
    const expiresAt = new Date(row.expires_at as string);
    const used = row.used as number;
    const email = row.email as string;

    if (used === 1) {
      return Response.json({ error: 'This reset link has already been used' }, { status: 400 });
    }

    if (expiresAt < new Date()) {
      return Response.json({ error: 'This reset link has expired' }, { status: 400 });
    }

    const passwordHash = hashPassword(password);
    await db.execute({
      sql: 'UPDATE tenants SET password_hash = ? WHERE email = ?',
      args: [passwordHash, email],
    });

    await db.execute({
      sql: 'UPDATE reset_tokens SET used = 1 WHERE token = ?',
      args: [token],
    });

    await auditLog(email, 'password_changed', ip, true);

    return Response.json({ success: true });
  } catch (err) {
    console.error('[ResetPassword]', err);
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
