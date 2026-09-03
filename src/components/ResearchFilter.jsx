import React, { useState, useMemo, useEffect, useRef, useId } from "react";
import "../styles/research-papers.css";

export const slugifyPaperTag = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const getPaperTags = (paper) => [
  ...new Set(
    (Array.isArray(paper.tags) ? paper.tags : [paper.tags])
      .filter((tag) => typeof tag === "string" && tag.trim())
      .map((tag) => tag.trim()),
  ),
];

export const getPaperTagCounts = (papers) => {
  const counts = new Map();
  papers.forEach((paper) =>
    getPaperTags(paper).forEach((tag) => {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }),
  );
  return [...counts].sort(
    ([a, aCount], [b, bCount]) => bCount - aCount || a.localeCompare(b),
  );
};

export const filterResearchPapers = (papers, tag) =>
  tag === "All"
    ? papers
    : papers.filter((paper) =>
        getPaperTags(paper).some(
          (value) => slugifyPaperTag(value) === slugifyPaperTag(tag),
        ),
      );

export const getScrollEdges = ({ scrollTop, scrollHeight, clientHeight }) => ({
  above: scrollTop > 2,
  below: scrollHeight - clientHeight - scrollTop > 2,
});

const getPaperAttribution = (paper) => {
  const authors =
    paper.authors ||
    (Array.isArray(paper.authors_json)
      ? paper.authors_json
          .map((author) => (typeof author === "string" ? author : author?.name))
          .filter(Boolean)
          .join(", ")
      : "");
  return [
    authors,
    paper.publication || paper.journal,
    paper.published_year || paper.year,
  ]
    .filter(Boolean)
    .join(" · ");
};

