// Server-side presentation placements. Never writes inferred coordinates back to artist records.
import cities from "../../data/artist-globe/cities.json";
import countries from "./countries.json";
import anchors from "../../../public/data/artist-globe/countries.json";
import regions from "../../../public/data/artist-globe/country-regions.json";
import { countryAtPoint } from "./geography";
import { normalizeSearch } from "./search";
import type { Artist, MappedArtist } from "./data";
const key = (value: string) => normalizeSearch(value).replaceAll(" ", "");
const countryCodes = new Map(countries.map((c) => [key(c.name), c.code]));
const cityIndex = new Map<string, [number, number]>();
for (const row of cities)
  for (const name of [row[1], row[2]]) {
    const k = `${row[3]}:${key(String(name))}`;
    if (!cityIndex.has(k)) cityIndex.set(k, [Number(row[4]), Number(row[5])]);
  }
const aliases: Record<string, string> = { cotedivoire: "Ivory Coast" };
const byCountry = new Map(anchors.map((a) => [key(String(a[0])), a]));
const byRegion = new Map(regions.map((r) => [key(r.name), r]));
const regionSets = new Map(regions.map((r) => [key(r.name), [r]]));
const halton = (index: number, base: number) => {
  let value = 0,
    fraction = 1;
  while (index > 0) {
    fraction /= base;
    value += fraction * (index % base);
    index = Math.floor(index / base);
  }
  return value;
};
function hash(id: string) {
  let h = 2166136261;
  for (const c of id) {
    h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  }
  return h >>> 0;
}
const countryBounds = new Map<
  string,
  { west: number; east: number; south: number; north: number }
>();
for (const region of regions) {
  // Use the largest land polygon so country-level markers stay in that country's main landmass.
  const largest = region.polygons.reduce((best, p) => {
    const area = (ring: number[][]) =>
      Math.abs(
        ring.reduce((s, a, i) => {
          const b = ring[(i + 1) % ring.length];
          return s + a[0] * b[1] - b[0] * a[1];
        }, 0),
      );
    return area(p[0]) > area(best[0]) ? p : best;
  });
  const xs = largest[0].map((p) => p[0]),
    ys = largest[0].map((p) => p[1]);
  countryBounds.set(key(region.name), {
    west: Math.min(...xs),
    east: Math.max(...xs),
    south: Math.min(...ys),
    north: Math.max(...ys),
  });
}
export function placeArtistsOnMap(artists: Artist[]): MappedArtist[] {
  return artists.map((artist) => {
    let point: [number, number] | undefined;
    let accuracy: "city" | "country" = "city";
    if (artist.latitude !== null && artist.longitude !== null)
      point = [artist.latitude, artist.longitude];
    else if (artist.current_city) {
      const code = countryCodes.get(key(artist.country));
      let city = key(artist.current_city);
      if (city === "newyork") city = "newyorkcity";
      point = cityIndex.get(`${code}:${city}`);
    }
    if (!point) {
      accuracy = "country";
      const name = aliases[key(artist.country)] || artist.country,
        k = key(name);
      const anchor = byCountry.get(k),
        region = byRegion.get(k),
        bounds = countryBounds.get(k);
      if (anchor) point = [Number(anchor[1]), Number(anchor[2])];
      if (region && bounds) {
        const start = (hash(artist.id) % 8191) + 1;
        for (let i = 0; i < 160; i++) {
          const lon =
            bounds.west + halton(start + i, 2) * (bounds.east - bounds.west);
          const lat =
            bounds.south + halton(start + i, 3) * (bounds.north - bounds.south);
          if (countryAtPoint(lon, lat, regionSets.get(k)!) === region.name) {
            point = [lat, lon];
            break;
          }
        }
      }
      if (!point && k === "guadeloupe") point = [16.25, -61.58];
      if (!point)
        throw Error(`No country placement available for ${artist.country}`);
    }
    return {
      ...artist,
      source_latitude: artist.latitude,
      source_longitude: artist.longitude,
      latitude: point[0],
      longitude: point[1],
      map_placement: accuracy,
    };
  });
}
