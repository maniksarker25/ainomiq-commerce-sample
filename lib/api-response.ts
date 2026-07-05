/**
 * Standardized API response helpers for Content Studio routes.
 *
 * Every route should return JSON matching one of these shapes:
 *
 *   Success → { success: true, data: { ... } }
 *   Error   → { success: false, error: "Human-readable message", code: "ERROR_CODE" }
 *
 * The `code` field lets the frontend distinguish error categories without
 * parsing free-text strings.
 */

import { AuthError } from '@/lib/auth-guard';
import type { NextRequest } from 'next/server';

// ── Error codes ──────────────────────────────────────────────────────────

export const ErrorCode = {
  // Auth / tenant
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',

  // Validation
  INVALID_JSON: 'INVALID_JSON',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_FIELD: 'MISSING_FIELD',

  // External service failures
  OPENAI_ERROR: 'OPENAI_ERROR',
  GEMINI_ERROR: 'GEMINI_ERROR',
  SCRAPE_ERROR: 'SCRAPE_ERROR',

  // Credits / billing
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',
  CREDIT_ERROR: 'CREDIT_ERROR',

  // Content Studio specific
  CONFIG_NOT_FOUND: 'CONFIG_NOT_FOUND',
  GENERATION_FAILED: 'GENERATION_FAILED',
  TRAINING_FAILED: 'TRAINING_FAILED',
  STATE_TOO_LARGE: 'STATE_TOO_LARGE',
  PUBLISH_FAILED: 'PUBLISH_FAILED',
  INSTAGRAM_NOT_CONNECTED: 'INSTAGRAM_NOT_CONNECTED',
  INSTAGRAM_PUBLISH_DENIED: 'INSTAGRAM_PUBLISH_DENIED',

  // Catch-all
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

// ── Response builders ────────────────────────────────────────────────────

export function apiSuccess<T extends Record<string, unknown>>(data: T, status = 200) {
  return Response.json({ success: true, ...data }, { status });
}

export function apiError(
  error: string,
  code: ErrorCodeValue = ErrorCode.INTERNAL_ERROR,
  status = 500,
  extra?: Record<string, unknown>,
) {
  return Response.json({ success: false, error, code, ...extra }, { status });
}

// ── Convenience wrappers ─────────────────────────────────────────────────

export function badRequest(error: string, code: ErrorCodeValue = ErrorCode.VALIDATION_ERROR, extra?: Record<string, unknown>) {
  return apiError(error, code, 400, extra);
}

export function unauthorized(error = 'Authentication required') {
  return apiError(error, ErrorCode.AUTH_REQUIRED, 401);
}

export function notFound(error: string, code: ErrorCodeValue = ErrorCode.CONFIG_NOT_FOUND) {
  return apiError(error, code, 404);
}

export function creditError(error: string, extra?: Record<string, unknown>) {
  return apiError(error, ErrorCode.INSUFFICIENT_CREDITS, 402, extra);
}

// ── Auth / credits (Content Studio routes) ───────────────────────────────

/** Maps AuthError to `{ success: false, error, code }`. */
export function handleStructuredAuthError(err: unknown): Response {
  if (err instanceof AuthError) {
    const code =
      err.status === 401 || err.status === 403
        ? ErrorCode.AUTH_REQUIRED
        : ErrorCode.VALIDATION_ERROR;
    return apiError(err.message, code, err.status);
  }
  throw err;
}

/** Maps Nomi / AI Creative 402 errors to structured JSON. */
export function handleContentCreditError(err: unknown): Response | null {
  const maybe = err as Error & { status?: number; credits?: unknown };
  if (maybe?.status === 402) {
    return creditError(
      maybe.message || 'Not enough Nomi credits for this action.',
      maybe.credits ? { credits: maybe.credits } : undefined,
    );
  }
  return null;
}

/**
 * Wraps an async route handler in a try/catch that always returns structured
 * JSON, even for unexpected crashes. Use in route files:
 *
 * ```ts
 * export const POST = withErrorHandler(async (request) => { ... });
 * ```
 */
export function withErrorHandler(
  handler: (request: NextRequest) => Promise<Response>,
) {
  return async (request: NextRequest): Promise<Response> => {
    try {
      return await handler(request);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred';
      console.error('[api] Unhandled error:', err);
      return apiError(message, ErrorCode.INTERNAL_ERROR, 500);
    }
  };
}
