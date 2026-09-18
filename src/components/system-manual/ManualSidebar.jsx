import React, { useState, useEffect, useMemo } from "react";

function stripSectionPrefix(title) {
  if (!title) return "";
  return title
    .replace(/^#+\s*/, "")
    .replace(/^chapter\s*\d{1,2}[:\s—–-]*/i, "")
    .replace(/^\d{1,2}(?:\.\d{1,2})*(?:\.\d{1,2})*\s*[—–:\-\.]\s*/, "")
    .replace(/^[0-9.]+-/, "")
    .trim();
}

export default function ManualSidebar({ chapters, rootDocs, activeSlug: propActiveSlug }) {
  const [activeSlug, setActiveSlug] = useState(propActiveSlug || "overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState(() => {
    const initial = {};
    for (const chapter of chapters) {
      const hasActive = chapter.docs.some(
        (doc) =>
          doc.slug === (propActiveSlug || "overview") ||
          doc.fullPath === propActiveSlug ||
          propActiveSlug?.includes(doc.slug),
      );
      initial[chapter.id] = hasActive;
    }
    // If no chapter is active (e.g. on overview/index), expand chapter 00 by default
    if (!Object.values(initial).some(Boolean) && chapters.length > 0) {
      initial[chapters[0].id] = true;
    }
    return initial;
  });

  // Keep activeSlug synchronized across Astro page transitions without re-mounting
  useEffect(() => {
    const syncActiveSlug = () => {
      const path = window.location.pathname
        .replace(/^\/system-manual\/?/, "")
        .replace(/\/$/, "");
      const current = path || "overview";
      setActiveSlug(current);

      // Auto-expand the chapter containing the active document
      for (const chapter of chapters) {
        if (chapter.docs.some((d) => d.slug === current || d.fullPath === current)) {
          setExpandedChapters((prev) => ({
            ...prev,
            [chapter.id]: true,
          }));
        }
      }
    };

    syncActiveSlug();
    document.addEventListener("astro:page-load", syncActiveSlug);
    window.addEventListener("popstate", syncActiveSlug);

    return () => {
      document.removeEventListener("astro:page-load", syncActiveSlug);
      window.removeEventListener("popstate", syncActiveSlug);
    };
  }, [chapters]);

  const toggleChapter = (chapterId, e) => {
    if (e) {
      e.stopPropagation();
    }
    setExpandedChapters((prev) => {
      const willExpand = !prev[chapterId];
      if (willExpand) {
        setTimeout(() => {
          const el = document.getElementById(`chapter-accordion-${chapterId}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        }, 120);
      }
      return {
        ...prev,
        [chapterId]: willExpand,
      };
    });
  };

  const filteredChapters = useMemo(() => {
    if (!searchTerm.trim()) return chapters;
    const query = searchTerm.toLowerCase().trim();

    return chapters
      .map((chapter) => {
        const matchingDocs = chapter.docs.filter((doc) => {
          const cleanTitle = stripSectionPrefix(doc.displayTitle || doc.title);
          return (
            cleanTitle.toLowerCase().includes(query) ||
            doc.sectionNumber.includes(query) ||
            doc.slug.toLowerCase().includes(query)
          );
        });
        const chapterMatches =
          chapter.title.toLowerCase().includes(query) ||
          chapter.number.includes(query);

        return {
          ...chapter,
          docs: chapterMatches ? chapter.docs : matchingDocs,
        };
      })
      .filter((chapter) => chapter.docs.length > 0);
  }, [chapters, searchTerm]);

  return (
    <>
      {/* Tablet & Mobile Slide-Out Drawer Header */}
      <div className="manual-tablet-bar">
        <button
          type="button"
          className="manual-tablet-toggle-btn"
          onClick={() => setMobileDrawerOpen((prev) => !prev)}
          aria-expanded={mobileDrawerOpen}
        >
          <span className="manual-tablet-toggle-icon">📑</span>
          <span className="manual-tablet-toggle-text">System Manual Chapters</span>
          <span className="manual-tablet-chevron">
            {mobileDrawerOpen ? "▲ Close" : "▼ Open"}
          </span>
        </button>
      </div>

      <aside className={`manual-sidebar-column ${mobileDrawerOpen ? "mobile-open" : ""}`}>
        <div className="manual-sidebar-header">
          <div className="manual-sidebar-title-row">
            <h2 className="manual-sidebar-title">SYSTEM MANUAL</h2>
            <span className="manual-sidebar-count-pill">{chapters.length} CHAPTERS</span>
          </div>

          <div className="manual-search-box">
            <input
              type="text"
              className="manual-search-input"
              placeholder="Search chapters or topics..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <nav className="manual-nav-scroll" aria-label="System Manual Chapters">
          {filteredChapters.map((chapter) => {
            const isExpanded = searchTerm.trim()
              ? true
              : Boolean(expandedChapters[chapter.id]);
            const hasActiveDoc = chapter.docs.some(
              (doc) =>
                doc.slug === activeSlug ||
                doc.fullPath === activeSlug ||
                activeSlug === doc.slug,
            );

            return (
              <div
                key={chapter.id}
                id={`chapter-accordion-${chapter.id}`}
                className={`chapter-accordion ${isExpanded ? "expanded" : ""} ${hasActiveDoc ? "has-active" : ""}`}
              >
                <button
                  type="button"
                  className="chapter-accordion-header"
                  onClick={(e) => toggleChapter(chapter.id, e)}
                  aria-expanded={isExpanded}
                >
                  <div className="chapter-title-group">
                    <span className="chapter-num-badge">{chapter.number}</span>
                    <span className="chapter-name-text">
                      {chapter.title}
                    </span>
                  </div>

                  {/* Clean, smoothly rotating SVG chevron */}
                  <svg
                    className={`chapter-toggle-chevron ${isExpanded ? "expanded" : ""}`}
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>

                <div className="chapter-accordion-body-wrapper" aria-hidden={!isExpanded}>
                  <div className="chapter-accordion-body">
                    {chapter.docs.map((doc) => {
                      const isActive =
                        doc.slug === activeSlug ||
                        doc.fullPath === activeSlug ||
                        activeSlug === doc.slug;

                      const cleanTitle = stripSectionPrefix(
                        doc.displayTitle || doc.title,
                      );

                      return (
                        <a
                          key={doc.fullPath || doc.slug}
                          href={`/system-manual/${doc.slug}`}
                          data-astro-prefetch="hover"
                          className={`section-link ${isActive ? "active" : ""}`}
                        >
                          <span className="section-num">{doc.sectionNumber}</span>
                          <span className="section-title">{cleanTitle}</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredChapters.length === 0 && (
            <div
              style={{
                padding: "1.5rem 1rem",
                textAlign: "center",
                fontSize: "0.85rem",
                opacity: 0.8,
                color: "#15130f",
              }}
            >
              No matching chapters or sections found for "{searchTerm}".
            </div>
          )}

          {/* Dedicated bottom spacer so the last chapter is never clipped */}
          <div className="manual-nav-bottom-spacer" aria-hidden="true" />
        </nav>
      </aside>
    </>
  );
}