const PaperEntry = ({ paper, index }) => {
  const [expanded, setExpanded] = useState(false);
  const abstractId = useId();
  const attribution = getPaperAttribution(paper);
  const abstract = paper.abstract || paper.description;
  const hasAbstract = Boolean(abstract || paper.explanation);
  const title = (
    <span
      dangerouslySetInnerHTML={{ __html: paper.formatted_title || paper.title }}
    />
  );

  return (
    <li className="paper-entry">
      <div className="paper-entry__heading">
        <span className="paper-entry__number" aria-hidden="true">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div>
          <h3 className="paper-entry__title">
            {hasAbstract ? (
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={abstractId}
                onClick={() => setExpanded((value) => !value)}
              >
                {title}
              </button>
            ) : (
              title
            )}
          </h3>
          {attribution && (
            <p className="paper-entry__attribution">{attribution}</p>
          )}
        </div>
        {paper.pdf_url && (
          <a
            className="paper-entry__pdf"
            href={paper.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View PDF: ${paper.title} (new tab)`}
          >
            View PDF
          </a>
        )}
      </div>
      {hasAbstract && (
        <div
          id={abstractId}
          className="paper-entry__abstract-copy"
          hidden={!expanded}
        >
          {abstract && <p>{abstract}</p>}
          {paper.explanation && paper.explanation !== abstract && (
            <p>{paper.explanation}</p>
          )}
        </div>
      )}
    </li>
  );
};

const ResearchFilter = ({ papers = [], initialTag = "All" }) => {
  const [activeTag, setActiveTag] = useState(initialTag);
  const [scrollEdges, setScrollEdges] = useState({
    above: false,
    below: false,
  });
  const [tagScrollEdges, setTagScrollEdges] = useState({
    above: false,
    below: false,
  });
  const scrollRef = useRef(null);
  const listRef = useRef(null);
  const tagScrollRef = useRef(null);
  const tagListRef = useRef(null);
  const sortedTags = useMemo(() => getPaperTagCounts(papers), [papers]);
  const normalizedActiveTag =
    activeTag === "All"
      ? "All"
      : sortedTags.find(
          ([tag]) => slugifyPaperTag(tag) === slugifyPaperTag(activeTag),
        )?.[0] || activeTag;
  const filteredPapers = useMemo(
    () => filterResearchPapers(papers, normalizedActiveTag),
    [papers, normalizedActiveTag],
  );

  useEffect(() => {
    const syncLocation = () => {
      const params = new URLSearchParams(window.location.search);
      setActiveTag(params.get("tag") || params.get("category") || "All");
    };
    syncLocation();
    window.addEventListener("popstate", syncLocation);
    return () => window.removeEventListener("popstate", syncLocation);
  }, []);

  useEffect(() => {
    const scroller = scrollRef.current;
    const list = listRef.current;
    if (!scroller || !list) return;
    scroller.scrollTop = 0;
    const updateEdges = () => setScrollEdges(getScrollEdges(scroller));
    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(scroller);
    observer.observe(list);
    scroller.addEventListener("scroll", updateEdges, { passive: true });
    return () => {
      observer.disconnect();
      scroller.removeEventListener("scroll", updateEdges);
    };
  }, [filteredPapers]);

  useEffect(() => {
    const scroller = tagScrollRef.current;
    const list = tagListRef.current;
    if (!scroller || !list) return;
    const updateEdges = () => setTagScrollEdges(getScrollEdges(scroller));
    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(scroller);
    observer.observe(list);
    scroller.addEventListener("scroll", updateEdges, { passive: true });
    return () => {
      observer.disconnect();
      scroller.removeEventListener("scroll", updateEdges);
    };
  }, [sortedTags]);

  const handleTagClick = (tag) => {
    const nextTag = normalizedActiveTag === tag ? "All" : tag;
    setActiveTag(nextTag);
    const url = new URL(window.location.href);
    url.searchParams.delete("category");
    if (nextTag === "All") url.searchParams.delete("tag");
    else url.searchParams.set("tag", slugifyPaperTag(nextTag));
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const scrollMore = (ref) => {
    const scroller = ref.current;
    scroller?.scrollBy({
      top: scroller.clientHeight * 0.75,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  };

  return (
    <div className="paper-browser">
      <section
        className="paper-browser__papers"
        aria-labelledby="paper-list-heading"
      >
        <header className="paper-browser__topline">
          <div>
            <p className="paper-browser__eyebrow">The reading shelf</p>
            <h2 id="paper-list-heading">
              {normalizedActiveTag === "All"
                ? "All papers"
                : normalizedActiveTag}
            </h2>
          </div>
          <span
            className="paper-browser__count"
            role="status"
            aria-live="polite"
          >
            {filteredPapers.length}{" "}
            {filteredPapers.length === 1 ? "paper" : "papers"}
          </span>
        </header>
        <div
          className="paper-browser__scroll-shell"
          data-more-above={scrollEdges.above}
          data-more-below={scrollEdges.below}
        >
          <div
            className="paper-browser__scroll"
            ref={scrollRef}
            tabIndex={0}
            role="region"
            aria-label="Scrollable research papers"
            aria-describedby="paper-scroll-hint"
          >
            <ul className="paper-browser__list" ref={listRef}>
              {filteredPapers.length === 0 && (
                <li className="paper-browser__empty">
                  <h3>
                    {papers.length === 0
                      ? "The shelf is being curated."
                      : "No papers with this tag yet."}
                  </h3>
                  <p>
                    {papers.length === 0
                      ? "New papers will appear here as they are added to the collection."
                      : "Choose another topic or return to the full collection."}
                  </p>
                  {papers.length > 0 && (
                    <button type="button" onClick={() => handleTagClick("All")}>
                      Show all papers <span aria-hidden="true">→</span>
                    </button>
                  )}
                </li>
              )}
              {filteredPapers.map((paper, index) => (
                <PaperEntry
                  key={paper.id || paper.slug || paper.title}
                  paper={paper}
                  index={index}
                />
              ))}
            </ul>
          </div>
        </div>
        <footer className="paper-browser__scroll-footer">
          <p id="paper-scroll-hint">
            {scrollEdges.below
              ? "Scroll within the shelf for more papers"
              : scrollEdges.above
                ? "You’ve reached the end of this shelf"
                : "Select a title to read its abstract"}
          </p>
          <button
            type="button"
            onClick={() => scrollMore(scrollRef)}
            disabled={!scrollEdges.below}
            aria-label="Scroll to more papers"
          >
            ↓
          </button>
        </footer>
      </section>
      <aside
        className="paper-browser__topics"
        aria-labelledby="paper-tags-heading"
      >
        <header className="paper-browser__topline">
          <div>
            <p className="paper-browser__eyebrow">Follow a thread</p>
            <h2 id="paper-tags-heading">Tags</h2>
          </div>
          <span className="paper-browser__count">
            {sortedTags.length} topics
          </span>
        </header>
        <button
          type="button"
          className="paper-browser__all"
          aria-pressed={normalizedActiveTag === "All"}
          onClick={() => handleTagClick("All")}
        >
          <span>All papers</span>
          <span>{papers.length}</span>
          <span aria-hidden="true">
            {normalizedActiveTag === "All" ? "✓" : "↗"}
          </span>
        </button>
        <div
          className="paper-browser__tag-scroll-shell"
          data-more-above={tagScrollEdges.above}
          data-more-below={tagScrollEdges.below}
        >
          <div
            className="paper-browser__tag-scroll"
            ref={tagScrollRef}
            tabIndex={0}
            role="region"
            aria-label="Scrollable paper tags"
          >
            <div className="paper-browser__tag-cloud" ref={tagListRef}>
              {sortedTags.map(([tag, count]) => (
                <button
                  type="button"
                  key={tag}
                  aria-pressed={normalizedActiveTag === tag}
                  onClick={() => handleTagClick(tag)}
                >
                  {normalizedActiveTag === tag && (
                    <span aria-hidden="true">✓ </span>
                  )}
                  <span>{tag}</span>
                  <span className="paper-browser__tag-count">{count}</span>
                </button>
              ))}
              {sortedTags.length === 0 && (
                <p>Topics will appear as papers are added.</p>
              )}
            </div>
          </div>
        </div>
        {(tagScrollEdges.above || tagScrollEdges.below) && (
          <button
            type="button"
            className="paper-browser__tag-scroll-hint"
            onClick={() => scrollMore(tagScrollRef)}
            disabled={!tagScrollEdges.below}
            aria-label={
              tagScrollEdges.below ? "Scroll to more tags" : "All tags shown"
            }
          >
            {tagScrollEdges.below ? (
              <>
                Scroll for more tags <span aria-hidden="true">↓</span>
              </>
            ) : (
              "All tags shown"
            )}
          </button>
        )}
        <p className="paper-browser__topics-note">
          A collection of other people’s research, connected by curiosity.
        </p>
      </aside>
    </div>
  );
};

export default ResearchFilter;
