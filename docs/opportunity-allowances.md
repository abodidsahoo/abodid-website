# Opportunity allowances and onboarding

Deployed to abodid.com on 30 October 2026. The two schema migrations and separate server-only intake activation are applied. The ZIP has not been regenerated. See `docs/releases/opportunity-production-rollout-2026-10-30.md` for the verified rollout record; it supersedes earlier local-only status notes below.

## Policy

- Default: five AI processing attempts per account per UTC calendar month. The admin user modal can raise the monthly allowance without resetting usage. A global server allowance of zero remains the emergency AI pause.
- Saved collection capacity: 100 per user across all saved statuses. Actual deletion frees space; completing or dismissing an item does not. Deletion does not refund AI attempts.
- Existing records are retained, including collections already above the cap. They remain readable/editable; new records require free capacity.
- Adding a snapshot from Abodid’s public collection uses no AI attempt. Duplicate capture handling remains unchanged.
- Website/extension/right-click and Telegram use the same allowance. Non-URL worker admission happens before paid voice transcription and covers the subsequent extraction, so voice does not incur a second allowance admission.
- Each admitted extraction attempt counts even if provider processing later fails; a provider retry within that extraction is included. Existing bounded background-job retries can consume another admitted attempt. This is an initial cost-protection allowance, not a payment ledger.

## Enforcement and performance

Apply `20261030034306_opportunity_ai_release_limits.sql` first, then `20261030034315_opportunity_capacity_and_support.sql`, with the matching server deployment. Coordinate the migration/deployment maintenance window described in the release handoff. Review other pending migrations instead of running a blind database push.

The first migration provides service-only monthly usage and concurrency leases, rejects anonymous identities and removes direct client job insertion. The second provides a per-user transaction lock plus a database trigger that rejects the 101st saved record, including privileged-worker and public-import writes. The capacity query uses the existing user-prefix index; it does not scan other users or require a separate Edge Function. AI admission checks capacity before starting paid processing; the final insert guard remains authoritative if capacity changes while processing. An overlapping manual save/import can fill the last slot after an AI request starts; in that case the final insert is rejected and the admitted AI attempt still counts. There is no durable saved-slot reservation in this iteration.

RLS continues to enforce saved-record ownership. Normal users have no access to entitlement updates, request records, audit tables or privileged quota RPCs. The admin endpoint verifies the live user role; the setter RPC checks that role again, changes the allowance and records the audit in one transaction. Support requests are resolved automatically when the allowance increases.

## Interface

- The discovery link is labelled “Browse opportunities”, without a personal name or a credit-related tagline.
- The dashboard stays focused on saving and listing opportunities. Settings → Your usage contains the browse link, collection/AI usage and credit-request action. Telegram connection controls remain in Settings; the example is collapsed under “Using Telegram”. Link preparation uses the existing signed account-link endpoint and requires a deliberate Open Telegram action.
- The Telegram welcome and Settings example use exactly: “Keep track of the Google Creative Art Residency in India whose application deadline is 12th April, 2027.” This is identified as example text rather than a verified listing.
- Monthly exhaustion opens a native editorial credit-request dialog from the dashboard capture error. A full 100-item collection instead explains deletion. Exhausted monthly jobs do not expose a pointless automatic retry button.
- Support correspondence is addressed to **Support team of Abodid & Co.**, delivered to **hello@abodid.com**. The user must press Send request. The server derives verified email/user ID from the session, fixes the recipient and uses an idempotency key. One pending request per user prevents duplicate email. Delivery failures are reported truthfully and offer a direct email fallback.
- Admin → Opportunity Tracker → Users → View collection now shows monthly attempts, saved count and a labelled monthly allowance input. Changes preserve usage; pending requests appear in the same modal. The notification email links to this modal.

## Deployment and verification

No live migration or test email was sent in this task. Existing Resend configuration and `reading_digest_settings.sender_email` are reused (explicit sender environment overrides are also supported). Keep the dedicated capped `OPENROUTER_OPPORTUNITIES_API_KEY` and other server settings from the release handoff.

Verified locally:

- 197 opportunity tests across 28 files, including forged email/identity rejection, fixed support destination, duplicate request prevention, truthful delivery failure, and Telegram quota-before-transcription/release-on-error tests.
- 22 isolated PGlite/PostgreSQL checks using actual migrations: monthly/global/user allowances, capacity insertion/deletion, owner isolation, privileged RPC restrictions, role validation and audit, and usage preservation after admin changes.
- Targeted strict TypeScript dependency graph passed; production website build passed with existing content/catalog warnings.
- Actual new component rendered in a temporary labelled local fixture. Desktop dialog appearance and 320px containment, Escape dismissal and focus return checked. The fixture and server were removed/stopped. No real account, Telegram connection or email delivery was exercised through this fixture.

Remaining live checks after deployment: admin increase for an ordinary account, five attempts and sixth denial, new Telegram welcome/linking, voice request at exhausted allowance, real support delivery/reply-to, concurrent final-slot requests and the actual curated-import onboarding flow. SMTP/provider settings and background cleanup must be operational. The existing release ZIP and its audit predate this feature and were deliberately left untouched.

## Admin usage and confirmed allowance changes

Deployed and promoted to production on 30 October 2026; final deployment `dpl_DeQT9EqmoPG8LuszSp82kAERRe3Y` (source `31f9d9a`).

The Opportunity Tracker Users directory shows admitted AI attempts this UTC month, the remaining monthly allowance, and total tracked attempts since metering began on 30 October 2026. These are processing admissions, including failures, rather than raw OpenRouter HTTP calls or blocked clicks. Free public-collection imports do not consume them.

The directory offers +5, and the user modal offers +5 and an exact monthly number. Every action first opens a native confirmation dialog identifying the user, current and proposed monthly allowance, used attempts and proposed remaining attempts. Cancel/Escape does not save; cancellation is disabled only while the confirmed request is already being committed. The override renews monthly until changed and preserves prior usage.

The admin-authenticated PATCH requires the reviewed `expected_limit`. The service-only `confirm_opportunity_ai_allowance` function locks the membership row and rejects stale reviews with a conflict, so a concurrent update or retry cannot silently grant a different allowance. Existing audit records identify the verified admin. Usage aggregation remains private to the service role. Migration: `20261030040657_opportunity_admin_increment_allowance.sql`.

Verification: 218 opportunity tests, strict type checks of the admin API dependency graph, and 30 isolated SQL checks. Live transactional verification checked a confirmed increase, audit insertion, unchanged usage and stale-review rejection; the entire transaction was rolled back. Native dialog checked at desktop and 320px, including Cancel focus, Escape and return focus. No real user allowance was changed for verification.

Final release adjustment: +5 is the only quick-increase shortcut. Repeat it after confirming each change to grant another five; the exact-number field remains available. No counter is reset.
