import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { TTS_SECRET } from '@/lib/cs-tts';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cs/tts?token=JWT
 * Decodes the JWT, calls OpenAI TTS, returns audio/mpeg.
 * Twilio's <Play> will fetch this URL to play the audio.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return new Response('Missing token', { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response('TTS not configured', { status: 503 });
  }

  // Verify and decode the token
  let text: string;
  let voice: string;
  try {
    const { payload } = await jwtVerify(token, TTS_SECRET);
    text = payload.t as string;
    voice = (payload.v as string) || 'nova';
    if (!text) throw new Error('Empty text');
  } catch {
    return new Response('Invalid or expired token', { status: 403 });
  }

  // Call OpenAI TTS API
  try {
    const ttsRes = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1-hd',
        input: text,
        voice,
        response_format: 'mp3',
        speed: 1.0,
      }),
    });

    if (!ttsRes.ok) {
      console.error('[TTS] OpenAI error:', ttsRes.status, await ttsRes.text().catch(() => ''));
      return new Response('TTS generation failed', { status: 502 });
    }

    // Stream the audio back to Twilio
    const audioBuffer = await ttsRes.arrayBuffer();

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
        'Content-Length': String(audioBuffer.byteLength),
      },
    });
  } catch (err) {
    console.error('[TTS] Error:', err);
    return new Response('TTS error', { status: 500 });
  }
}
