import { SignJWT } from 'jose';

const TTS_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'tts-fallback-secret');

const VOICE_MAP: Record<string, string> = {
  'nl-NL': 'nova',
  'en-GB': 'nova',
  'en-US': 'alloy',
  'de-DE': 'nova',
  'fr-FR': 'shimmer',
  'es-ES': 'shimmer',
};

export async function createTtsToken(text: string, lang: string): Promise<string> {
  const voice = VOICE_MAP[lang] || 'nova';
  return new SignJWT({ t: text, v: voice })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('5m')
    .sign(TTS_SECRET);
}

export function buildTtsPlayUrl(token: string): string {
  const baseUrl = process.env.APP_BASE_URL || 'https://app.ainomiq.com';
  return `${baseUrl}/api/cs/tts?token=${encodeURIComponent(token)}`;
}

export { TTS_SECRET };
