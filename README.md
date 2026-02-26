# Personal Site

This is the repository for my personal website, built with [Astro](https://astro.build).

## Features

- **Astro**: Static site generation for performance.
- **Supabase**: Backend for guestbook, newsletter, and more.
- **Vercel**: Deployment and serverless functions.
- **Tailwind CSS**: Utility-first styling (implied by design).

## Usage

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

## Structure

- `src/pages`: Website pages.
- `src/components`: Reusable UI components.
- `src/lib`: Helper functions (GitHub API, Vault logic).
- `public`: Static assets.

## BSA Schedule Page

- Route: `/bsa-schedule`
- Networking route: `/bsa-networking`
- Footer link: `Resources -> BSA Conference Schedule`
- Footer link: `Resources -> BSA Networking`
- Interactive client: `src/components/BsaScheduleApp.jsx`
- SQL deliverables: `sql/bsa-schedule/schema.sql` and `sql/bsa-schedule/seed/*.sql`
- Networking data files:
  - `src/components/BsaNetworkingApp.jsx`
  - `src/data/bsa-networking.json`
  - `scripts/bsa/generate_networking_data_from_programme_grid.py`

### Environment Variables

Add these to `.env`:

```bash
PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Use only the anon key in the browser. Never expose the service role key in client code.
The schedule UI is hard-locked to Manchester time: `Europe/London (GMT/BST)`.

### Database Setup

Fastest safe option (blank or existing DB): run one idempotent file.

```bash
# Supabase CLI (linked project)
supabase db execute --file sql/bsa-schedule/setup_and_seed_2026-04-08_to_2026-04-10.sql
```

If you prefer day-wise updates, run `schema.sql` once and then run seed files in `sql/bsa-schedule/seed/`.
If schedule UI still shows no days, verify in Supabase SQL editor:

```sql
select count(*) as conference_days_count from public.conference_days;
select count(*) as events_count from public.events;
```

Then confirm your deployed app is using the same `PUBLIC_SUPABASE_URL` project.

### Regenerate Networking Data From XLSX

```bash
python3 scripts/bsa/generate_networking_data_from_programme_grid.py \
  --input "/Users/abodid/Downloads/Programme grid 2026 v4 - view only.xlsx" \
  --output "src/data/bsa-networking.json"
```

### Build and Deploy

```bash
npm run dev
npm run build
npm run preview
```

The schedule page is static-first with client-side Supabase reads, so it deploys on the same static/SSR pipeline used by the rest of the Astro site.
