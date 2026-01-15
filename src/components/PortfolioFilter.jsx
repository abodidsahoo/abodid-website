import React, { useState, useMemo } from 'react';

const PortfolioFilter = ({ items }) => {
    const [activeTag, setActiveTag] = useState('All');

    // 1. Extract, count and sort unique categories
    const sortedCategories = useMemo(() => {
        const counts = {};

        items.forEach(item => {
            const cats = Array.isArray(item.category) ? item.category : (item.category ? [item.category] : []);
            cats.forEach(c => {
                counts[c] = (counts[c] || 0) + 1;
            });
        });

        // Filter out categories with 0 count (safety) and sort by count desc
        let cats = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

        // Limit to most relevant if too many (heuristic for "max 2 lines")
        // Accommodating roughly 12 tags max for 2 lines.
        if (cats.length > 11) {
            cats = cats.slice(0, 11);
        }

        return ['All', ...cats];
    }, [items]);

    // 2. Logic to split categories into up to 2 lines
    const { topRow, bottomRow } = useMemo(() => {
        const total = sortedCategories.length;

        // If few items, keep in one line to avoid forcing a weird stack
        // "One less in upper line" implies we want to bias bottom.
        // Mid floor: 5/2 = 2. Top: 2, Bot: 3.
        // 6/2 = 3. Top: 3, Bot: 3.

        // Threshold: If we have > 4 items, we split to ensure "pyramid" avoidance and visual balance.
        // If <= 4, usually fits on one line unless they are huge words.
        if (total <= 4) {
            return { topRow: sortedCategories, bottomRow: [] };
        }

        const mid = Math.floor(total / 2);
        return {
            topRow: sortedCategories.slice(0, mid),
            bottomRow: sortedCategories.slice(mid)
        };
    }, [sortedCategories]);

    // 3. Filter items based on active category
    const filteredItems = useMemo(() => {
        if (activeTag === 'All') return items;
        return items.filter(item => {
            if (Array.isArray(item.category)) {
                return item.category.includes(activeTag);
            }
            return item.category === activeTag;
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

    return (
        <div className="portfolio-filter-container">
            {/* Filter Bar */}
            <div className="filter-bar">
                {/* Row 1 */}
                <div className="filter-row">
                    {topRow.map(renderButton)}
                </div>
                {/* Row 2 (if exists) */}
                {bottomRow.length > 0 && (
                    <div className="filter-row">
                        {bottomRow.map(renderButton)}
                    </div>
                )}
            </div>

            {/* Grid */}
            <div className="photography-grid">
                {filteredItems.map((item) => (
                    <a href={item.href} className="photography-card" key={item.title}>
                        <div className="image-wrapper">
                            <img src={item.image} alt={item.title} loading="lazy" />
                        </div>
                        <div className="content">
                            <div className="meta">
                                <span className="category">
                                    {Array.isArray(item.category) ? item.category.join(', ') : (item.category || 'Photography')}
                                </span>
                            </div>
                            <h3>{item.title}</h3>
                        </div>
                    </a>
                ))}
            </div>

            <style>{`
        .portfolio-filter-container {
            width: 100%;
        }
        
        /* Filter Container */
        .filter-bar {
            margin-bottom: 3rem;
            padding: 0 1rem;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.5rem; /* Space between rows */
        }
        
        .filter-row {
            display: flex;
            justify-content: center;
            flex-wrap: wrap; 
            gap: 0.6rem; /* Space between buttons */
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
            color: var(--bg-color);
            border-color: var(--text-primary);
        }

        /* Replicating PhotographyCard Styles locally to avoid Astro mapping issues in React */
        .photography-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: var(--space-lg);
        }
        
        .photography-card {
            display: block;
            text-decoration: none;
            color: inherit;
        }

        .image-wrapper {
            width: 100%;
            aspect-ratio: 16/9;
            overflow: hidden;
            border-radius: var(--radius-sm);
            margin-bottom: 1rem;
            background: var(--bg-secondary);
        }

        .image-wrapper img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.5s ease;
        }

        .photography-card:hover .image-wrapper img {
            transform: scale(1.02);
        }

        .meta {
            margin-bottom: 0.5rem;
        }

        .category {
            font-family: var(--font-sans);
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-tertiary);
        }

        h3 {
            font-size: 1.5rem;
            font-weight: 500;
            margin: 0;
            line-height: 1.2;
        }

        @media (max-width: 768px) {
             .filter-row {
                gap: 0.4rem;
             }
        }
      `}</style>
        </div>
    );
};

export default PortfolioFilter;
