import React, { useState, useEffect, useRef, useMemo } from "react";

function stripSectionPrefix(title) {
  if (!title) return "";
  return title
    .replace(/^#+\s*/, "")
    .replace(/^chapter\s*\d{1,2}[:\s—–-]*/i, "")
    .replace(/^\d{1,2}(?:\.\d{1,2})*(?:\.\d{1,2})*\s*[—–:\-\.]\s*/, "")
    .replace(/^[0-9.]+-/, "")
    .trim();
}

export default function ManualTopNav({ chapters, rootDocs, activeSlug, currentDoc }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef(null);

  // Close on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Find active doc display label
  const activeLabel = useMemo(() => {
    if (!activeSlug || activeSlug === "overview") return "Overview (README)";
    if (activeSlug === "index") return "Index & Directory";
    if (activeSlug === "glossary") return "Glossary & Lexicon";
    if (activeSlug === "changelog") return "Changelog & History";

    for (const chapter of chapters) {
      for (const doc of chapter.docs) {
        if (doc.slug === activeSlug || doc.fullPath === activeSlug) {
          const cleanTitle = stripSectionPrefix(doc.displayTitle || doc.title);
          return `${doc.sectionNumber} — ${cleanTitle}`;
        }
      }
    }
    return currentDoc?.title || "Jump to chapter or topic...";
  }, [activeSlug, chapters, currentDoc]);

  // Filter items based on searchQuery
  const filteredData = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) {
      return {
        rootDocs: [
          { slug: "", label: "Overview (README)", path: "/system-manual" },
          { slug: "index", label: "Index & Directory", path: "/system-manual/index" },
          { slug: "glossary", label: "Glossary & Lexicon", path: "/system-manual/glossary" },
          { slug: "changelog", label: "Changelog & History", path: "/system-manual/changelog" },
        ],
        chapters,
      };
    }

    const filteredRoot = [
      { slug: "", label: "Overview (README)", path: "/system-manual" },
      { slug: "index", label: "Index & Directory", path: "/system-manual/index" },
      { slug: "glossary", label: "Glossary & Lexicon", path: "/system-manual/glossary" },
      { slug: "changelog", label: "Changelog & History", path: "/system-manual/changelog" },
    ].filter((d) => d.label.toLowerCase().includes(q));

    const filteredChapters = chapters
      .map((ch) => {
        const matchingDocs = ch.docs.filter((doc) => {
          const clean = stripSectionPrefix(doc.displayTitle || doc.title);
          return (
            clean.toLowerCase().includes(q) ||
            doc.sectionNumber.includes(q) ||
            doc.slug.toLowerCase().includes(q)
          );
        });
        const chMatch = ch.title.toLowerCase().includes(q) || ch.number.includes(q);
        if (chMatch || matchingDocs.length > 0) {
          return {
            ...ch,
            docs: chMatch ? ch.docs : matchingDocs,
          };
        }
        return null;
      })
      .filter(Boolean);

    return { rootDocs: filteredRoot, chapters: filteredChapters };
  }, [chapters, searchQuery]);

  return (
    <header className="manual-top-bar" aria-label="System Manual Header Navigation">
      <div className="manual-top-bar-inner">
        {/* Left: Brand + Badge */}
        <div className="manual-top-left">
          <a href="/system-manual" className="manual-top-brand">
            <span className="manual-top-brand-icon">📚</span>
            <span className="manual-top-brand-title">ABODID SYSTEM MANUAL</span>
          </a>
          <span className="manual-top-version-badge">v1.0.0</span>
        </div>

        {/* Center: Custom Pop Editorial Jump-To Dropdown */}
        <div className="manual-top-chapter-selector" ref={dropdownRef}>
          <button
            type="button"
            className={`manual-select-trigger-btn ${isOpen ? "open" : ""}`}
            onClick={() => setIsOpen((prev) => !prev)}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
          >
            <span className="manual-select-prefix">Jump to:</span>
            <span className="manual-select-current-text">{activeLabel}</span>
            <svg
              className={`manual-select-chevron ${isOpen ? "open" : ""}`}
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
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {/* Custom Pop Editorial Dropdown Menu */}
          {isOpen && (
            <div className="manual-pop-dropdown-panel" role="listbox">
              <div className="manual-dropdown-search-box">
                <input
                  type="text"
                  className="manual-dropdown-search-input"
                  placeholder="Quick search all 48 topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="manual-dropdown-scroll-list">
                {/* Core Documents Group */}
                {filteredData.rootDocs.length > 0 && (
                  <div className="manual-dropdown-group">
                    <div className="manual-dropdown-group-header">
                      <span>Core Documents</span>
                    </div>
                    {filteredData.rootDocs.map((item) => {
                      const isActive =
                        (item.slug === "" && (activeSlug === "overview" || !activeSlug)) ||
                        activeSlug === item.slug;
                      return (
                        <a
                          key={item.path}
                          href={item.path}
                          data-astro-prefetch="hover"
                          className={`manual-dropdown-item ${isActive ? "active" : ""}`}
                          onClick={() => setIsOpen(false)}
                        >
                          <span className="manual-item-title">{item.label}</span>
                          {isActive && <span className="manual-item-active-check">✓</span>}
                        </a>
                      );
                    })}
                  </div>
                )}

                {/* Chapter Groups */}
                {filteredData.chapters.map((chapter) => (
                  <div key={chapter.id} className="manual-dropdown-group">
                    <div className="manual-dropdown-group-header">
                      <span>Chapter {chapter.number}: {chapter.title}</span>
                    </div>
                    {chapter.docs.map((doc) => {
                      const cleanTitle = stripSectionPrefix(
                        doc.displayTitle || doc.title,
                      );
                      const isActive =
                        doc.slug === activeSlug ||
                        doc.fullPath === activeSlug ||
                        activeSlug === doc.slug;
                      return (
                        <a
                          key={doc.fullPath || doc.slug}
                          href={`/system-manual/${doc.slug}`}
                          data-astro-prefetch="hover"
                          className={`manual-dropdown-item ${isActive ? "active" : ""}`}
                          onClick={() => setIsOpen(false)}
                        >
                          <span className="manual-item-num">{doc.sectionNumber}</span>
                          <span className="manual-item-title">{cleanTitle}</span>
                          {isActive && <span className="manual-item-active-check">✓</span>}
                        </a>
                      );
                    })}
                  </div>
                ))}

                {filteredData.rootDocs.length === 0 && filteredData.chapters.length === 0 && (
                  <div className="manual-dropdown-empty">
                    No matching chapters or topics found for "{searchQuery}".
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Quick Tab Links */}
        <nav className="manual-top-tabs" aria-label="Quick Links">
          <a
            href="/system-manual"
            data-astro-prefetch="hover"
            className={`manual-top-tab-btn ${activeSlug === "overview" || !activeSlug ? "active" : ""}`}
          >
            Overview
          </a>
          <a
            href="/system-manual/index"
            data-astro-prefetch="hover"
            className={`manual-top-tab-btn ${activeSlug === "index" ? "active" : ""}`}
          >
            Index
          </a>
          <a
            href="/system-manual/glossary"
            data-astro-prefetch="hover"
            className={`manual-top-tab-btn ${activeSlug === "glossary" ? "active" : ""}`}
          >
            Glossary
          </a>
          <a
            href="/system-manual/changelog"
            data-astro-prefetch="hover"
            className={`manual-top-tab-btn ${activeSlug === "changelog" ? "active" : ""}`}
          >
            Log
          </a>
        </nav>
      </div>
    </header>
  );
}
