# Opportunity background capture

URL captures from the dashboard and browser extension use a durable Supabase job receipt. Vercel starts processing immediately with `waitUntil`; Supabase Cron retries pending, delayed, or stale work every minute.

## Production status

Activated on 2026-10-20 for `https://abodid.com`. Storage migration `20261020220000` and scheduler migration `20261020221000` are applied and recorded in Supabase. `OPPORTUNITIES_CRON_SECRET` is stored as a Vercel Production secret, the matching value is stored in Supabase Vault as `opportunities_cron_secret`, and the first scheduled recovery request completed with HTTP 200. The secret value is not stored in this repository.

## Safe activation order for another environment

1. Apply `supabase/migrations/20261020220000_create_opportunity_capture_jobs.sql`. This creates only the isolated job table, policies and claim function; it does not activate cron or modify saved opportunities.
2. Deploy the application code. Until the table exists, the dashboard and extension automatically fall back to the existing synchronous capture endpoint.
3. Configure one matching secret, then redeploy (or otherwise confirm the active Vercel deployment has the new environment value):
   - Vercel: `OPPORTUNITIES_CRON_SECRET`
   - Supabase Vault: `opportunities_cron_secret`
4. Apply `supabase/migrations/20261020221000_schedule_opportunity_capture_jobs.sql` to activate one-minute recovery and hourly payload cleanup. It deliberately fails if the Vault secret is absent.
5. Submit a URL from the dashboard, close the tab after “Safely captured,” then confirm the opportunity appears after reopening.
6. Repeat from the unpacked Chrome extension and inspect `opportunity_capture_jobs` for a `succeeded` row.

The repository has historical local migrations that are intentionally not all present in the linked project's migration history. Do not run an unreviewed blanket `supabase db push`. Apply each migration above by itself, then mark only the version actually applied in migration history if the deployment workflow requires it.

## Data and recovery behavior

- `(user_id, idempotency_key)` prevents browser retries from creating duplicate jobs.
- The existing `(user_id, canonical_url)` uniqueness continues to prevent duplicate saved opportunities.
- Interrupted processing leases become claimable again after 15 minutes.
- Retryable failures use up to three attempts with increasing delay.
- Successful jobs remove captured page text immediately.
- Final failures retain the private page snapshot for retry recovery for no longer than 24 hours; an hourly database cleanup removes it.
- The old synchronous `/api/opportunities/capture` endpoint remains available as a compatibility and rollback path.
