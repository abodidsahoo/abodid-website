import { useEffect, useState } from 'react';
import {
    ArrowUpRight,
    Eye,
    EyeOff,
    FlaskConical,
    GripVertical,
    LoaderCircle,
    Plus,
    Save,
    Trash2,
    X,
} from 'lucide-react';
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
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '../../lib/supabaseClient';
import AdminPageHeader from './AdminPageHeader';

const SURFACES = ['pink', 'blue', 'yellow', 'cream', 'lime'];
const SURFACE_COLOURS = {
    pink: '#ff7eb5',
    blue: '#2444ca',
    yellow: '#ffe44f',
    cream: '#fff8e8',
    lime: '#caff48',
};

const EMPTY_ENTRY = {
    id: null,
    entry_key: '',
    title: '',
    description: '',
    discipline: '',
    status_label: 'Live',
    year_label: String(new Date().getFullYear()),
    destination_path: '/lab/',
    destination_label: 'Open experiment',
    thumbnail_url: '',
    video_url: '',
    thumbnail_alt: '',
    surface: 'cream',
    card_variant: 'media',
    preview_heading: '',
    preview_cta: '',
    sort_order: 0,
    visible: true,
};

const slugify = (value) => String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const normalizeEntry = (row = {}) => ({
    ...EMPTY_ENTRY,
    ...row,
    entry_key: String(row.entry_key || ''),
    title: String(row.title || ''),
    description: String(row.description || ''),
    discipline: String(row.discipline || ''),
    status_label: String(row.status_label || ''),
    year_label: String(row.year_label || ''),
    destination_path: String(row.destination_path || ''),
    destination_label: String(row.destination_label || 'Open experiment'),
    thumbnail_url: String(row.thumbnail_url || ''),
    video_url: String(row.video_url || ''),
    thumbnail_alt: String(row.thumbnail_alt || ''),
    preview_heading: String(row.preview_heading || ''),
    preview_cta: String(row.preview_cta || ''),
    visible: row.visible !== false,
});

const isVideoUrl = (url) => /\.(mp4|webm|ogg|mov)(?:[?#]|$)/i.test(String(url || ''));

function ExperimentThumb({ entry }) {
    const video = entry.video_url || (isVideoUrl(entry.thumbnail_url) ? entry.thumbnail_url : '');
    if (video) return <video src={video} muted loop playsInline autoPlay preload="metadata" />;
    if (entry.thumbnail_url) return <img src={entry.thumbnail_url} alt="" loading="lazy" />;
    return <FlaskConical size={20} aria-hidden="true" />;
}

function SortableExperiment({ entry, selected, onSelect }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: entry.id });

    return (
        <article
            ref={setNodeRef}
            className={`lab-admin-row ${selected ? 'is-selected' : ''} ${!entry.visible ? 'is-hidden' : ''} ${isDragging ? 'is-dragging' : ''}`}
            style={{ transform: CSS.Transform.toString(transform), transition }}
        >
            <button
                type="button"
                className="lab-admin-drag"
                aria-label={`Reorder ${entry.title}`}
                title="Drag to reorder"
                {...attributes}
                {...listeners}
            >
                <GripVertical size={17} aria-hidden="true" />
            </button>
            <button type="button" className="lab-admin-select" onClick={() => onSelect(entry)}>
                <span className="lab-admin-thumb" style={{ borderColor: SURFACE_COLOURS[entry.surface] }}>
                    <ExperimentThumb entry={entry} />
                </span>
                <span className="lab-admin-row-copy">
                    <strong>{entry.title || 'Untitled experiment'}</strong>
                    <small>{entry.destination_path || 'No experiment route'}{!entry.visible ? ' · Hidden' : ''}</small>
                </span>
            </button>
            <span
                className="lab-admin-surface-dot"
                style={{ background: SURFACE_COLOURS[entry.surface] }}
                title={entry.surface}
                aria-label={`${entry.surface} card`}
            />
        </article>
    );
}

function Field({ id, label, value, onChange, placeholder = '', rows = 1, hint = '' }) {
    return (
        <label className="lab-admin-field" htmlFor={id}>
            <span>{label}{hint && <small>{hint}</small>}</span>
            {rows > 1 ? (
                <textarea id={id} value={value} rows={rows} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
            ) : (
                <input id={id} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
            )}
        </label>
    );
}

