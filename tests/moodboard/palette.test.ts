import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
    extractMoodboardPalette,
    isMoodboardPaletteData,
} from "../../src/lib/moodboard/palette";
import { mapMoodboardRows } from "../../src/lib/services/moodboard";

describe("moodboard palette persistence", () => {
    it("extracts a compact filter palette from uploaded image bytes", async () => {
        const bytes = await sharp({
            create: {
                width: 24,
                height: 24,
                channels: 4,
                background: { r: 190, g: 45, b: 35, alpha: 1 },
            },
        }).png().toBuffer();

        const palette = await extractMoodboardPalette(bytes);

        expect(isMoodboardPaletteData(palette)).toBe(true);
        expect(palette.dominantHex).toMatch(/^#[0-9a-f]{6}$/);
        expect(palette.dominantLab).toHaveLength(3);
        expect(palette.paletteLab).toHaveLength(4);
    });

    it("prefers the palette stored with the item over the generated-file fallback", () => {
        const storedPalette = {
            dominantHex: "#be2d23",
            dominantLab: [42, 58, 43] as [number, number, number],
            dominantHsl: [4, 69, 44] as [number, number, number],
            paletteHex: ["#be2d23"],
            paletteLab: [[42, 58, 43]] as [number, number, number][],
            paletteHsl: [[4, 69, 44]] as [number, number, number][],
            isDark: true,
        };
        const fallbackPalette = { ...storedPalette, dominantHex: "#000000" };
        const [item] = mapMoodboardRows([{
            id: "mood-with-palette",
            image_url: "https://assets.abodid.com/photos/originals/moodboard/red.png",
            storage_path: "assets/photos/originals/moodboard/red.png",
            title: "Red",
            tags: [],
            published: true,
            image_width: 24,
            image_height: 24,
            aspect_ratio: 1,
            source_url: null,
            artist_name: null,
            palette: storedPalette,
            created_at: "2026-10-12T00:00:00.000Z",
            updated_at: "2026-10-12T00:00:00.000Z",
        }], { "mood-with-palette": fallbackPalette });

        expect(item.palette).toEqual(storedPalette);
    });
});
