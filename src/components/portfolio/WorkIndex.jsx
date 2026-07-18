import { useEffect, useMemo, useState } from "react";
import { slugify } from "../../lib/portfolio/schema";
import { getOptimizedImageSrcSet, getOptimizedImageUrl } from "../../lib/imageOptimization.js";
import "../../styles/portfolio.css";

const PUBLIC_ORDER_CHANNEL = "portfolio-public-order";

const applyPublicOrder = (projects, ids) => {
  if (!Array.isArray(ids) || !ids.length) return projects;
  const positions = new Map(ids.map((id, index) => [id, index]));
  return [...projects].sort((left, right) => (positions.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (positions.get(right.id) ?? Number.MAX_SAFE_INTEGER));
};

const permanentCoverSources = (project) => {
  const variants = project.coverMedia?.variants || {};
  const available = [variants["800"], variants["1600"]]
    .filter((variant) => variant?.url)
    .sort((left, right) => Number(left.width || left.targetWidth) - Number(right.width || right.targetWidth));
  if (!available.length) return null;
  return {
    src: available.at(-1).url,
    srcSet: available.map((variant) => `${variant.url} ${variant.width || variant.targetWidth}w`).join(", "),
  };
};

const yearLabel = (card) => card.yearStart;

export default function WorkIndex({ projects = [] }) {
  const [orderedProjects, setOrderedProjects] = useState(projects);
  const [activeTag, setActiveTag] = useState(() => {
    if (typeof window === "undefined") return "All";
    const params = new URLSearchParams(window.location.search);
    const tagParam = params.get("tag") || params.get("terms") || params.get("genre") || params.get("role") || params.get("project_type");
    return tagParam || "All";
  });

  useEffect(() => setOrderedProjects(projects), [projects]);

  useEffect(() => {
    const receiveOrder = (ids) => setOrderedProjects((current) => applyPublicOrder(current, ids));
    const handleStorage = (event) => {
      if (event.key !== PUBLIC_ORDER_CHANNEL || !event.newValue) return;
      try { receiveOrder(JSON.parse(event.newValue).ids); } catch { /* Ignore malformed external storage values. */ }
    };
    const channel = "BroadcastChannel" in window ? new BroadcastChannel(PUBLIC_ORDER_CHANNEL) : null;
    if (channel) channel.onmessage = (event) => receiveOrder(event.data?.ids);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      channel?.close();
    };
  }, []);

  useEffect(() => {
    const sync = () => {
      const params = new URLSearchParams(window.location.search);
      const tagParam = params.get("tag") || params.get("terms") || params.get("genre") || params.get("role") || params.get("project_type");
      setActiveTag(tagParam || "All");
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  // Extract, count and sort unique taxonomy terms across all published projects
  const categories = useMemo(() => {
    const counts = {};
    orderedProjects.forEach((project) => {
      (project.taxonomies || []).forEach((term) => {
        const label = term.label?.trim();
        if (label) {
          counts[label] = (counts[label] || 0) + 1;
        }
      });
    });

    const sorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
    return ["All", ...sorted];
  }, [orderedProjects]);

  const normalizedActiveTag = useMemo(() => {
    if (activeTag === "All") return "All";
    const match = categories.find((cat) => cat.toLowerCase() === activeTag.toLowerCase() || slugify(cat) === slugify(activeTag));
    return match || activeTag;
  }, [categories, activeTag]);

  const handleTagClick = (category) => {
    const nextTag = normalizedActiveTag === category ? "All" : category;
    setActiveTag(nextTag);
    const params = new URLSearchParams();
    if (nextTag !== "All") {
      params.set("tag", slugify(nextTag));
    }
    const query = params.toString();
    window.history.pushState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  };

  const filtered = useMemo(() => {
    if (normalizedActiveTag === "All") return orderedProjects;
    const targetSlug = slugify(normalizedActiveTag);
    return orderedProjects.filter((project) => {
      return (project.taxonomies || []).some(
        (term) => term.label === normalizedActiveTag || term.slug === targetSlug || slugify(term.label || "") === targetSlug
      );
    });
  }, [orderedProjects, normalizedActiveTag]);

  return (
    <div className="work-index-app">
      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filter-scroll">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => handleTagClick(category)}
              className={`filter-btn ${normalizedActiveTag === category ? "contrast-active" : ""}`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="work-card-grid">
          {filtered.map((project) => {
            const permanentCover = permanentCoverSources(project);
            return (
              <article className="work-card" key={project.id || project.slug}>
                <a href={`/work/${project.slug}`} className="work-card-image">
                  {project.coverUrl && (
                    <img
                      src={permanentCover?.src || getOptimizedImageUrl(project.coverUrl, { width: 1200, quality: 74 })}
                      srcSet={permanentCover?.srcSet || getOptimizedImageSrcSet(project.coverUrl, { widths: [480, 800, 1200], quality: 74 })}
                      sizes="(max-width: 760px) calc(100vw - 36px), 50vw"
                      alt={project.coverAlt || ""}
                      loading="lazy"
                      decoding="async"
                      width="1200"
                      height="900"
                      style={{ objectPosition: `${project.coverFocalX ?? 50}% ${project.coverFocalY ?? 50}%` }}
                    />
                  )}
                </a>
                <div className="work-card-body">
                  <div className="work-card-meta">
                    <span>{yearLabel(project)}</span>
                    {project.workInProgress && <span className="portfolio-wip">Work in progress</span>}
                  </div>
                  <h2><a href={`/work/${project.slug}`}>{project.title}</a></h2>
                  <p>{project.oneLineDescription}</p>
                  
                  {project.organisations?.length > 0 && (
                    <p className="work-card-organisation">{project.organisations.map((org) => org.name).join(", ")}</p>
                  )}

                  {(() => {
                    const roles = project.taxonomies?.filter((t) => t.groupType === "role" || t.group_type === "role");
                    const themes = project.taxonomies?.filter((t) => t.groupType === "genre" || t.group_type === "genre" || t.groupType === "theme" || t.group_type === "theme");
                    if (!roles?.length && !themes?.length) return null;
                    
                    return (
                      <div className="work-card-footer">
                        {themes?.length > 0 && (
                          <div className="work-card-footer-row" style={{ gridTemplateColumns: "1fr" }}>
                            <div className="work-card-labels">
                              {themes.map((term) => <span key={`${term.groupType}-${term.slug}`}>{term.label}</span>)}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="work-empty">
          <h2>No projects match this filter.</h2>
          <button type="button" className="clear-all-btn" onClick={() => handleTagClick("All")}>
            Show all projects
          </button>
        </div>
      )}
    </div>
  );
}

