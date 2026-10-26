# Chrome Web Store Listing — Opportunity Tracker

> Last updated: 2026-10-26
>
> Manifest source: `extension/manifests/chrome.json`
>
> Release version: `2.1.12` (local candidate; submission gates remain open)

This file is the source of truth for Chrome Web Store metadata, permission justifications, privacy disclosures, release evidence, and submission blockers. Update it whenever the Chrome manifest, extension behavior, branding, data handling, or store assets change.

## Store listing

**Extension name**

Opportunity Tracker

**Short description — 127/132 characters**

Save open calls, residencies, fellowships, grants and jobs. AI summarizes key details and important dates so you stay on track.

**Tagline**

One Click. Every opportunity organized.

**Category**

Productivity

**Primary language**

English

**Single purpose**

Save opportunity pages to a private tracker that extracts and organizes the details and dates needed to follow up.

**Detailed description — paste as plain text into the Developer Dashboard**

```text
Save open calls, residencies, fellowships, grants and jobs to one organized private tracker.

FEATURES
• Capture the opportunity in your current tab
• Save a page or link from Chrome's right-click menu with visible extraction and completion feedback
• Automatically summarize the opportunity, organisation, requirements and next action
• Identify deadlines and other important dates
• Receive confirmation that your page was received, then close the tab, popup or browser while it is organized
• See successful opportunities appear in the dashboard, or retry a failed background capture without returning to the original page
• Track submitted pages and retry captures that could not be completed
• Reopen the popup to see the latest processing, saved or failed receipt
• Open your private Opportunity Tracker dashboard from the compact account footer

HOW TO USE
1. Sign in with Google to create or open your private Opportunity Tracker account.
2. Open a public opportunity page and select Save opportunity, or right-click a page or link and choose Save to Opportunity Tracker.
3. Review and manage the saved opportunity in your dashboard. Check extracted details and dates before applying.

PRIVACY
Google sign-in shares your name, primary email address and profile photo only to create and personalize your private tracker account. The extension does not request access to Gmail, Drive, Calendar or Contacts. Page content is not collected until you choose Save opportunity or use the save context menu. For a capture, the page URL, title and visible text are securely sent to abodid.com and its AI service only to extract and save opportunity details. Data is not sold or used for advertising.

PERMISSIONS
The extension accesses only the tab you explicitly choose to capture, stores your sign-in session locally, adds the two save commands to Chrome's right-click menu, and communicates only with abodid.com and its authentication service.

SUPPORT
Questions, privacy requests or bug reports: hello@abodid.com
Privacy policy: https://abodid.com/privacy

Version 2.1.12 — Improves right-click save feedback, account switching, duplicate handling and recovery from interrupted processing. Chrome tab access is limited to pages you explicitly invoke the extension on.
```

## URLs and developer information

| Field | Value | Status |
|---|---|---|
| Homepage URL | `https://abodid.com/opportunities` | Ready |
| Privacy policy URL | `https://abodid.com/privacy` | Ready; durable capture-job storage and temporary raw-page retention disclosures deployed on 2026-10-20 |
| Support URL | `https://abodid.com/contact` | Ready |
| Support email | `hello@abodid.com` | Confirm this inbox is monitored before submission |
| Publisher name | Abodid Sahoo | Confirm it matches the Developer Dashboard account |
| Visibility | Public | Planned |
| Regions | All regions | Planned; confirm legal and support coverage before submission |

## Graphics and assets

| Asset | Requirement | Current status | Source / next action |
|---|---|---|---|
| Store icon | 128×128 PNG | Ready | `extension/icons/icon-128.png`; solid Pop Editorial yellow with an optically centred bold black “O”, verified as a real 128×128 RGBA PNG |
| Toolbar and context-menu icon | 16×16 PNG | Ready | `extension/icons/icon-16.png`; the optically centred “O” is explicitly assigned to the toolbar action and supplied through the manifest for Chrome’s right-click menu, verified as 16×16 |
| Extension-management icon | 48×48 PNG | Ready | `extension/icons/icon-48.png`; matching optically centred yellow “O”, verified as 48×48 |
| Screenshot 1 | 1280×800 or 640×400 | Missing | Capture the signed-out popup with the privacy disclosure visible |
| Screenshot 2 | 1280×800 or 640×400 | Missing; refresh required for the redesigned popup | Capture the current-tab-first layout, processing state, minimal saved receipt, and account footer with View your dashboard and Log out |
| Screenshot 3 | 1280×800 or 640×400 | Missing | Show the private dashboard with organized opportunities |
| Small promo tile | 440×280 PNG or JPEG | Recommended, missing | Use the Pop Editorial blue, cream and yellow system without unsupported claims |
| Marquee promo tile | 1400×560 PNG or JPEG | Optional, missing | Create only if merchandising is planned |

Screenshots must show the current `2.1.12` UI and must not include private account data, email addresses, authentication tokens, or opportunity content that cannot be published.

## Permission justifications

These entries must match the built `extension/dist/chrome/manifest.json`, not only the source manifest. The build adds the configured Supabase project origin to `host_permissions`.

