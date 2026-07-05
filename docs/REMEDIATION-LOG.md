# Remediatie-log — ainomiq Commerce v2

Dit document koppelt elke audit-bevinding (`docs/ARCHITECTURE-AUDIT.md`) aan een status.
Deze v2-codebase is een schone kopie van `ainomiq/app` (zonder git-historie, zonder de
scripts die secrets bevatten). Datum nulmeting: 11 juni 2026.

Legenda: ✅ opgelost in v2 · 🟡 gescaffold/gedocumenteerd, afmaken door tech lead · ⬜ openstaand (tech lead) · 🔑 vereist actie van Bink

---

## KRITIEK

| # | Bevinding | Status | Wat is gedaan |
|---|-----------|--------|---------------|
| K1 | Live secrets in git (fix-db.js e.a.) | ✅ + 🔑 | Alle 15 scripts met hardcoded secrets verwijderd; kopie heeft schone historie. **Bink moet de tokens nog roteren** (Turso, Twilio, Shopify, Klaviyo, Meta) — zie `SECURITY.md` runbook. De oude commits in de ORIGINELE repo bevatten ze nog. |
| K2 | Hardcoded wachtwoord in `coming-soon-auth/route.ts` | ✅ | Vervangen door `COMING_SOON_PASSWORD` env-var + timing-safe vergelijking; faalt dicht (503) als niet geconfigureerd. |
| K3 | Tokens plaintext in DB (Google-shortcut, stille fallback) | ✅ + 🟡 | `lib/encryption.ts` herschreven: geen provider-uitzondering meer, geen stille plaintext-fallback (faalt luid). Legacy plaintext-rijen migreren met `scripts/migrate-encrypt-tokens.ts` (🟡 runner aanwezig, draaien zodra DB-toegang met nieuwe key). |

## HOOG

| # | Bevinding | Status | Wat is gedaan |
|---|-----------|--------|---------------|
| H1 | Cron-endpoints open als CRON_SECRET ontbreekt | ✅ | `lib/cron-auth.ts` faalt nu dicht; vereist `Authorization: Bearer <CRON_SECRET>`; spoofbare `x-vercel-cron`-header niet meer als enig bewijs. |
| H2 | Webhooks zonder signature-check / dev-bypass | ✅ (Instagram) · ⬜ (Twilio) | Instagram-webhook verifieert nu altijd (geen dev-bypass), faalt dicht zonder secret. Twilio-webhooks: signature-verificatie nog toe te voegen (tech lead). |
| H3 | Achtergrond-taken synchroon op serverless (timeout-risico) | 🟡 | Ontwerp + aanpak in `docs/TECH-LEAD-BRIEF.md` (job-queue + idempotentie). Bewust niet blind herschreven: raakt e-mail/ads/content-publishing en is niet te valideren zonder de live integraties. |
| H4 | In-process `node-cache` + singleton DB-client op serverless | 🟡 | Gedocumenteerd in tech-lead-brief (externe cache / stateless connectie). |
| H5 | God-files (`ads/page.tsx` 5.190 r, `CreativeOsWorkspace.tsx` 5.027 r) | 🟡 | Decompositieplan in `docs/TECH-LEAD-BRIEF.md`. Niet blind opgeknipt: zonder werkende testsuite te riskant; eerste-veilige stap = tests, dan extractie. |
| H6 | Tokens inconsistent versleuteld | ✅ + 🟡 | Code-pad nu consistent (zie K3); bestaande data migreren via script. |
| H7 | Webhooks zonder idempotentie → dubbele records | ⬜ | Tech lead: idempotency-keys op alle webhook-handlers. |

## MEDIUM

| # | Bevinding | Status | Wat is gedaan |
|---|-----------|--------|---------------|
| M1 | Geen migratiesysteem | ✅ (fundering) | `db/migrations/` + runner `scripts/migrate.ts` toegevoegd; `001_baseline.sql` placeholder met instructie om huidig schema te dumpen. |
| M2 | Geen werkende tests | ✅ (fundering) | Vitest geconfigureerd; echte unit-tests voor de security-fixes (`lib/__tests__/`). De 51 nep-regex-"tests" blijven staan maar tellen niet als dekking — tech lead vervangt ze. |
| M3 | 488× `any`, strict omzeild | ⬜ | Tech lead: incrementeel uitfaseren; nieuwe code zonder `any` (zie standaarden). |
| M4 | Geen gestructureerde logging | ⬜ | Tech lead: Pino + trace-IDs; `console.*` uitfaseren. |
| M5 | Modulegrenzen alleen in DB-config | ⬜ | Tech lead: lazy-load + feature-flags per module. |
| M6 | Dynamische tabelnaam-interpolatie in SQL | 🟡 | Gedocumenteerd; allowlist staat vast dus geen acuut lek, maar patroon vervangen. |

---

## Wat bewust NIET is gedaan (en waarom)
De zware architecturale herschrijvingen (job-queue, god-file-decompositie, observability)
zijn **gescaffold en gedocumenteerd, niet blind uitgevoerd**. Reden: deze raken live
integraties (Shopify/Meta/Klaviyo/Twilio/Gmail) en er is geen werkende testsuite om een
herschrijving tegen te valideren. Een refactor van 5.000 regels zonder te kunnen draaien
introduceert meer risico dan hij oplost. Dit is precies het werk waarvoor de tech lead
wordt aangenomen — met de architectuur en standaarden uit deze docs als fundament.
