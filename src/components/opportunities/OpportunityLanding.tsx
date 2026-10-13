import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const safeNextPath = () => {
    const candidate = new URLSearchParams(window.location.search).get('next');
    return candidate && candidate.startsWith('/opportunities/') && !candidate.startsWith('//')
        ? candidate
        : null;
};

export default function OpportunityLanding() {
    const [checking, setChecking] = useState(true);
    const [signingIn, setSigningIn] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        void supabase.auth.getSession().then(async ({ data }) => {
            const session = data.session;
            if (!active || !session?.access_token || session.user.is_anonymous) {
                if (active) setChecking(false);
                return;
            }

            const response = await fetch('/api/opportunities/session', {
                headers: { Authorization: `Bearer ${session.access_token}` },
                cache: 'no-store',
            });
            if (!active) return;
            if (response.ok) {
                const payload = await response.json();
                window.location.replace(safeNextPath() || `/opportunities/${payload.profile.username}`);
                return;
            }
            setChecking(false);
        }).catch(() => {
            if (active) setChecking(false);
        });
        return () => { active = false; };
    }, []);

    const signIn = async () => {
        setSigningIn(true);
        setError('');
        const callback = new URL('/opportunities/auth/callback', window.location.origin);
        const next = safeNextPath();
        if (next) callback.searchParams.set('next', next);

        const { error: authError } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: callback.toString(),
                queryParams: { prompt: 'select_account' },
            },
        });
        if (authError) {
            setError(`Google sign-in could not start (${authError.name}). Please try again.`);
            setSigningIn(false);
        }
    };

    return (
        <section className="opp-landing-shell" aria-labelledby="opportunities-title">
            <div className="opp-landing-card">
                <div className="opp-landing-copy">
                    <h1 id="opportunities-title" className="opp-landing-brand">
                        <span className="opp-landing-brand-title">Opportunity</span>
                        <span className="opp-landing-brand-product">Tracker</span>
                        <span className="opp-landing-brand-by">by Abodid.</span>
                    </h1>
                    <div className="opp-landing-divider" aria-hidden="true" />
                    <p className="opp-landing-promise">One Click. Every opportunity organized.</p>
                    <p className="opp-landing-promise-copy">Save open calls, residencies, fellowships, grants and jobs. AI automatically summarizes key details, identifies important dates and helps users stay on track.</p>
                </div>
                <div className="opp-landing-action">
                    <span className="opp-landing-action-label">ORGANIZE YOUR NEXT MOVE</span>
                    <button type="button" className="opp-google-signin" onClick={signIn} disabled={checking || signingIn}>
                        <span className="opp-google-mark" aria-hidden="true">G</span>
                        <span>{checking ? 'Checking your session…' : signingIn ? 'Opening Google…' : 'Continue with Google'}</span>
                        <span aria-hidden="true">→</span>
                    </button>
                    <a className="opp-public-collection-link" href="/opportunities/abodid">
                        <span>Browse Abodid’s opportunities</span>
                        <span aria-hidden="true">→</span>
                    </a>
                    {error && <p className="opp-auth-error" role="alert">{error}</p>}
                    <small>
                        One click AI-powered Opportunity and Deadline tracker.<br />
                        Just Paste the Link. And done.<br />
                        (Chrome Extension Coming Soon)
                    </small>
                </div>
            </div>
        </section>
    );
}
