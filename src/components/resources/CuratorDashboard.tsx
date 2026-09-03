import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { approveResource, rejectResource, getPendingResources, deleteResource, restoreResource, permanentDeleteResource, getDeletedResources, getAllResourcesAdmin } from '../../lib/resources/db';
import type { User } from '@supabase/supabase-js';
import TagInput from './TagInput';
import { uploadResourceThumbnail } from '../../lib/resources/storage';

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
    audience?: string | null;
    tags?: Array<{ id: string; name: string }>;
    status: 'pending' | 'approved' | 'rejected' | 'deleted';
    created_at: string;
    reviewed_at: string | null;
    rejection_reason: string | null;
    admin_notes?: string | null;
    submitted_by?: string;
    submitter_profile?: any;
}

interface CurationDraft {
    selectedTags: string[];
    thumbnailUrl: string;
    isUploading: boolean;
    uploadError: string | null;
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
    const [curationByResource, setCurationByResource] = useState<Record<string, CurationDraft>>({});
    const [moderationAction, setModerationAction] = useState<'approve' | 'reject' | null>(null);
    const [moderationTarget, setModerationTarget] = useState<Submission | null>(null);
    const [curatorMessage, setCuratorMessage] = useState('');
    const [isModerating, setIsModerating] = useState(false);
    const [moderationError, setModerationError] = useState<string | null>(null);

