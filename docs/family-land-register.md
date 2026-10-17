# Family Land Register

Private family reference register at `/land`. The viewer is Odia-first and read-only. The separately authenticated `/land/admin` route is the only write surface.

## Architecture

```text
Encrypted checked-in seed + PDFs
        │ server-only AES-256-GCM decrypt
        ▼
  /land SSR response ── signed HttpOnly viewer cookie
        │
        ├── /api/land/pdf/:slug (viewer session required)
        ├── /api/land/source/:slug (viewer session required)
        └── Supabase service read of append-only revisions

Supabase admin auth ── /land/admin ── /api/land/admin/revisions
                                      admin role verified server-side
```

The public repository contains ciphertext, validation counts, and code. It does not contain readable holder names, addresses, Markdown transcriptions, or PDFs. The source files are bundled only into the Vercel server function and are never emitted into `public/`.

## Server environment variables

- `LAND_VIEWER_PASSWORD_HASH` — `scrypt:<salt>:<hash>` produced by the bootstrap script.
- `LAND_SESSION_SECRET` — random server-only HMAC secret for the viewer cookie.
- `LAND_DATA_ENCRYPTION_KEY` — 32-byte hexadecimal AES key used for the encrypted seed and documents.
- `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` — existing admin sign-in.
- `SUPABASE_SERVICE_ROLE_KEY` — existing server-only key used to read the private revision log.

Never prefix the three `LAND_*` secrets with `PUBLIC_`. Set them in the production deployment without pasting values into source control.

## Import and validation

1. Put the reviewed person index in a private file outside this public repository.
2. Ensure `.env.local` contains the server secrets. For a first local setup, run `node scripts/bootstrap-land-secrets.mjs` and enter the chosen family password.
   To change only the viewer password later, run `node scripts/bootstrap-land-secrets.mjs --rotate-password`.
3. Import the source folder:

```sh
node --env-file=.env.local scripts/import-family-land-register.mjs \
  --source "/absolute/path/Odisha_Family_Land_Records" \
  --person-index "/private/path/person-index.reviewed.json"
```

4. Review `src/data/land/import-report.json`. The import stops unless it finds exactly 11 khatas, 28 plots, 6.1649 listed acres, unique composite keys, all 11 Markdown files, and all 11 PDFs.
5. Run `npm run test:land` and `npm run build`.

The current import verifies the PDF-backed discrepancies for Khata 97, 147/564, 474/7010, and 67. The exact PDFs remain the authority when a transcription and filename disagree.

## Authentication and authorization

- Viewer login compares the entered password to a server-side scrypt hash. The signed session cookie is `HttpOnly`, `SameSite=Strict`, HTTPS-only in production, and expires after 12 hours or 30 days when the trusted-device option is chosen.
- Failed viewer attempts receive in-process exponential backoff after five tries. For multi-region production, add Vercel Firewall or a shared rate-limit store so limits are coordinated across serverless instances.
- The viewer receives no database token and has no write endpoint. Table preferences, language, and text size are browser-local only.
- Admin writes require a valid Supabase access token and a current `profiles.role = 'admin'` check on the server. The SQL migration enables RLS, permits admin `SELECT`/`INSERT`, and denies `UPDATE`/`DELETE` so the audit trail stays append-only.
- The admin change form requires a before/after review, reason, and source reference. Original encrypted files are never overwritten.

Apply `supabase/migrations/20261017090000_family_land_revisions.sql` before enabling production editing. Until then, the viewer works from the encrypted seed and `/land/admin` reports that persistence is unavailable.

## Mapping contract

- **Verified shape:** display only after a human matches official geometry to district, tehsil, mouza, khata, and plot, and records its source and permitted use.
- **Approximate locality:** may be added later as an explicitly approximate village point. It must never be drawn as a parcel.
- **Unknown:** the current V1 state. Each plot shows known lookup identifiers, marks RI circle as unknown, and opens the official Odisha BhuNaksha landing page. No plot geometry, coordinates, or deep-link parameters are invented.

## Five-step Odia guide for father

1. Chrome କିମ୍ବା Edge ରେ `abodid.com/land` ଖୋଲି ପରିବାର ପାସୱାର୍ଡ ଦିଅନ୍ତୁ।
2. `ଖାତା ଖୋଜନ୍ତୁ`, `ବ୍ୟକ୍ତିଙ୍କ ନାମରେ ଦେଖନ୍ତୁ`, କିମ୍ବା `ପ୍ଲଟ୍ ମାନଚିତ୍ର ଦେଖନ୍ତୁ` ମଧ୍ୟରୁ ଗୋଟିଏ ବଡ଼ ବଟନ୍ ଦବାନ୍ତୁ।
3. ନମ୍ବର ମନେ ନଥିଲେ ତିନୋଟି dropdown ରୁ ମୌଜା, ବ୍ୟକ୍ତି କିମ୍ବା କିସମ ବାଛନ୍ତୁ। ପ୍ରତ୍ୟେକ ଖାତା ଓ ପ୍ଲଟ୍ ଉପରେ click କରି ଖୋଲିପାରିବେ।
4. ପ୍ଲଟ୍ ବାଛି `ଓଡ଼ିଶାର ସରକାରୀ ପ୍ଲଟ୍ ମାନଚିତ୍ର ଖୋଲନ୍ତୁ` ଦବାନ୍ତୁ। ସରକାରୀ ସାଇଟ୍‌ରେ ଫେରିବା ପାଇଁ browser Back ବ୍ୟବହାର କରନ୍ତୁ।
5. ରେକର୍ଡର ଛବି ପାଇଁ `ଛବି ନିଅନ୍ତୁ` → `ଏହି ରେକର୍ଡର ଛବି` → `Download PNG` ଦବାନ୍ତୁ। ଉପର ବାମପଟର ବଡ଼ `← ପଛକୁ` ବଟନ୍ ସବୁବେଳେ ପୂର୍ବ ପୃଷ୍ଠାକୁ ନେବ।

## Administrator guide

1. Open `/land/admin` and sign in with the approved Supabase administrator account. The family viewer password cannot unlock editing.
2. Choose `Correct record`, `Add record`, or `Archive record`. Select records from dropdowns; do not type business keys.
3. For a correction, compare the displayed current value with the proposed value. For an addition, fill every source-backed identity and plot field.
4. Enter a specific reason and source document/page, tick the verification confirmation, then save.
5. Confirm the new entry in Revision history and refresh `/land`. The display uses the reviewed revision while the original source wording and PDF remain available.

## Release checks and current limits

- Automated checks cover the data controls, composite keys, safe person-role filtering, area conversion/scaling, auth cookie signing, and revision validation.
- Browser screenshots are produced at 1440×900 and 1366×768 in both languages during release QA.
- Actual father testing on his Windows computer remains a human acceptance step: find Khata 67, find one recorded holder, open a protected PDF, follow the official map lookup, and capture the record. Record any missed clicks, clipped Odia glyphs, or uncomfortable text size and iterate once.

