import React, { useCallback, useRef, useState } from "react";
import { DndContext, DragOverlay, closestCenter } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BLOG_BLOCK_LABELS, BLOG_BLOCK_DESCRIPTIONS, getBlogBlockSummary, createBlogBlock } from "../../../lib/blogSchema";

const CONTENT_BLOCK_TYPES = ["body_text", "heading", "single_image", "video_embed", "quotation", "divider"];
const CONTENT_MORE_BLOCK_TYPES = ["two_columns", "highlight"];
const MEDIA_BLOCK_TYPES = ["single_image", "video_embed"];

const Field = ({ label, value, onChange, rows = 1, placeholder = "" }) => (
    <label className="editor-field">
        <span>{label}</span>
        {rows > 1
            ? <textarea value={value || ""} rows={rows} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
            : <input value={value || ""} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
        }
    </label>
);

function BlogImageUploader({ media, onChange, onUpload, onChooseMedia, uploading }) {
    const inputRef = useRef(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isExternalLink, setIsExternalLink] = useState(false);

    const item = media && typeof media === "object" ? media : null;
    const url = item?.url || "";

    const handleFiles = useCallback(async (fileList) => {
        const files = Array.from(fileList || []).filter(Boolean).slice(0, 1);
        if (!files.length || !onUpload) return;
        try {
            const result = await onUpload(files[0]);
            onChange({ sourceType: "uploaded", url: result.url, alt: "", caption: "" });
        } catch (e) { console.error(e); }
    }, [onChange, onUpload]);

    const addLink = () => {
        setIsExternalLink(true);
        onChange({ sourceType: "external", url: url || "", alt: item?.alt || "", caption: item?.caption || "" });
    };

    return (
        <div className="media-field-list">
            {url ? (
                <div className="media-field">
                    <div className="media-visual-column">
                        <div className="media-field-preview-shell">
                            <img className="media-field-preview" src={url} alt={item?.alt || ""} />
                        </div>
                        <div className="media-source-details">
                            <div className="media-source-url">
                                <span>Image URL</span>
                                <a href={url} target="_blank" rel="noopener noreferrer" title={url}>{url}</a>
                            </div>
                        </div>
                    </div>
                    <div className="media-details-column">
                        <Field label="Alt text (optional)" value={item?.alt} onChange={alt => onChange({ ...item, alt })} />
                        <Field label="Caption" value={item?.caption} onChange={caption => onChange({ ...item, caption })} />
                        <button type="button" className="quiet-button danger" onClick={() => { onChange(null); setIsExternalLink(false); }} style={{ marginTop: ".5rem", width: "fit-content" }}>
                            <span aria-hidden="true">×</span> Remove image
                        </button>
                    </div>
                </div>
            ) : isExternalLink ? (
                <div style={{ display: "grid", gap: ".5rem", marginBottom: "1rem" }}>
                    <Field label="Image URL" value={url} placeholder="https://example.com/image.jpg" onChange={newUrl => onChange({ sourceType: "external", url: newUrl, alt: "", caption: "" })} />
                    <button type="button" className="quiet-button" onClick={() => setIsExternalLink(false)} style={{ width: "fit-content" }}>← Cancel link</button>
                </div>
            ) : null}

            <div
                className={`portfolio-image-uploader ${url ? "is-compact" : ""} ${isDragOver ? "is-drag-over" : ""} ${uploading ? "is-uploading" : ""}`}
                onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false); }}
                onDrop={e => { e.preventDefault(); setIsDragOver(false); if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files); }}
            >
                <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={e => e.target.files?.length && handleFiles(e.target.files)} />
                <span className="portfolio-image-upload-icon" aria-hidden="true">↑</span>
                <div className="portfolio-image-upload-copy">
                    <strong>{uploading ? "Uploading image…" : url ? "Replace this image" : "Drop an image here"}</strong>
                    <span>JPEG, PNG, WebP or GIF · maximum 20 MB</span>
                </div>
                <button type="button" className="portfolio-image-upload-button" onClick={() => inputRef.current?.click()} disabled={uploading}>
                    {uploading ? "Uploading…" : "Choose file"}
                </button>
            </div>

            <div className="media-add-row is-secondary">
                {onChooseMedia && (
                    <button type="button" className="media-choice-button" onClick={onChooseMedia}>
                        {url ? "Replace from library" : "Choose from library"}
                    </button>
                )}
                <button type="button" className="media-choice-button" onClick={addLink}>
                    {url ? "Replace with image link" : "Add image link"}
                </button>
            </div>
        </div>
    );
}

