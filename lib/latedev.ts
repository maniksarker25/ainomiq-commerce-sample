/**
 * Late.dev API client for social inbox (IG DMs, IG Comments).
 * Credentials from Vercel env vars.
 */

const LATEDEV_BASE = 'https://getlate.dev/api/v1';

function getConfig() {
  const apiKey = process.env.LATEDEV_API_KEY;
  const accountId = process.env.LATEDEV_ACCOUNT_ID;
  if (!apiKey || !accountId) return null;
  return { apiKey, accountId };
}

async function latedevFetch(path: string) {
  const config = getConfig();
  if (!config) throw new Error('Late.dev not configured');
  
  const res = await fetch(`${LATEDEV_BASE}${path}`, {
    headers: { 'Authorization': `Bearer ${config.apiKey}` },
    cache: 'no-store',
  });
  
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Late.dev ${res.status}: ${text}`);
  }
  return res.json();
}

export interface Conversation {
  id: string;
  participantName: string;
  lastMessage: string;
  updatedTime: string;
  status: string;
  followerCount: number | null;
  url: string;
}

export interface ConversationMessage {
  id: string;
  from: string;
  text: string;
  createdAt: string;
  direction: 'incoming' | 'outgoing';
}

export interface IGPost {
  id: string;
  content: string;
  createdTime: string;
  permalink: string;
  picture: string;
  commentCount: number;
  likeCount: number;
  comments?: Array<{
    id: string;
    from: string;
    message: string;
    createdTime: string;
    likeCount: number;
  }>;
}

export async function getInstagramDMs(): Promise<Conversation[]> {
  const config = getConfig();
  if (!config) return [];
  
  try {
    const data = await latedevFetch(`/inbox/conversations?accountId=${config.accountId}&limit=50`);
    const items = data.data || [];
    
    return items.map((c: any) => ({
      id: c.id || '',
      participantName: c.participantName || 'Unknown',
      lastMessage: c.lastMessage || '',
      updatedTime: c.updatedTime || '',
      status: c.status || 'active',
      followerCount: c.instagramProfile?.followerCount ?? null,
      url: c.url || '',
    }));
  } catch (err) {
    console.error('Failed to fetch IG DMs:', err);
    return [];
  }
}

export async function getConversationMessages(conversationId: string): Promise<ConversationMessage[]> {
  const config = getConfig();
  if (!config) return [];
  
  try {
    const data = await latedevFetch(`/inbox/conversations/${conversationId}/messages?accountId=${config.accountId}&limit=30`);
    const items = data.messages || data.data || [];
    
    return items.map((m: any) => ({
      id: m.id || '',
      from: m.senderName || '',
      text: m.message || '',
      createdAt: m.createdAt || '',
      direction: m.direction === 'outgoing' ? 'outgoing' : 'incoming',
    }));
  } catch (err) {
    console.error('Failed to fetch conversation messages:', err);
    return [];
  }
}

export async function getInstagramComments(): Promise<IGPost[]> {
  const config = getConfig();
  if (!config) return [];
  
  try {
    const data = await latedevFetch(`/inbox/comments?accountId=${config.accountId}&limit=50`);
    const items = data.data || [];
    
    return items.map((p: any) => ({
      id: p.id || '',
      content: p.content || '',
      createdTime: p.createdTime || '',
      permalink: p.permalink || '',
      picture: p.picture || '',
      commentCount: p.commentCount || 0,
      likeCount: p.likeCount || 0,
      comments: (p.comments?.data || p.comments || []).map((comment: any) => ({
        id: comment.id || '',
        from: comment.from?.username || comment.username || comment.from?.name || 'Unknown',
        message: comment.text || comment.message || '',
        createdTime: comment.createdTime || comment.timestamp || '',
        likeCount: comment.likeCount || 0,
      })),
    }));
  } catch (err) {
    console.error('Failed to fetch IG comments:', err);
    return [];
  }
}
