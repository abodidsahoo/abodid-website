# Shared feedback collections

Every new feedback collection uses the same two Supabase tables:

- `feedback_forms`: one row describing the institution, event, questions, page copy and resource links.
- `feedback_responses`: one row per submission, linked by `form_id`. Answers are a JSON object keyed by stable question IDs. `question_snapshot` and `form_version` record the questions as they were answered.

The database generates UUIDs. Each form also has a globally unique URL `slug`, and the combination of `institution_slug` + `event_slug` must be unique. Use the institution, event and date in slugs for recurring sessions, e.g. `nift-bhubaneswar-space-materiality-2026-11-03`. For non-institution feedback, use `institution_slug: "abodid-com"`, `institution_name: "abodid.com"`, and an event such as `website-feedback-2026`.

## Current links

| Collection | Form | Responses |
| --- | --- | --- |
| DU ethnographic filmmaking | `/du-workshop-feedback` | `/du-workshop-responses` |
| NIFT Space and Materiality, 3 November 2026 | `/nift-workshop-feedback` | `/nift-workshop-responses` |
| Photography album (private) | `/photo-album-feedback` | `/admin/photo-album-responses` |

Both collections use the shared form configuration and storage. DU retains its original presentation; NIFT uses the cobalt Pop Editorial hub. All future collections automatically get `/feedback/<slug>` and `/feedback/<slug>/responses`; no new page files or response tables are required. The existing `/feedback` page is a separate website-review archive and is preserved.

## Add another collection

Use one object from [the initial form definitions](../src/data/feedbackForms.seed.json) as a JSON template. That file provides current form templates; live configuration is read from `feedback_forms`, not from the seed file. Change the institution, event, globally unique slug, questions, copy and resource links. Every resource URL must use HTTPS. Then, with Node 24 and the existing server environment:

```sh
npm run feedback:create -- /absolute/path/to/new-form.json --dry-run
npm run feedback:create -- /absolute/path/to/new-form.json
```

The script validates the definition, inserts it without overwriting existing collections, and prints the live form and responses links. `responses_public` defaults to `true`, matching the DU pattern; set it to `false` to keep that collection off public response pages. `is_open: false` closes new submissions. Definitions support:

```json
[
  {"id":"thoughts","label":"What stayed with you?","shortLabel":"Thoughts","type":"textarea","placeholder":"Share a thought."},
  {"id":"project","label":"Your project","type":"text","required":true},
  {"id":"topic","label":"Which topic helped?","type":"choice","options":["Materials","Budgeting"]},
  {"id":"usefulness","label":"How useful was the session?","type":"rating"}
]
```

Ratings run from 1 (lowest) to 5 (highest). Required questions are enforced in the browser and on the server; otherwise people may answer any one question. Keep question IDs stable when rewording. Use a new ID when the meaning changes. Identity/submission names such as `email` and native form properties such as `action` and `reset` are reserved to prevent collisions. The database automatically increments `form_version` when the question array changes, and old response cards render their own saved question snapshot.

## Filter or export responses

Institution and event identity live on the parent form, preventing inconsistent names in individual submissions:

```sql
select f.institution_name, f.event_title, f.event_date,
       r.id, r.created_at, r.participant_name, r.participant_email,
       r.answers, r.question_snapshot, r.submission_status
from public.feedback_responses r
join public.feedback_forms f on f.id = r.form_id
where f.institution_slug = 'nift-bhubaneswar'
-- and f.event_slug = 'space-materiality-2026-11-03'
order by r.created_at desc;
```

## Submission and visibility behavior

The public POST route `/api/feedback/<slug>` loads the form definition on the server. Institution IDs, questions and resource URLs are never accepted from submitted data. It validates allowed answers, email, required fields and length; ignores unknown answer fields; checks the request origin; rejects bodies over 96 KiB; and uses a honeypot. The native `action`/`method` works without JavaScript, redirecting successful submissions to the resource view (a separate receipt-protected page for NIFT). JavaScript adds inline errors, focus management, autosizing textareas and saved receipts per collection.

Each attempt has a random `submission_key` UUID, retained for retries. A database uniqueness constraint on `(form_id, submission_key)` prevents double insertion, including concurrent retries. A returned response UUID identifies the saved row. These are submission identifiers, not verified student identities: names and emails remain optional, anonymous feedback is supported, and one email is not restricted to one response.

Names and answers appear on that event’s responses page; emails are masked before rendering. Forms explain this before submission. Email collection and newsletter consent are separate: providing an email alone does not subscribe someone. The generic DU form’s optional checkbox explicitly requests future email notes. NIFT has no newsletter checkbox; its optional email is used for the requested lecture resources. Newsletter failure does not discard feedback.

