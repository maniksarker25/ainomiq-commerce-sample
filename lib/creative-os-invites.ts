import { randomBytes, randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { ensureAdManagerDb } from '@/lib/ad-manager/db';

export type InviteStatus = 'invited' | 'accepted' | 'rejected' | 'revoked' | 'expired';
export type CreativeOsRole = 'editor' | 'reviewer' | 'viewer' | 'admin';

export type CreativeOsInvite = {
  token: string;
  tenantId: string;
  productId: string;
  permissionId: string;
  email: string;
  role: CreativeOsRole;
  status: InviteStatus;
  invitedAt: string;
  inviteSentAt?: string;
  respondedAt?: string;
  revokedAt?: string;
  expiresAt?: string;
  createdBy?: string;
  invitedByName?: string;
  lastEmailError?: string;
  metadata?: string;
};

export type CreativeOsPermission = {
  id: string;
  productId: string;
  userName: string;
  role: string;
  email?: string;
  status?: InviteStatus;
  invitedAt?: string;
  respondedAt?: string;
  revokedAt?: string;
  inviteToken?: string;
  inviteSentAt?: string;
  expiresAt?: string;
  lastEmailError?: string;
};

const VALID_STATUSES = new Set<InviteStatus>(['invited', 'accepted', 'rejected', 'revoked', 'expired']);
const VALID_ROLES = new Set<CreativeOsRole>(['editor', 'reviewer', 'viewer', 'admin']);
const LEGACY_FAKE_NAMES = new Set(['ainomiq creative team']);

export const INVITE_TTL_DAYS = 14;

export function normalizeInviteStatus(value: unknown): InviteStatus {
  const status = String(value || '').trim().toLowerCase() as InviteStatus;
  return VALID_STATUSES.has(status) ? status : 'invited';
}

export function normalizeCreativeOsRole(value: unknown): CreativeOsRole {
  const role = String(value || '').trim().toLowerCase() as CreativeOsRole;
  return VALID_ROLES.has(role) ? role : 'editor';
}

export function createInviteToken() {
  return randomBytes(32).toString('base64url');
}

export function createPermissionId() {
  return `permission-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

export function inviteExpiresAt(from = new Date()) {
  return new Date(from.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function isExpiredInvite(invite: Pick<CreativeOsInvite, 'status' | 'expiresAt'>) {
  if (invite.status === 'expired') return true;
  return Boolean(invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now());
}

export function cleanInviteError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return message.replace(/[A-Za-z0-9_-]{24,}/g, '[redacted]').slice(0, 180) || 'Email provider rejected the invite';
}

export function isFakePermission(permission: Partial<CreativeOsPermission>) {
  const name = String(permission.userName || '').trim().toLowerCase();
  if (LEGACY_FAKE_NAMES.has(name)) return true;
  if (!permission.email && !permission.userName) return true;
  return false;
}

export function sanitizeStoredPermissions(permissions: CreativeOsPermission[]) {
  return permissions
    .filter(permission => !isFakePermission(permission))
    .map(permission => {
      const status = normalizeInviteStatus(permission.status || 'accepted');
      return {
        ...permission,
        email: typeof permission.email === 'string' ? permission.email.trim().toLowerCase() : '',
        status,
      };
    });
}

export function permissionFromInvite(invite: CreativeOsInvite): CreativeOsPermission {
  return {
    id: invite.permissionId,
    productId: invite.productId,
    userName: invite.email,
    role: invite.role,
    email: invite.email,
    status: isExpiredInvite(invite) && invite.status === 'invited' ? 'expired' : invite.status,
    invitedAt: invite.invitedAt,
    respondedAt: invite.respondedAt,
    revokedAt: invite.revokedAt,
    inviteToken: invite.token,
    inviteSentAt: invite.inviteSentAt || invite.invitedAt,
    expiresAt: invite.expiresAt,
    lastEmailError: invite.lastEmailError,
  };
}

async function addColumn(sql: string) {
  try {
    await db.execute(sql);
  } catch {
    // SQLite/libSQL cannot add an existing column. Ignore idempotent migrations.
  }
}

export async function ensureCreativeOsStores() {
  await ensureAdManagerDb();
  await db.execute(`CREATE TABLE IF NOT EXISTS creative_os_state (
    tenant_id TEXT PRIMARY KEY,
    state_json TEXT NOT NULL,
    updated_by TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS creative_os_invites (
    token TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    permission_id TEXT NOT NULL,
    email TEXT NOT NULL,
    status TEXT NOT NULL,
    invited_at DATETIME NOT NULL,
    responded_at DATETIME,
    created_by TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await addColumn(`ALTER TABLE creative_os_invites ADD COLUMN role TEXT DEFAULT 'editor'`);
  await addColumn(`ALTER TABLE creative_os_invites ADD COLUMN invite_sent_at DATETIME`);
  await addColumn(`ALTER TABLE creative_os_invites ADD COLUMN revoked_at DATETIME`);
  await addColumn(`ALTER TABLE creative_os_invites ADD COLUMN expires_at DATETIME`);
  await addColumn(`ALTER TABLE creative_os_invites ADD COLUMN invited_by_name TEXT`);
  await addColumn(`ALTER TABLE creative_os_invites ADD COLUMN last_email_error TEXT`);
  await addColumn(`ALTER TABLE creative_os_invites ADD COLUMN metadata TEXT`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_creative_os_invites_tenant ON creative_os_invites(tenant_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_creative_os_invites_email ON creative_os_invites(lower(email), status)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_creative_os_invites_permission ON creative_os_invites(tenant_id, permission_id)`);
}

function inviteFromRow(row: Record<string, unknown>): CreativeOsInvite {
  return {
    token: String(row.token || ''),
    tenantId: String(row.tenant_id || ''),
    productId: String(row.product_id || ''),
    permissionId: String(row.permission_id || ''),
    email: String(row.email || '').trim().toLowerCase(),
    role: normalizeCreativeOsRole(row.role),
    status: normalizeInviteStatus(row.status),
    invitedAt: String(row.invited_at || ''),
    inviteSentAt: row.invite_sent_at ? String(row.invite_sent_at) : undefined,
    respondedAt: row.responded_at ? String(row.responded_at) : undefined,
    revokedAt: row.revoked_at ? String(row.revoked_at) : undefined,
    expiresAt: row.expires_at ? String(row.expires_at) : undefined,
    createdBy: row.created_by ? String(row.created_by) : undefined,
    invitedByName: row.invited_by_name ? String(row.invited_by_name) : undefined,
    lastEmailError: row.last_email_error ? String(row.last_email_error) : undefined,
    metadata: row.metadata ? String(row.metadata) : undefined,
  };
}

export async function getInvitesForTenant(tenantId: string) {
  await ensureCreativeOsStores();
  const result = await db.execute({
    sql: `SELECT token, tenant_id, product_id, permission_id, email, role, status, invited_at, invite_sent_at, responded_at, revoked_at, expires_at, created_by, invited_by_name, last_email_error, metadata
          FROM creative_os_invites
          WHERE tenant_id = ?
          ORDER BY invited_at DESC`,
    args: [tenantId],
  });
  return result.rows.map(row => inviteFromRow(row as Record<string, unknown>));
}

export async function getInviteByToken(token: string) {
  await ensureCreativeOsStores();
  const result = await db.execute({
    sql: `SELECT token, tenant_id, product_id, permission_id, email, role, status, invited_at, invite_sent_at, responded_at, revoked_at, expires_at, created_by, invited_by_name, last_email_error, metadata
          FROM creative_os_invites
          WHERE token = ?
          LIMIT 1`,
    args: [token],
  });
  return result.rows[0] ? inviteFromRow(result.rows[0] as Record<string, unknown>) : null;
}

export async function getLatestAcceptedInviteForEmail(email: string) {
  await ensureCreativeOsStores();
  const result = await db.execute({
    sql: `SELECT token, tenant_id, product_id, permission_id, email, role, status, invited_at, invite_sent_at, responded_at, revoked_at, expires_at, created_by, invited_by_name, last_email_error, metadata
          FROM creative_os_invites
          WHERE lower(email) = ? AND status = 'accepted'
          ORDER BY responded_at DESC, invited_at DESC
          LIMIT 1`,
    args: [email.toLowerCase().trim()],
  });
  return result.rows[0] ? inviteFromRow(result.rows[0] as Record<string, unknown>) : null;
}

export async function markInviteExpired(invite: CreativeOsInvite) {
  if (invite.status !== 'invited' || !isExpiredInvite(invite)) return invite;
  const nowIso = new Date().toISOString();
  await db.execute({
    sql: `UPDATE creative_os_invites SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE token = ? AND status = 'invited'`,
    args: [invite.token],
  });
  return { ...invite, status: 'expired' as InviteStatus, respondedAt: nowIso };
}

export function mergeInvitePermissions(permissions: CreativeOsPermission[], invites: CreativeOsInvite[]) {
  const byId = new Map<string, CreativeOsPermission>();

  sanitizeStoredPermissions(permissions).forEach(permission => {
    const status = normalizeInviteStatus(permission.status || 'accepted');
    if (status === 'invited') return;
    if (status === 'rejected' || status === 'revoked' || status === 'expired') return;
    byId.set(permission.id, { ...permission, status });
  });

  [...invites]
    .sort((a, b) => new Date(a.invitedAt || 0).getTime() - new Date(b.invitedAt || 0).getTime())
    .forEach(invite => {
    const permission = permissionFromInvite(invite);
    if (permission.status === 'accepted' || permission.status === 'invited') {
      byId.set(permission.id, permission);
      return;
    }
    byId.delete(permission.id);
  });

  return [...byId.values()];
}

export function inviteHistoryPermissions(invites: CreativeOsInvite[]) {
  return invites
    .filter(invite => invite.status === 'rejected' || invite.status === 'revoked' || invite.status === 'expired')
    .map(permissionFromInvite);
}
