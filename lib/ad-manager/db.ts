import { randomUUID } from 'crypto';
import { db, getIntegration, initDb } from '@/lib/db';
import { assertAllowedReferenceAssetInput, isExcludedReferenceAsset } from './excluded-reference-assets';
import { initAdManagerDb } from './schema';
import { validateCopyVariant, validatePublishGate } from './guardrails';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type BatchInput = {
  name: string;
  productId?: string | null;
  status?: string;
  requestedFormats?: string[];
  personaIds?: string[];
  hookIds?: string[];
  templateIds?: string[];
  generationParams?: JsonValue;
  createdBy?: string;
};

type CreativeInput = {
  batchId: string;
  productId?: string | null;
  personaId?: string | null;
  hookId?: string | null;
  templateId?: string | null;
  format: string;
  mediaType?: string;
  assetUrl?: string | null;
  localAssetPath?: string | null;
  sourceAssetRefs?: JsonValue;
  status?: string;
  qcStatus?: string | null;
  finalAssetUrl?: string | null;
  metadata?: JsonValue;
  actor?: string;
};

type CopyVariantInput = {
  creativeId: string;
  primaryText: string;
  headline: string;
  cta: string;
  policyNotes?: string;
  selected?: boolean;
};

type DestinationInput = {
  creativeId: string;
  baseUrl: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
};

type PlanInput = {
  name: string;
  batchId?: string | null;
  campaignRefId?: string | null;
  planJson: JsonValue;
  reasoning?: string | null;
  createdBy?: string;
};

export type CreativeLibraryAssetInput = {
  name: string;
  type: 'image' | 'video';
  status?: 'ready' | 'needs_review' | 'archived';
  sourceType?: 'upload' | 'url' | 'asset_library' | 'external';
  assetUrl: string;
  thumbnailUrl?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  ratio?: '4:5' | '9:16' | '1:1' | '16:9' | 'unknown';
  productId?: string | null;
  productName?: string | null;
  productUrl?: string | null;
  personaId?: string | null;
  personaName?: string | null;
  campaignId?: string | null;
  tags?: string[];
  notes?: string | null;
  copyHint?: string | null;
  landingPageUrl?: string | null;
  actor?: string;
};

export type PersonaInput = {
  code: string;
  name: string;
  description?: string | null;
  angle?: string | null;
  targetingRules?: JsonValue;
  performanceSummary?: string | null;
  status?: 'active' | 'archived';
  actor?: string;
};

export type TemplateInput = {
  name: string;
  kind: string;
  formatSupport?: string[];
  renderer?: string;
  designJson?: JsonValue;
  status?: 'active' | 'archived';
  actor?: string;
};

type PlanAd = {
  creative_id?: unknown;
  creativeId?: unknown;
  ad_key?: unknown;
  adKey?: unknown;
};

type PlanAdset = {
  key?: unknown;
  adset_key?: unknown;
  adsetKey?: unknown;
  ads?: unknown;
};

type ParsedPlan = {
  adsets?: PlanAdset[];
  ads?: PlanAd[];
};

const COUNT_TABLES = [
  'ad_products',
  'ad_personas',
  'ad_hooks',
  'ad_templates',
  'creative_library_assets',
  'ad_creative_batches',
  'ad_creatives',
  'ad_qc_events',
  'ad_copy_variants',
  'ad_destinations',
  'adset_plans',
  'ad_approvals',
  'ad_publish_jobs',
  'ad_performance_snapshots',
  'ad_recommendations',
] as const;

export async function ensureAdManagerDb() {
  await initDb();
  await initAdManagerDb();
}

export async function getAdManagerOverview(tenantId: string) {
  await ensureAdManagerDb();
  const counts: Record<string, number> = {};

  for (const table of COUNT_TABLES) {
    const result = await db.execute({ sql: `SELECT COUNT(*) as count FROM ${table} WHERE tenant_id = ?`, args: [tenantId] });
    counts[table] = Number(result.rows[0]?.count || 0);
  }

  const latestBatches = await db.execute({
    sql: `SELECT id, name, status, created_at, updated_at
          FROM ad_creative_batches
          WHERE tenant_id = ?
          ORDER BY created_at DESC
          LIMIT 8`,
    args: [tenantId],
  });

  const openRecommendations = await db.execute({
    sql: `SELECT id, severity, title, recommendation_type, created_at
          FROM ad_recommendations
          WHERE tenant_id = ? AND status = 'open'
          ORDER BY created_at DESC
          LIMIT 8`,
    args: [tenantId],
  });

  const latestPersonas = await db.execute({
    sql: `SELECT id, code, name, description, angle, targeting_rules, performance_summary, status, created_at, updated_at
          FROM ad_personas
          WHERE tenant_id = ? AND status = 'active'
          ORDER BY updated_at DESC
          LIMIT 12`,
    args: [tenantId],
  });

  const latestTemplates = await db.execute({
    sql: `SELECT id, kind, name, format_support, renderer, design_json, status, created_at, updated_at
          FROM ad_templates
          WHERE tenant_id = ? AND status != 'archived'
          ORDER BY updated_at DESC
          LIMIT 12`,
    args: [tenantId],
  });

  const draftPlans = await db.execute({
    sql: `SELECT id, name, status, version, plan_json, created_at
          FROM adset_plans
          WHERE tenant_id = ?
          ORDER BY created_at DESC
          LIMIT 8`,
    args: [tenantId],
  });
  const latestPlanId = draftPlans.rows[0]?.id ? String(draftPlans.rows[0].id) : null;

  const publishJobsResult = await db.execute({
    sql: `SELECT id, tenant_id, plan_id, status, error, requested_by, started_at, completed_at, created_at, updated_at
          FROM ad_publish_jobs
          WHERE tenant_id = ?
          ORDER BY created_at DESC
          LIMIT 5`,
    args: [tenantId],
  });

  const latestPublishJobs: any[] = [];
  for (const job of publishJobsResult.rows) {
    const itemsResult = await db.execute({
      sql: `SELECT id, publish_job_id, creative_id, adset_key, status, meta_campaign_id, meta_adset_id, meta_ad_id, error, created_at, updated_at
            FROM ad_publish_items
            WHERE tenant_id = ? AND publish_job_id = ?`,
      args: [tenantId, job.id],
    });
    latestPublishJobs.push({
      ...job,
      items: itemsResult.rows,
    });
  }

  return {
    counts,
    latestBatches: latestBatches.rows,
    latestCreatives: await listCreatives(tenantId, { limit: 1000 }),
    latestCopyVariants: await listCopyVariants(tenantId, { limit: 48 }),
    latestDestinations: await listDestinations(tenantId, { limit: 48 }),
    latestPersonas: latestPersonas.rows,
    creativeLibraryAssets: await listCreativeLibraryAssets(tenantId, { includeArchived: true, limit: 200 }),
    latestTemplates: latestTemplates.rows,
    draftPlans: draftPlans.rows,
    openRecommendations: openRecommendations.rows,
    latestPublishJobs,
    publishGate: latestPlanId
      ? await getPublishGateForPlan(tenantId, latestPlanId)
      : validatePublishGate({
          planStatus: 'draft',
          planVersionApproved: false,
          creativesApproved: false,
          expectedAdCount: 1,
          selectedCopyCount: 0,
          validDestinationCount: 0,
        }),
  };
}