function BlogBlockFields({ block, onChange, onUpload, onChooseMedia, uploading }) {
    const updateContent = patch => onChange({ ...block, content: { ...(block.content || {}), ...patch } });
    const c = block.content || {};
    const type = block.blockType;

    if (type === "body_text") return <Field label="Text (Markdown supported)" value={c.text} rows={8} placeholder="Use **bold**, *italic*, and [link](https://…)" onChange={text => updateContent({ text })} />;
    if (type === "heading") {
        const level = Number(c.level) || 2;
        return (
            <div className="heading-block-editor">
                <div className="heading-level-selector-row">
                    <span className="heading-level-label">Heading level</span>
                    <div className="heading-level-segmented" role="group" aria-label="Heading level">
                        <button
                            type="button"
                            className={`heading-level-pill ${level === 2 ? "is-active" : ""}`}
                            onClick={() => updateContent({ level: 2 })}
                        >
                            <strong>H2</strong>
                            <span>Main section</span>
                        </button>
                        <button
                            type="button"
                            className={`heading-level-pill ${level === 3 ? "is-active" : ""}`}
                            onClick={() => updateContent({ level: 3 })}
                        >
                            <strong>H3</strong>
                            <span>Subsection</span>
                        </button>
                    </div>
                </div>
                <Field
                    label="Heading text"
                    value={c.text}
                    placeholder={level === 2 ? "e.g. Methodology & Findings" : "e.g. Key Observations"}
                    onChange={text => updateContent({ text })}
                />
            </div>
        );
    }
    if (type === "quotation") return <>
        <Field label="Quote" value={c.quote} rows={4} onChange={quote => updateContent({ quote })} />
        <Field label="Attribution (optional)" value={c.attribution} placeholder="— Author, Source" onChange={attribution => updateContent({ attribution })} />
    </>;
    if (type === "highlight") return <Field label="Callout text" value={c.text} rows={3} placeholder="A key insight or statement…" onChange={text => updateContent({ text })} />;
    if (type === "divider") return <div className="portfolio-divider-editor-preview" aria-label="Divider preview"><span /></div>;
    if (type === "single_image") return <BlogImageUploader media={c.media} onChange={media => updateContent({ media })} onUpload={onUpload} onChooseMedia={onChooseMedia ? () => onChooseMedia({ blockId: block.id }) : undefined} uploading={uploading} />;
    if (type === "video_embed") return <>
        <Field label="YouTube or Vimeo URL" value={c.url} placeholder="https://youtube.com/watch?v=…" onChange={url => updateContent({ url })} />
        <Field label="Caption (optional)" value={c.caption} onChange={caption => updateContent({ caption })} />
    </>;
    if (type === "two_columns") return (
        <div className="field-row">
            <Field label="Left column" value={c.leftText} rows={6} placeholder="Markdown supported…" onChange={leftText => updateContent({ leftText })} />
            <Field label="Right column" value={c.rightText} rows={6} placeholder="Markdown supported…" onChange={rightText => updateContent({ rightText })} />
        </div>
    );
    return null;
}

function extractBlockImages(block) {
    if (!block) return [];
    const content = block.content || {};
    const images = [];

    if (content.media) {
        if (Array.isArray(content.media)) {
            content.media.forEach((m) => {
                if (typeof m === "string" && m.trim()) images.push({ url: m.trim() });
                else if (m?.url) images.push(m);
            });
        } else if (typeof content.media === "string" && content.media.trim()) {
            images.push({ url: content.media.trim() });
        } else if (content.media?.url) {
            images.push(content.media);
        }
    }

    if (content.url && typeof content.url === "string" && !images.length) {
        const isImg = /\.(jpeg|jpg|gif|png|webp|avif|svg)(\?.*)?$/i.test(content.url) || content.url.includes("/images/") || content.url.includes("/covers/");
        if (isImg && block.blockType !== "video_embed") {
            images.push({ url: content.url, caption: content.caption, alt: content.alt });
        }
    }

    if (Array.isArray(content.images)) {
        content.images.forEach((img) => {
            if (typeof img === "string" && img.trim()) images.push({ url: img.trim() });
            else if (img?.url) images.push(img);
        });
    }

    if (Array.isArray(content.columns)) {
        content.columns.forEach((col) => {
            if (Array.isArray(col?.items)) {
                col.items.forEach((item) => {
                    if (item?.type === "image" && item.url) {
                        images.push({ url: item.url, alt: item.alt, caption: item.caption });
                    }
                });
            }
        });
    }

    return images;
}

