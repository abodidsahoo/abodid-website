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
        
        /* Filter Bar */
        .filter-bar {
            position: sticky;
            top: 20px;
            z-index: 50;
            margin-bottom: 2rem;
            padding: 10px 0;
            background: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid var(--border-subtle);
        }
        
        .filter-scroll {
            display: flex;
            gap: 0.8rem;
            overflow-x: auto;
            padding-bottom: 5px;
            scrollbar-width: none; /* Hide scrollbar Firefox */
        }
        .filter-scroll::-webkit-scrollbar { display: none; } /* Hide Chrome */

        .filter-btn {
            background: none;
            border: none;
            font-size: 0.85rem;
            font-weight: 500;
            color: var(--text-tertiary);
            cursor: pointer;
            padding: 6px 12px;
            border-radius: 100px;
            white-space: nowrap;
            transition: all 0.2s ease;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .filter-btn:hover {
            color: var(--text-primary);
            background: var(--bg-secondary);
        }

        .filter-btn.active {
            color: #fff;
            background: #000;
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
            .filter-bar { top: 70px; } /* Adjust for mobile header */
        }
      `}</style>
        </div>
    );
};

export default PortfolioFilter;
