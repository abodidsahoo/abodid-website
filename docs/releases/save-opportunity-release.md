# Save Opportunity 1.0.0 release audit and handoff

Audit date: 2026-10-30 (Asia/Kolkata; some tool timestamps are UTC October 29).

**Current result: website/API and allowance migrations deployed; local extension candidate rebuilt, not submission-ready.** No Store upload or publication has been performed. The [production rollout record](opportunity-production-rollout-2026-10-30.md) and current `CHROMEWEBSTORE.md` supersede the original local-only deployment statements below. The detailed audit retains historical test evidence and outstanding manual gates. Unrelated working-tree changes are excluded from the release.

## Files and architecture

- Extension: `extension/src/`, `extension/popup.html`, `extension/popup.css`.
- Manifest: `extension/manifests/chrome.json` → `extension/dist/chrome/manifest.json`.
- Build: `extension/vite.config.mjs`, Vite 6.4.1/Rollup, Node 24.22.1 for final verification. The shell's default Node 20 is older than the project's required Node 24; use Node 24 when reproducing.
- Runtime authentication dependency: `@supabase/supabase-js` / `@supabase/auth-js` 2.95.0, tree-shaken to the auth-only client. CSS and JS are local. Vite and node_modules are not shipped.
- Existing backend: Astro/Vercel APIs, Supabase Auth/Postgres/private attachment storage, durable capture jobs, server-only OpenRouter extraction.
- Packager: `npm run extension:package:chrome` → `extension/releases/save-opportunity-chrome-store.zip`, with `manifest.json` at ZIP root.
- Audit: `extension/releases/save-opportunity-1.0.0-audit.json` contains ZIP SHA-256, file hashes, byte sizes, source base commit and the exact built permissions/hosts. The working tree includes uncommitted edits; the base commit is not a claim that all changes are committed.
- Store copy, publisher details, permission explanations and privacy fields: root `CHROMEWEBSTORE.md`.
- Icon and screenshot handoff: `extension/store-assets/`.

## What passed / what changed

Existing MV3 architecture, popup design, Google PKCE flow, capture extraction prompt, tagging/category output, duplicate handling, durable receipts and model selection were retained. Production key configuration is deliberately isolated as described below. No payments or new product UI were added. No exposed privileged credential was found in the package or focused tracked-source scan; private-key marker matches were checked without printing values and did not contain valid embedded private keys.

Changes for release:

1. Chrome metadata now uses **Save Opportunity 1.0.0**. Existing 2.x versions were unpacked development candidates; the inspected Store publisher has no items. Firefox/Safari versioning was not reset.
2. Every production build rejects a non-abodid.com application origin, non-HTTPS/non-Supabase auth host and any non-public Supabase key, including service-role JWTs and secret keys. Development mode keeps the existing localhost option; AI extraction still requires its own dedicated key.
3. Built Chrome CSP explicitly allows local scripts and only the two existing application/auth network origins. No remote scripts, eval, new Function, CDN imports, always-on content scripts or external messaging are required.
4. Google identity callbacks must match the installed extension's expected origin and `/supabase-auth` path before the code is exchanged. Newer Chrome uses Origin when available; normalized URL comparison preserves Chrome 120 compatibility. No fabricated Store ID or publisher ID is embedded.
5. All OpenRouter opportunity extraction paths (URL capture including workers, text/attachments, re-extraction) require a server-only atomic allowance. Default **5 AI attempts per user per UTC calendar month**, **1 concurrent capture per user**, **4 globally**. Burst protection stays at 10/minute/user. Missing quota storage fails closed. No saved-record GET/import/duplicate access is gated by an AI quota.
6. New service-managed `opportunity_memberships.ai_monthly_limit` overrides the default for future entitlements; ordinary users cannot change it. Server setting zero pauses new AI for everyone. No payments/subscription implementation.
7. Usage and expiring leases live in two small service-only RLS tables. A short transaction advisory lock serializes admissions across serverless instances; leases release in finally and expire after 180 seconds after a crash. Provider extraction already uses two 28-second attempts with bounded retry delays and output capped at 300–2000 tokens (1200 default). Prompt/extraction behavior is unchanged.
8. Monthly exhaustion gives a nontechnical message confirming saved opportunities remain available, and is a final job error instead of repeated automatic retries until next month. Other transient failures retain existing bounded retry behavior.
9. Raw authenticated Data API inserts into the job queue are revoked in the migration. The API creates jobs with its service client only after verifying the actual Google/Supabase user; paid admission also checks `auth.users` and rejects anonymous identities. This closes the direct-insert route around API validation and anonymous-user rejection. Owner read access to receipts stays intact.
10. Production extraction now requires a dedicated `OPENROUTER_OPPORTUNITIES_API_KEY`, distinct from the site-wide key used by public experiments. Every environment requires the dedicated key; no shared-key fallback remains. The unauthenticated paid-model diagnostic GET at `/api/test-openrouter` is disabled in production. No keys were created, rotated or changed.
11. Targeted strict type checking found and fixed two existing reliability issues in the imported attachment/voice pipeline: video frame processing referenced an unimported `fileExtension` helper, and Google transcription used a field unsupported by the installed SDK. The helper is shared correctly and transcription now uses supported automatic-language configuration (`language_codes: []`), following https://ai.google.dev/gemini-api/docs/transcribe. No extraction/tagging prompt was changed.

