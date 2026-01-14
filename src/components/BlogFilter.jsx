import React, { useState, useMemo } from 'react';

const BlogFilter = ({ posts }) => { // Changed prop from items to posts for clarity
    const [activeTag, setActiveTag] = useState('All');

    // 1. Extract unique tags
    const allTags = useMemo(() => {
        const tags = new Set(['All']);
        posts.forEach(post => {
            if (post.tags && Array.isArray(post.tags)) {
                post.tags.forEach(tag => tags.add(tag));
            }
        });
        return Array.from(tags);
    }, [posts]);

    // 2. Filter posts
    const filteredPosts = useMemo(() => {
        if (activeTag === 'All') return posts;
        return posts.filter(post => post.tags && post.tags.includes(activeTag));
    }, [posts, activeTag]);

    return (
        <div className="blog-filter-container">
            {/* Sticky Filter Bar */}
            <div className="filter-bar">
                <div className="filter-scroll">
                    {allTags.map(tag => (
                        <button
                            key={tag}
                            onClick={() => setActiveTag(tag)}
                            className={`filter-btn ${activeTag === tag ? 'active' : ''}`}
                        >
                            {tag}
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
                                {post.tags && post.tags.slice(0, 3).map(tag => (
                                    <span key={tag} className="mini-tag">{tag}</span>
                                ))}
                            </div>
                        </a>
                    </li>
                ))}
            </ul>

            <style>{`
        .blog-filter-container { width: 100%; }

        .filter-bar {
            position: sticky;
            top: 20px;
            z-index: 50;
            margin-bottom: 2rem;
            padding: 10px 0;
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid var(--border-subtle);
        }

        .filter-scroll {
            display: flex;
            gap: 0.8rem;
            overflow-x: auto;
            padding-bottom: 5px;
            scrollbar-width: none;
        }
        .filter-scroll::-webkit-scrollbar { display: none; }

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
        .filter-btn:hover { color: var(--text-primary); background: var(--bg-secondary); }
        .filter-btn.active { color: #fff; background: #000; }

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
