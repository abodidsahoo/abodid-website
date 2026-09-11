import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { getBookmarkedResources, getAllTags } from '../../lib/resources/db';
import ResourceFeed from './ResourceFeed';
import type { HubResource, HubTag } from '../../lib/resources/types';

export default function SavedResourceList() {
    const [resources, setResources] = useState<HubResource[]>([]);
    const [tags, setTags] = useState<HubTag[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [notLoggedIn, setNotLoggedIn] = useState(false);

    useEffect(() => {
        const init = async () => {
            if (!supabase) return;
            const { data: { user } } = await supabase.auth.getUser();

            if (!user || user.is_anonymous) {
                // Show an inline login prompt instead of silently redirecting —
                // a silent redirect back to /login makes clicking "Saved" feel like a dead click.
                setNotLoggedIn(true);
                setLoading(false);
                return;
            }
            setUser(user);

            const [resData, tagsData] = await Promise.all([
                getBookmarkedResources(user.id),
                getAllTags()
            ]);

            setResources(resData);
            setTags(tagsData);
            setLoading(false);
        };

        init();
    }, []);

    if (loading) {
        return (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Loading your collection...
            </div>
        );
    }

    // Inline login-required state — explains why clicking "Saved" felt like nothing happened
    if (notLoggedIn) {
        return (
            <div style={{
                maxWidth: '560px',
                margin: '0 auto',
                padding: '0 16px 60px',
            }}>
                <div style={{
                    background: 'var(--pop-cream)',
                    border: '1px solid var(--pop-border)',
                    borderRadius: '24px',
                    padding: 'clamp(28px, 5vw, 48px)',
                    textAlign: 'left',
                }}>
                    <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '5px 14px',
                        border: '1px solid var(--pop-border)',
                        borderRadius: '999px',
                        background: 'var(--pop-yellow)',
                        color: 'var(--pop-ink)',
                        fontFamily: 'var(--resources-mono)',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase' as const,
                        marginBottom: '16px',
                    }}>
                        🔐 LOGIN REQUIRED
                    </span>

                    <h2 style={{
                        fontFamily: 'var(--resources-font)',
                        fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
                        fontWeight: 720,
                        lineHeight: 1.05,
                        letterSpacing: '-0.045em',
                        color: 'var(--pop-ink)',
                        margin: '0 0 12px',
                    }}>
                        Your saved collection
                    </h2>

                    <p style={{
                        fontFamily: 'var(--resources-font)',
                        fontSize: '1rem',
                        fontWeight: 450,
                        lineHeight: 1.55,
                        color: 'rgba(21, 19, 15, 0.8)',
                        margin: '0 0 28px',
                    }}>
                        Saved resources are tied to your account — you need to be logged in to view your bookmarks. Once you log in, all your saved items will appear here.
                    </p>

                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <a
                            href="/login?redirect=%2Fsaved"
                            className="hub-btn"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                textDecoration: 'none',
                                padding: '14px 28px',
                                fontSize: '1rem',
                            }}
                        >
                            Log in to view saved →
                        </a>
                        <a
                            href="/"
                            style={{
                                color: 'var(--pop-ink)',
                                fontFamily: 'var(--resources-mono)',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                letterSpacing: '0.05em',
                                textTransform: 'uppercase' as const,
                                textDecoration: 'underline',
                                opacity: 0.7,
                            }}
                        >
                            ← Back to Explore
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    if (resources.length === 0) {
        return (
            <div style={{
                maxWidth: '560px',
                margin: '0 auto',
                padding: '0 16px 60px',
            }}>
                <div style={{
                    background: 'var(--pop-cream)',
                    border: '1px solid var(--pop-border)',
                    borderRadius: '24px',
                    padding: 'clamp(28px, 5vw, 48px)',
                    textAlign: 'left',
                }}>
                    <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '5px 14px',
                        border: '1px solid var(--pop-border)',
                        borderRadius: '999px',
                        background: 'var(--pop-pink)',
                        color: 'var(--pop-ink)',
                        fontFamily: 'var(--resources-mono)',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase' as const,
                        marginBottom: '16px',
                    }}>
                        📚 EMPTY COLLECTION
                    </span>
                    <h2 style={{
                        fontFamily: 'var(--resources-font)',
                        fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
                        fontWeight: 720,
                        lineHeight: 1.05,
                        letterSpacing: '-0.045em',
                        color: 'var(--pop-ink)',
                        margin: '0 0 12px',
                    }}>
                        No saved resources yet
                    </h2>
                    <p style={{
                        fontFamily: 'var(--resources-font)',
                        fontSize: '1rem',
                        fontWeight: 450,
                        lineHeight: 1.55,
                        color: 'rgba(21, 19, 15, 0.8)',
                        margin: '0 0 28px',
                    }}>
                        Browse the hub, open any resource, then tap the bookmark icon to save it here for later.
                    </p>
                    <a
                        href="/"
                        className="hub-btn"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            textDecoration: 'none',
                            padding: '14px 28px',
                            fontSize: '1rem',
                        }}
                    >
                        Browse Curation →
                    </a>
                </div>
            </div>
        );
    }

    return (
        <ResourceFeed initialResources={resources} availableTags={tags} />
    );
}
