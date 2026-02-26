import React, { useEffect, useState } from 'react';
import { approveResource, getPendingResources, rejectResource } from '../../lib/resources/db';
import type { HubResource } from '../../lib/resources/types';
import TagInput from './TagInput';
import { uploadResourceThumbnail } from '../../lib/resources/storage';

interface CurationDraft {
    selectedTags: string[];
    thumbnailUrl: string;
    isUploading: boolean;
    uploadError: string | null;
}

const PreviewCard = ({ resource, thumbnailOverride }: { resource: HubResource; thumbnailOverride?: string }) => (
    <div style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        overflow: 'hidden',
        width: '280px',
        fontSize: '14px',
        backgroundColor: 'var(--bg-surface)'
    }}>
        <div style={{ height: '140px', backgroundColor: '#eee', position: 'relative' }}>
            {(thumbnailOverride || resource.thumbnail_url) && (
                <img
                    src={thumbnailOverride || resource.thumbnail_url || ''}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
            )}
            {resource.audience && (
                <span style={{ position: 'absolute', top: 8, right: 8, background: 'white', padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>
                    {resource.audience}
                </span>
            )}
        </div>
        <div style={{ padding: '12px' }}>
            <h4 style={{ fontWeight: 'bold', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{resource.title}</h4>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {resource.tags?.map(t => (
                    <span key={t.id} style={{ fontSize: '10px', background: '#eee', padding: '2px 6px', borderRadius: 4 }}>
                        #{t.name}
                    </span>
                ))}
            </div>
            <div style={{ fontSize: '11px', color: '#666', marginTop: '8px' }}>
                by @{resource.submitter_profile?.username}
            </div>
        </div>
    </div>
);

export default function AdminReviewList() {
    const [resources, setResources] = useState<HubResource[]>([]);
    const [loading, setLoading] = useState(true);
    const [curationByResource, setCurationByResource] = useState<Record<string, CurationDraft>>({});
    const [moderationAction, setModerationAction] = useState<'approve' | 'reject' | null>(null);
    const [moderationTarget, setModerationTarget] = useState<HubResource | null>(null);
    const [curatorMessage, setCuratorMessage] = useState('');
    const [isModerating, setIsModerating] = useState(false);
    const [moderationError, setModerationError] = useState<string | null>(null);

    useEffect(() => {
        loadResources();
    }, []);

    useEffect(() => {
        setCurationByResource(prev => {
            const next: Record<string, CurationDraft> = { ...prev };
            const ids = new Set<string>();

            resources.forEach(resource => {
                ids.add(resource.id);
                if (!next[resource.id]) {
                    next[resource.id] = {
                        selectedTags: resource.tags?.map(tag => tag.id) || [],
                        thumbnailUrl: resource.thumbnail_url || '',
                        isUploading: false,
                        uploadError: null
                    };
                }
            });

            Object.keys(next).forEach(id => {
                if (!ids.has(id)) delete next[id];
            });

            return next;
        });
    }, [resources]);

    const loadResources = async () => {
        setLoading(true);
        const data = await getPendingResources();
        setResources(data);
        setLoading(false);
    };

    const getDraft = (resource: HubResource): CurationDraft => {
        return curationByResource[resource.id] || {
            selectedTags: resource.tags?.map(tag => tag.id) || [],
            thumbnailUrl: resource.thumbnail_url || '',
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

    const handleThumbnailUpload = async (resource: HubResource, file: File | null) => {
        if (!file) return;

        setDraft(resource.id, { isUploading: true, uploadError: null });

        try {
            const { publicUrl } = await uploadResourceThumbnail(resource.id, file);
            setDraft(resource.id, {
                thumbnailUrl: publicUrl,
                isUploading: false,
                uploadError: null
            });
        } catch (error: any) {
            setDraft(resource.id, {
                isUploading: false,
                uploadError: error?.message || 'Failed to upload thumbnail.'
            });
        }
    };

    const handleApprove = async (resource: HubResource, note?: string): Promise<{ success: boolean; error?: string }> => {
        const draft = getDraft(resource);

        if (draft.isUploading) {
            return { success: false, error: 'Thumbnail upload is still in progress. Please wait.' };
        }

        const result = await approveResource(resource.id, {
            tag_ids: draft.selectedTags,
            thumbnail_url: draft.thumbnailUrl || null,
            audience: 'Designer',
            curator_note: note?.trim() || ''
        });

        if (result.success) {
            setResources(prev => prev.filter(r => r.id !== resource.id));
            return { success: true };
        } else {
            return { success: false, error: result.error || 'Failed to approve' };
        }
    };

    const handleReject = async (resource: HubResource, reason?: string): Promise<{ success: boolean; error?: string }> => {
        const result = await rejectResource(resource.id, reason || '');
        if (result.success) {
            setResources(prev => prev.filter(r => r.id !== resource.id));
            return { success: true };
        } else {
            return { success: false, error: result.error || 'Failed to reject' };
        }
    };

    const openModerationDialog = (resource: HubResource, action: 'approve' | 'reject') => {
        const draft = getDraft(resource);
        if (action === 'approve' && draft.isUploading) {
            alert('Thumbnail upload is still in progress. Please wait.');
            return;
        }

        setModerationAction(action);
        setModerationTarget(resource);
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
            : await handleReject(moderationTarget, note);

        if (!result.success) {
            setModerationError(result.error || 'Action failed. Please try again.');
            setIsModerating(false);
            return;
        }

        setIsModerating(false);
        closeModerationDialog();
    };

    if (loading) return <div>Loading...</div>;
    if (resources.length === 0) return <div>No pending submissions.</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
            {resources.map(resource => {
                const draft = getDraft(resource);

                return (
                    <div key={resource.id} style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '24px' }}>
                        <div style={{ flexShrink: 0 }}>
                            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-secondary)' }}>PREVIEW</div>
                            <PreviewCard resource={resource} thumbnailOverride={draft.thumbnailUrl} />
                        </div>

                        <div style={{ flexGrow: 1, minWidth: '320px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-secondary)' }}>DETAILS</div>

                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Title</div>
                                <div style={{ fontSize: '16px', fontWeight: '600' }}>{resource.title}</div>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>URL</div>
                                <a href={resource.url} target="_blank" rel="noopener noreferrer" style={{ color: 'blue', textDecoration: 'underline', wordBreak: 'break-all' }}>{resource.url}</a>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Why useful?</div>
                                <div>{resource.description || 'No description provided.'}</div>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Submitter</div>
                                <div>{resource.submitter_profile?.full_name} (@{resource.submitter_profile?.username})</div>
                            </div>

                            <div style={{
                                marginBottom: '16px',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '8px',
                                padding: '12px',
                                background: 'var(--bg-surface-hover)'
                            }}>
                                <div style={{ marginBottom: '12px' }}>
                                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '6px' }}>Curator tags</div>
                                    <TagInput
                                        selectedTags={draft.selectedTags}
                                        onChange={(newTags) => setDraft(resource.id, { selectedTags: newTags })}
                                        maxTags={5}
                                    />
                                </div>

                                <div>
                                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '6px' }}>Add thumbnail</div>
                                    <input
                                        id={`legacy-upload-${resource.id}`}
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0] || null;
                                            handleThumbnailUpload(resource, file);
                                            e.currentTarget.value = '';
                                        }}
                                    />
                                    {draft.isUploading && <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>Uploading thumbnail...</div>}
                                    {draft.uploadError && <div style={{ marginTop: '8px', fontSize: '12px', color: '#EF4444' }}>{draft.uploadError}</div>}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'flex-start', paddingTop: '24px' }}>
                            <button
                                className="btn-approve"
                                style={{ padding: '12px 24px', fontSize: '14px' }}
                                onClick={() => openModerationDialog(resource, 'approve')}
                                disabled={draft.isUploading}
                            >
                                Approve & Publish
                            </button>
                            <button
                                className="btn-reject"
                                style={{ padding: '12px 24px', fontSize: '14px', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444' }}
                                onClick={() => openModerationDialog(resource, 'reject')}
                            >
                                Reject
                            </button>
                        </div>
                    </div>
                );
            })}

            {moderationAction && moderationTarget && (
                <div
                    onClick={closeModerationDialog}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.45)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: '1rem'
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: 'min(560px, 100%)',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '12px',
                            padding: '1rem',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.25)'
                        }}
                    >
                        <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
                            {moderationAction === 'approve' ? 'Approve Submission' : 'Reject Submission'}
                        </h3>
                        <p style={{ margin: '0 0 12px 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Add a curator message (optional). Email is sent only when this message is provided.
                        </p>
                        <p style={{ margin: '0 0 12px 0', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                            <strong>Resource:</strong> {moderationTarget.title}
                        </p>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                            Curator message
                        </label>
                        <textarea
                            value={curatorMessage}
                            onChange={(e) => setCuratorMessage(e.target.value)}
                            placeholder="Write why you are approving or rejecting (optional)"
                            rows={5}
                            disabled={isModerating}
                            style={{
                                width: '100%',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '8px',
                                background: 'var(--bg-surface-hover)',
                                color: 'var(--text-primary)',
                                padding: '0.75rem',
                                resize: 'vertical',
                                minHeight: '120px',
                                fontSize: '0.95rem'
                            }}
                        />
                        {moderationError && (
                            <p style={{ margin: '12px 0 0', color: '#EF4444', fontSize: '0.85rem' }}>
                                {moderationError}
                            </p>
                        )}
                        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
                            <button className="btn-preview" onClick={closeModerationDialog} disabled={isModerating}>
                                Cancel
                            </button>
                            <button
                                className={moderationAction === 'approve' ? 'btn-approve' : 'btn-reject'}
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
        </div>
    );
}
