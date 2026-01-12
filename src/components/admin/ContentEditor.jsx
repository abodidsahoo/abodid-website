import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import ImageUploader from './ImageUploader';

export default function ContentEditor({ table, id }) {
    const isNew = id === 'new';
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState(isNew ? { published: true } : {});
    const [notification, setNotification] = useState(null);

    // Schema Config
    const isBlog = table === 'blog';
    const hasVisuals = isBlog || table === 'journal' || table === 'research';

    // Fields
    const SCHEMAS = {
        journal: ['title', 'slug', 'excerpt', 'content', 'cover_image', 'published_at', 'published'],
        research: ['title', 'slug', 'description', 'content', 'link', 'repo_link', 'tags', 'image', 'sort_order', 'published'],
        blog: ['title', 'slug', 'intro', 'content', 'category', 'cover_image', 'published'],
        films: ['title', 'year', 'description', 'video_url', 'thumbnail_url', 'role', 'genre', 'published']
    };
    const fields = SCHEMAS[table] || [];

    useEffect(() => {
        if (!isNew) fetchData();
    }, [id]);

    const fetchData = async () => {
        const { data } = await supabase.from(table).select('*').eq('id', id).single();
        if (data) setFormData(data);
        setLoading(false);
    };

    const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        setSaving(true);

        if (!formData.slug && fields.includes('slug')) {
            formData.slug = (formData.title || 'untitled').toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '-');
        }

        // Strict Filter
        const payload = {};
        fields.forEach(field => {
            if (formData[field] !== undefined) payload[field] = formData[field];
        });

        const query = isNew ? supabase.from(table).insert([payload]).select() : supabase.from(table).update(payload).eq('id', id);
        const { data, error } = await query;

        if (error) {
            setNotification({ type: 'error', msg: error.message });
        } else {
            setNotification({ type: 'success', msg: 'Saved successfully' });
            if (isNew && data) {
                window.location.href = `/admin/editor?table=${table}&id=${data[0].id}`;
            }
        }
        setSaving(false);
        setTimeout(() => setNotification(null), 3000);
    };

    const appendToContent = (text) => {
        handleChange('content', (formData.content || '') + text);
    };

    const handleImageBatch = (files, label) => {
        if (!files.length) return;
        const markdown = files.map(f => `\n![${f.name}](${f.url})`).join('');
        // Optional: Wrap in a nice comment or section
        const section = `\n\n<!-- ${label} -->${markdown}\n`;
        appendToContent(section);
        setNotification({ type: 'success', msg: `Added ${files.length} images from ${label}!` });
        setTimeout(() => setNotification(null), 2000);
    };

    if (loading) return <div className="loading">Loading Studio...</div>;

    const contentField = fields.includes('content') ? 'content' : fields.includes('intro') ? 'intro' : null;

    return (
        <div className="studio-layout">
            {/* ZONE A: HEADER & ACTIONS */}
            <header className="studio-topbar">
                <div className="breadcrumb">
                    <a href="/admin/dashboard">Dashboard</a> / <span className="current">{isNew ? 'New' : 'Edit'} {table}</span>
                </div>
                <div className="actions">
                    <button onClick={() => handleSave()} disabled={saving} className={`btn-save ${saving ? 'saving' : ''}`}>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </header>

            {notification && (
                <div className={`notification ${notification.type}`}>
                    {notification.msg}
                </div>
            )}

            <div className="studio-grid">

                {/* ZONE B: VISUAL ASSETS (Only for visual types) */}
                {hasVisuals && (
                    <div className="visual-tray">
                        {/* Cover Image Slot */}
                        <div className="tray-section">
                            <h4>Cover</h4>
                            <div className="cover-slot">
                                {formData.cover_image ? (
                                    <div className="cover-preview" onClick={() => handleChange('cover_image', '')}>
                                        <img src={formData.cover_image} alt="Cover" />
                                        <div className="overlay">Ref Change</div>
                                    </div>
                                ) : (
                                    <ImageUploader
                                        bucket={table} // Dynamic Bucket Name
                                        path={`${table}/covers`}
                                        label="Drag Cover"
                                        onUpload={(files) => handleChange('cover_image', files[0].url)}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Stacks for Content */}
                        <div className="tray-section">
                            <h4>Content Stacks</h4>
                            <div className="stack-list">
                                <StackBox label="Set 1 (Intro)" bucket={table} path={`${table}/set1`} onInsert={(files) => handleImageBatch(files, 'Set 1')} />
                                <StackBox label="Set 2 (Middle)" bucket={table} path={`${table}/set2`} onInsert={(files) => handleImageBatch(files, 'Set 2')} />
                                <StackBox label="Set 3 (End)" bucket={table} path={`${table}/set3`} onInsert={(files) => handleImageBatch(files, 'Set 3')} />
                            </div>
                        </div>

                        {/* Metadata Form */}
                        <div className="tray-section">
                            <h4>Details</h4>
                            {fields.filter(f => f !== 'content' && f !== 'cover_image' && f !== 'intro').map(field => (
                                <div key={field} className="mini-form-group">
                                    <label>{field.replace('_', ' ')}</label>
                                    {field === 'published' ? (
                                        <div className="toggle-wrapper" onClick={() => handleChange(field, !formData[field])}>
                                            <div className={`toggle ${formData[field] ? 'on' : 'off'}`}></div>
                                            <span>{formData[field] ? 'Public' : 'Draft'}</span>
                                        </div>
                                    ) : (
                                        <input
                                            type="text"
                                            value={formData[field] || ''}
                                            onChange={e => handleChange(field, e.target.value)}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ZONE C: CANVAS (Content Editor) */}
                <div className="canvas-area">
                    {/* Title Input as part of Canvas */}
                    <input
                        type="text"
                        className="canvas-title"
                        placeholder="Untitled Story"
                        value={formData.title || ''}
                        onChange={e => handleChange('title', e.target.value)}
                    />

                    {contentField && (
                        <>
                            <Toolbar onInsert={appendToContent} />
                            <textarea
                                className="canvas-editor"
                                value={formData[contentField] || ''}
                                onChange={e => handleChange(contentField, e.target.value)}
                                placeholder="# Start writing your story... Images from stacks will appear as links here."
                            />
                        </>
                    )}
                </div>
            </div>

            <style>{`
                .studio-layout { height: 100vh; display: flex; flex-direction: column; background: var(--bg-color); }
                .studio-topbar {
                    display: flex; justify-content: space-between; align-items: center;
                    padding: 0.8rem 1.5rem; border-bottom: 1px solid var(--border-subtle);
                    background: var(--bg-surface);
                    height: 60px;
                }
                .btn-save {
                    background: var(--text-primary); color: var(--bg-color); border: none;
                    padding: 0.5rem 1.2rem; border-radius: 4px; font-weight: 500; cursor: pointer;
                }
                .studio-grid { display: flex; flex: 1; overflow: hidden; }

                /* ZONE B: TRAY */
                .visual-tray {
                    width: 350px;
                    border-right: 1px solid var(--border-subtle);
                    background: var(--bg-surface);
                    overflow-y: auto;
                    display: flex; flex-direction: column;
                }
                .tray-section { padding: 1.5rem; border-bottom: 1px solid var(--border-subtle); }
                .tray-section h4 { 
                    margin: 0 0 1rem 0; font-size: 0.75rem; text-transform: uppercase; 
                    letter-spacing: 0.1em; color: var(--text-tertiary); 
                }
                
                .cover-preview {
                    aspect-ratio: 16/9; border-radius: 6px; overflow: hidden; position: relative; cursor: pointer;
                }
                .cover-preview img { width: 100%; height: 100%; object-fit: cover; }
                .cover-preview:hover .overlay { opacity: 1; }
                .overlay {
                    position: absolute; inset: 0; background: rgba(0,0,0,0.5); color: white;
                    display: flex; align-items: center; justify-content: center; opacity: 0; transition: 0.2s;
                }

                .stack-list { display: flex; flex-direction: column; gap: 1rem; }

                /* ZONE C: CANVAS */
                .canvas-area {
                    flex: 1;
                    padding: 3rem 4rem;
                    display: flex; flex-direction: column;
                    overflow-y: auto;
                    max-width: 900px; /* Reading width */
                    margin: 0 auto;
                }
                .canvas-title {
                    font-size: 2.5rem; border: none; background: transparent;
                    font-family: var(--font-serif); font-weight: 600;
                    margin-bottom: 2rem; color: var(--text-primary);
                    outline: none;
                }
                
                /* Toolbar */
                .toolbar {
                    display: flex; gap: 0.5rem; margin-bottom: 1rem;
                    padding: 0.5rem; border: 1px solid var(--border-subtle);
                    border-radius: 6px; background: var(--bg-surface);
                    position: sticky; top: 0;
                }
                .tool-btn {
                    background: none; border: none; padding: 0.4rem 0.8rem;
                    cursor: pointer; font-size: 0.9rem; border-radius: 4px;
                    color: var(--text-secondary); font-weight: 500;
                }
                .tool-btn:hover { background: var(--bg-surface-hover); color: var(--text-primary); }
                
                .canvas-editor {
                    flex: 1; resize: none; border: none; background: transparent;
                    font-family: 'Menlo', monospace; font-size: 1rem; line-height: 1.8;
                    color: var(--text-primary); outline: none; min-height: 500px;
                }

                /* Mini Forms */
                .mini-form-group { margin-bottom: 1rem; }
                .mini-form-group label { display: block; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.3rem; }
                .mini-form-group input { 
                    width: 100%; padding: 0.5rem; background: var(--bg-color); border: 1px solid var(--border-subtle);
                    border-radius: 4px; color: var(--text-primary);
                }
                
                .toggle-wrapper { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
                .toggle {
                    width: 32px; height: 18px; background: var(--border-subtle); border-radius: 9px; position: relative; transition: 0.3s;
                }
                .toggle.on { background: var(--text-primary); }
                .toggle::after {
                    content: ''; position: absolute; left: 2px; top: 2px; width: 14px; height: 14px;
                    background: white; border-radius: 50%; transition: 0.3s;
                }
                .toggle.on::after { transform: translateX(14px); }

                .notification {
                    position: fixed; top: 1rem; left: 50%; transform: translateX(-50%);
                    padding: 0.8rem 1.5rem; border-radius: 30px; 
                    font-size: 0.85rem; z-index: 1000; color: white;
                }
                .notification.success { background: #10B981; }
                .notification.error { background: #EF4444; }
            `}</style>
        </div>
    );
}

function Toolbar({ onInsert }) {
    return (
        <div className="toolbar">
            <button className="tool-btn" onClick={() => onInsert('**bold** ')} title="Bold">B</button>
            <button className="tool-btn" onClick={() => onInsert('*italic* ')} title="Italic">I</button>
            <button className="tool-btn" onClick={() => onInsert('\n# Heading 1\n')} title="Heading 1">H1</button>
            <button className="tool-btn" onClick={() => onInsert('\n## Heading 2\n')} title="Heading 2">H2</button>
            <button className="tool-btn" onClick={() => onInsert('\n> ')} title="Quote">❞</button>
            <button className="tool-btn" onClick={() => onInsert('[]()')} title="Link">🔗</button>
            <button className="tool-btn" onClick={() => onInsert('\n```\ncode\n```\n')} title="Code">{'</>'}</button>
            <button className="tool-btn" onClick={() => onInsert('\n---\n')} title="Divider">HR</button>
        </div>
    );
}

function StackBox({ label, bucket, path, onInsert }) {
    const [files, setFiles] = useState([]);

    const handleUpload = (newFiles) => {
        setFiles(prev => [...prev, ...newFiles]);
    };

    return (
        <div className="stack-box">
            <div className="stack-header">
                <span>{label}</span>
                {files.length > 0 && (
                    <button className="btn-insert" onClick={() => onInsert(files)}>
                        Insert All ({files.length})
                    </button>
                )}
            </div>
            <ImageUploader
                bucket={bucket}
                path={path}
                multiple={true}
                onUpload={handleUpload}
                label="+"
            />
            <style>{`
                .stack-box { margin-bottom: 0.5rem; }
                .stack-header { 
                    display: flex; justify-content: space-between; align-items: center; 
                    margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--text-secondary);
                }
                .btn-insert {
                    background: none; border: 1px solid var(--border-subtle);
                    font-size: 0.7rem; padding: 2px 6px; border-radius: 4px;
                    cursor: pointer; color: var(--text-primary);
                }
                .btn-insert:hover { background: var(--bg-surface-hover); }
            `}</style>
        </div>
    );
}
