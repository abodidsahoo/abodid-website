import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { describe, it, expect } from "vitest";
import ResearchFilter, {
  getPaperTags,
  getPaperTagCounts,
  filterResearchPapers,
  getScrollEdges,
} from "../../src/components/ResearchFilter.jsx";

// Fixtures stay in tests; the actual page never substitutes invented papers.
const papers = [
  {
    id: "one",
    slug: "memory-study",
    title: "A study of memory",
    formatted_title: "A study of <em>memory</em>",
    tags: ["Memory", "Visual Methods"],
    description: "A short abstract.",
    explanation: "A curatorial note.",
    authors: "Original Author",
    year: 2024,
    pdf_url: "https://example.org/paper.pdf",
  },
  {
    id: "two",
    title: "Photography and place",
    tags: ["Photography", "Memory"],
    abstract: "The full abstract.",
  },
  { id: "three", title: "A paper without an abstract", tags: null },
];
const render = (props = {}) =>
  load(renderToStaticMarkup(<ResearchFilter papers={papers} {...props} />));

describe("research paper shelf", () => {
  it("shows scroll cues only while more content exists in that direction", () => {
    expect(
      getScrollEdges({ scrollTop: 0, scrollHeight: 800, clientHeight: 400 }),
    ).toEqual({ above: false, below: true });
    expect(
      getScrollEdges({ scrollTop: 200, scrollHeight: 800, clientHeight: 400 }),
    ).toEqual({ above: true, below: true });
    expect(
      getScrollEdges({ scrollTop: 400, scrollHeight: 800, clientHeight: 400 }),
    ).toEqual({ above: true, below: false });
    expect(
      getScrollEdges({ scrollTop: 0, scrollHeight: 200, clientHeight: 200 }),
    ).toEqual({ above: false, below: false });
  });
  it("wraps the tag list in an independent keyboard-accessible scroll area", () => {
    const $ = render();
    expect(
      $(".paper-browser__tag-scroll-shell .paper-browser__tag-cloud button"),
    ).toHaveLength(3);
    expect($(".paper-browser__tag-scroll").attr("tabindex")).toBe("0");
    expect($(".paper-browser__tag-scroll").attr("aria-label")).toBe(
      "Scrollable paper tags",
    );
  });
  it("counts each topic once per paper and ignores invalid values", () => {
    expect(
      getPaperTags({ tags: [" Memory ", "Memory", null, 42, ""] }),
    ).toEqual(["Memory"]);
    expect(getPaperTags({ tags: "Photography" })).toEqual(["Photography"]);
    expect(getPaperTagCounts(papers)[0]).toEqual(["Memory", 2]);
  });
  it("keeps every tag accessible beyond the old twenty-tag limit", () => {
    const manyTopics = [
      {
        ...papers[0],
        tags: Array.from({ length: 30 }, (_, index) => `Topic ${index}`),
      },
    ];
    const $ = render({ papers: manyTopics });
    expect($(".paper-browser__tag-cloud button")).toHaveLength(30);
    expect(getPaperTagCounts(manyTopics)).toHaveLength(30);
  });
  it("filters slugged and mixed-case tag links, and restores all papers", () => {
    expect(filterResearchPapers(papers, "visual-methods")).toEqual([papers[0]]);
    expect(filterResearchPapers(papers, "mEmOrY")).toHaveLength(2);
    expect(filterResearchPapers(papers, "All")).toEqual(papers);
  });
  it("renders the selected URL tag on the server before hydration", () => {
    const $ = render({ initialTag: "visual-methods" });
    expect($(".paper-entry")).toHaveLength(1);
    expect($("#paper-list-heading").text()).toBe("Visual Methods");
    expect(
      $('.paper-browser__tag-cloud button[aria-pressed="true"]').text(),
    ).toContain("Visual Methods");
  });
  it("preserves original attribution and formatted titles, with plain View PDF links", () => {
    const $ = render();
    expect($(".paper-entry__title em").text()).toBe("memory");
    expect($(".paper-entry__attribution").text()).toContain(
      "Original Author · 2024",
    );
    expect($(".paper-entry__pdf").attr("href")).toBe(
      "https://example.org/paper.pdf",
    );
    expect($(".paper-entry__pdf").attr("rel")).toContain("noopener");
    expect($(".paper-entry__pdf").text().trim()).toBe("View PDF");
    expect($(".paper-entry__pdf span")).toHaveLength(0);
    expect($(".paper-entry__heading > .paper-entry__pdf")).toHaveLength(1);
  });
  it("uses titles as accessible abstract toggles, with abstracts initially hidden", () => {
    const $ = render();
    const toggles = $('.paper-entry__title button[aria-expanded="false"]');
    expect(toggles).toHaveLength(2);
    expect($(".paper-entry__abstract-copy[hidden]")).toHaveLength(2);
    expect(toggles.first().attr("aria-controls")).toBe(
      $(".paper-entry__abstract-copy").first().attr("id"),
    );
    expect(toggles.first().attr("aria-controls")).not.toBe(
      toggles.last().attr("aria-controls"),
    );
    expect($(".paper-entry__abstract-copy").first().text()).toContain(
      "A short abstract.",
    );
    expect($(".paper-entry__abstract-copy").first().text()).toContain(
      "A curatorial note.",
    );
    expect($(".paper-entry__abstract-copy").last().text()).toContain(
      "The full abstract.",
    );
    expect($(".paper-entry").last().find("button")).toHaveLength(0);
  });
  it("removes repeated paper tags, helper copy, arrows and abstract controls", () => {
    const $ = render();
    expect(
      $(".paper-entry__tags, .paper-entry__arrow, .paper-entry__toggle"),
    ).toHaveLength(0);
    expect($(".paper-browser__topics-intro")).toHaveLength(0);
    expect($(".paper-entry").text()).not.toContain("Read abstract");
    expect($(".paper-entry").text()).not.toContain("Hide abstract");
    expect($(".paper-entry").text()).not.toContain("↗");
    expect($(".paper-browser__tag-cloud button")).toHaveLength(3);
  });
  it("retains all papers in one focusable scroll region instead of cutting off records", () => {
    const manyPapers = Array.from({ length: 60 }, (_, index) => ({
      ...papers[0],
      id: `paper-${index}`,
    }));
    const $ = render({ papers: manyPapers });
    expect($(".paper-browser__scroll .paper-entry")).toHaveLength(60);
    expect($(".paper-browser__scroll").attr("tabindex")).toBe("0");
    expect($(".paper-browser__scroll").attr("aria-describedby")).toBe(
      "paper-scroll-hint",
    );
  });
  it("distinguishes an empty collection from a tag with no matches", () => {
    const empty = render({ papers: [] });
    expect(empty(".paper-browser__empty").text()).toContain(
      "The shelf is being curated.",
    );
    expect(empty(".paper-entry")).toHaveLength(0);
    const unmatched = render({ initialTag: "unknown-topic" });
    expect(unmatched(".paper-browser__empty").text()).toContain(
      "No papers with this tag yet.",
    );
    expect(unmatched(".paper-browser__empty button").text()).toContain(
      "Show all papers",
    );
  });
});
