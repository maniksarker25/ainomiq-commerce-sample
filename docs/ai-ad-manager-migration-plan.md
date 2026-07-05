# AI Ad Manager - Inventory, Turso Migration Plan, Build Plan

Owner: Rex
Status: phase 0 inventory complete, phase 1 ready
Scope: app-wide `app.ainomiq.com` product feature for all tenants
Hard rule: no live publish without explicit approval gate

## Goal

Build AI Ad Manager as a production-ready Meta Ads operating system inside app.ainomiq.com, reusing the existing Mission Control and ads-pipeline system instead of rebuilding from scratch.

End-to-end flow:

1. Generate creatives
2. Review and QC
3. Generate and select copy
4. Validate destination URL and UTM
5. Build draft adset plan
6. Approve per adset/ad
7. Publish through AdManage/Meta
8. Store upload results/errors
9. Pull performance
10. Recommend next tests, keep, kill or scale actions

## Existing system inventory

### Mission Control app

Path: `/Users/kaiclaw/.openclaw/workspace/apps/mission-control`

Relevant UI:

- `src/app/ads/page.tsx`
  - Current all-in-one ad workspace.
  - Uses 59 `fetch()` calls and 67 `/api/ads` references.
  - Covers generate, creatives, campaign, templates, QC-ish actions, upload and rerender controls.
- `src/app/ads/editor/page.tsx`
  - Template builder/editor.
  - Saves custom template designs.
- `src/app/ads/personas-tab.tsx`
  - Persona management UI.

Relevant API routes:

- Generation
  - `src/app/api/ads/generate/route.ts`
  - `src/app/api/ads/generate-video/route.ts`
  - `src/app/api/ads/render/route.ts`
  - `src/app/api/ads/rerender/route.ts`
  - `src/app/api/ads/outpaint/route.ts`
  - `src/app/api/ads/edit-text/route.ts`
- Products/content/templates/personas
  - `src/app/api/ads/products/route.ts`
  - `src/app/api/ads/shopify-products/route.ts`
  - `src/app/api/ads/shopify-images/route.ts`
  - `src/app/api/ads/product-content/route.ts`
  - `src/app/api/ads/product-content-status/route.ts`
  - `src/app/api/ads/template-designs/route.ts`
  - `src/app/api/ads/video-template-designs/route.ts`
  - `src/app/api/ads/personas/route.ts`
  - `src/app/api/ads/persona-hooks/route.ts`
  - `src/app/api/ads/generate-personas/route.ts`
  - `src/app/api/ads/generate-hooks/route.ts`
- QC/copy/approval
  - `src/app/api/ads/qc/route.ts`
  - `src/app/api/ads/copy/route.ts`
  - `src/app/api/ads/copy-check/route.ts`
  - `src/app/api/ads/generate-copy/route.ts`
  - `src/app/api/ads/approve/route.ts`
- Campaign/upload
  - `src/app/api/ads/campaign/route.ts`
  - `src/app/api/ads/campaigns/route.ts`
  - `src/app/api/ads/campaigns/create/route.ts`
  - `src/app/api/ads/campaigns/activate/route.ts`
  - `src/app/api/ads/adset-targeting/route.ts`
  - `src/app/api/ads/upload/route.ts`
  - `src/app/api/ads/upload-batch/route.ts`
  - `src/app/api/ads/upload-asset/route.ts`
- Performance/recommendations/workspaces
  - `src/app/api/ads/recommendations/route.ts`
  - `src/app/api/ads/score-assets/route.ts`
  - `src/app/api/ads/batches/route.ts`
  - `src/app/api/ads/workspaces/route.ts`
  - `src/app/api/ads/ai-optimize/route.ts`

Mission Control storage:

- `data/campaign-config.json`
- `data/personas.json`
- `data/qc-decisions.json`
- `data/qc-feedback.json`
- `data/product-content-links.json`
- `data/marco-decisions.json`
- `data/template-designs/*.json`
- `data/video-template-designs/*.json`

### ads-pipeline

Path: `/Users/kaiclaw/.openclaw/workspace/ads-pipeline`

