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
