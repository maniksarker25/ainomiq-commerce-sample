import { getIntegrationWithAliases, upsertIgMessage, disconnectIntegration } from '@/lib/db';

type IntegrationRow = {
  access_token?: string | null;
  provider_account_id?: string | null;
  provider_email?: string | null;
};

export type ResolvedFacebookPage = {
  accessToken: string;
  pageId: string;
  pageName?: string;
};

export type ResolvedInstagramAccount = {
  accessToken: string;
  igAccountId: string;
  pageId?: string;
  username?: string;
};

export function graphUrl(path: string, params: Record<string, string | number | null | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      search.set(key, String(value));
    }
  });
  return `https://graph.facebook.com/v21.0/${path.replace(/^\/+/, '')}?${search.toString()}`;
}

export function graphError(data: any, fallback: string) {
  return data?.error?.message || fallback;
}

export async function handleMetaApiError(tenantId: string, errData: any): Promise<boolean> {
  if (!errData || !errData.error) return false;
  const code = errData.error.code;
  const subcode = errData.error.error_subcode;
  const type = errData.error.type;
  const message = errData.error.message || '';

  // Standard Meta Graph API error codes for invalid/expired/revoked tokens are 190 and 102.
  // Other errors (like code 2500 for active access token required, or code 10 for permissions)
  // should not trigger a complete disconnection of the integration.
  const isTokenError =
    code === 190 ||
    code === 102 ||
    ((type === 'OAuthException' || type === 'AuthException') &&
     (code === 190 || code === 102 ||
      message.includes('access token') ||
      message.includes('revoked') ||
      message.includes('expired') ||
      message.includes('session') ||
      message.includes('checkpoint') ||
      message.includes('password changed'))) ||
    message.includes('access token has been revoked') ||
    message.includes('Session has expired') ||
    message.includes('invalid access token');

  if (isTokenError) {
    console.warn(`[Meta API Error] Token error detected for tenant ${tenantId}. Revoking integrations. Code: ${code}, Subcode: ${subcode}, Type: ${type}, Message: ${message}`);
    try {
      await Promise.all([
        disconnectIntegration(tenantId, 'meta'),
        disconnectIntegration(tenantId, 'facebook'),
        disconnectIntegration(tenantId, 'instagram'),
      ]);
      return true;
    } catch (dbErr) {
      console.error(`[Meta API Error] Failed to disconnect integrations:`, dbErr);
    }
  }
  return false;
}

function splitAccountId(raw: string) {
  const parts = raw.split('|').map(part => part.trim()).filter(Boolean);
  if (parts.length >= 2) return { pageId: parts[0], igAccountId: parts[1] };
  return { pageId: '', igAccountId: parts[0] || '' };
}

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

export async function resolveFacebookPage(tenantId: string): Promise<ResolvedFacebookPage | null> {
  const integration = await getIntegrationWithAliases(tenantId, 'facebook') as IntegrationRow | null;
  if (!integration?.access_token) return null;

  const storedPageId = String(integration.provider_account_id || '').trim();
  if (storedPageId) {
    return {
      accessToken: integration.access_token,
      pageId: storedPageId,
      pageName: integration.provider_email || undefined,
    };
  }

  const accounts = await fetchJson(graphUrl('me/accounts', {
    fields: 'id,name,access_token',
    access_token: integration.access_token,
  }));
  const page = accounts.data?.data?.[0];
  if (!accounts.ok || !page?.id) {
    if (accounts.data) {
      await handleMetaApiError(tenantId, accounts.data);
    }
    return null;
  }

  return {
    accessToken: page.access_token || integration.access_token,
    pageId: page.id,
    pageName: page.name || integration.provider_email || undefined,
  };
}

export async function resolveInstagramBusinessAccount(tenantId: string): Promise<ResolvedInstagramAccount | null> {
  const integration = await getIntegrationWithAliases(tenantId, 'instagram') as IntegrationRow | null;
  const facebookPage = await resolveFacebookPage(tenantId);

  if (integration?.access_token) {
    const raw = String(integration.provider_account_id || '').trim();
    const { pageId, igAccountId } = splitAccountId(raw);
    if (igAccountId) {
      return {
        accessToken: facebookPage?.accessToken || integration.access_token,
        igAccountId,
        pageId: pageId || facebookPage?.pageId,
        username: integration.provider_email || undefined,
      };
    }
  }

  if (!facebookPage) return null;

  const pageDetails = await fetchJson(graphUrl(facebookPage.pageId, {
    fields: 'instagram_business_account{id,username}',
    access_token: facebookPage.accessToken,
  }));
  const ig = pageDetails.data?.instagram_business_account;
  if (!pageDetails.ok || !ig?.id) {
    if (pageDetails.data) {
      await handleMetaApiError(tenantId, pageDetails.data);
    }
    return null;
  }

  return {
    accessToken: facebookPage.accessToken,
    igAccountId: ig.id,
    pageId: facebookPage.pageId,
    username: ig.username ? `@${ig.username}` : undefined,
  };
}

export function isOwnSender(senderId: string | undefined, accountIds: Array<string | undefined>) {
  if (!senderId) return false;
  return accountIds.filter(Boolean).includes(senderId);
}

export type SendInstagramDmInput = {
  conversationId?: string;
  recipientId?: string;
  message: string;
};

export type SendInstagramDmResult = {
  messageId: string;
  recipientId: string;
};

/**
 * Send an Instagram DM via the Page messaging API (Facebook Login flow).
 */
