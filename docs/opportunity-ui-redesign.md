# Opportunity Tracker UI release verification

## Result

- Owner dashboards use a 70:30 desktop hero, stacking at tablet and phone widths. The yellow save block fills its left column.
- Quick Access groups Settings, Chrome installation instructions and Telegram. Telegram reuses the existing authenticated connection flow and shows Connected only after the API confirms it. The Chrome store release is not yet published; its CTA opens the existing repository setup guide.
- Attach opens the existing multi-file picker directly. Shared browser/server validation keeps the same formats and limits: four files, 10 MB each (25 MB for video), 30 MB combined.
- File chips provide type icons, full names on hover/focus, removal and real upload states. Success is shown only after a successful upload response. Capture receipts, signed uploads, finalization, duplicate handling and saved-item editing are preserved.
- Tour steps contain one short paragraph, no small-print tips, balanced headings and non-breaking final word pairs. They target saving, urgency views, refresh and integrations. Short viewports highlight the individual control rather than crowding the whole panel.
- Pending auth recovery, wave-dot waiting feedback and the clean right-aligned Add to my radar action are included in this release.

## Verification

- 115 opportunity tests pass; targeted TypeScript checks and the production Astro build pass.
- Browser checks at 1440×900, 1025×768, 1024×768, 1023×768, 769×1024, 768×1024, 767×844, 390×844, 320×568 and 720×450 CSS pixels pass, including a long display name and loaded fonts. The final size checks a 200%-zoom-equivalent desktop content viewport.
- Every tour step stays inside the viewport, leaves a gap to its highlighted control, and avoids single-word final paragraph lines. No horizontal overflow was detected.
- Mocked browser/API checks cover multiple-file selection, individual removal, full filenames on focus, unsupported formats, oversized files, uploading and uploaded states, finalization, failed uploads, note saving, URL capture and processing resumption.
- Chrome installation opens the existing README instructions. Telegram connection and Settings navigation were checked using mocked responses; no real account was connected or disconnected by the tests.
- Chrome, Firefox and Safari 2.1.9 extension builds pass. Store submission remains a separate release action.

## Included files

- `CHROMEWEBSTORE.md`
- `docs/opportunity-ui-redesign.md`
- `extension/README.md`
- `extension/manifests/chrome.json`
- `extension/manifests/firefox.json`
- `extension/manifests/safari.json`
- `extension/popup.css`
- `extension/popup.html`
- `extension/src/auth.ts`
- `extension/src/authClient.ts`
- `extension/src/authNetwork.ts`
- `extension/src/background.ts`
- `extension/src/popup.ts`
- `extension/src/safari-callback.ts`
- `src/components/opportunities/EditOpportunityModal.tsx`
- `src/components/opportunities/ManualCreateModal.tsx`
- `src/components/opportunities/OpportunityBusy.tsx`
- `src/components/opportunities/OpportunityCard.tsx`
- `src/components/opportunities/OpportunityCollectionApp.tsx`
- `src/components/opportunities/OpportunityDashboard.tsx`
- `src/components/opportunities/OpportunityDetailModal.tsx`
- `src/components/opportunities/OpportunityExtensionHelp.tsx`
- `src/components/opportunities/OpportunityLanding.tsx`
- `src/components/opportunities/OpportunityListItem.tsx`
- `src/components/opportunities/OpportunityProfileDialog.tsx`
- `src/components/opportunities/OpportunityQuickTour.tsx`
- `src/components/opportunities/OpportunityRadarSignInDialog.tsx`
- `src/components/opportunities/OpportunitySettingsMenu.tsx`
- `src/components/opportunities/OpportunityStatusPicker.tsx`
- `src/lib/opportunities/attachmentValidation.ts`
- `src/lib/opportunities/inputExtractionService.ts`
- `src/lib/opportunities/tour.ts`
- `src/pages/opportunities/auth/callback.astro`
- `src/pages/opportunities/extension/callback.astro`
- `src/pages/privacy.astro`
- `src/styles/opportunities-editorial.css`
- `src/styles/opportunity-feedback.css`
- `tests/opportunities/extension-auth-network.test.ts`
- `tests/opportunities/quick-tour.test.ts`


