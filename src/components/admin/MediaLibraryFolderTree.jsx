import React, { useState } from 'react';
import { ChevronRight, Folder, FolderOpen, LoaderCircle } from 'lucide-react';

export default function MediaLibraryFolderTree({ roots, currentFolder, busy, fetchFolders, navigateTo, folderDropProps, openFolderMenu, dropFolder }) {
    const [expanded, setExpanded] = useState(() => new Set());
    const [children, setChildren] = useState(() => new Map());
    const [loading, setLoading] = useState('');
    const [error, setError] = useState('');
    const toggle = async (folder) => {
        if (expanded.has(folder.path)) { setExpanded((state) => { const next = new Set(state); next.delete(folder.path); return next; }); return; }
        setLoading(folder.path); setError('');
        try {
            const rows = await fetchFolders(folder.path);
            setChildren((state) => new Map(state).set(folder.path, rows));
            setExpanded((state) => new Set(state).add(folder.path));
        } catch { setError('Could not load subfolders. Try expanding the folder again.'); }
        finally { setLoading(''); }
    };
    const render = (rows, depth = 0) => rows.map((folder) => <React.Fragment key={folder.path}>
        <div className={`folder-tree-row ${currentFolder === folder.path ? 'is-active' : ''} ${dropFolder === folder.path ? 'is-drop-target' : ''}`} style={{ '--folder-depth': depth }}>
            <button type="button" className="folder-tree-expander" aria-label={`${expanded.has(folder.path) ? 'Collapse' : 'Expand'} ${folder.name}`} aria-expanded={expanded.has(folder.path)} disabled={busy || loading === folder.path} onClick={() => toggle(folder)}>
                {loading === folder.path ? <LoaderCircle size={13} className="is-spinning" /> : <ChevronRight size={13} className={expanded.has(folder.path) ? 'is-expanded' : ''} />}
            </button>
            <button type="button" className="sidebar-location" {...folderDropProps(folder.path)} disabled={busy} onClick={() => navigateTo(folder.path)} onContextMenu={(event) => openFolderMenu(event, folder)} title={folder.path}>
                {currentFolder === folder.path ? <FolderOpen size={16} /> : <Folder size={16} />}<span>{folder.name}</span>
            </button>
        </div>
        {expanded.has(folder.path) && render(children.get(folder.path) || [], depth + 1)}
        {expanded.has(folder.path) && !(children.get(folder.path) || []).length && <small className="folder-tree-empty" style={{ paddingInlineStart: `${1.5 + depth * 0.8}rem` }}>No subfolders</small>}
    </React.Fragment>);
    return <>{render(roots)}{error && <p className="folder-tree-error" role="alert">{error}</p>}</>;
}
