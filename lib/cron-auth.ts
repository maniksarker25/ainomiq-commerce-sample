import type { NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Authorise a cron invocation.
 *
 * Cron jobs must present `Authorization: Bearer <CRON_SECRET>`. Configure the
 * same secret in Vercel Project Settings; Vercel injects it on scheduled
 * invocations. We deliberately do NOT trust the `x-vercel-cron` header on its
 * own — any external caller can set it when hitting the public URL, so it is
 * not an authenticator.
 *
 * Fails closed: if CRON_SECRET is not configured, all cron requests are denied
 * (previously this returned true, leaving the endpoints open).
 */
export function verifyCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[cron-auth] CRON_SECRET is not set — denying cron request.');
    return false;
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;

  return safeEqual(authHeader, `Bearer ${cronSecret}`);
}
