import { useState, useMemo, useEffect } from 'react';
import {
    getOptimizedImageSrcSet,
    getOptimizedImageUrl,
} from '../lib/imageOptimization.js';

const slugify = (str) =>
    String(str || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

const POP_PALETTE = {
    pink: '#ff7eb5',
    yellow: '#ffe44f',
    lime: '#caff48',
    cream: '#fff8e8',
    blue: '#2444ca',
    orange: '#ff875c',
    purple: '#6657d8',
};

const getShadeColor = (shadeKey) => {
    if (!shadeKey) return null;
    const lower = String(shadeKey).toLowerCase().trim();
    if (POP_PALETTE[lower]) return POP_PALETTE[lower];
    return shadeKey.startsWith('#') || shadeKey.startsWith('var(') ? shadeKey : null;
};

const FilmsFilter = ({ items }) => {
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

    // 1. Extract, count and sort unique categories
    const sortedCategories = useMemo(() => {
        const counts = {};

        items.forEach(item => {
            const cats = Array.isArray(item.categories) ? item.categories : (item.categories ? [item.categories] : []);
            cats.forEach(c => {
                counts[c] = (counts[c] || 0) + 1;
            });
        });

        let cats = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

        return ['All', ...cats];
    }, [items]);

    const normalizedActiveTag = useMemo(() => {
        if (activeTag === 'All') return 'All';
        const match = sortedCategories.find(
            (cat) => cat.toLowerCase() === activeTag.toLowerCase() || slugify(cat) === slugify(activeTag)
        );
        return match || activeTag;
    }, [sortedCategories, activeTag]);

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

    // 2. Filter items based on active category
    const filteredItems = useMemo(() => {
        if (normalizedActiveTag === 'All') return items;
        const targetSlug = slugify(normalizedActiveTag);
        return items.filter(item => {
            const cats = Array.isArray(item.categories) ? item.categories : (item.categories ? [item.categories] : []);
            return cats.some(c => c === normalizedActiveTag || slugify(c) === targetSlug);
        });
    }, [items, normalizedActiveTag]);

    const renderButton = (category) => {
        const isActive = normalizedActiveTag === category;
        return (
            <button
                key={category}
                onClick={() => handleTagClick(category)}
                className={`filter-chip ${isActive ? 'active' : ''}`}
            >
                {category}
            </button>
        );
    };

    const handleOpenVideo = (videoUrl) => {
        if (typeof window !== 'undefined' && window.openVideo) {
            const provider = videoUrl.includes('vimeo') ? 'vimeo' : 'youtube';
            window.openVideo(videoUrl, provider);
        }
    };

    return (
        <div className="films-editorial-browser">
            {/* Filter Section */}
            <div className="filter-section">
                <p className="audience-label">Filter by genre & category</p>
                <div className="audience-filters">
                    {sortedCategories.map(renderButton)}
                </div>
            </div>

            {/* Results Count Bar */}
            <div className="resource-results-heading">
                <h2>Curation Pool</h2>
                <div className="resource-results-meta">
                    <span>{filteredItems.length} {filteredItems.length === 1 ? 'Film' : 'Films'}</span>
                    {normalizedActiveTag !== 'All' && (
                        <button
                            onClick={() => handleTagClick('All')}
                            className="resource-clear"
                        >
                            Reset filters ✕
                        </button>
                    )}
                </div>
            </div>

            {/* 2-Column Editorial Grid */}
            <div className="resource-grid">
                {filteredItems.map((film, index) => {
                    const customShade = getShadeColor(film.shade);
                    const cats = Array.isArray(film.categories) ? film.categories : (film.categories ? [film.categories] : []);
                    const primaryCategory = cats[0] || 'Film';
                    const badgeBg = customShade || POP_PALETTE.yellow;

                    return (
                        <article
                            key={film.videoUrl || film.id || index}
                            className="resource-card-react film-card-pop"
                        >
                            <div
                                className="thumbnail-container"
                                onClick={() => handleOpenVideo(film.videoUrl)}
                            >
                                {film.image ? (
                                    <img
                                        src={getOptimizedImageUrl(film.image, { width: 1200, quality: 74 })}
                                        srcSet={getOptimizedImageSrcSet(film.image, {
                                            widths: [480, 800, 1200],
                                            quality: 74,
                                        })}
                                        sizes="(max-width: 768px) 100vw, 50vw"
                                        alt={film.title || 'Film thumbnail'}
                                        className="thumbnail"
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="thumbnail-placeholder">
                                        <span>▶</span>
                                    </div>
                                )}

                                <div className="play-button-overlay">
                                    <svg
                                        width="26"
                                        height="26"
                                        viewBox="0 0 24 24"
                                        fill="currentColor"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                </div>

                                <div
                                    className="film-category-badge"
                                    style={{ backgroundColor: badgeBg }}
                                >
                                    {primaryCategory}
                                </div>
                            </div>

                            <div className="content">
                                <a
                                    href={`/films/${film.slug || slugify(film.title)}`}
                                    className="title-link-wrapper"
                                >
                                    <h3 className="title">
                                        <span>{film.title}</span>
                                    </h3>
                                    <span className="resource-card-arrow" aria-hidden="true">↗</span>
                                </a>

                                <div className="meta">
                                    <div className="tags">
                                        {film.roles && film.roles.length > 0 ? (
                                            film.roles.map((role) => (
                                                <span key={role} className="tag">{role}</span>
                                            ))
                                        ) : (
                                            <span className="tag">{primaryCategory}</span>
                                        )}
                                    </div>
                                    {film.year && <span className="film-year-badge">{film.year}</span>}
                                </div>
                            </div>
                        </article>
                    );
                })}
            </div>

            <style>{`
                .films-editorial-browser {
                    display: flex;
                    flex-direction: column;
                    gap: 28px;
                    width: 100%;
                }

                /* Filter Section */
                .filter-section {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .audience-label {
                    margin: 0;
                    color: var(--pop-ink, #15130f);
                    font: 700 0.72rem/1 var(--resources-mono, "Satoshi-Variable", monospace);
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }

                .audience-filters {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }

                .filter-chip {
                    min-height: 44px;
                    padding: 10px 18px;
                    border: 1px solid var(--pop-ink, #15130f);
                    border-radius: 14px;
                    background: var(--pop-cream, #fff8e8);
                    color: var(--pop-ink, #15130f);
                    font: 700 0.76rem/1 var(--resources-mono, "Satoshi-Variable", monospace);
                    letter-spacing: 0.06em;
                    text-transform: uppercase;
                    box-shadow: none;
                    cursor: pointer;
                    transition: transform 180ms ease, background 180ms ease, box-shadow 180ms ease;
                }

                .filter-chip:hover {
                    background: var(--pop-pink, #ff7eb5);
                    transform: translateY(-2px);
                    box-shadow: 0 3px 0 var(--pop-ink, #15130f);
                }

                .filter-chip.active {
                    background: var(--pop-yellow, #ffe44f);
                    color: var(--pop-ink, #15130f);
                    font-weight: 800;
                    box-shadow: inset 0 -3px 0 var(--pop-ink, #15130f);
                }

                /* Heading Bar */
                .resource-results-heading {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                    padding-top: 20px;
                    border-top: 1px solid var(--pop-ink, #15130f);
                }

                .resource-results-heading h2 {
                    margin: 0;
                    color: var(--pop-ink, #15130f);
                    font: 720 clamp(1.6rem, 2.5vw, 2.2rem)/1.1 var(--resources-font, "Satoshi-Variable", sans-serif);
                    letter-spacing: -0.04em;
                }

                .resource-results-meta {
                    display: flex;
                    align-items: center;
                    flex-wrap: wrap;
                    justify-content: flex-end;
                    gap: 8px 16px;
                    font: 750 0.72rem/1.4 var(--resources-mono, "Satoshi-Variable", monospace);
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    color: var(--pop-ink, #15130f);
                }

                .resource-clear {
                    min-height: 40px;
                    padding: 6px 14px;
                    border: 1px solid var(--pop-ink, #15130f);
                    border-radius: 12px;
                    background: var(--pop-pink, #ff7eb5);
                    color: var(--pop-ink, #15130f);
                    font: 700 0.7rem/1 var(--resources-mono, monospace);
                    letter-spacing: 0.06em;
                    text-transform: uppercase;
                    cursor: pointer;
                    transition: transform 180ms ease, background 180ms ease;
                }

                .resource-clear:hover {
                    background: var(--pop-yellow, #ffe44f);
                    transform: translateY(-1px);
                }

                /* Grid Layout: Matches Moodboard Page Responsive Columns */
                .resource-grid {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 20px;
                }

                @media (max-width: 1100px) {
                    .resource-grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }
                }

                @media (max-width: 720px) {
                    .resource-grid {
                        grid-template-columns: minmax(0, 1fr);
                    }
                }

                .resource-card-react {
                    padding: 12px;
                    border: 1.5px solid var(--pop-ink, #15130f);
                    border-radius: 20px;
                    background: #ffffff;
                    color: var(--pop-ink, #15130f);
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 4px 0 var(--pop-ink, #15130f);
                    transition: transform 200ms ease, box-shadow 200ms ease, background 200ms ease;
                }

                .resource-card-react:hover {
                    background: var(--pop-cream, #fff8e8);
                    transform: translateY(-3px);
                    box-shadow: 0 8px 0 var(--pop-ink, #15130f);
                }

                .thumbnail-container {
                    position: relative;
                    width: 100%;
                    aspect-ratio: 16 / 9;
                    border: 1px solid var(--pop-ink, #15130f);
                    border-radius: 14px;
                    background: var(--pop-ink, #15130f);
                    overflow: hidden;
                    cursor: pointer;
                }

                .thumbnail {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transition: transform 450ms ease;
                }

                .resource-card-react:hover .thumbnail {
                    transform: scale(1.03);
                }

                .thumbnail-placeholder {
                    display: grid;
                    place-items: center;
                    width: 100%;
                    height: 100%;
                    background: var(--pop-ink, #15130f);
                    color: var(--pop-cream, #fff8e8);
                    font-size: 2rem;
                }

                .play-button-overlay {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 58px;
                    height: 58px;
                    border-radius: 50%;
                    background: var(--pop-yellow, #ffe44f);
                    border: 1.5px solid var(--pop-ink, #15130f);
                    color: var(--pop-ink, #15130f);
                    box-shadow: 0 3px 0 var(--pop-ink, #15130f);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding-left: 3px;
                    transition: transform 180ms ease, background 180ms ease;
                }

                .resource-card-react:hover .play-button-overlay {
                    transform: translate(-50%, -50%) scale(1.1);
                    background: var(--pop-pink, #ff7eb5);
                }

                .film-category-badge {
                    position: absolute;
                    top: 12px;
                    right: 12px;
                    padding: 6px 14px;
                    border-radius: 999px;
                    border: 1px solid var(--pop-ink, #15130f);
                    font: 700 0.72rem/1 var(--resources-mono, "Satoshi-Variable", monospace);
                    letter-spacing: 0.06em;
                    text-transform: uppercase;
                    color: #15130f;
                    box-shadow: 0 2px 0 var(--pop-ink, #15130f);
                    pointer-events: none;
                }

                .content {
                    padding: 16px 4px 4px;
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                    gap: 12px;
                }

                .title-link-wrapper {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 12px;
                    text-decoration: none;
                    color: inherit;
                }

                .title {
                    margin: 0;
                    color: var(--pop-ink, #15130f);
                    font: 720 clamp(1.4rem, 2.2vw, 1.9rem)/1.15 var(--resources-font, "Satoshi-Variable", sans-serif);
                    letter-spacing: -0.04em;
                }

                .resource-card-react:hover .title span {
                    text-decoration: underline;
                    text-decoration-thickness: 2px;
                    text-underline-offset: 4px;
                }

                .resource-card-arrow {
                    flex-shrink: 0;
                    display: inline-block;
                    font-size: 1.4rem;
                    font-weight: 800;
                    line-height: 1;
                    color: var(--pop-ink, #15130f);
                    transition: transform 180ms ease;
                }

                .resource-card-react:hover .resource-card-arrow {
                    transform: translate(3px, -3px);
                }

                .meta {
                    padding-top: 12px;
                    margin-top: auto;
                    border-top: 1px solid var(--pop-line, rgba(21, 19, 15, 0.24));
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                }

                .tags {
                    display: flex;
                    gap: 6px;
                    flex-wrap: wrap;
                }

                .tag {
                    padding: 5px 10px;
                    border: 1px solid var(--pop-ink, #15130f);
                    border-radius: 8px;
                    background: var(--pop-cream, #fff8e8);
                    color: var(--pop-ink, #15130f);
                    font: 700 0.7rem/1.2 var(--resources-mono, "Satoshi-Variable", monospace);
                    letter-spacing: 0.06em;
                    text-transform: uppercase;
                }

                .film-year-badge {
                    padding: 5px 10px;
                    border: 1px solid var(--pop-ink, #15130f);
                    border-radius: 8px;
                    background: var(--pop-yellow, #ffe44f);
                    color: var(--pop-ink, #15130f);
                    font: 750 0.72rem/1.2 var(--resources-mono, "Satoshi-Variable", monospace);
                    letter-spacing: 0.08em;
                    box-shadow: 0 2px 0 var(--pop-ink, #15130f);
                }

                @media (max-width: 860px) {
                    .resource-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
};

export default FilmsFilter;

