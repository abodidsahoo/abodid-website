# Chrome Web Store Listing — Opportunity Tracker

> Last updated: 2026-10-21
>
> Manifest source: `extension/manifests/chrome.json`
>
> Release version: `2.1.3` (draft)

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
• Receive a durable capture receipt immediately, then close the tab, popup or browser while processing continues
• See successful opportunities appear in the dashboard, or retry a failed background capture without returning to the original page
• Capture consecutive pages reliably without browser or AI interruptions losing the submitted link
• Open your private Opportunity Tracker dashboard from the toolbar popup

HOW TO USE
1. Sign in with Google to create or open your private Opportunity Tracker account.
2. Open a public opportunity page and select Capture & Save, or right-click a page or link and choose Save to Opportunity Tracker.
3. Review and manage the saved opportunity in your dashboard.

PRIVACY
Google sign-in shares your name, primary email address and profile photo only to create and personalize your private tracker account. The extension does not request access to Gmail, Drive, Calendar or Contacts. Page content is not collected until you choose Capture & Save or use the save context menu. For a capture, the page URL, title and visible text are securely sent to abodid.com and its AI service only to extract and save opportunity details. Data is not sold or used for advertising.

PERMISSIONS
The extension accesses only the tab you explicitly choose to capture, stores your sign-in session locally, adds the two save commands to Chrome's right-click menu, and communicates only with abodid.com and its authentication service.

SUPPORT
Questions, privacy requests or bug reports: hello@abodid.com
Privacy policy: https://abodid.com/privacy

Version 2.1.3 — Starts popup progress only after the current Capture & Save action instead of replaying an earlier stored capture state.
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
| Screenshot 2 | 1280×800 or 640×400 | Missing; refresh required for the redesigned popup | Capture the signed-in account hierarchy, four-square handoff state, durable “Safely captured” receipt and persistent Open dashboard action |
| Screenshot 3 | 1280×800 or 640×400 | Missing | Show the private dashboard with organized opportunities |
| Small promo tile | 440×280 PNG or JPEG | Recommended, missing | Use the Pop Editorial blue, cream and yellow system without unsupported claims |
| Marquee promo tile | 1400×560 PNG or JPEG | Optional, missing | Create only if merchandising is planned |

Screenshots must show the current `2.1.3` UI and must not include private account data, email addresses, authentication tokens, or opportunity content that cannot be published.

## Permission justifications

These entries must match the built `extension/dist/chrome/manifest.json`, not only the source manifest. The build adds the configured Supabase project origin to `host_permissions`.

| Permission | Type | Developer Dashboard justification |
|---|---|---|
| `activeTab` | API permission | Grants temporary page access only after the user invokes the extension from the toolbar or right-click menu. It limits content extraction and status injection to a deliberate user action instead of allowing automatic access during ordinary browsing. |
| `tabs` | API permission | Reads the active tab's current title and URL when the popup opens and again immediately before capture. Rechecking prevents a navigation or tab change from pairing newly extracted content with a stale page address. The extension does not enumerate, monitor or retain browsing history. |
| `scripting` | API permission | Runs packaged functions in the user-selected tab after Capture & Save or the Save page context-menu action. One function reads visible page text, relevant links and structured opportunity data so the service can identify the title, organisation, deadline, requirements and application link; another displays the context-menu action’s durable handoff status. Neither runs automatically on ordinary browsing. |
| `storage` | API permission | Stores the user's Supabase PKCE authentication session, a minimal cached display name/username and the latest short-lived durable capture receipt in extension-local storage. This lets the popup reopen with accurate handoff status while server-side processing continues independently. It is not used for advertising, profiling or cross-device browsing-history sync. |
| `contextMenus` | API permission | Adds “Save page” and “Save link” commands to Chrome's right-click menu so a user can deliberately send an opportunity to the same private tracker without first opening the popup. |
| `identity` | API permission | Opens and completes the browser-controlled Google/Supabase OAuth flow using a `chromiumapp.org` redirect. It is used only when the user selects Continue with Google and requests the minimal `openid email profile` identity scopes so the tracker can receive the account identifier, primary email, display name and profile photo. It does not grant access to Gmail, Drive, Calendar or Contacts. |
| `notifications` | API permission | Shows a single browser-level confirmation after a user-triggered capture is safely accepted for background processing, or an immediate handoff failure if the receipt cannot be recorded. The notification is optional feedback and does not control processing. Notifications are not used for marketing. |
| `https://abodid.com/*` | Host permission | Sends authenticated session checks and user-triggered opportunity captures to the Opportunity Tracker API and opens the user's dashboard. No code is downloaded or executed from this origin. |
| `https://jwipqbjxpmgyevfzpjjx.supabase.co/*` | Host permission added at build time | Authenticates the user, refreshes the signed-in session and stores or retrieves that user's private tracker records through the configured Supabase project. Access is restricted by authenticated Row Level Security. |