| Permission | Type | Developer Dashboard justification |
|---|---|---|
| `activeTab` | API permission | Grants temporary page access only after the user invokes the extension from the toolbar or right-click menu. It limits content extraction and status injection to a deliberate user action instead of allowing automatic access during ordinary browsing. |
| `scripting` | API permission | Runs packaged functions in the user-selected tab after Save opportunity or the Save page context-menu action. One function reads visible page text, relevant links and structured opportunity data so the service can identify the title, organisation, deadline, requirements and application link; another displays the context-menu action’s durable handoff status. Neither runs automatically on ordinary browsing. |
| `storage` | API permission | Stores the user's Supabase PKCE authentication session, a minimal cached display name/username and the latest durable capture receipt with its account identifier in extension-local storage. This lets the popup reopen with accurate handoff status while server-side processing continues independently. It is not used for advertising, profiling or cross-device browsing-history sync. |
| `contextMenus` | API permission | Adds “Save page” and “Save link” commands to Chrome's right-click menu so a user can deliberately send an opportunity to the same private tracker without first opening the popup. |
| `identity` | API permission | Opens and completes the browser-controlled Google/Supabase OAuth flow using a `chromiumapp.org` redirect. It is used only when the user selects Continue with Google and requests the minimal `openid email profile` identity scopes so the tracker can receive the account identifier, primary email, display name and profile photo. It does not grant access to Gmail, Drive, Calendar or Contacts. |
| `notifications` | API permission | Shows browser-level feedback when a user-triggered capture is accepted, and when the accepted job finishes, is already saved, or fails. The notification is optional feedback and does not control processing. Notifications are not used for marketing. |
| `alarms` | API permission | Schedules a short, resource-efficient follow-up check for a user-triggered background capture after the popup closes. It lets the extension report the final saved, duplicate or failed result without keeping a service worker or webpage running. It is not used for recurring engagement or marketing. |
| `https://abodid.com/*` | Host permission | Sends authenticated session checks and user-triggered opportunity captures to the Opportunity Tracker API and opens the user's dashboard. No code is downloaded or executed from this origin. |
| `https://jwipqbjxpmgyevfzpjjx.supabase.co/*` | Host permission added at build time | Authenticates the user and refreshes the signed-in session through the configured Supabase project. The auth-only extension client does not access database records directly; the application backend authorizes opportunity requests and database Row Level Security restricts user-owned records. |

### Permission minimization result

- The Chrome build does not request `<all_urls>`, `history`, `cookies`, `webRequest`, downloads, clipboard, location, camera, or microphone. Its notification permission is limited to user-triggered capture completion or failure.
- Chrome no longer requests `tabs`: opening the toolbar action or executing a context-menu command grants `activeTab` access to that page, including its URL/title. Arbitrary browsing metadata is not needed. Cross-origin navigation revokes that grant; the popup asks the user to reopen it rather than capture an unavailable page. Firefox/Safari declarations remain unchanged pending their separate browser testing.
- The two host origins are the product application and its authentication/database provider. No wildcard third-party host access is present.
- Removing any current permission would break an existing, user-visible feature described above.

## Privacy and data use

**Does the extension collect user data?** Yes. Collection is limited to data needed to authenticate the user and save a user-selected opportunity.

| Chrome Web Store data type | Collected / transmitted | Purpose and handling | Shared with a service provider? |
|---|---|---|---|
| Personally identifiable information | Yes | Google account identifier, primary email, display name and profile photo create and personalize the private account. The saved display name supplies the first-name dashboard greeting; the user's tracker username identifies the collection URL. | Google for user-authorized sign-in; Supabase for authentication and account storage. |
| Health information | No | Not requested or used. Users should not capture pages containing private health data. | No. |
| Financial and payment information | No | Not requested or used. Public funding/fee text on an opportunity page may be extracted as part of the opportunity record, but no user's payment data is requested. | No user financial data is shared. |
| Authentication information | Yes | OAuth authorization result, access token and refresh state keep the user signed in. Tokens are stored in extension-local storage and transmitted only over HTTPS to the product and authentication service. | Google and Supabase as authentication providers; bearer tokens are sent to abodid.com only to authorize tracker requests. |
| Personal communications | No | The extension does not read email, messages or chat. Users should capture public opportunity pages, not private communications. | No. |
| Location | Browser timezone only | The browser timezone is sent with a capture solely to interpret ambiguous dates correctly. The extension does not request geolocation or collect GPS coordinates. | abodid.com and OpenRouter process it for date extraction. |
| Web history | Yes, user-selected page only | The URL and title of the page or link the user deliberately saves are transmitted and stored as part of the opportunity. The extension does not monitor browsing in the background. | abodid.com; Supabase stores the saved URL; OpenRouter may process it as extraction context. |
| User activity | Yes, minimal | Capture timestamp and the explicit save action support date interpretation, duplicate handling and the saved record. No advertising or behavioral profile is created. | abodid.com, Supabase and OpenRouter only as needed for the capture. |
| Website content | Yes, user-selected page only | Visible text, relevant links and limited structured data from the selected page are transmitted for opportunity extraction. A private durable capture job may temporarily hold the page snapshot so closing the browser cannot cancel processing. Raw text is removed immediately after success or within 24 hours after final failure; it is never stored in the saved opportunity record. | OpenRouter processes the text for AI extraction; abodid.com orchestrates the request; Supabase temporarily stores the private job and permanently stores only the derived record. |

### Prominent disclosure and consent

The popup displays this disclosure before the capture control can be used:

