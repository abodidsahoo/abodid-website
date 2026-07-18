import React, { useCallback, useEffect, useRef, useState } from "react";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, pointerWithin, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import PortfolioBlockEditor, { PortfolioBlockInsertToolbar, PortfolioImageUploader } from "./PortfolioBlockEditor";
import PortfolioMediaPicker from "./PortfolioMediaPicker";
import {
  createPortfolioProject,
  loadAdminProject,
  publishPortfolioProject,
  savePortfolioDraft,
  updatePortfolioProjectIdentity,
  uploadPortfolioImage,
} from "../../../lib/portfolio/services";
import {
  BLOCK_LABELS,
  createEmptyBlock,
  markCollaboratorsPublished,
  normalizeTaxonomyTerm,
  slugify,
  toPublicPortfolioProjection,
  validateProjectForPublish,
} from "../../../lib/portfolio/schema";
import "../../../styles/portfolio-admin.css";

const Field = ({ label, value, onChange, rows = 1, type = "text", placeholder = "", required = false }) => <label className="editor-field"><span>{label}{required && <b aria-hidden="true"> *</b>}</span>{rows > 1 ? <textarea value={value || ""} rows={rows} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /> : <input type={type} value={value ?? ""} placeholder={placeholder} onChange={(event) => onChange(type === "number" ? (event.target.value ? Number(event.target.value) : null) : event.target.value)} />}</label>;
const LAYOUT_STYLE_OPTIONS = [
  { value: 1, label: "1: Typographic Grid" },
  { value: 2, label: "2: Columnar Narrative" },
  { value: 3, label: "3: Manifesto Block" },
  { value: 4, label: "4: Centered Statement" },
  { value: 5, label: "5: Swiss Hairline Grid" },
];
const DESIGN_SECTIONS = ["basics", "content", "media"];
const CONTENT_BLOCK_TYPES = ["body_text", "heading", "divider", "spacer", "quotation"];
const CONTENT_MORE_BLOCK_TYPES = ["two_columns", "external_link", "highlight", "testimonial", "outcome", "collaborator", "organisation"];
const MEDIA_BLOCK_TYPES = ["single_image", "image_grid", "video_embed"];
const MEDIA_MORE_BLOCK_TYPES = ["media_text"];
const MEDIA_BLOCK_LABELS = {
  image_grid: "Multi-image grid",
  video_embed: "Video embedding",
};
const CLASSIFICATION_GROUPS = [
  { groupType: "genre", label: "Genre", placeholder: "Type a genre and press Enter", priority: true },
  { groupType: "role", label: "Role", placeholder: "Type a role and press Enter", priority: true },
  { groupType: "project_type", label: "Project type", placeholder: "Type a project type and press Enter", priority: true },
];

const buildSeoStudioUrl = (project, draft) => {
  const pagePath = `/work/${slugify(project.slug) || "project-slug"}`;
  const values = {
    section: "page_metadata",
    edit: pagePath,
    prefill_page_title: draft.title || "Portfolio project",
    prefill_meta_title: draft.seoTitle || draft.title || "",
    prefill_meta_description: draft.metaDescription || draft.oneLineDescription || "",
    prefill_og_image_url: draft.socialImageUrl || draft.coverUrl || "",
    prefill_og_image_alt: draft.coverAlt || draft.title || "",
    prefill_robots_index: draft.searchVisible === false ? "false" : "true",
  };
  const params = new URLSearchParams(Object.entries(values).filter(([, value]) => value !== ""));
  return `/admin/dashboard?${params.toString()}`;
};

function TaxonomyTagField({ groupType, label, placeholder, priority, terms = [], onChange }) {
  const [value, setValue] = useState("");
  const groupTerms = terms.filter((term) => (term.groupType || term.group_type) === groupType);

  const addTag = () => {
    const term = normalizeTaxonomyTerm(value, groupType);
    if (!term) return;
    const exists = groupTerms.some((item) => (item.slug || normalizeTaxonomyTerm(item, groupType)?.slug) === term.slug);
    if (!exists) onChange([...terms, term]);
    setValue("");
  };

  const removeTag = (slug) => onChange(terms.filter((term) => !(
    (term.groupType || term.group_type) === groupType
    && (term.slug || normalizeTaxonomyTerm(term, groupType)?.slug) === slug
  )));

  return <div className={`taxonomy-tag-field ${priority ? "is-priority" : ""}`}>
    <label className="editor-field taxonomy-tag-input">
      <span>{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent?.isComposing) return;
          event.preventDefault();
          addTag();
        }}
      />
    </label>
    <div className="taxonomy-tag-list" aria-label={`${label} tags`} aria-live="polite">
      {groupTerms.map((term) => {
        const slug = term.slug || normalizeTaxonomyTerm(term, groupType)?.slug;
        return <button
          type="button"
          className="taxonomy-tag-chip"
          key={`${groupType}-${slug}`}
          onClick={() => removeTag(slug)}
          aria-label={`Remove ${term.label} from ${label}`}
          title="Remove tag"
        ><span>{term.label}</span><b aria-hidden="true">×</b></button>;
      })}
    </div>
  </div>;
}

