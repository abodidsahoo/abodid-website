import React, { useState, useMemo } from 'react';

const PortfolioFilter = ({ items }) => {
    const [activeTag, setActiveTag] = useState('All');

    // 1. Extract unique categories from all items
    const allCategories = useMemo(() => {
        const categories = new Set(['All']);
        items.forEach(item => {
            if (item.category) {
                if (Array.isArray(item.category)) {
                    item.category.forEach(c => categories.add(c));
                } else {
                    categories.add(item.category);
                }
            }
        });
        return Array.from(categories);
    }, [items]);

    // 2. Filter items based on active category
    // 2. Filter items based on active category
    const filteredItems = useMemo(() => {
        if (activeTag === 'All') return items;
        return items.filter(item => {
            if (Array.isArray(item.category)) {
                return item.category.includes(activeTag);
            }
            return item.category === activeTag;
        });
    }, [items, activeTag]);

    return (
        <div className="portfolio-filter-container">
            {/* Sticky Filter Bar */}
            <div className="filter-bar">
                <div className="filter-scroll">
                    {allCategories.map(category => (
                        <button
                            key={category}
                            onClick={() => setActiveTag(category)}
                            className={`filter-btn ${activeTag === category ? 'active' : ''}`}
                        >
                            {category}
                        </button>
                    ))}
                </div>
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
            padding: 0 2rem; /* Added padding from sides as requested */
            display: flex;
            justify-content: center;
        }
        
        .filter-scroll {
            display: block; /* Switch to block for text-like flow helpers */
            text-align: center;
            width: 100%;
            max-width: 800px; /* Constrain width to encourage better wrapping */
            text-wrap: balance; /* Try to balance lines */
        }

        .filter-btn {
            display: inline-block; /* Inline-block for flowing */
            margin: 0.5rem 0.3rem; /* Spacing between lines and items */
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
             /* Mobile adjustments if needed */
        }
      `}</style>
        </div>
    );
};

export default PortfolioFilter;
