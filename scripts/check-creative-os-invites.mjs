#!/usr/bin/env node

const baseUrl = (process.env.AINOMIQ_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const cookie = process.env.AINOMIQ_SESSION_COOKIE || '';
const tenantId = process.env.AINOMIQ_TENANT_ID || '';
const productId = process.env.AINOMIQ_CREATIVE_OS_PRODUCT_ID || '';
const inviteEmail = process.env.AINOMIQ_INVITE_EMAIL || `creative-os-check-${Date.now()}@example.com`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function call(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { res, data, text };
}

if (!cookie || !tenantId || !productId) {
  console.error('Set AINOMIQ_SESSION_COOKIE, AINOMIQ_TENANT_ID and AINOMIQ_CREATIVE_OS_PRODUCT_ID before running this against a real environment.');
  process.exit(2);
}

const created = await call('/api/ad-manager/creative-os/invites', {
  method: 'POST',
  body: JSON.stringify({ tenant_id: tenantId, product_id: productId, email: inviteEmail, role: 'editor' }),
});
assert(created.res.ok, `Invite create failed: ${created.text}`);
const permission = created.data.permission;
assert(permission?.status === 'invited', 'POST invite did not return invited permission');

const loaded = await call(`/api/ad-manager/creative-os?tenant_id=${encodeURIComponent(tenantId)}`);
assert(loaded.res.ok, `Creative OS GET failed: ${loaded.text}`);
assert(loaded.data.state.permissions.some(item => item.id === permission.id && item.status === 'invited'), 'GET did not return invited row');

const autosave = await call('/api/ad-manager/creative-os', {
  method: 'POST',
  body: JSON.stringify({ tenant_id: tenantId, state: { ...loaded.data.state, permissions: [] } }),
});
assert(autosave.res.ok, `Autosave failed: ${autosave.text}`);
assert(autosave.data.state.permissions.some(item => item.id === permission.id && item.status === 'invited'), 'Autosave deleted invited row');

const accepted = await call('/api/ad-manager/creative-os/invites/respond', {
  method: 'POST',
  body: JSON.stringify({ token: permission.inviteToken, response: 'accepted' }),
});
assert(accepted.res.ok, `Accept failed: ${accepted.text}`);
assert(accepted.data.permission.status === 'accepted', 'Invite did not become accepted');

const revoke = await call('/api/ad-manager/creative-os/invites', {
  method: 'DELETE',
  body: JSON.stringify({ tenant_id: tenantId, permission_id: permission.id }),
});
assert(revoke.res.ok, `Revoke failed: ${revoke.text}`);

const afterRevoke = await call(`/api/ad-manager/creative-os?tenant_id=${encodeURIComponent(tenantId)}`);
assert(afterRevoke.res.ok, `GET after revoke failed: ${afterRevoke.text}`);
assert(!afterRevoke.data.state.permissions.some(item => item.id === permission.id), 'Revoked row returned as active permission');
assert(afterRevoke.data.state.permissionHistory.some(item => item.id === permission.id && item.status === 'revoked'), 'Revoked row missing from history');

console.log(JSON.stringify({
  ok: true,
  inviteEmail,
  permissionId: permission.id,
  checks: [
    'POST invite creates invited record',
    'GET returns invited row',
    'autosave preserves invited row',
    'respond accepted changes status',
    'revoke removes active access',
    'revoked appears only in history',
  ],
}, null, 2));
