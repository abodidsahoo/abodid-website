import React, { useEffect, useState } from 'react';

const Breadcrumbs = () => {
    const [pathSegments, setPathSegments] = useState([]);

    useEffect(() => {
        const path = window.location.pathname;
        if (path === '/') {
            setPathSegments([]);
            return;
        }

        const segments = path.split('/').filter(segment => segment !== '');

        // Map segments to { label, path }
        const breadcrumbs = segments.map((segment, index) => {
            const url = `/${segments.slice(0, index + 1).join('/')}`;

            // Prettify label: "my-project" -> "My Project"
            let label = segment
                .replace(/-/g, ' ')
                .replace(/_/g, ' ')
                // Capitalize first letter of each word
                .replace(/\b\w/g, char => char.toUpperCase());

            const words = label.split(' ');
            if (words.length > 3) {
                label = words.slice(0, 3).join(' ') + '...';
            }

            return { label, url };
        });

        // Add Home? Usually breadcrumbs start with Home.
        // Prompt says: "It shows from home."
        setPathSegments([{ label: 'Home', url: '/' }, ...breadcrumbs]);
    }, []);

    if (pathSegments.length === 0) return null;

    return (
        <nav aria-label="Breadcrumb" className="breadcrumbs-nav">
            <ol className="breadcrumb-list">
                {pathSegments.map((item, index) => {
                    const isLast = index === pathSegments.length - 1;

                    return (
                        <li key={item.url} className="breadcrumb-item">
                            {index > 0 && <span className="separator">/</span>}
                            {isLast ? (
                                <span className="current-page" aria-current="page">
                                    {item.label}
                                </span>
                            ) : (
                                <a href={item.url} className="breadcrumb-link">
                                    {item.label}
                                </a>
                            )}
                        </li>
                    );
                })}
            </ol>
            <style>{`
                .breadcrumbs-nav {
                    display: flex;
                    align-items: center;
                }
                .breadcrumb-list {
                    display: flex;
                    align-items: center;
                    list-style: none;
                    margin: 0;
                    padding: 0;
                    gap: 8px;
                    font-family: 'Space Mono', monospace;
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: inherit; /* Adapt to theme */
                }
                .breadcrumb-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: inherit;
                    opacity: 0.5; /* Dimmed for inactive */
                    transition: opacity 0.2s ease;
                }
                .breadcrumb-item:hover {
                    opacity: 1;
                }
                .separator {
                    opacity: 0.3;
                }
                .breadcrumb-link {
                    color: inherit;
                    text-decoration: none;
                }
                .current-page {
                    opacity: 1; /* Full visibility for active */
                    font-weight: 700;
                }

                @media (max-width: 768px) {
                    .breadcrumbs-nav {
                        width: 100%;
                        margin-top: 0.5rem;
                        margin-bottom: 2rem; /* Clean spacing below before content */
                        display: block; /* Allow full width block */
                    }
                    .breadcrumb-list {
                        font-size: 0.7rem;
                        justify-content: flex-start; /* Align left */
                        flex-wrap: wrap; /* allow wrap if very deep */
                    }
                }
            `}</style>
        </nav>
    );
};

export default Breadcrumbs;
