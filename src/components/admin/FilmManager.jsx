import { useEffect, useId, useMemo, useState } from 'react';
import {
    Archive,
    ArchiveRestore,
    ArrowUpRight,
    Clapperboard,
    ExternalLink,
    GripVertical,
    ImagePlus,
    LoaderCircle,
    Plus,
    RefreshCw,
    Save,
    Trash2,
    X,
} from 'lucide-react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '../../lib/supabaseClient';
import AdminPageHeader from './AdminPageHeader';
import ImageUploader from './ImageUploader';

const EMPTY_FILM = {
    id: null,
    title: '',
    roles: [],
    categories: [],
    video_url: '',
    thumbnail_url: '',
    year: '',
    description: '',
    published: false,
    sort_order: 0,
};

const normalizeList = (value) => {
    const entries = Array.isArray(value) ? value : String(value || '').split(',');
    const seen = new Set();

    return entries
        .map((entry) => String(entry || '').trim())
        .filter((entry) => {
            const key = entry.toLowerCase();
            if (!entry || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
};

const normalizeFilm = (row) => ({
    ...EMPTY_FILM,
    ...row,
    title: String(row?.title || ''),
    roles: normalizeList(row?.roles?.length ? row.roles : row?.role),
    categories: normalizeList(row?.categories?.length ? row.categories : row?.genre),
    video_url: String(row?.video_url || ''),
    thumbnail_url: String(row?.thumbnail_url || ''),
    year: row?.year ?? '',
    description: String(row?.description || ''),
    published: Boolean(row?.published),
});

const getYouTubeId = (url) => {
    if (!url) return null;

    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, '');

        if (host === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0] || null;
        if (['youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) {
            if (parsed.searchParams.get('v')) return parsed.searchParams.get('v');
            const parts = parsed.pathname.split('/').filter(Boolean);
            if (['embed', 'shorts', 'live'].includes(parts[0])) return parts[1] || null;
        }
    } catch {
        const match = String(url).match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{6,})/);
        return match?.[1] || null;
    }

    return null;
};

const getYouTubeThumbnail = (url) => {
    const id = getYouTubeId(url);
    return id ? `https://img.youtube.com/vi/${id}/maxresdefault.jpg` : '';
};

function FilmTokenField({ label, values, onChange, placeholder }) {
    const inputId = useId();
    const [draft, setDraft] = useState('');

    const addValue = () => {
        const [nextValue] = normalizeList([draft]);
        if (!nextValue) return;
        if (!values.some((value) => value.toLowerCase() === nextValue.toLowerCase())) {
            onChange([...values, nextValue]);
        }
        setDraft('');
    };

    return (
        <div className="film-token-field">
            <label htmlFor={inputId}>{label}</label>
            {values.length > 0 && (
                <div className="film-token-list" aria-label={`${label} added`}>
                    {values.map((value) => (
                        <span className="film-token" key={value}>
                            {value}
                            <button
                                type="button"
                                onClick={() => onChange(values.filter((entry) => entry !== value))}
                                aria-label={`Remove ${value}`}
                            >
                                <X size={12} aria-hidden="true" />
                            </button>
                        </span>
                    ))}
                </div>
            )}
            <div className="film-token-editor">
                <input
                    id={inputId}
                    value={draft}
                    placeholder={placeholder}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                        if ((event.key === 'Enter' || event.key === ',') && !event.nativeEvent?.isComposing) {
                            event.preventDefault();
                            addValue();
                        }
                    }}
                    onBlur={addValue}
                />
                <button
                    type="button"
                    className="film-token-add"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={addValue}
                    disabled={!draft.trim()}
                    aria-label={`Add ${label.toLowerCase()}`}
                >
                    <Plus size={15} aria-hidden="true" />
                </button>
            </div>
        </div>
    );
}