export function BlogBlockCard({ block, index, expanded, onToggle, onChange, onDuplicate, onDelete, onUpload, onChooseMedia, uploading }) {
    const type = block.blockType;
    const summary = getBlogBlockSummary(block);
    const images = extractBlockImages(block);
    const hasImages = images.length > 0;
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: block.id,
        data: {
            kind: "block-sort",
            label: BLOG_BLOCK_LABELS[type],
            summary,
            position: index + 1,
        },
    });

    return (
        <article
            ref={setNodeRef}
            style={{ transform: CSS.Translate.toString(transform), transition }}
            className={`portfolio-editor-block ${expanded ? "is-expanded" : ""} ${isDragging ? "is-dragging" : ""}`}
        >
            <header className="portfolio-block-card-header">
                <button type="button" className="drag-handle" {...attributes} {...listeners} aria-label={`Reorder ${BLOG_BLOCK_LABELS[type]}`}>
                    <span aria-hidden="true">⠿</span>
                </button>
                <button type="button" className="portfolio-block-card-toggle" aria-expanded={expanded} onClick={onToggle}>
                    <span className="portfolio-block-order">{index + 1}</span>
                    <span className="portfolio-block-card-title">
                        <strong>{BLOG_BLOCK_LABELS[type]}</strong>
                        <small>{summary}</small>
                    </span>
                    {hasImages && (
                        <div className="portfolio-block-thumb-side" aria-label={`${images.length} image${images.length === 1 ? "" : "s"}`}>
                            {images.slice(0, 3).map((img, i) => (
                                <span key={i} className="portfolio-block-thumb-frame">
                                    <img src={img.url || img} alt={img.alt || ""} loading="lazy" />
                                </span>
                            ))}
                            {images.length > 3 && (
                                <span className="portfolio-block-thumb-badge" title={`${images.length} images total`}>
                                    +{images.length - 3}
                                </span>
                            )}
                        </div>
                    )}
                    <span className="portfolio-block-toggle-indicator" aria-hidden="true">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </span>
                </button>
                <div className="portfolio-block-card-actions">
                    <button type="button" className="quiet-button" onClick={onDuplicate}>Duplicate</button>
                    <button type="button" className="quiet-button danger" onClick={onDelete}>Remove</button>
                </div>
            </header>
            {expanded && (
                <div className="portfolio-block-card-body">
                    <div className="block-fields">
                        <BlogBlockFields block={block} onChange={onChange} onUpload={onUpload} onChooseMedia={onChooseMedia} uploading={uploading} />
                    </div>
                    {type !== "divider" && type !== "single_image" && (
                        <footer className="portfolio-block-footer">
                            <div className="portfolio-block-setting">
                                <span className="portfolio-block-setting-label">Width</span>
                                <div className="portfolio-select-wrapper">
                                    <select
                                        value={block.settings?.width || "standard"}
                                        onChange={e => onChange({ ...block, settings: { ...block.settings, width: e.target.value } })}
                                    >
                                        <option value="narrow">Narrow layout</option>
                                        <option value="standard">Standard layout</option>
                                        <option value="wide">Wide layout</option>
                                    </select>
                                    <span className="portfolio-select-arrow" aria-hidden="true">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </span>
                                </div>
                            </div>
                            <div className="portfolio-block-setting">
                                <span className="portfolio-block-setting-label">Spacing</span>
                                <div className="portfolio-select-wrapper">
                                    <select
                                        value={block.settings?.spacing || "default"}
                                        onChange={e => onChange({ ...block, settings: { ...block.settings, spacing: e.target.value } })}
                                    >
                                        <option value="compact">Compact margins</option>
                                        <option value="default">Default spacing</option>
                                        <option value="spacious">Spacious padding</option>
                                    </select>
                                    <span className="portfolio-select-arrow" aria-hidden="true">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </span>
                                </div>
                            </div>
                        </footer>
                    )}
                </div>
            )}
        </article>
    );
}

export function BlogBlockInsertToolbar({ id, title = "Content elements", types = CONTENT_BLOCK_TYPES, moreTypes = [], onAddBlock }) {
    return (
        <section id={id} className="portfolio-block-insert-toolbar" role="toolbar" aria-label="Add content blocks">
            <div className="portfolio-block-insert-heading">
                <h3 id="blog-add-block-title">{title}</h3>
            </div>
            <div className="portfolio-add-block-grid">
                {types.map(type => (
                    <button
                        key={type}
                        type="button"
                        onClick={() => onAddBlock(type)}
                        title={BLOG_BLOCK_DESCRIPTIONS[type]}
                    >
                        <span className="portfolio-block-palette-grip" aria-hidden="true" />
                        <strong>{BLOG_BLOCK_LABELS[type]}</strong>
                        <span className="portfolio-block-palette-plus" aria-hidden="true">+</span>
                    </button>
                ))}
            </div>
            {moreTypes.length > 0 && (
                <details className="portfolio-more-blocks">
                    <summary>More elements</summary>
                    <div className="portfolio-add-block-grid is-secondary">
                        {moreTypes.map(type => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => onAddBlock(type)}
                                title={BLOG_BLOCK_DESCRIPTIONS[type]}
                            >
                                <span className="portfolio-block-palette-grip" aria-hidden="true" />
                                <strong>{BLOG_BLOCK_LABELS[type]}</strong>
                                <span className="portfolio-block-palette-plus" aria-hidden="true">+</span>
                            </button>
                        ))}
                    </div>
                </details>
            )}
        </section>
    );
}

