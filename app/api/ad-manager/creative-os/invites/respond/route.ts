import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { clearCookieHeader } from '@/lib/jwt';
import {
  ensureCreativeOsStores,
  getInviteByToken,
  isExpiredInvite,
  markInviteExpired,
  permissionFromInvite,
  type CreativeOsInvite,
} from '@/lib/creative-os-invites';

export const dynamic = 'force-dynamic';

type InviteResponse = 'accepted' | 'rejected';

function parseResponse(value: string | null | undefined): InviteResponse | null {
  if (value === 'accepted' || value === 'rejected') return value;
  return null;
}

function loginHref(invite: CreativeOsInvite) {
  const params = new URLSearchParams({
    return: '/dashboard/creative-os',
    force: '1',
    email: invite.email,
    invite: invite.token,
  });
  return `/login?${params.toString()}`;
}

function registerHref(invite: CreativeOsInvite) {
  const params = new URLSearchParams({
    return: '/dashboard/creative-os',
    force: '1',
    email: invite.email,
    invite: invite.token,
  });
  return `/register?${params.toString()}`;
}

function htmlPage(title: string, body: string, cta = '', tone: 'blue' | 'red' | 'slate' = 'blue') {
  const color = tone === 'red' ? '#dc2626' : tone === 'slate' ? '#475569' : '#2563eb';
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head><body style="margin:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a"><main style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px"><section style="max-width:560px;width:100%;border:1px solid #e2e8f0;border-radius:28px;background:white;padding:34px;box-shadow:0 24px 70px rgba(15,23,42,.08)"><div style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:${color};margin-bottom:10px">Ainomiq Creative OS</div><h1 style="font-size:30px;line-height:1.1;margin:0 0 12px">${title}</h1><p style="font-size:16px;line-height:1.6;color:#475569;margin:0">${body}</p>${cta}</section></main></body></html>`;
}

function invitePageHref(token: string) {
  return `/creative-os/invite?token=${encodeURIComponent(token)}`;
}

async function respondToInvite(token: string, response: InviteResponse) {
  await ensureCreativeOsStores();
  const found = await getInviteByToken(token);
  if (!found) return { ok: false as const, status: 404, invite: null, message: 'Invite link not found.' };

  const invite = isExpiredInvite(found) ? await markInviteExpired(found) : found;
  if (invite.status === 'expired') return { ok: false as const, status: 410, invite, message: 'This invite has expired. Ask the workspace owner for a new invite.' };
  if (invite.status === 'revoked') return { ok: false as const, status: 410, invite, message: 'This invite was revoked by the workspace owner.' };
  if (invite.status === 'accepted' && response === 'rejected') return { ok: false as const, status: 409, invite, message: 'This invite has already been accepted.' };
  if (invite.status === 'rejected' && response === 'accepted') return { ok: false as const, status: 409, invite, message: 'This invite was declined. Ask the workspace owner to invite you again.' };
  if (invite.status === response) return { ok: true as const, invite, already: true };

  const nowIso = new Date().toISOString();
  await db.execute({
    sql: `UPDATE creative_os_invites
          SET status = ?, responded_at = ?, revoked_at = CASE WHEN ? = 'rejected' THEN revoked_at ELSE revoked_at END, updated_at = CURRENT_TIMESTAMP
          WHERE token = ? AND status = 'invited'`,
    args: [response, nowIso, response, token],
  });

  const nextInvite = { ...invite, status: response, respondedAt: nowIso };

  return {
    ok: true as const,
    invite: nextInvite,
    already: false,
  };
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') || '';
  const response = parseResponse(request.nextUrl.searchParams.get('response'));
  const confirmed = request.nextUrl.searchParams.get('confirm') === '1';
  if (!token || !response) {
    return new Response(htmlPage('Invalid invite link', 'This Creative OS invite link is missing required information.', '', 'red'), {
      status: 400,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  try {
    if (response === 'rejected' && !confirmed) {
      const invite = await getInviteByToken(token);
      if (!invite) {
        return new Response(htmlPage('Invite link not found', 'Ask the workspace owner to send a fresh Creative OS invite.', '', 'red'), {
          status: 404,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }
      if (invite.status === 'invited') {
        const declineHref = `/api/ad-manager/creative-os/invites/respond?token=${encodeURIComponent(token)}&response=rejected&confirm=1`;
        const cta = `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:22px"><a href="${declineHref}" style="display:inline-block;border-radius:14px;background:#0f172a;color:#fff;text-decoration:none;padding:13px 18px;font-weight:800">Yes, decline invite</a><a href="${invitePageHref(token)}" style="display:inline-block;border-radius:14px;background:#fff;color:#0f172a;text-decoration:none;padding:13px 18px;font-weight:800;border:1px solid #e2e8f0">Go back</a></div>`;
        return new Response(htmlPage('Decline invite?', `This will decline the Creative OS invite for ${invite.email}.`, cta, 'slate'), {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }
    }

    const result = await respondToInvite(token, response);
    const headers = new Headers({ 'content-type': 'text/html; charset=utf-8' });
    if (response === 'accepted') headers.set('Set-Cookie', clearCookieHeader());

    if (!result.ok) {
      return new Response(htmlPage('Invite unavailable', result.message, '', 'red'), { status: result.status, headers });
    }

    const invite = result.invite;
    if (response === 'accepted') {
      const cta = `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:22px"><a href="${loginHref(invite)}" style="display:inline-block;border-radius:14px;background:#2563eb;color:#fff;text-decoration:none;padding:13px 18px;font-weight:800">Sign in</a><a href="${registerHref(invite)}" style="display:inline-block;border-radius:14px;background:#fff;color:#0f172a;text-decoration:none;padding:13px 18px;font-weight:800;border:1px solid #e2e8f0">Create account</a></div>`;
      return new Response(htmlPage('Invite accepted', `Use ${invite.email} to open this Creative OS workspace. Choose Create account if this email does not have an Ainomiq login yet.`, cta), { status: 200, headers });
    }

    return new Response(htmlPage('Invite declined', `${invite.email} declined this Creative OS invite. You do not need to take any further action.`, '', 'slate'), { status: 200, headers });
  } catch (err) {
    console.error('[Creative OS Invite Respond] GET failed:', err);
    return new Response(htmlPage('Invite could not be updated', 'Please ask the workspace owner to send a fresh invite.', '', 'red'), {
      status: 500,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }
}

export async function POST(request: NextRequest) {
  let body: { token?: string; response?: string } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const response = parseResponse(body.response);
  if (!body.token || !response) return Response.json({ error: 'Invalid invite response' }, { status: 400 });

  try {
    const result = await respondToInvite(body.token, response);
    if (!result.ok) return Response.json({ error: result.message }, { status: result.status });
    return Response.json({ ok: true, permission: permissionFromInvite(result.invite) });
  } catch (err) {
    console.error('[Creative OS Invite Respond] POST failed:', err);
    return Response.json({ error: 'Failed to update invite' }, { status: 500 });
  }
}
