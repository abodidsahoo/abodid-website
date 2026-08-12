import { useEffect, useId, useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowUpRight,
  GripVertical,
  ImagePlus,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "../../lib/supabaseClient";
import AdminPageHeader from "./AdminPageHeader";
import ImageUploader from "./ImageUploader";
import "../../styles/portfolio-admin.css";
import "../../styles/research-admin.css";

const EMPTY_PROJECT = {
  id: null,
  title: "",
  slug: "",
  description: "",
  content: "",
  cover_image: "",
  gallery_images: [],
  experiment_url: "",
  tags: [],
  featured: false,
  published: false,
  visible: true,
  sort_order: 0,
  created_at: null,
  updated_at: null,
};

const slugify = (value) => String(value || "")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/-{2,}/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 120);

const normalizeTags = (value) => {
  const entries = Array.isArray(value) ? value : String(value || "").split(",");
  const seen = new Set();
  return entries
    .map((entry) => String(entry || "").replace(/^#+/, "").trim())
    .filter((entry) => {
      const key = entry.toLowerCase();
      if (!entry || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const normalizeGallery = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry, index) => {
      const source = typeof entry === "string" ? { url: entry } : entry;
      const url = String(source?.url || "").trim();
      if (!url) return null;
      return {
        id: source.id || `research-image-${index}-${url}`,
        url,
        caption: String(source.caption || ""),
        sort_order: index,
      };
    })
    .filter(Boolean);
};

const normalizeProject = (row) => ({
  ...EMPTY_PROJECT,
  ...row,
  title: String(row?.title || ""),
  slug: String(row?.slug || ""),
  description: String(row?.description || ""),
  content: String(row?.content || ""),
  cover_image: String(row?.cover_image || ""),
  gallery_images: normalizeGallery(row?.gallery_images),
  experiment_url: String(row?.experiment_url || ""),
  tags: normalizeTags(row?.tags),
  featured: Boolean(row?.featured),
  published: Boolean(row?.published),
  visible: row?.visible !== false,
});

const getStatus = (project) => {
  if (!project.visible) return "archived";
  return project.published ? "published" : "draft";
};

const formatDate = (value) => value
  ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
  : "Never";

function TagEditor({ values, onChange }) {
  const inputId = useId();
  const [draft, setDraft] = useState("");

  const addTag = () => {
    const [tag] = normalizeTags([draft.slice(0, 60)]);
    if (!tag) return;
    if (!values.some((value) => value.toLowerCase() === tag.toLowerCase())) onChange([...values, tag]);
    setDraft("");
  };

  return (
    <div className="research-tag-field">
      <label htmlFor={inputId}>Tags</label>
      <div className="research-tag-editor">
        {values.length > 0 && (
          <div className="research-tag-list">
            {values.map((tag) => (
              <span key={tag}>
                {tag}
                <button type="button" onClick={() => onChange(values.filter((value) => value !== tag))} aria-label={`Remove ${tag}`}>
                  <X size={12} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          id={inputId}
          value={draft}
          placeholder="Creative coding, AI, interaction…"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === ",") && !event.nativeEvent?.isComposing) {
              event.preventDefault();
              addTag();
            }
          }}
          onBlur={addTag}
        />
      </div>
    </div>
  );
}

function ResearchRow({ project, disabled, onEdit, onArchive }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id, disabled });
  const status = getStatus(project);

  return (
    <article
      ref={setNodeRef}
      className={`portfolio-admin-row research-admin-row ${status === "archived" ? "is-archived" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.55 : 1 }}
    >
      <button type="button" className="drag-handle" {...attributes} {...listeners} disabled={disabled} aria-label={`Reorder ${project.title || "untitled project"}`}>⋮⋮</button>
      <button type="button" className="admin-project-link research-project-link" onClick={() => onEdit(project)}>
        <span className="admin-project-thumb">
          {project.cover_image ? <img src={project.cover_image} alt="" /> : <span>No cover</span>}
        </span>
        <span className="admin-project-main">
          <h2>{project.title || "Untitled project"}</h2>
          <p>{project.description || "No proposition yet"}</p>
        </span>
        <span className={`project-status status-${status}`}>{status}</span>
        <span className="admin-project-dates">
          <span>Saved {formatDate(project.updated_at || project.created_at)}</span>
          <span>{project.experiment_url ? "Experiment linked" : "No experiment link"}</span>
        </span>
        <span className="admin-project-edit-cue" aria-hidden="true">View / Edit <span>→</span></span>
      </button>
      {status !== "archived" && (
        <button type="button" className="admin-project-archive" onClick={() => onArchive(project)}>Archive</button>
      )}
    </article>
  );
}

function GalleryImage({ image, index, onCaption, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image.id });
  return (
    <article ref={setNodeRef} className={`research-gallery-card ${isDragging ? "is-dragging" : ""}`} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <div className="research-gallery-image">
        <img src={image.url} alt={image.caption || `Project image ${index + 1}`} />
        <span>{String(index + 1).padStart(2, "0")}</span>
        <button type="button" className="research-gallery-grip" {...attributes} {...listeners} aria-label={`Move project image ${index + 1}`}>
          <GripVertical size={16} aria-hidden="true" />
        </button>
        <button type="button" className="research-gallery-remove" onClick={() => onRemove(image.id)} aria-label={`Remove project image ${index + 1}`}>
          <X size={15} aria-hidden="true" />
        </button>
      </div>
      <input value={image.caption} placeholder="Optional caption" onChange={(event) => onCaption(image.id, event.target.value)} />
    </article>
  );
}

export default function ResearchManager() {
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const filtered = useMemo(() => projects.filter((project) => {
    if (status !== "all" && getStatus(project) !== status) return false;
    if (!search.trim()) return true;
    const haystack = [project.title, project.description, project.slug, project.experiment_url, ...project.tags].join(" ").toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  }), [projects, search, status]);
  const orderingDisabled = Boolean(search.trim()) || status !== "all";

  const updateUrl = ({ projectId, action } = {}) => {
    const url = new URL(window.location.href);
    url.searchParams.set("section", "research");
    url.searchParams.delete("project");
    url.searchParams.delete("action");
    if (projectId) url.searchParams.set("project", projectId);
    if (action) url.searchParams.set("action", action);
    window.history.replaceState({}, "", url);
  };

  const loadProjects = async ({ selectId, startNew = false } = {}) => {
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("research")
      .select("*")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }

    const normalized = (data || []).map(normalizeProject);
    setProjects(normalized);
    if (startNew) setForm({ ...EMPTY_PROJECT, sort_order: normalized.length });
    else if (selectId) setForm(normalized.find((project) => project.id === selectId) || null);
    setDirty(false);
    setLoading(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    loadProjects({ selectId: params.get("project"), startNew: params.get("action") === "new" });
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timeoutId = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setError("");
    setNotice("");
  };

  const editProject = (project) => {
    setForm(normalizeProject(project));
    setDirty(false);
    setError("");
    setNotice("");
    updateUrl({ projectId: project.id });
  };

  const startNew = () => {
    setForm({ ...EMPTY_PROJECT, sort_order: projects.length });
    setDirty(false);
    setError("");
    setNotice("");
    updateUrl({ action: "new" });
  };

  const closeEditor = () => {
    if (dirty && !window.confirm("Discard the unsaved changes to this research project?")) return;
    setForm(null);
    setDirty(false);
    setError("");
    setNotice("");
    updateUrl();
  };

  const buildPayload = ({ publish = form.published, visible = form.visible } = {}) => ({
    title: form.title.trim(),
    slug: (form.slug.trim() || slugify(form.title)),
    description: form.description.trim() || null,
    content: form.content || "",
    cover_image: form.cover_image.trim() || null,
    gallery_images: normalizeGallery(form.gallery_images),
    experiment_url: form.experiment_url.trim() || null,
    tags: normalizeTags(form.tags),
    featured: Boolean(form.featured),
    published: Boolean(publish),
    visible: Boolean(visible),
    sort_order: Number.isFinite(Number(form.sort_order)) ? Number(form.sort_order) : projects.length,
  });

  const saveProject = async ({ publish = form.published, visible = form.visible, message } = {}) => {
    const payload = buildPayload({ publish, visible });
    if (!payload.title) {
      setError("Add a project title before saving.");
      return;
    }
    if (!payload.slug) {
      setError("Add a URL slug before saving.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    const query = form.id
      ? supabase.from("research").update(payload).eq("id", form.id).select("*").single()
      : supabase.from("research").insert(payload).select("*").single();
    const { data, error: saveError } = await query;

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    const saved = normalizeProject(data);
    setForm(saved);
    setDirty(false);
    setNotice(message || (form.id ? "Research project saved." : "Research project created."));
    updateUrl({ projectId: saved.id });
    await loadProjects({ selectId: saved.id });
    setSaving(false);
  };

  const archiveFromList = async (project) => {
    if (!window.confirm(`Archive “${project.title}”? It will disappear from the public Research page.`)) return;
    const { error: archiveError } = await supabase.from("research").update({ visible: false }).eq("id", project.id);
    if (archiveError) setError(archiveError.message);
    else {
      setProjects((current) => current.map((item) => item.id === project.id ? { ...item, visible: false } : item));
      setNotice("Research project archived.");
    }
  };

  const toggleArchive = () => {
    const visible = !form.visible;
    saveProject({
      visible,
      message: visible ? "Research project restored." : "Research project archived and removed from the public page.",
    });
  };

  const deleteProject = async () => {
    if (!form.id || !window.confirm(`Permanently delete “${form.title}”? This cannot be undone.`)) return;
    setSaving(true);
    const { error: deleteError } = await supabase.from("research").delete().eq("id", form.id);
    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return;
    }
    setForm(null);
    updateUrl();
    await loadProjects();
    setNotice("Research project permanently deleted.");
    setSaving(false);
  };

  const handleProjectDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id || orderingDisabled) return;
    const oldIndex = projects.findIndex((project) => project.id === active.id);
    const newIndex = projects.findIndex((project) => project.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(projects, oldIndex, newIndex).map((project, index) => ({ ...project, sort_order: index }));
    setProjects(reordered);
    setSavingOrder(true);
    const results = await Promise.all(reordered.map((project, index) => supabase.from("research").update({ sort_order: index }).eq("id", project.id)));
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      setError(`Could not save the project order: ${failed.error.message}`);
      await loadProjects();
    } else setNotice("Research project order saved.");
    setSavingOrder(false);
  };

  const handleGalleryDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = form.gallery_images.findIndex((image) => image.id === active.id);
    const newIndex = form.gallery_images.findIndex((image) => image.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    setField("gallery_images", arrayMove(form.gallery_images, oldIndex, newIndex).map((image, index) => ({ ...image, sort_order: index })));
  };

  const addGalleryImages = (files) => {
    const additions = (files || []).map((file, index) => ({
      id: crypto.randomUUID(),
      url: file.url,
      caption: file.name || "",
      sort_order: form.gallery_images.length + index,
    }));
    setField("gallery_images", [...form.gallery_images, ...additions]);
  };

  const updateGalleryCaption = (id, caption) => setField("gallery_images", form.gallery_images.map((image) => image.id === id ? { ...image, caption } : image));
  const removeGalleryImage = (id) => setField("gallery_images", form.gallery_images.filter((image) => image.id !== id).map((image, index) => ({ ...image, sort_order: index })));

  if (form) {
    return (
      <section className="research-editor" aria-labelledby="research-editor-title">
        <header className="research-editor-topbar">
          <button type="button" className="research-back-button" onClick={closeEditor}><ArrowLeft size={16} aria-hidden="true" /> Research projects</button>
          <span className={`research-save-state ${dirty ? "is-dirty" : ""}`}>{saving ? "Saving…" : dirty ? "Unsaved changes" : "All changes saved"}</span>
          <div className="research-editor-actions">
            {form.id && <button type="button" className="research-archive-button" onClick={toggleArchive} disabled={saving}>{form.visible ? <Archive size={15} /> : <ArchiveRestore size={15} />}{form.visible ? "Archive" : "Restore"}</button>}
            <button type="button" onClick={() => saveProject()} disabled={saving}><Save size={15} /> Save draft</button>
            <button type="button" className="research-publish-button" onClick={() => saveProject({ publish: true, visible: true, message: "Research project published." })} disabled={saving}>{form.published && form.visible ? "Update live" : "Publish"}</button>
          </div>
        </header>

        <div className="research-editor-scroll">
          <div className="research-editor-heading">
            <div>
              <span>Creative technology project</span>
              <h1 id="research-editor-title">{form.title || "Untitled research project"}</h1>
            </div>
            {form.id && <a href={`/research/${form.slug}`} target="_blank" rel="noreferrer">View project <ArrowUpRight size={15} /></a>}
          </div>

          {notice && <div className="research-notice is-success" role="status">{notice}</div>}
          {error && <div className="research-notice is-error" role="alert">{error}</div>}

          <form className="research-editor-form" onSubmit={(event) => { event.preventDefault(); saveProject(); }}>
            <section className="research-editor-card research-project-basics">
              <div className="research-card-heading"><span>01</span><div><h2>Project basics</h2><p>The public title, proposition, and route.</p></div></div>
              <div className="research-fields-grid">
                <label className="wide research-title-field"><span>Project title</span><input value={form.title} placeholder="Untitled research project" onChange={(event) => setField("title", event.target.value)} /></label>
                <label><span>URL slug</span><input value={form.slug} placeholder={slugify(form.title) || "project-url"} onChange={(event) => setField("slug", slugify(event.target.value))} onFocus={() => !form.slug && form.title && setField("slug", slugify(form.title))} /></label>
                <label className="research-featured-field"><span>Research index</span><span className="research-checkbox"><input type="checkbox" checked={form.featured} onChange={(event) => setField("featured", event.target.checked)} /> Feature this project</span></label>
                <label className="wide"><span>Short proposition</span><textarea rows={3} value={form.description} placeholder="What is the idea, and why should someone care?" onChange={(event) => setField("description", event.target.value)} /></label>
                <TagEditor values={form.tags} onChange={(tags) => setField("tags", tags)} />
              </div>
            </section>

            <section className="research-editor-card research-experiment-card">
              <div className="research-card-heading"><span>02</span><div><h2>Launch the experiment</h2><p>Send visitors from the story into the working experience.</p></div></div>
              <div className="research-experiment-control">
                <label><span>Experiment URL</span><input type="text" inputMode="url" value={form.experiment_url} placeholder="https://… or /research/your-experiment" onChange={(event) => setField("experiment_url", event.target.value)} /></label>
                {form.experiment_url ? <a href={form.experiment_url} target="_blank" rel="noreferrer">Launch experiment <ArrowUpRight size={17} /></a> : <span className="research-experiment-placeholder">The launch button appears when a link is added.</span>}
              </div>
            </section>

            <section className="research-editor-card">
              <div className="research-card-heading"><span>03</span><div><h2>Cover image</h2><p>The visual invitation on the Research index and project page.</p></div></div>
              <div className="research-cover-grid">
                <div className="research-cover-preview">{form.cover_image ? <img src={form.cover_image} alt="Project cover preview" /> : <span><ImagePlus size={25} /> No cover image yet</span>}</div>
                <div className="research-cover-controls">
                  <label><span>Cover image URL</span><input type="url" value={form.cover_image} placeholder="https://…" onChange={(event) => setField("cover_image", event.target.value)} /></label>
                  <ImageUploader bucket="research" path="covers" buttonOnly className="research-upload-button" label={<><ImagePlus size={15} /> {form.cover_image ? "Replace cover" : "Upload cover"}</>} onUpload={(files) => setField("cover_image", files[0]?.url || "")} />
                  {form.cover_image && <button type="button" className="research-remove-media" onClick={() => setField("cover_image", "")}>Remove cover</button>}
                </div>
              </div>
            </section>

            <section className="research-editor-card">
              <div className="research-card-heading"><span>04</span><div><h2>Project story</h2><p>Simple text, headings, lists, and links using Markdown.</p></div></div>
              <label className="research-story-field"><span>Project content</span><textarea rows={15} value={form.content} placeholder={"## Start with the question\n\nDescribe the idea, the process, what changed, and what someone should notice…"} onChange={(event) => setField("content", event.target.value)} /></label>
            </section>

            <section className="research-editor-card">
              <div className="research-card-heading"><span>05</span><div><h2>Project images</h2><p>Upload, caption, drag, and sequence the visual story.</p></div></div>
              <ImageUploader bucket="research" path="gallery" multiple label="Drop project images here" onUpload={addGalleryImages} />
              {form.gallery_images.length > 0 && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGalleryDragEnd}>
                  <SortableContext items={form.gallery_images.map((image) => image.id)} strategy={rectSortingStrategy}>
                    <div className="research-gallery-grid">
                      {form.gallery_images.map((image, index) => <GalleryImage key={image.id} image={image} index={index} onCaption={updateGalleryCaption} onRemove={removeGalleryImage} />)}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </section>

            {form.id && (
              <section className="research-danger-zone">
                <span><strong>Permanent deletion</strong><small>Archive is the reversible way to remove a research project from the public page.</small></span>
                <button type="button" onClick={deleteProject} disabled={saving}><Trash2 size={15} /> Delete project</button>
              </section>
            )}
          </form>
        </div>
      </section>
    );
  }

  return (
    <div className="portfolio-admin-page research-admin-page is-embedded" aria-labelledby="research-projects-title">
      <header className="portfolio-admin-list-header">
        <div className="portfolio-admin-header-copy">
          <AdminPageHeader headingId="research-projects-title" title="Research Projects" description="Build ideas people can experience." />
        </div>
        <div className="header-actions">
          <a href="/research" target="_blank" rel="noreferrer">View public Research ↗</a>
          <button type="button" className="primary-button" onClick={startNew}><Plus size={15} /> Add Project</button>
        </div>
      </header>

      {notice && <div className="research-list-notice is-success" role="status">{notice}</div>}
      {error && <div className="research-list-notice is-error" role="alert">{error}</div>}

      <section className="portfolio-admin-toolbar">
        <label><span className="sr-only">Search research projects</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, experiment, slug or tag" /></label>
        <div className="status-tabs" role="group" aria-label="Research project status">
          {["all", "draft", "published", "archived"].map((item) => <button type="button" key={item} className={status === item ? "active" : ""} onClick={() => setStatus(item)}>{item}</button>)}
        </div>
      </section>
      {savingOrder && <p className="admin-hint">Saving the public Research order…</p>}
      {orderingDisabled && !savingOrder && <p className="admin-hint">Clear search and status filters to reorder the public grid.</p>}

      <section className="portfolio-admin-results" aria-live="polite">
        {loading ? <div className="admin-loading"><LoaderCircle size={17} className="research-spin" /> Loading research projects…</div> : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleProjectDragEnd}>
            <SortableContext items={filtered.map((project) => project.id)} strategy={verticalListSortingStrategy}>
              <div className="portfolio-admin-rows">{filtered.map((project) => <ResearchRow key={project.id} project={project} disabled={orderingDisabled} onEdit={editProject} onArchive={archiveFromList} />)}</div>
            </SortableContext>
          </DndContext>
        )}
        {!loading && filtered.length === 0 && <div className="admin-empty">No research projects match this view.</div>}
      </section>
    </div>
  );
}
