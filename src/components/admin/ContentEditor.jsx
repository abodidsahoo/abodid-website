import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function ContentEditor({ table, id }) {
    const isNew = id === 'new';
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({});
    const [notification, setNotification] = useState(null);

    // Schema Definitions
    const SCHEMAS = {
        posts: ['title', 'slug', 'excerpt', 'content', 'published'],
        projects: ['title', 'slug', 'description', 'content', 'link', 'repo_link', 'published'],
        stories: ['title', 'slug', 'intro', 'category', 'cover_image', 'published'],
        films: ['title', 'year', 'description', 'video_url', 'thumbnail_url', 'role', 'published']
    };

    const fields = SCHEMAS[table] || [];

    useEffect(() => {
        if (!isNew) {
            fetchData();
        }
    }, [id]);

    const fetchData = async () => {
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .eq('id', id)
            .single();

        if (data) setFormData(data);
        setLoading(false);
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // Drag & Drop Image Handler for Markdown
    const handleDrop = async (e, field) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files.length === 0) return;

        const file = files[0];
        if (!file.type.startsWith('image/')) return;

        setNotification('Uploading image...');

        // Upload
        const fileName = `${Date.now()}-${file.name}`;
        const filePath = `${table}/${fileName}`; // e.g. posts/123.jpg

        const { data, error } = await supabase.storage
            .from('portfolio-assets')
            .upload(filePath, file);

        if (error) {
            setNotification(`Error: ${error.message}`);
            return;
        }

        // Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from('portfolio-assets')
            .getPublicUrl(filePath);

        // Insert into Markdown
        const markdownImage = `\n![${file.name}](${publicUrl})\n`;
        const check = formData[field] || '';

        // Attempt to insert at cursor? For now, append to end or replace if empty
        // To keep it simple: Append
        handleChange(field, check + markdownImage);
        setNotification('Image uploaded and inserted!');
        setTimeout(() => setNotification(null), 3000);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);

        // Validate Slug
        if (!formData.slug) {
            // Auto-generate slug from title if missing
            const slug = formData.title
                .toLowerCase()
                .replace(/[^\w ]+/g, '')
                .replace(/ +/g, '-');
            formData.slug = slug;
        }

        let result;
        if (isNew) {
            result = await supabase.from(table).insert([formData]).select();
        } else {
            result = await supabase.from(table).update(formData).eq('id', id);
        }

        const { error } = result;

        if (error) {
            setNotification(`Error: ${error.message}`);
        } else {
            setNotification('Saved successfully!');
            if (isNew && result.data) {
                // Redirect to edit mode to avoid duplicate inserts
                window.location.href = `/admin/editor?table=${table}&id=${result.data[0].id}`;
            }
        }
        setSaving(false);
        setTimeout(() => setNotification(null), 3000);
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="editor-container">
            <header className="editor-header">
                <h1>{isNew ? 'Create' : 'Edit'} {table.slice(0, -1)}</h1>
                <div className="actions">
                    <a href="/admin/dashboard" className="btn-cancel">Cancel</a>
                    <button onClick={handleSave} disabled={saving} className="btn-save">
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </header>

            {notification && <div className="notification">{notification}</div>}

            <form className="editor-form">
                {fields.map(field => (
                    <div key={field} className="form-group">
                        <label>{field.replace('_', ' ')}</label>

                        {field === 'content' || field === 'description' || field === 'intro' ? (
                            <div
                                className="textarea-wrapper"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => handleDrop(e, field)}
                            >
                                <textarea
                                    value={formData[field] || ''}
                                    onChange={e => handleChange(field, e.target.value)}
                                    rows={field === 'content' ? 20 : 4}
                                    placeholder={field === 'content' ? "Write your story here... (Drag & Drop images supported)" : ""}
                                />
                                <span className="hint">Markdown supported. Drag & Drop images here.</span>
                            </div>
                        ) : field === 'published' ? (
                            <div className="checkbox-wrapper">
                                <input
                                    type="checkbox"
                                    checked={formData[field] || false}
                                    onChange={e => handleChange(field, e.target.checked)}
                                />
                                <span>Live on Site</span>
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
            </form>

            <style>{`
        .editor-container { max-width: 800px; margin: 0 auto; padding-bottom: 4rem; }
        .editor-header {
            display: flex; justify-content: space-between; align-items: center;
            margin-bottom: 2rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 1rem;
        }
        .actions { display: flex; gap: 1rem; }
        .btn-save {
            background: var(--text-primary); color: var(--bg-color); border: none;
            padding: 0.75rem 1.5rem; border-radius: 4px; cursor: pointer; font-weight: 500;
        }
        .btn-cancel {
            padding: 0.75rem 1rem; color: var(--text-secondary); text-decoration: none;
        }
        .form-group { margin-bottom: 1.5rem; }
        label {
            display: block; margin-bottom: 0.5rem; text-transform: capitalize;
            color: var(--text-secondary); font-size: 0.9rem;
        }
        input[type="text"], textarea {
            width: 100%; padding: 0.75rem; border: 1px solid var(--border-subtle);
            background: var(--bg-surface); color: var(--text-primary); border-radius: 4px;
            font-family: inherit; font-size: 1rem; box-sizing: border-box;
        }
        .textarea-wrapper { position: relative; }
        .textarea-wrapper textarea { font-family: 'Menlo', 'Monaco', 'Courier New', monospace; line-height: 1.6; }
        .is-dragging { border: 2px dashed var(--text-primary); background: rgba(0,0,0,0.05); }
        .hint {
            display: block; font-size: 0.8rem; color: var(--text-tertiary); margin-top: 0.5rem; text-align: right;
        }
        .notification {
            position: fixed; bottom: 2rem; right: 2rem; background: var(--text-primary);
            color: var(--bg-color); padding: 1rem 2rem; border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1); animation: slideIn 0.3s ease;
        }
        @keyframes slideIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
        </div>
    );
}