> Google sign-in shares your name, email and profile photo only to create and personalize your account. Page content is not collected until you choose Save opportunity or Save to Opportunity Tracker from the right-click menu; it is then sent only to extract and save the opportunity.

The Chrome Web Store listing repeats the same disclosure. Capturing requires the user's affirmative toolbar-button or context-menu action. Google sign-in is separately initiated by the Continue with Google button and is limited to `openid`, `email` and `profile`; the extension does not request Gmail, Drive, Calendar or Contacts scopes.

### Service providers

| Provider | Role | Data involved |
|---|---|---|
| Google | User-selected OAuth sign-in | Account identifier, primary email, display name, profile photo and OAuth authorization data from the `openid email profile` scopes |
| Supabase | Authentication, session refresh and database storage | Account identity, auth session, saved opportunity records |
| Vercel | Hosting for abodid.com application and API endpoints | Authenticated API requests and user-triggered capture payloads |
| OpenRouter | AI extraction requested by the capture API | Selected page text, URL/title context, capture time and timezone needed to derive opportunity fields |

Before submission, confirm the current data-processing and retention terms for every provider and ensure contractual settings match this disclosure.

### Storage, retention and deletion

- OAuth session material and the minimal display-name/username cache remain in `chrome.storage.local` until replaced, expired, the user signs out, or extension storage is cleared. The latest capture receipt remains until another capture replaces it, the user signs out, or extension storage is cleared; accepted jobs and final receipts no longer expire after 15 minutes. A handoff stuck in the sending phase for more than five minutes becomes a retryable error on the next state check. The receipt includes the selected URL/title, status and minimal result/error information, not raw page text. Server-side processing does not depend on this local receipt.
- Saved opportunity records remain in the user's private tracker until the user deletes them.
- Raw page text is used during extraction and is not written to the saved opportunity record. It is removed from successful jobs immediately; final failures retain it privately for retry recovery for no longer than 24 hours before automatic removal.
- Uninstalling the extension clears local extension storage but does not delete the user's server-side tracker records.
- Users can delete individual opportunities in the dashboard. Account-wide access or erasure requests go to `hello@abodid.com` until a self-service account deletion flow exists.

### Limited Use certification

- [x] Data is not sold to third parties.
- [x] Data is not used or transferred for purposes unrelated to the extension's disclosed single purpose.
- [x] Data is not used for advertising, personalized ads, creditworthiness, or lending.
- [x] Web browsing activity is collected only for the user-facing capture feature and only after an explicit user action.
- [x] Human access to user data is prohibited except when the user gives explicit consent for support, when required for security, to comply with law, or as otherwise allowed by the Chrome Web Store User Data Policy.
- [x] The public privacy policy contains the required Limited Use statement.

### Security and remote-code review

- Manifest V3 service worker and packaged popup are used.
- All extension JavaScript is bundled into the submitted package; no remotely hosted JavaScript, CDN script, `eval`, `new Function`, inline script or inline event handler is used.
- API responses are treated as data, not executable code.
- Source maps are disabled in release builds.
- Authentication uses OAuth PKCE. No service-role key, AI provider key, curator passcode or extraction prompt is shipped in the extension.
- All declared remote origins use HTTPS.
- The capture backend validates public HTTP(S) destinations and applies request limits before extraction; this is backend defense-in-depth and is not represented as a browser permission.
- Popup output uses `textContent`, preventing captured or API-returned strings from becoming HTML.

## Release and test evidence

Run from the repository root:

```sh
npm run extension:build:chrome
npm run test:opportunities
npm run build
```

Chrome runtime test matrix:

