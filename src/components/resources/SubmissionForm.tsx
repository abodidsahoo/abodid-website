import React, { useState, useEffect } from 'react';
import { submitResource } from '../../lib/resources/db';
import { supabase } from '../../lib/supabaseClient';

export default function SubmissionForm() {
    const [loading, setLoading] = useState(false);
    const [fetchingMeta, setFetchingMeta] = useState(false);
    const [success, setSuccess] = useState(false);
    const [autoApproved, setAutoApproved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

    // Check authentication on mount
    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        if (!supabase) {
            setIsAuthenticated(false);
            return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        setIsAuthenticated(!!session);
    };

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        url: '',
        description: '',
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
                        title: prev.title || data.title || ''
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
            audience: 'Designer'
        });

        setLoading(false);

        if (result.success) {
            setSuccess(true);
            // Check if the submission was auto-approved (curator/admin)
            setAutoApproved(result.data?.status === 'approved');
            setFormData({
                title: '',
                url: '',
                description: '',
                honeypot: ''
            });
        } else {
            setError(result.error || 'Something went wrong.');
        }
    };

    // Loading state while checking auth
    if (isAuthenticated === null) {
        return (
            <div className="hub-form text-center p-8">
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Loading...</div>
            </div>
        );
    }

    // Not authenticated - show login prompt
    if (!isAuthenticated) {
        return (
            <div className="submission-card-container" style={{ padding: '4rem 1rem' }}>
                <div className="submission-card" style={{
                    maxWidth: '420px',
                    margin: '0 auto',
                    padding: '3.5rem 2.5rem',
                    textAlign: 'center',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '16px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.08)'
                }}>
                    <div style={{ fontSize: '42px', marginBottom: '20px', opacity: 0.9 }}>🔒</div>
                    <h3 style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: '1.6rem',
                        fontWeight: '700',
                        marginBottom: '12px',
                        color: 'var(--text-primary)',
                        letterSpacing: '-0.02em'
                    }}>
                        Login Required
                    </h3>
                    <p style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: '1rem',
                        color: 'var(--text-secondary)',
                        lineHeight: '1.6',
                        marginBottom: '32px'
                    }}>
                        You need to be logged in to submit resources to the hub.
                    </p>
                    <a
                        href="/login?redirect=/resources/submit"
                        className="hub-btn"
                        style={{
                            display: 'inline-flex',
                            textDecoration: 'none',
                            width: 'auto',
                            padding: '10px 28px',
                            fontSize: '0.95rem',
                            borderRadius: '50px'
                        }}
                    >
                        Login to Submit
                    </a>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="submission-card-container">
                <div className="submission-card" style={{ maxWidth: '500px', margin: '0 auto', padding: '48px 32px', textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', marginBottom: '24px' }}>🎉</div>
                    <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '2rem', fontWeight: '700', marginBottom: '16px', color: 'var(--text-primary)' }}>
                        {autoApproved ? 'Published!' : 'Submitted!'}
                    </h3>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: '1.1rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '32px' }}>
                        {autoApproved
                            ? 'Your resource is now live on the hub!'
                            : 'Your submitted resource will be personally reviewed by Abodid and hopefully be live on the hub soon.'}
                    </p>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => window.location.href = '/resources'}
                            className="hub-btn"
                        >
                            View on Hub
                        </button>
                        <button
                            onClick={() => setSuccess(false)}
                            className="hub-btn"
                            style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                        >
                            Submit Another
                        </button>
                    </div>
                </div>
                <style>{`
                    .submission-card {
                        background: var(--bg-surface);
                        border-radius: 12px;
                        border: 1px solid var(--border-subtle);
                        overflow: hidden;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.04);
                    }
                `}</style>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="submission-card-container">
            {error && (
                <div style={{ padding: '12px', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', marginBottom: '16px', maxWidth: '800px', margin: '0 auto 24px' }}>
                    {error}
                </div>
            )}

            <div className="submission-card">
                {/* Header Section with Pastel Background */}
                <div className="form-header">
                    <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '2rem', fontWeight: '700', marginBottom: '12px', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                        Submit a resource
                    </h2>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: '1.5', maxWidth: '500px', margin: '0 auto' }}>
                        Share a useful link. You write why it is useful, and the curator adds tags and thumbnail before publishing.
                    </p>
                </div>

                {/* Form Content */}
                <div className="form-body">
                    {/* URL Route */}
                    <div className="form-row">
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
                                    <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px' }}>✨</div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="hub-form-group">
                            <label className="hub-label">Title (auto-generated) *</label>
                            <input
                                type="text"
                                required
                                className="hub-input"
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                placeholder="Auto-filled from your URL"
                            />
                        </div>
                    </div>

                    {/* Description Route */}
                    <div className="form-row">
                        <div className="hub-form-group">
                            <label className="hub-label">Why is it useful? *</label>
                            <textarea
                                required
                                className="hub-textarea"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Tell us why this is worth sharing."
                                style={{ minHeight: '100px' }}
                            />
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div style={{ marginTop: '32px' }}>
                        <button type="submit" className="hub-btn" disabled={loading}>
                            {loading ? 'Submitting...' : 'Submit Resource'}
                        </button>
                    </div>

                    {/* Honeypot */}
                    <div style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, width: 0, overflow: 'hidden' }}>
                        <input type="text" tabIndex={-1} autoComplete="off" value={formData.honeypot} onChange={e => setFormData({ ...formData, honeypot: e.target.value })} />
                    </div>
                </div>
            </div>

            <style>{`
                .submission-card {
                    background: var(--bg-surface);
                    border-radius: 12px;
                    border: 1px solid var(--border-subtle);
                    overflow: hidden;
                    max-width: 800px;
                    margin: 0 auto;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.04);
                }

                .form-header {
                    padding: 40px 24px;
                    text-align: center;
                    border-bottom: 1px solid var(--border-subtle);
                    background: var(--bg-surface-hover); /* Default fallback */
                }

                /* Layout Grids */
                .form-body {
                    padding: 40px;
                }

                .form-row {
                    margin-bottom: 24px;
                }

                .form-row-split {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 24px;
                    margin-bottom: 24px;
                }

                .hub-form-group {
                    margin-bottom: 0 !important; /* Reset component style if global interferes */
                }

                .hub-label {
                    margin-bottom: 8px !important;
                    display: block;
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: var(--text-secondary);
                }

                .hub-input, .hub-select {
                    padding: 12px;
                }

                /* Pastel Headers */
                /* Light Mode: Subtle Warm/Cool tint */
                html[data-theme="light"] .form-header {
                    background: #fbfbfd;
                    border-bottom: 1px solid #eaeaea;
                }
                
                /* Dark Mode: Slightly lighter than black */
                html[data-theme="dark"] .form-header {
                    background: #0a0a0a;
                    border-bottom: 1px solid #222;
                }

                @media (max-width: 768px) {
                    .form-body {
                        padding: 24px;
                    }
                    .form-row-split {
                        grid-template-columns: 1fr;
                        gap: 24px;
                    }
                }
            `}</style>
        </form>
    );
}
