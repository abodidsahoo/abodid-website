import React, { useCallback, useEffect, useRef, useState } from "react";
import "../../styles/portfolio-admin.css";
import BlogStudioBlockEditor from "./blog/BlogStudioBlockEditor";
import PortfolioMediaPicker from "../portfolio/admin/PortfolioMediaPicker";
import {
    getAdminBlog,
    saveBlogDraft,
    publishBlogPost,
    unpublishBlogPost,
    updateBlogSlug,
    uploadBlogImage,
} from "../../lib/blogAdmin";

const SAVE_LABELS = { idle: "All changes saved", unsaved: "Unsaved changes", saving: "Saving…", error: "Save failed" };
const DESIGN_SECTIONS = ["basics", "content", "media"];
const PUBLIC_BLOG_CHANNEL = "blog-public-update";

function notifyLiveSiteUpdate(slug) {
    try {
        window.localStorage.setItem(PUBLIC_BLOG_CHANNEL, JSON.stringify({ slug, timestamp: Date.now() }));
        if ("BroadcastChannel" in window) {
            const channel = new BroadcastChannel(PUBLIC_BLOG_CHANNEL);
            channel.postMessage({ slug, timestamp: Date.now() });
            channel.close();
        }
    } catch {
        // Fallback
    }
}

function useSaveState() {
    const [state, setState] = useState("idle");
    const mark = useCallback(next => setState(next), []);
    const onSuccess = useCallback(() => {
        setState("saved");
        setTimeout(() => setState("idle"), 2500);
    }, []);
    return { state, mark, onSuccess };
}

// ─── Tag Chip Input Component ──────────────────────────────────────────────────
function TaxonomyTagField({ label, placeholder, priority, terms = [], onChange }) {
    const [value, setValue] = useState("");

    const addTag = () => {
        const trimmed = value.trim();
        if (!trimmed) return;
        if (!terms.includes(trimmed)) onChange([...terms, trimmed]);
        setValue("");
    };

    const removeTag = (tagToRemove) => onChange(terms.filter((t) => t !== tagToRemove));

    return (
        <div className={`taxonomy-tag-field ${priority ? "is-priority" : ""}`}>
            <label className="editor-field taxonomy-tag-input">
                <span>{label}</span>
                <input
                    value={value}
                    placeholder={placeholder}
                    onChange={(event) => setValue(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === ",") {
                            event.preventDefault();
                            addTag();
                        }
                    }}
                />
            </label>
            <div className="taxonomy-tag-list" aria-label={`${label} tags`}>
                {terms.map((term) => (
                    <button
                        type="button"
                        className="taxonomy-tag-chip"
                        key={term}
                        onClick={() => removeTag(term)}
                        title="Remove tag"
                    >
                        <span>{term}</span>
                        <b aria-hidden="true">×</b>
                    </button>
                ))}
            </div>
        </div>
    );
}

