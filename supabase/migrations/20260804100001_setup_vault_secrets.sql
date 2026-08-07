select vault.create_secret(
  'https://jwipqbjxpmgyevfzpjjx.supabase.co',
  'reading_digest_project_url',
  'Base URL used by Supabase Cron'
);

select vault.create_secret(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3aXBxYmp4cG1neWV2Znpwamp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxOTEyMTUsImV4cCI6MjA4Mzc2NzIxNX0.eG3p3TnYZWrSukGmhWcWk9OSLdmAIIsDiIme3Or-F5o',
  'reading_digest_publishable_key',
  'Publishable API key for Edge gateway'
);

select vault.create_secret(
  'rd_cron_sec_89f3a12b80041',
  'reading_digest_cron_secret',
  'Shared secret checked by Edge Function'
);
