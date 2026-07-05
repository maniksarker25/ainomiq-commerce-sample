import { getIntegrationWithAliases, upsertIntegration } from './db';
import { getEnv } from './oauth-config';

// NOTE: Vercel production env var GOOGLE_CLIENT_SECRET must be set.
// Check .env.local for the value. Ensure Vercel has it configured.

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

export async function getGmailToken(tenantId: string): Promise<string> {
  const integration = await getIntegrationWithAliases(tenantId, 'google');
  if (!integration) {
    throw new GmailError('Google account not connected', 401);
  }

  const accessToken = integration.access_token as string;
  const refreshToken = integration.refresh_token as string | null;
  const expiresAt = integration.token_expires_at as string | null;

  // Always try to refresh proactively if we have a refresh token
  if (refreshToken) {
    const now = Date.now();
    const expiry = expiresAt ? new Date(expiresAt).getTime() : 0;
    // Refresh if: expired, about to expire (5min buffer), or no expiry recorded
    if (!expiresAt || now > expiry - 5 * 60 * 1000) {
      try {
        return await refreshGmailToken(tenantId, refreshToken);
      } catch (refreshError) {
        console.error('[Gmail] Token refresh failed, attempting to use current token:', refreshError);
        return accessToken;
      }
    }
  }

  return accessToken;
}

async function refreshGmailToken(tenantId: string, refreshToken: string): Promise<string> {
  const clientId = getEnv('GOOGLE_CLIENT_ID');
  const clientSecret = getEnv('GOOGLE_CLIENT_SECRET');
  
  if (!clientId || !clientSecret) {
    console.error('[Gmail] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables');
    throw new GmailError('Google OAuth configuration missing. Please contact support.', 500);
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[Gmail] Token refresh failed:', res.status, text);
    // Check for specific Google errors
    if (text.includes('invalid_grant')) {
      console.error('[Gmail] invalid_grant - refresh token is revoked or expired. If your Google Cloud app is in "Testing" mode, refresh tokens expire after 7 days. Publish the app to fix this.');
      throw new GmailError('Google refresh token expired. If your Google Cloud app is in Testing mode, tokens expire after 7 days. Please reconnect or publish the app.', 401);
    }
    throw new GmailError(`Failed to refresh Google token (${res.status}). Please reconnect.`, 401);
  }

  const data = await res.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await upsertIntegration(
    tenantId,
    'google',
    data.access_token,
    refreshToken,
    expiresAt,
    null,
    null,
    null,
  );

  console.log('[Gmail] Token refreshed successfully, expires at', expiresAt);
  return data.access_token;
}

export class GmailError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function gmailFetch(token: string, path: string, options?: RequestInit) {
  const res = await fetch(`${GMAIL_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    throw new GmailError('Google token expired. Please reconnect.', 401);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new GmailError(`Gmail API error: ${res.status} ${text}`, res.status);
  }

  return res.json();
}

export async function getGmailTokenAndFetch(tenantId: string, path: string, options?: RequestInit) {
  let token: string;
  try {
    token = await getGmailToken(tenantId);
  } catch (err) {
    throw err;
  }

  try {
    return await gmailFetch(token, path, options);
  } catch (err) {
    if (err instanceof GmailError && err.status === 401) {
      // Token was stale - force a refresh and retry once
      const integration = await getIntegrationWithAliases(tenantId, 'google');
      const refreshToken = integration?.refresh_token as string | null;
      if (refreshToken) {
        try {
          const newToken = await refreshGmailToken(tenantId, refreshToken);
          return await gmailFetch(newToken, path, options);
        } catch (refreshErr) {
          console.error('[Gmail] Retry refresh also failed:', refreshErr);
          throw new GmailError(
            'Google token expired and could not be refreshed. This usually means the app needs to be re-authorized. Please reconnect Google in Settings.',
            401
          );
        }
      }
    }
    throw err;
  }
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  const h = headers.find((h: { name: string }) => h.name.toLowerCase() === name.toLowerCase());
  return h?.value || '';
}

export function parseEmailHeaders(message: { id: string; threadId: string; labelIds?: string[]; snippet: string; payload: { headers: Array<{ name: string; value: string }> }; internalDate: string }) {
  const headers = message.payload.headers;
  return {
    id: message.id,
    threadId: message.threadId,
    subject: getHeader(headers, 'Subject'),
    from: getHeader(headers, 'From'),
    to: getHeader(headers, 'To'),
    deliveredTo: getHeader(headers, 'Delivered-To'),
    date: getHeader(headers, 'Date'),
    snippet: message.snippet,
    labels: message.labelIds || [],
    isUnread: (message.labelIds || []).includes('UNREAD'),
    internalDate: message.internalDate,
  };
}

interface MimePart {
  mimeType: string;
  body?: { data?: string; size?: number };
  parts?: MimePart[];
}

export function parseEmailBody(payload: MimePart): string {
  if (payload.body?.data) {
    if (payload.mimeType === 'text/plain' || payload.mimeType === 'text/html') {
      return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
    }
  }

  if (payload.parts) {
    // Prefer text/plain, fallback to text/html
    const textPart = payload.parts.find(p => p.mimeType === 'text/plain');
    if (textPart?.body?.data) {
      return Buffer.from(textPart.body.data, 'base64url').toString('utf-8');
    }
    const htmlPart = payload.parts.find(p => p.mimeType === 'text/html');
    if (htmlPart?.body?.data) {
      return Buffer.from(htmlPart.body.data, 'base64url').toString('utf-8');
    }
    // Recurse into nested multipart
    for (const part of payload.parts) {
      const body = parseEmailBody(part);
      if (body) return body;
    }
  }

  return '';
}

export interface ParsedEmailBody {
  text: string;
  html: string;
}

export function parseEmailBodyParts(payload: MimePart): ParsedEmailBody {
  let text = '';
  let html = '';

  function traverse(part: MimePart) {
    if (part.body?.data) {
      if (part.mimeType === 'text/plain') {
        text += Buffer.from(part.body.data, 'base64url').toString('utf-8');
      } else if (part.mimeType === 'text/html') {
        html += Buffer.from(part.body.data, 'base64url').toString('utf-8');
      }
    }
    if (part.parts) {
      for (const subPart of part.parts) {
        traverse(subPart);
      }
    }
  }

  traverse(payload);

  if (!text && !html) {
    text = parseEmailBody(payload);
  }

  return { text, html };
}

export function createMimeMessage(to: string, subject: string, body: string, threadId: string, messageId: string): string {
  const lines = [
    `To: ${to}`,
    `Subject: ${subject.startsWith('Re:') ? subject : `Re: ${subject}`}`,
    `In-Reply-To: ${messageId}`,
    `References: ${messageId}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    body,
  ];
  const raw = lines.join('\r\n');
  return Buffer.from(raw).toString('base64url');
}

