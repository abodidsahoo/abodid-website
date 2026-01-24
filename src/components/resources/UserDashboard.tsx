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

    if (loading) {
        return (
            <div className="user-dashboard">
                <div className="loading">Loading your dashboard...</div>
                <style>{`
                    .user-dashboard {
                        max-width: 1200px;
                        margin: 0 auto;
                        padding: 2rem;
                        color: var(--text-primary);
                    }
                    .loading {
                        text-align: center;
                        padding: 3rem;
                        color: var(--text-secondary);
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div className="user-dashboard">
            <div className="dashboard-header">
                <div>
                    <h1>My Dashboard</h1>
                    <p className="welcome">Welcome back!</p>
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
                <div className="stat-card">
                    <div className="stat-value">{submissions.length}</div>
                    <div className="stat-label">My Submissions</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{bookmarks.length}</div>
                    <div className="stat-label">Saved Resources</div>
                </div>
            </div>

            <div className="dashboard-content">
                <div className="tabs">
                    <button
                        className={`tab ${activeTab === 'submissions' ? 'active' : ''}`}
                        onClick={() => setActiveTab('submissions')}
                    >
                        My Submissions
                    </button>
                    <button
                        className={`tab ${activeTab === 'bookmarks' ? 'active' : ''}`}
                        onClick={() => setActiveTab('bookmarks')}
                    >
                        Saved Resources
                    </button>
                </div>

                {activeTab === 'submissions' && (
                    <div className="submissions-list">
                        {submissions.length === 0 ? (
                            <div className="empty-state">
                                <p>You haven't submitted any resources yet.</p>
                                <a href="/resources/submit" className="btn-link">Submit your first resource</a>
                            </div>
                        ) : (
                            submissions.map(sub => (
                                <div key={sub.id} className={`resource-card status-${sub.status}`}>
                                    <div className="card-header">
                                        <h3>{sub.title}</h3>
                                        <span className="status-badge" style={{ background: getStatusColor(sub.status) }}>
                                            {sub.status === 'approved' ? '✓' : sub.status === 'rejected' ? '✗' : '⏱'} {sub.status}
                                        </span>
                                    </div>
                                    <p className="card-url">{sub.url}</p>

                                    {sub.status === 'rejected' && sub.rejection_reason && (
                                        <div className="rejection-feedback">
                                            <strong>⚠️ Rejection Reason:</strong>
                                            <p>{sub.rejection_reason}</p>
                                        </div>
                                    )}

                                    <div className="card-actions">
                                        <a href={`/resources/submit?edit=${sub.id}`} className="btn-edit">Edit & Resubmit</a>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'bookmarks' && (
                    <div className="bookmarks-list">
                        {bookmarks.length === 0 ? (
                            <div className="empty-state">
                                <p>No saved resources yet.</p>
                                <a href="/resources" className="btn-link">Browse Resources</a>
                            </div>
                        ) : (
                            bookmarks.map(res => (
                                <div key={res.id} className="resource-card">
                                    <h3>{res.title}</h3>
                                    <p className="card-url">{res.url}</p>
                                    <p className="card-desc">{res.description}</p>
                                    <div className="card-actions">
                                        <a href={res.url} target="_blank" rel="noopener noreferrer" className="btn-view">View Resource</a>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            <style>{`
                .user-dashboard {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 2rem;
                    color: var(--text-primary);
                }
                .dashboard-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                }
                .dashboard-header h1 {
                    font-size: 2rem;
                    margin: 0;
                    margin-bottom: 0.5rem;
                }
                .welcome {
                    margin: 0;
                    color: var(--text-secondary);
                }
                .btn-submit-new {
                    background: var(--text-primary);
                    color: var(--bg-primary);
                    padding: 0.5rem 1rem;
                    border-radius: 6px;
                    text-decoration: none;
                    font-weight: 600;
                    transition: opacity 0.2s;
                }
                .btn-logout {
                    background: transparent;
                    border: 1px solid var(--border-subtle);
                    color: var(--text-secondary);
                    padding: 0.5rem 1rem;
                    border-radius: 6px;
                    cursor: pointer;
                }
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 3rem;
                }
                .stat-card {
                    background: var(--bg-surface);
                    border: 1px solid var(--border-subtle);
                    padding: 1.5rem;
                    border-radius: 12px;
                }
                .stat-value {
                    font-size: 2.5rem;
                    font-weight: 700;
                    margin-bottom: 0.5rem;
                }
                .stat-label {
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                }
                .tabs {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 2rem;
                    border-bottom: 1px solid var(--border-subtle);
                    padding-bottom: 1px;
                }
                .tab {
                    background: none;
                    border: none;
                    padding: 0.75rem 0;
                    color: var(--text-secondary);
                    font-size: 1rem;
                    cursor: pointer;
                    position: relative;
                }
                .tab.active {
                    color: var(--text-primary);
                    font-weight: 600;
                }
                .tab.active::after {
                    content: '';
                    position: absolute;
                    bottom: -1px;
                    left: 0;
                    right: 0;
                    height: 2px;
                    background: var(--text-primary);
                }
                .resource-card {
                    background: var(--bg-surface);
                    border: 1px solid var(--border-subtle);
                    padding: 1.5rem;
                    border-radius: 12px;
                    margin-bottom: 1rem;
                }
                .status-approved { border-left: 4px solid #10B981; }
                .status-pending { border-left: 4px solid #F59E0B; }
                .status-rejected { border-left: 4px solid #EF4444; }
                
                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 0.5rem;
                }
                .card-header h3 { margin: 0; font-size: 1.1rem; }
                .status-badge {
                    padding: 0.25rem 0.5rem;
                    border-radius: 4px;
                    color: white;
                    font-size: 0.75rem;
                    font-weight: 600;
                }
                .card-url { color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 1rem; }
                .card-desc { margin-bottom: 1rem; }
                
                .rejection-feedback {
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.2);
                    padding: 1rem;
                    border-radius: 8px;
                    margin-bottom: 1rem;
                    color: var(--text-primary);
                }
                .rejection-feedback strong { display: block; margin-bottom: 0.5rem; color: #EF4444; }
                .rejection-feedback p { margin: 0; }
                
                .card-actions {
                    display: flex;
                    gap: 1rem;
                }
                .btn-edit, .btn-view, .btn-link {
                    color: var(--text-primary);
                    text-decoration: none;
                    font-size: 0.875rem;
                    font-weight: 500;
                }
                .btn-edit:hover, .btn-view:hover, .btn-link:hover {
                    text-decoration: underline;
                }
                .empty-state {
                    text-align: center;
                    padding: 3rem;
                    background: var(--bg-surface);
                    border-radius: 12px;
                    color: var(--text-secondary);
                }
            `}</style>
        </div>
    );
}
