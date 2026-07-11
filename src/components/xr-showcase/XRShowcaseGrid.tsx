import { useMemo, useState } from "react";
import type { XRShowcaseItem } from "../../data/xr-showcase";
import XRShowcaseCard from "./XRShowcaseCard";

type SortMode = "curated" | "az" | "source";

type Props = {
  items: XRShowcaseItem[];
  filters: readonly string[];
};

const filterMatches = (item: XRShowcaseItem, filter: string) => {
  if (filter === "All") return true;
  if (filter === "Creative Concepts") {
    return item.primaryGenre === "Creative Concept" || item.tags.includes("Creative Concept");
  }

  return item.primaryGenre === filter || item.tags.includes(filter);
};

const normalize = (value = "") => value.toLowerCase().trim();

export default function XRShowcaseGrid({ items, filters }: Props) {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [sortMode, setSortMode] = useState<SortMode>("curated");

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalize(query);
    const matchingItems = items.filter((item) => {
      const searchText = normalize(
        [
          item.title,
          item.description,
          item.primaryGenre,
          item.tags.join(" "),
          item.source,
          item.domain,
        ].join(" "),
      );

      return filterMatches(item, activeFilter) && searchText.includes(normalizedQuery);
    });

    if (sortMode === "az") {
      return [...matchingItems].sort((a, b) => a.title.localeCompare(b.title));
    }

    if (sortMode === "source") {
      return [...matchingItems].sort((a, b) =>
        (a.source || a.domain || "").localeCompare(b.source || b.domain || ""),
      );
    }

    return matchingItems;
  }, [activeFilter, items, query, sortMode]);

  const hasActiveFilters = query.length > 0 || activeFilter !== "All" || sortMode !== "curated";

  const resetFilters = () => {
    setQuery("");
    setActiveFilter("All");
    setSortMode("curated");
  };

  return (
    <section className="xr-showcase" aria-label="XR showcase resources">
      <div className="xr-controls">
        <label className="xr-search">
          <span className="sr-only">Search XR references</span>
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="m21 21-4.8-4.8m2.3-5.7a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
          </svg>
          <input
            type="search"
            value={query}
            placeholder="Search title, source, genre, tags..."
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <label className="xr-sort">
          <span>Sort</span>
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
            <option value="curated">Curated order</option>
            <option value="az">A-Z</option>
            <option value="source">Source</option>
          </select>
        </label>
      </div>

      <div className="xr-filter-row" aria-label="Filter XR references">
        {filters.map((filter) => (
          <button
            type="button"
            className={filter === activeFilter ? "xr-chip xr-chip--active" : "xr-chip"}
            aria-pressed={filter === activeFilter}
            key={filter}
            onClick={() => setActiveFilter(filter)}
          >
            {filter}
          </button>
        ))}
        {hasActiveFilters && (
          <button type="button" className="xr-reset" onClick={resetFilters}>
            Reset
          </button>
        )}
      </div>

      <div className="xr-result-count" aria-live="polite">
        {filteredItems.length} {filteredItems.length === 1 ? "reference" : "references"}
      </div>

      {filteredItems.length > 0 ? (
        <div className="xr-grid">
          {filteredItems.map((item, index) => (
            <XRShowcaseCard item={item} index={index} key={item.id} />
          ))}
        </div>
      ) : (
        <p className="xr-empty">No references match these filters yet.</p>
      )}
    </section>
  );
}
