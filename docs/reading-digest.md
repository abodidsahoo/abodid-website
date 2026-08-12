# Personal reading digest

This system discovers, verifies, ranks, stores and emails five readings at 08:00 Asia/Kolkata. It is split into three deployable pieces:

- `supabase/migrations/20260804100000_create_daily_reading_digest.sql`: tables, row-level security, editorial invariants and Supabase Cron.
- `supabase/functions/daily-reading-digest/index.ts`: OpenAI-compatible web research, deterministic URL checks, deduplication, ranking and Resend delivery.
- `apps/reading-digest-dashboard`: private Next.js dashboard for preferences, the reading library, feedback and run history.

## What the pipeline guarantees

1. The Responses API searches for recent and foundational material with the current topic/source preferences.
2. Every candidate URL is canonicalised, checked against blocked domains, compared to the full sent history, and fetched directly.
3. Duplicate URLs and near-duplicate titles are removed. Broken, blocked, promotional and unverifiable candidates are stored as rejected.
4. Ranking combines relevance, credibility, recency, trusted-source preference and prior feedback for the same source domain.
5. Selection requires at least two recent items and one foundational item. If five valid items are not available after two search rounds, no email is sent.
6. `reading_digest_delivery_items.reading_id` is unique, so a reading cannot be included in a second delivery.
7. The database refuses to finalise a delivery without exactly five items and exactly one “Read first today” item.
8. Resend receives a stable idempotency key, making same-day retries safe.

The Edge Function stores its raw search actions/citations on the run and stores every structurally valid candidate in `reading_digest_readings`, including rejections.

## Deploy Supabase

Prerequisites: the repository must be linked to the intended Supabase project and the admin user must have `profiles.role = 'admin'`.

1. Review the pending migrations, then apply them:

   ```bash
   npx supabase migration list
   npx supabase db push
   ```

2. Create a long random cron secret. Add the Edge Function secrets (never commit the real values). Supply either a direct OpenAI key or an OpenRouter key:

   ```bash
   npx supabase secrets set OPENROUTER_API_KEY=sk-or-v1-REPLACE_ME
   npx supabase secrets set READING_DIGEST_AI_PROVIDER=openrouter
   npx supabase secrets set READING_DIGEST_OPENROUTER_MODEL=openai/gpt-5.6-terra
   npx supabase secrets set READING_DIGEST_OPENROUTER_FALLBACK_MODEL=openai/gpt-5.6-sol
   npx supabase secrets set RESEND_API_KEY=re_REPLACE_ME
   npx supabase secrets set READING_DIGEST_CRON_SECRET=REPLACE_WITH_THE_RANDOM_SECRET
   ```

   The first discovery round uses Terra. Sol is invoked only when fewer than five candidates survive verification and the second discovery round is necessary. OpenRouter discovery uses its hosted `openrouter:web_search` server tool so candidate URLs come from live results; search usage consumes OpenRouter credits in addition to model tokens. Use `OPENAI_API_KEY` with `READING_DIGEST_AI_PROVIDER=openai` for the direct OpenAI Responses API path. With `auto`, OpenRouter is preferred when both keys are available. Vercel environment variables are not visible to a Supabase Edge Function, so these values must also be configured in Supabase.

3. In the Supabase SQL editor, run `supabase/reading_digest_vault_setup.sql` after replacing its three placeholders. The Vault cron secret must exactly match the Edge Function secret from step 2.

4. Deploy the function:

   ```bash
   npx supabase functions deploy daily-reading-digest --use-api
   ```

5. Open Supabase → Integrations → Cron. Confirm `daily-reading-digest-0800-ist` is active. It runs at `30 2 * * *` UTC, which is 08:00 in Asia/Kolkata throughout the year.

6. Set the recipient (`abodidsahoo@gmail.com`) and a sender address from a domain verified in Resend. Until a recipient is set, a run fails safely before any search or send.

Supabase’s current documentation recommends combining Cron, `pg_net` and Vault for scheduled Edge Function calls. The function uses a custom `x-cron-secret`, so its project config intentionally sets `verify_jwt = false`; requests are still rejected unless they carry that secret or belong to a signed-in admin.

## Access the Dashboard

The Reading Digest desk is integrated directly into the main site Admin Panel at:
**`/admin/dashboard?section=reading_digest`**

Alternatively, a standalone Next.js dashboard is located at `apps/reading-digest-dashboard`:

```bash
cd apps/reading-digest-dashboard
npm install
cp .env.example .env.local
npm run dev
```

Set these browser-safe values in `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

The dashboard uses Supabase Auth cookies, confirms `profiles.role = 'admin'` on every Server Action, and relies on RLS for all reads and writes. It never needs a service-role key.

For production, deploy `apps/reading-digest-dashboard` as its own Next.js project and set the same two public environment variables there. Disable public indexing at the platform level as an additional precaution; the app already emits `noindex, nofollow` metadata.

## Test before enabling delivery

```bash
npm run test:reading-digest
cd apps/reading-digest-dashboard
npm run typecheck
npm run build
```

Then use “Run digest now” in the dashboard. Confirm:

- the run shows five selected readings;
- the email contains five item blocks and ends with “Read first today”;
- each URL opens the direct source;
- a second manual run does not reuse any of the first five readings;
- the Resend sender domain and recipient are correct.

## Operations

- Pause delivery or switch between daily, weekdays and weekly in the dashboard. Cron still wakes daily; the Edge Function records a cheap `skipped` run when delivery is not due.
- Add domain-only rules. A rule for `example.org` also covers its subdomains.
- “Useful”, “Read” and “Not for me” feedback adjusts future source-domain ranking. Saved readings remain independent of feedback.
- Failed runs and delivery errors are visible in the Activity section. A failed Resend attempt is retried with the same idempotency key.
- Cron history is also available in Supabase under Integrations → Cron → History.

## Primary references

- [OpenAI web search in the Responses API](https://developers.openai.com/api/docs/guides/tools-web-search)
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenRouter Responses API](https://openrouter.ai/docs/api_reference/responses/overview)
- [OpenRouter web-search server tool](https://openrouter.ai/docs/guides/features/server-tools/web-search)
- [Supabase: scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
- [Supabase Cron quickstart](https://supabase.com/docs/guides/cron/quickstart)
- [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets)
- [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email)
- [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys)