| Test | Expected result | 2026-10-14 status |
|---|---|---|
| Load `extension/dist/chrome` unpacked | Extension installs with no manifest error | Version `2.0.0` was reloaded and verified in Chrome on 2026-10-14 with ID `bikjdgkkefmflkanfmppnidfkdiblnpg`; `2.1.8` was reloaded successfully in the same installed unpacked Chrome extension on 2026-10-25. |
| Open popup while signed out | Current-page preview appears first; sign-in UI and prominent privacy disclosure render only after the signed-out state is confirmed; no console error | Built and passed a delayed-session headless Chromium UI-state test on 2026-10-14; real-extension signed-out recheck pending. |
| Open popup while signed in | The current tab appears first; cached name and handle, View your dashboard and Log out appear in a separate bottom account area | Built-popup browser tests passed on 2026-10-25. Version 2.1.8 was also opened in the actual signed-in Chrome extension and displayed the existing name and handle after reload. |
| Google sign-in | OAuth completes and session persists after popup closes | The unpacked Chrome ID `bikjdgkkefmflkanfmppnidfkdiblnpg` and its exact `chromiumapp.org/supabase-auth` callback were verified and allow-listed in Supabase on 2026-10-14. A fresh end-to-end sign-in and sign-out retest is pending. |
| Capture a public opportunity page | Three wave dots and a clear sending/processing message appear immediately; a durable receipt is returned before extraction and the record remains private | Automated build passed; authenticated real-Chrome test pending |
| Close the popup, tab or browser after the receipt | Server-side extraction continues independently; the dashboard resumes unfinished status after reopening and shows the saved opportunity or a retryable failure | Built-popup browser checks passed on 2026-10-25 for reopening during sending, queued processing older than 15 minutes, success and error. Authenticated real-Chrome confirmation remains pending |
| Capture two different pages consecutively | The second page is read from the current tab, its request completes independently, and the popup remains reusable | Regression logic covered by local opportunity tests; authenticated real-Chrome confirmation pending |
| Capture from many independent accounts concurrently | Requests retain isolated prompts/results; transient provider throttling uses model failover and a bounded jittered retry | A mocked 50-request concurrency regression passes locally; provider-account load confirmation remains pending |
| Capture a restricted/internal Chrome page | Control disables or capture fails safely without crashing | Pending real-Chrome test |
| Save page/link from context menu | An on-page toast immediately reports the durable handoff, then confirms that background processing owns the job or shows a receipt error; toolbar badge remains a fallback | The former synchronous flow passed an authenticated real-Chrome page-context test on 2026-10-14. The new `2.1.0` “Securing capture…” → “Capture received” flow, link context and restricted-page fallback require final real-Chrome confirmation. The disclosed `tabs` permission supports fresh popup target metadata, not background monitoring. |
| Duplicate capture | Reports Already saved and does not consume another extraction | Covered by opportunity API tests and confirmed in real Chrome on 2026-10-14. |
| Quota/network/timeout failure | Human-readable error; the bounded request returns the button to a usable retry state | Regression logic covered by local opportunity tests; browser confirmation pending |
| Open dashboard | Opens the current user's tracker route | Pending signed-in real-Chrome test |
| Log out and reopen popup | Local session is removed and sign-in panel returns | Pending signed-in real-Chrome test |
| Service worker starts cleanly | Worker scope, name and version match the installed extension | Passed in Chrome 155 for `2.0.0`; the `2.1.8` manifest was successfully reloaded in the actual installed Chrome extension on 2026-10-25 |
| Service worker restart with signed-in state | Session remains local while an accepted capture continues server-side without depending on service-worker lifetime | Code-audited; authenticated browser confirmation pending |

### Authentication network recovery (2.1.8)

- An auth-only Supabase client replaces the unused database/realtime client and its implicit initial-session subscription. Continuous token auto-refresh is disabled in extension workers; opening the popup or using a protected operation calls `getSession`, which refreshes expired sessions on demand.
- The existing `sb-<project-ref>-auth-token` storage key, PKCE verifier storage and refresh tokens are preserved, so the update does not require users to sign in again.
- Auth transport attempts have an eight-second timeout. Network and timeout failures become retryable 503 responses for the SDK's existing bounded retry mechanism, with a clear connection message returned to the popup. Temporary failures do not clear the identity cache or stored refresh token. Invalid authentication remains an error; cached profile data never authorizes backend requests.
- Logout uses local scope and checks the result before clearing display/receipt state.
- Regression tests use the actual auth client to verify no background refresh on initialization, preservation of the session during a failed refresh, recovery and token rotation after connectivity returns, and no raw SDK console errors during the simulated outage. Supabase Auth health returned 200 and the unauthenticated tracker session API returned the expected 401 on 2026-10-25.
- Actual Chrome version 2.1.8 reload and signed-in popup were verified. Historical diagnostics were cleared after inspection. The intermittent network outage itself was reproduced in tests, not forced against the user's live session.

### Waiting feedback and dashboard tour (2.1.9)

- The popup uses three decorative wave dots for session checks, sending and queued processing, and sign-in/logout button waits. Queued work continues to restore after dismissal. Success/error receipts stop the busy animation; no guessed percentage is displayed.
- A shared packaged CSS file supplies the wave and subtle waiting glow to the website and popup. Reduced-motion preferences stop both animations while keeping the dots and status text visible. Progress text remains available to assistive technology; decorative dots are hidden from it.
- The website adds a four-step manual-popover tour of saving links/files, urgency views, refresh, and the integration panel. Each help box contains one short instruction with balanced headings and orphan-resistant wrapping. Settings can replay the tour. The hero groups the Telegram flow and Chrome installation instructions in a quick-access rail; the Chrome dialog accurately explains that the store release is coming soon.
- The website stores only per-username tour progress/dismissal in local browser storage. It does not add extension storage, browser permissions, remote code, analytics or additional collection. Existing Chrome permission/host justifications and OAuth scopes remain unchanged.
- Desktop and 390px/320px phone browser checks verify step focus, control/card separation, viewport containment, dismissal, replay and reduced-motion behavior. Extension popup reopening and capture-state regression checks pass with mocked browser APIs. Actual installed Chrome 2.1.9 reload is not yet claimed.

### Clean waiting states (2.1.10)

- Status labels use direct technical copy, with the three decorative wave dots centered beneath the text rather than beside it. Labels paired with the animation have no trailing ellipsis. Initial account/page placeholders and capture feedback follow the same language.
- Shared website sign-in, session and list loaders remove conversational subtitles. Authentication failures retain their messages and retry links.
- Packaged CSS, persisted capture receipts, reduced-motion support, permissions, host permissions and privacy disclosures remain unchanged in scope. Store assets still need replacement for this version; installed-browser reload has not been verified for 2.1.10.
- Verification: production website and all three browser builds pass; 115 opportunity tests and targeted TypeScript checks pass. Headless browser checks verify centered label/dot geometry at 1440px, 768px, 390px and 320px, authentication failure recovery, reduced motion, and restored sending/queued/success/error popup receipts with mocked extension APIs.

