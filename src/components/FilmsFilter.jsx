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

    const renderButton = (category) => (
        <button
            key={category}
            onClick={() => handleTagClick(category)}
            className={`filter-btn ${normalizedActiveTag === category ? 'contrast-active' : ''}`}
        >
            {category}
        </button>
    );

    const handleOpenVideo = (videoUrl) => {
        if (typeof window !== 'undefined' && window.openVideo) {
            const provider = videoUrl.includes('vimeo') ? 'vimeo' : 'youtube';
            window.openVideo(videoUrl, provider);
        }
    };

    return (
        <div className="films-filter-container">
            {/* Filter Bar */}
            <div className="filter-bar">
                <div className="filter-row">
                    {sortedCategories.map(renderButton)}
                </div>
            </div>

            {/* 2-Column Grid */}
            <div className="films-grid">
                {filteredItems.map((film, index) => (
                    <article
                        key={film.videoUrl || index}
                        className="film-card fade-in-up"
                        style={{ animationDelay: `${index * 50}ms` }}
                    >
                        <div
                            className="film-thumbnail-wrapper"
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
                                    className="film-thumbnail"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="film-thumbnail-placeholder">
                                    <span className="placeholder-icon">▶</span>
                                </div>
                            )}

                            <div className="play-button-overlay">
                                <svg
                                    width="28"
                                    height="28"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path d="M8 5v14l11-7z" />
                                </svg>
                            </div>
                        </div>

                        <div className="film-info">
                            <div className="film-header-row">
                                <h2 className="film-title">{film.title}</h2>
                                {film.year && <span className="film-year">{film.year}</span>}
                            </div>

                            <div className="film-roles">
                                {film.roles && film.roles.length > 0 && (
                                    <span className="role-text">{film.roles.join(' / ')}</span>
                                )}
                            </div>
                        </div>
                    </article>
                ))}
            </div>

            <style>{`
                .films-filter-container {
                    width: 100%;
                }

                /* Filter Bar */
                .filter-bar {
                    margin-bottom: 3rem;
                    padding: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 0.8rem;
                    width: 100%;
                }

                .filter-row {
                    display: flex;
                    justify-content: flex-start;
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

                /* Grid: 2 Columns Layout */
                .films-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 3rem 2.5rem;
                    width: 100%;
                    margin-bottom: 4rem;
                }

                .film-card {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .film-thumbnail-wrapper {
                    position: relative;
                    width: 100%;
                    aspect-ratio: 16 / 9;
                    overflow: hidden;
                    border-radius: 14px;
                    background: var(--bg-surface);
                    cursor: pointer;
                }

                .film-thumbnail {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
                }

                .film-thumbnail-wrapper:hover .film-thumbnail {
                    transform: scale(1.035);
                }

                .film-thumbnail-placeholder {
                    display: grid;
                    place-items: center;
                    width: 100%;
                    height: 100%;
                    background: var(--bg-surface);
                    color: var(--text-tertiary);
                    font-size: 2rem;
                }

                .play-button-overlay {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 54px;
                    height: 54px;
                    border-radius: 50%;
                    background: rgba(0, 0, 0, 0.55);
                    backdrop-filter: blur(4px);
                    color: #ffffff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding-left: 3px;
                    transition: transform 0.25s ease, background-color 0.25s ease;
                }

                .film-thumbnail-wrapper:hover .play-button-overlay {
                    transform: translate(-50%, -50%) scale(1.1);
                    background: rgba(0, 0, 0, 0.8);
                }

                .film-info {
                    display: flex;
                    flex-direction: column;
                    gap: 0.35rem;
                }

                .film-header-row {
                    display: flex;
                    align-items: baseline;
                    justify-content: space-between;
                    gap: 1rem;
                }

                .film-title {
                    font-family: var(--font-serif, var(--font-display));
                    font-size: 1.45rem;
                    font-weight: 500;
                    line-height: 1.25;
                    color: var(--text-primary);
                    margin: 0;
                }

                .film-year {
                    font-family: var(--font-mono, monospace);
                    font-size: 0.82rem;
                    color: var(--text-tertiary);
                }

                .film-roles {
                    margin-top: 0.15rem;
                }

                .role-text {
                    font-family: var(--font-mono, monospace);
                    font-size: 0.76rem;
                    letter-spacing: 0.05em;
                    text-transform: uppercase;
                    color: var(--text-tertiary);
                }

                @media (max-width: 860px) {
                    .films-grid {
                        grid-template-columns: 1fr;
                        gap: 2.5rem;
                    }
                }
            `}</style>
        </div>
    );
};

export default FilmsFilter;
