import { useEffect, useId, useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowUpRight,
  Check,
  Eye,
  EyeOff,
  GripVertical,
  ImagePlus,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "../../lib/supabaseClient";
import AdminPageHeader from "./AdminPageHeader";
import ImageUploader from "./ImageUploader";
import BlogStudioBlockEditor from "./blog/BlogStudioBlockEditor";
import { compileBlocksToMarkdown, convertMarkdownToBlocks } from "../../lib/blogAdmin";
import "../../styles/portfolio-admin.css";
import "../../styles/research-admin.css";

const EMPTY_PROJECT = {
  id: null,
  title: "",
  slug: "",
  description: "",
  content: "",
  blocks: [],
  role: "Research project",
  accent: "lime",
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

const DESIGN_SECTIONS = ["basics", "content"];

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
  blocks: Array.isArray(row?.blocks) && row.blocks.length > 0
    ? row.blocks
    : convertMarkdownToBlocks(String(row?.content || "")),
  role: String(row?.role || "Research project"),
  accent: String(row?.accent || "lime"),
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

function ResearchRow({ project, position, disabled, updating, onEdit, onSetExposure }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id, disabled });
  const status = getStatus(project);
  const isHidden = !project.visible;
  const isDraft = status === "draft";
  const isLive = project.published && project.visible;

  return (
    <article
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`research-admin-card ${isHidden ? "is-hidden" : ""} ${isDraft ? "is-draft" : ""} ${isDragging ? "is-dragging" : ""}`}
      data-accent={project.accent || "lime"}
      style={{
        transform: CSS.Translate.toString(transform),
        transition: isDragging ? "none" : transition,
        opacity: isDragging ? 0.6 : undefined,
        zIndex: isDragging ? 50 : undefined,
      }}
      onClick={() => onEdit(project)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit(project);
        }
      }}
      role="button"
      aria-label={`Edit project: ${project.title || "Untitled"}`}
    >
      <div className="research-card-media-wrapper">
        <div className="research-card-media">
          {project.cover_image ? <img src={project.cover_image} alt="" loading="lazy" draggable={false} /> : <span>No cover</span>}
        </div>
      </div>

      <div className="research-card-copy">
        <h2>{project.title || "Untitled project"}</h2>
      </div>

      <footer className="research-card-bottomline">
        <div className="research-card-left-group">
          <span className="research-card-num-circle" title={`Sequence #${position + 1}`} aria-label={`Project sequence #${position + 1}`}>
            {position + 1}
          </span>
          <button
            type="button"
            className="research-card-edit-action-btn"
            title={`Edit project: ${project.title || "Untitled"}`}
            aria-label={`Edit project: ${project.title || "Untitled"}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(project);
            }}
          >
            <Pencil size={11} aria-hidden="true" />
            <span>Edit Project</span>
          </button>
          <div className="research-card-badges-wrapper">
            {isDraft && <span className="research-card-badge is-draft">Draft</span>}
            {project.visible && !project.featured && <span className="research-card-badge is-unlisted">Unlisted</span>}
          </div>
        </div>

        <div className="research-card-bottom-controls" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <div className="research-card-visibility-switch" role="radiogroup" aria-label="Visibility">
            <button
              type="button"
              role="radio"
              aria-checked={!isHidden}
              className={`visibility-btn ${!isHidden ? "is-active" : ""}`}
              disabled={updating}
              title="Public: Visible on site"
              onClick={() => onSetExposure(project, "listed")}
            >
              <Eye size={12} aria-hidden="true" />
              <span>Public</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={isHidden}
              className={`visibility-btn ${isHidden ? "is-active" : ""}`}
              disabled={updating}
              title="Hidden: No public access"
              onClick={() => onSetExposure(project, "hidden")}
            >
              <EyeOff size={12} aria-hidden="true" />
              <span>Hidden</span>
            </button>
          </div>

          {isLive && (
            <a
              href={`/research/${project.slug}`}
              target="_blank"
              rel="noreferrer"
              className="research-card-public-link-btn"
              title="Open public page ↗"
              aria-label={`Open public live page for ${project.title}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          )}
        </div>
      </footer>
    </article>
  );
}

