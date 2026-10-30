# Opportunity production rollout — 30 October 2026

The approved Opportunity website/API changes were deployed to the existing abodid-website Vercel project and promoted to abodid.com. The Chrome Web Store package was not rebuilt, uploaded or published. The existing generic OpenRouter key remains configured for other site features.

## Code and release scope

`src/lib/opportunities/extractor.ts` requires `OPENROUTER_OPPORTUNITIES_API_KEY` in every environment. It never falls back to the generic site key, and rejects reusing the same configured key. The existing provider/model choices and extraction prompt are preserved.

Deployment used an isolated HEAD snapshot with only these approved Opportunity-related paths overlaid:

- `src/components/opportunities/`
- `src/lib/opportunities/`
- `src/pages/opportunities/`
- `src/pages/api/opportunities/`
- `src/pages/api/admin/opportunity-users/`
- `src/components/admin/OpportunityUsers.jsx` and `opportunity-users.css`
- `src/pages/api/integrations/telegram/webhook.ts`
- `src/styles/opportunities-editorial.css`
- `src/pages/privacy.astro`
- `src/lib/audio/transcribeAudio.ts`
- `src/pages/api/test-openrouter.ts`

Unrelated working-tree analytics, moodboard, extension and skill edits were not included. No local environment files were copied into this release. Vercel supplied the existing project's Production configuration.

Deployment: `dpl_DhGszsmPwmrQbL2SoinPYgVoQMEz`

Immutable URL: https://abodid-website-9bf76jsth-abodid-sahoos-projects.vercel.app

Production: https://abodid.com/opportunities

## Database changes applied

Project: `jwipqbjxpmgyevfzpjjx`.

1. `20261030034306_opportunity_ai_release_limits.sql`: monthly AI usage, concurrency leases, entitlement override and service-only admission RPCs.
2. `20261030034315_opportunity_capacity_and_support.sql`: 100-item capacity guard, support requests, admin allowance/audit functions.
3. `20261030034917_opportunity_server_only_intake_activation.sql`: removes direct authenticated job insertion. This was deliberately applied after the new service-inserting API went live, preserving existing capture availability during deployment.

Local migration filenames match the verified live migration history. No existing saved records or user allowances were deleted or reset.

## Verification

- 198 opportunity tests passed across 28 files, including dedicated-key-only behavior in development as well as production.
- 22 isolated PostgreSQL checks passed using all three migration files.
- Vercel remote production build reached Ready and promotion succeeded.
- The live allowance API returns 401 without authentication; the old deployment had returned 404 for that route.
- Live monthly admission with a zero allowance returned `allowed=false, reason=monthly` inside a rolled-back transaction. No provider request or persisted user usage was created by this check.
- Live privileges verify ordinary users cannot directly insert jobs, call paid admission or change allowances; the service role can call admission.
- All four new private tables have RLS and FORCE RLS. Advisors report only expected INFO notices for their intentionally absent ordinary-user policies; no permissive policy was added.

## Secret verification limitation

The dedicated Production variable exists as a protected Vercel secret. Vercel CLI exports sensitive values as `[SENSITIVE]` placeholders. An early read-only OpenRouter check therefore tested a placeholder and returned 401; that result was discarded and is not evidence that the actual key is invalid. No secret value was printed or committed, and downloaded temporary environment files were deleted. The actual protected key's validity, difference from the general key and provider spending cap were not independently verified through that export. Runtime code fails closed if the dedicated key is missing or reused.

No paid AI capture or real support email was triggered in this rollout. Next functional check: sign in on the production site and save one new public opportunity, then confirm the result and its incremented monthly usage. The dependency/security findings, two genuine Store screenshots and Store identity/OAuth/reviewer gates documented in the release handoff still apply; this rollout is not Chrome Store approval.

Follow-up HTTP probes: an anonymous POST to the production capture-jobs endpoint returned 403, and an anonymous admin-directory GET returned 429. These may reflect request/origin or infrastructure filtering and are not claimed as successful authenticated application tests. The allowance endpoint's 401 and the verified live database grants remain the confirmed checks. Use an ordinary signed-in browser for the end-to-end capture test.

## Admin confirmation and usage follow-up

Applied additive migration `20261030040657_opportunity_admin_increment_allowance.sql`. Admin Users now has monthly/remaining/total tracked usage, +5/+10 or exact allowance controls, and a mandatory review popup before any credit update. The API sends the reviewed allowance to a locked database comparison; stale confirmations return a conflict. Existing usage is preserved and changes remain audited. A live rollback-only transaction verified the confirmed update, audit, unchanged usage and stale rejection without committing any allowance changes. Local verification passed 218 opportunity tests and 30 SQL checks, plus strict admin API type checks and native-dialog desktop/320px keyboard checks.

Final admin deployment: `dpl_BfQvyHQXkTMeLve8uXbaABSDjc88`, `https://abodid-website-nlh7y2pot-abodid-sahoos-projects.vercel.app`. Vercel reported Ready and successful production promotion. The isolated snapshot overlaid only the five admin runtime files onto the previously released snapshot. A subsequent unauthenticated `/admin` HTTP smoke probe received infrastructure HTTP 429, so an authenticated production UI test is not claimed. Native UI verification used the real component with synthetic local data; live database behavior was verified in a rolled-back transaction.
