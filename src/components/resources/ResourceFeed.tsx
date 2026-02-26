import React, { useState, useEffect, useMemo } from 'react';
import type { HubResource } from '../../lib/resources/types';
import { getApprovedResources } from '../../lib/resources/db';

// --- Re-implementing Resource Card (React) ---
const ReactResourceCard = ({
    resource
}: {
    resource: HubResource;
}) => {
    const getAudienceColor = (audience: string | null) => {
        switch (audience) {
            case 'Designer': return '#c084fc';
            case 'Artist': return '#f472b6';
            case 'Filmmaker': return '#60a5fa';
            case 'Creative Technologist': return '#4ade80';
            case 'Researcher': return '#fbbf24';
            case 'General Audience': return '#94a3b8';
            default: return '#9ca3af';
        }
    };
    const accentColor = getAudienceColor(resource.audience);

    const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty('--cursor-x', `${e.clientX - rect.left}px`);
        e.currentTarget.style.setProperty('--cursor-y', `${e.clientY - rect.top}px`);
    };

    return (
        <a
            href={`/resources/${resource.id}`}
            className="resource-card-react"
            style={{ '--accent-color': accentColor } as any}
            onMouseMove={handleMouseMove}
        >
            {/* Thumbnail - Clean, no overlay */}
            <div className="thumbnail-container">
                {resource.thumbnail_url ? (
                    <img src={resource.thumbnail_url} alt={resource.title || 'Resource'} className="thumbnail" loading="lazy" />
                ) : (
                    <div className="thumbnail-placeholder">🔗</div>
                )}
            </div>

            <div className="content">
                <h3 className="title">{resource.title}</h3>

                {resource.description && <p className="description">{resource.description}</p>}

                <div className="meta">
                    <div className="tags">
                        {resource.tags?.slice(0, 3).map((t, idx) => (
                            t && <span key={t.id || `tag-${idx}`} className="tag">{t.name}</span>
                        ))}
                    </div>

                </div>
            </div>

            <span className="hover-cue" aria-hidden="true">👆 Click to view details</span>
        </a>
    );
};

// --- Main Feed Component ---

interface Props {
    initialResources: HubResource[];
    availableTags?: { id: string; name: string }[];
    showSearch?: boolean;
}

