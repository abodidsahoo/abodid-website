import type { APIRoute } from "astro";
import cities from "../../../data/artist-globe/cities.json";
import countries from "../../../lib/artist-globe/countries.json";
export const prerender = false;
const names = new Map(countries.map((c) => [c.code, c.name]));
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const indexed = cities.map((row) => ({
  row,
  search: normalize(`${row[1]} ${row[2]} ${row[7]}`),
}));
export const GET: APIRoute = async ({ url }) => {
  const q = normalize((url.searchParams.get("q") || "").trim().slice(0, 80)),
    country = url.searchParams.get("country") || "";
  if (q.length < 2) return Response.json({ locations: [] });
  const matches = indexed.filter(
    ({ row, search }) => (!country || row[3] === country) && search.includes(q),
  );
  matches.sort(
    (a, b) =>
      Number(!normalize(String(a.row[1])).startsWith(q)) -
      Number(!normalize(String(b.row[1])).startsWith(q)),
  );
  const locations = matches.slice(0, 8).map(({ row }) => ({
    id: String(row[0]),
    name: String(row[1]),
    countryCode: String(row[3]),
    country: names.get(String(row[3])) || row[3],
    latitude: row[4],
    longitude: row[5],
  }));
  return Response.json(
    { locations },
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
  );
};
