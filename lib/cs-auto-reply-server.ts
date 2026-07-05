import {
  getTenantConfigForAlias,
  getTenantEmailAliases,
  resolveCanonicalTenantId,
  setTenantConfig,
  setTenantConfigForAlias,
} from '@/lib/db';
import {
  combineAutoReplyFromRecords,
  DEFAULT_AUTO_REPLY,
  mergeAutoReplySettings,
  type AutoReplyChannel,
  type AutoReplySettings,
} from '@/lib/cs-auto-reply';

async function readCsBotConfigRecords(
  tenantId: string,
): Promise<Array<Record<string, unknown>>> {
  const aliases = await getTenantEmailAliases(tenantId);
  const records: Array<Record<string, unknown>> = [];

  for (const alias of aliases) {
    const raw = await getTenantConfigForAlias(alias, 'cs_bot_config');
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        records.push(parsed as Record<string, unknown>);
      }
    } catch {
      // Ignore invalid JSON for this alias.
    }
  }

  return records;
}

async function readCanonicalBotConfigRecord(
  tenantId: string,
): Promise<Record<string, unknown> | undefined> {
  const canonical = await resolveCanonicalTenantId(tenantId);
  const raw = await getTenantConfigForAlias(canonical, 'cs_bot_config');
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/** Prefer the richest onboarding config when multiple tenant aliases have rows. */
export async function loadCsBotConfigForUpdate(
  tenantId: string,
): Promise<Record<string, unknown>> {
  const records = await readCsBotConfigRecords(tenantId);
  if (records.length === 0) return {};

  return records.reduce((best, current) => {
    const bestKeys = Object.keys(best).length;
    const currentKeys = Object.keys(current).length;
    if (currentKeys > bestKeys) return current;
    if (
      currentKeys === bestKeys &&
      JSON.stringify(current).length > JSON.stringify(best).length
    ) {
      return current;
    }
    return best;
  }, records[0]);
}

export async function getAutoReplySettings(
  tenantId: string,
): Promise<AutoReplySettings> {
  const records = await readCsBotConfigRecords(tenantId);
  if (records.length === 0) return { ...DEFAULT_AUTO_REPLY };

  const preferredRecord = await readCanonicalBotConfigRecord(tenantId);
  return combineAutoReplyFromRecords(records, preferredRecord);
}

export async function isAutoReplyEnabled(
  tenantId: string,
  channel: AutoReplyChannel,
): Promise<boolean> {
  const settings = await getAutoReplySettings(tenantId);
  return settings[channel];
}

/** Save auto_reply on the canonical config and mirror to other alias rows. */
export async function persistAutoReplySettings(
  tenantId: string,
  auto_reply: AutoReplySettings,
): Promise<void> {
  const botConfig = await loadCsBotConfigForUpdate(tenantId);
  const nextConfig: Record<string, unknown> = { ...botConfig, auto_reply };
  const canonical = await resolveCanonicalTenantId(tenantId);

  await setTenantConfig(tenantId, 'cs_bot_config', JSON.stringify(nextConfig));

  const aliases = await getTenantEmailAliases(tenantId);
  for (const alias of aliases) {
    if (alias === canonical) continue;

    const raw = await getTenantConfigForAlias(alias, 'cs_bot_config');
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') continue;
      await setTenantConfigForAlias(
        alias,
        'cs_bot_config',
        JSON.stringify({ ...(parsed as Record<string, unknown>), auto_reply }),
      );
    } catch {
      // Ignore invalid alias rows.
    }
  }
}

export async function applyAutoReplyPatch(
  tenantId: string,
  patch: Partial<AutoReplySettings>,
): Promise<AutoReplySettings> {
  const auto_reply = mergeAutoReplySettings(
    await getAutoReplySettings(tenantId),
    patch,
  );
  await persistAutoReplySettings(tenantId, auto_reply);
  return auto_reply;
}
