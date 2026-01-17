import React, { useState, useMemo } from 'react';

const PressFilter = ({ items }) => {
    const [activeTag, setActiveTag] = useState('All');

    // 1. Extract unique categories (e.g. Press, Work, Collaboration)
    const allCategories = useMemo(() => {
        const categories = new Set(['All']);
        items.forEach(item => {
            if (item.categories) {
                if (Array.isArray(item.categories)) {
                    item.categories.forEach(c => categories.add(c));
                } else {
                    categories.add(item.categories);
                }
            }
        });
        return Array.from(categories);
    }, [items]);

    // 2. Filter items
    const filteredItems = useMemo(() => {
        if (activeTag === 'All') return items;
        return items.filter(item => {
            if (Array.isArray(item.categories)) {
                return item.categories.includes(activeTag);
            }
            return item.categories === activeTag;
        });
    }, [items, activeTag]);

    return (
        <div className="press-filter-container">
            {/* Filter Bar */}
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

            {/* List Layout */}
            <ul className="mentions-list">
                {filteredItems.map((item, index) => (
                    <li key={`${item.title}-${index}`}>
                        <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mention-card"
                        >
                            {/* 1. Image Section */}
                            <div className="mention-image-wrapper">
                                {item.image ? (
                                    <img
                                        src={item.image}
                                        alt={item.title}
                                        className="mention-image"
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="mention-image-placeholder"></div>
                                )}
                            </div>

                            {/* 2. Content Section */}
                            <div className="mention-content">
                                <span className="mention-date">{item.date}</span>
                                <h3 className="mention-title">{item.title}</h3>
                                <div className="mention-meta">
                                    <span className="publication">{item.publication}</span>
                                    {item.categories && item.categories.length > 0 && (
                                        <span className="categories"> • {item.categories.join(', ')}</span>
                                    )}
                                </div>
                            </div>

                            {/* 3. Action Section */}
                            <div className="mention-action">
                                <span>READ ARTICLE</span>
                                <span className="arrow">↗</span>
                            </div>
                        </a>
                    </li>
                ))}
            </ul>

            <style>{`
        .press-filter-container { width: 100%; }

        /* Filter Bar */
        .filter-bar {
            margin-bottom: 4rem;
            padding: 0 2rem;
            display: flex;
            justify-content: flex-start;
        }

        .filter-scroll {
            display: block;
            text-align: left;
            width: 100%;
            max-width: 800px;
        }

        .filter-btn {
            display: inline-block;
            margin: 0.5rem 0.3rem;
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

        /* List Layout */
        .mentions-list {
            list-style: none;
            padding: 0;
            margin: 0;
            border-top: 1px solid var(--border-subtle);
        }

        .mentions-list li {
            border-bottom: 1px solid var(--border-subtle);
        }

        .mention-card {
            display: grid;
            grid-template-columns: 280px 1fr 200px; /* Matching Blog Grid */
            gap: 3rem;
            padding: 3rem 0;
            text-decoration: none;
            color: inherit;
            align-items: center;
            transition: background-color 0.2s ease;
        }

        .mention-card:hover .mention-image {
            transform: scale(1.03);
        }
        
        .mention-card:hover .mention-action {
            color: var(--text-primary);
        }

        /* Image Section */
        .mention-image-wrapper {
            width: 280px;
            height: 200px; 
            overflow: hidden;
            background-color: var(--bg-surface);
            border-radius: 4px;
        }

        .mention-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.5s ease;
        }

        .mention-image-placeholder {
            width: 100%;
            height: 100%;
            background-color: var(--bg-surface);
        }

        /* Content Section */
        .mention-content {
            display: flex;
            flex-direction: column;
            justify-content: center;
        }

        .mention-date {
            font-family: var(--font-mono);
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-tertiary);
            margin-bottom: 1rem;
        }

        .mention-title {
            font-family: var(--font-serif);
            font-size: 2rem;
            font-weight: 400;
            line-height: 1.2;
            margin: 0 0 1rem 0;
            color: var(--text-primary);
        }

        .mention-meta {
            font-family: var(--font-sans);
            font-size: 0.9rem;
            color: var(--text-secondary);
        }

        .publication {
            font-weight: 600;
            color: var(--text-primary);
        }

        /* Action Section */
        .mention-action {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 0.5rem;
            font-family: var(--font-mono);
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-tertiary); /* Faded by default */
            transition: color 0.3s ease;
        }

        /* Responsive */
        @media (max-width: 968px) {
            .mention-card {
            grid-template-columns: 200px 1fr auto;
            gap: 2rem;
            }
            .mention-image-wrapper {
                width: 200px;
                height: 150px;
            }
            .mention-title {
                font-size: 1.5rem;
            }
            .mention-action {
                display: none; /* Hide on tablet, link handles it */
            }
        }

        @media (max-width: 600px) {
            .mention-card {
            grid-template-columns: 1fr;
            gap: 1.5rem;
            padding: 2rem 0;
            }
            .mention-image-wrapper {
            width: 100%;
            height: 200px;
            }
            .mention-content {
                display: block;
            }
            .mention-action {
                display: flex; /* Show at bottom on mobile if desired, or keep hidden */
                justify-content: flex-start;
                margin-top: 1rem;
            }
        }
      `}</style>
        </div>
    );
};

export default PressFilter;
