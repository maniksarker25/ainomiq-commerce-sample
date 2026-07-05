import { clearCookieHeader } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

export async function POST() {
  const headers = new Headers();
  headers.set('Set-Cookie', clearCookieHeader());

  return Response.json({ success: true }, {
    status: 200,
    headers,
  });
}