Important JSON/state files:

- `creative-tracker.json`
  - Keys: `batches`, `content_used`, `champions`, `killed`, `fatigue_alerts`, `used_videos`, `creatives`.
- `ad_registry.json`
  - Keys: `created`, `campaign`, `campaign_name`, `ads`.
- `ad_set_registry.json`
  - Keys: `campaign_id`, `campaign_name`, `daily_budget_eur`, `status`, `effective_status`, `campaign_last_7d_metrics`, `ad_sets`, `evolution_log`, `last_evolution`, `last_scale_check`.
- `ad_approvals.json`
  - approval status by creative/ad id.
- `asset-catalog.json`
  - `videos`, `product_photos`, `reference_ads`.
- `content-tracking.json`
  - asset usage and fatigue tracking.
- `default_creative_brief.json`
  - personas, target counts, strategy, targeting.
- `output/batch_manifest.json`
  - generated creative manifest consumed by Mission Control routes.
- `output/generation_status.json`
  - local progress state.
- `output/<persona>/*.png|mp4`
  - generated creative assets.

Important scripts/modules:

- Creative generation/rendering
  - `scripts/batch_generate.py`
  - `scripts/batch_generate_v2.py`
  - `scripts/template_engine.py`
  - `scripts/custom_template_renderer.py`
  - `scripts/image_templates.py`
  - `scripts/video_templates.py`
  - `scripts/video_overlay_renderer.py`
  - `scripts/edit_text_render.py`
  - `scripts/text_boxes.py`
- Content/asset management
  - `scripts/content_manager.py`
  - `scripts/drive_content.py`
  - `scripts/persona_asset_scorer.py`
  - `scripts/shopify_image_fallback.py`
- QC and guardrails
  - `scripts/creative_qc.py`
  - `scripts/ad_guardrails.py`
  - `scripts/validate_batch.py`
- Upload/publish
  - `scripts/admanage_upload.py`
  - `scripts/upload_admanage.py`
  - `scripts/upload_to_meta.py`
  - `scripts/upload_v2.py`
  - `scripts/upload_batch_to_meta.py`
  - `scripts/build_full_batch.py`
  - `scripts/setup_fresh_adsets.py`
- Performance/intelligence
  - `scripts/deep_analysis.py`
  - `scripts/performance_feedback.py`
  - `scripts/evolve_ad_sets.py`
  - `scripts/daily_spend_alert.py`

### Existing app.ainomiq.com ads surface

Path: `/Users/kaiclaw/.openclaw/workspace/projects/ainomiq-integrations`

Current relevant app files:

- `app/dashboard/automations/page.tsx`
  - AI Ad Manager card currently exists and is active when `session.modules` contains `ads`.
- Existing Meta/ads APIs are read-only/performance-oriented:
  - `app/api/ads/campaigns/route.ts`
  - `app/api/ads/summary/route.ts`
  - `app/api/ads/insights/route.ts`
  - `app/api/ads/campaign-insights/route.ts`
  - `app/api/ads/persona-stats/route.ts`
  - `app/api/ads/ad-performance/route.ts`
  - `app/api/ads/stats/route.ts`
- Meta OAuth/token helpers:
  - `lib/meta.ts`
  - `app/api/auth/meta/*`
- Database:
  - `lib/db.ts` uses Turso via `@libsql/client`.
  - Current app tables include tenants, integrations, oauth_states, tenant_config, CS/logging tables.

## What to reuse

Reuse directly or adapt:

- Mission Control `/ads` UI concepts and workflow layout.
- Template editor data model from `data/template-designs` and `data/video-template-designs`.
- Python renderer stack: `template_engine`, `custom_template_renderer`, `image_templates`, `video_templates`, `edit_text_render`.
- `batch_generate.py` generation logic, but wrap it behind tenant-aware job records.
- `creative_qc.py`, `validate_batch.py`, `ad_guardrails.py` as validation modules.
- AdManage helper concepts from `src/lib/admanage.ts` and `scripts/admanage_upload.py`.
- Existing app `lib/meta.ts` for tenant Meta token retrieval.
- Existing app read-only Meta performance endpoints as source for performance snapshots.

