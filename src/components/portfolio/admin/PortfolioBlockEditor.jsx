import React from "react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BLOCK_LABELS } from "../../../lib/portfolio/schema";

const Text = ({ label, value, onChange, rows = 1, placeholder = "" }) => <label className="editor-field"><span>{label}</span>{rows > 1 ? <textarea value={value || ""} rows={rows} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /> : <input value={value || ""} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />}</label>;

function MediaField({ item, index, update, remove }) {
  return <div className="media-field">
    {item.url && <img src={item.url} alt="" />}
    {!item.storagePath && <Text label="Image link" value={item.url} placeholder="Paste an https:// image link" onChange={(url) => update(index, { sourceType: "external", url })} />}
    {item.storagePath && <div className="uploaded-media-source"><span>{item.processingStatus === "ready" ? "Cloudflare image" : "Cloudflare original ready"}</span><small>{item.originalFilename || item.storagePath}</small></div>}
    <Text label="Alt text (optional)" value={item.alt} onChange={(alt) => update(index, { alt })} />
    <Text label="Caption" value={item.caption} onChange={(caption) => update(index, { caption })} />
    <Text label="Credit" value={item.credit} onChange={(credit) => update(index, { credit })} />
    <button type="button" className="quiet-button danger media-remove-button" onClick={() => remove(index)}>Remove image</button>
  </div>;
}

function SortableMediaField({ item, index, sortId, update, remove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sortId });
  return <div ref={setNodeRef} className={`media-sortable-item ${isDragging ? "is-dragging" : ""}`} style={{ transform: CSS.Transform.toString(transform), transition }}>
    <button type="button" className="media-sequence-handle" {...attributes} {...listeners} aria-label={`Drag image ${index + 1} to change its display order`}>
      <span>{index + 1}</span>
      <small aria-hidden="true">⋮⋮</small>
    </button>
    <MediaField item={item} index={index} update={update} remove={remove} />
  </div>;
}

function MediaFields({ media, onChange, multiple = false, onUpload, onChooseMedia, onRemoveMedia, uploading, onFilePickerOpen, onFilePickerCancel }) {
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
    {multiple && items.length > 1 && <div className="media-sequence-label">Display order · drag a number to reorder</div>}
    {multiple ? <DndContext collisionDetection={closestCenter} onDragEnd={reorder}>
      <SortableContext items={sortIds} strategy={verticalListSortingStrategy}>
        {items.map((item, index) => <SortableMediaField key={sortIds[index]} item={item} index={index} sortId={sortIds[index]} update={update} remove={remove} />)}
      </SortableContext>
    </DndContext> : items.map((item, index) => <MediaField key={item.id || index} item={item} index={index} update={update} remove={remove} />)}
    {(multiple || items.length === 0) && <div className="media-choice-label">Choose how to add an image</div>}
    <div className="media-add-row"><button type="button" className="media-choice-button" onClick={() => onChooseMedia?.({ multiple, insertAt: multiple ? items.length : 0 })}>{items.length && !multiple ? "Replace from library" : multiple ? "Choose images from library" : "Choose from library"}</button><button type="button" className="media-choice-button" onClick={addLink}>{items.length && !multiple ? "Replace with image link" : "Add image link"}</button><label className="file-button media-choice-button">{uploading ? "Uploading…" : (multiple ? "Upload images" : (items.length ? "Replace with upload" : "Upload image"))}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple={multiple} disabled={uploading} onClickCapture={onFilePickerOpen} onCancel={onFilePickerCancel} onChange={(event) => {
      const files = [...(event.target.files || [])];
      if (files.length) { const result = onUpload(multiple ? files : files[0], multiple ? items.length : 0); if (result && typeof result.catch === "function") result.catch((err) => console.error("[block upload] unhandled:", err)); }
      else onFilePickerCancel?.();
      event.target.value = "";
    }} /></label></div>
  </div>;
}

