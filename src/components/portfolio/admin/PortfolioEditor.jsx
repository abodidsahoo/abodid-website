import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import PortfolioBlockEditor from "./PortfolioBlockEditor";
import PortfolioMediaPicker from "./PortfolioMediaPicker";
import {
  createPortfolioProject,
  listAdminProjects,
  loadAdminProject,
  publishPortfolioProject,
  restorePortfolioRevision,
  savePortfolioDraft,
  updatePortfolioProjectIdentity,
  uploadPortfolioImage,
} from "../../../lib/portfolio/services";
import {
  BLOCK_LABELS,
  BLOCK_TYPES,
  PRIMARY_TERMS,
  ROLE_TERMS,
  TAXONOMY_GROUPS,
  createEmptyBlock,
  createEmptyCollaborator,
  markCollaboratorsPublished,
  normalizeTaxonomyTerm,
  slugify,
  toPublicPortfolioProjection,
  updateCollaboratorDraft,
  validateProjectForPublish,
} from "../../../lib/portfolio/schema";
import "../../../styles/portfolio-admin.css";

const Field = ({ label, value, onChange, rows = 1, type = "text", placeholder = "", required = false }) => <label className="editor-field"><span>{label}{required && <b aria-hidden="true"> *</b>}</span>{rows > 1 ? <textarea value={value || ""} rows={rows} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /> : <input type={type} value={value ?? ""} placeholder={placeholder} onChange={(event) => onChange(type === "number" ? (event.target.value ? Number(event.target.value) : null) : event.target.value)} />}</label>;
const formatRevisionDate = (value) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const LAYOUT_STYLE_OPTIONS = [
  { value: 1, label: "1: Typographic Grid" },
  { value: 2, label: "2: Columnar Narrative" },
  { value: 3, label: "3: Manifesto Block" },
  { value: 4, label: "4: Centered Statement" },
  { value: 5, label: "5: Swiss Hairline Grid" },
];

function ThemedSelect({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const optionRefs = useRef([]);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selected = options[selectedIndex];

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    requestAnimationFrame(() => optionRefs.current[selectedIndex]?.focus());
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open, selectedIndex]);

  const closeAndRefocus = () => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const handleOptionKeyDown = (event, index) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeAndRefocus();
      return;
    }
    const direction = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (!direction) return;
    event.preventDefault();
    optionRefs.current[(index + direction + options.length) % options.length]?.focus();
  };

  return <div className={`editor-field themed-select-field ${open ? "is-open" : ""}`} ref={rootRef}>
    <span>{label}</span>
    <button ref={triggerRef} type="button" className="themed-select-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <span>{selected?.label}</span><span className="themed-select-chevron" aria-hidden="true" />
    </button>
    {open && <div className="themed-select-menu" role="listbox" aria-label={label}>
      {options.map((option, index) => <button ref={(node) => { optionRefs.current[index] = node; }} type="button" role="option" aria-selected={option.value === value} className="themed-select-option" key={option.value} onKeyDown={(event) => handleOptionKeyDown(event, index)} onClick={() => { onChange(option.value); closeAndRefocus(); }}><span className="themed-select-check" aria-hidden="true">{option.value === value ? "✓" : ""}</span><span>{option.label}</span></button>)}
    </div>}
  </div>;
}

function TaxonomyField({ groupType, terms, onChange }) {
  const derivedValue = terms.filter((term) => term.groupType === groupType).map((term) => term.label).join(", ");
  const [localValue, setLocalValue] = React.useState(derivedValue);

  React.useEffect(() => {
    const norm = (s) => (s || "").split(",").map((x) => x.trim()).filter(Boolean).join(",");
    if (norm(derivedValue) !== norm(localValue)) {
      setLocalValue(derivedValue);
    }
  }, [derivedValue, localValue]);

  const handleChange = (next) => {
    setLocalValue(next);
    const keep = terms.filter((term) => term.groupType !== groupType);
    const parsed = next.split(",").map((label) => normalizeTaxonomyTerm(label, groupType)).filter(Boolean);
    onChange([...keep, ...parsed]);
  };

  return <Field label={groupType.replace("_", " ")} value={localValue} placeholder="Comma-separated controlled terms" onChange={handleChange} />;
}

function TaxonomyFields({ terms, onChange }) {
  return <div className="taxonomy-fields">{TAXONOMY_GROUPS.map((groupType) => (
    <TaxonomyField key={groupType} groupType={groupType} terms={terms} onChange={onChange} />
  ))}<datalist id="portfolio-primary-terms">{PRIMARY_TERMS.map((term) => <option key={term}>{term}</option>)}</datalist><datalist id="portfolio-role-terms">{ROLE_TERMS.map((term) => <option key={term}>{term}</option>)}</datalist></div>;
}

