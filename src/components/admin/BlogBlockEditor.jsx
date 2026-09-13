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

export function normalizeIncomingBlock(block) {
    if (!block) return createBlogBlock('text');
    const id = block.id || crypto.randomUUID();
    const rawType = block.type || block.blockType || 'text';
    const c = block.content || {};

    if (rawType === 'heading') {
        const text = block.text || c.text || '';
        const level = block.level || c.level || 2;
        return { id, type: 'heading', blockType: 'heading', text, level, content: { text, level } };
    }
    if (rawType === 'image' || rawType === 'single_image') {
        const imageUrl = block.imageUrl || c.media?.url || c.imageUrl || c.url || '';
        const alt = block.alt || c.media?.alt || c.alt || '';
        const caption = block.caption || c.media?.caption || c.caption || '';
        return {
            id,
            type: 'image',
            blockType: 'single_image',
            imageUrl,
            alt,
            caption,
            content: { media: { url: imageUrl, alt, caption } }
        };
    }
    if (rawType === 'quote' || rawType === 'quotation') {
        const text = block.text || c.quote || c.text || '';
        const citation = block.citation || c.attribution || c.citation || '';
        return { id, type: 'quote', blockType: 'quotation', text, citation, content: { quote: text, attribution: citation } };
    }
    if (rawType === 'video' || rawType === 'video_embed') {
        const url = block.url || c.url || '';
        const caption = block.caption || c.caption || '';
        return { id, type: 'video', blockType: 'video_embed', url, caption, content: { url, caption } };
    }
    if (rawType === 'divider') {
        return { id, type: 'divider', blockType: 'divider', content: {} };
    }
    if (rawType === 'columns' || rawType === 'two_columns') {
        const leftText = block.leftText || c.leftText || '';
        const rightText = block.rightText || c.rightText || '';
        return { id, type: 'columns', blockType: 'two_columns', leftText, rightText, content: { leftText, rightText } };
    }
    const text = block.text || c.text || (typeof block === 'string' ? block : '');
    return { id, type: 'text', blockType: 'body_text', text, content: { text } };
}

function BlogBlockFields({ block, updateBlock }) {
    const normalized = normalizeIncomingBlock(block);

    if (normalized.type === 'heading') {
        return (
            <label className="field-group compact-field">
                <span>Heading</span>
                <input className="box-input" value={normalized.text || ''} onChange={e => updateBlock({ text: e.target.value })} placeholder="Section title" />
            </label>
        );
    }
    if (normalized.type === 'text') {
        return (
            <>
                <label className="field-group compact-field">
                    <span>Text (Markdown supported)</span>
                    <textarea className="box-input" rows="4" value={normalized.text || ''} onChange={e => updateBlock({ text: e.target.value })} placeholder="Write your paragraph..." />
                </label>
            </>
        );
    }
    if (normalized.type === 'quote') {
        return (
            <>
                <label className="field-group compact-field">
                    <span>Quote</span>
                    <textarea className="box-input" rows="3" value={normalized.text || ''} onChange={e => updateBlock({ text: e.target.value })} placeholder="The quote text..." />
                </label>
                <label className="field-group compact-field">
                    <span>Citation (Optional)</span>
                    <input className="box-input" value={normalized.citation || ''} onChange={e => updateBlock({ citation: e.target.value })} placeholder="Author or Source" />
                </label>
            </>
        );
    }
    if (normalized.type === 'image') {
        return (
            <>
                {normalized.imageUrl && <img src={normalized.imageUrl} alt={normalized.alt} className="block-image-reference" />}
                <div className="image-source-actions">
                    <ImageUploader
                        key={normalized.imageUrl || normalized.id}
                        bucket="blog"
                        path={`blocks/${normalized.id}`}
                        label="Upload Image"
                        onUpload={(files) => updateBlock({ imageUrl: files?.[0]?.url || normalized.imageUrl })}
                        accept="image/*"
                        buttonOnly
                    />
                    <label className="field-group compact-field">
                        <span>Or Image URL</span>
                        <input className="box-input" type="url" value={normalized.imageUrl || ''} onChange={e => updateBlock({ imageUrl: e.target.value })} placeholder="https://..." />
                    </label>
                </div>
                <div className="control-grid">
                    <label className="field-group compact-field"><span>Caption</span><input className="box-input" value={normalized.caption || ''} onChange={e => updateBlock({ caption: e.target.value })} /></label>
                    <label className="field-group compact-field"><span>Alt Text</span><input className="box-input" value={normalized.alt || ''} onChange={e => updateBlock({ alt: e.target.value })} /></label>
                </div>
            </>
        );
    }
    if (normalized.type === 'video') {
        return (
            <>
                <label className="field-group compact-field">
                    <span>YouTube / Vimeo URL</span>
                    <input className="box-input" type="url" value={normalized.url || ''} onChange={e => updateBlock({ url: e.target.value })} placeholder="https://..." />
                </label>
                <label className="field-group compact-field">
                    <span>Caption</span>
                    <input className="box-input" value={normalized.caption || ''} onChange={e => updateBlock({ caption: e.target.value })} />
                </label>
            </>
        );
    }
    if (normalized.type === 'divider') {
        return <div className="structural-block-placeholder divider-placeholder" aria-hidden="true"><span style={{ borderTopWidth: '1px', borderTopColor: 'var(--border-strong)' }} /></div>;
    }
    if (normalized.type === 'columns') {
        return (
            <div className="control-grid">
                <label className="field-group compact-field">
                    <span>Left Column</span>
                    <textarea className="box-input" rows="4" value={normalized.leftText || ''} onChange={e => updateBlock({ leftText: e.target.value })} />
                </label>
                <label className="field-group compact-field">
                    <span>Right Column</span>
                    <textarea className="box-input" rows="4" value={normalized.rightText || ''} onChange={e => updateBlock({ rightText: e.target.value })} />
                </label>
            </div>
        );
    }
    return null;
}

