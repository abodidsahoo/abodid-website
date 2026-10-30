# Save Opportunity submission assets

- `store-icon-128.png`: 128×128 PNG using the existing yellow O artwork, with transparent Store padding. No new logo or invented UI.
- Runtime icons remain in `extension/icons/`; package validator checks exact dimensions.
- **Two required task screenshots are still missing.** Do not submit a generated mockup, test fixture, DOM-injected success, placeholder PNG or screenshot of source code as a real capture/result.

Capture at 1280×800 (not merely a filename saying so):

1. Use the built 1.0.0 extension with the correct identity and a dedicated ordinary test account. Show a real public opportunity page with the actual toolbar popup open and its current-page title / Save opportunity action visible. Exclude browser tabs, email addresses, private records and tokens from the captured region.
2. Trigger that capture, wait for the real server's saved result, and capture the actual result popup or matching dashboard result. Do not replace a failed state with an invented success. A duplicate state is useful supplementary evidence but does not substitute for the requested new saved-result screenshot.
3. Save as `capture-1280x800.png` and `saved-result-1280x800.png` here. Record date, version, source URL, test account label (no password/token/email), and what succeeded in the release report. Keep screenshots outside the runtime ZIP; upload them in the Store's listing asset fields.
4. Verify actual dimensions and inspect privacy/legibility. Crop/resize an actual capture only; do not alter UI labels, data, deadlines or outcomes. Retake if the popup becomes unreadable.

The existing unpacked build was reloaded and its signed-in popup inspected, but native screenshot export did not produce a file and Chrome DevTools capture was unavailable. These assets are explicitly pending, not silently omitted.

Chrome requirements: https://developer.chrome.com/docs/webstore/images