export default function ResourceFeed({ initialResources, showSearch = true }: Props) {
    // Store ALL resources for client-side filtering
    const [allResources, setAllResources] = useState<HubResource[]>(initialResources);

    const [query, setQuery] = useState('');
    const [audience, setAudience] = useState('');

    // Fetch fresh data on mount to catch updates
    useEffect(() => {
        const fetchFresh = async () => {
            try {
                // Using the requested auto-refresh logic
                const freshData = await getApprovedResources();
                if (freshData && freshData.length > 0) {
                    setAllResources(freshData);
                }
            } catch (e) {
                console.error("Failed to refresh feed:", e);
            }
        };
        fetchFresh();
    }, []);

    // Client-Side Filter Logic (Instant)
    const filteredResources = useMemo(() => {
        let result = allResources;

        // 1. Filter by Audience
        if (audience) {
            result = result.filter(r => r.audience === audience);
        }

        // 2. Filter by Query (Simple text match on Title/Desc/Tags)
        if (query.trim()) {
            const q = query.toLowerCase();
            result = result.filter(r =>
                r.title.toLowerCase().includes(q) ||
                (r.description && r.description.toLowerCase().includes(q)) ||
                (r.tags && r.tags.some(t => t.name.toLowerCase().includes(q)))
            );
        }

        return result;
    }, [allResources, query, audience]);

    const audiences = [
        'General Audience',
        'Designer',
        'Artist',
        'Filmmaker',
        'Creative Technologist',
        'Researcher'
    ];

    return (
        <div className="feed-container" suppressHydrationWarning={true}>

            {/* Big Search Header */}
            {showSearch && (
                <>
                    <div className="filter-header">
                        <div className="search-wrapper-large">
                            <svg className="search-icon-large" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <input
                                type="text"
                                className="search-input-large"
                                placeholder="Search for tools, inspiration, articles..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                autoFocus={false}
                            />
                        </div>
                        <a href="/resources/submit" className="submit-to-hub-btn">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            Submit new resource
                        </a>
                    </div>

                    {/* Audience Filters */}
                    <div className="audience-section">
                        <div className="audience-label">Find resources relevant for:</div>
                        <div className="audience-filters">
                            <button
                                className={`filter-chip ${audience === '' ? 'active' : ''}`}
                                onClick={() => setAudience('')}
                            >
                                Everyone
                            </button>
                            {audiences.map(aud => (
                                <button
                                    key={aud}
                                    className={`filter-chip ${audience === aud ? 'active' : ''}`}
                                    onClick={() => setAudience(aud === audience ? '' : aud)}
                                >
                                    {aud}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* Resources Grid */}
            <div className="resource-grid">
                {filteredResources.map(res => (
                    <div key={res.id} style={{ height: '100%', animation: 'fadeIn 0.3s ease' }}>
                        <ReactResourceCard resource={res} />
                    </div>
                ))}
            </div>

            {filteredResources.length === 0 && (
                <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-secondary)' }}>
                    <p style={{ fontSize: '1.2rem', marginBottom: '8px' }}>No matches found.</p>
                    <button
                        onClick={() => { setQuery(''); setAudience(''); }}
                        style={{ background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', color: 'inherit' }}
                    >
                        Clear Filters
                    </button>
                </div>
            )}

            <style>{`
            .feed-container {
                display: flex;
                flex-direction: column;
                gap: 32px;
            }

            /* Large Search */
            .filter-header {
                width: 100%;
                display: flex;
                gap: 16px;
                align-items: center;
                flex-wrap: wrap;
            }

            .search-wrapper-large {
                position: relative;
                flex: 1;
                min-width: 300px;
                max-width: 600px;
            }

            .search-input-large {
                width: 100%;
                padding: 16px 24px 16px 60px;
                border-radius: 12px;
                border: 1px solid var(--border-subtle);
                background: var(--bg-surface);
                color: var(--text-primary);
                font-size: 1.1rem;
                font-family: inherit;
                box-shadow: 0 4px 12px rgba(0,0,0,0.03);
                transition: all 0.2s ease;
            }

            .search-input-large:focus {
                outline: none;
                border-color: var(--text-primary);
                box-shadow: 0 8px 24px rgba(0,0,0,0.08);
            }

            .search-icon-large {
                position: absolute;
                left: 24px;
                top: 50%;
                transform: translateY(-50%);
                color: var(--text-tertiary);
                pointer-events: none;
                opacity: 0.7;
            }

            .submit-to-hub-btn {
                display: inline-flex;
                align-items: center;
                gap: 10px;
                padding: 16px 32px;
                border-radius: 12px;
                background: var(--btn-primary-bg);
                color: var(--btn-primary-text);
                font-size: 1.05rem;
                font-weight: 600;
                text-decoration: none;
                white-space: nowrap;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                transition: all 0.2s ease;
                border: 1px solid var(--btn-primary-bg);
            }

            a.submit-to-hub-btn:link,
            a.submit-to-hub-btn:visited,
            a.submit-to-hub-btn:hover,
            a.submit-to-hub-btn:focus-visible {
                color: #ffffff;
                text-decoration: none;
                -webkit-text-fill-color: #ffffff;
            }

            a.submit-to-hub-btn:hover,
            a.submit-to-hub-btn:focus-visible {
                transform: translateY(-1px);
                background: color-mix(in srgb, var(--btn-primary-bg) 88%, black);
                border-color: color-mix(in srgb, var(--btn-primary-bg) 88%, black);
                color: #ffffff;
                box-shadow: 0 6px 16px rgba(0,0,0,0.15);
            }

            .submit-to-hub-btn svg {
                flex-shrink: 0;
            }

            /* Audience Section */
            .audience-section {
                text-align: left; /* Left align label */
            }

            .audience-label {
                font-size: 13px;
                color: var(--text-secondary);
                margin-bottom: 12px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                font-weight: 600;
            }
            
            .audience-filters {
                display: flex;
                flex-wrap: wrap;
                justify-content: flex-start; /* Left align chips */
                gap: 12px;
            }

            .filter-chip {
                padding: 8px 20px;
                border-radius: 100px;
                background: transparent;
                border: 1px solid var(--border-subtle);
                color: var(--text-secondary);
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
            }

            .filter-chip:hover {
                background: var(--bg-surface-hover);
                transform: translateY(-2px);
            }

            .filter-chip.active {
                background: var(--chip-active-bg);
                color: var(--chip-active-text);
                border-color: var(--chip-active-bg);
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                transform: scale(1.05);
            }

            /* Grid Animation */
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }

            .resource-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                gap: 24px;
                margin-top: 16px;
            }

            /* Styles reused from Card */
            .resource-card-react {
                display: flex;
                flex-direction: column;
                background: var(--bg-surface);
                border: 1px solid var(--border-subtle);
                border-radius: 12px;
                overflow: hidden;
                height: 100%;
                transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
                text-decoration: none;
                position: relative;
                border-left: 4px solid var(--accent-color);
                cursor: pointer;
            }

            .resource-card-react:hover {
                transform: translateY(-4px);
                box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
                border-color: var(--border-strong);
            }

            .thumbnail-container {
                aspect-ratio: 16/9;
                position: relative;
                background: var(--bg-surface-hover);
                overflow: hidden;
                border-bottom: 1px solid var(--border-subtle);
            }

            .thumbnail {
                width: 100%;
                height: 100%;
                object-fit: cover;
                transition: transform 0.5s ease, filter 0.5s ease, opacity 0.5s ease;
                filter: grayscale(0.8) opacity(0.8);
            }

             .resource-card-react:hover .thumbnail {
                transform: scale(1.05);
                filter: grayscale(0) opacity(1);
            }

            .thumbnail-placeholder {
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 2rem;
                opacity: 0.3;
            }
            .content {
                padding: 16px;
                display: flex;
                flex-direction: column;
                flex-grow: 1;
            }

            .header-row {
                display: flex;
                align-items: baseline;
                gap: 8px;
                margin-bottom: 8px;
            }

            .audience-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background-color: var(--accent-color);
                flex-shrink: 0;
            }

            .title {
                font-size: 16px;
                font-weight: 700;
                color: var(--text-primary);
                margin: 0 0 8px 0;
                line-height: 1.4;
                /* Two-line support with fixed height */
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
                min-height: 44px; /* Ensures consistent card height */
            }

            .description {
                font-size: 14px;
                color: var(--text-secondary);
                margin-bottom: 16px;
                line-height: 1.5;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }

            .meta {
                margin-top: auto;
            }

            .tags {
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
            }

            .tag {
                font-size: 11px;
                color: var(--text-secondary);
                background: var(--bg-surface-hover);
                padding: 2px 8px;
                border-radius: 4px;
                border: 1px solid var(--border-subtle);
                font-weight: 500;
            }

            .resource-card-react:hover .title {
                color: var(--accent-color);
            }

            .hover-cue {
                position: absolute;
                left: var(--cursor-x, 50%);
                top: var(--cursor-y, 50%);
                transform: translate(14px, -18px) scale(0.95);
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.15s ease, transform 0.15s ease;
                background: rgba(17, 24, 39, 0.9);
                color: #f9fafb;
                border: 1px solid rgba(255, 255, 255, 0.25);
                border-radius: 999px;
                padding: 6px 10px;
                font-size: 11px;
                font-weight: 600;
                letter-spacing: 0.01em;
                white-space: nowrap;
                z-index: 4;
            }

            .resource-card-react:hover .hover-cue {
                opacity: 1;
                transform: translate(14px, -18px) scale(1);
            }

            @media (hover: none), (pointer: coarse) {
                .hover-cue {
                    display: none;
                }
            }

        `}</style>
        </div>
    );
}
