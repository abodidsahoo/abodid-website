import { useState, useMemo, useEffect } from 'react';
import {
    getOptimizedImageSrcSet,
    getOptimizedImageUrl,
} from '../lib/imageOptimization.js';

const CORE_CATEGORIES = ['All', 'Art', 'Commercial', 'Exhibition', 'Fashion', 'Street'];

const slugify = (str) =>
    String(str || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

const getItemCategories = (item) => {
    const rawLabels = [
        ...(Array.isArray(item.labels) ? item.labels : (item.labels ? [item.labels] : [])),
        ...(Array.isArray(item.category) ? item.category : (item.category ? [item.category] : [])),
        ...(Array.isArray(item.tags) ? item.tags : (item.tags ? String(item.tags).split(',').map((t) => t.trim()) : [])),
    ].map((l) => String(l || '').toLowerCase());

    const matched = CORE_CATEGORIES.filter((cat) => {
        if (cat === 'All') return false;
        const target = cat.toLowerCase();
        return rawLabels.some((label) => {
            if (target === 'exhibition') return label.includes('exhibit');
            if (target === 'street') return label.includes('street');
            return label.includes(target);
        });
    });

    return matched.length > 0 ? matched : ['Art'];
};

const PortfolioFilter = ({ items = [] }) => {
    const [activeCategory, setActiveCategory] = useState('All');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const paramVal = params.get('category') || params.get('tag');
        if (paramVal) {
            const matched = CORE_CATEGORIES.find(
                (c) => c.toLowerCase() === paramVal.toLowerCase() || slugify(c) === slugify(paramVal)
            );
            if (matched) {
                setActiveCategory(matched);
            }
        }

        const handlePopState = () => {
            const currentParams = new URLSearchParams(window.location.search);
            const currentVal = currentParams.get('category') || currentParams.get('tag');
            const matched = CORE_CATEGORIES.find(
                (c) => c.toLowerCase() === (currentVal || '').toLowerCase() || slugify(c) === slugify(currentVal || '')
            );
            setActiveCategory(matched || 'All');
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const { categoriesWithCounts, itemCategoryMap } = useMemo(() => {
        const itemMap = new Map();
        const counts = { All: items.length };
        CORE_CATEGORIES.forEach((c) => {
            if (c !== 'All') counts[c] = 0;
        });

        items.forEach((item, idx) => {
            const cats = getItemCategories(item);
            itemMap.set(item.slug || item.title || idx, cats);
            cats.forEach((c) => {
                if (counts[c] !== undefined) {
                    counts[c] += 1;
                }
            });
        });

        return {
            categoriesWithCounts: CORE_CATEGORIES.map((cat) => ({
                name: cat,
                count: counts[cat] || 0,
            })),
            itemCategoryMap: itemMap,
        };
    }, [items]);

    const handleCategoryClick = (catName) => {
        const nextCategory = activeCategory.toLowerCase() === catName.toLowerCase() ? 'All' : catName;
        setActiveCategory(nextCategory);
        const params = new URLSearchParams(window.location.search);
        if (nextCategory === 'All') {
            params.delete('category');
            params.delete('tag');
        } else {
            params.set('category', slugify(nextCategory));
            params.delete('tag');
        }
        const query = params.toString();
        const newUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
        window.history.pushState({}, '', newUrl);
    };

    const filteredItems = useMemo(() => {
        if (activeCategory === 'All') return items;
        return items.filter((item, idx) => {
            const cats = itemCategoryMap.get(item.slug || item.title || idx) || [];
            return cats.some((c) => c.toLowerCase() === activeCategory.toLowerCase());
        });
    }, [items, activeCategory, itemCategoryMap]);

    return (
        <section className="press-archive" id="photo-archive" aria-label="Browse photography series">
            {/* Filter by Category */}
            <div className="press-topics" role="group" aria-labelledby="photo-topics-label">
                <h2 id="photo-topics-label" className="press-eyebrow">
                    Filter by category
                </h2>
                <div className="press-topics__options">
                    {categoriesWithCounts.map(({ name, count }) => {
                        const isActive = activeCategory.toLowerCase() === name.toLowerCase();

                        return (
                            <button
                                key={name}
                                type="button"
                                onClick={() => handleCategoryClick(name)}
                                className="press-topic"
                                aria-pressed={isActive}
                                aria-controls="photo-series-list"
                                aria-label={`${name === 'All' ? 'All series' : name}: ${count} ${count === 1 ? 'series' : 'series'}`}
                            >
                                <span>{name}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Results Heading & Meta */}
            <div className="press-results-heading">
                <h2>{activeCategory === 'All' ? 'All Photo Series' : `${activeCategory} Series`}</h2>
                <div className="press-results-heading__meta">
                    <p role="status" aria-live="polite" aria-atomic="true">
                        {filteredItems.length} {filteredItems.length === 1 ? 'series' : 'series'}
                    </p>
                    {activeCategory !== 'All' && (
                        <button
                            type="button"
                            onClick={() => handleCategoryClick('All')}
                            className="press-reset"
                        >
                            Reset filters <span aria-hidden="true">✕</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Photo Series Grid */}
            {filteredItems.length === 0 ? (
                <div className="press-empty">
                    <h3>No photo series found</h3>
                    <p>There are no series tagged under &ldquo;{activeCategory}&rdquo;.</p>
                    <button
                        type="button"
                        onClick={() => handleCategoryClick('All')}
                        className="press-reset"
                        style={{ marginTop: '12px' }}
                    >
                        View all series <span aria-hidden="true">→</span>
                    </button>
                </div>
            ) : (
                <ul className="press-list-grid" id="photo-series-list">
                    {filteredItems.map((item, index) => {
                        const itemCategories = itemCategoryMap.get(item.slug || item.title || index) || ['Art'];
                        const imageCount = item.imageCount || item.images?.length || 0;
                        const primaryCategory = itemCategories[0] || 'Photography';
                        const titleId = `photo-title-${index}`;

                        return (
                            <li key={item.slug || item.title || index}>
                                <article className="press-mention">
                                    <a
                                        href={item.href || `/photography/${item.slug}`}
                                        className="press-mention-card"
                                        aria-labelledby={titleId}
                                    >
                                        <div className="press-card-image">
                                            <img
                                                src={getOptimizedImageUrl(item.image, { width: 1200, quality: 84 })}
                                                srcSet={getOptimizedImageSrcSet(item.image, {
                                                    widths: [480, 720, 960, 1200],
                                                    quality: 84,
                                                })}
                                                sizes="(max-width: 760px) calc(100vw - 48px), (max-width: 1100px) 50vw, 33vw"
                                                alt={item.title}
                                                loading={index < 3 ? 'eager' : 'lazy'}
                                                decoding={index < 3 ? 'sync' : 'async'}
                                            />
                                        </div>

                                        <div className="press-card-copy">
                                            <p className="press-card-publication">
                                                {primaryCategory} // Photo Series
                                            </p>

                                            <div className="press-card-title-row">
                                                <h3 className="press-card-title" id={titleId}>
                                                    <span>{item.title}</span>
                                                </h3>
                                                <span className="press-card-arrow" aria-hidden="true">
                                                    ↗
                                                </span>
                                            </div>

                                            <div className="press-card-footer">
                                                <div className="press-card-categories">
                                                    {itemCategories.slice(0, 2).map((cat) => (
                                                        <span key={cat} className="press-card-tag">
                                                            {cat}
                                                        </span>
                                                    ))}
                                                </div>
                                                {imageCount > 0 && (
                                                    <span className="press-card-date">
                                                        {imageCount} Images
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </a>
                                </article>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
};

export default PortfolioFilter;
