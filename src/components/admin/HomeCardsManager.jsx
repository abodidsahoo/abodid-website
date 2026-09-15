import { useEffect, useId, useMemo, useState } from 'react';
import {
    ArrowUpRight,
    Eye,
    EyeOff,
    GripVertical,
    ImagePlus,
    LayoutTemplate,
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
import ImageUploader from './ImageUploader';
// Styles are embedded inline via the <style> block below (same pattern as FilmManager)

// ── Constants ──────────────────────────────────────────────────────────────

const ACCENT_OPTIONS = ['lime', 'pink', 'yellow', 'cyan', 'orange', 'purple'];
const ACCENT_COLORS = {
    lime:   '#84cc16',
    pink:   '#ec4899',
    yellow: '#eab308',
    cyan:   '#06b6d4',
    orange: '#f97316',
    purple: '#a855f7',
};

const EMPTY_CARD = {
    id:         null,
    card_id:    '',
    title:      '',
    category:   '',
    summary:    '',
    role:       '',
    outcome:    '',
    href:       '',
    alt:        '',
    image_url:  '',
    video_url:  '',
    accent:     'lime',
    themes:     [],
    sort_order: 0,
    visible:    true,
};

// ── Helpers ────────────────────────────────────────────────────────────────

const slugify = (str) =>
    String(str || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

const getYouTubeId = (url) => {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, '');
        if (host === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0] || null;
        if (['youtube.com', 'm.youtube.com'].includes(host)) {
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

const normalizeThemes = (value) => {
    const entries = Array.isArray(value) ? value : String(value || '').split(',');
    const seen = new Set();
    return entries
        .map((e) => String(e || '').trim())
        .filter((e) => {
            const k = e.toLowerCase();
            if (!e || seen.has(k)) return false;
            seen.add(k);
            return true;
        });
};

const normalizeCard = (row) => ({
    ...EMPTY_CARD,
    ...row,
    card_id:   String(row?.card_id || ''),
    title:     String(row?.title || ''),
    category:  String(row?.category || ''),
    summary:   String(row?.summary || ''),
    role:      String(row?.role || ''),
    outcome:   String(row?.outcome || ''),
    href:      String(row?.href || ''),
    alt:       String(row?.alt || ''),
    image_url: String(row?.image_url || ''),
    video_url: String(row?.video_url || ''),
    accent:    row?.accent || 'lime',
    themes:    normalizeThemes(row?.themes ?? []),
    visible:   row?.visible !== false,
});

// ── Token field (for Themes) ───────────────────────────────────────────────

function TokenField({ label, values, onChange, placeholder }) {
    const inputId = useId();
    const [draft, setDraft] = useState('');

    const add = () => {
        const trimmed = draft.trim();
        if (!trimmed) return;
        if (!values.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
            onChange([...values, trimmed]);
        }
        setDraft('');
    };

    return (
        <div className="film-token-field">
            <label htmlFor={inputId}>{label}</label>
            {values.length > 0 && (
                <div className="film-token-list">
                    {values.map((v) => (
                        <span className="film-token" key={v}>
                            {v}
                            <button
                                type="button"
                                onClick={() => onChange(values.filter((x) => x !== v))}
                                aria-label={`Remove ${v}`}
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
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ',') && !e.nativeEvent?.isComposing) {
                            e.preventDefault();
                            add();
                        }
                    }}
                    onBlur={add}
                />
                <button
                    type="button"
                    className="film-token-add"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={add}
                    disabled={!draft.trim()}
                    aria-label={`Add ${label.toLowerCase()}`}
                >
                    <Plus size={15} aria-hidden="true" />
                </button>
            </div>
        </div>
    );
}

// ── Sortable list row ──────────────────────────────────────────────────────

function SortableCardItem({ card, selected, onSelect }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: card.id });

    const accentColor = ACCENT_COLORS[card.accent] || ACCENT_COLORS.lime;

    // Detect whether a URL points to a playable video file
    const isVideoFile = (url) => Boolean(url) && /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);

    const ytId = getYouTubeId(card.video_url);
    const mp4Src = isVideoFile(card.video_url)
        ? card.video_url
        : isVideoFile(card.image_url)
        ? card.image_url   // some cards store the mp4 in image_url too
        : null;
    const staticImage = !mp4Src && !ytId && card.image_url ? card.image_url : null;
    const ytThumb    = !mp4Src && ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null;

    return (
        <div
            ref={setNodeRef}
            className={`film-list-item ${selected ? 'is-selected' : ''} ${!card.visible ? 'is-archived' : ''} ${isDragging ? 'is-dragging' : ''}`}
            style={{ transform: CSS.Transform.toString(transform), transition }}
        >
            <button
                type="button"
                className="film-list-drag"
                aria-label={`Reorder ${card.title || 'untitled card'}`}
                title="Drag to reorder"
                {...attributes}
                {...listeners}
            >
                <GripVertical size={15} aria-hidden="true" />
            </button>

            <button type="button" className="film-list-select" onClick={() => onSelect(card)}>
                <span
                    className="film-list-thumbnail"
                    style={{ borderLeft: `3px solid ${accentColor}` }}
                >
                    {mp4Src ? (
                        /* muted + autoPlay shows the clip silently as a live thumbnail */
                        <video
                            src={mp4Src}
                            muted
                            loop
                            playsInline
                            autoPlay
                            preload="metadata"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                    ) : ytThumb ? (
                        <img src={ytThumb} alt="" loading="lazy" />
                    ) : staticImage ? (
                        <img src={staticImage} alt="" loading="lazy" />
                    ) : (
                        <LayoutTemplate size={18} aria-hidden="true" />
                    )}
                </span>
                <span className="film-list-copy">
                    <strong>{card.title || 'Untitled card'}</strong>
                    <small>
                        {card.category || 'No category'}
                        {!card.visible && <span> · Hidden</span>}
                    </small>
                </span>
            </button>

            <span
                className="hcm-accent-dot"
                style={{ background: accentColor }}
                aria-label={`Accent: ${card.accent}`}
                title={card.accent}
            />
        </div>
    );
}

// ── Media preview ──────────────────────────────────────────────────────────

function MediaPreview({ imageUrl, videoUrl }) {
    const ytId = getYouTubeId(videoUrl);
    const isVideo = videoUrl && !ytId && /\.(mp4|webm|ogg|mov)(\?|$)/i.test(videoUrl);
    const isYouTube = Boolean(ytId);

    if (isYouTube) {
        return (
            <div className="hcm-media-preview">
                <img
                    src={`https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`}
                    alt="YouTube thumbnail"
                    loading="lazy"
                />
                <span className="hcm-media-badge">YouTube</span>
            </div>
        );
    }
    if (isVideo) {
        return (
            <div className="hcm-media-preview">
                <video src={videoUrl} muted playsInline preload="metadata" style={{ width: '100%', borderRadius: '6px', aspectRatio: '16/9', objectFit: 'cover' }} />
                <span className="hcm-media-badge">Video</span>
            </div>
        );
    }
    if (imageUrl) {
        return (
            <div className="hcm-media-preview">
                <img src={imageUrl} alt="Card thumbnail preview" loading="lazy" />
                <span className="hcm-media-badge">Image</span>
            </div>
        );
    }
    return (
        <div className="hcm-media-preview hcm-media-empty">
            <LayoutTemplate size={28} aria-hidden="true" />
            <span>No media set</span>
        </div>
    );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function HomeCardsManager() {
    const [cards, setCards]       = useState([]);
    const [loading, setLoading]   = useState(true);
    const [saving, setSaving]     = useState(false);
    const [error, setError]       = useState(null);
    const [selected, setSelected] = useState(null); // card being edited
    const [draft, setDraft]       = useState(null);
    const [isDirty, setIsDirty]   = useState(false);
    const [showUploader, setShowUploader] = useState(null); // 'image' | 'video' | null

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    // ── Load ────────────────────────────────────────────────────────────────

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: err } = await supabase
                .from('home_storytelling_cards')
                .select('*')
                .order('sort_order', { ascending: true });
            if (err) throw err;
            setCards((data || []).map(normalizeCard));
        } catch (err) {
            setError(err.message || 'Failed to load home cards.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    // ── Selection & editing ─────────────────────────────────────────────────

    const handleSelect = (card) => {
        setSelected(card);
        setDraft({ ...card });
        setIsDirty(false);
        setShowUploader(null);
    };

    const handleNewCard = () => {
        const newCard = { ...EMPTY_CARD, sort_order: cards.length + 1 };
        setSelected(newCard);
        setDraft({ ...newCard });
        setIsDirty(true);
        setShowUploader(null);
    };

    const handleClose = () => {
        setSelected(null);
        setDraft(null);
        setIsDirty(false);
        setShowUploader(null);
    };

    const patch = (key, value) => {
        setDraft((prev) => ({ ...prev, [key]: value }));
        setIsDirty(true);
    };

    // Auto-populate card_id from title if card_id is empty
    const handleTitleChange = (value) => {
        setDraft((prev) => ({
            ...prev,
            title: value,
            card_id: prev.card_id ? prev.card_id : slugify(value),
        }));
        setIsDirty(true);
    };

    // ── Save ────────────────────────────────────────────────────────────────

    const handleSave = async () => {
        if (!draft) return;
        setSaving(true);
        setError(null);
        try {
            const payload = {
                card_id:    draft.card_id || slugify(draft.title),
                title:      draft.title,
                category:   draft.category,
                summary:    draft.summary,
                role:       draft.role,
                outcome:    draft.outcome,
                href:       draft.href,
                alt:        draft.alt,
                image_url:  draft.image_url || null,
                video_url:  draft.video_url || null,
                accent:     draft.accent,
                themes:     draft.themes,
                sort_order: draft.sort_order ?? 0,
                visible:    draft.visible,
            };

            let savedCard;
            if (draft.id) {
                const { data, error: err } = await supabase
                    .from('home_storytelling_cards')
                    .update({ ...payload, updated_at: new Date().toISOString() })
                    .eq('id', draft.id)
                    .select()
                    .single();
                if (err) throw err;
                savedCard = normalizeCard(data);
                setCards((prev) => prev.map((c) => (c.id === savedCard.id ? savedCard : c)));
            } else {
                const { data, error: err } = await supabase
                    .from('home_storytelling_cards')
                    .insert(payload)
                    .select()
                    .single();
                if (err) throw err;
                savedCard = normalizeCard(data);
                setCards((prev) => [...prev, savedCard]);
            }

            setSelected(savedCard);
            setDraft({ ...savedCard });
            setIsDirty(false);
        } catch (err) {
            setError(err.message || 'Failed to save card.');
        } finally {
            setSaving(false);
        }
    };

    // ── Delete ──────────────────────────────────────────────────────────────

    const handleDelete = async () => {
        if (!draft?.id) return;
        if (!window.confirm(`Delete "${draft.title}"? This cannot be undone.`)) return;
        setSaving(true);
        try {
            const { error: err } = await supabase
                .from('home_storytelling_cards')
                .delete()
                .eq('id', draft.id);
            if (err) throw err;
            setCards((prev) => prev.filter((c) => c.id !== draft.id));
            handleClose();
        } catch (err) {
            setError(err.message || 'Failed to delete card.');
        } finally {
            setSaving(false);
        }
    };

    // ── Toggle visibility ───────────────────────────────────────────────────

    const handleToggleVisible = async (card) => {
        const next = !card.visible;
        try {
            const { error: err } = await supabase
                .from('home_storytelling_cards')
                .update({ visible: next, updated_at: new Date().toISOString() })
                .eq('id', card.id);
            if (err) throw err;
            setCards((prev) => prev.map((c) => c.id === card.id ? { ...c, visible: next } : c));
            if (draft?.id === card.id) {
                setDraft((prev) => ({ ...prev, visible: next }));
            }
        } catch (err) {
            setError(err.message || 'Failed to update visibility.');
        }
    };

    // ── Drag-and-drop reorder ───────────────────────────────────────────────

    const handleDragEnd = async ({ active, over }) => {
        if (!over || active.id === over.id) return;
        const oldIndex = cards.findIndex((c) => c.id === active.id);
        const newIndex = cards.findIndex((c) => c.id === over.id);
        const reordered = arrayMove(cards, oldIndex, newIndex).map((c, i) => ({
            ...c,
            sort_order: i + 1,
        }));
        setCards(reordered);
        // Persist new sort_order for every card
        try {
            await Promise.all(
                reordered.map((c) =>
                    supabase
                        .from('home_storytelling_cards')
                        .update({ sort_order: c.sort_order, updated_at: new Date().toISOString() })
                        .eq('id', c.id),
                ),
            );
        } catch (err) {
            setError('Reorder saved locally but failed to persist: ' + (err.message || ''));
        }
    };

    // ── Image uploader callback ─────────────────────────────────────────────

    const handleMediaUpload = ({ url }) => {
        if (!url) return;
        if (showUploader === 'image') patch('image_url', url);
        else if (showUploader === 'video') patch('video_url', url);
        setShowUploader(null);
    };

    // ── Render ──────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="film-manager">
                <AdminPageHeader title="Home Cards" description="Manage the storytelling project cards on the landing page." />
                <div className="film-loading">
                    <LoaderCircle size={22} className="film-spinner" aria-hidden="true" />
                    <span>Loading home cards…</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`film-manager ${selected ? 'film-manager--editing' : ''}`}>
            <AdminPageHeader
                title="Home Cards"
                description="Manage the storytelling project cards shown on the landing page. Drag to reorder."
            />

            {error && (
                <div className="film-error" role="alert">
                    <span>{error}</span>
                    <button type="button" onClick={() => setError(null)} aria-label="Dismiss error">
                        <X size={14} />
                    </button>
                </div>
            )}

            <div className="film-layout">
                {/* ── List panel ── */}
                <section className="film-list-panel" aria-label="Home cards list">
                    <div className="film-list-header">
                        <span className="film-list-count">{cards.length} cards</span>
                        <button type="button" className="film-btn film-btn-primary" onClick={handleNewCard}>
                            <Plus size={14} aria-hidden="true" />
                            New card
                        </button>
                    </div>

                    {cards.length === 0 ? (
                        <div className="film-empty">
                            <LayoutTemplate size={28} aria-hidden="true" />
                            <p>No cards yet. Add your first one.</p>
                        </div>
                    ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                                <div className="film-list">
                                    {cards.map((card) => (
                                        <SortableCardItem
                                            key={card.id}
                                            card={card}
                                            selected={selected?.id === card.id}
                                            onSelect={handleSelect}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}
                </section>

                {/* ── Edit panel ── */}
                {selected && draft && (
                    <section className="film-edit-panel" aria-label={`Editing: ${draft.title || 'new card'}`}>
                        <div className="film-edit-header">
                            <h2 className="film-edit-title">
                                {draft.id ? 'Edit card' : 'New card'}
                            </h2>
                            <div className="film-edit-actions">
                                {draft.id && (
                                    <button
                                        type="button"
                                        className="film-btn film-btn-ghost"
                                        onClick={() => handleToggleVisible(draft)}
                                        title={draft.visible ? 'Hide from landing page' : 'Show on landing page'}
                                    >
                                        {draft.visible
                                            ? <Eye size={15} aria-hidden="true" />
                                            : <EyeOff size={15} aria-hidden="true" />}
                                        {draft.visible ? 'Visible' : 'Hidden'}
                                    </button>
                                )}
                                {draft.href && (
                                    <a
                                        href={draft.href}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="film-btn film-btn-ghost"
                                        title="Preview destination"
                                    >
                                        <ArrowUpRight size={15} aria-hidden="true" />
                                        Preview
                                    </a>
                                )}
                                <button
                                    type="button"
                                    className="film-btn film-btn-primary"
                                    onClick={handleSave}
                                    disabled={saving || !isDirty}
                                >
                                    {saving ? <LoaderCircle size={14} className="film-spinner" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}
                                    {saving ? 'Saving…' : 'Save'}
                                </button>
                                <button
                                    type="button"
                                    className="film-btn film-btn-ghost"
                                    onClick={handleClose}
                                    aria-label="Close editor"
                                >
                                    <X size={16} aria-hidden="true" />
                                </button>
                            </div>
                        </div>

                        {/* Dirty indicator */}
                        {isDirty && (
                            <p className="film-dirty-notice" aria-live="polite">
                                You have unsaved changes.
                            </p>
                        )}

                        <div className="film-edit-body">
                            {/* ── Media preview ── */}
                            <div className="hcm-section">
                                <h3 className="hcm-section-title">Media Preview</h3>
                                <MediaPreview imageUrl={draft.image_url} videoUrl={draft.video_url} />
                            </div>

                            {/* ── Basics ── */}
                            <div className="hcm-section">
                                <h3 className="hcm-section-title">Basics</h3>

                                <div className="film-field">
                                    <label htmlFor="hcm-title">Title</label>
                                    <input
                                        id="hcm-title"
                                        value={draft.title}
                                        onChange={(e) => handleTitleChange(e.target.value)}
                                        placeholder="Sequence Room"
                                    />
                                </div>

                                <div className="film-field">
                                    <label htmlFor="hcm-card-id">
                                        Card ID <span className="film-field-hint">(slug, must be unique)</span>
                                    </label>
                                    <input
                                        id="hcm-card-id"
                                        value={draft.card_id}
                                        onChange={(e) => patch('card_id', slugify(e.target.value))}
                                        placeholder="sequence-room"
                                    />
                                </div>

                                <div className="film-field">
                                    <label htmlFor="hcm-category">Category</label>
                                    <input
                                        id="hcm-category"
                                        value={draft.category}
                                        onChange={(e) => patch('category', e.target.value)}
                                        placeholder="Spatial Narrative Interactive Tool"
                                    />
                                </div>

                                <div className="film-field">
                                    <label htmlFor="hcm-summary">Summary</label>
                                    <textarea
                                        id="hcm-summary"
                                        value={draft.summary}
                                        rows={3}
                                        onChange={(e) => patch('summary', e.target.value)}
                                        placeholder="A short description shown on the card…"
                                    />
                                </div>

                                <div className="film-field">
                                    <label htmlFor="hcm-role">Role</label>
                                    <input
                                        id="hcm-role"
                                        value={draft.role}
                                        onChange={(e) => patch('role', e.target.value)}
                                        placeholder="Concept · Interaction Design"
                                    />
                                </div>

                                <div className="film-field">
                                    <label htmlFor="hcm-outcome">Outcome / Meta value</label>
                                    <input
                                        id="hcm-outcome"
                                        value={draft.outcome}
                                        onChange={(e) => patch('outcome', e.target.value)}
                                        placeholder="Live interactive app"
                                    />
                                </div>

                                <div className="film-field">
                                    <label htmlFor="hcm-href">Destination link</label>
                                    <input
                                        id="hcm-href"
                                        value={draft.href}
                                        onChange={(e) => patch('href', e.target.value)}
                                        placeholder="/work/sequence-room"
                                    />
                                </div>

                                <div className="film-field">
                                    <label htmlFor="hcm-alt">Alt text <span className="film-field-hint">(for accessibility)</span></label>
                                    <input
                                        id="hcm-alt"
                                        value={draft.alt}
                                        onChange={(e) => patch('alt', e.target.value)}
                                        placeholder="Animated preview of the Sequence Room canvas"
                                    />
                                </div>
                            </div>

                            {/* ── Accent colour ── */}
                            <div className="hcm-section">
                                <h3 className="hcm-section-title">Accent Colour</h3>
                                <div className="hcm-accent-picker">
                                    {ACCENT_OPTIONS.map((accent) => (
                                        <button
                                            key={accent}
                                            type="button"
                                            className={`hcm-accent-swatch ${draft.accent === accent ? 'is-active' : ''}`}
                                            style={{ background: ACCENT_COLORS[accent] }}
                                            onClick={() => patch('accent', accent)}
                                            aria-label={`Set accent to ${accent}`}
                                            aria-pressed={draft.accent === accent}
                                            title={accent}
                                        />
                                    ))}
                                    <span className="hcm-accent-label">{draft.accent}</span>
                                </div>
                            </div>

                            {/* ── Themes ── */}
                            <div className="hcm-section">
                                <h3 className="hcm-section-title">Themes</h3>
                                <TokenField
                                    label="Themes"
                                    values={draft.themes}
                                    onChange={(v) => patch('themes', v)}
                                    placeholder="Photography, Memory…"
                                />
                            </div>

                            {/* ── Media ── */}
                            <div className="hcm-section">
                                <h3 className="hcm-section-title">Media</h3>

                                <div className="film-field">
                                    <label htmlFor="hcm-image-url">
                                        Thumbnail image URL
                                        <span className="film-field-hint"> (jpg, webp, gif, or video url)</span>
                                    </label>
                                    <div className="hcm-url-row">
                                        <input
                                            id="hcm-image-url"
                                            value={draft.image_url}
                                            onChange={(e) => patch('image_url', e.target.value)}
                                            placeholder="https://assets.abodid.com/…"
                                        />
                                        <button
                                            type="button"
                                            className="film-btn film-btn-ghost hcm-upload-btn"
                                            onClick={() => setShowUploader(showUploader === 'image' ? null : 'image')}
                                            aria-label="Upload thumbnail image"
                                            title="Upload from Media Library"
                                        >
                                            <ImagePlus size={15} aria-hidden="true" />
                                        </button>
                                    </div>
                                    {showUploader === 'image' && (
                                        <div className="hcm-uploader-panel">
                                            <ImageUploader
                                                bucket="misc"
                                                folder="home-cards"
                                                onUpload={handleMediaUpload}
                                                label="Upload thumbnail"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="film-field">
                                    <label htmlFor="hcm-video-url">
                                        Video URL
                                        <span className="film-field-hint"> (mp4, YouTube, or Supabase storage)</span>
                                    </label>
                                    <div className="hcm-url-row">
                                        <input
                                            id="hcm-video-url"
                                            value={draft.video_url}
                                            onChange={(e) => patch('video_url', e.target.value)}
                                            placeholder="https://www.youtube.com/watch?v=… or .mp4"
                                        />
                                        <button
                                            type="button"
                                            className="film-btn film-btn-ghost hcm-upload-btn"
                                            onClick={() => setShowUploader(showUploader === 'video' ? null : 'video')}
                                            aria-label="Upload video file"
                                            title="Upload from Media Library"
                                        >
                                            <ImagePlus size={15} aria-hidden="true" />
                                        </button>
                                    </div>
                                    {showUploader === 'video' && (
                                        <div className="hcm-uploader-panel">
                                            <ImageUploader
                                                bucket="misc"
                                                folder="home-cards/video"
                                                onUpload={handleMediaUpload}
                                                label="Upload video"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ── Danger zone ── */}
                            {draft.id && (
                                <div className="hcm-section hcm-danger-zone">
                                    <h3 className="hcm-section-title hcm-danger-title">Danger Zone</h3>
                                    <p className="hcm-danger-text">
                                        Deleting a card removes it from the landing page immediately. This cannot be undone. To simply hide it, use the Visible toggle instead.
                                    </p>
                                    <button
                                        type="button"
                                        className="film-btn film-btn-danger"
                                        onClick={handleDelete}
                                        disabled={saving}
                                    >
                                        <Trash2 size={14} aria-hidden="true" />
                                        Delete card
                                    </button>
                                </div>
                            )}
                        </div>
                    </section>
                )}
            </div>

            <style>{`
                /* ── Base layout & primitives (same as FilmManager inline block) ── */
                .film-manager { width:100%; max-width:var(--admin-page-content-max); display:flex; flex-direction:column; gap:1rem; color:var(--text-primary); font-family:var(--font-sans); }
                .film-manager *, .film-manager *::before, .film-manager *::after { box-sizing:border-box; }

                /* List + edit layout */
                .film-layout { display:grid; grid-template-columns:minmax(270px,320px) minmax(0,1fr); gap:1rem; min-height:0; }
                .film-manager--editing .film-layout { /* two-column when editing */ }
                .film-list-panel, .film-edit-panel {
                    border:1px solid var(--border-subtle); border-radius:12px;
                    background:var(--bg-surface); overflow:hidden;
                }
                .film-list-panel { display:flex; flex-direction:column; max-height:calc(100vh - 12rem); }
                .film-list-header {
                    display:flex; align-items:center; justify-content:space-between;
                    padding:0.85rem 0.9rem; border-bottom:1px solid var(--border-subtle); flex-shrink:0;
                }
                .film-list-count { font-size:0.78rem; color:var(--text-secondary); font-weight:600; }
                .film-list { flex:1; overflow-y:auto; display:grid; align-content:start; gap:0.35rem; padding:0.42rem; }
                .film-empty {
                    flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center;
                    gap:0.6rem; padding:2rem; color:var(--text-tertiary); font-size:0.8rem;
                }
                .film-empty p { margin:0; }

                /* List item */
                .film-list-item {
                    display:grid; grid-template-columns:22px minmax(0,1fr) auto; align-items:center;
                    gap:0.35rem; padding:0.38rem; border:1px solid transparent; border-radius:9px; background:transparent;
                }
                .film-list-item:hover, .film-list-item.is-selected { border-color:var(--border-subtle); background:var(--bg-surface-hover); }
                .film-list-item.is-dragging { z-index:10; opacity:0.62; }
                .film-list-item.is-archived .film-list-thumbnail { opacity:0.4; filter:grayscale(1); }
                .film-list-item.is-archived .film-list-copy strong { color:var(--text-tertiary); }
                .film-list-drag {
                    align-self:stretch; display:grid; place-items:center; padding:0;
                    border:0; background:transparent; color:var(--text-tertiary); cursor:grab; touch-action:none;
                }
                .film-list-select {
                    min-width:0; display:grid; grid-template-columns:58px minmax(0,1fr); align-items:center;
                    gap:0.6rem; padding:0; border:0; background:transparent; color:inherit; cursor:pointer; text-align:left;
                }
                .film-list-thumbnail {
                    width:58px; aspect-ratio:16/10; display:grid; place-items:center; overflow:hidden;
                    border:1px solid var(--border-subtle); border-radius:6px;
                    background:var(--bg-color); color:var(--text-tertiary); flex-shrink:0;
                }
                .film-list-thumbnail img { width:100%; height:100%; object-fit:cover; }
                .film-list-copy { min-width:0; }
                .film-list-copy strong, .film-list-copy small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
                .film-list-copy strong { font-size:0.78rem; line-height:1.2; }
                .film-list-copy small { margin-top:0.26rem; color:var(--text-tertiary); font-size:0.63rem; }

                /* Edit panel */
                .film-edit-panel { display:flex; flex-direction:column; overflow:hidden; }
                .film-edit-header {
                    display:flex; align-items:center; justify-content:space-between; gap:1rem;
                    padding:0.85rem 1rem; border-bottom:1px solid var(--border-subtle); flex-shrink:0;
                }
                .film-edit-title { margin:0; font-size:0.9rem; font-weight:700; letter-spacing:-0.02em; }
                .film-edit-actions { display:flex; align-items:center; gap:0.45rem; flex-wrap:wrap; }
                .film-edit-body { flex:1; overflow-y:auto; padding:1.25rem; }
                .film-dirty-notice {
                    margin:0; padding:0.4rem 1rem; background:rgba(234,179,8,0.1);
                    border-bottom:1px solid rgba(234,179,8,0.25); color:#ca8a04;
                    font-size:0.72rem; font-weight:600; flex-shrink:0;
                }

                /* Buttons */
                .film-btn {
                    display:inline-flex; align-items:center; gap:0.4rem; padding:0.55rem 0.8rem;
                    border:1px solid var(--border-subtle); border-radius:8px; cursor:pointer;
                    font:600 0.75rem/1 var(--font-sans); text-decoration:none; white-space:nowrap;
                    transition:background 0.15s, color 0.15s, opacity 0.15s;
                }
                .film-btn:disabled { opacity:0.45; cursor:not-allowed; }
                .film-btn-primary { background:var(--text-primary); color:var(--bg-color); border-color:var(--text-primary); }
                .film-btn-primary:hover:not(:disabled) { opacity:0.85; }
                .film-btn-ghost { background:transparent; color:var(--text-secondary); }
                .film-btn-ghost:hover:not(:disabled) { background:var(--bg-surface-hover); color:var(--text-primary); }

                /* Fields */
                .film-field { display:grid; gap:0.42rem; margin-bottom:0.9rem; }
                .film-field label { color:var(--text-secondary); font-size:0.7rem; font-weight:700; }
                .film-field-hint { font-weight:400; color:var(--text-tertiary); }
                .film-field input, .film-field textarea, .film-field select {
                    width:100%; padding:0.68rem 0.75rem;
                    border:1px solid var(--border-subtle); border-radius:8px; outline:0;
                    background:var(--bg-surface); color:var(--text-primary);
                    font:500 0.82rem/1.4 var(--font-sans);
                }
                .film-field input:focus, .film-field textarea:focus {
                    border-color:var(--border-focus);
                    box-shadow:0 0 0 2px color-mix(in srgb,var(--border-focus) 25%,transparent);
                }
                .film-field textarea { resize:vertical; }

                /* Token field */
                .film-token-field { display:grid; gap:0.42rem; margin-bottom:0.9rem; }
                .film-token-field > label { color:var(--text-secondary); font-size:0.7rem; font-weight:700; }
                .film-token-list { display:flex; flex-wrap:wrap; gap:0.35rem; }
                .film-token {
                    display:inline-flex; align-items:center; gap:0.3rem;
                    padding:0.3rem 0.42rem 0.3rem 0.58rem;
                    border:1px solid var(--border-subtle); border-radius:999px;
                    background:var(--bg-surface-hover); color:var(--text-primary);
                    font-size:0.65rem; font-weight:700;
                }
                .film-token button { display:grid; place-items:center; padding:0; border:0; background:transparent; color:inherit; cursor:pointer; }
                .film-token-editor {
                    display:grid; grid-template-columns:minmax(0,1fr) 2rem; align-items:center; gap:0.4rem;
                    padding:0.28rem 0.35rem 0.28rem 0.7rem;
                    border:1px solid var(--border-subtle); border-radius:8px; background:var(--bg-surface);
                }
                .film-token-editor:focus-within { border-color:var(--border-focus); box-shadow:0 0 0 2px color-mix(in srgb,var(--border-focus) 25%,transparent); }
                .film-token-editor > input { padding:0; border:0; border-radius:0; background:transparent; box-shadow:none !important; outline:none; font:500 0.82rem/1.4 var(--font-sans); color:var(--text-primary); }
                .film-token-editor > input::placeholder { color:var(--text-tertiary); }
                .film-token-add { width:2rem; height:2rem; display:grid; place-items:center; padding:0; border:0; border-radius:6px; background:var(--text-primary); color:var(--bg-color); cursor:pointer; }
                .film-token-add:disabled { opacity:0.24; cursor:default; }

                /* Loading / error */
                .film-loading { display:flex; align-items:center; gap:0.45rem; padding:1.5rem; color:var(--text-secondary); font-size:0.8rem; }
                .film-spinner { animation:hcm-spin 0.8s linear infinite; }
                @keyframes hcm-spin { to { transform:rotate(360deg); } }
                .film-error {
                    display:flex; align-items:center; justify-content:space-between; gap:1rem;
                    margin-bottom:0.75rem; padding:0.6rem 0.75rem;
                    border:1px solid rgba(239,68,68,0.35); border-radius:8px;
                    background:rgba(239,68,68,0.1); color:#fca5a5; font-size:0.78rem;
                }
                .film-error button { background:transparent; border:0; color:inherit; cursor:pointer; display:grid; place-items:center; }

                @media(max-width:1100px) {
                    .film-layout { grid-template-columns:1fr; }
                    .film-list-panel { max-height:340px; }
                }
                @media(prefers-reduced-motion:reduce) { .film-spinner { animation:none; } }

                /* ── Home Cards Manager extras ─────────────────────────── */
                .hcm-accent-dot {
                    width:8px; height:8px; border-radius:50%; flex-shrink:0;
                    margin-left:auto; margin-right:0.25rem;
                }
                .hcm-section { margin-bottom:1.75rem; }
                .hcm-section-title {
                    font-size:0.72rem; font-weight:600; text-transform:uppercase;
                    letter-spacing:0.07em; color:var(--text-tertiary);
                    margin:0 0 0.9rem 0; padding-bottom:0.5rem;
                    border-bottom:1px solid var(--border-subtle);
                }
                .hcm-section.hcm-danger-zone {
                    border:1px solid rgba(239,68,68,0.3);
                    border-radius:8px; padding:1rem; background:rgba(239,68,68,0.05);
                }
                .hcm-danger-title { color:rgba(239,68,68,0.8); border-color:rgba(239,68,68,0.2); }
                .hcm-danger-text { font-size:0.8rem; color:var(--text-secondary); line-height:1.5; margin:0 0 0.75rem 0; }
                .hcm-accent-picker { display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap; }
                .hcm-accent-swatch {
                    width:26px; height:26px; border-radius:50%; border:2px solid transparent;
                    cursor:pointer; transition:transform 0.15s ease, border-color 0.15s ease; flex-shrink:0;
                }
                .hcm-accent-swatch:hover { transform:scale(1.15); }
                .hcm-accent-swatch.is-active { border-color:var(--text-primary); transform:scale(1.2); box-shadow:0 0 0 2px var(--bg-color), 0 0 0 4px currentColor; }
                .hcm-accent-label { font-size:0.78rem; color:var(--text-secondary); font-weight:500; text-transform:capitalize; margin-left:0.25rem; }
                .hcm-media-preview {
                    position:relative; border-radius:8px; overflow:hidden;
                    background:var(--bg-surface-hover); aspect-ratio:16/9;
                    display:flex; align-items:center; justify-content:center;
                    margin-bottom:0.75rem; border:1px solid var(--border-subtle);
                }
                .hcm-media-preview img { width:100%; height:100%; object-fit:cover; display:block; }
                .hcm-media-badge {
                    position:absolute; bottom:0.5rem; right:0.5rem;
                    background:rgba(0,0,0,0.65); color:#fff;
                    font-size:0.65rem; font-weight:600; letter-spacing:0.06em; text-transform:uppercase;
                    padding:0.2rem 0.5rem; border-radius:4px; backdrop-filter:blur(4px);
                }
                .hcm-media-empty { flex-direction:column; gap:0.5rem; color:var(--text-tertiary); font-size:0.8rem; }
                .hcm-url-row { display:flex; gap:0.5rem; align-items:stretch; }
                .hcm-url-row input { flex:1; min-width:0; }
                .hcm-upload-btn { flex-shrink:0; padding:0 0.75rem; }
                .hcm-uploader-panel { margin-top:0.75rem; padding:1rem; background:var(--bg-surface-hover); border-radius:8px; border:1px solid var(--border-subtle); }
                .film-btn-danger { background:rgba(239,68,68,0.1) !important; border:1px solid rgba(239,68,68,0.35) !important; color:rgb(239,68,68) !important; }
                .film-btn-danger:hover { background:rgba(239,68,68,0.2) !important; }
            `}</style>
        </div>
    );
}