### Performance evidence

- The release output remains compact and is minified with source maps disabled: popup JavaScript 7.98 KB (2.93 KB gzip), popup CSS 8.56 KB (2.49 KB gzip), and background JavaScript 108.49 KB (28.71 KB gzip) in the `2.1.10` Chrome build on 2026-10-25.
- Idle, processing and saved views were visually checked at 360×600 on 2026-10-25 using the built popup and mocked extension APIs. Long failure messages wrap without horizontal overflow, account controls have a 44px minimum height, and tall content scrolls within the popup. Local QA images are not yet compliant store screenshots.
- The extension registers no always-on content script in Chrome. Page extraction is injected only after a user capture action, avoiding work on ordinary page loads.
- The updated signed-in popup was reloaded and visually verified in real Chrome on 2026-10-14; its first visible state contained the current page title and URL, not the Google sign-in card.
- Current-tab lookup remains independent. The service worker prewarms the minimal display identity at browser startup, and the popup reads that local cache before requesting a network-backed session refresh; AI extraction remains deferred until capture.

## Submission-readiness checklist

### Ready

- [x] Manifest V3.
- [x] Name and description match this document; manifest description is 127 characters.
- [x] Real 16×16, 48×48 and 128×128 PNG icons exist and match declared dimensions.
- [x] Narrow, feature-linked permissions with no `<all_urls>` access.
- [x] Single purpose is specific and consistent across UI, listing and permissions.
- [x] No remote code execution or runtime-loaded scripts.
- [x] No secrets or privileged backend credentials in the extension package.
- [x] Public privacy policy source now describes extension collection, providers, retention, deletion and Limited Use.
- [x] The repository privacy policy describes the current data flow; production verification from 2026-10-14 is historical. The current live URL must be rechecked before submission (see release audit).
- [x] User-triggered data collection is prominently disclosed inside the popup.
- [x] Context-menu save actions provide visible success and failure feedback.
- [x] The exact OAuth callback for the current unpacked Chrome ID (`bikjdgkkefmflkanfmppnidfkdiblnpg`) is allow-listed and remotely verified in Supabase.

### Must complete before submission

- [ ] Run the final release in real Chrome with the store/stable extension ID: new-user Google login, two consecutive captures, right-click page/link, reopen popup, browser restart, offline recovery, logout and account switching. Current 2.1.11 tests use mocked browser APIs; they are not a substitute for this pass.
- [ ] Upload the ZIP as an unpublished draft first. Use its assigned item ID to allow-list `https://<store-extension-id>.chromiumapp.org/supabase-auth` in Supabase BEFORE submitting for review. Obtain the draft public key to match the unpacked development ID when testing; never generate a new arbitrary key. See https://developer.chrome.com/docs/extensions/reference/manifest/key.
- [ ] Complete a successful Google sign-in and sign-out test with the production/stable extension ID.
- [ ] Verify the live privacy policy loads and matches the current data flow; confirm provider data-processing/retention settings, especially OpenRouter and its downstream model providers for submitted page text.
- [ ] Create at least one compliant 1280×800 or 640×400 screenshot; three current screenshots are recommended.
- [ ] Confirm publisher name, verified contact email, visibility and regions in the Developer Dashboard.
- [ ] Complete the Dashboard Privacy practices form exactly as documented above.
- [x] Produce a clean ZIP from `extension/dist/chrome` only: `extension/releases/opportunity-tracker-2.1.12-chrome.zip`. The packaging script audits file allow-list, permissions/hosts, PNG sizes and privileged credential values; no source maps, tests, environment files, repository metadata, benchmark script or development configuration are included.
- [ ] Inspect the final ZIP contents and bump the manifest version if `2.1.12` has already been uploaded. The user confirmed there is no existing store item on 2026-10-26.

## Current release audit — 2.1.12 (2026-10-26)

**Decision: local production package prepared; NOT cleared for submission. No upload, submission, publication, Git push, production deployment, or production database write was performed.**

### Source and confirmed fixes

- Fetched `origin/main` from `abodidsahoo/abodid-website`; both HEAD and latest main resolve to `15a4afc12cd51a25ea0295d49028c716c5f00e89`. Pending local 2.1.11 fixes were reviewed and retained rather than discarded. The unrelated free-model benchmark remains local and is excluded from the extension ZIP.
- **Right-click receipts:** the old main path bypassed persistent state/alarms. It now shares the toolbar handoff path, shows page-level acceptance even if another page becomes the latest receipt, preserves the linked page's own title, and restores queued checks after restart.
- **Account races:** cached identity and receipts carry the initiating account ID. Reads reject another account or legacy unbound receipt; the popup waits for matching identity before rendering it. Serialized writes prevent late responses from restoring removed receipts. Save/status token refreshes cannot switch accounts. No authentication token is embedded in receipts or injected page code.
- **Duplicate handoffs:** the receipt claim is atomic within the worker. Simultaneous toolbar requests reuse one operation/idempotency identity; repeated context-menu saves of the same currently processing URL do not submit another handoff. Distinct context-menu URLs can still be submitted independently; the popup intentionally displays the latest receipt.
- **Concurrent backend saves:** both curated and extracted URL saves previously used a conflict-update upsert after a non-atomic duplicate check. A second finishing capture could overwrite edits to the first saved row. They now insert once and resolve a unique collision by returning the existing owner-scoped row. No schema migration is required. This server fix is LOCAL and must be deployed with approval before production acceptance testing.
- **Processing failures:** status fetches have a 12-second timeout; unknown statuses cannot be called successful, and missing (404) jobs become retryable rather than polling forever. Optional browser alarm/badge failures no longer turn accepted server work into a failed receipt.
- **Restricted pages:** real Chrome reproduced an enabled save action on `chrome://extensions`. The release disables unsupported schemes and credential-bearing URLs before collecting text or submitting jobs. The same real Chrome page was rechecked with 2.1.12 and displayed a disabled Page unavailable button.

