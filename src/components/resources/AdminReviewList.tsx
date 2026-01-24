import React, { useState, useEffect } from 'react';
import { getPendingResources, updateResourceStatus } from '../../lib/resources/db';
import type { HubResource } from '../../lib/resources/types';

// Simple mocked card for preview (or re-implement basic structure in React since Astro components can't be imported into React easily without hydration issues or just use HTML/CSS)
// Easier: Just show the raw data cleanly, or build a mini React Card.
const PreviewCard = ({ resource }: { resource: HubResource }) => (
    <div style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        overflow: 'hidden',
        width: '280px',
        fontSize: '14px',
        backgroundColor: 'var(--bg-surface)'
    }}>
        <div style={{ height: '140px', backgroundColor: '#eee', position: 'relative' }}>
            {resource.thumbnail_url && <img src={resource.thumbnail_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            <span style={{ position: 'absolute', top: 8, right: 8, background: 'white', padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>{resource.audience}</span>
        </div>
        <div style={{ padding: '12px' }}>
            <h4 style={{ fontWeight: 'bold', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{resource.title}</h4>
            <div style={{ display: 'flex', gap: '4px' }}>
                {resource.tags?.map(t => <span key={t.id} style={{ fontSize: '10px', background: '#eee', padding: '2px 4px', borderRadius: 4 }}>{t.name}</span>)}
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

    useEffect(() => {
        loadResources();
    }, []);

    const loadResources = async () => {
        setLoading(true);
        const data = await getPendingResources();
        setResources(data);
        setLoading(false);
    };

    const handleAction = async (id: string, status: 'approved' | 'rejected') => {
        if (!confirm(`Are you sure you want to ${status} this resource?`)) return;

        const result = await updateResourceStatus(id, status);
        if (result.success) {
            setResources(prev => prev.filter(r => r.id !== id));
        } else {
            alert('Error: ' + result.error);
        }
    };

    if (loading) return <div>Loading...</div>;
    if (resources.length === 0) return <div>No pending submissions.</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
            {resources.map(res => (
                <div key={res.id} style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '24px' }}>

                    {/* Preview Column */}
                    <div style={{ flexShrink: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-secondary)' }}>PREVIEW</div>
                        <PreviewCard resource={res} />
                    </div>

                    {/* Details Column */}
                    <div style={{ flexGrow: 1, minWidth: '300px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-secondary)' }}>DETAILS</div>

                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Title</div>
                            <div style={{ fontSize: '16px', fontWeight: '600' }}>{res.title}</div>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>URL</div>
                            <a href={res.url} target="_blank" style={{ color: 'blue', textDecoration: 'underline', wordBreak: 'break-all' }}>{res.url}</a>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Description</div>
                            <div>{res.description || 'No description'}</div>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Submitter</div>
                            <div>{res.submitter_profile?.full_name} (@{res.submitter_profile?.username})</div>
                        </div>
                    </div>

                    {/* Actions Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'flex-start', paddingTop: '24px' }}>
                        <button
                            className="btn-approve"
                            style={{ padding: '12px 24px', fontSize: '14px' }}
                            onClick={() => handleAction(res.id, 'approved')}
                        >
                            Approve & Publish
                        </button>
                        <button
                            className="btn-reject"
                            style={{ padding: '12px 24px', fontSize: '14px', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444' }}
                            onClick={() => handleAction(res.id, 'rejected')}
                        >
                            Reject
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
