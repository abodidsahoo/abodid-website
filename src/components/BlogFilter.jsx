import React, { useState, useMemo, useEffect } from 'react';

const slugify = (str) =>
    String(str || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

const BlogFilter = ({ posts }) => {
    const [activeTag, setActiveTag] = useState(() => {
        if (typeof window === 'undefined') return 'All';
        const params = new URLSearchParams(window.location.search);
        const tagParam = params.get('tag') || params.get('category');
        return tagParam || 'All';
    });

    useEffect(() => {
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            const tagParam = params.get('tag') || params.get('category');
            setActiveTag(tagParam || 'All');
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    // Extract unique categories for filter bar
    const allCategories = useMemo(() => {
        const categories = new Set(['All']);
        posts.forEach(post => {
            if (post.category) {
                if (Array.isArray(post.category)) {
                    post.category.forEach(c => c && categories.add(c));
                } else {
                    categories.add(post.category);
                }
            }
        });
        return Array.from(categories);
    }, [posts]);

    const normalizedActiveTag = useMemo(() => {
        if (activeTag === 'All') return 'All';
        const match = allCategories.find(
            (cat) => cat.toLowerCase() === activeTag.toLowerCase() || slugify(cat) === slugify(activeTag)
        );
        return match || activeTag;
    }, [allCategories, activeTag]);

    const handleTagClick = (category) => {
        const nextTag = normalizedActiveTag === category ? 'All' : category;
        setActiveTag(nextTag);
        const params = new URLSearchParams();
        if (nextTag !== 'All') {
            params.set('tag', slugify(nextTag));
        }
        const query = params.toString();
        window.history.pushState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    };

    // Filter posts by active category
    const filteredPosts = useMemo(() => {
        if (normalizedActiveTag === 'All') return posts;
        const targetSlug = slugify(normalizedActiveTag);
        return posts.filter(post => {
            const cats = Array.isArray(post.category) ? post.category : (post.category ? [post.category] : []);
            return cats.some(c => c === normalizedActiveTag || slugify(c) === targetSlug);
        });
    }, [posts, normalizedActiveTag]);

    return (
        <div className="blog-filter-container">
            {/* Filter Bar */}
            <div className="filter-bar">
                <div className="filter-scroll">
                    {allCategories.map(category => (
                        <button
                            key={category}
                            onClick={() => handleTagClick(category)}
                            className={`filter-btn ${normalizedActiveTag === category ? 'contrast-active' : ''}`}
                        >
                            {category}
                        </button>
                    ))}
                </div>
            </div>

            {/* 2-Column Grid Replicating Recommended Card Design Pixel-by-Pixel */}
            <ul className="blog-list-grid">
                {filteredPosts.map((post) => (
                    <li key={post.title || post.href}>
                        <a href={post.href} className="blog-post-card">
                            {/* Left Image Column: 190px Square Image */}
                            <div className="card-image-wrapper">
                                {post.image ? (
                                    <img
                                        src={post.image}
                                        alt={post.title}
                                        className="card-image"
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="card-image-placeholder">
                                        <span className="placeholder-icon">✦</span>
                                    </div>
                                )}
                            </div>

                            {/* Center Content Column: Date + Title + Category & View More */}
                            <div className="card-main-col">
                                <div className="card-header-meta">
                                    <span className="card-date">{post.date}</span>
                                </div>

                                <h2 className="card-title">{post.title}</h2>

                                <div className="card-footer-row">
                                    {post.category && (
                                        <div className="card-category">
                                            {Array.isArray(post.category) ? post.category.join(' · ') : post.category}
                                        </div>
                                    )}
                                    <div className="card-action">
                                        <span>VIEW MORE</span>
                                        <span className="card-arrow" aria-hidden="true">→</span>
                                    </div>
                                </div>
                            </div>
                        </a>
                    </li>
                ))}
            </ul>

            <style>{`
                .filter-bar {
                    margin-bottom: 3rem;
                    width: 100%;
                }

                .filter-scroll {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.6rem;
                    max-width: 100%;
                }

                .filter-btn {
                    background: transparent;
                    border: 1px solid var(--border-subtle);
                    font-family: var(--font-sans, inherit);
                    font-size: 0.78rem;
                    font-weight: 500;
                    color: var(--text-secondary);
                    cursor: pointer;
                    padding: 8px 18px;
                    border-radius: 100px;
                    white-space: nowrap;
                    transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                }

                .filter-btn:hover {
                    border-color: var(--text-primary);
                    color: var(--text-primary);
                    background: var(--bg-surface);
                }

                .filter-btn.contrast-active,
                .filter-btn.active,
                .filter-btn.is-selected {
                    background: var(--text-primary) !important;
                    color: var(--bg-color) !important;
                    border-color: var(--text-primary) !important;
                }

                .blog-list-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 2rem;
                    padding: 0;
                    margin: 2.5rem 0 5rem;
                    list-style: none;
                    width: 100%;
                }

                .blog-post-card {
                    display: grid;
                    grid-template-columns: 190px 1fr;
                    gap: 2rem;
                    padding: 2rem;
                    text-decoration: none;
                    color: var(--text-primary);
                    border: 1px solid var(--border-subtle);
                    border-radius: 18px;
                    background: color-mix(in srgb, var(--bg-surface) 25%, var(--bg-color));
                    transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1),
                                border-color 0.3s cubic-bezier(0.2, 0.8, 0.2, 1),
                                background-color 0.3s cubic-bezier(0.2, 0.8, 0.2, 1),
                                box-shadow 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
                    align-items: center;
                    height: 100%;
                }

                .blog-post-card:hover {
                    transform: translateY(-3px);
                    border-color: color-mix(in srgb, var(--text-primary) 35%, var(--border-subtle));
                    background: var(--bg-surface);
                    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.16);
                }

                .card-image-wrapper {
                    width: 190px;
                    height: 190px;
                    overflow: hidden;
                    border-radius: 14px;
                    background: var(--bg-surface);
                    flex-shrink: 0;
                }

                .card-image {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
                }

                .blog-post-card:hover .card-image {
                    transform: scale(1.035);
                }

                .card-image-placeholder {
                    display: grid;
                    place-items: center;
                    width: 100%;
                    height: 100%;
                    background: var(--bg-surface);
                    color: var(--text-tertiary);
                    font-size: 1.8rem;
                }

                .card-main-col {
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    height: 100%;
                    min-height: 190px;
                    min-width: 0;
                }

                .card-date {
                    font-family: var(--font-mono, monospace);
                    font-size: 0.85rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--text-tertiary);
                }

                .card-title {
                    font-family: var(--font-serif, "Crimson Pro", serif);
                    font-size: 1.55rem;
                    font-weight: 400;
                    line-height: 1.25;
                    margin: 0.6rem 0 1rem;
                    color: var(--text-primary);
                    display: -webkit-box;
                    -webkit-line-clamp: 3;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .card-footer-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 1rem;
                    margin-top: auto;
                }

                .card-category {
                    font-family: var(--font-sans, inherit);
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .card-action {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-family: var(--font-mono, monospace);
                    font-size: 0.8rem;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    color: var(--text-tertiary);
                    transition: color 0.25s ease;
                    white-space: nowrap;
                    margin-left: auto;
                }

                .card-arrow {
                    display: inline-block;
                    transition: transform 0.2s ease;
                }

                .blog-post-card:hover .card-action {
                    color: var(--text-primary);
                }

                .blog-post-card:hover .card-arrow {
                    transform: translateX(5px);
                }

                @media (max-width: 1120px) {
                    .blog-list-grid {
                        grid-template-columns: 1fr;
                    }
                }

                @media (max-width: 600px) {
                    .blog-post-card {
                        grid-template-columns: 120px 1fr;
                        padding: 1.25rem;
                        gap: 1.25rem;
                    }
                    .card-image-wrapper {
                        width: 120px;
                        height: 120px;
                    }
                    .card-main-col {
                        min-height: 120px;
                    }
                    .card-title {
                        font-size: 1.2rem;
                        margin: 0.4rem 0 0.6rem;
                    }
                }
            `}</style>
        </div>
    );
};

export default BlogFilter;
