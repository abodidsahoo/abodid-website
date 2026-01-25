import React, { useState, useEffect } from 'react';
import { updateResource, getAllTags, deleteResource } from '../../lib/resources/db';
import type { HubResource, HubTag, ResourceAudience } from '../../lib/resources/types';
import TagInput from './TagInput';

interface Props {
    resource: HubResource; // Initial data
}

export default function EditResourceForm({ resource }: Props) {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Data for Selects
    const [tagsDropdown, setTagsDropdown] = useState<HubTag[]>([]);

    // Form State
    const [formData, setFormData] = useState({
        title: resource.title,
        url: resource.url,
        description: resource.description || '',
        audience: resource.audience || 'Designer',
        thumbnail_url: resource.thumbnail_url || '',
        credit_text: resource.credit_text || '',
        selectedTags: resource.tags ? resource.tags.map(t => t.id) : [] as string[]
    });

    useEffect(() => {
        // Load autocomplete options
        getAllTags().then(setTagsDropdown);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(false);

        const result = await updateResource(resource.id, {
            title: formData.title,
            url: formData.url,
            description: formData.description,
            audience: formData.audience as ResourceAudience,
            thumbnail_url: formData.thumbnail_url || undefined,
            credit_text: formData.credit_text || undefined,
            tag_ids: formData.selectedTags
        });

        setLoading(false);

        if (result.success) {
            setSuccess(true);
            // Wait a sec then redirect back to detail view
            setTimeout(() => {
                window.location.href = `/resources/${resource.id}`;
            }, 1000);
        } else {
            setError(result.error || 'Update failed.');
        }
    };

    return (
        <div className="hub-form-container">
            <form onSubmit={handleSubmit} className="hub-form">
                <h2 style={{ marginBottom: '24px' }}>Edit Resource</h2>

                {error && (
                    <div style={{ padding: '12px', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', marginBottom: '16px' }}>
                        {error}
                    </div>
                )}

                {success && (
                    <div style={{ padding: '12px', background: '#dcfce7', color: '#166534', borderRadius: '8px', marginBottom: '16px' }}>
                        ✅ Updated! Redirecting...
                    </div>
                )}

                <div className="hub-form-group">
                    <label className="hub-label">Title</label>
                    <input
                        type="text"
                        required
                        className="hub-input"
                        value={formData.title}
                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                    />
                </div>

                <div className="hub-form-group">
                    <label className="hub-label">URL</label>
                    <input
                        type="url"
                        required
                        className="hub-input"
                        value={formData.url}
                        onChange={e => setFormData({ ...formData, url: e.target.value })}
                    />
                </div>

                <div className="hub-form-group">
                    <label className="hub-label">Description</label>
                    <textarea
                        className="hub-textarea"
                        value={formData.description}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                    />
                </div>

                <div className="hub-form-group">
                    <label className="hub-label">Audience</label>
                    <select
                        className="hub-select"
                        value={formData.audience}
                        onChange={e => setFormData({ ...formData, audience: e.target.value as any })}
                    >
                        <option value="General Audience">General Audience</option>
                        <option value="Designer">Designer</option>
                        <option value="Artist">Artist</option>
                        <option value="Filmmaker">Filmmaker</option>
                        <option value="Creative Technologist">Creative Technologist</option>
                        <option value="Researcher">Researcher</option>
                        <option value="Other">Other</option>
                    </select>
                </div>

                <div className="hub-form-group">
                    <label className="hub-label">Thumbnail URL</label>
                    <input
                        type="url"
                        className="hub-input"
                        value={formData.thumbnail_url}
                        onChange={e => setFormData({ ...formData, thumbnail_url: e.target.value })}
                    />
                </div>

                <div className="hub-form-group">
                    <label className="hub-label">Tags</label>
                    <TagInput
                        selectedTags={formData.selectedTags}
                        onChange={(newTags) => setFormData(prev => ({ ...prev, selectedTags: newTags }))}
                        maxTags={5} // Allow 5 for admins/editing
                    />
                </div>

                <div style={{ display: 'flex', gap: '16px', marginTop: '32px', alignItems: 'center' }}>
                    <button type="submit" className="hub-btn" disabled={loading}>
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                    <a href={`/resources/${resource.id}`} style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-secondary)', textDecoration: 'none', padding: '0 16px' }}>
                        Cancel
                    </a>

                    <div style={{ flexGrow: 1 }} />

                    <button
                        type="button"
                        className="hub-btn"
                        style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #ef4444' }}
                        onClick={async () => {
                            if (confirm('Are you SUPER sure? This deletes the resource forever.')) {
                                setLoading(true); // Re-use loading state or add new one
                                const res = await deleteResource(resource.id);
                                if (res.success) {
                                    alert('Deleted.');
                                    window.location.href = '/resources/dashboard'; // Go to dashboard after delete
                                } else {
                                    alert(res.error || 'Failed to delete');
                                    setLoading(false);
                                }
                            }
                        }}
                    >
                        🗑 Delete Resource
                    </button>
                </div>
            </form>
        </div>
    );
}
