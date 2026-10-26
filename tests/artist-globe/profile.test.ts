import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import candidates from "../../src/data/artist-globe/research-candidates.json";
import {
  artistGivenName,
  artistGoogleSearch,
  countryFlag,
  instagramHandle,
  profileLinks,
} from "../../src/lib/artist-globe/profile";
import type { Artist } from "../../src/lib/artist-globe/data";
describe("concise source-backed artist card", () => {
  it("uses a full name token after initials for the learn-more label", () => {
    expect(artistGivenName("Abodid Sahoo")).toBe("Abodid");
    expect(artistGivenName("T. Vinoja")).toBe("Vinoja");
    expect(artistGivenName("T.Vinoja")).toBe("Vinoja");
    expect(artistGivenName("G. R. Iranna")).toBe("Iranna");
    expect(artistGivenName("G.R. Iranna")).toBe("Iranna");
    expect(artistGivenName("  A  María López ")).toBe("María");
    expect(artistGivenName("Jean-Michel Basquiat")).toBe("Jean-Michel");
    expect(artistGivenName("biarritzzz")).toBe("biarritzzz");
    expect(artistGivenName("A. B.")).toBe("A. B.");
  });
  it("has a real PNG flag for every artist country, including territories and alternate names", () => {
    for (const country of new Set(candidates.map((a) => a.country))) {
      const path = countryFlag(country);
      expect(path).toMatch(/\.png$/);
      expect(
        readFileSync(new URL("../../public" + path, import.meta.url)).subarray(
          0,
          8,
        ),
      ).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    }
  });
  it("uses actual Instagram profile handles and avoids shared exhibition rosters", () => {
    const a = candidates.find((a) => a.name === "Shivanjani Lal")! as Artist;
    const counts = new Map<string, number>();
    for (const r of candidates)
      for (const url of new Set(r.sources))
        counts.set(url, (counts.get(url) || 0) + 1);
    const links = profileLinks(a, counts);
    expect(links[0].label).toBe("Instagram · @arti_shivanjani");
    expect(links.some((l) => l.kind === "website")).toBe(true);
    expect(links.some((l) => l.kind === "email")).toBe(true);
    expect(links.some((l) => l.url === a.sources[0])).toBe(false);
    expect(instagramHandle("https://example.com/instagram")).toBeNull();
    expect(instagramHandle("https://instagram.com/p/photo")).toBeNull();
  });
  it("searches by artist name when no specific style is available", () => {
    const a = candidates.find((a) => a.name === "Shivanjani Lal")! as Artist;
    expect(new URL(artistGoogleSearch(a)).searchParams.get("q")).toBe(a.name);
    const styled = candidates.find(
      (a) => a.name === "Adrián Balseca",
    )! as Artist;
    const query = new URL(artistGoogleSearch(styled)).searchParams.get("q")!;
    expect(query).toContain(styled.name);
    expect(query).toContain(styled.country);
    expect(query).toContain("Moving image");
  });
});
