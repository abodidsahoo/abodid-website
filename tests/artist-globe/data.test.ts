import { describe, expect, it } from "vitest";
import {
  demoArtists,
  safeUrl,
  validArtist,
} from "../../src/lib/artist-globe/data";
import {
  angularVisibility,
  MIN_CAMERA_RADIUS,
  MAX_CAMERA_RADIUS,
  nearestArtistIndex,
  spinPose,
} from "../../src/lib/artist-globe/geography";
import {
  nominationInput,
  publicName,
  sameOrigin,
} from "../../src/lib/artist-globe/community";
describe("artist atlas data and geography", () => {
  it("keeps every fictional record explicit, valid and uniquely numbered", () => {
    expect(new Set(demoArtists.map((a) => a.id)).size).toBe(demoArtists.length);
    expect(new Set(demoArtists.map((a) => a.artist_number)).size).toBe(
      demoArtists.length,
    );
    expect(
      demoArtists.every(
        (a) =>
          validArtist(a) && a.is_demo && !a.public_email && !a.portfolio_url,
      ),
    ).toBe(true);
  });
  it("rejects malformed records and unsafe links", () => {
    expect(validArtist({ ...demoArtists[0], latitude: 91 })).toBe(false);
    expect(validArtist({ ...demoArtists[0], biography: { html: "bad" } })).toBe(
      false,
    );
    expect(safeUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeUrl("https://example.com/art")).toBe("https://example.com/art");
  });
  it("occludes the opposite hemisphere", () => {
    expect(angularVisibility(0, 0, 0, 0)).toBeCloseTo(1);
    expect(angularVisibility(0, 180, 0, 0)).toBeCloseTo(-1);
  });
  it("lands a multi-axis spin exactly on the artist in both directions", () => {
    for (const direction of [-1, 1]) {
      const end = spinPose(
        { lng: 170, lat: 30, bearing: 12 },
        { lng: -170, lat: -24 },
        1,
        direction,
      );
      expect((((end.lng + 170) % 360) + 360) % 360).toBeCloseTo(0);
      expect(end.lat).toBeCloseTo(-24);
      expect(end.bearing).toBeCloseTo(0);
    }
  });
  it("limits magnification to slightly beyond the frame and keeps the distant globe visible", () => {
    const diameterFraction =
      1 /
      (Math.sqrt(MIN_CAMERA_RADIUS ** 2 - 1) * Math.tan((19 * Math.PI) / 180));
    expect(diameterFraction).toBeGreaterThan(1);
    expect(diameterFraction).toBeLessThan(1.6);
    const closestGrowth = Math.sqrt(
      (2.3 ** 2 - 1) / (MIN_CAMERA_RADIUS ** 2 - 1),
    );
    expect(closestGrowth).toBeGreaterThan(1.09);
    expect(closestGrowth).toBeLessThan(1.12);
    const overviewDiameter =
      1 /
      (Math.sqrt(MAX_CAMERA_RADIUS ** 2 - 1) * Math.tan((19 * Math.PI) / 180));
    expect(overviewDiameter).toBeGreaterThan(0.5);
    expect(overviewDiameter).toBeLessThan(0.6);
  });
  it("spotlights the artist nearest the viewing direction", () => {
    const points = [
      { x: -1, y: 0, z: 0 },
      { x: 1, y: 1, z: 0 },
      { x: 1, y: 0, z: 0 },
    ];
    expect(nearestArtistIndex({ x: 1, y: 0, z: 0 }, points)).toBe(2);
    expect(nearestArtistIndex({ x: 0, y: 1, z: 0 }, points)).toBe(1);
    expect(nearestArtistIndex({ x: 0, y: 0, z: 1 }, [])).toBe(-1);
  });
});
describe("community inputs", () => {
  it("accepts a nomination without coordinates for review", () => {
    expect(
      nominationInput({
        name: "Artist Example",
        country: "IN",
        link: "@artist",
        city: "",
      }).latitude,
    ).toBeNull();
  });
  it("rejects missing names, invalid countries, unsafe handles and partial coordinates", () => {
    for (const bad of [
      { name: "" },
      { country: "??" },
      { link: "javascript:alert(1)" },
      { latitude: 4 },
    ])
      expect(() =>
        nominationInput({
          name: "Artist Example",
          country: "IN",
          link: "@artist",
          ...bad,
        }),
      ).toThrow();
  });
  it("normalizes public names without publishing links or contact details", () => {
    expect(publicName("  Art   Wanderer ")).toBe("Art Wanderer");
    expect(() => publicName("someone@example.com")).toThrow();
  });
  it("rejects cross-site writes", () => {
    expect(
      sameOrigin(
        new Request("https://abodid.com/api/test", {
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toBe(false);
  });
});
