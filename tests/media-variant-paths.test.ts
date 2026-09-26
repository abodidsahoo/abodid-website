import { describe, expect, it } from "vitest";
import { getR2VariantFolderPaths } from "../src/lib/media/r2";

describe("R2 variant folder mirroring", () => {
    it("mirrors a new photos/originals folder at both responsive widths", () => {
        expect(getR2VariantFolderPaths("photos/originals/portfolio-video-thumbnails")).toEqual([
            "photos/variants/portfolio-video-thumbnails/800",
            "photos/variants/portfolio-video-thumbnails/1600",
        ]);
    });

    it("preserves nested paths and supports legacy originals folders", () => {
        expect(getR2VariantFolderPaths("originals/project/gallery")).toEqual([
            "photos/variants/project/gallery/800",
            "photos/variants/project/gallery/1600",
        ]);
    });

    it("does not create variants for unrelated media folders", () => {
        expect(getR2VariantFolderPaths("documents/research")).toEqual([]);
    });
});