Both tables have RLS enabled and direct access revoked from `anon` and `authenticated`; only the server service client accesses them. Public response pages are deliberately accessible by link, matching DU, and are excluded from search indexing. They filter to one form and to `received`/`reviewed` statuses, use 48-card pagination, and send `private, no-store`. `archived`/`spam` responses stay stored but are hidden. Full email addresses, metadata, service credentials and raw JSON rows are never sent to these pages.

## NIFT lecture presentation and access

`WorkshopFeedbackHub.astro` preserves the cobalt, white and yellow Pop Editorial design and real deck imagery, with two distinct screens:

1. `/nift-workshop-feedback`: short introduction, visible optional name/email, and one required `feedback` textarea. The heading asks students to share feedback in a few lines, and the intro explicitly promises download links after submission. A compact preview lists the two PDFs and demo without resource URLs or download actions. The resources tab is inactive for first-time visitors. A verified saved submission turns it into a normal link, so the two screens can be revisited freely without resubmitting.
2. `/nift-workshop-resources`: confirmation, sharing notice, compact PDF cards and the tessellation demo. The server requires a signed feedback receipt cookie. Successful feedback issues that HTTP-only cookie and redirects here, with or without JavaScript. A URL parameter or old localStorage receipt cannot unlock the page. The cookie lasts 30 days, is available to both feedback and resources at Path=/, uses SameSite=Lax, and is Secure on HTTPS. The page sends no-store and noindex headers.

Receipt compatibility: the first implementation scoped the cookie to `/nift-workshop-resources`, which made it invisible on the feedback page and left the return tab inactive. The lightweight `/nift-workshop-resources/access.json` endpoint receives that legacy cookie, verifies its signature, sets the root-scoped receipt and removes the legacy path cookie. It returns only an `unlocked` boolean. The feedback page uses this check only when SSR has no valid root proof. The resources page also restores valid old cookies on visit. When duplicate cookie paths coexist, the newest valid signed receipt wins.

The NIFT page uses its own `data-workshop-feedback-page` marker so stale shared-form receipt handlers cannot hide its only visible screen. The current controller also never hides a separate-success-URL page as a fallback. `localStorage` receipt flags do not unlock resources or hide NIFT feedback. A successful save always navigates to resources, including when resource email fails. First-time visits, forged cookies and expiry still fail the server gate. Native links and submission work without JavaScript for current receipts.

The receipt uses `FEEDBACK_RECEIPT_SECRET` when configured, otherwise the existing server service-role secret. Neither the signing secret nor the raw email is sent in browser responses. The supplied Drive files themselves remain publicly shared; the receipt controls the site’s feedback-to-resources flow, and the notice requests that participants keep the PDFs within the NIFT community.

The initial resource-only email form and endpoint were removed following the updated requirement: resources and resource emails follow saved feedback only. A student may leave email blank and still reach the resource page. Email failure also preserves the saved response and allows downloads.

Session metadata lives in `src/data/niftWorkshop.ts`. Resource URLs and sharing text remain in the form’s content. WebP photographs under `public/images/workshops/nift-2026/` were extracted from the supplied decks: the Retail Window storefront is page 4, and the Tanishq store photograph is page 1. Original PDFs remain on Drive. The geometric demo illustration is an inline SVG. The feedback cover uses the supplied `Transparent Boutique Moodboard Collage.png`, encoded as two alpha-preserving WebP sizes (`boutique-cover-*`). It sits directly on the white hero surface without the old photo caption, uses its full 4:3 composition without cropping, and is capped at a compact 360px block on laptops/desktops. It uses 25 KB / 72 KB WebP variants; the earlier larger variants were removed. At widths of 980px and below the block is hidden and the `picture` fallback is an inline pixel, so phones (including common landscape sizes) do not request the collage file.

## Independent photography collections

The photography workshop/photo-walk interest and album thoughts are independent collections, with different `feedback_forms` IDs and separate rows in the shared `feedback_responses` table. Lecture responses are never overwritten. The two private form definitions are in `src/data/photographyCollections.json`; migration `20261104101902_independent_photography_collections.sql` has been applied to Supabase. It only inserts the two new definitions, both with `responses_public: false`, without changing existing schema, lecture questions or responses.

| Purpose | Student form | Private owner page |
| --- | --- | --- |
| Photography album thoughts | `/photo-album-feedback` (works independently of any lecture) | `/admin/photo-album-responses` |
| Photography workshop/photo-walk interest | Its own Save my interest form on the NIFT resources page | `/admin/photography-interest` |