### Permission and privacy findings

- Chrome Manifest V3 now has seven permissions: activeTab, scripting, storage, contextMenus, identity, notifications and alarms. `tabs` was removed because every metadata read follows toolbar invocation and every page save follows a toolbar/context-menu gesture. Chrome explicitly documents that activeTab grants URL/title access for that tab: https://developer.chrome.com/docs/extensions/develop/concepts/activeTab. This specific gesture-scoped allowance is narrower than the installed skill's blanket recommendation to request tabs whenever reading tab.url.
- Chrome minimum version is 120, matching the 30-second alarm cadence; no wildcard browsing hosts, always-on content script, external messaging, remote scripts or privileged key are added. Chrome's ordinary-page save smoke test after permission removal remains pending.
- Google login uses PKCE and `identity.getRedirectURL('supabase-auth')`; no unpacked extension ID is hardcoded in the runtime. The current unpacked ID is `bikjdgkkefmflkanfmppnidfkdiblnpg`. A store-assigned ID does not exist yet and cannot honestly be certified. Upload an unpublished draft, retrieve its item ID/public key, configure the exact Supabase callback, and test that identity BEFORE review. Do not submit or publish without approval.
- Real Chrome displayed the deployed privacy page and its extension capture, Google identity, Supabase, Vercel, OpenRouter and Limited Use sections. A more detailed DOM read was then denied by a saved origin permission. The user's text approval did not clear that managed/saved permission, so no alternate route was used to complete the blocked read. Exact live retention wording remains unverified for this release.
- OpenRouter's own content logging/use is opt-in, and downstream providers have separate training/retention policies. This project's extraction request does not override those account/provider controls. The actual production account settings were not inspected or changed; do not claim universal zero retention or no training based only on the default documentation. References: https://openrouter.ai/docs/guides/privacy/data-collection and https://openrouter.ai/docs/guides/privacy/provider-logging.
- The free NVIDIA experiments are a separate local benchmark. This release does not switch the live tracker to free inference. Keep the disclosure and cost expectations aligned with the current paid production route.

### Read-only production backend evidence

On 2026-10-26, Supabase SQL confirmed both tables have RLS enabled and owner predicates based on auth.uid() = user_id; unique indexes exist for saved `(user_id, canonical_url)` and job `(user_id, idempotency_key)`. The capture recovery cron is active every minute. Across jobs created in the preceding seven days: 52 succeeded and one failed with PAGE_CONTENT_INSUFFICIENT after one attempt. There were zero processing leases older than ten minutes and zero source cleanups overdue by more than fifteen minutes at the observation. These observations show no current stuck-queue incident; they are not a load or availability guarantee. No source text, tokens, private row contents or user identifiers were copied into these findings.

A project-wide Supabase advisor scan returned warnings outside and inside the wider site. Owner-policy anonymous-access warnings do not by themselves establish cross-account access: the actual tracker predicates above were checked. No unrelated policy or database configuration was changed. This audit is not a declaration that the entire shared project is vulnerability-free.

### Test evidence and unverified items

- Automated opportunity tests: 130 passing, including runtime-mocked receipt/account/concurrency/failure cases and insert-collision tests that preserve existing notes/status/title.
- Targeted extension/backend TypeScript check with Vite import-meta types passes. Production website build completes successfully (50.37 seconds); existing unrelated prerender-header warnings and the photography-catalog fallback are recorded in its local log. Chrome, Firefox and Safari production builds pass.
- **Real Chrome actually executed:** reload of 2.1.11, persisted signed-in popup; reload of an intermediate 2.1.12 candidate; disabled save on a restricted page; rendering of the deployed privacy page before the saved origin block. The final rebuilt ZIP has not been reloaded after the subsequent code hardening. No fresh Google OAuth flow, second-account login, successful new-page extraction, completed right-click save, duplicate round-trip, restart/offline flow or dashboard-record comparison is claimed for this release.
- Browser work was interrupted by a saved deny for abodid.com, repeated Mac locks, and an automation timeout after the reported unlock. These are test-environment blockers, not confirmed extension bugs. The user must clear the saved permission and keep Chrome available/unlocked for the remaining pass.
- **Three 1280×800 actual-UI screenshots are still pending.** No mockups, old images, AI reconstructions or fabricated success states have been substituted. The planned set is signed-out popup with disclosure; actual save/processing/saved popup beside its public source; dashboard filtered to public opportunity data without private notes or personal appointments.

### Final local package evidence

