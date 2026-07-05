# Architectuur-audit — ainomiq Commerce (SaaS)
**Datum:** 11 juni 2026 · **Repo:** github.com/ainomiq/app · **Stack:** Next.js 16, React 19, libSQL/Turso, shadcn/Tailwind 4, OpenRouter (Gemini)
**Door:** Hermes baseline-audit (nulmeting vóór hiring tech lead) · 466 TS/TSX-bestanden, 26 MB, ~165 API-routes

> Dit is de baseline. Vergelijk kandidaat-audits hiertegen: wie dieper graaft dan dit is je tech lead, wie minder vindt is het niet.

## Eindoordeel
Het product is ambitieus en breed (10 modules, veel integraties) en de frontend staat. Maar onder de motorkap is dit een snel gegroeid monoliet met **kritieke beveiligings- en deploymentrisico's**. Productieklaarheid nu: **~3/10.** De auth-basis is verrassend solide (sterke password-hashing, correcte multi-tenant isolatie), maar er staan live secrets in de repo, tokens deels plaintext in de database, en de zware achtergrond-taken (e-mail, publishing) zijn op serverless fragiel. Geen werkende tests. Dit is goed te repareren, maar het moet gebeuren vóór je nieuwe klanten aansluit.

---

## KRITIEK — deze week oplossen

### 1. Live credentials in de git-repo
Zes scripts in de root bevatten echte secrets en staan in git: `fix-db.js`, `add-integrations.js`, `disable-klaviyo.js`, `revoke-klaviyo.js`, `configure-twilio.mjs`, `_check-twilio.ts`.
Gevonden: Turso database-URL + auth-token, Twilio account SID + auth-token, Shopify/Klaviyo API-keys, en een klant-tenant (`pimsmit@billiejeans.eu`).
**Impact:** iedereen met repo-toegang (en straks 2-3 BD-kandidaten!) heeft volledige database- en integratietoegang. **Actie:** alle genoemde tokens roteren, scripts uit de repo halen, en — omdat ze in de historie staan — secrets als gecompromitteerd beschouwen. Zie urgente actielijst onderaan.

### 2. Hardcoded wachtwoord in endpoint
`app/api/coming-soon-auth/route.ts:3-4` — wachtwoord `"tesstainomiq"` staat plain in de code. Vervangen door env-var + hash.

### 3. Tokens deels plaintext in de database
`lib/encryption.ts:40-42` geeft Google-tokens (`ya29.`, `1//`) ongeëncrypt terug; IMAP e-mailwachtwoorden (`cs_imap_password`) staan plaintext in `tenant_config`; bij ontbrekende `ENCRYPTION_KEY` valt opslag stil terug op plaintext (`add-integrations.js`). AES-256-GCM bestaat wél, maar wordt omzeild. **Actie:** alles versleutelen, plaintext-fallback verwijderen (hard falen i.p.v. stil plaintext opslaan).

---

## HOOG — vóór opschalen

- **Achtergrond-taken fragiel op serverless.** `api/cron/cs-email`, `content-publish`, `ad-publish` doen e-mail ophalen + AI-inferentie + versturen synchroon in één request (`maxDuration=60s`). Bij >10-15 items timeout → stille mislukking, geen retry/queue. Idem de Twilio voice-webhook die live spraakherkenning in de handler doet. **Nodig:** echte job-queue (bv. Vercel Queues / BullMQ + idempotentie).
- **Webhooks zonder of met uitschakelbare signature-check.** Instagram-webhook slaat verificatie over buiten productie; Twilio-webhooks verifiëren niet. Geen idempotentie → platform-retries maken dubbele records. **Nodig:** altijd signature verifiëren + idempotency-keys.
- **In-process cache + singleton DB-client op serverless.** `node-cache` en een module-singleton DB-client werken lokaal, maar lekken/falen over parallelle Vercel-instances. **Nodig:** externe cache (Redis/Upstash) en stateless connectie-aanpak.
- **God-files.** `ads/page.tsx` (5.190 regels) en `CreativeOsWorkspace.tsx` (5.027 regels) — onhoudbaar, niet te reviewen, niet te testen. Opknippen.
- **Tokens inconsistent versleuteld** (Meta/Klaviyo/Shopify): mix van encrypted en plaintext in dezelfde tabel → geen compliance-garantie.

---

## MEDIUM — technische schuld

- **Geen migraties.** Schema via `CREATE TABLE IF NOT EXISTS` + ad-hoc `ALTER TABLE` in `lib/db.ts`; handmatige reparatie via `fix-db.js`. Nodig: migratieframework (Drizzle/Prisma-migrate).
- **Geen werkende tests.** De 51 `*.test.mjs` grep'en broncode met regex i.p.v. gedrag te draaien; `npm test` faalt by design; geen CI. Effectief 0% dekking.
- **TypeScript strict maar omzeild:** 488× `any` (o.a. dashboard-state volledig untyped).
- **Modulegrenzen ontbreken in code.** De 10 productmodules bestaan alleen als DB-config; UI laadt altijd alles, geen lazy-load/feature-flags per module.
- **SQL: dynamische tabelnaam-interpolatie** in COUNT-queries (`SELECT … FROM ${table}`) — nu veilig via hardcoded lijst, maar fragiel patroon.
- **Geen gestructureerde logging/observability:** 233× console.log/error, geen trace-IDs, geen error-tracking (Sentry), geen LLM-kosten/prompt-versioning.
- **Dubbele backend-paden** (Supabase REST naast Turso) zonder schone abstractie.
- **Klaviyo-churn:** `disable-klaviyo.js` + losse review-docs wijzen op een half-uitgefaseerde integratie — roadmap-status verduidelijken.

## Positief (behouden)
- Password-hashing PBKDF2-SHA512, 100k iteraties, random salt — modern.
- JWT correct: HttpOnly (prod), Secure conditioneel, SameSite=Lax, 30d TTL + refresh.
- Multi-tenant isolatie via `requireAuth()` consistent; geen IDOR gevonden in steekproef.
- Rolautorisatie (owner/operator/editor) server-side afgedwongen.
- Security headers goed geconfigureerd; git-discipline en commit-messages netjes (team: Pim Smit, Ashar Mehmood + bot).

## Productieklaarheid: 3/10
Auth ✓ · multi-tenancy ✓ · security headers ✓ — maar tests ✗ · secrets-hygiëne ✗ · achtergrond-architectuur ✗ · observability ✗ · type-discipline ✗.

## Aanbevolen herstelvolgorde
1. **Nu:** secrets roteren + scripts verwijderen (zie onder). 2. Encryptie sluitend maken. 3. Job-queue voor cron/webhooks + idempotentie. 4. Migratieframework. 5. Externe cache. 6. God-files opknippen. 7. Echte tests + CI. 8. Observability.