The NIFT resource page presents “A little gift for you all!” with a link to `/photography` and a balanced two-column grid on laptops (stacked on mobile):
- **Left block (workshop interest)**: “Photography workshop + photo walk” with a simple tick-mark checkbox (`Yes, I am interested.`) and a clean `Send` button that saves participant interest.
- **Right block (album thoughts)**: “Any thoughts on the album?” with an inline textarea allowing students to write and share their private thoughts directly on the page, with a clean `Send` button. Submissions save to `photography-album-thoughts` via the shared API without navigating away. The separate `/photo-album-feedback` standalone page is also preserved.

Identity continuity uses a signed, HTTP-only `feedback_participant` cookie (Path=/, 30 days, SameSite=Lax, Secure on HTTPS). The same browser session’s original response UUID acts as the participant key in each independent row’s `metadata.participant_id`. This is a capability-based anonymous identity, not a verified student login. Names/emails are never matched automatically across strangers or devices. Current private contact details live in the anchor response’s `metadata.private_identity`; they are kept outside public lecture answers and public identity snapshots. An optimistic JSON equality check preserves unrelated metadata during updates. A timestamp prevents an old retry from replacing newer contact details. Blank public lecture name/email fields remain blank, even if a prior private album identity is known.

The album page prefills these contact details when the signed cookie is present. For students who already submitted lecture feedback before this feature existed, the receipt-protected POST from the resource page creates the shared identity cookie from their saved lecture record. The bridge only opens the album page and does not create an album response. Workshop interest uses the participant UUID as its deterministic submission key, so saving again edits that participant’s interest without adding duplicate interest rows. Album thoughts can be submitted as separate entries; they never overwrite interest.

Full album notes are stored only in the private album collection. Public response routes reject both private collections. Their owner pages fetch `/api/admin/feedback/<slug>` through the existing verified admin-token/role check. Each shows a paginated table with current shared name/email and a CSV download of the displayed page. CSV export neutralizes spreadsheet formulas. Private pages disable Google Analytics, Apollo and the journey tracker. URLs, API receipts and resource emails do not include private thoughts or contact details.

The earlier combined private-column design was retired before it was applied. Its missing `private_follow_up` column caused the localhost error. No such column is needed now: these collections use the already-existing shared form/response schema, with service-only RLS and browser grants revoked. The obsolete unapplied migration has been removed.

Verification included a rolled-back Supabase transaction that wrote both collection shapes independently under the service role and checked shared identity. An actual localhost album test checked save, replay, prefill, updated contact continuity, public response rejection and admin API rejection; all temporary private verification records were removed and no email was sent. Unit tests cover ownership, CSRF, privacy, collection separation and admin authorization. Browser tests cover the independent form, separate interest action, native submission, private access, responsive layouts and disabled trackers.

## Resource email after feedback

If a student supplies their optional email, the feedback handler saves their response first, then automatically sends all three server-configured links through the existing Resend API. It sends links to view/download the high-resolution PDFs, not large attachments, and repeats the NIFT sharing notice. Supplying an email does not subscribe the student to a newsletter.

`feedback_resource_deliveries` is a separate server-only operational table, not another response table. It stores a unique `response_id` FK, form ID, request UUID, recipient, frozen email payload, status, provider receipt, attempt count and lease timestamps. Every row requires saved feedback. RLS is enabled and public/anon/authenticated grants are revoked. The public responses page does not read this table. Admin/Supabase operators can inspect delivery state by response ID; no new public or browser-based admin mail view is introduced.

A database claim prevents concurrent sends. The same provider idempotency key and frozen payload are reused after network failures; completed receipts never resend on replay. Uncertain attempts older than 23 hours are not automatically retried because Resend’s idempotency retention is 24 hours. There is no background delivery worker: email is attempted during submission, and a replay can resume a failed/uncertain attempt within the safe window. The resource page reports provider failure honestly while retaining download access.

Durable, HMAC-keyed limits reuse the existing service-only `consume_contact_rate_limit` RPC, in a separate `feedback-resources` namespace: 3 attempts/recipient/hour, 100/client IP/hour and 300 total/hour. Mail fails closed if the limiter or receipt storage is unavailable; feedback still succeeds. No raw IP is persisted in the mail ledger. The sender uses `FEEDBACK_RESOURCES_FROM_EMAIL`, then the existing contact notification sender, then `Abodid Sahoo <contact@abodid.com>`. `RESEND_API_KEY` stays server-only.

## Pending local changes and publication

Development merges `src/data/feedbackContent.pending.json` and `src/data/feedbackQuestions.pending.json` for local review. A changed question set previews the next form version; logically identical JSON does not increment it again. Production reads database content/questions until the migrations are applied.

Review locally without submitting or sending email:

- `/nift-workshop-feedback`
- `/nift-workshop-resources?preview=resources` (development-only review bypass, absent in production)

