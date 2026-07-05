import { createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvFile(name) {
  try {
    const content = readFileSync(resolve(process.cwd(), name), 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {}
}

loadEnvFile('.env');
loadEnvFile('.env.local');

const db = createClient({
  url: (process.env.TURSO_DATABASE_URL || 'file:local.db').trim(),
  authToken: process.env.TURSO_AUTH_TOKEN?.trim(),
});

async function run() {
  try {
    const res = await db.execute("SELECT provider, tenant_id, provider_account_id, provider_email, scopes, status, updated_at FROM integrations;");
    console.log("INTEGRATIONS:");
    console.log(JSON.stringify(res.rows, null, 2));

    const tenants = await db.execute("SELECT id, email, name FROM tenants;");
    console.log("TENANTS:");
    console.log(JSON.stringify(tenants.rows, null, 2));

    const messages = await db.execute("SELECT * FROM ig_messages ORDER BY timestamp DESC LIMIT 5;");
    console.log("RECENT IG MESSAGES:");
    console.log(JSON.stringify(messages.rows, null, 2));
    
    const states = await db.execute("SELECT * FROM oauth_states ORDER BY created_at DESC LIMIT 5;");
    console.log("RECENT OAUTH STATES:");
    console.log(JSON.stringify(states.rows, null, 2));
  } catch (err) {
    console.error(err);
  }
}

run();
