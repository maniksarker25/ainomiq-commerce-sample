import crypto from 'crypto';

function decodeBase64Url(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, 'base64');
}

export function parseMetaSignedRequest(
  signedRequest: string,
  appSecret: string,
): Record<string, unknown> | null {
  const trimmed = signedRequest.trim();
  if (!trimmed || !appSecret) return null;

  const parts = trimmed.split('.');
  if (parts.length !== 2) return null;

  const [encodedSig, payload] = parts;
  let sig: Buffer;
  try {
    sig = decodeBase64Url(encodedSig);
  } catch {
    return null;
  }

  const expectedSig = crypto
    .createHmac('sha256', appSecret)
    .update(payload)
    .digest();

  if (sig.length !== expectedSig.length || !crypto.timingSafeEqual(sig, expectedSig)) {
    return null;
  }

  try {
    return JSON.parse(decodeBase64Url(payload).toString('utf8')) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}