// ─── Basics Panel ─────────────────────────────────────────────────────────────
function BasicsPanel({ draft, onChange, onCoverUpload, onChooseCover, coverUploading }) {
    const coverInputRef = useRef(null);

    return (
        <section className="editor-spine-card" id="portfolio-design-basics" role="tabpanel">
            <span className="editor-eyebrow">Post spine</span>
            <div className="editor-spine-grid">
                <div className="editor-spine-fields">
                    <label className="editor-field">
                        <span>Post title <b>*</b></span>
                        <input
                            type="text"
                            value={draft.title || ""}
                            placeholder="Article title…"
                            onChange={e => onChange("title", e.target.value)}
                            style={{ fontSize: "1.1rem", fontWeight: 600 }}
                        />
                    </label>

                    <label className="editor-field">
                        <span>Excerpt / Abstract</span>
                        <textarea
                            value={draft.excerpt || ""}
                            rows={4}
                            placeholder="A short summary shown in listings and previews…"
                            onChange={e => onChange("excerpt", e.target.value)}
                        />
                    </label>

                    <TaxonomyTagField
                        label="Category tags"
                        placeholder="Type a category and press Enter"
                        priority={true}
                        terms={Array.isArray(draft.category) ? draft.category : []}
                        onChange={category => onChange("category", category)}
                    />
                </div>

                <aside className="editor-spine-media" aria-label="Post cover">
                    <header>
                        <div>
                            <span className="editor-eyebrow">Cover media</span>
                            <h2>Featured cover</h2>
                        </div>
                        <button type="button" className="quiet-button" onClick={onChooseCover}>Choose from library</button>
                    </header>

                    <div
                        className={`portfolio-image-uploader ${draft.cover_image ? "is-compact" : ""} ${coverUploading ? "is-uploading" : ""}`}
                        style={{ marginTop: ".8rem" }}
                        onClick={() => coverInputRef.current?.click()}
                        onDragOver={e => e.preventDefault()}
                        onDrop={async e => {
                            e.preventDefault();
                            const file = e.dataTransfer.files?.[0];
                            if (!file) return;
                            const result = await onCoverUpload(file);
                            onChange("cover_image", result.url);
                        }}
                    >
                        <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={async e => {
                            if (!e.target.files?.[0]) return;
                            const result = await onCoverUpload(e.target.files[0]);
                            onChange("cover_image", result.url);
                        }} />
                        <span className="portfolio-image-upload-icon" aria-hidden="true">↑</span>
                        <div className="portfolio-image-upload-copy">
                            <strong>{coverUploading ? "Uploading…" : draft.cover_image ? "Replace cover image" : "Drop cover image here"}</strong>
                            <span>JPEG, PNG, WebP or GIF</span>
                        </div>
                        <button type="button" className="portfolio-image-upload-button" disabled={coverUploading}>
                            {coverUploading ? "Uploading…" : "Choose file"}
                        </button>
                    </div>

                    {draft.cover_image ? (
                        <div style={{ marginTop: ".5rem" }}>
                            <img src={draft.cover_image} alt="Cover" className="editor-cover-preview" style={{ aspectRatio: "16/9", objectFit: "cover" }} />
                            <button type="button" className="quiet-button danger" onClick={() => onChange("cover_image", "")} style={{ marginTop: ".4rem" }}>
                                Remove cover
                            </button>
                        </div>
                    ) : (
                        <div className="cover-placeholder editor-cover-preview" style={{ aspectRatio: "16/9", marginTop: ".5rem" }}>
                            16:9 cover preview
                        </div>
                    )}
                </aside>
            </div>
        </section>
    );
}

