import React, { useState, useEffect, useMemo } from 'react';
import type { HubResource, ResourceAudience } from '../../lib/resources/types';
import { toggleBookmark, toggleUpvote, getMyBookmarks, getMyUpvotes } from '../../lib/resources/db';
import { supabase } from '../../lib/supabaseClient'; // Need to check auth state

// --- Re-implementing Resource Card (React) ---
const ReactResourceCard = ({
    resource,
    isBookmarked,
    isUpvoted,
    onToggleBookmark,
    onToggleUpvote
}: {
    resource: HubResource;
    isBookmarked: boolean;
    isUpvoted: boolean;
    onToggleBookmark: () => void;
    onToggleUpvote: () => void;
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

    return (
        <div
            className="resource-card-react"
            style={{ '--accent-color': accentColor } as any}
        >
            {/* Thumbnail - Clean, no overlay */}
            <a href={`/resources/${resource.id}`} className="card-link-wrapper">
                <div className="thumbnail-container">
                    {resource.thumbnail_url ? (
                        <img src={resource.thumbnail_url} alt={resource.title || 'Resource'} className="thumbnail" loading="lazy" />
                    ) : (
                        <div className="thumbnail-placeholder">🔗</div>
                    )}
                </div>
            </a>

            <div className="content">
                {/* Title - Bold, clean, NO dot */}
                <a href={`/resources/${resource.id}`} className="title-link">
                    <h3 className="title">{resource.title}</h3>
                </a>

                {resource.description && <p className="description">{resource.description}</p>}

                <div className="meta">
                    <div className="tags">
                        {resource.tags?.slice(0, 3).map(t => (
                            <span key={t.id} className="tag">{t.name}</span>
                        ))}
                    </div>

                    {/* Social Actions Row - Clean design with emoji */}
                    <div className="actions-row">
                        <button
                            className={`action-btn upvote-btn ${isUpvoted ? 'active' : ''}`}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleUpvote(); }}
                            title="Upvote this resource"
                        >
                            👍 {resource.upvotes_count || 0}
                        </button>

                        <button
                            className={`action-btn bookmark-btn ${isBookmarked ? 'active' : ''}`}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleBookmark(); }}
                            title="Bookmark"
                        >
                            🔖 {isBookmarked ? 'Saved' : 'Save'}
                        </button>

                        <a href={`/resources/${resource.id}`} className="view-details-link">
                            View Details
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Main Feed Component ---

interface Props {
    initialResources: HubResource[];
    availableTags?: { id: string; name: string }[];
    showSearch?: boolean;
}

