import { describe, expect, it } from "vitest";
import { variantFolderKeysFor } from "./index";

describe("variantFolderKeysFor", () => {
  it("mirrors a photos/originals folder into both variant widths", () => {
    expect(variantFolderKeysFor("photos/originals/new-series/")).toEqual([
      "photos/variants/new-series/800/",
      "photos/variants/new-series/1600/",
    ]);
  });

  it("preserves nested folders", () => {
    expect(variantFolderKeysFor("photos/originals/series/day-one/")).toEqual([
      "photos/variants/series/day-one/800/",
      "photos/variants/series/day-one/1600/",
    ]);
  });

  it("continues to support legacy originals folders", () => {
    expect(variantFolderKeysFor("originals/legacy-series/")).toEqual([
      "photos/variants/legacy-series/800/",
      "photos/variants/legacy-series/1600/",
    ]);
  });

  it("does not mirror the originals root or unrelated folders", () => {
    expect(variantFolderKeysFor("photos/originals/")).toEqual([]);
    expect(variantFolderKeysFor("documents/new-series/")).toEqual([]);
  });
});
