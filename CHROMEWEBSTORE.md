# Chrome Web Store — Save Opportunity

Last updated: 2026-10-30. First Store candidate: **1.0.0**. Status: **website/API deployed; final local ZIP rebuilt; not ready to submit** until the remaining Store gates below are closed. No Store upload or publication has been performed.

This is the authoritative current listing, permission, privacy and readiness record. The earlier 2.x numbers were unpacked development candidates, not Store releases. Their original notes are preserved in [pre-Store history](docs/releases/save-opportunity-pre-store-history.md). The existing Opportunity Tracker popup and website branding/workflows are preserved; the Store product name is Save Opportunity.

## Publisher and identity

- Publisher: **Abodid & Co.**
- Publisher ID: `50c87b47-caf5-4af7-902d-2252deff2750` — identifies the publisher, never the extension.
- Verified public contact: `hello@abodid.com` (provided by publisher).
- Developer Dashboard inspected through Chrome: **0/2 extension limit; “There are no items yet.”** No upload performed.
- Existing unpacked development extension ID: `bikjdgkkefmflkanfmppnidfkdiblnpg`. This is **not a production Store ID**.
- Production Store ID: **not assigned**. Obtain it from the first draft upload, then follow [the setup checklist](docs/releases/save-opportunity-release.md#manual-setup-and-release-order).
- Source: `extension/manifests/chrome.json`; built manifest: `extension/dist/chrome/manifest.json`.

## Production rollout — 30 October 2026

The Opportunity-only website/API deployment and all three allowance/support/intake migrations are now live. Every environment requires `OPENROUTER_OPPORTUNITIES_API_KEY`, with no fallback to the general site key. See [rollout evidence](docs/releases/opportunity-production-rollout-2026-10-30.md). Older local-only statements below describe the earlier release candidate. The Chrome Store ZIP has been rebuilt locally; it has not been uploaded. A real authenticated capture and the previously documented Store/security gates remain to be checked before submission.

## Store listing

**Name:** Save Opportunity

**Short description** (matches manifest; under 132 characters):

Save open calls, residencies, fellowships, grants and jobs. AI summarizes key details and important dates so you stay on track.

**Category:** Productivity (select the current Developer Dashboard equivalent if its category labels change).

**Language:** English.

**Single purpose:** Save a user-selected opportunity page or link to a private tracker and extract its details and deadlines for follow-up.

**Detailed description** — paste the text below:

```text
Save open calls, residencies, fellowships, grants and jobs to your private opportunity tracker.

A welcome tab opens after installation. Select Get started to sign in with Google, then save your first opportunity.

Save the page you are reading from the extension popup, or use Save page and Save link in Chrome's right-click menu. If you are signed out, a right-click save opens Google sign-in and saves the selected opportunity after you finish. The tracker identifies the title, organisation, category, requirements, important dates and next action. Review extracted details before you rely on them.

Once your capture is accepted, you can close the popup or tab while it is processed. Reopen the popup to check progress and see a saved, already-saved or failed result. Open your dashboard to review and organise your saved opportunities. Duplicate pages do not replace your existing edits.

GET STARTED
1. Continue with Google to create or open your private account.
2. Open a public opportunity page and select Save opportunity, or use a save command in the right-click menu.
3. Review the saved result in your dashboard.

INITIAL TEST RELEASE
Your radar holds up to 100 saved opportunities. Delete an existing record to make room when it is full. The initial trial includes five AI capture attempts per account per UTC calendar month. Requests that reach AI processing count even if extraction subsequently fails, because processing may incur a cost. A provider retry within the same extraction is included; a later capture or background-job retry is another attempt. Already-saved pages and existing catalogue matches can be reused without another AI extraction. Your saved opportunities remain accessible after the allowance is used.

PRIVACY
Google sign-in shares your account identity, name, primary email and profile photo to create and personalise your tracker account. It does not give the extension access to Gmail, Drive, Calendar or Contacts. Page content is read only when you choose a save action. The selected URL, title, page text and capture context are sent to our service and AI processors to extract and save that opportunity. No background browsing history is monitored. Data is not sold or used for advertising.

Sign-in and capture require an internet connection. Extraction may be unavailable on restricted, inaccessible or unreadable pages. AI can make mistakes; verify deadlines and application requirements on the source page.

Support and privacy requests: hello@abodid.com
Homepage: https://abodid.com/opportunities
Privacy policy: https://abodid.com/privacy

Version 1.0.0 — First Chrome Web Store release candidate.
```

Do not submit trial claims until the server migration and API changes are deployed and tested. This ZIP alone cannot enforce a server allowance.

## URLs and distribution

| Field | Value |
|---|---|
| Homepage | https://abodid.com/opportunities |
| Privacy policy | https://abodid.com/privacy — automated checks returned HTTP 429; verify browser access and publish new local wording before submission |
| Support | hello@abodid.com |
| Initial visibility | **Private → Only trusted testers** |
| Production version | 1.0.0 |
| Minimum Chrome | 120 |
| ZIP | `extension/releases/save-opportunity-chrome-store.zip` |
| Package audit | `extension/releases/save-opportunity-1.0.0-audit.json` |
| Build | Node 24; `npm ci`, then `npm run extension:package:chrome` |

## Graphics and assets

| Asset | Dimensions | Status / path |
|---|---|---|
| Store icon | 128×128 PNG | Prepared: `extension/store-assets/store-icon-128.png`; existing yellow O artwork with transparent Store padding |
| Runtime icons | 16, 48, 128 PNG | Existing artwork preserved in `extension/icons/`; exact dimensions checked by packager |
| Screenshot 1: capture | 1280×800 PNG/JPEG | **Missing**. Actual installed popup inspected; no valid exported capture screenshot obtained. Do not substitute a mockup. |
| Screenshot 2: saved result | 1280×800 PNG/JPEG | **Missing**. Capture a genuine successful result after production setup. |
| Small promo tile | 440×280 | Optional; not generated |

[Asset capture instructions](extension/store-assets/README.md). Screenshots must show the actual release UI, public opportunity content, and no tokens, email addresses or private saved records. The two requested screenshots remain a submission gate.

## Permission justifications

The build/package validator requires exactly these permissions and hosts; no access was added.

| Permission | Justification for Developer Dashboard |
|---|---|
| `activeTab` | Temporarily access the tab the user invokes from the toolbar or context menu, so the extension can save that selected opportunity without monitoring ordinary browsing. |
| `scripting` | Run packaged extraction and status-display functions in the explicitly selected tab to read the opportunity's visible text and structured details, and show capture feedback. |
| `storage` | Preserve the sign-in/PKCE session, a minimal account display cache, and the latest account-bound capture receipt locally so reopening the popup restores progress. No advertising profiles or browsing-history sync. Also remember that the first-install welcome tab has been shown. |
| `contextMenus` | Provide Save page and Save link commands that deliberately send the selected opportunity to the user's tracker. |
| `identity` | Complete the user-initiated Google/Supabase sign-in flow through Chrome's identity redirect. Only basic identity scopes are requested; no Gmail, Drive, Calendar or Contacts access. |
| `notifications` | Report acceptance, successful save, duplicate or failure for a user-triggered capture when the popup is closed. No marketing notifications. |
| `alarms` | Schedule one-shot status checks for accepted captures without keeping the worker running, and restore those checks after Chrome restarts. No engagement tracking. |
| `https://abodid.com/*` | Send authenticated capture/status/account requests to the existing tracker backend and open the dashboard. No executable code is fetched. |
| `https://jwipqbjxpmgyevfzpjjx.supabase.co/*` | Sign in and refresh the user's session through the configured Supabase authentication service. Only the public project key is bundled. |

No `tabs`, `<all_urls>`, `history`, `cookies`, `webRequest`, downloads, clipboard, camera, microphone, location, always-on content scripts or external messaging. The `activeTab` grant supplies selected-tab metadata on invocation; there is no need to add `tabs` for that gesture-scoped use. Source: https://developer.chrome.com/docs/extensions/develop/concepts/activeTab.

## Privacy and data-use fields

**Collects user data: Yes.** Use these conservative mappings in the Developer Dashboard.

| Data type | Select? | Actual purpose and recipients |
|---|---|---|
| Personally identifiable information | Yes | Google identifier, primary email, display name and profile photo for account creation/display; Google, Supabase and the application host process identity/account requests. |
| Authentication information | Yes | PKCE verifier, one-time OAuth code, access/refresh session. Stored in extension-local storage; sent to Google/Supabase and bearer-authenticated application endpoints. Never forwarded to opportunity webpages or OpenRouter. |
| Web history | Yes, selected page only | The explicitly saved URL/title, not background browsing history; application backend, Supabase and AI processing receive the selected capture. |
| Website content | Yes | User-selected visible text, relevant links and structured details; application backend and OpenRouter/provider for extraction; derived results and temporary job source in Supabase. |
| User activity | Yes, capture operations only | Capture time, status, retry/failure and monthly usage counters; needed for progress, reliability and abuse/cost limits. No independent extension analytics SDK. |
| Location | Yes, conservatively disclose timezone | Browser timezone helps interpret dates. No GPS, IP geolocation request or location browser permission; backend/AI receive timezone. Hosting providers may retain ordinary network request metadata. |
| Health / financial / personal communications | No intentional collection | Not requested. Capture only public opportunity pages. Funding/fee text is opportunity content, not the user's payment data. The extension can read user-selected content, so do not claim it cannot encounter sensitive text. |

- Supabase: authentication, profiles, private saved opportunities, durable capture receipts, quotas and temporary source storage.
- OpenRouter and its selected model provider: server-side processing of submitted opportunity content. Provider/model behavior and retention depend on the server/provider configuration; **do not claim zero retention or no model training without verifying provider settings**.
- Vercel: application/API hosting and background processing. Ordinary operational logs may contain capture/user identifiers and failure metadata; no tokens or provider keys should be logged.
- Google: user-initiated basic-identity sign-in. The package has no Google Analytics code. The separately opened abodid.com website has its own analytics, first-party session records and privacy disclosures.
- Website product-update email consent is optional and unchecked by default; sign-in or installation is not mailing-list consent. The extension itself does not enroll users in marketing.
- Extension-local receipts persist until replaced, signed out or local extension storage is cleared. Saved records remain until deletion. Raw source is redacted after success; after final failure, cleanup is scheduled for 24 hours later. **Cleanup depends on the deployed worker/cron running; verify scheduling before claiming an absolute retention guarantee.** Abandoned uploads expire after one hour under the same operational condition.
- The monthly quota stores user ID, month and count; short-lived concurrency leases store a user ID and expiry. Account deletion cascades these rows. No paid feature or payment data is implemented.

Certification, after confirming these statements in the production configuration:

- [ ] Data is not sold to third parties.
- [ ] Data is used only for the stated single purpose (separate optional website marketing requires explicit consent).
- [ ] Data is not used for creditworthiness or lending decisions.
- [ ] Listing, prominent popup disclosure, hosted policy and Dashboard fields agree.

Policy source: `src/pages/privacy.astro`; standalone extension policy draft: [privacy draft](docs/releases/save-opportunity-privacy-draft.md). Publish only after reviewing the production services and retention settings.

## Allowance and onboarding follow-up

The approved follow-up adds a 100-item saved capacity, admin monthly-AI controls, free curated imports as the starting flow, Telegram onboarding/example text and user-triggered credit request emails to the Support team of Abodid & Co. See [implementation and deployment notes](docs/opportunity-allowances.md). New private support-request and allowance-audit records are stored in Supabase; Resend delivers user-requested support email. The allowance/support/intake migrations and matching API/UI are deployed. The final ZIP is rebuilt with the release verification below; Store identity and reviewer checks remain outstanding.

## Readiness and evidence

- [x] Existing architecture/UI retained; Chrome MV3 package builds; runtime icons and local code are packaged.
- [x] Chrome permission/host set remains minimal and justified.
- [x] Production build rejects local app origins and non-public Supabase keys; source maps/private files excluded.
- [x] OAuth result origin and path checked before PKCE exchange; Chrome 120-compatible fallback retained.
- [x] Server allowance defaults to five/month, one AI operation per user and four globally; server-managed membership override supports future entitlements without payments. Direct client job insertion is revoked by the local migration; anonymous identities are denied at paid admission.
- [x] Production opportunity extraction requires a distinct server-only `OPENROUTER_OPPORTUNITIES_API_KEY`; the shared paid-model diagnostic returns 404 in production. No provider model/prompt change.
- [x] Live saved/job tables have forced RLS and owner policies. Isolated actual PostgreSQL migration/policy checks pass.
- [x] Node 24 full website build and automated opportunity tests pass; see [test report](docs/releases/save-opportunity-release.md#testing-report).
- [x] Existing unpacked Chrome installation reloaded to 1.0.0; session/current-page popup observed.
- [x] Dedicated server-only key variable configured; allowance/intake/support/admin migrations applied; matching website/API deployed.
- [ ] Independently verify the protected provider key’s spending cap, a real authenticated AI capture and production worker/cron behavior.
- [ ] Resolve/review relevant server dependency advisories and shared transcription exposure described in the release audit.
- [ ] Upload ZIP manually as a draft to obtain Store ID; configure its exact Supabase redirect.
- [ ] Confirm Google OAuth audience permits external users or add all initial testers; check account/provider configuration manually.
- [ ] Complete fresh installation, new-user OAuth, sign-out/in, Store-ID authentication, actual AI capture, two-account browser isolation and production quota/error checks.
- [ ] Export the two genuine 1280×800 screenshots and upload assets manually.
- [ ] Publish accurate privacy wording, confirm reviewer access and configure Private/trusted-testers visibility before submission.

The package audit deliberately records `submission_ready: false`. A ZIP build is not evidence that Google sign-in, production AI limits or Store review have passed.

## Reviewer instructions

Use [reviewer test steps](docs/releases/save-opportunity-release.md#reviewer-instructions). Reviewers use their own Google account through the normal sign-in flow; they must never receive Supabase service-role keys, OpenRouter keys or a bypass token. If Google or Private visibility restricts their account, fix access or arrange supported reviewer access in the Dashboard before submitting. Do not silently bypass quota/authentication for review.

## Version history

| Version | Date | Changes | Status |
|---|---|---|---|
| 1.0.0 | 2026-10-30 | First Store candidate; guarded production build, exact OAuth callbacks, dedicated extraction key, five monthly AI attempts, 100 saved items, consent/onboarding, confirmed admin allowance updates, first-install welcome, right-click sign-in-and-save, and refreshed package. | Website deployed; ZIP local; not uploaded |
| 2.1.13 and earlier | Before first Store submission | Historical unpacked development versions, not published releases. See archived notes. | Development only |

Once 1.0.0 is the first uploaded Store package, release 1.0.1 through **the same item's Package → Upload new package**, preserve the Store public key/ID and OAuth redirect, and submit that update for review. Never create a second listing for an update. If you upload an earlier 2.x ZIP first, you cannot subsequently downgrade that item's version to 1.0.0.

## Official references checked

- https://developer.chrome.com/docs/webstore/images
- https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code
- https://developer.chrome.com/docs/webstore/update
- https://developer.chrome.com/docs/extensions/reference/manifest/key
- https://supabase.com/docs/guides/auth/social-sign-in/auth-google
- https://supabase.com/docs/guides/auth/redirect-urls
- https://openrouter.ai/docs/api/api-reference/api-keys/update-keys

Admin follow-up (30 October 2026): usage analytics now distinguish admitted monthly and lifetime processing attempts; allowance adjustments require a review/confirmation popup and a database stale-value check. Existing usage is preserved. This changes the website admin interface only; the extension runtime is unchanged; the final package is regenerated during release preparation.

Final release adjustment (30 October 2026): +5 is the only admin allowance shortcut; exact numeric entry remains. Both require confirmation with the reviewed current value, preserve usage, and record the verified administrator. No extension permissions or host permissions were added. Store submission remains manual after identity, OAuth, screenshots, security review and reviewer-access checks.

## First-install welcome — local release candidate

- On `runtime.onInstalled` with reason `install`, open the packaged `welcome.html` tab. A boolean `opportunity-install-welcome-shown-v1` in extension-local storage prevents reopening it for the same installation. Updates, Chrome updates and browser startup do not open it. If tab creation fails, the marker is removed so initialization can be retried.
- The welcome copy is “From open tabs to open doors.” Get started uses the existing internal `AUTH_LOGIN` message and Google PKCE flow. It signs in to the extension session; no website-to-extension token transfer or additional OAuth scope is added. Already signed-in users see first-save instructions immediately. Cancellation, pending sign-in and temporary session-check failures keep a retry path.
- The first-save instructions explain the toolbar and right-click actions. Open your radar uses the existing `OPEN_DASHBOARD` handler. The website may require its own sign-in because website and extension sessions remain separate.
- The screen, scripts, styles and icon are packaged locally. There are no welcome-page analytics, new third-party services, marketing enrollment, automatic captures or AI allowance use. The marker contains no identity or browsing data; existing authentication/session disclosures remain applicable.
- Permissions and host permissions are unchanged. Creating the local welcome tab does not require adding `tabs`, `<all_urls>` or `externally_connectable`.
- New files in the audited package include `welcome.html`, `welcome.js` and its local stylesheet asset. The packager explicitly requires both welcome entry files and continues rejecting secrets, source maps, remote scripts and unexpected files.
- Welcome layout and state transitions are checked locally with a mock extension runtime; actual fresh-install Google sign-in remains part of the manual Store-identity/reviewer gate. No real account is signed in or opportunity processed during this check. Existing requested genuine Store screenshots remain outstanding; capture the actual installed welcome page if using it in the listing.
- This is still the unpublished 1.0.0 candidate. No Store upload, commit or deployment is performed by this addition.

Verification for this local addition: all 235 opportunity tests pass (31 files), strict TypeScript checking passes for the welcome/install/background modules, and the Chrome build/package audit passes. Desktop and narrow mobile welcome states were inspected using a temporary mock runtime; the mock fixture is absent from the release ZIP. The bundled welcome icon is verified byte-for-byte against the existing extension icon. Actual fresh-install OAuth remains a manual check.

Popup refinement (30 October 2026): in the queued/processing state, the top-left status badge is hidden so that "Processing" is not redundantly displayed above the centered "Processing opportunity" heading in the receipt card.

## Right-click sign-in-and-save — 30 October 2026

- Chrome signed-out (including anonymous-session) page/link saves now open the existing Google PKCE flow instead of immediately showing a sign-in error. After a non-anonymous extension session is established, the original clicked URL and page title resume through the existing capture receipt/job flow. A stale cached identity is replaced with the newly authenticated account before the capture starts.
- No capture request, page-text extraction or AI attempt is started before sign-in succeeds. Cancellation, missing persisted sessions and temporary network failures remain retryable errors without a capture. Safari's existing separate callback flow remains pending and asks the user to repeat the save after sign-in; this Chrome change does not claim automatic Safari resumption.
- During a sign-in wait, the chosen URL/title exist only in the active right-click operation; no new durable pending-save record is introduced. The OAuth API keeps the Chrome worker alive under the existing Chrome 120 minimum. Unexpected browser/worker termination requires repeating the user action; no automatic save is replayed at startup.
- Resumed page saves send only the original URL/title to the existing authenticated backend, which retrieves the source. They do not read a page that may have replaced the original tab during sign-in. Already-signed-in page saves keep their existing gesture-triggered page extraction.
- Permissions, host permissions, OAuth scopes, storage disclosures, retention, assets and manifest version are unchanged. This remains unpublished 1.0.0. The working/signed-in toast messages changed; existing genuine Store screenshot requirements still apply.
- Automated verification: all 242 opportunity tests pass, including signed-out page/link resumption, stale cached account identity, cancellation, pending Safari sign-in, temporary auth failures and an OAuth result without a persisted session. The Chrome package is rebuilt locally; no Store upload/publication is performed.
- [ ] Manual installed-Chrome check: signed out → right-click page and link → Google sign-in → one saved opportunity; repeat with cancellation and confirm no capture. This remains part of the existing real-OAuth/Store-identity release gate.

Reference: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle (Chrome 116+ interactive `identity.launchWebAuthFlow` lifetime support).
