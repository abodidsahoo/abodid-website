import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { getUserStats } from '../../lib/resources/db';

interface Profile {
    username: string;
    full_name: string | null;
    role: string;
    stats?: { recent_upvotes: number; total_bookmarks: number };
}

export default function AuthHeader() {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkUser = async () => {
            if (!supabase) {
                setLoading(false);
                return;
            }
            try {
                // 1. Check Session
                const { data: { session } } = await supabase.auth.getSession();

                if (session?.user) {
                    // 2. Fetch Profile if logged in
                    const { data } = await supabase
                        .from('profiles')
                        .select('username, full_name, role')
                        .eq('id', session.user.id)
                        .single();

                    if (data) {
                        // 3. Fetch Stats
                        const stats = await getUserStats(session.user.id);
                        setProfile({ ...data, stats });
                    }
                }
            } catch (e) {
                console.error("Auth check failed", e);
            } finally {
                setLoading(false);
            }
        };

        checkUser();

        // Listen for changes
        if (!supabase) return;
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                const { data } = await supabase.from('profiles').select('username, full_name, role').eq('id', session.user.id).single();
                const stats = await getUserStats(session.user.id);
                setProfile(data ? { ...data, stats } : null);
            } else if (event === 'SIGNED_OUT') {
                setProfile(null);
            }
        });

        return () => subscription.unsubscribe();

    }, []);

    if (loading) {
        return <div style={{ height: '40px' }}></div>;
    }

    // Render Logged In State
    if (profile) {
        const displayName = profile.full_name || profile.username;

        return (
            <div style={{ textAlign: 'right', animation: 'fadeIn 0.3s ease', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>

                {/* User Identity */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        {displayName}
                    </span>
                    {profile.role === 'admin' && (
                        <span style={{
                            background: 'var(--text-primary)',
                            color: 'var(--bg-color)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '9px',
                            fontWeight: 700,
                            letterSpacing: '0.05em'
                        }}>
                            ADMIN
                        </span>
                    )}
                </div>

                {/* Dashboard / Stats - All clickable */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '13px' }}>
                    <a
                        href={`/resources/u/${profile.username}#upvoted`}
                        style={{
                            color: 'var(--text-secondary)',
                            textDecoration: 'none',
                            borderBottom: '1px solid transparent',
                            paddingBottom: '2px',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.color = 'var(--text-primary)';
                            e.currentTarget.style.borderBottomColor = 'var(--text-primary)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.color = 'var(--text-secondary)';
                            e.currentTarget.style.borderBottomColor = 'transparent';
                        }}
                    >
                        👍 Upvoted: <strong>{profile.stats?.recent_upvotes || 0}</strong>
                    </a>
                    <a
                        href="/resources/saved"
                        style={{
                            color: 'var(--text-primary)',
                            textDecoration: 'none',
                            fontWeight: 500,
                            borderBottom: '2px solid var(--text-primary)',
                            paddingBottom: '2px',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.opacity = '0.7';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.opacity = '1';
                        }}
                    >
                        🔖 Saved: <strong>{profile.stats?.total_bookmarks || 0}</strong>
                    </a>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {profile.username && (
                        <a
                            href={`/resources/u/${profile.username}`}
                            className="auth-link-btn"
                            style={{
                                color: 'var(--text-secondary)',
                                textDecoration: 'none',
                                fontSize: '13px',
                                fontWeight: 500
                            }}
                        >
                            My Profile
                        </a>
                    )}

                    <button
                        onClick={() => supabase?.auth.signOut()}
                        className="auth-link-btn"
                    >
                        Sign Out
                    </button>

                    <a href="/resources/submit" className="hub-btn-pill">
                        Submit Resource
                    </a>
                </div>

                <style>{`
                    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                    
                    .auth-link-btn {
                        background: none;
                        border: none;
                        color: var(--text-secondary);
                        font-size: 13px;
                        font-weight: 500;
                        cursor: pointer;
                        padding: 0;
                        transition: color 0.2s;
                    }
                    .auth-link-btn:hover {
                        color: var(--text-primary);
                        text-decoration: underline;
                    }

                    .hub-btn-pill {
                         display: inline-block;
                         font-size: 13px;
                         fontWeight: 600;
                         color: var(--text-primary);
                         background: var(--bg-surface);
                         border: 1px solid var(--border-subtle);
                         padding: 6px 16px;
                         border-radius: 100px;
                         text-decoration: none;
                         transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
                    }
                    .hub-btn-pill:hover {
                         background: var(--text-primary);
                         color: var(--bg-color);
                         border-color: var(--text-primary);
                         transform: translateY(-1px);
                    }
                `}</style>
            </div>
        );
    }

    // Render Logged Out State
    return (
        <div style={{ maxWidth: '240px', textAlign: 'right', animation: 'fadeIn 0.3s ease' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.4 }}>
                Log in to add your favorite resources and join the journey.
            </p>
            <a href="/login" style={{
                background: 'var(--text-primary)',
                color: 'var(--bg-color)',
                padding: '10px 20px',
                borderRadius: '100px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '14px',
                display: 'inline-block',
                transition: 'all 0.2s ease'
            }}
                onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
            >
                Curator Login
            </a>
        </div>
    );
}
