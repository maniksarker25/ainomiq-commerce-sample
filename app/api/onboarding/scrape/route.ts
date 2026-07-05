import { NextRequest } from 'next/server';
import { verifyJwt, COOKIE_NAME } from '@/lib/jwt';
import { scrapeWebshop } from '@/lib/scraper';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Auth check
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token);
  if (!payload) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url || url.length < 4 || url.length > 500) {
    return Response.json({ error: 'Please provide a valid store URL' }, { status: 400 });
  }

  // Validate URL format
  const testUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  try {
    new URL(testUrl);
  } catch {
    return Response.json({ error: 'Invalid URL format' }, { status: 400 });
  }

  // Stream progress via SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await scrapeWebshop(url, (step) => {
          const data = JSON.stringify(step);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        });
      } catch (err) {
        const errorMsg = JSON.stringify({ step: 'error', message: 'Scraping failed. Please check the URL and try again.' });
        controller.enqueue(encoder.encode(`data: ${errorMsg}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
