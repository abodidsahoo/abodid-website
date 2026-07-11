import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import PortfolioBlockEditor from "./PortfolioBlockEditor";
import {
  createPortfolioProject,
  deletePortfolioImage,
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
  normalizeTaxonomyTerm,
  slugify,
  validateProjectForPublish,
} from "../../../lib/portfolio/schema";
import "../../../styles/portfolio-admin.css";

const Field = ({ label, value, onChange, rows = 1, type = "text", placeholder = "", required = false }) => <label className="editor-field"><span>{label}{required && <b aria-hidden="true"> *</b>}</span>{rows > 1 ? <textarea value={value || ""} rows={rows} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /> : <input type={type} value={value ?? ""} placeholder={placeholder} onChange={(event) => onChange(type === "number" ? (event.target.value ? Number(event.target.value) : null) : event.target.value)} />}</label>;
const formatRevisionDate = (value) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

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
  const update = (index, patch) => onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const add = () => {
    if (kind === "organisation") onChange([...items, { name: "", url: "", relationshipLabel: "" }]);
    if (kind === "collaborator") onChange([...items, { name: "", roleLabel: "", primaryUrl: "", secondaryUrl: "", organisation: "" }]);
    if (kind === "link") onChange([...items, { label: "", url: "", linkType: "external" }]);
  };
  return <section className="repeatable-editor"><header><h3>{title}</h3><button type="button" className="quiet-button" onClick={add}>+ Add</button></header>{items.map((item, index) => <div className="repeatable-row" key={item.id || index}>
    <Field label="Name / label" value={item.name ?? item.label} onChange={(value) => update(index, item.name !== undefined ? { name: value } : { label: value })} />
    {kind === "organisation" && <><Field label="Relationship" value={item.relationshipLabel} onChange={(relationshipLabel) => update(index, { relationshipLabel })} /><Field label="URL" value={item.url} onChange={(url) => update(index, { url })} /></>}
    {kind === "collaborator" && <><Field label="Project role" value={item.roleLabel} onChange={(roleLabel) => update(index, { roleLabel })} /><Field label="Organisation" value={item.organisation} onChange={(organisation) => update(index, { organisation })} /><Field label="Primary URL" value={item.primaryUrl} onChange={(primaryUrl) => update(index, { primaryUrl })} /><Field label="Secondary URL" value={item.secondaryUrl} onChange={(secondaryUrl) => update(index, { secondaryUrl })} /></>}
    {kind === "link" && <><label className="editor-field"><span>Type</span><select value={item.linkType || "external"} onChange={(event) => update(index, { linkType: event.target.value })}><option value="photography">Photography</option><option value="film">Film</option><option value="website">Website</option><option value="publication">Publication</option><option value="vimeo">Vimeo</option><option value="youtube">YouTube</option><option value="external">External</option></select></label><Field label="URL" value={item.url} onChange={(url) => update(index, { url })} /></>}
    <button type="button" className="quiet-button danger" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
  </div>)}</section>;
}