function TaxonomyFields({ terms, onChange }) {
  return <div className="taxonomy-fields">{CLASSIFICATION_GROUPS.map((group) => (
    <TaxonomyTagField key={group.groupType} {...group} terms={terms} onChange={onChange} />
  ))}</div>;
}

function BlockInsertionDropZone({ index, enabled, empty = false }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `block-insert:${index}`,
    data: { kind: "block-insert", index },
    disabled: !enabled,
  });
  const label = empty
    ? (enabled ? "Drop the first block here" : "Drag an element here or click + to add")
    : "Drop block here";

  return <div
    ref={setNodeRef}
    className={`portfolio-block-drop-zone ${empty ? "is-empty" : ""} ${enabled ? "is-enabled" : ""} ${isOver ? "is-over" : ""}`}
    aria-hidden={!empty && !enabled}
  ><span>{label}</span></div>;
}

class PortfolioEditorErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, retryKey: 0 };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Portfolio editor crashed:", error, info);
  }

  retry = () => this.setState(({ retryKey }) => ({ error: null, retryKey: retryKey + 1 }));

  render() {
    if (this.state.error) {
      return <main className="portfolio-admin-page">
        <div className="admin-notice error">
          <strong>The editor hit an unexpected error.</strong>
          <p>Reopen the editor to return to your last manually saved draft.</p>
          {this.state.error?.message && <p style={{ fontSize: ".75rem", opacity: .7, fontFamily: "monospace", marginTop: ".5rem" }}>{this.state.error.message}</p>}
          <button type="button" className="primary-button" onClick={this.retry}>Reopen editor</button>
        </div>
      </main>;
    }
    return <PortfolioEditorContent key={this.state.retryKey} {...this.props} />;
  }
}

function DeleteBlockDialog({ block, onCancel, onConfirm }) {
  const dialogRef = useRef(null);
  const cancelButtonRef = useRef(null);
  const blockLabel = BLOCK_LABELS[block.blockType] || "Content block";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    dialog.showModal();
    cancelButtonRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return <dialog
    ref={dialogRef}
    className="portfolio-delete-dialog"
    aria-labelledby="portfolio-delete-dialog-title"
    onCancel={(event) => {
      event.preventDefault();
      onCancel();
    }}
    onClick={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}
  >
    <div className="portfolio-delete-dialog-card">
      <h2 id="portfolio-delete-dialog-title">Remove “{blockLabel}” block?</h2>
      <div className="portfolio-delete-dialog-actions">
        <button ref={cancelButtonRef} type="button" className="portfolio-delete-cancel" onClick={onCancel}>Keep block</button>
        <button type="button" className="portfolio-delete-confirm" onClick={onConfirm}>Remove block</button>
      </div>
    </div>
  </dialog>;
}