export default function BlogStudioBlockEditor({ blocks = [], onBlocksChange, onUpload, onChooseMedia, uploading, designSection }) {
    const [expandedId, setExpandedId] = useState(null);
    const [draggedBlock, setDraggedBlock] = useState(null);

    const handleDragStart = ({ active }) => {
        const data = active.data.current;
        setDraggedBlock(data?.kind === "block-sort" ? {
            label: data.label,
            summary: data.summary,
            position: data.position,
        } : null);
    };

    const handleDragEnd = ({ active, over }) => {
        setDraggedBlock(null);
        if (!over || active.id === over.id) return;
        const oldIdx = blocks.findIndex(b => b.id === active.id);
        const newIdx = blocks.findIndex(b => b.id === over.id);
        if (oldIdx < 0 || newIdx < 0) return;
        onBlocksChange(arrayMove(blocks, oldIdx, newIdx));
    };

    const addBlock = type => {
        const block = createBlogBlock(type);
        onBlocksChange([...blocks, block]);
        setExpandedId(block.id);
        requestAnimationFrame(() => document.getElementById(`blog-block-${block.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
    };

    const updateBlock = (index, next) => {
        const updated = [...blocks];
        updated[index] = next;
        onBlocksChange(updated);
    };

    const duplicateBlock = index => {
        const dup = { ...blocks[index], id: crypto.randomUUID() };
        const next = [...blocks];
        next.splice(index + 1, 0, dup);
        onBlocksChange(next);
        setExpandedId(dup.id);
    };

    const deleteBlock = index => {
        if (expandedId === blocks[index].id) setExpandedId(null);
        onBlocksChange(blocks.filter((_, i) => i !== index));
    };

    return (
        <>
            {(designSection === "content" || designSection === "all") && (
                <BlogBlockInsertToolbar
                    id="blog-design-content"
                    title="Content elements"
                    types={CONTENT_BLOCK_TYPES}
                    moreTypes={CONTENT_MORE_BLOCK_TYPES}
                    onAddBlock={addBlock}
                />
            )}

            {(designSection === "media" || designSection === "all") && (
                <BlogBlockInsertToolbar
                    id="blog-design-media"
                    title="Media elements"
                    types={MEDIA_BLOCK_TYPES}
                    onAddBlock={addBlock}
                />
            )}

            <section className="editor-blocks-section portfolio-content-sequence" aria-label="Content sequence">
                <header>
                    <div>
                        <span className="editor-eyebrow">Article story</span>
                        <h2>Content sequence</h2>
                    </div>
                    <span className="portfolio-sequence-count">{blocks.length} {blocks.length === 1 ? "block" : "blocks"}</span>
                </header>
                <DndContext collisionDetection={closestCenter} onDragStart={handleDragStart} onDragCancel={() => setDraggedBlock(null)} onDragEnd={handleDragEnd}>
                    <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                        <div className="editor-block-list">
                            {blocks.length === 0 && (
                                <div className="portfolio-block-drop-zone is-empty">
                                    <span>Add a block above to start building your article sequence</span>
                                </div>
                            )}
                            {blocks.map((block, index) => (
                                <div key={block.id} id={`blog-block-${block.id}`} className="portfolio-sequence-block" style={{ marginBottom: ".5rem" }}>
                                    <BlogBlockCard
                                        block={block}
                                        index={index}
                                        expanded={expandedId === block.id}
                                        onToggle={() => setExpandedId(id => id === block.id ? null : block.id)}
                                        onChange={next => updateBlock(index, next)}
                                        onDuplicate={() => duplicateBlock(index)}
                                        onDelete={() => deleteBlock(index)}
                                        onUpload={onUpload}
                                        onChooseMedia={onChooseMedia}
                                        uploading={uploading}
                                    />
                                </div>
                            ))}
                        </div>
                    </SortableContext>
                    <DragOverlay adjustScale={false} dropAnimation={null}>
                        {draggedBlock && (
                            <div className="portfolio-block-sort-overlay">
                                <span className="portfolio-block-sort-grip" aria-hidden="true">⠿</span>
                                <span className="portfolio-block-order" aria-hidden="true">{draggedBlock.position}</span>
                                <span className="portfolio-block-sort-copy">
                                    <strong>{draggedBlock.label}</strong>
                                    <small>{draggedBlock.summary || "Move within the content sequence"}</small>
                                </span>
                                <span className="portfolio-block-sort-cue">Moving</span>
                            </div>
                        )}
                    </DragOverlay>
                </DndContext>
            </section>
        </>
    );
}
