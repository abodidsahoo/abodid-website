# Opportunity background capture

URL, pasted-note, and attachment captures use one durable Supabase job receipt. Vercel starts processing immediately with `waitUntil`; Supabase Cron checks for pending, delayed, or stale work every minute inside Postgres and calls Vercel only when work exists. The dashboard, browser extension, and future messaging adapters all feed the same extraction and save services.

## Production status

URL background capture was activated on 2026-10-20 for `https://abodid.com`. Storage migration `20261020220000` and scheduler migration `20261020221000` are applied and recorded in Supabase. Migration `20261020230000` extends the same queue to notes and temporary private attachments. Migration `20261024180338` was applied to production on 2026-10-25; both opportunity cron jobs now check for claimable work inside Postgres and do not invoke Vercel while the system is idle. `OPPORTUNITIES_CRON_SECRET` is stored as a Vercel Production secret, the matching value is stored in Supabase Vault as `opportunities_cron_secret`, and scheduled recovery requests complete with HTTP 200. The secret value is not stored in this repository.

## Safe activation order for another environment

1. Apply `supabase/migrations/20261020220000_create_opportunity_capture_jobs.sql`. This creates only the isolated job table, policies and claim function; it does not activate cron or modify saved opportunities.
2. Deploy the application code. Until the table exists, the dashboard and extension automatically fall back to the existing synchronous capture endpoint.
3. Configure one matching secret, then redeploy (or otherwise confirm the active Vercel deployment has the new environment value):
   - Vercel: `OPPORTUNITIES_CRON_SECRET`
   - Supabase Vault: `opportunities_cron_secret`
4. Apply `supabase/migrations/20261020221000_schedule_opportunity_capture_jobs.sql` to activate one-minute recovery. It deliberately fails if the Vault secret is absent.
5. Apply `supabase/migrations/20261020230000_expand_opportunity_capture_jobs.sql`. It adds note/attachment states, cleanup timestamps, and the private `opportunity-capture-files` bucket. It does not alter or delete saved opportunities.
6. Apply `supabase/migrations/20261021120000_create_telegram_integration.sql` and `supabase/migrations/20261021150000_create_opportunity_reminders.sql` before the cron gates, because the gated worker checks their durable event and reminder tables.
7. Apply `supabase/migrations/20261024180338_gate_opportunity_cron_http_calls.sql` so the minute-level database checks only issue HTTP requests when work is ready.
8. Submit a URL from the dashboard, close the tab after “Safely captured,” then confirm the opportunity appears after reopening.
9. Submit a note and an attachment. For an attachment, keep the tab open only through “Uploading securely” and close it after “Safely captured.” Confirm both become `succeeded` jobs.
10. Repeat a URL from the unpacked Chrome extension and inspect `opportunity_capture_jobs` for a `succeeded` row.

The repository has historical local migrations that are intentionally not all present in the linked project's migration history. Do not run an unreviewed blanket `supabase db push`. Apply each migration above by itself, then mark only the version actually applied in migration history if the deployment workflow requires it.

## Data and recovery behavior

- `(user_id, idempotency_key)` prevents browser retries from creating duplicate jobs.
- The existing `(user_id, canonical_url)` uniqueness continues to prevent duplicate saved opportunities.
- Interrupted processing leases become claimable again after 15 minutes.
- Retryable failures use up to three attempts with increasing delay.
- Notes are stored in the private job only after a durable receipt exists.
- Attachments upload directly from the browser to a private Supabase Storage bucket using one-time signed targets, avoiding serverless request-size limits.
- An attachment is not considered safely captured until all uploads are verified and the job changes from `uploading` to `pending`. Incomplete uploads expire after one hour.
- Successful jobs remove raw page text, pasted-note copies, and temporary attachments from the capture job immediately. Intentionally pasted text may remain in the saved opportunity’s editable notes. Cleanup failure does not rerun a completed extraction; the recovery worker retries cleanup separately.
- Final failures retain private source material for retry recovery for no longer than 24 hours, after which the one-minute authenticated worker removes both database source text and Storage objects.
- Public job responses never expose pasted text, page snapshots, user IDs, or private Storage paths.
- The old synchronous `/api/opportunities/capture` endpoint remains available as a compatibility and rollback path.
- The synchronous multipart extraction endpoint also remains as a rolling-deployment fallback, but normal dashboard note and attachment submissions use the durable queue.