function SortableFilmItem({ film, selected, onSelect }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: film.id });

    return (
        <div
            ref={setNodeRef}
            className={`film-list-item ${selected ? 'is-selected' : ''} ${!film.published ? 'is-archived' : ''} ${isDragging ? 'is-dragging' : ''}`}
            style={{ transform: CSS.Transform.toString(transform), transition }}
        >
            <button
                type="button"
                className="film-list-drag"
                aria-label={`Reorder ${film.title || 'untitled film'}`}
                title="Drag to reorder this film"
                {...attributes}
                {...listeners}
            >
                <GripVertical size={15} aria-hidden="true" />
            </button>
            <button type="button" className="film-list-select" onClick={() => onSelect(film)}>
                <span className="film-list-thumbnail">
                    {film.thumbnail_url
                        ? <img src={film.thumbnail_url} alt="" />
                        : <Clapperboard size={18} aria-hidden="true" />}
                </span>
                <span className="film-list-copy">
                    <strong>{film.title || 'Untitled film'}</strong>
                    <small>
                        {film.roles[0] || 'Role not added'}
                        {!film.published && <span> (Archived)</span>}
                    </small>
                </span>
            </button>
        </div>
    );
}

export default function FilmManager() {
    const [films, setFilms] = useState([]);
    const [form, setForm] = useState(EMPTY_FILM);
    const [showArchived, setShowArchived] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingOrder, setSavingOrder] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const publishedCount = films.filter((film) => film.published).length;
    const archivedCount = films.length - publishedCount;
    const visibleFilms = useMemo(
        () => films.filter((film) => film.published || showArchived),
        [films, showArchived],
    );

    const updateUrl = ({ id = null, isNew = false } = {}) => {
        const url = new URL(window.location.href);
        url.searchParams.set('section', 'films');
        url.searchParams.delete('film');
        url.searchParams.delete('action');
        if (id) url.searchParams.set('film', id);
        if (isNew) url.searchParams.set('action', 'new');
        window.history.replaceState({}, '', url);
    };

    const loadFilms = async ({ selectId, startWithNew = false } = {}) => {
        setLoading(true);
        setError('');

        const { data, error: loadError } = await supabase
            .from('films')
            .select('*')
            .order('sort_order', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: false });

        if (loadError) {
            setError(loadError.message);
            setLoading(false);
            return;
        }

        const normalized = (data || []).map(normalizeFilm);
        setFilms(normalized);

        if (startWithNew) {
            setForm({ ...EMPTY_FILM, sort_order: normalized.length });
            setDirty(false);
            setLoading(false);
            return;
        }

        const nextFilm = normalized.find((film) => film.id === selectId)
            || normalized.find((film) => film.id === form.id)
            || normalized.find((film) => film.published)
            || normalized[0]
            || null;
        setForm(nextFilm || { ...EMPTY_FILM, sort_order: normalized.length });
        setDirty(false);
        setLoading(false);
    };

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        loadFilms({
            selectId: params.get('film'),
            startWithNew: params.get('action') === 'new',
        });
    }, []);

    useEffect(() => {
        if (!notice) return undefined;
        const timeoutId = window.setTimeout(() => setNotice(''), 3200);
        return () => window.clearTimeout(timeoutId);
    }, [notice]);

    const setField = (key, value) => {
        setForm((current) => ({ ...current, [key]: value }));
        setDirty(true);
        setError('');
        setNotice('');
    };

    const handleVideoUrlChange = (value) => {
        const generatedThumbnail = getYouTubeThumbnail(value);
        setForm((current) => {
            const canReplaceThumbnail = !current.thumbnail_url || current.thumbnail_url.includes('img.youtube.com/vi/');
            return {
                ...current,
                video_url: value,
                ...(generatedThumbnail && canReplaceThumbnail ? { thumbnail_url: generatedThumbnail } : {}),
            };
        });
        setDirty(true);
        setError('');
        setNotice('');
    };

    const selectFilm = (film) => {
        if (film.id === form.id) return;
        if (dirty && !window.confirm('Discard the unsaved changes to this film?')) return;
        setForm(normalizeFilm(film));
        setDirty(false);
        setError('');
        setNotice('');
        updateUrl({ id: film.id });
    };

    const startNew = () => {
        if (dirty && !window.confirm('Discard the unsaved changes to this film?')) return;
        setForm({ ...EMPTY_FILM, sort_order: films.length });
        setDirty(false);
        setError('');
        setNotice('');
        updateUrl({ isNew: true });
    };

    const buildPayload = (published = form.published) => ({
        title: form.title.trim(),
        roles: normalizeList(form.roles),
        categories: normalizeList(form.categories),
        video_url: form.video_url.trim() || null,
        thumbnail_url: form.thumbnail_url.trim() || null,
        year: form.year ? Number(form.year) : null,
        description: form.description || null,
        published,
        sort_order: Number.isFinite(Number(form.sort_order)) ? Number(form.sort_order) : films.length,
    });

    const saveFilm = async ({ publish = form.published, successMessage } = {}) => {
        const payload = buildPayload(publish);

        if (!payload.title) {
            setError('Add a film title before saving.');
            return;
        }
        if (publish && !payload.video_url) {
            setError('Add a film URL before publishing.');
            return;
        }

        setSaving(true);
        setError('');
        setNotice('');

        const query = form.id
            ? supabase.from('films').update(payload).eq('id', form.id).select('*').single()
            : supabase.from('films').insert(payload).select('*').single();
        const { data, error: saveError } = await query;

        if (saveError) {
            setError(saveError.message);
            setSaving(false);
            return;
        }

        const saved = normalizeFilm(data);
        setForm(saved);
        setDirty(false);
        if (!publish) setShowArchived(true);
        setNotice(successMessage || (form.id ? 'Film changes saved.' : 'Film created.'));
        updateUrl({ id: saved.id });
        await loadFilms({ selectId: saved.id });
        setSaving(false);
    };

    const toggleArchive = () => {
        const publish = !form.published;
        saveFilm({
            publish,
            successMessage: publish ? 'Film is live again.' : 'Film archived and removed from the public Films page.',
        });
    };

    const deleteFilm = async () => {
        if (!form.id || !window.confirm(`Permanently delete “${form.title}”? Archive it instead if you may need it later.`)) return;

        setSaving(true);
        setError('');
        const { error: deleteError } = await supabase.from('films').delete().eq('id', form.id);

        if (deleteError) {
            setError(deleteError.message);
            setSaving(false);
            return;
        }

        setForm(EMPTY_FILM);
        updateUrl();
        await loadFilms();
        setNotice('Film permanently deleted.');
        setSaving(false);
    };

    const handleDragEnd = async ({ active, over }) => {
        if (!over || active.id === over.id) return;
        const oldIndex = films.findIndex((film) => film.id === active.id);
        const newIndex = films.findIndex((film) => film.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return;

        const reordered = arrayMove(films, oldIndex, newIndex).map((film, index) => ({ ...film, sort_order: index }));
        setFilms(reordered);
        if (form.id) {
            const selected = reordered.find((film) => film.id === form.id);
            if (selected) setForm((current) => ({ ...current, sort_order: selected.sort_order }));
        }

        setSavingOrder(true);
        const results = await Promise.all(reordered.map((film, index) => (
            supabase.from('films').update({ sort_order: index }).eq('id', film.id)
        )));
        const failed = results.find((result) => result.error);

        if (failed?.error) {
            setError(`Could not save the film order: ${failed.error.message}`);
            await loadFilms({ selectId: form.id });
        } else {
            setNotice('Film order saved.');
        }
        setSavingOrder(false);
    };

    return (
        <section className="film-admin" aria-labelledby="films-admin-title">
            <div className="film-admin-header">
                <AdminPageHeader
                    className="film-admin-page-header"
                    headingId="films-admin-title"
                    title="Films"
                    description="Add a new film."
                />
                <div className="film-admin-header-actions">
                    <a href="/films" target="_blank" rel="noreferrer">
                        View films <ArrowUpRight size={15} aria-hidden="true" />
                    </a>
                    <span
                        className={`film-admin-save-status ${notice ? 'is-visible' : ''}`}
                        role="status"
                        aria-live="polite"
                        aria-atomic="true"
                    >
                        {notice || '\u00a0'}
                    </span>
                    <button type="button" onClick={startNew}>
                        <Plus size={16} aria-hidden="true" /> New film
                    </button>
                </div>
            </div>

            {error && <div className="film-admin-notice is-error" role="alert">{error}</div>}

            <div className="film-admin-layout">
                <aside className="film-admin-list">
                    <div className="film-list-heading">
                        <span>
                            <strong>{visibleFilms.length} {visibleFilms.length === 1 ? 'film' : 'films'}</strong>
                            {savingOrder && <small>Saving order…</small>}
                        </span>
                        <button type="button" onClick={() => loadFilms({ selectId: form.id })} aria-label="Refresh films">
                            <RefreshCw size={15} aria-hidden="true" />
                        </button>
                    </div>
                    <div className="film-list-filters">
                        <label>
                            <input
                                type="checkbox"
                                checked={showArchived}
                                onChange={(event) => setShowArchived(event.target.checked)}
                            />
                            <span>{showArchived ? 'Hide archived' : 'Show archived'}</span>
                            <small>{archivedCount}</small>
                        </label>
                    </div>

                    {loading ? (
                        <div className="film-admin-loading"><LoaderCircle size={18} className="film-spin" /> Loading films…</div>
                    ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={visibleFilms.map((film) => film.id)} strategy={verticalListSortingStrategy}>
                                <div className="film-list-items">
                                    {visibleFilms.length === 0 && <p>No films match this view.</p>}
                                    {visibleFilms.map((film) => (
                                        <SortableFilmItem
                                            key={film.id}
                                            film={film}
                                            selected={form.id === film.id}
                                            onSelect={selectFilm}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}
                    <div className="film-order-note">
                        <GripVertical size={14} aria-hidden="true" /> Drag films to set their public order.
                    </div>
                </aside>

                <form className="film-admin-form" onSubmit={(event) => { event.preventDefault(); saveFilm(); }}>
                    <div className="film-form-heading">
                        <label className="film-primary-title-field">
                            <span className="film-visually-hidden">Film title</span>
                            <input
                                value={form.title}
                                placeholder="Untitled film"
                                onChange={(event) => setField('title', event.target.value)}
                            />
                        </label>
                        <div className="film-form-actions">
                            {form.id && (
                                <button
                                    type="button"
                                    className={`film-archive-button ${form.published ? '' : 'is-restore'}`}
                                    onClick={toggleArchive}
                                    disabled={saving}
                                >
                                    {form.published ? <Archive size={16} /> : <ArchiveRestore size={16} />}
                                    {form.published ? 'Archive' : 'Publish again'}
                                </button>
                            )}
                            <button type="submit" disabled={saving}>
                                {saving ? <LoaderCircle size={16} className="film-spin" /> : <Save size={16} />}
                                {form.id ? 'Save changes' : 'Create draft'}
                            </button>
                            {!form.id && (
                                <button type="button" className="film-publish-button" onClick={() => saveFilm({ publish: true })} disabled={saving}>
                                    Publish
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="film-editor-core">
                        <fieldset className="film-details-fieldset">
                            <legend>Film details</legend>
                            <label className="film-url-field">
                                <span>Film URL</span>
                                <div>
                                    <input
                                        type="url"
                                        value={form.video_url}
                                        placeholder="https://youtube.com/watch?v=…"
                                        onChange={(event) => handleVideoUrlChange(event.target.value)}
                                    />
                                    {form.video_url && (
                                        <a href={form.video_url} target="_blank" rel="noreferrer" aria-label="Open film URL">
                                            <ExternalLink size={15} aria-hidden="true" />
                                        </a>
                                    )}
                                </div>
                            </label>
                            <label className="film-year-field">
                                <span>Year</span>
                                <input
                                    type="number"
                                    value={form.year}
                                    placeholder="2026"
                                    onChange={(event) => setField('year', event.target.value)}
                                />
                            </label>
                            <FilmTokenField
                                label="Roles"
                                values={form.roles}
                                onChange={(roles) => setField('roles', roles)}
                                placeholder="Add a role…"
                            />
                            <FilmTokenField
                                label="Tags"
                                values={form.categories}
                                onChange={(categories) => setField('categories', categories)}
                                placeholder="Add a tag…"
                            />
                            <label className="film-description-field">
                                <span>Description</span>
                                <textarea
                                    rows={5}
                                    value={form.description}
                                    placeholder="Optional context for this film"
                                    onChange={(event) => setField('description', event.target.value)}
                                />
                            </label>
                        </fieldset>

                        <fieldset className="film-thumbnail-fieldset">
                            <legend>Thumbnail</legend>
                            <div className="film-thumbnail-preview">
                                {form.thumbnail_url
                                    ? <img src={form.thumbnail_url} alt={`${form.title || 'Film'} thumbnail`} />
                                    : <span><ImagePlus size={24} aria-hidden="true" /> No thumbnail selected</span>}
                            </div>
                            <label>
                                <span>Thumbnail URL</span>
                                <input
                                    type="url"
                                    value={form.thumbnail_url}
                                    placeholder="https://…"
                                    onChange={(event) => setField('thumbnail_url', event.target.value)}
                                />
                            </label>
                            <div className="film-thumbnail-actions">
                                <ImageUploader
                                    bucket="films"
                                    path="thumbnails"
                                    onUpload={(files) => setField('thumbnail_url', files[0]?.url || '')}
                                    buttonOnly
                                    className="film-thumbnail-upload"
                                    label={<><ImagePlus size={15} aria-hidden="true" /> {form.thumbnail_url ? 'Replace thumbnail' : 'Upload thumbnail'}</>}
                                />
                                {form.thumbnail_url && (
                                    <button className="film-thumbnail-remove" type="button" onClick={() => setField('thumbnail_url', '')}>Remove</button>
                                )}
                            </div>
                        </fieldset>
                    </div>

                    {form.id && (
                        <section className="film-danger-zone">
                            <span>
                                <strong>Permanent deletion</strong>
                                <small>Archive is the reversible way to remove a film from the public page.</small>
                            </span>
                            <button type="button" onClick={deleteFilm} disabled={saving}>
                                <Trash2 size={15} aria-hidden="true" /> Delete film
                            </button>
                        </section>
                    )}
                </form>
            </div>

            <style>{`
                .film-admin { width:100%; max-width:var(--admin-page-content-max); height:calc(100vh - 4rem); min-height:0; display:flex; flex-direction:column; gap:1rem; color:var(--text-primary); }
                .film-admin *,.film-admin *::before,.film-admin *::after { box-sizing:border-box; }
                .film-admin-header { display:flex; justify-content:space-between; align-items:flex-end; gap:2rem; padding:var(--admin-page-heading-offset-block) var(--admin-page-heading-offset-inline) 1.5rem; border-bottom:1px solid var(--border-subtle); }
                .film-admin-page-header { min-width:0; flex:1 1 34rem; }
                .film-admin-header-actions,.film-form-actions,.film-thumbnail-actions { display:flex; align-items:center; flex-wrap:wrap; gap:.55rem; }
                .film-admin-header-actions { flex:0 0 auto; padding-bottom:.25rem; }
                .film-admin-header-actions a,.film-admin-header-actions button,.film-form-actions button { min-height:2.45rem; display:inline-flex; align-items:center; justify-content:center; gap:.4rem; padding:.65rem .85rem; border:1px solid var(--border-subtle); border-radius:8px; background:var(--text-primary); color:var(--bg-color); cursor:pointer; font:700 .75rem/1 var(--font-ui); text-decoration:none; }
                .film-admin-header-actions a { background:transparent; color:var(--text-primary); }
                .film-admin-save-status { width:15rem; height:2.45rem; display:flex; align-items:center; overflow:hidden; color:#34d399; font:650 .68rem/1.35 var(--font-ui); opacity:0; transition:opacity .18s ease; }
                .film-admin-save-status::before { content:""; flex:0 0 auto; width:.38rem; height:.38rem; margin-right:.42rem; border-radius:50%; background:currentColor; }
                .film-admin-save-status.is-visible { opacity:1; }
                .film-admin-notice { margin:0 var(--admin-page-heading-offset-inline); padding:.6rem .75rem; border:1px solid; border-radius:8px; font-size:.75rem; }
                .film-admin-notice.is-error { border-color:rgba(239,68,68,.35); background:rgba(239,68,68,.1); color:#fca5a5; }
                .film-admin-layout { min-height:0; flex:1; display:grid; grid-template-columns:minmax(270px,330px) minmax(0,1fr); gap:1rem; overflow:hidden; }
                .film-admin-list,.film-admin-form { min-height:0; border:1px solid var(--border-subtle); border-radius:12px; background:var(--bg-surface); }
                .film-admin-list { display:grid; grid-template-rows:auto auto minmax(0,1fr) auto; overflow:clip; }
                .film-list-heading { display:flex; align-items:center; justify-content:space-between; padding:.85rem .9rem; border-bottom:1px solid var(--border-subtle); }
                .film-list-heading>span { display:flex; align-items:baseline; gap:.5rem; }
                .film-list-heading strong { font-size:1rem; letter-spacing:-.02em; }
                .film-list-heading small { color:var(--text-tertiary); font-size:.65rem; }
                .film-list-heading>button { display:grid; place-items:center; padding:.3rem; border:0; background:transparent; color:var(--text-secondary); cursor:pointer; }
                .film-list-filters { padding:.65rem .75rem; border-bottom:1px solid var(--border-subtle); }
                .film-list-filters label { min-height:2.35rem; display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:.6rem; padding:.5rem .6rem; border:1px solid var(--border-subtle); border-radius:8px; background:var(--bg-color); color:var(--text-secondary); cursor:pointer; font-size:.73rem; font-weight:750; }
                .film-list-filters label:hover { border-color:var(--border-strong); color:var(--text-primary); }
                .film-list-filters input { width:1rem; height:1rem; margin:0; accent-color:var(--text-primary); cursor:pointer; }
                .film-list-filters small { min-width:1.45rem; padding:.14rem .35rem; border-radius:999px; background:var(--bg-surface-hover); color:var(--text-tertiary); font-size:.65rem; text-align:center; }
                .film-list-items { overflow:auto; display:grid; align-content:start; gap:.35rem; padding:.42rem; }
                .film-list-items>p { margin:0; padding:1rem .6rem; color:var(--text-tertiary); font-size:.76rem; }
                .film-list-item { display:grid; grid-template-columns:22px minmax(0,1fr); align-items:center; gap:.35rem; padding:.38rem; border:1px solid transparent; border-radius:9px; background:transparent; }
                .film-list-item:hover,.film-list-item.is-selected { border-color:var(--border-subtle); background:var(--bg-surface-hover); }
                .film-list-item.is-dragging { z-index:10; opacity:.62; }
                .film-list-drag { align-self:stretch; display:grid; place-items:center; padding:0; border:0; background:transparent; color:var(--text-tertiary); cursor:grab; touch-action:none; }
                .film-list-select { min-width:0; display:grid; grid-template-columns:58px minmax(0,1fr); align-items:center; gap:.6rem; padding:0; border:0; background:transparent; color:inherit; cursor:pointer; text-align:left; }
                .film-list-thumbnail { width:58px; aspect-ratio:16/10; display:grid; place-items:center; overflow:hidden; border:1px solid var(--border-subtle); border-radius:6px; background:var(--bg-color); color:var(--text-tertiary); }
                .film-list-thumbnail img { width:100%; height:100%; object-fit:cover; }
                .film-list-copy { min-width:0; }
                .film-list-copy strong,.film-list-copy small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
                .film-list-copy strong { font-size:.78rem; line-height:1.2; }
                .film-list-copy small { margin-top:.26rem; color:var(--text-tertiary); font-size:.63rem; }
                .film-list-item.is-archived .film-list-thumbnail { opacity:.4; filter:grayscale(1); }
                .film-list-item.is-archived .film-list-copy strong { color:var(--text-tertiary); font-weight:600; }
                .film-list-item.is-archived:not(.is-selected) .film-list-copy { opacity:.68; }
                .film-order-note { display:flex; align-items:center; gap:.35rem; padding:.65rem .85rem; border-top:1px solid var(--border-subtle); color:var(--text-tertiary); font-size:.65rem; }
                .film-admin-loading { display:flex; align-items:center; gap:.45rem; padding:1rem; color:var(--text-secondary); font-size:.8rem; }
                .film-admin-form { padding:clamp(1rem,2.2vw,1.5rem); overflow-y:auto; }
                .film-form-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; padding-bottom:1.1rem; }
                .film-primary-title-field { min-width:0; flex:1 1 24rem; }
                .film-admin-form .film-primary-title-field input { width:100%; padding:0 0 .18rem; border:0; border-bottom:1px solid transparent; outline:0; background:transparent; color:var(--text-primary); font:620 clamp(1.65rem,3vw,2.6rem)/1.08 var(--font-sans); letter-spacing:-.04em; }
                .film-admin-form .film-primary-title-field input:hover,.film-admin-form .film-primary-title-field input:focus { border-bottom-color:var(--border-strong); }
                .film-admin-form .film-primary-title-field input::placeholder { color:var(--text-tertiary); }
                .film-form-actions { flex:0 0 auto; justify-content:flex-end; }
                .film-form-actions button:disabled { opacity:.55; cursor:not-allowed; }
                .film-form-actions .film-archive-button { border-color:color-mix(in srgb,#e88b2b 45%,var(--border-subtle)); background:color-mix(in srgb,#e88b2b 9%,transparent); color:#d97a19; }
                .film-form-actions .film-archive-button.is-restore { border-color:color-mix(in srgb,#10b981 42%,var(--border-subtle)); background:color-mix(in srgb,#10b981 9%,transparent); color:#10b981; }
                .film-form-actions .film-publish-button { background:#10b981; border-color:#10b981; color:#fff; }
                .film-editor-core { display:grid; grid-template-columns:minmax(0,1.05fr) minmax(260px,.95fr); gap:1rem; }
                .film-admin-form fieldset { min-width:0; margin:0; padding:1.15rem; border:1px solid var(--border-subtle); border-radius:10px; background:var(--bg-color); }
                .film-admin-form legend { padding:0 .35rem; color:var(--text-primary); font-size:.8rem; font-weight:800; }
                .film-details-fieldset { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); align-content:start; gap:1.05rem; }
                .film-token-field,.film-admin-form label { min-width:0; display:grid; gap:.42rem; }
                .film-token-field { grid-column:1/-1; }
                .film-token-field>label,.film-admin-form label>span { color:var(--text-secondary); font-size:.7rem; font-weight:750; }
                .film-token-editor,.film-admin-form input,.film-admin-form textarea { width:100%; padding:.68rem .75rem; border:1px solid var(--border-subtle); border-radius:8px; outline:0; background:var(--bg-surface); color:var(--text-primary); font:500 .82rem/1.4 var(--font-sans); }
                .film-token-editor:focus-within,.film-admin-form input:focus,.film-admin-form textarea:focus { border-color:var(--border-focus); box-shadow:0 0 0 2px color-mix(in srgb,var(--border-focus) 25%,transparent); }
                .film-token-editor { min-height:2.65rem; display:grid; grid-template-columns:minmax(0,1fr) 2rem; align-items:center; gap:.4rem; padding:.28rem .35rem .28rem .7rem; background:var(--bg-surface); }
                .film-token-editor>input { min-width:0; padding:0; border:0; border-radius:0; background:transparent; box-shadow:none!important; }
                .film-token-editor>input::placeholder { color:var(--text-tertiary); }
                .film-token-add { width:2rem; height:2rem; display:grid; place-items:center; padding:0; border:0; border-radius:6px; background:var(--text-primary); color:var(--bg-color); cursor:pointer; }
                .film-token-add:disabled { opacity:.24; cursor:default; }
                .film-token-list { max-width:100%; min-height:1.75rem; display:flex; flex-wrap:nowrap; align-items:center; gap:.35rem; overflow-x:auto; padding:.05rem 0 .2rem; scrollbar-width:thin; }
                .film-token { flex:0 0 auto; display:inline-flex; align-items:center; gap:.3rem; padding:.3rem .42rem .3rem .58rem; border:1px solid var(--border-subtle); border-radius:999px; background:var(--bg-surface-hover); color:var(--text-primary); font-size:.65rem; font-weight:700; }
                .film-token button { display:grid; place-items:center; padding:0; border:0; background:transparent; color:inherit; cursor:pointer; }
                .film-url-field,.film-year-field,.film-description-field { grid-column:1/-1; }
                .film-year-field { width:min(100%,10rem); }
                .film-url-field>div { display:grid; grid-template-columns:minmax(0,1fr) 38px; gap:.45rem; }
                .film-url-field input { min-height:2.85rem; border-color:var(--border-strong); background:var(--bg-surface); }
                .film-url-field a { display:grid; place-items:center; border:1px solid var(--border-subtle); border-radius:8px; color:var(--text-secondary); text-decoration:none; }
                .film-admin-form textarea { resize:vertical; }
                .film-thumbnail-fieldset { display:grid; align-content:start; gap:.8rem; }
                .film-thumbnail-preview { width:100%; aspect-ratio:16/9; display:grid; place-items:center; overflow:hidden; border:1px solid var(--border-subtle); border-radius:9px; background:var(--bg-surface); color:var(--text-tertiary); }
                .film-thumbnail-preview img { width:100%; height:100%; object-fit:cover; }
                .film-thumbnail-preview>span { display:grid; place-items:center; gap:.45rem; font-size:.7rem; }
                .film-thumbnail-actions { display:flex; align-items:center; flex-wrap:wrap; gap:.55rem; }
                .film-thumbnail-upload { min-height:36px; display:inline-flex; align-items:center; justify-content:center; gap:.4rem; padding:.55rem .7rem; border:1px solid var(--border-strong); border-radius:7px; background:var(--bg-surface-hover); color:var(--text-primary); cursor:pointer; font:700 .68rem/1 var(--font-ui); }
                .film-thumbnail-actions>.film-thumbnail-remove { min-height:36px; align-self:center; padding:.4rem .25rem; border:0; background:transparent; color:var(--text-tertiary); cursor:pointer; font:650 .66rem/1 var(--font-ui); }
                .film-thumbnail-actions>.film-thumbnail-remove:hover { color:#ef4444; }
                .film-thumbnail-upload.uploading { opacity:.55; cursor:wait; }
                .film-danger-zone { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-top:1.15rem; padding-top:1.15rem; border-top:1px solid var(--border-subtle); }
                .film-danger-zone>span { display:grid; gap:.25rem; }
                .film-danger-zone strong { font-size:.75rem; }
                .film-danger-zone small { color:var(--text-tertiary); font-size:.66rem; }
                .film-danger-zone button { display:inline-flex; align-items:center; gap:.35rem; padding:.55rem; border:0; background:transparent; color:#ef4444; cursor:pointer; font:700 .7rem/1 var(--font-ui); }
                .film-visually-hidden { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
                .film-spin { animation:film-spin .8s linear infinite; }
                @keyframes film-spin { to { transform:rotate(360deg); } }
                @media(max-width:1180px) { .film-admin-header { align-items:flex-start; flex-direction:column; } .film-admin-header-actions { width:100%; justify-content:flex-end; } .film-editor-core { grid-template-columns:1fr; } }
                @media(max-width:980px) { .film-admin { height:auto; } .film-admin-layout { grid-template-columns:1fr; overflow:visible; } .film-admin-list { max-height:390px; } .film-admin-form { overflow:visible; } }
                @media(max-width:700px) { .film-form-heading,.film-danger-zone { align-items:flex-start; flex-direction:column; } .film-form-actions { justify-content:flex-start; } .film-details-fieldset { grid-template-columns:1fr; } .film-url-field,.film-year-field,.film-description-field { grid-column:auto; } }
                @media(max-width:520px) { .film-admin-header-actions { flex-wrap:wrap; justify-content:flex-start; } }
                @media(prefers-reduced-motion:reduce) { .film-spin { animation:none; } }
            `}</style>
        </section>
    );
}
