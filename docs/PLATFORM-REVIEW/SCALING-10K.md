# Schaalbaarheid naar ~10.000 gebruikers — assessment

**Eerlijke samenvatting:** de codebase is functioneel, maar **nu nog niet klaar voor 10k
actieve gebruikers**. De auth- en multi-tenant-fundering schaalt prima; de knelpunten
zitten in achtergrondverwerking, caching en database-doorvoer. Dit zijn bekende,
oplosbare problemen — maar het is echt bouwwerk (tech lead), geen configuratie-knop.

## Wat al wél schaalt
- **Stateless auth.** JWT-sessies, geen server-side sessiestore → schaalt horizontaal mee met Vercel-functions.
- **Multi-tenant isolatie.** Elke query filtert op `tenant_id`; geen gedeelde mutable state in de hot path van requests.
- **Vercel-hosting.** Functions schalen automatisch op aanvraagvolume.

## Knelpunten (moeten opgelost vóór 10k)
| # | Knelpunt | Waarom het breekt bij volume | Oplossing |
|---|----------|------------------------------|-----------|
| S1 | **Synchrone cron-jobs** (`cs-email`, `content-publish`, `ad-publish`) | Alle tenants in één 60s-run; bij honderden/duizenden tenants timeouts en gemiste runs | Job-queue (Vercel Queues / QStash) — per tenant/per item een job, met retries + dead-letter |
| S2 | **In-process `node-cache`** | Cache leeft per function-instance; bij autoscaling geen gedeelde cache → cache-misses, inconsistentie | Externe cache (Upstash Redis) |
| S3 | **Eén libSQL/Turso-DB, singleton client** | Single-writer; write-druk en connectie-hergebruik over parallelle instances worden een bottleneck | Turso read-replicas voor reads; schrijf-batching; connectie-aanpak herzien; query's met indexen op `tenant_id` |
| S4 | **Synchrone integratie-calls in request-handlers** (scraper, Drive, IMAP) | Externe API-traagheid/timeouts vertalen direct naar trage of mislukte requests | Verplaatsen naar workers/queue; circuit breakers + backoff |
| S5 | **Webhooks zonder idempotentie** | Bij volume veel platform-retries → dubbele records, data-corruptie | Idempotency-keys op alle webhook-handlers |
| S6 | **Geen rate-limit/back-pressure per tenant** | Eén zware tenant kan de gedeelde resources opslokken | Per-tenant rate limits + queue-prioritering |
| S7 | **Geen observability** | Bij 10k gebruikers zie je problemen pas als klanten klagen | Pino-logging + trace-IDs + Sentry + metrics op queue/cron |

## Concreet pad naar 10k (volgorde)
1. **Queue invoeren** (S1, S4) — grootste impact: maakt achtergrondwerk betrouwbaar en schaalbaar.
2. **Externe cache** (S2) — stateless maken.
3. **DB schalen** (S3) — read-replicas + indexen + write-batching; load-test met realistische tenant-aantallen.
4. **Idempotentie + per-tenant rate limits** (S5, S6).
5. **Observability** (S7) — vóór de groei, niet erna.
6. **Load testing**: simuleer 10k gebruikers / piekverkeer (k6 of Artillery) en meet p95-latency, foutpercentage, DB-doorvoer.

## Inschatting
Met een sterke tech lead + senior is dit een traject van **weken, niet dagen**. Het is
precies het werk waarvoor dit team wordt aangenomen. De fundering (auth, tenancy,
encryptie) staat nu goed genoeg om erop te bouwen — dat is de helft van de strijd.
