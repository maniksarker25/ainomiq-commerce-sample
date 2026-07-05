import dotenv from 'dotenv';
dotenv.config({ path: '.env.turso' });

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

const MISSION_CONTROL_DATA = '/Users/kaiclaw/.openclaw/workspace/apps/mission-control/data';
const ADS_PIPELINE = '/Users/kaiclaw/.openclaw/workspace/ads-pipeline';

type SqlOperation = {
  table: string;
  label: string;
  sql: string;
  args: Array<string | number | null>;
};

type ImportState = {
  operations: SqlOperation[];
  personaByCode: Map<string, string>;
  campaignRefByMetaId: Map<string, string>;
  batchIds: Set<string>;
};

async function main() {
  const { db } = await import('../lib/db');
  const { ensureAdManagerDb } = await import('../lib/ad-manager/db');
  const dryRun = process.argv.includes('--dry-run');
  const tenantId = getArg('--tenant-id') || process.env.DEFAULT_TENANT_ID || 'demo@ainomiq.com';
  const state: ImportState = {
    operations: [],
    personaByCode: new Map(),
    campaignRefByMetaId: new Map(),
    batchIds: new Set(),
  };

  await collectMissionControlTemplates(tenantId, state);
  await collectMissionControlPersonas(tenantId, state);
  await collectPipelineBrief(tenantId, state);
  await collectPipelineHooks(tenantId, state);
  await collectAssetCatalogProducts(tenantId, state);
  await collectCreativeTracker(tenantId, state);
  await collectRegistries(tenantId, state);
  await collectHistoricalApprovals(tenantId, state);

  printSummary(state, dryRun, tenantId);

  if (dryRun) return;

  await ensureAdManagerDb();
  for (const op of state.operations) {
    await db.execute({ sql: op.sql, args: op.args });
  }
  console.log(`Import completed. Wrote ${state.operations.length} rows for tenant ${tenantId}.`);
}

async function collectMissionControlTemplates(tenantId: string, state: ImportState) {
  for (const folder of ['template-designs', 'video-template-designs']) {
    const dir = path.join(MISSION_CONTROL_DATA, folder);
    const files = await safeReaddir(dir);
    for (const file of files.filter(name => name.endsWith('.json'))) {
      const fullPath = path.join(dir, file);
      const json = await readJson(fullPath);
      if (!json || typeof json !== 'object') continue;
      const sourceId = stringField(json, 'id') || file.replace(/\.json$/, '');
      const id = stableId(tenantId, 'template', folder, sourceId);
      const kind = folder === 'video-template-designs' ? 'video' : 'image';
      add(state, {
        table: 'ad_templates',
        label: `${kind}:${sourceId}`,
        sql: `INSERT INTO ad_templates (id, tenant_id, kind, name, format_support, renderer, design_json, status, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))
              ON CONFLICT(id) DO UPDATE SET name = excluded.name, format_support = excluded.format_support,
                renderer = excluded.renderer, design_json = excluded.design_json, updated_at = datetime('now')`,
        args: [
          id,
          tenantId,
          kind,
          stringField(json, 'name') || sourceId,
          JSON.stringify((json as any).formats || (json as any).format || []),
          kind === 'video' ? 'video_template_design' : 'template_design',
          JSON.stringify(sanitized(json)),
        ],
      });
    }
  }
}

async function collectMissionControlPersonas(tenantId: string, state: ImportState) {
  const data = await readJson(path.join(MISSION_CONTROL_DATA, 'personas.json'));
  const personas = Array.isArray((data as any)?.personas) ? (data as any).personas : [];
  for (const persona of personas) {
    const code = stringField(persona, 'code') || stableCode(stringField(persona, 'name') || stringField(persona, 'id') || 'persona');
    const id = stableId(tenantId, 'persona', code);
    state.personaByCode.set(code, id);
    addPersona(state, tenantId, id, code, stringField(persona, 'name') || code, stringField(persona, 'description') || '', {
      source: 'mission-control/personas.json',
      persona: sanitized(persona),
    });
  }
}

