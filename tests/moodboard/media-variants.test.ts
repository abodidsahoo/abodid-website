import { describe, expect, it } from "vitest";
import {
    mapMoodboardRows,
    moodboardObjectKey,
} from "../../src/lib/services/moodboard";
import { animatedWebpQuality } from "../../src/lib/media/imageVariants";

const row = {
    id: "mood-1",
    image_url: "https://assets.abodid.com/photos/originals/moodboard/idea.gif",
    storage_path: "assets/photos/originals/moodboard/idea.gif",
    title: "Motion study",
    tags: ["motion"],
    published: true,
    image_width: 1200,
    image_height: 800,
    aspect_ratio: 1.5,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
};

describe("moodboard responsive media", () => {
    it("uses 800px variants for the grid and 1600px variants in the viewer", () => {
        const [item] = mapMoodboardRows([row], {}, [{
            object_key: "photos/originals/moodboard/idea.gif",
            public_url: row.image_url,
            media_variants: [
                { variant_key: "800", public_url: "https://assets.abodid.com/photos/variants/moodboard/800/idea.webp" },
                { variant_key: "1600", public_url: "https://assets.abodid.com/photos/variants/moodboard/1600/idea.webp" },
            ],
        }]);

        expect(item.thumbnailUrl).toContain("/800/");
        expect(item.imageUrl).toContain("/1600/");
        expect(item.originalUrl).toBe(row.image_url);
    });

    it("falls back safely while one or both variants are still processing", () => {
        const [partial] = mapMoodboardRows([row], {}, [{
            object_key: "photos/originals/moodboard/idea.gif",
            public_url: row.image_url,
            media_variants: [
                { variant_key: "800", public_url: "https://assets.abodid.com/photos/variants/moodboard/800/idea.webp" },
            ],
        }]);
        const [unprocessed] = mapMoodboardRows([row], {});

        expect(partial.thumbnailUrl).toContain("/800/");
        expect(partial.imageUrl).toBe(row.image_url);
        expect(unprocessed.thumbnailUrl).toBe(row.image_url);
        expect(unprocessed.imageUrl).toBe(row.image_url);
    });

    it("resolves the R2 object key without leaking bucket names into lookups", () => {
        expect(moodboardObjectKey(row)).toBe("photos/originals/moodboard/idea.gif");
    });
});

describe("animated WebP compression policy", () => {
    it("spends less bandwidth on very large or frame-heavy GIFs", () => {
        expect(animatedWebpQuality(2 * 1024 * 1024, 20)).toBe(76);
        expect(animatedWebpQuality(7 * 1024 * 1024, 20)).toBe(72);
        expect(animatedWebpQuality(2 * 1024 * 1024, 130)).toBe(68);
    });
});
