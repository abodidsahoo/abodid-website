import { extractMoodboardPaletteFromRgba, type MoodboardPaletteData } from "./paletteCore";

const SAMPLE_SIZE = 100;

export const extractMoodboardPaletteInBrowser = async (file: File): Promise<MoodboardPaletteData> => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    try {
        image.src = objectUrl;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = SAMPLE_SIZE;
        canvas.height = SAMPLE_SIZE;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("This browser cannot sample image colours.");
        const scale = Math.max(SAMPLE_SIZE / image.naturalWidth, SAMPLE_SIZE / image.naturalHeight);
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        context.drawImage(image, (SAMPLE_SIZE - width) / 2, (SAMPLE_SIZE - height) / 2, width, height);
        return extractMoodboardPaletteFromRgba(context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data);
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
};