export default function ResearchManager() {
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [uploadingBlock, setUploadingBlock] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [updatingProjectId, setUpdatingProjectId] = useState(null);
  const [workspaceTab, setWorkspaceTab] = useState("design");
  const [designSection, setDesignSection] = useState("basics");
  const [previewDevice, setPreviewDevice] = useState("laptop");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [orderSaved, setOrderSaved] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const filtered = useMemo(() => projects.filter((project) => {
    if (status === "index" && !(project.featured && project.published && project.visible)) return false;
    if (status === "draft" && getStatus(project) !== "draft") return false;
    if (status === "hidden" && project.visible) return false;
    if (!search.trim()) return true;
    const haystack = [project.title, project.description, project.slug, project.experiment_url, ...project.tags].join(" ").toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  }), [projects, search, status]);
  const orderingDisabled = Boolean(search.trim());
  const viewCounts = useMemo(() => ({
    all: projects.length,
    index: projects.filter((project) => project.featured && project.published && project.visible).length,
    draft: projects.filter((project) => getStatus(project) === "draft").length,
    hidden: projects.filter((project) => !project.visible).length,
  }), [projects]);

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

  useEffect(() => {
    if (!orderSaved) return undefined;
    const timeoutId = window.setTimeout(() => setOrderSaved(false), 2400);
    return () => window.clearTimeout(timeoutId);
  }, [orderSaved]);

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
    setWorkspaceTab("design");
    setDesignSection("basics");
    updateUrl({ projectId: project.id });
  };

  const startNew = () => {
    setForm({ ...EMPTY_PROJECT, sort_order: projects.length });
    setDirty(false);
    setError("");
    setNotice("");
    setWorkspaceTab("design");
    setDesignSection("basics");
    updateUrl({ action: "new" });
  };

  const handleBackClick = () => {
    if (dirty) {
      setShowDiscardModal(true);
    } else {
      forceCloseEditor();
    }
  };

  const forceCloseEditor = () => {
    setShowDiscardModal(false);
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
    content: compileBlocksToMarkdown(form.blocks),
    blocks: Array.isArray(form.blocks) ? form.blocks : [],
    role: form.role.trim() || "Research project",
    accent: form.accent || "lime",
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
      return null;
    }
    if (!payload.slug) {
      setError("Add a URL slug before saving.");
      return null;
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
      return null;
    }

    const saved = normalizeProject(data);
    setForm(saved);
    setDirty(false);
    setNotice(message || (form.id ? "Research project saved." : "Research project created."));
    updateUrl({ projectId: saved.id });
    await loadProjects({ selectId: saved.id });
    setSaving(false);
    return saved;
  };

  const openWorkspaceTab = async (nextTab) => {
    if (nextTab === "preview" && dirty) {
      const saved = await saveProject({ message: "Draft saved for preview." });
      if (!saved) return;
    }
    setWorkspaceTab(nextTab);
  };

  const setProjectExposure = async (project, exposure) => {
    setUpdatingProjectId(project.id);
    setError("");
    setNotice("");
    const payload = exposure === "listed"
      ? { visible: true, featured: true }
      : exposure === "unlisted"
        ? { visible: true, featured: false }
        : { visible: false, featured: false };
    if (exposure === "listed" && !project.featured) {
      const featuredOrders = projects.filter((item) => item.featured).map((item) => Number(item.sort_order) || 0);
      payload.sort_order = featuredOrders.length ? Math.max(...featuredOrders) + 1 : 0;
    }
    const { data, error: updateError } = await supabase
      .from("research")
      .update(payload)
      .eq("id", project.id)
      .select("*")
      .single();
    if (updateError) {
      setError(updateError.message);
    } else {
      const updated = normalizeProject(data);
      setProjects((current) => current
        .map((item) => item.id === project.id ? updated : item)
        .sort((first, second) => (first.sort_order ?? 0) - (second.sort_order ?? 0)));
      setNotice(exposure === "listed"
        ? "Project is public and listed on the Research page."
        : exposure === "unlisted"
          ? "Project is public by direct link and removed from the Research listing."
          : "Project is hidden from all public access.");
    }
    setUpdatingProjectId(null);
  };

  const toggleArchive = () => {
    const visible = !form.visible;
    saveProject({
      visible,
      message: visible ? "Research project restored." : "Research project archived and removed from the public page.",
    });
  };

  const confirmDeleteProject = async () => {
    if (!form?.id) return;
    setShowDeleteModal(false);
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
    const oldIndex = filtered.findIndex((project) => project.id === active.id);
    const newIndex = filtered.findIndex((project) => project.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(filtered, oldIndex, newIndex).map((project, index) => ({ ...project, sort_order: index }));
    const orderById = new Map(reordered.map((project) => [project.id, project.sort_order]));
    setProjects((current) => current
      .map((project) => orderById.has(project.id) ? { ...project, sort_order: orderById.get(project.id) } : project)
      .sort((first, second) => (first.sort_order ?? 0) - (second.sort_order ?? 0)));
    setSavingOrder(true);
    const results = await Promise.all(reordered.map((project, index) => supabase.from("research").update({ sort_order: index }).eq("id", project.id)));
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      setError(`Could not save the project order: ${failed.error.message}`);
      await loadProjects();
    } else {
      setOrderSaved(true);
    }
    setSavingOrder(false);
  };

  const uploadBlockImage = async (file) => {
    setUploadingBlock(true);
    try {
      const cleanName = String(file.name || "research-image")
        .toLowerCase()
        .replace(/[^a-z0-9.]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const path = `blocks/${crypto.randomUUID()}-${cleanName}`;
      const { error: uploadError } = await supabase.storage.from("research").upload(path, file, {
        cacheControl: "31536000",
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("research").getPublicUrl(path);
      return { url: data.publicUrl };
    } finally {
      setUploadingBlock(false);
    }
  };

  if (form) {
    return (
      <div className="portfolio-admin-page research-admin-page is-embedded is-editor-mode" aria-labelledby="research-editor-title">
        {/* Pop Editorial Header Card */}
        <header className="portfolio-admin-list-header research-editor-header">
          <div className="research-editor-header-nav">
            <button type="button" className="admin-back-button" onClick={handleBackClick}>
              <ArrowLeft size={15} aria-hidden="true" /> Back to all research
            </button>
            <div className="research-editor-save-indicator" data-dirty={dirty}>
              <span className="status-dot" aria-hidden="true" />
              <span>{saving ? "Saving…" : dirty ? "Unsaved changes" : form.published && form.visible ? "Published · Live" : "Draft saved"}</span>
            </div>
            <div className="header-actions">
              {form.slug && (
                <a href={`/research/${form.slug}`} target="_blank" rel="noreferrer" className="header-action-preview">
                  Public Page <ArrowUpRight size={14} aria-hidden="true" />
                </a>
              )}
              <button type="button" className="save-draft-button" onClick={() => saveProject()} disabled={saving}>
                <Save size={14} /> Save draft
              </button>
              <button type="button" className="primary-button" onClick={() => saveProject({ publish: true, visible: true, message: "Research project published." })} disabled={saving}>
                {form.published && form.visible ? "Update live →" : "Publish →"}
              </button>
            </div>
          </div>

          <div className="research-editor-header-body">
            <div className="portfolio-admin-header-copy">
              <span className="research-editor-kicker">
                Research Studio · {form.published && form.visible ? "Published" : form.visible ? "Draft" : "Archived"}
              </span>
              <h1 id="research-editor-title" className="admin-page-header__title">
                {form.title || "Untitled research project"}
              </h1>
              {form.description && (
                <p className="admin-page-header__description">{form.description}</p>
              )}
            </div>

            <div className="portfolio-workspace-tabs" role="tablist" aria-label="Research workspace" data-active={workspaceTab}>
              <button type="button" role="tab" aria-selected={workspaceTab === "design"} onClick={() => openWorkspaceTab("design")}>Design</button>
              <button type="button" role="tab" aria-selected={workspaceTab === "preview"} onClick={() => openWorkspaceTab("preview")}>Preview</button>
              <button type="button" role="tab" aria-selected={workspaceTab === "publish"} onClick={() => openWorkspaceTab("publish")}>Publish</button>
              <span aria-hidden="true" />
            </div>
          </div>
        </header>

        {notice && <div className="research-list-notice is-success" role="status">{notice}</div>}
        {error && <div className="research-list-notice is-error" role="alert">{error}</div>}

        <section className="research-editor-workspace-card">
          {workspaceTab === "design" && (
            <div className={`portfolio-design-workspace ${designSection !== "basics" ? "is-elements-mode" : ""}`}>
              <aside className="portfolio-design-sidebar">
                <div className="portfolio-design-section-tabs" role="tablist" aria-orientation="vertical" aria-label="Research design sections">
                  {DESIGN_SECTIONS.map((section) => (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={designSection === section}
                      key={section}
                      onClick={() => setDesignSection(section)}
                    >
                      {section === "basics" ? "Basics" : "Content Blocks"}
                    </button>
                  ))}
                </div>
              </aside>

              <div className="portfolio-design-main">
                {designSection === "basics" && (
                  <div className="editor-spine-card" role="tabpanel">
                    <span className="editor-eyebrow">Project Basics</span>
                    <div className="editor-spine-grid">
                      <div className="editor-spine-fields">
                        <label className="editor-field"><span>Project title <b>*</b></span><input value={form.title} placeholder="Untitled research project" onChange={(event) => setField("title", event.target.value)} style={{ fontSize: "1.1rem", fontWeight: 600 }} /></label>
                        <label className="editor-field"><span>Short proposition</span><textarea rows={4} value={form.description} placeholder="What is the question, and why should someone care?" onChange={(event) => setField("description", event.target.value)} /></label>
                        <div className="field-row">
                          <label className="editor-field"><span>Your role</span><input value={form.role} placeholder="Researcher / Artist" onChange={(event) => setField("role", event.target.value)} /></label>
                          <label className="editor-field"><span>Card colour</span><select value={form.accent} onChange={(event) => setField("accent", event.target.value)}><option value="lime">Lime</option><option value="pink">Pink</option><option value="yellow">Yellow</option><option value="cyan">Cyan</option><option value="orange">Orange</option><option value="purple">Purple</option></select></label>
                        </div>
                        <label className="editor-field"><span>Experiment URL</span><input type="text" inputMode="url" value={form.experiment_url} placeholder="https://… or /research/your-experiment" onChange={(event) => setField("experiment_url", event.target.value)} /></label>
                        <TagEditor values={form.tags} onChange={(tags) => setField("tags", tags)} />
                        <label className="editor-field"><span>Research index</span><span className="research-checkbox"><input type="checkbox" checked={form.featured} onChange={(event) => setField("featured", event.target.checked)} /> Feature this project</span></label>
                      </div>

                      <aside className="editor-spine-media" aria-label="Research cover">
                        <header><div><span className="editor-eyebrow">Cover media</span><h2>Featured cover</h2></div></header>
                        <div className="research-cover-preview">{form.cover_image ? <img src={form.cover_image} alt="Project cover preview" /> : <span><ImagePlus size={25} /> 16:10 cover preview</span>}</div>
                        <label className="editor-field"><span>Cover image URL</span><input type="url" value={form.cover_image} placeholder="https://…" onChange={(event) => setField("cover_image", event.target.value)} /></label>
                        <ImageUploader bucket="research" path="covers" buttonOnly className="research-upload-button" label={<><ImagePlus size={15} /> {form.cover_image ? "Replace cover" : "Upload cover"}</>} onUpload={(files) => setField("cover_image", files[0]?.url || "")} />
                        {form.cover_image && <button type="button" className="quiet-button danger" onClick={() => setField("cover_image", "")}>Remove cover</button>}
                      </aside>
                    </div>
                  </div>
                )}

                {designSection !== "basics" && (
                  <BlogStudioBlockEditor blocks={form.blocks} onBlocksChange={(blocks) => setField("blocks", blocks)} onUpload={uploadBlockImage} uploading={uploadingBlock} designSection={designSection} />
                )}
              </div>
            </div>
          )}

          {workspaceTab === "preview" && (
            <section className="portfolio-inline-preview is-active">
              <header className="portfolio-preview-toolbar">
                <div><span className="editor-eyebrow">Preview</span><h3>Research project live preview</h3></div>
                <div className="portfolio-preview-display-controls">
                  {form.slug && <a href={`/research/${form.slug}`} target="_blank" rel="noreferrer" className="preview-fullscreen-button">Full screen <ArrowUpRight size={13} /></a>}
                  <div className="preview-mode-switch">
                    {['laptop', 'tablet', 'phone'].map((device) => <button type="button" key={device} className={`preview-mode-pill ${previewDevice === device ? "active" : ""}`} onClick={() => setPreviewDevice(device)}>{device}</button>)}
                  </div>
                </div>
              </header>
              <div className={`portfolio-inline-preview-device is-${previewDevice}`}>
                {form.slug ? <iframe src={`/research/${form.slug}`} title={`${form.title} preview`} /> : <div className="research-preview-empty">Add a title and slug to enable preview.</div>}
              </div>
            </section>
          )}

          {workspaceTab === "publish" && (
            <section className="portfolio-publish-workspace">
              <span className="editor-eyebrow">Publish</span>
              <h2>Choose how this research project goes live</h2>
              <section className="publish-slug-section">
                <header><div><span className="editor-eyebrow">Public URL</span><h3>Research slug</h3></div><code>/research/{form.slug || "your-project"}</code></header>
                <div className="publish-slug-control">
                  <label className="editor-field"><span>Slug</span><input value={form.slug} placeholder={slugify(form.title) || "project-url"} onChange={(event) => setField("slug", slugify(event.target.value))} /></label>
                  <button type="button" className="primary-button publish-slug-button" onClick={() => saveProject()} disabled={saving}>Save URL</button>
                </div>
              </section>

              <div className="publish-settings-grid">
                <section className="publish-classification-section">
                  <header><span className="editor-eyebrow">Discoverability</span><h3>Classification and access</h3></header>
                  <TagEditor values={form.tags} onChange={(tags) => setField("tags", tags)} />
                  <div className="research-publish-toggles">
                    <label className="research-checkbox"><input type="checkbox" checked={form.featured} onChange={(event) => setField("featured", event.target.checked)} /> Feature on the Research index</label>
                    <label className="research-checkbox"><input type="checkbox" checked={form.visible} onChange={(event) => setField("visible", event.target.checked)} /> Publicly visible</label>
                  </div>
                  {form.experiment_url && <a className="manage-seo-link" href={form.experiment_url} target="_blank" rel="noreferrer"><span>Open linked experiment</span><ArrowUpRight size={14} /></a>}
                </section>

                <section className="publish-properties">
                  <header className="publish-properties-header"><span className="editor-eyebrow">Status</span><h3>Publishing</h3></header>
                  <div className="publish-properties-body">
                    <div className="publish-seo-handoff">
                      <div><span className="editor-eyebrow">Live status</span><strong className={form.published && form.visible ? "research-status-live" : ""}>{form.published && form.visible ? "● Published · Live" : form.visible ? "○ Draft" : "○ Archived"}</strong></div>
                      <div><span className="editor-eyebrow">Story</span><strong>{form.blocks.length} {form.blocks.length === 1 ? "block" : "blocks"}</strong></div>
                    </div>
                    <button type="button" className="primary-button publish-button full" onClick={() => saveProject({ publish: true, visible: true, message: "Research project published." })} disabled={saving}>{saving ? "Publishing…" : form.published && form.visible ? "Update live project →" : "Publish now →"}</button>
                    {form.id && <button type="button" className="quiet-button full research-maintenance-button" onClick={toggleArchive} disabled={saving}>{form.visible ? <Archive size={15} /> : <ArchiveRestore size={15} />}{form.visible ? "Archive project" : "Restore project"}</button>}
                    {form.id && <button type="button" className="quiet-button danger full research-maintenance-button" onClick={() => setShowDeleteModal(true)} disabled={saving}><Trash2 size={15} /> Permanently delete</button>}
                  </div>
                </section>
              </div>
            </section>
          )}
        </section>

        {/* Unsaved Changes Discard Modal */}
        {showDiscardModal && (
          <div
            className="admin-modal-backdrop"
            onClick={() => setShowDiscardModal(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="discard-modal-title"
          >
            <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <span className="admin-modal-kicker">Unsaved Changes</span>
                <h2 id="discard-modal-title">Discard unsaved changes?</h2>
                <p>
                  You have unsaved changes in “{form?.title || "Untitled project"}”. Leaving now will discard all modifications made since your last save.
                </p>
              </div>
              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="admin-modal-button secondary"
                  onClick={forceCloseEditor}
                >
                  Discard changes
                </button>
                <button
                  type="button"
                  className="admin-modal-button primary"
                  onClick={() => setShowDiscardModal(false)}
                >
                  Keep editing
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Permanently Delete Confirmation Modal */}
        {showDeleteModal && (
          <div
            className="admin-modal-backdrop"
            onClick={() => setShowDeleteModal(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
          >
            <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <span className="admin-modal-kicker">Confirm Deletion</span>
                <h2 id="delete-modal-title">Delete “{form?.title || "Untitled project"}”?</h2>
                <p>
                  This project will be permanently deleted from the database. This action cannot be undone.
                </p>
              </div>
              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="admin-modal-button secondary"
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="admin-modal-button danger"
                  onClick={confirmDeleteProject}
                >
                  Permanently delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="portfolio-admin-page research-admin-page is-embedded" aria-labelledby="research-projects-title">
      <header className="portfolio-admin-list-header">
        <div className="portfolio-admin-header-copy">
          <AdminPageHeader headingId="research-projects-title" title="Research Projects" description="Build ideas people can experience." />
        </div>
        <div className="header-actions">
          <a href="/research" target="_blank" rel="noreferrer">Public Page <ArrowUpRight size={15} aria-hidden="true" /></a>
          <button type="button" className="primary-button" onClick={startNew}><Plus size={15} aria-hidden="true" /> Add Project</button>
        </div>
      </header>

      {error && <div className="research-list-notice is-error" role="alert">{error}</div>}

      <section className="research-catalogue-layout">
        <div className="research-catalogue-main">
          <header className="research-results-heading">
            <div className="research-results-lead">
              <h2 className="research-lead-counter">
                {filtered.length} {filtered.length === 1 ? "project" : "projects"}
              </h2>
              <label className="research-search-field">
                <input
                  type="search"
                  aria-label="Find a project by title, slug or tag"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by title, slug or tag…"
                />
              </label>
            </div>

            <div className="research-results-actions-right">
              <div className="research-right-meta-row">
                {orderSaved ? (
                  <div className="research-order-saved-inline" role="status">
                    <Check size={13} aria-hidden="true" />
                    <span>Order saved</span>
                  </div>
                ) : (
                  <p className="research-search-helper">
                    {savingOrder
                      ? "Saving order…"
                      : status === "index"
                        ? (orderingDisabled ? "Clear search to reorder live sequence." : "Drag cards to set the public sequence.")
                        : "Switch to Listed to reorder public sequence."}
                  </p>
                )}
              </div>
              <div className="research-view-tabs" role="group" aria-label="Research project view">
                {[
                  ["all", "All"],
                  ["index", "Listed"],
                  ["draft", "Drafts"],
                  ["hidden", "Hidden"],
                ].map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    className={status === value ? "active" : ""}
                    aria-pressed={status === value}
                    onClick={() => setStatus(value)}
                  >
                    <span>{label}</span>
                    <strong>{viewCounts[value]}</strong>
                  </button>
                ))}
              </div>
            </div>
          </header>

          <section className="portfolio-admin-results" aria-live="polite">
            {loading ? <div className="admin-loading"><LoaderCircle size={17} className="research-spin" /> Loading research projects…</div> : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleProjectDragEnd}>
                <SortableContext items={filtered.map((project) => project.id)} strategy={rectSortingStrategy}>
                  <div className="research-admin-grid">{filtered.map((project, index) => <ResearchRow key={project.id} project={project} position={index} disabled={orderingDisabled} updating={updatingProjectId === project.id} onEdit={editProject} onSetExposure={setProjectExposure} />)}</div>
                </SortableContext>
              </DndContext>
            )}
            {!loading && filtered.length === 0 && <div className="admin-empty">No research projects match this view.</div>}
          </section>
        </div>
      </section>
    </div>
  );
}