**Accounting definition:** A capture is charged when server admission for AI processing succeeds. Failure after admission still counts because a provider may have incurred cost. The existing provider retry inside that extraction is included. A later request or durable-job retry is another admitted attempt. Existing saved URLs and reused curated records bypass AI and the allowance. This conservative initial trial is not a billing ledger; future paid plans may need idempotent reservation/settlement semantics.

**Deployment required:** Local migration `supabase/migrations/20261030034306_opportunity_ai_release_limits.sql` and the server changes have not been applied remotely. Until both are deployed, the new quota is not active in production. Before migration, new server code intentionally declines paid processing rather than running without a quota.

## Security findings and remaining blockers

### Relevant dependency advisories

`npm audit --omit=dev --json` reported **68 findings: 4 critical, 38 high, 21 moderate, 5 low** in the existing website dependency tree. Full registry evidence is retained in `save-opportunity-dependency-audit.json`. No advisories were returned for the installed Supabase auth packages in that report. These numbers are dependency findings, not proof that every issue is exploitable in this application.

Relevant server dependencies include Astro 5.17.1 (including reported image-optimization RCE advisory [GHSA-26w7-cxv4-gfx2](https://github.com/advisories/GHSA-26w7-cxv4-gfx2)), Undici 7.28.0 (multiple fetch/connection/parser advisories; fixed ranges in JSON), and Zod 3.25.x ([oversized constrained collection memory exhaustion](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)). Vite 6.4.1 also has development-server advisories and is not shipped as extension runtime code. Some remediation suggestions require major Astro/Zod migrations across the site. A blanket `npm audit fix --force` was deliberately not run: it could change the site's architecture and break unrelated workflows. **Review exploitability and upgrade affected backend/build dependencies before calling this production-secure.** This is an unresolved release gate, not a clean audit.

### Shared AI services and cost exposure

Several pre-existing public experiment endpoints (`/api/chat`, `/api/analyze-vision`, `/api/extract-emotions`, `/api/analyze-consensus`) use the generic site-wide OpenRouter key without this tracker’s authenticated monthly allowance. They are outside the extension workflow and were not converted into sign-in-only products. **Do not reuse that generic key for the production tracker.** The new extractor requires a distinct dedicated key, which you must create with its own limit and configure manually before deployment. The former `/api/test-openrouter` paid diagnostic now returns 404 in production. Public experiments can still affect the same account’s overall credit balance, so their budgets/rate limits need separate review.

The separate, pre-existing `src/pages/api/transcribe-audio.ts` is unauthenticated, accepts a client-selected paid transcription mode, and has no per-user allowance. It is used by the Punctum game, not by this Chrome extension, and uses OpenAI/Google transcription credentials rather than the OpenRouter extraction key. Telegram also transcribes voice before the opportunity extraction allowance. The new five-capture control bounds OpenRouter opportunity extraction; **it does not cap these separate transcription costs**. Restrict those endpoints/provider keys or add appropriate authenticated/anonymous product limits before wider release, especially if budgets are shared. The Punctum/voice access policy was not silently changed as part of this extension release. A supported Google transcription configuration was corrected during strict type checks.

### Live Supabase audit

Read-only project audit confirmed `saved_opportunities` and `opportunity_capture_jobs` have both RLS and FORCE RLS enabled. Saved CRUD policies and job SELECT/INSERT policies use `auth.uid() = user_id`; ordinary API requests verify tokens with `getUser`, reject anonymous identities, and use a request-scoped user client. Workers explicitly scope saved records/jobs to the initiating user. Memberships and counters are service-only.

Supabase Advisors have existing wider-project findings (5 security-definer views, mutable function search paths, callable definer functions, other warnings). The public profile view was inspected: it selects only public-facing columns, filters `is_public = true`, and contains no email/authentication column. The public import RPC has an explicit current-user destination and public-source filter; its definer permission is needed for that intentional snapshot operation. Service-only tables having no ordinary-user policy is deliberate denial, not a reason to add permissive policies. No live schema/permission changes were made.

References: [definer views](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view), [mutable search path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable). The shared project's other findings still need their own review. Do not represent the entire database as free of warnings.

### Account / browser gates

- Publisher Items page: no Store item exists; the production extension ID is therefore not yet available.
- The native Chrome UI confirmed unpacked ID `bikjdgkkefmflkanfmppnidfkdiblnpg` reloaded from 2.1.13 to 1.0.0 and retained its signed-in account/current-page popup. This is not a fresh install or new-user OAuth test.
- Chrome DevTools MCP could not connect because Chrome remote debugging was not enabled. This was not weakened/enabled automatically. Native UI inspection was used instead.
- Two genuine 1280×800 capture/result screenshots were **not exported**. The attempted native screenshot shortcut produced no file; no screenshots or results have been fabricated. Follow `extension/store-assets/README.md` after enabling a suitable capture workflow.
- Supabase public auth settings returned HTTP 200: Google provider enabled, signups enabled, anonymous sign-in enabled for other site features. The Opportunity API rejects anonymous users, and the local paid-admission migration independently rejects them. Google Cloud OAuth audience, new external-user onboarding, production Store-ID sign-in, two-account browser testing and live quota exhaustion remain manual gates. Evidence: `save-opportunity-auth-settings-check.json`.
- Automated GETs of the public privacy and opportunities pages returned HTTP 429. Existing production session API returned 401 without a token. Confirm the public policy loads in an ordinary reviewer browser; a previously published policy is not evidence that the new draft is deployed.

## Manual setup and release order

Prepare the dedicated key from step 4 before deploying. Coordinate steps 2 and 3 in a short maintenance window: the old API cannot enqueue after direct INSERT is revoked, and the new API declines paid processing until the quota RPC exists. Existing saved-record access is unaffected.

1. **Resolve the security findings above.** Keep OpenRouter isolated from unrelated public AI services with a dedicated server-side key if needed. Upgrade relevant dependencies with whole-site regression checks rather than a forced lockfile replacement.
2. **Supabase database:** Review the single new local quota migration, then apply it to project `jwipqbjxpmgyevfzpjjx` through the normal reviewed deployment process. Do not run a blanket `db push` without reviewing the repository's other pending migrations. It adds service-only usage/lease tables and a nullable membership entitlement column; it does not remove existing opportunities or change saved-record ownership policies. It deliberately removes direct authenticated client job creation; the verified API now inserts via its service client. Verify grants and run admissions under service_role only. Re-run security advisors.
3. **Vercel / server:** Deploy the accompanying rate-limit, URL/input/re-extraction and job handling changes together. Set server-only `OPPORTUNITIES_AI_MONTHLY_LIMIT=5`, `OPPORTUNITIES_AI_CONCURRENCY=4`; preserve existing model/prompt settings. Set the dedicated `OPENROUTER_OPPORTUNITIES_API_KEY` described in step 4; it must differ from `OPENROUTER_API_KEY` if that generic key remains configured. Keep all provider and privileged Supabase keys server-only (no PUBLIC_/VITE_ prefix). Missing or reused production capture keys fail closed. Verify job worker/cron/cleanup scheduling and that an unauthenticated POST returns 401. The extension ZIP does not include a server deployment.
4. **OpenRouter:** Create a distinct tracker-only key in OpenRouter and give it an explicit USD credit limit and monthly reset appropriate to the tester budget. Configure it on the server as `OPENROUTER_OPPORTUNITIES_API_KEY`; do not reuse the public experiments’ generic key. No key was created or rotated in this task. Do not use an unlimited key for a trial. The key API supports `limit` and `limit_reset` ([official fields](https://openrouter.ai/docs/api/api-reference/api-keys/update-keys)). No amount was guessed and no account/key setting was changed in this task. Update only the server secret and deploy the reviewed server changes. Confirm permitted models/providers and their retention/privacy choices. A provider cap is separate from the per-user allowance; a 402 must produce the ordinary extraction failure UI and keep existing saved records accessible.
5. **Chrome Developer Dashboard:** Open the existing publisher `50c87b47-caf5-4af7-902d-2252deff2750`, choose Items → Add a new item, and manually upload `extension/releases/save-opportunity-chrome-store.zip`. Leave it a draft. This obtains the actual 32-letter extension ID. Do not upload a historical 2.x package first if you want to start at 1.0.0. No service account or publishing API is necessary.
6. **Supabase Auth → URL Configuration:** Keep the current Site URL `https://abodid.com` and all required existing website/development callbacks. Add exactly `https://<STORE_EXTENSION_ID>.chromiumapp.org/supabase-auth` using the actual Store ID. Keep the unpacked callback `https://bikjdgkkefmflkanfmppnidfkdiblnpg.chromiumapp.org/supabase-auth` for development; do not replace it or use the publisher UUID as an extension ID. Avoid wildcard chromiumapp.org redirects.
7. **Google Cloud Console / Google Auth Platform:** This code uses Supabase's web OAuth flow, **not** `chrome.identity.getAuthToken` and not a manifest `oauth2.client_id`. Keep the Web application OAuth client's authorized redirect URI `https://jwipqbjxpmgyevfzpjjx.supabase.co/auth/v1/callback` exactly. **Do not add chromiumapp.org as a Google redirect URI or create an extension-type OAuth client just for this architecture.** The Store-specific redirect belongs in Supabase, after Google's Supabase callback. Check that Supabase's Google provider contains the matching web client ID/secret (never paste them into the extension).
8. **Google audience/scopes:** Audience must be External for ordinary users. While its publishing status is Testing, add every initial tester Google account and arrange reviewer access; otherwise use the appropriate production audience/verification process. Confirm new signups are enabled in Supabase and no auth hook/domain allowlist limits the app to the developer. Data access is only `openid`, email and profile. Do not add Gmail/Drive/Calendar/Contacts. Review branding, authorized domain `abodid.com`, support email and policy URL.
9. **Test the actual Store identity:** In the Store draft Package view, copy its **public key**. Add that public key as the Chrome manifest's `key` for a separate unpacked Store-identity test build, rebuild, and load it in a clean test profile. Record that `chrome.runtime.id` equals the assigned ID and `identity.getRedirectURL('supabase-auth')` equals the allowlisted URL. This key is public identity material, not a private signing key. Do not invent/generate a substitute key. Preserve a separate keyless development build if you need the existing local ID. The final uploaded ZIP can include the same verified public key; regenerate its audit if changed.
10. **Complete browser checks and assets:** Use two ordinary Google accounts with independent private trackers, exercise the cases in the testing report, and export actual capture/result screenshots. The first Store-installed version must also be tested through Private/trusted testers once reviewed.
11. **Publish policy and fill submission fields:** Review the local privacy draft and `src/pages/privacy.astro`, publish accurate provider/retention/usage wording to `https://abodid.com/privacy`, then paste the copy and disclosures from `CHROMEWEBSTORE.md`. Add required 128×128 icon and genuine screenshots. Configure Distribution → Private → Only trusted testers and add tester addresses. Verify Google audience and Store testers are two different allowlists. Do not select Public accidentally.
12. **Reviewer access and manual submission:** Fill test instructions below, ensure authenticated features can actually be reached, save the draft, review all fields and manually submit. Publishing remains your action.

## Reviewer instructions

Paste/adapt only after the gates are complete:

> Save Opportunity saves a deliberately selected public opportunity page or link into the user's own private tracker. Install the extension, open the toolbar popup and select Continue with Google. Use a Google account permitted by our current OAuth audience/test release. No payment is required. We request only basic account identity, email and profile; no Gmail/Drive/Calendar/Contacts access.
>
> Open a publicly accessible opportunity page (for example a current open call or job at jobs.ac.uk). Choose Save opportunity. After the capture is accepted, reopen the popup to observe progress and the saved result, then select View your dashboard. Compare the source title, category, organisation and deadline with the source page. AI details require review. Save the same URL again; it should report already saved and preserve edits. The current trial allows five AI processing attempts per account per UTC calendar month. Existing saved pages remain accessible after the trial allowance is used. Log out to end the local extension session.
>
> To test account separation, sign in with a second permitted Google account: it receives its own tracker. Public collections are deliberately public; private saved opportunities are user-scoped. If access is blocked by the test audience, contact hello@abodid.com through the review channel so access can be arranged. No provider/API secret is needed or should be supplied.

If the review team cannot use its own account under the test configuration, **do not claim these instructions work**. Use the Dashboard's supported review-access channel to arrange a dedicated ordinary test account/audience configuration before submission. Do not expose a personal Google password, remove authentication, add a privileged bypass, or place any credentials in listing copy, source or ZIP.

## Testing report

| Check | Result / limits |
|---|---|
| Full opportunity suite | 189 tests passed across 26 files after release changes, including build rejection, production key isolation and disabled diagnostic tests. Mocked provider/browser behavior is identified as such. |
| Targeted strict TypeScript | Passed for the extension auth and changed server capture/quota/API dependency graph, including the attachment/voice fixes. This is not a claim that every unrelated site file passes a full repository type check. |
| Website production build | Passed with Node 24.22.1; ordinary existing content/catalog fallback warnings remain. No deployment. |
| Extension production build | Passed; source maps disabled, exact MV3 permissions/hosts and asset paths checked by packager. |
| Fresh install | Not completed. Existing unpacked installation reloaded to 1.0.0 without losing the stored sign-in. |
| Google sign-in/out | PKCE/auth network refresh, outage recovery, logout/account-state and exact callback checks covered by tests; fresh external Google OAuth and Store-ID sign-in/out not completed. |
| User-specific save / duplicate | Automated insert-race/idempotency/account-state checks pass. Native signed-in popup/current UCL page inspected. No new live save is claimed. |
| AI extraction / categories | Existing extractor/concurrency/date/schema tests pass with mocked OpenRouter responses; extraction prompt/model defaults unchanged. A paid live capture is not claimed. |
| Expired authentication | Auth client tests cover expired-token refresh, token rotation and offline recovery; no forced expiry against the user's live Google session. |
| Invalid/inaccessible webpages | Existing URL/capture tests cover restricted protocols, unsafe fetch targets, wrappers and failure handling; source scraper pins validated public DNS, bounds redirects/body/timeouts. |
| Anonymous API access | Local capture, capture-jobs, extract-input, re-extract endpoints and production session probed without a bearer token; expected 401. Results in `save-opportunity-http-checks.json`. |
| Monthly quota / concurrency | 16 isolated PostgreSQL/PGlite checks pass using actual new migration and existing saved-record policies: five admissions, sixth denied, independent users, per-user/global concurrency, busy no charge, release/expiry recovery, zero kill switch, month reset, service-only ACL, enforced entitlement overrides, anonymous denial, direct client job-insert denial and foreign-user read/update denial. Single embedded DB verifies SQL behavior; distributed multi-instance contention/live deployment still needs staging verification. |
| Saved access after quota | Verified with actual isolated Postgres policies, after the fifth admission. |
| API/provider failure | Existing mock tests plus new fail-closed quota tests; live OpenRouter depleted-key/budget scenarios not forced. |
| Two real users | SQL policy isolation and mocked account-change tests pass; two real fresh Google users in separate browser profiles not completed. |
| Production permissions | Built allowlist verified; installed extension reload inspected. Store-installed permission prompt not yet testable. |
| Genuine Store screenshots | Not completed; two exports remain a required asset gate. No fabricated images supplied. |

Reproduce the isolated SQL checks without changing project dependencies:

```sh
npm install --prefix /tmp/save-opportunity-release-tools --no-save --ignore-scripts @electric-sql/pglite@0.5.13
node scripts/test-opportunity-release-sql.mjs /tmp/save-opportunity-release-tools/node_modules/@electric-sql/pglite/dist/index.js
npm run test:opportunities
npm run build
npm run extension:package:chrome
```

The SQL runner creates an in-memory database and fixtures, loads the actual migration/ownership policy SQL, and discards it. It never connects to Supabase. Use Node 24 for the project commands.

Before testers: additionally verify a real inaccessible page, duplicate save, worker interruption, Google cancellation/expiry, ordinary provider outage, quota exhaustion on an ordinary account, session persistence after Chrome restart, and two-user access isolation. Record actual outcomes instead of checking them off in advance.

## Next update: 1.0.1

Use the **same Store item**. Bump only the Chrome manifest to 1.0.1, update root listing/version history, keep its Store public key/identity and OAuth redirect unchanged, run tests/build/package, and upload the complete new ZIP through that existing item's Package → Upload new package. Refresh screenshots/disclosures if behavior changed and manually submit for review. Do not create a new item or regenerate the Store identity. The update should preserve extension-local Supabase session storage keys and user data. If permissions expand, document why and test the new consent/update behavior.
