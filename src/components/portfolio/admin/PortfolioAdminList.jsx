import React, { useEffect, useMemo, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { archivePortfolioProject, createPortfolioProject, listAdminProjects, reorderPortfolioProjects } from "../../../lib/portfolio/services";
import "../../../styles/portfolio-admin.css";

const formatDate = (value) => value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Never";
const PUBLIC_ORDER_CHANNEL = "portfolio-public-order";

function announcePublicOrder(ids) {
  try {
    window.localStorage.setItem(PUBLIC_ORDER_CHANNEL, JSON.stringify({ ids, updatedAt: Date.now() }));
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel(PUBLIC_ORDER_CHANNEL);
      channel.postMessage({ ids });
      channel.close();
    }
  } catch {
    // Persistence succeeded already; cross-tab refresh is a progressive enhancement.
  }
}

function ProjectRow({ project, disabled }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id, disabled });
  const title = project.draft?.title || "Untitled project";
  return (
    <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? .55 : 1 }} className="portfolio-admin-row">
      <button type="button" className="drag-handle" {...attributes} {...listeners} disabled={disabled} aria-label={`Reorder ${title}`}>⋮⋮</button>
      <a className="admin-project-link" href={`/admin/projects/${project.slug}`} aria-label={`View and edit ${title}`}>
        <div className="admin-project-thumb">{project.draft?.cover_url ? <img src={project.draft.cover_url} alt="" /> : <span>No cover</span>}</div>
        <div className="admin-project-main">
          <h2>{title}</h2>
          <p>{project.draft?.one_line_description || "No proposition yet"}</p>
        </div>
        <span className={`project-status status-${project.status}`}>{project.status === "wip" ? "Published · WIP" : project.status}</span>
        <div className="admin-project-dates"><span>Saved {formatDate(project.draft?.updated_at)}</span><span>Published {formatDate(project.published?.published_at)}</span></div>
        <span className="admin-project-edit-cue" aria-hidden="true">View / Edit <span>→</span></span>
      </a>
      {project.status !== "archived" && <button type="button" className="admin-project-archive" data-archive={project.id}>Archive</button>}
    </article>
  );
}

export default function PortfolioAdminList({ embedded = false }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [creating, setCreating] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const load = async () => {
    setLoading(true); setError("");
    try { setProjects(await listAdminProjects()); }
    catch (err) {
      if (err.message === "ADMIN_AUTH_REQUIRED") {
        const next = embedded ? "/admin/dashboard?section=portfolio_projects" : "/admin/projects";
        window.location.href = `/admin/login?next=${encodeURIComponent(next)}`;
      }
      else setError(err.message || "Could not load portfolio projects.");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => projects.filter((project) => {
    if (status !== "all" && project.status !== status) return false;
    if (!search.trim()) return true;
    const haystack = [project.draft?.title, project.draft?.one_line_description, project.slug, project.searchText].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(search.toLowerCase());
  }), [projects, search, status]);
  const orderingDisabled = Boolean(search.trim()) || status !== "all";

  const onCreate = async () => {
    setCreating(true); setError("");
    try {
      const projectId = await createPortfolioProject("Untitled project");
      window.location.href = `/admin/projects/${projectId}`;
    } catch (err) { setError(err.message || "Could not create project."); setCreating(false); }
  };
  const onDragEnd = async ({ active, over }) => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (!over || active.id === over.id || orderingDisabled) return;
    const oldIndex = projects.findIndex((item) => item.id === active.id);
    const newIndex = projects.findIndex((item) => item.id === over.id);
    const next = arrayMove(projects, oldIndex, newIndex);
    setProjects(next);
    try {
      const ids = next.map((item) => item.id);
      await reorderPortfolioProjects(ids);
      announcePublicOrder(ids);
    }
    catch (err) { setError(err.message || "Ordering failed."); await load(); }
  };
  const onClick = async (event) => {
    const projectId = event.target.closest("[data-archive]")?.dataset.archive;
    if (!projectId || !window.confirm("Archive this project? Published revisions remain recoverable.")) return;
    try { await archivePortfolioProject(projectId); setProjects((items) => items.map((item) => item.id === projectId ? { ...item, status: "archived" } : item)); }
    catch (err) { setError(err.message || "Archive failed."); }
  };

  return (
    <div className={`portfolio-admin-page ${embedded ? "is-embedded" : ""}`} onClick={onClick}>
      <header className="portfolio-admin-list-header">
        <div>{!embedded && <a href="/admin/dashboard" className="admin-eyebrow">← Admin home</a>}<h1>Portfolio projects</h1><p>Draft safely, publish deliberately, and control the order of the public Work grid.</p></div>
        <div className="header-actions"><a href="/work" target="_blank" rel="noreferrer">View public Work ↗</a><button type="button" className="primary-button" onClick={onCreate} disabled={creating}>{creating ? "Creating…" : "+ Add Project"}</button></div>
      </header>
      <section className="portfolio-admin-toolbar">
        <label><span className="sr-only">Search projects</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, organisation, collaborator or role" /></label>
        <div className="status-tabs" role="group" aria-label="Project status">{["all", "draft", "published", "wip", "archived"].map((item) => <button type="button" key={item} className={status === item ? "active" : ""} onClick={() => setStatus(item)}>{item === "wip" ? "WIP" : item}</button>)}</div>
      </section>
      {orderingDisabled && <p className="admin-hint">Clear search and status filters to reorder the public grid.</p>}
      {error && <div className="admin-notice error">{error}</div>}
      <section className="portfolio-admin-results" aria-live="polite">
        {loading ? <div className="admin-loading">Loading portfolio projects…</div> : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={filtered.map((item) => item.id)} strategy={verticalListSortingStrategy}>
              <div className="portfolio-admin-rows">{filtered.map((project) => <ProjectRow key={project.id} project={project} disabled={orderingDisabled} />)}</div>
            </SortableContext>
          </DndContext>
        )}
        {!loading && !filtered.length && <div className="admin-empty">No projects match this view.</div>}
      </section>
    </div>
  );
}
