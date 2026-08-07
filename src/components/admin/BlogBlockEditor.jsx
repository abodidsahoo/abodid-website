import React, { useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ImageUploader from './ImageUploader';
import InlineLinkEditor from './InlineLinkEditor'; // Reuse if possible

export const BLOG_BLOCK_TYPES = [
    { type: 'heading', label: 'Heading' },
    { type: 'text', label: 'Text' },
    { type: 'quote', label: 'Quotation' },
    { type: 'image', label: 'Image' },
    { type: 'video', label: 'Video Embed' },
    { type: 'divider', label: 'Divider' },
    { type: 'columns', label: 'Two Columns' }
];

export function createBlogBlock(type) {
    const base = { id: crypto.randomUUID(), type };
    switch (type) {
        case 'heading': return { ...base, text: '' };
        case 'text': return { ...base, text: '' };
        case 'quote': return { ...base, text: '', citation: '' };
        case 'image': return { ...base, imageUrl: '', caption: '', alt: '' };
        case 'video': return { ...base, url: '', caption: '' };
        case 'divider': return { ...base };
        case 'columns': return { ...base, leftText: '', rightText: '' };
        default: return base;
    }
}

function BlogBlockFields({ block, updateBlock }) {
    if (block.type === 'heading') {
        return (
            <label className="field-group compact-field">
                <span>Heading</span>
                <input className="box-input" value={block.text || ''} onChange={e => updateBlock({ text: e.target.value })} placeholder="Section title" />
            </label>
        );
    }
    if (block.type === 'text') {
        return (
            <>
                <label className="field-group compact-field">
                    <span>Text (Markdown supported)</span>
                    <textarea className="box-input" rows="4" value={block.text || ''} onChange={e => updateBlock({ text: e.target.value })} placeholder="Write your paragraph..." />
                </label>
            </>
        );
    }
    if (block.type === 'quote') {
        return (
            <>
                <label className="field-group compact-field">
                    <span>Quote</span>
                    <textarea className="box-input" rows="3" value={block.text || ''} onChange={e => updateBlock({ text: e.target.value })} placeholder="The quote text..." />
                </label>
                <label className="field-group compact-field">
                    <span>Citation (Optional)</span>
                    <input className="box-input" value={block.citation || ''} onChange={e => updateBlock({ citation: e.target.value })} placeholder="Author or Source" />
                </label>
            </>
        );
    }
    if (block.type === 'image') {
        return (
            <>
                {block.imageUrl && <img src={block.imageUrl} alt={block.alt} className="block-image-reference" />}
                <div className="image-source-actions">
                    <ImageUploader
                        key={block.imageUrl || block.id}
                        bucket="blog"
                        path={`blocks/${block.id}`}
                        label="Upload Image"
                        onUpload={(files) => updateBlock({ imageUrl: files?.[0]?.url || block.imageUrl })}
                        accept="image/*"
                        buttonOnly
                    />
                    <label className="field-group compact-field">
                        <span>Or Image URL</span>
                        <input className="box-input" type="url" value={block.imageUrl || ''} onChange={e => updateBlock({ imageUrl: e.target.value })} placeholder="https://..." />
                    </label>
                </div>
                <div className="control-grid">
                    <label className="field-group compact-field"><span>Caption</span><input className="box-input" value={block.caption || ''} onChange={e => updateBlock({ caption: e.target.value })} /></label>
                    <label className="field-group compact-field"><span>Alt Text</span><input className="box-input" value={block.alt || ''} onChange={e => updateBlock({ alt: e.target.value })} /></label>
                </div>
            </>
        );
    }
    if (block.type === 'video') {
        return (
            <>
                <label className="field-group compact-field">
                    <span>YouTube / Vimeo URL</span>
                    <input className="box-input" type="url" value={block.url || ''} onChange={e => updateBlock({ url: e.target.value })} placeholder="https://..." />
                </label>
                <label className="field-group compact-field">
                    <span>Caption</span>
                    <input className="box-input" value={block.caption || ''} onChange={e => updateBlock({ caption: e.target.value })} />
                </label>
            </>
        );
    }
    if (block.type === 'divider') {
        return <div className="structural-block-placeholder divider-placeholder" aria-hidden="true"><span style={{ borderTopWidth: '1px', borderTopColor: 'var(--border-strong)' }} /></div>;
    }
    if (block.type === 'columns') {
        return (
            <div className="control-grid">
                <label className="field-group compact-field">
                    <span>Left Column</span>
                    <textarea className="box-input" rows="4" value={block.leftText || ''} onChange={e => updateBlock({ leftText: e.target.value })} />
                </label>
                <label className="field-group compact-field">
                    <span>Right Column</span>
                    <textarea className="box-input" rows="4" value={block.rightText || ''} onChange={e => updateBlock({ rightText: e.target.value })} />
                </label>
            </div>
        );
    }
    return null;
}

function SortableBlogBlock({ block, index, onDuplicate, onDelete, onUpdate }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
    
    return (
        <div 
            ref={setNodeRef} 
            style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }} 
            className="newsletter-block-card"
        >
            <div className="block-drag-handle" {...attributes} {...listeners}>⋮⋮</div>
            <div className="block-content">
                <div className="block-header">
                    <strong>{BLOG_BLOCK_TYPES.find(t => t.type === block.type)?.label || 'Block'}</strong>
                    <div className="block-actions">
                        <button type="button" onClick={onDuplicate} title="Duplicate">⎘</button>
                        <button type="button" onClick={onDelete} className="danger" title="Delete">×</button>
                    </div>
                </div>
                <div className="block-fields">
                    <BlogBlockFields block={block} updateBlock={onUpdate} />
                </div>
            </div>
        </div>
    );
}

export default function BlogBlockEditor({ blocks = [], onChange }) {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = blocks.findIndex((b) => b.id === active.id);
        const newIndex = blocks.findIndex((b) => b.id === over.id);
        onChange(arrayMove(blocks, oldIndex, newIndex));
    };

    const addBlock = (type) => onChange([...blocks, createBlogBlock(type)]);
    const updateBlock = (index, patch) => {
        const next = [...blocks];
        next[index] = { ...next[index], ...patch };
        onChange(next);
    };
    const duplicateBlock = (index) => {
        const next = [...blocks];
        next.splice(index + 1, 0, { ...next[index], id: crypto.randomUUID() });
        onChange(next);
    };
    const deleteBlock = (index) => {
        const next = [...blocks];
        next.splice(index, 1);
        onChange(next);
    };

    return (
        <div className="newsletter-designer">
            <div className="designer-toolbar">
                <div className="block-palette">
                    <strong>Add Block</strong>
                    {BLOG_BLOCK_TYPES.map((type) => (
                        <button key={type.type} type="button" onClick={() => addBlock(type.type)}>+ {type.label}</button>
                    ))}
                </div>
            </div>
            
            <div className="designer-canvas">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                        <div className="block-list">
                            {blocks.map((block, index) => (
                                <SortableBlogBlock
                                    key={block.id}
                                    block={block}
                                    index={index}
                                    onUpdate={(patch) => updateBlock(index, patch)}
                                    onDuplicate={() => duplicateBlock(index)}
                                    onDelete={() => deleteBlock(index)}
                                />
                            ))}
                            {!blocks.length && <div className="empty-canvas-message">Start building your blog post by adding a block.</div>}
                        </div>
                    </SortableContext>
                </DndContext>
            </div>
            <style>{`
                /* Rely on newsletter styles for structural consistency */
            `}</style>
        </div>
    );
}