export async function sendInstagramDm(
  tenantId: string,
  input: SendInstagramDmInput,
): Promise<SendInstagramDmResult> {
  const message = String(input.message || '').trim();
  if (!message) throw new Error('Message is required');

  const connection = await resolveInstagramBusinessAccount(tenantId);
  if (!connection?.accessToken) {
    throw new Error('Instagram messaging is not connected');
  }

  const pageId = connection.pageId || '';
  if (!pageId) {
    throw new Error('Facebook Page id missing. Reconnect Meta messaging from Settings.');
  }

  let recipientId = String(input.recipientId || '').trim();

  if (!recipientId && input.conversationId) {
    const convRes = await fetchJson(graphUrl(input.conversationId, {
      fields: 'participants',
      access_token: connection.accessToken,
    }));
    if (!convRes.ok) {
      throw new Error(graphError(convRes.data, 'Failed to resolve conversation participants'));
    }
    const participants: Array<{ id?: string }> = convRes.data?.participants?.data || [];
    const peer = participants.find(
      p => p.id && !isOwnSender(p.id, [connection.pageId, connection.igAccountId]),
    );
    recipientId = String(peer?.id || '');
  }

  if (!recipientId) {
    throw new Error('Missing recipient. Pass conversation_id or recipient_id (Instagram-scoped user id).');
  }

  const sendRes = await fetch(
    graphUrl(`${pageId}/messages`, { access_token: connection.accessToken }),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_type: 'RESPONSE',
        recipient: { id: recipientId },
        message: { text: message },
      }),
      cache: 'no-store',
    },
  );

  const sendData = await sendRes.json().catch(() => null);
  if (!sendRes.ok) {
    throw new Error(graphError(sendData, 'Failed to send Instagram DM'));
  }

  const messageId = String(sendData?.message_id || sendData?.id || `ig-out-${Date.now()}`);

  await upsertIgMessage({
    id: messageId,
    tenantId,
    conversationId: input.conversationId || null,
    senderId: connection.igAccountId,
    recipientId,
    messageText: message,
    direction: 'outbound',
    status: 'read',
  });

  return { messageId, recipientId };
}

export type SendFacebookDmInput = {
  conversationId?: string;
  recipientId?: string;
  message: string;
};

export type SendFacebookDmResult = {
  messageId: string;
  recipientId: string;
};

/**
 * Send a Facebook Messenger DM via the Page messaging API.
 */
export async function sendFacebookMessengerDm(
  tenantId: string,
  input: SendFacebookDmInput,
): Promise<SendFacebookDmResult> {
  const message = String(input.message || '').trim();
  if (!message) throw new Error('Message is required');

  const connection = await resolveFacebookPage(tenantId);
  if (!connection?.accessToken || !connection.pageId) {
    throw new Error('Facebook Messenger is not connected');
  }

  let recipientId = String(input.recipientId || '').trim();

  if (!recipientId && input.conversationId) {
    const convRes = await fetchJson(graphUrl(input.conversationId, {
      fields: 'participants',
      access_token: connection.accessToken,
    }));
    if (!convRes.ok) {
      throw new Error(graphError(convRes.data, 'Failed to resolve conversation participants'));
    }
    const participants: Array<{ id?: string }> = convRes.data?.participants?.data || [];
    const peer = participants.find(
      p => p.id && !isOwnSender(p.id, [connection.pageId]),
    );
    recipientId = String(peer?.id || '');
  }

  if (!recipientId) {
    throw new Error('Missing recipient. Pass conversation_id or recipient_id (Messenger user id).');
  }

  const sendRes = await fetch(
    graphUrl(`${connection.pageId}/messages`, { access_token: connection.accessToken }),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_type: 'RESPONSE',
        recipient: { id: recipientId },
        message: { text: message },
      }),
      cache: 'no-store',
    },
  );

  const sendData = await sendRes.json().catch(() => null);
  if (!sendRes.ok) {
    throw new Error(graphError(sendData, 'Failed to send Facebook Messenger reply'));
  }

  const messageId = String(sendData?.message_id || sendData?.id || `fb-out-${Date.now()}`);

  return { messageId, recipientId };
}

/**
 * Reply to a Facebook Page post comment (public thread reply).
 */
export async function replyFacebookComment(
  tenantId: string,
  commentId: string,
  message: string,
): Promise<{ replyId: string }> {
  const text = String(message || '').trim();
  const id = String(commentId || '').trim();
  if (!id || !text) throw new Error('comment_id and message are required');

  const connection = await resolveFacebookPage(tenantId);
  if (!connection?.accessToken) {
    throw new Error('Facebook Page is not connected');
  }

  const params = new URLSearchParams({
    message: text,
    access_token: connection.accessToken,
  });

  const res = await fetch(graphUrl(`${id}/comments`, {}), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    cache: 'no-store',
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(graphError(data, 'Failed to send Facebook comment reply'));
  }

  return { replyId: String(data?.id || `fb-comment-reply-${Date.now()}`) };
}

/**
 * Reply to an Instagram Business account comment (public thread reply).
 */
export async function replyInstagramComment(
  tenantId: string,
  commentId: string,
  message: string,
): Promise<{ replyId: string }> {
  const text = String(message || '').trim();
  const id = String(commentId || '').trim();
  if (!id || !text) throw new Error('comment_id and message are required');

  const connection = await resolveInstagramBusinessAccount(tenantId);
  if (!connection?.accessToken) {
    throw new Error('Instagram Business account is not connected');
  }

  const params = new URLSearchParams({
    message: text,
    access_token: connection.accessToken,
  });

  const res = await fetch(graphUrl(`${id}/replies`, {}), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    cache: 'no-store',
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(graphError(data, 'Failed to send Instagram comment reply'));
  }

  return { replyId: String(data?.id || `ig-comment-reply-${Date.now()}`) };
}

