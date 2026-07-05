/**
 * Remove legacy Meta Ad Library / competitor-inspiration data from Turso.
 *
 * Usage:
 *   node scripts/cleanup-meta-ad-library-data.mjs          # preview only
 *   node scripts/cleanup-meta-ad-library-data.mjs --apply  # delete rows + drop table
 */
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
loadEnvFile('.env.turso');

const apply = process.argv.includes('--apply');
const dbUrl = (process.env.TURSO_DATABASE_URL || 'file:local.db').trim();
const db = createClient({
  url: dbUrl,
  authToken: process.env.TURSO_AUTH_TOKEN?.trim(),
});

const LEGACY_ASSET_WHERE = `
  lower(coalesce(asset_url, '')) LIKE '%facebook.com/ads/library%'
  OR lower(coalesce(thumbnail_url, '')) LIKE '%facebook.com/ads/library%'
  OR lower(coalesce(landing_page_url, '')) LIKE '%facebook.com/ads/library%'
  OR (
    lower(source_type) = 'external'
    AND (
      lower(coalesce(tags, '')) LIKE '%competitor%'
      OR lower(coalesce(tags, '')) LIKE '%inspiration%'
      OR lower(coalesce(tags, '')) LIKE '%meta-library%'
      OR lower(coalesce(tags, '')) LIKE '%meta_library%'
      OR lower(coalesce(tags, '')) LIKE '%ad-library%'
      OR lower(coalesce(tags, '')) LIKE '%ad_library%'
    )
  )
`;

async function tableExists(name) {
  const res = await db.execute({
    sql: `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
    args: [name],
  });
  return res.rows.length > 0;
}

async function countSql(sql, args = []) {
  const res = await db.execute({ sql, args });
  return Number(res.rows[0]?.c || 0);
}

async function previewLegacyAssets() {
  return countSql(`SELECT COUNT(*) AS c FROM creative_library_assets WHERE ${LEGACY_ASSET_WHERE}`);
}

async function main() {
  console.log(`Database: ${dbUrl.replace(/\/\/.*@/, '//***@')}`);
  console.log(`Mode: ${apply ? 'APPLY (destructive)' : 'preview'}\n`);

  const hasInspirationTable = await tableExists('ad_inspiration_brands');
  const inspirationRows = hasInspirationTable
    ? await countSql('SELECT COUNT(*) AS c FROM ad_inspiration_brands')
    : 0;
  const legacyAssets = await previewLegacyAssets();

  console.log('Legacy Meta Ad Library data:');
  console.log(`  ad_inspiration_brands table: ${hasInspirationTable ? 'exists' : 'missing'} (${inspirationRows} rows)`);
  console.log(`  creative_library_assets (legacy reference rows): ${legacyAssets}`);

  if (!apply) {
    console.log('\nNo changes made. Re-run with --apply to delete.');
    return;
  }

  let deletedLegacy = 0;
  if (legacyAssets > 0) {
    const res = await db.execute(`DELETE FROM creative_library_assets WHERE ${LEGACY_ASSET_WHERE}`);
    deletedLegacy = Number(res.rowsAffected || 0);
  }

  if (hasInspirationTable) {
    await db.execute('DROP TABLE IF EXISTS ad_inspiration_brands');
  }

  console.log('\nApplied:');
  console.log(`  deleted legacy reference assets: ${deletedLegacy}`);
  console.log(`  dropped ad_inspiration_brands: ${hasInspirationTable ? 'yes' : 'skipped'}`);

  const remainingLegacy = await previewLegacyAssets();
  const stillHasTable = await tableExists('ad_inspiration_brands');
  console.log('\nPost-cleanup:');
  console.log(`  ad_inspiration_brands: ${stillHasTable ? 'still exists' : 'gone'}`);
  console.log(`  legacy reference assets remaining: ${remainingLegacy}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
