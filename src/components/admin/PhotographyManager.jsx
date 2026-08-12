import { useEffect, useId, useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowUpRight,
  FolderOpen,
  GripVertical,
  ImagePlus,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "../../lib/supabaseClient";
import { uploadPortfolioImage } from "../../lib/portfolio/services";
import AdminPageHeader from "./AdminPageHeader";
import { PortfolioImageUploader } from "../portfolio/admin/PortfolioBlockEditor";
import PortfolioMediaPicker from "../portfolio/admin/PortfolioMediaPicker";
import "../../styles/portfolio-admin.css";

const EMPTY_PROJECT = {
  id: null,
  title: "",
  slug: "",
  intro: "",
  content: "",
  cover_image: "",
  gallery_images: [],
  category: [],
  tags: [],
  location: "",
  Collaborator: "",
  Year: null,
  published: false,
  published_at: null,
  sort_order: 0,
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
  const raw = Array.isArray(value) ? value : String(value || "").split(",");
  const seen = new Set();
  return raw
    .map((item) => String(item || "").replace(/^#+/, "").replace(/\s+/g, " ").trim())
    .filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const normalizeGallery = (value) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      const source = typeof item === "string" ? { url: item } : item;
      const url = String(source?.url || "").trim();
      if (!url) return null;
      return {
        ...source,
        id: source.id || `photo-${index}-${url}`,
        url,
        caption: source.caption || "",
        sort_order: index,
        is_vertical: Boolean(source.is_vertical),
      };
    })
    .filter(Boolean);
};

const normalizeProject = (row) => ({
  ...EMPTY_PROJECT,
  ...row,
  title: String(row?.title || ""),
  slug: String(row?.slug || ""),
  intro: String(row?.intro || ""),
  content: String(row?.content || ""),
  cover_image: String(row?.cover_image || ""),
  location: String(row?.location || ""),
  Collaborator: String(row?.Collaborator || ""),
  category: normalizeTags(row?.category),
  tags: normalizeTags(row?.tags),
  gallery_images: normalizeGallery(row?.gallery_images),
  published: Boolean(row?.published),
});

function TagEditor({ label, values, onChange, placeholder }) {
  const inputId = useId();
  const [value, setValue] = useState("");

  const addTag = () => {
    const [tag] = normalizeTags([value.slice(0, 60)]);
    if (!tag) return;
    if (!values.some((item) => item.toLowerCase() === tag.toLowerCase())) {
      onChange([...values, tag]);
    }
    setValue("");
  };

  return (
    <div className="photography-tag-field">
      <label htmlFor={inputId}>{label}</label>
      <div className="photography-tag-editor">
        {values.length > 0 && (
          <div className="photography-tag-list" aria-label={`${label} tags`}>
            {values.map((tag) => (
              <span className="photography-tag" key={tag}>
                {tag}
                <button
                  type="button"
                  aria-label={`Remove ${tag}`}
                  title={`Remove ${tag}`}
                  onClick={() => onChange(values.filter((item) => item !== tag))}
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          id={inputId}
          value={value}
          placeholder={placeholder}
          onChange={(event) => setValue(event.target.value)}
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

function SortableSeriesItem({ item, selected, onEdit }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const cover = item.cover_image || item.gallery_images?.[0]?.url;

  return (
    <div
      ref={setNodeRef}
      className={`photography-series-item ${selected ? "is-selected" : ""} ${!item.published ? "is-archived" : ""} ${isDragging ? "is-dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        type="button"
        className="photography-series-drag"
        aria-label={`Reorder ${item.title || "untitled series"}`}
        title="Drag to reorder this series"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={15} aria-hidden="true" />
      </button>
      <button type="button" className="photography-series-select" onClick={() => onEdit(item)}>
        <span className="photography-series-thumb">
          {cover ? <img src={cover} alt="" /> : <ImagePlus size={17} aria-hidden="true" />}
        </span>
        <span className="photography-series-copy">
          <strong>{item.title || "Untitled series"}</strong>
          <small>
            {item.gallery_images.length} {item.gallery_images.length === 1 ? "photo" : "photos"}
            {!item.published && <span className="photography-series-archived-note"> (Archived)</span>}
          </small>
        </span>
      </button>
    </div>
  );
}

function SortablePhoto({ photo, index, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id });

  return (
    <article
      ref={setNodeRef}
      className={`photography-gallery-item ${isDragging ? "is-dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <img src={photo.url} alt={photo.caption || `Gallery photo ${index + 1}`} />
      <span className="photography-gallery-position">{String(index + 1).padStart(2, "0")}</span>
      <button
        type="button"
        className="photography-gallery-drag"
        aria-label={`Move photo ${index + 1}`}
        title="Drag to change photo order"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="photography-gallery-remove"
        aria-label={`Remove photo ${index + 1}`}
        title="Remove from this collection"
        onClick={() => onRemove(photo.id)}
      >
        <X size={15} aria-hidden="true" />
      </button>
    </article>
  );
}

export default function PhotographyManager() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY_PROJECT);
  const [visibility, setVisibility] = useState({ published: true, archived: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const publishedCount = items.filter((item) => item.published).length;
  const archivedCount = items.length - publishedCount;
  const visibleItems = useMemo(
    () => items.filter((item) => (item.published ? visibility.published : visibility.archived)),
    [items, visibility],
  );

  const updateUrl = ({ id = null, isNew = false } = {}) => {
    const url = new URL(window.location.href);
    url.searchParams.set("section", "photography");
    url.searchParams.delete("project");
    url.searchParams.delete("action");
    if (id) url.searchParams.set("project", id);
    if (isNew) url.searchParams.set("action", "new");
    window.history.replaceState({}, "", url);
  };

  const loadItems = async ({ selectId, startWithNew = false } = {}) => {
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("photography")
      .select("*")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }

    const normalized = (data || []).map(normalizeProject);
    setItems(normalized);

    if (startWithNew) {
      setForm({ ...EMPTY_PROJECT, sort_order: normalized.length });
      setDirty(false);
      setLoading(false);
      return;
    }

    const next = normalized.find((item) => item.id === selectId)
      || normalized.find((item) => item.id === form.id)
      || normalized.find((item) => item.published)
      || normalized[0]
      || null;
    setForm(next || { ...EMPTY_PROJECT, sort_order: 0 });
    setDirty(false);
    setLoading(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    loadItems({
      selectId: params.get("project"),
      startWithNew: params.get("action") === "new",
    });
  }, []);

  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setError("");
    setNotice("");
  };

  const selectProject = (item) => {
    if (item.id === form.id) return;
    if (dirty && !window.confirm("Discard the unsaved changes in this series?")) return;
    setForm(normalizeProject(item));
    setDirty(false);
    setError("");
    setNotice("");
    updateUrl({ id: item.id });
  };

  const startNew = () => {
    if (dirty && !window.confirm("Discard the unsaved changes in this series?")) return;
    setForm({ ...EMPTY_PROJECT, sort_order: items.length });
    setDirty(false);
    setError("");
    setNotice("");
    updateUrl({ isNew: true });
  };

  const buildPayload = (published = form.published) => ({
    title: form.title.trim(),
    slug: slugify(form.slug || form.title),
    intro: form.intro || "",
    content: form.content || "",
    cover_image: form.cover_image || null,
    gallery_images: normalizeGallery(form.gallery_images).map((photo, index) => ({
      ...photo,
      sort_order: index,
    })),
    category: normalizeTags(form.category),
    tags: normalizeTags(form.tags),
    location: form.location || null,
    Collaborator: form.Collaborator || null,
    Year: form.Year ? Number(form.Year) : null,
    published,
    published_at: published ? (form.published_at || new Date().toISOString()) : form.published_at,
    sort_order: Number.isFinite(Number(form.sort_order)) ? Number(form.sort_order) : items.length,
  });

  const saveProject = async ({ publish = form.published } = {}) => {
    const payload = buildPayload(publish);
    if (!payload.title) {
      setError("Add a title before saving this photo series.");
      return;
    }
    if (!payload.slug) {
      setError("Add a usable title or slug before saving this photo series.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    const query = form.id
      ? supabase.from("photography").update(payload).eq("id", form.id).select("*").single()
      : supabase.from("photography").insert(payload).select("*").single();
    const { data, error: saveError } = await query;

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    const saved = normalizeProject(data);
    setForm(saved);
    setDirty(false);
    setVisibility((current) => ({ ...current, [publish ? "published" : "archived"]: true }));
    setNotice(form.id ? "Photo series saved." : "Photo series created.");
    updateUrl({ id: saved.id });
    await loadItems({ selectId: saved.id });
    setSaving(false);
  };

  const toggleArchive = async () => {
    if (!form.id || saving) return;
    const nextPublished = !form.published;
    setSaving(true);
    setError("");
    setNotice("");

    const payload = buildPayload(nextPublished);
    const { data, error: archiveError } = await supabase
      .from("photography")
      .update(payload)
      .eq("id", form.id)
      .select("*")
      .single();

    if (archiveError) {
      setError(archiveError.message);
      setSaving(false);
      return;
    }

    setVisibility((current) => ({ ...current, [nextPublished ? "published" : "archived"]: true }));
    setNotice(nextPublished ? "Photo series is live again." : "Photo series archived and removed from the photography page.");
    setDirty(false);
    await loadItems({ selectId: data.id });
    setSaving(false);
  };

  const deleteProject = async () => {
    if (!form.id || !window.confirm(`Permanently delete “${form.title}”? Archive it instead if you may need it later.`)) return;
    setSaving(true);
    setError("");
    const { error: deleteError } = await supabase.from("photography").delete().eq("id", form.id);
    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return;
    }
    setNotice("Photo series permanently deleted.");
    setForm(EMPTY_PROJECT);
    updateUrl();
    await loadItems();
    setSaving(false);
  };

  const handleSeriesDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = visibleItems.findIndex((item) => item.id === active.id);
    const newIndex = visibleItems.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(visibleItems, oldIndex, newIndex);
    const orderById = new Map(reordered.map((item, index) => [item.id, index]));
    setItems((current) => current.map((item) => (
      orderById.has(item.id) ? { ...item, sort_order: orderById.get(item.id) } : item
    )).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
    if (form.id && orderById.has(form.id)) {
      setForm((current) => ({ ...current, sort_order: orderById.get(form.id) }));
    }
    setSavingOrder(true);
    const results = await Promise.all(reordered.map((item, index) => (
      supabase.from("photography").update({ sort_order: index }).eq("id", item.id)
    )));
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      setError(`Could not save the series order: ${failed.error.message}`);
      await loadItems({ selectId: form.id });
    } else {
      setNotice("Series order saved.");
    }
    setSavingOrder(false);
  };

  const handlePhotoDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = form.gallery_images.findIndex((photo) => photo.id === active.id);
    const newIndex = form.gallery_images.findIndex((photo) => photo.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    setField("gallery_images", arrayMove(form.gallery_images, oldIndex, newIndex).map((photo, index) => ({
      ...photo,
      sort_order: index,
    })));
  };

  const addGalleryMedia = (selection) => {
    const selected = (Array.isArray(selection) ? selection : [selection]).filter(Boolean);
    if (!selected.length) return;

    setForm((current) => {
      const gallery = normalizeGallery(current.gallery_images);
      const seen = new Set(gallery.flatMap((photo) => (
        [photo.id, photo.objectKey, photo.storagePath, photo.url].filter(Boolean)
      )));
      const additions = [];

      selected.forEach((asset) => {
        const url = String(asset.url || asset.publicUrl || asset.originalUrl || "").trim();
        if (!url) return;
        const identifiers = [asset.id, asset.objectKey, asset.storagePath, url].filter(Boolean);
        if (identifiers.some((identifier) => seen.has(identifier))) return;
        identifiers.forEach((identifier) => seen.add(identifier));
        additions.push({
          ...asset,
          id: asset.id || crypto.randomUUID(),
          url,
          caption: asset.caption || asset.originalFilename || asset.name || "",
          sort_order: gallery.length + additions.length,
          is_vertical: Boolean(asset.is_vertical),
        });
      });

      if (!additions.length) return current;
      return {
        ...current,
        gallery_images: [...gallery, ...additions],
        cover_image: current.cover_image || additions[0].url,
      };
    });
    setDirty(true);
    setError("");
    setNotice("");
  };

  const uploadComputerMedia = async (fileOrFiles, target) => {
    const files = (Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles]).filter(Boolean);
    if (!files.length) return [];

    setUploadingMedia(true);
    setError("");
    const storageFolder = `photography-${slugify(form.slug || form.title) || "untitled-series"}`;
    const libraryCollection = { id: null, slug: storageFolder, storage_folder: storageFolder };
    const uploaded = [];

    try {
      for (const file of files) {
        const media = await uploadPortfolioImage(libraryCollection, file);
        uploaded.push(media);
        if (target === "cover") {
          setField("cover_image", media.url);
        } else {
          addGalleryMedia(media);
        }
      }
      setNotice(`${uploaded.length} ${uploaded.length === 1 ? "photo" : "photos"} uploaded to the Media Library${target === "cover" ? " and set as the cover" : " and added to this series"}.`);
      return uploaded;
    } catch (uploadError) {
      setError(uploadError?.message || "The photo upload failed. Please try again.");
      throw uploadError;
    } finally {
      setUploadingMedia(false);
    }
  };

  const chooseLibraryMedia = (selection) => {
    const target = mediaPickerTarget;
    if (target === "cover") {
      const media = Array.isArray(selection) ? selection[0] : selection;
      const url = String(media?.url || media?.publicUrl || media?.originalUrl || "").trim();
      if (url) {
        setField("cover_image", url);
        setNotice("Cover selected from the Media Library.");
      }
    } else if (target === "gallery") {
      addGalleryMedia(selection);
      setNotice("Media Library selection added to this series. Photos already present were skipped.");
    }
    setMediaPickerTarget(null);
  };

  const removePhoto = (photoId) => {
    if (!window.confirm("Remove this photo from the collection? The uploaded file will remain in storage.")) return;
    setField("gallery_images", form.gallery_images
      .filter((photo) => photo.id !== photoId)
      .map((photo, index) => ({ ...photo, sort_order: index })));
  };

  return (
    <section className="photography-admin" aria-labelledby="photography-admin-title">
      <div className="photography-admin-header">
        <AdminPageHeader
          className="photography-admin-page-header"
          headingId="photography-admin-title"
          title="Photography"
          description="Add your next photo series here."
        />
        <div className="photography-admin-header-actions">
          <div
            className={`photography-admin-toolbar-notification ${error ? "is-error" : "is-notice"}`}
            role={error ? "alert" : "status"}
            aria-live={error ? "assertive" : "polite"}
            aria-atomic="true"
          >
            {(error || notice) && <span title={error || notice}>{error || notice}</span>}
          </div>
          <a href="/photography" target="_blank" rel="noreferrer">
            View photography <ArrowUpRight size={15} aria-hidden="true" />
          </a>
          <button type="button" onClick={startNew}>
            <Plus size={16} aria-hidden="true" /> New series
          </button>
        </div>
      </div>

      <div className="photography-admin-layout">
        <aside className="photography-admin-list">
          <div className="photography-admin-list-heading">
            <span>
              <strong>{items.length} series</strong>
              {savingOrder && <small>Saving order…</small>}
            </span>
            <button type="button" onClick={() => loadItems({ selectId: form.id })} aria-label="Refresh photography series">
              <RefreshCw size={15} aria-hidden="true" />
            </button>
          </div>
          <div className="photography-admin-list-filters" aria-label="Photography visibility">
            <label>
              <input
                type="checkbox"
                checked={visibility.published}
                onChange={(event) => setVisibility((current) => ({ ...current, published: event.target.checked }))}
              />
              <span>Published</span><small>{publishedCount}</small>
            </label>
            <label>
              <input
                type="checkbox"
                checked={visibility.archived}
                onChange={(event) => setVisibility((current) => ({ ...current, archived: event.target.checked }))}
              />
              <span>Archive</span><small>{archivedCount}</small>
            </label>
          </div>

          {loading ? (
            <div className="photography-admin-loading"><LoaderCircle size={18} className="spin" /> Loading…</div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSeriesDragEnd}>
              <SortableContext items={visibleItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                <div className="photography-admin-list-items">
                  {visibleItems.length === 0 && <p>No series match this view.</p>}
                  {visibleItems.map((item) => (
                    <SortableSeriesItem
                      key={item.id}
                      item={item}
                      selected={form.id === item.id}
                      onEdit={selectProject}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
          <div className="photography-admin-order-note">
            <GripVertical size={14} aria-hidden="true" /> Drag series to set their public order.
          </div>
        </aside>

        <form className="photography-admin-form" onSubmit={(event) => { event.preventDefault(); saveProject(); }}>
          <div className="photography-admin-form-heading">
            <label className="photography-primary-title-field">
              <span className="photography-visually-hidden">Title</span>
              <input
                value={form.title}
                placeholder="Untitled photo series"
                onChange={(event) => {
                  const title = event.target.value;
                  setForm((current) => ({
                    ...current,
                    title,
                    slug: current.id || current.slug ? current.slug : slugify(title),
                  }));
                  setDirty(true);
                }}
              />
            </label>
            <div className="photography-admin-form-actions">
              {form.id && (
                <button
                  type="button"
                  className={`archive ${form.published ? "" : "restore"}`}
                  onClick={toggleArchive}
                  disabled={saving || uploadingMedia}
                >
                  {form.published ? <Archive size={16} /> : <ArchiveRestore size={16} />}
                  {form.published ? "Archive" : "Publish again"}
                </button>
              )}
              <button type="submit" disabled={saving || uploadingMedia}>
                {saving ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}
                {form.id ? "Save changes" : "Create draft"}
              </button>
              {!form.id && (
                <button type="button" className="publish" onClick={() => saveProject({ publish: true })} disabled={saving || uploadingMedia}>
                  Publish
                </button>
              )}
            </div>
          </div>

          <div className="photography-primary-slug-row">
            <label>
              <span>URL slug</span>
              <input value={form.slug} placeholder="photo-series" onChange={(event) => setField("slug", slugify(event.target.value))} />
            </label>
          </div>

          <fieldset className="photography-cover-fieldset">
            <legend>Cover image</legend>
            <div className="photography-cover-preview">
              {form.cover_image ? (
                <img src={form.cover_image} alt={`${form.title || "Photo series"} cover`} />
              ) : (
                <span><ImagePlus size={23} aria-hidden="true" /> No cover selected</span>
              )}
            </div>
            <div className="photography-cover-controls">
              <div className="photography-media-source-grid is-cover">
                <button type="button" className="photography-media-library-choice" onClick={() => setMediaPickerTarget("cover")} disabled={uploadingMedia}>
                  <span className="photography-media-library-icon"><FolderOpen size={18} aria-hidden="true" /></span>
                  <span>
                    <strong>Choose from Media Library</strong>
                    <small>Use an image that is already in your library.</small>
                  </span>
                </button>
                <PortfolioImageUploader
                  hasImages={Boolean(form.cover_image)}
                  disabled={uploadingMedia}
                  emptyLabel="Upload cover from computer"
                  filledLabel="Replace cover from computer"
                  onUpload={(file) => uploadComputerMedia(file, "cover")}
                />
              </div>
              {form.cover_image && (
                <button type="button" className="secondary" onClick={() => setField("cover_image", "")}>Remove cover</button>
              )}
              <small className="photography-cover-help">The cover is the thumbnail shown in the series list and on the photography page.</small>
            </div>
          </fieldset>

          <fieldset className="photography-gallery-fieldset">
            <legend>Photos in this series</legend>
            <div className="photography-gallery-heading">
              <span>{form.gallery_images.length} photos · drag thumbnails to sequence them</span>
            </div>
            <div className="photography-media-source-grid">
              <button type="button" className="photography-media-library-choice" onClick={() => setMediaPickerTarget("gallery")} disabled={uploadingMedia}>
                <span className="photography-media-library-icon"><FolderOpen size={18} aria-hidden="true" /></span>
                <span>
                  <strong>Choose from Media Library</strong>
                  <small>Select existing photos; your selection order is preserved.</small>
                </span>
              </button>
              <PortfolioImageUploader
                hasImages={form.gallery_images.length > 0}
                multiple
                disabled={uploadingMedia}
                emptyLabel="Upload photos from computer"
                filledLabel="Upload more from computer"
                onUpload={(files) => uploadComputerMedia(files, "gallery")}
              />
            </div>
            {form.gallery_images.length > 0 ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePhotoDragEnd}>
                <SortableContext items={form.gallery_images.map((photo) => photo.id)} strategy={rectSortingStrategy}>
                  <div className="photography-gallery-grid">
                    {form.gallery_images.map((photo, index) => (
                      <SortablePhoto key={photo.id} photo={photo} index={index} onRemove={removePhoto} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="photography-gallery-empty">
                <ImagePlus size={25} aria-hidden="true" />
                <strong>No photos in this collection yet</strong>
                <span>Choose photos from the Media Library or upload them from your computer.</span>
              </div>
            )}
          </fieldset>

          <fieldset className="photography-details-fieldset">
            <legend>About this series</legend>
            <label className="wide">
              <span>Short introduction</span>
              <input value={form.intro} placeholder="A one-line introduction to this series" onChange={(event) => setField("intro", event.target.value)} />
            </label>
            <label>
              <span>Year</span>
              <input type="number" value={form.Year || ""} placeholder="2026" onChange={(event) => setField("Year", event.target.value)} />
            </label>
            <label>
              <span>Location</span>
              <input value={form.location || ""} placeholder="City or place" onChange={(event) => setField("location", event.target.value)} />
            </label>
            <label className="wide">
              <span>Collaborator</span>
              <input value={form.Collaborator || ""} placeholder="Name or organisation" onChange={(event) => setField("Collaborator", event.target.value)} />
            </label>
            <label className="wide">
              <span>Project description</span>
              <textarea rows={6} value={form.content} placeholder="Write the story or context for this collection…" onChange={(event) => setField("content", event.target.value)} />
            </label>
            <TagEditor
              label="Categories"
              values={form.category}
              onChange={(category) => setField("category", category)}
              placeholder="Type a category and press Enter"
            />
            <TagEditor
              label="Tags"
              values={form.tags}
              onChange={(tags) => setField("tags", tags)}
              placeholder="Type a tag and press Enter"
            />
          </fieldset>

          {form.id && (
            <section className="photography-admin-danger">
              <span><strong>Permanent deletion</strong><small>Archive is the recommended reversible way to remove a series from the public page.</small></span>
              <button type="button" onClick={deleteProject} disabled={saving || uploadingMedia}><Trash2 size={15} /> Delete series</button>
            </section>
          )}
        </form>
      </div>

      <PortfolioMediaPicker
        open={Boolean(mediaPickerTarget)}
        multiple={mediaPickerTarget === "gallery"}
        onClose={() => setMediaPickerTarget(null)}
        onSelect={chooseLibraryMedia}
      />

      <style>{`
        .photography-admin { width:100%; max-width:var(--admin-page-content-max); display:flex; flex-direction:column; gap:1rem; height:calc(100vh - 4rem); min-height:0; color:var(--text-primary); }
        .photography-admin-header { display:flex; justify-content:space-between; gap:2rem; align-items:flex-end; padding:var(--admin-page-heading-offset-block) var(--admin-page-heading-offset-inline) 1.5rem; border-bottom:1px solid var(--border-subtle); }
        .photography-admin-page-header { min-width:0; flex:1 1 34rem; }
        .photography-admin-header-actions,.photography-admin-form-actions,.photography-gallery-heading { display:flex; flex-wrap:wrap; gap:.55rem; align-items:center; }
        .photography-admin-header-actions { position:relative; flex:0 0 auto; flex-wrap:nowrap; padding-bottom:.25rem; }
        .photography-admin button,.photography-admin a,.photography-admin .image-upload-button { font:700 .8rem/1 var(--font-ui); }
        .photography-admin-header-actions a,.photography-admin-header-actions button,.photography-admin-form-actions button { display:inline-flex; align-items:center; justify-content:center; gap:.4rem; min-height:2.45rem; border:1px solid var(--border-subtle); border-radius:8px; padding:.65rem .85rem; background:var(--text-primary); color:var(--bg-color); text-decoration:none; cursor:pointer; box-sizing:border-box; }
        .photography-admin-header-actions a { background:transparent; color:var(--text-primary); }
        .photography-admin-toolbar-notification { position:absolute; z-index:5; right:calc(100% + .75rem); top:50%; width:max-content; max-width:min(260px,26vw); transform:translateY(-50%); pointer-events:none; }
        .photography-admin-toolbar-notification:empty { display:none; }
        .photography-admin-toolbar-notification>span { display:block; overflow:hidden; border:1px solid var(--border-subtle); border-radius:999px; padding:.42rem .68rem; background:color-mix(in srgb,var(--bg-color) 94%,transparent); box-shadow:0 8px 24px rgba(0,0,0,.16); color:var(--text-secondary); font-size:.68rem; font-weight:700; line-height:1; text-overflow:ellipsis; white-space:nowrap; backdrop-filter:blur(10px); }
        .photography-admin-toolbar-notification.is-notice>span { border-color:color-mix(in srgb,#22c55e 42%,var(--border-subtle)); color:#22c55e; }
        .photography-admin-toolbar-notification.is-error>span { border-color:color-mix(in srgb,#ef4444 48%,var(--border-subtle)); color:#ef4444; }
        .photography-admin-layout { min-height:0; flex:1; display:grid; grid-template-columns:minmax(270px,330px) minmax(0,1fr); gap:1rem; align-items:stretch; overflow:hidden; }
        .photography-admin-list,.photography-admin-form { border:1px solid var(--border-subtle); border-radius:12px; background:var(--bg-surface); }
        .photography-admin-list { min-height:0; display:grid; grid-template-rows:auto auto minmax(0,1fr) auto; overflow:clip; }
        .photography-admin-list-heading { display:flex; justify-content:space-between; align-items:center; padding:.8rem .9rem; border-bottom:1px solid var(--border-subtle); }
        .photography-admin-list-heading>span { display:flex; gap:.5rem; align-items:baseline; }
        .photography-admin-list-heading strong { font-size:.8rem; }
        .photography-admin-list-heading small { color:var(--text-tertiary); font-size:.65rem; }
        .photography-admin-list-heading>button { display:grid; place-items:center; border:0; padding:.3rem; background:transparent; color:var(--text-secondary); cursor:pointer; }
        .photography-admin-list-filters { display:grid; gap:.42rem; padding:.7rem .9rem; border-bottom:1px solid var(--border-subtle); }
        .photography-admin-list-filters label { display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:.5rem; align-items:center; color:var(--text-secondary); font-size:.73rem; font-weight:700; cursor:pointer; }
        .photography-admin-list-filters input { width:auto; margin:0; accent-color:var(--text-primary); }
        .photography-admin-list-filters small { color:var(--text-tertiary); font-size:.67rem; }
        .photography-admin-list-items { overflow:auto; display:grid; align-content:start; gap:.35rem; padding:.42rem; }
        .photography-admin-list-items>p { margin:0; padding:1rem .6rem; color:var(--text-tertiary); font-size:.76rem; }
        .photography-series-item { position:relative; display:grid; grid-template-columns:22px minmax(0,1fr); gap:.35rem; align-items:center; border:1px solid transparent; border-radius:9px; padding:.38rem; background:transparent; }
        .photography-series-item:hover,.photography-series-item.is-selected { border-color:var(--border-subtle); background:var(--bg-surface-hover); }
        .photography-series-item.is-dragging,.photography-gallery-item.is-dragging { z-index:10; opacity:.62; }
        .photography-series-drag { display:grid; place-items:center; align-self:stretch; border:0; padding:0; background:transparent; color:var(--text-tertiary); cursor:grab; touch-action:none; }
        .photography-series-select { min-width:0; display:grid; grid-template-columns:54px minmax(0,1fr); gap:.58rem; align-items:center; border:0; padding:0; background:transparent; color:inherit; text-align:left; cursor:pointer; }
        .photography-series-thumb { width:54px; aspect-ratio:1.25; display:grid; place-items:center; overflow:hidden; border:1px solid var(--border-subtle); border-radius:6px; background:var(--bg-color); color:var(--text-tertiary); }
        .photography-series-thumb img { width:100%; height:100%; object-fit:cover; }
        .photography-series-copy { min-width:0; }
        .photography-series-copy strong,.photography-series-copy small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .photography-series-copy strong { font-size:.78rem; line-height:1.2; }
        .photography-series-copy small { margin-top:.26rem; color:var(--text-tertiary); font-size:.64rem; }
        .photography-series-item.is-archived .photography-series-thumb { opacity:.4; filter:grayscale(1); }
        .photography-series-item.is-archived .photography-series-copy strong { color:var(--text-tertiary); font-weight:600; }
        .photography-series-item.is-archived:not(.is-selected) .photography-series-copy { opacity:.68; }
        .photography-series-archived-note { color:var(--text-tertiary); font-size:.59rem; }
        .photography-admin-order-note { display:flex; gap:.35rem; align-items:center; padding:.65rem .85rem; border-top:1px solid var(--border-subtle); color:var(--text-tertiary); font-size:.65rem; }
        .photography-admin-loading { display:flex; align-items:center; gap:.45rem; padding:1rem; color:var(--text-secondary); font-size:.8rem; }
        .photography-admin-form { min-height:0; padding:clamp(1rem,2.2vw,1.5rem); overflow-y:auto; }
        .photography-admin-form-heading { display:flex; justify-content:space-between; gap:1rem; align-items:flex-start; padding-bottom:.6rem; }
        .photography-primary-title-field { min-width:0; flex:1 1 24rem; }
        .photography-primary-slug-row { width:min(29rem,100%); padding:0 0 .85rem; }
        .photography-admin-form-actions button.archive { border-color:color-mix(in srgb,#e88b2b 45%,var(--border-subtle)); background:color-mix(in srgb,#e88b2b 9%,transparent); color:#d97a19; }
        .photography-admin-form-actions button.archive.restore { border-color:color-mix(in srgb,#10b981 42%,var(--border-subtle)); background:color-mix(in srgb,#10b981 9%,transparent); color:#10b981; }
        .photography-admin-form-actions button.publish { background:#10b981; border-color:#10b981; color:white; }
        .photography-admin-form button:disabled,.photography-admin .image-upload-button.uploading { opacity:.58; cursor:not-allowed; }
        .photography-admin-form fieldset { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1rem; margin:0; border:0; border-top:1px solid var(--border-subtle); padding:1.35rem 0; }
        .photography-admin-form legend { grid-column:1/-1; padding:0 0 .2rem; color:var(--text-primary); font-size:.87rem; font-weight:800; }
        .photography-admin-form label,.photography-tag-field { display:grid; gap:.42rem; min-width:0; }
        .photography-admin-form label>span,.photography-tag-field>label { color:var(--text-secondary); font-size:.73rem; font-weight:750; }
        .photography-admin-form input,.photography-admin-form textarea,.photography-tag-editor { width:100%; border:1px solid var(--border-subtle); border-radius:8px; padding:.7rem .78rem; background:var(--bg-color); color:var(--text-primary); font:500 .88rem/1.45 var(--font-sans); box-sizing:border-box; }
        .photography-admin-form .photography-primary-title-field input { padding:0 0 .18rem; border:0; border-bottom:1px solid transparent; border-radius:0; background:transparent; font-size:clamp(1.65rem,3vw,2.6rem); font-weight:620; line-height:1.08; letter-spacing:-.04em; }
        .photography-admin-form .photography-primary-title-field input:hover,.photography-admin-form .photography-primary-title-field input:focus { border-bottom-color:var(--border-strong); outline:0; }
        .photography-admin-form .photography-primary-title-field input::placeholder { color:var(--text-tertiary); }
        .photography-visually-hidden { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
        .photography-admin-form textarea { resize:vertical; }
        .photography-admin-form input:focus,.photography-admin-form textarea:focus,.photography-tag-editor:focus-within { outline:2px solid var(--border-focus); outline-offset:2px; }
        .photography-admin-form .wide { grid-column:1/-1; }
        .photography-tag-editor { display:grid; gap:.5rem; padding:.5rem; }
        .photography-tag-editor>input { border:0; padding:.3rem; outline:0!important; background:transparent; }
        .photography-tag-list { display:flex; flex-wrap:wrap; gap:.32rem; }
        .photography-tag { display:inline-flex; gap:.28rem; align-items:center; border-radius:999px; padding:.28rem .42rem .28rem .58rem; background:var(--text-primary); color:var(--bg-color); font-size:.7rem; font-weight:700; }
        .photography-tag button { display:grid; place-items:center; border:0; padding:0; background:transparent; color:inherit; cursor:pointer; }
        .photography-cover-fieldset { grid-template-columns:minmax(180px,.75fr) minmax(0,1.25fr)!important; }
        .photography-cover-preview { width:100%; aspect-ratio:16/10; overflow:hidden; display:grid; place-items:center; border:1px solid var(--border-subtle); border-radius:9px; background:var(--bg-color); color:var(--text-tertiary); }
        .photography-cover-preview img { width:100%; height:100%; object-fit:cover; }
        .photography-cover-preview>span { display:grid; place-items:center; gap:.5rem; font-size:.73rem; }
        .photography-cover-controls { min-width:0; display:grid; align-content:start; gap:.65rem; }
        .photography-media-source-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:.7rem; margin:0 0 1rem; }
        .photography-media-source-grid.is-cover { grid-template-columns:1fr; margin:0; }
        .photography-media-source-grid .portfolio-image-uploader { min-width:0; min-height:104px; margin-top:0; }
        .photography-media-source-grid.is-cover .portfolio-image-uploader { min-height:82px; }
        .photography-media-library-choice { min-width:0; min-height:104px; display:grid; grid-template-columns:2.25rem minmax(0,1fr); gap:.8rem; align-items:center; border:1px dashed color-mix(in srgb,var(--text-secondary) 46%,var(--border-subtle)); border-radius:8px; padding:1rem; background:var(--bg-surface); color:var(--text-primary); text-align:left; cursor:pointer; box-sizing:border-box; }
        .photography-media-source-grid.is-cover .photography-media-library-choice { min-height:82px; }
        .photography-media-library-choice:hover:not(:disabled),.photography-media-library-choice:focus-visible { border-color:var(--text-primary); background:var(--bg-surface-hover); outline:none; }
        .photography-media-library-choice:disabled { opacity:.58; cursor:not-allowed; }
        .photography-media-library-icon { display:grid; width:2.25rem; height:2.25rem; place-items:center; border:1px solid var(--border-subtle); border-radius:999px; background:var(--bg-color); color:var(--text-secondary); }
        .photography-media-library-choice>span:last-child { min-width:0; display:grid; gap:.28rem; }
        .photography-media-library-choice strong { font-size:.76rem; line-height:1.25; }
        .photography-media-library-choice small,.photography-cover-help { color:var(--text-tertiary); font-size:.65rem; font-weight:500; line-height:1.4; }
        .photography-cover-controls button.secondary { width:fit-content; min-height:2.25rem; border:1px solid var(--border-subtle); border-radius:7px; padding:.55rem .7rem; background:transparent; color:var(--text-primary); cursor:pointer; }
        .photography-gallery-fieldset { display:block!important; }
        .photography-gallery-heading { justify-content:space-between; margin:.2rem 0 1rem; }
        .photography-gallery-heading>span { color:var(--text-secondary); font-size:.72rem; }
        .photography-gallery-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.7rem; }
        .photography-gallery-item { position:relative; overflow:hidden; min-width:0; aspect-ratio:4/3; border:1px solid var(--border-subtle); border-radius:8px; background:var(--bg-color); }
        .photography-gallery-item img { width:100%; height:100%; object-fit:cover; }
        .photography-gallery-position { position:absolute; left:.45rem; bottom:.42rem; border-radius:999px; padding:.22rem .4rem; background:rgba(0,0,0,.65); color:white; font:.7rem/1 var(--font-mono); backdrop-filter:blur(6px); }
        .photography-gallery-drag,.photography-gallery-remove { position:absolute; top:.42rem; display:grid; place-items:center; width:28px; height:28px; border:0; border-radius:7px; background:rgba(0,0,0,.68); color:white; cursor:pointer; backdrop-filter:blur(6px); }
        .photography-gallery-drag { left:.42rem; cursor:grab; touch-action:none; }
        .photography-gallery-remove { right:.42rem; }
        .photography-gallery-empty { min-height:190px; display:flex; flex-direction:column; justify-content:center; align-items:center; gap:.42rem; border:1px dashed var(--border-subtle); border-radius:9px; color:var(--text-tertiary); text-align:center; }
        .photography-gallery-empty strong { color:var(--text-secondary); font-size:.82rem; }
        .photography-gallery-empty span { font-size:.7rem; }
        .photography-admin-danger { display:flex; justify-content:space-between; gap:1rem; align-items:center; border-top:1px solid var(--border-subtle); padding:1.15rem 0 0; }
        .photography-admin-danger>span { display:grid; gap:.25rem; }
        .photography-admin-danger strong { font-size:.76rem; }
        .photography-admin-danger small { color:var(--text-tertiary); font-size:.68rem; line-height:1.4; }
        .photography-admin-danger button { flex:0 0 auto; display:inline-flex; gap:.35rem; align-items:center; border:0; padding:.55rem; background:transparent; color:#ef4444; cursor:pointer; }
        .spin { animation:photography-admin-spin .8s linear infinite; }
        @keyframes photography-admin-spin { to { transform:rotate(360deg); } }
        @media(max-width:1180px) { .photography-admin-header { align-items:flex-start; flex-direction:column; } .photography-admin-header-actions { width:100%; justify-content:flex-end; } }
        @media(max-width:980px) { .photography-admin { height:auto; min-height:0; } .photography-admin-layout { display:grid; grid-template-columns:1fr; overflow:visible; } .photography-admin-list { max-height:390px; } .photography-admin-form { overflow:hidden; } }
        @media(max-width:700px) { .photography-admin-header,.photography-admin-form-heading,.photography-admin-danger { align-items:flex-start; flex-direction:column; } .photography-admin-toolbar-notification { right:auto; left:0; top:auto; bottom:calc(100% + .55rem); max-width:min(260px,80vw); transform:none; } .photography-admin-form fieldset,.photography-cover-fieldset { grid-template-columns:1fr!important; } .photography-admin-form .wide { grid-column:auto; } .photography-media-source-grid { grid-template-columns:1fr; } .photography-gallery-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
        @media(max-width:430px) { .photography-gallery-grid { grid-template-columns:1fr; } }
        @media(prefers-reduced-motion:reduce) { .spin { animation:none; } }
      `}</style>
    </section>
  );
}
