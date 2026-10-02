import { describe, expect, it } from "vitest";
import {
    MOODBOARD_QUICK_ACTION_FOLDER,
    orientedImageDimensions,
    readBearerToken,
    readMoodboardRequestFields,
    resolveMoodboardImageType,
    securelyMatchesToken,
    titleFromMoodboardFilename,
} from "../../src/lib/moodboard/quickAction";

describe("Moodboard Finder Quick Action", () => {
    it("always targets the dedicated originals folder", () => {
        expect(MOODBOARD_QUICK_ACTION_FOLDER).toBe("photos/originals/moodboard");
    });

    it("accepts an exact bearer token without leaking comparison details", () => {
        const request = new Request("https://abodid.com/api/integrations/moodboard", {
            headers: { Authorization: "Bearer a-long-random-secret" },
        });
        expect(readBearerToken(request)).toBe("a-long-random-secret");
        expect(securelyMatchesToken(readBearerToken(request), "a-long-random-secret")).toBe(true);
        expect(securelyMatchesToken("wrong", "a-long-random-secret")).toBe(false);
        expect(securelyMatchesToken("", "a-long-random-secret")).toBe(false);
    });

    it("infers supported image types when Finder does not send one", () => {
        expect(resolveMoodboardImageType("Reference Photo.JPG", "")).toBe("image/jpeg");
        expect(resolveMoodboardImageType("inspiration.tiff", "image/tiff")).toBe("");
        expect(resolveMoodboardImageType("notes.txt", "image/png")).toBe("image/png");
    });

    it("accepts JSON from the browser extension and form data from Finder", async () => {
        const jsonRequest = new Request("https://abodid.com/api/integrations/moodboard/prepare", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: "reference.webp", size: 123 }),
        });
        await expect(readMoodboardRequestFields(jsonRequest)).resolves.toMatchObject({
            filename: "reference.webp",
            size: 123,
        });

        const form = new FormData();
        form.set("filename", "finder.png");
        const formRequest = new Request("https://abodid.com/api/integrations/moodboard/prepare", {
            method: "POST",
            body: form,
        });
        await expect(readMoodboardRequestFields(formRequest)).resolves.toMatchObject({
            filename: "finder.png",
        });
    });

    it("creates a useful title from the image filename", () => {
        expect(titleFromMoodboardFilename("brutalist_home--reference.webp"))
            .toBe("brutalist home reference");
    });

    it("accounts for EXIF rotation when recording dimensions", () => {
        expect(orientedImageDimensions({ width: 4032, height: 3024, orientation: 6 }))
            .toEqual({ width: 3024, height: 4032 });
        expect(orientedImageDimensions({ width: 4032, height: 3024, orientation: 1 }))
            .toEqual({ width: 4032, height: 3024 });
    });
});
