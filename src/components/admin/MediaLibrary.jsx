import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowLeft,
    CheckCircle2,
    ChevronRight,
    Copy,
    ExternalLink,
    File,
    FileImage,
    Folder,
    FolderOpen,
    Grid2X2,
    HardDrive,
    ImagePlus,
    Info,
    LayoutList,
    LoaderCircle,
    Plus,
    RefreshCw,
    Search,
    UploadCloud,
    X,
} from 'lucide-react';

const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const formatBytes = (value) => {
    const bytes = Number(value || 0);
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const amount = bytes / (1024 ** unitIndex);
    return `${amount >= 10 || unitIndex === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[unitIndex]}`;
};

const formatDate = (value) => {
    if (!value) return 'Unknown';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return new Intl.DateTimeFormat('en', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
};

const fileKind = (file) => {
    if (file.mimeType?.startsWith('image/')) return 'Image';
    if (file.mimeType?.startsWith('video/')) return 'Video';
    if (file.mimeType?.startsWith('audio/')) return 'Audio';
    const extension = file.name?.split('.').pop();
    return extension ? extension.toUpperCase() : 'File';
};

const readImageDimensions = (file) => new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    const finish = (dimensions) => {
        URL.revokeObjectURL(objectUrl);
        resolve(dimensions);
    };
    image.onload = () => finish({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => finish({ width: null, height: null });
    image.src = objectUrl;
});

const readJsonResponse = async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(payload.error || `Request failed with status ${response.status}.`);
        error.code = payload.code;
        error.details = payload;
        throw error;
    }
    return payload;
};

const makeBreadcrumbs = (folderPath) => {
    const parts = folderPath.split('/').filter(Boolean);
    return parts.map((name, index) => ({
        name,
        path: parts.slice(0, index + 1).join('/'),
    }));
};

