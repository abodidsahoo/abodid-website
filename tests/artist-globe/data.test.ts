import { describe, expect, it } from "vitest";
import {
  demoArtists,
  safeUrl,
  validArtist,
} from "../../src/lib/artist-globe/data";
import { position } from "../../src/components/artist-globe/scene";
describe("artist atlas data and geography", () => {
  it("keeps every fictional record explicit, valid and unique", () => {
    expect(new Set(demoArtists.map((a) => a.id)).size).toBe(demoArtists.length);
    expect(
      demoArtists.every(
        (a) =>
          validArtist(a) && a.is_demo && !a.public_email && !a.portfolio_url,
      ),
    ).toBe(true);
  });
  it("rejects malformed records and impossible coordinates", () => {
    expect(validArtist({ ...demoArtists[0], latitude: 91 })).toBe(false);
    expect(validArtist({ ...demoArtists[0], longitude: NaN })).toBe(false);
    expect(validArtist({ ...demoArtists[0], tags: [{}] })).toBe(false);
    expect(validArtist({ ...demoArtists[0], biography: { html: "bad" } })).toBe(
      false,
    );
  });
  it("does not turn unsafe URLs into links", () => {
    expect(safeUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeUrl("http://example.com")).toBeUndefined();
    expect(safeUrl("https://example.com/art")).toBe("https://example.com/art");
  });
  it("places Greenwich, the poles, and the antimeridian on the correct axes", () => {
    expect(position(0, 0).x).toBeCloseTo(1.015);
    expect(position(90, 0).y).toBeCloseTo(1.015);
    expect(position(0, 90).z).toBeCloseTo(-1.015);
    expect(position(0, 180).x).toBeCloseTo(-1.015);
  });
});
