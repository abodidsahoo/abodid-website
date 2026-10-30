# Admin analytics setup

The analytics panel lives at `/admin/dashboard?section=analytics` and uses
`AnalyticsDashboardV2` with the protected `/api/admin/analytics-v2` endpoint.
It shows one readable session narrative at a time with Previous/Next buttons,
followed by GA4 aggregate acquisition, country, and landing-page reports.

## Session narratives and interaction evidence (29 October 2026)

The API loads the latest 100 eligible stored sessions in the selected period.
The default Human activity view requires `human_signals.evidenceVersion = 2`
and `evidenceLevel = likely_human`. All recorded sessions and Unconfirmed
allow review of other records of at least five seconds. Visits with sufficient
new human-interaction evidence appear even below five seconds. Newest-first
and longest-active-time sorting apply to the loaded window. A session narrative
states discovery source, estimated location, entry page, active duration,
most-attended page (summing repeat views), and last observed page. Timestamps
use the administrator’s browser timezone. Page sequences are paginated from
PostgREST to avoid its row cap. The browser buffers 30 recent page views, so
some earlier steps may be unavailable.

Qualification no longer depends on elapsed time. The deterministic, uncalibrated
heuristic combines varied pointer distance/timing/direction, actual scroll
movement following trusted wheel/touch/navigation-key input, and direct
interactive actions. Touch and keyboard paths do not require a mouse. DOM
`isTrusted` alone does not establish a human: programmatic scrolling can emit
browser-generated scroll events. Known bots, excluded owner/admin browsers,
and exposed WebDriver automation remain excluded. Advanced automation can
forge browser signals, so the UI says **likely human**, never verified human,
and never presents the heuristic score as a percentage probability.

Only aggregate counters are stored in existing `human_signals`; no coordinate
trail, raw key values, or typed text are transmitted by the new analysis.
Individual coordinates are used transiently in memory to accumulate movement
features. The collector recomputes classification server-side and stores
reasons and evidence version. Inconclusive activity can be retained for review
without qualifying it as human. Existing records are not reclassified or
rewritten, and an old duration-only label does not qualify for Human activity.

Research informing the implementation:

- [Cloudflare bot detection engines](https://developers.cloudflare.com/bots/concepts/bot-detection-engines/): use multiple signals; no single mouse signal is definitive.
- [MDN Event.isTrusted](https://developer.mozilla.org/en-US/docs/Web/API/Event/isTrusted): user-agent-generated events include programmatic actions.
- [MDN scroll events](https://developer.mozilla.org/en-US/docs/Web/API/Document/scroll_event): high-frequency handlers need throttling; scrolling alone is not input evidence.
- [BeCAPTCHA-Mouse research](https://www.sciencedirect.com/science/article/pii/S0031320322001248): movement dynamics can help distinguish automation, but this project's heuristic is not that trained model and does not inherit its reported accuracy.

Active time is capped at the last observed input plus 60 idle seconds; a new
interaction first settles the previous interval so it cannot bridge an idle
gap. Pointer movement now refreshes activity. Snapshots are batched at initial
activity, an evidence checkpoint, every 30 seconds while active, and lifecycle
boundaries. Old measured durations may contain idle overcount and are marked
unconfirmed. Last seen is a received observation, not a confirmed browser close.

Country/city labels are network estimates. Neither GA4 nor this tracker can
supply an exact real/fake split. Only a referring domain and provided campaign
tags are stored; external page URLs, unprovided search queries, and earlier
browsing history cannot be reconstructed. GA4 `(not set)` landing pages display
as “Entry page unavailable.” Direct/unknown means no usable referral was supplied.

The earlier collection repair added missing collector columns without changing
RLS or old records (`repair_session_collection`). The schema repair was applied
on 29 October. Session/page write failures log only error codes server-side;
the dashboard warns when collection looks stale. No new migration is needed
for evidence version 2 because it uses the existing JSONB column.

## GA4 troubleshooting

The local failure on 29 October was a moved service-account JSON file:
`GOOGLE_APPLICATION_CREDENTIALS` referenced a nonexistent Downloads path.
`.env.local` now points to its existing private location under Documents.
A real seven-day GA4 request succeeded after the correction. Keys are never
copied into the repository or frontend. Prefer a server-only
`GA4_SERVICE_ACCOUNT_JSON` secret in hosting rather than a local file path.
The admin API distinguishes configuration, authentication, authorization,
request, and transient API failures with actionable messages.

## Collection and legacy reporting architecture

- `public/scripts/journey-tracker.js` records public page opens and active,
  visible engagement time. Admin, API, preview, test, and automated-browser
  traffic is excluded. Initial activity and behavioural evidence trigger compact
  snapshots; focused active sessions update every 30 seconds.
- `POST /api/analytics/collect` validates and sanitises same-origin events. It
  uses the service-role client only on the server; the key is never bundled for
  the browser.
- `analytics_sessions`, `analytics_page_views`, and `analytics_events` store
  the anonymous records. Raw IP addresses are not stored. The country code
  comes from the hosting provider's request header.
- `GET /api/admin/analytics` verifies the Supabase access token and the user's
  `profiles.role`, then executes the reporting function.
- The React panel uses Chart.js for line, bar, and pie views. Supabase Realtime
  listens for changes to both analytics tables and refreshes the protected
  report without reloading the page.

## 1. Install dependencies

```bash
npm install
```

The relevant packages are `@supabase/supabase-js`, `chart.js`, and
`react-chartjs-2`.

## 2. Configure environment variables

Copy `.env.example` to `.env` and set:

```bash
PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

`PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` are safe browser
configuration. `SUPABASE_SERVICE_ROLE_KEY` is privileged and must be configured
only as a server-side local/deployment secret. Never prefix it with `PUBLIC_`,
commit it, log it, or pass it to a browser component.

Set the same three values in the deployment environment. The service-role key
is required by the collection and reporting endpoints.

## 3. Apply the database migration

Link the Supabase CLI to the intended project, review the migration, and push
the repository migrations:

```bash
supabase link --project-ref your-project-ref
supabase db push
```

The analytics migration is
`supabase/migrations/20260713190000_create_admin_analytics.sql`. It creates the
two tables, indexes, collection/reporting functions, row-level security (RLS)
policies, grants, and Realtime publication entries.

Mobile-menu interaction reporting is added by
`supabase/migrations/20260715120000_add_navigation_analytics.sql`. It creates
the event table and its protected collection/reporting functions, and adds the
table to the same administrator-only Realtime flow.

Human and filtered traffic reporting is added by
`supabase/migrations/20260718150000_separate_human_and_filtered_analytics.sql`.
It applies the same session-level classification to summaries, charts, page
rankings, journeys, common routes, and mobile-menu metrics. Existing records
are classified automatically; no analytics rows are deleted or rewritten.

For an existing database, confirm the migration appears in the Supabase
migration history before testing the panel. The `analytics_build_report`
function must return a `timeline` array for the charts. The navigation migration
must expose `analytics_build_navigation_report` for the mobile-menu panel.

## 4. Create an authorised user

Sign up through the existing Supabase Auth login flow, then promote the account:

```bash
node scripts/promote-to-admin.js you@example.com
```

Only a signed-in user whose `profiles.role` is `admin` can call the report API,
read analytics rows through RLS, or receive Realtime table events. Other roles
receive `403 Admin access required` and cannot access the raw analytics tables.

## 5. Run and verify locally

```bash
npm run dev
npm run test:analytics
npm run build
```

Localhost and preview deployments are deliberately excluded from collection,
so use production traffic to populate the panel. After signing in, open
`/admin/dashboard?section=analytics`.

The status next to the page heading should change to `Live updates on`. If it
shows `Manual refresh only`, the report remains usable through the refresh
button; verify that the migration added both analytics tables to the
`supabase_realtime` publication and that the signed-in profile is an admin.

## Data and storage notes

No Supabase Storage bucket is required. The analytics feature stores structured
records only, so Postgres is the appropriate backend. Add a private Storage
bucket later only if downloadable report files are introduced; store report
metadata and ownership in Postgres and enforce access with storage policies.

The collector caps string lengths and body size, ignores bots and owner/admin
traffic, records only a normalised referrer domain, and never persists the
request IP address. Retention can be added later with a scheduled database job
that deletes old `analytics_sessions` rows; related page views cascade-delete.