async function collectPipelineBrief(tenantId: string, state: ImportState) {
  const brief = await readJson(path.join(ADS_PIPELINE, 'default_creative_brief.json'));
  const personas = Array.isArray((brief as any)?.personas) ? (brief as any).personas : [];
  for (const raw of personas) {
    const code = String(raw).trim();
    if (!code) continue;
    const id = state.personaByCode.get(code) || stableId(tenantId, 'persona', code);
    state.personaByCode.set(code, id);
    addPersona(state, tenantId, id, code, code.replace(/_/g, ' '), '', {
      source: 'ads-pipeline/default_creative_brief.json',
      brief: sanitized(brief),
    });
  }
}

async function collectPipelineHooks(tenantId: string, state: ImportState) {
  const outputDir = path.join(ADS_PIPELINE, 'output');
  const files = (await safeReaddir(outputDir)).filter(file => /^hooks_.*\.json$/.test(file)).sort();
  for (const file of files) {
    const hooks = await readJson(path.join(outputDir, file));
    if (!hooks || typeof hooks !== 'object' || Array.isArray(hooks)) continue;
    for (const [code, values] of Object.entries(hooks)) {
      const personaId = state.personaByCode.get(code) || stableId(tenantId, 'persona', code);
      state.personaByCode.set(code, personaId);
      addPersona(state, tenantId, personaId, code, code.replace(/_/g, ' '), '', { source: file });
      const hookTexts = Array.isArray(values) ? values : [];
      hookTexts.forEach((text, index) => {
        if (typeof text !== 'string' || !text.trim()) return;
        add(state, {
          table: 'ad_hooks',
          label: `${code}:${index}`,
          sql: `INSERT OR IGNORE INTO ad_hooks (id, tenant_id, persona_id, angle, hook_text, source, status, metadata, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'imported', 'active', ?, datetime('now'), datetime('now'))`,
          args: [
            stableId(tenantId, 'hook', code, text),
            tenantId,
            personaId,
            code,
            text.trim(),
            JSON.stringify({ source: `ads-pipeline/output/${file}`, index }),
          ],
        });
      });
    }
  }
}

async function collectAssetCatalogProducts(tenantId: string, state: ImportState) {
  const catalog = await readJson(path.join(ADS_PIPELINE, 'asset-catalog.json'));
  if (!catalog || typeof catalog !== 'object') return;
  const names = new Set<string>();
  for (const section of ['videos', 'product_photos']) {
    const entries = (catalog as any)[section];
    if (!entries || typeof entries !== 'object') continue;
    Object.keys(entries).forEach(name => names.add(name));
  }
  for (const name of names) {
    add(state, {
      table: 'ad_products',
      label: name,
      sql: `INSERT INTO ad_products (id, tenant_id, source, title, metadata, created_at, updated_at)
            VALUES (?, ?, 'asset_catalog', ?, ?, datetime('now'), datetime('now'))
            ON CONFLICT(id) DO UPDATE SET title = excluded.title, metadata = excluded.metadata, updated_at = datetime('now')`,
      args: [stableId(tenantId, 'product', name), tenantId, name, JSON.stringify({ source: 'ads-pipeline/asset-catalog.json', assets: sanitized((catalog as any)) })],
    });
  }
}

