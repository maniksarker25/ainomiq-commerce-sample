import { NextRequest } from 'next/server';

// Simple in-memory rate limiter
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 60; // max requests per window

export function validateTenantId(request: NextRequest): string {
  const tenantId = request.nextUrl.searchParams.get('tenant_id');
  if (!tenantId || tenantId.trim() === '') {
    throw new ValidationError('Missing tenant_id', 400);
  }
  return tenantId;
}

export function validateTenantIdFromBody(body: { tenant_id?: string }): string {
  const tenantId = body.tenant_id;
  if (!tenantId || tenantId.trim() === '') {
    throw new ValidationError('Missing tenant_id', 400);
  }
  return tenantId;
}

export function checkRateLimit(tenantId: string, endpoint: string): void {
  const key = `${tenantId}:${endpoint}`;
  const now = Date.now();
  const entry = rateLimits.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    throw new ValidationError('Rate limit exceeded. Try again later.', 429);
  }
}

export function sanitizeInput(input: string): string {
  // Strip HTML tags
  return input.replace(/<[^>]*>/g, '').trim();
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export class ValidationError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
