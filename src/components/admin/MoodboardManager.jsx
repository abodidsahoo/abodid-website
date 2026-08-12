import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Eye, EyeOff, X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import AdminPageHeader from './AdminPageHeader';

const MOODBOARD_BUCKET = 'moodboard-assets';
const MOODBOARD_PATH_PREFIX = 'uploads';
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function buildQueueId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeTag(value) {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isImageFile(file) {
    if (!file) return false;
    if (typeof file.type === 'string' && file.type.startsWith('image/')) return true;
    return /\.(avif|gif|jpe?g|png|webp|svg)$/i.test(file.name || '');
}

function isFileSizeAllowed(file) {
    if (!file || typeof file.size !== 'number') return false;
    return file.size <= MAX_FILE_SIZE_BYTES;
}

function titleFromFilename(fileName) {
    return (fileName || '')
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]+/g, ' ')
        .trim();
}

function normalizeTagArray(rawTags) {
    if (!Array.isArray(rawTags)) return [];
    return rawTags
        .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
        .filter(Boolean);
}

function toStorageSafeName(fileName) {
    const base = titleFromFilename(fileName)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return base || 'mood-image';
}

function readImageDimensions(file) {
    return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
            const width = image.naturalWidth;
            const height = image.naturalHeight;
            URL.revokeObjectURL(objectUrl);

            if (width > 0 && height > 0) {
                resolve({ width, height });
            } else {
                reject(new Error(`Could not read dimensions for ${file.name}.`));
            }
        };

        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error(`Could not decode ${file.name}.`));
        };

        image.src = objectUrl;
    });
}

function getStorageTarget(item) {
    const rawPath = typeof item?.storage_path === 'string' ? item.storage_path.trim() : '';

    if (rawPath.includes('/')) {
        const [bucket, ...rest] = rawPath.split('/');
        const knownBucket = bucket === MOODBOARD_BUCKET || bucket === 'portfolio-assets';
        if (knownBucket && rest.length > 0) {
            return { bucket, path: rest.join('/') };
        }
    }

    const imageUrl = typeof item?.image_url === 'string' ? item.image_url.trim() : '';
    if (imageUrl) {
        try {
            const pathname = new URL(imageUrl).pathname;
            const match = pathname.match(/\/object\/(?:public\/)?([^/]+)\/(.+)$/);
            if (match?.[1] && match?.[2]) {
                return {
                    bucket: decodeURIComponent(match[1]),
                    path: decodeURIComponent(match[2]),
                };
            }
        } catch {
            // no-op
        }
    }

    return { bucket: MOODBOARD_BUCKET, path: rawPath };
}

