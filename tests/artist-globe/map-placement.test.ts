import { describe, it, expect } from "vitest";
import candidates from "../../src/data/artist-globe/research-candidates.json";
import { placeArtistsOnMap } from "../../src/lib/artist-globe/map-placement";
import { validArtist, type Artist } from "../../src/lib/artist-globe/data";
describe("all-profile map presentation", () => {
  it("places every artist without modifying the source coordinates or verification flags", () => {
    const source = structuredClone(candidates) as Artist[];
    const result = placeArtistsOnMap(source);
    expect(result).toHaveLength(216);
    expect(result.every(validArtist)).toBe(true);
    expect(result.filter((a) => a.map_placement === "city")).toHaveLength(86);
    expect(result.filter((a) => a.map_placement === "country")).toHaveLength(
      130,
    );
    expect(result.filter((a) => a.map_pin_ready)).toHaveLength(28);
    expect(source).toEqual(candidates);
    expect(result.filter((a) => a.source_latitude === null)).toHaveLength(152);
    expect(
      new Set(result.map((a) => `${a.latitude},${a.longitude}`)).size,
    ).toBeGreaterThan(200);
  });
  it("keeps approximate country placements stable when the index order changes", () => {
    const original = placeArtistsOnMap(candidates as Artist[]);
    const reverse = placeArtistsOnMap([...candidates].reverse() as Artist[]);
    for (const a of original) {
      const b = reverse.find((r) => r.id === a.id)!;
      expect([b.latitude, b.longitude]).toEqual([a.latitude, a.longitude]);
    }
  });
});
