import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

const COOKIE_NAME = "ainomiq_cs_pass";

/**
 * Constant-time string comparison to avoid leaking the password via timing.
 * Returns false when lengths differ (without an early-return timing signal
 * that depends on content).
 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  const expected = process.env.COMING_SOON_PASSWORD;

  // Fail closed: if no password is configured the gate is disabled, not open.
  if (!expected) {
    console.error("[coming-soon-auth] COMING_SOON_PASSWORD is not set — denying.");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const { password } = await req.json().catch(() => ({ password: "" }));
  if (typeof password !== "string" || !safeEqual(password, expected)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 90, // 90 days
    path: "/",
  });
  return res;
}
