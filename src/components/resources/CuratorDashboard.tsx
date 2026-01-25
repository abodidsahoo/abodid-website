import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { approveResource, rejectResource, getPendingResources } from '../../lib/resources/db';
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
    status: 'pending' | 'approved' | 'rejected';
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
    const [filter, setFilter] = useState('all'); // all, pending, approved, rejected

    useEffect(() => {
        if (user) {
            initDashboard();
        }
    }, [user]);

    const initDashboard = async () => {
        setLoading(true);
        await fetchSubmissions(user.id);

        // Only fetch pending if curator/admin
        if (role === 'curator' || role === 'admin') {
            await fetchPendingSubmissions();
        }
        setLoading(false);
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

    const handleApprove = async (resourceId: string) => {
        const result = await approveResource(resourceId);
        if (result.success) {
            // Refresh pending list
            fetchPendingSubmissions();
            // Optionally refresh own submissions if this was theirs
            if (user) fetchSubmissions(user.id);
        } else {
            alert(result.error || 'Failed to approve');
        }
    };

    const handleReject = async (resourceId: string) => {
        const reason = prompt('Reason for rejection (optional):');

        // Call API that handles both rejection and email
        try {
            // Get auth token
            const { data: { session } } = await supabase!.auth.getSession();

            const response = await fetch('/api/resources/reject', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    resourceId,
                    reason: reason || 'No specific reason provided'
                })
            });

            const result = await response.json();

            if (result.success) {
                // Feedback about email
                if (result.emailResult?.sent) {
                    alert(`Submission rejected.\nExample email sent to submitter.`);
                } else {
                    alert(`Submission rejected (Saved to DB).\n⚠️ Email Failed: ${result.emailResult?.reason}\n\nCheck your Resend domain verification.`);
                }

                // Refresh both pending submissions and own submissions
                await fetchPendingSubmissions();
                if (user) await fetchSubmissions(user.id);
            } else {
                alert(result.error || 'Failed to reject');
            }
        } catch (error) {
            console.error('Rejection failed:', error);
            alert('Failed to reject submission');
        }
    };

    const filteredSubmissions = submissions.filter(sub => {
        if (filter === 'all') return true;
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

    const pendingCount = submissions.filter(s => s.status === 'pending').length;
    const approvedCount = submissions.filter(s => s.status === 'approved').length;
    const rejectedCount = submissions.filter(s => s.status === 'rejected').length;

    return (
        <div className="curator-dashboard">
            <div className="curator-header">
                <div>
                    <h1>Curator Dashboard</h1>
                    <p className="welcome">Welcome back, {user?.user_metadata?.full_name || user?.email}!</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {role === 'admin' && (
                        <a href="/admin/dashboard" className="btn-admin-panel">
                            Admin Panel
                        </a>
                    )}
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
            </div>

            <div className="submissions-section">
                <div className="section-header">
                    <h2>My Submissions</h2>
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
                    </div>
                </div>

                {filteredSubmissions.length === 0 ? (
                    <div className="empty-state">
                        <p>No submissions found.</p>
                        <a href="/resources/submit" className="btn-secondary">Submit Your First Resource</a>
                    </div>
                ) : (
                    <div className="submissions-list">
                        {filteredSubmissions.map(submission => (
                            <div key={submission.id} className="submission-card">
                                <div className="submission-header">
                                    <h3>{submission.title}</h3>
                                    <span
                                        className="status-badge"
                                        style={{
                                            background: getStatusColor(submission.status),
                                            color: 'white'
                                        }}
                                    >
                                        {getStatusIcon(submission.status)} {submission.status}
                                    </span>
                                </div>
                                <p className="submission-url">{submission.url}</p>
                                {submission.description && (
                                    <p className="submission-description">{submission.description}</p>
                                )}
                                <div className="submission-meta">
                                    <span>Submitted {new Date(submission.created_at).toLocaleDateString()}</span>
                                    {submission.reviewed_at && (
                                        <span>• Reviewed {new Date(submission.reviewed_at).toLocaleDateString()}</span>
                                    )}
                                </div>
                                {submission.rejection_reason && (
                                    <div className="rejection-reason">
                                        <strong>Rejection reason:</strong> {submission.rejection_reason}
                                    </div>
                                )}
                                <div className="submission-actions">
                                    {submission.status === 'approved' && (
                                        <a href={`/resources/${submission.id}`} className="btn-view">View Resource</a>
                                    )}
                                    {submission.status === 'pending' && (
                                        <a href={`/resources/submit?edit=${submission.id}`} className="btn-edit">Edit</a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
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
                                <div className="submission-header">
                                    <h3>{submission.title}</h3>
                                    <span
                                        className="status-badge"
                                        style={{
                                            background: '#F59E0B',
                                            color: 'white'
                                        }}
                                    >
                                        ⏱ pending
                                    </span>
                                </div>
                                <p className="submission-url">{submission.url}</p>
                                {submission.description && (
                                    <p className="submission-description">{submission.description}</p>
                                )}
                                <div className="submission-meta">
                                    <span>Submitted by {submission.submitter_profile?.full_name || submission.submitter_profile?.username || 'Unknown'}</span>
                                    <span>• {new Date(submission.created_at).toLocaleDateString()}</span>
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
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="quick-links">
                <a href="/resources" className="link-card">
                    <span className="icon">🔍</span>
                    <div>
                        <h3>Browse Resources</h3>
                        <p>Explore all approved resources</p>
                    </div>
                </a>
                <a href="/resources/saved" className="link-card">
                    <span className="icon">💾</span>
                    <div>
                        <h3>Saved Resources</h3>
                        <p>View your saved collection</p>
                    </div>
                </a>
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

                .btn-admin-panel {
                    background: #334155;
                    color: white;
                    padding: 0.875rem 1.5rem;
                    border-radius: 8px;
                    text-decoration: none;
                    font-weight: 600;
                    transition: all 0.2s;
                    white-space: nowrap;
                    border: 1px solid var(--border-subtle);
                }

                .btn-admin-panel:hover {
                    background: #1e293b;
                    border-color: var(--text-primary);
                    transform: translateY(-1px);
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

                .stat-card.pending {
                    border-color: #F59E0B;
                }

                .stat-card.approved {
                    border-color: #10B981;
                }

                .stat-card.rejected {
                    border-color: #EF4444;
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

                .pending-count {
                    background: #F59E0B;
                    color: white;
                    padding: 0.25rem 0.75rem;
                    border-radius: 100px;
                    font-size: 0.875rem;
                    font-weight: 600;
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
                }

                .btn-view, .btn-edit {
                    padding: 0.5rem 1rem;
                    border-radius: 6px;
                    text-decoration: none;
                    font-size: 0.875rem;
                    font-weight: 500;
                    transition: opacity 0.2s;
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

                .quick-links {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 1rem;
                }

                .link-card {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1.5rem;
                    background: var(--bg-surface);
                    border: 1px solid var(--border-subtle);
                    border-radius: 12px;
                    text-decoration: none;
                    transition: all 0.2s;
                }

                .link-card:hover {
                    border-color: var(--text-primary);
                    transform: translateY(-2px);
                }

                .link-card .icon {
                    font-size: 2rem;
                }

                .link-card h3 {
                    margin: 0 0 0.25rem 0;
                    font-size: 1rem;
                    color: var(--text-primary);
                }

                .link-card p {
                    margin: 0;
                    font-size: 0.875rem;
                    color: var(--text-secondary);
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
                }
            `}</style>
        </div>
    );
}
