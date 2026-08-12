const requiredEnv = (names) => {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new Error(`Missing ${names.join(" or ")}.`);
};

const sqlLiteral = (value) => value.replaceAll("'", "''");

async function main() {
  const supabaseUrl = requiredEnv([
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "PUBLIC_SUPABASE_URL",
  ]).replace(/\/+$/, "");
  const publishableKey = requiredEnv([
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "PUBLIC_SUPABASE_ANON_KEY",
  ]);
  const cronSecret = requiredEnv(["READING_DIGEST_CRON_SECRET"]);

  const statements = [
    `select vault.create_secret('${sqlLiteral(supabaseUrl)}', 'reading_digest_project_url', 'Base URL used by Supabase Cron');`,
    `select vault.create_secret('${sqlLiteral(publishableKey)}', 'reading_digest_publishable_key', 'Publishable API key for Edge gateway');`,
    `select vault.create_secret('${sqlLiteral(cronSecret)}', 'reading_digest_cron_secret', 'Shared secret checked by Edge Function');`,
  ];

  console.log("Vault setup statements are ready from environment variables.");
  return statements;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = { main };
