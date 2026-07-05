import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { COOKIE_NAME, verifyJwt } from '@/lib/jwt';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { validateEmail } from '@/lib/input-validation';
import {
  cleanInviteError,
  createInviteToken,
  createPermissionId,
  ensureCreativeOsStores,
  getInvitesForTenant,
  inviteExpiresAt,
  normalizeCreativeOsRole,
  permissionFromInvite,
  type CreativeOsInvite,
} from '@/lib/creative-os-invites';

export const dynamic = 'force-dynamic';

async function getActor(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const jwt = token ? await verifyJwt(token) : null;
  return { email: jwt?.email || '', name: jwt?.name || jwt?.email || 'Unknown', accessMode: jwt?.accessMode || 'customer' };
}

function baseUrl(request: NextRequest) {
  const configured = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim();
  if (configured) return configured.replace(/\/$/, '');
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  if (host) return `${proto}://${host}`;
  return 'https://app.ainomiq.com';
}

async function sendInviteViaResend(toEmail: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('Email service not configured');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Ainomiq <no-reply@ainomiq.com>',
      to: [toEmail],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[Creative OS Invite] Resend API failed:', res.status, text.slice(0, 500));
    throw new Error(`Email send failed: ${res.status}`);
  }
}

function inviteEmailHtml(invite: Pick<CreativeOsInvite, 'token' | 'email' | 'invitedByName'>, request: NextRequest) {
  const inviteUrl = `${baseUrl(request)}/creative-os/invite?token=${encodeURIComponent(invite.token)}`;
  const inviter = invite.invitedByName || 'Ainomiq';
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:36px 20px;color:#0f172a">
      <div style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#2563eb;margin-bottom:12px">Ainomiq Creative OS</div>
      <h1 style="font-size:28px;line-height:1.12;margin:0 0 12px;color:#0f172a">You have been invited to Creative OS</h1>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 18px">${inviter} invited <strong>${invite.email}</strong> to collaborate in a Creative OS workspace.</p>
      <div style="margin:22px 0 28px;display:flex;gap:12px;flex-wrap:wrap">
        <a href="${inviteUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:13px 18px;border-radius:14px;font-weight:800">Open invite</a>
      </div>
      <p style="color:#94a3b8;font-size:13px;line-height:1.45;margin:0">You can accept or decline on the invite page. If you did not expect this invite, you can ignore this email.</p>
    </div>
  `;
}

async function updateEmailResult(token: string, error: unknown | null) {
  await db.execute({
    sql: `UPDATE creative_os_invites
          SET invite_sent_at = ?, last_email_error = ?, updated_at = CURRENT_TIMESTAMP
          WHERE token = ?`,
    args: [new Date().toISOString(), error ? cleanInviteError(error) : null, token],
  });
}

async function sendAndPersist(invite: CreativeOsInvite, request: NextRequest) {
  try {
    await sendInviteViaResend(invite.email, 'You have been invited to Creative OS', inviteEmailHtml(invite, request));
    await updateEmailResult(invite.token, null);
    return { emailDelivery: 'sent' as const, lastEmailError: null };
  } catch (error) {
    await updateEmailResult(invite.token, error);
    return { emailDelivery: 'failed' as const, lastEmailError: cleanInviteError(error) };
  }
}

async function loadInvite(tenantId: string, permissionId: string) {
  const invites = await getInvitesForTenant(tenantId);
  return invites.find(invite => invite.permissionId === permissionId) || null;
}

function parseStateJson(value: unknown) {
  if (!value) return null;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

async function loadCreativeOsState(tenantId: string) {
  const result = await db.execute({ sql: `SELECT state_json FROM creative_os_state WHERE tenant_id = ? LIMIT 1`, args: [tenantId] });
  return parseStateJson(result.rows[0]?.state_json);
}

async function removePermissionFromStoredState(tenantId: string, permissionId: string) {
  const state = await loadCreativeOsState(tenantId);
  if (!state || !Array.isArray(state.permissions)) return { removed: false, productId: '', email: '' };

  const permission = state.permissions.find((item: any) => String(item?.id || '') === permissionId);
  state.permissions = state.permissions.filter((item: any) => String(item?.id || '') !== permissionId);
  await db.execute({
    sql: `INSERT INTO creative_os_state (tenant_id, state_json, updated_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(tenant_id) DO UPDATE SET state_json = excluded.state_json, updated_at = CURRENT_TIMESTAMP`,
    args: [tenantId, JSON.stringify(state)],
  });

  return {
    removed: Boolean(permission),
    productId: String(permission?.productId || ''),
    email: String(permission?.email || permission?.userName || '').trim().toLowerCase(),
  };
}

function combineWarnings(...warnings: Array<string | undefined>) {
  return warnings.filter(Boolean).join(' ');
}

export async function POST(request: NextRequest) {
  let body: { tenant_id?: string; product_id?: string; email?: string; user_name?: string; role?: string } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  let tenantId: string;
  try {
    tenantId = await requireAuth(request, body.tenant_id);
  } catch (err) {
    return handleAuthError(err);
  }

  const email = String(body.email || '').trim().toLowerCase();
  const productId = String(body.product_id || '').trim();
  const role = normalizeCreativeOsRole(body.role);

  if (!productId) return Response.json({ error: 'product_id is required' }, { status: 400 });
  if (!email || !validateEmail(email)) return Response.json({ field: 'email', error: 'Enter a valid email address.' }, { status: 400 });

  try {
    await ensureCreativeOsStores();
    const actor = await getActor(request);
    if (actor.accessMode === 'creative-editor') {
      return Response.json({ error: 'Editors cannot manage access' }, { status: 403 });
    }

    const existing = (await getInvitesForTenant(tenantId))
      .find(invite => invite.productId === productId && invite.email === email);

    if (existing?.status === 'accepted') {
      return Response.json({ ok: true, alreadyExists: true, reason: 'accepted', permission: permissionFromInvite(existing), message: 'Already has access.' });
    }

    if (existing?.status === 'invited') {
      return Response.json({ ok: true, alreadyExists: true, reason: 'invited', permission: permissionFromInvite(existing), message: 'Invite already sent.' });
    }

    const nowIso = new Date().toISOString();
    const invite: CreativeOsInvite = {
      token: createInviteToken(),
      tenantId,
      productId,
      permissionId: createPermissionId(),
      email,
      role,
      status: 'invited',
      invitedAt: nowIso,
      inviteSentAt: nowIso,
      expiresAt: inviteExpiresAt(new Date(nowIso)),
      createdBy: actor.email,
      invitedByName: actor.name || actor.email,
    };

    await db.execute({
      sql: `INSERT INTO creative_os_invites (token, tenant_id, product_id, permission_id, email, role, status, invited_at, invite_sent_at, expires_at, created_by, invited_by_name, last_email_error, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'invited', ?, ?, ?, ?, ?, NULL, CURRENT_TIMESTAMP)`,
      args: [invite.token, tenantId, productId, invite.permissionId, email, role, nowIso, nowIso, invite.expiresAt || null, actor.email, actor.name || actor.email],
    });

    const delivery = await sendAndPersist(invite, request);
    const emailWarning = delivery.emailDelivery === 'failed' ? 'Invite created, email failed to send.' : '';
    return Response.json({
      ok: delivery.emailDelivery === 'sent',
      permission: { ...permissionFromInvite(invite), lastEmailError: delivery.lastEmailError || undefined },
      emailDelivery: delivery.emailDelivery,
      warning: combineWarnings(emailWarning) || undefined,
    });
  } catch (err) {
    console.error('[Creative OS Invite] POST failed:', err);
    return Response.json({ error: 'Failed to create invite' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  let body: { tenant_id?: string; permission_id?: string; action?: string } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  let tenantId: string;
  try {
    tenantId = await requireAuth(request, body.tenant_id);
  } catch (err) {
    return handleAuthError(err);
  }

  const permissionId = String(body.permission_id || '').trim();
  if (!permissionId) return Response.json({ error: 'permission_id is required' }, { status: 400 });

  try {
    await ensureCreativeOsStores();
    const actor = await getActor(request);
    if (actor.accessMode === 'creative-editor') {
      return Response.json({ error: 'Editors cannot manage access' }, { status: 403 });
    }

    const invite = await loadInvite(tenantId, permissionId);
    if (!invite) return Response.json({ error: 'Invite not found' }, { status: 404 });
    if (invite.status !== 'invited') {
      return Response.json({ error: 'Only pending invites can be resent' }, { status: 409 });
    }

    const nextToken = createInviteToken();
    const nowIso = new Date().toISOString();
    const nextInvite = { ...invite, token: nextToken, inviteSentAt: nowIso, expiresAt: inviteExpiresAt(new Date(nowIso)), invitedByName: actor.name || actor.email };
    await db.execute({
      sql: `UPDATE creative_os_invites
            SET token = ?, invite_sent_at = ?, expires_at = ?, invited_by_name = ?, last_email_error = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE tenant_id = ? AND permission_id = ? AND status = 'invited'`,
      args: [nextToken, nowIso, nextInvite.expiresAt, nextInvite.invitedByName, tenantId, permissionId],
    });

    const delivery = await sendAndPersist(nextInvite, request);
    const emailWarning = delivery.emailDelivery === 'failed' ? 'Invite still exists, email failed to send.' : '';
    return Response.json({
      ok: delivery.emailDelivery === 'sent',
      permission: { ...permissionFromInvite(nextInvite), lastEmailError: delivery.lastEmailError || undefined },
      emailDelivery: delivery.emailDelivery,
      warning: combineWarnings(emailWarning) || undefined,
    });
  } catch (err) {
    console.error('[Creative OS Invite] PATCH failed:', err);
    return Response.json({ error: 'Failed to resend invite' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  let body: { tenant_id?: string; permission_id?: string; delete_history?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  let tenantId: string;
  try {
    tenantId = await requireAuth(request, body.tenant_id);
  } catch (err) {
    return handleAuthError(err);
  }

  const permissionId = String(body.permission_id || '').trim();
  if (!permissionId) return Response.json({ error: 'permission_id is required' }, { status: 400 });

  try {
    await ensureCreativeOsStores();
    const actor = await getActor(request);
    if (actor.accessMode === 'creative-editor') {
      return Response.json({ error: 'Editors cannot manage access' }, { status: 403 });
    }

    const invite = await loadInvite(tenantId, permissionId);
    if (body.delete_history) {
      if (!invite) return Response.json({ ok: true, alreadyRemoved: true });
      if (!['rejected', 'revoked', 'expired'].includes(invite.status)) {
        return Response.json({ error: 'Only inactive invite history can be deleted' }, { status: 409 });
      }
      await db.execute({
        sql: `DELETE FROM creative_os_invites WHERE tenant_id = ? AND permission_id = ?`,
        args: [tenantId, permissionId],
      });
      return Response.json({ ok: true, removed: true });
    }

    const legacyRemoval = invite ? { removed: false, productId: '', email: '' } : await removePermissionFromStoredState(tenantId, permissionId);
    const nowIso = new Date().toISOString();
    await db.execute({
      sql: `UPDATE creative_os_invites
            SET status = CASE WHEN status = 'accepted' THEN 'revoked' ELSE 'revoked' END,
                revoked_at = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE tenant_id = ? AND permission_id = ?`,
      args: [nowIso, tenantId, permissionId],
    });

    return Response.json({
      ok: true,
      status: 'revoked',
      removedLegacyPermission: legacyRemoval.removed,
    });
  } catch (err) {
    console.error('[Creative OS Invite] DELETE failed:', err);
    return Response.json({ error: 'Failed to revoke access' }, { status: 500 });
  }
}
