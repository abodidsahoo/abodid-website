import { useState, useMemo, useRef, useEffect } from 'react';
import {
    getOptimizedImageSrcSet,
    getOptimizedImageUrl,
} from '../lib/imageOptimization.js';

const slugify = (str) =>
    String(str || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

const PortfolioFilter = ({ items }) => {
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
            const cats = Array.isArray(item.category) ? item.category : (item.category ? [item.category] : []);
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

    // 3. Filter items based on active category
    const filteredItems = useMemo(() => {
        if (normalizedActiveTag === 'All') return items;
        const targetSlug = slugify(normalizedActiveTag);
        return items.filter(item => {
            const cats = Array.isArray(item.category) ? item.category : (item.category ? [item.category] : []);
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

    // Global Cursor Logic
    const cursorRef = useRef(null);

    useEffect(() => {
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
                <div className="filter-scroll">
                    {sortedCategories.map(renderButton)}
                </div>
            </div>

            {/* Global Fixed Cursor */}
            <div className="glass-cursor" ref={cursorRef}>
                <div className="cursor-dot"></div>
            </div>

            {/* Grid */}
            <div className="photography-grid">
                {filteredItems.map((item, index) => (
                    <a href={item.href} className="photography-card" key={item.title}>
                        <div
                            className="image-wrapper"
                            onMouseEnter={handleMouseEnter}
                            onMouseLeave={handleMouseLeave}
                        >
                            <img
                                src={getOptimizedImageUrl(item.image, { width: 1600, quality: 82 })}
                                srcSet={getOptimizedImageSrcSet(item.image, {
                                    widths: [800, 1200, 1600, 2000],
                                    quality: 82,
                                })}
                                sizes="(max-width: 599px) calc(100vw - 36px), (max-width: 1024px) 50vw, 1052px"
                                alt={item.title}
                                loading={index === 0 ? 'eager' : 'lazy'}
                                fetchpriority={index === 0 ? 'high' : 'auto'}
                                decoding="async"
                                width="1600"
                                height="900"
                            />
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
            width: 100%;
        }
        
        .filter-scroll {
            display: flex;
            flex-wrap: wrap; /* Default desktop: wrap */
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



        /* Photography Grid */
        .photography-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 5rem 0;
        }
        
        /* Tablet: 2 Columns */
        @media (min-width: 600px) and (max-width: 1024px) {
            .photography-grid {
                grid-template-columns: 1fr 1fr;
                gap: 2rem;
            }
        }

        /* Desktop: Maybe ensure it's not too wide if 1 col? 
           User said "Desktop = current grid as desired", which was 1 col.
           Keeping 1 col default.
        */

        .photography-card {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
            text-decoration: none;
            color: inherit;
            --portfolio-image-scale-hover: 1.018;
            --portfolio-image-zoom-in-duration: 1100ms;
            --portfolio-image-zoom-out-duration: 2400ms;
            --portfolio-image-zoom-in-ease: cubic-bezier(0.22, 1, 0.36, 1);
            --portfolio-image-zoom-out-ease: cubic-bezier(0.16, 1, 0.3, 1);
        }

        .image-wrapper {
            width: 100%;
            aspect-ratio: 16/9;
            overflow: hidden;
            border-radius: var(--radius-sm);
            position: relative;
            background: var(--bg-secondary);
            transition: box-shadow 0.45s ease;
            /* cursor: none; Removed for default cursor */
        }

        .image-wrapper:hover {
             box-shadow: 0 10px 24px rgba(0,0,0,0.12);
        }

        .image-wrapper img {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
            transform: scale(1);
            transform-origin: center center;
            transition-property: transform;
            transition-duration: var(--portfolio-image-zoom-out-duration);
            transition-timing-function: var(--portfolio-image-zoom-out-ease);
            will-change: transform;
            backface-visibility: hidden;
        }

        .photography-card:hover .image-wrapper img {
            transform: scale(var(--portfolio-image-scale-hover));
            transition-duration: var(--portfolio-image-zoom-in-duration);
            transition-timing-function: var(--portfolio-image-zoom-in-ease);
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

        h3.photo-title::after {
            content: '';
            position: absolute;
            left: 0;
            bottom: -6px;
            height: 6px;
            width: 0;
            background-color: #e63946;
            transition: width 0.4s cubic-bezier(0.25, 1, 0.5, 1);
        }

        .photography-card:hover h3.photo-title::after {
            width: 100%;
        }

        @media (max-width: 768px) {
             .photography-grid {
                gap: 3rem 0;
             }
        }

        /* Mobile Filters: Horizontal Scroll */
        @media (max-width: 600px) {
            .filter-scroll {
                flex-wrap: nowrap;
                overflow-x: auto;
                padding-bottom: 0.5rem;
                -webkit-overflow-scrolling: touch;
                scrollbar-width: none;
            }
            .filter-scroll::-webkit-scrollbar {
                display: none;
            }
        }

        @media (prefers-reduced-motion: reduce) {
            .image-wrapper,
            .image-wrapper img,
            h3.photo-title::after {
                transition-duration: 0.01ms !important;
            }

            .photography-card:hover .image-wrapper img {
                transform: scale(1);
            }
        }
      `}</style>
        </div>
    );
};

export default PortfolioFilter;
