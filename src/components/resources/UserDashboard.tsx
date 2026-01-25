import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { getBookmarkedResources } from '../../lib/resources/db';
import type { HubResource } from '../../lib/resources/types';

interface UserDashboardProps {
    user?: any;
}

export default function UserDashboard({ user: propUser }: UserDashboardProps) {
    const [user, setUser] = useState<any>(propUser || null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'submissions' | 'bookmarks'>('submissions');
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [bookmarks, setBookmarks] = useState<HubResource[]>([]);

    useEffect(() => {
        if (!user) {
            checkAuth();
        } else {
            fetchData(user.id);
        }
    }, [user]);

    const checkAuth = async () => {
        if (!supabase) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            setUser(session.user);
            fetchData(session.user.id);
        } else {
            window.location.href = '/login';
        }
    };

    const fetchData = async (userId: string) => {
        setLoading(true);
        try {
            // 1. Fetch Submissions
            if (supabase) {
                const { data: subs } = await supabase
                    .from('hub_resources')
                    .select('*')
                    .eq('submitted_by', userId)
                    .order('created_at', { ascending: false });

                if (subs) setSubmissions(subs);

                // 2. Fetch Bookmarks
                const bookmarked = await getBookmarkedResources(userId);
                setBookmarks(bookmarked);
            }
        } catch (e) {
            console.error('Error fetching dashboard data:', e);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved': return '#10B981';
            case 'pending': return '#F59E0B';
            case 'rejected': return '#EF4444';
            default: return '#6B7280';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'approved': return '✓';
            case 'pending': return '⏱';
            case 'rejected': return '✗';
            default: return '•';
        }
    };

    if (loading) {
        return (
            <div className="curator-dashboard">
                <div className="loading">Loading your dashboard...</div>
                <style>{`
                    .curator-dashboard { max-width: 1200px; margin: 0 auto; padding: 2rem; }
                    .loading { text-align: center; padding: 4rem 1rem; color: var(--text-secondary); }
                `}</style>
            </div>
        );
    }

    return (
        <div className="curator-dashboard">
            <div className="curator-header">
                <div>
                    <h1>My Dashboard</h1>
                    <p className="welcome">Welcome back, {user?.user_metadata?.full_name || user?.email}!</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <a href="/resources/submit" className="btn-submit-new">
                        + Submit New Resource
                    </a>
                    <button
                        onClick={() => supabase?.auth.signOut().then(() => window.location.href = '/resources')}
                        className="btn-logout"
                    >
                        Logout
                    </button>
                </div>
            </div>

            <div className="stats-grid">
                <div className="stat-card pending" style={{ borderColor: '#F59E0B' }}>
                    <div className="stat-value">{submissions.filter(s => s.status === 'pending').length}</div>
                    <div className="stat-label">Pending</div>
                </div>
                <div className="stat-card approved" style={{ borderColor: '#10B981' }}>
                    <div className="stat-value">{submissions.filter(s => s.status === 'approved').length}</div>
                    <div className="stat-label">Approved</div>
                </div>
                <div className="stat-card rejected" style={{ borderColor: '#EF4444' }}>
                    <div className="stat-value">{submissions.filter(s => s.status === 'rejected').length}</div>
                    <div className="stat-label">Rejected</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{bookmarks.length}</div>
                    <div className="stat-label">Saved Resources</div>
                </div>
            </div>

            <div className="submissions-section">
                <div className="section-header">
                    <h2>{activeTab === 'submissions' ? 'My Submissions' : 'Saved Resources'}</h2>
                    <div className="filter-tabs">
                        <button
                            className={activeTab === 'submissions' ? 'active' : ''}
                            onClick={() => setActiveTab('submissions')}
                        >
                            Submissions ({submissions.length})
                        </button>
                        <button
                            className={activeTab === 'bookmarks' ? 'active' : ''}
                            onClick={() => setActiveTab('bookmarks')}
                        >
                            Saved ({bookmarks.length})
                        </button>
                    </div>
                </div>

                {activeTab === 'submissions' && (
                    <div className="submissions-list">
                        {submissions.length === 0 ? (
                            <div className="empty-state">
                                <p>You haven't submitted any resources yet.</p>
                                <a href="/resources/submit" className="btn-secondary">Submit Your First Resource</a>
                            </div>
                        ) : (
                            submissions.map(sub => (
                                <div key={sub.id} className="submission-card">
                                    <div className="submission-header">
                                        <h3>{sub.title}</h3>
                                        <span
                                            className="status-badge"
                                            style={{
                                                background: getStatusColor(sub.status),
                                                color: 'white'
                                            }}
                                        >
                                            {getStatusIcon(sub.status)} {sub.status}
                                        </span>
                                    </div>
                                    <p className="submission-url">{sub.url}</p>

                                    {sub.status === 'rejected' && sub.rejection_reason && (
                                        <div className="rejection-reason">
                                            <strong>⚠️ Rejection Reason:</strong> {sub.rejection_reason}
                                        </div>
                                    )}

                                    <div className="submission-actions">
                                        {sub.status === 'approved' && (
                                            <a href={`/resources/${sub.id}`} className="btn-view">View Resource</a>
                                        )}
                                        <a href={`/resources/submit?edit=${sub.id}`} className="btn-edit">Edit & Resubmit</a>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'bookmarks' && (
                    <div className="submissions-list">
                        {bookmarks.length === 0 ? (
                            <div className="empty-state">
                                <p>No saved resources yet.</p>
                                <a href="/resources" className="btn-secondary">Browse Resources</a>
                            </div>
                        ) : (
                            bookmarks.map(res => (
                                <div key={res.id} className="submission-card">
                                    <div className="submission-header">
                                        <h3>{res.title}</h3>
                                        <a href={res.url} target="_blank" rel="noopener noreferrer" className="btn-preview">Visit →</a>
                                    </div>
                                    <p className="submission-url">{res.url}</p>
                                    <p className="submission-description">{res.description}</p>
                                    <div className="submission-actions">
                                        <a href={`/resources/${res.id}`} className="btn-view">View Details</a>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            <style>{`
                .curator-dashboard {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 2rem;
                }

                .curator-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 2rem;
                    gap: 2rem;
                }

                .curator-header h1 {
                    font-size: 2rem;
                    margin: 0 0 0.5rem 0;
                    color: var(--text-primary);
                }

                .welcome {
                    color: var(--text-secondary);
                    margin: 0;
                }

                .btn-submit-new {
                    background: var(--text-primary);
                    color: var(--bg-color);
                    padding: 0.875rem 1.5rem;
                    border-radius: 8px;
                    text-decoration: none;
                    font-weight: 600;
                    transition: opacity 0.2s;
                    white-space: nowrap;
                }

                .btn-submit-new:hover {
                    opacity: 0.9;
                }

                .btn-logout {
                    background: transparent;
                    color: var(--text-secondary);
                    padding: 0.875rem 1.5rem;
                    border-radius: 8px;
                    border: 1px solid var(--border-subtle);
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    white-space: nowrap;
                }

                .btn-logout:hover {
                    border-color: var(--text-primary);
                    color: var(--text-primary);
                }

                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1rem;
                    margin-bottom: 3rem;
                }

                .stat-card {
                    background: var(--bg-surface);
                    border: 1px solid var(--border-subtle);
                    border-radius: 12px;
                    padding: 1.5rem;
                    text-align: center;
                }

                .stat-value {
                    font-size: 2.5rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    margin-bottom: 0.5rem;
                }

                .stat-label {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .submissions-section {
                    margin-bottom: 3rem;
                }

                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                    gap: 1rem;
                    flex-wrap: wrap;
                }

                .section-header h2 {
                    margin: 0;
                    font-size: 1.5rem;
                }

                .filter-tabs {
                    display: flex;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                }

                .filter-tabs button {
                    padding: 0.5rem 1rem;
                    border: 1px solid var(--border-subtle);
                    background: transparent;
                    color: var(--text-secondary);
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 0.875rem;
                    transition: all 0.2s;
                }

                .filter-tabs button:hover {
                    border-color: var(--text-primary);
                    color: var(--text-primary);
                }

                .filter-tabs button.active {
                    background: var(--text-primary);
                    color: var(--bg-color);
                    border-color: var(--text-primary);
                }

                .submissions-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .submission-card {
                    background: var(--bg-surface);
                    border: 1px solid var(--border-subtle);
                    border-radius: 12px;
                    padding: 1.5rem;
                }

                .submission-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 1rem;
                    margin-bottom: 0.75rem;
                }

                .submission-header h3 {
                    margin: 0;
                    font-size: 1.125rem;
                    color: var(--text-primary);
                }

                .status-badge {
                    padding: 0.25rem 0.75rem;
                    border-radius: 100px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    white-space: nowrap;
                }

                .submission-url {
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                    margin: 0 0 0.5rem 0;
                    word-break: break-all;
                }

                .submission-description {
                    color: var(--text-secondary);
                    margin: 0 0 1rem 0;
                    line-height: 1.6;
                }

                .rejection-reason {
                    background: #FEE2E2;
                    color: #991B1B;
                    padding: 0.75rem;
                    border-radius: 6px;
                    font-size: 0.875rem;
                    margin-bottom: 1rem;
                }

                .submission-actions {
                    display: flex;
                    gap: 0.5rem;
                }

                .btn-view, .btn-edit, .btn-preview {
                    padding: 0.5rem 1rem;
                    border-radius: 6px;
                    text-decoration: none;
                    font-size: 0.875rem;
                    font-weight: 500;
                    transition: opacity 0.2s;
                    cursor: pointer;
                }

                .btn-view {
                    background: var(--text-primary);
                    color: var(--bg-color);
                }

                .btn-edit {
                    background: transparent;
                    color: var(--text-primary);
                    border: 1px solid var(--border-subtle);
                }
                
                .btn-preview {
                     background: var(--bg-surface-hover);
                     color: var(--text-primary);
                     border: 1px solid var(--border-subtle);
                }

                .btn-view:hover, .btn-edit:hover, .btn-preview:hover {
                    opacity: 0.8;
                }

                .empty-state {
                    text-align: center;
                    padding: 3rem 1rem;
                    color: var(--text-secondary);
                }

                .btn-secondary {
                    display: inline-block;
                    margin-top: 1rem;
                    padding: 0.75rem 1.5rem;
                    background: transparent;
                    border: 1px solid var(--border-subtle);
                    color: var(--text-primary);
                    border-radius: 8px;
                    text-decoration: none;
                    font-weight: 500;
                }

                @media (max-width: 768px) {
                    .curator-header {
                        flex-direction: column;
                    }

                    .btn-submit-new {
                        width: 100%;
                        text-align: center;
                    }

                    .section-header {
                        flex-direction: column;
                        align-items: flex-start;
                    }
                }
            `}</style>
        </div >
    );
}