async function collectCreativeTracker(tenantId: string, state: ImportState) {
  const tracker = await readJson(path.join(ADS_PIPELINE, 'creative-tracker.json'));
  if (!tracker || typeof tracker !== 'object') return;

  const batches = Array.isArray((tracker as any).batches) ? (tracker as any).batches : [];
  for (const batch of batches) {
    const sourceId = stringField(batch, 'batch_id') || stableId(tenantId, 'batch', JSON.stringify(batch));
    const id = stableId(tenantId, 'batch', sourceId);
    state.batchIds.add(id);
    add(state, {
      table: 'ad_creative_batches',
      label: sourceId,
      sql: `INSERT INTO ad_creative_batches (id, tenant_id, name, status, persona_ids, generation_params, started_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            ON CONFLICT(id) DO UPDATE SET name = excluded.name, status = excluded.status,
              persona_ids = excluded.persona_ids, generation_params = excluded.generation_params, updated_at = datetime('now')`,
      args: [
        id,
        tenantId,
        sourceId,
        stringField(batch, 'status') || 'imported',
        JSON.stringify((batch as any).personas || []),
        JSON.stringify(sanitized(batch)),
        stringField(batch, 'created') || null,
      ],
    });
  }

  const creatives = (tracker as any).creatives;
  const entries = Array.isArray(creatives) ? creatives.map((value, index) => [String(index), value]) : Object.entries(creatives || {});
  for (const [sourceId, creative] of entries) {
    if (!creative || typeof creative !== 'object') continue;
    const batchSourceId = stringField(creative, 'batch_id') || 'imported-tracker';
    const batchId = stableId(tenantId, 'batch', batchSourceId);
    if (!state.batchIds.has(batchId)) {
      state.batchIds.add(batchId);
      add(state, {
        table: 'ad_creative_batches',
        label: batchSourceId,
        sql: `INSERT OR IGNORE INTO ad_creative_batches (id, tenant_id, name, status, generation_params, created_at, updated_at)
              VALUES (?, ?, ?, 'imported', ?, datetime('now'), datetime('now'))`,
        args: [batchId, tenantId, batchSourceId, JSON.stringify({ source: 'creative-tracker orphan batch' })],
      });
    }
    addCreative(state, tenantId, stableId(tenantId, 'creative', sourceId, JSON.stringify(creative)), batchId, creative, {
      source: 'ads-pipeline/creative-tracker.json',
      source_id: sourceId,
    });
  }

  for (const killed of Array.isArray((tracker as any).killed) ? (tracker as any).killed : []) {
    addRecommendation(state, tenantId, 'ad', stringField(killed, 'id') || null, 'kill_historical', 'warning', stringField(killed, 'name') || 'Historical killed ad', stringField(killed, 'reason') || 'Imported killed status.', killed);
  }
}

async function collectRegistries(tenantId: string, state: ImportState) {
  const adSetRegistry = await readJson(path.join(ADS_PIPELINE, 'ad_set_registry.json'));
  if (adSetRegistry && typeof adSetRegistry === 'object') {
    const campaignId = stringField(adSetRegistry, 'campaign_id');
    if (campaignId) {
      const id = stableId(tenantId, 'campaign', campaignId);
      state.campaignRefByMetaId.set(campaignId, id);
      add(state, {
        table: 'ad_campaign_refs',
        label: campaignId,
        sql: `INSERT INTO ad_campaign_refs (id, tenant_id, meta_campaign_id, name, status, daily_budget_cents, metadata, synced_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
              ON CONFLICT(tenant_id, meta_campaign_id) DO UPDATE SET name = excluded.name, status = excluded.status,
                daily_budget_cents = excluded.daily_budget_cents, metadata = excluded.metadata, synced_at = datetime('now')`,
        args: [
          id,
          tenantId,
          campaignId,
          stringField(adSetRegistry, 'campaign_name') || campaignId,
          stringField(adSetRegistry, 'status') || null,
          Math.round(Number((adSetRegistry as any).daily_budget_eur || 0) * 100),
          JSON.stringify(sanitized(adSetRegistry)),
        ],
      });
      addSnapshot(state, tenantId, 'campaign', campaignId, (adSetRegistry as any).campaign_last_7d_metrics);
    }

    const adSets = (adSetRegistry as any).ad_sets || {};
    for (const [key, adset] of Object.entries(adSets)) {
      const metaAdsetId = stringField(adset, 'ad_set_id') || null;
      add(state, {
        table: 'ad_adset_refs',
        label: key,
        sql: `INSERT INTO ad_adset_refs (id, tenant_id, meta_adset_id, campaign_ref_id, name, budget_cents, status, metadata, synced_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
              ON CONFLICT(tenant_id, meta_adset_id) DO UPDATE SET name = excluded.name, budget_cents = excluded.budget_cents,
                status = excluded.status, metadata = excluded.metadata, synced_at = datetime('now')`,
        args: [
          stableId(tenantId, 'adset', metaAdsetId || key),
          tenantId,
          metaAdsetId,
          campaignId ? state.campaignRefByMetaId.get(campaignId) || null : null,
          stringField(adset, 'name') || key,
          null,
          stringField(adset, 'status') || stringField(adset, 'meta_status') || null,
          JSON.stringify({ key, adset: sanitized(adset) }),
        ],
      });
      addSnapshot(state, tenantId, 'adset', metaAdsetId || key, (adset as any)?.last_7d_metrics);
    }
  }

  const adRegistry = await readJson(path.join(ADS_PIPELINE, 'ad_registry.json'));
  const ads = Array.isArray((adRegistry as any)?.ads) ? (adRegistry as any).ads : [];
  for (const ad of ads) {
    const sourceId = stringField(ad, 'ad_id') || stableId(tenantId, 'registry-ad', JSON.stringify(ad));
    addCreative(state, tenantId, stableId(tenantId, 'creative', 'ad_registry', sourceId), stableId(tenantId, 'batch', 'ad-registry-import'), ad, {
      source: 'ads-pipeline/ad_registry.json',
      campaign_id: stringField(adRegistry, 'campaign'),
    });
  }
}

