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
                            className={`filter-btn ${activeTag === category ? 'contrast-active' : ''}`}
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
                            {/* 1. Image Section */}
                            <div className="post-image-wrapper">
                                {post.image ? (
                                    <img
                                        src={post.image}
                                        alt={post.title}
                                        className="post-image"
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="post-image-placeholder"></div>
                                )}
                            </div>

                            {/* 2. Content Section */}
                            <div className="post-content">
                                <span className="post-date">{post.date}</span>
                                <h3 className="post-title">{post.title}</h3>
                                <div className="post-category">
                                    {post.category && (Array.isArray(post.category) ? post.category[0] : post.category)}
                                </div>
                            </div>

                            {/* 3. Action Section */}
                            <div className="post-action">
                                <span className="view-more">VIEW MORE</span>
                                <span className="arrow">→</span>
                            </div>
                        </a>
                    </li>
                ))}
            </ul>

            <style>{`
        .blog-filter-container { width: 100%; }

        /* Filter Container */
        .filter-bar {
            margin-bottom: 4rem;
            padding: 0 2rem;
            display: flex;
            justify-content: flex-start;
            padding: 0; /* Align with left margin */
        }

        .filter-scroll {
            display: block;
            text-align: left;
            width: 100%;
            max-width: 100%; /* Allow full width */
            overflow-x: auto; /* Horizontal scroll */
            white-space: nowrap; /* Prevent wrapping */
            -webkit-overflow-scrolling: touch; /* Smooth scroll on iOS */
            padding-bottom: 1rem; /* Space for scrollbar if visible */
            scrollbar-width: none; /* Hide scrollbar Firefox */
        }
        
        .filter-scroll::-webkit-scrollbar {
            display: none; /* Hide scrollbar Chrome/Safari */
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



        .blog-list {
            list-style: none;
            padding: 0;
            margin: 0;
            border-top: 1px solid var(--border-subtle);
        }

        .blog-list li {
            border-bottom: 1px solid var(--border-subtle);
        }

        .post-link {
            display: grid;
            grid-template-columns: 280px 1fr 200px; /* Image | Content | Action */
            gap: 4rem;
            padding: 3rem 0;
            text-decoration: none;
            color: var(--text-primary);
            transition: background-color 0.3s ease;
            align-items: center; /* Center vertically */
        }
        
        .post-link:hover {
            /* Create a subtle highlight effect, maybe minimal interaction */
        }

        /* 1. Image */
        .post-image-wrapper {
            width: 280px;
            height: 280px;
            overflow: hidden;
            background: var(--bg-surface);
        }
        
        .post-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.5s ease;
        }
        
        .post-image-placeholder {
            width: 100%;
            height: 100%;
            background: var(--bg-surface);
        }

        .post-link:hover .post-image {
            transform: scale(1.03);
        }

        /* 2. Content */
        .post-content {
            display: flex;
            flex-direction: column;
            justify-content: center;
            height: 100%;
        }

        .post-date {
            font-family: var(--font-mono);
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-primary);
            margin-bottom: 2rem;
            display: block;
        }

        .post-title {
            font-family: var(--font-serif); /* Display font */
            font-size: 2.5rem;
            font-weight: 400;
            line-height: 1.1;
            margin: 0 0 1.5rem 0;
            letter-spacing: -0.02em;
        }

        .post-category {
            font-size: 0.9rem;
            color: var(--text-secondary);
        }

        /* 3. Action */
        .post-action {
            display: flex;
            align-items: center;
            justify-content: flex-end; /* Align to right */
            gap: 1rem;
            font-size: 0.9rem;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            color: var(--text-tertiary); /* Muted initially */
            transition: color 0.3s ease;
        }

        .post-link:hover .post-action {
            color: var(--text-primary); /* Highlight on hover */
        }

        .arrow {
            font-size: 1.2rem;
            transition: transform 0.3s ease;
        }

        .post-link:hover .arrow {
            transform: translateX(5px);
        }


        /* Responsive */
        @media (max-width: 968px) {
             .post-link {
                grid-template-columns: 200px 1fr;
                gap: 2rem;
                padding: 2.5rem 0;
            }
            .post-action {
                grid-column: 2;
                justify-content: flex-start;
                margin-top: 1rem;
            }
            .post-image-wrapper {
                width: 200px;
                height: 200px;
            }
            .post-title {
                font-size: 2rem;
            }
        }

        @media (max-width: 600px) {
            .post-link {
                display: flex;
                flex-direction: column;
                gap: 2rem;
                align-items: flex-start;
                padding: 3rem 0;
            }
            
            .post-image-wrapper {
                width: 100%;
                height: auto;
                aspect-ratio: 1/1;
            }

            .post-content {
                width: 100%;
            }

            .post-title {
                font-size: 1.8rem;
            }

            .post-action {
                width: 100%;
                justify-content: space-between; /* Spread out on mobile */
                border-top: 1px solid var(--border-subtle);
                padding-top: 1rem;
            }
        }
      `}</style>
        </div>
    );
};

export default BlogFilter;
