import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    rectSortingStrategy,
    sortableKeyboardCoordinates,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    AlertCircle,
    CalendarClock,
    Check,
    CheckCircle2,
    ChevronRight,
    FolderOpen,
    GripVertical,
    Images,
    Instagram,
    LayoutGrid,
    List,
    LoaderCircle,
    Pencil,
    Plus,
    RefreshCw,
    RotateCcw,
    Search,
    Send,
    Shuffle,
    Trash2,
    Upload,
    X,
} from 'lucide-react';
import AdminPageHeader from './AdminPageHeader';
import './instagram-publisher.css';

const POST_FORMATS = {
    portrait: { label: 'Portrait', detail: '4:5 · 1080×1350', ratio: '4 / 5' },
    square: { label: 'Square', detail: '1:1 · 1080×1080', ratio: '1 / 1' },
    landscape: { label: 'Landscape', detail: '1.91:1 · 1080×566', ratio: '1.91 / 1' },
    reel: { label: 'Reel', detail: '9:16 · 1080×1920', ratio: '9 / 16' },
};
const defaultCrop = () => ({ zoom: 1, positionX: 0.5, positionY: 0.5, fit: 'cover' });
const emptyComposer = () => ({ media: [], format: 'portrait', caption: '', hashtags: '', mode: 'schedule', date: '', time: '' });
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

const readJson = async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(payload.error || `Request failed (${response.status}).`);
        error.payload = payload;
        throw error;
    }
    return payload;
};

const localDateTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return { date: '', time: '' };
    const pad = (number) => String(number).padStart(2, '0');
    return {
        date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
        time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    };
};

const defaultSchedule = () => {
    const date = new Date(Date.now() + 60 * 60 * 1000);
    date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
    return localDateTime(date);
};

const formatSchedule = (value) => {
    if (!value) return 'Not scheduled';
    const date = new Date(value);
    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
    }).format(date);
};

const statusLabel = (status) => ({
    draft: 'Draft', scheduled: 'Scheduled', publishing: 'Publishing…',
    published: 'Published ✓', failed: 'Failed',
}[status] || status);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const asPickerItem = (file, rendition = 'auto') => {
    const variants = file.variants || {};
    const instagramAsset = file.instagramAsset || null;
    const requested = rendition === 'original' ? null : variants[rendition];
    const automatic = variants['1600'] || variants['800'];
    const display = requested || (rendition === 'auto' ? automatic : null);
    const originalUrl = file.publicUrl || file.originalUrl || file.url;
    const sourceMimeType = String(file.mimeType || '').toLowerCase();
    const isVideo = sourceMimeType.startsWith('video/');
    const effectiveId = instagramAsset?.id || file.id;
    const effectiveMimeType = String(instagramAsset?.mimeType || file.mimeType || '').toLowerCase();
    const catalogued = file.catalogued !== false && UUID_PATTERN.test(String(effectiveId || ''));
    const instagramCompatible = ['image/jpeg', 'image/jpg', 'video/mp4'].includes(effectiveMimeType);
    const isOriginal = /^(photos\/originals|originals)\//.test(String(file.objectKey || ''));
    const canPrepare = isOriginal && (
        ['image/jpeg', 'image/jpg', 'image/webp', 'image/png', 'image/avif'].includes(sourceMimeType)
        || sourceMimeType.startsWith('video/')
    );
    return {
        ...file,
        id: effectiveId,
        sourceId: file.sourceId || file.id,
        name: file.name || file.originalFilename || file.objectKey?.split('/').pop() || 'Photograph',
        folder: file.folder ?? file.objectKey?.split('/').slice(0, -1).join('/') ?? '',
        originalUrl,
        url: display?.url || originalUrl,
        thumbnailUrl: variants['800']?.url || display?.url || file.thumbnailUrl || originalUrl,
        width: display?.width || file.width,
        height: display?.height || file.height,
        altText: file.altText || file.name,
        rendition: display?.key || 'original',
        variants,
        mediaKind: isVideo ? 'video' : 'image',
        catalogued,
        instagramCompatible,
        canPrepare,
        publishable: catalogued && instagramCompatible,
        crop: file.crop || defaultCrop(),
    };
};

function MediaVisual({ item, controls = false, ...props }) {
    if (item?.mediaKind === 'video' || String(item?.mimeType || '').startsWith('video/')) {
        return <video src={item.url || item.publicUrl} muted playsInline controls={controls} preload="metadata" {...props} />;
    }
    return <img src={item?.thumbnailUrl || item?.url} alt={item?.altText || item?.name || ''} loading="lazy" {...props} />;
}