export default function LabExperimentsManager() {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [draft, setDraft] = useState(null);
    const [dirty, setDirty] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const { data, error: queryError } = await supabase
                .from('lab_catalogue_entries')
                .select('*')
                .order('sort_order', { ascending: true });
            if (queryError) throw queryError;
            setEntries((data || []).map(normalizeEntry));
        } catch (loadError) {
            setError(loadError.message || 'Could not load Lab experiments.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const patchDraft = (patch) => {
        setDraft((current) => ({ ...current, ...patch }));
        setDirty(true);
        setNotice('');
    };

    const selectEntry = (entry) => {
        setDraft({ ...entry });
        setDirty(false);
        setError('');
        setNotice('');
    };

    const newEntry = () => {
        setDraft({ ...EMPTY_ENTRY, sort_order: entries.length + 1 });
        setDirty(true);
        setError('');
        setNotice('');
    };

    const validate = () => {
        if (!draft?.title.trim()) return 'Add a title.';
        if (!draft.entry_key.trim()) return 'Add a unique entry key.';
        if (!/^\/[a-z0-9][a-z0-9/_-]*$/i.test(draft.destination_path.trim())) {
            return 'The destination must be a safe internal site path beginning with /.';
        }
        if (!draft.description.trim()) return 'Add the card description.';
        if (!draft.thumbnail_alt.trim() && draft.card_variant === 'media') return 'Add media alt text.';
        return '';
    };

    const save = async () => {
        const validationError = validate();
        if (validationError) {
            setError(validationError);
            return;
        }

        setSaving(true);
        setError('');
        setNotice('');
        const payload = {
            entry_key: slugify(draft.entry_key || draft.title),
            title: draft.title.trim(),
            description: draft.description.trim(),
            discipline: draft.discipline.trim(),
            status_label: draft.status_label.trim(),
            year_label: draft.year_label.trim(),
            destination_path: draft.destination_path.trim(),
            destination_label: draft.destination_label.trim() || 'Open experiment',
            thumbnail_url: draft.thumbnail_url.trim(),
            video_url: draft.video_url.trim() || null,
            thumbnail_alt: draft.thumbnail_alt.trim(),
            surface: draft.surface,
            card_variant: draft.card_variant,
            preview_heading: draft.preview_heading.trim() || null,
            preview_cta: draft.preview_cta.trim() || null,
            sort_order: Number(draft.sort_order) || entries.length + 1,
            visible: draft.visible,
        };

        try {
            const request = draft.id
                ? supabase.from('lab_catalogue_entries').update(payload).eq('id', draft.id)
                : supabase.from('lab_catalogue_entries').insert(payload);
            const { data, error: saveError } = await request.select().single();
            if (saveError) throw saveError;
            const saved = normalizeEntry(data);
            setEntries((current) => {
                const next = draft.id
                    ? current.map((entry) => entry.id === saved.id ? saved : entry)
                    : [...current, saved];
                return next.sort((left, right) => left.sort_order - right.sort_order);
            });
            setDraft(saved);
            setDirty(false);
            setNotice('Lab experiment saved.');
        } catch (saveError) {
            setError(saveError.message || 'Could not save the Lab experiment.');
        } finally {
            setSaving(false);
        }
    };

    const toggleVisibility = async () => {
        if (!draft?.id) {
            patchDraft({ visible: !draft.visible });
            return;
        }
        setSaving(true);
        setError('');
        const visible = !draft.visible;
        try {
            const { error: updateError } = await supabase
                .from('lab_catalogue_entries')
                .update({ visible })
                .eq('id', draft.id);
            if (updateError) throw updateError;
            setEntries((current) => current.map((entry) => entry.id === draft.id ? { ...entry, visible } : entry));
            setDraft((current) => ({ ...current, visible }));
            setNotice(visible ? 'Experiment is visible in the Lab.' : 'Experiment is hidden from the Lab.');
        } catch (updateError) {
            setError(updateError.message || 'Could not update visibility.');
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        if (!draft?.id || !window.confirm(`Remove “${draft.title}” from the Lab catalogue? The experiment page itself will not be deleted.`)) return;
        setSaving(true);
        setError('');
        try {
            const { error: deleteError } = await supabase
                .from('lab_catalogue_entries')
                .delete()
                .eq('id', draft.id);
            if (deleteError) throw deleteError;
            setEntries((current) => current.filter((entry) => entry.id !== draft.id));
            setDraft(null);
            setDirty(false);
        } catch (deleteError) {
            setError(deleteError.message || 'Could not remove the catalogue entry.');
        } finally {
            setSaving(false);
        }
    };

    const reorder = async ({ active, over }) => {
        if (!over || active.id === over.id) return;
        const previous = entries;
        const oldIndex = entries.findIndex((entry) => entry.id === active.id);
        const newIndex = entries.findIndex((entry) => entry.id === over.id);
        const next = arrayMove(entries, oldIndex, newIndex).map((entry, index) => ({ ...entry, sort_order: index + 1 }));
        setEntries(next);
        setNotice('');
        try {
            const { error: reorderError } = await supabase.rpc('lab_catalogue_reorder', {
                p_entry_ids: next.map((entry) => entry.id),
            });
            if (reorderError) throw reorderError;
            setNotice('Lab sequence updated.');
        } catch (reorderError) {
            setEntries(previous);
            setError(reorderError.message || 'Could not save the new sequence.');
        }
    };

    return (
        <section className={`lab-admin ${draft ? 'is-editing' : ''}`} aria-labelledby="lab-admin-title">
            <AdminPageHeader
                headingId="lab-admin-title"
                title="Lab Experiments"
                description="Control the Lab catalogue independently. Drag to sequence; every card opens its experiment directly."
            />

            {error && <div className="lab-admin-message is-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Dismiss error"><X size={14} /></button></div>}
            {notice && <div className="lab-admin-message is-success" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss confirmation"><X size={14} /></button></div>}

            <div className="lab-admin-layout">
                <div className="lab-admin-list-panel">
                    <header>
                        <span>{entries.length} experiments</span>
                        <div>
                            <a href="/lab" target="_blank" rel="noreferrer"><ArrowUpRight size={14} /> View Lab</a>
                            <button type="button" onClick={newEntry}><Plus size={14} /> New experiment</button>
                        </div>
                    </header>

                    {loading ? (
                        <div className="lab-admin-empty"><LoaderCircle className="lab-admin-spinner" size={20} /> Loading Lab experiments…</div>
                    ) : entries.length ? (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorder}>
                            <SortableContext items={entries.map((entry) => entry.id)} strategy={verticalListSortingStrategy}>
                                <div className="lab-admin-list">
                                    {entries.map((entry) => (
                                        <SortableExperiment
                                            key={entry.id}
                                            entry={entry}
                                            selected={draft?.id === entry.id}
                                            onSelect={selectEntry}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    ) : (
                        <div className="lab-admin-empty"><FlaskConical size={26} /> No Lab experiments yet.</div>
                    )}
                </div>

                {draft && (
                    <div className="lab-admin-editor">
                        <header className="lab-admin-editor-header">
                            <div>
                                <span>{draft.id ? 'Catalogue entry' : 'New catalogue entry'}</span>
                                <h2>{draft.title || 'Untitled experiment'}</h2>
                            </div>
                            <div className="lab-admin-editor-actions">
                                <button type="button" className="is-secondary" onClick={toggleVisibility} disabled={saving}>
                                    {draft.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                                    {draft.visible ? 'Visible' : 'Hidden'}
                                </button>
                                {draft.destination_path !== '/lab/' && (
                                    <a href={draft.destination_path} target="_blank" rel="noreferrer"><ArrowUpRight size={15} /> Open experiment</a>
                                )}
                                <button type="button" onClick={save} disabled={saving || !dirty}>
                                    {saving ? <LoaderCircle className="lab-admin-spinner" size={15} /> : <Save size={15} />}
                                    {saving ? 'Saving…' : 'Save'}
                                </button>
                                <button type="button" className="is-icon" onClick={() => { setDraft(null); setDirty(false); }} aria-label="Close editor"><X size={17} /></button>
                            </div>
                        </header>

                        {dirty && <p className="lab-admin-dirty" role="status">You have unsaved changes.</p>}

                        <div className="lab-admin-editor-body">
                            <section>
                                <h3>Card content</h3>
                                <div className="lab-admin-field-grid">
                                    <Field id="lab-title" label="Title" value={draft.title} onChange={(title) => patchDraft({ title, entry_key: draft.entry_key || slugify(title) })} placeholder="Experiment title" />
                                    <Field id="lab-key" label="Entry key" hint="unique" value={draft.entry_key} onChange={(entry_key) => patchDraft({ entry_key: slugify(entry_key) })} placeholder="experiment-slug" />
                                </div>
                                <Field id="lab-description" label="Description" value={draft.description} rows={4} onChange={(description) => patchDraft({ description })} placeholder="A short description for the catalogue card." />
                                <div className="lab-admin-field-grid">
                                    <Field id="lab-discipline" label="Discipline" value={draft.discipline} onChange={(discipline) => patchDraft({ discipline })} placeholder="Creative coding · Typography" />
                                    <Field id="lab-status" label="Status" value={draft.status_label} onChange={(status_label) => patchDraft({ status_label })} placeholder="Live" />
                                </div>
                                <Field id="lab-year" label="Year" value={draft.year_label} onChange={(year_label) => patchDraft({ year_label })} placeholder="2026" />
                            </section>

                            <section>
                                <h3>Direct experiment destination</h3>
                                <p className="lab-admin-helper">This must point directly to an experiment page under <code>/lab/</code>. No Work project page is created or opened.</p>
                                <div className="lab-admin-field-grid">
                                    <Field id="lab-destination" label="Experiment route" value={draft.destination_path} onChange={(destination_path) => patchDraft({ destination_path })} placeholder="/lab/my-experiment" />
                                    <Field id="lab-destination-label" label="Link label" value={draft.destination_label} onChange={(destination_label) => patchDraft({ destination_label })} placeholder="Open experiment" />
                                </div>
                            </section>

                            <section>
                                <h3>Media</h3>
                                <div className="lab-admin-media-preview" data-surface={draft.surface}>
                                    <ExperimentThumb entry={draft} />
                                </div>
                                <Field id="lab-thumbnail" label="Thumbnail URL" value={draft.thumbnail_url} onChange={(thumbnail_url) => patchDraft({ thumbnail_url })} placeholder="https://… or /images/…" />
                                <Field id="lab-video" label="Video URL" hint="optional" value={draft.video_url} onChange={(video_url) => patchDraft({ video_url })} placeholder="https://…mp4" />
                                <Field id="lab-alt" label="Media alt text" value={draft.thumbnail_alt} onChange={(thumbnail_alt) => patchDraft({ thumbnail_alt })} placeholder="Describe the preview clearly" />
                                <a className="lab-admin-media-link" href="/admin/dashboard?section=media_library">Open Media Library →</a>
                            </section>

                            <section>
                                <h3>Card presentation</h3>
                                <div className="lab-admin-choice-group" aria-label="Card colour">
                                    {SURFACES.map((surface) => (
                                        <button
                                            key={surface}
                                            type="button"
                                            className={draft.surface === surface ? 'is-active' : ''}
                                            style={{ '--choice-colour': SURFACE_COLOURS[surface] }}
                                            onClick={() => patchDraft({ surface })}
                                            aria-pressed={draft.surface === surface}
                                        >
                                            <span />{surface}
                                        </button>
                                    ))}
                                </div>
                                <label className="lab-admin-field" htmlFor="lab-variant">
                                    <span>Card type</span>
                                    <select id="lab-variant" value={draft.card_variant} onChange={(event) => patchDraft({ card_variant: event.target.value })}>
                                        <option value="media">Image or video</option>
                                        <option value="vault-tags">Interactive Obsidian tags</option>
                                    </select>
                                </label>
                                {draft.card_variant === 'vault-tags' && (
                                    <div className="lab-admin-field-grid">
                                        <Field id="lab-preview-heading" label="Interactive heading" value={draft.preview_heading} onChange={(preview_heading) => patchDraft({ preview_heading })} placeholder="A glimpse into my second brain." />
                                        <Field id="lab-preview-cta" label="Interactive prompt" value={draft.preview_cta} onChange={(preview_cta) => patchDraft({ preview_cta })} placeholder="Move cursor to reveal tags" />
                                    </div>
                                )}
                            </section>

                            {draft.id && (
                                <section className="lab-admin-danger">
                                    <div><h3>Remove catalogue entry</h3><p>The experiment route and its code will remain intact.</p></div>
                                    <button type="button" onClick={remove} disabled={saving}><Trash2 size={15} /> Remove</button>
                                </section>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .lab-admin { width: 100%; min-width: 0; color: var(--text-primary); }
                .lab-admin-message { margin: 1rem 0; padding: .72rem .85rem; display: flex; align-items: center; gap: .75rem; border: 1px solid; border-radius: 8px; font-size: .76rem; }
                .lab-admin-message button { margin-left: auto; padding: 0; border: 0; background: transparent; color: inherit; cursor: pointer; }
                .lab-admin-message.is-error { border-color: rgba(248,113,113,.45); background: rgba(127,29,29,.16); color: #fca5a5; }
                .lab-admin-message.is-success { border-color: rgba(74,222,128,.35); background: rgba(20,83,45,.14); color: #86efac; }
                .lab-admin-layout { min-height: min(720px, calc(100dvh - 190px)); display: grid; grid-template-columns: minmax(300px, .72fr) minmax(0, 1.55fr); gap: 1rem; }
                .lab-admin-list-panel, .lab-admin-editor { min-width: 0; overflow: hidden; border: 1px solid var(--border-subtle); border-radius: 12px; background: var(--bg-card); }
                .lab-admin-list-panel > header { min-height: 54px; padding: .7rem .75rem; display: flex; align-items: center; justify-content: space-between; gap: .75rem; border-bottom: 1px solid var(--border-subtle); color: var(--text-tertiary); font-size: .7rem; }
                .lab-admin-list-panel > header > div { display: flex; gap: .4rem; }
                .lab-admin-list-panel > header :is(a,button), .lab-admin-editor-actions :is(a,button) { min-height: 34px; padding: 0 .7rem; display: inline-flex; align-items: center; justify-content: center; gap: .36rem; border: 1px solid var(--border-subtle); border-radius: 7px; background: var(--bg-surface); color: var(--text-primary); cursor: pointer; font: inherit; font-size: .67rem; font-weight: 700; text-decoration: none; }
                .lab-admin-list-panel > header button, .lab-admin-editor-actions > button:not(.is-secondary):not(.is-icon) { border-color: #f4f4f4; background: #f4f4f4; color: #101010; }
                .lab-admin-list { padding: .55rem; display: flex; flex-direction: column; gap: .4rem; }
                .lab-admin-row { min-width: 0; display: grid; grid-template-columns: 30px minmax(0,1fr) 18px; align-items: center; border: 1px solid transparent; border-radius: 9px; background: var(--bg-surface); }
                .lab-admin-row.is-selected { border-color: var(--border-strong); background: var(--bg-surface-hover); }
                .lab-admin-row.is-hidden { opacity: .58; }
                .lab-admin-row.is-dragging { z-index: 5; opacity: .7; }
                .lab-admin-drag { height: 100%; border: 0; background: transparent; color: var(--text-tertiary); cursor: grab; }
                .lab-admin-select { min-width: 0; padding: .46rem .35rem; display: flex; align-items: center; gap: .65rem; border: 0; background: transparent; color: inherit; cursor: pointer; text-align: left; }
                .lab-admin-thumb { width: 54px; height: 43px; flex: 0 0 auto; display: grid; place-items: center; overflow: hidden; border: 2px solid; border-radius: 6px; background: #111; color: var(--text-tertiary); }
                .lab-admin-thumb :is(img,video), .lab-admin-media-preview :is(img,video) { width: 100%; height: 100%; display: block; object-fit: cover; }
                .lab-admin-row-copy { min-width: 0; display: flex; flex-direction: column; gap: .2rem; }
                .lab-admin-row-copy strong, .lab-admin-row-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .lab-admin-row-copy strong { font-size: .74rem; }
                .lab-admin-row-copy small { color: var(--text-tertiary); font-size: .6rem; }
                .lab-admin-surface-dot { width: 9px; height: 9px; border: 1px solid rgba(0,0,0,.45); border-radius: 50%; }
                .lab-admin-empty { min-height: 220px; display: grid; place-items: center; align-content: center; gap: .65rem; color: var(--text-tertiary); font-size: .75rem; }
                .lab-admin-editor { overflow-y: auto; }
                .lab-admin-editor-header { position: sticky; top: 0; z-index: 3; min-height: 64px; padding: .75rem .85rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; border-bottom: 1px solid var(--border-subtle); background: color-mix(in srgb, var(--bg-card) 96%, transparent); backdrop-filter: blur(10px); }
                .lab-admin-editor-header > div:first-child { min-width: 0; }
                .lab-admin-editor-header span { color: var(--text-tertiary); font-size: .58rem; letter-spacing: .08em; text-transform: uppercase; }
                .lab-admin-editor-header h2 { margin: .15rem 0 0; overflow: hidden; font-size: 1rem; text-overflow: ellipsis; white-space: nowrap; }
                .lab-admin-editor-actions { display: flex; align-items: center; gap: .4rem; }
                .lab-admin-editor-actions .is-icon { width: 34px; padding: 0; }
                .lab-admin-editor-actions :is(button,a):disabled { opacity: .45; cursor: not-allowed; }
                .lab-admin-dirty { margin: 0; padding: .45rem .9rem; border-bottom: 1px solid rgba(234,179,8,.25); background: rgba(234,179,8,.08); color: #fde68a; font-size: .67rem; }
                .lab-admin-editor-body { padding: .9rem; display: flex; flex-direction: column; gap: .85rem; }
                .lab-admin-editor-body > section { padding: .9rem; border: 1px solid var(--border-subtle); border-radius: 9px; background: var(--bg-surface); }
                .lab-admin-editor-body h3 { margin: 0 0 .8rem; font-size: .72rem; letter-spacing: .03em; }
                .lab-admin-field { display: flex; flex-direction: column; gap: .35rem; }
                .lab-admin-field + .lab-admin-field { margin-top: .72rem; }
                .lab-admin-field > span { display: flex; align-items: baseline; gap: .35rem; color: var(--text-secondary); font-size: .64rem; font-weight: 700; }
                .lab-admin-field > span small { color: var(--text-tertiary); font-size: .55rem; font-weight: 500; }
                .lab-admin-field :is(input,textarea,select) { width: 100%; min-height: 38px; padding: .55rem .62rem; border: 1px solid var(--border-subtle); border-radius: 7px; outline: 0; background: var(--bg-card); color: var(--text-primary); font: inherit; font-size: .72rem; }
                .lab-admin-field textarea { resize: vertical; line-height: 1.45; }
                .lab-admin-field :is(input,textarea,select):focus { border-color: var(--text-tertiary); box-shadow: 0 0 0 2px color-mix(in srgb, var(--text-primary) 8%, transparent); }
                .lab-admin-field-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: .72rem; }
                .lab-admin-field-grid .lab-admin-field + .lab-admin-field { margin-top: 0; }
                .lab-admin-helper { margin: -.35rem 0 .8rem; color: var(--text-tertiary); font-size: .67rem; line-height: 1.5; }
                .lab-admin-helper code { color: var(--text-secondary); }
                .lab-admin-media-preview { height: 180px; margin-bottom: .8rem; display: grid; place-items: center; overflow: hidden; border: 1px solid var(--border-subtle); border-radius: 8px; background: #111; color: #777; }
                .lab-admin-media-link { margin-top: .7rem; display: inline-flex; color: var(--text-secondary); font-size: .65rem; }
                .lab-admin-choice-group { margin-bottom: .85rem; display: flex; flex-wrap: wrap; gap: .42rem; }
                .lab-admin-choice-group button { min-height: 34px; padding: 0 .6rem; display: inline-flex; align-items: center; gap: .38rem; border: 1px solid var(--border-subtle); border-radius: 7px; background: var(--bg-card); color: var(--text-secondary); cursor: pointer; font: inherit; font-size: .62rem; text-transform: capitalize; }
                .lab-admin-choice-group button span { width: 12px; height: 12px; border: 1px solid rgba(0,0,0,.5); border-radius: 50%; background: var(--choice-colour); }
                .lab-admin-choice-group button.is-active { border-color: var(--text-primary); color: var(--text-primary); }
                .lab-admin-danger { display: flex; align-items: center; justify-content: space-between; gap: 1rem; border-color: rgba(248,113,113,.25) !important; }
                .lab-admin-danger h3 { margin-bottom: .25rem; color: #fca5a5; }
                .lab-admin-danger p { margin: 0; color: var(--text-tertiary); font-size: .65rem; }
                .lab-admin-danger button { min-height: 34px; padding: 0 .7rem; display: inline-flex; align-items: center; gap: .35rem; border: 1px solid rgba(248,113,113,.45); border-radius: 7px; background: rgba(127,29,29,.16); color: #fca5a5; cursor: pointer; font: inherit; font-size: .65rem; }
                .lab-admin-spinner { animation: lab-admin-spin .8s linear infinite; }
                @keyframes lab-admin-spin { to { transform: rotate(360deg); } }
                @media (max-width: 1050px) { .lab-admin-layout { grid-template-columns: 1fr; } .lab-admin-editor { max-height: none; } }
                @media (max-width: 720px) { .lab-admin-list-panel > header, .lab-admin-editor-header { align-items: flex-start; flex-direction: column; } .lab-admin-list-panel > header > div, .lab-admin-editor-actions { width: 100%; flex-wrap: wrap; } .lab-admin-field-grid { grid-template-columns: 1fr; } }
                @media (prefers-reduced-motion: reduce) { .lab-admin-spinner { animation-duration: .01ms; } }
            `}</style>
        </section>
    );
}
