import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { getUserStats } from '../../lib/resources/db';

interface Profile {
    username: string;
    full_name: string | null;
    role: string;
    stats?: { recent_upvotes: number; total_bookmarks: number };
}

interface Props {
    theme?: 'default' | 'scifi';
}

export default function AuthHeader({ theme = 'default' }: Props) {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    // Determine base font based on theme
    const quoteFont = theme === 'scifi' ? '"Inconsolata", monospace' : "'Poppins', sans-serif";

    // Determine base font based on theme - Moved inside component or passed to styles
    // But since we use it in render, let's keep it derived.

    useEffect(() => {
        // 0. Try to load from cache immediately for instant UI
        const cached = localStorage.getItem('curator_profile');
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                setProfile(parsed);
                setLoading(false); // Show cached data immediately
            } catch (e) {
                console.error("Cache parse error", e);
            }
        }

        const checkUser = async () => {
            if (!supabase) {
                if (!cached) setLoading(false);
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
                        const fullProfile = { ...data, stats };

                        setProfile(fullProfile);
                        // Update cache
                        localStorage.setItem('curator_profile', JSON.stringify(fullProfile));
                    }
                } else {
                    // No session, clear profile and cache
                    setProfile(null);
                    localStorage.removeItem('curator_profile');
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
                const fullProfile = { ...data, stats };
                setProfile(fullProfile);
                localStorage.setItem('curator_profile', JSON.stringify(fullProfile));
            } else if (event === 'SIGNED_OUT') {
                setProfile(null);
                localStorage.removeItem('curator_profile');
            }
        });

        return () => subscription.unsubscribe();

    }, []);

    if (loading) {
        // Reserve space to prevent layout shift, or render nothing if handled by cache
        return <div style={{ height: '40px', minWidth: '100px' }}></div>;
    }

    // Render Logged Out State
    if (!profile) {
        return (
            <div style={{ textAlign: 'right', animation: 'fadeIn 0.3s ease' }}>
                <a href="/login"
                    className={theme === 'scifi' ? 'scifi-login-btn' : ''}
                    style={theme === 'scifi' ? {} : {
                        background: 'var(--text-primary)',
                        color: 'var(--bg-color)',
                        padding: '8px 20px',
                        borderRadius: '100px',
                        textDecoration: 'none',
                        fontWeight: 600,
                        fontSize: '14px',
                        display: 'inline-block',
                        transition: 'all 0.2s ease',
                        fontFamily: quoteFont
                    }}>
                    CURATOR LOGIN
                </a>

                {theme === 'scifi' && (
                    <style>{`
                        .scifi-login-btn {
                            font-family: "Inconsolata", monospace;
                            color: #00f3ff;
                            border: 1px solid rgba(0, 243, 255, 0.3);
                            padding: 8px 16px;
                            text-decoration: none;
                            font-size: 0.9rem;
                            letter-spacing: 0.1em;
                            background: rgba(0, 243, 255, 0.05);
                            transition: all 0.3s ease;
                        }
                        .scifi-login-btn:hover {
                            background: rgba(0, 243, 255, 0.15);
                            box-shadow: 0 0 10px rgba(0, 243, 255, 0.4);
                            text-shadow: 0 0 5px #00f3ff;
                        }
                    `}</style>
                )}
            </div>
        );
    }

    // Render Logged In State
    const displayName = profile.full_name || profile.username;
    const fontFamily = theme === 'scifi' ? '"Inconsolata", monospace' : "'Poppins', sans-serif";
    const textColor = theme === 'scifi' ? '#fff' : 'var(--text-primary)';
    const accentColor = theme === 'scifi' ? '#00f3ff' : 'var(--text-primary)';

    return (
        <div style={{ textAlign: 'right', animation: 'fadeIn 0.3s ease', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>

            {/* User Identity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily, fontWeight: 600, fontSize: '0.9rem', color: textColor, letterSpacing: theme === 'scifi' ? '0.1em' : '0' }}>
                    {theme === 'scifi' ? `USER: ${displayName.toUpperCase()}` : displayName}
                </span>
                {profile.role === 'admin' && (
                    <a
                        href="/admin/dashboard"
                        className="hub-btn-pill"
                        style={{
                            background: 'transparent',
                            color: 'var(--text-primary)',
                            borderColor: 'var(--text-primary)'
                        }}
                    >
                        Admin Dashboard
                    </a>
                )}
            </div>

            {/* Dashboard / Stats */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', fontSize: '12px', fontFamily }}>
                <a
                    href={`/resources/u/${profile.username}#upvoted`}
                    style={{ color: theme === 'scifi' ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)', textDecoration: 'none' }}
                >
                    UPVOTES: <strong>{profile.stats?.recent_upvotes || 0}</strong>
                </a>
                <a
                    href="/resources/saved"
                    style={{ color: theme === 'scifi' ? accentColor : 'var(--text-primary)', textDecoration: 'none', fontWeight: 600 }}
                >
                    SAVED: <strong>{profile.stats?.total_bookmarks || 0}</strong>
                </a>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '2px' }}>
                {profile.role === 'admin' && (
                    <a href="/admin/dashboard" style={{ color: textColor, fontSize: '11px', textDecoration: 'none', fontFamily }}>
                        DASHBOARD
                    </a>
                )}
                <a href={`/resources/u/${profile.username}`} style={{ color: theme === 'scifi' ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)', fontSize: '11px', textDecoration: 'none', fontFamily }}>
                    PROFILE
                </a>
                <button
                    onClick={() => supabase?.auth.signOut()}
                    style={{ background: 'none', border: 'none', color: theme === 'scifi' ? '#ef4444' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '11px', padding: 0, fontFamily }}
                >
                    LOGOUT
                </button>
            </div>
        </div>
    );
}