export default function MoodboardManager() {
    const fileInputRef = useRef(null);
    const queueRef = useRef([]);

    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [savingTagItemIds, setSavingTagItemIds] = useState([]);
    const [errorMsg, setErrorMsg] = useState('');
    const [notice, setNotice] = useState('');
    const [libraryFilter, setLibraryFilter] = useState('');
    const [libraryTagDrafts, setLibraryTagDrafts] = useState({});

    const [items, setItems] = useState([]);
    const [queue, setQueue] = useState([]);

    useEffect(() => {
        queueRef.current = queue;
    }, [queue]);

    useEffect(() => {
        return () => {
            queueRef.current.forEach((entry) => {
                if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
            });
        };
    }, []);

    const loadItems = useCallback(async () => {
        setLoading(true);
        setErrorMsg('');

        try {
            const { data, error } = await supabase
                .from('moodboard_items')
                .select('id, image_url, storage_path, title, tags, published, image_width, image_height, aspect_ratio, created_at, updated_at')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setItems(data || []);
        } catch (error) {
            console.error(error);
            setErrorMsg(error?.message || 'Failed to load moodboard items.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadItems();
    }, [loadItems]);

    useEffect(() => {
        if (!notice) return undefined;
        const timer = window.setTimeout(() => setNotice(''), 3500);
        return () => window.clearTimeout(timer);
    }, [notice]);

    const revokeEntries = (entries) => {
        entries.forEach((entry) => {
            if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
        });
    };

    const appendFiles = useCallback((inputFiles) => {
        const allFiles = Array.from(inputFiles || []);
        const imageFiles = allFiles.filter(isImageFile);
        const files = imageFiles.filter(isFileSizeAllowed);

        const nonImageCount = allFiles.length - imageFiles.length;
        const oversizedCount = imageFiles.length - files.length;

        if (!files.length) {
            const parts = [];
            if (nonImageCount > 0) parts.push('non-image files');
            if (oversizedCount > 0) parts.push(`files above ${Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB`);
            const reason = parts.length > 0 ? ` (${parts.join(', ')})` : '';
            setErrorMsg(`No valid images added${reason}.`);
            return;
        }

        if (nonImageCount > 0 || oversizedCount > 0) {
            const notices = [];
            if (nonImageCount > 0) notices.push(`${nonImageCount} unsupported`);
            if (oversizedCount > 0) notices.push(`${oversizedCount} oversized`);
            setErrorMsg(`Added ${files.length} file(s). Skipped ${notices.join(' and ')}.`);
        } else {
            setErrorMsg('');
        }

        const newRows = files.map((file) => ({
            id: buildQueueId(),
            file,
            previewUrl: URL.createObjectURL(file),
            title: titleFromFilename(file.name),
            tags: [],
            tagDraft: '',
        }));

        setQueue((previous) => [...previous, ...newRows]);
    }, []);

    const updateQueueEntry = (entryId, updater) => {
        setQueue((previous) =>
            previous.map((entry) => (entry.id === entryId ? updater(entry) : entry)),
        );
    };

    const removeQueueEntry = (entryId) => {
        setQueue((previous) => {
            const target = previous.find((entry) => entry.id === entryId);
            if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
            return previous.filter((entry) => entry.id !== entryId);
        });
    };

    const clearQueue = () => {
        revokeEntries(queue);
        setQueue([]);
    };

    const addTag = (entryId, rawTag) => {
        const normalized = normalizeTag(rawTag || '');
        if (!normalized) return;

        updateQueueEntry(entryId, (entry) => {
            if (entry.tags.some((tag) => tag.toLowerCase() === normalized)) {
                return {
                    ...entry,
                    tagDraft: '',
                };
            }

            return {
                ...entry,
                tags: [...entry.tags, normalized],
                tagDraft: '',
            };
        });
    };

    const removeTag = (entryId, tagValue) => {
        updateQueueEntry(entryId, (entry) => ({
            ...entry,
            tags: entry.tags.filter((tag) => tag !== tagValue),
        }));
    };

    const handleUpload = async () => {
        if (!queue.length || uploading) return;

        setUploading(true);
        setErrorMsg('');
        setNotice('');

        const failedIds = new Set();
        let successCount = 0;

        for (const entry of queue) {
            try {
                const dimensions = await readImageDimensions(entry.file);
                const fileExt = (entry.file.name.split('.').pop() || 'jpg').toLowerCase();
                const uploadFolder = `${MOODBOARD_PATH_PREFIX}/moodboard`;

                const formData = new FormData();
                formData.append('file', entry.file);
                formData.append('bucket', MOODBOARD_BUCKET);
                formData.append('path', uploadFolder);

                const uploadResponse = await fetch('/api/admin/upload', {
                    method: 'POST',
                    body: formData,
                });

                const uploadResult = await uploadResponse.json();
                if (!uploadResponse.ok) {
                    throw new Error(uploadResult?.error || `Upload failed for ${entry.file.name}`);
                }

                const uploadPath = uploadResult?.path || `${uploadFolder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${toStorageSafeName(entry.file.name)}.${fileExt}`;
                const publicUrl = uploadResult?.url;
                if (!publicUrl) throw new Error('Missing public URL from upload API.');

                const payload = {
                    image_url: String(publicUrl),
                    storage_path: `${MOODBOARD_BUCKET}/${uploadPath}`,
                    title: entry.title?.trim() || titleFromFilename(entry.file.name) || 'Untitled mood',
                    tags: entry.tags,
                    published: true,
                    image_width: dimensions.width,
                    image_height: dimensions.height,
                };

                const { error: insertError } = await supabase
                    .from('moodboard_items')
                    .insert(payload);

                if (insertError) {
                    try {
                        await supabase.storage.from(MOODBOARD_BUCKET).remove([uploadPath]);
                    } catch {
                        // best effort cleanup only
                    }
                    throw insertError;
                }

                successCount += 1;
            } catch (error) {
                console.error('Moodboard upload failed:', error);
                failedIds.add(entry.id);
            }
        }

        if (successCount > 0) {
            await loadItems();
        }

        if (failedIds.size === 0) {
            clearQueue();
            setNotice(`Uploaded ${successCount} moodboard image${successCount === 1 ? '' : 's'}. Queue is clean for your next drop.`);
        } else {
            const successful = queue.filter((entry) => !failedIds.has(entry.id));
            revokeEntries(successful);

            setQueue((previous) => previous.filter((entry) => failedIds.has(entry.id)));
            setErrorMsg(
                `Uploaded ${successCount} image${successCount === 1 ? '' : 's'}. ${failedIds.size} image${failedIds.size === 1 ? '' : 's'} failed and stayed in the queue.`,
            );
        }

        setUploading(false);
    };

    const handleDeleteItem = async (item) => {
        const confirmDelete = window.confirm('Remove this image from the mood board? This cannot be undone.');
        if (!confirmDelete) return;

        setErrorMsg('');

        try {
            const { error } = await supabase.from('moodboard_items').delete().eq('id', item.id);
            if (error) throw error;

            if (item.storage_path || item.image_url) {
                const target = getStorageTarget(item);
                if (target.path) {
                    await supabase.storage.from(target.bucket).remove([target.path]);
                }
            }

            setItems((previous) => previous.filter((entry) => entry.id !== item.id));
            setNotice('Image removed from the mood board.');
        } catch (error) {
            console.error(error);
            setErrorMsg(error?.message || 'Failed to remove the moodboard image.');
        }
    };

    const togglePublished = async (item) => {
        const nextPublished = !item.published;

        setItems((previous) =>
            previous.map((entry) =>
                entry.id === item.id ? { ...entry, published: nextPublished } : entry,
            ),
        );

        const { error } = await supabase
            .from('moodboard_items')
            .update({ published: nextPublished })
            .eq('id', item.id);

        if (error) {
            console.error(error);
            setItems((previous) =>
                previous.map((entry) =>
                    entry.id === item.id ? { ...entry, published: item.published } : entry,
                ),
            );
            setErrorMsg(error.message || 'Failed to update visibility.');
        }
    };

    const filteredLibraryItems = useMemo(() => {
        const q = libraryFilter.trim().toLowerCase();
        if (!q) return items;

        return items.filter((item) => {
            const tags = normalizeTagArray(item.tags).join(' ');
            const title = (item.title || '').toLowerCase();
            return `${title} ${tags}`.includes(q);
        });
    }, [items, libraryFilter]);

    const uniqueTagCount = useMemo(() => {
        const tagSet = new Set();
        items.forEach((item) => {
            normalizeTagArray(item.tags).forEach((tag) => tagSet.add(tag.toLowerCase()));
        });
        return tagSet.size;
    }, [items]);

    const updateLibraryTagDraft = (itemId, value) => {
        setLibraryTagDrafts((previous) => ({ ...previous, [itemId]: value }));
    };

    const addLibraryTag = async (item) => {
        const draft = libraryTagDrafts[item.id] || '';
        const normalized = normalizeTag(draft);
        if (!normalized) return;

        const currentTags = normalizeTagArray(item.tags);
        const alreadyExists = currentTags.some((tag) => tag.toLowerCase() === normalized);
        if (alreadyExists) {
            setLibraryTagDrafts((previous) => ({ ...previous, [item.id]: '' }));
            return;
        }

        const nextTags = [...currentTags, normalized];
        setSavingTagItemIds((previous) => [...previous, item.id]);
        setItems((previous) =>
            previous.map((entry) => (entry.id === item.id ? { ...entry, tags: nextTags } : entry)),
        );

        const { error } = await supabase
            .from('moodboard_items')
            .update({ tags: nextTags })
            .eq('id', item.id);

        if (error) {
            console.error(error);
            setItems((previous) =>
                previous.map((entry) => (entry.id === item.id ? { ...entry, tags: currentTags } : entry)),
            );
            setErrorMsg(error.message || 'Failed to add tag.');
        } else {
            setErrorMsg('');
            setLibraryTagDrafts((previous) => ({ ...previous, [item.id]: '' }));
        }

        setSavingTagItemIds((previous) => previous.filter((id) => id !== item.id));
    };

    return (
        <section className="moodboard-manager" aria-labelledby="visual-moodboard-title">
            <div className="moodboard-manager-header">
                <AdminPageHeader
                    className="moodboard-page-header"
                    headingId="visual-moodboard-title"
                    title="Visual Moodboard"
                    description="When inspiration hits you, never let it go."
                />
                <div className="moodboard-header-actions">
                    <a href="/moodboard" target="_blank" rel="noreferrer" className="moodboard-view-link">
                        View Mood Board <ArrowUpRight size={15} aria-hidden="true" />
                    </a>
                </div>
            </div>

            <section className="upload-panel">
                <div className="upload-overview">
                    <div
                        className={`dropzone ${isDragOver ? 'dragging' : ''}`}
                        onDragOver={(event) => {
                            event.preventDefault();
                            setIsDragOver(true);
                        }}
                        onDragEnter={(event) => {
                            event.preventDefault();
                            setIsDragOver(true);
                        }}
                        onDragLeave={(event) => {
                            event.preventDefault();
                            setIsDragOver(false);
                        }}
                        onDrop={(event) => {
                            event.preventDefault();
                            setIsDragOver(false);
                            appendFiles(event.dataTransfer.files);
                        }}
                    >
                        <div className="dropzone-copy">
                            <strong>Drop moodboard images here</strong>
                            <span>Each file gets one tag field. Press Enter to keep stacking tags.</span>
                        </div>

                        <button
                            type="button"
                            className="dropzone-btn"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            Choose files
                        </button>

                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(event) => {
                                appendFiles(event.target.files);
                                event.target.value = '';
                            }}
                        />
                    </div>

                    <div className="upload-stats" aria-label="Moodboard totals">
                        <div className="upload-stat">
                            <strong>{items.length}</strong>
                            <span>{items.length === 1 ? 'image' : 'images'}</span>
                        </div>
                        <div className="upload-stat">
                            <strong>{uniqueTagCount}</strong>
                            <span>unique {uniqueTagCount === 1 ? 'tag' : 'tags'}</span>
                        </div>
                    </div>
                </div>

                {queue.length > 0 && (
                    <div className="queue-panel">
                        <div className="queue-header-row">
                            <h4>Upload Queue ({queue.length})</h4>
                            <div className="queue-actions">
                                <button type="button" className="queue-btn subtle" onClick={clearQueue} disabled={uploading}>
                                    Clear queue
                                </button>
                                <button type="button" className="queue-btn primary" onClick={handleUpload} disabled={uploading}>
                                    {uploading ? 'Uploading...' : `Upload ${queue.length} image${queue.length === 1 ? '' : 's'}`}
                                </button>
                            </div>
                        </div>

                        <div className="queue-list">
                            {queue.map((entry) => (
                                <article key={entry.id} className="queue-row">
                                    <img src={entry.previewUrl} alt="Queued moodboard image" />

                                    <div className="queue-main">
                                        <div className="tag-input-grid">
                                            <input
                                                className="tag-entry"
                                                value={entry.tagDraft}
                                                placeholder="Add tag and press Enter"
                                                onChange={(event) =>
                                                    updateQueueEntry(entry.id, (current) => ({
                                                        ...current,
                                                        tagDraft: event.target.value,
                                                    }))
                                                }
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter') {
                                                        event.preventDefault();
                                                        addTag(entry.id, event.currentTarget.value);
                                                    }
                                                }}
                                            />
                                        </div>

                                        {entry.tags.length > 0 && (
                                            <div className="queue-tags">
                                                {entry.tags.map((tag) => (
                                                    <button
                                                        key={`${entry.id}-${tag}`}
                                                        type="button"
                                                        className="queue-tag"
                                                        onClick={() => removeTag(entry.id, tag)}
                                                        title="Remove tag"
                                                    >
                                                        #{tag} ×
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        className="remove-row-btn"
                                        onClick={() => removeQueueEntry(entry.id)}
                                    >
                                        Remove
                                    </button>
                                </article>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            {notice && <div className="manager-notice success">{notice}</div>}
            {errorMsg && <div className="manager-notice error">{errorMsg}</div>}

            <section className="library-panel">
                <div className="library-header-row">
                    <h4>Moodboard Library</h4>
                    <input
                        className="library-search"
                        value={libraryFilter}
                        onChange={(event) => setLibraryFilter(event.target.value)}
                        placeholder="Search uploaded moodboard images..."
                    />
                </div>

                {loading ? (
                    <div className="library-loading">Loading moodboard items...</div>
                ) : filteredLibraryItems.length === 0 ? (
                    <div className="library-empty">No moodboard images match this filter.</div>
                ) : (
                    <div className="library-grid">
                        {filteredLibraryItems.map((item) => {
                            const tags = normalizeTagArray(item.tags);

                            return (
                                <article key={item.id} className={`library-card ${item.published ? '' : 'is-hidden'}`}>
                                    <div className="library-image-wrap">
                                        <img
                                            className="library-image"
                                            src={item.image_url}
                                            alt="Moodboard image"
                                            loading="lazy"
                                        />

                                        <button
                                            type="button"
                                            className="library-remove-btn"
                                            onClick={() => handleDeleteItem(item)}
                                            aria-label="Remove image from mood board"
                                            title="Remove from mood board"
                                        >
                                            <X size={17} aria-hidden="true" />
                                        </button>

                                        <button
                                            type="button"
                                            className="library-visibility-btn"
                                            onClick={() => togglePublished(item)}
                                            aria-label={item.published ? 'Hide image from mood board' : 'Show image on mood board'}
                                            title={item.published ? 'Hide from mood board' : 'Show on mood board'}
                                        >
                                            {item.published
                                                ? <EyeOff size={14} aria-hidden="true" />
                                                : <Eye size={14} aria-hidden="true" />}
                                            <span>{item.published ? 'Hide' : 'Show'}</span>
                                        </button>
                                    </div>

                                    <div className="library-meta">
                                        <div className="library-tag-list" aria-label="Image tags">
                                            {tags.length > 0 ? tags.map((tag, index) => (
                                                <span key={`${item.id}-${tag}`} className="library-tag-item">
                                                    <span className="library-tag-text">{tag}</span>
                                                    {index < tags.length - 1 && <span className="library-tag-separator">, </span>}
                                                </span>
                                            )) : (
                                                <span className="library-tags-empty">No tags yet</span>
                                            )}
                                        </div>

                                        <div className="library-tag-adder">
                                            <button
                                                type="button"
                                                className="library-tag-add-btn"
                                                onClick={() => addLibraryTag(item)}
                                                aria-label="Add tag"
                                                title="Add tag"
                                                disabled={savingTagItemIds.includes(item.id)}
                                            >
                                                +
                                            </button>

                                            <input
                                                className="library-tag-input"
                                                value={libraryTagDrafts[item.id] || ''}
                                                placeholder="Type a tag and press Enter"
                                                onChange={(event) => updateLibraryTagDraft(item.id, event.target.value)}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter') {
                                                        event.preventDefault();
                                                        addLibraryTag(item);
                                                    }
                                                    if (event.key === 'Escape') {
                                                        event.preventDefault();
                                                        updateLibraryTagDraft(item.id, '');
                                                    }
                                                }}
                                                disabled={savingTagItemIds.includes(item.id)}
                                            />
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>

            <style>{`
                .moodboard-manager {
                    width: 100%;
                    max-width: var(--admin-page-content-max);
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                }

                .moodboard-manager-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    gap: 2rem;
                    padding: var(--admin-page-heading-offset-block) var(--admin-page-heading-offset-inline) 1.5rem;
                    border-bottom: 1px solid var(--border-subtle);
                }

                .moodboard-page-header {
                    min-width: 0;
                    flex: 1 1 34rem;
                }

                .moodboard-header-actions {
                    display: flex;
                    align-items: center;
                    flex: 0 0 auto;
                    padding-bottom: 0.25rem;
                }

                .moodboard-view-link {
                    min-height: 40px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.4rem;
                    padding: 0.6rem 0.75rem;
                    border: 1px solid var(--border-subtle);
                    border-radius: 8px;
                    background: transparent;
                    color: var(--text-primary);
                    font: 700 0.72rem/1 var(--font-ui);
                    text-decoration: none;
                }

                .upload-panel,
                .library-panel {
                    border: 1px solid var(--border-subtle);
                    border-radius: 12px;
                    background: rgba(255, 255, 255, 0.02);
                    padding: 1rem;
                }

                .upload-overview {
                    display: grid;
                    grid-template-columns: minmax(0, 1.2fr) minmax(270px, 0.8fr);
                    gap: 1rem;
                    align-items: stretch;
                }

                .dropzone {
                    border: 2px dashed var(--border-strong);
                    border-radius: 12px;
                    min-height: 150px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 1rem;
                    padding: 1rem 1.1rem;
                    transition: all 0.18s ease;
                    background: rgba(255, 255, 255, 0.015);
                }

                .upload-stats {
                    min-width: 0;
                    min-height: 150px;
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    align-items: center;
                    border: 1px solid var(--border-subtle);
                    border-radius: 12px;
                    background: rgba(255, 255, 255, 0.015);
                }

                .upload-stat {
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 0.45rem;
                    padding: 1rem 0.75rem;
                    text-align: center;
                }

                .upload-stat + .upload-stat {
                    border-left: 1px solid var(--border-subtle);
                }

                .upload-stat strong {
                    max-width: 100%;
                    color: var(--text-primary);
                    font-size: clamp(3rem, 6vw, 5.6rem);
                    font-weight: 360;
                    line-height: 0.82;
                    letter-spacing: -0.075em;
                }

                .upload-stat span {
                    color: var(--text-tertiary);
                    font-size: 0.65rem;
                    line-height: 1.15;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }

                .dropzone.dragging {
                    border-color: var(--color-brand-red);
                    background: rgba(163, 0, 33, 0.12);
                    transform: translateY(-1px);
                }

                .dropzone-copy {
                    display: flex;
                    flex-direction: column;
                    gap: 0.3rem;
                }

                .dropzone-copy strong {
                    font-size: 0.95rem;
                }

                .dropzone-copy span {
                    color: var(--text-secondary);
                    font-size: 0.8rem;
                }

                .dropzone-btn {
                    border: 1px solid var(--border-strong);
                    background: rgba(255, 255, 255, 0.04);
                    color: var(--text-primary);
                    border-radius: 8px;
                    min-height: 40px;
                    padding: 0 1rem;
                    cursor: pointer;
                    font-family: var(--font-ui);
                    font-size: 0.75rem;
                    text-transform: uppercase;
                }

                .queue-panel {
                    margin-top: 1rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.8rem;
                }

                .queue-header-row,
                .library-header-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 0.75rem;
                }

                .queue-header-row h4,
                .library-header-row h4 {
                    margin: 0;
                    font-size: 1rem;
                }

                .queue-actions {
                    display: flex;
                    gap: 0.55rem;
                    align-items: center;
                }

                .queue-btn {
                    border: 1px solid var(--border-strong);
                    border-radius: 8px;
                    min-height: 36px;
                    padding: 0 0.85rem;
                    font-size: 0.72rem;
                    font-family: var(--font-ui);
                    text-transform: uppercase;
                    cursor: pointer;
                    background: rgba(255, 255, 255, 0.03);
                    color: var(--text-primary);
                }

                .queue-btn.subtle {
                    background: transparent;
                }

                .queue-btn.primary {
                    background: rgba(234, 42, 16, 0.92);
                    border-color: rgba(234, 42, 16, 1);
                    color: #fff;
                }

                .queue-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .queue-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.7rem;
                    max-height: 420px;
                    overflow: auto;
                    padding-right: 0.2rem;
                }

                .queue-row {
                    display: grid;
                    grid-template-columns: 88px 1fr auto;
                    gap: 0.8rem;
                    align-items: flex-start;
                    border: 1px solid var(--border-subtle);
                    border-radius: 10px;
                    padding: 0.65rem;
                    background: rgba(0, 0, 0, 0.25);
                }

                .queue-row img {
                    width: 88px;
                    height: 88px;
                    border-radius: 6px;
                    object-fit: cover;
                    border: 1px solid rgba(255, 255, 255, 0.12);
                }

                .queue-main {
                    display: flex;
                    flex-direction: column;
                    gap: 0.55rem;
                    min-width: 0;
                }

                .tag-entry,
                .library-search {
                    width: 100%;
                    border: 1px solid var(--border-subtle);
                    background: rgba(255, 255, 255, 0.03);
                    color: var(--text-primary);
                    border-radius: 8px;
                    min-height: 34px;
                    padding: 0.45rem 0.6rem;
                    font-size: 0.78rem;
                }

                .tag-entry:focus,
                .library-search:focus {
                    outline: none;
                    border-color: rgba(234, 42, 16, 0.9);
                }

                .tag-input-grid {
                    display: block;
                }

                .queue-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.4rem;
                }

                .queue-tag {
                    display: inline-flex;
                    align-items: center;
                    padding: 0.24rem 0.5rem;
                    border-radius: 999px;
                    border: 1px solid rgba(234, 42, 16, 0.75);
                    background: rgba(234, 42, 16, 0.18);
                    color: rgba(255, 255, 255, 0.92);
                    font-size: 0.68rem;
                    font-family: var(--font-ui);
                }

                .queue-tag {
                    cursor: pointer;
                }

                .remove-row-btn {
                    border: 1px solid var(--border-subtle);
                    background: transparent;
                    color: var(--text-secondary);
                    border-radius: 8px;
                    min-height: 34px;
                    padding: 0 0.75rem;
                    cursor: pointer;
                    font-size: 0.72rem;
                }

                .remove-row-btn:hover {
                    color: #ff6f5b;
                    border-color: #ff6f5b;
                }

                .manager-notice {
                    border-radius: 10px;
                    padding: 0.75rem 0.9rem;
                    font-size: 0.82rem;
                }

                .manager-notice.success {
                    border: 1px solid rgba(44, 198, 137, 0.5);
                    background: rgba(44, 198, 137, 0.14);
                    color: #80f0c5;
                }

                .manager-notice.error {
                    border: 1px solid rgba(255, 107, 107, 0.5);
                    background: rgba(255, 107, 107, 0.14);
                    color: #ffb2b2;
                }

                .library-search {
                    max-width: 340px;
                }

                .library-loading,
                .library-empty {
                    padding: 1rem 0.25rem;
                    color: var(--text-secondary);
                    font-size: 0.84rem;
                }

                .library-grid {
                    margin-top: 0.85rem;
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
                    gap: 0.75rem;
                }

                .library-card {
                    border: 1px solid var(--border-subtle);
                    border-radius: 10px;
                    overflow: hidden;
                    background: rgba(0, 0, 0, 0.24);
                }

                .library-image-wrap {
                    position: relative;
                    overflow: hidden;
                    background: rgba(0, 0, 0, 0.4);
                    border-bottom: 1px solid var(--border-subtle);
                }

                .library-image {
                    width: 100%;
                    aspect-ratio: 4 / 5;
                    object-fit: cover;
                    display: block;
                    transition: opacity 0.2s ease, filter 0.2s ease, transform 0.2s ease;
                }

                .library-card:hover .library-image {
                    transform: scale(1.01);
                }

                .library-card.is-hidden .library-image {
                    opacity: 0.42;
                    filter: grayscale(0.75);
                }

                .library-remove-btn,
                .library-visibility-btn {
                    position: absolute;
                    top: 0.65rem;
                    z-index: 2;
                    min-height: 30px;
                    border: 1px solid rgba(255, 255, 255, 0.22);
                    background: rgba(8, 8, 8, 0.78);
                    color: rgba(255, 255, 255, 0.94);
                    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.24);
                    backdrop-filter: blur(8px);
                    cursor: pointer;
                }

                .library-remove-btn {
                    left: 0.65rem;
                    width: 30px;
                    padding: 0;
                    border-radius: 50%;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    color: #ffb2b2;
                }

                .library-remove-btn:hover {
                    border-color: rgba(255, 107, 107, 0.8);
                    background: rgba(90, 15, 15, 0.9);
                    color: #fff;
                }

                .library-visibility-btn {
                    right: 0.65rem;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.35rem;
                    padding: 0 0.6rem;
                    border-radius: 7px;
                    font: 650 0.66rem/1 var(--font-ui);
                    opacity: 0;
                    pointer-events: none;
                    transform: translateY(-4px);
                    transition: opacity 0.16s ease, transform 0.16s ease, border-color 0.16s ease;
                }

                .library-card:hover .library-visibility-btn,
                .library-card:focus-within .library-visibility-btn {
                    opacity: 1;
                    pointer-events: auto;
                    transform: translateY(0);
                }

                .library-visibility-btn:hover {
                    border-color: rgba(255, 255, 255, 0.55);
                }

                .library-meta {
                    padding: 0.7rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.7rem;
                }

                .library-tag-list {
                    min-height: 1.2rem;
                    color: var(--text-primary);
                    font-size: 0.76rem;
                    line-height: 1.55;
                }

                .library-tag-item {
                    white-space: normal;
                }

                .library-tag-text {
                    text-decoration: underline;
                    text-decoration-color: rgba(255, 255, 255, 0.42);
                    text-underline-offset: 0.2em;
                }

                .library-tag-separator {
                    color: var(--text-tertiary);
                }

                .library-tags-empty {
                    color: var(--text-tertiary);
                    font-style: italic;
                }

                .library-tag-adder {
                    display: flex;
                    align-items: center;
                    gap: 0.45rem;
                }

                .library-tag-add-btn {
                    flex: 0 0 auto;
                    width: 24px;
                    height: 24px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border: 0;
                    background: transparent;
                    color: var(--text-secondary);
                    padding: 0;
                    font: 400 1.1rem/1 var(--font-ui);
                    cursor: pointer;
                }

                .library-tag-add-btn:hover {
                    color: var(--text-primary);
                }

                .library-tag-add-btn:disabled {
                    opacity: 0.45;
                    cursor: not-allowed;
                }

                .library-tag-input {
                    width: 100%;
                    min-width: 0;
                    min-height: 26px;
                    padding: 0.15rem 0;
                    border: 0;
                    border-bottom: 1px solid var(--border-subtle);
                    border-radius: 0;
                    background: transparent;
                    color: var(--text-primary);
                    font-size: 0.7rem;
                }

                .library-tag-input::placeholder {
                    color: var(--text-tertiary);
                }

                .library-tag-input:focus {
                    outline: none;
                    border-bottom-color: rgba(234, 42, 16, 0.9);
                }

                @media (hover: none) {
                    .library-visibility-btn {
                        opacity: 1;
                        pointer-events: auto;
                        transform: none;
                    }
                }

                @media (max-width: 1180px) {
                    .upload-overview {
                        grid-template-columns: minmax(0, 1.1fr) minmax(250px, 0.9fr);
                    }
                }

                @media (max-width: 980px) {

                    .dropzone {
                        flex-direction: column;
                        align-items: flex-start;
                    }

                    .queue-row {
                        grid-template-columns: 72px 1fr;
                    }

                    .queue-row img {
                        width: 72px;
                        height: 72px;
                    }

                    .remove-row-btn {
                        grid-column: 1 / -1;
                    }

                }

                @media (max-width: 640px) {
                    .moodboard-manager-header {
                        align-items: flex-start;
                        flex-direction: column;
                        gap: 1rem;
                    }

                    .upload-overview {
                        grid-template-columns: 1fr;
                    }

                    .upload-stats {
                        min-height: 120px;
                    }

                    .upload-stat strong {
                        font-size: clamp(3.25rem, 18vw, 5rem);
                    }

                    .queue-header-row,
                    .library-header-row {
                        flex-direction: column;
                        align-items: stretch;
                    }

                    .library-search {
                        max-width: none;
                    }
                }
            `}</style>
        </section>
    );
}
