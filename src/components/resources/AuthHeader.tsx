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
    const [sessionUser, setSessionUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Determine base font based on theme
    const quoteFont = theme === 'scifi' ? '"Inconsolata", monospace' : "'Poppins', sans-serif";

    // Determine base font based on theme - Moved inside component or passed to styles
    // But since we use it in render, let's keep it derived.

    useEffect(() => {
        // Safety timeout - force loading to false after 2s max
        const timer = setTimeout(() => setLoading(false), 2000);

        // 0. Try to load from cache immediately for instant UI
        const cached = localStorage.getItem('curator_profile');
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                setProfile(parsed);
                setLoading(false); // Show cached data immediately
                clearTimeout(timer);
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
                    setSessionUser(session.user);
                    // Don't modify loading state if we have session but no profile yet -> wait for profile
                    // Actually, let's set loading false so we render fallback
                    if (!cached) setLoading(false);

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
                    setSessionUser(null);
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
                setSessionUser(session.user);
                if (!supabase) return;
                const { data } = await supabase.from('profiles').select('username, full_name, role').eq('id', session.user.id).single();
                const stats = await getUserStats(session.user.id);
                if (data) {
                    const fullProfile: Profile = {
                        username: data.username,
                        full_name: data.full_name,
                        role: data.role,
                        stats
                    };
                    setProfile(fullProfile);
                    localStorage.setItem('curator_profile', JSON.stringify(fullProfile));
                }
            } else if (event === 'SIGNED_OUT') {
                setProfile(null);
                setSessionUser(null);
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
    if (!profile && !sessionUser) {
        return (
            <div style={{ textAlign: 'right', animation: 'fadeIn 0.3s ease' }}>
                <a href="/login"
                    className={theme === 'scifi' ? 'scifi-login-btn' : ''}
                    style={theme === 'scifi' ? {} : {
                        background: theme === 'scifi' ? '#FFFFFF' : 'var(--btn-primary-bg)',
                        color: theme === 'scifi' ? '#000000' : 'var(--btn-primary-text)',
                        padding: '8px 20px',
                        borderRadius: '100px',
                        textDecoration: 'none',
                        fontWeight: 600,
                        fontSize: '14px',
                        display: 'inline-block',
                        transition: 'all 0.2s ease',
                        fontFamily: quoteFont,
                        border: '1px solid var(--btn-primary-bg)'
                    }}>
                    LOGIN
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

    // Determine what to show (Profile or Fallback Session)
    const activeData = profile || {
        username: sessionUser?.email?.split('@')[0] || 'User',
        full_name: sessionUser?.user_metadata?.full_name || null,
        role: 'user', // Default role for fallback
        stats: { recent_upvotes: 0, total_bookmarks: 0 }
    };

    // Render Logged In State
    const displayName = activeData.full_name || activeData.username;
    const fontFamily = theme === 'scifi' ? '"Inconsolata", monospace' : "'Poppins', sans-serif";
    const textColor = theme === 'scifi' ? '#fff' : 'var(--text-primary)';
    const accentColor = theme === 'scifi' ? '#00f3ff' : 'var(--text-primary)';

    return (
        <div style={{ textAlign: 'right', animation: 'fadeIn 0.3s ease', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>

            {/* Greeting Block */}
            <div className="auth-greeting-block" style={{ marginBottom: '4px' }}>
                <span style={{
                    fontFamily,
                    fontWeight: 700,
                    fontSize: '1.2rem',
                    color: textColor,
                    letterSpacing: '-0.01em'
                }}>
                    Hi, {displayName}
                </span>
            </div>

            {/* Dashboard Action Box */}
            <div className="auth-action-box" style={{
                width: '100%',
                maxWidth: '240px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
            }}>
                <a
                    href="/resources/dashboard"
                    className="auth-dashboard-btn-box"
                    style={{
                        background: '#334155',
                        color: '#FFFFFF',
                        padding: '12px 20px',
                        borderRadius: '12px',
                        textDecoration: 'none',
                        transition: 'all 0.2s ease',
                        fontFamily,
                        border: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '2px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}
                >
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.05em' }}>
                        {activeData.role === 'admin' ? 'GO TO ADMIN PANEL' : 'GO TO DASHBOARD'}
                    </span>
                    <span style={{
                        fontSize: '9px',
                        opacity: 0.7,
                        fontWeight: 500,
                        fontStyle: 'italic'
                    }}>
                        (Logout option is available in dashboard)
                    </span>
                </a>
            </div>

            <style>{`
                .auth-dashboard-btn-box:hover {
                    background: #1e293b !important;
                    transform: translateY(-2px);
                    box-shadow: 0 6px 15px rgba(0,0,0,0.2) !important;
                    border-color: rgba(255,255,255,0.3) !important;
                }
                .auth-dashboard-btn-box:active {
                    transform: translateY(0);
                }
            `}</style>
        </div>
    );
}
