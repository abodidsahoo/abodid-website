import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { getUserStats } from '../../lib/resources/db';
import { clearResourcePageData } from '../../lib/resources/pageData';

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
    const [profile, setProfile] = useState<Profile | null>(() => {
        if (typeof window === 'undefined') return null;
        const cached = localStorage.getItem('curator_profile');
        if (!cached) return null;
        try {
            return JSON.parse(cached);
        } catch {
            return null;
        }
    });
    const [sessionUser, setSessionUser] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(() => {
        if (typeof window === 'undefined') return true;
        return !localStorage.getItem('curator_profile');
    });

    // Determine base font based on theme
    const quoteFont = theme === 'scifi' ? '"Inconsolata", monospace' : 'var(--font-sans)';

    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 2000);

        const syncProfile = async (session: any) => {
            if (!session?.user || session.user.is_anonymous) {
                setProfile(null);
                setSessionUser(null);
                localStorage.removeItem('curator_profile');
                setLoading(false);
                return;
            }

            setSessionUser(session.user);
            setLoading(false);

            try {
                if (!supabase) return;
                const { data } = await supabase
                    .from('profiles')
                    .select('username, full_name, role')
                    .eq('id', session.user.id)
                    .single();

                if (data) {
                    const stats = await getUserStats(session.user.id);
                    const fullProfile: Profile = { ...data, stats };
                    setProfile(fullProfile);
                    localStorage.setItem('curator_profile', JSON.stringify(fullProfile));
                }
            } catch (e) {
                console.error("Profile fetch error in AuthHeader", e);
            }
        };

        const checkUser = async () => {
            if (!supabase) {
                setLoading(false);
                return;
            }
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error || !session) {
                    await syncProfile(null);
                } else {
                    await syncProfile(session);
                }
            } catch (e) {
                console.error("Auth check failed in AuthHeader", e);
                await syncProfile(null);
            } finally {
                clearTimeout(timer);
                setLoading(false);
            }
        };

        checkUser();

        if (!supabase) return;
        let authUpdateTimer: ReturnType<typeof setTimeout>;
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') clearResourcePageData();
            // Supabase waits for auth callbacks while holding its session lock.
            // Profile/stat queries must begin only after that callback returns.
            clearTimeout(authUpdateTimer);
            authUpdateTimer = setTimeout(() => { void syncProfile(session); }, 0);
        });

        return () => {
            clearTimeout(timer);
            clearTimeout(authUpdateTimer);
            subscription.unsubscribe();
        };
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
                        background: 'var(--btn-primary-bg)',
                        color: 'var(--btn-primary-text)',
                        padding: '8px 20px',
                        borderRadius: '100px',
                        textDecoration: 'none',
                        fontWeight: 600,
                        fontSize: '14px',
                        display: 'inline-block',
                        transition: 'all 0.2s ease',
                        fontFamily: quoteFont,
                        border: '1px solid var(--btn-primary-border)'
                    }}>
                    LOGIN
                </a>

                {theme === 'scifi' && (
                    <style>{`
                        .scifi-login-btn {
                            font-family: var(--font-mono);
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
    const fontFamily = theme === 'scifi' ? '"Inconsolata", monospace' : 'var(--font-sans)';
    const textColor = theme === 'scifi' ? '#fff' : 'var(--text-primary)';

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
                    className={`auth-dashboard-btn-box ${theme === 'scifi' ? 'theme-scifi' : 'theme-default'}`}
                    style={{
                        background: theme === 'scifi' ? '#334155' : 'var(--btn-primary-bg)',
                        color: theme === 'scifi' ? '#ffffff' : 'var(--btn-primary-text)',
                        padding: '12px 20px',
                        borderRadius: '12px',
                        textDecoration: 'none',
                        transition: 'all 0.2s ease',
                        fontFamily,
                        border: theme === 'scifi' ? '1px solid rgba(255,255,255,0.1)' : '1px solid var(--btn-primary-border)',
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
                    transform: translateY(-1px);
                    box-shadow: 0 6px 15px rgba(0,0,0,0.2) !important;
                }
                .auth-dashboard-btn-box.theme-default:hover {
                    background: color-mix(in srgb, var(--btn-primary-bg) 88%, black) !important;
                    border-color: color-mix(in srgb, var(--btn-primary-bg) 88%, black) !important;
                    color: var(--btn-primary-text) !important;
                }
                .auth-dashboard-btn-box:active {
                    transform: translateY(0);
                }
            `}</style>
        </div>
    );
}