export default function ResourceFeed({ initialResources, availableTags, showSearch = true }: Props) {
    // Store ALL resources for client-side filtering
    const [allResources, setAllResources] = useState<HubResource[]>(initialResources);

    // User State
    const [myBookmarks, setMyBookmarks] = useState<string[]>([]);
    const [myUpvotes, setMyUpvotes] = useState<string[]>([]);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        // Check auth and fetch user state
        const initUser = async () => {
            if (!supabase) return;
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setIsAuthenticated(true);
                const [bookmarks, upvotes] = await Promise.all([getMyBookmarks(), getMyUpvotes()]);
                setMyBookmarks(bookmarks);
                setMyUpvotes(upvotes);
            }
        };
        initUser();
    }, []);

    const handleToggleBookmark = async (resourceId: string) => {
        if (!isAuthenticated) return alert('Please log in to save resources.');

        // Optimistic UI
        const isBookmarked = myBookmarks.includes(resourceId);
        setMyBookmarks(prev => isBookmarked ? prev.filter(id => id !== resourceId) : [...prev, resourceId]);

        try {
            await toggleBookmark(resourceId);
        } catch (e) {
            // Revert on error
            setMyBookmarks(prev => isBookmarked ? [...prev, resourceId] : prev.filter(id => id !== resourceId));
            console.error(e);
        }
    };

    const handleToggleUpvote = async (resourceId: string) => {
        if (!isAuthenticated) return alert('Please log in to vote.');

        const isUpvoted = myUpvotes.includes(resourceId);

        // Optimistic UI
        setMyUpvotes(prev => isUpvoted ? prev.filter(id => id !== resourceId) : [...prev, resourceId]);

        // Update Resource Count locally
        setAllResources(prev => prev.map(res => {
            if (res.id === resourceId) {
                const newCount = (res.upvotes_count || 0) + (isUpvoted ? -1 : 1);
                return { ...res, upvotes_count: newCount };
            }
            return res;
        }));

        try {
            await toggleUpvote(resourceId);
        } catch (e) {
            // Revert
            setMyUpvotes(prev => isUpvoted ? [...prev, resourceId] : prev.filter(id => id !== resourceId));
            setAllResources(prev => prev.map(res => {
                if (res.id === resourceId) {
                    const newCount = (res.upvotes_count || 0) + (isUpvoted ? 1 : -1);
                    return { ...res, upvotes_count: newCount };
                }
                return res;
            }));
        }
    };

    const [query, setQuery] = useState('');
    const [audience, setAudience] = useState('');

    // NOTE: If we wanted to fetch "fresh" data on client mount to catch updates since SSR:
    // useEffect(() => { fetch('/api/resources/search').then(r => r.json()).then(setAllResources); }, []);

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
        <div className="feed-container">

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
                        <div key={res.id} style={{ height: '100%', animation: 'fadeIn 0.3s ease' }}>
                            <ReactResourceCard
                                resource={res}
                                isBookmarked={myBookmarks.includes(res.id)}
                                isUpvoted={myUpvotes.includes(res.id)}
                                onToggleBookmark={() => handleToggleBookmark(res.id)}
                                onToggleUpvote={() => handleToggleUpvote(res.id)}
                            />
                        </div>
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
                /* Removed max-width restriction to span full or reasonable width */
            }

            .search-wrapper-large {
                position: relative;
                width: 100%;
                max-width: 600px; /* Limit width but keep left aligned */
            }

            .search-input-large {
                width: 100%;
                padding: 16px 24px 16px 60px; /* Slightly smaller padding */
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
                background: var(--text-primary);
                color: var(--bg-color);
                border-color: var(--text-primary);
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
                transition: transform 0.5s ease;
            }

             .resource-card-react:hover .thumbnail {
                transform: scale(1.05);
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
            /* Hover Overlay */
            .card-overlay {
                position: absolute;
                inset: 0;
                background: rgba(0, 0, 0, 0.6);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 16px;
                opacity: 0;
                transition: opacity 0.3s ease;
                backdrop-filter: blur(4px);
            }

            .resource-card-react:hover .card-overlay {
                opacity: 1;
            }

            .visit-obj {
                z-index: 2;
            }

            .visit-btn {
                background: white;
                color: black;
                padding: 10px 20px;
                border-radius: 100px;
                font-size: 14px;
                font-weight: 700;
                text-decoration: none;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                transform: translateY(10px);
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
            }
            
            .visit-btn:hover {
                background: var(--text-primary);
                color: var(--bg-color);
                transform: scale(1.05); 
            }

            .view-btn {
                background: rgba(255, 255, 255, 0.2);
                color: white;
                padding: 8px 16px;
                border-radius: 100px;
                font-size: 13px;
                font-weight: 500;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                backdrop-filter: blur(4px);
                border: 1px solid rgba(255, 255, 255, 0.3);
                transform: translateY(10px);
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
            
            .resource-card-react:hover .visit-btn,
            .resource-card-react:hover .view-btn {
                transform: translateY(0);
            }

            .arrow {
                font-size: 1.2em;
                line-height: 1;
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

            /* New Card Styles for React Version with Actions */
            .resource-card-react a {
                text-decoration: none;
                color: inherit;
            }
            
            .card-link-wrapper {
                display: block;
            }

            .title-link {
                 text-decoration: none;
                 color: inherit;
            }
            .title-link:hover .title {
                color: var(--accent-color);
            }

            .actions-row {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-top: 12px;
                padding-top: 12px;
                border-top: 1px solid var(--border-subtle);
            }

            .action-btn {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 4px 8px;
                border-radius: 4px;
                border: none;
                background: transparent;
                color: var(--text-secondary);
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .action-btn:hover {
                background: var(--bg-surface-hover);
                color: var(--text-primary);
            }

            .action-btn.active {
                color: var(--text-primary);
                font-weight: 600;
            }

            .view-details-link {
                margin-left: auto;
                font-size: 12px;
                color: var(--text-secondary);
                text-decoration: underline;
                transition: color 0.2s ease;
            }
            .view-details-link:hover {
                color: var(--text-primary);
            }


        `}</style>
        </div>
    );
}
