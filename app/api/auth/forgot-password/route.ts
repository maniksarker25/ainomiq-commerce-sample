import { NextRequest } from 'next/server';
import { createClient } from '@libsql/client/web';
import crypto from 'crypto';
import { validateEmail } from '@/lib/input-validation';

export const dynamic = 'force-dynamic';

const db = createClient({
  url: (process.env.TURSO_DATABASE_URL || 'file:local.db').trim(),
  authToken: process.env.TURSO_AUTH_TOKEN?.trim(),
});

// Rate limiting: max 3 reset requests per email per hour
const resetAttempts = new Map<string, { count: number; resetAt: number }>();

function checkResetRateLimit(email: string): boolean {
  const key = email.toLowerCase().trim();
  const now = Date.now();
  const entry = resetAttempts.get(key);

  if (entry && now < entry.resetAt) {
    if (entry.count >= 3) return false;
    entry.count++;
    return true;
  }

  resetAttempts.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 });
  return true;
}

async function sendResetCodeViaResend(toEmail: string, code: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[ForgotPassword] RESEND_API_KEY not configured');
    throw new Error('Email service not configured');
  }

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <h2 style="color: #111; margin-bottom: 8px;">Password reset</h2>
      <p style="color: #666; font-size: 15px; line-height: 1.5;">Enter this code on the reset page to set a new password:</p>
      <div style="background: #f5f5f5; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
        <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #111;">${code}</span>
      </div>
      <p style="color: #999; font-size: 13px;">This code expires in 15 minutes. If you didn't request this, ignore this email.</p>
    </div>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Ainomiq <no-reply@ainomiq.com>',
      to: [toEmail],
      subject: 'Your password reset code',
      html: htmlBody,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[ForgotPassword] Resend API failed:', res.status, text);
    throw new Error(`Email send failed: ${res.status}`);
  }

  const data = await res.json();
  console.log(`[ForgotPassword] Reset code sent to ${toEmail} via Resend (id: ${data.id})`);
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
    const { email } = body;

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!validateEmail(email)) {
      return Response.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const ip = getClientIp(request);

    // Rate limiting
    if (!checkResetRateLimit(normalizedEmail)) {
      await auditLog(normalizedEmail, 'password_reset_rate_limited', ip, false);
      return Response.json({ success: true });
    }

    // Check if user exists
    const result = await db.execute({
      sql: 'SELECT id, email FROM tenants WHERE email = ?',
      args: [normalizedEmail],
    });

    // Always show success (don't reveal if user exists)
    if (result.rows.length === 0) {
      return Response.json({ success: true });
    }

    // Generate 6-digit code
    const code = String(crypto.randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Ensure reset_tokens table exists
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS reset_tokens (
        token TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        used INTEGER DEFAULT 0,
        attempts INTEGER DEFAULT 0
      )`,
      args: [],
    });

    // Delete any existing codes for this email
    await db.execute({
      sql: 'DELETE FROM reset_tokens WHERE email = ?',
      args: [normalizedEmail],
    });

    // Store code
    await db.execute({
      sql: 'INSERT INTO reset_tokens (token, email, expires_at) VALUES (?, ?, ?)',
      args: [code, normalizedEmail, expiresAt],
    });

    // Send email via Resend
    await sendResetCodeViaResend(normalizedEmail, code);
    await auditLog(normalizedEmail, 'password_reset_requested', ip, true);

    return Response.json({ success: true });
  } catch (err) {
    console.error('[ForgotPassword]', err);
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
