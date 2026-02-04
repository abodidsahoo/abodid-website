import React, { useState, useMemo } from 'react';

const FilmsFilter = ({ items }) => {
    const [activeTag, setActiveTag] = useState('All');

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

    // 2. Logic to split categories into rows (Bottom-heavy pyramid based on visual weight)
    const rows = useMemo(() => {
        // We add "All" which is short, but some categories are "Non-Fiction Storytelling" (long).
        // A simple count split usually fails visual balance.
        // Let's use character count heuristic.

        const totalItems = sortedCategories.length;

        // Helper to get weight (char count + padding/margin proxy)
        const getWeight = (str) => str.length + 6;
        const totalWeight = sortedCategories.reduce((acc, cat) => acc + getWeight(cat), 0);

        // Targeted Split:
        // We want Top Row to be lighter than Bottom Row.
        // Ideal ratio: Top ~ 40-45%, Bottom ~ 55-60%.

        let currentWeight = 0;
        let splitIndex = 0;

        // Find the index where we cross the 45% threshold
        for (let i = 0; i < totalItems; i++) {
            currentWeight += getWeight(sortedCategories[i]);
            if (currentWeight > (totalWeight * 0.45)) {
                // Check if stopping here is better or continuing to next is better?
                // Actually, strictly stopping as soon as we cross usually makes Top lighter, which is desired.
                splitIndex = i + 1;
                // However, we must ensure we don't leave just 1 orphan on the next line if possible,
                // or have 1 item on top line if total is large. 
                // But generally loop finds a decent spot.
                break;
            }
        }

        // Safety adjustments for small counts
        if (totalItems <= 3) return [sortedCategories];

        // If the calculation put almost everything in bottom, ensure at least some on top
        if (splitIndex < 2 && totalItems > 4) splitIndex = 2;
        // If it put almost everything on top, push back
        if (splitIndex > totalItems - 2) splitIndex = totalItems - 2;

        // Force max 2 lines for reasonable amounts of tags (up to ~18 tags usually fits in 2 lines on desktop)
        // The user hates "random tag here and there", which implies 3rd line with 1 item.
        // Let's stick to 2 lines unless we have a massive amount.

        const topRow = sortedCategories.slice(0, splitIndex);
        const bottomRow = sortedCategories.slice(splitIndex);

        return [topRow, bottomRow];

    }, [sortedCategories]);

    // 3. Filter items based on active category
    const filteredItems = useMemo(() => {
        if (activeTag === 'All') return items;
        return items.filter(item => {
            if (Array.isArray(item.categories)) {
                return item.categories.includes(activeTag);
            }
            return item.categories === activeTag;
        });
    }, [items, activeTag]);

    const renderButton = (category) => (
        <button
            key={category}
            onClick={() => setActiveTag(category)}
            className={`filter-btn ${activeTag === category ? 'active' : ''}`}
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
                                    src={film.image}
                                    alt={film.title}
                                    className="film-thumbnail"
                                    loading="lazy"
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

                .filter-btn.active {
                    background: var(--text-primary);
                    color: #000000;
                    border-color: var(--text-primary);
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
                    color: var(--text-tertiary);
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
                    .filter-row {
                        gap: 0.4rem;
                    }
                }
            `}</style>
        </div>
    );
};

export default FilmsFilter;
