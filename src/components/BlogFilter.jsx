import React, { useState, useMemo, useEffect } from 'react';

const slugify = (value) => String(value || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const categoriesFor = (post) =>
    (Array.isArray(post.category) ? post.category : [post.category]).filter(Boolean);

const displayDate = (post) => {
    const date = post.published_at ? new Date(post.published_at) : null;
    return date && !Number.isNaN(date.getTime())
        ? { label: new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date), iso: date.toISOString() }
        : { label: post.date || '', iso: undefined };
};

const BlogFilter = ({ posts = [], initialTag = 'All' }) => {
    // Match the server query state on the first render to avoid hydration differences.
    const [activeTag, setActiveTag] = useState(initialTag);

    useEffect(() => {
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            setActiveTag(params.get('tag') || params.get('category') || 'All');
        };
        window.addEventListener('popstate', handlePopState);

        // ⚡ Early background preloading of blog posts (both JSON data and HTML document prefetch)
        window.__PRELOADED_POSTS__ = window.__PRELOADED_POSTS__ || {};
        posts.forEach((post) => {
            const rawSlug = post.slug || (post.href ? post.href.replace('/blog/', '').replace(/\/$/, '') : '');
            if (!rawSlug) return;
            const cleanSlug = decodeURIComponent(rawSlug);

            // Prefetch JSON payload
            if (!window.__PRELOADED_POSTS__[cleanSlug]) {
                fetch(`/api/blog-post.json?slug=${encodeURIComponent(cleanSlug)}`, { priority: 'low' })
                    .then((res) => res.json())
                    .then((data) => {
                        if (data && data.post) {
                            window.__PRELOADED_POSTS__[cleanSlug] = data;
                        }
                    })
                    .catch(() => {});
            }

            // Prefetch HTML page document for instant browser navigation
            if (post.href && !document.querySelector(`link[rel="prefetch"][href="${post.href}"]`)) {
                const link = document.createElement('link');
                link.rel = 'prefetch';
                link.href = post.href;
                document.head.appendChild(link);
            }
        });

        return () => window.removeEventListener('popstate', handlePopState);
    }, [posts]);

    const categories = useMemo(() => {
        const counts = new Map();
        posts.forEach((post) => new Set(categoriesFor(post)).forEach((category) => {
            counts.set(category, (counts.get(category) || 0) + 1);
        }));
        return [{ label: 'All', count: posts.length }, ...Array.from(counts, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)];
    }, [posts]);

    const normalizedActiveTag = categories.find(({ label }) => slugify(label) === slugify(activeTag))?.label || activeTag;
    const filteredPosts = useMemo(() => normalizedActiveTag === 'All' ? posts : posts.filter((post) =>
        categoriesFor(post).some((category) => slugify(category) === slugify(normalizedActiveTag))
    ), [posts, normalizedActiveTag]);

    const selectTag = (category) => {
        const nextTag = normalizedActiveTag === category ? 'All' : category;
        setActiveTag(nextTag);
        const url = new URL(window.location.href);
        url.searchParams.delete('category');
        url.searchParams.delete('tag');
        if (nextTag !== 'All') url.searchParams.set('tag', slugify(nextTag));
        window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
    };

    const preloadSinglePost = (post) => {
        const rawSlug = post.slug || (post.href ? post.href.replace('/blog/', '').replace(/\/$/, '') : '');
        if (!rawSlug) return;
        const cleanSlug = decodeURIComponent(rawSlug);
        window.__PRELOADED_POSTS__ = window.__PRELOADED_POSTS__ || {};
        if (window.__PRELOADED_POSTS__[cleanSlug]) return;

        fetch(`/api/blog-post.json?slug=${encodeURIComponent(cleanSlug)}`)
            .then((res) => res.json())
            .then((data) => {
                if (data && data.post) {
                    window.__PRELOADED_POSTS__[cleanSlug] = data;
                }
            })
            .catch(() => {});
    };

    return (
        <section className="blog-archive" aria-label="Browse articles">
            <div className="blog-topics" role="group" aria-labelledby="blog-topics-label">
                <h2 id="blog-topics-label" className="blog-eyebrow">Filter by topic & category</h2>
                <div className="blog-topics__options">
                    {categories.map(({ label, count }) => (
                        <button
                            key={label}
                            type="button"
                            onClick={() => selectTag(label)}
                            className="blog-topic"
                            aria-pressed={normalizedActiveTag === label}
                            aria-controls="blog-articles"
                            aria-label={`${label === 'All' ? 'All articles' : label}: ${count} ${count === 1 ? 'article' : 'articles'}`}
                            data-count={count}
                        >
                            <span>{label}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="blog-results-heading">
                <h2>{normalizedActiveTag === 'All' ? 'All writing' : normalizedActiveTag}</h2>
                <div className="blog-results-heading__meta">
                    <p role="status" aria-live="polite" aria-atomic="true">
                        {filteredPosts.length} {filteredPosts.length === 1 ? 'article' : 'articles'}
                    </p>
                    {normalizedActiveTag !== 'All' && (
                        <button type="button" onClick={() => selectTag('All')} className="blog-reset">Reset filters <span aria-hidden="true">✕</span></button>
                    )}
                </div>
            </div>

            <ul className="blog-list-grid" id="blog-articles">
                {filteredPosts.map((post, index) => {
                    const date = displayDate(post);
                    const postCategories = categoriesFor(post);
                    return (
                        <li key={post.href || post.title}>
                            <article className="blog-post">
                                <a
                                    href={post.href}
                                    className="blog-post-card"
                                    onMouseEnter={() => preloadSinglePost(post)}
                                    onTouchStart={() => preloadSinglePost(post)}
                                    aria-labelledby={`blog-title-${index}`}
                                >
                                    <div className="blog-card-image">
                                        {post.image ? (
                                            <img src={post.image} alt="" loading={index < 3 ? 'eager' : 'lazy'} decoding="async" />
                                        ) : (
                                            <div className="blog-card-placeholder" aria-hidden="true">
                                                <span>Field notes</span>
                                                <span>{String(index + 1).padStart(2, '0')}</span>
                                            </div>
                                        )}
                                        <span className="blog-card-badge">{postCategories[0] || 'Writing'}</span>
                                    </div>
                                    <div className="blog-card-copy">
                                        <div className="blog-card-title-row">
                                            <h3 id={`blog-title-${index}`} className="blog-card-title"><span>{post.title}</span></h3>
                                            <span className="blog-card-arrow" aria-hidden="true">↗</span>
                                        </div>
                                        <div className="blog-card-footer">
                                            <div className="blog-card-category" aria-label="Article categories">
                                                {postCategories.map((category) => <span className="blog-card-tag" key={category}>{category}</span>)}
                                            </div>
                                            {date.label && <time className="blog-card-date" dateTime={date.iso}>{date.label}</time>}
                                        </div>
                                    </div>
                                </a>
                            </article>
                        </li>
                    );
                })}
            </ul>

            {filteredPosts.length === 0 && (
                <div className="blog-empty">
                    <h3>{posts.length ? 'No articles in this topic yet.' : 'New writing is on its way.'}</h3>
                    <p>{posts.length ? 'Explore another topic or return to all writing.' : 'Check back soon for notes, stories, and reflections.'}</p>
                    {normalizedActiveTag !== 'All' && <button type="button" className="blog-topic" onClick={() => selectTag('All')}>Show all articles <span aria-hidden="true">→</span></button>}
                </div>
            )}
        </section>
    );
};

export default BlogFilter;
