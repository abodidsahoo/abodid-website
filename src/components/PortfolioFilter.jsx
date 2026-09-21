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
    // Initial state is deterministic across SSR and Client initial render
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

    // 1. Calculate counts for the 5-6 core categories
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

    // 2. Filter items based on active core category
    const filteredItems = useMemo(() => {
        if (activeCategory === 'All') return items;
        return items.filter((item, idx) => {
            const cats = itemCategoryMap.get(item.slug || item.title || idx) || [];
            return cats.some((c) => c.toLowerCase() === activeCategory.toLowerCase());
        });
    }, [items, activeCategory, itemCategoryMap]);

    return (
        <div className="pe-photography-archive" id="archive-grid">
            {/* Pop Editorial Category Filter Toolbar */}
            <div className="pe-filter-bar">
                <div className="pe-filter-bar__top">
                    <p className="pe-filter-eyebrow">
                        <span>Filter by Category</span>
                    </p>
                </div>
                <div className="pe-filter-scroll" role="toolbar" aria-label="Filter photography by category">
                    {categoriesWithCounts.map(({ name, count }) => {
                        const isActive = activeCategory.toLowerCase() === name.toLowerCase();

                        return (
                            <button
                                key={name}
                                type="button"
                                onClick={() => handleCategoryClick(name)}
                                className={`pe-filter-pill ${isActive ? 'is-active' : ''}`}
                                aria-pressed={isActive}
                            >
                                <span className="pe-filter-pill__label">{name}</span>
                                <span className="pe-filter-pill__count">{String(count).padStart(2, '0')}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Asymmetric Pop Editorial Photography Grid */}
            {filteredItems.length === 0 ? (
                <div className="pe-empty-state">
                    <p className="pe-empty-state__title">No photo essays found</p>
                    <p className="pe-empty-state__desc">
                        There are no series tagged under &ldquo;{activeCategory}&rdquo;.
                    </p>
                    <button
                        type="button"
                        onClick={() => handleCategoryClick('All')}
                        className="pe-reset-btn"
                    >
                        <span>View all series</span>
                        <b aria-hidden="true">→</b>
                    </button>
                </div>
            ) : (
                <div className="pe-photo-grid">
                    {filteredItems.map((item, index) => {
                        const paletteIndex = index % 7;
                        const itemCategories = itemCategoryMap.get(item.slug || item.title || index) || ['Art'];

                        return (
                            <a
                                key={item.slug || item.title || index}
                                href={item.href || `/photography/${item.slug}`}
                                className={`pe-photo-card pe-photo-card--${(index % 8) + 1}`}
                                data-palette={paletteIndex}
                            >
                                <figure className="pe-photo-card__media">
                                    <img
                                        src={getOptimizedImageUrl(item.image, { width: 1400, quality: 84 })}
                                        srcSet={getOptimizedImageSrcSet(item.image, {
                                            widths: [600, 960, 1400, 1800],
                                            quality: 84,
                                        })}
                                        sizes="(max-width: 720px) calc(100vw - 72px), (max-width: 980px) 50vw, 840px"
                                        alt={item.title}
                                        loading={index < 2 ? 'eager' : 'lazy'}
                                        decoding={index < 2 ? 'sync' : 'async'}
                                        width="1400"
                                        height="900"
                                    />
                                </figure>

                                <div className="pe-photo-card__body">
                                    <div className="pe-photo-card__meta">
                                        <div className="pe-photo-card__tags">
                                            {itemCategories.slice(0, 2).map((cat) => (
                                                <span key={cat} className="pe-meta-tag">
                                                    {cat}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <h3 className="pe-photo-card__title">{item.title}</h3>

                                    <div className="pe-photo-card__cta">
                                        <span className="pe-photo-card__cta-label">Explore series</span>
                                        <b className="link-destination-arrow" aria-hidden="true">
                                            ↗
                                        </b>
                                    </div>
                                </div>
                            </a>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default PortfolioFilter;
