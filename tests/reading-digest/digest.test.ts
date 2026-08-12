import { describe, expect, it } from "vitest";
import {
  canonicalizeUrl,
  discoveryTooling,
  domainMatches,
  filterTopicsForDay,
  limitWords,
  renderDigestHtml,
  selectExactlyFive,
  shouldDeliverToday,
  titleSimilarity,
  type VerifiedDigestCandidate,
  wordCount,
} from "../../supabase/functions/_shared/reading-digest";

const candidate = (
  index: number,
  overrides: Partial<VerifiedDigestCandidate> = {},
): VerifiedDigestCandidate => ({
  title: `Reading number ${index}`,
  source_name: "Trusted Museum",
  publication_date: "2026-08-01",
  estimated_reading_minutes: 8,
  url: `https://museum.example/readings/${index}`,
  why_it_matters:
    "Connects cultural research with Abodid's spatial and participatory practice.",
  topic_names: ["Museums"],
  relevance_score: 90 - index,
  credibility_score: 90,
  is_foundational: index === 1,
  canonical_url: `https://museum.example/readings/${index}`,
  source_domain: "museum.example",
  normalized_title: `reading number ${index}`,
  rank_score: 100 - index,
  verification_status: "verified",
  http_status: 200,
  content_type: "text/html",
  ...overrides,
});

describe("reading digest URL controls", () => {
  it("enables hosted web search for OpenRouter discovery", () => {
    expect(discoveryTooling("openrouter")).toMatchObject({
      tools: [{
        type: "openrouter:web_search",
        parameters: {
          max_results: 8,
          max_total_results: 24,
          max_uses: 4,
        },
      }],
    });
  });

  it("enables native web search for direct OpenAI discovery", () => {
    expect(discoveryTooling("openai")).toMatchObject({
      tools: [{ type: "web_search" }],
    });
  });

  it("canonicalizes tracking URLs before deduplication", () => {
    expect(
      canonicalizeUrl("http://WWW.Example.org/story/?utm_source=x&b=2&a=1#top"),
    ).toBe(
      "https://example.org/story?a=1&b=2",
    );
  });

  it("matches a source rule to its subdomains but not lookalikes", () => {
    expect(domainMatches("journal.mit.edu", "mit.edu")).toBe(true);
    expect(domainMatches("notmit.edu.example", "mit.edu")).toBe(false);
  });

  it("recognizes near-duplicate titles", () => {
    expect(
      titleSimilarity("Museums in the Age of AI", "Museums in an Age of A.I."),
    ).toBeGreaterThan(0.7);
  });
});

describe("reading digest editorial rules", () => {
  it("limits why-it-matters copy to one sentence and twenty words", () => {
    const limited = limitWords(
      "This very useful reading connects Abodid's immersive practice to difficult questions about memory, institutions, publics, archives, and cultural power today. Another sentence.",
    );
    expect(wordCount(limited)).toBeLessThanOrEqual(20);
    expect(limited).not.toContain("Another sentence");
  });

  it("selects top five verified items", () => {
    const selected = selectExactlyFive(
      Array.from({ length: 8 }, (_, index) => candidate(index + 1)),
    );
    expect(selected).toHaveLength(5);
  });

  it("renders five items and ends with the read-first recommendation", () => {
    const selected = selectExactlyFive(
      Array.from({ length: 5 }, (_, index) => candidate(index + 1)),
    );
    const html = renderDigestHtml({
      items: selected,
      recipientName: "Abodid",
      digestDate: "2026-08-04",
    });
    expect(html.match(/Read Article →/g) ?? []).toHaveLength(5);
    expect(html).toContain("Read first today");
    expect(html.lastIndexOf(selected[0].title)).toBeGreaterThan(
      html.lastIndexOf("Read first today"),
    );
  });

  it("partitions topic clusters day-wise across a 7-day week", () => {
    const topics = Array.from({ length: 14 }, (_, i) => ({ name: `Topic ${i + 1}` }));
    const monday = new Date("2026-08-03T00:00:00Z"); // Day 1
    const tuesday = new Date("2026-08-04T00:00:00Z"); // Day 2
    const monFiltered = filterTopicsForDay(topics, monday);
    const tueFiltered = filterTopicsForDay(topics, tuesday);
    expect(monFiltered).toHaveLength(2);
    expect(tueFiltered).toHaveLength(2);
    expect(monFiltered[0].name).toBe("Topic 2");
    expect(tueFiltered[0].name).toBe("Topic 3");
  });
});

describe("delivery frequency", () => {
  const monday = new Date("2026-08-03T00:00:00Z");
  const sunday = new Date("2026-08-02T00:00:00Z");

  it("handles daily, weekday, weekly and paused schedules", () => {
    expect(shouldDeliverToday("daily", 1, sunday)).toBe(true);
    expect(shouldDeliverToday("weekdays", 1, monday)).toBe(true);
    expect(shouldDeliverToday("weekdays", 1, sunday)).toBe(false);
    expect(shouldDeliverToday("weekly", 1, monday)).toBe(true);
    expect(shouldDeliverToday("paused", 1, monday)).toBe(false);
  });
});
