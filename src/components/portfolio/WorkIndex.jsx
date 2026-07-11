import React, { useEffect, useMemo, useState, useRef } from "react";
import { matchesStrictAnd, parseFilters, serializeFilters, slugify } from "../../lib/portfolio/schema";
import "../../styles/portfolio.css";

const groupLabels = {
  primary: "Focus",
  organisation: "Organisation",
  role: "Role",
  project_type: "Project type",
  genre: "Theme",
  theme: "Theme",
  method: "Method",
  technology: "Technology",
  year: "Year",
};

const yearLabel = (card) => card.yearEnd && card.yearEnd !== card.yearStart ? `${card.yearStart}-${card.yearEnd}` : card.yearStart;

export default function WorkIndex({ projects = [] }) {
  const [selected, setSelected] = useState(() => typeof window === "undefined" ? {} : parseFilters(window.location.search));
  const [filterOpen, setFilterOpen] = useState(false);
  const popoverRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    const sync = () => setSelected(parseFilters(window.location.search));
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  useEffect(() => {
    if (!filterOpen) return;
    const handleClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target) && triggerRef.current && !triggerRef.current.contains(e.target)) {
        setFilterOpen(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key === "Escape") setFilterOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [filterOpen]);

  const groups = useMemo(() => {
    const values = new Map();
    projects.forEach((project) => {
      (project.taxonomies || []).forEach((term) => {
        const group = term.groupType || term.group_type;
        if (!["role", "project_type", "genre", "theme"].includes(group)) return;
        if (!values.has(group)) values.set(group, new Map());
        values.get(group).set(term.slug, term.label);
      });
      (project.organisations || []).forEach((org) => {
        if (!values.has("organisation")) values.set("organisation", new Map());
        values.get("organisation").set(org.slug || slugify(org.name), org.name);
      });
      if (project.yearStart) {
        if (!values.has("year")) values.set("year", new Map());
        values.get("year").set(String(project.yearStart), String(project.yearStart));
      }
    });
    return [...values.entries()].map(([group, options]) => ({
      group,
      options: [...options.entries()].map(([slug, label]) => ({ slug, label })).sort((a, b) => a.label.localeCompare(b.label)),
    })).sort((a, b) => {
      const order = Object.keys(groupLabels);
      return order.indexOf(a.group) - order.indexOf(b.group);
    });
  }, [projects]);

  const filtered = useMemo(() => projects.filter((project) => matchesStrictAnd(project, selected)), [projects, selected]);
  const selectedItems = useMemo(() => Object.entries(selected).flatMap(([group, slugs]) => (slugs || []).map((slug) => ({
    group,
    slug,
    label: groups.find((item) => item.group === group)?.options.find((item) => item.slug === slug)?.label || slug,
  }))), [groups, selected]);

  const commit = (next) => {
    setSelected(next);
    const query = serializeFilters(next);
    window.history.pushState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  };
  
  const toggle = (group, slug) => {
    const current = selected[group] || [];
    const values = current.includes(slug) ? current.filter((value) => value !== slug) : [...current, slug];
    const next = { ...selected };
    if (values.length) next[group] = values;
    else delete next[group];
    commit(next);
  };

  return (
    <div className="work-index-app">
      <div className="work-toolbar-container">
        <div className="work-toolbar">
          <span className="work-toolbar-label">{selectedItems.length > 0 ? "Filtered work" : "All work"}</span>
          <button 
            type="button" 
            ref={triggerRef}
            className={`work-toolbar-filter-btn ${filterOpen ? 'is-open' : ''}`}
            onClick={() => setFilterOpen(v => !v)}
            aria-expanded={filterOpen}
          >
            Filter +
          </button>
          <span className="work-toolbar-count">{filtered.length} {filtered.length === 1 ? "project" : "projects"}</span>
        </div>

        {filterOpen && (
          <div className="work-filter-popover" ref={popoverRef}>
            {groups.map(({ group, options }) => (
              <fieldset key={group} className="filter-group">
                <legend>{groupLabels[group] || group}</legend>
                <div className="filter-options">
                  {options.map((option) => {
                    const active = selected[group]?.includes(option.slug) || false;
                    return (
                      <button 
                        key={option.slug} 
                        type="button" 
                        className={active ? "is-selected" : ""} 
                        aria-pressed={active} 
                        onClick={() => toggle(group, option.slug)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        )}

        {selectedItems.length > 0 && (
          <div className="selected-filter-chips" aria-label="Selected filters">
            {selectedItems.map((item) => (
              <button key={`${item.group}-${item.slug}`} type="button" onClick={() => toggle(item.group, item.slug)} aria-label={`Remove ${item.label} filter`}>
                {item.label}<span aria-hidden="true">×</span>
              </button>
            ))}
            <button type="button" className="clear-all-btn" onClick={() => commit({})}>Clear filters</button>
          </div>
        )}
      </div>

      {filtered.length > 0 ? (
        <div className="work-card-grid">
          {filtered.map((project) => (
            <article className="work-card" key={project.id || project.slug}>
              <a href={`/work/${project.slug}`} className="work-card-image">
                {project.coverUrl && <img src={project.coverUrl} alt={project.coverAlt || ""} loading="lazy" width="1200" height="900" style={{ objectPosition: `${project.coverFocalX ?? 50}% ${project.coverFocalY ?? 50}%` }} />}
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
                  const roles = project.taxonomies?.filter(t => t.groupType === 'role' || t.group_type === 'role');
                  const themes = project.taxonomies?.filter(t => t.groupType === 'genre' || t.group_type === 'genre' || t.groupType === 'theme' || t.group_type === 'theme');
                  if (!roles?.length && !themes?.length) return null;
                  
                  return (
                    <div className="work-card-footer">
                      {themes?.length > 0 && (
                        <div className="work-card-footer-row" style={{ gridTemplateColumns: '1fr' }}>
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
          ))}
        </div>
      ) : (
        <div className="work-empty">
          <h2>No projects match these filters.</h2>
          <button type="button" className="clear-all-btn" onClick={() => commit({})}>Clear filters</button>
        </div>
      )}
    </div>
  );
}