function SortableBlogBlock({ block, index, onDuplicate, onDelete, onUpdate }) {
    const normalized = normalizeIncomingBlock(block);
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: normalized.id });
    
    return (
        <div 
            ref={setNodeRef} 
            style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }} 
            className="newsletter-block-card"
        >
            <div className="block-drag-handle" {...attributes} {...listeners}>⋮⋮</div>
            <div className="block-content">
                <div className="block-header">
                    <strong>{BLOG_BLOCK_TYPES.find(t => t.type === normalized.type)?.label || 'Block'}</strong>
                    <div className="block-actions">
                        <button type="button" onClick={onDuplicate} title="Duplicate">⎘</button>
                        <button type="button" onClick={onDelete} className="danger" title="Delete">×</button>
                    </div>
                </div>
                <div className="block-fields">
                    <BlogBlockFields block={normalized} updateBlock={onUpdate} />
                </div>
            </div>
        </div>
    );
}

export default function BlogBlockEditor({ blocks = [], onChange }) {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

    const normalizedBlocks = blocks.map(normalizeIncomingBlock);

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = normalizedBlocks.findIndex((b) => b.id === active.id);
        const newIndex = normalizedBlocks.findIndex((b) => b.id === over.id);
        onChange(arrayMove(normalizedBlocks, oldIndex, newIndex));
    };

    const addBlock = (type) => onChange([...normalizedBlocks, createBlogBlock(type)]);
    const updateBlock = (index, patch) => {
        const next = [...normalizedBlocks];
        const current = next[index];
        const merged = { ...current, ...patch };
        if (merged.type === 'image' || merged.blockType === 'single_image') {
            merged.content = { media: { url: merged.imageUrl || '', alt: merged.alt || '', caption: merged.caption || '' } };
        } else if (merged.type === 'text' || merged.blockType === 'body_text') {
            merged.content = { text: merged.text || '' };
        } else if (merged.type === 'heading') {
            merged.content = { text: merged.text || '', level: merged.level || 2 };
        } else if (merged.type === 'quote') {
            merged.content = { quote: merged.text || '', attribution: merged.citation || '' };
        } else if (merged.type === 'video') {
            merged.content = { url: merged.url || '', caption: merged.caption || '' };
        } else if (merged.type === 'columns') {
            merged.content = { leftText: merged.leftText || '', rightText: merged.rightText || '' };
        }
        next[index] = merged;
        onChange(next);
    };
    const duplicateBlock = (index) => {
        const next = [...normalizedBlocks];
        next.splice(index + 1, 0, { ...next[index], id: crypto.randomUUID() });
        onChange(next);
    };
    const deleteBlock = (index) => {
        const next = [...normalizedBlocks];
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
                    <SortableContext items={normalizedBlocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                        <div className="block-list">
                            {normalizedBlocks.map((block, index) => (
                                <SortableBlogBlock
                                    key={block.id}
                                    block={block}
                                    index={index}
                                    onUpdate={(patch) => updateBlock(index, patch)}
                                    onDuplicate={() => duplicateBlock(index)}
                                    onDelete={() => deleteBlock(index)}
                                />
                            ))}
                            {!normalizedBlocks.length && <div className="empty-canvas-message">Start building your blog post by adding a block.</div>}
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
