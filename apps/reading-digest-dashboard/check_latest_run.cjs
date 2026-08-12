const requiredEnv = (names) => {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new Error(`Missing ${names.join(" or ")}.`);
};

const resolveConfig = () => ({
  supabaseUrl: requiredEnv([
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "PUBLIC_SUPABASE_URL",
  ]).replace(/\/+$/, ""),
  serviceRoleKey: requiredEnv(["SUPABASE_SERVICE_ROLE_KEY"]),
});

async function main({ fetchImpl = fetch, config = resolveConfig() } = {}) {
  const url = new URL("/rest/v1/reading_digest_runs", config.supabaseUrl);
  url.search = new URLSearchParams({
    select: "*",
    order: "started_at.desc",
    limit: "5",
  }).toString();

  const res = await fetchImpl(url, {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data && typeof data === "object"
      ? JSON.stringify(data).slice(0, 1_000)
      : "No JSON error response received.";
    throw new Error(`Supabase run lookup failed (${res.status}): ${detail}`);
  }
  console.log("Recent runs:", JSON.stringify(data, null, 2));
  return data;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = { main, resolveConfig };
