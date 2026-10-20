import { describe, expect, it } from "vitest";
import {
    MASTER_TAGGING_VERSION,
    buildMasterTagUserPrompt,
    buildVocabularyHints,
    canonicalTagKey,
    mergeProtectedTags,
    normalizeGeneratedTags,
    parseMasterTagResponse,
} from "../../src/lib/moodboard/tagging";

describe("Master Tag Builder v1.1", () => {
    it("normalizes generated tags to lowercase and known canonical aliases", () => {
        expect(normalizeGeneratedTags([
            " Woman ",
            "Shallow   Focus",
            "BNW",
            "photogrpahy",
            "woman",
            "bad,tag",
        ])).toEqual([
            "woman",
            "shallow focus",
            "black and white",
            "photography",
        ]);
    });

    it("preserves existing manual spelling and appends only new concepts", () => {
        const result = mergeProtectedTags(
            ["Woman", "BNW", "TouchDesigner"],
            ["woman", "black and white", "touch designer", "top view", "vulnerability"],
        );

        expect(result.tags).toEqual([
            "Woman",
            "BNW",
            "TouchDesigner",
            "top view",
            "vulnerability",
        ]);
        expect(result.appended).toEqual(["top view", "vulnerability"]);
    });

    it("builds a frequency-ranked compact vocabulary without changing live data", () => {
        expect(buildVocabularyHints([
            { tags: ["Woman", "Portrait"] },
            { tags: ["woman", "photogrpahy"] },
            { tags: ["Photography"] },
        ], 3)).toEqual(["photography", "woman", "portrait"]);
    });

    it("parses the one-list model contract and rejects empty responses", () => {
        const payload = {
            choices: [{ message: { content: JSON.stringify({ tags: ["Red", "Grid", "red"] }) } }],
        };
        expect(parseMasterTagResponse(payload)).toEqual(["red", "grid"]);
        expect(() => parseMasterTagResponse({ choices: [] })).toThrow(/no tags/i);
    });

    it("keeps the prompt compact, protects existing tags and rejects title dates as evidence", () => {
        const prompt = buildMasterTagUserPrompt({
            title: "film-still-1987",
            artistName: "Example Artist",
            existingTags: ["Manual Tag"],
            vocabularyHints: ["portrait", "tableau"],
        });

        expect(prompt).toContain("protected + generated");
        expect(prompt).toContain("not verified creation metadata");
        expect(prompt).toContain('"protected_existing_tags":["Manual Tag"]');
        expect(MASTER_TAGGING_VERSION).toBe("1.1.0");
        expect(canonicalTagKey("BNW")).toBe("black and white");
    });

});
