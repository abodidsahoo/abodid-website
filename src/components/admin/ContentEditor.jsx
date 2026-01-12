import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function ContentEditor({ table, id }) {
    const isNew = id === 'new';
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState(isNew ? { published: true } : {});
    const [notification, setNotification] = useState(null);

    const SCHEMAS = {
        posts: ['title', 'slug', 'excerpt', 'content', 'published'],
        projects: ['title', 'slug', 'description', 'content', 'link', 'repo_link', 'published'],
        stories: ['title', 'slug', 'intro', 'content', 'category', 'cover_image', 'published'],
        films: ['title', 'year', 'description', 'video_url', 'thumbnail_url', 'role', 'published']
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

    const handleDrop = async (e, field) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files.length === 0) return;
        const file = files[0];
        if (!file.type.startsWith('image/')) return;

        setNotification({ type: 'info', msg: 'Uploading image...' });

        const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
        const filePath = `${table}/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('portfolio-assets').upload(filePath, file);
        if (uploadError) {
            setNotification({ type: 'error', msg: uploadError.message });
            return;
        }

        const { data: { publicUrl } } = supabase.storage.from('portfolio-assets').getPublicUrl(filePath);

        // Smart Insert
        const markdownImage = `\n![${file.name}](${publicUrl})\n`;
        const textarea = document.getElementById(`field-${field}`);

        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = formData[field] || '';
            const newText = text.substring(0, start) + markdownImage + text.substring(end);
            handleChange(field, newText);
        } else {
            handleChange(field, (formData[field] || '') + markdownImage);
        }

        setNotification({ type: 'success', msg: 'Image inserted!' });
        setTimeout(() => setNotification(null), 3000);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);

        if (!formData.slug && fields.includes('slug')) {
            formData.slug = (formData.title || 'untitled').toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '-');
        }

        // Strict Filter: Only send fields that exist in the schema
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

    if (loading) return <div className="loading">Loading Editor...</div>;

    const contentField = fields.includes('content') ? 'content' : fields.includes('intro') ? 'intro' : null;
    const metaFields = fields.filter(f => f !== contentField);

    return (
        <div className="editor-layout">
            <header className="editor-topbar">
                <div className="breadcrumb">
                    <a href="/admin/dashboard">Dashboard</a> / <span className="current">{isNew ? 'New' : 'Edit'} {table}</span>
                </div>
                <div className="actions">
                    <button onClick={handleSave} disabled={saving} className={`btn-save ${saving ? 'saving' : ''}`}>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </header>

            {notification && (
                <div className={`notification ${notification.type}`}>
                    {notification.msg}
                </div>
            )}

            <div className="editor-grid">
                {/* Left Column: Metadata */}
                <div className="meta-pane">
                    <h3>Details</h3>
                    {metaFields.map(field => (
                        <div key={field} className="form-group">
                            <label>{field.replace('_', ' ')}</label>
                            {field === 'published' ? (
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={formData[field] || false}
                                        onChange={e => handleChange(field, e.target.checked)}
                                    />
                                    <span className="slider"></span>
                                    <span className="label-text">{formData[field] ? 'Public' : 'Draft'}</span>
                                </label>
                            ) : (
                                <input
                                    type="text"
                                    value={formData[field] || ''}
                                    onChange={e => handleChange(field, e.target.value)}
                                    placeholder={`Enter ${field}...`}
                                />
                            )}
                        </div>
                    ))}
                </div>

                {/* Right Column: Content Editor */}
                {contentField && (
                    <div className="content-pane">
                        <div
                            className="markdown-editor"
                            onDragOver={e => e.preventDefault()}
                            onDrop={e => handleDrop(e, contentField)}
                        >
                            <div className="editor-toolbar">
                                <span>Markdown Editor</span>
                                <span className="hint">Drag & Drop images anywhere to upload</span>
                            </div>
                            <textarea
                                id={`field-${contentField}`}
                                value={formData[contentField] || ''}
                                onChange={e => handleChange(contentField, e.target.value)}
                                placeholder="# Start writing your story..."
                            />
                        </div>
                    </div>
                )}
            </div>

            <style>{`
        .editor-layout { max-width: 1400px; margin: 0 auto; height: 90vh; display: flex; flex-direction: column; }
        .editor-topbar {
            display: flex; justify-content: space-between; align-items: center;
            padding: 1rem 2rem; border-bottom: 1px solid var(--border-subtle);
            background: var(--bg-color);
        }
        .breadcrumb a { color: var(--text-secondary); text-decoration: none; }
        .breadcrumb .current { color: var(--text-primary); font-weight: 500; }
        
        .btn-save {
            background: var(--text-primary); color: var(--bg-color); border: none;
            padding: 0.6rem 1.2rem; border-radius: 4px; font-weight: 500; cursor: pointer;
            transition: opacity 0.2s;
        }
        .btn-save:disabled { opacity: 0.7; }

        .editor-grid {
            display: grid; grid-template-columns: 350px 1fr; gap: 0; flex: 1; overflow: hidden;
        }
        
        .meta-pane {
            padding: 2rem; border-right: 1px solid var(--border-subtle);
            overflow-y: auto; background: var(--bg-surface);
        }
        .meta-pane h3 { margin-top: 0; font-size: 0.9rem; text-transform: uppercase; color: var(--text-tertiary); }
        
        .content-pane { display: flex; flex-direction: column; height: 100%; border-left: 1px solid var(--border-subtle); }
        .markdown-editor { display: flex; flex-direction: column; height: 100%; }
        
        .editor-toolbar {
            padding: 0.8rem 1.5rem; background: var(--bg-surface);
            border-bottom: 1px solid var(--border-subtle);
            display: flex; justify-content: space-between; color: var(--text-secondary); font-size: 0.85rem;
        }
        
        textarea {
            flex: 1; resize: none; border: none; padding: 2rem;
            background: var(--bg-color); color: var(--text-primary);
            font-family: 'Menlo', monospace; font-size: 1rem; line-height: 1.7;
            outline: none;
        }
        
        .form-group { margin-bottom: 1.5rem; }
        .form-group label { display: block; margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--text-secondary); text-transform: capitalize; }
        input[type="text"] {
            width: 100%; padding: 0.6rem; background: var(--bg-color);
            border: 1px solid var(--border-subtle); border-radius: 4px;
            color: var(--text-primary);
        }
        input[type="text"]:focus { border-color: var(--text-primary); outline: none; }

        .notification {
            position: fixed; top: 1rem; left: 50%; transform: translateX(-50%);
            padding: 0.8rem 1.5rem; border-radius: 30px; 
            font-size: 0.9rem; font-weight: 500; z-index: 100;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .notification.info { background: var(--text-primary); color: var(--bg-color); }
        .notification.success { background: #10B981; color: white; }
        .notification.error { background: #EF4444; color: white; }

        /* Toggle Switch */
        .toggle-switch { display: flex; align-items: center; position: relative; cursor: pointer; }
        .toggle-switch input { opacity: 0; width: 0; height: 0; }
        .slider {
            position: relative; display: inline-block; width: 40px; height: 20px;
            background-color: var(--bg-surface-hover); border-radius: 20px; transition: .4s;
            border: 1px solid var(--border-subtle);
        }
        .slider:before {
            position: absolute; content: ""; height: 14px; width: 14px;
            left: 3px; bottom: 2px; background-color: var(--text-tertiary);
            border-radius: 50%; transition: .4s;
        }
        input:checked + .slider { background-color: var(--text-primary); border-color: var(--text-primary); }
        input:checked + .slider:before { transform: translateX(20px); background-color: var(--bg-color); }
        .label-text { margin-left: 10px; font-size: 0.9rem; }
      `}</style>
        </div>
    );
}
