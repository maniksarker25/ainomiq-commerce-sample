/**
 * One-time migration: re-encrypt legacy plaintext integration tokens.
 *
 * After the encryption hardening (lib/encryption.ts no longer reads plaintext
 * silently), any rows in `integrations` whose access_token / refresh_token were
 * stored in plaintext must be encrypted with the current ENCRYPTION_KEY.
 *
 * Usage:
 *   npx tsx scripts/migrate-encrypt-tokens.ts --dry-run   # report only
 *   npx tsx scripts/migrate-encrypt-tokens.ts             # apply
 *
 * Requires TURSO_DATABASE_URL, TURSO_AUTH_TOKEN and ENCRYPTION_KEY in the env.
 * Safe to run multiple times: already-encrypted values are skipped.
 */
import { createClient } from "@libsql/client";
import { encrypt, isCiphertext } from "../lib/encryption";

const url = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
if (!url) {
  console.error("TURSO_DATABASE_URL is not set.");
  process.exit(1);
}
if (!process.env.ENCRYPTION_KEY) {
  console.error("ENCRYPTION_KEY is not set.");
  process.exit(1);
}
const db = createClient({ url, authToken });
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const res = await db.execute(
    "SELECT id, access_token, refresh_token FROM integrations"
  );
  let encrypted = 0;
  let skipped = 0;

  for (const row of res.rows) {
    const id = row.id;
    const access = row.access_token as string | null;
    const refresh = row.refresh_token as string | null;

    const newAccess = access && !isCiphertext(access) ? encrypt(access) : null;
    const newRefresh = refresh && !isCiphertext(refresh) ? encrypt(refresh) : null;

    if (!newAccess && !newRefresh) {
      skipped++;
      continue;
    }

    console.log(
      `${dryRun ? "[dry-run] would encrypt" : "encrypting"} integration id=${id}` +
        `${newAccess ? " access_token" : ""}${newRefresh ? " refresh_token" : ""}`
    );

    if (!dryRun) {
      await db.execute({
        sql: "UPDATE integrations SET access_token = COALESCE(?, access_token), refresh_token = COALESCE(?, refresh_token) WHERE id = ?",
        args: [newAccess, newRefresh, id],
      });
    }
    encrypted++;
  }

  console.log(
    `\n${dryRun ? "Dry run complete" : "Migration complete"}: ${encrypted} row(s) ${dryRun ? "to encrypt" : "encrypted"}, ${skipped} already-encrypted/empty.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
