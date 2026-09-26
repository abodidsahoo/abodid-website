import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowUpRight,
  FolderOpen,
  GripVertical,
  ImagePlus,
  LoaderCircle,
  Newspaper,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "../../lib/supabaseClient";
import { uploadPortfolioImage } from "../../lib/portfolio/services";
import {
  EMPTY_MEDIA_MENTION,
  mediaMentionPayload,
  normalizeMediaMention,
  normalizeMentionCategories,
  validateMediaMention,
} from "../../lib/mediaMentions";
import AdminPageHeader from "./AdminPageHeader";
import PortfolioMediaPicker from "../portfolio/admin/PortfolioMediaPicker";
import "./media-mentions-manager.css";
import "../../styles/portfolio-admin.css";

const MEDIA_COLLECTION = {
  id: null,
  slug: "press-mentions",
  storage_folder: "press-mentions",
};

function Thumbnail({ src, label, compact = false }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  return (
    <span className={`mention-thumbnail ${compact ? "is-compact" : ""} ${failed ? "is-broken" : ""}`}>
      {src && !failed ? (
        <img src={src} alt="" onError={() => setFailed(true)} />
      ) : (
        <span className="mention-thumbnail-empty">
          <ImagePlus size={compact ? 17 : 25} aria-hidden="true" />
          {!compact && <small>{failed ? "Image unavailable" : label}</small>}
        </span>
      )}
    </span>
  );
}

