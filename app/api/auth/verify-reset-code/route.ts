import { NextRequest } from "next/server";
import { createClient } from '@libsql/client/web';

export const dynamic = "force-dynamic";

const db = createClient({
  url: (process.env.TURSO_DATABASE_URL || "file:local.db").trim(),
  authToken: process.env.TURSO_AUTH_TOKEN?.trim(),
});

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
    const { email, code } = body;

    if (!email || !code) {
      return Response.json(
        { error: "Email and code are required" },
        { status: 400 },
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedCode = code.trim();
    const ip = getClientIp(request);

    const result = await db.execute({
      sql: "SELECT token, expires_at, used, attempts FROM reset_tokens WHERE email = ?",
      args: [normalizedEmail],
    });

    if (result.rows.length === 0) {
      return Response.json(
        { error: "No reset code found. Please request a new one." },
        { status: 400 },
      );
    }

    const row = result.rows[0];
    const storedCode = row.token as string;
    const expiresAt = new Date(row.expires_at as string);
    const used = row.used as number;
    const attempts = (row.attempts as number) || 0;

    if (used === 1) {
      return Response.json(
        { error: "This code has already been used. Please request a new one." },
        { status: 400 },
      );
    }

    if (expiresAt < new Date()) {
      return Response.json(
        { error: "This code has expired. Please request a new one." },
        { status: 400 },
      );
    }

    // Max 3 attempts
    if (attempts >= 3) {
      await auditLog(normalizedEmail, "reset_code_max_attempts", ip, false);
      return Response.json(
        { error: "Too many incorrect attempts. Please request a new code." },
        { status: 429 },
      );
    }

    if (normalizedCode !== storedCode) {
      await db.execute({
        sql: "UPDATE reset_tokens SET attempts = attempts + 1 WHERE email = ?",
        args: [normalizedEmail],
      });
      await auditLog(normalizedEmail, "reset_code_wrong", ip, false);
      const remaining = 2 - attempts;
      return Response.json(
        {
          error: `Incorrect code. ${remaining > 0 ? `${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.` : "Please request a new code."}`,
        },
        { status: 400 },
      );
    }

    // Code correct - generate one-time reset token
    const crypto = await import("crypto");
    const resetToken = crypto.randomBytes(32).toString("hex");

    await db.execute({
      sql: "UPDATE reset_tokens SET token = ?, expires_at = ? WHERE email = ?",
      args: [
        resetToken,
        new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        normalizedEmail,
      ],
    });

    await auditLog(normalizedEmail, "reset_code_verified", ip, true);

    return Response.json({ success: true, resetToken });
  } catch (err) {
    console.error("[VerifyResetCode]", err);
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
