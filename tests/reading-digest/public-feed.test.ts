import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/supabaseServer", () => ({
  createSupabaseServiceClient: vi.fn(),
}));

import { createSupabaseServiceClient } from "../../src/lib/supabaseServer";
import { EXHIBITION_THUMBNAIL_COUNT, exhibitionThumbnailFor } from "../../src/lib/reading/thumbnailPool";
import {
  getPublicReadingFeed,
  groupReadings,
  istDate,
  nextDate,
  validDate,
  type PublicReading,
} from "../../src/lib/reading/publicFeed";

const reading = (id: string, date: string, display_order: number, topic_names = ["Photography"]): PublicReading => ({
  id,
  delivery_date: date,
  display_order,
  title: `Reading ${id}`,
  url: `https://example.org/${id}`,
  source_name: "Example Journal",
  publication_date: date,
  topic_names,
  why_it_matters: "A useful source for visual research.",
  editorial_note: null,
  thumbnail_url: null,
  fallback_thumbnail_url: exhibitionThumbnailFor(id),
});

describe("public reading feed", () => {
  it("assigns a stable exhibition photo from the frozen pool", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    expect(EXHIBITION_THUMBNAIL_COUNT).toBe(56);
    expect(exhibitionThumbnailFor(id)).toBe(
      "https://assets.abodid.com/photos/variants/exhibition-photos/800/rca-2023-ting-photoshoot-collab-22-d4ca79b9b1.webp",
    );
    expect(exhibitionThumbnailFor(id)).toMatch(/^https:\/\/assets\.abodid\.com\/photos\/variants\/exhibition-photos\/800\/.+\.webp$/);
    expect(new Set(Array.from({ length: 12 }, (_, index) => exhibitionThumbnailFor(`${id}-${index}`))).size).toBeGreaterThan(1);
  });

  it("uses the Kolkata calendar day and validates archive cursors", () => {
    expect(istDate(new Date("2026-09-21T20:00:00Z"))).toBe("2026-09-22");
    expect(nextDate("2026-12-31")).toBe("2027-01-01");
    expect(validDate("2026-09-22")).toBe(true);
    expect(validDate("2026-02-30")).toBe(false);
  });

  it("keeps archive groups intact and follows editorial order", () => {
    const groups = groupReadings([
      reading("second", "2026-09-21", 2),
      reading("first", "2026-09-21", 1),
    ], ["2026-09-21", "2026-09-20"]);
    expect(groups).toHaveLength(1);
    expect(groups[0].readings.map((item) => item.id)).toEqual(["first", "second"]);
  });

  it("loads today plus five archive dates, with an earlier-days cursor", async () => {
    const dates = ["2026-09-22", "2026-09-21", "2026-09-20", "2026-09-19", "2026-09-18", "2026-09-17", "2026-09-16"];
    const rows = dates.map((date) => reading(date, date, 1));
    const database = {
      rpc: vi.fn(async (name: string) => name === "reading_digest_public_days"
        ? { data: dates.map((delivery_date) => ({ delivery_date })), error: null }
        : { data: [{ name: "Photography", item_count: 7 }], error: null }),
      from: vi.fn(() => ({
        select: () => ({
          in: async (_column: string, selected: string[]) => ({
            data: rows.filter((item) => selected.includes(item.delivery_date)), error: null,
          }),
        }),
      })),
    };
    vi.mocked(createSupabaseServiceClient).mockReturnValue(database as never);

    const feed = await getPublicReadingFeed({
      now: new Date("2026-09-22T06:00:00Z"), includeTopics: true,
    });
    expect(feed.today.map((item) => item.id)).toEqual(["2026-09-22"]);
    expect(feed.archive.map((day) => day.date)).toEqual(dates.slice(1, 6));
    expect(feed.nextCursor).toBe("2026-09-17");
    expect(feed.topics).toEqual([{ name: "Photography", count: 7 }]);
    expect(feed.today[0].fallback_thumbnail_url).toBe(exhibitionThumbnailFor("2026-09-22"));
  });
});