function CategoryEditor({ values, onChange }) {
  const inputId = useId();
  const [draft, setDraft] = useState("");

  const addCategory = () => {
    const [category] = normalizeMentionCategories([draft.slice(0, 60)]);
    if (!category) return;
    if (!values.some((value) => value.toLowerCase() === category.toLowerCase())) {
      onChange([...values, category]);
    }
    setDraft("");
  };

  return (
    <div className="mention-category-field">
      <label htmlFor={inputId}>Categories</label>
      <div className="mention-category-editor">
        {values.length > 0 && (
          <div className="mention-category-list" aria-label="Selected categories">
            {values.map((value) => (
              <span key={value}>
                {value}
                <button type="button" onClick={() => onChange(values.filter((item) => item !== value))} aria-label={`Remove ${value}`}>
                  <X size={12} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          id={inputId}
          value={draft}
          placeholder="Type a category and press Enter"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === ",") && !event.nativeEvent?.isComposing) {
              event.preventDefault();
              addCategory();
            }
          }}
          onBlur={addCategory}
        />
      </div>
    </div>
  );
}

function SortableMention({ mention, selected, onSelect }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: mention.id });
  const year = mention.published_at ? new Date(`${mention.published_at}T00:00:00`).getFullYear() : "No date";

  return (
    <article
      ref={setNodeRef}
      className={`mention-list-row ${selected ? "is-selected" : ""} ${!mention.published ? "is-archived" : ""} ${isDragging ? "is-dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        type="button"
        className="mention-list-drag"
        aria-label={`Reorder ${mention.title || "untitled mention"}`}
        title="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} aria-hidden="true" />
      </button>
      <button type="button" className="mention-list-select" onClick={() => onSelect(mention)}>
        <Thumbnail src={mention.image_url} label="No thumbnail" compact />
        <span className="mention-list-copy">
          <strong>{mention.title || "Untitled mention"}</strong>
          <small>{mention.publication || "Publication not added"} · {year}{!mention.published ? " · Hidden" : ""}</small>
        </span>
      </button>
    </article>
  );
}

export default function MediaMentionsManager() {
  const fileInputRef = useRef(null);
  const [mentions, setMentions] = useState([]);
  const [form, setForm] = useState({ ...EMPTY_MEDIA_MENTION });
  const [showArchived, setShowArchived] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const visibleMentions = useMemo(
    () => mentions.filter((mention) => mention.published || showArchived),
    [mentions, showArchived],
  );
  const liveCount = mentions.filter((mention) => mention.published).length;
  const hiddenCount = mentions.length - liveCount;

  const updateUrl = ({ id = null, isNew = false } = {}) => {
    const url = new URL(window.location.href);
    url.searchParams.set("section", "media_mentions");
    url.searchParams.delete("mention");
    url.searchParams.delete("action");
    if (id) url.searchParams.set("mention", id);
    if (isNew) url.searchParams.set("action", "new");
    window.history.replaceState({}, "", url);
  };

  const loadMentions = async ({ selectId, startWithNew = false } = {}) => {
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("media_mentions")
      .select("*")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("published_at", { ascending: false });

    if (loadError) {
      setError(loadError.message || "Could not load press mentions.");
      setLoading(false);
      return;
    }

    const normalized = (data || []).map(normalizeMediaMention);
    setMentions(normalized);

    if (startWithNew) {
      const nextOrder = normalized.length
        ? Math.max(...normalized.map((mention) => mention.sort_order)) + 1
        : 0;
      setForm({ ...EMPTY_MEDIA_MENTION, sort_order: nextOrder });
    } else {
      const selected = normalized.find((mention) => mention.id === selectId)
        || normalized.find((mention) => mention.published)
        || normalized[0];
      setForm(selected ? { ...selected } : { ...EMPTY_MEDIA_MENTION });
    }

    setDirty(false);
    setLoading(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    loadMentions({
      selectId: params.get("mention"),
      startWithNew: params.get("action") === "new",
    });
  }, []);

  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setError("");
    setNotice("");
  };

  const selectMention = (mention) => {
    if (mention.id === form.id) return;
    if (dirty && !window.confirm("Discard the unsaved changes to this mention?")) return;
    setForm({ ...mention });
    setDirty(false);
    setError("");
    setNotice("");
    updateUrl({ id: mention.id });
  };

  const startNew = () => {
    if (dirty && !window.confirm("Discard the unsaved changes to this mention?")) return;
    const nextOrder = mentions.length
      ? Math.max(...mentions.map((mention) => mention.sort_order)) + 1
      : 0;
    setForm({ ...EMPTY_MEDIA_MENTION, sort_order: nextOrder });
    setDirty(false);
    setError("");
    setNotice("");
    updateUrl({ isNew: true });
  };

  const saveMention = async ({ publish = form.published } = {}) => {
    const validationError = validateMediaMention(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    const payload = mediaMentionPayload(form, mentions.length, publish);
    const request = form.id
      ? supabase.from("media_mentions").update(payload).eq("id", form.id)
      : supabase.from("media_mentions").insert(payload);
    const { data, error: saveError } = await request.select("*").single();

    if (saveError) {
      setError(saveError.message || "Could not save this mention.");
      setSaving(false);
      return;
    }

    const saved = normalizeMediaMention(data);
    setForm(saved);
    setShowArchived((current) => current || !saved.published);
    setDirty(false);
    setNotice(form.id ? "Mention saved." : "Mention created.");
    updateUrl({ id: saved.id });
    await loadMentions({ selectId: saved.id });
    setSaving(false);
  };

  const togglePublished = async () => {
    if (!form.id) {
      await saveMention({ publish: true });
      return;
    }
    await saveMention({ publish: !form.published });
  };

  const deleteMention = async () => {
    if (!form.id || !window.confirm(`Permanently delete “${form.title}”? Hiding it is the safer option.`)) return;
    setSaving(true);
    setError("");
    const { error: deleteError } = await supabase.from("media_mentions").delete().eq("id", form.id);
    if (deleteError) {
      setError(deleteError.message || "Could not delete this mention.");
      setSaving(false);
      return;
    }
    setNotice("Mention permanently deleted.");
    setForm({ ...EMPTY_MEDIA_MENTION });
    updateUrl();
    await loadMentions();
    setSaving(false);
  };

  const reorderMentions = async ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = visibleMentions.findIndex((mention) => mention.id === active.id);
    const newIndex = visibleMentions.findIndex((mention) => mention.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(visibleMentions, oldIndex, newIndex).map((mention, index) => ({
      ...mention,
      sort_order: index,
    }));
    const orderById = new Map(reordered.map((mention) => [mention.id, mention.sort_order]));
    setMentions((current) => current.map((mention) => (
      orderById.has(mention.id) ? { ...mention, sort_order: orderById.get(mention.id) } : mention
    )).sort((left, right) => left.sort_order - right.sort_order));
    if (form.id && orderById.has(form.id)) {
      setForm((current) => ({ ...current, sort_order: orderById.get(form.id) }));
    }

    setSavingOrder(true);
    const results = await Promise.all(reordered.map((mention) => (
      supabase.from("media_mentions").update({ sort_order: mention.sort_order }).eq("id", mention.id)
    )));
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      setError(`Could not save the new order: ${failed.error.message}`);
      await loadMentions({ selectId: form.id });
    } else {
      setNotice("Press page order saved.");
    }
    setSavingOrder(false);
  };

  const chooseLibraryImage = (asset) => {
    const image = Array.isArray(asset) ? asset[0] : asset;
    const url = String(image?.url || image?.publicUrl || image?.originalUrl || "").trim();
    if (!url) return;
    setForm((current) => ({
      ...current,
      image_url: url,
      image_alt: current.image_alt || image.alt || image.originalFilename || "",
    }));
    setDirty(true);
    setNotice("Thumbnail selected from the Media Library.");
    setMediaPickerOpen(false);
  };

  const uploadImage = async (event) => {
    const [file] = Array.from(event.target.files || []);
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose a JPEG, PNG, WebP or GIF image.");
      return;
    }

    setUploading(true);
    setError("");
    setNotice("");
    try {
      const media = await uploadPortfolioImage(MEDIA_COLLECTION, file, {
        alt: form.image_alt || form.title,
      });
      setForm((current) => ({
        ...current,
        image_url: media.url,
        image_alt: current.image_alt || current.title || file.name,
      }));
      setDirty(true);
      setNotice("Thumbnail uploaded to the Media Library.");
    } catch (uploadError) {
      setError(uploadError?.message || "Could not upload the thumbnail.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="media-mentions-admin" aria-labelledby="media-mentions-title">
      <header className="media-mentions-header">
        <AdminPageHeader
          headingId="media-mentions-title"
          title="Press & Mentions"
          description="Keep the links, credits and thumbnails on your press page up to date."
        />
        <div className="media-mentions-header-actions">
          <a href="/press" target="_blank" rel="noreferrer">View page <ArrowUpRight size={15} aria-hidden="true" /></a>
          <button type="button" onClick={startNew}><Plus size={16} aria-hidden="true" /> Add mention</button>
        </div>
      </header>

      <div className="media-mentions-statusbar">
        <span>{liveCount} live · {hiddenCount} hidden</span>
        <label><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} /> Show hidden</label>
        {savingOrder && <span className="is-saving"><LoaderCircle className="spin" size={14} /> Saving order…</span>}
      </div>

      {error && <div className="media-mentions-message is-error" role="alert">{error}</div>}
      {notice && <div className="media-mentions-message is-success" role="status">{notice}</div>}

      <div className="media-mentions-workspace">
        <aside className="media-mentions-list" aria-label="Press mentions">
          {loading ? (
            <div className="media-mentions-empty"><LoaderCircle className="spin" size={20} /> Loading mentions…</div>
          ) : visibleMentions.length ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorderMentions}>
              <SortableContext items={visibleMentions.map((mention) => mention.id)} strategy={verticalListSortingStrategy}>
                {visibleMentions.map((mention) => (
                  <SortableMention key={mention.id} mention={mention} selected={mention.id === form.id} onSelect={selectMention} />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            <div className="media-mentions-empty"><Newspaper size={22} aria-hidden="true" /> No mentions here yet.</div>
          )}
        </aside>

        <form className="media-mention-editor" onSubmit={(event) => { event.preventDefault(); saveMention(); }}>
          <div className="media-mention-editor-heading">
            <div>
              <span>{form.id ? (form.published ? "Live mention" : "Hidden mention") : "New mention"}</span>
              <h3>{form.title || "Untitled mention"}</h3>
            </div>
            <div className="media-mention-editor-actions">
              <button type="submit" disabled={saving || uploading || !dirty}><Save size={15} aria-hidden="true" /> Save</button>
              <button type="button" className={form.published ? "secondary" : "publish"} onClick={togglePublished} disabled={saving || uploading}>
                {form.published ? <Archive size={15} aria-hidden="true" /> : <ArchiveRestore size={15} aria-hidden="true" />}
                {form.published ? "Hide" : "Publish"}
              </button>
            </div>
          </div>

          <fieldset className="media-mention-fields">
            <legend>Mention details</legend>
            <label className="wide"><span>Title</span><input value={form.title} placeholder="Article, project or feature title" onChange={(event) => setField("title", event.target.value)} /></label>
            <label><span>Publication or collaborator</span><input value={form.publication} placeholder="Publication, studio or person" onChange={(event) => setField("publication", event.target.value)} /></label>
            <label><span>Publication date</span><input type="date" value={form.published_at} onChange={(event) => setField("published_at", event.target.value)} /></label>
            <label className="wide"><span>Destination link</span><input type="text" inputMode="url" value={form.url} placeholder="https://… or /internal-page" onChange={(event) => setField("url", event.target.value)} /></label>
            {form.url && (
              <a className="mention-open-link" href={form.url} target="_blank" rel="noreferrer">Open destination <ArrowUpRight size={14} aria-hidden="true" /></a>
            )}
            <CategoryEditor values={form.categories} onChange={(categories) => setField("categories", categories)} />
          </fieldset>

          <fieldset className="media-mention-thumbnail-fieldset">
            <legend>Thumbnail</legend>
            <div className="media-mention-thumbnail-layout">
              <Thumbnail src={form.image_url} label="No thumbnail selected" />
              <div className="media-mention-thumbnail-controls">
                <button type="button" className="media-source-button" onClick={() => setMediaPickerOpen(true)} disabled={uploading}>
                  <FolderOpen size={18} aria-hidden="true" />
                  <span><strong>Choose from Media Library</strong><small>Reuse an image that is already available.</small></span>
                </button>
                <button type="button" className="media-source-button" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? <LoaderCircle className="spin" size={18} aria-hidden="true" /> : <ImagePlus size={18} aria-hidden="true" />}
                  <span><strong>{uploading ? "Uploading thumbnail…" : "Upload an image"}</strong><small>It will also be added to the Media Library.</small></span>
                </button>
                <input ref={fileInputRef} hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={uploadImage} />
                <label><span>Image URL</span><input type="url" value={form.image_url} placeholder="https://…" onChange={(event) => setField("image_url", event.target.value)} /></label>
                <label><span>Alt text</span><input value={form.image_alt} placeholder="Describe the thumbnail" onChange={(event) => setField("image_alt", event.target.value)} /></label>
                {form.image_url && <button type="button" className="remove-thumbnail" onClick={() => setField("image_url", "")}>Remove thumbnail</button>}
              </div>
            </div>
          </fieldset>

          {form.id && (
            <section className="media-mention-danger">
              <span><strong>Permanent deletion</strong><small>Hide the mention if you may want it again later.</small></span>
              <button type="button" onClick={deleteMention} disabled={saving || uploading}><Trash2 size={15} aria-hidden="true" /> Delete</button>
            </section>
          )}
        </form>
      </div>

      <PortfolioMediaPicker open={mediaPickerOpen} allowUncatalogued onClose={() => setMediaPickerOpen(false)} onSelect={chooseLibraryImage} />
    </section>
  );
}