export async function listCreativeLibraryAssets(tenantId: string, options: { includeArchived?: boolean; limit?: number } = {}) {
  await ensureAdManagerDb();
  const clauses = ['tenant_id = ?'];
  const args: Array<string | number> = [tenantId];
  if (!options.includeArchived) clauses.push(`status != 'archived'`);
  args.push(clampLimit(options.limit || 100));
  const result = await db.execute({
    sql: `SELECT * FROM creative_library_assets WHERE ${clauses.join(' AND ')} ORDER BY updated_at DESC LIMIT ?`,
    args,
  });
  return result.rows.filter((row) => !isExcludedReferenceAsset(row as Record<string, unknown>));
}

export async function getCreativeLibraryAsset(tenantId: string, id: string) {
  await ensureAdManagerDb();
  const result = await db.execute({
    sql: `SELECT * FROM creative_library_assets WHERE tenant_id = ? AND id = ?`,
    args: [tenantId, id],
  });
  const row = result.rows[0] || null;
  if (!row || isExcludedReferenceAsset(row as Record<string, unknown>)) return null;
  return row;
}

export async function upsertPersona(tenantId: string, input: PersonaInput) {
  await ensureAdManagerDb();
  const code = String(input.code || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 96);
  const name = String(input.name || '').trim();
  if (!code) throw new Error('Persona code is required');
  if (!name) throw new Error('Persona name is required');
  const normalized = {
    code,
    name,
    description: input.description || null,
    angle: input.angle || null,
    targetingRules: stringify(input.targetingRules || {}),
    performanceSummary: input.performanceSummary || null,
    status: input.status === 'archived' ? 'archived' : 'active',
  };
  const existing = await db.execute({
    sql: `SELECT * FROM ad_personas WHERE tenant_id = ? AND code = ? LIMIT 1`,
    args: [tenantId, code],
  });
  if (existing.rows[0]?.id) {
    const id = String(existing.rows[0].id);
    await db.execute({
      sql: `UPDATE ad_personas
            SET name = ?, description = ?, angle = ?, targeting_rules = ?, performance_summary = ?, status = ?, updated_at = datetime('now')
            WHERE tenant_id = ? AND id = ?`,
      args: [normalized.name, normalized.description, normalized.angle, normalized.targetingRules, normalized.performanceSummary, normalized.status, tenantId, id],
    });
    await logAdManagerAudit({ tenantId, actor: input.actor, action: 'upsert_persona', entityType: 'ad_persona', entityId: id, before: existing.rows[0], after: normalized });
    return (await db.execute({ sql: `SELECT * FROM ad_personas WHERE tenant_id = ? AND id = ?`, args: [tenantId, id] })).rows[0];
  }
  const id = randomUUID();
  await db.execute({
    sql: `INSERT INTO ad_personas (id, tenant_id, code, name, description, angle, targeting_rules, performance_summary, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    args: [id, tenantId, normalized.code, normalized.name, normalized.description, normalized.angle, normalized.targetingRules, normalized.performanceSummary, normalized.status],
  });
  await logAdManagerAudit({ tenantId, actor: input.actor, action: 'create_persona', entityType: 'ad_persona', entityId: id, after: normalized });
  return (await db.execute({ sql: `SELECT * FROM ad_personas WHERE tenant_id = ? AND id = ?`, args: [tenantId, id] })).rows[0];
}

export async function archivePersona(tenantId: string, id: string, actor?: string) {
  await ensureAdManagerDb();
  const existing = await db.execute({ sql: `SELECT * FROM ad_personas WHERE tenant_id = ? AND id = ?`, args: [tenantId, id] });
  if (!existing.rows[0]) throw new Error('Persona not found');
  await db.execute({ sql: `UPDATE ad_personas SET status = 'archived', updated_at = datetime('now') WHERE tenant_id = ? AND id = ?`, args: [tenantId, id] });
  await logAdManagerAudit({ tenantId, actor, action: 'archive_persona', entityType: 'ad_persona', entityId: id, before: existing.rows[0], after: { status: 'archived' } });
  return { ok: true, id };
}

export async function listTemplates(tenantId: string, options: { includeArchived?: boolean; limit?: number } = {}) {
  await ensureAdManagerDb();
  const clauses = ['tenant_id = ?'];
  const args: Array<string | number> = [tenantId];
  if (!options.includeArchived) clauses.push(`status != 'archived'`);
  args.push(clampLimit(options.limit || 100));
  const result = await db.execute({
    sql: `SELECT * FROM ad_templates WHERE ${clauses.join(' AND ')} ORDER BY updated_at DESC LIMIT ?`,
    args,
  });
  return result.rows;
}

export async function createTemplate(tenantId: string, input: TemplateInput) {
  await ensureAdManagerDb();
  const name = String(input.name || '').trim();
  const kind = String(input.kind || 'image').trim();
  const renderer = String(input.renderer || 'visual_template_builder').trim();
  if (!name) throw new Error('Template name is required');
  if (!kind) throw new Error('Template kind is required');
  if (!renderer) throw new Error('Template renderer is required');
  const normalized = {
    name,
    kind,
    formatSupport: stringify(input.formatSupport || []),
    renderer,
    designJson: stringify(input.designJson || {}),
    status: input.status === 'archived' ? 'archived' : 'active',
  };
  const id = randomUUID();
  await db.execute({
    sql: `INSERT INTO ad_templates (id, tenant_id, kind, name, format_support, renderer, design_json, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    args: [id, tenantId, normalized.kind, normalized.name, normalized.formatSupport, normalized.renderer, normalized.designJson, normalized.status],
  });
  await logAdManagerAudit({ tenantId, actor: input.actor, action: 'create_template', entityType: 'ad_template', entityId: id, after: normalized });
  return (await db.execute({ sql: `SELECT * FROM ad_templates WHERE tenant_id = ? AND id = ?`, args: [tenantId, id] })).rows[0];
}

export async function createCreativeLibraryAsset(tenantId: string, input: CreativeLibraryAssetInput) {
  await ensureAdManagerDb();
  const id = randomUUID();
  const normalized = normalizeCreativeLibraryAssetInput(input);
  assertAllowedReferenceAssetInput({
    sourceType: normalized.sourceType,
    tags: normalized.tags,
    assetUrl: normalized.assetUrl,
    thumbnailUrl: normalized.thumbnailUrl,
    landingPageUrl: normalized.landingPageUrl,
  });
  await db.execute({
    sql: `INSERT INTO creative_library_assets (
            id, tenant_id, name, type, status, source_type, asset_url, thumbnail_url, file_name,
            mime_type, file_size, width, height, duration_seconds, ratio, product_id, product_name,
            product_url, persona_id, persona_name, campaign_id, tags, notes, copy_hint,
            landing_page_url, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    args: [
      id,
      tenantId,
      normalized.name,
      normalized.type,
      normalized.status,
      normalized.sourceType,
      normalized.assetUrl,
      normalized.thumbnailUrl,
      normalized.fileName,
      normalized.mimeType,
      normalized.fileSize,
      normalized.width,
      normalized.height,
      normalized.durationSeconds,
      normalized.ratio,
      normalized.productId,
      normalized.productName,
      normalized.productUrl,
      normalized.personaId,
      normalized.personaName,
      normalized.campaignId,
      stringify(normalized.tags),
      normalized.notes,
      normalized.copyHint,
      normalized.landingPageUrl,
    ],
  });
  await logAdManagerAudit({ tenantId, actor: input.actor, action: 'create_creative_library_asset', entityType: 'creative_library_asset', entityId: id, after: normalized });
  return getCreativeLibraryAsset(tenantId, id);
}

export async function updateCreativeLibraryAsset(tenantId: string, id: string, input: Partial<CreativeLibraryAssetInput>) {
  await ensureAdManagerDb();
  const existing = await getCreativeLibraryAsset(tenantId, id);
  if (!existing) throw new Error('Creative asset not found');
  const merged = normalizeCreativeLibraryAssetInput({
    name: input.name ?? String(existing.name || ''),
    type: (input.type ?? String(existing.type || 'image')) as 'image' | 'video',
    status: (input.status ?? String(existing.status || 'ready')) as 'ready' | 'needs_review' | 'archived',
    sourceType: (input.sourceType ?? String(existing.source_type || 'url')) as 'upload' | 'url' | 'asset_library' | 'external',
    assetUrl: input.assetUrl ?? String(existing.asset_url || ''),
    thumbnailUrl: input.thumbnailUrl ?? String(existing.thumbnail_url || ''),
    fileName: input.fileName ?? String(existing.file_name || ''),
    mimeType: input.mimeType ?? String(existing.mime_type || ''),
    fileSize: input.fileSize ?? (existing.file_size === null ? null : Number(existing.file_size)),
    width: input.width ?? (existing.width === null ? null : Number(existing.width)),
    height: input.height ?? (existing.height === null ? null : Number(existing.height)),
    durationSeconds: input.durationSeconds ?? (existing.duration_seconds === null ? null : Number(existing.duration_seconds)),
    ratio: (input.ratio ?? String(existing.ratio || 'unknown')) as '4:5' | '9:16' | '1:1' | '16:9' | 'unknown',
    productId: input.productId ?? String(existing.product_id || ''),
    productName: input.productName ?? String(existing.product_name || ''),
    productUrl: input.productUrl ?? String(existing.product_url || ''),
    personaId: input.personaId ?? String(existing.persona_id || ''),
    personaName: input.personaName ?? String(existing.persona_name || ''),
    campaignId: input.campaignId ?? String(existing.campaign_id || ''),
    tags: input.tags ?? parseStringArray(existing.tags),
    notes: input.notes ?? String(existing.notes || ''),
    copyHint: input.copyHint ?? String(existing.copy_hint || ''),
    landingPageUrl: input.landingPageUrl ?? String(existing.landing_page_url || ''),
    actor: input.actor,
  });
  assertAllowedReferenceAssetInput({
    sourceType: merged.sourceType,
    tags: merged.tags,
    assetUrl: merged.assetUrl,
    thumbnailUrl: merged.thumbnailUrl,
    landingPageUrl: merged.landingPageUrl,
  });
  await db.execute({
    sql: `UPDATE creative_library_assets
          SET name = ?, type = ?, status = ?, source_type = ?, asset_url = ?, thumbnail_url = ?,
              file_name = ?, mime_type = ?, file_size = ?, width = ?, height = ?,
              duration_seconds = ?, ratio = ?, product_id = ?, product_name = ?, product_url = ?,
              persona_id = ?, persona_name = ?, campaign_id = ?, tags = ?, notes = ?,
              copy_hint = ?, landing_page_url = ?, updated_at = datetime('now')
          WHERE tenant_id = ? AND id = ?`,
    args: [
      merged.name,
      merged.type,
      merged.status,
      merged.sourceType,
      merged.assetUrl,
      merged.thumbnailUrl,
      merged.fileName,
      merged.mimeType,
      merged.fileSize,
      merged.width,
      merged.height,
      merged.durationSeconds,
      merged.ratio,
      merged.productId,
      merged.productName,
      merged.productUrl,
      merged.personaId,
      merged.personaName,
      merged.campaignId,
      stringify(merged.tags),
      merged.notes,
      merged.copyHint,
      merged.landingPageUrl,
      tenantId,
      id,
    ],
  });
  await logAdManagerAudit({ tenantId, actor: input.actor, action: 'update_creative_library_asset', entityType: 'creative_library_asset', entityId: id, before: existing, after: merged });
  return getCreativeLibraryAsset(tenantId, id);
}

export async function archiveCreativeLibraryAsset(tenantId: string, id: string, actor?: string) {
  await ensureAdManagerDb();
  const existing = await getCreativeLibraryAsset(tenantId, id);
  if (!existing) throw new Error('Creative asset not found');
  await db.execute({
    sql: `UPDATE creative_library_assets SET status = 'archived', updated_at = datetime('now') WHERE tenant_id = ? AND id = ?`,
    args: [tenantId, id],
  });
  await logAdManagerAudit({ tenantId, actor, action: 'archive_creative_library_asset', entityType: 'creative_library_asset', entityId: id, before: existing, after: { status: 'archived' } });
  return { ok: true, id };
}

export async function createBatch(tenantId: string, input: BatchInput) {
  await ensureAdManagerDb();
  const id = randomUUID();
  await db.execute({
    sql: `INSERT INTO ad_creative_batches (
            id, tenant_id, product_id, name, status, requested_formats, persona_ids, hook_ids,
            template_ids, generation_params, created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    args: [
      id,
      tenantId,
      input.productId || null,
      input.name.trim() || `Draft batch ${new Date().toISOString().slice(0, 10)}`,
      input.status || 'draft',
      stringify(input.requestedFormats || []),
      stringify(input.personaIds || []),
      stringify(input.hookIds || []),
      stringify(input.templateIds || []),
      stringify(input.generationParams || {}),
      input.createdBy || null,
    ],
  });
  await logAdManagerAudit({ tenantId, actor: input.createdBy, action: 'create_batch', entityType: 'ad_creative_batch', entityId: id, after: input });
  return getBatch(tenantId, id);
}

export async function getBatch(tenantId: string, id: string) {
  await ensureAdManagerDb();
  const result = await db.execute({
    sql: `SELECT * FROM ad_creative_batches WHERE tenant_id = ? AND id = ?`,
    args: [tenantId, id],
  });
  return result.rows[0] || null;
}

export async function deleteBatch(tenantId: string, id: string, actor?: string) {
  await ensureAdManagerDb();
  const batch = await getBatch(tenantId, id);
  if (!batch) throw new Error('Batch not found');

  const creatives = await db.execute({
    sql: `SELECT id FROM ad_creatives WHERE tenant_id = ? AND batch_id = ?`,
    args: [tenantId, id],
  });
  const creativeIds = creatives.rows.map(row => String(row.id)).filter(Boolean);

  for (const creativeId of creativeIds) {
    await db.execute({ sql: `DELETE FROM ad_publish_items WHERE tenant_id = ? AND creative_id = ?`, args: [tenantId, creativeId] });
    await db.execute({ sql: `DELETE FROM ad_approvals WHERE tenant_id = ? AND creative_id = ?`, args: [tenantId, creativeId] });
    await db.execute({ sql: `DELETE FROM ad_destinations WHERE tenant_id = ? AND creative_id = ?`, args: [tenantId, creativeId] });
    await db.execute({ sql: `DELETE FROM ad_copy_variants WHERE tenant_id = ? AND creative_id = ?`, args: [tenantId, creativeId] });
    await db.execute({ sql: `DELETE FROM ad_qc_events WHERE tenant_id = ? AND creative_id = ?`, args: [tenantId, creativeId] });
  }

  const plans = await db.execute({
    sql: `SELECT id FROM adset_plans WHERE tenant_id = ? AND batch_id = ?`,
    args: [tenantId, id],
  });
  for (const plan of plans.rows) {
    const planId = String(plan.id || '');
    if (!planId) continue;
    const jobs = await db.execute({ sql: `SELECT id FROM ad_publish_jobs WHERE tenant_id = ? AND plan_id = ?`, args: [tenantId, planId] });
    for (const job of jobs.rows) {
      await db.execute({ sql: `DELETE FROM ad_publish_items WHERE tenant_id = ? AND publish_job_id = ?`, args: [tenantId, String(job.id)] });
    }
    await db.execute({ sql: `DELETE FROM ad_publish_jobs WHERE tenant_id = ? AND plan_id = ?`, args: [tenantId, planId] });
    await db.execute({ sql: `DELETE FROM ad_approvals WHERE tenant_id = ? AND plan_id = ?`, args: [tenantId, planId] });
  }

  await db.execute({ sql: `DELETE FROM adset_plans WHERE tenant_id = ? AND batch_id = ?`, args: [tenantId, id] });
  await db.execute({ sql: `DELETE FROM ad_creatives WHERE tenant_id = ? AND batch_id = ?`, args: [tenantId, id] });
  await db.execute({ sql: `DELETE FROM ad_creative_batches WHERE tenant_id = ? AND id = ?`, args: [tenantId, id] });
  await logAdManagerAudit({ tenantId, actor, action: 'delete_batch', entityType: 'ad_creative_batch', entityId: id, before: batch });
  return { deleted: true, id, creativeCount: creativeIds.length };
}

export async function listBatches(tenantId: string, options: { limit?: number } = {}) {
  await ensureAdManagerDb();
  const result = await db.execute({
    sql: `SELECT * FROM ad_creative_batches WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?`,
    args: [tenantId, clampLimit(options.limit)],
  });
  return result.rows;
}

export async function createCreative(tenantId: string, input: CreativeInput) {
  await ensureAdManagerDb();
  const batch = await getBatch(tenantId, input.batchId);
  if (!batch) throw new Error('Batch not found');
  const id = randomUUID();
  await db.execute({
    sql: `INSERT INTO ad_creatives (
            id, tenant_id, batch_id, product_id, persona_id, hook_id, template_id, format, media_type,
            asset_url, local_asset_path, source_asset_refs, status, qc_status, final_asset_url, metadata,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    args: [
      id,
      tenantId,
      input.batchId,
      input.productId || null,
      input.personaId || null,
      input.hookId || null,
      input.templateId || null,
      input.format || 'feed_4x5',
      input.mediaType || 'image',
      input.assetUrl || null,
      input.localAssetPath || null,
      stringify(input.sourceAssetRefs || {}),
      input.status || 'generated',
      input.qcStatus || 'unchecked',
      input.finalAssetUrl || null,
      stringify(input.metadata || {}),
    ],
  });
  await logAdManagerAudit({ tenantId, actor: input.actor, action: 'create_creative', entityType: 'ad_creative', entityId: id, after: input });
  return getCreative(tenantId, id);
}

export async function listCreatives(tenantId: string, options: { batchId?: string; limit?: number } = {}) {
  await ensureAdManagerDb();
  const clauses = ['tenant_id = ?'];
  const args: Array<string | number> = [tenantId];
  if (options.batchId) {
    clauses.push('batch_id = ?');
    args.push(options.batchId);
  }
  args.push(clampLimit(options.limit));
  const result = await db.execute({
    sql: `SELECT * FROM ad_creatives WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT ?`,
    args,
  });
  return result.rows;
}

export async function updateCreativeQcStatus(
  tenantId: string,
  creativeId: string,
  input: { status: string; reviewer?: string; feedback?: string; rejectionReason?: string; finalAssetUrl?: string },
) {
  await ensureAdManagerDb();
  const existing = await db.execute({
    sql: `SELECT id, status, qc_status, final_asset_url FROM ad_creatives WHERE tenant_id = ? AND id = ?`,
    args: [tenantId, creativeId],
  });
  if (!existing.rows[0]) throw new Error('Creative not found');

  const current = existing.rows[0];
  const nextCreativeStatus = input.status === 'approved' ? 'approved' : input.status === 'upload_ready' ? 'upload_ready' : 'generated';
  await db.execute({
    sql: `UPDATE ad_creatives
          SET qc_status = ?, status = ?, final_asset_url = COALESCE(?, final_asset_url), updated_at = datetime('now')
          WHERE tenant_id = ? AND id = ?`,
    args: [input.status, nextCreativeStatus, input.finalAssetUrl || null, tenantId, creativeId],
  });
  await db.execute({
    sql: `INSERT INTO ad_qc_events (
            id, tenant_id, creative_id, from_status, to_status, reviewer, feedback, rejection_reason, final_asset_url, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    args: [
      randomUUID(),
      tenantId,
      creativeId,
      current.qc_status || current.status || null,
      input.status,
      input.reviewer || null,
      input.feedback || null,
      input.rejectionReason || null,
      input.finalAssetUrl || current.final_asset_url || null,
    ],
  });
  await logAdManagerAudit({ tenantId, actor: input.reviewer, action: 'update_creative_qc', entityType: 'ad_creative', entityId: creativeId, before: current, after: input });
  return getCreative(tenantId, creativeId);
}

export async function getCreative(tenantId: string, creativeId: string) {
  await ensureAdManagerDb();
  const result = await db.execute({
    sql: `SELECT * FROM ad_creatives WHERE tenant_id = ? AND id = ?`,
    args: [tenantId, creativeId],
  });
  return result.rows[0] || null;
}

export async function deleteCreative(tenantId: string, creativeId: string, actor?: string) {
  await ensureAdManagerDb();
  const creative = await getCreative(tenantId, creativeId);
  if (!creative) throw new Error('Creative not found');

  await db.execute({ sql: `DELETE FROM ad_publish_items WHERE tenant_id = ? AND creative_id = ?`, args: [tenantId, creativeId] });
  await db.execute({ sql: `DELETE FROM ad_approvals WHERE tenant_id = ? AND creative_id = ?`, args: [tenantId, creativeId] });
  await db.execute({ sql: `DELETE FROM ad_destinations WHERE tenant_id = ? AND creative_id = ?`, args: [tenantId, creativeId] });
  await db.execute({ sql: `DELETE FROM ad_copy_variants WHERE tenant_id = ? AND creative_id = ?`, args: [tenantId, creativeId] });
  await db.execute({ sql: `DELETE FROM ad_qc_events WHERE tenant_id = ? AND creative_id = ?`, args: [tenantId, creativeId] });
  await db.execute({ sql: `DELETE FROM ad_creatives WHERE tenant_id = ? AND id = ?`, args: [tenantId, creativeId] });

  await logAdManagerAudit({ tenantId, actor, action: 'delete_creative', entityType: 'ad_creative', entityId: creativeId, before: creative });
  return { deleted: true, id: creativeId };
}

export async function createCopyVariant(tenantId: string, input: CopyVariantInput) {
  await ensureAdManagerDb();
  const creative = await getCreative(tenantId, input.creativeId);
  if (!creative) throw new Error('Creative not found');
  const policy = validateCopyVariant(input);
  const variantIndex = await nextCopyVariantIndex(tenantId, input.creativeId);
  const id = randomUUID();

  if (input.selected) {
    await db.execute({
      sql: `UPDATE ad_copy_variants SET selected = 0, updated_at = datetime('now') WHERE tenant_id = ? AND creative_id = ?`,
      args: [tenantId, input.creativeId],
    });
  }

  await db.execute({
    sql: `INSERT INTO ad_copy_variants (
            id, tenant_id, creative_id, variant_index, primary_text, headline, cta, policy_status,
            policy_notes, selected, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    args: [
      id,
      tenantId,
      input.creativeId,
      variantIndex,
      input.primaryText.trim(),
      input.headline.trim(),
      input.cta.trim(),
      policy.allowed ? 'passed' : 'blocked',
      input.policyNotes || policy.blockers.join(' '),
      input.selected ? 1 : 0,
    ],
  });
  await logAdManagerAudit({ tenantId, action: 'create_copy_variant', entityType: 'ad_copy_variant', entityId: id, after: { ...input, policy } });
  return getCopyVariant(tenantId, id);
}

export async function listCopyVariants(tenantId: string, options: { creativeId?: string; limit?: number } = {}) {
  await ensureAdManagerDb();
  const clauses = ['tenant_id = ?'];
  const args: Array<string | number> = [tenantId];
  if (options.creativeId) {
    clauses.push('creative_id = ?');
    args.push(options.creativeId);
  }
  args.push(clampLimit(options.limit));
  const result = await db.execute({
    sql: `SELECT * FROM ad_copy_variants WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT ?`,
    args,
  });
  return result.rows;
}

export async function getCopyVariant(tenantId: string, id: string) {
  await ensureAdManagerDb();
  const result = await db.execute({
    sql: `SELECT * FROM ad_copy_variants WHERE tenant_id = ? AND id = ?`,
    args: [tenantId, id],
  });
  return result.rows[0] || null;
}

export async function selectCopyVariant(tenantId: string, id: string) {
  await ensureAdManagerDb();
  const variant = await getCopyVariant(tenantId, id);
  if (!variant) throw new Error('Copy variant not found');
  if (variant.policy_status === 'blocked') throw new Error(String(variant.policy_notes || 'Copy variant is blocked by policy checks'));
  await db.execute({
    sql: `UPDATE ad_copy_variants SET selected = 0, updated_at = datetime('now') WHERE tenant_id = ? AND creative_id = ?`,
    args: [tenantId, String(variant.creative_id)],
  });
  await db.execute({
    sql: `UPDATE ad_copy_variants SET selected = 1, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?`,
    args: [tenantId, id],
  });
  await logAdManagerAudit({ tenantId, action: 'select_copy_variant', entityType: 'ad_copy_variant', entityId: id, after: variant });
  return getCopyVariant(tenantId, id);
}

export async function upsertDestinationUrl(tenantId: string, input: DestinationInput) {
  await ensureAdManagerDb();
  const creative = await getCreative(tenantId, input.creativeId);
  if (!creative) throw new Error('Creative not found');
  const validation = validateDestinationUrl(input);
  const existing = await db.execute({
    sql: `SELECT id FROM ad_destinations WHERE tenant_id = ? AND creative_id = ? ORDER BY created_at DESC LIMIT 1`,
    args: [tenantId, input.creativeId],
  });
  const id = existing.rows[0]?.id ? String(existing.rows[0].id) : randomUUID();
  if (existing.rows[0]) {
    await db.execute({
      sql: `UPDATE ad_destinations
            SET base_url = ?, final_url = ?, utm_source = ?, utm_medium = ?, utm_campaign = ?,
                utm_content = ?, utm_term = ?, valid = ?, validation_error = ?, updated_at = datetime('now')
            WHERE tenant_id = ? AND id = ?`,
      args: [
        input.baseUrl.trim(),
        validation.finalUrl,
        validation.utmSource,
        validation.utmMedium,
        validation.utmCampaign,
        validation.utmContent,
        validation.utmTerm,
        validation.valid ? 1 : 0,
        validation.error || null,
        tenantId,
        id,
      ],
    });
  } else {
    await db.execute({
      sql: `INSERT INTO ad_destinations (
              id, tenant_id, creative_id, base_url, final_url, utm_source, utm_medium, utm_campaign,
              utm_content, utm_term, valid, validation_error, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      args: [
        id,
        tenantId,
        input.creativeId,
        input.baseUrl.trim(),
        validation.finalUrl,
        validation.utmSource,
        validation.utmMedium,
        validation.utmCampaign,
        validation.utmContent,
        validation.utmTerm,
        validation.valid ? 1 : 0,
        validation.error || null,
      ],
    });
  }
  await logAdManagerAudit({ tenantId, action: 'upsert_destination', entityType: 'ad_destination', entityId: id, after: validation });
  return getDestination(tenantId, id);
}

export async function listDestinations(tenantId: string, options: { creativeId?: string; limit?: number } = {}) {
  await ensureAdManagerDb();
  const clauses = ['tenant_id = ?'];
  const args: Array<string | number> = [tenantId];
  if (options.creativeId) {
    clauses.push('creative_id = ?');
    args.push(options.creativeId);
  }
  args.push(clampLimit(options.limit));
  const result = await db.execute({
    sql: `SELECT * FROM ad_destinations WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT ?`,
    args,
  });
  return result.rows;
}

export async function getDestination(tenantId: string, id: string) {
  await ensureAdManagerDb();
  const result = await db.execute({
    sql: `SELECT * FROM ad_destinations WHERE tenant_id = ? AND id = ?`,
    args: [tenantId, id],
  });
  return result.rows[0] || null;
}

export async function createAdsetPlan(tenantId: string, input: PlanInput) {
  await ensureAdManagerDb();
  const id = randomUUID();
  await db.execute({
    sql: `INSERT INTO adset_plans (
            id, tenant_id, campaign_ref_id, batch_id, name, status, plan_json, reasoning, version,
            created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, 1, ?, datetime('now'), datetime('now'))`,
    args: [
      id,
      tenantId,
      input.campaignRefId || null,
      input.batchId || null,
      input.name.trim() || `Draft plan ${new Date().toISOString().slice(0, 10)}`,
      stringify(input.planJson),
      input.reasoning || null,
      input.createdBy || null,
    ],
  });
  await logAdManagerAudit({ tenantId, actor: input.createdBy, action: 'create_adset_plan', entityType: 'adset_plan', entityId: id, after: input });
  return getAdsetPlan(tenantId, id);
}

export async function listAdsetPlans(tenantId: string, options: { status?: string; limit?: number } = {}) {
  await ensureAdManagerDb();
  const clauses = ['tenant_id = ?'];
  const args: Array<string | number> = [tenantId];
  if (options.status) {
    clauses.push('status = ?');
    args.push(options.status);
  }
  args.push(clampLimit(options.limit));
  const result = await db.execute({
    sql: `SELECT * FROM adset_plans WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT ?`,
    args,
  });
  return result.rows;
}

export async function getAdsetPlan(tenantId: string, id: string) {
  await ensureAdManagerDb();
  const result = await db.execute({
    sql: `SELECT * FROM adset_plans WHERE tenant_id = ? AND id = ?`,
    args: [tenantId, id],
  });
  return result.rows[0] || null;
}

export async function approveAdsetPlan(tenantId: string, planId: string, actor: string) {
  await ensureAdManagerDb();
  const plan = await getAdsetPlan(tenantId, planId);
  if (!plan) throw new Error('Plan not found');
  const approvalId = randomUUID();
  await db.execute({
    sql: `UPDATE adset_plans SET status = 'approved', updated_at = datetime('now') WHERE tenant_id = ? AND id = ?`,
    args: [tenantId, planId],
  });
  await db.execute({
    sql: `INSERT INTO ad_approvals (
            id, tenant_id, plan_id, approved_by, approval_scope, approved_payload_json, status, created_at
          ) VALUES (?, ?, ?, ?, 'plan_version', ?, 'approved', datetime('now'))`,
    args: [approvalId, tenantId, planId, actor, stringify({ plan_id: planId, version: Number(plan.version || 1), plan_json: parseJson(String(plan.plan_json || '{}')) })],
  });
  await logAdManagerAudit({ tenantId, actor, action: 'approve_adset_plan', entityType: 'adset_plan', entityId: planId, before: plan, after: { approvalId } });
  return getAdsetPlan(tenantId, planId);
}

export async function createPublishJob(tenantId: string, planId: string, requestedBy: string) {
  await ensureAdManagerDb();
  const gate = await getPublishGateForPlan(tenantId, planId);
  if (!gate.allowed) {
    await logAdManagerAudit({ tenantId, actor: requestedBy, action: 'publish_blocked', entityType: 'adset_plan', entityId: planId, after: gate, reason: gate.blockers.join(' ') });
    return { created: false, gate, job: null, items: [] };
  }

  const plan = await getAdsetPlan(tenantId, planId);
  if (!plan) throw new Error('Plan not found');
  const planAds = extractPlanAds(parseJson(String(plan.plan_json || '{}')));
  const jobId = randomUUID();
  await db.execute({
    sql: `INSERT INTO ad_publish_jobs (id, tenant_id, plan_id, status, requested_by, created_at, updated_at)
          VALUES (?, ?, ?, 'ready', ?, datetime('now'), datetime('now'))`,
    args: [jobId, tenantId, planId, requestedBy],
  });

  for (const ad of planAds) {
    await db.execute({
      sql: `INSERT INTO ad_publish_items (id, tenant_id, publish_job_id, creative_id, adset_key, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'queued', datetime('now'), datetime('now'))`,
      args: [randomUUID(), tenantId, jobId, ad.creativeId, ad.adsetKey || null],
    });
  }

  await logAdManagerAudit({ tenantId, actor: requestedBy, action: 'create_run_job', entityType: 'ad_publish_job', entityId: jobId, after: { planId, itemCount: planAds.length } });
  return { created: true, gate, job: await getPublishJob(tenantId, jobId), items: await listPublishItems(tenantId, jobId) };
}

export async function getPublishGateForPlan(tenantId: string, planId: string) {
  await ensureAdManagerDb();
  const plan = await getAdsetPlan(tenantId, planId);
  if (!plan) return { allowed: false, blockers: ['Plan not found.'], expectedAdCount: 0 };

  const metaIntegration = await getIntegration(tenantId, 'meta');
  const hasSelectedAdAccount = Boolean(String(metaIntegration?.provider_account_id || '').trim());

  const parsed = parseJson(String(plan.plan_json || '{}'));
  const planAds = extractPlanAds(parsed);
  const creativeIds = Array.from(new Set(planAds.map(ad => ad.creativeId).filter(Boolean)));
  const expectedAdCount = creativeIds.length;
  const approval = await db.execute({
    sql: `SELECT id FROM ad_approvals
          WHERE tenant_id = ? AND plan_id = ? AND approval_scope = 'plan_version'
            AND status = 'approved'
            AND json_extract(approved_payload_json, '$.version') = ?
          ORDER BY created_at DESC LIMIT 1`,
    args: [tenantId, planId, Number(plan.version || 1)],
  });

  if (creativeIds.length === 0) {
    const gate = validatePublishGate({
        planStatus: String(plan.status || ''),
        planVersionApproved: approval.rows.length > 0,
        creativesApproved: false,
        expectedAdCount: 1,
        selectedCopyCount: 0,
        validDestinationCount: 0,
      });
    const blockers = [...gate.blockers];
    if (!hasSelectedAdAccount) blockers.unshift('Connect and select a Meta ad account before publishing.');
    return {
      ...gate,
      allowed: gate.allowed && hasSelectedAdAccount,
      blockers,
      expectedAdCount: 0,
    };
  }

  const placeholders = creativeIds.map(() => '?').join(',');
  const creativeStatus = await db.execute({
    sql: `SELECT COUNT(*) as count FROM ad_creatives
          WHERE tenant_id = ? AND id IN (${placeholders}) AND (status IN ('approved', 'upload_ready') OR qc_status IN ('approved', 'upload_ready'))`,
    args: [tenantId, ...creativeIds],
  });
  const selectedCopy = await db.execute({
    sql: `SELECT COUNT(DISTINCT creative_id) as count FROM ad_copy_variants
          WHERE tenant_id = ? AND creative_id IN (${placeholders}) AND selected = 1 AND policy_status != 'blocked'`,
    args: [tenantId, ...creativeIds],
  });
  const validDestinations = await db.execute({
    sql: `SELECT COUNT(DISTINCT creative_id) as count FROM ad_destinations
          WHERE tenant_id = ? AND creative_id IN (${placeholders}) AND valid = 1`,
    args: [tenantId, ...creativeIds],
  });

  const gate = validatePublishGate({
      planStatus: String(plan.status || ''),
      planVersionApproved: approval.rows.length > 0,
      creativesApproved: Number(creativeStatus.rows[0]?.count || 0) >= expectedAdCount,
      expectedAdCount,
      selectedCopyCount: Number(selectedCopy.rows[0]?.count || 0),
      validDestinationCount: Number(validDestinations.rows[0]?.count || 0),
    });
  const blockers = [...gate.blockers];
  if (!hasSelectedAdAccount) blockers.unshift('Connect and select a Meta ad account before publishing.');
  return {
    ...gate,
    allowed: gate.allowed && hasSelectedAdAccount,
    blockers,
    expectedAdCount,
  };
}

export async function listPublishJobs(tenantId: string, options: { limit?: number } = {}) {
  await ensureAdManagerDb();
  const result = await db.execute({
    sql: `SELECT * FROM ad_publish_jobs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?`,
    args: [tenantId, clampLimit(options.limit)],
  });
  return result.rows;
}

export async function getPublishJob(tenantId: string, id: string) {
  await ensureAdManagerDb();
  const result = await db.execute({
    sql: `SELECT * FROM ad_publish_jobs WHERE tenant_id = ? AND id = ?`,
    args: [tenantId, id],
  });
  return result.rows[0] || null;
}

export async function listPublishItems(tenantId: string, jobId: string) {
  await ensureAdManagerDb();
  const result = await db.execute({
    sql: `SELECT * FROM ad_publish_items WHERE tenant_id = ? AND publish_job_id = ? ORDER BY created_at ASC`,
    args: [tenantId, jobId],
  });
  return result.rows;
}

export async function logAdManagerAudit(args: {
  tenantId: string;
  actor?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
}) {
  await ensureAdManagerDb();
  await db.execute({
    sql: `INSERT INTO ad_audit_log (id, tenant_id, actor, action, entity_type, entity_id, before_json, after_json, reason, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    args: [
      randomUUID(),
      args.tenantId,
      args.actor || 'system',
      args.action,
      args.entityType || null,
      args.entityId || null,
      args.before === undefined ? null : JSON.stringify(args.before),
      args.after === undefined ? null : JSON.stringify(args.after),
      args.reason || null,
    ],
  });
}

function stringify(value: unknown) {
  return JSON.stringify(value ?? null);
}

function parseJson(value: string): ParsedPlan {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function parseStringArray(value: unknown) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(item => String(item).trim()).filter(Boolean);
    } catch {
      return value.split(',').map(item => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function normalizeCreativeLibraryAssetInput(input: CreativeLibraryAssetInput) {
  const name = String(input.name || '').trim();
  const assetUrl = String(input.assetUrl || '').trim();
  const type = input.type === 'video' ? 'video' : 'image';
  const status = ['ready', 'needs_review', 'archived'].includes(String(input.status)) ? input.status! : 'ready';
  const sourceType = ['upload', 'url', 'asset_library', 'external'].includes(String(input.sourceType)) ? input.sourceType! : 'url';
  const ratio = ['4:5', '9:16', '1:1', '16:9', 'unknown'].includes(String(input.ratio)) ? input.ratio! : 'unknown';
  if (!name) throw new Error('Creative name is required.');
  if (!assetUrl) throw new Error('Creative asset URL is required.');
  try {
    const url = new URL(assetUrl);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid protocol');
  } catch {
    throw new Error('Creative asset URL must be a valid http or https URL.');
  }
  if (input.landingPageUrl) {
    try {
      const url = new URL(String(input.landingPageUrl));
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid protocol');
    } catch {
      throw new Error('Landing page URL must be a valid http or https URL.');
    }
  }
  return {
    name,
    type,
    status,
    sourceType,
    assetUrl,
    thumbnailUrl: input.thumbnailUrl || (type === 'image' ? assetUrl : null),
    fileName: input.fileName || null,
    mimeType: input.mimeType || null,
    fileSize: Number.isFinite(input.fileSize) ? Number(input.fileSize) : null,
    width: Number.isFinite(input.width) ? Number(input.width) : null,
    height: Number.isFinite(input.height) ? Number(input.height) : null,
    durationSeconds: Number.isFinite(input.durationSeconds) ? Number(input.durationSeconds) : null,
    ratio,
    productId: input.productId || null,
    productName: input.productName || null,
    productUrl: input.productUrl || null,
    personaId: input.personaId || null,
    personaName: input.personaName || null,
    campaignId: input.campaignId || null,
    tags: parseStringArray(input.tags),
    notes: input.notes || null,
    copyHint: input.copyHint || null,
    landingPageUrl: input.landingPageUrl || null,
  };
}

function clampLimit(limit?: number) {
  if (!Number.isFinite(limit)) return 50;
  return Math.min(Math.max(Number(limit), 1), 1000);
}

async function nextCopyVariantIndex(tenantId: string, creativeId: string) {
  const result = await db.execute({
    sql: `SELECT COALESCE(MAX(variant_index), 0) + 1 as next_index FROM ad_copy_variants WHERE tenant_id = ? AND creative_id = ?`,
    args: [tenantId, creativeId],
  });
  return Number(result.rows[0]?.next_index || 1);
}

function validateDestinationUrl(input: DestinationInput) {
  const utmSource = cleanUtm(input.utmSource || 'meta');
  const utmMedium = cleanUtm(input.utmMedium || 'paid_social');
  const utmCampaign = cleanUtm(input.utmCampaign || 'ai_ad_manager');
  const utmContent = cleanUtm(input.utmContent || input.creativeId);
  const utmTerm = cleanUtm(input.utmTerm || '');

  try {
    const url = new URL(input.baseUrl.trim());
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { valid: false, finalUrl: input.baseUrl.trim(), error: 'Destination URL must use http or https.', utmSource, utmMedium, utmCampaign, utmContent, utmTerm };
    }
    url.searchParams.set('utm_source', utmSource);
    url.searchParams.set('utm_medium', utmMedium);
    url.searchParams.set('utm_campaign', utmCampaign);
    url.searchParams.set('utm_content', utmContent);
    if (utmTerm) url.searchParams.set('utm_term', utmTerm);
    return { valid: true, finalUrl: url.toString(), utmSource, utmMedium, utmCampaign, utmContent, utmTerm, error: null };
  } catch {
    return { valid: false, finalUrl: input.baseUrl.trim(), error: 'Destination URL is not a valid URL.', utmSource, utmMedium, utmCampaign, utmContent, utmTerm };
  }
}

function cleanUtm(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 120);
}

function extractPlanAds(plan: ParsedPlan) {
  const ads: Array<{ creativeId: string; adsetKey?: string; adKey?: string }> = [];
  const adsets = Array.isArray(plan.adsets) ? plan.adsets : [];
  for (const adset of adsets) {
    const adsetKey = stringValue(adset.key) || stringValue(adset.adset_key) || stringValue(adset.adsetKey);
    const adList = Array.isArray(adset.ads) ? adset.ads : [];
    for (const ad of adList) {
      const creativeId = stringValue(ad.creative_id) || stringValue(ad.creativeId);
      if (creativeId) ads.push({ creativeId, adsetKey, adKey: stringValue(ad.ad_key) || stringValue(ad.adKey) });
    }
  }
  const flatAds = Array.isArray(plan.ads) ? plan.ads : [];
  for (const ad of flatAds) {
    const creativeId = stringValue(ad.creative_id) || stringValue(ad.creativeId);
    if (creativeId) ads.push({ creativeId, adKey: stringValue(ad.ad_key) || stringValue(ad.adKey) });
  }
  return ads;
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
