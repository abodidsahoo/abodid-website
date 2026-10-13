import { describe, expect, it } from "vitest";
import { resolveMediaVariantProcessor } from "../../src/lib/media/variantProcessor";

describe("media variant processor", () => {
    it("uses Cloudflare by default", () => {
        expect(resolveMediaVariantProcessor(undefined)).toBe("cloudflare");
        expect(resolveMediaVariantProcessor("")).toBe("cloudflare");
        expect(resolveMediaVariantProcessor("unexpected")).toBe("cloudflare");
    });

    it("allows Vercel only as an explicit fallback", () => {
        expect(resolveMediaVariantProcessor("vercel")).toBe("vercel");
        expect(resolveMediaVariantProcessor(" VERCEL ")).toBe("vercel");
    });
});