## Capture examples and integration controls — 2026-10-25

- Reuses the moodboard’s 5.6-second phrase cadence, upward enter/exit and moonlight text sweep for four examples in the empty capture field. Real input remains separate, examples disappear during editing, and reduced-motion users get a static example. Examples remain on one line, with ellipsis on narrow screens; entered notes and URLs wrap as the field grows.
- Aligns the desktop integration rail with the save panel, removes the Quick access label, and keeps Settings positioned from its trigger. The settings menu renders in a portal above navigation so short-screen positioning cannot put interactive controls behind the site header.
- Telegram status loads on mount and refreshes when the window regains focus, rather than whenever Settings opens. For disconnected accounts, the existing authenticated POST prepares a short-lived connection token in advance; it stays in component memory, deduplicates in-flight requests, and is reused only before expiry. Expired or failed preparation retries on click. No account becomes active until the existing Telegram confirmation succeeds. Connected accounts can disconnect from the integration card’s small dropdown.
- Public access uses one checkbox-style toggle and an icon-only copy control, disabled while private. The existing server visibility update and rollback behavior are preserved. The URL editor has no gap or inner focus outline at the slash; keyboard focus highlights the complete field. Text directly on the cobalt canvas uses white.
- Validation: 115 opportunity tests, targeted TypeScript and production builds pass. Mocked browser checks cover six responsive hero widths, all four rotating examples, reduced motion, public/private updates, clipboard copying, seamless URL focus, and Telegram preparation/reuse/expiry/retry/disconnect. All four onboarding steps pass at ten viewport sizes, including 720×450, with no clipping, overlap or orphaned final words. Telegram timing is verified with mocked transport; no live-account linking or disconnecting is performed.


## Compact capture and Google feedback — 2026-10-25

- Capture starts at a single-line 60px height, with Save opportunity below the field. Only entered text expands it, up to eight line-height units; clearing it restores the initial size. Rotating examples remain on one line with ellipsis when needed. The paperclip retains its accessible Attach files label and becomes icon-only on small phones.
- Native `field-sizing: content` keeps the textarea width stable and grows it vertically. Unsupported browsers use a hidden CSS Grid mirror of the controlled value, with matching typography, padding and height limits. Neither path measures the decorative examples.
- Settings is capped at 340px and clamped to the viewport, replacing the rail-width-plus-24px sizing. Google session/sign-in buttons and the Google completion page place wave dots immediately after their label; other feedback retains its stacked layout.
- Verification: 115 opportunity tests, targeted TypeScript and the production build pass. Browser checks cover seven capture widths, native growth/shrinking, fallback layout at three widths, all four one-line examples, the narrowed menu, Google feedback at desktop/390px/320px, and callback error recovery. The four-step tour still passes at ten viewports without clipping, overlap or orphaned final words.


## Inline save row and compact busy feedback — 2026-10-25

- Desktop and tablet capture use one row for the growing input and Save opportunity, with matching initial control heights and a stable save-button width. The yellow block has no empty second row. Phones retain a stacked layout so the field and attachment control remain usable. Desktop integration cards are shorter; the Telegram card’s bottom follows the save panel’s bottom.
- Buttons and compact notifications use trailing decorative wave dots. Full-page session/list loaders retain centered stacked feedback. Refresh uses its existing SVG arrows alone, centered on the 24×24 viewBox, with a stable button width, Refreshing text and aria-busy during requests. The icon stops and returns to its default orientation after completion. Reduced-motion preferences slow the rotation to six seconds per turn.
- Verification: 115 opportunity tests, targeted TypeScript and production build pass. Browser checks at eight widths verify save alignment, input expansion, Telegram alignment, refresh without dots, stable button dimensions, symmetric SVG geometry and a stationary rotation center, reduced motion, stopped animation after completion, and inline capture progress restored after reload. Tour layout is also checked after the changed hero height. Tests use mocked APIs; no live opportunity or Telegram data is changed.
