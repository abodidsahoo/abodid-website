import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowUpRight, Check, CornerDownLeft, Eye, EyeOff, Loader2, RotateCw, X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import AdminPageHeader from './AdminPageHeader';

const MOODBOARD_BUCKET = 'moodboard-assets';
const R2_BUCKET = 'assets';
const MOODBOARD_R2_FOLDER = 'photos/originals/moodboard';
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

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
    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
    if (supportedTypes.includes(file.type)) return true;
    return /\.(gif|jpe?g|png|webp|avif)$/i.test(file.name || '');
}

function isGifAsset(item) {
    const url = item?.image_url || '';
    const path = item?.storage_path || '';
    return /\.gif(\?|$)/i.test(url) || /\.gif$/i.test(path);
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
        const knownBucket = bucket === MOODBOARD_BUCKET || bucket === 'portfolio-assets' || bucket === R2_BUCKET;
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

export default function MoodboardManager({
    accessToken,
    initialFiles = [],
    onInitialFilesConsumed,
}) {
    const fileInputRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [isDragOver, setIsDragOver] = useState(false);
    const [savingTagItemIds, setSavingTagItemIds] = useState([]);
    const [errorMsg, setErrorMsg] = useState('');
    const [notice, setNotice] = useState('');
    const [libraryFilter, setLibraryFilter] = useState('');
    const [libraryTagDrafts, setLibraryTagDrafts] = useState({});
    const [imageLoadErrors, setImageLoadErrors] = useState({});

    const [items, setItems] = useState([]);

    // Live Upload Pipeline State
    const [uploadSession, setUploadSession] = useState({
        active: false,
        total: 0,
        completed: 0,
        failed: 0,
        entries: [],
    });

    const uploadSessionRef = useRef(uploadSession);
    const isUploadingLoopRef = useRef(false);
    const localPreviewsRef = useRef({});

    useEffect(() => {
        uploadSessionRef.current = uploadSession;
    }, [uploadSession]);

    // Clean up created object URLs on unmount
    useEffect(() => {
        return () => {
            Object.values(localPreviewsRef.current).forEach((url) => {
                if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
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
        const timer = window.setTimeout(() => setNotice(''), 4500);
        return () => window.clearTimeout(timer);
    }, [notice]);

    // Upload worker loop that processes queued files
    const runUploadQueue = useCallback(async () => {
        if (isUploadingLoopRef.current) return;
        isUploadingLoopRef.current = true;

        try {
            while (true) {
                const currentEntries = uploadSessionRef.current.entries;
                const nextEntry = currentEntries.find((entry) => entry.status === 'queued');
                if (!nextEntry) break;

                // Mark current entry as uploading
                setUploadSession((prev) => ({
                    ...prev,
                    active: true,
                    entries: prev.entries.map((e) =>
                        e.id === nextEntry.id ? { ...e, status: 'uploading' } : e,
                    ),
                }));

                try {
                    const token =
                        accessToken ||
                        (await supabase.auth.getSession()).data.session?.access_token;
                    if (!token) {
                        throw new Error('Your admin session has expired. Sign in again before uploading.');
                    }

                    const dimensions = await readImageDimensions(nextEntry.file);

                    const formData = new FormData();
                    formData.append('file', nextEntry.file);
                    formData.append('folder', MOODBOARD_R2_FOLDER);
                    formData.append('width', String(dimensions.width));
                    formData.append('height', String(dimensions.height));

                    const uploadResponse = await fetch('/api/admin/media/upload', {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                        body: formData,
                    });

                    const uploadResult = await uploadResponse.json();
                    if (!uploadResponse.ok) {
                        throw new Error(uploadResult?.error || `Upload failed for ${nextEntry.name}`);
                    }

                    const uploadedAsset = uploadResult?.asset;
                    const publicUrl = uploadedAsset?.publicUrl;
                    const objectKey = uploadedAsset?.objectKey;

                    if (!publicUrl || !objectKey) {
                        throw new Error('The file was uploaded, but its Cloudflare location was not returned.');
                    }

                    const payload = {
                        image_url: String(publicUrl),
                        storage_path: `${R2_BUCKET}/${objectKey}`,
                        title: titleFromFilename(nextEntry.file.name) || 'Untitled mood',
                        tags: [],
                        published: true,
                        image_width: dimensions.width,
                        image_height: dimensions.height,
                    };

                    const { data: insertedItem, error: insertError } = await supabase
                        .from('moodboard_items')
                        .insert(payload)
                        .select('id, image_url, storage_path, title, tags, published, image_width, image_height, aspect_ratio, created_at, updated_at')
                        .single();

                    if (insertError) throw insertError;

                    // Cache local preview for instant display without waiting for remote propagation
                    if (nextEntry.previewUrl) {
                        localPreviewsRef.current[insertedItem.id] = nextEntry.previewUrl;
                    }

                    // Immediately prepend newly uploaded image to the library grid
                    setItems((prev) => [insertedItem, ...prev.filter((it) => it.id !== insertedItem.id)]);

                    // Mark as success
                    setUploadSession((prev) => {
                        const nextCompleted = prev.completed + 1;
                        const nextEntries = prev.entries.map((e) =>
                            e.id === nextEntry.id ? { ...e, status: 'success' } : e,
                        );
                        return {
                            ...prev,
                            completed: nextCompleted,
                            entries: nextEntries,
                        };
                    });
                } catch (err) {
                    console.error('Moodboard upload failed for entry:', nextEntry.name, err);
                    setUploadSession((prev) => {
                        const nextFailed = prev.failed + 1;
                        const nextEntries = prev.entries.map((e) =>
                            e.id === nextEntry.id
                                ? { ...e, status: 'error', error: err.message || 'Upload failed' }
                                : e,
                        );
                        return {
                            ...prev,
                            failed: nextFailed,
                            entries: nextEntries,
                        };
                    });
                }
            }
        } finally {
            isUploadingLoopRef.current = false;
            setUploadSession((prev) => {
                const isFinished = prev.completed + prev.failed >= prev.total;
                return {
                    ...prev,
                    active: !isFinished,
                };
            });
        }
    }, [accessToken]);

    // Direct Upload Handler - invoked immediately on file selection or drop
    const startDirectUpload = useCallback((inputFiles) => {
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
            setErrorMsg(`No valid images selected${reason}.`);
            return;
        }

        if (nonImageCount > 0 || oversizedCount > 0) {
            const notices = [];
            if (nonImageCount > 0) notices.push(`${nonImageCount} unsupported`);
            if (oversizedCount > 0) notices.push(`${oversizedCount} oversized`);
            setErrorMsg(`Uploading ${files.length} file(s). Skipped ${notices.join(' and ')}.`);
        } else {
            setErrorMsg('');
        }

        const newEntries = files.map((file) => ({
            id: buildQueueId(),
            name: file.name,
            file,
            previewUrl: URL.createObjectURL(file),
            status: 'queued',
            error: null,
        }));

        setUploadSession((prev) => {
            const existingIncomplete = prev.entries.filter((e) => e.status !== 'success');
            const mergedEntries = [...existingIncomplete, ...newEntries];
            return {
                active: true,
                total: mergedEntries.length,
                completed: 0,
                failed: 0,
                entries: mergedEntries,
            };
        });

        setTimeout(() => {
            runUploadQueue();
        }, 20);
    }, [runUploadQueue]);

    // Handle initialFiles passed from layout/dashboard
    useEffect(() => {
        if (!initialFiles.length) return;
        startDirectUpload(initialFiles);
        onInitialFilesConsumed?.();
    }, [initialFiles, onInitialFilesConsumed, startDirectUpload]);

    const retryFailedUploads = () => {
        setUploadSession((prev) => {
            const resetEntries = prev.entries.map((e) =>
                e.status === 'error' ? { ...e, status: 'queued', error: null } : e,
            );
            return {
                ...prev,
                active: true,
                failed: 0,
                entries: resetEntries,
            };
        });
        setTimeout(() => runUploadQueue(), 30);
    };

    const dismissUploadSession = () => {
        setUploadSession({
            active: false,
            total: 0,
            completed: 0,
            failed: 0,
            entries: [],
        });
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
                if (target.bucket === MOODBOARD_BUCKET && target.path) {
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

    // Auto-save tag addition on Enter or button click
    const addLibraryTag = async (item) => {
        const draft = libraryTagDrafts[item.id] || '';
        if (!draft.trim()) return;

        // Support single tag or comma-separated tags e.g. "silhouette, people"
        const enteredTags = draft
            .split(',')
            .map((t) => normalizeTag(t))
            .filter(Boolean);

        if (!enteredTags.length) return;

        const currentTags = normalizeTagArray(item.tags);
        const newTagsToAdd = enteredTags.filter(
            (t) => !currentTags.some((existing) => existing.toLowerCase() === t),
        );

        if (newTagsToAdd.length === 0) {
            setLibraryTagDrafts((previous) => ({ ...previous, [item.id]: '' }));
            return;
        }

        const nextTags = [...currentTags, ...newTagsToAdd];

        // Optimistic update
        setSavingTagItemIds((previous) => [...previous, item.id]);
        setItems((previous) =>
            previous.map((entry) => (entry.id === item.id ? { ...entry, tags: nextTags } : entry)),
        );
        setLibraryTagDrafts((previous) => ({ ...previous, [item.id]: '' }));

        const { error } = await supabase
            .from('moodboard_items')
            .update({ tags: nextTags })
            .eq('id', item.id);

        if (error) {
            console.error('Failed to add tag:', error);
            setItems((previous) =>
                previous.map((entry) => (entry.id === item.id ? { ...entry, tags: currentTags } : entry)),
            );
            setErrorMsg(error.message || 'Failed to add tag.');
        } else {
            setErrorMsg('');
        }

        setSavingTagItemIds((previous) => previous.filter((id) => id !== item.id));
    };

    // Auto-save tag removal on tag pill cross click
    const removeLibraryTag = async (item, tagToRemove) => {
        const currentTags = normalizeTagArray(item.tags);
        const nextTags = currentTags.filter((t) => t.toLowerCase() !== tagToRemove.toLowerCase());

        setSavingTagItemIds((previous) => [...previous, item.id]);
        setItems((previous) =>
            previous.map((entry) => (entry.id === item.id ? { ...entry, tags: nextTags } : entry)),
        );

        const { error } = await supabase
            .from('moodboard_items')
            .update({ tags: nextTags })
            .eq('id', item.id);

        if (error) {
            console.error('Failed to remove tag:', error);
            setItems((previous) =>
                previous.map((entry) => (entry.id === item.id ? { ...entry, tags: currentTags } : entry)),
            );
            setErrorMsg(error.message || 'Failed to remove tag.');
        } else {
            setErrorMsg('');
        }

        setSavingTagItemIds((previous) => previous.filter((id) => id !== item.id));
    };

    // Progress computation
    const uploadTotal = uploadSession.total || 0;
    const uploadCompleted = uploadSession.completed || 0;
    const uploadFailed = uploadSession.failed || 0;
    const uploadRemaining = Math.max(0, uploadTotal - uploadCompleted - uploadFailed);
    const uploadPercentage = uploadTotal > 0 ? Math.round((uploadCompleted / uploadTotal) * 100) : 0;

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
                            startDirectUpload(event.dataTransfer.files);
                        }}
                    >
                        <div className="dropzone-copy">
                            <strong>Drop moodboard images here</strong>
                            <span>Images upload directly. Tagging is an instant auto-save feature right on the cards below.</span>
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
                                startDirectUpload(event.target.files);
                                event.target.value = '';
                            }}
                        />
                    </div>

                    {/* Resized, high-contrast, prominent stats */}
                    <div className="upload-stats" aria-label="Moodboard totals">
                        <div className="upload-stat">
                            <span className="upload-stat-number">{items.length}</span>
                            <span className="upload-stat-label">Images</span>
                        </div>
                        <div className="upload-stat">
                            <span className="upload-stat-number">{uniqueTagCount}</span>
                            <span className="upload-stat-label">Unique Tags</span>
                        </div>
                    </div>
                </div>

                {/* Visible Real-Time Progress Bar & Upload Pipeline */}
                {uploadSession.entries.length > 0 && (
                    <div className={`upload-progress-card ${uploadSession.active ? 'is-active' : 'is-complete'} ${uploadFailed > 0 ? 'has-errors' : ''}`}>
                        <div className="upload-progress-header">
                            <div className="upload-progress-headline-wrap">
                                {uploadSession.active ? (
                                    <Loader2 size={18} className="upload-indicator-spin" />
                                ) : uploadFailed > 0 ? (
                                    <AlertCircle size={18} className="upload-indicator-error" />
                                ) : (
                                    <Check size={18} className="upload-indicator-check" />
                                )}
                                <div>
                                    <h4 className="upload-progress-title">
                                        {uploadSession.active
                                            ? `Uploading ${uploadCompleted + 1 > uploadTotal ? uploadTotal : uploadCompleted + 1} of ${uploadTotal} image${uploadTotal === 1 ? '' : 's'}...`
                                            : uploadFailed > 0
                                            ? `Uploaded ${uploadCompleted} of ${uploadTotal} image${uploadTotal === 1 ? '' : 's'} (${uploadFailed} failed)`
                                            : `All ${uploadTotal} image${uploadTotal === 1 ? '' : 's'} uploaded successfully!`}
                                    </h4>
                                    <p className="upload-progress-subtext">
                                        {uploadSession.active
                                            ? `${uploadRemaining} image${uploadRemaining === 1 ? '' : 's'} remaining • Uploaded images appear in your library immediately`
                                            : uploadFailed > 0
                                            ? `${uploadFailed} image(s) encountered an error. Click retry to attempt uploading again.`
                                            : 'Everything is live in your moodboard library. Tag any image below anytime.'}
                                    </p>
                                </div>
                            </div>

                            <div className="upload-progress-actions">
                                {uploadFailed > 0 && !uploadSession.active && (
                                    <button
                                        type="button"
                                        className="upload-progress-action-btn retry"
                                        onClick={retryFailedUploads}
                                    >
                                        <RotateCw size={13} aria-hidden="true" />
                                        <span>Retry failed</span>
                                    </button>
                                )}
                                {!uploadSession.active && (
                                    <button
                                        type="button"
                                        className="upload-progress-action-btn dismiss"
                                        onClick={dismissUploadSession}
                                        aria-label="Dismiss progress bar"
                                        title="Dismiss"
                                    >
                                        <X size={15} aria-hidden="true" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Visible Progress Bar Track */}
                        <div className="upload-progress-bar-container">
                            <div
                                className="upload-progress-bar-track"
                                role="progressbar"
                                aria-valuenow={uploadPercentage}
                                aria-valuemin="0"
                                aria-valuemax="100"
                                aria-label="Upload progress"
                            >
                                <div
                                    className="upload-progress-bar-fill"
                                    style={{
                                        width: `${Math.max(uploadPercentage, uploadSession.active ? 8 : 0)}%`,
                                    }}
                                />
                            </div>
                            <span className="upload-progress-percentage-label">
                                {uploadPercentage}%
                            </span>
                        </div>

                        {/* Mini Live Upload Thumbnail Strip */}
                        <div className="upload-thumbnail-strip" aria-label="Uploading files status">
                            {uploadSession.entries.map((entry) => (
                                <div
                                    key={entry.id}
                                    className={`upload-thumb-card status-${entry.status}`}
                                    title={`${entry.name} (${entry.status})`}
                                >
                                    <img src={entry.previewUrl} alt={entry.name} />
                                    <div className="upload-thumb-status-badge">
                                        {entry.status === 'uploading' && <Loader2 size={11} className="thumb-spin" />}
                                        {entry.status === 'success' && <Check size={11} />}
                                        {entry.status === 'error' && <X size={11} />}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            {notice && <div className="manager-notice success">{notice}</div>}
            {errorMsg && <div className="manager-notice error">{errorMsg}</div>}

            <section className="library-panel">
                <div className="library-header-row">
                    <h4>Moodboard Library ({items.length})</h4>
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
                            const displaySrc = localPreviewsRef.current[item.id] || item.image_url;
                            const isFailed = imageLoadErrors[item.id] && !localPreviewsRef.current[item.id];
                            const isGif = isGifAsset(item);

                            return (
                                <article key={item.id} className={`library-card ${item.published ? '' : 'is-hidden'}`}>
                                    <div className="library-image-wrap">
                                        <img
                                            className="library-image"
                                            src={displaySrc}
                                            alt={item.title || 'Moodboard image'}
                                            loading="lazy"
                                            onError={(e) => {
                                                if (localPreviewsRef.current[item.id] && e.currentTarget.src !== localPreviewsRef.current[item.id]) {
                                                    e.currentTarget.src = localPreviewsRef.current[item.id];
                                                } else {
                                                    setImageLoadErrors((prev) => ({ ...prev, [item.id]: true }));
                                                }
                                            }}
                                        />

                                        {/* GIF badge for animated GIF assets */}
                                        {isGif && (
                                            <span className="library-gif-badge" title="Animated GIF image">GIF</span>
                                        )}

                                        {isFailed && (
                                            <div className="library-image-fallback">
                                                <AlertCircle size={22} className="fallback-alert-icon" />
                                                <span>Loading image...</span>
                                                <button
                                                    type="button"
                                                    className="fallback-retry-btn"
                                                    onClick={() => {
                                                        setImageLoadErrors((prev) => {
                                                            const copy = { ...prev };
                                                            delete copy[item.id];
                                                            return copy;
                                                        });
                                                    }}
                                                >
                                                    <RotateCw size={12} /> Reload
                                                </button>
                                            </div>
                                        )}

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

                                    {/* Redesigned Clean Tag Area (Add tag input first, tag list below) */}
                                    <div className="library-meta">
                                        {/* Clean, compact tag input pill at top of card meta */}
                                        <div className="library-tag-input-pill">
                                            <input
                                                className="library-tag-input"
                                                value={libraryTagDrafts[item.id] || ''}
                                                placeholder="Add tag..."
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
                                            {savingTagItemIds.includes(item.id) ? (
                                                <span className="tag-enter-badge saving" title="Saving tag...">
                                                    <Loader2 size={11} className="tag-save-spin" />
                                                </span>
                                            ) : (
                                                <kbd className="tag-enter-badge" title="Press Enter to auto-save">
                                                    <CornerDownLeft size={11} strokeWidth={2.4} aria-hidden="true" />
                                                </kbd>
                                            )}
                                        </div>

                                        {/* Tag chips below input in uniform container */}
                                        <div className="library-tag-list" aria-label="Image tags">
                                            {tags.length > 0 ? (
                                                tags.map((tag) => (
                                                    <span key={`${item.id}-${tag}`} className="library-tag-chip">
                                                        <span className="library-tag-name">{tag}</span>
                                                        <button
                                                            type="button"
                                                            className="library-tag-remove-btn"
                                                            onClick={() => removeLibraryTag(item, tag)}
                                                            title={`Remove "${tag}"`}
                                                            aria-label={`Remove tag ${tag}`}
                                                            disabled={savingTagItemIds.includes(item.id)}
                                                        >
                                                            <X size={10} aria-hidden="true" />
                                                        </button>
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="library-tags-empty">No tags yet</span>
                                            )}
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
                    transition: border-color 0.16s ease, background 0.16s ease;
                }

                .moodboard-view-link:hover {
                    border-color: rgba(255, 255, 255, 0.4);
                    background: rgba(255, 255, 255, 0.04);
                }

                .upload-panel,
                .library-panel {
                    border: 1px solid var(--border-subtle);
                    border-radius: 14px;
                    background: var(--bg-surface);
                    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
                    padding: 1.15rem;
                }

                .upload-overview {
                    display: grid;
                    grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
                    gap: 1.15rem;
                    align-items: stretch;
                }

                .dropzone {
                    border: 2px dashed var(--border-strong);
                    border-radius: 12px;
                    min-height: 150px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 1.2rem;
                    padding: 1.25rem 1.4rem;
                    transition: all 0.18s ease;
                    background: var(--bg-canvas);
                }

                /* =========================================
                   Prominent, High-Contrast Stats
                   ========================================= */
                .upload-stats {
                    min-width: 0;
                    min-height: 150px;
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    align-items: center;
                    border: 1px solid var(--border-subtle);
                    border-radius: 12px;
                    background: var(--bg-canvas);
                }

                .upload-stat {
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    gap: 0.35rem;
                    padding: 1.25rem 1rem;
                }

                .upload-stat + .upload-stat {
                    border-left: 1px solid var(--border-subtle);
                }

                .upload-stat-number {
                    color: var(--text-primary);
                    font-size: clamp(2.8rem, 4.8vw, 4.2rem);
                    font-weight: 800;
                    line-height: 0.95;
                    letter-spacing: -0.04em;
                    font-variant-numeric: tabular-nums;
                }

                .upload-stat-label {
                    color: var(--text-secondary);
                    font-size: 0.78rem;
                    font-weight: 700;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    line-height: 1.2;
                    white-space: nowrap;
                }

                .dropzone.dragging {
                    border-color: var(--color-brand-red, #ea2a10);
                    background: rgba(234, 42, 16, 0.08);
                    transform: translateY(-1px);
                }

                .dropzone-copy {
                    display: flex;
                    flex-direction: column;
                    gap: 0.35rem;
                }

                .dropzone-copy strong {
                    font-size: 0.98rem;
                    color: var(--text-primary);
                    font-weight: 700;
                }

                .dropzone-copy span {
                    color: var(--text-secondary);
                    font-size: 0.8rem;
                    line-height: 1.35;
                }

                .dropzone-btn {
                    border: 1px solid var(--border-strong);
                    background: var(--bg-surface);
                    color: var(--text-primary);
                    border-radius: 8px;
                    min-height: 42px;
                    padding: 0 1.15rem;
                    cursor: pointer;
                    font-family: var(--font-ui);
                    font-size: 0.76rem;
                    font-weight: 650;
                    text-transform: uppercase;
                    white-space: nowrap;
                    transition: all 0.16s ease;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
                }

                .dropzone-btn:hover {
                    background: var(--bg-surface-hover);
                    border-color: var(--text-primary);
                }

                /* =========================================
                   Visible Upload Progress Card
                   ========================================= */
                .upload-progress-card {
                    margin-top: 1rem;
                    border: 1px solid rgba(234, 42, 16, 0.35);
                    border-radius: 12px;
                    background: linear-gradient(180deg, rgba(234, 42, 16, 0.06) 0%, var(--bg-surface) 100%);
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
                    padding: 1rem 1.15rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.85rem;
                    animation: progressSlideDown 0.22s ease-out;
                }

                .upload-progress-card.is-complete {
                    border-color: rgba(44, 198, 137, 0.35);
                    background: linear-gradient(180deg, rgba(44, 198, 137, 0.06) 0%, var(--bg-surface) 100%);
                }

                .upload-progress-card.has-errors {
                    border-color: rgba(255, 107, 107, 0.4);
                    background: linear-gradient(180deg, rgba(255, 107, 107, 0.08) 0%, var(--bg-surface) 100%);
                }

                @keyframes progressSlideDown {
                    from {
                        opacity: 0;
                        transform: translateY(-8px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .upload-progress-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 1rem;
                }

                .upload-progress-headline-wrap {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .upload-indicator-spin {
                    color: #ea2a10;
                    animation: spin 0.9s linear infinite;
                    flex-shrink: 0;
                }

                .upload-indicator-check {
                    color: #2cc689;
                    flex-shrink: 0;
                }

                .upload-indicator-error {
                    color: #ff6b6b;
                    flex-shrink: 0;
                }

                .upload-progress-title {
                    margin: 0;
                    font-size: 0.95rem;
                    font-weight: 650;
                    color: var(--text-primary);
                }

                .upload-progress-subtext {
                    margin: 0.15rem 0 0;
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                }

                .upload-progress-actions {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .upload-progress-action-btn {
                    border: 1px solid var(--border-subtle);
                    background: var(--bg-surface);
                    color: var(--text-primary);
                    border-radius: 6px;
                    padding: 0.35rem 0.65rem;
                    font-size: 0.72rem;
                    font-family: var(--font-ui);
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.35rem;
                    transition: all 0.15s ease;
                }

                .upload-progress-action-btn.retry:hover {
                    background: rgba(234, 42, 16, 0.14);
                    border-color: rgba(234, 42, 16, 0.6);
                    color: #ff8570;
                }

                .upload-progress-action-btn.dismiss {
                    padding: 0.35rem;
                    color: var(--text-secondary);
                }

                .upload-progress-action-btn.dismiss:hover {
                    color: var(--text-primary);
                    background: var(--bg-surface-hover);
                }

                /* Visual Progress Bar */
                .upload-progress-bar-container {
                    display: flex;
                    align-items: center;
                    gap: 0.85rem;
                }

                .upload-progress-bar-track {
                    flex: 1;
                    height: 8px;
                    background: var(--bg-surface-hover);
                    border-radius: 999px;
                    overflow: hidden;
                    position: relative;
                }

                .upload-progress-bar-fill {
                    height: 100%;
                    border-radius: 999px;
                    background: linear-gradient(90deg, #ea2a10 0%, #ff5733 60%, #ff8a65 100%);
                    transition: width 0.26s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    overflow: hidden;
                }

                .upload-progress-card.is-complete .upload-progress-bar-fill {
                    background: linear-gradient(90deg, #2cc689 0%, #4ae3a4 100%);
                }

                .upload-progress-card.is-active .upload-progress-bar-fill::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
                    animation: shimmer 1.5s infinite;
                }

                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }

                .upload-progress-percentage-label {
                    font-size: 0.78rem;
                    font-weight: 700;
                    font-family: var(--font-mono, monospace);
                    color: var(--text-primary);
                    min-width: 38px;
                    text-align: right;
                }

                /* Mini Thumbnail Strip */
                .upload-thumbnail-strip {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    overflow-x: auto;
                    padding-bottom: 0.2rem;
                }

                .upload-thumb-card {
                    position: relative;
                    width: 44px;
                    height: 44px;
                    flex-shrink: 0;
                    border-radius: 6px;
                    overflow: hidden;
                    border: 1px solid var(--border-subtle);
                    background: var(--bg-surface-hover);
                }

                .upload-thumb-card img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .upload-thumb-status-badge {
                    position: absolute;
                    bottom: 2px;
                    right: 2px;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: rgba(0, 0, 0, 0.85);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #fff;
                }

                .upload-thumb-card.status-uploading .upload-thumb-status-badge {
                    background: #ea2a10;
                }

                .upload-thumb-card.status-success .upload-thumb-status-badge {
                    background: #2cc689;
                }

                .upload-thumb-card.status-error .upload-thumb-status-badge {
                    background: #ff4d4d;
                }

                .thumb-spin {
                    animation: spin 0.85s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .manager-notice {
                    border-radius: 10px;
                    padding: 0.75rem 0.9rem;
                    font-size: 0.82rem;
                }

                .manager-notice.success {
                    border: 1px solid rgba(44, 198, 137, 0.5);
                    background: rgba(44, 198, 137, 0.14);
                    color: #2cc689;
                }

                .manager-notice.error {
                    border: 1px solid rgba(255, 107, 107, 0.5);
                    background: rgba(255, 107, 107, 0.14);
                    color: #ff6b6b;
                }

                /* =========================================
                   Library Section & Cards
                   ========================================= */
                .library-header-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 0.75rem;
                }

                .library-header-row h4 {
                    margin: 0;
                    font-size: 1.05rem;
                    font-weight: 700;
                    color: var(--text-primary);
                }

                .library-search {
                    max-width: 320px;
                    width: 100%;
                    border: 1px solid var(--border-subtle);
                    background: var(--bg-canvas);
                    color: var(--text-primary);
                    border-radius: 8px;
                    min-height: 36px;
                    padding: 0.45rem 0.75rem;
                    font-size: 0.78rem;
                    transition: border-color 0.16s ease, background 0.16s ease;
                }

                .library-search:focus {
                    outline: none;
                    border-color: #ea2a10;
                    background: var(--bg-surface);
                }

                .library-loading,
                .library-empty {
                    padding: 1.5rem 0.25rem;
                    color: var(--text-secondary);
                    font-size: 0.84rem;
                }

                .library-grid {
                    margin-top: 1rem;
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
                    gap: 0.85rem;
                }

                /* Crisp card without muddy background, uniform column layout */
                .library-card {
                    display: flex;
                    flex-direction: column;
                    border: 1px solid var(--border-subtle);
                    border-radius: 12px;
                    overflow: hidden;
                    background: var(--bg-surface);
                    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
                    transition: border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
                }

                .library-card:hover {
                    border-color: var(--border-strong);
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
                }

                .library-image-wrap {
                    position: relative;
                    overflow: hidden;
                    background: var(--bg-surface-hover);
                    border-bottom: 1px solid var(--border-subtle);
                    flex-shrink: 0;
                }

                .library-image {
                    width: 100%;
                    aspect-ratio: 4 / 5;
                    object-fit: cover;
                    display: block;
                    transition: opacity 0.2s ease, filter 0.2s ease, transform 0.2s ease;
                }

                .library-card:hover .library-image {
                    transform: scale(1.02);
                }

                .library-card.is-hidden .library-image {
                    opacity: 0.42;
                    filter: grayscale(0.75);
                }

                /* Animated GIF Badge */
                .library-gif-badge {
                    position: absolute;
                    bottom: 0.5rem;
                    right: 0.5rem;
                    z-index: 2;
                    background: rgba(15, 15, 15, 0.82);
                    color: #fff;
                    font-size: 0.6rem;
                    font-weight: 800;
                    letter-spacing: 0.06em;
                    padding: 0.18rem 0.42rem;
                    border-radius: 4px;
                    border: 1px solid rgba(255, 255, 255, 0.24);
                    backdrop-filter: blur(6px);
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
                }

                /* Image Fallback & Retry */
                .library-image-fallback {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 0.45rem;
                    background: var(--bg-surface);
                    color: var(--text-secondary);
                    font-size: 0.74rem;
                    padding: 1rem;
                    text-align: center;
                }

                .fallback-alert-icon {
                    color: #ff9800;
                }

                .fallback-retry-btn {
                    margin-top: 0.25rem;
                    border: 1px solid var(--border-subtle);
                    background: var(--bg-surface-hover);
                    color: var(--text-primary);
                    border-radius: 6px;
                    padding: 0.3rem 0.65rem;
                    font-size: 0.7rem;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.3rem;
                    transition: all 0.15s ease;
                }

                .fallback-retry-btn:hover {
                    background: var(--bg-surface);
                    border-color: var(--text-primary);
                }

                .library-remove-btn,
                .library-visibility-btn {
                    position: absolute;
                    top: 0.6rem;
                    z-index: 2;
                    min-height: 28px;
                    border: 1px solid rgba(255, 255, 255, 0.24);
                    background: rgba(15, 15, 15, 0.78);
                    color: rgba(255, 255, 255, 0.95);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.22);
                    backdrop-filter: blur(8px);
                    cursor: pointer;
                }

                .library-remove-btn {
                    left: 0.6rem;
                    width: 28px;
                    padding: 0;
                    border-radius: 50%;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    color: #ffb2b2;
                }

                .library-remove-btn:hover {
                    border-color: rgba(255, 107, 107, 0.8);
                    background: rgba(90, 15, 15, 0.92);
                    color: #fff;
                }

                .library-visibility-btn {
                    right: 0.6rem;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.35rem;
                    padding: 0 0.55rem;
                    border-radius: 6px;
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
                    border-color: rgba(255, 255, 255, 0.6);
                }

                /* =========================================
                   Clean, Uniform Tag Area (Zero Muddy Color)
                   ========================================= */
                .library-meta {
                    padding: 0.6rem 0.7rem;
                    background: var(--bg-surface);
                    display: flex;
                    flex-direction: column;
                    gap: 0.45rem;
                    flex: 1;
                }

                /* Compact Tag Input Pill - Fixed 28px height, uniform position across all cards */
                .library-tag-input-pill {
                    display: flex;
                    align-items: center;
                    height: 28px;
                    padding: 0 0.35rem 0 0.6rem;
                    border-radius: 6px;
                    border: 1px solid var(--border-subtle);
                    background: var(--bg-canvas);
                    transition: border-color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
                    flex-shrink: 0;
                }

                .library-tag-input-pill:focus-within {
                    border-color: #ea2a10;
                    background: var(--bg-surface);
                    box-shadow: 0 0 0 1px rgba(234, 42, 16, 0.22);
                }

                .library-tag-input {
                    flex: 1;
                    min-width: 0;
                    height: 100%;
                    padding: 0;
                    border: none;
                    background: transparent;
                    color: var(--text-primary);
                    font-size: 0.72rem;
                    font-family: inherit;
                    line-height: normal;
                }

                .library-tag-input::placeholder {
                    color: var(--text-tertiary);
                    font-size: 0.69rem;
                    opacity: 0.85;
                }

                .library-tag-input:focus {
                    outline: none;
                }

                /* Precision Aligned Enter Symbol Badge */
                .tag-enter-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 18px;
                    height: 18px;
                    border-radius: 4px;
                    background: var(--bg-surface-hover);
                    border: 1px solid var(--border-subtle);
                    color: var(--text-tertiary);
                    padding: 0;
                    flex-shrink: 0;
                    margin-left: 0.3rem;
                    transition: all 0.14s ease;
                }

                .tag-enter-badge svg {
                    display: block;
                    color: currentColor;
                    margin: 0;
                }

                .library-tag-input-pill:focus-within .tag-enter-badge {
                    border-color: rgba(234, 42, 16, 0.35);
                    color: #ea2a10;
                    background: rgba(234, 42, 16, 0.08);
                }

                .tag-enter-badge.saving {
                    border-color: transparent;
                    background: transparent;
                }

                .tag-save-spin {
                    animation: spin 0.85s linear infinite;
                    color: #ea2a10;
                    flex-shrink: 0;
                }

                /* Fixed-height Tags Container: 1 or 2 lines both fit cleanly without altering card size */
                .library-tag-list {
                    min-height: 44px;
                    max-height: 48px;
                    overflow-y: auto;
                    display: flex;
                    flex-wrap: wrap;
                    align-content: flex-start;
                    gap: 0.28rem;
                    scrollbar-width: thin;
                    scrollbar-color: var(--border-subtle) transparent;
                }

                .library-tag-list::-webkit-scrollbar {
                    width: 3px;
                }

                .library-tag-list::-webkit-scrollbar-thumb {
                    background: var(--border-subtle);
                    border-radius: 3px;
                }

                /* Compact, attractive tag chip */
                .library-tag-chip {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.22rem;
                    padding: 0.16rem 0.42rem;
                    border-radius: 5px;
                    background: var(--bg-surface-hover);
                    border: 1px solid var(--border-subtle);
                    font-size: 0.68rem;
                    line-height: 1.15;
                    color: var(--text-primary);
                    font-weight: 500;
                    transition: all 0.14s ease;
                    height: 20px;
                    box-sizing: border-box;
                }

                .library-tag-chip:hover {
                    border-color: var(--border-strong);
                }

                .library-tag-name {
                    white-space: nowrap;
                    max-width: 130px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .library-tag-remove-btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 12px;
                    height: 12px;
                    padding: 0;
                    border: none;
                    background: transparent;
                    color: var(--text-tertiary);
                    border-radius: 50%;
                    cursor: pointer;
                    transition: all 0.14s ease;
                    margin-left: 0.05rem;
                    flex-shrink: 0;
                }

                .library-tag-remove-btn:hover {
                    color: #ff4d4d;
                    background: rgba(255, 77, 77, 0.14);
                }

                .library-tags-empty {
                    color: var(--text-tertiary);
                    font-size: 0.68rem;
                    font-style: italic;
                    opacity: 0.7;
                    line-height: 20px;
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
                        grid-template-columns: minmax(0, 1.1fr) minmax(260px, 0.9fr);
                    }
                }

                @media (max-width: 980px) {
                    .dropzone {
                        flex-direction: column;
                        align-items: flex-start;
                    }

                    .upload-stat {
                        gap: 0.3rem;
                        padding: 1.1rem 0.75rem;
                    }

                    .upload-stat-number {
                        font-size: clamp(2.5rem, 6vw, 3.4rem);
                    }

                    .upload-stat-label {
                        font-size: 0.72rem;
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
                        min-height: 110px;
                    }

                    .library-header-row {
                        flex-direction: column;
                        align-items: stretch;
                    }

                    .library-search {
                        max-width: none;
                    }

                    .library-grid {
                        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
                        gap: 0.65rem;
                    }
                }
            `}</style>
        </section>
    );
}