Do not reuse as primary storage:

- JSON files in Mission Control or ads-pipeline.
- Local `output/generation_status.json` as source of truth.
- Local `ad_approvals.json` as source of truth.
- Local adset registries as source of truth after import.

## What must be rewritten

- All `/api/ads/*` routes need tenant auth via `requireAuth` and Turso-backed reads/writes.
- Generation job state must move from local JSON to Turso.
- QC decisions, feedback, selected copy, URLs, adset plans, approvals and publish jobs must move to Turso.
- Upload must be blocked by database gates:
  - creative status approved/upload_ready
  - selected copy exists
  - final destination URL valid
  - approval exists for exact ad/adset plan version
- Adset builder is new and must combine campaign structure, approved creatives, copy, URLs and performance learnings.
- Performance feedback loop must use tenant Meta integrations and store snapshots/recommendations per tenant.

## Turso schema plan

All tables must include `tenant_id` and timestamps. JSON columns are `TEXT` containing JSON.

### Core catalog

```sql
CREATE TABLE IF NOT EXISTS ad_products (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  external_product_id TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  title TEXT NOT NULL,
  handle TEXT,
  default_url TEXT,
  image_urls TEXT,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ad_personas (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  angle TEXT,
  targeting_rules TEXT,
  performance_summary TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, code)
);

CREATE TABLE IF NOT EXISTS ad_hooks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  persona_id TEXT,
  angle TEXT,
  hook_text TEXT NOT NULL,
  source TEXT DEFAULT 'generated',
  status TEXT DEFAULT 'active',
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ad_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  format_support TEXT,
  renderer TEXT NOT NULL,
  design_json TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Creative factory

```sql
CREATE TABLE IF NOT EXISTS ad_creative_batches (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  product_id TEXT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  requested_formats TEXT,
  persona_ids TEXT,
  hook_ids TEXT,
  template_ids TEXT,
  generation_params TEXT,
  started_at DATETIME,
  completed_at DATETIME,
  error TEXT,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ad_creatives (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  product_id TEXT,
  persona_id TEXT,
  hook_id TEXT,
  template_id TEXT,
  format TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  asset_url TEXT,
  local_asset_path TEXT,
  source_asset_refs TEXT,
  status TEXT NOT NULL DEFAULT 'generated',
  qc_status TEXT,
  final_asset_url TEXT,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ad_creative_versions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  creative_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  action TEXT NOT NULL,
  asset_url TEXT,
  local_asset_path TEXT,
  prompt_or_params TEXT,
  feedback TEXT,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### QC, copy, URL

```sql
CREATE TABLE IF NOT EXISTS ad_qc_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  creative_id TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  reviewer TEXT,
  feedback TEXT,
  rejection_reason TEXT,
  final_asset_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ad_copy_variants (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  creative_id TEXT NOT NULL,
  variant_index INTEGER NOT NULL,
  primary_text TEXT NOT NULL,
  headline TEXT NOT NULL,
  cta TEXT NOT NULL,
  policy_status TEXT DEFAULT 'unchecked',
  policy_notes TEXT,
  selected INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ad_destinations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  creative_id TEXT NOT NULL,
  base_url TEXT NOT NULL,
  final_url TEXT NOT NULL,
  utm_source TEXT DEFAULT 'meta',
  utm_medium TEXT DEFAULT 'paid_social',
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  valid INTEGER DEFAULT 0,
  validation_error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Campaigns, adsets, approvals, publish

```sql
CREATE TABLE IF NOT EXISTS ad_campaign_refs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  meta_campaign_id TEXT NOT NULL,
  name TEXT NOT NULL,
  objective TEXT,
  status TEXT,
  daily_budget_cents INTEGER,
  metadata TEXT,
  synced_at DATETIME,
  UNIQUE(tenant_id, meta_campaign_id)
);

CREATE TABLE IF NOT EXISTS ad_adset_refs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  meta_adset_id TEXT,
  campaign_ref_id TEXT,
  name TEXT NOT NULL,
  persona_id TEXT,
  angle TEXT,
  budget_cents INTEGER,
  targeting_json TEXT,
  placements_json TEXT,
  status TEXT,
  metadata TEXT,
  synced_at DATETIME,
  UNIQUE(tenant_id, meta_adset_id)
);

