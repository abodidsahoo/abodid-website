import React, { useState } from 'react';
import { submitResource } from '../../lib/resources/db';
import type { ResourceAudience } from '../../lib/resources/types';
import TagInput from './TagInput';

export default function SubmissionForm() {
    const [loading, setLoading] = useState(false);
    const [fetchingMeta, setFetchingMeta] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        url: '',
        description: '',
        audience: 'Designer' as ResourceAudience,
        thumbnail_url: '',
        credit_text: '',
        selectedTags: [] as string[],
        honeypot: '' // Anti-spam
    });

    // Magic Autofill
    const handleUrlPaste = async (e: React.FocusEvent<HTMLInputElement> | React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setFormData(prev => ({ ...prev, url: val }));

        // Simple regex check for URL
        if (val.length > 10 && val.includes('http') && !formData.title) {
            try {
                setFetchingMeta(true);
                const res = await fetch(`/api/resources/extract-metadata?url=${encodeURIComponent(val)}`);
                const data = await res.json();

                if (res.ok) {
                    setFormData(prev => ({
                        ...prev,
                        title: prev.title || data.title || '',
                        description: prev.description || data.description || '',
                        thumbnail_url: prev.thumbnail_url || data.image || ''
                    }));
                }
            } catch (err) {
                console.warn('Failed to fetch metadata:', err);
            } finally {
                setFetchingMeta(false);
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Anti-spam check
        if (formData.honeypot) {
            // Silently fail for bots
            setLoading(false);
            setSuccess(true);
            return;
        }

        const result = await submitResource({
            title: formData.title,
            url: formData.url,
            description: formData.description,
            audience: formData.audience,
            thumbnail_url: formData.thumbnail_url || undefined,
            credit_text: formData.credit_text || undefined,
            tag_ids: formData.selectedTags
        });

        setLoading(false);

        if (result.success) {
            setSuccess(true);
            setFormData({
                title: '',
                url: '',
                description: '',
                audience: 'Designer',
                thumbnail_url: '',
                credit_text: '',
                selectedTags: [],
                honeypot: ''
            });
        } else {
            setError(result.error || 'Something went wrong.');
        }
    };

    if (success) {
        return (
            <div className="hub-form text-center p-8">
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
                <h3 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>Submitted!</h3>
                <p className="text-secondary mb-6">Your resource is now pending review.</p>
                <button
                    onClick={() => setSuccess(false)}
                    className="hub-btn"
                >
                    Submit Another
                </button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="hub-form">
            {error && (
                <div style={{ padding: '12px', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', marginBottom: '16px' }}>
                    {error}
                </div>
            )}

            {/* Hero Copy inside form */}
            <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '4px' }}>Submit a Gem</h2>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>One resource you'd pass to your best friend.</p>
            </div>

            <div className="hub-form-group">
                <label className="hub-label">URL *</label>
                <div style={{ position: 'relative' }}>
                    <input
                        type="url"
                        required
                        className="hub-input"
                        value={formData.url}
                        onChange={handleUrlPaste}
                        onBlur={handleUrlPaste}
                        placeholder="Paste verified link..."
                    />
                    {fetchingMeta && (
                        <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                            ✨ Fetching info...
                        </div>
                    )}
                </div>
            </div>

            <div className="hub-form-group">
                <label className="hub-label">Title *</label>
                <input
                    type="text"
                    required
                    className="hub-input"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                />
            </div>

            <div className="hub-form-group">
                <label className="hub-label">Description</label>
                <textarea
                    className="hub-textarea"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Why is it useful?"
                />
            </div>

            <div className="hub-form-group">
                <label className="hub-label">Audience *</label>
                <select
                    className="hub-select"
                    value={formData.audience}
                    onChange={e => setFormData({ ...formData, audience: e.target.value as ResourceAudience })}
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

            {formData.thumbnail_url && (
                <div style={{ marginBottom: '16px' }}>
                    <label className="hub-label">Preview</label>
                    <img src={formData.thumbnail_url} alt="Preview" style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '8px' }} />
                </div>
            )}

            <div className="hub-form-group">
                <label className="hub-label">Thumbnail URL (Optional)</label>
                <input
                    type="url"
                    className="hub-input"
                    value={formData.thumbnail_url}
                    onChange={e => setFormData({ ...formData, thumbnail_url: e.target.value })}
                    placeholder="https://.../image.jpg"
                />
            </div>

            <div className="hub-form-group">
                <label className="hub-label">Tags (Max 3)</label>
                <TagInput
                    selectedTags={formData.selectedTags}
                    onChange={(newTags) => setFormData(prev => ({ ...prev, selectedTags: newTags }))}
                    maxTags={3}
                />
            </div>

            <button type="submit" className="hub-btn" disabled={loading}>
                {loading ? 'Submitting...' : 'Submit Resource'}
            </button>

            {/* Honeypot Field */}
            <div style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, width: 0, overflow: 'hidden' }}>
                <label>Website</label>
                <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={formData.honeypot}
                    onChange={e => setFormData({ ...formData, honeypot: e.target.value })}
                />
            </div>
        </form>
    );
}
