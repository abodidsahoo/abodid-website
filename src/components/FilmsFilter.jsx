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

        // Filter out categories with 0 count (safety) and sort by count desc
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

    // 2. Logic to split categories into rows (Bottom-heavy pyramid based on visual weight)
    const rows = useMemo(() => {
        const totalItems = sortedCategories.length;
        const getWeight = (str) => str.length + 6;
        const totalWeight = sortedCategories.reduce((acc, cat) => acc + getWeight(cat), 0);

        let currentWeight = 0;
        let splitIndex = 0;

        for (let i = 0; i < totalItems; i++) {
            currentWeight += getWeight(sortedCategories[i]);
            if (currentWeight > (totalWeight * 0.45)) {
                splitIndex = i + 1;
                break;
            }
        }

        if (totalItems <= 3) return [sortedCategories];
        if (splitIndex < 2 && totalItems > 4) splitIndex = 2;
        if (splitIndex > totalItems - 2) splitIndex = totalItems - 2;

        const topRow = sortedCategories.slice(0, splitIndex);
        const bottomRow = sortedCategories.slice(splitIndex);

        return [topRow, bottomRow];
    }, [sortedCategories]);

    // 3. Filter items based on active category
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
                {rows.map((row, i) => (
                    <div key={i} className="filter-row">
                        {row.map(renderButton)}
                    </div>
                ))}
            </div>

            {/* Grid */}
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
                                    sizes="(max-width: 768px) calc(100vw - 36px), 1052px"
                                    alt={film.title}
                                    className="film-thumbnail"
                                    loading={index === 0 ? 'eager' : 'lazy'}
                                    fetchpriority={index === 0 ? 'high' : 'auto'}
                                    decoding="async"
                                    width="1280"
                                    height="720"
                                />
                            ) : (
                                <div className="film-placeholder" />
                            )}
                            <div className="play-overlay">
                                <div className="play-button">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M5 3L19 12L5 21V3Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="film-content">
                            <div className="film-categories">
                                {film.categories && film.categories.map(cat => (
                                    <span key={cat} className="category-tag">{cat}</span>
                                ))}
                            </div>

                            <h2 className="film-title">{film.title}</h2>

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
                    margin-bottom: 4rem;
                    padding: 0 1rem;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 1rem;
                }

                .filter-row {
                    display: flex;
                    justify-content: flex-start;
                    flex-wrap: wrap;
                    gap: 0.6rem;
                    max-width: 900px;
                }

                .filter-btn {
                    background: transparent;
                    border: 1px solid var(--border-subtle);
                    font-size: 0.8rem;
                    font-weight: 500;
                    color: var(--text-secondary);
                    cursor: pointer;
                    padding: 8px 16px;
                    border-radius: 100px;
                    white-space: nowrap;
                    transition: all 0.2s ease;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .filter-btn:hover {
                    border-color: var(--text-primary);
                    color: var(--text-primary);
                }



                /* Grid */
                .films-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 5rem 0;
                }

                .film-card {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                    opacity: 0;
                    animation: fadeInUp 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
                }

                .film-card:first-child {
                    opacity: 1;
                    animation: none;
                }

                /* Client animation for React re-renders */
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                /* Thumbnail */
                .film-thumbnail-wrapper {
                    width: 100%;
                    aspect-ratio: 16/9;
                    border-radius: 12px;
                    overflow: hidden;
                    position: relative;
                    cursor: pointer;
                    background: var(--bg-surface);
                    box-shadow: 0 4px 20px rgba(0,0,0,0.05);
                    transition: transform 0.4s ease, box-shadow 0.4s ease;
                }

                .film-thumbnail-wrapper:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 12px 30px rgba(0,0,0,0.15);
                }

                .film-thumbnail {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transition: transform 0.6s ease;
                }

                .film-thumbnail-wrapper:hover .film-thumbnail {
                    transform: scale(1.05);
                }

                /* Play Button */
                .play-overlay {
                    position: absolute;
                    inset: 0;
                    background: rgba(0,0,0,0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.3s ease;
                }

                .film-thumbnail-wrapper:hover .play-overlay {
                    background: rgba(0,0,0,0.1);
                }

                .play-button {
                    width: 64px;
                    height: 64px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    transition: all 0.3s ease;
                    transform: scale(0.9);
                }

                .film-thumbnail-wrapper:hover .play-button {
                    transform: scale(1.1);
                    background: white;
                    color: black;
                    border-color: white;
                }
                
                .play-button svg {
                    margin-left: 4px;
                }
                
                /* Content */
                .film-content {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .film-categories {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                }

                .category-tag {
                    font-family: var(--font-mono);
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--text-tertiary);
                    border: 1px solid var(--border-subtle);
                    padding: 0.2rem 0.6rem;
                    border-radius: 100px;
                }

                .film-title {
                    font-family: var(--font-serif);
                    font-size: 1.75rem;
                    font-weight: 500;
                    color: var(--text-primary);
                    margin: 0;
                    line-height: 1.2;
                    transition: color 0.2s ease;
                }

                .film-card:hover .film-title {
                 font-weight: 700;   
                color: var(--text-primary);
                }

                .film-roles {
                    font-family: var(--font-sans);
                    font-size: 0.95rem;
                    color: var(--text-secondary);
                }

                @media (max-width: 768px) {
                    .films-grid {
                        grid-template-columns: 1fr;
                        gap: 3rem;
                    }
                    .filter-bar {
                        flex-direction: row;
                        flex-wrap: nowrap;
                        overflow-x: auto;
                        -webkit-overflow-scrolling: touch;
                        scrollbar-width: none;
                        padding-bottom: 0.5rem;
                        gap: 0.4rem;
                        margin-left: -1rem; /* Adjust padding to allow full bleed scroll on mobile if needed, or keep padding */
                        padding-left: 1rem;
                        padding-right: 1rem;
                        width: calc(100% + 2rem);
                    }
                    .filter-bar::-webkit-scrollbar {
                        display: none;
                    }
                    .filter-row {
                        gap: 0.4rem;
                        flex-wrap: nowrap;
                        flex-shrink: 0;
                    }
                }
            `}</style>
        </div>
    );
};

export default FilmsFilter;
