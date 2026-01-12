import React, { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function ImageUploader({ bucket = 'portfolio-assets', path, onUpload, multiple = false, label = "Drop images here" }) {
    const [uploading, setUploading] = useState(false);
    const [previews, setPreviews] = useState([]);

    const handleFiles = async (files) => {
        if (!files || files.length === 0) return;
        setUploading(true);

        const newUploads = [];
        const fileArray = Array.from(files);

        // 1. Create Local Previews immediately
        const localPreviews = fileArray.map(file => ({
            objUrl: URL.createObjectURL(file), // Immediate visual feedback
            name: file.name
        }));
        setPreviews(prev => multiple ? [...prev, ...localPreviews] : localPreviews);

        // 2. Upload to Supabase
        for (const file of fileArray) {
            const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '-')}`;
            const filePath = `${path}/${fileName}`;

            const { error } = await supabase.storage.from(bucket).upload(filePath, file);

            if (!error) {
                const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);
                newUploads.push({
                    url: publicUrl,
                    name: file.name,
                    isImage: file.type.startsWith('image/')
                });
            } else {
                console.error('Upload failed:', error);
            }
        }

        setUploading(false);
        if (onUpload) onUpload(newUploads);
    };

    const onDrop = (e) => {
        e.preventDefault();
        handleFiles(e.dataTransfer.files);
    };

    const onFileSelect = (e) => {
        handleFiles(e.target.files);
    };

    return (
        <div className={`uploader-container ${uploading ? 'uploading' : ''}`}
            onDragOver={e => e.preventDefault()}
            onDrop={onDrop}>

            {previews.length === 0 && (
                <div className="empty-state">
                    <span className="icon">☁️</span>
                    <p>{label}</p>
                    <input
                        type="file"
                        multiple={multiple}
                        onChange={onFileSelect}
                        style={{ display: 'none' }}
                        id={`file-${path}`}
                    />
                    <label htmlFor={`file-${path}`} className="btn-upload">Choose Files</label>
                </div>
            )}

            {previews.length > 0 && (
                <div className="preview-grid">
                    {previews.map((p, i) => (
                        <div key={i} className="preview-card">
                            <img src={p.objUrl} alt="Preview" />
                            {uploading && <div className="loader-overlay"></div>}
                        </div>
                    ))}
                    {multiple && (
                        <div className="add-more">
                            <input
                                type="file"
                                multiple
                                onChange={onFileSelect}
                                style={{ display: 'none' }}
                                id={`add-${path}`}
                            />
                            <label htmlFor={`add-${path}`}>+</label>
                        </div>
                    )}
                </div>
            )}

            <style>{`
                .uploader-container {
                    border: 2px dashed var(--border-subtle);
                    border-radius: 8px;
                    background: var(--bg-surface);
                    min-height: 150px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    transition: all 0.2s;
                    position: relative;
                }
                .uploader-container:hover {
                    border-color: var(--text-tertiary);
                    background: var(--bg-surface-hover);
                }
                .uploader-container.uploading {
                    opacity: 0.7;
                    pointer-events: none;
                }
                .empty-state {
                    text-align: center;
                    padding: 2rem;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 1rem;
                }
                .icon { font-size: 2rem; opacity: 0.5; }
                .btn-upload {
                    padding: 0.5rem 1rem;
                    background: var(--bg-color);
                    border: 1px solid var(--border-strong);
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.9rem;
                }
                .preview-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
                    gap: 0.5rem;
                    padding: 1rem;
                    width: 100%;
                }
                .preview-card {
                    aspect-ratio: 1;
                    border-radius: 4px;
                    overflow: hidden;
                    position: relative;
                    background: #000;
                }
                .preview-card img {
                    width: 100%; height: 100%; object-fit: cover; opacity: 0.8;
                }
                .add-more label {
                    display: flex; align-items: center; justify-content: center;
                    width: 100%; height: 100%;
                    font-size: 2rem; color: var(--text-tertiary);
                    cursor: pointer;
                    border: 1px dashed var(--border-subtle);
                    border-radius: 4px;
                }
                .add-more label:hover { color: var(--text-primary); border-color: var(--text-primary); }
            `}</style>
        </div>
    );
}
