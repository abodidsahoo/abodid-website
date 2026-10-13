# Chrome Web Store Listing — Opportunity Tracker

> Last updated: 2026-10-13
>
> Manifest source: `extension/manifests/chrome.json`
>
> Release version: `2.0.0` (draft)

This file is the source of truth for Chrome Web Store metadata, permission justifications, privacy disclosures, release evidence, and submission blockers. Update it whenever the Chrome manifest, extension behavior, branding, data handling, or store assets change.

## Store listing

**Extension name**

Opportunity Tracker

**Short description — 127/132 characters**

Save open calls, residencies, fellowships, grants and jobs. AI summarizes key details and important dates so you stay on track.

**Tagline**

Every opportunity organized.

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
• Save a page or link from Chrome's right-click menu
• Automatically summarize the opportunity, organisation, requirements and next action
• Identify deadlines and other important dates
• Open your private Opportunity Tracker dashboard from the toolbar popup

HOW TO USE
1. Sign in with the same Google account you use on abodid.com.
2. Open a public opportunity page and select Capture & Save, or right-click a page or link and choose Save to Opportunity Tracker.
3. Review and manage the saved opportunity in your dashboard.

PRIVACY
Nothing is collected until you choose Capture & Save or use the save context menu. For a capture, the page URL, title and visible text are securely sent to abodid.com and its AI service only to extract and save opportunity details. Authentication and saved opportunity data are used only to provide the tracker. Data is not sold or used for advertising.

PERMISSIONS
The extension accesses only the tab you explicitly choose to capture, stores your sign-in session locally, adds the two save commands to Chrome's right-click menu, and communicates only with abodid.com and its authentication service.

SUPPORT
Questions, privacy requests or bug reports: hello@abodid.com
Privacy policy: https://abodid.com/privacy

Version 2.0.0 — Branded as Opportunity Tracker with clearer capture privacy information and more reliable error feedback.
```

## URLs and developer information

| Field | Value | Status |
|---|---|---|
| Homepage URL | `https://abodid.com/opportunities` | Ready |
| Privacy policy URL | `https://abodid.com/privacy` | Ready after the 2026-10-13 policy update is deployed and rechecked |
| Support URL | `https://abodid.com/contact` | Ready |
| Support email | `hello@abodid.com` | Confirm this inbox is monitored before submission |
| Publisher name | Abodid Sahoo | Confirm it matches the Developer Dashboard account |
| Visibility | Public | Planned |
| Regions | All regions | Planned; confirm legal and support coverage before submission |

## Graphics and assets

| Asset | Requirement | Current status | Source / next action |
|---|---|---|---|
| Store icon | 128×128 PNG | Ready | `extension/icons/icon-128.png`; verified as a real 128×128 RGBA PNG |
| Toolbar icon | 16×16 PNG | Ready | `extension/icons/icon-16.png`; verified as 16×16 |
| Extension-management icon | 48×48 PNG | Ready | `extension/icons/icon-48.png`; verified as 48×48 |
| Screenshot 1 | 1280×800 or 640×400 | Missing | Capture the signed-out popup with the privacy disclosure visible |
| Screenshot 2 | 1280×800 or 640×400 | Missing | Capture a successful save and extracted deadline/category |
| Screenshot 3 | 1280×800 or 640×400 | Missing | Show the private dashboard with organized opportunities |
| Small promo tile | 440×280 PNG or JPEG | Recommended, missing | Use the Pop Editorial blue, cream and yellow system without unsupported claims |
| Marquee promo tile | 1400×560 PNG or JPEG | Optional, missing | Create only if merchandising is planned |

Screenshots must show the current `2.0.0` UI and must not include private account data, email addresses, authentication tokens, or opportunity content that cannot be published.

## Permission justifications

These entries must match the built `extension/dist/chrome/manifest.json`, not only the source manifest. The build adds the configured Supabase project origin to `host_permissions`.

