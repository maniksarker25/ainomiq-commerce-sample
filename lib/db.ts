import { createClient, type Client } from '@libsql/client/web';
import { encrypt, decrypt } from './encryption';

type SupabaseRestOptions = {
  method?: string;
  body?: unknown;
  prefer?: string;
};

function getSupabaseRestConfig() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) return null;
  return { url, key };
}

async function supabaseRest<T = any>(path: string, options: SupabaseRestOptions = {}): Promise<T> {
  const config = getSupabaseRestConfig();
  if (!config) throw new Error('Supabase REST is not configured');
  const headers: Record<string, string> = {
    apikey: config.key,
    authorization: `Bearer ${config.key}`,
    'content-type': 'application/json',
  };
  if (options.prefer) headers.prefer = options.prefer;
  const res = await fetch(`${config.url}/rest/v1/${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase REST ${res.status}: ${text.slice(0, 300)}`);
  }
  if (res.status === 204) return null as T;
  const text = await res.text();
  return text ? JSON.parse(text) as T : null as T;
}

function useSupabaseTenantStore() {
  return Boolean(getSupabaseRestConfig());
}

async function getSupabaseTenantConfig(tenantId: string, key: string): Promise<string | null> {
  const rows = await supabaseRest<Array<{ config_value: string }>>(
    `tenant_config?tenant_id=eq.${encodeURIComponent(tenantId)}&config_key=eq.${encodeURIComponent(key)}&select=config_value&limit=1`
  );
  return rows?.[0]?.config_value ?? null;
}

async function setSupabaseTenantConfig(tenantId: string, key: string, value: string) {
  await supabaseRest(
    'tenant_config?on_conflict=tenant_id,config_key',
    {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: [{ tenant_id: tenantId, config_key: key, config_value: value, updated_at: new Date().toISOString() }],
    }
  );
}

let dbClient: Client | null = null;

function getLibsqlClient(): Client {
  if (!dbClient) {
    dbClient = createClient({
      url: (process.env.TURSO_DATABASE_URL || 'file:local.db').trim(),
      authToken: process.env.TURSO_AUTH_TOKEN?.trim(),
    });
  }
  return dbClient;
}

