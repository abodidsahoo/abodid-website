# One Click Opportunity Tracker WebExtension

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
4. Verify Google sign-in, session persistence, popup capture, context-menu capture, dashboard opening, logout, and a second account's isolation.

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
     --app-name "One Click Opportunity Tracker" \
     --bundle-identifier com.abodid.opportunities
   ```

3. Open the generated project in Xcode, select the Apple team/signing configuration, and enable the extension for the macOS and iOS/iPadOS app targets.
4. Add `https://abodid.com/opportunities/extension/callback` to the Supabase redirect allow-list before device testing. Safari does not support the WebExtension `identity` API, so this target opens OAuth in a normal tab. A content script restricted to that callback route passes the one-time code and state back to the extension; the PKCE verifier and resulting tokens remain in extension-local storage.
5. Test the containing macOS app and iOS/iPadOS app targets with separate accounts before App Store submission.

## Permission rationale

- `activeTab`: read the current page only after a user action.
- `scripting`: collect visible text and structured-data hints for the server-side extractor.
- `storage`: persist the Supabase PKCE verifier/session and extension state.
- `contextMenus`: save a page or link through right-click.
- `identity` (Chrome and Firefox only): complete browser-controlled OAuth without exposing tokens to visited pages.
- Host permissions: only `abodid.com` and the configured Supabase project.

The Safari callback content script runs only on `https://abodid.com/opportunities/extension/callback*` and relays a one-time authorization code plus anti-forgery state. It never receives an access token, refresh token, service-role key, or OpenRouter credential.

The content script is injected only after explicit capture. It never receives access or refresh tokens; authenticated API calls are made by the extension background context.
