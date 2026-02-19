import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { approveResource, rejectResource, getPendingResources, deleteResource, restoreResource, permanentDeleteResource, getDeletedResources, getAllResourcesAdmin } from '../../lib/resources/db';
import type { User } from '@supabase/supabase-js';

interface Profile {
    id: string;
    full_name: string | null;
    role: string;
}

interface Submission {
    id: string;
    title: string;
    url: string;
    description: string | null;
    thumbnail_url: string | null;
    status: 'pending' | 'approved' | 'rejected' | 'deleted';
    created_at: string;
    reviewed_at: string | null;
    rejection_reason: string | null;
    submitted_by?: string;
    submitter_profile?: any;
}

// Add props interface
interface Props {
    user: User;
    role: string;
}

export default function CuratorDashboard({ user, role }: Props) {
    const [loading, setLoading] = useState(true);
    // User/Profile come from props now
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [pendingSubmissions, setPendingSubmissions] = useState<Submission[]>([]);
    const [deletedSubmissions, setDeletedSubmissions] = useState<Submission[]>([]);
    const [globalResources, setGlobalResources] = useState<Submission[]>([]);
    const [filter, setFilter] = useState('all'); // all, pending, approved, rejected, deleted, global
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        if (!user) return;
        setLoading(true);
        setError(null);
        try {
            await fetchSubmissions(user.id);
            if (role === 'curator' || role === 'admin') {
                await fetchPendingSubmissions();
            }
            if (role === 'admin') {
                await fetchDeletedSubmissions();
                await fetchGlobalResources();
            }
        } catch (err: any) {
            console.error('Dashboard load error:', err);
            setError('Failed to load dashboard data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user, role]);

    const handleRefresh = () => {
        fetchData();
    };

    const fetchSubmissions = async (userId: string) => {
        if (!supabase) return;

        setLoading(true);
        const { data, error } = await supabase
            .from('hub_resources')
            .select('*')
            .eq('submitted_by', userId)
            .order('created_at', { ascending: false });

        if (!error && data) {
            setSubmissions(data as Submission[]);
        }
        setLoading(false);
    };

    const fetchPendingSubmissions = async () => {
        const pending = await getPendingResources();
        setPendingSubmissions(pending as unknown as Submission[]);
    };

    const fetchDeletedSubmissions = async () => {
        const deleted = await getDeletedResources();
        setDeletedSubmissions(deleted as unknown as Submission[]);
    };

    const fetchGlobalResources = async () => {
        const global = await getAllResourcesAdmin();
        setGlobalResources(global as unknown as Submission[]);
    };

    const handleApprove = async (resourceId: string) => {
        // Optimistic Update
        const item = pendingSubmissions.find(s => s.id === resourceId);
        if (!item) return;

        setPendingSubmissions(prev => prev.filter(s => s.id !== resourceId));

        // If it was my submission, update status in main list
        setSubmissions(prev => prev.map(s => s.id === resourceId ? { ...s, status: 'approved' } : s));

        // Attempt API
        const result = await approveResource(resourceId);
        if (!result.success) {
            // Revert on failure (simplified: just reload or show alert)
            alert('Failed to approve. Refreshing...');
            fetchPendingSubmissions();
        }
    };

    const handleReject = async (resourceId: string) => {
        const reason = prompt('Reason for rejection?');
        if (reason === null) return;

        // Optimistic Update
        setPendingSubmissions(prev => prev.filter(s => s.id !== resourceId));
        setSubmissions(prev => prev.map(s => s.id === resourceId ? { ...s, status: 'rejected' } : s));

        const result = await rejectResource(resourceId, reason);
        if (!result.success) {
            alert('Failed to reject. Refreshing...');
            fetchPendingSubmissions();
        }
    };

    const handleDelete = async (resourceId: string) => {
        if (!confirm('Move this resource to Trash?')) return;

        // Optimistic Update
        const itemInGlobal = globalResources.find(s => s.id === resourceId);
        const itemInMy = submissions.find(s => s.id === resourceId);

        // Remove from ALL views immediately
        setSubmissions(prev => prev.filter(s => s.id !== resourceId));
        setGlobalResources(prev => prev.filter(s => s.id !== resourceId));
        setPendingSubmissions(prev => prev.filter(s => s.id !== resourceId));

        // Add to trash (ensure no duplicates)
        if (role === 'admin') {
            const recycledItem = itemInGlobal || itemInMy;
            if (recycledItem) {
                setDeletedSubmissions(prev => {
                    // Remove any existing duplicate first
                    const filtered = prev.filter(s => s.id !== resourceId);
                    return [{ ...recycledItem, status: 'deleted', reviewed_at: new Date().toISOString() }, ...filtered];
                });
            }
        }

        const result = await deleteResource(resourceId);
        if (!result.success) {
            // Revert by refetching
            alert('Failed to delete. Refreshing...');
            fetchGlobalResources();
            if (user) fetchSubmissions(user.id);
            fetchDeletedSubmissions();
        }
    };

    const handleRestore = async (resourceId: string) => {
        // Optimistic
        const item = deletedSubmissions.find(s => s.id === resourceId);

        // Remove from trash
        setDeletedSubmissions(prev => prev.filter(s => s.id !== resourceId));

        // Add to pending (ensure no duplicates)
        if (item) {
            setPendingSubmissions(prev => {
                const filtered = prev.filter(s => s.id !== resourceId);
                return [{ ...item, status: 'pending' }, ...filtered];
            });
            // Also update submissions if it's the user's item
            setSubmissions(prev => {
                const filtered = prev.filter(s => s.id !== resourceId);
                return [{ ...item, status: 'pending' }, ...filtered];
            });
        }

        const result = await restoreResource(resourceId);
        if (!result.success) {
            alert('Failed to restore. Refreshing...');
            fetchDeletedSubmissions();
            fetchPendingSubmissions();
            if (user) fetchSubmissions(user.id);
        }
    };

    const handlePermanentDelete = async (resourceId: string) => {
        if (!confirm('Are you ABSOLUTELY SURE? This cannot be undone.')) return;

        // Optimistic - remove from everywhere
        setDeletedSubmissions(prev => prev.filter(s => s.id !== resourceId));
        setSubmissions(prev => prev.filter(s => s.id !== resourceId));
        setGlobalResources(prev => prev.filter(s => s.id !== resourceId));
        setPendingSubmissions(prev => prev.filter(s => s.id !== resourceId));

        const result = await permanentDeleteResource(resourceId);
        if (!result.success) {
            alert('Failed to delete. Refreshing...');
            fetchDeletedSubmissions();
            if (user) fetchSubmissions(user.id);
        }
    };

    const filteredSubmissions = submissions.filter(sub => {
        if (filter === 'all') return true; // Show everything, including deleted
        return sub.status === filter;
    });

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
            case 'deleted': return '🗑';
            default: return '•';
        }
    };

    if (loading) {
        return (
            <div className="curator-dashboard">
                <div className="loading">Loading your dashboard...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="curator-dashboard">
                <div className="error-state" style={{ textAlign: 'center', padding: '4rem' }}>
                    <p style={{ color: '#EF4444', marginBottom: '1rem' }}>{error}</p>
                    <button onClick={handleRefresh} className="btn-secondary">Retry</button>
                </div>
            </div>
        );
    }

    const pendingCount = submissions.filter(s => s.status === 'pending').length;
    const approvedCount = submissions.filter(s => s.status === 'approved').length;
    const rejectedCount = submissions.filter(s => s.status === 'rejected').length;

    return (
        <div className="curator-dashboard">
            <div className="curator-header">
                <div>
                    <h1>Curator Dashboard</h1>
                    <p className="welcome">Welcome back, {user?.user_metadata?.full_name || user?.email}!</p>

                    <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
                        <a href="/resources/submit" className="btn-submit-new-prominent">
                            + Submit New Resource
                        </a>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                    <button onClick={handleRefresh} className="btn-refresh-text">
                        Refresh
                    </button>
                    <a href="/resources" className="btn-back-logo">
                        Back to Resources
                    </a>
                    {role === 'admin' && (
                        <a
                            href="/admin/dashboard"
                            className="btn-admin-panel"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Admin Panel
                        </a>
                    )}
                    <button
                        onClick={async (e) => {
                            e.preventDefault();
                            try {
                                await supabase?.auth.signOut();
                            } catch (err) {
                                console.error("Logout error:", err);
                            } finally {
                                localStorage.removeItem('curator_profile');
                                window.location.href = '/resources';
                            }
                        }}
                        className="btn-logout-prominent"
                    >
                        Sign Out
                    </button>
                </div>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-value">{submissions.length}</div>
                    <div className="stat-label">Total Submissions</div>
                </div>
                <div className="stat-card pending">
                    <div className="stat-value">{role === 'curator' || role === 'admin' ? pendingSubmissions.length : pendingCount}</div>
                    <div className="stat-label">Pending Review</div>
                </div>
                <div className="stat-card approved">
                    <div className="stat-value">{approvedCount}</div>
                    <div className="stat-label">Approved</div>
                </div>
                <div className="stat-card rejected">
                    <div className="stat-value">{rejectedCount}</div>
                    <div className="stat-label">Rejected</div>
                </div>
                {role === 'admin' && (
                    <div className="stat-card deleted">
                        <div className="stat-value">{deletedSubmissions.length}</div>
                        <div className="stat-label">Trash</div>
                    </div>
                )}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
                <div className="quick-nav-buttons">
                    <a href="/resources" className="btn-quick-nav">
                        <span style={{ marginRight: '0.5rem' }}>🔍</span>
                        Explore All Approved Resources
                    </a>
                    <a href={`/resources/u/${user?.user_metadata?.username || 'me'}`} className="btn-quick-nav">
                        <span style={{ marginRight: '0.5rem' }}>⭐</span>
                        View Saved Collection
                    </a>
                </div>
            </div>

            {/* Submit button moved to top section */}

            <div className="submissions-section">
                <div className="section-header">
                    <h2>{filter === 'global' ? 'Global Library (All Users)' : 'My Submissions'}</h2>
                    <div className="filter-tabs">
                        <button
                            className={filter === 'all' ? 'active' : ''}
                            onClick={() => setFilter('all')}
                        >
                            All ({submissions.length})
                        </button>
                        <button
                            className={filter === 'pending' ? 'active' : ''}
                            onClick={() => setFilter('pending')}
                        >
                            Pending ({pendingCount})
                        </button>
                        <button
                            className={filter === 'approved' ? 'active' : ''}
                            onClick={() => setFilter('approved')}
                        >
                            Approved ({approvedCount})
                        </button>
                        <button
                            className={filter === 'rejected' ? 'active' : ''}
                            onClick={() => setFilter('rejected')}
                        >
                            Rejected ({rejectedCount})
                        </button>
                        {role === 'admin' && (
                            <>
                                <button
                                    className={filter === 'deleted' ? 'active' : ''}
                                    onClick={() => setFilter('deleted')}
                                >
                                    Trash ({deletedSubmissions.length})
                                </button>
                                <button
                                    className={filter === 'global' ? 'active' : ''}
                                    onClick={() => setFilter('global')}
                                    style={{ marginLeft: '1rem', borderLeft: '1px solid var(--border-subtle)' }}
                                >
                                    Global Library ({globalResources.length})
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {filter === 'global' ? (
                    <div className="submissions-list">
                        {globalResources.map(submission => (
                            <div key={submission.id} className="submission-card">
                                {submission.thumbnail_url && (
                                    <div className="card-thumbnail">
                                        <img src={submission.thumbnail_url} alt={submission.title} loading="lazy" />
                                        <span
                                            className="status-badge-overlay"
                                            style={{
                                                background: getStatusColor(submission.status)
                                            }}
                                        >
                                            {submission.status.toUpperCase()}
                                        </span>
                                    </div>
                                )}
                                <div className="card-content">
                                    <div className="submission-header">
                                        <h3>{submission.title}</h3>
                                    </div>
                                    <p className="submission-url">{submission.url}</p>
                                    <div className="submission-actions">
                                        <a href={`/resources/${submission.id}`} className="btn-view">View Resource</a>
                                        {role === 'admin' && (
                                            <button
                                                onClick={() => handleDelete(submission.id)}
                                                className="btn-delete"
                                                title="Move to Trash"
                                            >
                                                <span>🗑</span> Delete
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filter === 'deleted' ? null : (
                    filteredSubmissions.length === 0 ? (
                        <div className="empty-state">
                            <p>No submissions found.</p>
                            <a href="/resources/submit" className="btn-secondary">Submit Your First Resource</a>
                        </div>
                    ) : (
                        <div className="submissions-list">
                            {filteredSubmissions.map(submission => (
                                <div key={submission.id} className="submission-card">
                                    {submission.thumbnail_url && (
                                        <div className="card-thumbnail">
                                            <img src={submission.thumbnail_url} alt={submission.title} loading="lazy" />
                                            <span
                                                className="status-badge-overlay"
                                                style={{
                                                    background: getStatusColor(submission.status)
                                                }}
                                            >
                                                {submission.status.toUpperCase()}
                                            </span>
                                        </div>
                                    )}
                                    <div className="card-content">
                                        <div className="submission-header">
                                            <h3>{submission.title}</h3>
                                        </div>
                                        <p className="submission-url">{submission.url}</p>

                                        {submission.rejection_reason && (
                                            <div className="rejection-reason">
                                                <strong>Rejection reason:</strong> {submission.rejection_reason}
                                            </div>
                                        )}
                                        <div className="submission-actions">
                                            <a href={`/resources/${submission.id}`} className="btn-view">View Resource</a>
                                            {submission.status === 'pending' && (
                                                <a href={`/resources/submit?edit=${submission.id}`} className="btn-edit">Edit</a>
                                            )}
                                            {role === 'admin' && submission.status !== 'deleted' && (
                                                <button
                                                    onClick={() => handleDelete(submission.id)}
                                                    className="btn-delete"
                                                    title="Move to Trash"
                                                    style={{ gap: '0.5rem' }}
                                                >
                                                    <span>🗑</span> Delete
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>

            {/* Pending Submissions from Others (Curator Moderation) */}
            {pendingSubmissions.length > 0 && (
                <div className="submissions-section">
                    <div className="section-header">
                        <h2>🔍 Pending Submissions to Review</h2>
                        <span className="pending-count">{pendingSubmissions.length} pending</span>
                    </div>

                    <div className="submissions-list">
                        {pendingSubmissions.map(submission => (
                            <div key={submission.id} className="submission-card pending-review">
                                {submission.thumbnail_url && (
                                    <div className="card-thumbnail">
                                        <img src={submission.thumbnail_url} alt={submission.title} loading="lazy" />
                                    </div>
                                )}
                                <div className="card-content">
                                    <div className="submission-header">
                                        <h3>{submission.title}</h3>
                                    </div>
                                    <p className="submission-url">{submission.url}</p>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <span
                                            className="status-badge"
                                            style={{
                                                background: '#F59E0B',
                                                color: 'white',
                                                fontSize: '0.75rem',
                                                padding: '0.25rem 0.75rem',
                                                borderRadius: '100px',
                                                fontWeight: 600,
                                                letterSpacing: '0.05em',
                                                textTransform: 'uppercase'
                                            }}
                                        >
                                            ⏱ pending
                                        </span>
                                    </div>
                                    <div className="submission-actions">
                                        <button
                                            onClick={() => handleApprove(submission.id)}
                                            className="btn-approve"
                                        >
                                            ✓ Approve
                                        </button>
                                        <button
                                            onClick={() => handleReject(submission.id)}
                                            className="btn-reject"
                                        >
                                            ✗ Reject
                                        </button>
                                        <a
                                            href={submission.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn-preview"
                                        >
                                            Preview →
                                        </a>
                                        {role === 'admin' && (
                                            <button
                                                onClick={() => handleDelete(submission.id)}
                                                className="btn-delete"
                                                title="Move to Trash"
                                                style={{ gap: '0.5rem' }}
                                            >
                                                <span>🗑</span> Delete
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Trash Bin (Admin Only) */}
            {role === 'admin' && filter === 'deleted' && (
                <div className="submissions-section">
                    <div className="section-header">
                        <h2>🗑 Trash Bin</h2>
                        <span className="pending-count" style={{ background: '#EF4444' }}>{deletedSubmissions.length} items</span>
                    </div>

                    <div className="submissions-list">
                        {deletedSubmissions.map(submission => (
                            <div key={submission.id} className="submission-card" style={{ opacity: 0.7 }}>
                                {submission.thumbnail_url && (
                                    <div className="card-thumbnail">
                                        <img src={submission.thumbnail_url} alt={submission.title} loading="lazy" />
                                    </div>
                                )}
                                <div className="card-content">
                                    <div className="submission-header">
                                        <h3>{submission.title}</h3>
                                    </div>
                                    <p className="submission-url">{submission.url}</p>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <span className="status-badge" style={{ background: '#EF4444', color: 'white', fontSize: '0.75rem', padding: '0.25rem 0.75rem', borderRadius: '100px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Deleted</span>
                                    </div>
                                    <div className="submission-meta">
                                        Deleted at {submission.reviewed_at ? new Date(submission.reviewed_at).toLocaleDateString() : 'Unknown'}
                                    </div>
                                    <div className="submission-actions">
                                        <button onClick={() => handleRestore(submission.id)} className="btn-approve">
                                            ↺ Restore
                                        </button>
                                        <button onClick={() => handlePermanentDelete(submission.id)} className="btn-delete">
                                            ⚠ Delete Forever
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}



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

                /* Common Header Button Style */
                .btn-refresh-text,
                .btn-back-logo,
                .btn-admin-panel,
                .btn-logout-prominent {
                    height: 42px; /* Fixed uniform height */
                    padding: 0 1.25rem;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 8px;
                    font-family: 'Space Mono', monospace; /* Monospace font */
                    font-size: 0.85rem;
                    font-weight: 500;
                    text-decoration: none;
                    transition: all 0.2s;
                    white-space: nowrap;
                    border: 1px solid transparent;
                    box-sizing: border-box;
                    cursor: pointer;
                }

                /* Refresh Button */
                .btn-refresh-text {
                    background: transparent;
                    border-color: var(--border-subtle);
                    color: var(--text-primary);
                }
                .btn-refresh-text:hover {
                    background: var(--bg-surface-hover);
                    border-color: var(--text-primary);
                }

                /* Back to Resources */
                /* Light Mode: Black BG, White Text */
                html[data-theme="light"] .btn-back-logo {
                    background: #000000;
                    color: #ffffff;
                }
                html[data-theme="light"] .btn-back-logo:hover {
                     background: #333333;
                }

                /* Dark Mode: White BG, Black Text */
                html[data-theme="dark"] .btn-back-logo {
                    background: #ffffff;
                    color: #000000;
                }
                html[data-theme="dark"] .btn-back-logo:hover {
                     background: #e5e5e5;
                }

                /* Admin Panel */
                .btn-admin-panel {
                    background: #334155;
                    color: white;
                    border-color: var(--border-subtle);
                }
                .btn-admin-panel:hover {
                    background: #1e293b;
                    border-color: var(--text-primary);
                    transform: translateY(-1px);
                }

                /* Sign Out */
                .btn-logout-prominent {
                    background: #EF4444; 
                    color: white;
                }
                .btn-logout-prominent:hover {
                    background: #DC2626;
                }

                /* Submit Button - Reduced Size */
                .btn-submit-new-prominent {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0.75rem 1.5rem; /* Reduced padding */
                    background: var(--text-primary);
                    color: var(--bg-surface); /* Inverse Text */
                    border-radius: 8px; /* Slightly smaller radius */
                    text-decoration: none;
                    font-weight: 600; /* Slightly lighter weight */
                    font-size: 0.95rem; /* Reduced font size */
                    transition: transform 0.2s, opacity 0.2s;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                    font-family: 'Space Mono', monospace; /* Consistent font */
                    width: auto; /* Allow auto width */
                    min-width: 200px;
                }
                
                /* Force Black Text on White Button (Dark Mode) */
                html[data-theme="dark"] .btn-submit-new-prominent {
                    background: #ffffff;
                    color: #000000;
                }
                /* Force White Text on Black Button (Light Mode) */
                html[data-theme="light"] .btn-submit-new-prominent {
                    background: #000000;
                    color: #ffffff;
                }

                .btn-submit-new-prominent:hover {
                    transform: translateY(-1px);
                    opacity: 0.95;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                }

                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                    gap: 1rem;
                    margin-bottom: 2rem;
                }

                .stat-card {
                    background: var(--bg-surface);
                    border: 1px solid var(--border-subtle);
                    border-radius: 12px;
                    padding: 1rem;
                    text-align: center;
                }

                .stat-card.pending { border-color: #F59E0B; }
                .stat-card.approved { border-color: #10B981; }
                .stat-card.rejected { border-color: #EF4444; }
                .stat-card.deleted { border-color: #6B7280; opacity: 0.8; }

                .stat-value {
                    font-size: 1.75rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    margin-bottom: 0.25rem;
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
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                }

                .section-header h2 {
                    margin: 0;
                    font-size: 2.5rem;
                    font-weight: 700;
                    letter-spacing: -0.02em;
                    color: var(--text-primary);
                }
                
                .filter-tabs {
                    display: flex;
                    gap: 0.75rem;
                    flex-wrap: wrap;
                    width: 100%;
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
                    color: var(--bg-surface); /* Inverse */
                    border-color: var(--text-primary);
                }

                /* Filter Tabs Active Text Fix */
                html[data-theme="dark"] .filter-tabs button.active {
                    color: #000000;
                    background: #ffffff;
                }
                html[data-theme="light"] .filter-tabs button.active {
                    color: #ffffff;
                    background: #000000;
                }


                .submissions-list {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 1.5rem;
                }

                .submission-card {
                    background: var(--bg-surface);
                    border: 1px solid var(--border-subtle);
                    border-radius: 12px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    transition: transform 0.2s, box-shadow 0.2s;
                }

                .submission-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                }

                .card-thumbnail {
                    position: relative;
                    width: 100%;
                    height: 160px;
                    background: var(--bg-surface-hover);
                    overflow: hidden;
                }

                .status-badge-overlay {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    color: white;
                    font-size: 0.7rem;
                    padding: 0.25rem 0.5rem;
                    border-radius: 6px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.02em;
                    backdrop-filter: blur(4px);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                }

                .card-thumbnail img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .card-content {
                    padding: 1.25rem;
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                }

                .submission-header {
                    margin-bottom: 0.5rem;
                }

                .submission-header h3 {
                    margin: 0;
                    font-size: 1.125rem;
                    color: var(--text-primary);
                    line-height: 1.4;
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
                    color: var(--text-tertiary);
                    font-size: 0.75rem;
                    margin: 0 0 0.5rem 0;
                    word-break: break-all;
                }

                .submission-description {
                    color: var(--text-secondary);
                    margin: 0 0 1rem 0;
                    line-height: 1.6;
                }

                .submission-meta {
                    font-size: 0.8125rem;
                    color: var(--text-tertiary);
                    margin-bottom: 1rem;
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
                    margin-top: auto; 
                    flex-wrap: wrap;
                }

                .btn-view, .btn-edit {
                    padding: 0.5rem 1rem;
                    border-radius: 6px;
                    text-decoration: none;
                    font-size: 0.875rem;
                    font-weight: 500;
                    transition: opacity 0.2s;
                }

                /* View Resource Button - Strict Contrast */
                .btn-view {
                    background: var(--text-primary);
                    color: var(--bg-surface);
                }
                
                html[data-theme="dark"] .btn-view {
                    background: #ffffff;
                    color: #000000;
                }
                html[data-theme="light"] .btn-view {
                    background: #000000;
                    color: #ffffff;
                }

                .btn-edit {
                    background: transparent;
                    color: var(--text-primary);
                    border: 1px solid var(--border-subtle);
                }

                .btn-view:hover, .btn-edit:hover {
                    opacity: 0.8;
                }

                .btn-approve, .btn-reject, .btn-preview {
                    padding: 0.5rem 1rem;
                    border-radius: 6px;
                    font-size: 0.875rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: none;
                }

                .btn-approve {
                    background: #10B981;
                    color: white;
                }

                .btn-approve:hover {
                    background: #059669;
                }

                .btn-reject {
                    background: transparent;
                    color: #EF4444;
                    border: 1px solid #EF4444;
                }

                .btn-reject:hover {
                    background: #FEE2E2;
                }

                .btn-preview {
                    background: transparent;
                    color: var(--text-primary);
                    border: 1px solid var(--border-subtle);
                    text-decoration: none;
                    display: inline-block;
                }

                .btn-preview:hover {
                    background: var(--bg-surface-hover);
                }

                .pending-review {
                    border-left: 4px solid #F59E0B;
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

                .quick-nav-buttons {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                    width: 100%;
                }

                .btn-quick-nav {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 1.5rem;
                    background: var(--bg-surface);
                    color: var(--text-primary);
                    border: 1px solid var(--border-subtle);
                    border-radius: 12px;
                    text-decoration: none;
                    font-weight: 600;
                    font-size: 1rem;
                    transition: all 0.2s;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                }
                .btn-quick-nav:hover {
                    background: var(--bg-surface-hover);
                    border-color: var(--text-primary);
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                }

                .btn-delete {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    padding: 0.5rem 1rem;
                    border-radius: 6px;
                    text-decoration: none;
                    font-size: 0.875rem;
                    font-weight: 500;
                    border: none;
                    background: #EF4444;
                    color: white;
                    cursor: pointer;
                    transition: opacity 0.2s;
                }

                .btn-delete:hover {
                    opacity: 0.8;
                }

                .loading {
                    text-align: center;
                    padding: 4rem 1rem;
                    color: var(--text-secondary);
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

                    .filter-tabs {
                        width: 100%;
                    }

                    .filter-tabs button {
                        flex: 1;
                    }
                    
                    .quick-nav-buttons {
                         grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
}
