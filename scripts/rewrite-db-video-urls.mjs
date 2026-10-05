// One-off: rewrite stored Supabase video-clip URLs to the R2 landing-page URLs.
// Backs up every touched row to scratch before writing.
import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });
import { writeFile } from "node:fs/promises";

const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const BACKUP = process.argv[2];

const S = "https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/video-clips/";
const R = "https://assets.abodid.com/videos/landing-page/";
const map = {
  "Obsidian_Timelapse.mp4": "obsidian-timelapse.mp4",
  "audio-spectrum-compressed.mp4": "audio-spectrum.mp4",
  "gesture-image.mp4": "gesture-control.mp4",
  "obsidian-vault-notes-thumbnail-video.mp4": "obsidian-vault-notes-thumbnail.mp4",
  "punctum_thumbnail_video.mp4": "punctum-thumbnail.mp4",
  "sequence-room-comp.mp4": "sequence-room.mp4",
};
const rewrite = (text) => Object.entries(map).reduce((t, [from, to]) => t.split(S + from).join(R + to), text);

const targets = {
  home_storytelling_cards: ["image_url", "video_url"],
  lab_catalogue_entries: ["thumbnail_url", "video_url"],
  portfolio_projects: ["content", "published_content", "cover_url", "social_image_url"],
};

const backup = {};
for (const [table, columns] of Object.entries(targets)) {
  const rows = await (await fetch(`${url}/rest/v1/${table}?select=*`, { headers })).json();
  if (!Array.isArray(rows)) throw new Error(`${table}: ${JSON.stringify(rows)}`);
  for (const row of rows) {
    const patch = {};
    for (const col of columns) {
      if (row[col] == null || !(col in row)) continue;
      const before = JSON.stringify(row[col]);
      if (!before.includes(S)) continue;
      patch[col] = JSON.parse(rewrite(before));
    }
    if (!Object.keys(patch).length) continue;
    (backup[table] ||= []).push(row);
    const res = await fetch(`${url}/rest/v1/${table}?id=eq.${row.id}`, {
      method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`${table} ${row.id}: ${res.status} ${await res.text()}`);
    console.log(`updated ${table} ${row.id}: ${Object.keys(patch).join(", ")}`);
  }
  await writeFile(BACKUP, JSON.stringify(backup, null, 2));
}
console.log(`backup written to ${BACKUP}`);
