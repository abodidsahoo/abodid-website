import React, { useEffect, useState } from "react";
import { loadAdminProject } from "../../lib/portfolio/services";
import { LAYOUTS } from "./PortfolioProjectRenderer";
import "../../styles/portfolio.css";
import "../../styles/layout-preview.css";





function mapDraftToProject(slug, project, draft) {
  return {
    id: project.id, slug, status: project.status,
    title: draft.title, oneLineDescription: draft.oneLineDescription,
    context: draft.context, specificContribution: draft.specificContribution,
    yearStart: draft.yearStart, yearEnd: draft.yearEnd,
    location: draft.location, duration: draft.duration,
    outcomeHeading: draft.outcomeHeading, outcomeText: draft.outcomeText,
    workInProgress: draft.workInProgress, limitedPublic: draft.limitedPublic,
    coverUrl: draft.coverUrl, coverAlt: draft.coverAlt,
    coverFocalX: draft.coverFocalX ?? 50, coverFocalY: draft.coverFocalY ?? 50,
    taxonomies: draft.taxonomies || [], organisations: draft.organisations || [],
    collaborators: draft.collaborators || [], links: draft.links || [],
    blocks: draft.blocks || [],
    layoutStyle: draft.layoutStyle || 1,
  };
}

export default function LayoutPreview({ slug, presetProject }) {
  const [active, setActive] = useState(null);
  const [project, setProject] = useState(presetProject || null);
  const [loading, setLoading] = useState(!presetProject);
  const [error, setError] = useState("");

  useEffect(() => {
    if (presetProject) {
      if (active === null) setActive(presetProject.layoutStyle || 1);
      return;
    }
    loadAdminProject(slug)
      .then(({ project: proj, draft }) => { 
        const mapped = mapDraftToProject(slug, proj, draft);
        setProject(mapped);
        if (active === null) setActive(mapped.layoutStyle || 1);
        setLoading(false); 
      })
      .catch(err => {
        if (err.message === "ADMIN_AUTH_REQUIRED") window.location.href = `/admin/login?next=/work/layout-preview`;
        else { setError(err.message || "Could not load project."); setLoading(false); }
      });
  }, [slug, presetProject, active]);

  const activeId = active ?? 1;
  const layout = LAYOUTS.find(l => l.id === activeId) || LAYOUTS[0];
  const Component = layout.Component;

  if (loading) return <div className="lp-loading">Loading project draft…</div>;
  if (error)   return <div className="lp-error">{error}</div>;

  return (
    <>
      <nav className="lp-switcher" aria-label="Switch layout">
        {LAYOUTS.map(l => (
          <div key={l.id} className="lp-switcher-item">
            <button type="button"
              className={`lp-switcher-btn ${activeId === l.id ? "is-active" : ""}`}
              onClick={() => setActive(l.id)} aria-pressed={activeId === l.id}>
              <span className="lp-switcher-num">{l.id}</span>
            </button>
            <div className="lp-switcher-tooltip">{l.label}</div>
          </div>
        ))}
      </nav>
      <div className="lp-stage" key={activeId}>
        <Component p={project} />
      </div>
    </>
  );
}
