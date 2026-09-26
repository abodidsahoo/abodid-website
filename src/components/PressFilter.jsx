import React, { useEffect, useMemo, useState } from 'react';

const slugify = (value) => String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const categoriesFor = (item) => (
    Array.isArray(item.categories) ? item.categories : [item.categories]
).filter(Boolean);

const displayDate = (item) => {
    const rawDate = item.published_at || item.date;
    const date = rawDate ? new Date(rawDate) : null;

    if (date && !Number.isNaN(date.getTime())) {
        return {
            label: new Intl.DateTimeFormat('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                timeZone: 'UTC',
            }).format(date),
            iso: date.toISOString(),
        };
    }

    return { label: item.date || '', iso: undefined };
};

const PressFilter = ({ items = [], initialTag = 'All' }) => {
    const [activeTag, setActiveTag] = useState(initialTag);

    useEffect(() => {
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            setActiveTag(params.get('tag') || params.get('category') || 'All');
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const categories = useMemo(() => {
        const counts = new Map();

        items.forEach((item) => {
            new Set(categoriesFor(item)).forEach((category) => {
                counts.set(category, (counts.get(category) || 0) + 1);
            });
        });

        return [
            { label: 'All', count: items.length },
            ...Array.from(counts, ([label, count]) => ({ label, count }))
                .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
        ];
    }, [items]);

    const normalizedActiveTag = categories.find(
        ({ label }) => slugify(label) === slugify(activeTag)
    )?.label || activeTag;

    const filteredItems = useMemo(() => {
        if (normalizedActiveTag === 'All') return items;

        const activeSlug = slugify(normalizedActiveTag);
        return items.filter((item) => categoriesFor(item).some(
            (category) => slugify(category) === activeSlug
        ));
    }, [items, normalizedActiveTag]);

    const selectTag = (category) => {
        const nextTag = normalizedActiveTag === category ? 'All' : category;
        setActiveTag(nextTag);

        const url = new URL(window.location.href);
        url.searchParams.delete('category');
        url.searchParams.delete('tag');
        if (nextTag !== 'All') url.searchParams.set('tag', slugify(nextTag));
        window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
    };

    const showImageFallback = (event) => {
        const image = event.currentTarget;
        image.hidden = true;
        image.closest('.press-card-image')?.classList.add('has-image-error');
    };

    return (
        <section className="press-archive" aria-label="Browse press and media mentions">
            <div className="press-topics" role="group" aria-labelledby="press-topics-label">
                <h2 id="press-topics-label" className="press-eyebrow">Filter by type &amp; category</h2>
                <div className="press-topics__options">
                    {categories.map(({ label, count }) => (
                        <button
                            key={label}
                            type="button"
                            onClick={() => selectTag(label)}
                            className="press-topic"
                            aria-pressed={normalizedActiveTag === label}
                            aria-controls="press-mentions"
                            aria-label={`${label === 'All' ? 'All mentions' : label}: ${count} ${count === 1 ? 'mention' : 'mentions'}`}
                        >
                            <span>{label}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="press-results-heading">
                <h2>{normalizedActiveTag === 'All' ? 'All mentions' : normalizedActiveTag}</h2>
                <div className="press-results-heading__meta">
                    <p role="status" aria-live="polite" aria-atomic="true">
                        {filteredItems.length} {filteredItems.length === 1 ? 'entry' : 'entries'}
                    </p>
                    {normalizedActiveTag !== 'All' && (
                        <button type="button" onClick={() => selectTag('All')} className="press-reset">
                            Reset filters <span aria-hidden="true">✕</span>
                        </button>
                    )}
                </div>
            </div>

            <ul className="press-list-grid" id="press-mentions">
                {filteredItems.map((item, index) => {
                    const itemCategories = categoriesFor(item);
                    const date = displayDate(item);
                    const titleId = `press-title-${index}`;

                    return (
                        <li key={item.id || item.url || `${item.title}-${index}`}>
                            <article className="press-mention">
                                <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="press-mention-card"
                                    aria-labelledby={titleId}
                                >
                                    <div className="press-card-image">
                                        {item.image ? (
                                            <img
                                                src={item.image}
                                                alt={item.image_alt || ''}
                                                loading={index < 3 ? 'eager' : 'lazy'}
                                                decoding="async"
                                                onError={showImageFallback}
                                            />
                                        ) : null}
                                        <div className="press-card-placeholder" aria-hidden="true">
                                            <span>Public record</span>
                                            <span>{String(index + 1).padStart(2, '0')}</span>
                                        </div>
                                    </div>

                                    <div className="press-card-copy">
                                        {item.publication && (
                                            <p className="press-card-publication">{item.publication}</p>
                                        )}
                                        <div className="press-card-title-row">
                                            <h3 id={titleId} className="press-card-title"><span>{item.title}</span></h3>
                                            <span className="press-card-arrow" aria-hidden="true">↗</span>
                                        </div>
                                        <div className="press-card-footer">
                                            <div className="press-card-categories" aria-label="Mention categories">
                                                {itemCategories.map((category) => (
                                                    <span className="press-card-tag" key={category}>{category}</span>
                                                ))}
                                            </div>
                                            {date.label && <time className="press-card-date" dateTime={date.iso}>{date.label}</time>}
                                        </div>
                                    </div>
                                </a>
                            </article>
                        </li>
                    );
                })}
            </ul>

            {filteredItems.length === 0 && (
                <div className="press-empty">
                    <h3>{items.length ? 'Nothing is filed under this label yet.' : 'The archive is being assembled.'}</h3>
                    <p>{items.length ? 'Choose another filter or return to the complete archive.' : 'New mentions will appear here as soon as they are published.'}</p>
                    {normalizedActiveTag !== 'All' && (
                        <button type="button" className="press-topic" onClick={() => selectTag('All')}>
                            Show all mentions <span aria-hidden="true">→</span>
                        </button>
                    )}
                </div>
            )}
        </section>
    );
};

export default PressFilter;
