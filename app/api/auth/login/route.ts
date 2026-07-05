import { NextRequest } from "next/server";
import { createClient } from '@libsql/client/web';
import crypto from "crypto";
import { createJwt, buildCookieHeader } from "@/lib/jwt";
import { validateEmail, validatePassword } from "@/lib/input-validation";
import { getLatestAcceptedInviteForEmail } from "@/lib/creative-os-invites";

export const dynamic = "force-dynamic";

const db = createClient({
  url: (process.env.TURSO_DATABASE_URL || "file:local.db").trim(),
  authToken: process.env.TURSO_AUTH_TOKEN?.trim(),
});

// In-memory rate limiting (per-process, resets on deploy - good enough for serverless)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(email: string): {
  allowed: boolean;
  retryAfter?: number;
} {
  const key = email.toLowerCase().trim();
  const now = Date.now();
  const entry = loginAttempts.get(key);

  if (entry && now < entry.resetAt) {
    if (entry.count >= 5) {
      return {
        allowed: false,
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      };
    }
    entry.count++;
    return { allowed: true };
  }

  // New window: 15 minutes
  loginAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
  return { allowed: true };
}

function resetRateLimit(email: string) {
  loginAttempts.delete(email.toLowerCase().trim());
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const verify = crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha512")
    .toString("hex");
  return hash === verify;
}

async function auditLog(
  email: string,
  action: string,
  ip: string,
  success: boolean,
) {
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
      sql: "INSERT INTO audit_log (email, action, ip, success) VALUES (?, ?, ?, ?)",
      args: [email, action, ip, success ? 1 : 0],
    });
  } catch (err) {
    console.error("[AuditLog]", err);
  }
}

async function getAcceptedCreativeOsInvite(email: string) {
  try {
    const invite = await getLatestAcceptedInviteForEmail(email);
    return invite ? { tenantId: invite.tenantId } : null;
  } catch {
    return null;
  }
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    const normalizedEmail = (email || "test@example.com").toLowerCase().trim();

    const session = {
      email: normalizedEmail,
      tenantId: "dummy-tenant-id",
      name: normalizedEmail.split('@')[0] || "Tester",
      organization: "Ainomiq Demo",
      modules: ['performance', 'ads', 'creative-os', 'stock', 'cs', 'content'],
      accessMode: "customer" as const,
    };

    // Create JWT
    const token = await createJwt({
      email: session.email,
      tenantId: session.tenantId,
      name: session.name,
      organization: session.organization,
      modules: session.modules,
      accessMode: session.accessMode,
    });

    const headers = new Headers();
    headers.set("Set-Cookie", buildCookieHeader(token));

    return Response.json({
      success: true,
      user: {
        id: session.tenantId,
        name: session.name,
        email: session.email,
        organization: session.organization,
        modules: session.modules,
        accessMode: session.accessMode,
      },
    }, {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error("[Login]", err);
    return Response.json(
      { error: "Login failed. Please try again." },
      { status: 500 },
    );
  }
}