async function collectHistoricalApprovals(tenantId: string, state: ImportState) {
  const approvals = await readJson(path.join(ADS_PIPELINE, 'ad_approvals.json'));
  if (!approvals || typeof approvals !== 'object' || Array.isArray(approvals)) return;
  for (const [key, approval] of Object.entries(approvals)) {
    add(state, {
      table: 'ad_approvals',
      label: key,
      sql: `INSERT OR IGNORE INTO ad_approvals (id, tenant_id, creative_id, approved_by, approval_scope, approved_payload_json, status, created_at)
            VALUES (?, ?, ?, 'historical_import', 'historical_creative', ?, ?, datetime('now'))`,
      args: [
        stableId(tenantId, 'historical-approval', key),
        tenantId,
        key,
        JSON.stringify({ source: 'ads-pipeline/ad_approvals.json', key, approval: sanitized(approval) }),
        stringField(approval, 'status') || 'approved',
      ],
    });
  }
}

function addPersona(state: ImportState, tenantId: string, id: string, code: string, name: string, description: string, metadata: unknown) {
  add(state, {
    table: 'ad_personas',
    label: code,
    sql: `INSERT INTO ad_personas (id, tenant_id, code, name, description, targeting_rules, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))
          ON CONFLICT(tenant_id, code) DO UPDATE SET name = excluded.name, description = COALESCE(NULLIF(excluded.description, ''), ad_personas.description),
            targeting_rules = excluded.targeting_rules, updated_at = datetime('now')`,
    args: [id, tenantId, code, name, description, JSON.stringify(metadata)],
  });
}

function addCreative(state: ImportState, tenantId: string, id: string, batchId: string, creative: any, metadata: unknown) {
  const mediaPath = stringField(creative, 'local_asset_path') || stringField(creative, 'asset_path') || stringField(creative, 'output') || stringField(creative, 'drive_filename') || stringField(creative, 'source_video');
  const mediaType = /\.(mp4|mov|webm)$/i.test(mediaPath || '') ? 'video' : 'image';
  add(state, {
    table: 'ad_creatives',
    label: id,
    sql: `INSERT INTO ad_creatives (id, tenant_id, batch_id, product_id, format, media_type, local_asset_path, status, qc_status, metadata, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          ON CONFLICT(id) DO UPDATE SET batch_id = excluded.batch_id, product_id = excluded.product_id,
            format = excluded.format, media_type = excluded.media_type, local_asset_path = excluded.local_asset_path,
            status = excluded.status, qc_status = excluded.qc_status, metadata = excluded.metadata, updated_at = datetime('now')`,
    args: [
      id,
      tenantId,
      batchId,
      stringField(creative, 'product') ? stableId(tenantId, 'product', stringField(creative, 'product') as string) : null,
      stringField(creative, 'format') || stringField(creative, 'placement') || 'unknown',
      mediaType,
      mediaPath || null,
      stringField(creative, 'status') || ((creative as any).uploaded ? 'uploaded_historical' : 'generated'),
      stringField(creative, 'qc_status') || null,
      JSON.stringify({ ...metadata as object, creative: sanitized(creative) }),
    ],
  });
}

