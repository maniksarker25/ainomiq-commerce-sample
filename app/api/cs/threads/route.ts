import { NextRequest } from 'next/server';
import { isDemoTenant } from '@/lib/demo';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  if (isDemoTenant(tenantId)) {
    return Response.json({
      stats: { received: 47, handled: 39, avgResponseTime: '2h 14m', escalated: 2 },
      threads: [
        { from: 'lisa.vanderberg', subject: 'Where is my order #4821?', status: 'pending', time: '2h ago' },
        { from: 'mark.dejong', subject: 'Return request - wrong size', status: 'pending', time: '5h ago' },
        { from: 'sarah.klein', subject: 'Discount code not working', status: 'pending', time: '8h ago' },
        { from: 'tom.bakker', subject: 'Product question - Heavyweight Hoodie', status: 'handled', time: '12h ago' },
        { from: 'emma.visser', subject: 'Missing item in my package', status: 'handled', time: '18h ago' },
      ],
    });
  }

  return Response.json({ threads: [], stats: {} });
}
