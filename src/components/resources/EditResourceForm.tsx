import React, { useState, useEffect } from 'react';
import { ArrowLeft, Check, Trash2 } from 'lucide-react';
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
        <div className="resource-edit-layout">
            <header className="resource-edit-header">
                <div className="resource-edit-heading-row">
                    <span className="resource-edit-eyebrow">Resource hub / Editor</span>
                    <a href={`/resources/${resource.id}`} className="resource-edit-back">
                        <ArrowLeft size={16} aria-hidden="true" />
                        <span>Back to resource</span>
                    </a>
                </div>
                <h1 id="resource-edit-title">Edit resource.</h1>
                <p>{resource.title}</p>
            </header>
            <form onSubmit={handleSubmit} className="hub-form resource-edit-form" aria-labelledby="resource-edit-title">

                {error && (
                    <div className="resource-edit-notice resource-edit-notice-error" role="alert">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="resource-edit-notice resource-edit-notice-success" role="status">
                        <Check size={18} aria-hidden="true" />
                        <span>Updated! Returning to your resource…</span>
                    </div>
                )}

                <div className="hub-form-group">
                    <label className="hub-label" htmlFor="resource-edit-name">Title</label>
                    <input
                        id="resource-edit-name"
                        type="text"
                        required
                        className="hub-input"
                        value={formData.title}
                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                    />
                </div>

                <div className="hub-form-group">
                    <label className="hub-label" htmlFor="resource-edit-url">URL</label>
                    <input
                        id="resource-edit-url"
                        type="url"
                        required
                        className="hub-input"
                        value={formData.url}
                        onChange={e => setFormData({ ...formData, url: e.target.value })}
                    />
                </div>

                <div className="hub-form-group">
                    <label className="hub-label" htmlFor="resource-edit-description">Description</label>
                    <textarea
                        id="resource-edit-description"
                        className="hub-textarea"
                        value={formData.description}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                    />
                </div>

                <div className="resource-edit-fields-row">
                    <div className="hub-form-group">
                        <label className="hub-label" htmlFor="resource-edit-audience">Audience</label>
                        <select
                            id="resource-edit-audience"
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
                        <label className="hub-label" htmlFor="resource-edit-thumbnail">Thumbnail URL</label>
                        <input
                            id="resource-edit-thumbnail"
                            type="url"
                            className="hub-input"
                            value={formData.thumbnail_url}
                            onChange={e => setFormData({ ...formData, thumbnail_url: e.target.value })}
                        />
                    </div>
                </div>

                <div className="hub-form-group">
                    <span className="hub-label">Tags</span>
                    <TagInput
                        selectedTags={formData.selectedTags}
                        onChange={(newTags) => setFormData(prev => ({ ...prev, selectedTags: newTags }))}
                        maxTags={5} // Allow 5 for admins/editing
                    />
                </div>

                <div className="resource-edit-actions">
                    <button type="submit" className="hub-btn resource-edit-save" disabled={loading}>
                        <Check size={18} aria-hidden="true" />
                        <span>{loading ? 'Saving…' : 'Save changes'}</span>
                    </button>
                    <a href={`/resources/${resource.id}`} className="resource-edit-cancel">
                        Cancel
                    </a>

                    <button
                        type="button"
                        className="resource-edit-delete"
                        disabled={loading}
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
                        <Trash2 size={18} aria-hidden="true" />
                        <span>Delete resource</span>
                    </button>
                </div>
            </form>
        </div>
    );
}
