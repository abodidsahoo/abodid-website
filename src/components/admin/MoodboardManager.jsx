import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

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
    const [libraryTagEditors, setLibraryTagEditors] = useState({});
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
                .select('id, image_url, storage_path, title, tags, published, created_at, updated_at')
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
        const confirmDelete = window.confirm('Delete this moodboard image? This cannot be undone.');
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
            setNotice('Moodboard image deleted.');
        } catch (error) {
            console.error(error);
            setErrorMsg(error?.message || 'Failed to delete moodboard image.');
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

    const showLibraryTagEditor = (itemId) => {
        setLibraryTagEditors((previous) => ({ ...previous, [itemId]: true }));
    };

    const hideLibraryTagEditor = (itemId) => {
        setLibraryTagEditors((previous) => ({ ...previous, [itemId]: false }));
        setLibraryTagDrafts((previous) => ({ ...previous, [itemId]: '' }));
    };

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
            hideLibraryTagEditor(item.id);
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
        }

        setSavingTagItemIds((previous) => previous.filter((id) => id !== item.id));
        hideLibraryTagEditor(item.id);
    };

    return (
        <div className="moodboard-manager">
            <header className="manager-header">
                <div>
                    <h3>Visual Moodboard CMS</h3>
                    <p>
                        Upload a batch, tag each image, publish instantly. Search on the live page supports partial keyword matches.
                    </p>
                </div>
                <div className="header-stats">
                    <span>{items.length} total</span>
                    <span>{items.filter((item) => item.published).length} live</span>
                    <span>{uniqueTagCount} unique tags</span>
                </div>
            </header>

            <section className="upload-panel">
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
                                    <img src={entry.previewUrl} alt={entry.title || entry.file.name} />

                                    <div className="queue-main">
                                        <input
                                            className="queue-title"
                                            value={entry.title}
                                            onChange={(event) =>
                                                updateQueueEntry(entry.id, (current) => ({
                                                    ...current,
                                                    title: event.target.value,
                                                }))
                                            }
                                            placeholder="Image title"
                                        />

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
                                <article key={item.id} className="library-card">
                                    <img src={item.image_url} alt={item.title || 'Moodboard image'} loading="lazy" />

                                    <div className="library-meta">
                                        <div className="library-title" title={item.title || ''}>
                                            {item.title || 'Untitled mood'}
                                        </div>
                                        <div className="library-tags">
                                            {tags.length > 0
                                                ? tags.map((tag) => (
                                                    <span key={`${item.id}-${tag}`} className="library-tag">
                                                        #{tag}
                                                    </span>
                                                ))
                                                : <span className="library-tag muted">No tags</span>}
                                            {!libraryTagEditors[item.id] && (
                                                <button
                                                    type="button"
                                                    className="library-tag-add-btn"
                                                    onClick={() => showLibraryTagEditor(item.id)}
                                                    title="Add tag"
                                                    disabled={savingTagItemIds.includes(item.id)}
                                                >
                                                    +
                                                </button>
                                            )}
                                            {libraryTagEditors[item.id] && (
                                                <input
                                                    className="library-tag-input"
                                                    value={libraryTagDrafts[item.id] || ''}
                                                    placeholder="Type tag + Enter"
                                                    onChange={(event) => updateLibraryTagDraft(item.id, event.target.value)}
                                                    onBlur={() => hideLibraryTagEditor(item.id)}
                                                    onKeyDown={(event) => {
                                                        if (event.key === 'Enter') {
                                                            event.preventDefault();
                                                            addLibraryTag(item);
                                                        }
                                                        if (event.key === 'Escape') {
                                                            event.preventDefault();
                                                            hideLibraryTagEditor(item.id);
                                                        }
                                                    }}
                                                    disabled={savingTagItemIds.includes(item.id)}
                                                    autoFocus
                                                />
                                            )}
                                        </div>
                                        <div className="library-actions">
                                            <button
                                                type="button"
                                                className={`library-btn ${item.published ? 'live' : ''}`}
                                                onClick={() => togglePublished(item)}
                                            >
                                                {item.published ? 'Live' : 'Hidden'}
                                            </button>
                                            <button
                                                type="button"
                                                className="library-btn danger"
                                                onClick={() => handleDeleteItem(item)}
                                            >
                                                Delete
                                            </button>
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
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                }

                .manager-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 1rem;
                    border: 1px solid var(--border-subtle);
                    border-radius: 12px;
                    background: rgba(255, 255, 255, 0.02);
                    padding: 1rem 1.1rem;
                }

                .manager-header h3 {
                    margin: 0;
                    font-size: 1.25rem;
                }

                .manager-header p {
                    margin: 0.45rem 0 0;
                    color: var(--text-secondary);
                    font-size: 0.85rem;
                    line-height: 1.45;
                    max-width: 640px;
                }

                .header-stats {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.4rem;
                    justify-content: flex-end;
                }

                .header-stats span {
                    padding: 0.35rem 0.65rem;
                    border-radius: 999px;
                    font-size: 0.72rem;
                    border: 1px solid var(--border-subtle);
                    background: rgba(255, 255, 255, 0.03);
                    font-family: 'Space Mono', monospace;
                }

                .upload-panel,
                .library-panel {
                    border: 1px solid var(--border-subtle);
                    border-radius: 12px;
                    background: rgba(255, 255, 255, 0.02);
                    padding: 1rem;
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

                .dropzone.dragging {
                    border-color: #ea2a10;
                    background: rgba(234, 42, 16, 0.12);
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
                    font-family: 'Space Mono', monospace;
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

                .queue-btn,
                .library-btn {
                    border: 1px solid var(--border-strong);
                    border-radius: 8px;
                    min-height: 36px;
                    padding: 0 0.85rem;
                    font-size: 0.72rem;
                    font-family: 'Space Mono', monospace;
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

                .queue-title,
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

                .queue-title:focus,
                .tag-entry:focus,
                .library-search:focus {
                    outline: none;
                    border-color: rgba(234, 42, 16, 0.9);
                }

                .tag-input-grid {
                    display: block;
                }

                .queue-tags,
                .library-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.4rem;
                }

                .queue-tag,
                .library-tag {
                    display: inline-flex;
                    align-items: center;
                    padding: 0.24rem 0.5rem;
                    border-radius: 999px;
                    border: 1px solid rgba(234, 42, 16, 0.75);
                    background: rgba(234, 42, 16, 0.18);
                    color: rgba(255, 255, 255, 0.92);
                    font-size: 0.68rem;
                    font-family: 'Space Mono', monospace;
                }

                .queue-tag {
                    cursor: pointer;
                }

                .library-tag.muted {
                    border-color: var(--border-subtle);
                    background: rgba(255, 255, 255, 0.04);
                    color: var(--text-secondary);
                }

                .library-tag-add-btn {
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    background: rgba(255, 255, 255, 0.04);
                    color: var(--text-primary);
                    border-radius: 999px;
                    min-width: 26px;
                    height: 26px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1rem;
                    line-height: 1;
                    cursor: pointer;
                }

                .library-tag-add-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .library-tag-input {
                    min-width: 128px;
                    max-width: 180px;
                    border: 1px solid var(--border-subtle);
                    background: rgba(255, 255, 255, 0.03);
                    color: var(--text-primary);
                    border-radius: 999px;
                    min-height: 26px;
                    padding: 0 0.55rem;
                    font-size: 0.7rem;
                }

                .library-tag-input:focus {
                    outline: none;
                    border-color: rgba(234, 42, 16, 0.9);
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

                .library-card img {
                    width: 100%;
                    aspect-ratio: 4 / 5;
                    object-fit: cover;
                    display: block;
                    border-bottom: 1px solid var(--border-subtle);
                }

                .library-meta {
                    padding: 0.65rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.55rem;
                }

                .library-title {
                    font-size: 0.83rem;
                    font-weight: 500;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .library-actions {
                    display: flex;
                    gap: 0.4rem;
                }

                .library-btn {
                    flex: 1;
                }

                .library-btn.live {
                    background: rgba(44, 198, 137, 0.2);
                    border-color: rgba(44, 198, 137, 0.6);
                    color: #7ff0c5;
                }

                .library-btn.danger {
                    color: #ffb2b2;
                    border-color: rgba(255, 107, 107, 0.6);
                    background: rgba(255, 107, 107, 0.14);
                }

                @media (max-width: 980px) {
                    .manager-header {
                        flex-direction: column;
                    }

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
        </div>
    );
}
