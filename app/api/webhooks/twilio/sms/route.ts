import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const from = String(form.get('From') || '');
  const body = String(form.get('Body') || '');

  console.log('[Twilio SMS/WhatsApp]', { from, body });

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Thanks! We received your message and will reply shortly.</Message>
</Response>`;

  return new Response(twiml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  });
}
