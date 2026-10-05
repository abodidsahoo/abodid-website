// Read-only scan of every public Supabase table for old video URLs.
import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: key, Authorization: `Bearer ${key}` };
const pattern = /misc\/video-clips\/[^"'\s]+\.mp4|\/videos\/(showreel-2025|cambridge-visual-edit)\.mp4|assets\.abodid\.com\/videos\/(obsidian-timelapse|showreel-2025-compressed)\.mp4/g;

const spec = await (await fetch(`${url}/rest/v1/`, { headers })).json();
const tables = Object.keys(spec.paths).filter((p) => p !== "/" && !p.startsWith("/rpc/")).map((p) => p.slice(1));

for (const table of tables) {
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${url}/rest/v1/${table}?select=*`, { headers: { ...headers, Range: `${from}-${from + 999}` } });
    if (!res.ok) break;
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) break;
    for (const row of rows) {
      for (const [col, val] of Object.entries(row)) {
        const hits = val == null ? null : JSON.stringify(val).match(pattern);
        if (hits) console.log(`${table}\t${row.id ?? row.card_id ?? "?"}\t${col}\t${[...new Set(hits)].join(" ")}`);
      }
    }
    if (rows.length < 1000) break;
  }
}
console.log(`scanned ${tables.length} tables`);
