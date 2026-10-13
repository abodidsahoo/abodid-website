import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { extractMoodboardPaletteFromRgba } from "../../src/lib/moodboard/paletteCore";
import { readPngSample } from "../../workers/media-processor/src/index";

describe("Cloudflare moodboard palette sampling", () => {
    it("decodes the transient PNG and produces persistable palette data", async () => {
        const png = await sharp({
            create: {
                width: 100,
                height: 100,
                channels: 4,
                background: { r: 190, g: 45, b: 35, alpha: 1 },
            },
        }).png().toBuffer();

        const rgba = await readPngSample(new Uint8Array(png));
        const palette = extractMoodboardPaletteFromRgba(rgba);

        expect(rgba).toHaveLength(100 * 100 * 4);
        expect(palette.dominantHex).toMatch(/^#[0-9a-f]{6}$/);
        expect(palette.paletteLab).toHaveLength(4);
    });
});