function RepeatableEditor({ title, items, onChange, kind }) {
  const update = (index, patch) => onChange(items.map((item, itemIndex) => {
    if (itemIndex !== index) return item;
    return kind === "collaborator" ? updateCollaboratorDraft(item, patch) : { ...item, ...patch };
  }));
  const add = () => {
    if (kind === "organisation") onChange([...items, { name: "", url: "", relationshipLabel: "" }]);
    if (kind === "collaborator") onChange([...items, createEmptyCollaborator()]);
    if (kind === "link") onChange([...items, { label: "", url: "", linkType: "external" }]);
  };
  return <section className="repeatable-editor"><header><h3>{title}</h3><button type="button" className="quiet-button" onClick={add}>+ Add</button></header>{items.map((item, index) => <div className="repeatable-row" key={item.id || index}>
    <Field label="Name / label" value={item.name ?? item.label} onChange={(value) => update(index, item.name !== undefined ? { name: value } : { label: value })} />
    {kind === "organisation" && <><Field label="Relationship" value={item.relationshipLabel} onChange={(relationshipLabel) => update(index, { relationshipLabel })} /><Field label="URL" value={item.url} onChange={(url) => update(index, { url })} /></>}
    {kind === "collaborator" && <><Field label="Project role" value={item.roleLabel} onChange={(roleLabel) => update(index, { roleLabel })} /><Field label="Organisation" value={item.organisation} onChange={(organisation) => update(index, { organisation })} /><Field label="Name link" value={item.primaryUrl} placeholder="instagram.com/handle or personal-site.com" onChange={(primaryUrl) => update(index, { primaryUrl })} /><Field label="Secondary link (optional)" value={item.secondaryUrl} placeholder="Another website or social profile" onChange={(secondaryUrl) => update(index, { secondaryUrl })} /></>}
    {kind === "link" && <><label className="editor-field"><span>Type</span><select value={item.linkType || "external"} onChange={(event) => update(index, { linkType: event.target.value })}><option value="photography">Photography</option><option value="film">Film</option><option value="website">Website</option><option value="publication">Publication</option><option value="vimeo">Vimeo</option><option value="youtube">YouTube</option><option value="external">External</option></select></label><Field label="URL" value={item.url} placeholder="example.com or https://example.com" onChange={(url) => update(index, { url })} /></>}
    <button type="button" className="quiet-button danger" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
  </div>)}</section>;
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

function PortfolioEditorContent({ projectId }) {
  const [project, setProject] = useState(null);
  const [draft, setDraft] = useState(null);
  const [history, setHistory] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saveState, setSaveState] = useState("Saved");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [uploadOverlay, setUploadOverlay] = useState(null); // null | { status: 'uploading'|'done'|'error', message: string }
  const [uploadOverlayClosing, setUploadOverlayClosing] = useState(false);
  const [preview, setPreview] = useState(false);
  const [previewDevice, setPreviewDevice] = useState("laptop");
  const [previewVersion, setPreviewVersion] = useState(0);
  const [tab, setTab] = useState("details");
  const [projectSearch, setProjectSearch] = useState("");
  const [blockMenuOpen, setBlockMenuOpen] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState(null);
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
  const filePickerSessionRef = useRef(null);
  const filePickerCooldownTimerRef = useRef(null);
  const uploadingRef = useRef(false);
  const uploadOverlayRef = useRef(null);
  const uploadOverlayCloseTimerRef = useRef(null);
  const uploadOverlayRemoveTimerRef = useRef(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);
  useEffect(() => { draftRef.current = draft; }, [draft]);

  const clearUploadOverlayTimers = useCallback(() => {
    window.clearTimeout(uploadOverlayCloseTimerRef.current);
    window.clearTimeout(uploadOverlayRemoveTimerRef.current);
    uploadOverlayCloseTimerRef.current = null;
    uploadOverlayRemoveTimerRef.current = null;
  }, []);

  const updateUploadOverlay = useCallback((nextOverlay) => {
    uploadOverlayRef.current = nextOverlay;
    setUploadOverlay(nextOverlay);
  }, []);

  const releaseFilePickerSession = useCallback((token, delay = 900) => {
    window.clearTimeout(filePickerCooldownTimerRef.current);
    filePickerCooldownTimerRef.current = window.setTimeout(() => {
      const session = filePickerSessionRef.current;
      if (session?.token === token && session.phase === "cooldown") {
        filePickerSessionRef.current = null;
      }
      filePickerCooldownTimerRef.current = null;
    }, delay);
  }, []);

  const settleFilePickerSession = useCallback(() => {
    const session = filePickerSessionRef.current;
    if (!session || session.phase !== "picker") return;
    filePickerSessionRef.current = { ...session, phase: "cooldown" };
    releaseFilePickerSession(session.token);
  }, [releaseFilePickerSession]);

  // Arm this in the input's capture phase, before Chrome opens the native file chooser.
  const beginFilePickerSession = useCallback((event) => {
    if (uploadingRef.current || uploadOverlayRef.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const token = interactionEpochRef.current + 1;
    interactionEpochRef.current = token;
    window.clearTimeout(filePickerCooldownTimerRef.current);
    filePickerCooldownTimerRef.current = null;
    filePickerSessionRef.current = { token, phase: "picker" };
    setPreview(false);
  }, []);

  useEffect(() => {
    const blockPickerClickThrough = (event) => {
      if (!filePickerSessionRef.current) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener("click", blockPickerClickThrough, true);
    window.addEventListener("mousedown", blockPickerClickThrough, true);
    window.addEventListener("mouseup", blockPickerClickThrough, true);
    window.addEventListener("pointerdown", blockPickerClickThrough, true);
    window.addEventListener("pointerup", blockPickerClickThrough, true);
    window.addEventListener("focus", settleFilePickerSession);
    return () => {
      window.removeEventListener("click", blockPickerClickThrough, true);
      window.removeEventListener("mousedown", blockPickerClickThrough, true);
      window.removeEventListener("mouseup", blockPickerClickThrough, true);
      window.removeEventListener("pointerdown", blockPickerClickThrough, true);
      window.removeEventListener("pointerup", blockPickerClickThrough, true);
      window.removeEventListener("focus", settleFilePickerSession);
    };
  }, [settleFilePickerSession]);

  useEffect(() => () => {
    window.clearTimeout(filePickerCooldownTimerRef.current);
    clearUploadOverlayTimers();
  }, [clearUploadOverlayTimers]);

  const load = useCallback(async () => {
    setLoading(true); setError(""); setConflict(false);
    try {
      const [result, allProjects] = await Promise.all([loadAdminProject(projectId), listAdminProjects()]);
      projectIdRef.current = result.project.id;
      if (window.location.pathname !== `/admin/projects/${result.project.slug}`) {
        window.history.replaceState({}, "", `/admin/projects/${result.project.slug}`);
      }
      draftRef.current = result.draft;
      dirtyRef.current = false;
      editVersionRef.current = 0;
      setProject(result.project); setDraft(result.draft); setHistory(result.history); setProjects(allProjects);
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
    if (validation.length) { setError(`Publish blocked: ${validation.join(" · ")}`); setTab("publishing"); return; }
    setPublishing(true);
    try {
      if (dirtyRef.current) await saveDraft({ showConfirmation: false });
      const publishedRevisionId = await publishPortfolioProject(projectIdRef.current);
      const refreshed = await loadAdminProject(projectIdRef.current);
      setProject(refreshed.project);
      setHistory(refreshed.history);
      const publishedDraft = {
        ...draftRef.current,
        lockVersion: refreshed.draft.lockVersion,
        collaborators: markCollaboratorsPublished(draftRef.current.collaborators),
      };
      draftRef.current = publishedDraft;
      setDraft(publishedDraft);
      setProjects((current) => current.map((item) => item.id === refreshed.project.id ? {
        ...item,
        ...refreshed.project,
        draft: { ...item.draft, title: refreshed.draft.title, cover_url: refreshed.draft.coverUrl, updated_at: new Date().toISOString() },
        published: { id: publishedRevisionId, title: refreshed.draft.title, published_at: new Date().toISOString() },
      } : item));
      setSaveState("Published");
      setNotice(refreshed.project.status === "wip" ? "Published as Work in Progress." : "Published successfully.");
    } catch (err) {
      setError(err.message || "Publishing failed. The draft is still safe.");
    } finally {
      setPublishing(false);
    }
  };
  const openPreview = () => {
    if (uploadingRef.current || uploadOverlayRef.current || filePickerSessionRef.current) return;
    try {
      const nextPreview = { ...toPublicPortfolioProjection(draftRef.current), id: project.id, slug: project.slug, status: project.status };
      window.sessionStorage.setItem(`portfolio:preview:${project.id}`, JSON.stringify(nextPreview));
      setPreviewVersion(Date.now());
      setPreview(true);
    } catch {
      // Keep the editor visible with the existing save error.
    }
  };
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
  const restore = async (revisionId) => {
    if (!window.confirm("Edit from this earlier version? The current live version will stay unchanged until you publish again.")) return;
    try { await restorePortfolioRevision(projectIdRef.current, revisionId); setNotice("Earlier version opened as an editable draft."); await load(); }
    catch (err) { setError(err.message || "Revision restore failed."); }
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
  const createNewProject = async () => {
    if (!confirmDiscardChanges()) return;
    try {
      const id = await createPortfolioProject("Untitled project");
      window.location.href = `/admin/projects/${id}`;
    } catch (err) {
      allowUnloadRef.current = false;
      setError(err.message || "Could not create a new project.");
    }
  };
  const onBlockDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    updateDraft((current) => {
      const oldIndex = current.blocks.findIndex((item) => item.id === active.id);
      const newIndex = current.blocks.findIndex((item) => item.id === over.id);
      return { ...current, blocks: arrayMove(current.blocks, oldIndex, newIndex) };
    });
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

  const upload = async (fileOrFiles, blockId = null, mediaIndex = 0) => {
    if (uploadingRef.current) return;
    const pickerSession = filePickerSessionRef.current;
    const uploadToken = pickerSession?.token || interactionEpochRef.current + 1;
    interactionEpochRef.current = Math.max(interactionEpochRef.current, uploadToken);
    window.clearTimeout(filePickerCooldownTimerRef.current);
    filePickerCooldownTimerRef.current = null;
    filePickerSessionRef.current = { token: uploadToken, phase: "uploading" };
    clearUploadOverlayTimers();
    setPreview(false);
    uploadingRef.current = true;
    setUploading(true);
    setUploadOverlayClosing(false);
    updateUploadOverlay({ status: "uploading", message: "Uploading image…" });
    setError("");
    try {
      const files = (Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles]).filter(Boolean);
      if (!files.length) throw new Error("No images were selected.");
      const temporaryMedia = files.map((file) => ({
        id: `upload-${crypto.randomUUID()}`,
        url: URL.createObjectURL(file),
        originalUrl: null,
        storagePath: null,
        originalFilename: file.name,
        mimeType: file.type,
        alt: "",
        caption: "",
        credit: "",
        focalX: 50,
        focalY: 50,
        variants: {},
        processingStatus: "uploading",
        temporary: true,
      }));

      const targetBlock = blockId
        ? draftRef.current?.blocks?.find((block) => block.id === blockId)
        : null;
      const multiple = ["image_grid", "image_gallery"].includes(targetBlock?.blockType);
      if (!blockId) {
        const temporary = temporaryMedia[0];
        updateDraft((current) => ({
          ...current,
          coverUrl: temporary.url,
          coverMedia: temporary,
          coverAlt: current.coverAlt || current.title,
        }));
      } else {
        updateDraft((current) => ({ ...current, blocks: current.blocks.map((block) => {
          if (block.id !== blockId) return block;
          if (multiple) {
            const list = Array.isArray(block.content?.media) ? block.content.media : [];
            return { ...block, content: { ...block.content, media: [...list, ...temporaryMedia] } };
          }
          return { ...block, content: { ...block.content, media: temporaryMedia[0] } };
        }) }));
      }

      const replaceTemporary = (temporaryId, media) => updateDraft((current) => {
        if (!blockId) {
          if (current.coverMedia?.id !== temporaryId) return current;
          return { ...current, coverUrl: media.url, coverMedia: media };
        }
        return { ...current, blocks: current.blocks.map((block) => {
          if (block.id !== blockId) return block;
          const currentMedia = block.content?.media;
          if (Array.isArray(currentMedia)) {
            return { ...block, content: { ...block.content, media: currentMedia.map((item) => item?.id === temporaryId ? media : item) } };
          }
          if (currentMedia?.id === temporaryId) return { ...block, content: { ...block.content, media } };
          return block;
        }) };
      });
      const removeTemporary = (temporaryId) => updateDraft((current) => {
        if (!blockId) {
          if (current.coverMedia?.id !== temporaryId) return current;
          return { ...current, coverUrl: "", coverMedia: null };
        }
        return { ...current, blocks: current.blocks.map((block) => {
          if (block.id !== blockId) return block;
          const currentMedia = block.content?.media;
          if (Array.isArray(currentMedia)) {
            return { ...block, content: { ...block.content, media: currentMedia.filter((item) => item?.id !== temporaryId) } };
          }
          if (currentMedia?.id === temporaryId) return { ...block, content: { ...block.content, media: null } };
          return block;
        }) };
      });

      const uploadedMedia = [];
      const failedUploads = [];
      for (const [i, file] of files.entries()) {
        if (files.length > 1) updateUploadOverlay({ status: "uploading", message: `Uploading image ${i + 1} of ${files.length}…` });
        try {
          const media = await uploadPortfolioImage(project, file);
          if (!media?.id || !media?.url) throw new Error("The upload completed without valid image data.");
          uploadedMedia.push(media);
          replaceTemporary(temporaryMedia[i].id, media);
          URL.revokeObjectURL(temporaryMedia[i].url);
        } catch (uploadError) {
          console.error("[upload] per-file upload error:", uploadError);
          failedUploads.push({ file, error: uploadError });
          removeTemporary(temporaryMedia[i].id);
          URL.revokeObjectURL(temporaryMedia[i].url);
        }
      }
      if (!uploadedMedia.length) throw failedUploads[0]?.error || new Error("No images were selected.");
      if (failedUploads.length) {
        const failedNames = failedUploads.map(({ file }) => file.name).join(", ");
        updateUploadOverlay({ status: "error", message: `${uploadedMedia.length} uploaded, ${failedUploads.length} failed: ${failedNames}` });
        setError(`${uploadedMedia.length} image${uploadedMedia.length === 1 ? "" : "s"} uploaded; ${failedUploads.length} failed: ${failedNames}`);
        uploadOverlayRemoveTimerRef.current = window.setTimeout(() => {
          if (interactionEpochRef.current !== uploadToken) return;
          updateUploadOverlay(null);
          setPreview(false);
          const session = filePickerSessionRef.current;
          if (session?.token === uploadToken) filePickerSessionRef.current = null;
        }, 3000);
      } else {
        updateUploadOverlay({ status: "done", message: "Original ready · optimization continues in the background" });
        uploadOverlayCloseTimerRef.current = window.setTimeout(() => {
          if (interactionEpochRef.current !== uploadToken) return;
          setUploadOverlayClosing(true);
          uploadOverlayRemoveTimerRef.current = window.setTimeout(() => {
            if (interactionEpochRef.current !== uploadToken) return;
            updateUploadOverlay(null);
            setUploadOverlayClosing(false);
            setPreview(false);
            const session = filePickerSessionRef.current;
            if (session?.token === uploadToken) filePickerSessionRef.current = null;
          }, 200);
        }, 1200);
      }
    } catch (err) {
      console.error("[upload] upload failed:", err);
      const message = err.message || "Image upload failed.";
      updateUploadOverlay({ status: "error", message });
      setError(message);
      uploadOverlayRemoveTimerRef.current = window.setTimeout(() => {
        if (interactionEpochRef.current !== uploadToken) return;
        updateUploadOverlay(null);
        setPreview(false);
        const session = filePickerSessionRef.current;
        if (session?.token === uploadToken) filePickerSessionRef.current = null;
      }, 3000);
    } finally {
      if (filePickerSessionRef.current?.token === uploadToken) {
        uploadingRef.current = false;
        setUploading(false);
        filePickerSessionRef.current = { token: uploadToken, phase: "cooldown" };
      }
    }
  };

  const projectList = useMemo(() => projects.filter((item) => (item.draft?.title || "").toLowerCase().includes(projectSearch.toLowerCase())), [projectSearch, projects]);
  const validation = draft ? validateProjectForPublish(draft) : [];
  if (loading) return <div className="admin-loading full-screen">Loading project editor…</div>;
  if (!draft || !project) return <div className="portfolio-admin-page"><div className="admin-notice error">{error || "Project not found."}</div><a href="/admin/dashboard?section=portfolio_projects">Back to projects</a></div>;

  return <div className="portfolio-editor-shell">
    {/* Upload overlay — sits at z-index 2000 (above the preview modal at 1000) and
        blocks ALL pointer events during upload so nothing else can be accidentally
        triggered by click-throughs from the OS file picker. */}
    {uploadOverlay && (
      <div className={`upload-overlay upload-overlay--${uploadOverlay.status} ${uploadOverlayClosing ? "is-closing" : ""}`} aria-live="polite" aria-label="Upload status">
        <div className="upload-overlay-card">
          <div className="upload-overlay-icon">
            {uploadOverlay.status === "uploading" && (
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2.5" strokeOpacity=".15" />
                <path d="M16 3C16 3 29 3 29 16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <animateTransform attributeName="transform" type="rotate" from="0 16 16" to="360 16 16" dur="0.8s" repeatCount="indefinite" />
                </path>
              </svg>
            )}
            {uploadOverlay.status === "done" && (
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2.5" />
                <path d="M10 16.5l4.5 4.5 8-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {uploadOverlay.status === "error" && (
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2.5" />
                <path d="M16 10v8M16 22v.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            )}
          </div>
          <p className="upload-overlay-message">{uploadOverlay.message}</p>
          {uploadOverlay.status === "uploading" && (
            <div className="upload-progress-track" role="progressbar" aria-label="Uploading">
              <div className="upload-progress-bar" />
            </div>
          )}
        </div>
      </div>
    )}
    <header className="portfolio-editor-topbar">
      <div className="topbar-left"><a className="admin-back-button" href="/admin/dashboard?section=portfolio_projects" onClick={(event) => navigateWithUnsavedCheck(event, "/admin/dashboard?section=portfolio_projects")}><span aria-hidden="true">←</span> Back to projects</a></div>
      <div className="topbar-main-actions">
        <button type="button" className="responsive-preview-button" onClick={openPreview} disabled={uploading}>Responsive preview</button>
        <div className={`save-state ${saveState.toLowerCase().replaceAll(" ", "-")}`}>{saveState}</div>
        <div className="topbar-publish-combo">
          <button type="button" className="save-draft-button" onClick={() => saveDraft().catch(() => {})} disabled={!dirty || saving || publishing || uploading || conflict}>{saving ? "Saving…" : "Save draft"}</button>
          <button type="button" className="primary-button publish-button" onClick={publish} disabled={publishing || saving || uploading}>{publishing ? "Publishing…" : "Publish"}</button>
        </div>
      </div>
      <div className="topbar-right-spacer" aria-hidden="true" />
    </header>
    {conflict && <div className="conflict-banner"><strong>Conflict detected.</strong> A newer draft was saved elsewhere. <button type="button" onClick={load}>Reload latest</button><button type="button" onClick={duplicateConflict}>Duplicate my local version</button></div>}
    {notice && <div className="floating-admin-notice success" role="status" aria-live="polite"><span className="success-check" aria-hidden="true">✓</span><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss confirmation">×</button></div>}
    {error && <div className="floating-admin-notice error">{error}<button type="button" onClick={() => setError("")}>×</button></div>}

    <aside className="portfolio-editor-left">
      <header><h2>All Projects</h2><button type="button" className="quiet-button" onClick={createNewProject}>+ Add</button></header><input type="search" value={projectSearch} onChange={(event) => setProjectSearch(event.target.value)} placeholder="Search projects" /><nav>{projectList.map((item) => <a key={item.id} href={`/admin/projects/${item.slug}`} onClick={(event) => navigateWithUnsavedCheck(event, `/admin/projects/${item.slug}`)} className={item.id === project.id ? "active" : ""}>{item.draft?.cover_url ? <img src={item.draft.cover_url} alt="" /> : <span className="nav-placeholder" /> }<span><strong>{item.draft?.title || "Untitled"}</strong><small>{item.status === "wip" ? "WIP" : item.status}</small></span></a>)}</nav>
    </aside>

    <main className="portfolio-editor-canvas">
      <section className="editor-spine-card">
        <span className="editor-eyebrow">Project spine</span>
        <Field label="Project title" value={draft.title} required onChange={(title) => updateDraft({ title })} />
        <Field label="One-line proposition" value={draft.oneLineDescription} required onChange={(oneLineDescription) => updateDraft({ oneLineDescription })} />
        <div className="field-row"><Field label="Start year" type="number" value={draft.yearStart} required onChange={(yearStart) => updateDraft({ yearStart })} /><Field label="End year" type="number" value={draft.yearEnd} onChange={(yearEnd) => updateDraft({ yearEnd })} /></div>
        <Field label="Research Question" value={draft.context} rows={4} required={!draft.workInProgress} onChange={(context) => updateDraft({ context })} />
        <Field label="Specific contribution" value={draft.specificContribution} rows={5} required={!draft.workInProgress} onChange={(specificContribution) => updateDraft({ specificContribution })} />
      </section>

      <section className="editor-cover-card">
        <header><div><span className="editor-eyebrow">Cover media</span><h2>Project cover</h2></div><div className="cover-media-actions"><button type="button" className="quiet-button" onClick={() => setMediaPickerTarget({ blockId: null })}>Choose from library</button><label className={`file-button${uploading ? " is-uploading" : ""}`}>{uploading ? "Uploading…" : "Upload cover"}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading} onClickCapture={beginFilePickerSession} onCancel={settleFilePickerSession} onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) upload(file).catch((err) => { console.error("[cover upload] unhandled:", err); setError(err?.message || "Image upload failed."); setUploading(false); updateUploadOverlay(null); });
          else settleFilePickerSession();
          event.target.value = "";
        }} /></label></div></header>
        {draft.coverUrl ? <img src={draft.coverUrl} alt={draft.coverAlt || ""} style={{ objectPosition: `${draft.coverFocalX ?? 50}% ${draft.coverFocalY ?? 50}%` }} /> : <div className="cover-placeholder">4:3 cover preview</div>}
        <Field label="Cover URL" value={draft.coverUrl} onChange={(coverUrl) => updateDraft({ coverUrl, coverMedia: null })} />
        <Field label="Cover alt text (optional)" value={draft.coverAlt} onChange={(coverAlt) => updateDraft({ coverAlt })} />
        <div className="field-row"><label className="editor-field"><span>Horizontal focal point · {draft.coverFocalX}%</span><input type="range" min="0" max="100" value={draft.coverFocalX} onChange={(event) => updateDraft({ coverFocalX: Number(event.target.value) })} /></label><label className="editor-field"><span>Vertical focal point · {draft.coverFocalY}%</span><input type="range" min="0" max="100" value={draft.coverFocalY} onChange={(event) => updateDraft({ coverFocalY: Number(event.target.value) })} /></label></div>
      </section>

      <section className="editor-blocks-section">
        <header><div><span className="editor-eyebrow">Project story</span><h2>Content blocks</h2></div><div className="add-block-wrap"><button type="button" className="primary-button" onClick={() => setBlockMenuOpen((value) => !value)}>+ Add block</button>{blockMenuOpen && <div className="add-block-menu">{BLOCK_TYPES.map((type) => <button type="button" key={type} onClick={() => { updateDraft((current) => ({ ...current, blocks: [...current.blocks, createEmptyBlock(type)] })); setBlockMenuOpen(false); }}>{BLOCK_LABELS[type]}</button>)}</div>}</div></header>
        {draft.blocks.length ? <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onBlockDragEnd}><SortableContext items={draft.blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}><div className="editor-block-list">{draft.blocks.map((block) => <PortfolioBlockEditor key={block.id} block={block} uploading={uploading} onUpload={(file, index) => upload(file, block.id, index)} onChooseMedia={(options) => setMediaPickerTarget({ blockId: block.id, ...options })} onFilePickerOpen={beginFilePickerSession} onFilePickerCancel={settleFilePickerSession} onChange={(next) => updateDraft((current) => ({ ...current, blocks: current.blocks.map((item) => item.id === block.id ? next : item) }))} onDuplicate={() => updateDraft((current) => { const index = current.blocks.findIndex((item) => item.id === block.id); const next = [...current.blocks]; next.splice(index + 1, 0, { ...block, id: crypto.randomUUID() }); return { ...current, blocks: next }; })} onDelete={() => { if (!window.confirm("Delete this block from the draft?")) return; updateDraft((current) => ({ ...current, blocks: current.blocks.filter((item) => item.id !== block.id) })); }} />)}</div></SortableContext></DndContext> : <div className="editor-empty-blocks">Start with a controlled block. Templates create these same ordinary blocks.</div>}
      </section>
    </main>

    <aside className="portfolio-editor-right">
      <div className="property-tabs" role="tablist" aria-label="Project properties">{["details", "classification", "people", "links", "seo", "publishing"].map((item) => <button type="button" role="tab" aria-selected={tab === item} key={item} onClick={() => setTab(item)}>{item}</button>)}</div><div className="property-panel">
        {tab === "details" && <><Field label="Public slug" value={project.slug} onChange={(value) => setProject((current) => ({ ...current, slug: value }))} /><button type="button" className="quiet-button" onClick={() => changeSlug(project.slug)}>Save explicit slug</button><ThemedSelect label="Layout style" value={draft.layoutStyle || 1} options={LAYOUT_STYLE_OPTIONS} onChange={(layoutStyle) => updateDraft({ layoutStyle })} /><Field label="Location" value={draft.location} onChange={(location) => updateDraft({ location })} /><Field label="Duration" value={draft.duration} onChange={(duration) => updateDraft({ duration })} /><Field label="Outcome heading" value={draft.outcomeHeading} onChange={(outcomeHeading) => updateDraft({ outcomeHeading })} /><Field label="Outcome text" value={draft.outcomeText} rows={5} onChange={(outcomeText) => updateDraft({ outcomeText })} /></>}

        {tab === "classification" && <TaxonomyFields terms={draft.taxonomies} onChange={(taxonomies) => updateDraft({ taxonomies })} />}
        {tab === "people" && <><RepeatableEditor kind="organisation" title="Organisations" items={draft.organisations} onChange={(organisations) => updateDraft({ organisations })} /><RepeatableEditor kind="collaborator" title="Collaborators" items={draft.collaborators} onChange={(collaborators) => updateDraft({ collaborators })} /></>}
        {tab === "links" && <RepeatableEditor kind="link" title="External Links" items={draft.links} onChange={(links) => updateDraft({ links })} />}
        {tab === "seo" && <><Field label="SEO title" value={draft.seoTitle} onChange={(seoTitle) => updateDraft({ seoTitle })} /><Field label="Meta description" value={draft.metaDescription} rows={4} onChange={(metaDescription) => updateDraft({ metaDescription })} /><Field label="Social image URL" value={draft.socialImageUrl} onChange={(socialImageUrl) => updateDraft({ socialImageUrl })} /><label className="toggle-field"><input type="checkbox" checked={draft.searchVisible} onChange={(event) => updateDraft({ searchVisible: event.target.checked })} /> Include in search and portfolio sitemap</label></>}
        {tab === "publishing" && <><section className={`publication-summary ${project.published_revision_id ? "is-published" : "is-draft"}`}><span>Live status</span><strong>{project.published_revision_id ? (project.status === "wip" ? "Published · Work in Progress" : "Published · Full project") : "Not published"}</strong></section><fieldset className="publishing-mode-choice"><legend>Public mode</legend><button type="button" role="radio" aria-checked={!draft.workInProgress} className={!draft.workInProgress ? "is-selected" : ""} onClick={() => updateDraft({ workInProgress: false, limitedPublic: false })}><strong>Full project</strong><span>Publish all visible project information.</span></button><button type="button" role="radio" aria-checked={draft.workInProgress} className={draft.workInProgress ? "is-selected" : ""} onClick={() => updateDraft({ workInProgress: true, limitedPublic: true })}><strong>Work in progress</strong><span>Publish the cover, summary and visible blocks while keeping incomplete details private.</span></button></fieldset><section className={validation.length ? "publish-validation has-errors" : "publish-validation is-ready"}><h3>{validation.length ? `${validation.length} item${validation.length === 1 ? "" : "s"} before publishing` : "Ready to publish"}</h3>{validation.length > 0 && <ul>{validation.map((item) => <li key={item}>{item}</li>)}</ul>}</section><button type="button" className="primary-button publish-button full" onClick={publish} disabled={validation.length > 0 || publishing || saving || uploading}>{publishing ? "Publishing…" : "Publish"}</button><section className="revision-history"><h3>Version history</h3>{history.length ? <><div className="revision-current"><span>Current live</span><strong>v{history[0].revision_number}</strong><small>{formatRevisionDate(history[0].published_at)}</small></div>{history.length > 1 && <details><summary>Earlier versions ({history.length - 1})</summary><div className="revision-earlier-list">{history.slice(1).map((revision) => <div key={revision.id}><span><strong>v{revision.revision_number}</strong><small>{formatRevisionDate(revision.published_at)}</small></span><button type="button" className="quiet-button" onClick={() => restore(revision.id)}>Edit from this version</button></div>)}</div></details>}</> : <p>No published versions yet.</p>}</section></>}
      </div>
    </aside>

    <PortfolioMediaPicker open={Boolean(mediaPickerTarget)} multiple={Boolean(mediaPickerTarget?.multiple)} onClose={closeMediaPicker} onSelect={attachLibraryMedia} />

    {preview && (
      <div className="portfolio-preview-modal" role="dialog" aria-modal="true" aria-label="Responsive project preview">
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
            key={`${previewVersion}-${previewDevice}`}
            src={`/admin/projects/preview?project=${project.id}&v=${previewVersion}`}
            title={`${draft.title} responsive preview`}
          />
        </div>
      </div>
    )}
  </div>;
}

export default function PortfolioEditor(props) {
  return <PortfolioEditorErrorBoundary {...props} />;
}
