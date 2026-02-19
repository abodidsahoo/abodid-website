import React, { useState, useEffect } from 'react';

interface Props {
    initialQuery?: string;
    initialAudience?: string;
    initialTags?: string[];
    availableTags: { id: string; name: string }[];
}

export default function FilterBar({ initialQuery = '', initialAudience = '', availableTags = [] }: Props) {
    const [query, setQuery] = useState(initialQuery);
    const [audience, setAudience] = useState(initialAudience);
    // Debounce query
    useEffect(() => {
        const timer = setTimeout(() => {
            // Create new URLSearchParams
            const params = new URLSearchParams(window.location.search);

            if (query) params.set('q', query);
            else params.delete('q');

            if (audience) params.set('audience', audience);
            else params.delete('audience');

            // Update URL and reload (SSR nature)
            // For smoother UX, we'd use client-side fetching + state, 
            // but Astro SSR simplest path is navigation.
            // To prevent typing lag, we only nav on blur or debounce 500ms
            if (query !== initialQuery || audience !== initialAudience) {
                window.location.search = params.toString();
            }
        }, 800);

        return () => clearTimeout(timer);
    }, [query, audience]);

    // Audience Options
    const audiences = ['Designer', 'Artist', 'Filmmaker', 'Creative Technologist'];

    return (
        <div className="filter-bar-container">
            {/* Search Input */}
            <div className="search-wrapper">
                <input
                    type="text"
                    className="search-input"
                    placeholder="Search resources..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </div>

            {/* Audience Filters */}
            <div className="audience-filters">
                <button
                    className={`filter-chip ${audience === '' ? 'active' : ''}`}
                    onClick={() => setAudience('')}
                    style={audience === '' ? { color: '#ffffff', borderColor: '#000000', backgroundColor: '#000000' } : {}}
                >
                    All
                </button>
                {audiences.map(aud => (
                    <button
                        key={aud}
                        className={`filter-chip ${audience === aud ? 'active' : ''}`}
                        onClick={() => setAudience(aud === audience ? '' : aud)}
                        style={audience === aud ? { color: '#ffffff', borderColor: '#000000', backgroundColor: '#000000' } : {}}
                    >
                        {aud}
                    </button>
                ))}
            </div>

            <style>{`
        .filter-bar-container {
            display: flex;
            flex-direction: column;
            gap: 16px;
            margin-bottom: 32px;
        }

        .search-wrapper {
            position: relative;
            width: 100%;
        }

        .search-input {
            width: 100%;
            padding: 12px 16px 12px 48px;
            border-radius: 100px;
            border: 1px solid var(--border-subtle);
            background: var(--bg-surface);
            color: var(--text-primary);
            font-size: 16px;
            transition: all 0.2s ease;
        }

        .search-input:focus {
            outline: none;
            border-color: var(--text-primary);
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }

        .search-icon {
            position: absolute;
            left: 16px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-tertiary);
            pointer-events: none;
        }

        .audience-filters {
            display: flex;
            gap: 8px;
            overflow-x: auto;
            padding-bottom: 4px; /* for scrollbar */
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
        
        .audience-filters::-webkit-scrollbar {
            display: none;
        }

        .filter-chip {
            padding: 6px 16px;
            border-radius: 100px;
            background: var(--bg-surface);
            border: 1px solid var(--border-subtle);
            color: var(--text-secondary);
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            white-space: nowrap;
            transition: all 0.2s ease;
        }

        .filter-chip:hover {
            border-color: var(--text-secondary);
        }

        .filter-chip.active {
            background: var(--chip-active-bg);
            color: var(--chip-active-text);
            border-color: var(--chip-active-bg);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transform: scale(1.05);
        }

        /* FORCE VISIBILITY IN LIGHT MODE - Strict Override */
        html[data-theme="light"] .audience-filters .filter-chip.active,
        body[data-theme="light"] .audience-filters .filter-chip.active,
        .filter-chip.active {
            /* Active State Always High Contrast */
            color: #ffffff !important; 
            --chip-active-text: #ffffff !important;
        }

        /* Specific Light Mode Black Background / White Text Override */
        html[data-theme="light"] .filter-chip.active {
             background-color: #000000 !important;
             color: #ffffff !important; 
             border-color: #000000 !important;
        }

        @media (min-width: 768px) {
             .filter-bar-container {
                flex-direction: row;
                align-items: center;
                justify-content: space-between;
             }
             .search-wrapper {
                 max-width: 400px;
             }
        }
      `}</style>
        </div>
    );
}
