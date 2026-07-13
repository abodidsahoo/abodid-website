# Admin analytics setup

The analytics panel lives inside the existing admin dashboard at
`/admin/dashboard?section=analytics`. It records anonymous site sessions and
active page-view time, then presents the results as summary metrics, a line
chart, a country bar chart, a traffic-source pie chart, page rankings, and
visitor journeys.

## Architecture

- `public/scripts/journey-tracker.js` records public page opens and active,
  visible engagement time. Admin, API, preview, test, and automated-browser
  traffic is excluded.
- `POST /api/analytics/collect` validates and sanitises same-origin events. It
  uses the service-role client only on the server; the key is never bundled for
  the browser.
- `analytics_sessions` and `analytics_page_views` store the anonymous records.
  Raw IP addresses are not stored. The country code comes from the hosting
  provider's request header.
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

For an existing database, confirm the migration appears in the Supabase
migration history before testing the panel. The `analytics_build_report`
function must return a `timeline` array for the charts.

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