`extension/releases/opportunity-tracker-2.1.12-chrome.zip` — 41,989 bytes; SHA-256 `9d476fd45a61c8e1cc7d4ea48367f48a090d744df75999388e348f9de33ae954`. Nine built runtime/icon files; manifest at ZIP root; seven Chrome permissions; no source maps, tests, environment files or benchmark artifacts. All ZIP CRCs and per-file hashes verify. `extension/releases/store-listing.txt` exports the exact validated listing block (127-character short description; detailed description below 16,000 characters). The adjacent audit JSON records `submission_ready: false`.

### Current blockers before submission

1. Complete the browser acceptance matrix and three real 1280×800 screenshots once origin permission and unlocked Chrome access are available.
2. Create/obtain the unpublished store draft ID and verify its exact Supabase OAuth callback and a fresh external-user login. Confirm Google OAuth audience/testing status.
3. Deploy the reviewed backend insert-race fix only after approval, then recheck the live capture path. No website deployment has been authorized/performed as part of submission preparation.
4. Verify actual OpenRouter/provider training/logging/retention settings and the complete deployed privacy text; complete the Store Privacy practices form consistently.
5. Confirm account-wide spending controls/alerts and support/publisher settings. The code's 10-per-minute-per-user burst protection is not an account-wide cost cap.

## Previous local audit — 2.1.11 (2026-10-26)

**Current decision: packaged for draft upload; not ready for Submit for Review.** The user confirmed there is no existing Chrome Web Store item. Browser-tool attempts to open the Developer Dashboard returned “Not allowed”; no item was created, uploaded or published. No registration fee or legal agreement was accepted.

### Fixed in 2.1.11

- Right-click page and link saves now use the same persisted receipt and final-status alarm path as toolbar saves. Previously this path submitted jobs without updating popup progress or scheduling final feedback.
- Saving a link no longer supplies the unrelated parent tab title as the linked opportunity's title.
- Late capture/status completions cannot recreate a receipt removed by logout or replace a newer receipt. Requests are bound to the initiating account, and a 401 retry will not submit an old capture under another account's refreshed token.
- Startup/install events reschedule checks for the latest queued receipt, because browser alarms may be cleared across restarts.
- A repeatable build-and-package command is available: `node scripts/package-opportunity-extension.mjs`. It builds Chrome, checks declared privileges, verifies actual icon sizes, scans for configured privileged secrets, excludes unexpected files, and writes ZIP/audit hashes. It never uploads or publishes.

### Remaining launch gates

1. **Store identity and external-user login.** Upload an unpublished draft, configure its exact Supabase redirect, and test real sign-in/sign-out with that ID. Confirm the Google OAuth application permits the intended public users rather than only a testing allow-list. No store item/ID exists yet.
2. **Real-browser acceptance.** Mocked tests cover the corrected receipt flows but do not establish store-ID OAuth, Chrome restricted-page behavior, denied notifications, or a full production save after browser closure. Run the current release, including multiple accounts, before review.
3. **Privacy and AI processing.** The repository privacy source covers extension capture, Supabase, OpenRouter, retention, deletion and Limited Use. During this audit a direct request to the live privacy URL returned HTTP 429, while the search index showed an older cached page. Live delivery and content are therefore unverified for this release; check in a normal browser. Confirm OpenRouter and downstream provider retention/training settings match the disclosure. Do not claim that the free benchmark changed the deployed model: it did not.
4. **Store materials.** Screenshots remain missing. Supply at least one current 1280×800 or 640×400 screenshot, preferably signed-out disclosure, processing/saved popup and dashboard. Complete publisher contact, regions, privacy practices and review instructions in the Dashboard.
5. **Public-launch cost controls.** Code limits AI extraction to 10 calls per minute per user; this is burst protection, not a daily/global spending cap. Confirm provider/account budget limits, alerts and abuse monitoring before opening public registration. Existing OpenRouter account caps were not inspected or changed.

### Executed verification

- 119 opportunity tests pass, including four new runtime-mocked background tests for right-click persistence/alarms, logout during handoff, account changes during token retry, and restoring alarms after restart.
- Targeted TypeScript checks and production Chrome, Firefox and Safari builds pass.
- Chrome ZIP contains nine built runtime/icon files, with the manifest at its root. No private benchmark artifacts or privileged credentials are included. The adjacent audit JSON records exact bytes and SHA-256 checksums; regenerate it if rebuilding.
- No fresh authenticated production capture was submitted and no production database, OAuth configuration, website deployment, live extraction model or account billing settings were changed.

## Version history