| Permission | Type | Developer Dashboard justification |
|---|---|---|
| `activeTab` | API permission | Grants temporary access only to the tab the user explicitly invokes from the toolbar or right-click menu. It lets the popup display that page's title and URL and limits capture access to a deliberate user action instead of requesting permanent access to browsing activity. |
| `scripting` | API permission | Runs the packaged capture function in the user-selected tab after Capture & Save. The function reads visible page text, relevant links and structured opportunity data so the service can identify the title, organisation, deadline, requirements and application link. It does not run automatically on every page. |
| `storage` | API permission | Stores the user's Supabase PKCE authentication session and refresh state in extension-local storage so sign-in persists across popup and service-worker restarts. It is not used for advertising, profiling or cross-device browsing-history sync. |
| `contextMenus` | API permission | Adds “Save page” and “Save link” commands to Chrome's right-click menu so a user can deliberately send an opportunity to the same private tracker without first opening the popup. |
| `identity` | API permission | Opens and completes the browser-controlled Google/Supabase OAuth flow using a `chromiumapp.org` redirect. This keeps the authorization result out of visited pages and is used only when the user selects Continue with Google. |
| `https://abodid.com/*` | Host permission | Sends authenticated session checks and user-triggered opportunity captures to the Opportunity Tracker API and opens the user's dashboard. No code is downloaded or executed from this origin. |
| `https://jwipqbjxpmgyevfzpjjx.supabase.co/*` | Host permission added at build time | Authenticates the user, refreshes the signed-in session and stores or retrieves that user's private tracker records through the configured Supabase project. Access is restricted by authenticated Row Level Security. |

### Permission minimization result

- The Chrome build does not request `<all_urls>`, `tabs`, `history`, `cookies`, `webRequest`, downloads, notifications, clipboard, location, camera, or microphone.
- `activeTab` is preferred over persistent access to all websites. Page capture occurs only after a toolbar or context-menu user gesture.
- The two host origins are the product application and its authentication/database provider. No wildcard third-party host access is present.
- Removing any current permission would break an existing, user-visible feature described above.

## Privacy and data use

**Does the extension collect user data?** Yes. Collection is limited to data needed to authenticate the user and save a user-selected opportunity.

| Chrome Web Store data type | Collected / transmitted | Purpose and handling | Shared with a service provider? |
|---|---|---|---|
| Personally identifiable information | Yes | Google account email/display identity and the user's tracker username identify the private account. | Google for sign-in; Supabase for authentication and account storage. |
| Health information | No | Not requested or used. Users should not capture pages containing private health data. | No. |
| Financial and payment information | No | Not requested or used. Public funding/fee text on an opportunity page may be extracted as part of the opportunity record, but no user's payment data is requested. | No user financial data is shared. |
| Authentication information | Yes | OAuth authorization result, access token and refresh state keep the user signed in. Tokens are stored in extension-local storage and transmitted only over HTTPS to the product and authentication service. | Google and Supabase as authentication providers; bearer tokens are sent to abodid.com only to authorize tracker requests. |
| Personal communications | No | The extension does not read email, messages or chat. Users should capture public opportunity pages, not private communications. | No. |
| Location | Browser timezone only | The browser timezone is sent with a capture solely to interpret ambiguous dates correctly. The extension does not request geolocation or collect GPS coordinates. | abodid.com and OpenRouter process it for date extraction. |
| Web history | Yes, user-selected page only | The URL and title of the page or link the user deliberately saves are transmitted and stored as part of the opportunity. The extension does not monitor browsing in the background. | abodid.com; Supabase stores the saved URL; OpenRouter may process it as extraction context. |
| User activity | Yes, minimal | Capture timestamp and the explicit save action support date interpretation, duplicate handling and the saved record. No advertising or behavioral profile is created. | abodid.com, Supabase and OpenRouter only as needed for the capture. |
| Website content | Yes, user-selected page only | Visible text, relevant links and limited structured data from the selected page are transmitted for opportunity extraction. Raw page text is not stored in the saved opportunity record; derived opportunity fields are stored. | OpenRouter processes the text for AI extraction; abodid.com orchestrates the request; Supabase stores the derived record. |

### Prominent disclosure and consent

The popup displays this disclosure before the capture control can be used:

> Nothing is collected until you choose Capture & Save. Then this page's URL, title and visible text are securely sent to abodid.com and its AI service only to extract and save the opportunity.

The Chrome Web Store listing repeats the same disclosure. Capturing requires the user's affirmative toolbar-button or context-menu action. Google sign-in is separately initiated by the Continue with Google button.

### Service providers

| Provider | Role | Data involved |
|---|---|---|
| Google | User-selected OAuth sign-in | Account identity and OAuth authorization data |
| Supabase | Authentication, session refresh and database storage | Account identity, auth session, saved opportunity records |
| Vercel | Hosting for abodid.com application and API endpoints | Authenticated API requests and user-triggered capture payloads |
| OpenRouter | AI extraction requested by the capture API | Selected page text, URL/title context, capture time and timezone needed to derive opportunity fields |

Before submission, confirm the current data-processing and retention terms for every provider and ensure contractual settings match this disclosure.

### Storage, retention and deletion

- OAuth session material remains in `chrome.storage.local` until it expires, is replaced, the user signs out, or extension storage is cleared.
- Saved opportunity records remain in the user's private tracker until the user deletes them.
- Raw page text is used during extraction and is not written to the saved opportunity record by the application.
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

