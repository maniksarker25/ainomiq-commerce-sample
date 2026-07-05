# Security — ainomiq Commerce

## Beveiligingsmodel
- **Secrets** staan uitsluitend in `.env.local` (lokaal) of Vercel Project Settings — nooit in source. `.gitignore` blokkeert alle `.env*`-varianten.
- **Credentials van derden** (OAuth-tokens, API-keys, IMAP-wachtwoorden) worden versleuteld opgeslagen met AES-256-GCM (`lib/encryption.ts`). Geen enkele provider is uitgezonderd.
- **Wachtwoorden** van gebruikers: PBKDF2-SHA512, 100k iteraties, random salt.
- **Sessies**: JWT (`jose`), HttpOnly + Secure (prod) + SameSite=Lax.
- **Multi-tenancy**: elke API-route valideert via `requireAuth()` dat de tenant in het JWT overeenkomt met de opgevraagde data. Nieuwe queries MOETEN altijd op `tenant_id` filteren.
- **Cron**: alleen met `Authorization: Bearer <CRON_SECRET>` (faalt dicht).
- **Webhooks**: signature altijd verifiëren (Meta/Instagram gedaan; Twilio open — zie remediatie-log).

## 🔑 RUNBOOK — secrets roteren (Bink, vóór de repo gedeeld wordt)
De oude tokens stonden in de git-historie van de originele repo. Behandel ze als gelekt en roteer:

1. **Turso** — `turso db tokens create <db>` voor een nieuw auth-token; oude intrekken met `turso db tokens revoke`. Zet `TURSO_AUTH_TOKEN` in Vercel.
2. **Twilio** — Console → Account → API keys & tokens → Auth Token roteren (Secondary promoten, oude verwijderen). Update `TWILIO_AUTH_TOKEN`.
3. **Shopify** — Partner/Admin → app credentials → API secret opnieuw genereren. Update `SHOPIFY_API_SECRET` / `SHOPIFY_CLIENT_SECRET`.
4. **Klaviyo** — Account → Settings → API keys → oude private key intrekken, nieuwe maken. Update `KLAVIYO_API_KEY`.
5. **Meta** — App Dashboard → Settings → app secret resetten. Update `META_APP_SECRET`.
6. **Nieuwe `ENCRYPTION_KEY` + `JWT_SECRET`** genereren (`openssl rand -hex 32` / `-hex 48`). Let op: een nieuwe `ENCRYPTION_KEY` maakt bestaande versleutelde tokens onleesbaar — eerst de re-encryptie-migratie plannen (zie `scripts/migrate-encrypt-tokens.ts`).

Na rotatie: oude waarden zijn waardeloos, ook al staan ze nog in oude commits.

## Een nieuw secret melden
Vind je een secret in de code? Niet committen, direct bij Bink melden en roteren.
