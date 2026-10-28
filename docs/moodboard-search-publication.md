# Moodboard search freshness

`/moodboard` stays prerendered. It loads one public JSON file directly from
Supabase Storage: `moodboard-search/search-v1.json`. No Vercel Function, public
database query, timer polling, signed URL, or per-keystroke request is added.
The browser keeps the deployed gallery if the file is unavailable or invalid.

The file has schema version, revision, generation time and **published** image
IDs, titles, artist names and tag arrays only. It contains no credentials,
private tagging analysis, draft records, image bodies or palettes. Existing
image URLs/order stay intact. Withdrawn images are removed after hydration.
New image references still enter the static HTML through the next deployment;
this mechanism refreshes search metadata for existing references.

## Publication and cost

A database trigger increments one private counter after a relevant published
row changes. It covers admin edits, AI tagging, external batch scripts and
direct database writes. Unchanged saves, palette-only writes and draft-only
changes do not request publication. There is no AI reanalysis or tag rewriting.

Supabase Cron checks that single row once a minute. Only pending changes with
an available lease invoke `moodboard-search-publisher`. Idle checks do not make
HTTP calls. Edits between checks are combined. An ongoing long batch may
publish once per minute, and its final changes are published by a later check.
The publisher reads all public metadata in one consistent database statement,
uploads the JSON and acknowledges that revision. Concurrent changes remain
pending. A single-use dispatch token and 10-minute lease prevent overlapping
publishers; expired work recovers automatically. Failures back off up to one
hour and retain the prior file. A successful save never waits for publication.

Public reads use the stable Storage CDN URL, without cache-busting parameters.
The file has a 60-second browser TTL. Smart CDN, when available on the plan,
invalidates overwritten files within roughly 60 seconds. Allow approximately
1–3 minutes after a save under normal operation, then reload the moodboard.
Storage egress and publisher Edge Function invocations use Supabase allowances;
visitor tag delivery adds **zero Vercel Fluid CPU**. Existing analytics and
palette-proxy usage are separate. Image cache headers are unaffected.

## Deployment and recovery

1. Deploy `supabase/functions/moodboard-search-publisher/index.ts` with the
   function-specific `verify_jwt = false` setting. It authenticates one-use
   database dispatch tokens; all backing RPCs are service-role-only.
2. Apply only the `moodboard_search_snapshot` migration. This creates a dedicated
   public JSON bucket with no browser write policies, a private state row, a
   trigger, restricted RPCs and an initially disabled readiness job.
3. Set `publisher_url` on `moodboard_private.search_publication` to the project's
   `/functions/v1/moodboard-search-publisher` URL and set `enabled = true`.
   Call `moodboard_private.dispatch_search_publication()` once to seed the file.
4. Verify the public file, its row count, cache headers and publication state.
   Deploy the website and check a tag through the live browser.

Inspect `revision`, `published_revision`, `published_at`, `attempts`, `last_error`
and `lease_until` in the private state row when troubleshooting. Disable the
publisher with `enabled = false`; the site continues using the last file, or
its deployed data if the file cannot be loaded. Re-enable after correcting the
underlying error; do not erase tag arrays or reset a still-active lease.

References: [Smart CDN](https://supabase.com/docs/guides/storage/cdn/smart-cdn),
[Scheduling functions](https://supabase.com/docs/guides/functions/schedule-functions).
