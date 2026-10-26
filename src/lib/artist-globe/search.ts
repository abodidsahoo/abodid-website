import type { Artist } from "./data";
export const normalizeSearch = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
function distance(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 2) return 99;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++)
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + Number(a[i - 1] !== b[j - 1]),
      );
    previous = current;
  }
  return previous[b.length];
}
export function searchArtists(artists: Artist[], query: string) {
  const raw = normalizeSearch(query.slice(0, 120));
  const aliases: Record<string, string> = {
    uk: "united kingdom",
    usa: "united states",
    uae: "united arab emirates",
  };
  const tokens = (aliases[raw] || raw).split(" ").filter(Boolean).slice(0, 8);
  if (!tokens.length) return artists;
  return artists
    .map((artist) => {
      const fields = [
        artist.name,
        `${artist.current_city} ${artist.country}`,
        artist.disciplines.join(" "),
        artist.tags.join(" "),
        artist.biography,
      ].map(normalizeSearch);
      let score = 0;
      for (const token of tokens) {
        let best = Infinity;
        fields.forEach((field, index) => {
          if (field.includes(token))
            best = Math.min(
              best,
              index * 2 + (field.startsWith(token) ? 0 : 1),
            );
          else if (token.length >= 4)
            for (const word of field.split(" ")) {
              const d = distance(token, word);
              if (d <= (token.length > 6 ? 2 : 1))
                best = Math.min(best, 10 + index * 2 + d);
            }
        });
        if (!Number.isFinite(best)) return { artist, score: Infinity };
        score += best;
      }
      return { artist, score };
    })
    .filter((item) => Number.isFinite(item.score))
    .sort(
      (a, b) => a.score - b.score || a.artist.name.localeCompare(b.artist.name),
    )
    .map((item) => item.artist);
}
