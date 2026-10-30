# Opportunity Tracker WebExtension

One shared TypeScript source powers the Chrome, Firefox, and Safari builds. The extension contains no curator passcode, OpenRouter key, service-role key, extraction prompt, or configurable backend URL. It authenticates with Supabase Google OAuth using PKCE and stores the resulting rotating session in extension-local storage.

## Build

The build reads the public Supabase URL and publishable/anon key from the repository's ignored environment files. These identify the Supabase project but do not grant privileged database access; RLS remains the authorization boundary.

```sh
npm run extension:build:chrome
npm run extension:build:firefox
npm run extension:build:safari
```

Outputs:

- `extension/dist/chrome`
- `extension/dist/firefox`
- `extension/dist/safari`

Source maps are disabled. Load the generated directory, not the `extension` source directory.

## Chrome DevTools MCP

The repository uses Google's `chrome-extensions` and `modern-web-guidance` skills under `.agents/skills/`. Codex is configured with the Chrome DevTools MCP server using extension tools and automatic connection:

```sh
codex mcp add chrome-devtools -- npx -y chrome-devtools-mcp@latest --categoryExtensions --autoConnect
```

Restart Codex after adding or changing the MCP entry. For an existing Chrome profile, open `chrome://inspect/#remote-debugging`, allow remote debugging for that browser session, then use the MCP extension tools to install `extension/dist/chrome`, trigger the toolbar action, inspect the popup and service worker, and reload the extension after code changes.

Keep the root `CHROMEWEBSTORE.md` synchronized with manifest permissions, data handling, store copy, release evidence, and submission blockers whenever this extension changes.

## Supabase redirect allow-list

Chrome and Firefox builds have a stable identity redirect. Obtain it from `identity.getRedirectURL('supabase-auth')` for the installed build and add the exact value to Supabase Auth → URL Configuration → Redirect URLs.

- Chrome: `https://<extension-id>.chromiumapp.org/supabase-auth`
- Firefox: the URL returned for the signed `opportunities@abodid.com` extension
- Safari: `https://abodid.com/opportunities/extension/callback`

Google's OAuth client continues to use the Supabase project callback URL; extension redirects are configured in Supabase, not as additional Google callback URLs.

## Local installation and checks

### Chrome

1. Run `npm run extension:build:chrome`.
2. Open `chrome://extensions`, enable Developer mode, and load `extension/dist/chrome`.
3. Record the stable extension ID, allow-list its identity redirect in Supabase, then reload.
4. Verify Google sign-in, session persistence, two consecutive popup captures, overlapping context-menu captures, dashboard opening, logout, and a second account's isolation.

The right-click page action immediately shows an in-page receipt, captures the current page text, and hands the work to durable background processing. Right-clicking a link records the same durable receipt while the backend safely fetches the selected public URL. Once the receipt is accepted, closing the tab, popup, browser, or extension service worker does not cancel extraction. Restricted browser pages fall back to the toolbar badge because Chrome does not allow injected page UI there.

Each capture waits only for the durable receipt, not for AI extraction. The popup re-reads the active tab immediately before capture, and each submission carries an idempotency identity so browser retries cannot create duplicate jobs or opportunities. The dashboard resumes unfinished jobs, reports final failures, and offers a safe retry.

### Firefox

1. Run `npm run extension:build:firefox`.
2. Load `extension/dist/firefox/manifest.json` temporarily from `about:debugging`.
3. Allow-list the generated redirect URL.
4. For distribution, sign the build through Firefox Add-ons. The manifest uses the stable Gecko ID `opportunities@abodid.com`.

### Safari on macOS, iPhone, and iPad

1. Run `npm run extension:build:safari`.
2. Convert the output on macOS with Xcode:

   ```sh
   xcrun safari-web-extension-packager extension/dist/safari \
     --project-location extension/safari-xcode \
     --app-name "Opportunity Tracker" \
     --bundle-identifier com.abodid.opportunities
   ```

