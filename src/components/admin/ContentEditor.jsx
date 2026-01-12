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

                        {/* --- COMMON: TITLE HEADER --- */}
                        <section className="card-section">
                            <label className="section-label">Essential Info</label>
                            <div className="field-group">
                                <label>Title</label>
                                <input
                                    type="text" className="box-input large" placeholder="Enter Title..."
                                    value={formData.title || ''} onChange={e => handleChange('title', e.target.value)}
                                />
                            </div>

                            {/* Slug Logic (Common) */}
                            {table !== 'films' && (
                                <div className="field-group">
                                    <label>Slug</label>
                                    <input
                                        type="text" className="box-input" value={formData.slug || ''}
                                        onChange={e => handleChange('slug', e.target.value)}
                                        onFocus={() => {
                                            if (!formData.slug && formData.title) {
                                                const s = formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                                                handleChange('slug', s);
                                            }
                                        }}
                                        placeholder="Click to auto-generate..."
                                    />
                                </div>
                            )}
                        </section>

                        {/* =========================================
                            MODE: FILM EDITOR
                           ========================================= */}
                        {isFilms && (
                            <>
                                <section className="card-section">
                                    <div className="field-group">
                                        <label>Year</label>
                                        <input type="number" className="box-input" value={formData.year || ''} onChange={e => handleChange('year', e.target.value)} />
                                    </div>
                                    <div className="field-group">
                                        <label>Genre</label>
                                        <input type="text" className="box-input" value={formData.genre || ''} onChange={e => handleChange('genre', e.target.value)} />
                                    </div>
                                    <div className="field-group full-width">
                                        <label>Role / Credit</label>
                                        <input type="text" className="box-input" value={formData.role || ''} onChange={e => handleChange('role', e.target.value)} placeholder="e.g. Director, Editor..." />
                                    </div>
                                </section>

                                <section className="card-section" style={{ marginBottom: '3rem' }}>
                                    <label className="section-label">Media Assets</label>
                                    <div className="media-stack">
                                        <div className="media-col">
                                            <label>Video URL (YouTube/Vimeo)</label>
                                            {formData.video_url && getVideoEmbed(formData.video_url) ? (
                                                <div className="fixed-uploader">
                                                    <div className="preview-fit">
                                                        <iframe src={getVideoEmbed(formData.video_url)} frameBorder="0" allowFullScreen></iframe>
                                                        <button className="btn-mini-remove" onClick={() => handleChange('video_url', '')}>Remove</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="field-group">
                                                    <input type="text" className="box-input" placeholder="Paste URL..." value={formData.video_url || ''} onChange={e => handleChange('video_url', e.target.value)} />
                                                </div>
                                            )}
                                        </div>
                                        <div className="media-col">
                                            <label>Thumbnail Poster</label>
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

                                <section className="card-section">
                                    <label className="section-label">Logline / Description</label>
                                    <textarea className="box-input content-area" style={{ minHeight: '200px' }} value={formData.description || ''} onChange={e => handleChange('description', e.target.value)} />
                                </section>
                            </>
                        )}

                        {/* =========================================
                            MODE: PHOTOGRAPHY EDITOR
                           ========================================= */}
                        {isPhotography && (
                            <>
                                <section className="card-section">
                                    <div className="meta-grid">
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

                                <section className="card-section">
                                    <label className="section-label">Story Text</label>
                                    <textarea className="box-input content-area" value={formData.content || ''} onChange={e => handleChange('content', e.target.value)} />
                                </section>
                            </>
                        )}

                        {/* =========================================
                            MODE: WRITING (BLOG) & RESEARCH EDITOR
                           ========================================= */}
                        {(!isFilms && !isPhotography) && (
                            <>
                                <section className="card-section">
                                    <div className="meta-grid">
                                        {table === 'research' && (
                                            <>
                                                <div className="field-group">
                                                    <label>Project Link</label>
                                                    <input type="text" className="box-input" placeholder="https://..." value={formData.link || ''} onChange={e => handleChange('link', e.target.value)} />
                                                </div>
                                                <div className="field-group">
                                                    <label>Repo Link</label>
                                                    <input type="text" className="box-input" placeholder="GitHub URL..." value={formData.repo_link || ''} onChange={e => handleChange('repo_link', e.target.value)} />
                                                </div>
                                                <div className="field-group full-width">
                                                    <label>Tags (Comma separated)</label>
                                                    <input type="text" className="box-input" placeholder="AI, UI/UX, Data..."
                                                        value={(formData.tags || []).join(', ')}
                                                        onChange={e => handleChange('tags', e.target.value.split(',').map(s => s.trim()))}
                                                    />
                                                </div>
                                            </>
                                        )}
                                        {table === 'blog' && (
                                            <div className="field-group full-width">
                                                <label>Excerpt</label>
                                                <input type="text" className="box-input" value={formData.excerpt || ''} onChange={e => handleChange('excerpt', e.target.value)} />
                                            </div>
                                        )}
                                    </div>
                                </section>

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

                                {/* WRITING AREA WITH INSERT TOOL */}
                                <section className="card-section" style={{ position: 'relative' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <label className="section-label">Content Body (Markdown)</label>
                                        <div style={{ fontSize: '0.7rem', color: '#666' }}>
                                            Drop image below to insert →
                                        </div>
                                    </div>

                                    <div className="writing-container" style={{ display: 'grid', gridTemplateColumns: '1fr 60px', gap: '1rem' }}>
                                        <textarea
                                            className="box-input content-area"
                                            value={formData.content || ''}
                                            onChange={e => handleChange('content', e.target.value)}
                                            placeholder="Write your article..."
                                        />

                                        {/* INLINE IMAGE INSERTER */}
                                        <div className="inserter-rail">
                                            <ImageUploader
                                                bucket={table}
                                                path="content-assets"
                                                label="IMG"
                                                className="rail-uploader"
                                                onUpload={(files) => insertMarkdownImage(files[0].url)}
                                            />
                                        </div>
                                    </div>
                                </section>
                            </>
                        )}

                    </div>
                </div>
            </main>

            {/* STYLES */}
            <style>{`
                :root {
                    --c-bg: #050505;
                    --c-card-bg: #111;
                    --c-input-bg: #111;
                    --c-border: #333;
                    --c-text: #e5e5e5;
                    --c-text-dim: #666;
                    --font-mono: 'Menlo', 'Monaco', monospace;
                    --font-sans: 'Inter', system-ui, sans-serif;
                }

                .cms-shell {
                    display: flex; height: 100vh;
                    background: var(--c-bg); color: var(--c-text);
                    font-family: var(--font-sans); overflow: hidden;
                }

                .cms-sidebar {
                    width: 250px; flex-shrink: 0;
                    border-right: 1px solid var(--c-border);
                    padding: 2rem; display: flex; flex-direction: column; gap: 2rem;
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
                    position: sticky; top: 0; z-index: 50; background: rgba(5,5,5,0.9); backdrop-filter: blur(10px);
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

                /* CANVAS */
                .cms-canvas {
                    flex: 1; overflow-y: auto; padding: 4rem 2rem;
                    display: flex; justify-content: center; align-items: flex-start;
                }

                .model-card {
                    width: 100%; max-width: 720px;
                    display: flex; flex-direction: column; gap: 3.5rem;
                }

                .card-section { display: flex; flex-direction: column; gap: 1rem; }
                .section-label { 
                    font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; 
                    color: #444; font-weight: 600; padding-bottom: 0.5rem; border-bottom: 1px solid #1a1a1a; margin-bottom: 0.5rem;
                }

                .field-group { display: flex; flex-direction: column; gap: 0.5rem; }
                .field-group label { font-size: 0.65rem; color: var(--c-text-dim); text-transform: uppercase; }

                .box-input {
                    background: var(--c-input-bg); border: 1px solid var(--c-border);
                    border-radius: 3px; padding: 0.8rem 1rem; color: var(--c-text);
                    font-size: 0.9rem; width: 100%; outline: none; transition: 0.1s;
                }
                .box-input:focus { border-color: #555; background: #161616; }
                .box-input.large { font-size: 1.2rem; padding: 1rem; border-color: #444; }
                .box-input.content-area { min-height: 400px; line-height: 1.6; font-size: 0.9rem; font-family: var(--font-mono); }

                .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
                .full-width { grid-column: span 2; }

                /* UPLOADERS - Clean Unification */
                /* 1. The Cover Uploader Box configuration */
                .cover-uploader-box {
                    width: 100% !important; max-width: 300px; /* Adjust width as needed, stacking now */
                    aspect-ratio: 16/9;
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
                
                /* The + Button */
                .cover-uploader-box .btn-upload { 
                    display: flex !important; align-items: center; justify-content: center;
                    width: 40px; height: 40px; border-radius: 50%;
                    background: #222; border: 1px solid #333; color: #fff;
                    font-size: 1.5rem; line-height: 1; cursor: pointer; padding: 0;
                    transition: 0.2s;
                }
                .cover-uploader-box .btn-upload:hover { background: #333; border-color: #555; }
                
                /* When preview is live */
                .cover-wrapper-small.preview-active {
                    width: 100%; max-width: 300px;
                    aspect-ratio: 16/9;
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
                .media-stack { display: flex; flex-direction: column; gap: 2rem; margin-top: 1rem; }
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


                /* WRITING INSERTER RAIL */
                .inserter-rail {
                    display: flex; flex-direction: column; gap: 10px;
                }
                .rail-uploader {
                    width: 60px; height: 60px; 
                    border: 1px dashed var(--c-border) !important;
                    border-radius: 4px; background: transparent;
                    padding: 0 !important; min-height: 0 !important;
                    display: flex; align-items: center; justify-content: center;
                }
                .rail-uploader:hover { border-color: #888 !important; background: #1a1a1a; }
                .rail-uploader .empty-state { padding: 0 !important; }
                .rail-uploader .icon { display: none; }
                .rail-uploader p { font-size: 0.7rem; color: #666; margin: 0; font-weight: 600; }
                .rail-uploader .btn-upload { display: none; }

                .loading-screen {
                    height: 100vh; display: flex; align-items: center; justify-content: center;
                    color: #666; font-family: var(--font-sans); background: #050505;
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

// Minimal placeholder for the ImageUploader if specific styling is needed externally
// But we assume the existing ImageUploader component works generally well.