CREATE TABLE IF NOT EXISTS adset_plans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  campaign_ref_id TEXT,
  batch_id TEXT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  plan_json TEXT NOT NULL,
  reasoning TEXT,
  version INTEGER DEFAULT 1,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ad_approvals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  plan_id TEXT,
  creative_id TEXT,
  adset_key TEXT,
  ad_key TEXT,
  approved_by TEXT NOT NULL,
  approval_scope TEXT NOT NULL,
  approved_payload_json TEXT NOT NULL,
  diff_json TEXT,
  status TEXT NOT NULL DEFAULT 'approved',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ad_publish_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by TEXT,
  started_at DATETIME,
  completed_at DATETIME,
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ad_publish_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  publish_job_id TEXT NOT NULL,
  creative_id TEXT,
  adset_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admanage_asset_id TEXT,
  admanage_result_json TEXT,
  meta_campaign_id TEXT,
  meta_adset_id TEXT,
  meta_ad_id TEXT,
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Performance and audit

```sql
CREATE TABLE IF NOT EXISTS ad_performance_snapshots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  date_preset TEXT,
  spend REAL DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr REAL DEFAULT 0,
  cpc REAL DEFAULT 0,
  cpm REAL DEFAULT 0,
  lpv INTEGER DEFAULT 0,
  atc INTEGER DEFAULT 0,
  ic INTEGER DEFAULT 0,
  purchases INTEGER DEFAULT 0,
  cpa REAL DEFAULT 0,
  roas REAL DEFAULT 0,
  raw_json TEXT,
  captured_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ad_recommendations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  recommendation_type TEXT NOT NULL,
  severity TEXT DEFAULT 'info',
  title TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  suggested_action_json TEXT,
  status TEXT DEFAULT 'open',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME
);

CREATE TABLE IF NOT EXISTS ad_audit_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  actor TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  before_json TEXT,
  after_json TEXT,
  reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Import/migration plan

### Phase 0 - read-only inventory

Done in this document.

### Phase 1 - Turso schema and app scaffold

1. Add schema creation to `lib/db.ts` via an `initAdManagerDb()` helper called from `initDb()`.
2. Add `lib/ad-manager/db.ts` with typed helpers for catalog, batches, creatives, QC, copy, destinations, plans, approvals, publish jobs and audit log.
3. Add `lib/ad-manager/guardrails.ts` with gates:
   - no publish unless plan status approved
   - no publish unless every ad has approved creative, selected copy and valid URL
   - budget bounds: default EUR 10-20/day, scale max 15-20%, scale cooldown 48h
   - tenant ad account/campaign scope validation
4. Add `/dashboard/ads` or `/dashboard/automations/ai-ad-manager` route with tabs:
   - Generate
   - Review/QC
   - Copy & URL
   - Adset Plan
   - Approval
   - Publish
   - Performance Loop
5. Wire AI Ad Manager card to the new route.

### Phase 2 - import existing data

Create `scripts/import-ai-ad-manager-data.ts`:

- Import Mission Control template designs into `ad_templates`.
- Import video template designs into `ad_templates` with `kind='video'`.
- Import `data/personas.json` into `ad_personas`.
- Import `ads-pipeline/default_creative_brief.json` personas/hooks into `ad_personas` and `ad_hooks`.
- Import `ads-pipeline/asset-catalog.json` product/content references into `ad_products` metadata or later asset table.
- Import `ads-pipeline/creative-tracker.json` batches/creatives/champions/killed into `ad_creative_batches`, `ad_creatives`, `ad_recommendations`.
- Import `ads-pipeline/ad_set_registry.json` into `ad_campaign_refs`, `ad_adset_refs`, `ad_performance_snapshots`, `ad_recommendations`.
- Import `ads-pipeline/ad_approvals.json` into `ad_approvals` only as historical approvals, not current publish permission.

### Phase 3 - creative factory API

New app API namespace: `/api/ad-manager/*`.

Routes:

- `GET/POST /api/ad-manager/catalog/products`
- `GET/POST /api/ad-manager/catalog/personas`
- `GET/POST /api/ad-manager/catalog/hooks`
- `GET/POST /api/ad-manager/templates`
- `GET/POST /api/ad-manager/batches`
- `GET /api/ad-manager/batches/[id]`
- `POST /api/ad-manager/batches/[id]/generate`
- `GET /api/ad-manager/creatives`
- `POST /api/ad-manager/creatives/[id]/qc`
- `POST /api/ad-manager/creatives/[id]/rerender`
- `POST /api/ad-manager/creatives/[id]/outpaint`
- `POST /api/ad-manager/creatives/[id]/edit-text`

Implementation notes:

- First version can run local renderer jobs from Mac mini and persist every output row in Turso.
- Generated assets may remain file-backed initially, but Turso stores the authoritative asset URL/path/status/version.
- JSON files become cache/import/export only.

### Phase 4 - copy and URL

Routes:

- `POST /api/ad-manager/creatives/[id]/copy/generate`
- `POST /api/ad-manager/copy/[id]/select`
- `POST /api/ad-manager/creatives/[id]/destination`

Guardrails:

- primary text <= 125 chars target
- headline <= 40 chars target
- CTA in fixed allowlist: `SHOP_NOW`, `LEARN_MORE`, `GET_OFFER`, `SIGN_UP`, `CONTACT_US`
- block guaranteed claims, weird claims, direct `you` targeting
- URL must parse as http/https and match allowed tenant/product domains unless explicitly overridden by approved actor

### Phase 5 - adset planner

Routes:

- `POST /api/ad-manager/plans/generate`
- `GET /api/ad-manager/plans/[id]`
- `PATCH /api/ad-manager/plans/[id]`

Inputs:

- selected campaign
- approved creatives
- selected copy
- valid destinations
- tenant budget settings
- existing campaign/adset refs
- performance snapshots
- recommendation history

Output stored in `adset_plans.plan_json` with:

- campaign
- adsets
- ads
- statuses
- reasons
- guardrail warnings

### Phase 6 - approval and publish

Routes:

- `POST /api/ad-manager/plans/[id]/approve`
- `POST /api/ad-manager/plans/[id]/reject`
- `POST /api/ad-manager/publish-jobs`
- `POST /api/ad-manager/publish-jobs/[id]/retry`
- `GET /api/ad-manager/publish-jobs/[id]`

Publish must:

- validate exact approved plan version
- create publish job and items
- upload via AdManage where possible
- store per-item errors without blocking whole batch
- log every state transition to `ad_audit_log`

### Phase 7 - performance loop

Routes:

- `POST /api/ad-manager/performance/sync`
- `GET /api/ad-manager/recommendations`
- `POST /api/ad-manager/recommendations/[id]/resolve`

Recommendation rules:

- Never blind-kill on 0 purchases if CTR, CPC, LPV, ATC or IC show useful funnel contribution.
- Use data-thin state when spend/conversions are insufficient.
- Protect winners by default.
- Scale max 15-20% and no more than once per 48h.

## Acceptance gates for implementation

A build is not done until:

- `npm run build` passes.
- New DB schema initializes against local file DB and Turso env.
- UI route loads with authenticated session.
- Generated rows persist in Turso tables, not JSON.
- Upload button is disabled until approved creative, selected copy, valid URL and plan approval exist.
- Publish route refuses unapproved plans in automated tests or script-level checks.
- Errors appear in UI and `ad_audit_log`.

## Immediate implementation order

1. Commit this plan.
2. Add schema/helper layer.
3. Add AI Ad Manager route with the seven tabs and real Turso-backed empty states.
4. Add import script dry-run mode.
5. Add generation batch records and QC status update flow.
6. Add copy/URL flow.
7. Add planner and approval gates.
8. Add publish job shell with hard-blocked live publish until AdManage payload is complete and approval is verified.
