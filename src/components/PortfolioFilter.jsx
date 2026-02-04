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

    // Global Cursor Logic
    const cursorRef = React.useRef(null);

    React.useEffect(() => {
        const moveCursor = (e) => {
            if (cursorRef.current) {
                const x = e.clientX;
                const y = e.clientY;
                cursorRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
            }
        };

        window.addEventListener('mousemove', moveCursor);
        return () => window.removeEventListener('mousemove', moveCursor);
    }, []);

    const handleMouseEnter = () => {
        if (!cursorRef.current) return;
        cursorRef.current.style.opacity = '1';
        cursorRef.current.style.scale = '1';
    };

    const handleMouseLeave = () => {
        if (!cursorRef.current) return;
        cursorRef.current.style.opacity = '0';
        cursorRef.current.style.scale = '0.5';
    };

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

            {/* Global Fixed Cursor */}
            <div className="glass-cursor" ref={cursorRef}>
                <div className="cursor-dot"></div>
            </div>

            {/* Grid */}
            <div className="photography-grid">
                {filteredItems.map((item) => (
                    <a href={item.href} className="photography-card" key={item.title}>
                        <div
                            className="image-wrapper"
                            onMouseEnter={handleMouseEnter}
                            onMouseLeave={handleMouseLeave}
                        >
                            <img src={item.image} alt={item.title} loading="lazy" />
                        </div>
                        <div className="content">
                            <div className="categories">
                                {Array.isArray(item.category)
                                    ? item.category.map(cat => <span key={cat} className="category-tag">{cat}</span>)
                                    : <span className="category-tag">{item.category || 'Photography'}</span>
                                }
                            </div>
                            <h3 className="photo-title">{item.title}</h3>
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
            padding: 0;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem; /* Space between rows */
        }
        
        .filter-row {
            display: flex;
            justify-content: flex-start;
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
            color: #000000;
            border-color: var(--text-primary);
        }

        /* Replicating PhotographyCard Styles locally to avoid Astro mapping issues in React */
        .photography-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 5rem 0;
        }
        
        .photography-card {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
            text-decoration: none;
            color: inherit;
        }

        .image-wrapper {
            width: 100%;
            aspect-ratio: 16/9;
            overflow: hidden;
            border-radius: var(--radius-sm);
            position: relative;
            background: var(--bg-secondary);
            transition: transform 0.4s ease, box-shadow 0.4s ease;
            cursor: none; /* Hide default cursor */
        }

        .image-wrapper:hover {
             transform: translateY(-4px);
             box-shadow: 0 12px 30px rgba(0,0,0,0.15);
        }

        .image-wrapper img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.6s ease;
        }

        .photography-card:hover .image-wrapper img {
            transform: scale(1.05);
        }

        /* GLOBAL Glass Cursor */
        .glass-cursor {
            position: fixed; /* Fixed to viewport, independent of scroll */
            top: 0; 
            left: 0;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            border: 1px solid rgba(255, 255, 255, 0.25);
            pointer-events: none;
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            
            /* Initial State */
            opacity: 0;
            transform: scale(0.5);
            /* NO TRANSITIONS - Instant switch to mimic native cursor */
            /* transition: opacity 0.2s ease, scale 0.2s ease; */
        }

        .cursor-dot {
            width: 6px;
            height: 6px;
            background: white;
            border-radius: 50%;
            box-shadow: 0 0 4px rgba(0,0,0,0.2);
        }

        .content {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        .categories {
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

        h3.photo-title {
            font-family: var(--font-serif);
            font-size: 1.75rem;
            font-weight: 500;
            color: var(--text-primary);
            margin: 0;
            line-height: 1.2;
            position: relative;
            display: inline-block;
            width: fit-content;
        }

        /* Dynamic Red Underline Animation */
        h3.photo-title::after {
            content: '';
            position: absolute;
            left: 0;
            bottom: -6px; /* Space below text */
            height: 6px; /* Thickness */
            width: 0;
            background-color: #e63946; /* Vibrant red */
            transition: width 0.4s cubic-bezier(0.25, 1, 0.5, 1); /* Fast out, slow ease */
        }

        .photography-card:hover h3.photo-title::after {
            width: 100%;
        }

        @media (max-width: 768px) {
             .photography-grid {
                gap: 3rem 0;
             }
             .filter-row {
                gap: 0.4rem;
             }
             /* Disable custom cursor on touch devices */
             .glass-cursor {
                display: none;
             }
             .image-wrapper {
                cursor: default;
             }
        }
      `}</style>
        </div>
    );
};

export default PortfolioFilter;
