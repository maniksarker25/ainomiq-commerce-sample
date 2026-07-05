# ainomiq Commerce

A modular operating system for e-commerce businesses. One authenticated workspace
with optional modules: Performance, Logic Ads, Creative OS, Smart Inventory,
Content Studio, Intelli Support, Library, and Wallet. Multi-tenant; connects a
business's tools (Shopify, Meta, Klaviyo, Twilio, Gmail) once and works from shared
business context.

**Stack:** Next.js 16 (App Router) · React 19 · libSQL/Turso · shadcn/ui + Tailwind 4 · OpenRouter (Gemini).

> **This is the v2 hardened copy.** See `docs/REMEDIATION-LOG.md` for what changed
> versus the original, `docs/ARCHITECTURE-AUDIT.md` for the full audit, and
> `docs/TECH-LEAD-BRIEF.md` for the open architectural work.

## Requirements
- Node.js 22+
- npm
- A Turso database (or `file:local.db` for local dev)

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your env file and fill it in:
   ```bash
   cp .env.example .env.local
   ```
   Generate the required secrets:
   ```bash
   openssl rand -hex 32   # ENCRYPTION_KEY
   openssl rand -hex 48   # JWT_SECRET
   ```
   See `SECURITY.md` for the secret model. **Never put real secrets in source.**
3. Run database migrations:
   ```bash
   npm run migrate:status   # see what's pending
   npm run migrate          # apply
   ```
4. Start the dev server (port 3001):
   ```bash
   npm run dev
   ```

## Scripts
| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server on :3001 |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |
| `npm run migrate` | Apply DB migrations |
| `npm run migrate:encrypt-tokens` | One-time: re-encrypt legacy plaintext tokens |

## Security
Read `SECURITY.md` before touching auth, tokens, webhooks, or cron. Key rules:
secrets only in env/Vercel, all third-party credentials encrypted at rest, every
query filters by `tenant_id`, webhooks verify signatures, cron requires a bearer secret.

## Documentation
- `docs/ARCHITECTURE-AUDIT.md` — full architecture audit (baseline, 11 Jun 2026)
- `docs/REMEDIATION-LOG.md` — every finding and its fix status
- `docs/TECH-LEAD-BRIEF.md` — open architectural work + candidate scoring
- `docs/ENGINEERING-STANDARDS.md` — how we build (read before your first PR)
- `SECURITY.md` — security model + secret rotation runbook
