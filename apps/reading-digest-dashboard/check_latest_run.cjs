const url = 'https://jwipqbjxpmgyevfzpjjx.supabase.co/rest/v1/reading_digest_runs?select=*&order=started_at.desc&limit=5';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3aXBxYmp4cG1neWV2Znpwamp4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODE5MTIxNSwiZXhwIjoyMDgzNzY3MjE1fQ.SqXzrQNTcx_ZHCxRY64ZosYHNSL2c8pAFaC_m0mNAFM';

async function main() {
  const res = await fetch(url, {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    }
  });
  const data = await res.json();
  console.log("Recent runs:", JSON.stringify(data, null, 2));
}

main();