function SortablePhoto({ item, index, onRemove }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    return (
        <div
            ref={setNodeRef}
            className={`ig-selected-photo ${isDragging ? 'is-dragging' : ''}`}
            style={{ transform: CSS.Transform.toString(transform), transition }}
        >
            <MediaVisual item={item} />
            <span className="ig-photo-order">{String(index + 1).padStart(2, '0')}</span>
            <button type="button" className="ig-photo-drag" aria-label={`Reorder ${item.name || 'photograph'}`} {...attributes} {...listeners}>
                <GripVertical size={16} />
            </button>
            <button type="button" className="ig-photo-remove" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.name || 'photograph'}`}>
                <X size={14} />
            </button>
        </div>
    );
}

function MediaPicker({ accessToken, current, onCancel, onConfirm }) {
    const [files, setFiles] = useState([]);
    const [folders, setFolders] = useState([]);
    const [selected, setSelected] = useState(() => new Set(current.map((item) => item.id)));
    const [knownItems, setKnownItems] = useState(() => new Map(current.map((item) => [item.id, item])));
    const [query, setQuery] = useState('');
    const [currentFolder, setCurrentFolder] = useState('');
    const [source, setSource] = useState('library');
    const [selectionMode, setSelectionMode] = useState('multiple');
    const [viewMode, setViewMode] = useState('grid');
    const [viewPreferenceReady, setViewPreferenceReady] = useState(false);
    const [rendition, setRendition] = useState('auto');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [preparing, setPreparing] = useState(() => new Set());
    const [selectionError, setSelectionError] = useState('');
    const [uploading, setUploading] = useState(false);
    const uploadInput = useRef(null);

    const load = useCallback(async ({ folder = currentFolder, search = query, nextSource = source } = {}) => {
        setLoading(true);
        setError('');
        try {
            let endpoint;
            if (nextSource === 'random') {
                endpoint = '/api/admin/social/media?random=1';
            } else if (search.trim()) {
                const params = new URLSearchParams({ q: search.trim() });
                if (folder) params.set('folder', folder);
                endpoint = `/api/admin/media/search?${params}`;
            } else {
                const params = new URLSearchParams();
                if (folder) params.set('folder', folder);
                endpoint = `/api/admin/media?${params}`;
            }
            const response = await fetch(endpoint, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            const payload = await readJson(response);
            const nextFiles = payload.items || payload.files || [];
            setFiles(nextFiles);
            setFolders(nextSource === 'library' ? (payload.folders || []) : []);
            setKnownItems((previous) => {
                const next = new Map(previous);
                nextFiles.forEach((file) => {
                    const item = asPickerItem(file, rendition);
                    if (item.id) next.set(item.id, item);
                });
                return next;
            });
        } catch (loadError) {
            setError(loadError.message);
        } finally {
            setLoading(false);
        }
    }, [accessToken, currentFolder, query, rendition, source]);

    useEffect(() => {
        const timer = window.setTimeout(() => load(), query && source === 'library' ? 250 : 0);
        return () => window.clearTimeout(timer);
    }, [load]);

    const items = useMemo(() => files
        .filter((file) => /^(image|video)\//.test(String(file.mimeType || '')))
        .map((file) => asPickerItem(file, rendition)), [files, rendition]);

    const uploadVideos = async (event) => {
        const selectedFiles = [...(event.target.files || [])];
        event.target.value = '';
        if (!selectedFiles.length) return;
        setUploading(true);
        setSelectionError('');
        try {
            for (const file of selectedFiles) {
                if (!file.type.startsWith('video/')) throw new Error(`${file.name} is not a video.`);
                const signed = await readJson(await fetch('/api/admin/media/presign', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
                    body: JSON.stringify({
                        filename: file.name,
                        contentType: file.type,
                        size: file.size,
                        folder: 'photos/originals/instagram-uploads',
                    }),
                }));
                const uploaded = await fetch(signed.uploadUrl, {
                    method: 'PUT',
                    headers: signed.requiredHeaders,
                    body: file,
                });
                if (!uploaded.ok) throw new Error(`Could not upload ${file.name}.`);
                await readJson(await fetch('/api/admin/media/complete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
                    body: JSON.stringify({
                        objectKey: signed.objectKey,
                        originalFilename: file.name,
                        expectedSize: file.size,
                    }),
                }));
            }
            setSource('library');
            setCurrentFolder('photos/originals/instagram-uploads');
            setQuery('');
        } catch (uploadError) {
            setSelectionError(uploadError.message || 'Could not upload the video.');
        } finally {
            setUploading(false);
        }
    };

    useEffect(() => {
        setKnownItems((previous) => {
            const next = new Map(previous);
            items.forEach((item) => item.id && next.set(item.id, item));
            return next;
        });
        setSelected((previous) => {
            const next = new Set(previous);
            items.forEach((item) => {
                if (item.sourceId && item.sourceId !== item.id && next.has(item.sourceId)) {
                    next.delete(item.sourceId);
                    next.add(item.id);
                }
            });
            return next;
        });
    }, [items]);

    useEffect(() => {
        if (window.localStorage.getItem('instagram-media-view') === 'list') setViewMode('list');
        setViewPreferenceReady(true);
    }, []);

    useEffect(() => {
        if (viewPreferenceReady) window.localStorage.setItem('instagram-media-view', viewMode);
    }, [viewMode, viewPreferenceReady]);

    const toggle = async (item) => {
        if ((!item.publishable && !item.canPrepare) || preparing.has(item.id)) return;
        const selectedItem = selected.has(item.id) || (item.sourceId && selected.has(item.sourceId));
        if (selectedItem) {
            setSelected((previous) => {
                const next = new Set(previous);
                next.delete(item.id);
                if (item.sourceId) next.delete(item.sourceId);
                return next;
            });
            return;
        }
        if (selectionMode === 'multiple' && selected.size >= 10) return;

        let selectable = item;
        if (!item.catalogued) {
            setSelectionError('');
            setPreparing((previous) => new Set(previous).add(item.id));
            try {
                const response = await fetch('/api/admin/social/prepare-media', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify({
                        objectKey: item.objectKey,
                        originalFilename: item.name,
                        catalogueOnly: true,
                    }),
                });
                const payload = await readJson(response);
                selectable = asPickerItem({ ...item, ...payload.asset, name: item.name, catalogued: true }, rendition);
                setFiles((previous) => previous.map((file) => (
                    file.objectKey === item.objectKey ? { ...file, ...payload.asset, name: item.name, catalogued: true } : file
                )));
                setKnownItems((previous) => {
                    const next = new Map(previous);
                    next.delete(item.id);
                    if (item.sourceId) next.delete(item.sourceId);
                    next.set(selectable.id, selectable);
                    return next;
                });
            } catch (prepareError) {
                setSelectionError(prepareError.message || 'Could not prepare this photograph.');
                return;
            } finally {
                setPreparing((previous) => {
                    const next = new Set(previous);
                    next.delete(item.id);
                    return next;
                });
            }
        }

        setSelected((previous) => {
            if (selectionMode === 'single') return new Set([selectable.id]);
            const next = new Set(previous);
            next.delete(item.id);
            if (item.sourceId) next.delete(item.sourceId);
            if (next.size < 10) next.add(selectable.id);
            return next;
        });
    };

    const changeSelectionMode = (mode) => {
        setSelectionMode(mode);
        if (mode === 'single') setSelected((previous) => new Set([...previous].slice(0, 1)));
    };

    const openFolder = (path) => {
        setSource('library');
        setCurrentFolder(path);
        setQuery('');
    };

    const shuffleVisible = () => setFiles((previous) => {
        const next = [...previous];
        for (let index = next.length - 1; index > 0; index -= 1) {
            const swap = Math.floor(Math.random() * (index + 1));
            [next[index], next[swap]] = [next[swap], next[index]];
        }
        return next;
    });

    const surpriseMe = () => {
        setSource('random');
        setCurrentFolder('');
        setQuery('');
    };

    const breadcrumbs = currentFolder.split('/').filter(Boolean);

    const confirm = () => {
        const retained = current.filter((item) => selected.has(item.id));
        const retainedIds = new Set(retained.map((item) => item.id));
        const added = [...selected]
            .filter((id) => !retainedIds.has(id))
            .map((id) => knownItems.get(id))
            .filter(Boolean);
        onConfirm([...retained, ...added]);
    };

    return (
        <div className="ig-picker-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
            <section className="ig-picker" role="dialog" aria-modal="true" aria-labelledby="ig-picker-title">
                <header className="ig-picker-header">
                    <div>
                        <span className="ig-eyebrow">Media Library</span>
                        <h2 id="ig-picker-title">Choose media</h2>
                        <p>Selection never converts a file. Photo and video preparation happens only when you choose Schedule post or Post now.</p>
                    </div>
                    <button type="button" className="ig-icon-button" onClick={onCancel} aria-label="Close Media Library"><X size={18} /></button>
                </header>
                <div className="ig-picker-toolbar">
                    <div className="ig-picker-toolbar-main">
                        <label className="ig-search">
                            <Search size={16} aria-hidden="true" />
                            <input value={query} onChange={(event) => { setQuery(event.target.value); setSource('library'); }} placeholder="Search this folder and subfolders" autoFocus />
                        </label>
                        <strong>{selected.size} / {selectionMode === 'single' ? 1 : 10} selected</strong>
                    </div>
                    <div className="ig-picker-options">
                        <div className="ig-segmented" aria-label="Library view">
                            <button type="button" className={viewMode === 'grid' ? 'is-active' : ''} onClick={() => setViewMode('grid')} aria-label="Grid view" title="Grid view"><LayoutGrid size={14} /> Grid</button>
                            <button type="button" className={viewMode === 'list' ? 'is-active' : ''} onClick={() => setViewMode('list')} aria-label="List view" title="List view"><List size={14} /> List</button>
                        </div>
                        <div className="ig-segmented" aria-label="Selection mode">
                            <button type="button" className={selectionMode === 'single' ? 'is-active' : ''} onClick={() => changeSelectionMode('single')}>Single</button>
                            <button type="button" className={selectionMode === 'multiple' ? 'is-active' : ''} onClick={() => changeSelectionMode('multiple')}>Multi-select</button>
                        </div>
                        <label className="ig-rendition-select"><span>Preview</span><select value={rendition} onChange={(event) => setRendition(event.target.value)}><option value="auto">Best available</option><option value="original">Original</option><option value="800">800px variant</option><option value="1600">1600px variant</option></select></label>
                        <button type="button" className="ig-tool-button" onClick={surpriseMe}><Shuffle size={14} /> Random set</button>
                        <input ref={uploadInput} type="file" accept="video/*" multiple hidden onChange={uploadVideos} />
                        <button type="button" className="ig-tool-button" onClick={() => uploadInput.current?.click()} disabled={uploading}>
                            {uploading ? <LoaderCircle className="is-spinning" size={14} /> : <Upload size={14} />} Upload video
                        </button>
                        <button type="button" className="ig-tool-button" onClick={shuffleVisible} disabled={items.length < 2}><Shuffle size={14} /> Shuffle visible</button>
                        <button type="button" className="ig-tool-button" onClick={() => setSelected(new Set())} disabled={!selected.size}><RotateCcw size={14} /> Reset selection</button>
                    </div>
                    <nav className="ig-picker-path" aria-label="Media folder">
                        <button type="button" className={!currentFolder && source === 'library' ? 'is-current' : ''} onClick={() => openFolder('')}>All media</button>
                        {source === 'random' ? <><ChevronRight size={13} /><span>Random catalogue</span></> : breadcrumbs.map((part, index) => <React.Fragment key={`${part}-${index}`}><ChevronRight size={13} /><button type="button" className={index === breadcrumbs.length - 1 ? 'is-current' : ''} onClick={() => openFolder(breadcrumbs.slice(0, index + 1).join('/'))}>{part}</button></React.Fragment>)}
                    </nav>
                </div>
                <div className="ig-picker-body">
                    {selectionError && <div className="ig-picker-inline-error" role="alert"><AlertCircle size={16} /> {selectionError}</div>}
                    {loading && <div className="ig-picker-state"><LoaderCircle className="is-spinning" size={20} /> Loading media…</div>}
                    {!loading && error && <div className="ig-picker-state is-error"><AlertCircle size={20} /> {error}</div>}
                    {!loading && !error && items.length === 0 && (source !== 'library' || query || folders.length === 0) && <div className="ig-picker-state">No media found.</div>}
                    {!loading && !error && (items.length > 0 || (source === 'library' && !query && folders.length > 0)) && (
                        <div className={`ig-picker-grid is-${viewMode}`}>
                            {source === 'library' && !query && folders.map((folder) => (
                                <button type="button" className="ig-picker-folder" key={folder.path} onClick={() => openFolder(folder.path)}>
                                    <FolderOpen size={30} /><span>{folder.name}</span><ChevronRight size={15} />
                                </button>
                            ))}
                            {items.map((item) => {
                                const isSelected = selected.has(item.id) || (item.sourceId && selected.has(item.sourceId));
                                const isPreparing = preparing.has(item.id);
                                const isUnavailable = (!item.publishable && !item.canPrepare) || isPreparing;
                                return (
                                    <button
                                        type="button"
                                        key={item.id}
                                        className={`ig-picker-item ${isSelected ? 'is-selected' : ''} ${isUnavailable ? 'is-disabled' : ''} ${isPreparing ? 'is-preparing' : ''}`}
                                        onClick={() => toggle(item)}
                                        aria-pressed={isSelected}
                                        aria-disabled={isUnavailable}
                                        title={!item.publishable && item.canPrepare ? 'Select the original now. Its Instagram copy is made only when you schedule or post.' : !item.publishable ? 'Choose the corresponding file from the originals folder.' : `${item.folder || 'Media Library'} · ${item.rendition}`}
                                    >
                                        <MediaVisual item={item} />
                                        <span className="ig-picker-check">{isPreparing ? <LoaderCircle className="is-spinning" size={15} /> : isSelected ? <Check size={15} /> : <Plus size={15} />}</span>
                                        <span className="ig-picker-name"><strong>{item.name}</strong><small>{isPreparing ? 'Adding to library…' : item.publishable ? `${item.rendition} preview` : item.canPrepare ? item.catalogued ? 'JPEG made when posting' : 'Select original' : 'Choose from originals'}</small></span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
                <footer className="ig-picker-footer">
                    <button type="button" className="ig-button is-secondary" onClick={onCancel}>Cancel</button>
                    <button type="button" className="ig-button is-primary" onClick={confirm} disabled={selected.size === 0}>
                        Use {selected.size || ''} {selected.size === 1 ? 'item' : 'items'}
                    </button>
                </footer>
            </section>
        </div>
    );
}

function CropCanvas({ media, format, activeId, onActive, onChange, onFormat }) {
    const active = media.find((item) => item.id === activeId) || media[0];
    const drag = useRef(null);
    const crop = active?.crop || defaultCrop();
    const formatInfo = POST_FORMATS[format] || POST_FORMATS.portrait;
    const reelEligible = media.length === 1 && active?.mediaKind === 'video';

    const startDrag = (event) => {
        if (!active) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {
            x: event.clientX,
            y: event.clientY,
            positionX: crop.positionX,
            positionY: crop.positionY,
        };
    };
    const moveDrag = (event) => {
        if (!drag.current || !active) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const next = {
            ...crop,
            positionX: clamp(drag.current.positionX - ((event.clientX - drag.current.x) / bounds.width), 0, 1),
            positionY: clamp(drag.current.positionY - ((event.clientY - drag.current.y) / bounds.height), 0, 1),
        };
        onChange(active.id, next);
    };
    const endDrag = () => { drag.current = null; };

    return (
        <div className="ig-crop-editor">
            <div className="ig-format-control" aria-label="Post canvas size">
                {Object.entries(POST_FORMATS).map(([key, option]) => (
                    <button type="button" key={key} disabled={key === 'reel' && !reelEligible} className={format === key ? 'is-active' : ''} onClick={() => onFormat(key)} title={key === 'reel' && !reelEligible ? 'Reel framing is available for one video.' : ''}>
                        <strong>{option.label}</strong><small>{option.detail}</small>
                    </button>
                ))}
            </div>
            <div
                className={`ig-preview-image ig-crop-canvas ${active ? 'has-media' : ''}`}
                style={{ aspectRatio: formatInfo.ratio }}
                onPointerDown={startDrag}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
            >
                {active ? (
                    <MediaVisual
                        item={active}
                        draggable="false"
                        style={{
                            objectFit: crop.fit,
                            objectPosition: `${crop.positionX * 100}% ${crop.positionY * 100}%`,
                            transform: `scale(${crop.zoom})`,
                            transformOrigin: `${crop.positionX * 100}% ${crop.positionY * 100}%`,
                        }}
                    />
                ) : <div><Images size={30} /><span>Your media will appear here</span></div>}
                {active && <div className="ig-thirds-grid" aria-hidden="true" />}
                {active && <span className="ig-drag-hint">Drag to position</span>}
                {media.length > 1 && <span className="ig-preview-count">{media.findIndex((item) => item.id === active?.id) + 1} / {media.length}</span>}
            </div>
            {active && (
                <div className="ig-crop-controls">
                    <div className="ig-fit-control">
                        <button type="button" className={crop.fit === 'cover' ? 'is-active' : ''} onClick={() => onChange(active.id, { ...crop, fit: 'cover' })}>Fill frame</button>
                        <button type="button" className={crop.fit === 'contain' ? 'is-active' : ''} onClick={() => onChange(active.id, { ...crop, fit: 'contain', zoom: 1 })}>Fit whole image</button>
                    </div>
                    <label className="ig-zoom-control">
                        <span>Zoom</span>
                        <input type="range" min="1" max="3" step="0.01" value={crop.zoom} onChange={(event) => onChange(active.id, { ...crop, zoom: Number(event.target.value) })} />
                        <strong>{crop.zoom.toFixed(2)}×</strong>
                    </label>
                    <button type="button" className="ig-reset-crop" onClick={() => onChange(active.id, defaultCrop())}><RotateCcw size={13} /> Centre</button>
                </div>
            )}
            {media.length > 1 && (
                <div className="ig-preview-sequence" aria-label="Choose an item to position">
                    {media.map((item, index) => (
                        <button type="button" key={item.id} className={item.id === active?.id ? 'is-active' : ''} onClick={() => onActive(item.id)} title={`Position item ${index + 1}`}>
                            <MediaVisual item={item} /><span>{String(index + 1).padStart(2, '0')}</span>
                        </button>
                    ))}
                </div>
            )}
            {active && <p className="ig-processing-note">The original stays untouched. This framed copy is generated only when you schedule or post.</p>}
        </div>
    );
}

export default function InstagramPublisher({ accessToken }) {
    const [composer, setComposer] = useState(() => ({ ...emptyComposer(), ...defaultSchedule() }));
    const [editingId, setEditingId] = useState('');
    const [posts, setPosts] = useState([]);
    const [settings, setSettings] = useState({ default_hashtags: '', username: '' });
    const [connection, setConnection] = useState({ connected: false });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [message, setMessage] = useState(null);
    const [activeMediaId, setActiveMediaId] = useState('');
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const authorizedFetch = useCallback((url, options = {}) => fetch(url, {
        ...options,
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(options.headers || {}),
            Authorization: `Bearer ${accessToken}`,
        },
    }), [accessToken]);

    const load = useCallback(async ({ quiet = false } = {}) => {
        if (!accessToken) return;
        if (!quiet) setLoading(true);
        try {
            const payload = await readJson(await authorizedFetch('/api/admin/social/instagram'));
            setPosts(payload.posts || []);
            setSettings(payload.settings || { default_hashtags: '', username: '' });
            setConnection(payload.connection || { connected: false });
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            if (!quiet) setLoading(false);
        }
    }, [accessToken, authorizedFetch]);

    useEffect(() => { load(); }, [load]);

    const updateComposer = (patch) => setComposer((current) => ({ ...current, ...patch }));
    const reset = () => {
        setComposer({ ...emptyComposer(), ...defaultSchedule() });
        setEditingId('');
        setActiveMediaId('');
    };

    useEffect(() => {
        if (composer.media.length && !composer.media.some((item) => item.id === activeMediaId)) {
            setActiveMediaId(composer.media[0].id);
        }
        if (!composer.media.length && activeMediaId) setActiveMediaId('');
    }, [activeMediaId, composer.media]);

    const updateCrop = (id, crop) => setComposer((current) => ({
        ...current,
        media: current.media.map((item) => item.id === id ? { ...item, crop } : item),
    }));

    const onDragEnd = ({ active, over }) => {
        if (!over || active.id === over.id) return;
        setComposer((current) => {
            const oldIndex = current.media.findIndex((item) => item.id === active.id);
            const newIndex = current.media.findIndex((item) => item.id === over.id);
            return { ...current, media: arrayMove(current.media, oldIndex, newIndex) };
        });
    };

    const scheduledAt = () => {
        if (!composer.date || !composer.time) throw new Error('Choose a date and time.');
        const date = new Date(`${composer.date}T${composer.time}`);
        if (Number.isNaN(date.getTime())) throw new Error('Choose a valid date and time.');
        return date.toISOString();
    };

    const prepareMediaForPublishing = async (media) => {
        const prepared = [];
        for (const item of media) {
            const sourceIsOriginal = /^(photos\/originals|originals)\//.test(String(item.objectKey || ''));
            if (!sourceIsOriginal) {
                if (item.publishable === false) throw new Error(`${item.name || 'This item'} cannot be prepared from this folder.`);
                prepared.push(item);
                continue;
            }
            const endpoint = item.mediaKind === 'video' ? '/api/admin/social/prepare-video' : '/api/admin/social/prepare-media';
            const payload = await readJson(await authorizedFetch(endpoint, {
                method: 'POST',
                body: JSON.stringify({
                    objectKey: item.objectKey,
                    originalFilename: item.name,
                    format: composer.format,
                    crop: item.crop || defaultCrop(),
                }),
            }));
            const readyItem = asPickerItem({ ...item, instagramAsset: payload.asset, catalogued: true });
            if (!readyItem.publishable) throw new Error(`${item.name || 'This item'} could not be prepared for Instagram.`);
            prepared.push(readyItem);
        }
        return prepared;
    };

    const submit = async () => {
        if (composer.media.length === 0) return setMessage({ type: 'error', text: 'Choose at least one photograph.' });
        setSaving(true);
        setMessage(null);
        try {
            const preparedMedia = await prepareMediaForPublishing(composer.media);
            setComposer((current) => ({ ...current, media: preparedMedia }));
            const base = {
                mediaIds: preparedMedia.map((item) => item.id),
                caption: composer.caption,
                hashtags: composer.hashtags,
            };
            let payload;
            if (editingId) {
                await readJson(await authorizedFetch('/api/admin/social/instagram', {
                    method: 'PATCH',
                    body: JSON.stringify({
                        ...base,
                        id: editingId,
                        mode: composer.mode,
                        scheduledAt: composer.mode === 'schedule' ? scheduledAt() : null,
                    }),
                }));
                payload = composer.mode === 'now'
                    ? await readJson(await authorizedFetch('/api/admin/social/instagram', {
                        method: 'POST', body: JSON.stringify({ action: 'publish', id: editingId }),
                    }))
                    : { post: { status: 'scheduled' } };
            } else {
                payload = await readJson(await authorizedFetch('/api/admin/social/instagram', {
                    method: 'POST',
                    body: JSON.stringify({
                        ...base,
                        mode: composer.mode,
                        scheduledAt: composer.mode === 'schedule' ? scheduledAt() : null,
                    }),
                }));
            }
            const published = payload.post?.status === 'published';
            setMessage({ type: 'success', text: published ? 'Published ✓' : 'Post scheduled.' });
            reset();
            await load({ quiet: true });
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
            await load({ quiet: true });
        } finally {
            setSaving(false);
        }
    };

    const saveDefault = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const payload = await readJson(await authorizedFetch('/api/admin/social/instagram', {
                method: 'PATCH',
                body: JSON.stringify({ action: 'settings', defaultHashtags: composer.hashtags }),
            }));
            setSettings((current) => ({ ...current, ...payload.settings }));
            setMessage({ type: 'success', text: 'Default hashtags saved.' });
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setSaving(false);
        }
    };

    const editPost = (post) => {
        const local = localDateTime(post.scheduled_at || new Date(Date.now() + 3600000));
        setComposer({
            media: (post.media || []).filter((item) => !item.missing).map((item) => ({ ...item, thumbnailUrl: item.url, crop: defaultCrop() })),
            format: 'portrait',
            caption: post.caption || '',
            hashtags: post.hashtags || '',
            mode: 'schedule',
            ...local,
        });
        setEditingId(post.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const action = async (post, operation) => {
        if (operation === 'delete' && !window.confirm('Delete this queued post?')) return;
        setMessage(null);
        try {
            if (operation === 'delete') {
                await readJson(await authorizedFetch(`/api/admin/social/instagram?id=${post.id}`, { method: 'DELETE' }));
                setMessage({ type: 'success', text: 'Post deleted.' });
            } else {
                const payload = await readJson(await authorizedFetch('/api/admin/social/instagram', {
                    method: 'POST', body: JSON.stringify({ action: 'publish', id: post.id }),
                }));
                setMessage({ type: 'success', text: payload.post?.status === 'published' ? 'Published ✓' : 'Publish started.' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            await load({ quiet: true });
        }
    };

    const previewCaption = useMemo(() => {
        const tags = composer.hashtags.trim();
        return tags ? `${composer.caption}${composer.caption ? '\n\n' : ''}${tags}` : composer.caption;
    }, [composer.caption, composer.hashtags]);

    if (loading) return <div className="ig-page-state"><LoaderCircle className="is-spinning" /> Loading Instagram publishing…</div>;

    return (
        <div className="ig-publisher">
            <header className="ig-page-header">
                <AdminPageHeader title="Instagram" description="Publish photographs now or place them in a simple, reliable queue." />
                <div className={`ig-connection ${connection.connected ? 'is-connected' : ''}`} title={connection.error || ''}>
                    {connection.connected ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
                    <span>{connection.connected ? `Connected as @${connection.username || settings.username || 'instagram'}` : 'Instagram connection needed'}</span>
                </div>
            </header>

            {message && <div className={`ig-message is-${message.type}`} role="status">{message.type === 'error' ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}{message.text}</div>}

            <div className="ig-workspace">
                <section className="ig-composer-card" aria-labelledby="ig-create-title">
                    <div className="ig-section-heading">
                        <div><span className="ig-eyebrow">Create post</span><h2 id="ig-create-title">Media and words</h2></div>
                        {editingId && <button type="button" className="ig-text-button" onClick={reset}>Cancel edit</button>}
                    </div>

                    <div className="ig-field-group">
                        <div className="ig-field-label"><span>Photos and videos</span><small>{composer.media.length} / 10</small></div>
                        <button type="button" className="ig-library-button" onClick={() => setPickerOpen(true)}>
                            <Images size={19} />
                            <span><strong>Choose from Media Library</strong><small>Browse photos, variants, and videos</small></span>
                            <Plus size={18} />
                        </button>
                        {composer.media.length > 0 && (
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                                <SortableContext items={composer.media.map((item) => item.id)} strategy={rectSortingStrategy}>
                                    <div className="ig-selected-grid">
                                        {composer.media.map((item, index) => (
                                            <SortablePhoto
                                                key={item.id}
                                                item={item}
                                                index={index}
                                                onRemove={(id) => updateComposer({ media: composer.media.filter((media) => media.id !== id) })}
                                            />
                                        ))}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        )}
                    </div>

                    <label className="ig-field">
                        <span>Caption <small>{composer.caption.length}</small></span>
                        <textarea rows={7} value={composer.caption} onChange={(event) => updateComposer({ caption: event.target.value })} placeholder="Write a caption…" maxLength={2200} />
                    </label>

                    <div className="ig-field">
                        <div className="ig-field-label">
                            <span>Hashtags</span>
                            <div className="ig-inline-actions">
                                <button type="button" onClick={() => updateComposer({ hashtags: settings.default_hashtags || '' })} disabled={!settings.default_hashtags}>Use default hashtags</button>
                                <button type="button" onClick={saveDefault} disabled={saving || !composer.hashtags.trim()}>Save as default</button>
                            </div>
                        </div>
                        <textarea rows={3} value={composer.hashtags} onChange={(event) => updateComposer({ hashtags: event.target.value })} placeholder="#photography #portrait #visualstorytelling" maxLength={2200} />
                    </div>

                    <fieldset className="ig-publish-choice">
                        <legend>When to publish</legend>
                        <label className={composer.mode === 'now' ? 'is-active' : ''}>
                            <input type="radio" name="ig-publish-mode" checked={composer.mode === 'now'} onChange={() => updateComposer({ mode: 'now' })} />
                            <Send size={17} /><span><strong>Post now</strong><small>Send immediately after Meta confirms</small></span>
                        </label>
                        <label className={composer.mode === 'schedule' ? 'is-active' : ''}>
                            <input type="radio" name="ig-publish-mode" checked={composer.mode === 'schedule'} onChange={() => updateComposer({ mode: 'schedule' })} />
                            <CalendarClock size={17} /><span><strong>Schedule</strong><small>Publish automatically through Supabase</small></span>
                        </label>
                    </fieldset>

                    {composer.mode === 'schedule' && (
                        <div className="ig-date-row">
                            <label><span>Date</span><input type="date" value={composer.date} min={localDateTime(new Date()).date} onChange={(event) => updateComposer({ date: event.target.value })} /></label>
                            <label><span>Time</span><input type="time" value={composer.time} onChange={(event) => updateComposer({ time: event.target.value })} /></label>
                        </div>
                    )}

                    <div className="ig-submit-row">
                        <span>{composer.media.length ? `${composer.media.length} ${composer.media.length === 1 ? 'item' : 'items'} ready` : 'Choose media to continue'}</span>
                        <button type="button" className="ig-button is-primary" onClick={submit} disabled={saving || composer.media.length === 0 || !connection.connected}>
                            {saving ? <LoaderCircle className="is-spinning" size={17} /> : composer.mode === 'now' ? <Send size={17} /> : <CalendarClock size={17} />}
                            {saving ? 'Working…' : composer.mode === 'now' ? 'Post now' : editingId ? 'Update schedule' : 'Schedule post'}
                        </button>
                    </div>
                </section>

                <aside className="ig-preview-card" aria-label="Instagram post preview">
                    <div className="ig-preview-heading"><span>Preview & position</span><small>{composer.media.length > 1 ? `${composer.media.length} items · one shared frame` : 'Single post'}</small></div>
                    <div className="ig-preview-account"><span className="ig-preview-avatar"><Instagram size={18} /></span><strong>@{connection.username || settings.username || 'username'}</strong></div>
                    <CropCanvas
                        media={composer.media}
                        format={composer.format}
                        activeId={activeMediaId}
                        onActive={setActiveMediaId}
                        onChange={updateCrop}
                        onFormat={(format) => updateComposer({ format })}
                    />
                    <p className={`ig-preview-copy ${previewCaption ? '' : 'is-empty'}`}>{previewCaption || 'Caption and hashtags will appear here. Line breaks are preserved.'}</p>
                </aside>
            </div>

            <section className="ig-queue" aria-labelledby="ig-queue-title">
                <div className="ig-section-heading">
                    <div><span className="ig-eyebrow">Queue</span><h2 id="ig-queue-title">Scheduled posts</h2></div>
                    <button type="button" className="ig-icon-button" onClick={() => load({ quiet: true })} title="Refresh queue"><RefreshCw size={17} /></button>
                </div>
                {posts.length === 0 ? (
                    <div className="ig-queue-empty"><CalendarClock size={22} /><span>No scheduled posts yet.</span></div>
                ) : (
                    <div className="ig-queue-list">
                        {posts.map((post) => (
                            <article className="ig-queue-item" key={post.id}>
                                <div className="ig-queue-thumb">
                                    {post.media?.[0]?.url ? <img src={post.media[0].url} alt={post.media[0].altText || ''} loading="lazy" /> : <Images size={20} />}
                                    {post.media?.length > 1 && <span>+{post.media.length - 1}</span>}
                                </div>
                                <div className="ig-queue-copy"><strong>{post.caption?.split('\n')[0] || 'Untitled post'}</strong><span>{post.status === 'published' ? formatSchedule(post.published_at) : formatSchedule(post.scheduled_at)}</span></div>
                                <span className={`ig-status is-${post.status}`}>{statusLabel(post.status)}</span>
                                {post.error_message && <p className="ig-queue-error">{post.error_message}</p>}
                                <div className="ig-queue-actions">
                                    {['scheduled', 'failed', 'draft'].includes(post.status) && <button type="button" onClick={() => editPost(post)}><Pencil size={14} /> Edit</button>}
                                    {['scheduled', 'failed', 'draft'].includes(post.status) && <button type="button" onClick={() => action(post, 'publish')}><Send size={14} /> {post.status === 'failed' ? 'Retry' : 'Post now'}</button>}
                                    {['scheduled', 'failed', 'draft'].includes(post.status) && <button type="button" className="is-danger" onClick={() => action(post, 'delete')}><Trash2 size={14} /> Delete</button>}
                                    {post.instagram_permalink && <a href={post.instagram_permalink} target="_blank" rel="noreferrer">View post</a>}
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>

            {pickerOpen && <MediaPicker accessToken={accessToken} current={composer.media} onCancel={() => setPickerOpen(false)} onConfirm={(media) => {
                const normalized = media.map((item) => ({ ...item, crop: item.crop || defaultCrop() }));
                updateComposer({
                    media: normalized,
                    format: composer.format === 'reel' && !(normalized.length === 1 && normalized[0].mediaKind === 'video') ? 'portrait' : composer.format,
                });
                if (media[0]) setActiveMediaId(media[0].id);
                setPickerOpen(false);
            }} />}
        </div>
    );
}
