import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowLeft,
    CheckCircle2,
    ChevronRight,
    ChevronDown,
    Copy,
    Download,
    ClipboardPaste,
    Scissors,
    MoreHorizontal,
    ExternalLink,
    File,
    FileImage,
    Folder,
    FolderOpen,
    Grid2X2,
    ImagePlus,
    Pencil,
    FolderInput,
    PanelLeft,
    Music,
    Film,
    Info,
    LayoutList,
    LoaderCircle,
    Plus,
    RefreshCw,
    Search,
    UploadCloud,
    X,
} from 'lucide-react';
import AdminPageHeader from './AdminPageHeader';
import MediaLibraryMenu from './MediaLibraryMenu';
import MediaLibraryDialog from './MediaLibraryDialog';
import MediaLibraryFolderTree from './MediaLibraryFolderTree';
import { filterLibraryFiles, mediaType } from '../../lib/media/libraryView';
import { createLibraryCache } from '../../lib/media/libraryCache';
import './media-library.css';

import { maxUploadBytes } from '../../lib/media/uploadPolicy';
import { createLibraryArchive, saveLibraryBlob, uploadLibraryFile } from '../../lib/media/libraryTransfers';

const LIBRARY_DRAG_TYPE = 'application/x-abodid-media-library';
const listingUrl = (folder, { type = 'all', sort = 'date-desc', page = 0, term = '' } = {}) => {
    // Folder endpoints return a complete listing; their filters/sort run locally.
    const params = new URLSearchParams(folder ? {} : { type, sort, page: String(page) });
    if (folder) params.set('folder', folder);
    else params.set('view', 'all');
    if (term) params.set('q', term);
    return `/api/admin/media${term ? '/search' : ''}?${params}`;
};

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
    const basename = (file.objectKey || file.name || '').split('/').pop();
    const extension = basename?.includes('.') ? basename.split('.').pop() : '';
    if (extension) return extension.toUpperCase();
    if (file.mimeType?.startsWith('image/')) return 'Image';
    if (file.mimeType?.startsWith('video/')) return 'Video';
    if (file.mimeType?.startsWith('audio/')) return 'Audio';
    return 'File';
};

