# Tech Lead Brief — ainomiq Commerce

Dit is het mandaat voor de tech lead die we aannemen. Het beschrijft de openstaande
architecturale ankers en dient tegelijk als **scoringskader voor kandidaten**: geef
kandidaten de audit (`docs/ARCHITECTURE-AUDIT.md`) en zie of ze zelfstandig tot
vergelijkbare of diepere conclusies komen.

## Context
ainomiq Commerce is een modulair e-commerce-OS (Next.js 16, React 19, libSQL/Turso,
OpenRouter). ~165 API-routes, 10 modules, veel live integraties (Shopify, Meta,
Klaviyo, Twilio, Gmail/IMAP, R2). De frontend staat; de backend heeft architecturale
schuld. De kritieke security is in v2 al gerepareerd (zie `docs/REMEDIATION-LOG.md`).

## Openstaande ankers (jouw eerste kwartaal)
1. **Job-queue voor achtergrondwerk.** `api/cron/cs-email`, `content-publish`, `ad-publish`
   doen ophalen + AI + versturen synchroon binnen één 60s-request → timeouts en stille
   mislukkingen. Ontwerp: queue (bv. Vercel Queues, Upstash QStash of BullMQ) met
   per-item jobs, retries met backoff, dead-letter, en idempotency-keys. E-mail-ingestie
   en publishing splitsen in enqueue → worker.
2. **Idempotente, geverifieerde webhooks.** Alle webhook-handlers (Twilio nog open):
   signature verifiëren + idempotency-key per event om dubbele records te voorkomen.
3. **Stateless op serverless.** `node-cache` vervangen door externe cache (Upstash Redis);
   DB-client-singleton herzien zodat er geen state lekt tussen parallelle instances.
4. **God-files opknippen.** `app/dashboard/ads/page.tsx` (5.190 r) en
   `creative-os/components/CreativeOsWorkspace.tsx` (5.027 r). Veilige volgorde:
   eerst tests rond huidig gedrag → types extraheren → tabs/secties als eigen
   componenten met eigen state → server-logic naar `lib/`-services. Niet in één keer.
5. **Migraties.** `db/migrations/` + `scripts/migrate.ts` zijn opgezet; vul `001_baseline.sql`
   met het huidige schema (dump via Turso) en zet alle toekomstige schemawijzigingen als
   genummerde migraties. Geen ad-hoc `ALTER TABLE` in `lib/db.ts` meer.
6. **Observability.** Pino-logger met trace-IDs i.p.v. 233× `console.*`; error-tracking
   (Sentry); LLM-kosten en prompt-versies vastleggen.
7. **Type-discipline.** 488× `any` incrementeel uitfaseren; nieuwe code zonder `any`.
8. **Echte testdekking.** Vitest staat klaar (`lib/__tests__/`); de 51 nep-regex-"tests"
   in `/tests` vervangen door echte unit-/integratietests, en een CI-workflow toevoegen.

## Scoringskader voor kandidaat-audits
Geef de kandidaat read-only repo-toegang (ná NDA en ná token-rotatie) en de opdracht:
"audit deze codebase, prioriteer de top-5 risico's met aanpak."

- **Sterk (tech lead):** vindt de plaintext-token-opslag, de serverless-cron-timeouts en
  de ontbrekende webhook-idempotentie; beoordeelt de multi-tenant-isolatie correct als
  *wél* op orde (geen vals alarm); stelt een gefaseerde, testbare aanpak voor.
- **Middelmatig:** noemt vooral oppervlakkige zaken ("bestanden te groot", "geen tests")
  zonder de echte productie-risico's te raken.
- **Zwak:** mist de security-issues of roept vals alarm over de auth-laag.
