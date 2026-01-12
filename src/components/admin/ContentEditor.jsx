import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import ImageUploader from './ImageUploader';

export default function ContentEditor({ table, id }) {
    const isNew = id === 'new';
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState(isNew ? { published: false } : {});
    const [notification, setNotification] = useState(null);

    // --- CONFIGURATION ---
    const isPhotography = table === 'photography';
    const isFilms = table === 'films';

    // Field Config
    const FIELDS = {
        blog: ['slug', 'excerpt', 'published_at'], // content handled separately
        research: ['slug', 'link', 'repo_link', 'tags', 'published_at'],
        photography: ['slug', 'category', 'intro'],
        films: ['year', 'genre', 'role', 'video_url', 'thumbnail_url']
    };
    const visibleFields = FIELDS[table] || [];

    // --- DATA FETCHING ---
    useEffect(() => {
        if (!isNew) fetchData();
    }, [id]);

    const fetchData = async () => {
        const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
        if (data) setFormData(data);
        if (error) notify('error', 'Error loading data');
        setLoading(false);
    };

    // --- ACTIONS ---
    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async (publishStatus = null) => {
        setSaving(true);
        const payload = { ...formData };

        // Auto-slug
        if (!payload.slug && payload.title) {
            payload.slug = payload.title.toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '-');
        }

        // Publish Logic
        if (publishStatus !== null) {
            payload.published = publishStatus;
        }

        const query = isNew
            ? supabase.from(table).insert([payload]).select()
            : supabase.from(table).update(payload).eq('id', id);

        const { data, error } = await query;

        if (error) {
            notify('error', error.message);
        } else {
            const msg = publishStatus === true ? 'Published Live 🟢' : 'Draft Saved 💾';
            notify('success', msg);
            if (isNew && data) {
                window.location.href = `/admin/editor?table=${table}&id=${data[0].id}`;
            } else if (!isNew) {
                setFormData(prev => ({ ...prev, ...payload })); // Update local state specifically for published status
            }
        }
        setSaving(false);
    };

    const notify = (type, msg) => {
        setNotification({ type, msg });
        setTimeout(() => setNotification(null), 3000);
    };

    const copyLink = () => {
        const origin = window.location.origin;
        const link = `${origin}/${table === 'photography' ? 'photography' : table}/${formData.slug || ''}`;
        navigator.clipboard.writeText(link);
        notify('success', 'Preview link copied to clipboard');
    };

    // --- GALLERY LOGIC (Single Table) ---
    const handleGalleryUpload = async (newUploads) => {
        if (!newUploads.length) return;
        const current = formData.gallery_images || [];
        const newItems = newUploads.map((u, i) => ({
            id: crypto.randomUUID(),
            url: u.url,
            caption: u.name,
            sort_order: current.length + i,
            is_vertical: false
        }));
        const updated = [...current, ...newItems];

        handleChange('gallery_images', updated);
        if (!isNew) {
            await supabase.from(table).update({ gallery_images: updated }).eq('id', id);
            notify('success', 'Photos added to gallery');
        }
    };

    const removeGalleryItem = async (index) => {
        const updated = [...(formData.gallery_images || [])];
        updated.splice(index, 1);
        handleChange('gallery_images', updated);
        if (!isNew) {
            await supabase.from(table).update({ gallery_images: updated }).eq('id', id);
        }
    };

    // --- RENDER HELPERS ---
    const getVideoEmbed = (url) => {
        if (!url) return null;
        if (url.includes('youtube') || url.includes('youtu.be')) {
            const id = url.split('v=')[1]?.split('&')[0] || url.split('/').pop();
            return `https://www.youtube.com/embed/${id}`;
        }
        if (url.includes('vimeo')) {
            const id = url.split('/').pop().split('?')[0];
            return `https://player.vimeo.com/video/${id}`;
        }
        return null;
    };

    if (loading) return <div className="loading-screen">Loading Record...</div>;

    // --- MARKDOWN INSERTION LOGIC (For Writing/Research) ---
    const insertMarkdownImage = (url) => {
        const textArea = document.querySelector('.content-area');
        if (!textArea) return;

        const start = textArea.selectionStart;
        const end = textArea.selectionEnd;
        const text = textArea.value;
        const markdown = `![Image](${url})\n`;

        const newText = text.substring(0, start) + markdown + text.substring(end);
        handleChange('content', newText);

        // Restore focus/cursor
        setTimeout(() => {
            textArea.focus();
            textArea.setSelectionRange(start + markdown.length, start + markdown.length);
        }, 0);

        notify('success', 'Image inserted into text');
    };

    return (
        <div className="cms-shell">
            {/* SIDEBAR */}
            <aside className="cms-sidebar">
                <div className="brand">
                    <a href="/admin/dashboard">← Back to Dashboard</a>
                </div>
                <div className="meta-block">
                    <label>Content Type</label>
                    <div className="id-hash">{table.toUpperCase()}</div>
                </div>
                <div className="meta-block">
                    <label>Status</label>
                    <div className={`status-badge ${formData.published ? 'live' : 'draft'}`}>
                        {formData.published ? 'Live' : 'Draft'}
                    </div>
                </div>
                <div className="meta-block">
                    <label>Reference ID</label>
                    <div className="id-hash">{id.split('-')[0]}...</div>
                </div>
            </aside>

            {/* MAIN */}
            <main className="cms-main">
                {/* ACTIONS */}
                <header className="cms-actions">
                    <div className={`context-title ${!formData.title ? 'placeholder' : ''}`}>
                        {formData.title || 'Untitled Story'}
                    </div>
                    <div className="btn-group">
                        <button className="btn sec" onClick={() => handleSave(false)}>Save Draft</button>
                        <button className="btn pri" onClick={() => handleSave(true)}>{formData.published ? 'Update Live' : 'Publish'}</button>
                    </div>
                </header>

                {/* CANVAS */}
                <div className="cms-canvas">
                    {notification && (
                        <div className={`toast ${notification.type}`}>{notification.msg}</div>
                    )}

                    <div className="model-card">

                        {/* =========================================
                            MODE: FILM EDITOR
                           ========================================= */}
                        {isFilms && (
                            <div className="editor-grid">
                                {/* LEFT COL: METADATA */}
                                <div className="editor-col-left">
                                    <section className="card-section">
                                        <label className="section-label">Essential Info</label>
                                        <div className="field-group">
                                            <label>Title</label>
                                            <input type="text" className="box-input large" placeholder="Movie Title..." value={formData.title || ''} onChange={e => handleChange('title', e.target.value)} />
                                        </div>
                                        <div className="meta-row">
                                            <div className="field-group">
                                                <label>Year</label>
                                                <input type="number" className="box-input" value={formData.year || ''} onChange={e => handleChange('year', e.target.value)} />
                                            </div>
                                            <div className="field-group">
                                                <label>Genre</label>
                                                <input type="text" className="box-input" value={formData.genre || ''} onChange={e => handleChange('genre', e.target.value)} />
                                            </div>
                                        </div>
                                        <div className="field-group full-width">
                                            <label>Role / Credit</label>
                                            <input type="text" className="box-input" value={formData.role || ''} onChange={e => handleChange('role', e.target.value)} placeholder="e.g. Director, Editor..." />
                                        </div>

                                        <div className="field-group" style={{ marginTop: '1rem' }}>
                                            <label>Logline / Description</label>
                                            <textarea className="box-input content-area-compact" value={formData.description || ''} onChange={e => handleChange('description', e.target.value)} />
                                        </div>
                                    </section>
                                </div>

                                {/* RIGHT COL: MEDIA */}
                                <div className="editor-col-right">
                                    <section className="card-section">
                                        <label className="section-label">Media Assets</label>
                                        <div className="media-stack">
                                            <div className="media-col">
                                                <label>Video URL</label>
                                                {formData.video_url && getVideoEmbed(formData.video_url) ? (
                                                    <div className="fixed-uploader">
                                                        <div className="preview-fit">
                                                            <iframe src={getVideoEmbed(formData.video_url)} frameBorder="0" allowFullScreen></iframe>
                                                            <button className="btn-mini-remove" onClick={() => handleChange('video_url', '')}>Remove</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <input type="text" className="box-input" placeholder="Paste URL..." value={formData.video_url || ''} onChange={e => handleChange('video_url', e.target.value)} />
                                                )}
                                            </div>
                                            <div className="media-col">
                                                <label>Thumbnail</label>
                                                {formData.thumbnail_url ? (
                                                    <div className="cover-wrapper-small preview-active">
                                                        <div className="preview-fit">
                                                            <img src={formData.thumbnail_url} />
                                                            <button className="btn-mini-remove" onClick={() => handleChange('thumbnail_url', '')}>Replace</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <ImageUploader
                                                        bucket="films" path="thumbnails" label="Upload Thumbnail"
                                                        buttonLabel="+"
                                                        className="cover-uploader-box"
                                                        onUpload={f => handleChange('thumbnail_url', f[0].url)}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            </div>
                        )}

                        {/* =========================================
                            MODE: PHOTOGRAPHY EDITOR
                           ========================================= */}
                        {isPhotography && (
                            <div className="editor-grid">
                                {/* LEFT COL */}
                                <div className="editor-col-left">
                                    <section className="card-section">
                                        <label className="section-label">Classification</label>
                                        <div className="field-group">
                                            <label>Title</label>
                                            <input type="text" className="box-input large" placeholder="Title..." value={formData.title || ''} onChange={e => handleChange('title', e.target.value)} />
                                        </div>
                                        <div className="field-group">
                                            <label>Slug</label>
                                            <input type="text" className="box-input" value={formData.slug || ''} onChange={e => handleChange('slug', e.target.value)} onFocus={() => !formData.slug && formData.title && handleChange('slug', formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'))} placeholder="Auto-generate..." />
                                        </div>
                                        <div className="meta-row">
                                            <div className="field-group">
                                                <label>Category</label>
                                                <input type="text" className="box-input" value={formData.category || ''} onChange={e => handleChange('category', e.target.value)} />
                                            </div>
                                            <div className="field-group">
                                                <label>Intro</label>
                                                <input type="text" className="box-input" value={formData.intro || ''} onChange={e => handleChange('intro', e.target.value)} />
                                            </div>
                                        </div>
                                    </section>

                                    <section className="card-section">
                                        <label className="section-label">Cover Image</label>
                                        {formData.cover_image ? (
                                            <div className="cover-wrapper-small preview-active">
                                                <div className="preview-fit">
                                                    <img src={formData.cover_image} />
                                                    <button className="btn-mini-remove" onClick={() => handleChange('cover_image', '')}>Replace</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <ImageUploader
                                                bucket="photography" path="covers" label="Upload Cover"
                                                className="cover-uploader-box"
                                                onUpload={f => handleChange('cover_image', f[0].url)}
                                            />
                                        )}
                                    </section>

                                    <section className="card-section">
                                        <label className="section-label">Story Text</label>
                                        <textarea className="box-input content-area-compact" value={formData.content || ''} onChange={e => handleChange('content', e.target.value)} />
                                    </section>
                                </div>

                                {/* RIGHT COL */}
                                <div className="editor-col-right">
                                    <section className="card-section">
                                        <label className="section-label">Gallery Stream (All Photos)</label>
                                        <div className="gallery-container large">
                                            <div className="gallery-stream">
                                                {(formData.gallery_images || []).map((img, idx) => (
                                                    <div key={idx} className="stream-item">
                                                        <img src={img.url} />
                                                        <div className="item-overlay"><button onClick={() => removeGalleryItem(idx)}>×</button></div>
                                                    </div>
                                                ))}
                                                <div className="stream-action-tile">
                                                    <ImageUploader
                                                        bucket="photography" path={`stories/${id}`} multiple={true} label="+"
                                                        className="stream-uploader-inner"
                                                        onUpload={handleGalleryUpload}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            </div>
                        )}

                        {/* =========================================
                            MODE: WRITING (BLOG) & RESEARCH EDITOR
                           ========================================= */}
                        {(!isFilms && !isPhotography) && (
                            <div className="editor-stack">
                                {/* SECTION 1: METADATA & COVER - SIDE BY SIDE or STACKED? User asked for Content Body BELOW cover image.
                                    Let's keep Metadata and Cover somewhat compact, maybe 2 columns for them, followed by full-width editor.
                                */}

                                <div className="meta-cover-row">
                                    {/* METADATA */}
                                    <div className="stack-section fit-content">
                                        <section className="card-section">
                                            <label className="section-label">Metadata</label>
                                            <div className="field-group">
                                                <label>Title</label>
                                                <input type="text" className="box-input large" placeholder="Article Title..." value={formData.title || ''} onChange={e => handleChange('title', e.target.value)} />
                                            </div>
                                            <div className="field-group">
                                                <label>Slug</label>
                                                <input type="text" className="box-input" value={formData.slug || ''} onChange={e => handleChange('slug', e.target.value)} onFocus={() => !formData.slug && formData.title && handleChange('slug', formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'))} placeholder="Auto-generate..." />
                                            </div>

                                            <div className="field-group full-width" style={{ marginTop: '1rem' }}>
                                                <label>Excerpt / Abstract</label>
                                                <textarea className="box-input" style={{ minHeight: '100px' }} value={formData.excerpt || ''} onChange={e => handleChange('excerpt', e.target.value)} />
                                            </div>

                                            {table === 'research' && (
                                                <>
                                                    <div className="meta-row" style={{ marginTop: '1rem' }}>
                                                        <div className="field-group">
                                                            <label>Project Link</label>
                                                            <input type="text" className="box-input" placeholder="https://..." value={formData.link || ''} onChange={e => handleChange('link', e.target.value)} />
                                                        </div>
                                                        <div className="field-group">
                                                            <label>Repo Link</label>
                                                            <input type="text" className="box-input" placeholder="GitHub..." value={formData.repo_link || ''} onChange={e => handleChange('repo_link', e.target.value)} />
                                                        </div>
                                                    </div>
                                                    <div className="field-group full-width" style={{ marginTop: '1rem' }}>
                                                        <label>Tags</label>
                                                        <input type="text" className="box-input" placeholder="AI, UI/UX..."
                                                            value={(formData.tags || []).join(', ')}
                                                            onChange={e => handleChange('tags', e.target.value.split(',').map(s => s.trim()))}
                                                        />
                                                    </div>
                                                </>
                                            )}
                                        </section>
                                    </div>

                                    {/* COVER IMAGE */}
                                    <div className="stack-section fit-content">
                                        <section className="card-section">
                                            <label className="section-label">Cover Image</label>
                                            {(formData.cover_image || formData.image) ? (
                                                <div className="cover-wrapper-small preview-active">
                                                    <div className="preview-fit">
                                                        <img src={formData.cover_image || formData.image} />
                                                        <button className="btn-mini-remove" onClick={() => handleChange(table === 'research' ? 'image' : 'cover_image', '')}>Replace</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <ImageUploader
                                                    bucket={table} path="covers" label="Upload Cover"
                                                    className="cover-uploader-box"
                                                    onUpload={f => handleChange(table === 'research' ? 'image' : 'cover_image', f[0].url)}
                                                />
                                            )}
                                        </section>
                                    </div>
                                </div>

                                {/* SECTION 2: CONTENT EDITOR - FULL WIDTH BELOW */}
                                <div className="stack-section full-editor">
                                    {/* WRITING AREA WITH INSERT TOOL */}
                                    <section className="card-section" style={{ position: 'relative', height: '100%' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <label className="section-label">Content Body (Markdown)</label>
                                            <div style={{ fontSize: '0.7rem', color: '#666' }}>
                                                Drop image below to insert →
                                            </div>
                                        </div>

                                        <div className="writing-container" style={{ display: 'flex', flexDirection: 'column', height: 'auto' }}>
                                            {/* TOP INLINE IMAGE INSERTER */}
                                            <div className="inserter-rail">
                                                <ImageUploader
                                                    bucket={table}
                                                    path="content-assets"
                                                    label="DRAG IMAGE HERE TO UPLOAD & INSERT"
                                                    className="rail-uploader"
                                                    onUpload={(files) => insertMarkdownImage(files[0].url)}
                                                />
                                            </div>

                                            <textarea
                                                className="box-input content-area"
                                                style={{ minHeight: '80vh', resize: 'vertical' }} /* Allow huge scrolling */
                                                value={formData.content || ''}
                                                onChange={e => handleChange('content', e.target.value)}
                                                placeholder="Write your article..."
                                                spellCheck="false"
                                            />
                                        </div>
                                    </section>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </main>

            {/* STYLES */}
            <style>{`
                :root {
                    --c-bg: #111; /* User requested strict background match with inputs */
                    --c-card-bg: #111;
                    --c-input-bg: #111;
                    --c-border: #333;
                    --c-text: #e5e5e5;
                    --c-text-dim: #666;
                    --font-mono: 'Menlo', 'Monaco', monospace;
                    --font-sans: 'Inter', system-ui, sans-serif;
                }

                /* FORCE GLOBAL OVERRIDE to kill black bars */
                body {
                    background-color: #111 !important;
                    margin: 0; padding: 0;
                }
                .admin-wrapper {
                    max-width: 100% !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    width: 100vw !important;
                }

                .cms-shell {
                    display: flex; height: 100vh;
                    width: 100vw; /* Force full viewport width */
                    background: var(--c-bg); color: var(--c-text);
                    font-family: var(--font-sans); overflow: hidden;
                }

                .cms-sidebar {
                    width: 250px; flex-shrink: 0;
                    border-right: 1px solid var(--c-border);
                    padding: 2rem; display: flex; flex-direction: column; gap: 2rem;
                    background: var(--c-bg); /* Ensure sidebar matches */
                }
                .brand a { color: var(--c-text-dim); text-decoration: none; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; }
                .meta-block label { display: block; font-size: 0.65rem; color: var(--c-text-dim); text-transform: uppercase; margin-bottom: 0.4rem; }
                .status-badge { display: inline-block; padding: 3px 6px; border-radius: 3px; font-size: 0.65rem; font-weight: 600; text-transform: uppercase; }
                .status-badge.live { background: #0f291e; color: #4ade80; border: 1px solid #14532d; }
                .status-badge.draft { background: #1a1a1a; color: #888; border: 1px solid #333; }
                .id-hash { font-family: var(--font-mono); font-size: 0.75rem; color: var(--c-text-dim); }

                .cms-main { flex: 1; display: flex; flex-direction: column; min-width: 0; position: relative; }

                .cms-actions {
                    height: 80px;
                    border-bottom: 1px solid var(--c-border);
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 0 3rem;
                    position: sticky; top: 0; z-index: 50; 
                    background: rgba(17, 17, 17, 0.9); /* Match BG */
                    backdrop-filter: blur(10px);
                }
                .context-title { 
                    font-family: var(--font-sans); font-size: 1.8rem; font-weight: 700; color: var(--c-text);
                    letter-spacing: -0.02em;
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 600px;
                }
                .context-title.placeholder { color: #333; }
                .btn-group { display: flex; gap: 0.8rem; align-items: center; }
                .btn { height: 36px; padding: 0 1.2rem; font-size: 0.8rem; font-weight: 500; cursor: pointer; border-radius: 4px; }
                .btn.sec { background: transparent; border: 1px solid var(--c-border); color: var(--c-text-dim); }
                .btn.sec:hover { border-color: var(--c-text); color: var(--c-text); }
                .btn.pri { background: var(--c-text); color: var(--c-bg); border: none; font-weight: 600; }
                .btn.pri:hover { background: #ccc; }

                /* CANVAS - FULL SCREEN */
                .cms-canvas {
                    flex: 1; overflow-y: auto; padding: 0; /* NO PADDING to hit edges */
                    display: flex; justify-content: center; align-items: flex-start;
                }

                .model-card {
                    width: 100%; max-width: none;
                    display: flex; flex-direction: column; gap: 2rem;
                    background: transparent; /* No box */
                    border: none; /* No border */
                    padding: 3rem 4rem; /* Padding for content breathing room */
                    min-height: auto;
                    box-shadow: none;
                }

                /* SPLIT GRID LAYOUT */
                .editor-grid {
                    display: grid; grid-template-columns: 450px 1fr; /* Fixed Left Sidebar, Fluid Right */
                    gap: 5rem; /* Wide gap */
                    align-items: start;
                }
                .editor-col-left { display: flex; flex-direction: column; gap: 2.5rem; }
                .editor-col-right { display: flex; flex-direction: column; gap: 2.5rem; min-width: 0; height: 100%; }

                /* STACKED LAYOUT (For Blog/Research) */
                .editor-stack {
                    display: flex; flex-direction: column; gap: 3rem;
                    max-width: 1600px; /* FULL WIDE as requested */
                    margin: 0 auto; 
                    width: 100%;
                }
                /* VERTICAL STACK for top section */
                .meta-cover-row {
                    display: flex; flex-direction: column; gap: 3rem;
                    width: 100%;
                }
                
                .meta-row { display: flex; gap: 1rem; }
                .meta-row .field-group { flex: 1; }

                .card-section { display: flex; flex-direction: column; gap: 1rem; }
                .section-label { 
                    font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; 
                    color: #555; font-weight: 600; padding-bottom: 0.5rem; border-bottom: 1px solid #222; margin-bottom: 0.5rem;
                }

                .field-group { display: flex; flex-direction: column; gap: 0.5rem; }
                .field-group label { font-size: 0.65rem; color: var(--c-text-dim); text-transform: uppercase; }

                .box-input {
                    background: var(--c-input-bg); border: 1px solid var(--c-border);
                    border-radius: 3px; padding: 0.8rem 1rem; color: var(--c-text);
                    font-size: 0.9rem; width: 100%; outline: none; transition: 0.1s;
                }
                .box-input:focus { border-color: #555; background: #1a1a1a; }
                .box-input.large { font-size: 1.2rem; padding: 1rem; border-color: #444; }
                .box-input.content-area { min-height: 400px; line-height: 1.6; font-size: 1rem; font-family: var(--font-mono); }
                .box-input.content-area-compact { min-height: 150px; line-height: 1.6; font-size: 0.9rem; font-family: var(--font-mono); }

                .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
                .full-width { grid-column: span 2; }

                /* UPLOADERS - Clean Unification */
                .cover-uploader-box {
                    width: 100% !important; /* Adjust width as needed, stacking now */
                    aspect-ratio: 21/9; /* WIDER aspect ratio for full width cover feel */
                    background: var(--c-input-bg);
                    border: 1px solid var(--c-border) !important;
                    border-radius: 4px;
                    padding: 0 !important;
                    min-height: 0 !important;
                    position: relative;
                }
                .cover-uploader-box:hover { border-color: #555 !important; }
                .cover-uploader-box .empty-state { padding: 0 !important; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 10px; }
                .cover-uploader-box .icon { display: none; } /* Hide default cloud icon */
                .cover-uploader-box p { font-size: 0.75rem; color: #666; margin: 0; text-transform: uppercase; letter-spacing: 0.05em; }
                
                /* The + Button - FIXED: Removed shadows/borders to prevent circle artifacts */
                .cover-uploader-box .btn-upload { 
                    display: flex !important; align-items: center; justify-content: center;
                    width: 40px; height: 40px; border-radius: 50% !important;
                    background: #222 !important; border: 1px solid #333 !important; color: #fff;
                    font-size: 1.5rem; line-height: 1; cursor: pointer; padding: 0 !important;
                    transition: 0.2s; box-shadow: none !important;
                }
                .cover-uploader-box .btn-upload:hover { background: #333 !important; border-color: #555 !important; }
                
                /* When preview is live */
                .cover-wrapper-small.preview-active {
                    width: 100%; 
                    aspect-ratio: 21/9; /* Match uploader */
                    background: var(--c-input-bg); border: 1px solid var(--c-border);
                    border-radius: 4px; overflow: hidden; position: relative;
                }

                .preview-fit { width: 100%; height: 100%; position: relative; }
                .preview-fit img, .preview-fit iframe { width: 100%; height: 100%; object-fit: cover; }
                .btn-mini-remove {
                    position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.8); color: white;
                    border: none; width: 24px; height: 24px; border-radius: 50%; 
                    font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center;
                }
                .btn-mini-remove::after { content: "×"; }

                /* MEDIA ROW (Films) - STACKED NOW */
                .media-stack { display: flex; flex-direction: column; gap: 1.5rem; }
                .media-col { display: flex; flex-direction: column; gap: 0.5rem; }
                
                .fixed-uploader {
                    width: 100%; aspect-ratio: 16/9;
                    background: var(--c-input-bg); border: 1px solid var(--c-border);
                    border-radius: 4px; overflow: hidden; position: relative;
                }

                /* GALLERY */
                .gallery-container.large {
                    background: var(--c-input-bg); border: 1px solid var(--c-border);
                    border-radius: 4px; padding: 1.5rem; min-height: 200px;
                }
                .gallery-stream { display: flex; flex-wrap: wrap; gap: 0.8rem; }
                .stream-item {
                    width: 100px; height: 100px; position: relative; border-radius: 3px; overflow: hidden;
                    border: 1px solid var(--c-border);
                }
                .stream-item img { width: 100%; height: 100%; object-fit: cover; }
                .item-overlay {
                    position: absolute; inset: 0; background: rgba(0,0,0,0.5); opacity: 0;
                    display: flex; align-items: center; justify-content: center; transition: 0.1s;
                }
                .stream-item:hover .item-overlay { opacity: 1; }
                .item-overlay button {
                    background: #ff4444; color: white; border: none; width: 22px; height: 22px; border-radius: 50%;
                    cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center;
                }
                
                /* Stream Uploader Tile */
                .stream-action-tile { width: 100px; height: 100px; }
                .stream-uploader-inner {
                    width: 100%; height: 100%;
                    border: 1px dashed var(--c-border) !important;
                    border-radius: 3px; background: #111;
                    padding: 0 !important; min-height: 0 !important;
                    display: flex; align-items: center; justify-content: center;
                }
                .stream-uploader-inner:hover { border-color: #666 !important; background: #1a1a1a; }
                .stream-uploader-inner .empty-state { padding: 0 !important; }
                .stream-uploader-inner .icon { display: none; }
                .stream-uploader-inner p { font-size: 2rem; color: #444; display: block; margin: 0; line-height: 1; }
                .stream-uploader-inner .btn-upload { display: none; }


                /* WRITING INSERTER RAIL - TOP BAR NOW */
                .inserter-rail {
                    display: block; width: 100%;
                    margin-bottom: 2rem; /* Spacing below the dropper */
                }
                .rail-uploader {
                    width: 100%; height: 120px; /* Horizontal strip */
                    border: 1px dashed var(--c-border) !important;
                    border-radius: 4px; background: transparent;
                    padding: 0 !important; min-height: 0 !important;
                    display: flex; align-items: center; justify-content: center;
                    transition: all 0.2s;
                }
                .rail-uploader:hover { border-color: #888 !important; background: #1a1a1a; }
                .rail-uploader .empty-state { padding: 0 !important; }
                .rail-uploader .icon { display: none; }
                .rail-uploader .btn-upload { display: none; }
                .rail-uploader .plus-label { font-size: 2rem; color: #444; }

                .loading-screen {
                    height: 100vh; display: flex; align-items: center; justify-content: center;
                    color: #666; font-family: var(--font-sans); background: #111;
                }

                .toast {
                    position: fixed; bottom: 2rem; right: 2rem; padding: 0.7rem 1.2rem;
                    border-radius: 4px; color: white; font-size: 0.8rem; z-index: 100; font-weight: 500;
                }
                .toast.success { background: #1a4d2e; border: 1px solid #14532d; }
                .toast.error { background: #7f1d1d; border: 1px solid #7f1d1d; }

                /* Hide Number Spinners */
                input[type=number]::-webkit-inner-spin-button, 
                input[type=number]::-webkit-outer-spin-button { 
                  -webkit-appearance: none; 
                  margin: 0; 
                }
                input[type=number] { -moz-appearance: textfield; }

            `}</style>
        </div>
    );
}
