import { describe, expect, it } from "vitest";
import { advanceSpring } from "../../src/lib/artist-globe/motion";

describe("weighted globe motion", () => {
  it("starts gently, accelerates, and settles without overshooting", () => {
    let offset = 1,
      velocity = 0;
    const speeds: number[] = [];
    for (let i = 0; i < 120; i++) {
      const next = advanceSpring(offset, velocity, 1 / 120);
      expect(next.offset).toBeGreaterThanOrEqual(0);
      expect(next.step).toBeGreaterThanOrEqual(0);
      speeds.push(next.velocity);
      offset = next.offset;
      velocity = next.velocity;
    }
    expect(speeds[0]).toBeLessThan(speeds[7]);
    expect(offset).toBeLessThan(0.00001);
    expect(velocity).toBeLessThan(0.0001);
  });
  it("gives the same rotation at 30, 60, and 120 frames per second", () => {
    const outcomes = [30, 60, 120].map((fps) => {
      let offset = 0.8,
        velocity = -0.2;
      for (let i = 0; i < fps / 2; i++)
        ({ offset, velocity } = advanceSpring(offset, velocity, 1 / fps));
      return { offset, velocity };
    });
    for (const result of outcomes.slice(1)) {
      expect(result.offset).toBeCloseTo(outcomes[0].offset, 10);
      expect(result.velocity).toBeCloseTo(outcomes[0].velocity, 10);
    }
  });
});
