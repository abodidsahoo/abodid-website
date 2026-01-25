import React, { useState } from 'react';
import { restoreResource, permanentDeleteResource } from '../../lib/resources/db';

interface Props {
    resourceId: string;
}

export default function AdminTrashActions({ resourceId }: Props) {
    const [loading, setLoading] = useState(false);

    const handleRestore = async () => {
        if (!confirm('Restore this resource to pending status?')) return;
        setLoading(true);
        const result = await restoreResource(resourceId);
        if (result.success) {
            alert('Resource restored!');
            window.location.reload();
        } else {
            alert('Failed to restore: ' + result.error);
            setLoading(false);
        }
    };

    const handleDeleteForever = async () => {
        if (!confirm('ARE YOU SURE? This will permanently delete the resource logic and cannot be undone.')) return;
        setLoading(true);
        const result = await permanentDeleteResource(resourceId);
        if (result.success) {
            alert('Resource permanently deleted.');
            window.location.href = '/resources';
        } else {
            alert('Failed to delete: ' + result.error);
            setLoading(false);
        }
    };

    if (loading) return <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Processing...</span>;

    return (
        <div style={{ display: 'flex', gap: '1rem' }}>
            <button
                onClick={handleRestore}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: '#10B981',
                    color: 'white',
                    border: 'none',
                    padding: '0.6rem 1.2rem',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                }}
            >
                ↻ Restore
            </button>
            <button
                onClick={handleDeleteForever}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: '#EF4444',
                    color: 'white',
                    border: 'none',
                    padding: '0.6rem 1.2rem',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                }}
            >
                ⚠ Delete Forever
            </button>
        </div>
    );
}
