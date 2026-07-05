/**
 * Minimal forward-only SQL migration runner for libSQL/Turso.
 *
 * Usage:
 *   npx tsx scripts/migrate.ts          # apply all pending migrations
 *   npx tsx scripts/migrate.ts --status # show applied vs pending
 *
 * Migrations live in db/migrations/*.sql and are applied in filename order.
 * Each file runs once; applied filenames are tracked in the _migrations table.
 * Statements are split on ";" at line ends — keep one statement per line group.
 */
import { createClient } from "@libsql/client";
import { readdirSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "db", "migrations");

const url = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
if (!url) {
  console.error("TURSO_DATABASE_URL is not set.");
  process.exit(1);
}
const db = createClient({ url, authToken });

async function appliedSet(): Promise<Set<string>> {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)`
  );
  const res = await db.execute("SELECT name FROM _migrations");
  return new Set(res.rows.map((r) => String(r.name)));
}

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

async function main() {
  const statusOnly = process.argv.includes("--status");
  const applied = await appliedSet();
  const files = migrationFiles();

  if (statusOnly) {
    for (const f of files) {
      console.log(`${applied.has(f) ? "✓ applied" : "• pending"}  ${f}`);
    }
    return;
  }

  const pending = files.filter((f) => !applied.has(f));
  if (pending.length === 0) {
    console.log("No pending migrations.");
    return;
  }

  for (const f of pending) {
    const sql = readFileSync(join(MIGRATIONS_DIR, f), "utf8");
    const statements = sql
      .split(/;\s*$/m)
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith("--"));
    console.log(`Applying ${f} (${statements.length} statements)...`);
    for (const stmt of statements) {
      await db.execute(stmt);
    }
    await db.execute({ sql: "INSERT INTO _migrations (name) VALUES (?)", args: [f] });
    console.log(`  ✓ ${f}`);
  }
  console.log(`Done. Applied ${pending.length} migration(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