export default function PortfolioEditor({ projectId }) {
  const [project, setProject] = useState(null);
  const [draft, setDraft] = useState(null);
  const [history, setHistory] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saveState, setSaveState] = useState("Saved");
  const [dirty, setDirty] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [preview, setPreview] = useState(false);
  const [previewMobile, setPreviewMobile] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [tab, setTab] = useState("details");
  const [projectSearch, setProjectSearch] = useState("");
  const [blockMenuOpen, setBlockMenuOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const dirtyRef = useRef(false);
  const draftRef = useRef(null);
  const projectIdRef = useRef(null);
  const savePromiseRef = useRef(null);
  const pendingMediaDeletesRef = useRef(new Map());
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const cacheKey = `portfolio:draft:${projectId}`;

  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);
  useEffect(() => { draftRef.current = draft; }, [draft]);

  const load = useCallback(async () => {
    setLoading(true); setError(""); setConflict(false);
    try {
      const [result, allProjects] = await Promise.all([loadAdminProject(projectId), listAdminProjects()]);
      projectIdRef.current = result.project.id;
      if (window.location.pathname !== `/admin/projects/${result.project.slug}`) {
        window.history.replaceState({}, "", `/admin/projects/${result.project.slug}`);
      }
      const cached = localStorage.getItem(cacheKey);
      let nextDraft = result.draft;
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          (parsed.pendingMediaDeletes || []).forEach((media) => {
            if (media?.id && media?.storagePath) pendingMediaDeletesRef.current.set(media.id, media);
          });
          if (!parsed.cleanupOnly && parsed.savedAt > new Date(result.project.updated_at).getTime() && window.confirm("A newer emergency draft exists on this device. Restore it?")) {
            nextDraft = { ...parsed.draft, lockVersion: result.draft.lockVersion, id: result.draft.id };
            setDirty(true);
            setSaveState("Recovered locally");
          }
        } catch { localStorage.removeItem(cacheKey); }
      }
      setProject(result.project); setDraft(nextDraft); setHistory(result.history); setProjects(allProjects);
      if (nextDraft === result.draft) { setDirty(false); setSaveState("Saved"); }
    } catch (err) {
      if (err.message === "ADMIN_AUTH_REQUIRED") window.location.href = `/admin/login?next=/admin/projects/${projectId}`;
      else setError(err.message || "Could not load this project.");
    } finally { setLoading(false); }
  }, [cacheKey, projectId]);
  useEffect(() => { load(); }, [load]);

  const updateDraft = (updater) => {
    setDraft((current) => typeof updater === "function" ? updater(current) : { ...current, ...updater });
    setDirty(true); dirtyRef.current = true; setSaveState("Unsaved changes"); setConflict(false);
  };

  const queueMediaForDeletion = useCallback((media) => {
    if (!media?.id || !media?.storagePath) return;
    pendingMediaDeletesRef.current.set(media.id, media);
  }, []);

  const flushPendingMediaDeletes = useCallback(async () => {
    const queued = [...pendingMediaDeletesRef.current.values()];
    if (!queued.length) return;
    pendingMediaDeletesRef.current.clear();
    const results = await Promise.allSettled(queued.map((media) => deletePortfolioImage(media)));
    let retainedByHistory = 0;
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        pendingMediaDeletesRef.current.set(queued[index].id, queued[index]);
        setError(`Draft saved, but ${queued[index].originalFilename || "an uploaded image"} could not be removed from storage yet.`);
      } else if (result.value.reason === "referenced") {
        retainedByHistory += 1;
      }
    });
    if (retainedByHistory > 0) {
      setNotice(`${retainedByHistory} removed image${retainedByHistory === 1 ? " was" : "s were"} kept in protected storage because a published or recoverable revision still uses it.`);
    }
    if (pendingMediaDeletesRef.current.size > 0) {
      localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), cleanupOnly: true, draft: draftRef.current, pendingMediaDeletes: [...pendingMediaDeletesRef.current.values()] }));
    } else if (!dirtyRef.current) {
      localStorage.removeItem(cacheKey);
    }
  }, [cacheKey]);

  const saveNow = useCallback(async () => {
    if (!dirtyRef.current || !draftRef.current || savePromiseRef.current) return savePromiseRef.current;
    setSaveState("Saving…"); setError("");
    const currentDraft = draftRef.current;
    const promise = savePortfolioDraft(projectIdRef.current, currentDraft).then(async (nextLockVersion) => {
      setDraft((value) => ({ ...value, lockVersion: Number(nextLockVersion) }));
      setDirty(false); dirtyRef.current = false; setSaveState("Saved"); localStorage.removeItem(cacheKey);
      setProject((value) => ({ ...value, updated_at: new Date().toISOString() }));
      await flushPendingMediaDeletes();
      return nextLockVersion;
    }).catch((err) => {
      localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), draft: currentDraft, pendingMediaDeletes: [...pendingMediaDeletesRef.current.values()] }));
      if (err.code === "PORTFOLIO_CONFLICT" || err.message === "PORTFOLIO_CONFLICT") { setConflict(true); setSaveState("Conflict detected"); }
      else { setSaveState(navigator.onLine ? "Save failed - retrying" : "Offline - stored locally"); setError(err.message || "Draft save failed."); }
      throw err;
    }).finally(() => { savePromiseRef.current = null; });
    savePromiseRef.current = promise;
    return promise;
  }, [cacheKey, flushPendingMediaDeletes, projectId]);

  useEffect(() => {
    if (!dirty || conflict) return;
    const timeout = window.setTimeout(() => saveNow().catch(() => {}), 2500);
    return () => window.clearTimeout(timeout);
  }, [dirty, conflict, draft, saveNow]);
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (dirtyRef.current && !conflict) saveNow().catch(() => {});
      else if (pendingMediaDeletesRef.current.size > 0 && navigator.onLine) flushPendingMediaDeletes().catch(() => {});
    }, 30000);
    const beforeUnload = () => {
      if ((dirtyRef.current || pendingMediaDeletesRef.current.size > 0) && draftRef.current) {
        localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), draft: draftRef.current, pendingMediaDeletes: [...pendingMediaDeletesRef.current.values()] }));
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => { window.clearInterval(interval); window.removeEventListener("beforeunload", beforeUnload); };
  }, [cacheKey, conflict, flushPendingMediaDeletes, saveNow]);

  const publish = async () => {
    setError(""); setNotice("");
    const validation = validateProjectForPublish(draftRef.current);
    if (validation.length) { setError(`Publish blocked: ${validation.join(" · ")}`); setTab("publishing"); return; }
    setPublishing(true);
    try {
      if (dirtyRef.current) await saveNow();
      const publishedRevisionId = await publishPortfolioProject(projectIdRef.current);
      const refreshed = await loadAdminProject(projectIdRef.current);
      setProject(refreshed.project);
      setHistory(refreshed.history);
      setDraft((current) => ({ ...current, lockVersion: refreshed.draft.lockVersion }));
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
  const openPreview = async () => {
    try {
      if (dirtyRef.current) await saveNow();
      const nextPreview = { ...draftRef.current, id: project.id, slug: project.slug, status: project.status };
      window.sessionStorage.setItem(`portfolio:preview:${project.id}`, JSON.stringify(nextPreview));
      setPreviewVersion(Date.now());
      setPreview(true);
    } catch {
      // Keep the editor visible with the existing save error.
    }
  };
  const navigateAfterSave = async (event, href) => {
    event.preventDefault();
    try { if (dirtyRef.current && !conflict) await saveNow(); }
    catch { return; }
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
  const onBlockDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    updateDraft((current) => {
      const oldIndex = current.blocks.findIndex((item) => item.id === active.id);
      const newIndex = current.blocks.findIndex((item) => item.id === over.id);
      return { ...current, blocks: arrayMove(current.blocks, oldIndex, newIndex) };
    });
  };
  const upload = async (file, blockId = null, mediaIndex = 0) => {
    setUploading(true); setError("");
    try {
      const media = await uploadPortfolioImage(project, file);
      if (!blockId) updateDraft({ coverUrl: media.url, coverAlt: media.alt || draft.title });
      else {
        const targetBlock = draftRef.current?.blocks?.find((block) => block.id === blockId);
        const targetMedia = Array.isArray(targetBlock?.content?.media)
          ? targetBlock.content.media[mediaIndex]
          : targetBlock?.content?.media;
        queueMediaForDeletion(targetMedia);
        updateDraft((current) => ({ ...current, blocks: current.blocks.map((block) => {
        if (block.id !== blockId) return block;
        if (["image_grid", "image_gallery"].includes(block.blockType)) {
          const list = Array.isArray(block.content.media) ? [...block.content.media] : [];
          list[mediaIndex] = media;
          return { ...block, content: { ...block.content, media: list } };
        }
        return { ...block, content: { ...block.content, media } };
        }) }));
      }
    } catch (err) { setError(err.message || "Image upload failed."); }
    finally { setUploading(false); }
  };

  const projectList = useMemo(() => projects.filter((item) => (item.draft?.title || "").toLowerCase().includes(projectSearch.toLowerCase())), [projectSearch, projects]);
  const validation = draft ? validateProjectForPublish(draft) : [];
  if (loading) return <div className="admin-loading full-screen">Loading project editor…</div>;
  if (!draft || !project) return <div className="portfolio-admin-page"><div className="admin-notice error">{error || "Project not found."}</div><a href="/admin/projects">Back to projects</a></div>;

  return <div className={`portfolio-editor-shell ${leftCollapsed ? "left-collapsed" : ""} ${rightCollapsed ? "right-collapsed" : ""}`}>
    <header className="portfolio-editor-topbar">
      <div className="topbar-left"><a href="/admin/projects" onClick={(event) => navigateAfterSave(event, "/admin/projects")}>← Projects</a><a href="/admin/dashboard" onClick={(event) => navigateAfterSave(event, "/admin/dashboard")}>Admin home</a></div>
      <div className={`save-state ${saveState.toLowerCase().replaceAll(" ", "-")}`}>{saveState}</div>
      <div className="topbar-actions"><button type="button" onClick={openPreview}>Responsive preview</button><button type="button" className="primary-button publish-button" onClick={publish} disabled={publishing}>{publishing ? "Publishing…" : "Publish"}</button></div>
    </header>
    {conflict && <div className="conflict-banner"><strong>Conflict detected.</strong> A newer draft was saved elsewhere. <button type="button" onClick={load}>Reload latest</button><button type="button" onClick={duplicateConflict}>Duplicate my local version</button></div>}
    {notice && <div className="floating-admin-notice success">{notice}<button type="button" onClick={() => setNotice("")}>×</button></div>}
    {error && <div className="floating-admin-notice error">{error}<button type="button" onClick={() => setError("")}>×</button></div>}

    <aside className="portfolio-editor-left">
      <button type="button" className="panel-collapse" onClick={() => setLeftCollapsed((value) => !value)} aria-label={leftCollapsed ? "Show project navigation" : "Hide project navigation"}>{leftCollapsed ? <><span>Show projects</span><span aria-hidden="true">→</span></> : <><span aria-hidden="true">←</span><span>Hide projects</span></>}</button>
      {!leftCollapsed && <><header><h2>Projects</h2><button type="button" className="quiet-button" onClick={async () => { if (dirtyRef.current) { try { await saveNow(); } catch { return; } } const id = await createPortfolioProject("Untitled project"); window.location.href = `/admin/projects/${id}`; }}>+ Add</button></header><input type="search" value={projectSearch} onChange={(event) => setProjectSearch(event.target.value)} placeholder="Search projects" /><nav>{projectList.map((item) => <a key={item.id} href={`/admin/projects/${item.slug}`} onClick={(event) => navigateAfterSave(event, `/admin/projects/${item.slug}`)} className={item.id === project.id ? "active" : ""}>{item.draft?.cover_url ? <img src={item.draft.cover_url} alt="" /> : <span className="nav-placeholder" /> }<span><strong>{item.draft?.title || "Untitled"}</strong><small>{item.status === "wip" ? "WIP" : item.status}</small></span></a>)}</nav></>}
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
        <header><div><span className="editor-eyebrow">Cover media</span><h2>Project cover</h2></div><label className="file-button">{uploading ? "Uploading…" : "Upload cover"}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) upload(file); event.target.value = ""; }} /></label></header>
        {draft.coverUrl ? <img src={draft.coverUrl} alt="" style={{ objectPosition: `${draft.coverFocalX}% ${draft.coverFocalY}%` }} /> : <div className="cover-placeholder">4:3 cover preview</div>}
        <Field label="Cover URL" value={draft.coverUrl} onChange={(coverUrl) => updateDraft({ coverUrl })} />
        <Field label="Cover alt text" value={draft.coverAlt} required onChange={(coverAlt) => updateDraft({ coverAlt })} />
        <div className="field-row"><label className="editor-field"><span>Horizontal focal point · {draft.coverFocalX}%</span><input type="range" min="0" max="100" value={draft.coverFocalX} onChange={(event) => updateDraft({ coverFocalX: Number(event.target.value) })} /></label><label className="editor-field"><span>Vertical focal point · {draft.coverFocalY}%</span><input type="range" min="0" max="100" value={draft.coverFocalY} onChange={(event) => updateDraft({ coverFocalY: Number(event.target.value) })} /></label></div>
      </section>

      <section className="editor-blocks-section">
        <header><div><span className="editor-eyebrow">Project story</span><h2>Content blocks</h2></div><div className="add-block-wrap"><button type="button" className="primary-button" onClick={() => setBlockMenuOpen((value) => !value)}>+ Add block</button>{blockMenuOpen && <div className="add-block-menu">{BLOCK_TYPES.map((type) => <button type="button" key={type} onClick={() => { updateDraft((current) => ({ ...current, blocks: [...current.blocks, createEmptyBlock(type)] })); setBlockMenuOpen(false); }}>{BLOCK_LABELS[type]}</button>)}</div>}</div></header>
        {draft.blocks.length ? <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onBlockDragEnd}><SortableContext items={draft.blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}><div className="editor-block-list">{draft.blocks.map((block) => <PortfolioBlockEditor key={block.id} block={block} uploading={uploading} onUpload={(file, index) => upload(file, block.id, index)} onRemoveMedia={queueMediaForDeletion} onChange={(next) => updateDraft((current) => ({ ...current, blocks: current.blocks.map((item) => item.id === block.id ? next : item) }))} onDuplicate={() => updateDraft((current) => { const index = current.blocks.findIndex((item) => item.id === block.id); const next = [...current.blocks]; next.splice(index + 1, 0, { ...block, id: crypto.randomUUID() }); return { ...current, blocks: next }; })} onDelete={() => { if (!window.confirm("Delete this block from the draft?")) return; const media = Array.isArray(block.content?.media) ? block.content.media : block.content?.media ? [block.content.media] : []; media.forEach(queueMediaForDeletion); updateDraft((current) => ({ ...current, blocks: current.blocks.filter((item) => item.id !== block.id) })); }} />)}</div></SortableContext></DndContext> : <div className="editor-empty-blocks">Start with a controlled block. Templates create these same ordinary blocks.</div>}
      </section>
    </main>

    <aside className="portfolio-editor-right">
      <button type="button" className="panel-collapse" onClick={() => setRightCollapsed((value) => !value)} aria-label={rightCollapsed ? "Show project details" : "Hide project details"}>{rightCollapsed ? <><span aria-hidden="true">←</span><span>Show details</span></> : <><span>Hide details</span><span aria-hidden="true">→</span></>}</button>
      {!rightCollapsed && <><div className="property-tabs" role="tablist">{["details", "classification", "people", "links", "seo", "publishing"].map((item) => <button type="button" role="tab" aria-selected={tab === item} key={item} onClick={() => setTab(item)}>{item}</button>)}</div><div className="property-panel">
        {tab === "details" && <><Field label="Public slug" value={project.slug} onChange={(value) => setProject((current) => ({ ...current, slug: value }))} /><button type="button" className="quiet-button" onClick={() => changeSlug(project.slug)}>Save explicit slug</button><label className="editor-field"><span>Layout style</span><select value={draft.layoutStyle || 1} onChange={(event) => updateDraft({ layoutStyle: Number(event.target.value) })}><option value={1}>1: Typographic Grid</option><option value={2}>2: Columnar Narrative</option><option value={3}>3: Manifesto Block</option><option value={4}>4: Centered Statement</option><option value={5}>5: Swiss Hairline Grid</option></select></label><Field label="Location" value={draft.location} onChange={(location) => updateDraft({ location })} /><Field label="Duration" value={draft.duration} onChange={(duration) => updateDraft({ duration })} /><Field label="Outcome heading" value={draft.outcomeHeading} onChange={(outcomeHeading) => updateDraft({ outcomeHeading })} /><Field label="Outcome text" value={draft.outcomeText} rows={5} onChange={(outcomeText) => updateDraft({ outcomeText })} /></>}

        {tab === "classification" && <TaxonomyFields terms={draft.taxonomies} onChange={(taxonomies) => updateDraft({ taxonomies })} />}
        {tab === "people" && <><RepeatableEditor kind="organisation" title="Organisations" items={draft.organisations} onChange={(organisations) => updateDraft({ organisations })} /><RepeatableEditor kind="collaborator" title="Collaborators" items={draft.collaborators} onChange={(collaborators) => updateDraft({ collaborators })} /></>}
        {tab === "links" && <RepeatableEditor kind="link" title="Photography, Film and external links" items={draft.links} onChange={(links) => updateDraft({ links })} />}
        {tab === "seo" && <><Field label="SEO title" value={draft.seoTitle} onChange={(seoTitle) => updateDraft({ seoTitle })} /><Field label="Meta description" value={draft.metaDescription} rows={4} onChange={(metaDescription) => updateDraft({ metaDescription })} /><Field label="Social image URL" value={draft.socialImageUrl} onChange={(socialImageUrl) => updateDraft({ socialImageUrl })} /><label className="toggle-field"><input type="checkbox" checked={draft.searchVisible} onChange={(event) => updateDraft({ searchVisible: event.target.checked })} /> Include in search and portfolio sitemap</label></>}
        {tab === "publishing" && <><section className={`publication-summary ${project.published_revision_id ? "is-published" : "is-draft"}`}><span>Live status</span><strong>{project.published_revision_id ? (project.status === "wip" ? "Published · Work in Progress" : "Published · Full project") : "Not published"}</strong></section><fieldset className="publishing-mode-choice"><legend>Public mode</legend><button type="button" role="radio" aria-checked={!draft.workInProgress} className={!draft.workInProgress ? "is-selected" : ""} onClick={() => updateDraft({ workInProgress: false, limitedPublic: false })}><strong>Full project</strong><span>Publish all visible project information.</span></button><button type="button" role="radio" aria-checked={draft.workInProgress} className={draft.workInProgress ? "is-selected" : ""} onClick={() => updateDraft({ workInProgress: true, limitedPublic: true })}><strong>Work in progress</strong><span>Publish the cover, summary and visible blocks while keeping incomplete details private.</span></button></fieldset><section className={validation.length ? "publish-validation has-errors" : "publish-validation is-ready"}><h3>{validation.length ? `${validation.length} item${validation.length === 1 ? "" : "s"} before publishing` : "Ready to publish"}</h3>{validation.length > 0 && <ul>{validation.map((item) => <li key={item}>{item}</li>)}</ul>}</section><button type="button" className="primary-button publish-button full" onClick={publish} disabled={validation.length > 0 || publishing}>{publishing ? "Publishing…" : "Publish"}</button><section className="revision-history"><h3>Version history</h3>{history.length ? <><div className="revision-current"><span>Current live</span><strong>v{history[0].revision_number}</strong><small>{formatRevisionDate(history[0].published_at)}</small></div>{history.length > 1 && <details><summary>Earlier versions ({history.length - 1})</summary><div className="revision-earlier-list">{history.slice(1).map((revision) => <div key={revision.id}><span><strong>v{revision.revision_number}</strong><small>{formatRevisionDate(revision.published_at)}</small></span><button type="button" className="quiet-button" onClick={() => restore(revision.id)}>Edit from this version</button></div>)}</div></details>}</> : <p>No published versions yet.</p>}</section></>}
      </div></>}
    </aside>

    {preview && <div className="portfolio-preview-modal" role="dialog" aria-modal="true" aria-label="Responsive project preview"><header><span>Production renderer preview · {previewMobile ? "Mobile 390px" : "Desktop"}</span><div><button type="button" onClick={() => setPreviewMobile((value) => !value)}>{previewMobile ? "Show desktop" : "Show mobile"}</button><button type="button" onClick={() => setPreview(false)}>Close</button></div></header><div className={`preview-device ${previewMobile ? "is-mobile" : ""}`}><iframe key={`${previewVersion}-${previewMobile ? "mobile" : "desktop"}`} src={`/admin/projects/preview?project=${project.id}&v=${previewVersion}`} title={`${draft.title} responsive preview`} /></div></div>}
  </div>;
}
