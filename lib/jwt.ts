import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const JWT_SECRET_RAW = process.env.JWT_SECRET || 'development_fallback_secret_key_that_is_at_least_32_bytes_long';
const secret = new TextEncoder().encode(JWT_SECRET_RAW);

const COOKIE_NAME = 'ainomiq_jwt';
const TOKEN_TTL_DAYS = 30;
const REFRESH_THRESHOLD_DAYS = 7;

export interface JwtSession {
  email: string;
  tenantId: string;
  name: string;
  organization: string;
  modules: string[];
  accessMode?: 'customer' | 'creative-editor';
}

interface AinomiqJwtPayload extends JWTPayload {
  email: string;
  tenantId: string;
  name: string;
  organization: string;
  modules: string[];
  accessMode?: 'customer' | 'creative-editor';
}

export async function createJwt(session: JwtSession): Promise<string> {
  return new SignJWT({
    email: session.email,
    tenantId: session.tenantId,
    name: session.name,
    organization: session.organization,
    modules: session.modules,
    accessMode: session.accessMode || 'customer',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_DAYS}d`)
    .sign(secret);
}

export async function verifyJwt(token: string): Promise<AinomiqJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as AinomiqJwtPayload;
  } catch {
    return null;
  }
}

export function shouldRefresh(payload: AinomiqJwtPayload): boolean {
  if (!payload.exp) return false;
  const expiresIn = payload.exp * 1000 - Date.now();
  return expiresIn < REFRESH_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
}

export function buildCookieHeader(token: string): string {
  const maxAge = TOKEN_TTL_DAYS * 24 * 60 * 60;
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  return `${COOKIE_NAME}=${token}; HttpOnly;${secure} SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function clearCookieHeader(): string {
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  return `${COOKIE_NAME}=; HttpOnly;${secure} SameSite=Lax; Path=/; Max-Age=0`;
}

export function getTokenFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return match ? match[1] : null;
}

export { COOKIE_NAME };
