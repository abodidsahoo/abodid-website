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

    const handleApprove = async (resource: HubResource) => {
        const draft = getDraft(resource);

        if (draft.isUploading) {
            alert('Thumbnail upload is still in progress. Please wait.');
            return;
        }

        const result = await approveResource(resource.id, {
            tag_ids: draft.selectedTags,
            thumbnail_url: draft.thumbnailUrl || null,
            audience: 'Designer'
        });

        if (result.success) {
            setResources(prev => prev.filter(r => r.id !== resource.id));
        } else {
            alert('Error: ' + result.error);
        }
    };

    const handleReject = async (resource: HubResource) => {
        const reason = prompt('Reason for rejection?');
        if (reason === null) return;

        const result = await rejectResource(resource.id, reason);
        if (result.success) {
            setResources(prev => prev.filter(r => r.id !== resource.id));
        } else {
            alert('Error: ' + result.error);
        }
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
                                onClick={() => handleApprove(resource)}
                                disabled={draft.isUploading}
                            >
                                Approve & Publish
                            </button>
                            <button
                                className="btn-reject"
                                style={{ padding: '12px 24px', fontSize: '14px', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444' }}
                                onClick={() => handleReject(resource)}
                            >
                                Reject
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