export default function PortfolioBlockEditor({ block, onChange, onDuplicate, onDelete, onUpload, onChooseMedia, onRemoveMedia, uploading, onFilePickerOpen, onFilePickerCancel }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const updateContent = (patch) => onChange({ ...block, content: { ...block.content, ...patch } });
  const updateSettings = (patch) => onChange({ ...block, settings: { ...block.settings, ...patch } });
  const type = block.blockType;
  const content = block.content || {};
  let fields = null;
  if (type === "body_text") fields = <Text label="Text" value={content.text} rows={7} placeholder="Use **bold**, *italic* and [link text](https://…)" onChange={(text) => updateContent({ text })} />;
  if (type === "heading") fields = <><Text label="Heading" value={content.text} onChange={(text) => updateContent({ text })} /><label className="editor-field"><span>Level</span><select value={content.level || 2} onChange={(event) => updateContent({ level: Number(event.target.value) })}><option value="2">H2</option><option value="3">H3</option></select></label></>;
  if (type === "quotation") fields = <><Text label="Quote" value={content.quote} rows={4} onChange={(quote) => updateContent({ quote })} /><Text label="Attribution" value={content.attribution} onChange={(attribution) => updateContent({ attribution })} /></>;
  if (type === "highlight") fields = <Text label="Highlight" value={content.text} rows={3} onChange={(text) => updateContent({ text })} />;
  if (type === "testimonial") fields = <><Text label="Quote" value={content.quote} rows={4} onChange={(quote) => updateContent({ quote })} /><Text label="Name" value={content.name} onChange={(name) => updateContent({ name })} /><Text label="Role / organisation" value={content.role} onChange={(role) => updateContent({ role })} /><Text label="Link" value={content.link} onChange={(link) => updateContent({ link })} /></>;
  if (["single_image", "image_grid", "image_gallery"].includes(type)) fields = <MediaFields media={content.media} multiple={type !== "single_image"} onChange={(media) => updateContent({ media })} onUpload={onUpload} onChooseMedia={onChooseMedia} onRemoveMedia={onRemoveMedia} uploading={uploading} onFilePickerOpen={onFilePickerOpen} onFilePickerCancel={onFilePickerCancel} />;
  if (type === "video_embed") fields = <><Text label="YouTube or Vimeo URL" value={content.url} onChange={(url) => updateContent({ url })} /><Text label="Caption" value={content.caption} onChange={(caption) => updateContent({ caption })} /></>;
  if (type === "media_text") fields = <><MediaFields media={content.media} onChange={(media) => updateContent({ media })} onUpload={onUpload} onChooseMedia={onChooseMedia} onRemoveMedia={onRemoveMedia} uploading={uploading} onFilePickerOpen={onFilePickerOpen} onFilePickerCancel={onFilePickerCancel} /><Text label="Text" value={content.text} rows={6} onChange={(text) => updateContent({ text })} /><label className="editor-field"><span>Media position</span><select value={content.mediaPosition || "left"} onChange={(event) => updateContent({ mediaPosition: event.target.value })}><option value="left">Left</option><option value="right">Right</option></select></label></>;
  if (type === "external_link") fields = <><Text label="Label" value={content.label} onChange={(label) => updateContent({ label })} /><Text label="URL" value={content.url} onChange={(url) => updateContent({ url })} /></>;

  return <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? .55 : 1 }} className={`portfolio-editor-block ${block.visible === false ? "is-hidden" : ""}`}>
    <header><button type="button" className="drag-handle" {...attributes} {...listeners} aria-label={`Reorder ${BLOCK_LABELS[type]}`}>⋮⋮</button><strong>{BLOCK_LABELS[type]}</strong><div><button type="button" className="quiet-button" onClick={() => onChange({ ...block, visible: block.visible === false })}>{block.visible === false ? "Show" : "Hide"}</button><button type="button" className="quiet-button" onClick={onDuplicate}>Duplicate</button><button type="button" className="quiet-button danger" onClick={onDelete}>Delete</button></div></header>
    <div className="block-fields">{fields}</div>
    <footer>
      <label>Width<select value={block.settings?.width || "wide"} onChange={(event) => updateSettings({ width: event.target.value })}><option value="narrow">Narrow</option><option value="standard">Standard</option><option value="wide">Wide</option><option value="full">Full</option></select></label>
      <label>Spacing<select value={block.settings?.spacing || "default"} onChange={(event) => updateSettings({ spacing: event.target.value })}><option value="compact">Compact</option><option value="default">Default</option><option value="spacious">Spacious</option></select></label>
      {["image_grid", "image_gallery"].includes(type) && <label>Columns<select value={block.settings?.columns || 2} onChange={(event) => updateSettings({ columns: Number(event.target.value) })}><option value="1">One</option><option value="2">Two</option><option value="3">Three</option></select></label>}
      {["single_image", "image_grid", "image_gallery", "media_text"].includes(type) && <label>Fit<select value={block.settings?.mediaFit || "cover"} onChange={(event) => updateSettings({ mediaFit: event.target.value })}><option value="cover">Cover</option><option value="contain">Contain</option></select></label>}
    </footer>
  </article>;
}