When publication is authorized, apply the pending `20261104035239_nift_feedback_pdf_resources.sql` and then `20261104073339_nift_lecture_feedback_and_resource_email.sql`, immediately before deploying this release. The latter replaces NIFT’s four questions with the new `feedback` ID, increments its version via the existing trigger, creates the mail ledger, and restricts the legacy DU backup to service access. It also fixes that backup’s trigger search path. Existing answers, snapshots, response IDs and timestamps are not modified. DU’s form configuration remains unchanged. Remove local drafts after verifying database configuration matches the release. Those earlier NIFT UI/email migrations remain unapplied; the independent private collection seed and resource email storage are applied for functional localhost use.

The shared responses viewer already renders each row’s question snapshot, so historical four-question responses and new one-question responses coexist without an admin-view rewrite. A source audit found no separate admin feedback editor or browser access to the legacy DU table. The legacy table’s broad authenticated policies are unnecessary for the current server-rendered views; the staged migration removes them and revokes direct browser access while preserving the backup and mirror trigger.

Responsive checks cover 1440×900, 1024×768, 768×1024, 390×844 and 320×568, plus breakpoint neighbors. Tests cover the protected redirect, receipt reload, 48px action targets, missing images, 200% text, a 2× layout-zoom equivalent, reduced motion, preserved drafts, and native submission without JavaScript. The browser suite mocks POST requests and provider calls. Additional real integration checks use temporary private or archived fixtures and remove them immediately; no resource emails are sent.

## DU migration and compatibility

The migration copies all six original DU rows with the same response UUIDs, timestamps, identity, consent, status and answer text, retaining metadata and adding the legacy source. A transactional assertion aborts the migration if any original row is not represented exactly. The original `du_workshop_feedback` table remains as a recovery copy; it is not the destination of new-site submissions.

The old `/api/du-workshop-feedback` URL forwards to the shared handler. An insert/update trigger mirrors old DU writes into shared storage during rollout, avoiding a gap between database migration and website deployment. It can be retired in a later migration once there are no old clients. New submissions go directly to `feedback_responses`; no reverse copy is maintained. The original browser receipt key is honored for students who have already submitted DU feedback.

## Verification

```sh
npm run test:feedback
npm run test:seo
npm run build
supabase db query --linked --file tests/feedback/storage-verification.sql
```

The storage verification tests retry uniqueness, automatic version changes, historical question preservation, access restrictions and DU migration counts in a transaction that rolls back all test writes. The current browser suite intercepts submissions and never writes live responses. Local Postgres (PGlite) checks applied the original DU/shared migrations and both pending NIFT migrations to fixtures, verifying unchanged old rows/snapshots and DU config, the new NIFT version, RLS/grants, and feedback-linked mail uniqueness. Unit, browser and targeted strict TypeScript checks cover the shared submission flow, private follow-up ownership/CSRF/privacy, phone image request suppression, responsive layouts, and native submission. The local Postgres fixture also verifies private collection separation and exclusion from public response routes. No live schema changes or real provider sends were performed during this revision.

The navigation revision passed 15 browser tests, including repeated tab switching, legacy token restoration, first-visit blocking, stale localStorage, and native navigation. An actual localhost replay of an archived saved submission with name/email verified the two cookies and resource access even when email delivery was unavailable; its temporary record was removed.

## Email download links button and standardized email

The receipt-protected resources page includes “Send all PPTs and links to my email.” If the student already submitted their email address with their feedback, it is automatically prefilled and indicated on the page with a “Change email” toggle; the email input is not asked for again. If the student left email blank during initial feedback submission, clicking the button opens an accessible native `<dialog>` pop-up requesting their email address.

The standardized email sent via Resend contains:
- Complete slide decks for Session 01 (The Retail Window) and Session 02 (Tanishq, Bhubaneswar) and the Tessellation demo.
- The NIFT community confidentiality notice.
- Dedicated section on **Obsidian Tutoring & Mentorship for NIFT Students**, explaining how personal knowledge vaults help Fashion Communication and design students organize visual references, research, moodboards, and thesis documentation, and articulate their creative process in future job and internship interviews (linking to `/obsidian-tutoring` and `/workshops/obsidian`).
- Links to Photography & Visual Storytelling (`/photography`).
- Complete contact details: email (`hello@abodid.com`, `contact@abodid.com`), phone numbers (+91 94390 94370 for India, +44 7522 258768 for UK), portfolio website, and social links.

Its POST `/nift-workshop-resources/email` checks the signed submission receipt, origin, CSRF proof and recipient, updates the participant identity, and uses durable rate and idempotency protection. Separate intentional requests can send again, while retries of one request are deduplicated.
