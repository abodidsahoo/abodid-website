import { describe, it, expect } from "vitest";
import candidates from "../../src/data/artist-globe/research-candidates.json";
import regions from "../../public/data/artist-globe/country-regions.json";
import {
  countryAtPoint,
  spinPose,
  formatCoordinates,
} from "../../src/lib/artist-globe/geography";
import {
  validArtist,
  validProfile,
  type Artist,
} from "../../src/lib/artist-globe/data";
import { searchArtists } from "../../src/lib/artist-globe/search";
describe("research atlas", () => {
  it("keeps all research candidates as drafts and only verified locations as pins", () => {
    expect(candidates).toHaveLength(216);
    expect(new Set(candidates.map((a) => a.id)).size).toBe(216);
    expect(
      candidates.every((a) => !a.published && !a.is_demo && validProfile(a)),
    ).toBe(true);
    expect(candidates.filter(validArtist)).toHaveLength(28);
    expect(candidates.filter((a) => a.latitude === null)).toHaveLength(152);
    expect(
      candidates.filter((a) => a.latitude !== null && !a.map_pin_ready),
    ).toHaveLength(36);
  });
  it.each([
    [-0.13, 51.51, "United Kingdom"],
    [-3.19, 55.95, "United Kingdom"],
    [-6.26, 53.35, "Ireland"],
    [4.35, 50.85, "Belgium"],
    [2.35, 48.86, "France"],
    [139.69, 35.68, "Japan"],
    [-74.0, 40.71, "United States"],
    [-30, 0, null],
    [77.21, 28.61, "India"],
    [-78.47, -0.18, "Ecuador"],
    [115.86, -31.95, "Australia"],
    [69.24, 41.31, "Uzbekistan"],
    [2.11, 13.51, "Niger"],
    [178.1, -17.8, "Fiji"],
    [29, 41, "Turkey"],
    [-171.75, -13.83, "Samoa"],
  ] as const)("identifies the country beneath %s,%s", (lon, lat, name) =>
    expect(countryAtPoint(lon, lat, regions)).toBe(name),
  );
  it("uses one circular discovery path with monotonic latitude and no wobble", () => {
    const values = Array.from({ length: 101 }, (_, i) =>
      spinPose(
        { lng: -0.1, lat: 51, bearing: 0 },
        { lng: 135, lat: -20 },
        i / 100,
        1,
      ),
    );
    expect(values.every((p, i) => i === 0 || p.lat <= values[i - 1].lat)).toBe(
      true,
    );
    expect(values.every((p) => p.bearing === 0)).toBe(true);
    expect(values.every((p, i) => i === 0 || p.lng >= values[i - 1].lng)).toBe(
      true,
    );
    expect(values.at(-1)?.lat).toBe(-20);
  });
  it("finds names, diacritics, places, style and small typing errors", () => {
    const records = candidates as Artist[];
    expect(searchArtists(records, "galann")[0]?.name).toBe("Nicholas Galanin");
    expect(searchArtists(records, "balsca")[0]?.name).toBe("Adrián Balseca");
    expect(searchArtists(records, "photography").length).toBeGreaterThan(0);
    expect(
      searchArtists(records, "Jappan").some((a) => a.country === "Japan"),
    ).toBe(true);
    expect(searchArtists(records, "zzzzzzzzzzzz")).toHaveLength(0);
  });
});

it("formats central coordinates with rounded degrees and simple compass directions", () => {
  expect(formatCoordinates(51.51, -0.13)).toBe("52° N · 0° W");
  expect(formatCoordinates(-33.87, 151.21)).toBe("34° S · 151° E");
  expect(formatCoordinates(-0.5, -179.6)).toBe("1° S · 180° W");
});
