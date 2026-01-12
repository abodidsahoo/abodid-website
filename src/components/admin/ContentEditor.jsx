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
    const isPhotography = table === 'photography';
    const isFilms = table === 'films';
    const hasVisuals = isPhotography || table === 'blog' || table === 'research' || isFilms;

    // Fields
    const SCHEMAS = {
        blog: ['title', 'slug', 'excerpt', 'content', 'cover_image', 'published_at', 'published'],
        research: ['title', 'slug', 'description', 'content', 'link', 'repo_link', 'tags', 'image', 'sort_order', 'published'],
        photography: ['title', 'slug', 'intro', 'content', 'category', 'cover_image', 'published'],
        films: ['title', 'year', 'description', 'video_url', 'thumbnail_url', 'role', 'genre', 'published']
    };
    const fields = SCHEMAS[table] || [];

    // Film Specific State
    const [thumbMode, setThumbMode] = useState('upload'); // 'upload' | 'url'

    useEffect(() => {
        if (!isNew) fetchData();
    }, [id]);

    const fetchData = async () => {
        const { data } = await supabase.from(table).select('*').eq('id', id).single();
        if (data) setFormData(data);
        setLoading(false);
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

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

    // Helper: Video Embed Parser
    const getVideoEmbed = (url) => {
        if (!url) return null;
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const id = url.split('v=')[1]?.split('&')[0] || url.split('/').pop();
            return `https://www.youtube.com/embed/${id}`;
        }
        if (url.includes('vimeo.com')) {
            const id = url.split('/').pop();
            return `https://player.vimeo.com/video/${id}`;
        }
        return null; // Fallback or raw video link
    };

    const appendToContent = (text) => {
        handleChange('content', (formData.content || '') + text);
    };

    const handleImageBatch = (files, label) => {
        if (!files.length) return;
        const markdown = files.map(f => `\n![${f.name}](${f.url})`).join('');
        const section = `\n\n<!-- ${label} -->${markdown}\n`;
        appendToContent(section);
        setNotification({ type: 'success', msg: `Added ${files.length} images from ${label}!` });
        setTimeout(() => setNotification(null), 2000);
    };

    // Gallery State (for Photography)
    const [gallery, setGallery] = useState([]);

    useEffect(() => {
        if (!isNew && isPhotography) fetchGallery();
    }, [id, isPhotography]);

    const fetchGallery = async () => {
        const { data } = await supabase.from('photos').select('*').eq('story_id', id).order('sort_order');
        if (data) setGallery(data);
    };

    const handleGalleryUpload = async (newUploads) => {
        const newRecords = newUploads.map((u, i) => ({
            story_id: id,
            url: u.url,
            caption: u.name,
            sort_order: gallery.length + i,
            is_vertical: false
        }));

        const { error } = await supabase.from('photos').insert(newRecords);
        if (error) {
            setNotification({ type: 'error', msg: 'Failed to link photos: ' + error.message });
        } else {
            setNotification({ type: 'success', msg: 'Gallery updated!' });
            fetchGallery();
        }
    };

    const handleDeletePhoto = async (photoId) => {
        const { error } = await supabase.from('photos').delete().eq('id', photoId);
        if (!error) fetchGallery();
    };

    if (loading) return <div className="loading">Loading Studio...</div>;

    const contentField = fields.includes('content') ? 'content' : fields.includes('description') ? 'description' : null;
    const introField = fields.includes('intro') ? 'intro' : null;

    return (
        <div className="studio-layout">
            {/* ZONE A: HEADER & ACTIONS */}
            <header className="studio-topbar">
                <div className="breadcrumb">
                    <a href="/admin/dashboard">Dashboard</a> / <span className="current">{isNew ? 'New' : 'Edit'} {table}</span>
                </div>
                <div className="actions">
                    <button onClick={() => handleSave()} disabled={saving} className={`btn-save ${saving ? 'saving' : ''}`}>
                        {saving ? 'Publish Changes' : 'Publish Changes'}
                    </button>
                </div>
            </header>

            {notification && (
                <div className={`notification ${notification.type}`}>
                    {notification.msg}
                </div>
            )}

            <div className="studio-grid">

                {/* ZONE B: VISUAL ASSETS (Left Panel) */}
                {hasVisuals && (
                    <div className="visual-tray">

                        {/* --- FILM SPECIFIC UI --- */}
                        {isFilms && (
                            <>
                                {/* 1. Video Input & Preview */}
                                <div className="tray-section">
                                    <h4>Primary Video</h4>
                                    <input
                                        type="text"
                                        className="std-input"
                                        placeholder="Paste YouTube or Vimeo URL..."
                                        value={formData.video_url || ''}
                                        onChange={e => handleChange('video_url', e.target.value)}
                                    />
                                    {formData.video_url && (
                                        <div className="video-preview-box">
                                            {getVideoEmbed(formData.video_url) ? (
                                                <iframe src={getVideoEmbed(formData.video_url)} frameBorder="0" allowFullScreen></iframe>
                                            ) : (
                                                <div className="vid-placeholder">Invalid Video URL</div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* 2. Thumbnail (Dual Mode) */}
                                <div className="tray-section">
                                    <div className="section-head">
                                        <h4>Thumbnail</h4>
                                        <div className="mode-toggle">
                                            <span onClick={() => setThumbMode('upload')} className={thumbMode === 'upload' ? 'active' : ''}>Upload</span>
                                            <span onClick={() => setThumbMode('url')} className={thumbMode === 'url' ? 'active' : ''}>URL</span>
                                        </div>
                                    </div>

                                    {thumbMode === 'upload' ? (
                                        <div className="cover-slot">
                                            {formData.thumbnail_url ? (
                                                <div className="cover-preview" onClick={() => handleChange('thumbnail_url', '')}>
                                                    <img src={formData.thumbnail_url} alt="Thumb" />
                                                    <div className="overlay">Remove</div>
                                                </div>
                                            ) : (
                                                <ImageUploader
                                                    bucket="films"
                                                    path="thumbnails"
                                                    label="Upload Thumbnail"
                                                    onUpload={(files) => handleChange('thumbnail_url', files[0].url)}
                                                />
                                            )}
                                        </div>
                                    ) : (
                                        <div className="url-input-mode">
                                            <input
                                                type="text"
                                                className="std-input"
                                                placeholder="https://example.com/image.jpg"
                                                value={formData.thumbnail_url || ''}
                                                onChange={e => handleChange('thumbnail_url', e.target.value)}
                                            />
                                            {formData.thumbnail_url && (
                                                <div className="mini-preview">
                                                    <img src={formData.thumbnail_url} alt="Preview" />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}


                        {/* --- STANDARD COVER IMAGE (Non-Films) --- */}
                        {!isFilms && (
                            <div className="tray-section">
                                <h4>Cover Image</h4>
                                <div className="cover-slot">
                                    {formData.cover_image || (table === 'research' && formData.image) ? (
                                        <div className="cover-preview" onClick={() => handleChange(table === 'research' ? 'image' : 'cover_image', '')}>
                                            <img src={formData.cover_image || formData.image} alt="Cover" />
                                            <div className="overlay">Remove</div>
                                        </div>
                                    ) : (
                                        <ImageUploader
                                            bucket={table}
                                            path={`${table}/covers`}
                                            label="Upload Cover"
                                            onUpload={(files) => handleChange(table === 'research' ? 'image' : 'cover_image', files[0].url)}
                                        />
                                    )}
                                </div>
                            </div>
                        )}

                        {/* GALLERY MANAGER (Photography) */}
                        {isPhotography && (
                            <div className="tray-section">
                                <h4>Gallery Photos</h4>
                                {!isNew ? (
                                    <div className="gallery-manager">
                                        <div className="gallery-grid">
                                            {gallery.map(photo => (
                                                <div key={photo.id} className="gallery-thumb">
                                                    <img src={photo.url} alt="Gallery" />
                                                    <button className="btn-del" onClick={() => handleDeletePhoto(photo.id)}>×</button>
                                                </div>
                                            ))}
                                        </div>
                                        <ImageUploader
                                            bucket="photography"
                                            path={`stories/${id}`}
                                            multiple={true}
                                            label="+ Add Photos"
                                            onUpload={handleGalleryUpload}
                                        />
                                    </div>
                                ) : (
                                    <div className="info-box">Save the story first to add gallery photos.</div>
                                )}
                            </div>
                        )}

                        {/* STACKS (Blog/Research) */}
                        {!isPhotography && !isFilms && (
                            <div className="tray-section">
                                <h4>Asset Stacks</h4>
                                <div className="stack-list">
                                    <StackBox label="Set 1" bucket={table} path={`${table}/set1`} onInsert={(files) => handleImageBatch(files, 'Set 1')} />
                                </div>
                            </div>
                        )}

                        {/* Metadata Form */}
                        <div className="tray-section">
                            <h4>Metadata</h4>
                            {fields
                                .filter(f => !['content', 'description', 'intro', 'cover_image', 'image', 'video_url', 'thumbnail_url'].includes(f))
                                .map(field => (
                                    <div key={field} className="mini-form-group">
                                        <label>
                                            {field === 'genre' ? 'Kind of Project' :
                                                field === 'role' ? 'My Role' :
                                                    field.replace('_', ' ')}
                                        </label>

                                        {field === 'published' ? (
                                            <div className="toggle-wrapper" onClick={() => handleChange(field, !formData[field])}>
                                                <div className={`toggle ${formData[field] ? 'on' : 'off'}`}></div>
                                                <span>{formData[field] ? 'Live' : 'Draft'}</span>
                                            </div>
                                        ) : (
                                            <input
                                                type="text"
                                                value={formData[field] || ''}
                                                onChange={e => handleChange(field, e.target.value)}
                                                placeholder="..."
                                            />
                                        )}
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                )}

                {/* ZONE C: MAIN EDITOR (Canvas) */}
                <div className="canvas-area">
                    <input
                        type="text"
                        className="canvas-title"
                        placeholder={isFilms ? "Film Title" : "Title"}
                        value={formData.title || ''}
                        onChange={e => handleChange('title', e.target.value)}
                    />

                    {introField && (
                        <textarea
                            className="canvas-intro"
                            placeholder="Write a short introduction..."
                            value={formData.intro || ''}
                            onChange={e => handleChange('intro', e.target.value)}
                        />
                    )}

                    {/* Editor for Text Content (or Description for Films) */}
                    {contentField && (
                        <>
                            {!isFilms && <Toolbar onInsert={appendToContent} />}
                            <textarea
                                className="canvas-editor"
                                value={formData[contentField] || ''}
                                onChange={e => handleChange(contentField, e.target.value)}
                                placeholder={isFilms ? "Write a brief description..." : "# Write your story here..."}
                                style={isFilms ? { minHeight: '200px', fontSize: '1rem' } : {}}
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
                    width: 380px;
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
                
                .std-input {
                    width: 100%; padding: 0.6rem; border: 1px solid var(--border-subtle);
                    border-radius: 4px; background: var(--bg-color); color: var(--text-primary);
                    font-size: 0.9rem;
                }
                
                .video-preview-box {
                    margin-top: 1rem; aspect-ratio: 16/9; background: black; border-radius: 4px; overflow: hidden;
                }
                .video-preview-box iframe { width: 100%; height: 100%; }
                .vid-placeholder { 
                    width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; 
                    color: #666; font-size: 0.8rem; 
                }

                .section-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
                .mode-toggle { display: flex; gap: 10px; font-size: 0.8rem; }
                .mode-toggle span { cursor: pointer; opacity: 0.5; border-bottom: 1px solid transparent; }
                .mode-toggle span.active { opacity: 1; border-bottom: 1px solid var(--text-primary); font-weight: 500; }

                .cover-preview {
                    aspect-ratio: 16/9; border-radius: 6px; overflow: hidden; position: relative; cursor: pointer;
                }
                .cover-preview img { width: 100%; height: 100%; object-fit: cover; }
                .cover-preview:hover .overlay { opacity: 1; }
                .overlay {
                    position: absolute; inset: 0; background: rgba(0,0,0,0.5); color: white;
                    display: flex; align-items: center; justify-content: center; opacity: 0; transition: 0.2s;
                }
                
                .mini-preview { margin-top: 0.5rem; width: 100px; height: 60px; border-radius: 4px; overflow: hidden; }
                .mini-preview img { width: 100%; height: 100%; object-fit: cover; }

                .gallery-grid {
                    display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-bottom: 1rem;
                }
                .gallery-thumb { position: relative; aspect-ratio: 1; }
                .gallery-thumb img { width: 100%; height: 100%; object-fit: cover; border-radius: 4px; }
                .btn-del {
                    position: absolute; top: 2px; right: 2px; width: 18px; height: 18px;
                    background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 50%;
                    font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center;
                }

                .stack-list { display: flex; flex-direction: column; gap: 1rem; }
                .info-box { font-size: 0.85rem; color: var(--text-secondary); font-style: italic; }

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
                    margin-bottom: 1rem; color: var(--text-primary);
                    outline: none;
                }
                .canvas-intro {
                    font-size: 1.25rem; border: none; background: transparent;
                    font-family: var(--font-serif); color: var(--text-secondary);
                    outline: none; resize: none; min-height: 80px; margin-bottom: 2rem;
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