function PortfolioEditorContent({ projectId }) {
  const [project, setProject] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saveState, setSaveState] = useState("Saved");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [preview, setPreview] = useState(false);
  const [previewDevice, setPreviewDevice] = useState("laptop");
  const [workspaceTab, setWorkspaceTab] = useState("design");
  const [designSection, setDesignSection] = useState("basics");
  const [expandedBlockId, setExpandedBlockId] = useState(null);
  const [draggedBlockType, setDraggedBlockType] = useState(null);
  const [mediaPickerTarget, setMediaPickerTarget] = useState(null);
  const [blockPendingRemovalId, setBlockPendingRemovalId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const closeMediaPicker = useCallback(() => setMediaPickerTarget(null), []);
  const dirtyRef = useRef(false);
  const editVersionRef = useRef(0);
  const draftRef = useRef(null);
  const projectIdRef = useRef(null);
  const savePromiseRef = useRef(null);
  const allowUnloadRef = useRef(false);
  const interactionEpochRef = useRef(0);
  const uploadingRef = useRef(false);
  const inlinePreviewRef = useRef(null);
  const modalPreviewRef = useRef(null);
  const workspaceScrollRef = useRef(null);
  const suppressPaletteClickRef = useRef(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const blockCollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    return pointerCollisions.length ? pointerCollisions : closestCenter(args);
  }, []);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);
  useEffect(() => { draftRef.current = draft; }, [draft]);

  const load = useCallback(async () => {
    setLoading(true); setError(""); setConflict(false);
    try {
      const result = await loadAdminProject(projectId);
      projectIdRef.current = result.project.id;
      if (window.location.pathname !== `/admin/projects/${result.project.slug}`) {
        window.history.replaceState({}, "", `/admin/projects/${result.project.slug}`);
      }
      draftRef.current = result.draft;
      dirtyRef.current = false;
      editVersionRef.current = 0;
      setProject(result.project); setDraft(result.draft);
      setDirty(false); setSaveState("Saved");
    } catch (err) {
      if (err.message === "ADMIN_AUTH_REQUIRED") window.location.href = `/admin/login?next=/admin/projects/${projectId}`;
      else setError(err.message || "Could not load this project.");
    } finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const updateDraft = (updater) => {
    const current = draftRef.current;
    const next = typeof updater === "function" ? updater(current) : { ...current, ...updater };
    editVersionRef.current += 1;
    draftRef.current = next;
    setDraft(next);
    setDirty(true); dirtyRef.current = true; setSaveState("Unsaved changes"); setConflict(false); setNotice("");
  };

  const saveNow = useCallback(async () => {
    if (!dirtyRef.current || !draftRef.current || savePromiseRef.current) return savePromiseRef.current;
    setSaveState("Saving…"); setError("");
    const currentDraft = draftRef.current;
    const savedEditVersion = editVersionRef.current;
    const promise = savePortfolioDraft(projectIdRef.current, currentDraft).then(async (nextLockVersion) => {
      const latestDraft = { ...draftRef.current, lockVersion: Number(nextLockVersion) };
      draftRef.current = latestDraft;
      setDraft(latestDraft);
      const savedLatestEdit = editVersionRef.current === savedEditVersion;
      if (savedLatestEdit) {
        setDirty(false); dirtyRef.current = false; setSaveState("Saved");
      } else {
        setDirty(true); dirtyRef.current = true; setSaveState("Unsaved changes");
      }
      setProject((value) => ({ ...value, updated_at: new Date().toISOString() }));
      return nextLockVersion;
    }).catch((err) => {
      if (err.code === "PORTFOLIO_CONFLICT" || err.message === "PORTFOLIO_CONFLICT") { setConflict(true); setSaveState("Conflict detected"); }
      else { setSaveState("Save failed"); setError(err.message || "Draft save failed."); }
      throw err;
    }).finally(() => { savePromiseRef.current = null; });
    savePromiseRef.current = promise;
    return promise;
  }, []);

  const saveDraft = useCallback(async ({ showConfirmation = true } = {}) => {
    setSaving(true); setNotice(""); setError("");
    try {
      do {
        await saveNow();
      } while (dirtyRef.current);
      if (showConfirmation) setNotice("Draft Saved.");
    } finally {
      setSaving(false);
    }
  }, [saveNow]);

  useEffect(() => {
    const beforeUnload = (event) => {
      if (!dirtyRef.current || allowUnloadRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);

  const publish = async () => {
    setError(""); setNotice("");
    const validation = validateProjectForPublish(draftRef.current);
    if (validation.length) { setError(`Publish blocked: ${validation.join(" · ")}`); setWorkspaceTab("publish"); return; }
    setPublishing(true);
    try {
      if (dirtyRef.current) await saveDraft({ showConfirmation: false });
      await publishPortfolioProject(projectIdRef.current);
      const refreshed = await loadAdminProject(projectIdRef.current);
      setProject(refreshed.project);
      const publishedDraft = {
        ...draftRef.current,
        lockVersion: refreshed.draft.lockVersion,
        collaborators: markCollaboratorsPublished(draftRef.current.collaborators),
      };
      draftRef.current = publishedDraft;
      setDraft(publishedDraft);
      setSaveState("Published");
      setNotice(refreshed.project.status === "wip" ? "Published as Work in Progress." : "Published successfully.");
    } catch (err) {
      setError(err.message || "Publishing failed. The draft is still safe.");
    } finally {
      setPublishing(false);
    }
  };
  const writePreviewData = useCallback(() => {
    if (uploadingRef.current || !draftRef.current || !project) return false;
    try {
      const nextPreview = { ...toPublicPortfolioProjection(draftRef.current), id: project.id, slug: project.slug, status: project.status };
      window.sessionStorage.setItem(`portfolio:preview:${project.id}`, JSON.stringify(nextPreview));
      const message = { type: "portfolio:preview:update", projectId: project.id, project: nextPreview };
      inlinePreviewRef.current?.contentWindow?.postMessage(message, window.location.origin);
      modalPreviewRef.current?.contentWindow?.postMessage(message, window.location.origin);
      return true;
    } catch {
      // Keep the editor visible with the existing save error.
      return false;
    }
  }, [project]);
  const openPreview = () => {
    if (writePreviewData()) setPreview(true);
  };
  const openWorkspaceTab = (nextTab) => {
    if (nextTab === "preview" && !writePreviewData()) return;
    setWorkspaceTab(nextTab);
    requestAnimationFrame(() => workspaceScrollRef.current?.scrollTo({ top: 0, behavior: "auto" }));
  };
  useEffect(() => {
    if (!draft || !project) return undefined;
    const timer = window.setTimeout(writePreviewData, 100);
    return () => window.clearTimeout(timer);
  }, [draft, project, writePreviewData]);
  const confirmDiscardChanges = () => {
    if (!dirtyRef.current) return true;
    if (!window.confirm("You have unsaved changes. Leave without saving them?")) return false;
    allowUnloadRef.current = true;
    return true;
  };
  const navigateWithUnsavedCheck = (event, href) => {
    event.preventDefault();
    if (!confirmDiscardChanges()) return;
    window.location.href = href;
  };
  const duplicateConflict = async () => {
    try {
      const newId = await createPortfolioProject(`${draft.title} (conflict copy)`);
      const next = await loadAdminProject(newId);
      await savePortfolioDraft(newId, { ...draft, id: next.draft.id, lockVersion: next.draft.lockVersion, title: `${draft.title} (conflict copy)` });
      allowUnloadRef.current = true;
      window.location.href = `/admin/projects/${newId}`;
    } catch (err) { setError(err.message || "Could not duplicate local draft."); }
  };
  const changeSlug = async (value) => {
    const slug = slugify(value);
    setProject((current) => ({ ...current, slug }));
    try {
      await updatePortfolioProjectIdentity(projectIdRef.current, { slug });
      window.history.replaceState({}, "", `/admin/projects/${slug}`);
      setNotice("Project slug and editor URL updated. The previous public slug redirects here.");
    }
    catch (err) { setError(err.message || "Slug update failed."); }
  };
  const suppressTrailingPaletteClick = () => {
    suppressPaletteClickRef.current = true;
    window.setTimeout(() => { suppressPaletteClickRef.current = false; }, 0);
  };

  const insertBlockAt = (type, requestedIndex, { expand = false, scroll = false } = {}) => {
    const block = createEmptyBlock(type);
    updateDraft((current) => {
      const blocks = [...current.blocks];
      const index = Math.max(0, Math.min(Number.isInteger(requestedIndex) ? requestedIndex : blocks.length, blocks.length));
      blocks.splice(index, 0, block);
      return { ...current, blocks };
    });
    if (expand) setExpandedBlockId(block.id);
    if (scroll) window.requestAnimationFrame(() => document.getElementById(`portfolio-block-${block.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  const onBlockDragStart = ({ active }) => {
    if (active.data.current?.kind === "block-palette") setDraggedBlockType(active.data.current.blockType);
  };

  const onBlockDragCancel = () => {
    if (draggedBlockType) suppressTrailingPaletteClick();
    setDraggedBlockType(null);
  };

  const onBlockDragEnd = ({ active, over }) => {
    const dragKind = active.data.current?.kind;
    if (dragKind === "block-palette") {
      const type = active.data.current?.blockType;
      if (type && over) {
        let insertionIndex = over.data.current?.kind === "block-insert"
          ? over.data.current.index
          : draftRef.current.blocks.findIndex((item) => item.id === over.id);
        if (over.data.current?.kind !== "block-insert" && insertionIndex >= 0) {
          const draggedRect = active.rect.current.translated;
          const draggedCenter = draggedRect ? draggedRect.top + (draggedRect.height / 2) : over.rect.top;
          if (draggedCenter > over.rect.top + (over.rect.height / 2)) insertionIndex += 1;
        }
        if (insertionIndex >= 0) insertBlockAt(type, insertionIndex);
      }
      suppressTrailingPaletteClick();
      setDraggedBlockType(null);
      return;
    }

    setDraggedBlockType(null);
    if (!over || active.id === over.id) return;
    updateDraft((current) => {
      const oldIndex = current.blocks.findIndex((item) => item.id === active.id);
      const newIndex = current.blocks.findIndex((item) => item.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return current;
      return { ...current, blocks: arrayMove(current.blocks, oldIndex, newIndex) };
    });
  };

  const addBlock = (type) => {
    if (suppressPaletteClickRef.current) return;
    insertBlockAt(type, draftRef.current.blocks.length, { expand: true, scroll: true });
  };

  const removePendingBlock = () => {
    const blockId = blockPendingRemovalId;
    if (!blockId) return;
    if (expandedBlockId === blockId) setExpandedBlockId(null);
    updateDraft((current) => ({ ...current, blocks: current.blocks.filter((item) => item.id !== blockId) }));
    setBlockPendingRemovalId(null);
  };

  const attachLibraryMedia = (media) => {
    const target = mediaPickerTarget;
    if (!target || !media) return;
    const selectedMedia = (Array.isArray(media) ? media : [media]).filter(Boolean);
    if (!selectedMedia.length) return;
    if (!target.blockId) {
      const selected = selectedMedia[0];
      updateDraft((current) => ({
        ...current,
        coverUrl: selected.url,
        coverMedia: selected,
        coverAlt: current.coverAlt || selected.alt || current.title,
      }));
      return;
    }
    const targetBlock = draftRef.current?.blocks?.find((block) => block.id === target.blockId);
    const multiple = target.multiple || ["image_grid", "image_gallery"].includes(targetBlock?.blockType);
    updateDraft((current) => ({
      ...current,
      blocks: current.blocks.map((block) => {
        if (block.id !== target.blockId) return block;
        if (multiple) {
          const list = Array.isArray(block.content?.media) ? block.content.media : [];
          const next = [...list];
          selectedMedia.forEach((item) => {
            const key = item.id || item.objectKey || item.storagePath || item.url;
            const exists = next.some((existing) => (existing?.id || existing?.objectKey || existing?.storagePath || existing?.url) === key);
            if (!exists) next.push(item);
          });
          return { ...block, content: { ...block.content, media: next } };
        }
        return { ...block, content: { ...block.content, media: selectedMedia[0] } };
      }),
    }));
  };

  const upload = async (fileOrFiles, blockId = null) => {
    if (uploadingRef.current) throw new Error("Another image upload is already in progress.");
    const uploadToken = interactionEpochRef.current + 1;
    interactionEpochRef.current = uploadToken;
    setPreview(false);
    uploadingRef.current = true;
    setUploading(true);
    setError("");
    try {
      const files = (Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles]).filter(Boolean);
      if (!files.length) throw new Error("No images were selected.");
      const targetBlock = blockId
        ? draftRef.current?.blocks?.find((block) => block.id === blockId)
        : null;
      const multiple = ["image_grid", "image_gallery"].includes(targetBlock?.blockType);
      const addUploadedMedia = (media) => updateDraft((current) => {
        if (!blockId) {
          return {
            ...current,
            coverUrl: media.url,
            coverMedia: media,
            coverAlt: current.coverAlt || current.title,
          };
        }
        return { ...current, blocks: current.blocks.map((block) => {
          if (block.id !== blockId) return block;
          if (multiple) {
            const currentMedia = Array.isArray(block.content?.media) ? block.content.media : [];
            return { ...block, content: { ...block.content, media: [...currentMedia, media] } };
          }
          return { ...block, content: { ...block.content, media } };
        }) };
      });

      const uploadedMedia = [];
      const failedUploads = [];
      for (const file of files) {
        try {
          const media = await uploadPortfolioImage(project, file);
          if (!media?.id || !media?.url) throw new Error("The upload completed without valid image data.");
          uploadedMedia.push(media);
          addUploadedMedia(media);
        } catch (uploadError) {
          console.error("[upload] per-file upload error:", uploadError);
          failedUploads.push({ file, error: uploadError });
        }
      }
      if (!uploadedMedia.length) throw failedUploads[0]?.error || new Error("No images were selected.");
      if (failedUploads.length) {
        const failedNames = failedUploads.map(({ file }) => file.name).join(", ");
        throw new Error(`${uploadedMedia.length} image${uploadedMedia.length === 1 ? "" : "s"} uploaded; ${failedUploads.length} failed: ${failedNames}`);
      }
      return uploadedMedia;
    } catch (err) {
      console.error("[upload] upload failed:", err);
      const message = err.message || "Image upload failed.";
      setError(message);
      throw err;
    } finally {
      if (interactionEpochRef.current === uploadToken) {
        uploadingRef.current = false;
        setUploading(false);
      }
    }
  };

  const validation = draft ? validateProjectForPublish(draft) : [];
  if (loading) return <div className="admin-loading full-screen">Loading project editor…</div>;
  if (!draft || !project) return <div className="portfolio-admin-page"><div className="admin-notice error">{error || "Project not found."}</div><a href="/admin/dashboard?section=portfolio_projects">Back to projects</a></div>;

  return <div className="portfolio-editor-shell">
    <header className="portfolio-editor-topbar">
      <div className="topbar-main-actions">
        <a className="admin-back-button" href="/admin/dashboard?section=portfolio_projects" onClick={(event) => navigateWithUnsavedCheck(event, "/admin/dashboard?section=portfolio_projects")}><span aria-hidden="true">←</span> Back to projects</a>
        <div className={`save-state ${saveState.toLowerCase().replaceAll(" ", "-")}`}>{saveState}</div>
        <div className="topbar-publish-combo">
          <button type="button" className="save-draft-button" onClick={() => saveDraft().catch(() => {})} disabled={!dirty || saving || publishing || uploading || conflict}>{saving ? "Saving…" : "Save draft"}</button>
          <button type="button" className="primary-button publish-button" onClick={publish} disabled={publishing || saving || uploading}>{publishing ? "Publishing…" : "Publish"}</button>
        </div>
      </div>
    </header>
    {conflict && <div className="conflict-banner"><strong>Conflict detected.</strong> A newer draft was saved elsewhere. <button type="button" onClick={load}>Reload latest</button><button type="button" onClick={duplicateConflict}>Duplicate my local version</button></div>}
    {notice && <div className="floating-admin-notice success" role="status" aria-live="polite"><span className="success-check" aria-hidden="true">✓</span><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss confirmation">×</button></div>}
    {error && <div className="floating-admin-notice error">{error}<button type="button" onClick={() => setError("")}>×</button></div>}

    <main className="portfolio-editor-canvas">
      <section className="portfolio-workspace-heading">
        <div><span className="editor-eyebrow">Project studio</span><h1>{draft.title || "Untitled project"}</h1></div>
        <div className="portfolio-workspace-tabs" role="tablist" aria-label="Project workspace" data-active={workspaceTab}>
          <button type="button" role="tab" aria-selected={workspaceTab === "design"} onClick={() => openWorkspaceTab("design")}>Design</button>
          <button type="button" role="tab" aria-selected={workspaceTab === "preview"} onClick={() => openWorkspaceTab("preview")}>Preview</button>
          <button type="button" role="tab" aria-selected={workspaceTab === "publish"} onClick={() => openWorkspaceTab("publish")}>Publish</button>
          <span aria-hidden="true" />
        </div>
      </section>

      <div className={`portfolio-editor-scroll-region ${workspaceTab === "design" && designSection === "basics" ? "is-design-basics-mode" : ""} ${workspaceTab === "design" && designSection !== "basics" ? "is-design-elements-mode" : ""}`} ref={workspaceScrollRef}>
      {workspaceTab === "design" && <div className={`portfolio-design-workspace ${designSection !== "basics" ? "is-elements-mode" : ""}`}>
        <aside className="portfolio-design-sidebar">
          <div className="portfolio-design-section-tabs" role="tablist" aria-label="Design sections" aria-orientation="vertical">
            {DESIGN_SECTIONS.map((section) => <button
              type="button"
              role="tab"
              aria-selected={designSection === section}
              aria-controls={`portfolio-design-${section}`}
              key={section}
              onClick={() => setDesignSection(section)}
            >{section}</button>)}
          </div>
        </aside>

        <DndContext sensors={sensors} collisionDetection={blockCollisionDetection} onDragStart={onBlockDragStart} onDragCancel={onBlockDragCancel} onDragEnd={onBlockDragEnd}>
        <div className="portfolio-design-main">
          {designSection === "basics" && <section className="editor-spine-card" id="portfolio-design-basics" role="tabpanel">
            <span className="editor-eyebrow">Project spine</span>
            <div className="editor-spine-grid">
              <div className="editor-spine-fields">
                <Field label="Project title" value={draft.title} required onChange={(title) => updateDraft({ title })} />
                <Field label="One-line proposition" value={draft.oneLineDescription} required onChange={(oneLineDescription) => updateDraft({ oneLineDescription })} />
                <div className="editor-year-field"><Field label="Year" type="number" value={draft.yearStart} required onChange={(yearStart) => updateDraft({ yearStart, yearEnd: null })} /></div>
                <Field label="Research Question" value={draft.context} rows={4} required={!draft.workInProgress} onChange={(context) => updateDraft({ context })} />
                <Field label="Specific contribution" value={draft.specificContribution} rows={5} required={!draft.workInProgress} onChange={(specificContribution) => updateDraft({ specificContribution })} />
              </div>
              <aside className="editor-spine-media" aria-label="Project cover">
                <header><div><span className="editor-eyebrow">Cover media</span><h2>Project cover</h2></div><button type="button" className="quiet-button" onClick={() => setMediaPickerTarget({ blockId: null })}>Choose from library</button></header>
                <details className="editor-cover-settings">
                  <summary>Cover settings</summary>
                  <div className="editor-cover-settings-fields">
                    <Field label="Cover URL" value={draft.coverUrl} onChange={(coverUrl) => updateDraft({ coverUrl, coverMedia: null })} />
                    <Field label="Cover alt text (optional)" value={draft.coverAlt} onChange={(coverAlt) => updateDraft({ coverAlt })} />
                    <div className="field-row"><label className="editor-field"><span>Horizontal focal point · {draft.coverFocalX}%</span><input type="range" min="0" max="100" value={draft.coverFocalX} onChange={(event) => updateDraft({ coverFocalX: Number(event.target.value) })} /></label><label className="editor-field"><span>Vertical focal point · {draft.coverFocalY}%</span><input type="range" min="0" max="100" value={draft.coverFocalY} onChange={(event) => updateDraft({ coverFocalY: Number(event.target.value) })} /></label></div>
                  </div>
                </details>
                <PortfolioImageUploader
                  hasImages={Boolean(draft.coverUrl)}
                  onUpload={(file) => upload(file)}
                  disabled={uploading}
                  emptyLabel="Drop a project cover here"
                  filledLabel="Replace the project cover"
                />
                {draft.coverUrl ? <img className="editor-cover-preview" src={draft.coverUrl} alt={draft.coverAlt || ""} style={{ objectPosition: `${draft.coverFocalX ?? 50}% ${draft.coverFocalY ?? 50}%` }} /> : <div className="cover-placeholder editor-cover-preview">4:3 cover preview</div>}
              </aside>
            </div>
          </section>}

          {designSection === "content" && <PortfolioBlockInsertToolbar
            id="portfolio-design-content"
            title="Content elements"
            types={CONTENT_BLOCK_TYPES}
            moreTypes={CONTENT_MORE_BLOCK_TYPES}
            onAddBlock={addBlock}
          />}

          {designSection === "media" && <PortfolioBlockInsertToolbar
            id="portfolio-design-media"
            title="Media elements"
            types={MEDIA_BLOCK_TYPES}
            moreTypes={MEDIA_MORE_BLOCK_TYPES}
            labels={MEDIA_BLOCK_LABELS}
            onAddBlock={addBlock}
          />}

          {designSection !== "basics" && <section className="editor-blocks-section portfolio-content-sequence">
            <header><div><span className="editor-eyebrow">Project story</span><h2>Content sequence</h2></div><span className="portfolio-sequence-count">{draft.blocks.length} {draft.blocks.length === 1 ? "block" : "blocks"}</span></header>
            <SortableContext items={draft.blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
              <div className="editor-block-list">
                <BlockInsertionDropZone index={0} enabled={Boolean(draggedBlockType)} empty={!draft.blocks.length} />
                {draft.blocks.map((block, index) => <React.Fragment key={block.id}>
                  <div className="portfolio-sequence-block" id={`portfolio-block-${block.id}`}><PortfolioBlockEditor index={index} block={block} expanded={expandedBlockId === block.id} onToggle={() => setExpandedBlockId((current) => current === block.id ? null : block.id)} uploading={uploading} onUpload={(file) => upload(file, block.id)} onChooseMedia={(options) => setMediaPickerTarget({ blockId: block.id, ...options })} onChange={(next) => updateDraft((current) => ({ ...current, blocks: current.blocks.map((item) => item.id === block.id ? next : item) }))} onDuplicate={() => { const duplicate = { ...block, id: crypto.randomUUID() }; updateDraft((current) => { const sourceIndex = current.blocks.findIndex((item) => item.id === block.id); const next = [...current.blocks]; next.splice(sourceIndex + 1, 0, duplicate); return { ...current, blocks: next }; }); setExpandedBlockId(duplicate.id); }} onDelete={() => setBlockPendingRemovalId(block.id)} /></div>
                  <BlockInsertionDropZone index={index + 1} enabled={Boolean(draggedBlockType)} />
                </React.Fragment>)}
              </div>
            </SortableContext>
          </section>}
        </div>
        <DragOverlay dropAnimation={null}>{draggedBlockType ? <div className="portfolio-block-drag-overlay"><span className="portfolio-block-palette-grip" aria-hidden="true" /><strong>{MEDIA_BLOCK_LABELS[draggedBlockType] || BLOCK_LABELS[draggedBlockType]}</strong><small>Drop into sequence</small><span className="portfolio-block-palette-plus" aria-hidden="true">+</span></div> : null}</DragOverlay>
        </DndContext>
      </div>}

      <section className={`portfolio-inline-preview ${workspaceTab === "preview" ? "is-active" : "is-preloading"}`} aria-label="Live project preview" aria-hidden={workspaceTab !== "preview"}>
        <header className="portfolio-preview-toolbar"><label className="preview-layout-control"><span>Layout style</span><select value={draft.layoutStyle || 1} onChange={(event) => updateDraft({ layoutStyle: Number(event.target.value) })}>{LAYOUT_STYLE_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label><div className="portfolio-preview-display-controls"><button type="button" className="preview-fullscreen-button" onClick={openPreview}>Full screen</button><div className="preview-mode-switch"><button type="button" className={`preview-mode-pill ${previewDevice === "laptop" ? "active" : ""}`} onClick={() => setPreviewDevice("laptop")}>Laptop</button><button type="button" className={`preview-mode-pill ${previewDevice === "tablet" ? "active" : ""}`} onClick={() => setPreviewDevice("tablet")}>Tablet</button><button type="button" className={`preview-mode-pill ${previewDevice === "phone" ? "active" : ""}`} onClick={() => setPreviewDevice("phone")}>Phone</button></div></div></header>
        <div className={`portfolio-inline-preview-device is-${previewDevice}`}><iframe ref={inlinePreviewRef} src={`/admin/projects/preview?project=${project.id}`} onLoad={writePreviewData} title={`${draft.title} live project preview`} /></div>
      </section>

      {workspaceTab === "publish" && <section className="portfolio-publish-workspace">
        <span className="editor-eyebrow">Publish</span>
        <h2>Choose how this project goes live</h2>
        <section className="publish-slug-section" aria-labelledby="publish-slug-heading">
          <header><div><span className="editor-eyebrow">Public project URL</span><h3 id="publish-slug-heading">Project slug</h3></div><code>/work/{slugify(project.slug) || "project-slug"}</code></header>
          <div className="publish-slug-control">
            <label className="editor-field"><span>Slug</span><input value={project.slug || ""} onChange={(event) => setProject((current) => ({ ...current, slug: event.target.value }))} /></label>
            <button type="button" className="primary-button publish-slug-button" disabled={!slugify(project.slug)} onClick={() => changeSlug(project.slug)}>Save as new slug</button>
          </div>
        </section>
        <div className="publish-settings-grid">
          <section className="publish-classification-section" aria-labelledby="publish-classification-heading">
            <header><span className="editor-eyebrow">Project filters</span><h3 id="publish-classification-heading">Classification tags</h3></header>
            <TaxonomyFields terms={draft.taxonomies} onChange={(taxonomies) => updateDraft({ taxonomies })} />
          </section>
          <section className="publish-properties" aria-labelledby="publishing-heading">
            <header className="publish-properties-header"><span className="editor-eyebrow">Project settings</span><h3 id="publishing-heading">Publishing</h3></header>
            <div className="publish-properties-body">
              <section className={`publication-summary ${project.published_content ? "is-published" : "is-draft"}`}><span>Live status</span><strong>{project.published_content ? (project.status === "wip" ? "Published · Work in Progress" : "Published · Full project") : "Not published"}</strong></section>
              <fieldset className="publishing-mode-choice"><legend>Public mode</legend><button type="button" role="radio" aria-checked={!draft.workInProgress} className={!draft.workInProgress ? "is-selected" : ""} onClick={() => updateDraft({ workInProgress: false, limitedPublic: false })}><strong>Full project</strong></button><button type="button" role="radio" aria-checked={draft.workInProgress} className={draft.workInProgress ? "is-selected" : ""} onClick={() => updateDraft({ workInProgress: true, limitedPublic: true })}><strong>Work in progress</strong></button></fieldset>
              <p className="publishing-mode-helper">{draft.workInProgress ? "Research question, specific contribution, outcomes, and collaborators will be hidden from the public." : "All project details and sections will be fully visible to the public."}</p>
              {validation.length > 0 && <section className="publish-validation has-errors"><h3>{validation.length} item{validation.length === 1 ? "" : "s"} before publishing</h3><ul>{validation.map((item) => <li key={item}>{item}</li>)}</ul></section>}
              <button type="button" className="primary-button publish-button full" onClick={publish} disabled={validation.length > 0 || publishing || saving || uploading}>{publishing ? "Publishing…" : "Publish"}</button>
              <div className="publish-seo-handoff">
                <div><span className="editor-eyebrow">Search &amp; social</span><strong>SEO</strong></div>
                <a className="manage-seo-link" href={buildSeoStudioUrl(project, draft)} target="_blank" rel="noopener noreferrer">Manage SEO in SEO Studio <span aria-hidden="true">↗</span></a>
              </div>
            </div>
          </section>
        </div>
      </section>}
      </div>
    </main>

    <PortfolioMediaPicker open={Boolean(mediaPickerTarget)} multiple={Boolean(mediaPickerTarget?.multiple)} onClose={closeMediaPicker} onSelect={attachLibraryMedia} />

    {blockPendingRemovalId && <DeleteBlockDialog
      block={draft.blocks.find((block) => block.id === blockPendingRemovalId) || { blockType: "content" }}
      onCancel={() => setBlockPendingRemovalId(null)}
      onConfirm={removePendingBlock}
    />}

      <div className={`portfolio-preview-modal ${preview ? "is-open" : ""}`} role="dialog" aria-modal={preview ? "true" : undefined} aria-hidden={!preview} aria-label="Responsive project preview">
        <div className="preview-floating-controls">
          <div className="preview-mode-switch">
            <button
              type="button"
              className={`preview-mode-pill ${previewDevice === "laptop" ? "active" : ""}`}
              onClick={() => setPreviewDevice("laptop")}
            >
              Laptop
            </button>
            <button
              type="button"
              className={`preview-mode-pill ${previewDevice === "tablet" ? "active" : ""}`}
              onClick={() => setPreviewDevice("tablet")}
            >
              Tablet
            </button>
            <button
              type="button"
              className={`preview-mode-pill ${previewDevice === "phone" ? "active" : ""}`}
              onClick={() => setPreviewDevice("phone")}
            >
              Phone
            </button>
          </div>
          <div className="preview-divider" />
          <button
            type="button"
            className="preview-close-button"
            onClick={() => setPreview(false)}
            aria-label="Close preview"
          >
            &times;
          </button>
        </div>
        <div className={`preview-device is-${previewDevice}`}>
          <iframe
            ref={modalPreviewRef}
            src={`/admin/projects/preview?project=${project.id}`}
            onLoad={writePreviewData}
            title={`${draft.title} responsive preview`}
          />
        </div>
      </div>
  </div>;
}

export default function PortfolioEditor(props) {
  return <PortfolioEditorErrorBoundary {...props} />;
}
