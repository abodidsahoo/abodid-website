const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jwipqbjxpmgyevfzpjjx.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3aXBxYmp4cG1neWV2Znpwamp4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODE5MTIxNSwiZXhwIjoyMDgzNzY3MjE1fQ.SqXzrQNTcx_ZHCxRY64ZosYHNSL2c8pAFaC_m0mNAFM';

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
  const q1 = `select vault.create_secret('https://jwipqbjxpmgyevfzpjjx.supabase.co', 'reading_digest_project_url', 'Base URL used by Supabase Cron');`;
  const q2 = `select vault.create_secret('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3aXBxYmp4cG1neWV2Znpwamp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxOTEyMTUsImV4cCI6MjA4Mzc2NzIxNX0.eG3p3TnYZWrSukGmhWcWk9OSLdmAIIsDiIme3Or-F5o', 'reading_digest_publishable_key', 'Publishable API key for Edge gateway');`;
  const q3 = `select vault.create_secret('rd_cron_sec_89f3a12b80041', 'reading_digest_cron_secret', 'Shared secret checked by Edge Function');`;

  console.log("Vault setup query ready.");
}

main();