| Test | Expected result | 2026-10-13 status |
|---|---|---|
| Load `extension/dist/chrome` unpacked | Extension installs with no manifest error | Passed in Chrome 155 through the Extensions DevTools domain; ID `bikjdgkkefmflkanfmppnidfkdiblnpg`, version `2.0.0`, enabled |
| Open popup while signed out | Branded sign-in UI and prominent privacy disclosure render; no console error | Passed at 360×457 CSS pixels; disclosure visible, auth state returned `signedIn: false`, and no popup/worker runtime, console or failed-network issues were reported |
| Google sign-in | OAuth completes and session persists after popup closes | Pending stable extension ID and Supabase redirect allow-list verification |
| Capture a public opportunity page | Page is extracted once, success details appear and the record is private | Pending authenticated real-Chrome test |
| Capture a restricted/internal Chrome page | Control disables or capture fails safely without crashing | Pending real-Chrome test |
| Save page/link from context menu | Success badge `✓`; failure badge `!`; no silent result | Pending authenticated real-Chrome test |
| Duplicate capture | Reports Already saved and does not consume another extraction | Covered by opportunity API tests; browser confirmation pending |
| Quota/network failure | Human-readable error; button becomes usable again | Code-audited; browser confirmation pending |
| Open dashboard | Opens the current user's tracker route | Pending signed-in real-Chrome test |
| Log out and reopen popup | Local session is removed and sign-in panel returns | Pending signed-in real-Chrome test |
| Service worker starts cleanly | Worker scope, name and version match the installed extension | Passed in Chrome 155; scope and `2.0.0` manifest verified with no worker issue events |
| Service worker restart with signed-in state | Session and capture continue because durable state is in extension storage | Code-audited; authenticated browser confirmation pending |

### Performance evidence

- The unpacked Chrome package is approximately 208 KB.
- Release output is minified with source maps disabled: popup JavaScript 3.60 KB (1.51 KB gzip), popup CSS 3.76 KB (1.28 KB gzip), and background JavaScript 178.67 KB (47.80 KB gzip).
- The extension registers no always-on content script in Chrome. Page extraction is injected only after a user capture action, avoiding work on ordinary page loads.
- The real-Chrome signed-out popup loaded with no failed resource requests or runtime errors.
- Network and AI work is deferred until sign-in or capture; the popup's signed-out state is resolved from extension-local auth state.

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
- [x] User-triggered data collection is prominently disclosed inside the popup.
- [x] Context-menu save actions provide visible success and failure feedback.

### Must complete before submission

- [ ] Deploy the updated privacy policy and verify `https://abodid.com/privacy` is public, current and returns HTTP 200.
- [ ] Restart Codex so the newly configured Chrome DevTools MCP server is loaded, enable remote debugging for the Chrome session, and use it for the remaining authenticated and restricted-page rows above. The equivalent Chrome Extensions DevTools-domain load, popup, manifest and worker checks already pass in Chrome 155.
- [ ] Establish the production Chrome Web Store extension ID, then add `https://<extension-id>.chromiumapp.org/supabase-auth` to the Supabase redirect allow-list.
- [ ] Complete a successful Google sign-in and sign-out test with the production/stable extension ID.
- [ ] Confirm provider data-processing/retention settings, especially OpenRouter's policy for submitted page text.
- [ ] Create at least one compliant 1280×800 or 640×400 screenshot; three current screenshots are recommended.
- [ ] Confirm publisher name, verified contact email, visibility and regions in the Developer Dashboard.
- [ ] Complete the Dashboard Privacy practices form exactly as documented above.
- [ ] Produce a clean ZIP from `extension/dist/chrome` only; exclude source maps, tests, environment files, repository metadata, `CHROMEWEBSTORE.md`, and development configuration.
- [ ] Inspect the final ZIP contents and bump the manifest version if `2.0.0` has already been uploaded.

## Version history

| Version | Date | Changes | Store status |
|---|---|---|---|
| 2.0.0 | 2026-10-13 | Branded as Opportunity Tracker; added prominent capture disclosure, resilient popup errors, and visible context-menu failure feedback. | Draft |

## Review notes

### Known limitations

- AI extraction requires network access and may fail on inaccessible, script-heavy, paywalled or unsupported pages. The UI reports failures without silently saving incomplete data.
- Google sign-in depends on the exact extension identity redirect being allow-listed in Supabase. The unpacked development ID may differ from the Chrome Web Store ID unless a stable key is used.
- The extension is intended for public opportunity pages. Users should not capture private messages, account portals, health information, payment information, or other sensitive page content.
- A self-service full-account deletion flow is not currently documented; requests are handled through `hello@abodid.com`.

### Rejection history

None recorded.