export default function MediaLibrary({ accessToken }) {
    const [files, setFiles] = useState([]);
    const [folders, setFolders] = useState([]);
    const [rootFolders, setRootFolders] = useState([]);
    const [currentFolder, setCurrentFolder] = useState('');
    const [selectedKey, setSelectedKey] = useState('');
    const [query, setQuery] = useState('');
    const [searchFiles, setSearchFiles] = useState([]);
    const [folderMatches, setFolderMatches] = useState([]);
    const [searching, setSearching] = useState(false);
    const [searchTruncated, setSearchTruncated] = useState(false);
    const [sortBy, setSortBy] = useState('date-desc');
    const [viewMode, setViewMode] = useState('grid');
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [catalogueReady, setCatalogueReady] = useState(false);
    const [truncated, setTruncated] = useState(false);
    const [newFolderOpen, setNewFolderOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [creatingFolder, setCreatingFolder] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        const savedView = window.localStorage.getItem('admin-media-view');
        if (savedView === 'grid' || savedView === 'list') setViewMode(savedView);
    }, []);

    const changeView = (mode) => {
        setViewMode(mode);
        window.localStorage.setItem('admin-media-view', mode);
    };

    const authorizedFetch = useCallback((url, options = {}) => fetch(url, {
        ...options,
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(options.headers || {}),
            Authorization: `Bearer ${accessToken}`,
        },
    }), [accessToken]);

    const loadFolder = useCallback(async (folderPath, { silent = false } = {}) => {
        if (!accessToken) return;
        if (!silent) setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            if (folderPath) params.set('folder', folderPath);
            const response = await authorizedFetch(`/api/admin/media?${params.toString()}`);
            const payload = await readJsonResponse(response);
            setFiles(payload.files || []);
            setFolders(payload.folders || []);
            setTruncated(Boolean(payload.truncated));
            setCatalogueReady(true);
            if (!payload.folderPath) setRootFolders(payload.folders || []);
            setSelectedKey((current) => (
                (payload.files || []).some((file) => file.objectKey === current) ? current : ''
            ));
        } catch (loadError) {
            setCatalogueReady(false);
            setError(loadError.message);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [accessToken, authorizedFetch]);

    useEffect(() => {
        loadFolder(currentFolder);
    }, [currentFolder, loadFolder]);

    useEffect(() => {
        const searchTerm = query.trim();
        if (!searchTerm || !accessToken) {
            setSearchFiles([]);
            setFolderMatches([]);
            setSearchTruncated(false);
            setSearching(false);
            return undefined;
        }

        const controller = new AbortController();
        setSearching(true);
        setSearchFiles([]);
        setFolderMatches([]);
        setSearchTruncated(false);
        const timer = window.setTimeout(async () => {
            try {
                const params = new URLSearchParams({ q: searchTerm });
                if (currentFolder) params.set('folder', currentFolder);
                const response = await authorizedFetch(`/api/admin/media/search?${params.toString()}`, {
                    signal: controller.signal,
                });
                const payload = await readJsonResponse(response);
                setSearchFiles(payload.files || []);
                setFolderMatches(payload.folderMatches || []);
                setSearchTruncated(Boolean(payload.truncated));
                setSelectedKey((current) => (
                    (payload.files || []).some((file) => file.objectKey === current) ? current : ''
                ));
            } catch (searchError) {
                if (searchError.name !== 'AbortError') setError(searchError.message);
            } finally {
                if (!controller.signal.aborted) setSearching(false);
            }
        }, 300);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [accessToken, authorizedFetch, currentFolder, query]);

    const navigateTo = (folderPath) => {
        setSelectedKey('');
        setNotice('');
        setCurrentFolder(folderPath);
    };

    const isSearching = Boolean(query.trim());
    const activeFiles = isSearching ? searchFiles : files;
    const folderMatchMap = useMemo(
        () => new Map(folderMatches.map((match) => [match.path, match.count])),
        [folderMatches],
    );

    const selectedFile = useMemo(
        () => activeFiles.find((file) => file.objectKey === selectedKey) || null,
        [activeFiles, selectedKey],
    );

    const visibleFolders = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return folders
            .map((folder) => ({ ...folder, matchCount: folderMatchMap.get(folder.path) || 0 }))
            .filter((folder) => !needle || folder.matchCount > 0 || folder.name.toLowerCase().includes(needle))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    }, [folderMatchMap, folders, query]);

    const visibleFiles = useMemo(() => {
        const sorted = [...activeFiles];
        sorted.sort((a, b) => {
            if (sortBy === 'name-asc') return a.name.localeCompare(b.name, undefined, { numeric: true });
            if (sortBy === 'name-desc') return b.name.localeCompare(a.name, undefined, { numeric: true });
            if (sortBy === 'size-asc') return Number(a.fileSize || 0) - Number(b.fileSize || 0);
            if (sortBy === 'size-desc') return Number(b.fileSize || 0) - Number(a.fileSize || 0);
            const firstDate = new Date(a.createdAt || 0).getTime();
            const secondDate = new Date(b.createdAt || 0).getTime();
            return sortBy === 'date-asc' ? firstDate - secondDate : secondDate - firstDate;
        });
        return sorted;
    }, [activeFiles, sortBy]);

    const uploadFiles = async (fileList) => {
        const selected = Array.from(fileList || []);
        if (!selected.length || uploading || !catalogueReady) return;

        const invalidType = selected.find((file) => !ACCEPTED_TYPES.includes(file.type));
        const oversized = selected.find((file) => file.size > MAX_IMAGE_SIZE_BYTES);
        if (invalidType) {
            setError(`${invalidType.name} is not a supported image. Use JPEG, PNG, WebP or GIF.`);
            return;
        }
        if (oversized) {
            setError(`${oversized.name} is larger than 20 MB.`);
            return;
        }

        setUploading(true);
        setError('');
        setNotice('');
        setUploadProgress({ current: 0, total: selected.length });

        try {
            for (let index = 0; index < selected.length; index += 1) {
                const file = selected[index];
                setUploadProgress({ current: index + 1, total: selected.length, filename: file.name });
                const dimensionsPromise = readImageDimensions(file);
                const presignResponse = await authorizedFetch('/api/admin/media/presign', {
                    method: 'POST',
                    body: JSON.stringify({
                        filename: file.name,
                        contentType: file.type,
                        size: file.size,
                        folder: currentFolder,
                    }),
                });
                const signed = await readJsonResponse(presignResponse);

                const uploadResponse = await fetch(signed.uploadUrl, {
                    method: 'PUT',
                    headers: signed.requiredHeaders,
                    body: file,
                });
                if (!uploadResponse.ok) {
                    throw new Error(`R2 rejected ${file.name} with status ${uploadResponse.status}.`);
                }

                const dimensions = await dimensionsPromise;
                const completeResponse = await authorizedFetch('/api/admin/media/complete', {
                    method: 'POST',
                    body: JSON.stringify({
                        objectKey: signed.objectKey,
                        originalFilename: file.name,
                        expectedSize: file.size,
                        width: dimensions.width,
                        height: dimensions.height,
                    }),
                });
                await readJsonResponse(completeResponse);
            }

            setNotice(`${selected.length} ${selected.length === 1 ? 'image' : 'images'} uploaded to ${currentFolder || 'the library root'}.`);
            await loadFolder(currentFolder, { silent: true });
        } catch (uploadError) {
            setError(uploadError.message);
        } finally {
            setUploading(false);
            setUploadProgress(null);
            setDragging(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const createFolder = async (event) => {
        event.preventDefault();
        if (!newFolderName.trim() || creatingFolder) return;
        setCreatingFolder(true);
        setError('');
        try {
            const response = await authorizedFetch('/api/admin/media/folders', {
                method: 'POST',
                body: JSON.stringify({ parentPath: currentFolder, name: newFolderName }),
            });
            const payload = await readJsonResponse(response);
            setNewFolderName('');
            setNewFolderOpen(false);
            setNotice(`Folder “${payload.folder.name}” created.`);
            await loadFolder(currentFolder, { silent: true });
            if (!currentFolder) setRootFolders((current) => {
                const withoutDuplicate = current.filter((folder) => folder.path !== payload.folder.path);
                return [...withoutDuplicate, payload.folder].sort((a, b) => a.name.localeCompare(b.name));
            });
        } catch (folderError) {
            setError(folderError.message);
        } finally {
            setCreatingFolder(false);
        }
    };

    const copyPublicUrl = async () => {
        if (!selectedFile) return;
        try {
            await navigator.clipboard.writeText(selectedFile.publicUrl);
            setNotice('Public image link copied.');
        } catch {
            setError('Could not copy the link. Open the image and copy it from the browser.');
        }
    };

    const breadcrumbs = useMemo(() => makeBreadcrumbs(currentFolder), [currentFolder]);
    const topLevelFolder = currentFolder.split('/')[0];

    return (
        <section className="media-library" aria-labelledby="media-library-title">
            <header className="media-library-header">
                <div>
                    <p className="media-library-kicker">Cloudflare R2 + Supabase</p>
                    <h2 id="media-library-title">Media Library</h2>
                    <p>Browse, organize and upload website images from one place.</p>
                </div>
                <div className="header-actions">
                    <span className={`connection-pill ${catalogueReady ? 'is-ready' : ''}`}>
                        <span /> {catalogueReady ? 'Library connected' : 'Checking connection'}
                    </span>
                    <button
                        type="button"
                        className="secondary-button"
                        onClick={() => loadFolder(currentFolder)}
                        disabled={loading || uploading}
                    >
                        <RefreshCw size={15} className={loading ? 'is-spinning' : ''} /> Refresh
                    </button>
                </div>
            </header>

            {error && (
                <div className="media-message is-error" role="alert">
                    <Info size={18} />
                    <div><strong>Media Library needs attention</strong><span>{error}</span></div>
                    <button type="button" aria-label="Dismiss error" onClick={() => setError('')}><X size={15} /></button>
                </div>
            )}

            {notice && (
                <div className="media-message is-success" role="status">
                    <CheckCircle2 size={18} />
                    <span>{notice}</span>
                    <button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><X size={15} /></button>
                </div>
            )}

            <div className="finder-window">
                <aside className="finder-sidebar" aria-label="Media folders">
                    <div className="sidebar-label">Library</div>
                    <button
                        type="button"
                        className={`sidebar-location ${!currentFolder ? 'is-active' : ''}`}
                        onClick={() => navigateTo('')}
                    >
                        <HardDrive size={16} />
                        <span>All media</span>
                    </button>
                    <div className="sidebar-label folder-label">Folders</div>
                    <div className="sidebar-folders">
                        {rootFolders.map((folder) => (
                            <button
                                type="button"
                                className={`sidebar-location ${topLevelFolder === folder.path ? 'is-active' : ''} ${!currentFolder && folderMatchMap.get(folder.path) ? 'has-search-match' : ''}`}
                                onClick={() => navigateTo(folder.path)}
                                key={folder.path}
                                title={folder.name}
                            >
                                <Folder size={16} />
                                <span>{folder.name}</span>
                                {!currentFolder && folderMatchMap.get(folder.path) > 0 && (
                                    <small>{folderMatchMap.get(folder.path)}</small>
                                )}
                            </button>
                        ))}
                        {!rootFolders.length && !loading && <span className="sidebar-empty">No folders yet</span>}
                    </div>
                    <div className="storage-note">
                        <span>R2 bucket</span>
                        <strong>photos</strong>
                        <small>Images are served from photos.abodid.com</small>
                    </div>
                </aside>

                <main
                    className={`finder-main ${dragging ? 'is-dragging' : ''}`}
                    onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
                    onDragOver={(event) => event.preventDefault()}
                    onDragLeave={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false);
                    }}
                    onDrop={(event) => {
                        event.preventDefault();
                        setDragging(false);
                        uploadFiles(event.dataTransfer.files);
                    }}
                >
                    <div className="finder-titlebar">
                        <button
                            type="button"
                            className="icon-button"
                            aria-label="Go to parent folder"
                            disabled={!currentFolder || loading}
                            onClick={() => navigateTo(currentFolder.split('/').slice(0, -1).join('/'))}
                        >
                            <ArrowLeft size={17} />
                        </button>
                        <nav className="breadcrumbs" aria-label="Current folder">
                            <button type="button" onClick={() => navigateTo('')}>photos</button>
                            {breadcrumbs.map((crumb) => (
                                <React.Fragment key={crumb.path}>
                                    <ChevronRight size={14} />
                                    <button type="button" onClick={() => navigateTo(crumb.path)}>{crumb.name}</button>
                                </React.Fragment>
                            ))}
                        </nav>
                        <span className="item-count">
                            {isSearching ? `${visibleFiles.length} matches` : `${folders.length + files.length} items`}
                        </span>
                    </div>

                    <div className="finder-toolbar">
                        <label className="search-field">
                            <Search size={16} />
                            <input
                                type="search"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder={`Search ${currentFolder || 'all media'}`}
                            />
                            {query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={14} /></button>}
                        </label>
                        <div className="toolbar-actions">
                            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort media">
                                <option value="date-desc">Newest first</option>
                                <option value="date-asc">Oldest first</option>
                                <option value="name-asc">Name A–Z</option>
                                <option value="name-desc">Name Z–A</option>
                                <option value="size-desc">Largest first</option>
                                <option value="size-asc">Smallest first</option>
                            </select>
                            <div className="view-switcher" aria-label="View options">
                                <button type="button" className={viewMode === 'grid' ? 'is-active' : ''} aria-label="Grid view" onClick={() => changeView('grid')}><Grid2X2 size={16} /></button>
                                <button type="button" className={viewMode === 'list' ? 'is-active' : ''} aria-label="List view" onClick={() => changeView('list')}><LayoutList size={17} /></button>
                            </div>
                            <button type="button" className="secondary-button" onClick={() => setNewFolderOpen(true)} disabled={uploading}>
                                <Plus size={15} /> New folder
                            </button>
                            <input
                                ref={fileInputRef}
                                className="visually-hidden-file-input"
                                type="file"
                                multiple
                                accept={ACCEPTED_TYPES.join(',')}
                                onChange={(event) => uploadFiles(event.target.files)}
                                tabIndex={-1}
                            />
                            <button type="button" className="primary-button" onClick={() => fileInputRef.current?.click()} disabled={uploading || !catalogueReady}>
                                {uploading ? <LoaderCircle size={16} className="is-spinning" /> : <UploadCloud size={16} />}
                                {uploading ? `${uploadProgress?.current || 0}/${uploadProgress?.total || 0}` : 'Upload'}
                            </button>
                        </div>
                    </div>

                    {uploading && (
                        <div className="upload-strip">
                            <LoaderCircle size={15} className="is-spinning" />
                            <span>Uploading {uploadProgress?.filename || 'image'} to {currentFolder || 'photos'}…</span>
                            <strong>{uploadProgress?.current}/{uploadProgress?.total}</strong>
                        </div>
                    )}

                    {isSearching && (
                        <div className="search-strip">
                            {searching ? <LoaderCircle size={15} className="is-spinning" /> : <Search size={15} />}
                            <span>
                                {searching
                                    ? `Searching ${currentFolder || 'all media'} and every subfolder…`
                                    : `${visibleFiles.length} matching ${visibleFiles.length === 1 ? 'file' : 'files'} across ${currentFolder || 'all media'} and its subfolders`}
                            </span>
                        </div>
                    )}

                    {(isSearching ? searchTruncated : truncated) && (
                        <div className="limit-note">There are more results than can be displayed at once. Use a more specific search term.</div>
                    )}

                    <div className="browser-scroll">
                        {viewMode === 'list' && !loading && !searching && (visibleFolders.length > 0 || visibleFiles.length > 0) && (
                            <div className="list-heading" aria-hidden="true">
                                <span>Name</span><span>Size</span><span>Kind</span><span>Modified</span>
                            </div>
                        )}

                        {loading || searching ? (
                            <div className="browser-state">
                                <LoaderCircle size={21} className="is-spinning" />
                                {searching ? 'Searching this folder and all subfolders…' : 'Loading this folder…'}
                            </div>
                        ) : visibleFolders.length > 0 || visibleFiles.length > 0 ? (
                            <div className={`finder-items is-${viewMode}`}>
                                {visibleFolders.map((folder) => (
                                    <button
                                        type="button"
                                        className={`folder-item ${folder.matchCount > 0 ? 'has-descendant-match' : ''}`}
                                        key={folder.path}
                                        onClick={() => navigateTo(folder.path)}
                                    >
                                        <span className="folder-visual">
                                            <FolderOpen size={viewMode === 'grid' ? 32 : 19} />
                                            {folder.matchCount > 0 && <small className="folder-match-count">{folder.matchCount}</small>}
                                        </span>
                                        <span className="item-name" title={folder.name}>{folder.name}</span>
                                        {viewMode === 'list' && <><span>—</span><span>Folder</span><span>—</span></>}
                                    </button>
                                ))}
                                {visibleFiles.map((file) => (
                                    <button
                                        type="button"
                                        className={`file-item ${selectedKey === file.objectKey ? 'is-selected' : ''}`}
                                        key={file.objectKey}
                                        onClick={() => setSelectedKey(file.objectKey)}
                                        onDoubleClick={() => window.open(file.publicUrl, '_blank', 'noopener,noreferrer')}
                                    >
                                        <span className="file-visual">
                                            {file.mimeType?.startsWith('image/') ? (
                                                <><FileImage className="image-fallback" size={25} /><img src={file.publicUrl} alt="" loading="lazy" /></>
                                            ) : (
                                                <File size={viewMode === 'grid' ? 30 : 18} />
                                            )}
                                        </span>
                                        <span className="item-copy" title={file.name}>
                                            <span className="item-name">{file.name}</span>
                                            {isSearching && (
                                                <small>{file.objectKey.split('/').slice(0, -1).join('/') || 'photos'}</small>
                                            )}
                                        </span>
                                        {viewMode === 'list' && <><span>{formatBytes(file.fileSize)}</span><span>{fileKind(file)}</span><span>{formatDate(file.createdAt)}</span></>}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="browser-state is-empty">
                                <ImagePlus size={27} />
                                <strong>{query ? 'Nothing matches your search' : 'This folder is empty'}</strong>
                                <span>{query ? 'No matching filename was found in this folder or any of its subfolders.' : 'Drop images here or use the Upload button.'}</span>
                            </div>
                        )}
                    </div>

                    {dragging && (
                        <div className="drop-overlay">
                            <UploadCloud size={34} />
                            <strong>Drop images into {currentFolder || 'photos'}</strong>
                            <span>JPEG, PNG, WebP or GIF · up to 20 MB each</span>
                        </div>
                    )}
                </main>

                <aside className="finder-inspector" aria-label="Selected file details">
                    {selectedFile ? (
                        <>
                            <div className="inspector-preview">
                                {selectedFile.mimeType?.startsWith('image/') ? (
                                    <img src={selectedFile.publicUrl} alt={selectedFile.altText || ''} />
                                ) : (
                                    <File size={38} />
                                )}
                            </div>
                            <div className="inspector-heading">
                                <strong title={selectedFile.name}>{selectedFile.name}</strong>
                                <span className={selectedFile.catalogued ? 'is-catalogued' : ''}>
                                    {selectedFile.catalogued ? 'Supabase catalogued' : 'R2 file'}
                                </span>
                            </div>
                            <dl>
                                <div><dt>Kind</dt><dd>{fileKind(selectedFile)}</dd></div>
                                <div><dt>Size</dt><dd>{formatBytes(selectedFile.fileSize)}</dd></div>
                                {selectedFile.width && selectedFile.height && <div><dt>Dimensions</dt><dd>{selectedFile.width} × {selectedFile.height}</dd></div>}
                                <div><dt>Modified</dt><dd>{formatDate(selectedFile.updatedAt || selectedFile.createdAt)}</dd></div>
                                <div><dt>Location</dt><dd title={selectedFile.objectKey}>{selectedFile.objectKey}</dd></div>
                                {selectedFile.credit && <div><dt>Credit</dt><dd>{selectedFile.credit}</dd></div>}
                            </dl>
                            <div className="inspector-actions">
                                <button type="button" className="secondary-button" onClick={copyPublicUrl}><Copy size={15} /> Copy link</button>
                                <a className="primary-button" href={selectedFile.publicUrl} target="_blank" rel="noreferrer">Open <ExternalLink size={14} /></a>
                            </div>
                            <p>Alt text, captions and credits will be editable in the next metadata step.</p>
                        </>
                    ) : (
                        <div className="inspector-empty">
                            <Info size={24} />
                            <strong>Select a file</strong>
                            <span>Its preview, link and technical details will appear here.</span>
                        </div>
                    )}
                </aside>
            </div>

            {newFolderOpen && (
                <div className="modal-backdrop" role="presentation" onMouseDown={() => !creatingFolder && setNewFolderOpen(false)}>
                    <form className="folder-dialog" onSubmit={createFolder} onMouseDown={(event) => event.stopPropagation()}>
                        <div className="dialog-icon"><Folder size={22} /></div>
                        <div>
                            <h3>New folder</h3>
                            <p>Create it inside <strong>{currentFolder || 'photos'}</strong>.</p>
                        </div>
                        <label htmlFor="new-media-folder">Folder name</label>
                        <input
                            id="new-media-folder"
                            autoFocus
                            value={newFolderName}
                            onChange={(event) => setNewFolderName(event.target.value)}
                            placeholder="project-name"
                            disabled={creatingFolder}
                        />
                        <div className="dialog-actions">
                            <button type="button" className="secondary-button" onClick={() => setNewFolderOpen(false)} disabled={creatingFolder}>Cancel</button>
                            <button type="submit" className="primary-button" disabled={!newFolderName.trim() || creatingFolder}>
                                {creatingFolder ? <LoaderCircle size={15} className="is-spinning" /> : <Plus size={15} />}
                                Create folder
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <style>{`
                .media-library { display: flex; flex-direction: column; gap: 1rem; animation: fadeIn 0.3s ease; }
                .media-library-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 2rem; padding-bottom: 1.15rem; border-bottom: 1px solid var(--border-subtle); }
                .media-library-kicker { margin: 0 0 0.42rem; color: var(--text-tertiary); font-size: 0.68rem; font-weight: 650; letter-spacing: 0.08em; text-transform: uppercase; }
                .media-library-header h2 { margin: 0; color: var(--text-primary); font-size: clamp(1.8rem, 3vw, 2.65rem); font-weight: 620; letter-spacing: -0.045em; }
                .media-library-header p:not(.media-library-kicker) { margin: 0.48rem 0 0; color: var(--text-secondary); font-size: 0.88rem; }
                .header-actions, .toolbar-actions, .inspector-actions, .dialog-actions { display: flex; align-items: center; gap: 0.55rem; }
                .connection-pill { display: inline-flex; align-items: center; gap: 0.45rem; color: var(--text-tertiary); font-size: 0.7rem; }
                .connection-pill > span { width: 6px; height: 6px; border-radius: 50%; background: #858585; }
                .connection-pill.is-ready > span { background: #35d46f; box-shadow: 0 0 0 3px rgba(53,212,111,0.1); }
                .secondary-button, .primary-button, .icon-button { display: inline-flex; align-items: center; justify-content: center; gap: 0.42rem; min-height: 34px; border-radius: 7px; cursor: pointer; font: inherit; font-size: 0.72rem; font-weight: 650; text-decoration: none; }
                .secondary-button { padding: 0.45rem 0.72rem; border: 1px solid var(--border-subtle); background: var(--bg-surface); color: var(--text-primary); }
                .primary-button { padding: 0.47rem 0.78rem; border: 1px solid #f4f4f4; background: #f4f4f4; color: #101010; }
                .icon-button { width: 33px; border: 1px solid var(--border-subtle); background: var(--bg-surface); color: var(--text-secondary); }
                button:disabled { cursor: not-allowed; opacity: 0.45; }
                .media-message { display: flex; align-items: center; gap: 0.65rem; padding: 0.72rem 0.82rem; border: 1px solid; border-radius: 8px; font-size: 0.75rem; }
                .media-message > div { flex: 1; }
                .media-message strong, .media-message span { display: block; }
                .media-message strong { margin-bottom: 0.15rem; }
                .media-message > button { margin-left: auto; border: 0; background: transparent; color: inherit; cursor: pointer; }
                .media-message.is-error { border-color: rgba(248,113,113,0.38); background: rgba(127,29,29,0.18); color: #fca5a5; }
                .media-message.is-error span { color: #fecaca; }
                .media-message.is-success { border-color: rgba(74,222,128,0.25); background: rgba(20,83,45,0.18); color: #86efac; }
                .finder-window { height: clamp(500px, calc(100dvh - 245px), 820px); min-height: 0; display: grid; grid-template-columns: 190px minmax(0, 1fr) 245px; overflow: hidden; border: 1px solid var(--border-subtle); border-radius: 12px; background: var(--bg-card); box-shadow: 0 18px 55px rgba(0,0,0,0.18); }
                .finder-sidebar { min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; padding: 0.85rem 0.65rem; border-right: 1px solid var(--border-subtle); background: color-mix(in srgb, var(--bg-surface) 88%, transparent); }
                .sidebar-label { padding: 0.2rem 0.55rem 0.45rem; color: var(--text-tertiary); font-size: 0.62rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
                .sidebar-label.folder-label { margin-top: 1rem; }
                .sidebar-location { width: 100%; display: flex; align-items: center; gap: 0.55rem; padding: 0.5rem 0.55rem; border: 0; border-radius: 6px; background: transparent; color: var(--text-secondary); cursor: pointer; font: inherit; font-size: 0.73rem; text-align: left; }
                .sidebar-location span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .sidebar-location small { margin-left: auto; min-width: 20px; padding: 0.12rem 0.32rem; border-radius: 999px; background: rgba(34,197,94,0.14); color: #86efac; font-size: 0.55rem; text-align: center; }
                .sidebar-location:hover { background: rgba(255,255,255,0.045); color: var(--text-primary); }
                .sidebar-location.is-active { background: rgba(255,255,255,0.09); color: var(--text-primary); }
                .sidebar-location.has-search-match { color: #bbf7d0; box-shadow: inset 0 0 0 1px rgba(74,222,128,0.28), 0 0 14px rgba(34,197,94,0.08); }
                .sidebar-folders { min-height: 0; flex: 1 1 auto; display: flex; flex-direction: column; gap: 0.1rem; overflow-y: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }
                .sidebar-empty { padding: 0.45rem 0.55rem; color: var(--text-tertiary); font-size: 0.68rem; }
                .storage-note { margin-top: auto; display: flex; flex-direction: column; gap: 0.2rem; padding: 0.8rem 0.7rem; border: 1px solid var(--border-subtle); border-radius: 8px; }
                .storage-note span, .storage-note small { color: var(--text-tertiary); font-size: 0.61rem; line-height: 1.4; }
                .storage-note strong { font-size: 0.75rem; }
                .finder-main { position: relative; min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; background: var(--bg-card); }
                .finder-titlebar { min-height: 48px; flex: 0 0 auto; display: flex; align-items: center; gap: 0.7rem; padding: 0.45rem 0.75rem; border-bottom: 1px solid var(--border-subtle); }
                .breadcrumbs { min-width: 0; display: flex; align-items: center; gap: 0.2rem; overflow: hidden; }
                .breadcrumbs button { max-width: 145px; overflow: hidden; padding: 0.25rem; border: 0; background: transparent; color: var(--text-secondary); cursor: pointer; font: inherit; font-size: 0.72rem; font-weight: 620; text-overflow: ellipsis; white-space: nowrap; }
                .breadcrumbs button:last-child { color: var(--text-primary); }
                .breadcrumbs svg { flex: 0 0 auto; color: var(--text-tertiary); }
                .item-count { margin-left: auto; flex: 0 0 auto; color: var(--text-tertiary); font-size: 0.64rem; }
                .finder-toolbar { flex: 0 0 auto; display: flex; align-items: center; gap: 0.7rem; padding: 0.65rem 0.75rem; border-bottom: 1px solid var(--border-subtle); }
                .search-field { min-width: 170px; max-width: 330px; flex: 1; display: flex; align-items: center; gap: 0.45rem; padding: 0.42rem 0.55rem; border: 1px solid var(--border-subtle); border-radius: 7px; background: var(--bg-surface); color: var(--text-tertiary); }
                .search-field input { min-width: 0; width: 100%; border: 0; outline: 0; background: transparent; color: var(--text-primary); font: inherit; font-size: 0.7rem; }
                .search-field button { padding: 0; border: 0; background: transparent; color: var(--text-tertiary); cursor: pointer; }
                .toolbar-actions { margin-left: auto; }
                .toolbar-actions select { min-height: 34px; padding: 0 1.8rem 0 0.62rem; border: 1px solid var(--border-subtle); border-radius: 7px; background: var(--bg-surface); color: var(--text-secondary); font: inherit; font-size: 0.68rem; }
                .view-switcher { display: flex; padding: 2px; border: 1px solid var(--border-subtle); border-radius: 7px; background: var(--bg-surface); }
                .view-switcher button { width: 29px; height: 28px; display: grid; place-items: center; border: 0; border-radius: 5px; background: transparent; color: var(--text-tertiary); cursor: pointer; }
                .view-switcher button.is-active { background: rgba(255,255,255,0.09); color: var(--text-primary); }
                .upload-strip, .search-strip, .limit-note { display: flex; align-items: center; gap: 0.5rem; padding: 0.55rem 0.75rem; border-bottom: 1px solid var(--border-subtle); background: rgba(59,130,246,0.08); color: #bfdbfe; font-size: 0.68rem; }
                .upload-strip span, .search-strip span { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .search-strip { background: rgba(34,197,94,0.07); color: #bbf7d0; }
                .limit-note { background: rgba(245,158,11,0.08); color: #fcd34d; }
                .browser-scroll { min-height: 0; flex: 1 1 auto; overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; padding: 0.8rem; }
                .finder-items.is-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(122px, 1fr)); gap: 0.65rem; }
                .finder-items button { min-width: 0; font: inherit; }
                .finder-items.is-grid .folder-item, .finder-items.is-grid .file-item { min-height: 142px; display: flex; flex-direction: column; gap: 0.55rem; padding: 0.55rem; border: 1px solid transparent; border-radius: 8px; background: transparent; color: var(--text-primary); cursor: pointer; text-align: left; }
                .finder-items.is-grid .folder-item:hover, .finder-items.is-grid .file-item:hover { border-color: var(--border-subtle); background: rgba(255,255,255,0.025); }
                .finder-items.is-grid .file-item.is-selected { border-color: rgba(96,165,250,0.55); background: rgba(59,130,246,0.12); }
                .finder-items.is-grid .folder-item.has-descendant-match { border-color: rgba(74,222,128,0.52); background: rgba(22,101,52,0.13); box-shadow: 0 0 0 1px rgba(74,222,128,0.1), 0 0 22px rgba(34,197,94,0.14); }
                .folder-visual, .file-visual { position: relative; display: grid; place-items: center; overflow: hidden; }
                .finder-items.is-grid .folder-visual, .finder-items.is-grid .file-visual { width: 100%; aspect-ratio: 4 / 3; border-radius: 6px; background: var(--bg-surface); color: #d6b86e; }
                .finder-items.is-grid .file-visual { color: var(--text-tertiary); }
                .file-visual img { position: relative; z-index: 1; width: 100%; height: 100%; object-fit: cover; }
                .image-fallback { position: absolute; }
                .item-name { width: 100%; overflow: hidden; color: var(--text-primary); font-size: 0.68rem; font-weight: 590; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
                .item-copy { width: 100%; min-width: 0; display: flex; flex-direction: column; gap: 0.14rem; overflow: hidden; }
                .item-copy small { overflow: hidden; color: var(--text-tertiary); font-size: 0.56rem; text-overflow: ellipsis; white-space: nowrap; }
                .folder-match-count { position: absolute; top: 0.42rem; right: 0.42rem; z-index: 2; min-width: 22px; padding: 0.16rem 0.34rem; border: 1px solid rgba(134,239,172,0.35); border-radius: 999px; background: rgba(20,83,45,0.88); color: #bbf7d0; font-size: 0.56rem; font-weight: 750; text-align: center; box-shadow: 0 0 12px rgba(34,197,94,0.22); }
                .list-heading, .finder-items.is-list .folder-item, .finder-items.is-list .file-item { display: grid; grid-template-columns: minmax(200px, 1fr) 78px 76px 142px; align-items: center; gap: 0.6rem; }
                .list-heading { padding: 0.2rem 0.55rem 0.5rem; color: var(--text-tertiary); font-size: 0.6rem; }
                .finder-items.is-list { display: flex; flex-direction: column; }
                .finder-items.is-list .folder-item, .finder-items.is-list .file-item { min-height: 38px; padding: 0.35rem 0.55rem; border: 0; border-bottom: 1px solid color-mix(in srgb, var(--border-subtle) 65%, transparent); background: transparent; color: var(--text-tertiary); cursor: pointer; text-align: left; font-size: 0.64rem; }
                .finder-items.is-list .folder-item:hover, .finder-items.is-list .file-item:hover { background: rgba(255,255,255,0.035); }
                .finder-items.is-list .file-item.is-selected { background: rgba(59,130,246,0.14); }
                .finder-items.is-list .folder-item.has-descendant-match { background: rgba(22,101,52,0.14); box-shadow: inset 3px 0 0 #4ade80, inset 0 0 0 1px rgba(74,222,128,0.15); }
                .finder-items.is-list .folder-visual, .finder-items.is-list .file-visual { display: inline-grid; width: 28px; height: 28px; margin-right: 0.42rem; float: left; border-radius: 4px; color: #d6b86e; }
                .finder-items.is-list .file-visual { color: var(--text-tertiary); }
                .finder-items.is-list .item-name { display: flex; align-items: center; }
                .finder-items.is-list .item-name::before { content: ''; }
                .finder-items.is-list .folder-item > .folder-visual, .finder-items.is-list .file-item > .file-visual { grid-column: 1; grid-row: 1; }
                .finder-items.is-list .folder-item > .item-name, .finder-items.is-list .file-item > .item-copy { grid-column: 1; grid-row: 1; padding-left: 35px; }
                .finder-items.is-list .folder-match-count { top: -1px; right: -1px; transform: scale(0.82); }
                .browser-state { min-height: 330px; display: flex; align-items: center; justify-content: center; gap: 0.55rem; color: var(--text-tertiary); font-size: 0.75rem; }
                .browser-state.is-empty { flex-direction: column; text-align: center; }
                .browser-state.is-empty strong { margin-top: 0.25rem; color: var(--text-secondary); }
                .browser-state.is-empty span { max-width: 280px; font-size: 0.68rem; }
                .drop-overlay { position: absolute; z-index: 10; inset: 0.7rem; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 0.55rem; border: 1.5px dashed #60a5fa; border-radius: 10px; background: rgba(7,12,22,0.92); color: #dbeafe; pointer-events: none; }
                .drop-overlay span { color: #93c5fd; font-size: 0.7rem; }
                .finder-inspector { min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow-y: auto; overscroll-behavior: contain; scrollbar-gutter: stable; padding: 0.8rem; border-left: 1px solid var(--border-subtle); background: color-mix(in srgb, var(--bg-surface) 76%, transparent); }
                .inspector-preview { aspect-ratio: 4 / 3; display: grid; place-items: center; overflow: hidden; border: 1px solid var(--border-subtle); border-radius: 8px; background: #080808; color: var(--text-tertiary); }
                .inspector-preview img { width: 100%; height: 100%; object-fit: contain; }
                .inspector-heading { display: flex; flex-direction: column; gap: 0.4rem; padding: 0.75rem 0 0.65rem; border-bottom: 1px solid var(--border-subtle); }
                .inspector-heading strong { overflow: hidden; font-size: 0.75rem; text-overflow: ellipsis; white-space: nowrap; }
                .inspector-heading span { width: fit-content; padding: 0.18rem 0.38rem; border-radius: 999px; background: rgba(255,255,255,0.07); color: var(--text-tertiary); font-size: 0.56rem; }
                .inspector-heading span.is-catalogued { background: rgba(34,197,94,0.1); color: #86efac; }
                .finder-inspector dl { display: flex; flex-direction: column; gap: 0.62rem; margin: 0.8rem 0; }
                .finder-inspector dl > div { display: grid; grid-template-columns: 68px minmax(0,1fr); gap: 0.45rem; }
                .finder-inspector dt { color: var(--text-tertiary); font-size: 0.61rem; }
                .finder-inspector dd { overflow: hidden; margin: 0; color: var(--text-secondary); font-size: 0.62rem; line-height: 1.4; text-overflow: ellipsis; }
                .inspector-actions { margin-top: auto; }
                .inspector-actions > * { flex: 1; }
                .finder-inspector > p { margin: 0.65rem 0 0; color: var(--text-tertiary); font-size: 0.58rem; line-height: 1.45; }
                .inspector-empty { margin: auto; display: flex; align-items: center; flex-direction: column; gap: 0.45rem; color: var(--text-tertiary); text-align: center; }
                .inspector-empty strong { color: var(--text-secondary); font-size: 0.75rem; }
                .inspector-empty span { max-width: 170px; font-size: 0.62rem; line-height: 1.45; }
                .modal-backdrop { position: fixed; z-index: 1000; inset: 0; display: grid; place-items: center; padding: 1rem; background: rgba(0,0,0,0.68); backdrop-filter: blur(5px); }
                .folder-dialog { width: min(390px, 100%); display: grid; grid-template-columns: auto 1fr; gap: 0.85rem; padding: 1.1rem; border: 1px solid var(--border-subtle); border-radius: 12px; background: var(--bg-card); box-shadow: 0 24px 80px rgba(0,0,0,0.5); }
                .dialog-icon { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 9px; background: rgba(214,184,110,0.12); color: #d6b86e; }
                .folder-dialog h3 { margin: 0; font-size: 1rem; }
                .folder-dialog p { margin: 0.28rem 0 0; color: var(--text-tertiary); font-size: 0.68rem; }
                .folder-dialog label, .folder-dialog > input, .dialog-actions { grid-column: 1 / -1; }
                .folder-dialog label { margin-top: 0.2rem; color: var(--text-secondary); font-size: 0.65rem; }
                .folder-dialog > input { padding: 0.62rem 0.7rem; border: 1px solid var(--border-subtle); border-radius: 7px; outline: 0; background: var(--bg-surface); color: var(--text-primary); font: inherit; font-size: 0.75rem; }
                .folder-dialog > input:focus { border-color: rgba(96,165,250,0.65); }
                .dialog-actions { justify-content: flex-end; margin-top: 0.35rem; }
                .visually-hidden-file-input { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; clip-path: inset(50%); }
                .is-spinning { animation: media-spin 0.8s linear infinite; }
                @keyframes media-spin { to { transform: rotate(360deg); } }
                @media (max-width: 1180px) {
                    .finder-window { grid-template-columns: 170px minmax(0,1fr); }
                    .finder-inspector { display: none; }
                    .finder-toolbar { align-items: stretch; flex-direction: column; }
                    .search-field { max-width: none; }
                    .toolbar-actions { margin-left: 0; flex-wrap: wrap; }
                }
                @media (max-width: 760px) {
                    .media-library-header { flex-direction: column; gap: 0.8rem; }
                    .header-actions { width: 100%; justify-content: space-between; }
                    .finder-window { height: max(520px, calc(100dvh - 210px)); max-height: 760px; grid-template-columns: 1fr; }
                    .finder-sidebar { display: none; }
                    .finder-items.is-grid { grid-template-columns: repeat(auto-fill, minmax(104px,1fr)); }
                    .toolbar-actions select { flex: 1; }
                    .list-heading, .finder-items.is-list .folder-item, .finder-items.is-list .file-item { grid-template-columns: minmax(150px,1fr) 70px 70px; }
                    .list-heading span:last-child, .finder-items.is-list .folder-item > span:last-child, .finder-items.is-list .file-item > span:last-child { display: none; }
                    .breadcrumbs button { max-width: 95px; }
                    .item-count { display: none; }
                }
            `}</style>
        </section>
    );
}