3. Open the generated project in Xcode, select the Apple team/signing configuration, and enable the extension for the macOS and iOS/iPadOS app targets.
4. Add `https://abodid.com/opportunities/extension/callback` to the Supabase redirect allow-list before device testing. Safari does not support the WebExtension `identity` API, so this target opens OAuth in a normal tab. When Continue with Google is selected, Safari first asks for narrowly scoped access to `abodid.com`; this permission is required so the callback content script can pass the one-time code and state back to the extension. The PKCE verifier and resulting tokens remain in extension-local storage.
5. Verify that denying the `abodid.com` prompt keeps the user in the popup with an actionable error, then grant it and confirm that Google sign-in completes, the callback tab closes, and the session persists after Safari restarts.
6. Test the containing macOS app and iOS/iPadOS app targets with separate accounts before App Store submission.

## Permission rationale

- `activeTab`: read the current page only after a user action.
- `tabs`: read the active tab's current URL and title when the popup opens and immediately before capture, so a navigation cannot pair new page content with a stale address. The extension does not enumerate or retain browsing history.
- `scripting`: collect visible text and structured-data hints after a toolbar or right-click page capture, and show progress/completion feedback for the right-click action.
- `storage`: persist the Supabase PKCE verifier/session and extension state.
- `contextMenus`: save a page or link through right-click.
- `identity` (Chrome and Firefox only): complete browser-controlled OAuth without exposing tokens to visited pages.
- Host permissions: only the configured Supabase project is required at install time. Safari requests optional access to `abodid.com` from the sign-in click so it can receive the OAuth callback and use the authenticated Opportunity Tracker API; Chrome and Firefox declare the same app origin as a required host permission.

The Safari callback content script runs only on `https://abodid.com/opportunities/extension/callback*`, validates the exact callback origin and path, and relays a one-time authorization code plus anti-forgery state. A bounded retry handles a temporarily sleeping background worker without leaving the page in a permanent loading state. It never receives an access token, refresh token, service-role key, or OpenRouter credential.

Page scripts are injected only after an explicit toolbar or context-menu action. They collect the selected page content or display the temporary capture-status toast, and never receive access or refresh tokens; authenticated API calls are made by the extension background context.

### Popup receipt and account layout (2.1.13)

The popup leads with the current tab and **Save opportunity**. Account identity, **View your dashboard**, and **Log out** live in a separate bottom area. Sending and queued work replace the save control with one clear status; completion shows a minimal saved receipt. The latest receipt is restored from local extension storage when reopened. Sending and queued progress remain visible after a tab change; completed, duplicate and failed receipts appear only on their source page (ignoring URL fragments). New pages show a clear Save opportunity action once prior processing finishes. Hiding a receipt does not delete it or the saved opportunity. Accepted jobs and final receipts remain until replaced, signed out, or storage is cleared. A sending phase interrupted for over five minutes becomes retryable. While the popup is open, queued status refreshes every three seconds (five seconds after a network error); once closed, existing one-shot browser alarms check completion. No new browser permission is needed.

### Authentication recovery (2.1.8)

Authentication uses the Supabase auth-only client with the same persisted session/PKCE storage key as earlier builds. The worker refreshes expired sessions on demand instead of running a continuous refresh timer. Auth requests time out after eight seconds per attempt and use the SDK's bounded retry behavior. An offline or temporarily unreachable auth service does not erase a stored sign-in; the popup reports a connection problem and can recover on reopening. Protected capture requests still require a valid token.

### Waiting feedback (2.1.9)

Session checks, sign-in/logout buttons, sending and queued capture status use three wave dots and clear status text. A subtle glow marks active waiting controls. Both effects stop for reduced-motion preferences, keeping the indicator and text visible. Completed receipts stop animating. The shared CSS is bundled locally; no dependency or browser permission is added. The website’s four-step Quick tour can be dismissed or replayed from Settings and explains Telegram voice notes and the extension’s current availability.

### Clean waiting states (2.1.10)

