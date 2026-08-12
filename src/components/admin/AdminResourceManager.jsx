import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ArrowUpRight,
    Check,
    ExternalLink,
    LoaderCircle,
    Pencil,
    Plus,
    RefreshCw,
    RotateCcw,
    Search,
    Trash2,
    X,
    XCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import {
    approveResource,
    deleteResource,
    getAllResourcesAdmin,
    getDeletedResources,
    permanentDeleteResource,
    rejectResource,
    restoreResource,
    updateResource,
} from '../../lib/resources/db';
import TagInput from '../resources/TagInput';
import AdminPageHeader from './AdminPageHeader';

const AUDIENCES = [
    'General Audience',
    'Designer',
    'Artist',
    'Filmmaker',
    'Creative Technologist',
    'Researcher',
    'Other',
];

const EMPTY_FORM = {
    title: '',
    url: '',
    description: '',
    audience: 'General Audience',
    thumbnail_url: '',
    credit_text: '',
    selectedTags: [],
    curatorNote: '',
};

const formFromResource = (resource) => ({
    title: resource?.title || '',
    url: resource?.url || '',
    description: resource?.description || '',
    audience: resource?.audience || 'General Audience',
    thumbnail_url: resource?.thumbnail_url || '',
    credit_text: resource?.credit_text || '',
    selectedTags: Array.isArray(resource?.tags) ? resource.tags.map((tag) => tag.id) : [],
    curatorNote: resource?.admin_notes || resource?.rejection_reason || '',
});

const getDomain = (value) => {
    try {
        return new URL(value).hostname.replace(/^www\./, '');
    } catch {
        return 'Resource link';
    }
};

const gradientFor = (seed) => {
    let hash = 2166136261;
    for (const character of String(seed || 'resource')) {
        hash ^= character.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }
    const hueA = (hash >>> 0) % 360;
    const hueB = (hueA + 52 + ((hash >>> 8) % 76)) % 360;
    return {
        '--resource-gradient-a': `hsl(${hueA} 68% 84%)`,
        '--resource-gradient-b': `hsl(${hueB} 64% 81%)`,
    };
};