// ─── Publish Panel ────────────────────────────────────────────────────────────
function PublishPanel({ draft, id, hasPendingEdits, onChange, onPublish, onUnpublish, publishing }) {
    const [slugDraft, setSlugDraft] = useState(draft.slug || "");
    const [slugSaving, setSlugSaving] = useState(false);
    const [slugMsg, setSlugMsg] = useState("");

    useEffect(() => setSlugDraft(draft.slug || ""), [draft.slug]);

    const saveSlug = async () => {
        if (!slugDraft.trim() || slugDraft === draft.slug) return;
        setSlugSaving(true); setSlugMsg("");
        try {
            await updateBlogSlug(id, slugDraft.trim());
            onChange("slug", slugDraft.trim());
            setSlugMsg("Slug updated ✓");
        } catch (e) { setSlugMsg("Failed: " + e.message); }
        finally { setSlugSaving(false); }
    };

    return (
        <section className="portfolio-publish-workspace">
            <span className="editor-eyebrow">Publish</span>
            <h2>Choose how this article goes live</h2>

            <section className="publish-slug-section" aria-labelledby="publish-slug-heading">
                <header>
                    <div>
                        <span className="editor-eyebrow">Public URL</span>
                        <h3 id="publish-slug-heading">Article slug</h3>
                    </div>
                    <code>/blog/{slugDraft || "your-slug-here"}</code>
                </header>
                <div className="publish-slug-control">
                    <label className="editor-field">
                        <span>Slug</span>
                        <input type="text" value={slugDraft} onChange={e => setSlugDraft(e.target.value)} onBlur={saveSlug} />
                    </label>
                    <button type="button" className="primary-button publish-slug-button" onClick={saveSlug} disabled={slugSaving}>
                        {slugSaving ? "Saving…" : "Save slug"}
                    </button>
                </div>
                {slugMsg && <p style={{ marginTop: ".5rem", fontSize: ".75rem", color: "var(--text-secondary)" }}>{slugMsg}</p>}
            </section>

            <div className="publish-settings-grid">
                <section className="publish-classification-section">
                    <header>
                        <span className="editor-eyebrow">Article tags</span>
                        <h3>Tags</h3>
                    </header>
                    <div className="taxonomy-fields">
                        <TaxonomyTagField
                            label="Tags"
                            placeholder="Type tag and press Enter"
                            priority={true}
                            terms={Array.isArray(draft.tags) ? draft.tags : []}
                            onChange={tags => onChange("tags", tags)}
                        />
                    </div>
                </section>

                <section className="publish-properties">
                    <header className="publish-properties-header">
                        <span className="editor-eyebrow">Settings</span>
                        <h3>Publishing</h3>
                    </header>
                    <div className="publish-properties-body">
                        <label className="editor-field">
                            <span>Meta description</span>
                            <textarea
                                value={draft.meta_description || ""}
                                rows={3}
                                placeholder="Search engine description…"
                                onChange={e => onChange("meta_description", e.target.value)}
                            />
                        </label>

                        <div className="publish-seo-handoff">
                            <div>
                                <span className="editor-eyebrow">Live status</span>
                                <strong style={{ color: draft.published ? (hasPendingEdits ? "#f59e0b" : "#22c55e") : "var(--text-tertiary)" }}>
                                    {draft.published
                                        ? (hasPendingEdits ? "● Published · Edits pending" : "● Published · Live ✓")
                                        : "○ Draft (Not published)"
                                    }
                                </strong>
                            </div>
                            {draft.published_at && (
                                <div>
                                    <span className="editor-eyebrow">Last published</span>
                                    <strong style={{ fontSize: ".8rem" }}>
                                        {new Date(draft.published_at).toLocaleDateString("en-GB", { dateStyle: "medium" })}
                                    </strong>
                                </div>
                            )}
                        </div>

                        <div style={{ marginTop: "1.25rem", display: "grid", gap: ".65rem" }}>
                            <button
                                type="button"
                                className="primary-button publish-button full"
                                onClick={onPublish}
                                disabled={publishing}
                            >
                                {publishing ? "Publishing…" : draft.published ? (hasPendingEdits ? "Republish changes →" : "Republish live site ✓") : "Publish now →"}
                            </button>

                            {draft.published && (
                                <button
                                    type="button"
                                    className="quiet-button danger full"
                                    style={{
                                        width: "100%",
                                        padding: ".65rem 1rem",
                                        border: "1px solid rgba(239, 68, 68, 0.3)",
                                        borderRadius: "7px",
                                        background: "transparent",
                                        color: "#ef4444",
                                        fontSize: ".8rem",
                                        cursor: "pointer"
                                    }}
                                    onClick={onUnpublish}
                                    disabled={publishing}
                                >
                                    Unpublish to draft
                                </button>
                            )}
                        </div>
                    </div>
                </section>
            </div>
        </section>
    );
}

// ─── Preview Panel ────────────────────────────────────────────────────────────
function PreviewPanel({ slug, draft }) {
    const [previewDevice, setPreviewDevice] = useState("laptop");
    const previewUrl = slug ? `/blog/${slug}?preview=1` : null;

    return (
        <section className="portfolio-inline-preview is-active">
            <header className="portfolio-preview-toolbar">
                <div>
                    <span className="editor-eyebrow">Preview</span>
                    <h3 style={{ margin: ".2rem 0 0", fontSize: "1rem" }}>Article live preview</h3>
                </div>
                <div className="portfolio-preview-display-controls">
                    {previewUrl && (
                        <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="preview-fullscreen-button" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                            Full screen ↗
                        </a>
                    )}
                    <div className="preview-mode-switch">
                        <button type="button" className={`preview-mode-pill ${previewDevice === "laptop" ? "active" : ""}`} onClick={() => setPreviewDevice("laptop")}>Laptop</button>
                        <button type="button" className={`preview-mode-pill ${previewDevice === "tablet" ? "active" : ""}`} onClick={() => setPreviewDevice("tablet")}>Tablet</button>
                        <button type="button" className={`preview-mode-pill ${previewDevice === "phone" ? "active" : ""}`} onClick={() => setPreviewDevice("phone")}>Phone</button>
                    </div>
                </div>
            </header>
            <div className={`portfolio-inline-preview-device is-${previewDevice}`}>
                {previewUrl ? (
                    <iframe src={previewUrl} title={`${draft.title} preview`} />
                ) : (
                    <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--text-tertiary)" }}>
                        Set a slug to enable live preview.
                    </div>
                )}
            </div>
        </section>
    );
}

