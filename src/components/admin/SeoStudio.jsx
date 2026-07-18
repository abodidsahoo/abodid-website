import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Image as ImageIcon,
  LoaderCircle,
  Plus,
  Search,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import {
  formatSeoTitle,
  getSeoReadiness,
  mergeManagedSeoPages,
  normalizeSeoPagePath,
  SEO_SITE_URL,
} from "../../lib/seoMetadata.js";
import "./seo-studio.css";

const EMPTY_FORM = {
  id: null,
  page_path: "/",
  page_title: "",
  focus_keyword: "",
  meta_title: "",
  meta_description: "",
  og_image_url: "",
  og_image_alt: "",
  og_type: "website",
  robots_index: true,
  is_active: true,
};

const cleanPayloadValue = (value) => {
  const cleaned = typeof value === "string" ? value.trim() : value;
  return cleaned === "" ? null : cleaned;
};

const buildOgFile = (file) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    const sourceUrl = URL.createObjectURL(file);

    image.onload = () => {
      try {
        const width = 1200;
        const height = 630;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Your browser could not prepare this image.");

        const scale = Math.max(width / image.width, height / image.height);
        const drawWidth = image.width * scale;
        const drawHeight = image.height * scale;
        const x = (width - drawWidth) / 2;
        const y = (height - drawHeight) / 2;

        context.drawImage(image, x, y, drawWidth, drawHeight);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(sourceUrl);
            if (!blob) {
              reject(new Error("The social image could not be processed."));
              return;
            }
            resolve(
              new File([blob], `og-${Date.now()}.jpg`, {
                type: "image/jpeg",
              }),
            );
          },
          "image/jpeg",
          0.9,
        );
      } catch (error) {
        URL.revokeObjectURL(sourceUrl);
        reject(error);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(sourceUrl);
      reject(new Error("Please choose a valid JPG, PNG, or WebP image."));
    };
    image.src = sourceUrl;
  });

const StatusPill = ({ ready, readyLabel = "Ready", emptyLabel = "Missing" }) => (
  <span className={`seo-status-pill ${ready ? "ready" : "missing"}`}>
    {ready ? <Check size={13} /> : <X size={13} />}
    {ready ? readyLabel : emptyLabel}
  </span>
);

