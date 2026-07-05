import { NextRequest } from 'next/server';
import { isDemoTenant } from '@/lib/demo';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { graphError, graphUrl, resolveFacebookPage } from '@/lib/cs-social';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  if (isDemoTenant(tenantId)) {
    return Response.json({ conversations: [] });
  }

  const connection = await resolveFacebookPage(tenantId);
  if (!connection?.accessToken || !connection.pageId) {
    return Response.json({
      error: 'Facebook is connected, but no Page inbox was found. Reconnect Facebook Messaging from Support Settings.',
      conversations: [],
    }, { status: 400 });
  }

  try {
    const res = await fetch(graphUrl(`${connection.pageId}/conversations`, {
      fields: 'id,participants,updated_time,messages.limit(1){message,from,created_time}',
      platform: 'messenger',
      access_token: connection.accessToken,
    }), { cache: 'no-store' });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      const errMsg = graphError(errData, `Facebook API ${res.status}`);
      console.error('[fb-dms] API error:', errMsg);
      return Response.json({ error: errMsg, conversations: [] }, { status: 502 });
    }

    const data = await res.json();
    const conversations = (data.data || []).map((conversation: any) => {
      const lastMsg = conversation.messages?.data?.[0];
      const participant = conversation.participants?.data?.find((p: any) => p.id !== connection.pageId);
      return {
        id: conversation.id || '',
        participantName: participant?.name || participant?.username || 'Unknown',
        lastMessage: lastMsg?.message || '',
        updatedTime: conversation.updated_time || lastMsg?.created_time || '',
        status: 'active',
        followerCount: null,
        url: '',
      };
    });

    return Response.json({ conversations });
  } catch (err: any) {
    console.error('[fb-dms] Error:', err);
    return Response.json({ error: err.message || 'Failed to fetch Facebook DMs', conversations: [] }, { status: 500 });
  }
}
