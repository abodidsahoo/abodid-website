import type { Artist } from "./data";
import { safeUrl } from "./data";
import flags from "./flag-codes.json";
import { normalizeSearch } from "./search";
const flagIndex = new Map(
  Object.entries(flags).map(([country, code]) => [
    normalizeSearch(country),
    code,
  ]),
);
export const countryFlag = (country: string) => {
  const code = flagIndex.get(normalizeSearch(country));
  return code ? `/images/artist-globe/flags/${code}.png` : undefined;
};
export function instagramHandle(value: string | null) {
  const safe = safeUrl(value);
  if (!safe) return null;
  const u = new URL(safe),
    handle = u.pathname.split("/").filter(Boolean)[0];
  if (
    !/(^|\.)instagram\.com$/i.test(u.hostname) ||
    !handle ||
    ["p", "reel", "reels", "stories", "accounts", "explore"].includes(handle)
  )
    return null;
  return "@" + handle;
}
export function specificPractices(artist: Artist) {
  return artist.disciplines.filter(
    (s) =>
      s.trim() &&
      !/contemporary visual art|pending verification|not (yet )?(known|specified)|unknown/i.test(
        s,
      ),
  );
}
export function artistGoogleSearch(artist: Artist) {
  const practices = specificPractices(artist);
  const query = practices.length
    ? [artist.name, artist.country, practices.join(" ")].join(" ")
    : artist.name;
  return `https://www.google.com/search?${new URLSearchParams({ q: query })}`;
}
export function artistGivenName(name: string) {
  const parts = name
    .trim()
    .split(/\s+/u)
    .map((part) => part.replace(/^(?:\p{L}\.)+/u, ""));
  return (
    parts.find((part) => (part.match(/\p{L}/gu)?.length || 0) > 1) ||
    name.trim() ||
    "this artist"
  );
}
export type ArtistLink = {
  label: string;
  url: string;
  kind: "instagram" | "website" | "email" | "source";
};
export function profileLinks(
  artist: Artist,
  sourceFrequency: Map<string, number>,
): ArtistLink[] {
  const links: ArtistLink[] = [];
  const instagram = safeUrl(artist.instagram_url);
  if (instagram && instagramHandle(instagram))
    links.push({
      label: `Instagram · ${instagramHandle(instagram)}`,
      url: instagram,
      kind: "instagram",
    });
  const website = safeUrl(artist.portfolio_url);
  if (website)
    links.push({
      label: "Website / artist profile",
      url: website,
      kind: "website",
    });
  if (
    artist.public_email &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(artist.public_email)
  )
    links.push({
      label: `Email · ${artist.public_email}`,
      url: `mailto:${encodeURIComponent(artist.public_email)}`,
      kind: "email",
    });
  const seen = new Set(links.map((link) => link.url));
  for (const raw of [...artist.sources, ...artist.artwork_urls]) {
    const url = safeUrl(raw);
    if (!url || seen.has(url) || (sourceFrequency.get(raw) || 0) > 1) continue;
    seen.add(url);
    const host = new URL(url).hostname.replace(/^www\./, "");
    links.push({ label: `Article / source · ${host}`, url, kind: "source" });
  }
  return links;
}