export default function SeoStudio() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [verification, setVerification] = useState(null);
  const requestedEditRef = useRef(
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("edit"),
  );
  const requestedPrefillRef = useRef(
    typeof window === "undefined"
      ? null
      : (() => {
          const params = new URLSearchParams(window.location.search);
          const pagePath = params.get("edit");
          if (!pagePath) return null;
          return {
            page_path: pagePath,
            page_title: params.get("prefill_page_title") || "",
            meta_title: params.get("prefill_meta_title") || "",
            meta_description: params.get("prefill_meta_description") || "",
            og_image_url: params.get("prefill_og_image_url") || "",
            og_image_alt: params.get("prefill_og_image_alt") || "",
            robots_index: params.get("prefill_robots_index") !== "false",
            is_active: true,
          };
        })(),
  );

  const pages = useMemo(() => mergeManagedSeoPages(rows), [rows]);
  const filteredPages = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return pages;

    return pages.filter((page) =>
      [page.page_title, page.page_path, page.focus_keyword]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }, [pages, query]);

  const socialPreviewUrl = form
    ? form.og_image_url ||
      `/api/og?title=${encodeURIComponent(
        form.meta_title || form.page_title || "Abodid Sahoo",
      )}&description=${encodeURIComponent(form.meta_description || "")}`
    : "";

  useEffect(() => {
    loadMetadata();
  }, []);

  const notify = (type, message) => {
    setNotice({ type, message });
    window.setTimeout(() => setNotice(null), 4500);
  };

  const setEditParam = (value) => {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set("edit", value);
    else url.searchParams.delete("edit");
    window.history.replaceState({}, "", url);
  };

  const openEditor = (page) => {
    setForm({
      ...EMPTY_FORM,
      ...page,
      id: page.id || null,
      page_path: normalizeSeoPagePath(page.page_path),
      page_title: page.page_title || "",
      focus_keyword: page.focus_keyword || "",
      meta_title: page.meta_title || "",
      meta_description: page.meta_description || "",
      og_image_url: page.og_image_url || "",
      og_image_alt: page.og_image_alt || "",
      robots_index: page.robots_index !== false,
      is_active: page.is_active ?? true,
    });
    setVerification(null);
    setEditParam(page.id || page.page_path);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeEditor = () => {
    setForm(null);
    setVerification(null);
    setEditParam(null);
  };

  const loadMetadata = async (preferredEdit = null) => {
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("page_metadata")
      .select("*")
      .order("page_path", { ascending: true });

    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }

    const nextRows = data || [];
    setRows(nextRows);
    setLoading(false);

    const editKey = preferredEdit || requestedEditRef.current;
    requestedEditRef.current = null;
    if (editKey) {
      const merged = mergeManagedSeoPages(nextRows);
      const requestedPage = merged.find(
        (page) => page.id === editKey || page.page_path === editKey,
      );
      const requestedPrefill = requestedPrefillRef.current;
      requestedPrefillRef.current = null;
      if (requestedPage || requestedPrefill) {
        const page = { ...EMPTY_FORM, ...(requestedPrefill || {}), ...(requestedPage || {}) };
        openEditor(page);
      }
    }
  };

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setVerification(null);
  };

  const validateForm = () => {
    if (!form.page_path.trim()) return "Add a page path.";
    if (!form.page_title.trim()) return "Add an internal page name.";
    if (form.is_active && !form.focus_keyword.trim()) {
      return "Add the main search phrase for this page.";
    }
    if (form.is_active && !form.meta_title.trim()) return "Add an SEO title.";
    if (form.is_active && !form.meta_description.trim()) {
      return "Add a search description.";
    }
    if (form.og_image_url && !form.og_image_alt.trim()) {
      return "Describe the social image for accessibility.";
    }
    return null;
  };

  const savePage = async () => {
    const validationError = validateForm();
    if (validationError) {
      notify("error", validationError);
      return;
    }

    setSaving(true);
    const normalizedPath = normalizeSeoPagePath(form.page_path);
    const payload = {
      page_path: normalizedPath,
      page_title: form.page_title.trim(),
      focus_keyword: cleanPayloadValue(form.focus_keyword),
      meta_title: cleanPayloadValue(form.meta_title),
      meta_description: cleanPayloadValue(form.meta_description),
      og_image_url: cleanPayloadValue(form.og_image_url),
      og_image_alt: cleanPayloadValue(form.og_image_alt),
      og_type: normalizedPath === "/blog" || normalizedPath.startsWith("/blog/")
        ? "article"
        : "website",
      robots_index: Boolean(form.robots_index),
      is_active: Boolean(form.is_active),
    };

    const queryBuilder = form.id
      ? supabase.from("page_metadata").update(payload).eq("id", form.id)
      : supabase.from("page_metadata").upsert(payload, {
          onConflict: "page_path",
        });
    const { data, error: saveError } = await queryBuilder.select().single();

    setSaving(false);
    if (saveError) {
      notify("error", saveError.message);
      return;
    }

    setForm((current) => ({ ...current, ...data }));
    notify(
      "success",
      data.is_active
        ? "SEO settings published. Cached pages can take a few minutes to refresh."
        : "SEO override saved as inactive.",
    );
    await loadMetadata(data.id);
  };

  const uploadOgImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify("error", "Please choose an image file.");
      return;
    }

    setUploading(true);
    try {
      const preparedFile = await buildOgFile(file);
      const uniquePart =
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);
      const filePath = `og-images/${Date.now()}-${uniquePart}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("page-assets")
        .upload(filePath, preparedFile, {
          contentType: "image/jpeg",
          cacheControl: "31536000",
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("page-assets")
        .getPublicUrl(filePath);
      updateField("og_image_url", data.publicUrl);
      notify("success", "Social image prepared at 1200 × 630 pixels.");
    } catch (uploadError) {
      notify("error", uploadError.message || "Image upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const verifyLivePage = async () => {
    if (!form?.is_active) {
      notify("error", "Enable the live SEO override before verifying it.");
      return;
    }

    setVerification({ loading: true, checks: [] });
    try {
      const path = normalizeSeoPagePath(form.page_path);
      const separator = path.includes("?") ? "&" : "?";
      const response = await fetch(`${path}${separator}seo_verify=${Date.now()}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`The live page returned ${response.status}.`);

      const html = await response.text();
      const documentCopy = new DOMParser().parseFromString(html, "text/html");
      const actualTitle = documentCopy.querySelector("title")?.textContent?.trim() || "";
      const actualDescription =
        documentCopy.querySelector('meta[name="description"]')?.getAttribute("content") ||
        "";
      const actualImage =
        documentCopy.querySelector('meta[property="og:image"]')?.getAttribute("content") ||
        "";
      const robots =
        documentCopy.querySelector('meta[name="robots"]')?.getAttribute("content") ||
        "";
      const expectedTitle = formatSeoTitle(form.meta_title || form.page_title);

      const checks = [
        { label: "SEO title is live", pass: actualTitle === expectedTitle },
        {
          label: "Search description is live",
          pass: actualDescription === form.meta_description.trim(),
        },
        {
          label: "Social image is live",
          pass: form.og_image_url
            ? actualImage === form.og_image_url
            : actualImage.includes("/api/og"),
        },
        {
          label: form.robots_index ? "Page can be indexed" : "Page is noindex",
          pass: form.robots_index ? !robots.includes("noindex") : robots.includes("noindex"),
        },
      ];
      setVerification({ loading: false, checks });
    } catch (verificationError) {
      setVerification({
        loading: false,
        error: verificationError.message || "Verification failed.",
        checks: [],
      });
    }
  };

  if (loading) {
    return (
      <div className="seo-studio-state">
        <LoaderCircle className="spin" size={22} /> Loading SEO pages…
      </div>
    );
  }

  if (error) {
    return (
      <div className="seo-studio-error">
        <strong>SEO Studio could not load.</strong>
        <span>{error}</span>
        <button type="button" onClick={() => loadMetadata()}>
          Try again
        </button>
      </div>
    );
  }

  if (form) {
    const formattedPreviewTitle = formatSeoTitle(form.meta_title || form.page_title);
    const pageUrl = `${SEO_SITE_URL}${normalizeSeoPagePath(form.page_path) === "/" ? "/" : normalizeSeoPagePath(form.page_path)}`;

    return (
      <section className="seo-studio seo-editor-view">
        {notice && <div className={`seo-toast ${notice.type}`}>{notice.message}</div>}

        <header className="seo-studio-header editor-header">
          <div>
            <button type="button" className="seo-back-button" onClick={closeEditor}>
              <ArrowLeft size={16} /> All SEO pages
            </button>
            <h2>{form.page_title || "New SEO page"}</h2>
            <p>{normalizeSeoPagePath(form.page_path)}</p>
          </div>
          <div className="seo-header-actions">
            <a
              href={normalizeSeoPagePath(form.page_path)}
              target="_blank"
              rel="noreferrer"
              className="seo-button secondary"
            >
              Open page <ExternalLink size={15} />
            </a>
            <button
              type="button"
              className="seo-button primary"
              onClick={savePage}
              disabled={saving || uploading}
            >
              {saving ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}
              Save settings
            </button>
          </div>
        </header>

        <div className="seo-editor-grid">
          <div className="seo-form-column">
            <section className="seo-panel">
              <div className="seo-panel-heading">
                <span className="seo-panel-icon"><Search size={18} /></span>
                <div>
                  <h3>Search appearance</h3>
                  <p>Tell search engines and AI search what this page is about.</p>
                </div>
              </div>

              <div className="seo-field-grid two-columns">
                <label className="seo-field">
                  <span>Page URL</span>
                  <input
                    value={form.page_path}
                    onChange={(event) => updateField("page_path", event.target.value)}
                    onBlur={() => updateField("page_path", normalizeSeoPagePath(form.page_path))}
                    placeholder="/about"
                  />
                </label>
                <label className="seo-field">
                  <span>Internal page name</span>
                  <input
                    value={form.page_title}
                    onChange={(event) => updateField("page_title", event.target.value)}
                    placeholder="About"
                  />
                </label>
              </div>

              <label className="seo-field">
                <span>Main search phrase</span>
                <input
                  value={form.focus_keyword}
                  onChange={(event) => updateField("focus_keyword", event.target.value)}
                  placeholder="e.g. creative technology consultant"
                />
                <small>Planning only. This is not emitted as a meta-keywords tag.</small>
              </label>

              <label className="seo-field">
                <span>SEO title</span>
                <input
                  value={form.meta_title}
                  onChange={(event) => updateField("meta_title", event.target.value)}
                  placeholder="Creative Technology Consulting"
                />
                <small>{form.meta_title.length} characters · the site name is added automatically.</small>
              </label>

              <label className="seo-field">
                <span>Search description</span>
                <textarea
                  value={form.meta_description}
                  onChange={(event) => updateField("meta_description", event.target.value)}
                  placeholder="A clear, specific summary of what visitors will find on this page."
                  rows={4}
                />
                <small>{form.meta_description.length} characters · aim for a useful one or two sentence summary.</small>
              </label>

              <div className="seo-toggle-row">
                <div>
                  <strong>Allow search engines to index this page</strong>
                  <span>Turn this off only for pages that should stay out of search.</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.robots_index}
                  className={`seo-switch ${form.robots_index ? "on" : ""}`}
                  onClick={() => updateField("robots_index", !form.robots_index)}
                >
                  <span />
                </button>
              </div>
            </section>

            <section className="seo-panel">
              <div className="seo-panel-heading">
                <span className="seo-panel-icon"><ImageIcon size={18} /></span>
                <div>
                  <h3>Social sharing image</h3>
                  <p>One image and description for LinkedIn, X, Facebook and messaging apps.</p>
                </div>
              </div>

              {form.og_image_url ? (
                <div className="seo-image-editor">
                  <img src={form.og_image_url} alt={form.og_image_alt || "Current social preview"} />
                  <div className="seo-image-actions">
                    <label className="seo-button secondary compact" htmlFor="seo-og-replace">
                      <Upload size={14} /> Replace image
                    </label>
                    <input
                      id="seo-og-replace"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={uploadOgImage}
                      hidden
                    />
                    <button
                      type="button"
                      className="seo-button danger compact"
                      onClick={() => updateField("og_image_url", "")}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <label className={`seo-upload-zone ${uploading ? "uploading" : ""}`} htmlFor="seo-og-upload">
                  {uploading ? <LoaderCircle className="spin" size={24} /> : <Upload size={24} />}
                  <strong>{uploading ? "Preparing image…" : "Upload social image"}</strong>
                  <span>JPG, PNG or WebP · automatically fitted to 1200 × 630</span>
                  <input
                    id="seo-og-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={uploadOgImage}
                    hidden
                    disabled={uploading}
                  />
                </label>
              )}

              {form.og_image_url && (
                <label className="seo-field">
                  <span>Image description</span>
                  <input
                    value={form.og_image_alt}
                    onChange={(event) => updateField("og_image_alt", event.target.value)}
                    placeholder="Describe the image clearly for people using screen readers"
                  />
                </label>
              )}
            </section>

            <section className="seo-panel compact-panel">
              <div className="seo-toggle-row">
                <div>
                  <strong>Use these admin settings on the live page</strong>
                  <span>When off, the page falls back to its built-in title and description.</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.is_active}
                  className={`seo-switch ${form.is_active ? "on" : ""}`}
                  onClick={() => updateField("is_active", !form.is_active)}
                >
                  <span />
                </button>
              </div>
            </section>
          </div>

          <aside className="seo-preview-column">
            <section className="seo-preview-panel">
              <div className="seo-preview-heading">
                <span>Google preview</span>
                <small>Approximation</small>
              </div>
              <div className="google-preview-card">
                <div className="google-source-row">
                  <span className="google-favicon">A</span>
                  <div><strong>Abodid Sahoo</strong><span>{pageUrl}</span></div>
                </div>
                <div className="google-title">{formattedPreviewTitle}</div>
                <p>{form.meta_description || "Your search description will appear here."}</p>
              </div>
            </section>

            <section className="seo-preview-panel">
              <div className="seo-preview-heading">
                <span>Social preview</span>
                <small>LinkedIn / X / messages</small>
              </div>
              <div className="social-preview-card">
                <img src={socialPreviewUrl} alt="Social sharing preview" />
                <div className="social-preview-copy">
                  <span>ABODID.COM</span>
                  <strong>{formattedPreviewTitle}</strong>
                  <p>{form.meta_description || "Your social description will appear here."}</p>
                </div>
              </div>
            </section>

            <section className="seo-preview-panel verification-panel">
              <div className="seo-preview-heading">
                <span>Live check</span>
                <ShieldCheck size={17} />
              </div>
              <p>After saving, compare these settings with the real public HTML.</p>
              <button
                type="button"
                className="seo-button secondary full-width"
                onClick={verifyLivePage}
                disabled={verification?.loading}
              >
                {verification?.loading ? <LoaderCircle className="spin" size={16} /> : <ShieldCheck size={16} />}
                Verify live page
              </button>
              {verification?.error && <div className="verification-error">{verification.error}</div>}
              {verification?.checks?.length > 0 && (
                <ul className="verification-list">
                  {verification.checks.map((check) => (
                    <li key={check.label} className={check.pass ? "pass" : "fail"}>
                      {check.pass ? <Check size={15} /> : <X size={15} />}
                      {check.label}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </section>
    );
  }

  return (
    <section className="seo-studio">
      {notice && <div className={`seo-toast ${notice.type}`}>{notice.message}</div>}
      <header className="seo-studio-header">
        <div>
          <span className="seo-eyebrow">Search & social</span>
          <h2>SEO Studio</h2>
          <p>Give each important page one clear search topic and one strong sharing image.</p>
        </div>
        <button
          type="button"
          className="seo-button primary"
          onClick={() => openEditor({ ...EMPTY_FORM, page_path: "/new-page", page_title: "New page" })}
        >
          <Plus size={16} /> Add page
        </button>
      </header>

      <div className="seo-list-toolbar">
        <label className="seo-search-box">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a page or search phrase"
            aria-label="Find a page or search phrase"
          />
        </label>
        <span>{filteredPages.length} pages</span>
      </div>

      <div className="seo-page-list">
        <div className="seo-page-list-head" aria-hidden="true">
          <span>Page</span>
          <span>Main search phrase</span>
          <span>Search</span>
          <span>Social image</span>
          <span />
        </div>
        {filteredPages.map((page) => {
          const readiness = getSeoReadiness(page);
          return (
            <article className="seo-page-row" key={page.id || page.page_path}>
              <div className="seo-page-identity">
                <strong>{page.page_title}</strong>
                <span>{page.page_path}</span>
              </div>
              <div className="seo-keyword-cell">
                {page.focus_keyword || <span className="muted">Not set</span>}
              </div>
              <StatusPill
                ready={readiness.searchReady}
                emptyLabel={readiness.state === "draft" ? "Inactive" : "Needs text"}
              />
              <StatusPill ready={readiness.socialReady} emptyLabel="Needs image" />
              <button type="button" className="seo-edit-button" onClick={() => openEditor(page)}>
                Edit
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