/** Turso/libSQL client. Lazily created so Supabase-only routes avoid opening SQLite. */
export const db = new Proxy({} as Client, {
  get(_target, prop, receiver) {
    const client = getLibsqlClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

let initialized = false;

export async function initDb() {
  if (initialized) return;
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS tenants (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS integrations (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL, provider TEXT NOT NULL, access_token TEXT NOT NULL, refresh_token TEXT, token_expires_at DATETIME, scopes TEXT, provider_account_id TEXT, provider_email TEXT, status TEXT DEFAULT 'active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(tenant_id, provider))`);
    await db.execute(`CREATE TABLE IF NOT EXISTS oauth_states (state TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, provider TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS tenant_config (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL, config_key TEXT NOT NULL, config_value TEXT NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(tenant_id, config_key))`);
    await db.execute(`CREATE TABLE IF NOT EXISTS cs_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL,
      call_sid TEXT NOT NULL UNIQUE,
      from_number TEXT,
      to_number TEXT,
      direction TEXT,
      call_status TEXT,
      duration_sec INTEGER DEFAULT 0,
      recording_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.execute(`CREATE TABLE IF NOT EXISTS cs_call_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL,
      call_sid TEXT NOT NULL,
      speaker TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.execute(`CREATE TABLE IF NOT EXISTS cs_email_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL,
      gmail_message_id TEXT NOT NULL,
      thread_id TEXT,
      from_email TEXT,
      subject TEXT,
      action TEXT NOT NULL,
      ai_reply TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id, gmail_message_id)
    )`);
    await db.execute(`CREATE TABLE IF NOT EXISTS klaviyo_event_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL,
      recipient_email TEXT NOT NULL,
      event_name TEXT NOT NULL,
      fired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      properties TEXT,
      UNIQUE(tenant_id, recipient_email, event_name)
    )`);
    await db.execute(`CREATE TABLE IF NOT EXISTS ig_messages (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      conversation_id TEXT,
      sender_id TEXT NOT NULL,
      sender_username TEXT,
      recipient_id TEXT NOT NULL,
      message_text TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      direction TEXT CHECK(direction IN ('inbound', 'outbound')),
      status TEXT DEFAULT 'unread'
    )`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_ig_messages_tenant_ts ON ig_messages(tenant_id, timestamp DESC)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_ig_messages_tenant_status ON ig_messages(tenant_id, status)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS ig_comments (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      post_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      sender_username TEXT,
      comment_text TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'unread'
    )`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_ig_comments_tenant_ts ON ig_comments(tenant_id, timestamp DESC)`);
    initialized = true;
  } catch (err) {
    console.error('[DB] initDb error:', err);
    // Tables likely already exist, continue
    initialized = true;
  }
}

// OAuth state management (replaces in-memory NodeCache)
export async function createOAuthState(state: string, tenantId: string, provider: string, codeVerifier?: string, returnTo?: string | null) {
  await initDb();
  // Ensure code_verifier column exists
  try { await db.execute({ sql: 'ALTER TABLE oauth_states ADD COLUMN code_verifier TEXT', args: [] }); } catch {}
  try { await db.execute({ sql: 'ALTER TABLE oauth_states ADD COLUMN return_to TEXT', args: [] }); } catch {}
  await db.execute({
    sql: 'INSERT INTO oauth_states (state, tenant_id, provider, code_verifier, return_to) VALUES (?, ?, ?, ?, ?)',
    args: [state, tenantId, provider, codeVerifier || null, returnTo || null],
  });
}

export async function validateOAuthState(state: string): Promise<{ tenantId: string; provider: string; codeVerifier?: string; returnTo?: string } | null> {
  await initDb();
  try { await db.execute({ sql: 'ALTER TABLE oauth_states ADD COLUMN return_to TEXT', args: [] }); } catch {}
  const result = await db.execute({
    sql: "SELECT tenant_id, provider, code_verifier, return_to FROM oauth_states WHERE state = ? AND created_at > datetime('now', '-60 minutes')",
    args: [state],
  });
  if (result.rows.length === 0) return null;
  // Delete used state
  await db.execute({ sql: 'DELETE FROM oauth_states WHERE state = ?', args: [state] });
  return {
    tenantId: result.rows[0].tenant_id as string,
    provider: result.rows[0].provider as string,
    codeVerifier: result.rows[0].code_verifier as string | undefined,
    returnTo: result.rows[0].return_to as string | undefined,
  };
}

// Integration CRUD
export async function upsertIntegration(
  tenantId: string,
  provider: string,
  accessToken: string,
  refreshToken: string | null,
  expiresAt: Date | null,
  scopes: string | null,
  providerAccountId: string | null,
  providerEmail: string | null,
) {
  await initDb();
  const canonicalTenantId = await resolveCanonicalTenantId(tenantId);
  // Encrypt tokens if ENCRYPTION_KEY is available
  const encAccessToken = process.env.ENCRYPTION_KEY ? encrypt(accessToken) : accessToken;
  const encRefreshToken = refreshToken && process.env.ENCRYPTION_KEY ? encrypt(refreshToken) : refreshToken;

  await db.execute({
    sql: `INSERT INTO integrations (tenant_id, provider, access_token, refresh_token, token_expires_at, scopes, provider_account_id, provider_email, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(tenant_id, provider)
          DO UPDATE SET access_token=?, refresh_token=?, token_expires_at=?, scopes=?, provider_account_id=?, provider_email=?, status='active', updated_at=datetime('now')`,
    args: [
      canonicalTenantId, provider, encAccessToken, encRefreshToken, expiresAt?.toISOString() || null, scopes, providerAccountId, providerEmail,
      encAccessToken, encRefreshToken, expiresAt?.toISOString() || null, scopes, providerAccountId, providerEmail,
    ],
  });
}

export async function getIntegration(tenantId: string, provider: string) {
  await initDb();
  const aliases = await getTenantEmailAliases(tenantId);
  for (const alias of aliases) {
    const result = await db.execute({
      sql: 'SELECT * FROM integrations WHERE tenant_id = ? AND provider = ? AND status = ?',
      args: [alias, provider, 'active'],
    });
    if (result.rows.length > 0) {
      const row = { ...result.rows[0] };
      // Decrypt tokens if ENCRYPTION_KEY is available
      if (process.env.ENCRYPTION_KEY) {
        if (row.access_token) row.access_token = decrypt(row.access_token as string);
        if (row.refresh_token) row.refresh_token = decrypt(row.refresh_token as string);
      }
      return row;
    }
  }
  return null;
}

export async function getIntegrationWithAliases(tenantId: string, provider: string) {
  return getIntegration(tenantId, provider);
}

export async function getIntegrations(tenantId: string) {
  await initDb();
  const aliases = await getTenantEmailAliases(tenantId);
  const allIntegrations: any[] = [];
  const seenProviders = new Set<string>();
  for (const alias of aliases) {
    const result = await db.execute({
      sql: 'SELECT provider, provider_email, status, created_at, access_token, token_expires_at, provider_account_id, scopes FROM integrations WHERE tenant_id = ? AND status = ?',
      args: [alias, 'active'],
    });
    for (const row of result.rows) {
      if (!seenProviders.has(row.provider as string)) {
        seenProviders.add(row.provider as string);
        allIntegrations.push(row);
      }
    }
  }
  return allIntegrations;
}

export async function disconnectIntegration(tenantId: string, provider: string) {
  await initDb();
  const aliases = await getTenantEmailAliases(tenantId);
  for (const alias of aliases) {
    await db.execute({
      sql: "UPDATE integrations SET status = 'revoked', updated_at = datetime('now') WHERE tenant_id = ? AND provider = ?",
      args: [alias, provider],
    });
  }
}

export async function updateIntegrationScopes(tenantId: string, provider: string, scopes: string) {
  await initDb();
  const aliases = await getTenantEmailAliases(tenantId);
  for (const alias of aliases) {
    await db.execute({
      sql: "UPDATE integrations SET scopes = ?, updated_at = datetime('now') WHERE tenant_id = ? AND provider = ?",
      args: [scopes, alias, provider],
    });
  }
}

// Tenant management
export async function upsertTenant(id: string, name: string, email: string) {
  await initDb();
  await db.execute({
    sql: 'INSERT OR IGNORE INTO tenants (id, name, email) VALUES (?, ?, ?)',
    args: [id, name, email],
  });
}

/** Resolve tenant that previously connected this Shopify shop (including revoked rows). */
export async function findTenantIdByShopifyShop(shop: string): Promise<string | null> {
  await initDb();
  const result = await db.execute({
    sql: `SELECT tenant_id FROM integrations WHERE provider = ? AND provider_account_id = ?
          ORDER BY updated_at DESC LIMIT 1`,
    args: ['shopify', shop],
  });
  const id = result.rows[0]?.tenant_id
  return id != null ? String(id) : null;
}

export async function getTenantById(id: string): Promise<{ id: string; name: string; email: string } | null> {
  await initDb();
  const result = await db.execute({
    sql: 'SELECT id, name, email FROM tenants WHERE id = ?',
    args: [id],
  });
  if (result.rows.length === 0) return null;
  const row = result.rows[0]
  return {
    id: String(row.id),
    name: String(row.name || ''),
    email: String(row.email || ''),
  }
}

/** Bootstrap tenant after Shopify App Store install (passwordless until merchant sets one). */
export async function insertTenantForShopifyInstall(args: { id: string; name: string; email: string }) {
  await initDb();
  await db.execute({
    sql: 'INSERT INTO tenants (id, name, email, password_hash) VALUES (?, ?, ?, NULL)',
    args: [args.id, args.name, args.email],
  });
  await db.execute({
    sql: `INSERT INTO tenant_config (tenant_id, config_key, config_value, updated_at)
          VALUES (?, 'modules', ?, datetime('now'))`,
    args: [args.id, JSON.stringify([])],
  });
}

// Tenant config
export async function getTenantConfig(tenantId: string, key: string): Promise<string | null> {
  if (useSupabaseTenantStore()) {
    try {
      const aliases = await getTenantEmailAliases(tenantId);
      for (const alias of aliases) {
        const value = await getSupabaseTenantConfig(alias, key);
        if (value !== null) return value;
      }
      return null;
    } catch (err) {
      console.error('[Supabase tenant_config] read failed:', err);
      return null;
    }
  }

  await initDb();
  const aliases = await getTenantEmailAliases(tenantId);
  const placeholders = aliases.map(() => '?').join(',');
  const result = await db.execute({
    sql: `SELECT config_value FROM tenant_config WHERE tenant_id IN (${placeholders}) AND config_key = ? ORDER BY updated_at DESC LIMIT 1`,
    args: [...aliases, key],
  });
  return result.rows.length > 0 ? (result.rows[0].config_value as string) : null;
}

/** Read config for one tenant key without expanding aliases (for merge reads). */
export async function getTenantConfigForAlias(
  tenantId: string,
  key: string,
): Promise<string | null> {
  const normalized = tenantId.trim();
  if (!normalized) return null;
  const lookup = normalized.includes('@') ? normalized.toLowerCase() : normalized;

  if (useSupabaseTenantStore()) {
    try {
      return await getSupabaseTenantConfig(lookup, key);
    } catch (err) {
      console.error('[Supabase tenant_config] alias read failed:', err);
      return null;
    }
  }

  await initDb();
  const result = await db.execute({
    sql: `SELECT config_value FROM tenant_config WHERE tenant_id = ? AND config_key = ? ORDER BY updated_at DESC LIMIT 1`,
    args: [lookup, key],
  });
  return result.rows.length > 0 ? (result.rows[0].config_value as string) : null;
}

/** Write config to an exact tenant key (no canonical rewrite). */
export async function setTenantConfigForAlias(
  tenantId: string,
  key: string,
  value: string,
): Promise<void> {
  const normalized = tenantId.trim();
  if (!normalized) return;
  const lookup = normalized.includes('@') ? normalized.toLowerCase() : normalized;

  if (useSupabaseTenantStore()) {
    await setSupabaseTenantConfig(lookup, key, value);
    return;
  }

  await initDb();
  await db.execute({
    sql: `INSERT INTO tenant_config (tenant_id, config_key, config_value, updated_at) VALUES (?, ?, ?, datetime('now'))
          ON CONFLICT(tenant_id, config_key) DO UPDATE SET config_value=?, updated_at=datetime('now')`,
    args: [lookup, key, value, value],
  });
}

export async function setTenantConfig(tenantId: string, key: string, value: string) {
  if (useSupabaseTenantStore()) {
    const canonicalTenantId = await resolveCanonicalTenantId(tenantId);
    await setSupabaseTenantConfig(canonicalTenantId, key, value);
    return;
  }

  await initDb();
  const canonicalTenantId = await resolveCanonicalTenantId(tenantId);
  await db.execute({
    sql: `INSERT INTO tenant_config (tenant_id, config_key, config_value, updated_at) VALUES (?, ?, ?, datetime('now'))
          ON CONFLICT(tenant_id, config_key) DO UPDATE SET config_value=?, updated_at=datetime('now')`,
    args: [canonicalTenantId, key, value, value],
  });
}

/** Primary tenant key for writes (email when the row exists, else the id passed in). */
export async function resolveCanonicalTenantId(tenantId: string): Promise<string> {
  const normalized = tenantId.trim();
  if (!normalized) return tenantId;

  await initDb();
  const lookup = normalized.includes('@') ? normalized.toLowerCase() : normalized;
  const result = await db.execute({
    sql: 'SELECT id, email FROM tenants WHERE id = ? OR email = ?',
    args: [lookup, lookup],
  });
  if (result.rows.length === 0) return lookup;
  const email = String(result.rows[0].email || '').trim().toLowerCase();
  if (email) return email;
  return String(result.rows[0].id || lookup);
}

export async function getTenantEmailAliases(tenantId: string): Promise<string[]> {
  const normalized = tenantId.trim();
  if (!normalized) return [];

  await initDb();
  const lookup = normalized.includes('@') ? normalized.toLowerCase() : normalized;
  const aliases = new Set<string>([lookup]);
  const result = await db.execute({
    sql: 'SELECT id, email FROM tenants WHERE id = ? OR email = ?',
    args: [lookup, lookup],
  });
  for (const row of result.rows) {
    const id = String(row.id || '').trim();
    const email = String(row.email || '').trim().toLowerCase();
    if (id) aliases.add(id);
    if (email) aliases.add(email);
  }
  return Array.from(aliases);
}

export async function getTenantConfigWithAliases(tenantId: string, key: string): Promise<string | null> {
  const aliases = await getTenantEmailAliases(tenantId);
  for (const alias of aliases) {
    const value = await getTenantConfig(alias, key);
    if (value) return value;
  }
  return null;
}

export async function addTenantModule(tenantId: string, moduleId: string) {
  await initDb();
  const aliases = await getTenantEmailAliases(tenantId);
  for (const alias of aliases) {
    const existing = await getTenantConfig(alias, 'modules');
    let modules: string[];
    try {
      const parsed = existing ? JSON.parse(existing) : [];
      modules = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
      modules = [];
    }
    if (!modules.includes(moduleId)) modules.push(moduleId);
    await setTenantConfig(alias, 'modules', JSON.stringify(modules));
  }
}

export async function deleteTenantConfig(tenantId: string, key: string) {
  await initDb();
  const aliases = await getTenantEmailAliases(tenantId);
  const placeholders = aliases.map(() => '?').join(',');
  await db.execute({
    sql: `DELETE FROM tenant_config WHERE tenant_id IN (${placeholders}) AND config_key = ?`,
    args: [...aliases, key],
  });
}

// Cleanup old states (run periodically)
export async function cleanupStates() {
  await initDb();
  await db.execute("DELETE FROM oauth_states WHERE created_at < datetime('now', '-60 minutes')");
}

export async function getIntegrationsByProviders(providers: string[], expiresWithinDays?: number) {
  await initDb();
  if (providers.length === 0) return [];
  const placeholders = providers.map(() => '?').join(',');
  let sql = `SELECT * FROM integrations WHERE provider IN (${placeholders}) AND status = ?`;
  const args: any[] = [...providers, 'active'];
  if (expiresWithinDays !== undefined) {
    sql += ' AND token_expires_at < datetime(\'now\', ?)';
    args.push(`+${expiresWithinDays} days`);
  }
  const result = await db.execute({ sql, args });
  return result.rows.map(row => {
    // Decrypt tokens if ENCRYPTION_KEY is available
    const decrypted = { ...row };
    if (process.env.ENCRYPTION_KEY) {
      if (decrypted.access_token) decrypted.access_token = decrypt(decrypted.access_token as string);
      if (decrypted.refresh_token) decrypted.refresh_token = decrypt(decrypted.refresh_token as string);
    }
    return decrypted;
  });
}

function normalizePhone(input: string): string {
  return (input || '').replace(/[^\d+]/g, '');
}

export async function findTenantByTwilioNumber(phoneNumber: string): Promise<string | null> {
  await initDb();
  const target = normalizePhone(phoneNumber);
  if (!target) return null;

  const result = await db.execute({
    sql: 'SELECT tenant_id, config_value FROM tenant_config WHERE config_key = ?',
    args: ['cs_twilio_provisioning'],
  });

  for (const row of result.rows) {
    try {
      const config = JSON.parse(String(row.config_value || '{}')) as { phone?: { phoneNumber?: string } };
      const candidate = normalizePhone(config?.phone?.phoneNumber || '');
      if (candidate && candidate === target) return String(row.tenant_id);
    } catch {
      // Skip invalid rows
    }
  }

  return null;
}

export async function upsertCsCall(args: {
  tenantId: string;
  callSid: string;
  fromNumber?: string;
  toNumber?: string;
  direction?: string;
  callStatus?: string;
  durationSec?: number;
  recordingUrl?: string;
}) {
  await initDb();
  const canonicalTenantId = await resolveCanonicalTenantId(args.tenantId);
  await db.execute({
    sql: `INSERT INTO cs_calls (tenant_id, call_sid, from_number, to_number, direction, call_status, duration_sec, recording_url, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(call_sid) DO UPDATE SET
            call_status=excluded.call_status,
            duration_sec=excluded.duration_sec,
            recording_url=COALESCE(excluded.recording_url, cs_calls.recording_url),
            updated_at=datetime('now')`,
    args: [
      canonicalTenantId,
      args.callSid,
      args.fromNumber || null,
      args.toNumber || null,
      args.direction || null,
      args.callStatus || null,
      args.durationSec || 0,
      args.recordingUrl || null,
    ],
  });
}

export async function countCsCalls(tenantId: string, days: number): Promise<number> {
  await initDb();
  const aliases = await getTenantEmailAliases(tenantId);
  const placeholders = aliases.map(() => '?').join(',');
  const result = await db.execute({
    sql: `SELECT COUNT(*) as c FROM cs_calls WHERE tenant_id IN (${placeholders}) AND created_at >= datetime('now', ?)`,
    args: [...aliases, `-${Math.max(days, 1)} days`],
  });
  const val = Number(result.rows?.[0]?.c || 0);
  return Number.isFinite(val) ? val : 0;
}

export async function addCsCallEvent(args: {
  tenantId: string;
  callSid: string;
  speaker: 'caller' | 'agent' | 'system';
  message: string;
}) {
  await initDb();
  const message = (args.message || '').trim();
  if (!message) return;
  const canonicalTenantId = await resolveCanonicalTenantId(args.tenantId);

  await db.execute({
    sql: `INSERT INTO cs_call_events (tenant_id, call_sid, speaker, message, created_at)
          VALUES (?, ?, ?, ?, datetime('now'))`,
    args: [canonicalTenantId, args.callSid, args.speaker, message],
  });
}

export async function getCsCalls(tenantId: string, days: number) {
  await initDb();
  const aliases = await getTenantEmailAliases(tenantId);
  const placeholders = aliases.map(() => '?').join(',');
  const result = await db.execute({
    sql: `SELECT call_sid, from_number, to_number, direction, call_status, duration_sec, recording_url, created_at
          FROM cs_calls
          WHERE tenant_id IN (${placeholders}) AND created_at >= datetime('now', ?)
          ORDER BY created_at DESC
          LIMIT 100`,
    args: [...aliases, `-${Math.max(days, 1)} days`],
  });
  return result.rows;
}

export async function getCsCallTranscript(tenantId: string, callSid: string) {
  await initDb();
  const aliases = await getTenantEmailAliases(tenantId);
  const placeholders = aliases.map(() => '?').join(',');
  const result = await db.execute({
    sql: `SELECT speaker, message, created_at
          FROM cs_call_events
          WHERE tenant_id IN (${placeholders}) AND call_sid = ?
          ORDER BY id ASC`,
    args: [...aliases, callSid],
  });
  return result.rows;
}

export async function findTenantByShopifyShop(shopDomain: string): Promise<string | null> {
  await initDb();
  const shop = (shopDomain || '').trim().toLowerCase();
  if (!shop) return null;

  const result = await db.execute({
    sql: `SELECT tenant_id
          FROM integrations
          WHERE provider = ? AND status = ? AND lower(provider_account_id) = ?
          ORDER BY updated_at DESC
          LIMIT 1`,
    args: ['shopify', 'active', shop],
  });

  return result.rows.length > 0 ? String(result.rows[0].tenant_id) : null;
}

export async function getLatestCallerName(tenantId: string, callSid: string): Promise<string | null> {
  await initDb();
  const aliases = await getTenantEmailAliases(tenantId);
  const placeholders = aliases.map(() => '?').join(',');
  const result = await db.execute({
    sql: `SELECT message
          FROM cs_call_events
          WHERE tenant_id IN (${placeholders}) AND call_sid = ? AND speaker = 'system' AND message LIKE 'customer_name:%'
          ORDER BY id DESC
          LIMIT 1`,
    args: [...aliases, callSid],
  });

  if (!result.rows.length) return null;
  const raw = String(result.rows[0].message || '');
  const name = raw.replace(/^customer_name:\s*/i, '').trim();
  return name || null;
}

// ─── Content Studio scheduled publishing ─────────────────────────

export async function getContentPublishingTenants(): Promise<string[]> {
  const CONFIG_KEY = 'content_pipeline_config';

  if (useSupabaseTenantStore()) {
    try {
      const rows = await supabaseRest<Array<{ tenant_id: string; config_value: string }>>(
        `tenant_config?config_key=eq.${CONFIG_KEY}&select=tenant_id,config_value`,
      );
      return rows
        .filter((row) => {
          try {
            const parsed = JSON.parse(String(row.config_value || '{}')) as {
              publishing_enabled?: boolean;
              publish_platforms?: unknown[];
            };
            if (parsed.publishing_enabled === false) return false;
            return Array.isArray(parsed.publish_platforms) && parsed.publish_platforms.length > 0;
          } catch {
            return false;
          }
        })
        .map((row) => String(row.tenant_id));
    } catch (err) {
      console.error('[Supabase tenant_config] content publishing tenant read failed:', err);
    }
  }

  await initDb();
  const result = await db.execute({
    sql: 'SELECT tenant_id, config_value FROM tenant_config WHERE config_key = ?',
    args: [CONFIG_KEY],
  });

  const tenants: string[] = [];
  for (const row of result.rows) {
    try {
      const parsed = JSON.parse(String(row.config_value || '{}')) as {
        publishing_enabled?: boolean;
        publish_platforms?: unknown[];
      };
      if (parsed.publishing_enabled === false) continue;
      if (!Array.isArray(parsed.publish_platforms) || parsed.publish_platforms.length === 0) continue;
      tenants.push(String(row.tenant_id));
    } catch {
      // skip invalid config rows
    }
  }
  return tenants;
}

// ─── CS Email Automation ─────────────────────────────────────────

export async function getCsEnabledTenants(): Promise<string[]> {
  if (useSupabaseTenantStore()) {
    try {
      const rows = await supabaseRest<Array<{ tenant_id: string }>>(
        'tenant_config?config_key=eq.cs_onboarding_completed&config_value=eq.true&select=tenant_id'
      );
      return rows.map(r => String(r.tenant_id));
    } catch (err) {
      console.error('[Supabase tenant_config] enabled tenant read failed:', err);
    }
  }

  await initDb();
  const result = await db.execute({
    sql: "SELECT tenant_id FROM tenant_config WHERE config_key = 'cs_onboarding_completed' AND config_value = 'true'",
    args: [],
  });
  return result.rows.map(r => String(r.tenant_id));
}

export async function getCsLastProcessedTime(tenantId: string): Promise<string | null> {
  await initDb();
  const result = await db.execute({
    sql: "SELECT config_value FROM tenant_config WHERE tenant_id = ? AND config_key = 'cs_email_last_processed'",
    args: [tenantId],
  });
  return result.rows.length > 0 ? String(result.rows[0].config_value) : null;
}

export async function setCsLastProcessedTime(tenantId: string, isoTime: string) {
  await setTenantConfig(tenantId, 'cs_email_last_processed', isoTime);
}

export async function isCsEmailProcessed(tenantId: string, messageId: string): Promise<boolean> {
  if (useSupabaseTenantStore()) {
    try {
      const aliases = await getTenantEmailAliases(tenantId);
      for (const alias of aliases) {
        const rows = await supabaseRest<Array<{ id: number }>>(
          `cs_email_log?tenant_id=eq.${encodeURIComponent(alias)}&gmail_message_id=eq.${encodeURIComponent(messageId)}&select=id&limit=1`
        );
        if (rows.length > 0) return true;
      }
    } catch (err) {
      console.error('[Supabase cs_email_log] processed check failed:', err);
    }
  }

  await initDb();
  const aliases = await getTenantEmailAliases(tenantId);
  const placeholders = aliases.map(() => '?').join(',');
  const result = await db.execute({
    sql: `SELECT 1 FROM cs_email_log WHERE tenant_id IN (${placeholders}) AND gmail_message_id = ? LIMIT 1`,
    args: [...aliases, messageId],
  });
  return result.rows.length > 0;
}

export async function logCsEmail(args: {
  tenantId: string;
  gmailMessageId: string;
  threadId: string;
  fromEmail: string;
  subject: string;
  action: 'auto_replied' | 'escalated' | 'skipped';
  aiReply?: string;
}) {
  await initDb();
  const canonicalTenantId = await resolveCanonicalTenantId(args.tenantId);
  await db.execute({
    sql: `INSERT INTO cs_email_log (tenant_id, gmail_message_id, thread_id, from_email, subject, action, ai_reply, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    args: [canonicalTenantId, args.gmailMessageId, args.threadId, args.fromEmail, args.subject, args.action, args.aiReply || null],
  });

  if (useSupabaseTenantStore()) {
    await supabaseRest('cs_email_log?on_conflict=tenant_id,gmail_message_id', {
      method: 'POST',
      prefer: 'resolution=ignore-duplicates,return=minimal',
      body: [{
        tenant_id: canonicalTenantId,
        gmail_message_id: args.gmailMessageId,
        thread_id: args.threadId || null,
        from_email: args.fromEmail || null,
        subject: args.subject || null,
        action: args.action,
        ai_reply: args.aiReply || null,
      }],
    });
  }
}

// ─── Klaviyo Event Duplicate Guard ──────────────────────────────

export async function hasRecentEvent(
  tenantId: string,
  email: string,
  eventName: string,
  cooldownHours: number,
): Promise<boolean> {
  await initDb();
  const aliases = await getTenantEmailAliases(tenantId);
  const placeholders = aliases.map(() => '?').join(',');
  const result = await db.execute({
    sql: `SELECT 1 FROM klaviyo_event_log
          WHERE tenant_id IN (${placeholders}) AND recipient_email = ? AND event_name = ?
            AND fired_at > datetime('now', ?)
          LIMIT 1`,
    args: [...aliases, email, eventName, `-${cooldownHours} hours`],
  });
  return result.rows.length > 0;
}

export async function logKlaviyoEvent(
  tenantId: string,
  email: string,
  eventName: string,
  properties?: string,
): Promise<void> {
  await initDb();
  const canonicalTenantId = await resolveCanonicalTenantId(tenantId);
  await db.execute({
    sql: `INSERT INTO klaviyo_event_log (tenant_id, recipient_email, event_name, fired_at, properties)
          VALUES (?, ?, ?, datetime('now'), ?)
          ON CONFLICT(tenant_id, recipient_email, event_name)
          DO UPDATE SET fired_at = datetime('now'), properties = excluded.properties`,
    args: [canonicalTenantId, email, eventName, properties || null],
  });
}

// ─── Instagram webhook persistence ───────────────────────────────

export type IgMessageRow = {
  id: string;
  tenant_id: string;
  conversation_id: string | null;
  sender_id: string;
  sender_username: string | null;
  recipient_id: string;
  message_text: string | null;
  timestamp: string;
  direction: 'inbound' | 'outbound';
  status: string;
};

export async function upsertIgMessage(row: {
  id: string;
  tenantId: string;
  conversationId?: string | null;
  senderId: string;
  senderUsername?: string | null;
  recipientId: string;
  messageText?: string | null;
  direction: 'inbound' | 'outbound';
  status?: string;
  timestamp?: string;
}): Promise<void> {
  await initDb();
  const canonicalTenantId = await resolveCanonicalTenantId(row.tenantId);
  await db.execute({
    sql: `INSERT INTO ig_messages (id, tenant_id, conversation_id, sender_id, sender_username, recipient_id, message_text, timestamp, direction, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), ?, COALESCE(?, 'unread'))
          ON CONFLICT(id) DO UPDATE SET
            message_text = excluded.message_text,
            status = excluded.status,
            timestamp = excluded.timestamp`,
    args: [
      row.id,
      canonicalTenantId,
      row.conversationId || null,
      row.senderId,
      row.senderUsername || null,
      row.recipientId,
      row.messageText || null,
      row.timestamp || null,
      row.direction,
      row.status || null,
    ],
  });
}

export async function upsertIgComment(row: {
  id: string;
  tenantId: string;
  postId: string;
  senderId: string;
  senderUsername?: string | null;
  commentText?: string | null;
  status?: string;
  timestamp?: string;
}): Promise<void> {
  await initDb();
  const canonicalTenantId = await resolveCanonicalTenantId(row.tenantId);
  await db.execute({
    sql: `INSERT INTO ig_comments (id, tenant_id, post_id, sender_id, sender_username, comment_text, timestamp, status)
          VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), COALESCE(?, 'unread'))
          ON CONFLICT(id) DO UPDATE SET
            comment_text = excluded.comment_text,
            status = excluded.status`,
    args: [
      row.id,
      canonicalTenantId,
      row.postId,
      row.senderId,
      row.senderUsername || null,
      row.commentText || null,
      row.timestamp || null,
      row.status || null,
    ],
  });
}

export async function findTenantIdByMetaPageId(pageId: string): Promise<string | null> {
  await initDb();
  const id = String(pageId || '').trim();
  if (!id) return null;

  const facebook = await db.execute({
    sql: `SELECT tenant_id FROM integrations
          WHERE provider = 'facebook' AND status = 'active' AND provider_account_id = ?
          ORDER BY updated_at DESC LIMIT 1`,
    args: [id],
  });
  if (facebook.rows.length > 0) return String(facebook.rows[0].tenant_id);

  const instagram = await db.execute({
    sql: `SELECT tenant_id FROM integrations
          WHERE provider = 'instagram' AND status = 'active'
            AND (provider_account_id LIKE ? OR provider_account_id = ?)
          ORDER BY updated_at DESC LIMIT 1`,
    args: [`${id}|%`, id],
  });
  if (instagram.rows.length > 0) return String(instagram.rows[0].tenant_id);

  return null;
}

export async function findTenantIdByIgAccountId(igAccountId: string): Promise<string | null> {
  await initDb();
  const id = String(igAccountId || '').trim();
  if (!id) return null;

  const exact = await db.execute({
    sql: `SELECT tenant_id FROM integrations
          WHERE provider = 'instagram' AND status = 'active'
            AND (provider_account_id = ? OR provider_account_id LIKE ?)
          ORDER BY updated_at DESC LIMIT 1`,
    args: [id, `%|${id}`],
  });
  if (exact.rows.length > 0) return String(exact.rows[0].tenant_id);

  return null;
}

export async function getRecentIgMessagesForTenant(
  tenantId: string,
  limit = 50,
): Promise<IgMessageRow[]> {
  await initDb();
  const aliases = await getTenantEmailAliases(tenantId);
  const placeholders = aliases.map(() => '?').join(',');
  const result = await db.execute({
    sql: `SELECT id, tenant_id, conversation_id, sender_id, sender_username, recipient_id, message_text, timestamp, direction, status
          FROM ig_messages
          WHERE tenant_id IN (${placeholders})
          ORDER BY timestamp DESC
          LIMIT ?`,
    args: [...aliases, limit],
  });
  return result.rows.map(r => ({
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    conversation_id: r.conversation_id != null ? String(r.conversation_id) : null,
    sender_id: String(r.sender_id),
    sender_username: r.sender_username != null ? String(r.sender_username) : null,
    recipient_id: String(r.recipient_id),
    message_text: r.message_text != null ? String(r.message_text) : null,
    timestamp: String(r.timestamp),
    direction: String(r.direction) as 'inbound' | 'outbound',
    status: String(r.status),
  }));
}

export async function getRecentIgConversationHints(
  tenantId: string,
  limit = 30,
): Promise<Array<{ conversationKey: string; lastMessage: string; updatedTime: string; senderId: string }>> {
  const rows = await getRecentIgMessagesForTenant(tenantId, limit * 3);
  const byKey = new Map<string, { lastMessage: string; updatedTime: string; senderId: string }>();

  for (const row of rows) {
    const peerId = row.direction === 'inbound' ? row.sender_id : row.recipient_id;
    const key = row.conversation_id || `peer:${peerId}`;
    const existing = byKey.get(key);
    if (!existing || row.timestamp > existing.updatedTime) {
      byKey.set(key, {
        lastMessage: row.message_text || '',
        updatedTime: row.timestamp,
        senderId: peerId,
      });
    }
    if (byKey.size >= limit) break;
  }

  return Array.from(byKey.entries()).map(([conversationKey, v]) => ({
    conversationKey,
    ...v,
  }));
}

// ─── Tenant data purge (account deletion, Meta data-deletion callback) ───

export const META_FACEBOOK_USER_ID_KEY = 'meta_facebook_user_id';

const TENANT_SQL_TABLES = [
  'ig_messages',
  'ig_comments',
  'cs_call_events',
  'cs_calls',
  'cs_email_log',
  'klaviyo_event_log',
  'integrations',
  'tenant_config',
  'oauth_states',
  'change_requests',
  'ad_products',
  'ad_personas',
  'ad_hooks',
  'ad_templates',
  'ad_creative_batches',
  'ad_creatives',
  'ad_creative_versions',
  'ad_qc_events',
  'ad_copy_variants',
  'ad_destinations',
  'ad_campaign_refs',
  'ad_adset_refs',
  'adset_plans',
  'ad_approvals',
  'ad_publish_jobs',
  'ad_publish_items',
  'ad_performance_snapshots',
  'ad_recommendations',
  'creative_library_assets',
  'ad_inspiration_brands',
  'ad_audit_log',
  'creative_os_state',
  'creative_os_invites',
] as const;

async function deleteSupabaseRowsForAliases(table: string, aliases: string[]) {
  if (!useSupabaseTenantStore()) return;
  for (const alias of aliases) {
    try {
      await supabaseRest(
        `${table}?tenant_id=eq.${encodeURIComponent(alias)}`,
        { method: 'DELETE' },
      );
    } catch (err) {
      console.error(`[Supabase] DELETE ${table} for ${alias}:`, err);
    }
  }
}

async function deleteSqliteRowsForAliases(table: string, aliases: string[]) {
  if (aliases.length === 0) return;
  const placeholders = aliases.map(() => '?').join(',');
  await db
    .execute({
      sql: `DELETE FROM ${table} WHERE tenant_id IN (${placeholders})`,
      args: aliases,
    })
    .catch(() => {});
}

export async function storeMetaFacebookUserId(
  tenantId: string,
  facebookUserId: string,
) {
  const id = String(facebookUserId || '').trim();
  if (!id) return;
  await setTenantConfig(tenantId, META_FACEBOOK_USER_ID_KEY, id);
}

export async function findTenantIdsByMetaFacebookUserId(
  facebookUserId: string,
): Promise<string[]> {
  const userId = String(facebookUserId || '').trim();
  if (!userId) return [];

  await initDb();
  const found = new Set<string>();

  if (useSupabaseTenantStore()) {
    try {
      const rows = await supabaseRest<Array<{ tenant_id: string }>>(
        `tenant_config?config_key=eq.${encodeURIComponent(META_FACEBOOK_USER_ID_KEY)}&config_value=eq.${encodeURIComponent(userId)}&select=tenant_id`,
      );
      for (const row of rows || []) {
        if (row.tenant_id) found.add(String(row.tenant_id));
      }
    } catch (err) {
      console.error('[Supabase] meta facebook user lookup failed:', err);
    }
  }

  const result = await db.execute({
    sql: `SELECT DISTINCT tenant_id FROM tenant_config WHERE config_key = ? AND config_value = ?`,
    args: [META_FACEBOOK_USER_ID_KEY, userId],
  });
  for (const row of result.rows) {
    if (row.tenant_id) found.add(String(row.tenant_id));
  }

  return Array.from(found);
}

export async function revokeMetaAccess(tenantId: string) {
  try {
    await initDb();
    const aliases = await getTenantEmailAliases(tenantId);
    let accessToken: string | null = null;

    for (const alias of aliases) {
      for (const provider of ['meta', 'facebook', 'instagram']) {
        const result = await db.execute({
          sql: `SELECT access_token FROM integrations
                WHERE tenant_id = ? AND provider = ? AND access_token IS NOT NULL AND access_token != ''
                ORDER BY updated_at DESC LIMIT 1`,
          args: [alias, provider],
        });
        const raw = result.rows[0]?.access_token;
        if (!raw) continue;
        accessToken =
          process.env.ENCRYPTION_KEY && typeof raw === 'string'
            ? decrypt(raw as string)
            : (raw as string);
        break;
      }
      if (accessToken) break;
    }

    if (!accessToken) return;

    const url = `https://graph.facebook.com/v21.0/me/permissions?access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url, { method: 'DELETE', cache: 'no-store' });
    const data = await res.json().catch(() => null);
    console.log('[Meta Revoke] DELETE /me/permissions:', data);
  } catch (err) {
    console.error('[Meta Revoke] Failed:', err);
  }
}

export async function purgeMetaCachedData(tenantId: string) {
  await initDb();
  const aliases = await getTenantEmailAliases(tenantId);
  await Promise.all([
    deleteSqliteRowsForAliases('ig_messages', aliases),
    deleteSqliteRowsForAliases('ig_comments', aliases),
  ]);
}

/** Remove Meta integrations and cached social data (Meta data-deletion callback). */
export async function purgeMetaUserData(tenantId: string) {
  await revokeMetaAccess(tenantId);
  await purgeMetaCachedData(tenantId);
  await Promise.all([
    disconnectIntegration(tenantId, 'meta'),
    disconnectIntegration(tenantId, 'facebook'),
    disconnectIntegration(tenantId, 'instagram'),
  ]);
}

/** Permanently delete all tenant-owned data from SQLite, Supabase, and tenants row. */
export async function deleteAllTenantData(tenantId: string) {
  await initDb();
  const aliases = await getTenantEmailAliases(tenantId);
  if (aliases.length === 0) return;

  await revokeMetaAccess(tenantId);

  for (const table of TENANT_SQL_TABLES) {
    await deleteSqliteRowsForAliases(table, aliases);
  }

  if (useSupabaseTenantStore()) {
    await deleteSupabaseRowsForAliases('tenant_config', aliases);
    await deleteSupabaseRowsForAliases('cs_email_log', aliases);
  }

  const placeholders = aliases.map(() => '?').join(',');
  await db.execute({
    sql: `DELETE FROM tenants WHERE id IN (${placeholders}) OR email IN (${placeholders})`,
    args: [...aliases, ...aliases],
  });
}
