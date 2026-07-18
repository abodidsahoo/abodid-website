import React, { useCallback, useRef, useState } from "react";
import { DndContext, closestCenter, useDraggable } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BLOCK_DESCRIPTIONS, BLOCK_LABELS, BLOCK_TYPES, getPortfolioBlockSummary } from "../../../lib/portfolio/schema";

const Text = ({ label, value, onChange, rows = 1, placeholder = "" }) => <label className="editor-field"><span>{label}</span>{rows > 1 ? <textarea value={value || ""} rows={rows} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /> : <input value={value || ""} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />}</label>;

const COLUMN_ITEM_TYPES = [
  ["heading", "Heading"],
  ["text", "Text"],
  ["image", "Image"],
  ["button", "Button"],
  ["external_link", "External link"],
];
const INSERTABLE_BLOCK_TYPES = BLOCK_TYPES.filter((type) => type !== "link");
const MULTI_IMAGE_DISPLAY_MODES = [
  { value: "grid", label: "Grid" },
  { value: "lightbox", label: "Lightbox" },
  { value: "floating", label: "Floating" },
];
const columnItemLabel = (type) => type === "link"
  ? "External link"
  : COLUMN_ITEM_TYPES.find(([itemType]) => itemType === type)?.[1] || "Element";

function createColumnItem(type) {
  return {
    id: globalThis.crypto?.randomUUID?.() || `column-${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    ...(type === "heading" || type === "text" || ["link", "external_link"].includes(type) ? { text: "" } : {}),
    ...(type === "image" ? { url: "", alt: "", caption: "" } : {}),
    ...(type === "button" ? { label: "", url: "" } : {}),
    ...(["link", "external_link"].includes(type) ? { url: "" } : {}),
  };
}

function normalizeColumn(column, index) {
  if (Array.isArray(column?.items)) return { ...column, items: column.items };
  const legacyItems = [];
  if (column?.heading) legacyItems.push({ ...createColumnItem("heading"), text: column.heading });
  if (column?.text) legacyItems.push({ ...createColumnItem("text"), text: column.text });
  if (column?.linkText || column?.linkUrl) legacyItems.push({ ...createColumnItem("external_link"), text: column.linkText || "", url: column.linkUrl || "" });
  return { id: column?.id || `column-${index + 1}`, items: legacyItems };
}

function TwoColumnsFields({ columns, onChange }) {
  const [activeColumn, setActiveColumn] = useState(0);
  const normalizedColumns = Array.from({ length: 2 }, (_, index) => normalizeColumn(columns?.[index], index));
  const updateItems = (items) => onChange(normalizedColumns.map((column, index) => index === activeColumn ? { ...column, items } : column));
  const column = normalizedColumns[activeColumn];
  const items = column.items || [];
  const updateItem = (itemIndex, patch) => updateItems(items.map((item, index) => index === itemIndex ? { ...item, ...patch } : item));
  const moveItem = (itemIndex, direction) => {
    const targetIndex = itemIndex + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const next = [...items];
    [next[itemIndex], next[targetIndex]] = [next[targetIndex], next[itemIndex]];
    updateItems(next);
  };

  return <div className="portfolio-columns-editor">
    <div className="portfolio-column-selector" role="tablist" aria-label="Choose a portfolio column to edit">
      {normalizedColumns.map((item, index) => <button key={item.id || index} type="button" role="tab" aria-selected={activeColumn === index} onClick={() => setActiveColumn(index)}>
        <strong>Column {index + 1}</strong>
        <small>{item.items?.length || 0} elements</small>
      </button>)}
    </div>
    <div className="portfolio-column-fields" role="tabpanel" aria-label={`Column ${activeColumn + 1}`}>
      <div className="portfolio-column-element-toolbar">
        <strong>Add to Column {activeColumn + 1}</strong>
        <div>{COLUMN_ITEM_TYPES.map(([type, label]) => <button key={type} type="button" onClick={() => updateItems([...items, createColumnItem(type)])}>+ {label}</button>)}</div>
      </div>
      <div className="portfolio-column-element-stack">
        {items.map((item, itemIndex) => <section className="portfolio-column-element-card" key={item.id || itemIndex}>
          <header><strong>{columnItemLabel(item.type)} {itemIndex + 1}</strong><div><button type="button" onClick={() => moveItem(itemIndex, -1)} disabled={itemIndex === 0} aria-label="Move element up">↑</button><button type="button" onClick={() => moveItem(itemIndex, 1)} disabled={itemIndex === items.length - 1} aria-label="Move element down">↓</button><button type="button" className="danger" onClick={() => updateItems(items.filter((_, index) => index !== itemIndex))} aria-label="Delete element">×</button></div></header>
          {item.type === "heading" && <Text label="Heading" value={item.text} onChange={(text) => updateItem(itemIndex, { text })} />}
          {item.type === "text" && <Text label="Text" value={item.text} rows={5} placeholder="Use **bold**, *italic* and [link text](https://…)" onChange={(text) => updateItem(itemIndex, { text })} />}
          {item.type === "image" && <><Text label="Image URL" value={item.url} placeholder="https://example.com/image.jpg" onChange={(url) => updateItem(itemIndex, { url })} /><div className="field-row"><Text label="Alt text" value={item.alt} onChange={(alt) => updateItem(itemIndex, { alt })} /><Text label="Caption" value={item.caption} onChange={(caption) => updateItem(itemIndex, { caption })} /></div></>}
          {item.type === "button" && <div className="field-row"><Text label="Button label" value={item.label} onChange={(label) => updateItem(itemIndex, { label })} /><Text label="URL" value={item.url} placeholder="https://example.com" onChange={(url) => updateItem(itemIndex, { url })} /></div>}
          {["link", "external_link"].includes(item.type) && <div className="field-row"><Text label="Link label" value={item.text} onChange={(text) => updateItem(itemIndex, { text })} /><Text label="URL" value={item.url} placeholder="https://example.com" onChange={(url) => updateItem(itemIndex, { url })} /></div>}
        </section>)}
        {!items.length && <p className="portfolio-column-empty">This column is empty. Add an element above.</p>}
      </div>
    </div>
  </div>;
}

function mediaDisplayName(item, index) {
  const explicitName = item.originalFilename || item.filename || item.name;
  if (explicitName) return explicitName;
  const path = String(item.url || item.storagePath || "").split(/[?#]/)[0];
  const filename = path.split("/").filter(Boolean).pop();
  if (!filename) return `Image ${index + 1}`;
  try { return decodeURIComponent(filename); }
  catch { return filename; }
}

function MediaField({ item, index, update, remove, dragHandle = null, sequenceLabel = "" }) {
  const displayName = mediaDisplayName(item, index);
  return <div className="media-field">
    <div className="media-visual-column">
      <div className="media-field-preview-shell">
        {item.url
          ? <img className="media-field-preview" src={item.url} alt="" />
          : <div className="media-field-preview is-empty">Image preview appears here</div>}
        {dragHandle}
        {sequenceLabel && <span className="media-sequence-number">{sequenceLabel}</span>}
      </div>
      <div className="media-source-details">
        <div className="media-source-name"><span>Image name</span><strong title={displayName}>{displayName}</strong></div>
        <div className="media-source-url">
          {item.storagePath
            ? <><span>Image URL</span><a href={item.url} target="_blank" rel="noopener noreferrer" title={item.url}>{item.url}</a></>
            : <Text label="Image URL" value={item.url} placeholder="Paste an https:// image link" onChange={(url) => update(index, { sourceType: "external", url })} />}
        </div>
      </div>
    </div>
    <div className="media-details-column">
      <Text label="Alt text (optional)" value={item.alt} onChange={(alt) => update(index, { alt })} />
      <Text label="Caption" value={item.caption} onChange={(caption) => update(index, { caption })} />
      <Text label="Credit" value={item.credit} onChange={(credit) => update(index, { credit })} />
      <button type="button" className="media-remove-button" onClick={() => remove(index)}><span aria-hidden="true">×</span> Remove image</button>
    </div>
  </div>;
}

function SortableMediaField({ item, index, sortId, update, remove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sortId });
  return <div ref={setNodeRef} className={`media-sortable-item ${isDragging ? "is-dragging" : ""}`} style={{ transform: CSS.Transform.toString(transform), transition }}>
    <MediaField
      item={item}
      index={index}
      update={update}
      remove={remove}
      sequenceLabel={`Image ${index + 1}`}
      dragHandle={<button type="button" className="media-sequence-handle" {...attributes} {...listeners} aria-label={`Drag image ${index + 1} to change its display order`}><span className="portfolio-block-palette-grip" aria-hidden="true" /></button>}
    />
  </div>;
}

export function PortfolioImageUploader({
  hasImages = false,
  multiple = false,
  onUpload,
  disabled,
  emptyLabel,
  filledLabel,
}) {
  const inputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [uploadError, setUploadError] = useState("");

  const handleFiles = useCallback(async (fileList) => {
    const selected = Array.from(fileList || []).filter(Boolean);
    const files = multiple ? selected : selected.slice(0, 1);
    if (!files.length || disabled || isUploading) return;
    setUploadError("");
    setIsDragOver(false);
    setIsUploading(true);
    setUploadCount(files.length);
    try {
      await onUpload(multiple ? files : files[0], 0, { inline: true });
    } catch (error) {
      setUploadError(error?.message || `${multiple ? "Images" : "Image"} upload failed. Please try again.`);
    } finally {
      setIsUploading(false);
      setUploadCount(0);
    }
  }, [disabled, isUploading, multiple, onUpload]);

  const openPicker = () => {
    if (disabled || isUploading) return;
    inputRef.current?.click();
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const files = event.dataTransfer.files;
    if (files?.length) handleFiles(files);
    else setIsDragOver(false);
  };

  const uploadingLabel = multiple && uploadCount > 1 ? `Uploading ${uploadCount} images…` : "Uploading image…";
  const idleLabel = hasImages
    ? (filledLabel || (multiple ? "Add more images" : "Replace this image"))
    : (emptyLabel || (multiple ? "Drop images here" : "Drop an image here"));

  return <div
    className={`portfolio-image-uploader ${hasImages ? "is-compact" : ""} ${isDragOver ? "is-drag-over" : ""} ${isUploading ? "is-uploading" : ""}`}
    onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); setIsDragOver(true); }}
    onDragEnter={(event) => { event.preventDefault(); event.stopPropagation(); setIsDragOver(true); }}
    onDragLeave={(event) => { event.preventDefault(); event.stopPropagation(); if (!event.currentTarget.contains(event.relatedTarget)) setIsDragOver(false); }}
    onDrop={handleDrop}
  >
    <input
      ref={inputRef}
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      multiple={multiple}
      disabled={disabled || isUploading}
      onClick={(event) => { event.currentTarget.value = ""; }}
      onChange={(event) => {
        const files = event.currentTarget.files;
        if (files?.length) handleFiles(files);
        event.currentTarget.value = "";
      }}
      hidden
    />
    <span className="portfolio-image-upload-icon" aria-hidden="true">↑</span>
    <div className="portfolio-image-upload-copy">
      <strong>{isUploading ? uploadingLabel : idleLabel}</strong>
      <span>{isUploading ? "The editor stays available while the originals are sent to Cloudflare." : `JPEG, PNG, WebP or GIF · maximum 20 MB${multiple ? " each" : ""}`}</span>
    </div>
    <button type="button" className="portfolio-image-upload-button" onClick={openPicker} disabled={disabled || isUploading}>
      {isUploading ? "Uploading…" : multiple ? "Choose images" : "Choose file"}
    </button>
    {uploadError && <p className="portfolio-image-upload-error" role="alert">{uploadError}</p>}
  </div>;
}

function MediaFields({ media, onChange, multiple = false, onUpload, onChooseMedia, onRemoveMedia, uploading, emptyUploadLabel, filledUploadLabel }) {
  // Drafts can briefly contain null/partial media while an async upload is
  // completing. Never let that transient value crash the entire editor.
  const items = (Array.isArray(media) ? media : media ? [media] : [])
    .filter((item) => item && typeof item === "object");
  const sortIds = items.map((item, index) => `${item.id || item.storagePath || item.url || "media"}:${index}`);
  const update = (index, patch) => {
    const next = [...items];
    next[index] = { ...(next[index] || {}), ...patch };
    onChange(multiple ? next : next[0]);
  };
  const addLink = () => {
    if (!multiple && items[0]) onRemoveMedia?.(items[0]);
    onChange(multiple ? [...items, { sourceType: "external", url: "", alt: "", caption: "", credit: "", focalX: 50, focalY: 50 }] : { sourceType: "external", url: "", alt: "", caption: "", credit: "", focalX: 50, focalY: 50 });
  };
  const remove = (index) => {
    const removed = items[index];
    onRemoveMedia?.(removed);
    onChange(multiple ? items.filter((_, itemIndex) => itemIndex !== index) : null);
  };
  const reorder = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = sortIds.indexOf(active.id);
    const newIndex = sortIds.indexOf(over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(items, oldIndex, newIndex));
  };
  return <div className="media-field-list">
    {multiple && items.length > 1 && <div className="media-sequence-label">Display order · drag the six-dot handle on an image to reorder</div>}
    {multiple ? <DndContext collisionDetection={closestCenter} onDragEnd={reorder}>
      <SortableContext items={sortIds} strategy={verticalListSortingStrategy}>
        {items.map((item, index) => <SortableMediaField key={sortIds[index]} item={item} index={index} sortId={sortIds[index]} update={update} remove={remove} />)}
      </SortableContext>
    </DndContext> : items.map((item, index) => <MediaField key={item.id || index} item={item} index={index} update={update} remove={remove} />)}
    <PortfolioImageUploader
      hasImages={items.length > 0}
      multiple={multiple}
      onUpload={onUpload}
      disabled={uploading}
      emptyLabel={emptyUploadLabel}
      filledLabel={filledUploadLabel}
    />
    <div className="media-add-row is-secondary"><button type="button" className="media-choice-button" onClick={() => onChooseMedia?.({ multiple, insertAt: multiple ? items.length : 0 })}>{items.length && !multiple ? "Replace from library" : multiple ? "Choose images from library" : "Choose from library"}</button><button type="button" className="media-choice-button" onClick={addLink}>{items.length && !multiple ? "Replace with image link" : "Add image link"}</button></div>
  </div>;
}

function MultiImageDisplayControl({ block, onChange }) {
  const settings = block.settings || {};
  const displayMode = settings.displayMode || (block.blockType === "image_gallery" || settings.lightbox ? "lightbox" : "grid");
  const updateMode = (nextMode) => {
    const { lightbox: _legacyLightbox, ...currentSettings } = settings;
    onChange({
      ...block,
      blockType: "image_grid",
      settings: { ...currentSettings, displayMode: nextMode, columns: Number(settings.columns) || 2 },
    });
  };
  const updateSetting = (patch) => onChange({ ...block, blockType: "image_grid", settings: { ...settings, displayMode, ...patch } });

  return <section className="multi-image-display-control" aria-labelledby={`multi-image-display-${block.id}`}>
    <div className="multi-image-mode-row">
      <h4 id={`multi-image-display-${block.id}`}>Display mode</h4>
      <div className="multi-image-mode-switch" data-active={displayMode} role="radiogroup" aria-label="Multi-image display style">
        {MULTI_IMAGE_DISPLAY_MODES.map((mode) => <button
          type="button"
          role="radio"
          aria-checked={displayMode === mode.value}
          className={displayMode === mode.value ? "is-active" : ""}
          key={mode.value}
          onClick={() => updateMode(mode.value)}
        >{mode.label}</button>)}
        <span aria-hidden="true" />
      </div>
    </div>
    <div className="multi-image-settings-row">
      {displayMode === "grid" && <label className="editor-field"><span>Columns</span><select value={Number(settings.columns) || 2} onChange={(event) => updateSetting({ columns: Number(event.target.value) })}><option value="1">One</option><option value="2">Two</option><option value="3">Three</option></select></label>}
      {displayMode === "floating" && <label className="editor-field"><span>Image size</span><select value={settings.imageSize || "medium"} onChange={(event) => updateSetting({ imageSize: event.target.value })}><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></label>}
      <label className="editor-field"><span>Width</span><select value={settings.width || "wide"} onChange={(event) => updateSetting({ width: event.target.value })}><option value="narrow">Narrow</option><option value="standard">Standard</option><option value="wide">Wide</option><option value="full">Full</option></select></label>
      <label className="editor-field"><span>Spacing</span><select value={settings.spacing || "default"} onChange={(event) => updateSetting({ spacing: event.target.value })}><option value="compact">Compact</option><option value="default">Default</option><option value="spacious">Spacious</option></select></label>
      {displayMode === "grid" && <label className="editor-field"><span>Image fit</span><select value={settings.mediaFit || "cover"} onChange={(event) => updateSetting({ mediaFit: event.target.value })}><option value="cover">Cover</option><option value="contain">Contain</option></select></label>}
    </div>
  </section>;
}

function DraggableBlockPaletteButton({ paletteId, type, label, onAddBlock }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `block-palette:${paletteId}:${type}`,
    data: { kind: "block-palette", blockType: type },
  });

  return <button
    ref={setNodeRef}
    type="button"
    className={isDragging ? "is-dragging" : ""}
    onClick={() => onAddBlock(type)}
    title={`${BLOCK_DESCRIPTIONS[type]} Drag into the content sequence or click to append.`}
    aria-label={`${label}. Drag into the content sequence or click to append.`}
    {...attributes}
    {...listeners}
  >
    <span className="portfolio-block-palette-grip" aria-hidden="true" />
    <strong>{label}</strong>
    <span className="portfolio-block-palette-plus" aria-hidden="true">+</span>
  </button>;
}

export function PortfolioBlockInsertToolbar({ id, onAddBlock, types = INSERTABLE_BLOCK_TYPES, moreTypes = [], labels = {}, title = "Elements" }) {
  const paletteId = id || title.toLowerCase().replaceAll(" ", "-");
  return <section id={id} className="portfolio-block-insert-toolbar" role="tabpanel" aria-labelledby="portfolio-add-block-title">
    <div className="portfolio-block-insert-heading">
      <h3 id="portfolio-add-block-title">{title}</h3>
    </div>
    <div className="portfolio-add-block-grid">
      {types.map((type) => <DraggableBlockPaletteButton key={type} paletteId={paletteId} type={type} label={labels[type] || BLOCK_LABELS[type]} onAddBlock={onAddBlock} />)}
    </div>
    {moreTypes.length > 0 && <details className="portfolio-more-blocks">
      <summary>More elements</summary>
      <div className="portfolio-add-block-grid is-secondary">
        {moreTypes.map((type) => <DraggableBlockPaletteButton key={type} paletteId={`${paletteId}:more`} type={type} label={labels[type] || BLOCK_LABELS[type]} onAddBlock={onAddBlock} />)}
      </div>
    </details>}
  </section>;
}

export default function PortfolioBlockEditor({ block, index, expanded, onToggle, onChange, onDuplicate, onDelete, onUpload, onChooseMedia, onRemoveMedia, uploading }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const updateContent = (patch) => onChange({ ...block, content: { ...block.content, ...patch } });
  const updateSettings = (patch) => onChange({ ...block, settings: { ...block.settings, ...patch } });
  const type = block.blockType;
  const isMultiImage = ["image_grid", "image_gallery"].includes(type);
  const content = block.content || {};
  let fields = null;
  if (type === "body_text") fields = <Text label="Text" value={content.text} rows={7} placeholder="Use **bold**, *italic* and [link text](https://…)" onChange={(text) => updateContent({ text })} />;
  if (type === "heading") fields = <><Text label="Heading" value={content.text} onChange={(text) => updateContent({ text })} /><label className="editor-field"><span>Level</span><select value={content.level || 2} onChange={(event) => updateContent({ level: Number(event.target.value) })}><option value="2">H2</option><option value="3">H3</option></select></label></>;
  if (type === "two_columns") fields = <TwoColumnsFields columns={content.columns} onChange={(columns) => updateContent({ columns })} />;
  if (type === "quotation") fields = <><Text label="Quote" value={content.quote} rows={4} onChange={(quote) => updateContent({ quote })} /><Text label="Attribution" value={content.attribution} onChange={(attribution) => updateContent({ attribution })} /></>;
  if (type === "highlight") fields = <Text label="Highlight" value={content.text} rows={3} onChange={(text) => updateContent({ text })} />;
  if (type === "testimonial") fields = <><Text label="Quote" value={content.quote} rows={4} onChange={(quote) => updateContent({ quote })} /><Text label="Name" value={content.name} onChange={(name) => updateContent({ name })} /><Text label="Role / organisation" value={content.role} onChange={(role) => updateContent({ role })} /><Text label="Link" value={content.link} onChange={(link) => updateContent({ link })} /></>;
  if (type === "outcome") fields = <><Text label="Small heading" value={content.heading} placeholder="Outcome" onChange={(heading) => updateContent({ heading })} /><Text label="Text" value={content.text} rows={4} placeholder="Add a few lines explaining the outcome." onChange={(text) => updateContent({ text })} /></>;
  if (type === "collaborator") fields = <><Text label="Collaborator name" value={content.name} onChange={(name) => updateContent({ name })} /><Text label="Role" value={content.role} onChange={(role) => updateContent({ role })} /><Text label="Link (optional)" value={content.url} placeholder="https://example.com" onChange={(url) => updateContent({ url })} /></>;
  if (type === "organisation") fields = <><Text label="Organisation name" value={content.name} onChange={(name) => updateContent({ name })} /><Text label="Location" value={content.location} onChange={(location) => updateContent({ location })} /><Text label="Link (optional)" value={content.url} placeholder="https://example.com" onChange={(url) => updateContent({ url })} /></>;
  if (["single_image", "image_grid", "image_gallery"].includes(type)) fields = <>
    {["image_grid", "image_gallery"].includes(type) && <MultiImageDisplayControl block={block} onChange={onChange} />}
    <MediaFields
      media={content.media}
      multiple={type !== "single_image"}
      onChange={(media) => updateContent({ media })}
      onUpload={onUpload}
      onChooseMedia={onChooseMedia}
      onRemoveMedia={onRemoveMedia}
      uploading={uploading}
      emptyUploadLabel={["image_grid", "image_gallery"].includes(type) ? "Drop multiple images here" : undefined}
      filledUploadLabel={["image_grid", "image_gallery"].includes(type) ? "Add more images" : undefined}
    />
  </>;
  if (type === "video_embed") fields = <><Text label="YouTube or Vimeo URL" value={content.url} onChange={(url) => updateContent({ url })} /><Text label="Caption" value={content.caption} onChange={(caption) => updateContent({ caption })} /></>;
  if (type === "media_text") fields = <><MediaFields media={content.media} onChange={(media) => updateContent({ media })} onUpload={onUpload} onChooseMedia={onChooseMedia} onRemoveMedia={onRemoveMedia} uploading={uploading} /><Text label="Text" value={content.text} rows={6} onChange={(text) => updateContent({ text })} /><label className="editor-field"><span>Media position</span><select value={content.mediaPosition || "left"} onChange={(event) => updateContent({ mediaPosition: event.target.value })}><option value="left">Left</option><option value="right">Right</option></select></label></>;
  if (type === "link") fields = <div className="field-row"><Text label="Link text" value={content.text} onChange={(text) => updateContent({ text })} /><Text label="URL" value={content.url} placeholder="https://example.com" onChange={(url) => updateContent({ url })} /></div>;
  if (type === "external_link") fields = <div className="field-row"><Text label="Link label" value={content.label} onChange={(label) => updateContent({ label })} /><Text label="URL" value={content.url} placeholder="https://example.com" onChange={(url) => updateContent({ url })} /></div>;
  if (type === "divider") fields = <div className="portfolio-divider-editor-preview" aria-label="Divider preview"><span /></div>;
  if (type === "spacer") fields = <div className="portfolio-spacer-editor"><label className="editor-field"><span>Spacer height · {Math.max(0, Number(content.height) || 0)}px</span><input type="range" min="0" max="320" step="4" value={Math.max(0, Number(content.height) || 0)} onChange={(event) => updateContent({ height: Number(event.target.value) })} /></label><label className="editor-field"><span>Exact height</span><input type="number" min="0" max="480" step="4" value={Math.max(0, Number(content.height) || 0)} onChange={(event) => updateContent({ height: Math.min(480, Math.max(0, Number(event.target.value) || 0)) })} /></label></div>;

  return <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? .55 : 1 }} className={`portfolio-editor-block ${expanded ? "is-expanded" : ""} ${block.visible === false ? "is-hidden" : ""}`}>
    <header className="portfolio-block-card-header">
      <button type="button" className="drag-handle" {...attributes} {...listeners} aria-label={`Drag ${BLOCK_LABELS[type]} to change its position`}><span aria-hidden="true">⠿</span></button>
      <button type="button" className="portfolio-block-card-toggle" aria-expanded={expanded} onClick={onToggle}>
        <span className="portfolio-block-order">{index + 1}</span>
        <span className="portfolio-block-card-title"><strong>{BLOCK_LABELS[type]}</strong><small>{getPortfolioBlockSummary(block)}</small></span>
        <span className="portfolio-block-chevron" aria-hidden="true" />
      </button>
      <div className="portfolio-block-card-actions"><button type="button" className="quiet-button" onClick={() => onChange({ ...block, visible: block.visible === false })}>{block.visible === false ? "Show" : "Hide"}</button><button type="button" className="quiet-button" onClick={onDuplicate}>Duplicate</button><button type="button" className="quiet-button danger" onClick={onDelete}>Remove</button></div>
    </header>
    {expanded && <div className="portfolio-block-card-body">
      <div className="block-fields">{fields}</div>
      {type !== "spacer" && !isMultiImage && <footer>
        <label>Width<select value={block.settings?.width || "wide"} onChange={(event) => updateSettings({ width: event.target.value })}><option value="narrow">Narrow</option><option value="standard">Standard</option><option value="wide">Wide</option><option value="full">Full</option></select></label>
        <label>Spacing<select value={block.settings?.spacing || "default"} onChange={(event) => updateSettings({ spacing: event.target.value })}><option value="compact">Compact</option><option value="default">Default</option><option value="spacious">Spacious</option></select></label>
        {type === "two_columns" && <label>Column gap<select value={block.settings?.columnGap || 32} onChange={(event) => updateSettings({ columnGap: Number(event.target.value) })}><option value="16">Small</option><option value="32">Medium</option><option value="48">Large</option><option value="64">Extra large</option></select></label>}
        {["single_image", "media_text"].includes(type) && (
          <label>Fit
            <select
              value={block.settings?.mediaFit || "cover"}
              onChange={(event) => updateSettings({ mediaFit: event.target.value })}
            >
              <option value="cover">Cover</option><option value="contain">Contain</option>
            </select>
          </label>
        )}
      </footer>}
    </div>}
  </article>;
}