Busy labels use direct status text without trailing ellipses, with wave dots centered beneath the label. Initial page/account placeholders and queued capture copy follow the same pattern. Persistent progress, reduced-motion behavior and permissions are unchanged.

## Chrome Store release packaging

Run `node scripts/package-opportunity-extension.mjs` from the repository root. This produces `extension/releases/opportunity-tracker-2.1.13-chrome.zip` and its file/hash audit. The ZIP contains only the built Chrome runtime, manifest and icons. Generated releases are ignored by Git. The local free-model benchmark is not part of this package; extraction continues on the existing server configuration.

Right-click captures now persist the latest receipt and schedule completion checks just like toolbar captures. Link captures do not reuse their parent page title. Startup restores queued checks; logout prevents late completions from resurrecting removed receipts, and capture token retries reject account changes.

Upload the ZIP as an unpublished Chrome Developer Dashboard draft to obtain the store item ID. Configure that exact identity callback in Supabase and test login BEFORE submitting for review. The draft's public key can stabilize the unpacked ID for that test: https://developer.chrome.com/docs/extensions/reference/manifest/key. Follow the remaining release gates in the root CHROMEWEBSTORE.md; this command does not upload or publish.

## Release audit follow-up (2.1.12)

Latest main base: 15a4afc. Chrome requires 120+ and uses gesture-scoped activeTab metadata access; it no longer requests tabs. Firefox/Safari retain their existing tabs declarations. Save/status receipts and display identity are account-bound, simultaneous toolbar saves share one handoff, and unsupported pages are disabled. Backend URL capture resolves duplicate inserts without replacing an already saved row; deploy that separate server change only after approval.

The prior release candidate was `extension/releases/opportunity-tracker-2.1.12-chrome.zip`. Its historical audit remains in CHROMEWEBSTORE.md; the current candidate is 2.1.13 with the page-specific popup fix below. No submission or publication is performed by the package command.

## Page-specific final receipts (2.1.13)

Completed, duplicate and failed receipts no longer appear on unrelated pages. The popup rechecks restored receipt visibility after the current tab resolves, and local save errors remain tied to that page. Active sending/queued progress still restores across tabs. Current builds and the Chrome ZIP use 2.1.13; read the current audit in CHROMEWEBSTORE.md for validation and outstanding store gates.

## First Chrome Web Store release — Save Opportunity 1.0.0

The authoritative current release is **Save Opportunity 1.0.0**. The preceding 2.x notes describe unpacked development builds and are retained as history. No Store item existed at the 2026-10-30 audit, so no production extension ID is embedded. Existing popup/dashboard branding and capture behavior remain unchanged.

Use **Node 24** and run `npm run extension:package:chrome`. The current output is `extension/releases/save-opportunity-chrome-store.zip` and `extension/releases/save-opportunity-1.0.0-audit.json`; older package filenames above are historical. Only runtime files, icons and the root manifest are included. The package is not uploaded or published automatically.

Production builds reject localhost app origins and secret/service-role Supabase keys. Development mode retains the existing localhost override. Chrome's explicit CSP restricts scripts to local files and connections to the two configured application/auth hosts. Exact OAuth result origin/path validation preserves the installed development identity flow.

The separate server release adds a five-attempt monthly AI allowance (UTC month), one concurrent extraction per user and four globally. It needs the reviewed migration and matching server deployment; the ZIP alone cannot enforce quotas. See [release audit and setup](../docs/releases/save-opportunity-release.md), [privacy draft](../docs/releases/save-opportunity-privacy-draft.md) and root [Store submission record](../CHROMEWEBSTORE.md) for manual OAuth, billing-limit, security, browser-test and screenshot gates. There are no payment/subscription additions. Chrome does not request `tabs`; the earlier rationale applies only to the other browser targets.

Production captures also require a distinct, capped `OPENROUTER_OPPORTUNITIES_API_KEY` on the server. The generic site experiment key is never used for opportunity captures, including in development/tests. The local migration restricts job insertion to the verified server API and rejects anonymous users at paid admission. See the release report before deployment.
