# Engineering Standards — ainomiq Commerce

Read this before your first PR. These are non-negotiables; everything else is taste.

## Security (hard rules)
1. **No secrets in source — ever.** Use `.env.local` / Vercel. If you find a secret in the repo, stop and tell Bink; it must be rotated.
2. **All third-party credentials are encrypted at rest** via `lib/encryption.ts`. Never store a token in plaintext, no provider exceptions.
3. **Every tenant-scoped query filters by `tenant_id`.** Use `requireAuth()` and verify the authenticated tenant owns the data. Never trust an ID from the request body alone.
4. **Webhooks verify signatures** and use idempotency keys. **Cron** endpoints require `Authorization: Bearer <CRON_SECRET>`.
5. **Validate input at the boundary.** `zod` is available — parse request bodies; don't destructure untyped JSON.

## Database
- Schema changes go in `db/migrations/NNN_description.sql` and run via `npm run migrate`. **No ad-hoc `ALTER TABLE` in application code.**
- Parameterised queries only (`?` placeholders). Never interpolate user input into SQL. Table names must come from a fixed allowlist, not from input.

## Background work
- Anything that takes more than a couple of seconds (AI calls, email batches, publishing) goes through the job queue, not inline in a request handler. Serverless functions time out.

## Code quality
- **No new `any`.** Type it or use `unknown` + a narrow. The existing `any` debt is being paid down, not added to.
- **No `console.log` in committed code** — use the structured logger (once added). Remove debug logs before PR.
- **Keep files focused.** If a file passes ~400 lines, that's a smell; split by responsibility. No new 5,000-line components.
- Components render; business logic lives in `lib/` services and is unit-testable.

## Testing
- New logic ships with a test. Real tests (Vitest) live in `__tests__/` next to the code. The legacy `/tests/*.test.mjs` regex files don't count and are being removed.
- CI (`.github/workflows/ci.yml`) runs typecheck, lint, tests, build on every PR. Green before merge.

## Git
- Small, descriptive commits. Branch + PR; no direct pushes to `main`.
- PRs are reviewed by the tech lead. IP belongs to ainomiq (see contract).
