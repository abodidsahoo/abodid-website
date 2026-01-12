import React, { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function ImageUploader({ bucket = 'portfolio-assets', path, onUpload, multiple = false, label = "Drop images here", className = '', style = {} }) {
    const [uploading, setUploading] = useState(false);
    const [previews, setPreviews] = useState([]);

    const handleFiles = async (files) => {
        if (!files || files.length === 0) return;
        setUploading(true);

        const newUploads = [];

        try {
            for (const file of files) {
                // Create preview
                const objUrl = URL.createObjectURL(file);

                // Upload to Supabase
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
                const filePath = `${path ? path + '/' : ''}${fileName}`;

                const { data, error } = await supabase.storage
                    .from(bucket)
                    .upload(filePath, file);

                if (error) throw error;

                // Get Public URL
                const { data: { publicUrl } } = supabase.storage
                    .from(bucket)
                    .getPublicUrl(filePath);

                newUploads.push({
                    url: publicUrl,
                    objUrl: objUrl,
                    name: file.name
                });
            }

            setPreviews(prev => multiple ? [...prev, ...newUploads] : newUploads);
            if (onUpload) onUpload(newUploads);

        } catch (error) {
            console.error('Upload failed:', error);
            alert('Upload failed: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const onDrop = useCallback(e => {
        e.preventDefault();
        e.stopPropagation();
        const files = Array.from(e.dataTransfer.files);
        handleFiles(files);
    }, [path, bucket]);

    const onFileSelect = (e) => {
        const files = Array.from(e.target.files);
        handleFiles(files);
    };

    return (
        <div className={`uploader-container ${uploading ? 'uploading' : ''} ${className}`}
            style={style}
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
                        id={`file-${path || 'upload'}`}
                    />
                    <label htmlFor={`file-${path || 'upload'}`} className="btn-upload">Choose Files</label>
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
                                id={`add-${path || 'upload'}`}
                            />
                            <label htmlFor={`add-${path || 'upload'}`}>+</label>
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
                .uploader-container:hover, .uploader-container.drag-over {
                    border-color: var(--text-tertiary);
                    background: var(--bg-surface-hover);
                }
                .uploader-container.drag-over {
                    border-color: #fff !important;
                    background: #222 !important;
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
                    box-sizing: border-box; /* Ensure padding doesn't cause overflow */
                }
                .preview-card, .add-more {
                    aspect-ratio: 1;
                    border-radius: 4px;
                    overflow: hidden;
                    position: relative;
                    background: var(--bg-surface-hover);
                }
                .preview-card img {
                    width: 100%; height: 100%; object-fit: cover; opacity: 0.8;
                }
                .add-more {
                    display: flex;
                }
                .add-more label {
                    display: flex; align-items: center; justify-content: center;
                    width: 100%; height: 100%;
                    font-size: 2rem; color: var(--text-tertiary);
                    cursor: pointer;
                    border: 1px dashed var(--border-subtle);
                    border-radius: 4px;
                    transition: all 0.2s;
                }
                .add-more label:hover { 
                    color: var(--text-primary); 
                    border-color: var(--text-primary);
                    background: var(--bg-surface);
                }
            `}</style>
        </div>
    );
}
