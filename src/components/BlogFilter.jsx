import React, { useState, useMemo } from 'react';

const BlogFilter = ({ posts }) => { // Changed prop from items to posts for clarity
    const [activeTag, setActiveTag] = useState('All');

    // 1. Extract unique categories
    const allCategories = useMemo(() => {
        const categories = new Set(['All']);
        posts.forEach(post => {
            if (post.category) {
                if (Array.isArray(post.category)) {
                    post.category.forEach(c => categories.add(c));
                } else {
                    categories.add(post.category);
                }
            }
        });
        return Array.from(categories);
    }, [posts]);

    // 2. Filter posts
    const filteredPosts = useMemo(() => {
        if (activeTag === 'All') return posts;
        return posts.filter(post => {
            if (Array.isArray(post.category)) {
                return post.category.includes(activeTag);
            }
            return post.category === activeTag;
        });
    }, [posts, activeTag]);

    return (
        <div className="blog-filter-container">
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

            {/* Blog List Layout */}
            <ul className="blog-list">
                {filteredPosts.map((post) => (
                    <li key={post.title}>
                        <a href={post.href} className="post-link">
                            <span className="post-date">{post.date}</span>
                            <span className="post-title">{post.title}</span>
                            <div className="tags-row">
                                {post.category && (Array.isArray(post.category) ? post.category : [post.category]).slice(0, 3).map(cat => (
                                    <span key={cat} className="mini-tag">{cat}</span>
                                ))}
                            </div>
                        </a>
                    </li>
                ))}
            </ul>

            <style>{`
        .blog-filter-container { width: 100%; }

        /* Filter Container */
        .filter-bar {
            margin-bottom: 3rem;
            padding: 0 2rem;
            display: flex;
            justify-content: center;
        }

        .filter-scroll {
            display: block;
            text-align: center;
            width: 100%;
            max-width: 800px;
            text-wrap: balance;
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

        .blog-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }

        .blog-list li {
            border-bottom: 1px solid var(--border-subtle);
        }

        .post-link {
            display: grid;
            grid-template-columns: 100px 1fr auto; /* Date | Title | Tags */
            gap: 2rem;
            padding: 1.5rem 0;
            text-decoration: none;
            color: var(--text-primary);
            transition: color 0.2s ease;
            align-items: center;
        }

        .post-link:hover { color: var(--text-tertiary); }
        .post-date {
            font-family: var(--font-mono);
            font-size: 0.85rem;
            color: var(--text-tertiary);
        }
        .post-title {
            font-size: 1.1rem;
            font-weight: 400;
        }

        .tags-row {
            display: flex;
            gap: 0.5rem;
        }
        .mini-tag {
            font-size: 0.65rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-tertiary);
            background: var(--bg-secondary);
            padding: 2px 6px;
            border-radius: 4px;
        }

        @media (max-width: 768px) {
            .filter-bar { margin-bottom: 2rem; }
            .post-link {
                grid-template-columns: 1fr;
                gap: 0.5rem;
            }
            .tags-row { opacity: 0.7; }
        }
      `}</style>
        </div>
    );
};

export default BlogFilter;