### Permission minimization result

- The Chrome build does not request `<all_urls>`, `history`, `cookies`, `webRequest`, downloads, clipboard, location, camera, or microphone. Its notification permission is limited to user-triggered capture completion or failure.
- `tabs` is limited to current-tab metadata, while `activeTab` gates page-content access behind a toolbar or context-menu user gesture. Page capture never occurs during ordinary browsing.
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

> Google sign-in shares your name, email and profile photo only to create and personalize your account. Page content is not collected until you choose Capture & Save or Save to Opportunity Tracker from the right-click menu; it is then sent only to extract and save the opportunity.

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

- OAuth session material, the minimal display-name/username cache and the latest short-lived capture receipt remain in `chrome.storage.local` until replaced, expired, the user signs out, or extension storage is cleared. Server-side processing does not depend on this local receipt.
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
| Load `extension/dist/chrome` unpacked | Extension installs with no manifest error | Version `2.0.0` was reloaded and verified in Chrome on 2026-10-14 with ID `bikjdgkkefmflkanfmppnidfkdiblnpg`; the `2.1.3` popup build requires a final unpacked reload. |
| Open popup while signed out | Current-page preview appears first; sign-in UI and prominent privacy disclosure render only after the signed-out state is confirmed; no console error | Built and passed a delayed-session headless Chromium UI-state test on 2026-10-14; real-extension signed-out recheck pending. |
| Open popup while signed in | The service worker prepares the minimal local identity cache at browser startup; the popup reserves the profile row and paints the cached name and handle before the network refresh, without a late layout shift | Cache-first initialization and startup prewarming are implemented in `2.1.1`; final unpacked signed-in timing check pending. |
| Google sign-in | OAuth completes and session persists after popup closes | The unpacked Chrome ID `bikjdgkkefmflkanfmppnidfkdiblnpg` and its exact `chromiumapp.org/supabase-auth` callback were verified and allow-listed in Supabase on 2026-10-14. A fresh end-to-end sign-in and sign-out retest is pending. |
| Capture a public opportunity page | Four-square handoff progress appears immediately; a durable receipt is returned before extraction and the record remains private | Automated build passed; authenticated real-Chrome test pending |
| Close the popup, tab or browser after the receipt | Server-side extraction continues independently; the dashboard resumes unfinished status after reopening and shows the saved opportunity or a retryable failure | Code-audited; authenticated real-Chrome confirmation pending |
| Capture two different pages consecutively | The second page is read from the current tab, its request completes independently, and the popup remains reusable | Regression logic covered by local opportunity tests; authenticated real-Chrome confirmation pending |
| Capture from many independent accounts concurrently | Requests retain isolated prompts/results; transient provider throttling uses model failover and a bounded jittered retry | A mocked 50-request concurrency regression passes locally; provider-account load confirmation remains pending |
| Capture a restricted/internal Chrome page | Control disables or capture fails safely without crashing | Pending real-Chrome test |
| Save page/link from context menu | An on-page toast immediately reports the durable handoff, then confirms that background processing owns the job or shows a receipt error; toolbar badge remains a fallback | The former synchronous flow passed an authenticated real-Chrome page-context test on 2026-10-14. The new `2.1.0` “Securing capture…” → “Capture received” flow, link context and restricted-page fallback require final real-Chrome confirmation. The disclosed `tabs` permission supports fresh popup target metadata, not background monitoring. |
| Duplicate capture | Reports Already saved and does not consume another extraction | Covered by opportunity API tests and confirmed in real Chrome on 2026-10-14. |
| Quota/network/timeout failure | Human-readable error; the bounded request returns the button to a usable retry state | Regression logic covered by local opportunity tests; browser confirmation pending |
| Open dashboard | Opens the current user's tracker route | Pending signed-in real-Chrome test |
| Log out and reopen popup | Local session is removed and sign-in panel returns | Pending signed-in real-Chrome test |
| Service worker starts cleanly | Worker scope, name and version match the installed extension | Passed in Chrome 155 for `2.0.0`; the `2.1.3` manifest requires a final unpacked reload |
| Service worker restart with signed-in state | Session remains local while an accepted capture continues server-side without depending on service-worker lifetime | Code-audited; authenticated browser confirmation pending |