| Version | Date | Changes | Store status |
|---|---|---|---|
| 2.1.12 | 2026-10-26 | Binds receipts and identity to their account, atomically reuses duplicate handoffs, rejects restricted URLs, handles missing/unknown jobs and feedback failures, removes Chrome tabs permission, and fixes owner-preserving backend insert collisions. UI/branding/model unchanged. | Local candidate; browser/assets/OAuth gates open |
| 2.1.11 | 2026-10-26 | Unifies context-menu and toolbar receipt persistence and completion checks, clears stale feedback after logout, binds capture retries to the initiating account, restores queued checks on startup, and adds an audited Chrome ZIP packager. No new permissions or provider/model changes. | Local package; not uploaded |
| 2.1.10 | 2026-10-25 | Simplifies loading copy and places decorative wave dots below the centered status label across packaged popup and shared website feedback. Removes conversational helper subtitles from initial website loaders. No permission or data-handling changes. | Draft |
| 2.1.9 | 2026-10-25 | Adds shared three-dot wave feedback, a subtle busy glow and welcoming waiting copy to popup/sign-in/save flows; honors reduced-motion preferences and keeps successful receipts minimal. The web dashboard adds a four-step dismissible/replayable tour with mobile spotlight positioning, Telegram guidance and truthful extension availability. No permissions, host permissions or data categories changed. | Draft |
| 2.1.8 | 2026-10-25 | Uses an auth-only client with the existing session storage key, refreshes tokens on demand instead of continuously in the worker, bounds auth transport attempts, preserves sign-in during retryable network failures, reports connection errors without raw rejected-fetch logging, and checks local-scope logout errors. Adds regression coverage for outage/recovery. No permissions, host permissions or data categories changed. | Draft |
| 2.1.7 | 2026-10-25 | Leads with current tab and Save opportunity, groups account identity, View your dashboard and bottom-right Log out in a footer, shows one clear processing or minimal saved receipt, restores the latest receipt across popup/tab changes, keeps accepted and final receipts until replaced or signed out, makes interrupted sending retryable, and guards stale state updates. No permissions or host permissions added; local receipt retention is updated above. | Draft |
| 2.1.6 | 2026-10-24 | Requests Safari’s narrowly scoped `abodid.com` access from the Google sign-in gesture before opening OAuth, allows the callback content script to run, accepts Safari’s alternate sender URL metadata, validates the exact origin/path, retries a sleeping background worker with a bounded timeout, and preserves PKCE state until exchange succeeds. Chrome permissions and data handling are unchanged. | Draft |
| 2.1.5 | 2026-10-21 | Restores active capturing and queued states whenever the popup is reopened, even after focus or tab changes; completed and failed receipts remain page-specific so unrelated pages stay uncluttered. | Draft |
| 2.1.4 | 2026-10-21 | Added page-specific receipt restoration when reopening the popup, explicit “do not capture again” handoff copy, resource-efficient completion checks after popup dismissal, and final saved, duplicate or failed browser notifications. Added the narrowly scoped `alarms` permission for those one-shot completion checks. | Draft |
| 2.1.3 | 2026-10-21 | Prevented an earlier persisted queued receipt from displaying as active progress when the popup is merely opened; capture progress and completion now render only after Capture & Save is selected in that popup session. Durable background processing remains unchanged. | Draft |
| 2.1.2 | 2026-10-21 | Reworked the popup hierarchy around account, current tab and primary capture action; replaced placeholder category/deadline values with one global background-processing state; reveals extracted category and deadline only after completion; simplified repeated branding and dashboard copy. No permissions or data handling changed. | Draft |
| 2.1.1 | 2026-10-21 | Prewarms the minimal signed-in profile cache when Chrome starts or the extension is installed, writes a fallback identity cache immediately after session recovery instead of waiting for the profile API, initializes the popup cache-first, and reserves the account row to eliminate the delayed name/handle layout shift. No permissions or data categories changed. | Draft |
| 2.1.0 | 2026-10-20 | Replaced browser-lifetime extraction with a durable server-side capture receipt; accepted jobs continue after the popup, tab, browser or extension worker closes; added idempotent submissions, automatic retry recovery, dashboard resumption and explicit retry for final failures; limited temporary raw-page retention to successful completion or 24 hours after final failure. | Draft |
| 2.0.2 | 2026-10-20 | Redesigned the signed-in popup with clearer name/handle hierarchy, simpler logout, no redundant current-page label or upper diagonal action, and a persistent Open dashboard control; cached the minimal profile display for immediate rendering; moved toolbar capture ownership to the service worker with restorable state, a four-square progress indicator, a Keep exploring action, and browser-level success/failure notifications. | Superseded before submission |
| 2.0.1 | 2026-10-15 | Prevented consecutive captures from getting stuck or erasing a newly pasted link; added bounded extraction waits, automatic expired-session recovery, OpenRouter multi-model failover and jittered throttling recovery for concurrent traffic; rechecked the current tab immediately before toolbar capture using the disclosed `tabs` permission; prevented an older right-click completion from replacing a newer extraction's feedback. | Draft |
| 2.0.0 | 2026-10-15 | Branded as Opportunity Tracker; corrected the yellow “O” icon’s optical centring across the store listing, toolbar and context menu; added first-name personalization, an instant current-page preview without authentication flash, yellow scanning feedback, a redesigned post-capture receipt with clear category/deadline facts and a direct dashboard action, explicit minimal Google identity scopes, prominent toolbar/right-click disclosures, resilient extraction diagnostics, and an on-page context-menu progress/completion toast. | Draft |

## Review notes

### Known limitations

- AI extraction requires network access and may fail on inaccessible, script-heavy, paywalled or unsupported pages. The UI reports failures without silently saving incomplete data, and long-running requests return to a retryable state after the capture timeout.
- Google sign-in depends on the exact extension identity redirect being allow-listed in Supabase. The current unpacked ID is configured, but the Chrome Web Store ID may differ and must be added after draft upload and before review; use the draft public key to test that same identity locally.
- The extension is intended for public opportunity pages. Users should not capture private messages, account portals, health information, payment information, or other sensitive page content.
- A self-service full-account deletion flow is not currently documented; requests are handled through `hello@abodid.com`.

### Rejection history

None recorded.
