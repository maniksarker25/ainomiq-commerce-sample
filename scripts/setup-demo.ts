// Setup script for demo tenant (info@ainomiq.com)
// Sets password, configures all modules, removes existing integrations
// Run with: npx tsx scripts/setup-demo.ts

import { createClient } from '@libsql/client';
import crypto from 'crypto';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load env from .env.local
config({ path: resolve(import.meta.dirname, '../.env.local') });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!.trim(),
  authToken: process.env.TURSO_AUTH_TOKEN?.trim(),
});

const DEMO_EMAIL = 'info@ainomiq.com';
const DEMO_PASSWORD = 'ainomiq2026';
const ALL_MODULES = ['stock', 'cs', 'ads', 'email', 'performance', 'analytics', 'automations'];

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  console.log('Setting up demo tenant...');

  // 1. Check tenant exists
  const tenant = await db.execute({
    sql: 'SELECT id, name, email, password_hash FROM tenants WHERE email = ?',
    args: [DEMO_EMAIL],
  });

  if (tenant.rows.length === 0) {
    console.error('Tenant not found:', DEMO_EMAIL);
    process.exit(1);
  }

  const tenantId = tenant.rows[0].id as string;
  console.log('Found tenant:', tenantId, tenant.rows[0].name);

  // 2. Set password
  const passwordHash = hashPassword(DEMO_PASSWORD);
  await db.execute({
    sql: 'UPDATE tenants SET password_hash = ? WHERE email = ?',
    args: [passwordHash, DEMO_EMAIL],
  });
  console.log('Password set for', DEMO_EMAIL);

  // 3. Set modules config (all modules)
  await db.execute({
    sql: `INSERT INTO tenant_config (tenant_id, config_key, config_value)
          VALUES (?, 'modules', ?)
          ON CONFLICT(tenant_id, config_key) DO UPDATE SET config_value = excluded.config_value`,
    args: [DEMO_EMAIL, JSON.stringify(ALL_MODULES)],
  });
  console.log('Modules set:', ALL_MODULES.join(', '));

  // 4. Remove all existing integrations so everything starts disconnected
  const integrations = await db.execute({
    sql: 'SELECT provider, status FROM integrations WHERE tenant_id = ?',
    args: [DEMO_EMAIL],
  });
  console.log('Current integrations:', integrations.rows.map(r => `${r.provider} (${r.status})`).join(', ') || 'none');

  if (integrations.rows.length > 0) {
    await db.execute({
      sql: 'DELETE FROM integrations WHERE tenant_id = ?',
      args: [DEMO_EMAIL],
    });
    console.log('Removed all existing integrations');
  }

  // Also check by UUID
  const integrations2 = await db.execute({
    sql: 'SELECT provider, status FROM integrations WHERE tenant_id = ?',
    args: [tenantId],
  });
  if (integrations2.rows.length > 0) {
    await db.execute({
      sql: 'DELETE FROM integrations WHERE tenant_id = ?',
      args: [tenantId],
    });
    console.log('Removed integrations by UUID');
  }

  // 5. Verify
  const verify = await db.execute({
    sql: 'SELECT password_hash FROM tenants WHERE email = ?',
    args: [DEMO_EMAIL],
  });
  console.log('Password hash set:', verify.rows[0].password_hash ? 'YES' : 'NO');

  const verifyConfig = await db.execute({
    sql: "SELECT config_value FROM tenant_config WHERE tenant_id = ? AND config_key = 'modules'",
    args: [DEMO_EMAIL],
  });
  console.log('Modules config:', verifyConfig.rows[0]?.config_value);

  const verifyInt = await db.execute({
    sql: 'SELECT COUNT(*) as count FROM integrations WHERE tenant_id = ? OR tenant_id = ?',
    args: [DEMO_EMAIL, tenantId],
  });
  console.log('Remaining integrations:', verifyInt.rows[0].count);

  console.log('\nDone! Demo tenant ready.');
  console.log(`Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main().catch(console.error);
