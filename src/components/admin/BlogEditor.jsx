import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import BlogBlockEditor from './BlogBlockEditor';
import ImageUploader from './ImageUploader';

export default function BlogEditor({ id }) {
    const isNew = id === 'new' || !id;
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({ 
        title: '', 
        slug: '', 
        excerpt: '', 
        tags: [], 
        cover_image: '', 
        published: false,
        blocks: []
    });
    const [notification, setNotification] = useState(null);

    useEffect(() => {
        if (!isNew && id) fetchData();
    }, [id]);

    const fetchData = async () => {
        const { data, error } = await supabase.from('blog').select('*').eq('id', id).single();
        if (data) {
            setFormData({
                ...data,
                blocks: Array.isArray(data.blocks) ? data.blocks : []
            });
        }
        if (error) notify('error', 'Error loading blog post');
        setLoading(false);
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async (publishStatus = null) => {
        setSaving(true);
        const payload = { ...formData };

        if (!payload.slug && payload.title) {
            payload.slug = payload.title.toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '-');
        }

        if (publishStatus !== null) {
            payload.published = publishStatus;
            if (payload.published && !payload.published_at) {
                payload.published_at = new Date().toISOString();
            }
        }

        const query = isNew
            ? supabase.from('blog').insert([payload]).select()
            : supabase.from('blog').update(payload).eq('id', id);

        const { data, error } = await query;

        if (error) {
            notify('error', error.message);
        } else {
            const msg = publishStatus === true ? 'Published Live 🟢' : 'Draft Saved 💾';
            notify('success', msg);
            if (isNew && data && data.length > 0) {
                window.location.href = `/admin/editor?table=blog&id=${data[0].id}`;
            } else if (!isNew) {
                setFormData(prev => ({ ...prev, ...payload, published: publishStatus !== null ? publishStatus : prev.published }));
            }
        }
        setSaving(false);
    };

    const notify = (type, msg) => {
        setNotification({ type, msg });
        setTimeout(() => setNotification(null), 3000);
    };

    if (loading) return <div className="loading-screen">Loading Record...</div>;

    return (
        <div className="cms-shell">
            <aside className="cms-sidebar">
                <div className="brand">
                    <a href="/admin/dashboard?section=blog">← Back to Blog List</a>
                </div>
                <div className="meta-block">
                    <label>Content Type</label>
                    <div className="id-hash">BLOG</div>
                </div>
                <div className="meta-block">
                    <label>Status</label>
                    <div className={`status-badge ${formData.published ? 'live' : 'draft'}`}>
                        {formData.published ? 'Live' : 'Draft'}
                    </div>
                </div>
                {!isNew && (
                    <div className="meta-block">
                        <label>Reference ID</label>
                        <div className="id-hash">{id.split('-')[0]}...</div>
                    </div>
                )}
            </aside>

            <main className="cms-main">
                <header className="cms-actions">
                    <div className={`context-title ${(!formData.title) ? 'placeholder' : ''}`}>
                        {formData.title || 'Untitled Post'}
                    </div>
                    <div className="btn-group">
                        <button className="btn sec" onClick={() => handleSave(false)} disabled={saving}>Save Draft</button>
                        <button className="btn pri" onClick={() => handleSave(true)} disabled={saving}>{formData.published ? 'Update Live' : 'Publish'}</button>
                    </div>
                </header>

                <div className="cms-canvas">
                    {notification && (
                        <div className={`toast ${notification.type}`}>{notification.msg}</div>
                    )}

                    <div className="model-card">
                        <div className="editor-stack">
                            {/* METADATA ROW */}
                            <div className="meta-cover-row">
                                <div className="stack-section fit-content" style={{ flex: 2 }}>
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
                                            <textarea className="box-input" style={{ minHeight: '80px' }} value={formData.excerpt || ''} onChange={e => handleChange('excerpt', e.target.value)} />
                                        </div>
                                        <div className="field-group full-width" style={{ marginTop: '1rem' }}>
                                            <label>Tags (Comma separated)</label>
                                            <input type="text" className="box-input" placeholder="AI, Writing, Technology..."
                                                value={(formData.tags || []).join(', ')}
                                                onChange={e => handleChange('tags', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                            />
                                        </div>
                                    </section>
                                </div>

                                <div className="stack-section fit-content" style={{ flex: 1 }}>
                                    <section className="card-section">
                                        <label className="section-label">Cover Image</label>
                                        {formData.cover_image ? (
                                            <div className="cover-wrapper-small preview-active">
                                                <div className="preview-fit">
                                                    <img src={formData.cover_image} alt="Cover" />
                                                    <button className="btn-mini-remove" onClick={() => handleChange('cover_image', '')}>Replace</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <ImageUploader
                                                bucket="blog" path="covers" label="Upload Cover"
                                                className="cover-uploader-box"
                                                onUpload={f => handleChange('cover_image', f[0].url)}
                                            />
                                        )}
                                    </section>
                                </div>
                            </div>

                            {/* BLOCK EDITOR ROW */}
                            <div className="stack-section full-editor">
                                <section className="card-section">
                                    <label className="section-label">Article Content (Blocks)</label>
                                    <BlogBlockEditor 
                                        blocks={formData.blocks || []} 
                                        onChange={blocks => handleChange('blocks', blocks)} 
                                    />
                                </section>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* STYLES REUSED FROM CONTENT_EDITOR + NEWSLETTER_BLOCK_EDITOR */}
            <style>{`
                /* Themes - Variables mapped for component specifics */
                .cms-shell {
                    display: flex; height: 100vh;
                    width: 100%;
                    background: var(--bg-color); color: var(--text-primary);
                    font-family: var(--font-sans); overflow: hidden;
                    position: fixed; top: 0; left: 0; bottom: 0; right: 0;
                }

                .cms-sidebar {
                    width: 250px; flex-shrink: 0;
                    border-right: 1px solid var(--border-subtle);
                    padding: 2rem; display: flex; flex-direction: column; gap: 2rem;
                    background: var(--bg-surface);
                    padding-top: 4rem;
                }
                .brand a { color: var(--text-secondary); text-decoration: none; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500; }
                .brand a:hover { color: var(--text-primary); }
                .meta-block label { display: block; font-size: 0.65rem; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 0.4rem; font-weight: 600; letter-spacing: 0.1em; }
                .status-badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
                .status-badge.live { background: rgba(16, 185, 129, 0.1); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.2); }
                .status-badge.draft { background: var(--bg-surface-hover); color: var(--text-secondary); border: 1px solid var(--border-strong); }
                .id-hash { font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-secondary); opacity: 0.7; }

                .cms-main { flex: 1; display: flex; flex-direction: column; min-width: 0; position: relative; background: var(--bg-color); }

                .cms-actions {
                    height: 80px;
                    border-bottom: 1px solid var(--border-subtle);
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 0 3rem;
                    position: sticky; top: 0; z-index: 50; 
                    background: var(--bg-color); 
                }
                .context-title { 
                    font-family: var(--font-sans); font-size: 1.5rem; font-weight: 600; color: var(--text-primary);
                    letter-spacing: -0.01em;
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 600px;
                }
                .context-title.placeholder { color: var(--text-tertiary); font-weight: 400; font-style: italic; }
                .btn-group { display: flex; gap: 0.8rem; align-items: center; }
                .btn { height: 40px; padding: 0 1.5rem; font-size: 0.875rem; font-weight: 500; cursor: pointer; border-radius: 6px; transition: all 0.2s; }
                .btn.sec { background: transparent; border: 1px solid var(--border-subtle); color: var(--text-secondary); }
                .btn.sec:hover { border-color: var(--text-primary); color: var(--text-primary); background: var(--bg-surface); }
                .btn.pri { background: var(--text-primary); color: var(--bg-color); border: none; font-weight: 600; }
                .btn.pri:hover { opacity: 0.9; transform: translateY(-1px); }

                .cms-canvas {
                    flex: 1; overflow-y: auto; padding: 0;
                    display: flex; justify-content: center; align-items: flex-start;
                }

                .model-card {
                    width: 100%; max-width: none;
                    display: flex; flex-direction: column; gap: 2rem;
                    padding: 3rem;
                }

                .editor-stack { display: flex; flex-direction: column; gap: 2rem; }
                .meta-cover-row { display: flex; gap: 2rem; align-items: stretch; flex-wrap: wrap; }
                .stack-section { min-width: 300px; }
                .full-editor { flex: 1 1 100%; }

                .card-section {
                    background: var(--bg-surface); border: 1px solid var(--border-subtle);
                    border-radius: 12px; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;
                    height: 100%;
                }
                .section-label { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary); padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-subtle); margin-bottom: 0.5rem; }

                .field-group { display: flex; flex-direction: column; gap: 0.4rem; }
                .field-group label { font-size: 0.8rem; font-weight: 500; color: var(--text-secondary); }
                .box-input {
                    background: var(--bg-color); border: 1px solid var(--border-strong);
                    padding: 0.6rem 0.8rem; border-radius: 6px; font-family: inherit; font-size: 0.9rem; color: var(--text-primary);
                    transition: border-color 0.2s; outline: none;
                }
                .box-input:focus { border-color: var(--text-primary); }
                .box-input.large { font-size: 1.25rem; font-weight: 500; padding: 0.8rem 1rem; }

                .cover-wrapper-small { width: 100%; aspect-ratio: 16/9; border-radius: 8px; overflow: hidden; position: relative; background: #000; }
                .preview-fit { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; position: relative; }
                .preview-fit img { width: 100%; height: 100%; object-fit: cover; }
                .btn-mini-remove { position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; cursor: pointer; backdrop-filter: blur(4px); }

                .toast {
                    position: fixed; bottom: 2rem; right: 2rem; padding: 1rem 1.5rem;
                    border-radius: 8px; font-weight: 500; font-size: 0.9rem; z-index: 1000;
                    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                }
                .toast.success { background: #10B981; color: white; }
                .toast.error { background: #EF4444; color: white; }

                @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

                /* Designer Toolbar */
                .newsletter-designer { display: flex; flex-direction: column; gap: 1rem; }
                .designer-toolbar {
                    background: var(--bg-color); border: 1px solid var(--border-subtle);
                    padding: 0.75rem 1rem; border-radius: 8px; position: sticky; top: 0; z-index: 10;
                }
                .block-palette { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
                .block-palette strong { font-size: 0.8rem; color: var(--text-tertiary); text-transform: uppercase; margin-right: 0.5rem; }
                .block-palette button {
                    background: var(--bg-surface); border: 1px solid var(--border-strong);
                    padding: 0.4rem 0.75rem; border-radius: 6px; font-size: 0.75rem; color: var(--text-secondary);
                    cursor: pointer; transition: all 0.2s;
                }
                .block-palette button:hover { background: var(--text-primary); color: var(--bg-color); border-color: var(--text-primary); }

                /* Sortable Blocks */
                .designer-canvas { background: var(--bg-color); border: 1px dashed var(--border-strong); border-radius: 12px; padding: 2rem; min-height: 400px; }
                .block-list { display: flex; flex-direction: column; gap: 1rem; }
                .empty-canvas-message { text-align: center; color: var(--text-tertiary); padding: 4rem 0; font-size: 0.9rem; font-style: italic; }

                .newsletter-block-card {
                    background: var(--bg-surface); border: 1px solid var(--border-strong);
                    border-radius: 8px; display: flex; overflow: hidden;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.02);
                }
                .block-drag-handle {
                    background: var(--bg-color); border-right: 1px solid var(--border-strong);
                    padding: 1rem 0.5rem; display: flex; align-items: center; justify-content: center;
                    color: var(--text-tertiary); cursor: grab; font-size: 1.2rem; line-height: 1; user-select: none;
                }
                .block-drag-handle:active { cursor: grabbing; }
                
                .block-content { flex: 1; display: flex; flex-direction: column; }
                .block-header {
                    padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-subtle);
                    display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.02);
                }
                .block-header strong { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); }
                .block-actions { display: flex; gap: 0.5rem; }
                .block-actions button {
                    background: transparent; border: none; color: var(--text-tertiary);
                    cursor: pointer; font-size: 1rem; padding: 2px 6px; border-radius: 4px;
                }
                .block-actions button:hover { background: var(--bg-color); color: var(--text-primary); }
                .block-actions button.danger:hover { color: #EF4444; }

                .block-fields { padding: 1rem; display: flex; flex-direction: column; gap: 1rem; }
                .compact-field span { font-size: 0.75rem; color: var(--text-tertiary); }
                .control-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
                
                .image-source-actions { display: flex; gap: 1rem; align-items: flex-end; }
                .block-image-reference { max-height: 200px; width: 100%; object-fit: contain; background: var(--bg-color); border: 1px solid var(--border-subtle); border-radius: 6px; margin-bottom: 0.5rem; }
            `}</style>
        </div>
    );
}
