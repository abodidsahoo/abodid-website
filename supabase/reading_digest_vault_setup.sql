-- Run this once in the Supabase SQL editor after replacing every placeholder.
-- Use the same READING_DIGEST_CRON_SECRET value in Edge Function secrets.

select vault.create_secret(
  'https://YOUR_PROJECT_REF.supabase.co',
  'reading_digest_project_url',
  'Base URL used by Supabase Cron to invoke the daily reading digest'
);

select vault.create_secret(
  'YOUR_SUPABASE_PUBLISHABLE_KEY',
  'reading_digest_publishable_key',
  'Publishable API key used by Supabase Cron at the Edge gateway'
);

select vault.create_secret(
  'GENERATE_A_LONG_RANDOM_SECRET',
  'reading_digest_cron_secret',
  'Shared secret checked by the daily reading digest Edge Function'
);
