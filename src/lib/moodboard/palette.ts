import sharp from "sharp";
import {
    extractMoodboardPaletteFromRgba,
    isMoodboardPaletteData,
    type MoodboardPaletteData,
} from "./paletteCore";

export { isMoodboardPaletteData };
export type { MoodboardPaletteData };

export const extractMoodboardPalette = async (
    sourceBytes: Uint8Array | Buffer,
): Promise<MoodboardPaletteData> => {
    const { data, info } = await sharp(sourceBytes)
        .rotate()
        .resize(100, 100, { fit: "cover" })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    return extractMoodboardPaletteFromRgba(data, info.channels);
};
