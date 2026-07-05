import { NextRequest } from 'next/server';
import { isDemoTenant } from '@/lib/demo';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { graphError, graphUrl, isOwnSender, resolveFacebookPage, resolveInstagramBusinessAccount } from '@/lib/cs-social';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  const conversationId = request.nextUrl.searchParams.get('id');
  const platform = request.nextUrl.searchParams.get('platform') === 'facebook' ? 'facebook' : 'instagram';
  const beforeCursor = request.nextUrl.searchParams.get('before') || '';
  const limitParam = request.nextUrl.searchParams.get('limit') || '50';

  if (!tenantId || !conversationId) {
    return Response.json({ error: 'Missing tenant_id or id' }, { status: 400 });
  }

  if (isDemoTenant(tenantId)) {
    const { getDemoConversationMessages } = await import('@/lib/demo-data');
    return Response.json(getDemoConversationMessages(conversationId));
  }

  const connection = platform === 'facebook'
    ? await resolveFacebookPage(tenantId)
    : await resolveInstagramBusinessAccount(tenantId);

  if (!connection?.accessToken) {
    return Response.json({ error: `${platform === 'facebook' ? 'Facebook' : 'Instagram'} messaging is not connected` }, { status: 400 });
  }

  try {
    const limit = parseInt(limitParam, 10) || 50;
    const messagesQuery = beforeCursor
      ? `messages.limit(${limit}).before(${beforeCursor}){message,from,created_time}`
      : `messages.limit(${limit}){message,from,created_time}`;

    const res = await fetch(graphUrl(conversationId, {
      fields: messagesQuery,
      access_token: connection.accessToken,
    }), { cache: 'no-store' });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      const errMsg = graphError(errData, `Meta conversation API ${res.status}`);
      console.error('[social-conversation] API error:', errMsg);
      return Response.json({ error: errMsg, messages: [] }, { status: 502 });
    }

    const data = await res.json();
    const items = data.messages?.data || [];
    const paging = data.messages?.paging || null;

    const accountIds = platform === 'facebook'
      ? ['pageId' in connection ? connection.pageId : undefined]
      : [
          'pageId' in connection ? connection.pageId : undefined,
          'igAccountId' in connection ? connection.igAccountId : undefined,
        ];

    const messages = items.map((m: any) => ({
      id: m.id || '',
      from: m.from?.username || m.from?.name || 'Unknown',
      text: m.message || '',
      createdAt: m.created_time || '',
      direction: isOwnSender(m.from?.id, accountIds) ? 'outgoing' : 'incoming',
    }));

    // API returns newest first, reverse for chronological order
    messages.reverse();

    return Response.json({
      messages,
      paging: paging ? {
        cursors: paging.cursors || null,
        next: paging.next ? true : false,
        previous: paging.previous ? true : false,
      } : null
    });
  } catch (err: any) {
    console.error('[social-conversation] Error:', err);
    return Response.json({ error: err.message || 'Failed to fetch conversation', messages: [] }, { status: 500 });
  }
}
