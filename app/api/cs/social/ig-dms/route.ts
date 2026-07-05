import { NextRequest } from 'next/server';
import { isDemoTenant } from '@/lib/demo';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { graphError, graphUrl, resolveInstagramBusinessAccount } from '@/lib/cs-social';
import { getRecentIgConversationHints } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  if (isDemoTenant(tenantId)) {
    const { getDemoIgDms } = await import('@/lib/demo-data');
    return Response.json(getDemoIgDms());
  }

  const connection = await resolveInstagramBusinessAccount(tenantId);
  if (!connection?.accessToken || !connection.igAccountId) {
    return Response.json({
      error: 'Meta is connected, but no Instagram Business inbox was found. Reconnect Instagram/Facebook Messaging from Support Settings.',
      conversations: [],
    }, { status: 400 });
  }

  try {
    const res = await fetch(graphUrl(`${connection.pageId || connection.igAccountId}/conversations`, {
      fields: 'id,participants,updated_time,messages.limit(1){message,from,created_time}',
      platform: 'instagram',
      access_token: connection.accessToken,
    }), { cache: 'no-store' });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      const errMsg = graphError(errData, `Instagram API ${res.status}`);
      console.error('[ig-dms] API error:', errMsg);
      return Response.json({ error: errMsg, conversations: [] }, { status: 502 });
    }

    const data = await res.json();
    const items = data.data || [];

    type IgConversationItem = {
      id: string;
      participantName: string;
      lastMessage: string;
      updatedTime: string;
      status: string;
      followerCount: null;
      url: string;
      fromWebhook: boolean;
    };

    const conversations: IgConversationItem[] = items.map((c: any) => {
      const lastMsg = c.messages?.data?.[0];
      const participant = c.participants?.data?.find((p: any) => p.id !== connection.pageId && p.id !== connection.igAccountId);
      return {
        id: c.id || '',
        participantName: participant?.username || participant?.name || 'Unknown',
        lastMessage: lastMsg?.message || '',
        updatedTime: c.updated_time || lastMsg?.created_time || '',
        status: 'active',
        followerCount: null,
        url: '',
        fromWebhook: false,
      };
    });

    const hints = await getRecentIgConversationHints(tenantId, 20);
    const byId = new Map<string, IgConversationItem>(conversations.map((c) => [c.id, c]));

    for (const hint of hints) {
      if (hint.conversationKey.startsWith('peer:')) continue;
      const existing = byId.get(hint.conversationKey);
      if (existing) {
        const hintTime = new Date(hint.updatedTime).getTime();
        const existingTime = new Date(existing.updatedTime || 0).getTime();
        if (hintTime > existingTime) {
          existing.lastMessage = hint.lastMessage || existing.lastMessage;
          existing.updatedTime = hint.updatedTime;
          existing.fromWebhook = true;
        }
        continue;
      }
      conversations.unshift({
        id: hint.conversationKey,
        participantName: 'Instagram user',
        lastMessage: hint.lastMessage,
        updatedTime: hint.updatedTime,
        status: 'unread',
        followerCount: null,
        url: '',
        fromWebhook: true,
      });
    }

    conversations.sort(
      (a: { updatedTime: string }, b: { updatedTime: string }) =>
        new Date(b.updatedTime || 0).getTime() - new Date(a.updatedTime || 0).getTime(),
    );

    return Response.json({ conversations });
  } catch (err: any) {
    console.error('[ig-dms] Error:', err);
    return Response.json({ error: err.message || 'Failed to fetch Instagram DMs', conversations: [] }, { status: 500 });
  }
}