export default function AdminResourceManager() {
    const [resources, setResources] = useState([]);
    const [deletedResources, setDeletedResources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [editor, setEditor] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [actionPending, setActionPending] = useState('');
    const [editorError, setEditorError] = useState('');

    const loadResources = useCallback(async ({ quiet = false } = {}) => {
        if (!quiet) setLoading(true);
        setError('');
        try {
            const [all, deleted] = await Promise.all([
                getAllResourcesAdmin(),
                getDeletedResources(),
            ]);
            setResources(all || []);
            setDeletedResources(deleted || []);
        } catch (loadError) {
            console.error('Resource curation load failed:', loadError);
            setError(loadError?.message || 'The resource library could not be loaded.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadResources();
        const params = new URLSearchParams(window.location.search);
        if (params.get('action') === 'new') {
            setEditor({ mode: 'new', resource: null });
            setForm(EMPTY_FORM);
        }
    }, [loadResources]);

    useEffect(() => {
        if (!editor) return undefined;
        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && !actionPending) setEditor(null);
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [actionPending, editor]);

    const openEditor = (resource = null, mode = 'edit') => {
        setEditor({ mode: resource?.status === 'deleted' ? 'trash' : mode, resource });
        setForm(resource ? formFromResource(resource) : EMPTY_FORM);
        setEditorError('');
        setNotice('');
    };

    const closeEditor = () => {
        if (actionPending) return;
        setEditor(null);
        setEditorError('');
        const url = new URL(window.location.href);
        if (url.searchParams.get('action') === 'new') {
            url.searchParams.delete('action');
            window.history.replaceState({}, '', url);
        }
    };

    const updateForm = (field, value) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const saveResource = async ({ keepOpen = false } = {}) => {
        if (!form.title.trim() || !form.url.trim()) {
            setEditorError('Add a title and a valid URL before saving.');
            return false;
        }

        setActionPending('save');
        setEditorError('');
        try {
            if (editor?.resource?.id) {
                const result = await updateResource(editor.resource.id, {
                    title: form.title.trim(),
                    url: form.url.trim(),
                    description: form.description.trim(),
                    audience: form.audience,
                    thumbnail_url: form.thumbnail_url.trim() || undefined,
                    credit_text: form.credit_text.trim() || undefined,
                    tag_ids: form.selectedTags,
                });
                if (!result.success) throw new Error(result.error || 'Could not update this resource.');
            } else {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error('Your admin session has expired.');

                const { data: newResource, error: insertError } = await supabase
                    .from('hub_resources')
                    .insert([{
                        title: form.title.trim(),
                        url: form.url.trim(),
                        description: form.description.trim() || null,
                        audience: form.audience,
                        thumbnail_url: form.thumbnail_url.trim() || null,
                        credit_text: form.credit_text.trim() || null,
                        status: 'approved',
                        submitted_by: user.id,
                        reviewed_by: user.id,
                        reviewed_at: new Date().toISOString(),
                    }])
                    .select('*')
                    .single();
                if (insertError) throw insertError;

                if (form.selectedTags.length > 0) {
                    const { error: tagError } = await supabase
                        .from('hub_resource_tags')
                        .insert(form.selectedTags.map((tagId) => ({
                            resource_id: newResource.id,
                            tag_id: tagId,
                        })));
                    if (tagError) throw tagError;
                }
            }

            await loadResources({ quiet: true });
            setNotice(editor?.resource?.id ? 'Resource updated.' : 'Resource added to the hub.');
            if (!keepOpen) {
                setEditor(null);
                const url = new URL(window.location.href);
                if (url.searchParams.get('action') === 'new') {
                    url.searchParams.delete('action');
                    window.history.replaceState({}, '', url);
                }
            }
            return true;
        } catch (saveError) {
            console.error('Resource save failed:', saveError);
            setEditorError(saveError?.message || 'The resource could not be saved.');
            return false;
        } finally {
            setActionPending('');
        }
    };

    const reviewResource = async (decision) => {
        if (!editor?.resource?.id) return;
        setActionPending(decision);
        setEditorError('');
        try {
            if (decision === 'approve') {
                const updateResult = await updateResource(editor.resource.id, {
                    title: form.title.trim(),
                    url: form.url.trim(),
                    description: form.description.trim(),
                    audience: form.audience,
                    thumbnail_url: form.thumbnail_url.trim() || undefined,
                    credit_text: form.credit_text.trim() || undefined,
                    tag_ids: form.selectedTags,
                });
                if (!updateResult.success) throw new Error(updateResult.error || 'Could not save the review changes.');

                const result = await approveResource(editor.resource.id, {
                    curator_note: form.curatorNote,
                    thumbnail_url: form.thumbnail_url.trim() || null,
                    tag_ids: form.selectedTags,
                    audience: form.audience,
                });
                if (!result.success) throw new Error(result.error || 'Could not approve this resource.');
                setNotice('Resource approved and published.');
            } else {
                const result = await rejectResource(editor.resource.id, form.curatorNote);
                if (!result.success) throw new Error(result.error || 'Could not reject this resource.');
                setNotice('Resource moved out of the pending queue.');
            }
            setEditor(null);
            await loadResources({ quiet: true });
        } catch (reviewError) {
            console.error('Resource review failed:', reviewError);
            setEditorError(reviewError?.message || 'The review action could not be completed.');
        } finally {
            setActionPending('');
        }
    };

    const moveToTrash = async (resource, event) => {
        event?.stopPropagation();
        if (!window.confirm(`Move “${resource.title}” to trash?`)) return;
        setActionPending(`delete:${resource.id}`);
        const result = await deleteResource(resource.id);
        setActionPending('');
        if (!result.success) {
            setError(result.error || 'The resource could not be deleted.');
            return;
        }
        if (editor?.resource?.id === resource.id) setEditor(null);
        setNotice('Resource moved to trash.');
        await loadResources({ quiet: true });
    };

    const restoreFromTrash = async () => {
        if (!editor?.resource?.id) return;
        setActionPending('restore');
        const result = await restoreResource(editor.resource.id);
        setActionPending('');
        if (!result.success) {
            setEditorError(result.error || 'The resource could not be restored.');
            return;
        }
        setEditor(null);
        setNotice('Resource restored to the pending queue.');
        await loadResources({ quiet: true });
    };

    const deleteForever = async () => {
        if (!editor?.resource?.id) return;
        if (!window.confirm('Delete this resource permanently? This cannot be undone.')) return;
        setActionPending('permanent-delete');
        const result = await permanentDeleteResource(editor.resource.id);
        setActionPending('');
        if (!result.success) {
            setEditorError(result.error || 'The resource could not be permanently deleted.');
            return;
        }
        setEditor(null);
        setNotice('Resource permanently deleted.');
        await loadResources({ quiet: true });
    };

    const filteredResources = useMemo(() => {
        const source = statusFilter === 'deleted' ? deletedResources : resources;
        const normalizedQuery = query.trim().toLowerCase();
        return source
            .filter((resource) => {
                const matchesStatus = statusFilter === 'all' || statusFilter === 'deleted' || resource.status === statusFilter;
                const searchText = [
                    resource.title,
                    resource.url,
                    resource.description,
                    resource.audience,
                    ...(resource.tags || []).map((tag) => tag.name),
                ].filter(Boolean).join(' ').toLowerCase();
                return matchesStatus && (!normalizedQuery || searchText.includes(normalizedQuery));
            })
            .sort((left, right) => Number(Boolean(right.thumbnail_url)) - Number(Boolean(left.thumbnail_url)));
    }, [deletedResources, query, resources, statusFilter]);

    const counts = useMemo(() => ({
        all: resources.length,
        approved: resources.filter((resource) => resource.status === 'approved').length,
        pending: resources.filter((resource) => resource.status === 'pending').length,
        rejected: resources.filter((resource) => resource.status === 'rejected').length,
        deleted: deletedResources.length,
    }), [deletedResources, resources]);

    const renderCard = (resource, { pending = false } = {}) => (
        <article
            key={resource.id}
            className={`resource-card ${pending ? 'resource-card--pending' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => openEditor(resource, pending ? 'review' : 'edit')}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openEditor(resource, pending ? 'review' : 'edit');
                }
            }}
            aria-label={`${pending ? 'Review' : 'Edit'} ${resource.title}`}
        >
            <div className="resource-card__thumbnail" style={gradientFor(resource.id)}>
                {resource.thumbnail_url && (
                    <img
                        src={resource.thumbnail_url}
                        alt=""
                        loading="lazy"
                        onLoad={(event) => { event.currentTarget.style.display = 'block'; }}
                        onError={(event) => { event.currentTarget.style.display = 'none'; }}
                    />
                )}
                <span className={`resource-status resource-status--${resource.status}`}>{resource.status}</span>
                {resource.status !== 'deleted' && (
                    <button
                        type="button"
                        className="resource-card__delete"
                        onClick={(event) => void moveToTrash(resource, event)}
                        disabled={actionPending === `delete:${resource.id}`}
                        aria-label={`Delete ${resource.title}`}
                        title="Move to trash"
                    >
                        {actionPending === `delete:${resource.id}`
                            ? <LoaderCircle size={15} className="spin" aria-hidden="true" />
                            : <Trash2 size={15} aria-hidden="true" />}
                    </button>
                )}
            </div>
            <div className="resource-card__body">
                <div className="resource-card__meta">
                    <span>{resource.audience || 'General Audience'}</span>
                    <span>{getDomain(resource.url)}</span>
                </div>
                <h3>{resource.title}</h3>
                {resource.description && <p>{resource.description}</p>}
                <div className="resource-card__tags">
                    {(resource.tags || []).slice(0, 3).map((tag) => <span key={tag.id}>#{tag.name}</span>)}
                </div>
                <div className="resource-card__footer">
                    <small>
                        {pending
                            ? `From ${resource.submitter_profile?.full_name || resource.submitter_profile?.username || 'a contributor'}`
                            : resource.status === 'deleted' ? 'In trash' : 'Open editor'}
                    </small>
                    {pending ? <span>Review <ArrowUpRight size={14} aria-hidden="true" /></span> : <Pencil size={14} aria-hidden="true" />}
                </div>
            </div>
        </article>
    );

    return (
        <section className="resource-admin">
            <header className="resource-admin__header">
                <AdminPageHeader
                    title="Curator Dashboard"
                    description="Keep building your impeccable taste."
                />
                <div className="resource-admin__header-actions">
                    <a href="/resources" target="_blank" rel="noreferrer">
                        View resources <ArrowUpRight size={16} aria-hidden="true" />
                    </a>
                    <button type="button" onClick={() => openEditor(null, 'new')}>
                        <Plus size={17} aria-hidden="true" /> Add new resource
                    </button>
                </div>
            </header>

            {error && <div className="resource-alert resource-alert--error">{error}</div>}
            {notice && <div className="resource-alert resource-alert--notice">{notice}</div>}

            <section className="resource-library" aria-labelledby="resource-library-title">
                <div className="resource-section-heading resource-section-heading--library">
                    <div>
                        <span className="resource-section-kicker">Resource Hub</span>
                        <h2 id="resource-library-title">All resources</h2>
                    </div>
                    <button type="button" className="resource-refresh" onClick={() => void loadResources()} aria-label="Refresh resources">
                        <RefreshCw size={15} aria-hidden="true" /> Refresh
                    </button>
                </div>

                <div className="resource-library-controls">
                    <label className="resource-search">
                        <Search size={16} aria-hidden="true" />
                        <span className="sr-only">Search resources</span>
                        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, URL or tag" />
                    </label>
                    <div className="resource-filter-tabs" aria-label="Filter resources">
                        {['all', 'approved', 'pending', 'rejected', 'deleted'].map((status) => (
                            <button
                                type="button"
                                key={status}
                                className={statusFilter === status ? 'is-active' : ''}
                                aria-pressed={statusFilter === status}
                                onClick={() => setStatusFilter(status)}
                            >
                                {status === 'all' ? 'All' : status === 'deleted' ? 'Trash' : status[0].toUpperCase() + status.slice(1)}
                                <span>{counts[status]}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="resource-loading"><LoaderCircle size={18} className="spin" aria-hidden="true" /> Loading resources…</div>
                ) : filteredResources.length > 0 ? (
                    <div className="resource-grid">
                        {filteredResources.map((resource) => renderCard(resource, { pending: resource.status === 'pending' }))}
                    </div>
                ) : (
                    <p className="resource-empty">No resources match this view.</p>
                )}
            </section>

            {editor && (
                <div className="resource-editor-layer" role="presentation" onMouseDown={(event) => {
                    if (event.target === event.currentTarget) closeEditor();
                }}>
                    <form
                        className="resource-editor"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="resource-editor-title"
                        onSubmit={(event) => {
                            event.preventDefault();
                            if (editor.mode === 'review') void reviewResource('approve');
                            else if (editor.mode !== 'trash') void saveResource();
                        }}
                    >
                        <header className="resource-editor__header">
                            <div>
                                <span>{editor.mode === 'new' ? 'New resource' : editor.mode === 'review' ? 'Pending review' : editor.mode === 'trash' ? 'Trash' : 'Edit resource'}</span>
                                <h2 id="resource-editor-title">{form.title || 'Untitled resource'}</h2>
                            </div>
                            <div className="resource-editor__top-actions">
                                {editor.resource?.url && (
                                    <a href={editor.resource.url} target="_blank" rel="noreferrer" aria-label="Open source website">
                                        <ExternalLink size={16} aria-hidden="true" />
                                    </a>
                                )}
                                {editor.resource && editor.mode !== 'trash' && (
                                    <button type="button" className="danger-icon" onClick={(event) => void moveToTrash(editor.resource, event)} aria-label="Move resource to trash">
                                        <Trash2 size={16} aria-hidden="true" />
                                    </button>
                                )}
                                <button type="button" onClick={closeEditor} aria-label="Close editor"><X size={18} aria-hidden="true" /></button>
                            </div>
                        </header>

                        {editorError && <div className="resource-alert resource-alert--error">{editorError}</div>}

                        <div className="resource-editor__scroll">
                            <section className="resource-editor__thumbnail">
                                <div className="resource-editor__preview" style={gradientFor(editor.resource?.id || form.title)}>
                                    {form.thumbnail_url && <img src={form.thumbnail_url} alt="Resource thumbnail preview" onLoad={(event) => { event.currentTarget.style.display = 'block'; }} onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
                                </div>
                                <label>
                                    <span>Thumbnail URL</span>
                                    <input type="url" value={form.thumbnail_url} placeholder="https://example.com/preview.jpg" disabled={editor.mode === 'trash'} onChange={(event) => updateForm('thumbnail_url', event.target.value)} />
                                    <small>Use a clear landscape image; the grid crops it to 16:10.</small>
                                </label>
                            </section>

                            <fieldset disabled={editor.mode === 'trash'}>
                                <legend>Resource details</legend>
                                <label className="resource-editor__wide">
                                    <span>Website URL</span>
                                    <input type="url" required value={form.url} placeholder="https://example.com" onChange={(event) => updateForm('url', event.target.value)} />
                                </label>
                                <label>
                                    <span>Title</span>
                                    <input required value={form.title} onChange={(event) => updateForm('title', event.target.value)} />
                                </label>
                                <label>
                                    <span>Audience</span>
                                    <select value={form.audience} onChange={(event) => updateForm('audience', event.target.value)}>
                                        {AUDIENCES.map((audience) => <option key={audience} value={audience}>{audience}</option>)}
                                    </select>
                                </label>
                                <label className="resource-editor__wide">
                                    <span>Description</span>
                                    <textarea rows={4} value={form.description} onChange={(event) => updateForm('description', event.target.value)} />
                                </label>
                                <label className="resource-editor__wide">
                                    <span>Tags</span>
                                    <TagInput
                                        selectedTags={form.selectedTags}
                                        onChange={(selectedTags) => updateForm('selectedTags', selectedTags)}
                                        maxTags={5}
                                        label="Resource tags"
                                    />
                                    <small>Type a tag and press Enter. Repeat for each tag.</small>
                                </label>
                            </fieldset>

                            {editor.mode === 'review' && (
                                <fieldset>
                                    <legend>Review note</legend>
                                    <label className="resource-editor__wide">
                                        <span>Message to the submitter</span>
                                        <textarea rows={3} value={form.curatorNote} placeholder="Optional context for your decision" onChange={(event) => updateForm('curatorNote', event.target.value)} />
                                    </label>
                                </fieldset>
                            )}

                            {editor.mode !== 'trash' && (
                                <details className="resource-editor__secondary-fields">
                                    <summary>Optional credit</summary>
                                    <label>
                                        <span>Credit text</span>
                                        <input value={form.credit_text} onChange={(event) => updateForm('credit_text', event.target.value)} />
                                    </label>
                                </details>
                            )}
                        </div>

                        <footer className="resource-editor__footer">
                            {editor.mode === 'trash' ? (
                                <>
                                    <button type="button" className="danger" onClick={() => void deleteForever()} disabled={Boolean(actionPending)}>
                                        <Trash2 size={16} aria-hidden="true" /> Delete forever
                                    </button>
                                    <button type="button" onClick={() => void restoreFromTrash()} disabled={Boolean(actionPending)}>
                                        {actionPending === 'restore' ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : <RotateCcw size={16} aria-hidden="true" />}
                                        Restore to review queue
                                    </button>
                                </>
                            ) : editor.mode === 'review' ? (
                                <>
                                    <button type="button" className="secondary" onClick={() => void saveResource({ keepOpen: true })} disabled={Boolean(actionPending)}>
                                        Save changes
                                    </button>
                                    <span className="resource-editor__footer-spacer" />
                                    <button type="button" className="danger" onClick={() => void reviewResource('reject')} disabled={Boolean(actionPending)}>
                                        {actionPending === 'reject' ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : <XCircle size={16} aria-hidden="true" />}
                                        Reject
                                    </button>
                                    <button type="submit" disabled={Boolean(actionPending)}>
                                        {actionPending === 'approve' ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
                                        Approve & publish
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button type="button" className="secondary" onClick={closeEditor}>Cancel</button>
                                    <span className="resource-editor__footer-spacer" />
                                    <button type="submit" disabled={Boolean(actionPending)}>
                                        {actionPending === 'save' ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
                                        {editor.mode === 'new' ? 'Add resource' : 'Save changes'}
                                    </button>
                                </>
                            )}
                        </footer>
                    </form>
                </div>
            )}

            <style>{`
                .resource-admin { display:grid; gap:2rem; color:var(--text-primary); }
                .resource-admin__header { display:flex; align-items:flex-end; justify-content:space-between; gap:2rem; padding:var(--admin-page-heading-offset-block) var(--admin-page-heading-offset-inline) 1.5rem; border-bottom:1px solid var(--border-subtle); }
                .resource-admin__header .admin-page-header__description { max-width:42rem; }
                .resource-admin__header-actions { display:flex; flex:0 0 auto; flex-wrap:wrap; gap:.6rem; padding-bottom:.25rem; }
                .resource-admin button,.resource-admin a,.resource-editor button,.resource-editor a { font-family:var(--font-sans); }
                .resource-admin__header-actions a,.resource-admin__header-actions button,.resource-editor__footer button {
                    min-height:42px; display:inline-flex; align-items:center; justify-content:center; gap:.45rem; padding:.68rem .92rem;
                    border:1px solid var(--border-subtle); border-radius:9px; background:var(--text-primary); color:var(--bg-color);
                    text-decoration:none; font-size:.8rem; font-weight:750; cursor:pointer;
                }
                .resource-admin__header-actions a { background:transparent; color:var(--text-primary); }
                .resource-admin__header-actions a:hover,.resource-admin__header-actions button:hover { transform:translateY(-1px); }
                .resource-alert { padding:.8rem 1rem; border:1px solid var(--border-subtle); border-radius:9px; font-size:.83rem; }
                .resource-alert--error { border-color:color-mix(in srgb,#ef4444 46%,var(--border-subtle)); background:color-mix(in srgb,#ef4444 8%,transparent); color:#ef4444; }
                .resource-alert--notice { border-color:color-mix(in srgb,#22c55e 36%,var(--border-subtle)); background:color-mix(in srgb,#22c55e 7%,transparent); }
                .resource-library { display:grid; gap:1rem; }
                .resource-section-heading { display:flex; justify-content:space-between; align-items:flex-end; gap:1rem; }
                .resource-section-kicker { display:block; margin-bottom:.32rem; color:var(--text-tertiary); font-size:.66rem; font-weight:800; letter-spacing:.1em; text-transform:uppercase; }
                .resource-section-heading h2 { margin:0; font-size:clamp(1.45rem,2.2vw,2rem); letter-spacing:-.035em; line-height:1; }
                .resource-section-heading--library { padding-bottom:.25rem; border-bottom:1px solid var(--border-subtle); }
                .resource-refresh { display:inline-flex; align-items:center; gap:.4rem; padding:.45rem .55rem; border:0; background:transparent; color:var(--text-tertiary); font-size:.72rem; font-weight:700; cursor:pointer; }
                .resource-loading { min-height:92px; display:flex; align-items:center; justify-content:center; gap:.65rem; color:var(--text-secondary); font-size:.82rem; }
                .resource-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:1rem; }
                .resource-card { min-width:0; overflow:hidden; border:1px solid var(--border-subtle); border-radius:12px; background:var(--bg-surface); cursor:pointer; transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease; }
                .resource-card:hover,.resource-card:focus-visible { transform:translateY(-3px); border-color:var(--border-strong); box-shadow:0 14px 32px rgba(0,0,0,.1); outline:0; }
                .resource-card--pending { background:var(--bg-color); }
                .resource-card__thumbnail { position:relative; aspect-ratio:16/10; overflow:hidden; background:radial-gradient(circle at 18% 16%,var(--resource-gradient-a),transparent 60%),radial-gradient(circle at 82% 84%,var(--resource-gradient-b),transparent 63%),linear-gradient(135deg,var(--resource-gradient-a),var(--resource-gradient-b)); }
                .resource-card__thumbnail img { width:100%; height:100%; display:block; object-fit:cover; transition:transform .35s ease; }
                .resource-card:hover .resource-card__thumbnail img { transform:scale(1.035); }
                .resource-status { position:absolute; left:.65rem; top:.65rem; padding:.32rem .5rem; border:1px solid rgba(255,255,255,.38); border-radius:999px; background:rgba(17,17,17,.74); color:#fff; backdrop-filter:blur(9px); font-size:.59rem; font-weight:850; letter-spacing:.08em; text-transform:uppercase; }
                .resource-status--pending { background:rgba(176,102,0,.86); }
                .resource-status--approved { background:rgba(15,118,74,.86); }
                .resource-status--rejected,.resource-status--deleted { background:rgba(153,27,27,.84); }
                .resource-card__delete { position:absolute; top:.55rem; right:.55rem; width:34px; height:34px; display:grid; place-items:center; padding:0; border:1px solid rgba(255,255,255,.45); border-radius:8px; background:rgba(35,10,10,.82); color:#fff; backdrop-filter:blur(9px); cursor:pointer; transition:background .15s ease,transform .15s ease; }
                .resource-card__delete:hover { background:#b91c1c; transform:scale(1.04); }
                .resource-card__body { min-height:190px; display:flex; flex-direction:column; padding:.9rem; }
                .resource-card__meta { display:flex; justify-content:space-between; gap:.6rem; color:var(--text-tertiary); font-size:.62rem; font-weight:750; letter-spacing:.06em; text-transform:uppercase; }
                .resource-card__meta span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
                .resource-card h3 { margin:.62rem 0 0; overflow:hidden; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; color:var(--text-primary); font-size:1.04rem; letter-spacing:-.025em; line-height:1.25; }
                .resource-card p { margin:.5rem 0 0; overflow:hidden; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; color:var(--text-secondary); font-size:.76rem; line-height:1.45; }
                .resource-card__tags { min-height:24px; display:flex; flex-wrap:wrap; gap:.35rem; margin-top:.65rem; }
                .resource-card__tags span { padding:.28rem .42rem; border-radius:999px; background:var(--bg-surface-hover); color:var(--text-secondary); font-size:.62rem; font-weight:700; }
                .resource-card__footer { display:flex; align-items:center; justify-content:space-between; gap:.6rem; margin-top:auto; padding-top:.75rem; border-top:1px solid var(--border-subtle); color:var(--text-tertiary); }
                .resource-card__footer small { overflow:hidden; font-size:.66rem; text-overflow:ellipsis; white-space:nowrap; }
                .resource-card__footer span { display:inline-flex; align-items:center; gap:.25rem; color:var(--text-primary); font-size:.68rem; font-weight:800; }
                .resource-library-controls { display:flex; align-items:center; justify-content:space-between; gap:1rem; }
                .resource-search { flex:1 1 300px; max-width:430px; display:flex; align-items:center; gap:.55rem; min-height:40px; padding:0 .75rem; border:1px solid var(--border-subtle); border-radius:9px; background:var(--bg-surface); color:var(--text-tertiary); }
                .resource-search:focus-within { outline:2px solid var(--border-focus); outline-offset:2px; }
                .resource-search input { width:100%; border:0; outline:0; background:transparent; color:var(--text-primary); font:500 .8rem var(--font-sans); }
                .resource-filter-tabs { display:flex; flex-wrap:wrap; gap:.45rem; }
                .resource-filter-tabs button { display:inline-flex; align-items:center; justify-content:center; gap:.55rem; min-height:42px; padding:.58rem .78rem; border:1px solid var(--border-subtle); border-radius:10px; background:var(--bg-surface); color:var(--text-secondary); font:500 .78rem/1 var(--font-sans); cursor:pointer; transition:border-color .16s ease,background .16s ease,color .16s ease,transform .16s ease; }
                .resource-filter-tabs button:hover { transform:translateY(-1px); border-color:var(--border-strong); background:var(--bg-surface-hover); color:var(--text-primary); }
                .resource-filter-tabs button.is-active { border-color:var(--border-strong); background:var(--bg-surface-hover); color:var(--text-primary); }
                .resource-filter-tabs button:focus-visible { outline:2px solid var(--border-focus); outline-offset:2px; }
                .resource-filter-tabs button span { min-width:24px; padding:.25rem .42rem; border:1px solid var(--border-subtle); border-radius:999px; background:var(--bg-color); color:var(--text-primary); font-size:.7rem; font-weight:700; line-height:1; text-align:center; }
                .resource-filter-tabs button.is-active span { border-color:var(--border-strong); background:var(--bg-surface); }
                .resource-empty { margin:0; padding:2.5rem; border:1px dashed var(--border-subtle); border-radius:10px; color:var(--text-tertiary); text-align:center; font-size:.8rem; }
                .resource-editor-layer { position:fixed; inset:0; z-index:500; display:grid; place-items:center; padding:1rem; background:rgba(0,0,0,.62); backdrop-filter:blur(7px); }
                .resource-editor { width:min(900px,100%); max-height:calc(100vh - 2rem); display:grid; grid-template-rows:auto minmax(0,1fr) auto; overflow:hidden; border:1px solid var(--border-subtle); border-radius:15px; background:var(--bg-surface); color:var(--text-primary); box-shadow:0 30px 90px rgba(0,0,0,.38); }
                .resource-editor__header { display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1rem 1.15rem; border-bottom:1px solid var(--border-subtle); }
                .resource-editor__header span { display:block; margin-bottom:.25rem; color:var(--text-tertiary); font-size:.62rem; font-weight:850; letter-spacing:.1em; text-transform:uppercase; }
                .resource-editor__header h2 { max-width:640px; margin:0; overflow:hidden; font-size:clamp(1.2rem,2.3vw,1.7rem); line-height:1.15; text-overflow:ellipsis; white-space:nowrap; }
                .resource-editor__top-actions { display:flex; gap:.4rem; }
                .resource-editor__top-actions button,.resource-editor__top-actions a { width:38px; height:38px; display:grid; place-items:center; padding:0; border:1px solid var(--border-subtle); border-radius:8px; background:transparent; color:var(--text-primary); cursor:pointer; }
                .resource-editor__top-actions .danger-icon { color:#ef4444; }
                .resource-editor__scroll { overflow:auto; padding:1.15rem; }
                .resource-editor__thumbnail { display:grid; grid-template-columns:minmax(210px,.75fr) minmax(0,1.25fr); gap:1rem; align-items:center; padding-bottom:1.2rem; }
                .resource-editor__preview { aspect-ratio:16/10; overflow:hidden; border:1px solid var(--border-subtle); border-radius:10px; background:radial-gradient(circle at 18% 16%,var(--resource-gradient-a),transparent 60%),radial-gradient(circle at 82% 84%,var(--resource-gradient-b),transparent 63%),linear-gradient(135deg,var(--resource-gradient-a),var(--resource-gradient-b)); }
                .resource-editor__preview img { width:100%; height:100%; object-fit:cover; }
                .resource-editor fieldset { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1rem; margin:0; padding:1.2rem 0; border:0; border-top:1px solid var(--border-subtle); }
                .resource-editor legend { grid-column:1/-1; padding:0 0 .15rem; font-size:.82rem; font-weight:800; }
                .resource-editor label { min-width:0; display:grid; gap:.42rem; }
                .resource-editor label>span,.resource-editor__secondary-fields label>span { color:var(--text-secondary); font-size:.7rem; font-weight:750; }
                .resource-editor input,.resource-editor textarea,.resource-editor select { width:100%; box-sizing:border-box; padding:.7rem .78rem; border:1px solid var(--border-subtle); border-radius:8px; background:var(--bg-color); color:var(--text-primary); font:500 .86rem/1.4 var(--font-sans); }
                .resource-editor textarea { resize:vertical; }
                .resource-editor input:focus,.resource-editor textarea:focus,.resource-editor select:focus { outline:2px solid var(--border-focus); outline-offset:2px; }
                .resource-editor input:disabled,.resource-editor textarea:disabled,.resource-editor select:disabled { opacity:.68; }
                .resource-editor label small { color:var(--text-tertiary); font-size:.66rem; line-height:1.35; }
                .resource-editor__wide { grid-column:1/-1; }
                .resource-editor__secondary-fields { padding:1rem 0 .2rem; border-top:1px solid var(--border-subtle); }
                .resource-editor__secondary-fields summary { color:var(--text-tertiary); font-size:.7rem; font-weight:750; cursor:pointer; }
                .resource-editor__secondary-fields label { margin-top:.8rem; }
                .resource-editor__footer { display:flex; align-items:center; gap:.55rem; padding:.8rem 1.15rem; border-top:1px solid var(--border-subtle); background:var(--bg-color); }
                .resource-editor__footer button.secondary { background:transparent; color:var(--text-primary); }
                .resource-editor__footer button.danger { border-color:color-mix(in srgb,#ef4444 45%,var(--border-subtle)); background:transparent; color:#ef4444; }
                .resource-editor__footer button:disabled { opacity:.55; cursor:wait; }
                .resource-editor__footer-spacer { flex:1; }
                .spin { animation:resource-spin .8s linear infinite; }
                @keyframes resource-spin { to { transform:rotate(360deg); } }
                @media (max-width:1180px) { .resource-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .resource-admin__header { align-items:flex-start; flex-direction:column; } }
                @media (max-width:760px) { .resource-library-controls { align-items:stretch; flex-direction:column; } .resource-search { max-width:none; flex-basis:auto; } .resource-grid { grid-template-columns:1fr; } .resource-editor__thumbnail,.resource-editor fieldset { grid-template-columns:1fr; } .resource-editor__wide { grid-column:auto; } .resource-editor__footer { flex-wrap:wrap; } .resource-editor__footer-spacer { display:none; } .resource-editor__footer button { flex:1 1 150px; } }
            `}</style>
        </section>
    );
}