    const fetchData = async () => {
        if (!user) return;
        setLoading(true);
        setError(null);
        try {
            const requests: Promise<any>[] = [
                fetchSubmissions(user.id),
                fetchPendingSubmissions(),
                fetchDeletedSubmissions(),
                fetchGlobalResources()
            ];
            await Promise.all(requests);
        } catch (err: any) {
            console.error('Dashboard load error:', err);
            setError('Failed to load dashboard data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const refreshDataSilent = async () => {
        if (!user) return;
        try {
            const requests: Promise<any>[] = [
                fetchSubmissions(user.id),
                fetchPendingSubmissions(),
                fetchDeletedSubmissions(),
                fetchGlobalResources()
            ];
            await Promise.all(requests);
        } catch (err: any) {
            console.error('Background refresh error:', err);
        }
    };

    useEffect(() => {
        fetchData();

        // Auto-refresh every 60s silently in background
        const intervalId = setInterval(() => {
            refreshDataSilent();
        }, 60000);

        // Auto-refresh silently whenever curator switches back to window/tab
        const handleFocus = () => {
            refreshDataSilent();
        };
        window.addEventListener('focus', handleFocus);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
        };
    }, [user, role]);

    useEffect(() => {
        setCurationByResource(prev => {
            const next: Record<string, CurationDraft> = { ...prev };
            const pendingIds = new Set<string>();

            pendingSubmissions.forEach(submission => {
                pendingIds.add(submission.id);
                if (!next[submission.id]) {
                    next[submission.id] = {
                        selectedTags: submission.tags?.map(tag => tag.id) || [],
                        thumbnailUrl: submission.thumbnail_url || '',
                        isUploading: false,
                        uploadError: null
                    };
                }
            });

            Object.keys(next).forEach(resourceId => {
                if (!pendingIds.has(resourceId)) {
                    delete next[resourceId];
                }
            });

            return next;
        });
    }, [pendingSubmissions]);

    const handleRefresh = () => {
        fetchData();
    };

    const fetchSubmissions = async (userId: string) => {
        if (!supabase) return;

        const { data, error } = await supabase
            .from('hub_resources')
            .select('*')
            .eq('submitted_by', userId)
            .order('created_at', { ascending: false });

        if (!error && data) {
            setSubmissions(data as Submission[]);
        }
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

    const getDraft = (submission: Submission): CurationDraft => {
        return curationByResource[submission.id] || {
            selectedTags: submission.tags?.map(tag => tag.id) || [],
            thumbnailUrl: submission.thumbnail_url || '',
            isUploading: false,
            uploadError: null
        };
    };

    const setDraft = (resourceId: string, updates: Partial<CurationDraft>) => {
        setCurationByResource(prev => {
            const current = prev[resourceId] || {
                selectedTags: [],
                thumbnailUrl: '',
                isUploading: false,
                uploadError: null
            };

            return {
                ...prev,
                [resourceId]: {
                    ...current,
                    ...updates
                }
            };
        });
    };

    const handleThumbnailUpload = async (submission: Submission, file: File | null) => {
        if (!file) return;

        const resourceId = submission.id;
        setDraft(resourceId, { isUploading: true, uploadError: null });

        try {
            const { publicUrl } = await uploadResourceThumbnail(resourceId, file);
            setDraft(resourceId, {
                thumbnailUrl: publicUrl,
                isUploading: false,
                uploadError: null
            });
        } catch (uploadError: any) {
            setDraft(resourceId, {
                isUploading: false,
                uploadError: uploadError?.message || 'Failed to upload thumbnail.'
            });
        }
    };

    const handleApprove = async (submission: Submission, curatorNote?: string): Promise<{ success: boolean; error?: string }> => {
        const resourceId = submission.id;
        const draft = getDraft(submission);

        if (draft.isUploading) {
            return { success: false, error: 'Thumbnail upload is still in progress. Please wait.' };
        }

        // Optimistic Update
        const item = pendingSubmissions.find(s => s.id === resourceId);
        if (!item) return { success: false, error: 'Submission not found in pending list.' };

        setPendingSubmissions(prev => prev.filter(s => s.id !== resourceId));

        // If it was my submission, update status in main list
        setSubmissions(prev => prev.map(s => s.id === resourceId ? {
            ...s,
            status: 'approved',
            thumbnail_url: draft.thumbnailUrl || null
        } : s));

        // Attempt API
        const result = await approveResource(resourceId, {
            tag_ids: draft.selectedTags,
            thumbnail_url: draft.thumbnailUrl || null,
            audience: 'Designer',
            curator_note: curatorNote?.trim() || ''
        });
        if (!result.success) {
            // Revert on failure (simplified: just reload or show alert)
            fetchPendingSubmissions();
            if (user) fetchSubmissions(user.id);
            return { success: false, error: result.error || 'Failed to approve.' };
        }

        return { success: true };
    };

    const handleReject = async (resourceId: string, reason?: string): Promise<{ success: boolean; error?: string }> => {
        // Optimistic Update
        setPendingSubmissions(prev => prev.filter(s => s.id !== resourceId));
        setSubmissions(prev => prev.map(s => s.id === resourceId ? { ...s, status: 'rejected' } : s));

        const result = await rejectResource(resourceId, reason || '');
        if (!result.success) {
            fetchPendingSubmissions();
            return { success: false, error: result.error || 'Failed to reject.' };
        }

        return { success: true };
    };

    const openModerationDialog = (submission: Submission, action: 'approve' | 'reject') => {
        if (action === 'approve' && getDraft(submission).isUploading) {
            alert('Thumbnail upload is still in progress. Please wait.');
            return;
        }

        setModerationAction(action);
        setModerationTarget(submission);
        setCuratorMessage('');
        setModerationError(null);
    };

    const closeModerationDialog = () => {
        if (isModerating) return;
        setModerationAction(null);
        setModerationTarget(null);
        setCuratorMessage('');
        setModerationError(null);
    };

    const confirmModeration = async () => {
        if (!moderationAction || !moderationTarget) return;

        setIsModerating(true);
        setModerationError(null);

        const note = curatorMessage.trim();
        const result = moderationAction === 'approve'
            ? await handleApprove(moderationTarget, note)
            : await handleReject(moderationTarget.id, note);

        if (!result.success) {
            setModerationError(result.error || 'Action failed. Please try again.');
            setIsModerating(false);
            return;
        }

        setIsModerating(false);
        closeModerationDialog();
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

    const pendingCount = pendingSubmissions.length;
    const approvedCount = globalResources.length > 0 ? globalResources.filter(r => r.status === 'approved').length : submissions.filter(s => s.status === 'approved').length;
    const archivedCount = deletedSubmissions.length + submissions.filter(s => s.status === 'rejected').length;

    // Set initial filter tab to pending if there are pending items
    const activeFilter = filter === 'all' ? (pendingCount > 0 ? 'pending' : 'approved') : filter;

    return (
        <div className="curator-dashboard">
            <div className="curator-header">
                <div>
                    <h1>Curator Dashboard</h1>
                    <p className="welcome">Welcome back, {user?.user_metadata?.full_name || user?.email}!</p>

                    <div style={{ marginTop: '1.25rem' }}>
                        <a href="/resources/submit" className="btn-submit-new-prominent">
                            + Submit New Resource
                        </a>
                    </div>
                </div>
                <div className="dashboard-header-actions">
                    <a href="/resources" className="btn-back-logo">
                        Back to Resources ↗
                    </a>
                    {role === 'admin' && (
                        <a
                            href="/admin/dashboard"
                            className="btn-admin-panel"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Admin Panel ↗
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

            {/* Unified Curation Queue & Library */}
            <div className="submissions-section">
                <div className="section-header">
                    <h2>
                        {activeFilter === 'pending' && '⏱ Pending Submissions to Review'}
                        {activeFilter === 'approved' && '✓ Live Approved Resources'}
                        {activeFilter === 'history' && '📁 Archived & Rejected Submissions'}
                    </h2>
                    <div className="filter-tabs">
                        <button
                            className={activeFilter === 'pending' ? 'active' : ''}
                            onClick={() => setFilter('pending')}
                        >
                            ⏱ Pending Review ({pendingCount})
                        </button>
                        <button
                            className={activeFilter === 'approved' ? 'active' : ''}
                            onClick={() => setFilter('approved')}
                        >
                            ✓ Live on Hub ({approvedCount})
                        </button>
                        <button
                            className={activeFilter === 'history' ? 'active' : ''}
                            onClick={() => setFilter('history')}
                        >
                            📁 Archive & Trash ({archivedCount})
                        </button>
                    </div>
                </div>

                {/* 1. PENDING REVIEW TAB */}
                {activeFilter === 'pending' && (
                    <div className="submissions-list">
                        {pendingSubmissions.length === 0 ? (
                            <div className="empty-state" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🎉</div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px', color: 'var(--pop-ink)' }}>No pending submissions!</h3>
                                <p style={{ color: 'rgba(21, 19, 15, 0.75)', margin: 0 }}>All submitted resources have been reviewed.</p>
                            </div>
                        ) : (
                            pendingSubmissions.map(submission => (
                                <div key={submission.id} className="submission-card pending-review" style={{ background: 'var(--pop-cream)', border: '1px solid var(--pop-border)', borderRadius: '20px', padding: '24px', marginBottom: '16px' }}>
                                    <div className="card-content">
                                        <div className="submission-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '8px' }}>
                                            <h3 style={{ font: '620 1.4rem/1.2 var(--resources-font)', color: 'var(--pop-ink)', margin: 0 }}>{submission.title}</h3>
                                            <span
                                                className="status-badge"
                                                style={{
                                                    background: 'var(--pop-yellow)',
                                                    color: 'var(--pop-ink)',
                                                    border: '1px solid var(--pop-border)',
                                                    fontSize: '0.72rem',
                                                    padding: '4px 10px',
                                                    borderRadius: '100px',
                                                    fontWeight: 800,
                                                    letterSpacing: '0.08em',
                                                    textTransform: 'uppercase'
                                                }}
                                            >
                                                ⏱ pending review
                                            </span>
                                        </div>
                                        <p className="submission-url" style={{ color: 'rgba(21, 19, 15, 0.75)', fontSize: '0.9rem', margin: '0 0 12px 0', wordBreak: 'break-all' }}>{submission.url}</p>
                                        {submission.description && (
                                            <p className="submission-description" style={{ color: 'var(--pop-ink)', fontSize: '0.98rem', lineHeight: '1.5', margin: '0 0 16px 0' }}>{submission.description}</p>
                                        )}

                                        {/* Curation Controls: Tags & Thumbnail */}
                                        <div className="curation-box">
                                            <div className="curation-row">
                                                <label className="curation-label" style={{ display: 'block', font: '750 0.7rem/1.3 var(--resources-mono)', letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--pop-ink)', marginBottom: '8px' }}>Assign Curator Tags</label>
                                                <TagInput
                                                    selectedTags={getDraft(submission).selectedTags}
                                                    onChange={(newTags) => setDraft(submission.id, { selectedTags: newTags })}
                                                    maxTags={5}
                                                />
                                            </div>

                                            <div className="curation-row" style={{ borderTop: '1px solid rgba(21, 19, 15, 0.1)', paddingTop: '14px' }}>
                                                <label className="curation-label" htmlFor={`thumbnail-upload-${submission.id}`} style={{ display: 'block', font: '750 0.7rem/1.3 var(--resources-mono)', letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--pop-ink)', marginBottom: '8px' }}>Upload Custom Thumbnail (Optional)</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                                    <input
                                                        id={`thumbnail-upload-${submission.id}`}
                                                        type="file"
                                                        accept="image/*"
                                                        className="thumbnail-upload-input"
                                                        style={{ font: '500 0.85rem var(--resources-font)', maxWidth: '280px' }}
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0] || null;
                                                            handleThumbnailUpload(submission, file);
                                                            e.currentTarget.value = '';
                                                        }}
                                                    />
                                                    {getDraft(submission).isUploading && (
                                                        <p className="thumbnail-upload-status" style={{ color: 'var(--pop-blue)', fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>Uploading thumbnail...</p>
                                                    )}
                                                    {getDraft(submission).uploadError && (
                                                        <p className="thumbnail-upload-error" style={{ color: '#b91c1c', fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>{getDraft(submission).uploadError}</p>
                                                    )}
                                                    {getDraft(submission).thumbnailUrl && (
                                                        <img
                                                            src={getDraft(submission).thumbnailUrl}
                                                            alt={`Thumbnail preview for ${submission.title}`}
                                                            style={{ width: '100px', height: '56px', objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--pop-border)' }}
                                                            loading="lazy"
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="submission-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                                            <button
                                                onClick={() => openModerationDialog(submission, 'approve')}
                                                className="btn-approve"
                                            >
                                                ✓ Approve & Publish
                                            </button>
                                            <button
                                                onClick={() => openModerationDialog(submission, 'reject')}
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
                                                Visit Link ↗
                                            </a>
                                            {role === 'admin' && (
                                                <button
                                                    onClick={() => handleDelete(submission.id)}
                                                    className="btn-delete"
                                                    title="Move to Trash"
                                                >
                                                    🗑 Delete
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* 2. APPROVED LIVE LIBRARY TAB */}
                {activeFilter === 'approved' && (
                    <div className="submissions-list">
                        {(globalResources.length > 0 ? globalResources.filter(r => r.status === 'approved') : submissions.filter(s => s.status === 'approved')).length === 0 ? (
                            <div className="empty-state" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                                <p style={{ color: 'rgba(21, 19, 15, 0.75)' }}>No approved resources yet.</p>
                            </div>
                        ) : (
                            (globalResources.length > 0 ? globalResources.filter(r => r.status === 'approved') : submissions.filter(s => s.status === 'approved')).map(submission => (
                                <div key={submission.id} className="submission-card" style={{ background: 'var(--pop-cream)', border: '1px solid var(--pop-border)', borderRadius: '20px', padding: '20px', marginBottom: '12px' }}>
                                    <div className="card-content">
                                        <div className="submission-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '6px' }}>
                                            <h3 style={{ font: '620 1.25rem/1.2 var(--resources-font)', color: 'var(--pop-ink)', margin: 0 }}>{submission.title}</h3>
                                            <span
                                                className="status-badge"
                                                style={{
                                                    background: 'var(--pop-lime)',
                                                    color: 'var(--pop-ink)',
                                                    border: '1px solid var(--pop-border)',
                                                    fontSize: '0.68rem',
                                                    padding: '3px 8px',
                                                    borderRadius: '100px',
                                                    fontWeight: 800,
                                                    textTransform: 'uppercase'
                                                }}
                                            >
                                                ✓ Approved
                                            </span>
                                        </div>
                                        <p className="submission-url" style={{ color: 'rgba(21, 19, 15, 0.75)', fontSize: '0.85rem', margin: '0 0 12px 0', wordBreak: 'break-all' }}>{submission.url}</p>
                                        <div className="submission-actions" style={{ display: 'flex', gap: '8px' }}>
                                            <a href={`/resources/${submission.id}`} className="btn-view">View Resource ↗</a>
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
                            ))
                        )}
                    </div>
                )}

                {/* 3. ARCHIVE & TRASH TAB */}
                {activeFilter === 'history' && (
                    <div className="submissions-list">
                        {[...deletedSubmissions, ...submissions.filter(s => s.status === 'rejected')].length === 0 ? (
                            <div className="empty-state" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                                <p style={{ color: 'rgba(21, 19, 15, 0.75)' }}>No archived or deleted submissions.</p>
                            </div>
                        ) : (
                            [...deletedSubmissions, ...submissions.filter(s => s.status === 'rejected')].map(submission => (
                                <div key={submission.id} className="submission-card" style={{ background: 'var(--pop-cream)', border: '1px solid var(--pop-border)', borderRadius: '20px', padding: '20px', marginBottom: '12px' }}>
                                    <div className="card-content">
                                        <div className="submission-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '6px' }}>
                                            <h3 style={{ font: '620 1.25rem/1.2 var(--resources-font)', color: 'var(--pop-ink)', margin: 0 }}>{submission.title}</h3>
                                            <span
                                                className="status-badge"
                                                style={{
                                                    background: submission.status === 'rejected' ? 'var(--pop-orange)' : 'var(--pop-pink)',
                                                    color: 'var(--pop-ink)',
                                                    border: '1px solid var(--pop-border)',
                                                    fontSize: '0.68rem',
                                                    padding: '3px 8px',
                                                    borderRadius: '100px',
                                                    fontWeight: 800,
                                                    textTransform: 'uppercase'
                                                }}
                                            >
                                                {submission.status === 'rejected' ? '✗ Rejected' : '🗑 In Trash'}
                                            </span>
                                        </div>
                                        <p className="submission-url" style={{ color: 'rgba(21, 19, 15, 0.75)', fontSize: '0.85rem', margin: '0 0 8px 0', wordBreak: 'break-all' }}>{submission.url}</p>
                                        {(submission.admin_notes || submission.rejection_reason) && (
                                            <div className="rejection-reason" style={{ background: 'var(--pop-yellow)', border: '1px solid var(--pop-border)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--pop-ink)', margin: '8px 0 12px' }}>
                                                <strong>Curator Note:</strong> {submission.admin_notes || submission.rejection_reason}
                                            </div>
                                        )}
                                        <div className="submission-actions" style={{ display: 'flex', gap: '8px' }}>
                                            {role === 'admin' && submission.status === 'deleted' && (
                                                <>
                                                    <button onClick={() => handleRestore(submission.id)} className="btn-approve">
                                                        Restore
                                                    </button>
                                                    <button onClick={() => handlePermanentDelete(submission.id)} className="btn-delete">
                                                        Delete Forever
                                                    </button>
                                                </>
                                            )}
                                            {submission.status === 'rejected' && (
                                                <a href={`/resources/${submission.id}`} className="btn-preview">View Details ↗</a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {moderationAction && moderationTarget && (
                <div className="moderation-modal-backdrop" onClick={closeModerationDialog}>
                    <div className="moderation-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
                        <h3>{moderationAction === 'approve' ? 'Approve Submission' : 'Reject Submission'}</h3>
                        <p className="moderation-modal-subtitle">
                            Add a curator message (optional). An email is sent only when this message is provided.
                        </p>
                        <p className="moderation-modal-resource">
                            <strong>Resource:</strong> {moderationTarget.title}
                        </p>
                        <label className="curation-label" htmlFor="moderation-note-input">Curator message</label>
                        <textarea
                            id="moderation-note-input"
                            className="moderation-note-input"
                            value={curatorMessage}
                            onChange={(e) => setCuratorMessage(e.target.value)}
                            placeholder="Write why you are approving or rejecting (optional)"
                            rows={5}
                            disabled={isModerating}
                        />
                        {moderationError && (
                            <p className="moderation-error">{moderationError}</p>
                        )}
                        <div className="moderation-actions">
                            <button className="btn-preview" onClick={closeModerationDialog} disabled={isModerating}>
                                Cancel
                            </button>
                            <button
                                className={moderationAction === 'approve' ? 'btn-approve' : 'btn-delete'}
                                onClick={confirmModeration}
                                disabled={isModerating}
                            >
                                {isModerating
                                    ? (moderationAction === 'approve' ? 'Approving...' : 'Rejecting...')
                                    : (moderationAction === 'approve' ? 'Confirm Approve' : 'Confirm Reject')}
                            </button>
                        </div>
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

                .dashboard-header-actions {
                    display: flex;
                    gap: 1.5rem;
                    align-items: center;
                    flex-wrap: wrap;
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
                    font-family: var(--font-ui); /* Monospace font */
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
                    font-family: var(--font-ui); /* Consistent font */
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
                    background: var(--bg-surface-hover);
                    color: var(--text-secondary);
                    border: 1px solid var(--border-subtle);
                    border-left: 3px solid var(--border-strong);
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

                .curation-box {
                    margin-bottom: 1rem;
                    padding: 0.875rem;
                    border: 1px solid var(--border-subtle);
                    border-radius: 8px;
                    background: var(--bg-surface-hover);
                }

                .curation-row + .curation-row {
                    margin-top: 0.875rem;
                }

                .curation-label {
                    display: block;
                    margin-bottom: 0.5rem;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }

                .thumbnail-upload-input {
                    width: 100%;
                    font-size: 0.9rem;
                    color: var(--text-primary);
                }

                .thumbnail-upload-status {
                    margin: 0.5rem 0 0;
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                }

                .thumbnail-upload-error {
                    margin: 0.5rem 0 0;
                    font-size: 0.8rem;
                    color: #EF4444;
                }

                .curation-thumbnail-preview {
                    margin-top: 0.625rem;
                    width: 100%;
                    max-height: 180px;
                    object-fit: cover;
                    border-radius: 6px;
                    border: 1px solid var(--border-subtle);
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

                .moderation-modal-backdrop {
                    position: fixed;
                    inset: 0;
                    background: rgba(21, 19, 15, 0.65);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    padding: 1rem;
                }

                .moderation-modal {
                    width: min(560px, 100%);
                    background: var(--pop-cream, #fff8e8);
                    border: 1px solid var(--pop-border, rgba(21, 19, 15, 0.78));
                    border-radius: 20px;
                    padding: 28px;
                    box-shadow: 0 20px 50px rgba(21, 19, 15, 0.25);
                    color: var(--pop-ink, #15130f);
                }

                .moderation-modal h3 {
                    margin: 0 0 0.5rem;
                    font: 720 1.6rem/1.1 var(--resources-font, sans-serif);
                    color: var(--pop-ink, #15130f);
                }

                .moderation-modal-subtitle {
                    margin: 0 0 0.75rem;
                    color: rgba(21, 19, 15, 0.8);
                    font: 450 0.92rem/1.4 var(--resources-font, sans-serif);
                }

                .moderation-modal-resource {
                    margin: 0 0 1rem;
                    color: var(--pop-ink, #15130f);
                    font: 600 0.95rem/1.4 var(--resources-font, sans-serif);
                    background: var(--pop-yellow, #ffe44f);
                    padding: 8px 12px;
                    border-radius: 8px;
                    border: 1px solid var(--pop-border, rgba(21, 19, 15, 0.78));
                }

                .moderation-note-input {
                    width: 100%;
                    border: 1px solid var(--pop-border, rgba(21, 19, 15, 0.78));
                    border-radius: 12px;
                    background: var(--pop-cream, #fff8e8);
                    color: var(--pop-ink, #15130f);
                    padding: 12px;
                    resize: vertical;
                    min-height: 120px;
                    font: 450 0.95rem/1.4 var(--resources-font, sans-serif);
                }

                .moderation-note-input:focus {
                    outline: 3px solid var(--pop-purple, #5524c7);
                    outline-offset: 2px;
                }

                .moderation-error {
                    margin: 0.75rem 0 0;
                    color: #b91c1c;
                    font-weight: 700;
                    font-size: 0.85rem;
                }

                .moderation-actions {
                    margin-top: 1.5rem;
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.75rem;
                    flex-wrap: wrap;
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

                    .dashboard-header-actions {
                        width: 100%;
                        flex-direction: column;
                        align-items: stretch;
                    }

                    .dashboard-header-actions > * {
                        width: 100%;
                        justify-content: center;
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
