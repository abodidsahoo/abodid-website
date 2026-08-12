import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowUpRight,
  ImagePlus,
  LoaderCircle,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { xrShowcaseFilters } from "../../data/xr-showcase";
import AdminPageHeader from "./AdminPageHeader";

const EMPTY_FORM = {
  id: null,
  slug: "",
  title: "",
  description: "",
  source_url: "",
  canonical_url: "",
  source_name: "",
  source_domain: "",
  primary_genre: "Creative Concepts",
  tags: [],
  preview_image_url: "",
  manual_image_url: "",
  image_alt: "",
  status: "published",
  metadata_status: "pending",
  metadata_error: "",
  metadata: {},
  featured: false,
  sort_order: 0,
};

const normalizeRow = (row) => ({
  ...EMPTY_FORM,
  ...row,
  tags: Array.isArray(row?.tags) ? row.tags : [],
  metadata: row?.metadata && typeof row.metadata === "object" ? row.metadata : {},
});

const slugify = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

const getGradientStyle = (seed) => {
  let hash = 2166136261;
  for (const character of String(seed || "xr")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const hueA = (hash >>> 0) % 360;
  const hueB = (hueA + 58 + ((hash >>> 8) % 70)) % 360;
  return {
    "--xr-admin-gradient-a": `hsl(${hueA} 72% 84%)`,
    "--xr-admin-gradient-b": `hsl(${hueB} 68% 82%)`,
  };
};

const readJson = async (response) => {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed with ${response.status}.`);
  return body;
};

function XRTagInput({ tags, onChange }) {
  const inputId = useId();
  const [value, setValue] = useState("");

  const addTag = () => {
    const tag = value.replace(/^#+/, "").replace(/\s+/g, " ").trim().slice(0, 60);
    if (!tag) return;
    if (!tags.some((item) => item.toLowerCase() === tag.toLowerCase())) {
      onChange([...tags, tag]);
    }
    setValue("");
  };

  return (
    <div className="xr-admin-tag-field">
      <label htmlFor={inputId}>Filter tags</label>
      {tags.length > 0 && (
        <div className="xr-admin-tag-list" aria-label="Filter tags added">
          {tags.map((tag) => (
            <span className="xr-admin-tag" key={tag}>
              {tag}
              <button
                type="button"
                aria-label={`Remove ${tag}`}
                onClick={() => onChange(tags.filter((item) => item !== tag))}
              >
                <X size={13} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="xr-admin-tag-editor">
        <input
          id={inputId}
          value={value}
          placeholder="Add a filter tag…"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (
              (event.key === "Enter" || event.key === ",") &&
              !event.nativeEvent?.isComposing
            ) {
              event.preventDefault();
              addTag();
            }
          }}
          onBlur={addTag}
        />
        <button
          type="button"
          className="xr-admin-tag-add"
          onMouseDown={(event) => event.preventDefault()}
          onClick={addTag}
          disabled={!value.trim()}
          aria-label="Add filter tag"
        >
          <Plus size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default function XRShowcaseManager({ accessToken }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [metadataSourceUrl, setMetadataSourceUrl] = useState("");
  const [listVisibility, setListVisibility] = useState({
    published: true,
    archived: false,
  });
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const extractionRef = useRef({ url: "", promise: null });

  const selectedId = form.id;
  const effectiveImage = form.manual_image_url || form.preview_image_url;
  const orderedItems = useMemo(
    () =>
      [...items].sort(
        (left, right) =>
          Number(left.sort_order || 0) - Number(right.sort_order || 0) ||
          left.title.localeCompare(right.title),
    ),
    [items],
  );
  const publishedCount = items.filter((item) => item.status === "published").length;
  const archivedCount = items.filter((item) => item.status === "archived").length;
  const visibleItems = orderedItems.filter(
    (item) =>
      (item.status === "published" && listVisibility.published) ||
      (item.status === "archived" && listVisibility.archived),
  );

  const loadItems = async ({ selectId } = {}) => {
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("xr_showcase_items")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (loadError) {
      setError(
        ["42P01", "PGRST205"].includes(loadError.code)
          ? "The XR Showcase table has not been installed yet."
          : loadError.message,
      );
      setItems([]);
      setLoading(false);
      return;
    }

    setItems(data || []);
    if (selectId) {
      const selected = data?.find((item) => item.id === selectId);
      if (selected) {
        setForm(normalizeRow(selected));
        setMetadataSourceUrl(selected.source_url || "");
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadItems();
  }, []);

  const startNew = () => {
    const nextOrder = items.length
      ? Math.max(...items.map((item) => Number(item.sort_order || 0))) + 10
      : 0;
    setForm({ ...EMPTY_FORM, sort_order: nextOrder });
    setMetadataSourceUrl("");
    setError("");
    setNotice("");
  };

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const requestMetadata = (url) => {
    if (extractionRef.current.url === url && extractionRef.current.promise) {
      return extractionRef.current.promise;
    }

    const promise = (async () => {
      const response = await fetch("/api/admin/xr-showcase/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ url }),
      });
      const { metadata } = await readJson(response);
      return metadata;
    })().finally(() => {
      if (extractionRef.current.url === url) {
        extractionRef.current = { url: "", promise: null };
      }
    });

    extractionRef.current = { url, promise };
    return promise;
  };

  const mergeMetadata = (current, metadata) => ({
    ...current,
    source_url: metadata.sourceUrl,
    canonical_url: metadata.canonicalUrl,
    title: metadata.title || current.title,
    slug: current.slug || slugify(metadata.title),
    description: metadata.description || current.description,
    source_name: metadata.sourceName,
    source_domain: metadata.sourceDomain,
    primary_genre: metadata.primaryGenre || current.primary_genre,
    tags: [...new Set([...(current.tags || []), ...(metadata.tags || [])])],
    preview_image_url: metadata.previewImageUrl || "",
    image_alt: metadata.imageAlt || current.image_alt,
    metadata_status: metadata.metadataStatus,
    metadata_error: "",
    metadata: metadata.metadata || {},
  });

  const extractMetadata = async () => {
    const url = form.source_url.trim();
    if (!url || extracting || metadataSourceUrl === url) return;

    setExtracting(true);
    setError("");
    setNotice("");
    try {
      const metadata = await requestMetadata(url);
      setForm((current) => mergeMetadata(current, metadata));
      setMetadataSourceUrl(metadata.sourceUrl);
      setNotice(
        metadata.previewImageUrl
          ? "Website details and thumbnail loaded. Every field remains editable."
          : "Website details loaded. No usable image was found, so the pastel gradient will be used.",
      );
    } catch (extractError) {
      setForm((current) => ({
        ...current,
        metadata_status: "error",
        metadata_error: extractError.message,
      }));
      setError(extractError.message);
    } finally {
      setExtracting(false);
    }
  };

  const uploadManualImage = async (file) => {
    if (!file || uploading) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      setError("Use a JPEG, PNG, WebP or GIF image.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("Images must be 20 MB or smaller.");
      return;
    }

    setUploading(true);
    setError("");
    setNotice("");
    try {
      const presignResponse = await fetch("/api/admin/media/presign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
          folder: "originals/xr-showcase",
        }),
      });
      const signed = await readJson(presignResponse);
      const uploadResponse = await fetch(signed.uploadUrl, {
        method: "PUT",
        headers: signed.requiredHeaders,
        body: file,
      });
      if (!uploadResponse.ok) {
        throw new Error(`The image upload failed with status ${uploadResponse.status}.`);
      }

      updateForm("manual_image_url", signed.publicUrl);
      setNotice("Manual image uploaded. It will override the website thumbnail after saving.");
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const publishItem = async (event) => {
    event.preventDefault();
    if (saving) return;
    const url = form.source_url.trim();
    if (!url) {
      setError("Paste a complete website link first.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      let publishForm = form;
      if (metadataSourceUrl !== url || !form.title.trim()) {
        setExtracting(true);
        const metadata = await requestMetadata(url);
        publishForm = mergeMetadata(form, metadata);
        setForm(publishForm);
        setMetadataSourceUrl(metadata.sourceUrl);
      }

      if (!publishForm.title.trim()) {
        throw new Error("The page did not provide a title. Add one before publishing.");
      }

      const payload = {
        slug: publishForm.slug.trim() || slugify(publishForm.title),
        title: publishForm.title.trim(),
        description: publishForm.description.trim(),
        source_url: publishForm.source_url.trim(),
        canonical_url: publishForm.canonical_url.trim() || publishForm.source_url.trim(),
        source_name: publishForm.source_name.trim() || null,
        source_domain: publishForm.source_domain.trim() || null,
        primary_genre: publishForm.primary_genre,
        tags: publishForm.tags,
        preview_image_url: publishForm.preview_image_url.trim() || null,
        manual_image_url: publishForm.manual_image_url.trim() || null,
        image_alt:
          publishForm.image_alt.trim() || `${publishForm.title.trim()} preview image`,
        status: "published",
        metadata_status: publishForm.metadata_status,
        metadata_error: publishForm.metadata_error || null,
        metadata: publishForm.metadata || {},
        featured: false,
        sort_order: Number(publishForm.sort_order) || 0,
      };

      const query = publishForm.id
        ? supabase.from("xr_showcase_items").update(payload).eq("id", publishForm.id)
        : supabase.from("xr_showcase_items").insert(payload);
      const { data, error: publishError } = await query.select("*").single();
      if (publishError) throw publishError;

      setNotice(publishForm.id ? "XR reference published." : "XR reference added and published.");
      setForm(normalizeRow(data));
      setMetadataSourceUrl(data.source_url || "");
      setListVisibility((current) => ({ ...current, published: true }));
      await loadItems({ selectId: data.id });
    } catch (publishError) {
      setError(publishError.message);
    } finally {
      setSaving(false);
      setExtracting(false);
    }
  };

  const toggleArchive = async () => {
    if (!form.id || saving) return;
    const nextStatus = form.status === "archived" ? "published" : "archived";
    setSaving(true);
    setError("");
    setNotice("");
    const { data, error: archiveError } = await supabase
      .from("xr_showcase_items")
      .update({ status: nextStatus })
      .eq("id", form.id)
      .select("*")
      .single();

    if (archiveError) {
      setError(archiveError.message);
      setSaving(false);
      return;
    }

    setForm(normalizeRow(data));
    setMetadataSourceUrl(data.source_url || "");
    setListVisibility((current) => ({
      ...current,
      [nextStatus === "published" ? "published" : "archived"]: true,
    }));
    setNotice(nextStatus === "archived" ? "XR reference archived." : "XR reference published again.");
    await loadItems({ selectId: data.id });
    setSaving(false);
  };

  const deleteItem = async () => {
    if (!form.id || !window.confirm(`Delete “${form.title}”? This cannot be undone.`)) return;
    setSaving(true);
    setError("");
    const { error: deleteError } = await supabase
      .from("xr_showcase_items")
      .delete()
      .eq("id", form.id);
    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return;
    }
    setNotice("XR reference deleted.");
    setForm(EMPTY_FORM);
    setMetadataSourceUrl("");
    await loadItems();
    setSaving(false);
  };

  return (
    <section className="xr-admin" aria-labelledby="xr-showcase-title">
      <header className="xr-admin-header">
        <AdminPageHeader
          className="xr-admin-page-header"
          headingId="xr-showcase-title"
          title="XR Showcase"
          description="Your taste is the only thing that will differentiate you."
        />
        <div className="xr-admin-header-actions">
          <a href="/xr-showcase" target="_blank" rel="noreferrer">
            View showcase <ArrowUpRight size={16} aria-hidden="true" />
          </a>
          <button type="button" onClick={startNew}>
            <Plus size={17} aria-hidden="true" /> Add a new link
          </button>
        </div>
      </header>

      {error && <div className="xr-admin-alert xr-admin-alert--error">{error}</div>}
      {notice && <div className="xr-admin-alert xr-admin-alert--notice">{notice}</div>}

      <div className="xr-admin-layout">
        <aside className="xr-admin-list">
          <div className="xr-admin-list-heading">
            <strong>{items.length} references</strong>
            <button type="button" onClick={() => loadItems()} aria-label="Refresh XR references">
              <RefreshCw size={15} aria-hidden="true" />
            </button>
          </div>
          <div className="xr-admin-list-filters" aria-label="Reference visibility">
            <label>
              <input
                type="checkbox"
                checked={listVisibility.published}
                onChange={(event) =>
                  setListVisibility((current) => ({
                    ...current,
                    published: event.target.checked,
                  }))
                }
              />
              <span>Published items</span>
              <small>{publishedCount}</small>
            </label>
            <label>
              <input
                type="checkbox"
                checked={listVisibility.archived}
                onChange={(event) =>
                  setListVisibility((current) => ({
                    ...current,
                    archived: event.target.checked,
                  }))
                }
              />
              <span>Archived items</span>
              <small>{archivedCount}</small>
            </label>
          </div>

          {loading ? (
            <div className="xr-admin-loading">
              <LoaderCircle size={19} className="spin" aria-hidden="true" /> Loading…
            </div>
          ) : (
            <div className="xr-admin-list-items">
              {visibleItems.length === 0 && (
                <p className="xr-admin-list-empty">No references match this view.</p>
              )}
              {visibleItems.map((item) => {
                const thumbnail =
                  item.effective_image_url || item.manual_image_url || item.preview_image_url;
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={selectedId === item.id ? "is-selected" : ""}
                    onClick={() => {
                      setForm(normalizeRow(item));
                      setMetadataSourceUrl(item.source_url || "");
                      setError("");
                      setNotice("");
                    }}
                  >
                    <span
                      className="xr-admin-list-thumb"
                      style={getGradientStyle(item.slug || item.id)}
                    >
                      {thumbnail && <img src={thumbnail} alt="" />}
                    </span>
                    <span className="xr-admin-list-copy">
                      <strong>{item.title}</strong>
                      <small>{item.primary_genre}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <form className="xr-admin-form" onSubmit={publishItem}>
          <div className="xr-admin-form-heading">
            <div>
              <p>{form.id ? "Edit reference" : "New reference"}</p>
              {form.id && <h3>{form.title || "Untitled XR link"}</h3>}
            </div>
            <div className="xr-admin-form-actions">
              {form.id && (
                <button type="button" className="secondary" onClick={toggleArchive} disabled={saving}>
                  {form.status === "archived" ? (
                    <ArchiveRestore size={16} aria-hidden="true" />
                  ) : (
                    <Archive size={16} aria-hidden="true" />
                  )}
                  {form.status === "archived" ? "Unarchive" : "Archive"}
                </button>
              )}
              {form.id && (
                <button type="button" className="danger" onClick={deleteItem}>
                  <Trash2 size={16} aria-hidden="true" /> Delete
                </button>
              )}
              <button type="submit" disabled={saving}>
                {saving ? (
                  <LoaderCircle size={16} className="spin" aria-hidden="true" />
                ) : (
                  <Send size={16} aria-hidden="true" />
                )}
                Publish
              </button>
            </div>
          </div>

          <fieldset className="xr-admin-link-fieldset">
            <legend>{form.id ? "Website link" : "Add a new link"}</legend>
            <label className="xr-admin-wide">
              <span>Website URL</span>
              <div className="xr-admin-url-row">
                <input
                  type="url"
                  value={form.source_url}
                  placeholder="https://example.com/xr-project"
                  onChange={(event) => {
                    updateForm("source_url", event.target.value);
                    setMetadataSourceUrl("");
                  }}
                  onBlur={extractMetadata}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      extractMetadata();
                    }
                  }}
                />
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={extractMetadata}
                  disabled={
                    extracting ||
                    !form.source_url.trim() ||
                    metadataSourceUrl === form.source_url.trim()
                  }
                >
                  {extracting && <LoaderCircle size={16} className="spin" aria-hidden="true" />}
                  {extracting
                    ? "Generating…"
                    : metadataSourceUrl === form.source_url.trim() && form.source_url.trim()
                      ? "Details generated"
                      : "Generate details"}
                </button>
              </div>
              <small>
                Paste the page URL first. The title, thumbnail and the remaining details will fill
                automatically below.
              </small>
            </label>
          </fieldset>

          <fieldset className="xr-admin-title-fieldset">
            <legend>Title</legend>
            <label className="xr-admin-wide">
              <span>Generated title</span>
              <input
                value={form.title}
                placeholder={extracting ? "Generating title…" : "Project or reference title"}
                maxLength={180}
                onChange={(event) => {
                  const title = event.target.value;
                  setForm((current) => ({
                    ...current,
                    title,
                    slug: current.id ? current.slug : slugify(title),
                  }));
                }}
              />
              <small>Generated from the website and still fully editable.</small>
            </label>
          </fieldset>

          <fieldset className="xr-admin-image-fieldset">
            <legend>Thumbnail</legend>
            <div
              className="xr-admin-preview"
              style={getGradientStyle(form.slug || form.title || "new-xr-link")}
            >
              {effectiveImage && (
                <img
                  src={effectiveImage}
                  alt={form.image_alt || "XR preview"}
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              )}
            </div>
            <div className="xr-admin-image-controls">
              <label>
                <span>Manual image URL</span>
                <input
                  type="url"
                  value={form.manual_image_url}
                  placeholder="https://…"
                  onChange={(event) => updateForm("manual_image_url", event.target.value)}
                />
              </label>
              <div className="xr-admin-upload-row">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(event) => uploadManualImage(event.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <LoaderCircle size={16} className="spin" aria-hidden="true" />
                  ) : (
                    <ImagePlus size={16} aria-hidden="true" />
                  )}
                  Upload replacement
                </button>
                {form.manual_image_url && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => updateForm("manual_image_url", "")}
                  >
                    Use website image
                  </button>
                )}
              </div>
              <label>
                <span>Image description</span>
                <input
                  value={form.image_alt}
                  placeholder="Describe the thumbnail for accessibility"
                  onChange={(event) => updateForm("image_alt", event.target.value)}
                />
              </label>
              <small>
                A manual image overrides the automatic website image. If neither works, the public
                card uses its two-colour pastel gradient.
              </small>
            </div>
          </fieldset>

          <fieldset>
            <legend>Content</legend>
            <label className="xr-admin-wide">
              <span>Description</span>
              <textarea
                rows={5}
                value={form.description}
                placeholder="A concise explanation of why this belongs in the XR showcase"
                maxLength={1200}
                onChange={(event) => updateForm("description", event.target.value)}
              />
            </label>
            <label>
              <span>Source name</span>
              <input
                value={form.source_name}
                placeholder="Studio, publication or organisation"
                onChange={(event) => updateForm("source_name", event.target.value)}
              />
            </label>
            <label>
              <span>Main category</span>
              <select
                value={form.primary_genre}
                onChange={(event) => updateForm("primary_genre", event.target.value)}
              >
                {xrShowcaseFilters
                  .filter((filter) => filter !== "All")
                  .map((filter) => (
                    <option value={filter} key={filter}>
                      {filter}
                    </option>
                  ))}
              </select>
              <small>This places the reference under one broad showcase filter.</small>
            </label>
            <div className="xr-admin-wide xr-admin-tag-section">
              <XRTagInput tags={form.tags} onChange={(tags) => updateForm("tags", tags)} />
              <small>Press Enter or comma after every tag.</small>
            </div>
          </fieldset>

        </form>
      </div>

      <style>{`
        .xr-admin { display:grid; gap:2rem; width:100%; max-width:var(--admin-page-content-max); margin:0; color:var(--text-primary); }
        .xr-admin-header { display:flex; justify-content:space-between; gap:2rem; align-items:flex-end; padding:var(--admin-page-heading-offset-block) var(--admin-page-heading-offset-inline) 1.5rem; border-bottom:1px solid var(--border-subtle); }
        .xr-admin-page-header { min-width:0; flex:1 1 34rem; }
        .xr-admin-form-heading p { margin:0 0 .3rem; color:var(--text-tertiary); font-size:.72rem; font-weight:800; letter-spacing:.09em; text-transform:uppercase; }
        .xr-admin-header-actions,.xr-admin-form-actions,.xr-admin-upload-row { display:flex; flex-wrap:wrap; gap:.55rem; align-items:center; }
        .xr-admin-header-actions { flex:0 0 auto; padding-bottom:.25rem; }
        .xr-admin button,.xr-admin a { font:700 .84rem/1 var(--font-ui); }
        .xr-admin-header-actions a,.xr-admin-header-actions button,.xr-admin-form-actions button,.xr-admin-url-row button,.xr-admin-upload-row button { display:inline-flex; align-items:center; justify-content:center; gap:.4rem; min-height:2.5rem; border:1px solid var(--border-subtle); border-radius:8px; padding:.65rem .85rem; background:var(--text-primary); color:var(--bg-color); text-decoration:none; cursor:pointer; }
        .xr-admin button:disabled { opacity:.48; cursor:not-allowed; }
        .xr-admin-header-actions a { background:transparent; color:var(--text-primary); }
        .xr-admin-alert { border:1px solid var(--border-subtle); border-radius:9px; padding:.8rem 1rem; font-size:.88rem; }
        .xr-admin-alert--error { border-color:color-mix(in srgb,#ef4444 48%,var(--border-subtle)); background:color-mix(in srgb,#ef4444 9%,transparent); color:#ef4444; }
        .xr-admin-alert--notice { border-color:color-mix(in srgb,#22c55e 40%,var(--border-subtle)); background:color-mix(in srgb,#22c55e 8%,transparent); }
        .xr-admin-layout { display:grid; grid-template-columns:minmax(240px,320px) minmax(0,1fr); gap:1rem; align-items:start; }
        .xr-admin-list,.xr-admin-form { border:1px solid var(--border-subtle); border-radius:12px; background:var(--bg-surface); overflow:hidden; }
        .xr-admin-list { position:sticky; top:1rem; max-height:calc(100vh - 2rem); display:grid; grid-template-rows:auto auto minmax(0,1fr); }
        .xr-admin-list-heading { display:flex; justify-content:space-between; align-items:center; padding:.85rem 1rem; border-bottom:1px solid var(--border-subtle); }
        .xr-admin-list-heading button { display:grid; place-items:center; border:0; padding:.3rem; background:transparent; color:var(--text-secondary); cursor:pointer; }
        .xr-admin-list-filters { display:grid; gap:.45rem; padding:.75rem 1rem; border-bottom:1px solid var(--border-subtle); }
        .xr-admin-list-filters label { display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:.55rem; align-items:center; color:var(--text-secondary); font-size:.76rem; font-weight:700; cursor:pointer; }
        .xr-admin-list-filters input { width:auto; margin:0; accent-color:var(--text-primary); }
        .xr-admin-list-filters small { color:var(--text-tertiary); font-size:.7rem; }
        .xr-admin-list-items { overflow:auto; padding:.45rem; }
        .xr-admin-list-empty { margin:0; padding:1rem .65rem; color:var(--text-tertiary); font-size:.78rem; }
        .xr-admin-list-items>button { display:grid; grid-template-columns:64px minmax(0,1fr); gap:.7rem; width:100%; align-items:center; border:1px solid transparent; border-radius:9px; padding:.5rem; background:transparent; color:inherit; text-align:left; cursor:pointer; }
        .xr-admin-list-items>button:hover,.xr-admin-list-items>button.is-selected { border-color:var(--border-subtle); background:var(--bg-surface-hover); }
        .xr-admin-list-thumb,.xr-admin-preview { position:relative; overflow:hidden; background:radial-gradient(circle at 20% 18%,var(--xr-admin-gradient-a),transparent 62%),radial-gradient(circle at 80% 82%,var(--xr-admin-gradient-b),transparent 64%),linear-gradient(135deg,var(--xr-admin-gradient-a),var(--xr-admin-gradient-b)); }
        .xr-admin-list-thumb { width:64px; aspect-ratio:1.2; border-radius:6px; }
        .xr-admin-list-thumb img,.xr-admin-preview img { width:100%; height:100%; object-fit:cover; }
        .xr-admin-list-copy { min-width:0; }
        .xr-admin-list-copy strong { display:block; overflow:hidden; color:var(--text-primary); font-size:.84rem; line-height:1.25; text-overflow:ellipsis; white-space:nowrap; }
        .xr-admin-list-copy small { display:block; overflow:hidden; margin-top:.3rem; color:var(--text-tertiary); font-size:.7rem; text-overflow:ellipsis; white-space:nowrap; text-transform:capitalize; }
        .xr-admin-loading { display:flex; gap:.5rem; align-items:center; padding:1rem; color:var(--text-secondary); }
        .xr-admin-form { padding:clamp(1rem,2.2vw,1.5rem); }
        .xr-admin-form-heading { display:flex; justify-content:space-between; gap:1rem; align-items:center; padding-bottom:1rem; }
        .xr-admin-form-heading h3 { margin:0; font-size:clamp(1.35rem,2.4vw,2rem); }
        .xr-admin-form-actions button.secondary { background:transparent; color:var(--text-primary); }
        .xr-admin-form-actions button.danger { background:transparent; color:#ef4444; }
        .xr-admin-form fieldset { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1rem; margin:0; border:0; border-top:1px solid var(--border-subtle); padding:1.4rem 0; }
        .xr-admin-form legend { grid-column:1/-1; padding:0 0 .2rem; color:var(--text-primary); font-size:.9rem; font-weight:800; }
        .xr-admin-form .xr-admin-link-fieldset { margin:.2rem 0 .45rem; border:1px solid var(--border-strong); border-radius:12px; padding:clamp(1rem,2vw,1.35rem); background:color-mix(in srgb,var(--bg-color) 76%,var(--bg-surface-hover)); box-shadow:0 10px 30px color-mix(in srgb,#000 9%,transparent); }
        .xr-admin-form .xr-admin-link-fieldset legend { padding:0 .45rem; font-size:clamp(1.08rem,2vw,1.3rem); }
        .xr-admin-form label { display:grid; gap:.42rem; min-width:0; }
        .xr-admin-form label>span,.xr-admin-image-controls label>span { color:var(--text-secondary); font-size:.75rem; font-weight:750; }
        .xr-admin-form input,.xr-admin-form textarea,.xr-admin-form select,.xr-admin-tag-editor { width:100%; border:1px solid var(--border-subtle); border-radius:8px; padding:.72rem .8rem; background:var(--bg-color); color:var(--text-primary); font:500 .9rem/1.4 var(--font-sans); box-sizing:border-box; }
        .xr-admin-form textarea { resize:vertical; }
        .xr-admin-form input:focus,.xr-admin-form textarea:focus,.xr-admin-form select:focus,.xr-admin-tag-editor:focus-within { outline:2px solid var(--border-focus); outline-offset:2px; }
        .xr-admin-form small { color:var(--text-tertiary); font-size:.72rem; line-height:1.4; }
        .xr-admin-wide { grid-column:1/-1; }
        .xr-admin-url-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:.55rem; }
        .xr-admin-url-row button { min-width:8.5rem; }
        .xr-admin-link-fieldset input { min-height:3.3rem; border-color:var(--border-strong); background:var(--bg-surface); font-size:1rem; }
        .xr-admin-title-fieldset { padding-top:1.15rem!important; }
        .xr-admin-image-fieldset { grid-template-columns:minmax(180px,.75fr) minmax(0,1.25fr)!important; }
        .xr-admin-preview { width:100%; aspect-ratio:16/10; border-radius:10px; border:1px solid var(--border-subtle); }
        .xr-admin-image-controls { display:grid; gap:.8rem; align-content:start; }
        .xr-admin-upload-row input[type=file] { display:none; }
        .xr-admin-upload-row button.secondary { background:transparent; color:var(--text-primary); }
        .xr-admin-tag-section,.xr-admin-tag-field { display:grid; gap:.42rem; min-width:0; }
        .xr-admin-tag-field>label { color:var(--text-secondary); font-size:.75rem; font-weight:750; }
        .xr-admin-tag-editor { min-height:2.85rem; display:grid; grid-template-columns:minmax(0,1fr) 2rem; align-items:center; gap:.4rem; padding:.28rem .35rem .28rem .7rem; }
        .xr-admin-tag-editor>input { min-width:0; border:0; padding:0; outline:0!important; background:transparent; box-shadow:none!important; }
        .xr-admin-tag-add { width:2rem; height:2rem; display:grid; place-items:center; padding:0; border:0; border-radius:6px; background:var(--text-primary); color:var(--bg-color); cursor:pointer; }
        .xr-admin-tag-add:disabled { opacity:.24; cursor:default; }
        .xr-admin-tag-list { max-width:100%; min-height:1.75rem; display:flex; flex-wrap:wrap; align-items:center; gap:.35rem; padding:.05rem 0 .2rem; }
        .xr-admin-tag { display:inline-flex; gap:.3rem; align-items:center; border:1px solid var(--border-subtle); border-radius:999px; padding:.3rem .42rem .3rem .58rem; background:var(--bg-surface-hover); color:var(--text-primary); font-size:.7rem; font-weight:700; }
        .xr-admin-tag button { display:grid; place-items:center; border:0; padding:0; background:transparent; color:inherit; cursor:pointer; }
        .spin { animation:xr-admin-spin .8s linear infinite; }
        @keyframes xr-admin-spin { to { transform:rotate(360deg); } }
        @media(max-width:1180px) { .xr-admin-header { align-items:flex-start; flex-direction:column; } }
        @media(max-width:900px) { .xr-admin-layout { grid-template-columns:1fr; } .xr-admin-list { position:static; max-height:340px; } }
        @media(max-width:640px) { .xr-admin-form-heading { align-items:flex-start; flex-direction:column; } .xr-admin-form fieldset,.xr-admin-image-fieldset { grid-template-columns:1fr!important; } .xr-admin-wide { grid-column:auto; } .xr-admin-url-row { grid-template-columns:1fr; } }
        @media(prefers-reduced-motion:reduce) { .spin { animation:none; } }
      `}</style>
    </section>
  );
}