### Performance evidence

- The release output remains compact and is minified with source maps disabled: popup JavaScript 6.34 KB (2.42 KB gzip), popup CSS 6.33 KB (1.98 KB gzip), and background JavaScript 189.42 KB (51.20 KB gzip) in the `2.1.3` Chrome build on 2026-10-21.
- The redesigned successful-save receipt was rendered at the popup's 360×600 viewport on 2026-10-15 with no horizontal overflow; all popup buttons measured at least 44px tall, and category/deadline values are configured to wrap inside the keylined facts panel.
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
- [x] The updated public privacy policy is deployed at `https://abodid.com/privacy` and was rechecked in production on 2026-10-14.
- [x] User-triggered data collection is prominently disclosed inside the popup.
- [x] Context-menu save actions provide visible success and failure feedback.
- [x] The exact OAuth callback for the current unpacked Chrome ID (`bikjdgkkefmflkanfmppnidfkdiblnpg`) is allow-listed and remotely verified in Supabase.

### Must complete before submission

- [ ] Restart Codex so the newly configured Chrome DevTools MCP server is loaded, enable remote debugging for the Chrome session, and use it for the remaining authenticated and restricted-page rows above. The equivalent Chrome Extensions DevTools-domain load, popup, manifest and worker checks already pass in Chrome 155.
- [ ] After Chrome Web Store publication assigns the production extension ID, add `https://<production-extension-id>.chromiumapp.org/supabase-auth` to Supabase if it differs from the verified unpacked ID.
- [ ] Complete a successful Google sign-in and sign-out test with the production/stable extension ID.
- [ ] Confirm provider data-processing/retention settings, especially OpenRouter's policy for submitted page text.
- [ ] Create at least one compliant 1280×800 or 640×400 screenshot; three current screenshots are recommended.
- [ ] Confirm publisher name, verified contact email, visibility and regions in the Developer Dashboard.
- [ ] Complete the Dashboard Privacy practices form exactly as documented above.
- [ ] Produce a clean ZIP from `extension/dist/chrome` only; exclude source maps, tests, environment files, repository metadata, `CHROMEWEBSTORE.md`, and development configuration.
- [ ] Inspect the final ZIP contents and bump the manifest version if `2.1.3` has already been uploaded.

## Version history

| Version | Date | Changes | Store status |
|---|---|---|---|
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
- Google sign-in depends on the exact extension identity redirect being allow-listed in Supabase. The current unpacked ID is configured, but the Chrome Web Store ID may differ and must be added after publication unless a stable key is adopted.
- The extension is intended for public opportunity pages. Users should not capture private messages, account portals, health information, payment information, or other sensitive page content.
- A self-service full-account deletion flow is not currently documented; requests are handled through `hello@abodid.com`.

### Rejection history

None recorded.
