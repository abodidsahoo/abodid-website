import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const labelDate = (value) => {
    if (!value) return '';
    const date = new Date(`${value}T12:00:00Z`);
    return new Intl.DateTimeFormat('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    }).format(date);
};

const shortDate = (value) => {
    if (!value) return '';
    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
    }).format(new Date(`${value}T12:00:00Z`));
};

function ReadingCard({ reading, index = 0 }) {
    const note = reading.editorial_note || reading.why_it_matters;
    return (
        <article className="blog-post reading-card">
            <a className="blog-post-card" href={reading.url} target="_blank" rel="noopener noreferrer"
                aria-label={`${reading.title} — ${reading.source_name} (opens in a new tab)`}>
                <div className="blog-card-image reading-card-image">
                    <div className="blog-card-placeholder" aria-hidden="true">
                        <span>{reading.source_name}</span><span>{String(index + 1).padStart(2, '0')}</span>
                    </div>
                    <img src={reading.thumbnail_url || reading.fallback_thumbnail_url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={(event) => {
                        const image = event.currentTarget;
                        if (image.src === reading.fallback_thumbnail_url) image.style.display = 'none';
                        else image.src = reading.fallback_thumbnail_url;
                    }} />
                </div>
                <div className="blog-card-copy">
                    <p className="reading-card-source">{reading.source_name}</p>
                    <div className="blog-card-title-row">
                        <h3 className="blog-card-title"><span>{reading.title}</span></h3>
                        <span className="blog-card-arrow" aria-hidden="true">↗</span>
                    </div>
                    {note && <p className="reading-card-note">{note}</p>}
                    <div className="blog-card-footer">
                        <div className="blog-card-category">{reading.topic_names?.slice(0, 2).map((topic) => <span className="blog-card-tag" key={topic}>{topic}</span>)}</div>
                        <time className="blog-card-date" dateTime={reading.publication_date}>{shortDate(reading.publication_date)}</time>
                    </div>
                </div>
            </a>
        </article>
    );
}

function EditorPanel({ days, onAction, busy }) {
    const [drafts, setDrafts] = useState({});
    const grouped = new Map();
    for (const day of days) {
        const existing = grouped.get(day.date) || [];
        grouped.set(day.date, [...existing, ...day.readings]);
    }
    return (
        <section className="reading-editor-panel" aria-label="Reading page editor">
            <div className="reading-editor-panel__head">
                <div><p className="blog-eyebrow">Private editor</p><h2>Arrange the reading page</h2></div>
                <p>Changes appear on the public page within about a minute.</p>
            </div>
            {[...grouped].map(([date, readings]) => {
                const sorted = [...readings].sort((a, b) =>
                    (a.editorial_order ?? a.delivery_position) - (b.editorial_order ?? b.delivery_position));
                return <div className="reading-editor-day" key={date}>
                    <h3>{labelDate(date)}</h3>
                    {sorted.map((reading, index) => (
                        <div className="reading-editor-row" key={reading.id}>
                            <div className="reading-editor-row__title">
                                <strong>{reading.title}</strong>
                                <span>{reading.source_name}{!reading.published ? ' · hidden' : ''}</span>
                            </div>
                            <div className="reading-editor-row__actions">
                                <button type="button" disabled={busy || index === 0} onClick={() => {
                                    const ids = sorted.map((item) => item.id);
                                    [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
                                    onAction({ action: 'reorder', date, ids });
                                }} aria-label={`Move ${reading.title} up`}>↑</button>
                                <button type="button" disabled={busy || index === sorted.length - 1} onClick={() => {
                                    const ids = sorted.map((item) => item.id);
                                    [ids[index + 1], ids[index]] = [ids[index], ids[index + 1]];
                                    onAction({ action: 'reorder', date, ids });
                                }} aria-label={`Move ${reading.title} down`}>↓</button>
                                <button type="button" disabled={busy} onClick={() => onAction({ action: 'visibility', id: reading.id, published: !reading.published })}>{reading.published ? 'Hide' : 'Publish'}</button>
                            </div>
                            <form className="reading-editor-row__note" onSubmit={(event) => {
                                event.preventDefault();
                                onAction({
                                    action: 'editorial', id: reading.id,
                                    note: drafts[reading.id]?.note ?? reading.editorial_note ?? '',
                                    thumbnail_url: drafts[reading.id]?.thumbnail_url ?? reading.thumbnail_url ?? '',
                                });
                            }}>
                                <input type="text" maxLength={240} aria-label={`Editorial note for ${reading.title}`}
                                    placeholder="Short editorial note" value={drafts[reading.id]?.note ?? reading.editorial_note ?? ''}
                                    onChange={(event) => setDrafts((current) => ({ ...current, [reading.id]: { ...current[reading.id], note: event.target.value } }))} />
                                <input type="url" aria-label={`Thumbnail URL for ${reading.title}`}
                                    placeholder="Optional thumbnail URL" value={drafts[reading.id]?.thumbnail_url ?? reading.thumbnail_url ?? ''}
                                    onChange={(event) => setDrafts((current) => ({ ...current, [reading.id]: { ...current[reading.id], thumbnail_url: event.target.value } }))} />
                                <button type="submit" disabled={busy}>Save</button>
                            </form>
                        </div>
                    ))}
                </div>;
            })}
        </section>
    );
}

export default function ReadingFeed({ initialFeed, initialTag = '', initialError = '' }) {
    const [feed, setFeed] = useState(initialFeed);
    const [activeTag, setActiveTag] = useState(initialTag);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(initialError);
    const [editorDays, setEditorDays] = useState(null);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editorBusy, setEditorBusy] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const requestId = useRef(0);

    const loadFeed = async (tag, fresh = false) => {
        const id = ++requestId.current;
        setLoading(true);
        setError('');
        const params = new URLSearchParams();
        if (tag) params.set('tag', tag);
        if (fresh) params.set('refresh', String(Date.now()));
        try {
            const response = await fetch(`/api/reading/feed?${params}`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not load readings.');
            if (id === requestId.current) setFeed(data);
        } catch (cause) {
            if (id === requestId.current) setError(cause.message);
        } finally {
            if (id === requestId.current) setLoading(false);
        }
    };

    useEffect(() => {
        const onPopState = () => {
            const tag = new URLSearchParams(window.location.search).get('tag') || '';
            setActiveTag(tag);
            loadFeed(tag);
        };
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);

    useEffect(() => {
        let active = true;
        const checkAdmin = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token || !active) return;
            const response = await fetch('/api/reading/editor', {
                headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store',
            });
            if (response.ok && active) setEditorDays((await response.json()).days);
        };
        checkAdmin().catch(() => {});
        return () => { active = false; };
    }, []);

    const chooseTag = (tag) => {
        const next = activeTag === tag ? '' : tag;
        setActiveTag(next);
        setFiltersOpen(false);
        const url = new URL(window.location.href);
        url.searchParams.delete('tag');
        if (next) url.searchParams.set('tag', next);
        window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
        loadFeed(next);
    };

    const loadMore = async () => {
        if (!feed.nextCursor || loadingMore) return;
        const requestAtStart = requestId.current;
        setLoadingMore(true);
        setError('');
        const tagAtStart = activeTag;
        const params = new URLSearchParams({ before: feed.nextCursor });
        if (tagAtStart) params.set('tag', tagAtStart);
        try {
            const response = await fetch(`/api/reading/feed?${params}`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not load earlier readings.');
            if (requestAtStart === requestId.current) setFeed((current) => ({
                ...current,
                archive: [...current.archive, ...data.archive],
                nextCursor: data.nextCursor,
            }));
        } catch (cause) {
            setError(cause.message);
        } finally {
            setLoadingMore(false);
        }
    };

    const edit = async (payload) => {
        setEditorBusy(true);
        setError('');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('Please sign in again.');
            const headers = { Authorization: `Bearer ${session.access_token}` };
            const response = await fetch('/api/reading/editor', {
                method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload), cache: 'no-store',
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Could not save the reading.');
            const updated = await fetch('/api/reading/editor', { headers, cache: 'no-store' });
            if (updated.ok) setEditorDays((await updated.json()).days);
            await loadFeed(activeTag, true);
        } catch (cause) {
            setError(cause.message);
        } finally {
            setEditorBusy(false);
        }
    };

    const hasToday = feed.today.length > 0;
    return <section className="blog-archive reading-feed" aria-label="Reading recommendations">
        <div className="blog-topics" role="group" aria-labelledby="reading-topics-label">
            <h2 id="reading-topics-label" className="blog-eyebrow">Filter by topic & category</h2>
            <button type="button" className="reading-filter-toggle" aria-expanded={filtersOpen}
                aria-controls="reading-topic-options" onClick={() => setFiltersOpen((open) => !open)}>
                <span>{activeTag ? `Filter topics · ${activeTag}` : 'Filter topics'}</span>
                <span aria-hidden="true">{filtersOpen ? '−' : '+'}</span>
            </button>
            <div id="reading-topic-options" className="blog-topics__options" data-open={filtersOpen}>
                <button type="button" className="blog-topic" aria-pressed={!activeTag} onClick={() => chooseTag('')}>All</button>
                {feed.topics.map((topic) => <button key={topic.name} type="button" className="blog-topic"
                    aria-pressed={activeTag === topic.name} onClick={() => chooseTag(topic.name)}>
                    {topic.name}
                </button>)}
            </div>
        </div>

        {editorDays && <div className="reading-editor-toggle">
            <button type="button" className="blog-reset" aria-expanded={editorOpen} onClick={() => setEditorOpen((value) => !value)}>
                {editorOpen ? 'Close editor' : 'Edit reading page'}
            </button>
        </div>}
        {editorOpen && editorDays && <EditorPanel days={editorDays} onAction={edit} busy={editorBusy} />}

        {error && <p className="reading-error" role="alert">{error}</p>}
        <div className="blog-results-heading reading-section-heading">
            <div><p className="blog-eyebrow">{labelDate(feed.todayDate)}</p><h2>Today’s readings</h2></div>
            <div className="blog-results-heading__meta"><p role="status" aria-live="polite">{loading ? 'Loading…' : `${feed.today.length} ${feed.today.length === 1 ? 'reading' : 'readings'}`}</p>
                {activeTag && <button type="button" className="blog-reset" onClick={() => chooseTag('')}>Reset filters <span aria-hidden="true">✕</span></button>}
            </div>
        </div>
        {hasToday && <ul className="blog-list-grid reading-today-grid" aria-label="Today’s readings">
            {feed.today.map((reading, index) => <li key={reading.id}><ReadingCard reading={reading} index={index} /></li>)}
        </ul>}
        {!hasToday && <div className="blog-empty reading-empty"><h3>{activeTag ? 'Nothing in this topic today.' : 'Today’s five are on their way.'}</h3><p>Browse earlier selections below.</p></div>}

        <div className="blog-results-heading reading-section-heading reading-archive-heading"><div><p className="blog-eyebrow">The reading file</p><h2>Earlier readings</h2></div></div>
        {feed.archive.map((day) => <section className="reading-archive-day" key={day.date} aria-labelledby={`reading-day-${day.date}`}>
            <div className="reading-day-heading"><h3 id={`reading-day-${day.date}`}><time dateTime={day.date}>{labelDate(day.date)}</time></h3><span>{day.readings.length} readings</span></div>
            <ul className="blog-list-grid">{day.readings.map((reading, index) => <li key={reading.id}><ReadingCard reading={reading} index={index} /></li>)}</ul>
        </section>)}
        {!feed.archive.length && <p className="reading-archive-empty">{loading ? 'Loading earlier readings…' : 'No earlier readings in this topic yet.'}</p>}
        {feed.nextCursor && <button type="button" className="reading-load-more" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Earlier readings'} <span aria-hidden="true">↓</span>
        </button>}
    </section>;
}