// ─── Main Blog Studio Shell ───────────────────────────────────────────────────
export default function BlogStudio({ id }) {
    const [draft, setDraft] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [workspaceTab, setWorkspaceTab] = useState("design");
    const [designSection, setDesignSection] = useState("basics");
    const [publishing, setPublishing] = useState(false);
    const [coverUploading, setCoverUploading] = useState(false);
    const [blockUploading, setBlockUploading] = useState(false);
    const [mediaPickerTarget, setMediaPickerTarget] = useState(null);
    const [hasPendingEdits, setHasPendingEdits] = useState(false);
    const saveState = useSaveState();
    const saveTimer = useRef(null);

    useEffect(() => {
        (async () => {
            try {
                const data = await getAdminBlog(id);
                setDraft(data);
            } catch (e) { setError(e.message); }
            finally { setLoading(false); }
        })();
    }, [id]);

    const handleChange = useCallback((field, value) => {
        setDraft(prev => {
            const next = { ...prev, [field]: value };
            if (prev?.published) {
                setHasPendingEdits(true);
            }
            clearTimeout(saveTimer.current);
            saveState.mark("unsaved");
            saveTimer.current = setTimeout(async () => {
                saveState.mark("saving");
                try {
                    await saveBlogDraft(id, next);
                    saveState.onSuccess();
                } catch (e) { saveState.mark("error"); }
            }, 1200);
            return next;
        });
    }, [id, saveState]);

    const saveNow = async () => {
        clearTimeout(saveTimer.current);
        saveState.mark("saving");
        try {
            await saveBlogDraft(id, draft);
            saveState.onSuccess();
        } catch (e) { saveState.mark("error"); setError(e.message); }
    };

    const handlePublish = async () => {
        setPublishing(true);
        try {
            await saveNow();
            await publishBlogPost(id);
            setDraft(prev => ({ ...prev, published: true, published_at: new Date().toISOString() }));
            setHasPendingEdits(false);
            notifyLiveSiteUpdate(draft.slug);
        } catch (e) { setError(e.message); }
        finally { setPublishing(false); }
    };

    const handleUnpublish = async () => {
        setPublishing(true);
        try {
            await unpublishBlogPost(id);
            setDraft(prev => ({ ...prev, published: false }));
            setHasPendingEdits(false);
            notifyLiveSiteUpdate(draft.slug);
        } catch (e) { setError(e.message); }
        finally { setPublishing(false); }
    };

    const handleCoverUpload = async (file) => {
        setCoverUploading(true);
        try {
            const result = await uploadBlogImage(file);
            return result;
        } finally { setCoverUploading(false); }
    };

    const handleBlockUpload = async (file) => {
        setBlockUploading(true);
        try {
            return await uploadBlogImage(file);
        } finally { setBlockUploading(false); }
    };

    const attachLibraryMedia = useCallback((media) => {
        const target = mediaPickerTarget;
        if (!target || !media) return;
        const selectedMedia = (Array.isArray(media) ? media : [media]).filter(Boolean);
        if (!selectedMedia.length) return;
        const selected = selectedMedia[0];

        if (target.type === "cover") {
            handleChange("cover_image", selected.url);
        } else if (target.blockId) {
            handleChange("blocks", (draft.blocks || []).map((block) => {
                if (block.id !== target.blockId) return block;
                return {
                    ...block,
                    content: {
                        ...block.content,
                        media: {
                            url: selected.url,
                            alt: selected.alt || selected.name || "",
                            caption: selected.caption || ""
                        }
                    }
                };
            }));
        }
        setMediaPickerTarget(null);
    }, [mediaPickerTarget, draft, handleChange]);

    if (loading) return <div className="admin-loading full-screen">Loading Blog Studio…</div>;
    if (!draft) return <div className="admin-loading full-screen">{error || "Post not found."}</div>;

    const isPublished = Boolean(draft.published);

    return (
        <div className="portfolio-editor-shell">
            {/* ── Topbar aligned strictly to 1280px content boundary ───────── */}
            <header className="portfolio-editor-topbar">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "min(1280px, 100%)", margin: "0 auto" }}>
                    <div className="topbar-left">
                        <a className="admin-back-button" href="/admin/dashboard?section=blog">
                            <span aria-hidden="true">←</span> Back to posts
                        </a>
                    </div>

                    <div className={`save-state ${saveState.state === "unsaved" ? "unsaved-changes" : saveState.state === "error" ? "save-failed" : ""}`}>
                        {SAVE_LABELS[saveState.state] || SAVE_LABELS.idle}
                    </div>

                    <div className="topbar-actions">
                        <button
                            type="button"
                            className="primary-button publish-button"
                            onClick={handlePublish}
                            disabled={publishing}
                        >
                            {publishing
                                ? "Publishing…"
                                : isPublished
                                    ? (hasPendingEdits ? "Republish →" : "Published ✓")
                                    : "Publish →"
                            }
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Canvas ─────────────────────────────────────────────────────── */}
            <main className="portfolio-editor-canvas">
                {/* Workspace Heading with Design / Preview / Publish Tabs */}
                <section className="portfolio-workspace-heading">
                    <div>
                        <span className="editor-eyebrow">
                            Blog Studio · {isPublished ? (hasPendingEdits ? "Published (Edits pending)" : "Published · Live") : "Draft"}
                        </span>
                        <h1>{draft.title || "Untitled post"}</h1>
                    </div>

                    <div className="portfolio-workspace-tabs" role="tablist" aria-label="Blog workspace" data-active={workspaceTab}>
                        <button type="button" role="tab" aria-selected={workspaceTab === "design"} onClick={() => setWorkspaceTab("design")}>Design</button>
                        <button type="button" role="tab" aria-selected={workspaceTab === "preview"} onClick={() => setWorkspaceTab("preview")}>Preview</button>
                        <button type="button" role="tab" aria-selected={workspaceTab === "publish"} onClick={() => setWorkspaceTab("publish")}>Publish</button>
                        <span aria-hidden="true" />
                    </div>
                </section>

                {error && <div className="admin-notice error" style={{ margin: "1rem var(--editor-gutter)" }}>{error}</div>}

                <div className={`portfolio-editor-scroll-region ${workspaceTab === "design" && designSection === "basics" ? "is-design-basics-mode" : ""} ${workspaceTab === "design" && designSection !== "basics" ? "is-design-elements-mode" : ""}`}>
                    {workspaceTab === "design" && (
                        <div className={`portfolio-design-workspace ${designSection !== "basics" ? "is-elements-mode" : ""}`}>
                            <aside className="portfolio-design-sidebar">
                                <div className="portfolio-design-section-tabs" role="tablist" aria-orientation="vertical">
                                    {DESIGN_SECTIONS.map((section) => (
                                        <button
                                            type="button"
                                            role="tab"
                                            aria-selected={designSection === section}
                                            key={section}
                                            onClick={() => setDesignSection(section)}
                                            style={{ textTransform: "capitalize" }}
                                        >
                                            {section}
                                        </button>
                                    ))}
                                </div>
                            </aside>

                            <div className="portfolio-design-main">
                                {designSection === "basics" && (
                                    <BasicsPanel
                                        draft={draft}
                                        onChange={handleChange}
                                        onCoverUpload={handleCoverUpload}
                                        onChooseCover={() => setMediaPickerTarget({ type: "cover" })}
                                        coverUploading={coverUploading}
                                    />
                                )}

                                {designSection !== "basics" && (
                                    <BlogStudioBlockEditor
                                        blocks={draft.blocks || []}
                                        onBlocksChange={blocks => handleChange("blocks", blocks)}
                                        onUpload={handleBlockUpload}
                                        onChooseMedia={(target) => setMediaPickerTarget(target)}
                                        uploading={blockUploading}
                                        designSection={designSection}
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {workspaceTab === "preview" && (
                        <PreviewPanel slug={draft.slug} draft={draft} />
                    )}

                    {workspaceTab === "publish" && (
                        <PublishPanel
                            draft={draft}
                            id={id}
                            hasPendingEdits={hasPendingEdits}
                            onChange={handleChange}
                            onPublish={handlePublish}
                            onUnpublish={handleUnpublish}
                            publishing={publishing}
                        />
                    )}
                </div>
            </main>

            {/* Media Picker Modal */}
            <PortfolioMediaPicker
                open={Boolean(mediaPickerTarget)}
                onClose={() => setMediaPickerTarget(null)}
                onSelect={attachLibraryMedia}
            />
        </div>
    );
}
