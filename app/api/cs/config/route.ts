import { NextRequest } from 'next/server';
import { getTenantConfigWithAliases } from '@/lib/db';
import { isDemoTenant } from '@/lib/demo';
import { getDemoCsConfig } from '@/lib/demo-data';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import {
  DEFAULT_AUTO_REPLY,
  mergeAutoReplySettings,
  parseAutoReplySettings,
  type AutoReplySettings,
} from '@/lib/cs-auto-reply';
import {
  getAutoReplySettings,
  applyAutoReplyPatch,
  loadCsBotConfigForUpdate,
} from '@/lib/cs-auto-reply-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  if (isDemoTenant(tenantId)) {
    return Response.json(getDemoCsConfig());
  }

  try {
    const [escalationContact, botConfigRaw] = await Promise.all([
      getTenantConfigWithAliases(tenantId, 'escalation_contacts'),
      getTenantConfigWithAliases(tenantId, 'cs_bot_config'),
    ]);

    let botConfig = null;
    if (botConfigRaw) {
      try {
        botConfig = JSON.parse(botConfigRaw);
      } catch {
        // Invalid JSON
      }
    }

    const auto_reply = await getAutoReplySettings(tenantId);

    return Response.json({
      auto_reply,
      escalation_contact: escalationContact || botConfig?.escalation_contact || null,
      vip: botConfig?.vip || null,
      safety: botConfig?.safety || null,
      bot_scope: botConfig?.bot_scope || null,
      schedule: botConfig?.schedule || null,
      fulfillment_email: botConfig?.fulfillment_email || null,
      tone: botConfig?.tone || null,
      hard_rules: botConfig?.hard_rules || null,
    });
  } catch (err) {
    console.error('[CS Config]', err);
    return Response.json({ error: 'Failed to fetch config' }, { status: 500 });
  }
}

function parseAutoReplyPatch(body: Record<string, unknown>): Partial<AutoReplySettings> | null {
  const raw = body.auto_reply;
  if (!raw || typeof raw !== 'object') return null;

  const patch: Partial<AutoReplySettings> = {};
  const obj = raw as Record<string, unknown>;
  if (typeof obj.email === 'boolean') patch.email = obj.email;
  if (typeof obj.instagram === 'boolean') patch.instagram = obj.instagram;
  if (typeof obj.facebook === 'boolean') patch.facebook = obj.facebook;
  return Object.keys(patch).length ? patch : null;
}

export async function PATCH(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const patch = parseAutoReplyPatch(body);
  if (!patch) {
    return Response.json({ error: 'Missing or invalid auto_reply settings' }, { status: 400 });
  }

  let tenantId: string;
  try {
    tenantId = await requireAuth(request, typeof body.tenant_id === 'string' ? body.tenant_id : undefined);
  } catch (err) {
    return handleAuthError(err);
  }

  if (isDemoTenant(tenantId)) {
    const demo = getDemoCsConfig();
    const auto_reply = mergeAutoReplySettings(
      demo.auto_reply || DEFAULT_AUTO_REPLY,
      patch,
    );
    return Response.json({ ...demo, auto_reply });
  }

  try {
    const auto_reply = await applyAutoReplyPatch(tenantId, patch);
    const botConfig = await loadCsBotConfigForUpdate(tenantId);
    const escalationContact = await getTenantConfigWithAliases(tenantId, 'escalation_contacts');

    return Response.json({
      auto_reply,
      escalation_contact: escalationContact || botConfig?.escalation_contact || null,
      vip: botConfig?.vip || null,
      safety: botConfig?.safety || null,
      bot_scope: botConfig?.bot_scope || null,
      schedule: botConfig?.schedule || null,
      fulfillment_email: botConfig?.fulfillment_email || null,
      tone: botConfig?.tone || null,
      hard_rules: botConfig?.hard_rules || null,
    });
  } catch (err) {
    console.error('[CS Config PATCH]', err);
    return Response.json({ error: 'Failed to update config' }, { status: 500 });
  }
}