const readImageDimensions = (file) => new Promise((resolve) => {
    if (!file.type?.startsWith('image/')) {
        resolve({ width: null, height: null });
        return;
    }
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    const timer = window.setTimeout(() => finish({ width: null, height: null }), 5000);
    const finish = (dimensions) => {
        window.clearTimeout(timer);
        image.onload = null;
        image.onerror = null;
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
    const [typeFilter, setTypeFilter] = useState('all');
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [mobileFoldersOpen, setMobileFoldersOpen] = useState(false);
    const [totalCount, setTotalCount] = useState(null);
    const [hasMore, setHasMore] = useState(false);
    const [loadedPage, setLoadedPage] = useState(0);
    const [loadingMore, setLoadingMore] = useState(false);
    const requestRef = useRef(null);
    // Keep private listings only in this authenticated component's memory.
    const listingCache = useMemo(() => createLibraryCache(60_000), [accessToken]);
    const indexNeedsRefresh = useRef(false);
    const prefetchTimer = useRef(null);
    const prefetchBusy = useRef(false);
    const [renameItem, setRenameItem] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [movePicker, setMovePicker] = useState(null);
    const [movePath, setMovePath] = useState('');
    const [moveFolders, setMoveFolders] = useState([]);
    const [moveLoading, setMoveLoading] = useState(false);
    const [altDraft, setAltDraft] = useState('');
    const [savingDetails, setSavingDetails] = useState(false);
    const [folders, setFolders] = useState([]);
    const [rootFolders, setRootFolders] = useState([]);
    const [currentFolder, setCurrentFolder] = useState('');
    const [selectedKey, setSelectedKey] = useState('');
    const [selectedFolder, setSelectedFolder] = useState(null);
    const [organizeProgress, setOrganizeProgress] = useState('');
    const draggedFolder = useRef(null);
    const [checkedFiles, setCheckedFiles] = useState(() => new Map());
    const [downloading, setDownloading] = useState(false);
    const [organizing, setOrganizing] = useState(false);
    const [clipboard, setClipboard] = useState(null);
    const [dropFolder, setDropFolder] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);
    const [refreshIndex, setRefreshIndex] = useState(0);
    const organizeInFlight = useRef(false);
    const draggedFiles = useRef([]);
    const closeContextMenu = useCallback(() => setContextMenu(null), []);
    const [downloadProgress, setDownloadProgress] = useState(null);
    const [query, setQuery] = useState('');
    const [folderMatches, setFolderMatches] = useState([]);
    const [searching, setSearching] = useState(false);
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
    const selectAllRef = useRef(null);
    const uploadInFlight = useRef(false);

    useEffect(() => {
        const savedView = window.localStorage.getItem('admin-media-view');
        if (savedView === 'grid' || savedView === 'list') setViewMode(savedView);
    }, []);

    const changeView = (mode) => {
        setViewMode(mode);
        window.localStorage.setItem('admin-media-view', mode);
    };

    const authorizedFetch = useCallback(async (url, options = {}) => {
        const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
        try { return await fetch(url, {
            ...options,
            headers: {
                ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
                ...(options.headers || {}),
                Authorization: `Bearer ${accessToken}`,
            },
        }); } finally {
            // Even a failed batch may have completed some writes.
            if (options.method && options.method !== 'GET' && url.startsWith('/api/admin/media/')) {
                listingCache.clear();
                if (indexNeedsRefresh.current !== true) indexNeedsRefresh.current = url.endsWith('/metadata') ? 'catalogue' : true;
            }
        }
    }, [accessToken, listingCache]);

    const loadFolder = useCallback(async (folderPath, { silent = false, page = 0, append = false, force = false } = {}) => {
        if (!accessToken) return;
        requestRef.current?.abort();
        const controller = new AbortController();
        requestRef.current = controller;
        const refresh = force || (!folderPath && indexNeedsRefresh.current);
        if (refresh) listingCache.clear();
        const term = query.trim();
        const url = listingUrl(folderPath, { type: typeFilter, sort: sortBy, page, term });
        const cached = listingCache.peek(url);
        if (append) setLoadingMore(true);
        else setLoading(!silent && !cached);
        setSearching(Boolean(term) && !cached);
        setError('');
        const apply = (payload) => {
            if (controller.signal.aborted) return;
            setFiles((current) => append ? [...new Map([...current, ...(payload.files || [])].map((file) => [file.objectKey, file])).values()] : payload.files || []);
            // Searches inside a folder retain its navigation cards.
            if (!term || !folderPath) setFolders(payload.folders || []);
            setFolderMatches(payload.folderMatches || []);
            setTruncated(Boolean(payload.truncated));
            setHasMore(Boolean(payload.hasMore));
            setTotalCount(typeof payload.totalCount === 'number' ? payload.totalCount : null);
            setLoadedPage(page);
            setCatalogueReady(true);
            if (force) setRefreshIndex((value) => value + 1);
            if (!folderPath && (!term || payload.folders)) setRootFolders(payload.folders || []);
            if (!append) setSelectedKey((current) => (payload.files || []).some((file) => file.objectKey === current) ? current : '');
        };
        try {
            if (cached) apply(cached.value);
            // Shared requests survive navigation so returning to a folder can
            // reuse an in-flight fetch. The controller guards UI updates only.
            const payload = await listingCache.read(url, async () => readJsonResponse(await authorizedFetch(refresh ? `${url}&refresh=${refresh === true ? '1' : 'catalogue'}` : url)));
            if (!folderPath && !controller.signal.aborted) indexNeedsRefresh.current = false;
            apply(payload);
        } catch (loadError) {
            if (!controller.signal.aborted && loadError.name !== 'AbortError') { setCatalogueReady(false); setError(loadError.message); }
        } finally {
            if (requestRef.current === controller) { setLoading(false); setSearching(false); setLoadingMore(false); }
        }
    }, [accessToken, authorizedFetch, listingCache, query, typeFilter, sortBy]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            loadFolder(currentFolder);
        }, query.trim() ? 250 : 0);
        return () => { window.clearTimeout(timer); requestRef.current?.abort(); };
    }, [currentFolder, loadFolder]);

    useEffect(() => () => { window.clearTimeout(prefetchTimer.current); }, [listingCache]);

    const fetchFolders = useCallback(async (folder) => {
        const url = `/api/admin/media?${new URLSearchParams({ folder, foldersOnly: '1' })}`;
        const payload = await listingCache.read(url, async () => readJsonResponse(await authorizedFetch(url)));
        return payload.folders || [];
    }, [authorizedFetch, listingCache]);

    useEffect(() => {
        if (!movePicker) return undefined;
        let active = true;
        setMoveLoading(true);
        fetchFolders(movePath).then((rows) => { if (active) setMoveFolders(rows); })
            .catch((moveError) => { if (active) setError(moveError.message); })
            .finally(() => { if (active) setMoveLoading(false); });
        return () => { active = false; };
    }, [movePicker, movePath, fetchFolders]);

    const navigateTo = (folderPath) => {
        if (uploadInFlight.current || organizeInFlight.current) return;
        setSelectedKey('');
        setSelectedFolder(null);
        setDetailsOpen(false);
        setMobileFoldersOpen(false);
        setQuery('');
        setNotice('');
        if (currentFolder === folderPath) loadFolder(folderPath);
        else setCurrentFolder(folderPath);
    };

    const activeFiles = files;
    const folderMatchMap = useMemo(
        () => new Map(folderMatches.map((match) => [match.path, match.count])),
        [folderMatches],
    );

    const selectedFile = useMemo(
        () => checkedFiles.size === 1 ? [...checkedFiles.values()][0] : activeFiles.find((file) => file.objectKey === selectedKey) || null,
        [activeFiles, selectedKey, checkedFiles],
    );

    const visibleFolders = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (typeFilter !== 'all') return [];
        return folders
            .map((folder) => ({ ...folder, matchCount: folderMatchMap.get(folder.path) || 0 }))
            .filter((folder) => !needle || folder.matchCount > 0 || folder.name.toLowerCase().includes(needle))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    }, [folderMatchMap, folders, query, typeFilter]);

    const visibleFiles = useMemo(() => filterLibraryFiles(activeFiles, { type: typeFilter, sort: sortBy }), [activeFiles, typeFilter, sortBy]);

    const visibleCheckedCount = visibleFiles.filter((file) => checkedFiles.has(file.objectKey)).length;
    const allVisibleChecked = visibleFiles.length > 0 && visibleCheckedCount === visibleFiles.length;
    useEffect(() => {
        if (selectAllRef.current) selectAllRef.current.indeterminate = visibleCheckedCount > 0 && !allVisibleChecked;
    }, [visibleCheckedCount, allVisibleChecked]);

    const toggleFile = (file, checked) => {
        setSelectedFolder(null);
        if (checked) setDetailsOpen(true);
        else if (selectedKey === file.objectKey) setSelectedKey('');
        setCheckedFiles((current) => {
            const next = new Map(current);
            if (checked) next.set(file.objectKey, file);
            else next.delete(file.objectKey);
            return next;
        });
    };

    const toggleVisibleFiles = (checked) => {
        setSelectedFolder(null);
        if (checked) setDetailsOpen(true);
        else { setSelectedKey(''); setDetailsOpen(false); }
        setCheckedFiles((current) => {
            const next = new Map(current);
            visibleFiles.forEach((file) => {
                if (checked) next.set(file.objectKey, file);
                else next.delete(file.objectKey);
            });
            return next;
        });
    };

    const downloadFiles = async (selection) => {
        if (!selection.length || downloading) return;
        setDownloading(true);
        setError('');
        setNotice('');
        setDownloadProgress({ current: 0, total: selection.length });
        try {
            const blob = await createLibraryArchive(selection, setDownloadProgress, (file) => authorizedFetch('/api/admin/media/download', {
                method: 'POST',
                body: JSON.stringify({ objectKey: file.objectKey }),
            }));
            saveLibraryBlob(blob, 'media-library.zip');
            setNotice(`Download started for ${selection.length} ${selection.length === 1 ? 'file' : 'files'} in media-library.zip.`);
        } catch (downloadError) {
            setError(downloadError.message || 'Could not download the selected files. Please try again.');
        } finally {
            setDownloading(false);
            setDownloadProgress(null);
        }
    };

    const uploadFiles = async (fileList, destinationFolder = currentFolder) => {
        const selected = Array.from(fileList || []);
        if (!selected.length || uploadInFlight.current || organizeInFlight.current || !catalogueReady) return;
        uploadInFlight.current = true;
        const targetFolder = destinationFolder;
        let uploaded = 0;
        const failures = [];
        setUploading(true);
        setError('');
        setNotice('');
        setUploadProgress({ current: 0, total: selected.length, folder: targetFolder });

        try {
            for (let index = 0; index < selected.length; index += 1) {
                const file = selected[index];
                setUploadProgress({ current: index + 1, total: selected.length, filename: file.name, folder: targetFolder });
                try {
                    const maxSize = maxUploadBytes(file.type);
                    if (!file.size) throw new Error('The file is empty.');
                    if (file.size > maxSize) throw new Error(`File exceeds the ${maxSize / (1024 * 1024)} MB size limit.`);
                    const dimensions = await readImageDimensions(file);
                    await uploadLibraryFile(file, targetFolder, dimensions, authorizedFetch);
                    uploaded += 1;
                } catch (uploadError) {
                    failures.push(`${file.name}: ${uploadError.message}`);
                }
            }
            await loadFolder(currentFolder, { silent: true, force: true });
            if (uploaded) setNotice(`${uploaded} ${uploaded === 1 ? 'file' : 'files'} uploaded successfully.`);
            if (failures.length) setError(`${failures.length} ${failures.length === 1 ? 'file failed' : 'files failed'} to upload. ${failures.join(' ')}`);
        } finally {
            uploadInFlight.current = false;
            setUploading(false);
            setUploadProgress(null);
            setDragging(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const selection = selectedFolder ? [] : checkedFiles.size ? [...checkedFiles.values()] : selectedFile ? [selectedFile] : [];
    const busy = uploading || organizing || downloading || savingDetails;

    const clipboardCount = (clipboard?.files.length || 0) + (clipboard?.folders?.length || 0);
    const copyFiles = (items, mode = 'copy', folder = null) => {
        if ((!items.length && !folder) || busy) return;
        if (folder) {
            setClipboard({ files: [], folders: [folder], mode });
            setNotice(`Folder “${folder.name}” ${mode === 'copy' ? 'copied' : 'cut'}. Open a folder and choose Paste.`);
            return;
        }
        setClipboard({ files: items, folders: [], mode });
        setNotice(`${items.length} ${items.length === 1 ? 'file' : 'files'} ${mode === 'copy' ? 'copied' : 'cut'}. Open a folder and choose Paste.`);
    };

    const organizeFiles = async (items, destinationFolder, action = 'move') => {
        if (!items.length || busy || organizeInFlight.current) return;
        organizeInFlight.current = true;
        setOrganizing(true);
        setError('');
        setNotice('');
        const results = [];
        try {
            for (let offset = 0; offset < items.length; offset += 100) {
                const response = await authorizedFetch('/api/admin/media/organize', {
                    method: 'POST',
                    body: JSON.stringify({ action, destinationFolder, objectKeys: items.slice(offset, offset + 100).map((file) => file.objectKey) }),
                });
                const payload = await readJsonResponse(response);
                results.push(...payload.results);
            }
        } catch (operationError) {
            results.push({ error: operationError.message });
        } finally {
            const completed = results.filter((result) => !result.error);
            const keys = new Set(completed.map((result) => result.objectKey));
            if (action === 'move') {
                setSelectedKey('');
                setCheckedFiles((current) => new Map([...current].filter(([key]) => !keys.has(key))));
                setClipboard((current) => current?.mode === 'move' ? { ...current, files: current.files.filter((file) => !keys.has(file.objectKey)) } : current);
            }
            await loadFolder(currentFolder, { silent: true, force: true });
            const changed = completed.filter((result) => !result.unchanged).length;
            if (completed.length) setNotice(changed ? `${changed} ${changed === 1 ? 'file' : 'files'} ${action === 'copy' ? 'copied' : 'moved'} to ${destinationFolder || 'assets'}.` : 'The files are already in that folder.');
            const failures = results.filter((result) => result.error);
            if (failures.length) setError(failures.map((result) => `${items.find((file) => file.objectKey === result.objectKey)?.name || 'File operation'}: ${result.error}`).join(' '));
            organizeInFlight.current = false;
            setOrganizing(false);
        }
        return results.every((result) => !result.error);
    };

    const organizeFolder = async (folder, destinationFolder, action = 'move', destinationName = '') => {
        if (!folder || busy || organizeInFlight.current) return;
        organizeInFlight.current = true;
        setOrganizing(true);
        setError(''); setNotice('');
        setOrganizeProgress(`Preparing folder “${folder.name}”…`);
        let destination = destinationFolder;
        let success = false;
        let failure = '';
        let unchanged = false;
        try {
            const plan = await readJsonResponse(await authorizedFetch('/api/admin/media/folder-organize', {
                method: 'POST', body: JSON.stringify({ phase: 'plan', action, sourceFolder: folder.path, destinationFolder, ...(destinationName ? { destinationName } : {}) }),
            }));
            destination = plan.destinationFolder;
            unchanged = Boolean(plan.unchanged);
            if (!plan.unchanged) {
                let completed = 0;
                for (const group of plan.groups) {
                    for (let offset = 0; offset < group.files.length; offset += 100) {
                        setOrganizeProgress(`${action === 'copy' ? 'Copying' : 'Moving'} “${folder.name}”: ${completed}/${plan.fileCount} files…`);
                        const payload = await readJsonResponse(await authorizedFetch('/api/admin/media/organize', {
                            method: 'POST', body: JSON.stringify({ action, destinationFolder: group.destinationFolder, objectKeys: group.files.slice(offset, offset + 100).map((file) => file.objectKey) }),
                        }));
                        const failures = payload.results.filter((result) => result.error);
                        if (failures.length) throw new Error(`${failures[0].error} Some items may already be in the destination. The source folder stays visible; refresh before retrying.`);
                        completed += payload.results.length;
                    }
                }
                if (action === 'move') await readJsonResponse(await authorizedFetch('/api/admin/media/folder-organize', {
                    method: 'POST', body: JSON.stringify({ phase: 'finish', action, sourceFolder: folder.path, destinationFolder: destination }),
                }));
            }
            success = true;
            if (action === 'move') {
                setClipboard((current) => current?.mode === 'move' && current.folders?.some((item) => item.path === folder.path) ? null : current);
                setCheckedFiles(new Map());
                setSelectedFolder(null);
            }
        } catch (operationError) {
            failure = operationError.message;
        } finally {
            // Folder moves may change the root sidebar as well as the open folder.
            await loadFolder(currentFolder, { silent: true, force: true });
            if (currentFolder) {
                try { const root = await readJsonResponse(await authorizedFetch('/api/admin/media?')); setRootFolders(root.folders || []); } catch { /* Open-folder refresh already reports connection errors. */ }
            }
            if (failure) setError(failure);
            if (success) setNotice(unchanged && !destinationName ? 'This folder is already in that location.' : destinationName ? `Folder renamed to “${destination.split('/').pop()}”.` : `Folder “${folder.name}” ${action === 'copy' ? 'copied' : 'moved'} to ${destination || 'assets'}.`);
            organizeInFlight.current = false;
            setOrganizing(false);
            setOrganizeProgress('');
        }
        return success;
    };

    const pasteFiles = (folder = currentFolder) => {
        if (clipboard?.folders?.length) organizeFolder(clipboard.folders[0], folder, clipboard.mode);
        else if (clipboard?.files.length) organizeFiles(clipboard.files, folder, clipboard.mode);
    };

    const openContextMenu = (event, items = selection, folder = currentFolder, folderItem = null) => {
        if (event.target.closest('textarea, select, input:not([type="checkbox"]), [contenteditable="true"]')) return;
        event.preventDefault();
        event.stopPropagation();
        const source = event.target.closest('button, [tabindex]') || event.currentTarget;
        const rect = source.getBoundingClientRect();
        // A contextmenu event can precede pointerup. Opening an auto popover
        // before that release makes the browser immediately light-dismiss it.
        const ready = event.buttons ? new Promise((resolve) => window.addEventListener('pointerup', resolve, { once: true })) : Promise.resolve();
        setContextMenu({ x: event.clientX || rect.left, y: event.clientY || rect.bottom, files: items, folder, folderItem, source, ready });
    };

    const openFolderMenu = (event, folder) => {
        setDetailsOpen(true);
        setSelectedFolder(folder);
        setSelectedKey('');
        setCheckedFiles(new Map());
        openContextMenu(event, [], folder.path, folder);
    };

    const startFolderDrag = (event, folder) => {
        if (busy) { event.preventDefault(); return; }
        event.stopPropagation();
        draggedFolder.current = folder;
        draggedFiles.current = [];
        event.dataTransfer.setData(LIBRARY_DRAG_TYPE, 'folder');
        event.dataTransfer.effectAllowed = 'move';
        setDragging(false);
    };

    const startFileDrag = (event, file) => {
        draggedFolder.current = null;
        if (busy) { event.preventDefault(); return; }
        const items = checkedFiles.has(file.objectKey) ? [...checkedFiles.values()] : [file];
        draggedFiles.current = items;
        event.dataTransfer.setData(LIBRARY_DRAG_TYPE, 'files');
        event.dataTransfer.effectAllowed = 'move';
        setDragging(false);
    };

    const prefetchFolder = (path) => {
        window.clearTimeout(prefetchTimer.current);
        const connection = navigator.connection;
        if (!accessToken || busy || path === currentFolder || prefetchBusy.current || connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '')) return;
        prefetchTimer.current = window.setTimeout(async () => {
            const url = listingUrl(path, { type: typeFilter, sort: sortBy });
            if ((!path && indexNeedsRefresh.current) || listingCache.peek(url)?.fresh || prefetchBusy.current) return;
            prefetchBusy.current = true;
            try {
                await listingCache.read(url, async () => readJsonResponse(await authorizedFetch(url, { priority: 'low' })));
            } catch { /* Navigation retries speculative requests and reports real failures. */ }
            finally { prefetchBusy.current = false; }
        }, 180);
    };

    const folderDropProps = (path) => ({
        onPointerEnter: () => prefetchFolder(path),
        onPointerLeave: () => window.clearTimeout(prefetchTimer.current),
        onFocus: () => prefetchFolder(path),
        onKeyDown: (event) => {
            if (path && (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))) openFolderMenu(event, { path, name: path.split('/').pop() });
        },
        onDragOver: (event) => {
            const internal = event.dataTransfer.types.includes(LIBRARY_DRAG_TYPE);
            const external = event.dataTransfer.types.includes('Files');
            if (busy || (!internal && !external)) return;
            event.preventDefault(); event.stopPropagation();
            event.dataTransfer.dropEffect = internal ? 'move' : 'copy';
            setDropFolder(path); setDragging(false);
        },
        onDragLeave: (event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDropFolder((current) => current === path ? null : current); },
        onDrop: (event) => {
            event.preventDefault(); event.stopPropagation();
            setDropFolder(null); setDragging(false);
            if (busy) return;
            if (event.dataTransfer.types.includes(LIBRARY_DRAG_TYPE)) {
                if (draggedFolder.current) organizeFolder(draggedFolder.current, path, 'move');
                else organizeFiles(draggedFiles.current, path, 'move');
                draggedFiles.current = []; draggedFolder.current = null;
            } else if (event.dataTransfer.files.length) uploadFiles(event.dataTransfer.files, path);
        },
    });

    const openRename = (file = null, folder = null) => {
        setError('');
        setRenameItem(folder ? { kind: 'folder', item: folder } : { kind: 'file', item: file });
        setRenameValue(folder?.name || file?.name || '');
    };
    const openMove = (items = selection, folder = selectedFolder) => {
        setError(''); setMovePath(currentFolder); setMoveFolders([]);
        setMovePicker({ files: items, folder });
    };
    const saveFileMetadata = async (file, patch) => {
        const payload = await readJsonResponse(await authorizedFetch('/api/admin/media/metadata', { method: 'POST', body: JSON.stringify({ objectKey: file.objectKey, ...patch }) }));
        const update = (item) => item.objectKey === file.objectKey ? { ...item, name: payload.name, altText: payload.altText } : item;
        setFiles((current) => current.map(update));
        setCheckedFiles((current) => new Map([...current].map(([key, item]) => [key, update(item)])));
        if (!currentFolder && (sortBy.startsWith('name') || query.trim())) await loadFolder(currentFolder, { silent: true });
        return payload;
    };
    const submitRename = async (event) => {
        event.preventDefault();
        if (!renameValue.trim() || busy) return;
        if (renameItem.kind === 'folder') {
            const parent = renameItem.item.path.split('/').slice(0, -1).join('/');
            if (await organizeFolder(renameItem.item, parent, 'move', renameValue.trim())) setRenameItem(null);
            return;
        }
        setSavingDetails(true); setError('');
        try {
            await saveFileMetadata(renameItem.item, { name: renameValue.trim() });
            setRenameItem(null); setNotice('File renamed. Its public link is unchanged.');
        } catch (saveError) { setError(saveError.message); }
        finally { setSavingDetails(false); }
    };
    const submitMove = async (event) => {
        event.preventDefault();
        if (!movePicker || busy) return;
        const success = movePicker.folder ? await organizeFolder(movePicker.folder, movePath) : await organizeFiles(movePicker.files, movePath);
        if (success) setMovePicker(null);
    };
    const copySelectionLinks = async () => {
        if (!selection.length) return;
        try { await navigator.clipboard.writeText(selection.map((file) => file.publicUrl).join('\n')); setNotice(`${selection.length === 1 ? 'Public link' : 'Public links'} copied.`); }
        catch { setError('Could not copy the links. Open the file and copy the address from the browser.'); }
    };

    const menuFolder = contextMenu?.folderItem || null;
    const menuItems = contextMenu ? [
        ...(menuFolder ? [{ label: 'Open folder', icon: <FolderOpen size={15} />, disabled: busy, run: () => navigateTo(menuFolder.path) }] : []),
        { label: menuFolder ? 'Copy folder' : 'Copy files', icon: <Copy size={15} />, disabled: busy || (!menuFolder && !contextMenu.files.length), run: () => copyFiles(contextMenu.files, 'copy', menuFolder) },
        { label: menuFolder ? 'Cut folder' : 'Cut files', icon: <Scissors size={15} />, disabled: busy || (!menuFolder && !contextMenu.files.length), run: () => copyFiles(contextMenu.files, 'move', menuFolder) },
        { label: menuFolder ? 'Rename folder' : 'Rename file', icon: <Pencil size={15} />, disabled: busy || (!menuFolder && contextMenu.files.length !== 1), run: () => openRename(contextMenu.files[0], menuFolder) },
        { label: 'Move to folder…', icon: <FolderInput size={15} />, disabled: busy || (!menuFolder && !contextMenu.files.length), run: () => openMove(contextMenu.files, menuFolder) },
        { label: 'Paste into this folder', icon: <ClipboardPaste size={15} />, disabled: busy || !clipboardCount, run: () => pasteFiles(contextMenu.folder) },
        ...(!menuFolder ? [
            { label: 'Move selected here', icon: <FolderOpen size={15} />, disabled: busy || !contextMenu.files.length, run: () => organizeFiles(contextMenu.files, contextMenu.folder) },
            { label: 'Download files (ZIP)', icon: <Download size={15} />, disabled: busy || !contextMenu.files.length, run: () => downloadFiles(contextMenu.files) },
        ] : []),
    ] : [];

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
            setNotice(
                payload.variantPaths?.length
                    ? `Folder “${payload.folder.name}” created with 800px and 1600px variants.`
                    : `Folder “${payload.folder.name}” created.`,
            );
            await loadFolder(currentFolder, { silent: true, force: true });
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
            setNotice('Public link copied.');
        } catch {
            setError('Could not copy the link. Open the file and copy it from the browser.');
        }
    };

    const breadcrumbs = useMemo(() => makeBreadcrumbs(currentFolder), [currentFolder]);
    const canUpload = !busy && catalogueReady;
    const canCreateFolder = !busy;

    const showInspector = detailsOpen && Boolean(selectedFolder || selectedFile || checkedFiles.size > 1);
    const selectionCount = selectedFolder ? 1 : selection.length;
    useEffect(() => { setAltDraft(selectedFile?.altText || ''); }, [selectedFile?.objectKey, selectedFile?.altText]);
    const saveAltText = async (event) => {
        event.preventDefault();
        if (!selectedFile || savingDetails) return;
        setSavingDetails(true); setError('');
        try { await saveFileMetadata(selectedFile, { altText: altDraft }); setNotice('Image description saved.'); }
        catch (saveError) { setError(saveError.message); }
        finally { setSavingDetails(false); }
    };
    const closeDetails = () => setDetailsOpen(false);

    const filePreview = (file, inspector = false, index = 0) => {
        const type = mediaType(file);
        if (type === 'images') return <span className="file-visual is-image"><FileImage size={inspector ? 44 : 48} className="image-fallback" /><img src={inspector ? file.variants?.['1600']?.url || file.variants?.['800']?.url || file.publicUrl : file.variants?.['800']?.url || file.publicUrl} alt={inspector ? file.altText || '' : ''} loading={inspector || index < 4 ? 'eager' : 'lazy'} fetchPriority={index === 0 || inspector ? 'high' : 'auto'} decoding="async" draggable={false} onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} /></span>;
        if (inspector && type === 'videos') return <video controls playsInline preload="metadata" src={file.publicUrl} aria-label={`Preview ${file.name}`} />;
        if (inspector && type === 'audio') return <div className="audio-preview"><Music size={40} /><audio controls preload="metadata" src={file.publicUrl} aria-label={`Preview ${file.name}`} /></div>;
        const Icon = type === 'videos' ? Film : type === 'audio' ? Music : File;
        return <span className={`file-visual is-${type}`}><Icon size={inspector ? 44 : 56} /><span className="file-format">{fileKind(file)}</span></span>;
    };
    const moveIntoSelf = Boolean(movePicker?.folder && (movePath === movePicker.folder.path || movePath.startsWith(`${movePicker.folder.path}/`)));

    return (
        <section className="media-library" aria-labelledby="media-library-title" tabIndex={-1}
            onContextMenu={openContextMenu}
            onKeyDown={(event) => {
                if (event.target.closest('textarea, select, input:not([type="checkbox"]), [contenteditable="true"], dialog')) return;
                if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) { openContextMenu(event, selection, currentFolder, selectedFolder); return; }
                if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
                const key = event.key.toLowerCase();
                if (['c', 'x'].includes(key) && (selection.length || selectedFolder)) { event.preventDefault(); copyFiles(selection, key === 'x' ? 'move' : 'copy', selectedFolder); }
                if (key === 'v' && clipboardCount) { event.preventDefault(); pasteFiles(); }
            }}>
            <div className="media-library-header">
                <AdminPageHeader className="media-library-page-header" headingId="media-library-title" title="Media Library" description="Browse, search, and manage your files in one place." />
                <div className="header-actions">
                    <span className={`connection-pill ${catalogueReady ? 'is-ready' : ''}`}><span />{catalogueReady ? 'Library connected' : 'Checking connection'}</span>
                    <button type="button" className="secondary-button" disabled={loading || busy} onClick={() => loadFolder(currentFolder, { force: true })}><RefreshCw size={15} className={loading ? 'is-spinning' : ''} />Refresh</button>
                </div>
            </div>
            {error && !renameItem && !movePicker && !newFolderOpen && <div className="media-message is-error" role="alert"><Info size={18} /><div><strong>Media Library needs attention</strong><span>{error}</span></div><button type="button" aria-label="Dismiss error" onClick={() => setError('')}><X size={15} /></button></div>}
            {notice && <div className="media-message is-success" role="status"><CheckCircle2 size={18} /><span>{notice}</span><button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><X size={15} /></button></div>}

            <div className={`finder-window ${showInspector ? 'has-inspector' : ''} ${mobileFoldersOpen ? 'folders-open' : ''}`}>
                <aside className="finder-sidebar" id="media-folder-navigation" aria-label="Media folders">
                    <div className="sidebar-heading"><strong><Folder size={17} />Folders</strong><button type="button" className="icon-button" aria-label="Create a new folder" onClick={() => { setError(''); setNewFolderOpen(true); }} disabled={!canCreateFolder}><Plus size={16} /></button></div>
                    <button type="button" className={`sidebar-location all-files-location ${!currentFolder ? 'is-active' : ''}`} onClick={() => navigateTo('')} disabled={busy} {...folderDropProps('')}><Grid2X2 size={16} /><span>All files</span></button>
                    <div className="sidebar-folders">
                        <MediaLibraryFolderTree key={refreshIndex} roots={rootFolders} currentFolder={currentFolder} busy={busy} fetchFolders={fetchFolders} navigateTo={navigateTo} folderDropProps={folderDropProps} openFolderMenu={openFolderMenu} dropFolder={dropFolder} />
                        {!rootFolders.length && !loading && <p className="sidebar-empty">Create a folder to get organized.</p>}
                    </div>
                </aside>

                <main className={`finder-main ${dragging ? 'is-dragging' : ''}`}
                    onDragEnter={(event) => { if (canUpload && event.dataTransfer.types.includes('Files')) { event.preventDefault(); setDragging(true); } }}
                    onDragOver={(event) => { if (canUpload && event.dataTransfer.types.includes('Files')) event.preventDefault(); }}
                    onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
                    onDrop={(event) => { event.preventDefault(); setDragging(false); setDropFolder(null); if (event.dataTransfer.types.includes('Files')) uploadFiles(event.dataTransfer.files); }}>
                    <div className="finder-titlebar">
                        <div className="navigation-actions"><button type="button" className="icon-button mobile-folders-toggle" aria-label="Show folders" aria-expanded={mobileFoldersOpen} aria-controls="media-folder-navigation" onClick={() => setMobileFoldersOpen((open) => !open)}><PanelLeft size={17} /></button>
                            <button type="button" className="icon-button" aria-label="Go to parent folder" disabled={!currentFolder || loading || busy} onClick={() => navigateTo(currentFolder.split('/').slice(0, -1).join('/'))}><ArrowLeft size={17} /></button></div>
                        <nav className="breadcrumbs" aria-label="Current folder"><button type="button" {...folderDropProps('')} className={dropFolder === '' ? 'is-drop-target' : ''} onClick={() => navigateTo('')}>All files</button>{breadcrumbs.map((crumb) => <React.Fragment key={crumb.path}><ChevronRight size={13} /><button type="button" {...folderDropProps(crumb.path)} className={dropFolder === crumb.path ? 'is-drop-target' : ''} onClick={() => navigateTo(crumb.path)} onContextMenu={(event) => openFolderMenu(event, crumb)}>{crumb.name}</button></React.Fragment>)}</nav>
                        <div className="creation-actions"><button type="button" className="secondary-button" disabled={!canCreateFolder} onClick={() => { setError(''); setNewFolderOpen(true); }}><Plus size={16} />New folder</button><button type="button" className="primary-button" disabled={!canUpload} onClick={() => fileInputRef.current?.click()}><UploadCloud size={16} />Upload</button></div>
                        <input ref={fileInputRef} className="visually-hidden-file-input" type="file" multiple aria-label="Upload files" onChange={(event) => uploadFiles(event.target.files)} tabIndex={-1} />
                    </div>
                    <div className="finder-toolbar">
                        <label className="search-field"><Search size={17} /><input type="search" aria-label="Search files" placeholder={currentFolder ? `Search ${currentFolder.split('/').pop()}` : 'Search all files…'} value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={14} /></button>}</label>
                        <label className="filter-control"><span className="visually-hidden">File type</span><select name="mediaType" aria-label="File type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">Type: All files</option><option value="images">Images</option><option value="videos">Videos</option><option value="documents">Documents</option><option value="audio">Audio</option><option value="other">Other files</option></select><ChevronDown className="filter-chevron" size={15} aria-hidden="true" /></label>
                        <label className="filter-control sort-control"><span className="visually-hidden">Sort media</span><select name="mediaSort" aria-label="Sort media" value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="date-desc">Sort: Newest</option><option value="date-asc">Oldest first</option><option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option><option value="size-desc">Largest first</option><option value="size-asc">Smallest first</option></select><ChevronDown className="filter-chevron" size={15} aria-hidden="true" /></label>
                        <div className="view-switcher" role="group" aria-label="View options"><button type="button" aria-label="Grid view" aria-pressed={viewMode === 'grid'} className={viewMode === 'grid' ? 'is-active' : ''} onClick={() => changeView('grid')}><Grid2X2 size={16} /></button><button type="button" aria-label="List view" aria-pressed={viewMode === 'list'} className={viewMode === 'list' ? 'is-active' : ''} onClick={() => changeView('list')}><LayoutList size={17} /></button></div>
                    </div>
                    <div className="selection-toolbar">
                        <label className="select-all-files"><input ref={selectAllRef} type="checkbox" aria-label="Select all shown" checked={allVisibleChecked} disabled={!visibleFiles.length || loading || searching || busy} onChange={(event) => toggleVisibleFiles(event.target.checked)} /><span>{checkedFiles.size ? `${checkedFiles.size} selected` : 'Select all shown'}</span></label>
                        {checkedFiles.size > 0 && <button type="button" className="text-button" onClick={() => { setCheckedFiles(new Map()); setSelectedKey(''); setDetailsOpen(false); }} disabled={busy}>Clear</button>}
                        {selectionCount > 0 && !showInspector && <button type="button" className="text-button" onClick={() => setDetailsOpen(true)}><Info size={14} />Details</button>}
                        <span className="item-count" role="status">{totalCount === null ? `${visibleFiles.length} ${visibleFiles.length === 1 ? 'file' : 'files'}` : `${totalCount.toLocaleString()} ${totalCount === 1 ? 'file' : 'files'}`}</span>
                    </div>
                    {(selectionCount > 0 || clipboardCount > 0) && <div className="file-action-toolbar">
                        {selectionCount > 0 && <>
                            <button type="button" className="secondary-button" disabled={busy} onClick={() => copyFiles(selection, 'copy', selectedFolder)}><Copy size={14} />{selectedFolder ? 'Copy folder' : 'Copy files'}</button>
                            <button type="button" className="secondary-button" disabled={busy} onClick={() => copyFiles(selection, 'move', selectedFolder)}><Scissors size={14} />Cut</button>
                            <button type="button" className="secondary-button" disabled={busy} onClick={() => openMove()}><FolderInput size={14} />Move to folder</button>
                            {!selectedFolder && <button type="button" className="secondary-button" disabled={busy} onClick={() => downloadFiles(selection)}>{downloading ? <LoaderCircle size={14} className="is-spinning" /> : <Download size={14} />}{downloading ? `Preparing ${downloadProgress?.current || 0}/${downloadProgress?.total || 0}…` : 'Download selected (ZIP)'}</button>}
                            <button type="button" className="secondary-button" aria-label="More file actions" aria-haspopup="menu" aria-expanded={Boolean(contextMenu)} disabled={busy} onClick={(event) => openContextMenu(event, selection, currentFolder, selectedFolder)}><MoreHorizontal size={16} /></button>
                        </>}
                        {clipboardCount > 0 && <button type="button" className="secondary-button paste-action" disabled={busy} onClick={() => pasteFiles()}><ClipboardPaste size={14} />Paste here ({clipboardCount})</button>}
                    </div>}
                    {uploading && <div className="upload-strip" role="status"><LoaderCircle size={15} className="is-spinning" /><span>Uploading {uploadProgress?.filename} to {uploadProgress?.folder || 'library root'}…</span><strong>{uploadProgress?.current}/{uploadProgress?.total}</strong></div>}
                    {organizing && <div className="upload-strip" role="status"><LoaderCircle size={15} className="is-spinning" />{organizeProgress || 'Organizing files…'}</div>}
                    {truncated && <div className="limit-note">This view reached its browsing limit. Open a more specific folder to see the remaining files.</div>}

                    <div className="browser-scroll" aria-busy={loading || searching}>
                        {loading || searching ? <div className="browser-state"><LoaderCircle size={23} className="is-spinning" /><span>{searching ? 'Searching files…' : 'Loading files…'}</span></div> : visibleFolders.length || visibleFiles.length ? <>
                            {viewMode === 'list' && <div className="list-heading" aria-hidden="true"><span>Name</span><span>Size</span><span>Type</span><span>Modified</span></div>}
                            <div className={`finder-items is-${viewMode}`}>
                                {visibleFolders.length > 0 && <div className="finder-folder-items">{visibleFolders.map((folder) => <div className="folder-entry" key={folder.path}>
                                    <button type="button" className={`folder-item ${selectedFolder?.path === folder.path ? 'is-selected-folder' : ''} ${dropFolder === folder.path ? 'is-drop-target' : ''} ${clipboard?.mode === 'move' && clipboard.folders?.some((item) => item.path === folder.path) ? 'is-cut' : ''}`} draggable={!busy} onDragStart={(event) => startFolderDrag(event, folder)} onDragEnd={() => { draggedFolder.current = null; setDropFolder(null); }} {...folderDropProps(folder.path)} onClick={() => navigateTo(folder.path)} onContextMenu={(event) => openFolderMenu(event, folder)}>
                                        <span className="folder-visual"><FolderOpen size={viewMode === 'grid' ? 40 : 20} /></span><span className="item-copy"><span className="item-name" title={folder.name}>{folder.name}</span><small>Folder{folder.matchCount ? ` · ${folder.matchCount} matches` : ''}</small></span>{viewMode === 'list' && <><span>—</span><span>Folder</span><span>—</span></>}
                                    </button><button type="button" className="item-more" aria-label={`Actions for folder ${folder.name}`} onClick={(event) => openFolderMenu(event, folder)}><MoreHorizontal size={17} /></button>
                                </div>)}</div>}
                                <div className="finder-file-items">{visibleFiles.map((file, index) => <div className={`file-entry ${checkedFiles.has(file.objectKey) ? 'is-checked' : ''} ${clipboard?.mode === 'move' && clipboard.files.some((item) => item.objectKey === file.objectKey) ? 'is-cut' : ''}`} key={file.objectKey}
                                    onContextMenu={(event) => { const items = checkedFiles.has(file.objectKey) ? [...checkedFiles.values()] : [file]; if (!checkedFiles.has(file.objectKey)) setCheckedFiles(new Map([[file.objectKey, file]])); setSelectedFolder(null); setDetailsOpen(true); setSelectedKey(file.objectKey); openContextMenu(event, items); }}>
                                    <label className="file-selection" title={`Select ${file.name}`}><input type="checkbox" checked={checkedFiles.has(file.objectKey)} disabled={busy} onChange={(event) => toggleFile(file, event.target.checked)} /><span className="visually-hidden">Select {file.name}</span></label>
                                    <button type="button" className={`file-item ${selectedKey === file.objectKey ? 'is-selected' : ''}`} draggable={!busy} onDragStart={(event) => startFileDrag(event, file)} onDragEnd={() => { draggedFiles.current = []; setDropFolder(null); }}
                                        onClick={(event) => { setSelectedFolder(null); setDetailsOpen(true); setSelectedKey(file.objectKey); if (event.ctrlKey || event.metaKey) toggleFile(file, !checkedFiles.has(file.objectKey)); else setCheckedFiles(new Map([[file.objectKey, file]])); }} onDoubleClick={() => window.open(file.publicUrl, '_blank', 'noopener,noreferrer')}>
                                        {filePreview(file, false, index)}<span className="item-copy"><span className="item-name" title={file.name}>{file.name}</span><small>{fileKind(file)}{file.width && file.height ? ` · ${file.width} × ${file.height}` : ''} · {formatBytes(file.fileSize)}</small>{!currentFolder && <small className="item-location" title={file.folderPath}>{file.folderPath || 'Library root'}</small>}</span>
                                        {viewMode === 'list' && <><span>{formatBytes(file.fileSize)}</span><span>{fileKind(file)}</span><span>{formatDate(file.updatedAt || file.createdAt)}</span></>}
                                    </button>
                                    <button type="button" className="item-more" aria-label={`Actions for ${file.name}`} onClick={(event) => { const items = checkedFiles.has(file.objectKey) ? [...checkedFiles.values()] : [file]; setSelectedFolder(null); setDetailsOpen(true); setSelectedKey(file.objectKey); if (!checkedFiles.has(file.objectKey)) setCheckedFiles(new Map([[file.objectKey, file]])); openContextMenu(event, items); }}><MoreHorizontal size={17} /></button>
                                </div>)}</div>
                            </div>
                        </> : <div className="browser-state is-empty"><ImagePlus size={32} /><strong>{query || typeFilter !== 'all' ? 'No matching files' : 'This folder is empty'}</strong><span>{query || typeFilter !== 'all' ? 'Try a different search or file type.' : 'Drop files here or use Upload to add them.'}</span>{(query || typeFilter !== 'all') && <button type="button" className="secondary-button" onClick={() => { setQuery(''); setTypeFilter('all'); }}>Clear filters</button>}</div>}
                        {hasMore && !loading && <div className="load-more"><button type="button" className="secondary-button" disabled={loadingMore} onClick={() => loadFolder(currentFolder, { page: loadedPage + 1, append: true })}>{loadingMore ? <LoaderCircle size={15} className="is-spinning" /> : <Plus size={15} />}Load more files</button><small>{files.length.toLocaleString()} of {totalCount?.toLocaleString()} shown</small></div>}
                    </div>
                    <div className="browser-footer"><span>{currentFolder ? 'Search includes subfolders.' : 'Original files across every folder.'}</span><span>Images ≤20 MB · Other files ≤100 MB</span></div>
                    {dragging && <div className="drop-overlay"><UploadCloud size={36} /><strong>Drop files into {currentFolder.split('/').pop() || 'the library'}</strong><span>Multiple files · All formats</span></div>}
                </main>

                {showInspector && <aside className="finder-inspector" aria-label="Selected file details">
                    <div className="inspector-title"><strong>{selectedFolder ? 'Folder details' : checkedFiles.size > 1 ? 'Selection details' : 'File details'}</strong><button type="button" className="icon-button" aria-label="Close details" onClick={closeDetails}><X size={17} /></button></div>
                    {selectedFolder ? <><div className="inspector-preview is-folder"><FolderOpen size={54} /></div><h3 className="inspector-name">{selectedFolder.name}</h3><p className="inspector-note">Copy or move this folder with its files and subfolders.</p><div className="bulk-inspector-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => copyFiles([], 'copy', selectedFolder)}><Copy size={15} />Copy folder</button><button type="button" className="secondary-button" disabled={busy} onClick={() => openRename(null, selectedFolder)}><Pencil size={15} />Rename folder</button></div></> : checkedFiles.size > 1 ? <><div className="selection-preview"><File size={40} /><strong>{checkedFiles.size} files selected</strong><span>{formatBytes([...checkedFiles.values()].reduce((sum, file) => sum + Number(file.fileSize || 0), 0))} total</span></div><ul className="selected-file-names">{[...checkedFiles.values()].map((file) => <li key={file.objectKey} title={file.name}><File size={14} /><span>{file.name}</span></li>)}</ul><div className="bulk-inspector-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => copyFiles([...checkedFiles.values()])}><Copy size={15} />Copy files</button><button type="button" className="secondary-button" disabled={busy} onClick={copySelectionLinks}><ExternalLink size={15} />Copy public links</button></div></> : selectedFile && <>
                        <div className="inspector-preview">{filePreview(selectedFile, true)}</div><h3 className="inspector-name">{selectedFile.name}</h3>
                        <dl><div><dt>Type</dt><dd>{fileKind(selectedFile)}</dd></div>{selectedFile.width && selectedFile.height && <div><dt>Dimensions</dt><dd>{selectedFile.width} × {selectedFile.height} px</dd></div>}<div><dt>File size</dt><dd>{formatBytes(selectedFile.fileSize)}</dd></div><div><dt>Folder</dt><dd title={selectedFile.folderPath}>{selectedFile.folderPath || 'Library root'}</dd></div><div><dt>Added</dt><dd>{formatDate(selectedFile.createdAt)}</dd></div></dl>
                        <div className="bulk-inspector-actions"><a className="secondary-button" href={selectedFile.publicUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} />Open file</a><button type="button" className="secondary-button" disabled={busy} onClick={() => openRename(selectedFile)}><Pencil size={15} />Rename file</button></div>
                        <div className="public-link-field"><label htmlFor="media-public-url">Public link</label><div><input id="media-public-url" value={selectedFile.publicUrl} readOnly onFocus={(event) => event.target.select()} /><button type="button" className="icon-button" aria-label="Copy public link" onClick={copyPublicUrl}><Copy size={15} /></button></div></div>
                        {mediaType(selectedFile) === 'images' && <form className="alt-text-form" onSubmit={saveAltText}><label htmlFor="media-alt-text">Image description</label><textarea id="media-alt-text" name="altText" rows={3} maxLength={2000} value={altDraft} onChange={(event) => setAltDraft(event.target.value)} placeholder="Describe the image for accessibility" /><button type="submit" className="secondary-button" disabled={busy || altDraft === (selectedFile.altText || '')}>{savingDetails ? 'Saving…' : 'Save description'}</button></form>}
                    </>}
                </aside>}
            </div>
            <MediaLibraryMenu request={contextMenu} items={menuItems} onClose={closeContextMenu} />

            {newFolderOpen && <MediaLibraryDialog title="New folder" description={`Create inside ${currentFolder || 'the library root'}.`} busy={creatingFolder} onClose={() => setNewFolderOpen(false)} onSubmit={createFolder}><label htmlFor="new-media-folder">Folder name</label><input id="new-media-folder" name="folderName" autoFocus required maxLength={100} value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} disabled={creatingFolder} placeholder="e.g. presentations" />{error && <p className="dialog-error" role="alert">{error}</p>}<div className="dialog-actions"><button type="button" className="secondary-button" disabled={creatingFolder} onClick={() => setNewFolderOpen(false)}>Cancel</button><button type="submit" className="primary-button" disabled={creatingFolder || !newFolderName.trim()}>{creatingFolder ? 'Creating…' : 'Create folder'}</button></div></MediaLibraryDialog>}
            {renameItem && <MediaLibraryDialog title={renameItem.kind === 'folder' ? 'Rename folder' : 'Rename file'} description="Existing public links will continue to work." busy={busy} onClose={() => setRenameItem(null)} onSubmit={submitRename}><label htmlFor="media-rename">{renameItem.kind === 'folder' ? 'Folder name' : 'File name'}</label><input id="media-rename" name="name" autoFocus required maxLength={renameItem.kind === 'folder' ? 100 : 255} value={renameValue} onChange={(event) => setRenameValue(event.target.value)} disabled={busy} />{error && <p className="dialog-error" role="alert">{error}</p>}<div className="dialog-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => setRenameItem(null)}>Cancel</button><button type="submit" className="primary-button" disabled={busy || !renameValue.trim()}>{busy ? 'Renaming…' : 'Rename'}</button></div></MediaLibraryDialog>}
            {movePicker && <MediaLibraryDialog title="Move to folder" description={`Choose a destination for ${movePicker.folder ? `“${movePicker.folder.name}”` : `${movePicker.files.length} selected files`}.`} busy={busy} onClose={() => setMovePicker(null)} onSubmit={submitMove}>
                <nav className="move-breadcrumbs" aria-label="Destination folder"><button type="button" disabled={busy} onClick={() => setMovePath('')}>Library root</button>{makeBreadcrumbs(movePath).map((crumb) => <React.Fragment key={crumb.path}><ChevronRight size={13} /><button type="button" disabled={busy} onClick={() => setMovePath(crumb.path)}>{crumb.name}</button></React.Fragment>)}</nav>
                <div className="move-folder-list">{moveLoading ? <span><LoaderCircle size={17} className="is-spinning" />Loading folders…</span> : moveFolders.length ? moveFolders.map((folder) => <button type="button" key={folder.path} disabled={busy || (movePicker.folder && (folder.path === movePicker.folder.path || folder.path.startsWith(`${movePicker.folder.path}/`)))} onClick={() => setMovePath(folder.path)}><Folder size={19} /><span>{folder.name}</span><ChevronRight size={15} /></button>) : <p>No subfolders. You can move files into this folder.</p>}</div>
                {moveIntoSelf && <p className="dialog-error">Choose a destination outside the selected folder.</p>}{error && <p className="dialog-error" role="alert">{error}</p>}
                <div className="dialog-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => setMovePicker(null)}>Cancel</button><button type="submit" className="primary-button" disabled={busy || moveLoading || moveIntoSelf}>{busy ? 'Moving…' : 'Move here'}</button></div>
            </MediaLibraryDialog>}
        </section>
    );
}