function addRecommendation(state: ImportState, tenantId: string, entityType: string, entityId: string | null, type: string, severity: string, title: string, reasoning: string, raw: unknown) {
  add(state, {
    table: 'ad_recommendations',
    label: title,
    sql: `INSERT OR IGNORE INTO ad_recommendations (id, tenant_id, entity_type, entity_id, recommendation_type, severity, title, reasoning, suggested_action_json, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', datetime('now'))`,
    args: [stableId(tenantId, 'recommendation', type, entityId || title), tenantId, entityType, entityId, type, severity, title, reasoning, JSON.stringify(sanitized(raw))],
  });
}

function addSnapshot(state: ImportState, tenantId: string, entityType: string, entityId: string, metrics: any) {
  if (!metrics || typeof metrics !== 'object') return;
  add(state, {
    table: 'ad_performance_snapshots',
    label: `${entityType}:${entityId}`,
    sql: `INSERT OR IGNORE INTO ad_performance_snapshots (
            id, tenant_id, entity_type, entity_id, date_preset, spend, impressions, clicks, ctr, cpc, cpm,
            atc, ic, purchases, cpa, roas, raw_json, captured_at
          ) VALUES (?, ?, ?, ?, 'last_7d', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    args: [
      stableId(tenantId, 'snapshot', entityType, entityId, JSON.stringify(metrics)),
      tenantId,
      entityType,
      entityId,
      numberField(metrics, 'spend'),
      numberField(metrics, 'impressions'),
      numberField(metrics, 'clicks') || numberField(metrics, 'inline_link_clicks'),
      numberField(metrics, 'ctr'),
      numberField(metrics, 'cpc'),
      numberField(metrics, 'cpm'),
      numberField(metrics, 'add_to_cart'),
      numberField(metrics, 'initiate_checkout'),
      numberField(metrics, 'purchases'),
      numberField(metrics, 'cpa'),
      numberField(metrics, 'roas'),
      JSON.stringify(sanitized(metrics)),
    ],
  });
}

function add(state: ImportState, operation: SqlOperation) {
  state.operations.push(operation);
}

async function readJson(filePath: string) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

async function safeReaddir(dir: string) {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

function stableId(...parts: string[]) {
  return `imp_${createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 32)}`;
}

function stableCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'PERSONA';
}

function stringField(input: unknown, key: string) {
  if (!input || typeof input !== 'object') return '';
  const value = (input as Record<string, unknown>)[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function numberField(input: unknown, key: string) {
  if (!input || typeof input !== 'object') return 0;
  const value = Number((input as Record<string, unknown>)[key] || 0);
  return Number.isFinite(value) ? value : 0;
}

function sanitized(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitized);
  if (!value || typeof value !== 'object') return value;
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (/token|secret|password|key/i.test(key) && typeof child === 'string' && child.length > 12) {
      result[key] = '[redacted]';
    } else {
      result[key] = sanitized(child);
    }
  }
  return result;
}

function getArg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function printSummary(state: ImportState, dryRun: boolean, tenantId: string) {
  const counts = state.operations.reduce<Record<string, number>>((acc, op) => {
    acc[op.table] = (acc[op.table] || 0) + 1;
    return acc;
  }, {});
  console.log(`${dryRun ? 'Dry run' : 'Import'} for tenant ${tenantId}`);
  for (const [table, count] of Object.entries(counts).sort()) {
    console.log(`${table}: ${count}`);
  }
  console.log(`Total mapped rows: ${state.operations.length}`);
}

main().catch(err => {
  console.error('Import failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
