import React, { useState, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { clearResourcePageData, getResourceViewer, loadResourceDetail, RESOURCE_DATA_CHANGED } from '../../lib/resources/pageData';
import ResourceLoading from './ResourceLoading';
import type { HubResource } from '../../lib/resources/types';
import AdminTrashActions from './AdminTrashActions';
import ResourceDetailActions from './ResourceDetailActions';
import AdminEditButton from './AdminEditButton';

interface Props {
    initialResource: HubResource | null;
    resourceId: string;
}

export default function ResourceDetailView({ initialResource, resourceId }: Props) {
    const [resource, setResource] = useState<HubResource | null>(initialResource);
    const [user, setUser] = useState<any>(null);
    const [role, setRole] = useState<string | null>(null);
    const [checkingAuth, setCheckingAuth] = useState(true);

    const [reconnecting, setReconnecting] = useState(false);

    useEffect(() => {
        let active = true;
        let running = false;
        let rerun = false;
        let timer: ReturnType<typeof setTimeout>;
        const syncResource = async () => {
            if (!active) return;
            if (running) { rerun = true; return; }
            running = true;
            clearTimeout(timer);
            try {
                const viewer = await getResourceViewer();
                const next = await loadResourceDetail(resourceId, viewer?.user.id || null);
                if (!active) return;
                setUser(viewer?.user || null);
                setRole(viewer?.role || null);
                setResource(next);
                setCheckingAuth(false);
                setReconnecting(false);
            } catch (error) {
                if (!active) return;
                console.error('Resource connection interrupted:', error);
                setReconnecting(true);
                timer = setTimeout(syncResource, 8_000);
            } finally {
                running = false;
                if (active && rerun) {
                    rerun = false;
                    void syncResource();
                }
            }
        };
        setResource(initialResource);
        setCheckingAuth(true);
        void syncResource();
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_OUT') {
                clearResourcePageData();
                setUser(null);
                setRole(null);
                setResource(current => current?.status === 'approved' ? current : null);
                setCheckingAuth(true);
            }
            if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
                clearTimeout(timer);
                timer = setTimeout(syncResource, 0);
            }
        });
        window.addEventListener('online', syncResource);
        window.addEventListener('pageshow', syncResource);
        window.addEventListener(RESOURCE_DATA_CHANGED, syncResource);
        return () => {
            active = false;
            clearTimeout(timer);
            subscription.unsubscribe();
            window.removeEventListener('online', syncResource);
            window.removeEventListener('pageshow', syncResource);
            window.removeEventListener(RESOURCE_DATA_CHANGED, syncResource);
        };
    }, [resourceId, initialResource]);

    const isStaff = role === 'admin' || role === 'curator';
    const isOwner = user && resource && resource.submitted_by === user.id;
    const isApproved = resource?.status === 'approved';
    const canView = isApproved || isStaff || isOwner;

    if (!resource && !checkingAuth) {
        return (
            <div className="resources-editorial" style={{ paddingBlock: '40px' }}>
                <div className="detail-page-card" style={{ textAlign: 'center', padding: '60px 24px' }}>
                    <h2 className="submit-title" style={{ marginBottom: '12px' }}>Resource Not Found</h2>
                    <p className="submit-subtitle" style={{ marginBottom: '24px' }}>
                        The resource you are looking for does not exist or may have been removed.
                    </p>
                    <a href="/resources" className="detail-back-btn">
                        &larr; Back to Resource Hub
                    </a>
                </div>
            </div>
        );
    }

    if (resource && !canView && !checkingAuth) {
        return (
            <div className="resources-editorial" style={{ paddingBlock: '40px' }}>
                <div className="detail-page-card" style={{ textAlign: 'center', padding: '60px 24px' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔒</div>
                    <h2 className="submit-title" style={{ marginBottom: '12px' }}>Staff Review Required</h2>
                    <p className="submit-subtitle" style={{ marginBottom: '28px', maxWidth: '500px', marginInline: 'auto' }}>
                        This resource is currently pending curator review. If you are a curator or admin, please log in to access this resource.
                    </p>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <a href={`/login?redirect=/resources/${resourceId}`} className="detail-cta-primary">
                            Log In as Curator ↗
                        </a>
                        <a href="/resources" className="detail-cta-secondary">
                            &larr; Return to Hub
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    if (!resource || (checkingAuth && !canView)) {
        return <div className="resources-editorial"><ResourceLoading label="Loading resource." reconnecting={reconnecting} /></div>;
    }

    return (
        <div className="resources-editorial" style={{ paddingBlock: '40px' }}>
            <div className="detail-page-card">
                {resource.status !== 'approved' && (
                    <div style={{
                        background: 'var(--pop-yellow)',
                        border: '1px solid var(--pop-border)',
                        borderRadius: '14px',
                        padding: '14px 20px',
                        fontWeight: 700,
                        color: 'var(--pop-ink)',
                        marginBottom: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '12px'
                    }}>
                        <span>
                            {resource.status === 'pending' && '⚠️ This resource is pending review.'}
                            {resource.status === 'rejected' && '❌ This resource has been rejected.'}
                            {resource.status === 'deleted' && '🗑 This resource is in the trash.'}{' '}
                            Only visible to staff and submitter.
                        </span>
                        {resource.status === 'deleted' && role === 'admin' && (
                            <div>
                                <AdminTrashActions resourceId={resource.id} />
                            </div>
                        )}
                    </div>
                )}

                {/* Navigation Bar */}
                <div className="detail-navigation">
                    <a href={isStaff ? "/resources/dashboard" : "/resources"} className="detail-back-btn">
                        &larr; Back to {isStaff ? "Dashboard" : "Resources"}
                    </a>

                    {role === 'admin' && (
                        <a href={`/resources/${resource.id}/edit`} className="detail-back-btn detail-edit-btn">
                            <Pencil size={16} strokeWidth={2} aria-hidden="true" />
                            <span>Edit Resource</span>
                        </a>
                    )}
                </div>

                <article className="resource-detail-stack">
                    {/* Thumbnail Container */}
                    <div className="detail-thumbnail-container-editorial">
                        {resource.thumbnail_url ? (
                            <img src={resource.thumbnail_url} alt={resource.title} className="detail-thumbnail" />
                        ) : (
                            <div className="detail-placeholder" style={{ color: 'var(--pop-cream)', fontSize: '4rem' }}>🔗</div>
                        )}
                    </div>

                    {/* Primary Content */}
                    <div className="detail-content" style={{ marginTop: '28px' }}>
                        {/* Audience Tag */}
                        {resource.audience && (
                            <div style={{ marginBottom: '14px' }}>
                                <span style={{
                                    display: 'inline-block',
                                    background: 'var(--pop-yellow)',
                                    color: 'var(--pop-ink)',
                                    border: '1px solid var(--pop-border)',
                                    padding: '6px 14px',
                                    borderRadius: '999px',
                                    font: '800 0.72rem/1 var(--resources-mono)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.08em'
                                }}>
                                    {resource.audience}
                                </span>
                            </div>
                        )}

                        <h1 className="detail-title-editorial">{resource.title}</h1>

                        {/* Metadata Section */}
                        <div className="detail-meta-box-editorial">
                            <div className="meta-item">
                                <span className="meta-label-editorial">Submitted by</span>
                                <span className="meta-value-editorial">
                                    {resource.submitter_profile?.avatar_url && (
                                        <img
                                            src={resource.submitter_profile.avatar_url}
                                            className="meta-avatar"
                                            alt=""
                                            style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--pop-border)' }}
                                        />
                                    )}
                                    @{resource.submitter_profile?.username || "curator"}
                                </span>
                            </div>

                            <div className="meta-item">
                                <span className="meta-label-editorial">Date Added</span>
                                <span className="meta-value-editorial">
                                    {new Date(resource.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                                </span>
                            </div>

                            <div className="meta-item detail-edit-action">
                                <AdminEditButton resourceId={resource.id} isAdmin={role === 'admin'} />
                            </div>
                        </div>

                        <p className="detail-description-editorial">{resource.description}</p>

                        {/* Tags */}
                        {resource.tags && resource.tags.length > 0 && (
                            <div className="detail-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '28px' }}>
                                {resource.tags.map((tag: any, idx: number) => (
                                    <span key={idx} className="tag" style={{
                                        padding: '6px 12px',
                                        border: '1px solid var(--pop-border)',
                                        borderRadius: '10px',
                                        background: 'var(--pop-cream)',
                                        color: 'var(--pop-ink)',
                                        font: '700 0.8rem/1.3 var(--resources-font)'
                                    }}>
                                        {tag.name}
                                    </span>
                                ))}
                            </div>
                        )}

                        <ResourceDetailActions resourceId={resource.id} initialUpvotes={resource.upvotes_count || 0} />

                        {/* Action Buttons */}
                        <div className="detail-resource-links">
                            <a href={resource.url} target="_blank" rel="noopener noreferrer" className="detail-cta-primary">
                                Visit Website ↗
                            </a>

                            <button
                                type="button"
                                className="detail-cta-secondary"
                                onClick={async (e) => {
                                    try {
                                        await navigator.clipboard.writeText(window.location.href);
                                        const btn = e.currentTarget;
                                        const original = btn.innerText;
                                        btn.innerText = "✓ Copied!";
                                        setTimeout(() => { btn.innerText = original; }, 2000);
                                    } catch (err) {
                                        console.error('Failed to copy:', err);
                                    }
                                }}
                            >
                                🔗 Share Link
                            </button>
                        </div>
                    </div>
                </article>
            </div>
        </div>
    );
}
