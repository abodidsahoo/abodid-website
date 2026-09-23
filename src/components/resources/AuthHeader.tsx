import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { clearResourcePageData } from '../../lib/resources/pageData';

export default function AuthHeader() {
    const [signedIn, setSignedIn] = useState(false);
    const [loading, setLoading] = useState(true);
    const [signingOut, setSigningOut] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!supabase) {
            setLoading(false);
            return;
        }

        let active = true;
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (!active) return;
            if (event === 'SIGNED_OUT') {
                clearResourcePageData();
                localStorage.removeItem('curator_profile');
            }
            setSignedIn(Boolean(session?.user && !session.user.is_anonymous));
            setLoading(false);
        });

        void supabase.auth.getSession().then(({ data, error: sessionError }) => {
            if (!active) return;
            if (sessionError) console.error('Curator session check failed', sessionError);
            setSignedIn(Boolean(data.session?.user && !data.session.user.is_anonymous));
            setLoading(false);
        }).catch((sessionError) => {
            if (!active) return;
            console.error('Curator session check failed', sessionError);
            setLoading(false);
        });

        return () => {
            active = false;
            subscription.unsubscribe();
        };
    }, []);

    const handleSignOut = async () => {
        if (!supabase || signingOut) return;
        setSigningOut(true);
        setError('');
        try {
            const { error: signOutError } = await supabase.auth.signOut();
            if (signOutError) throw signOutError;
            clearResourcePageData();
            localStorage.removeItem('curator_profile');
            setSignedIn(false);
        } catch (signOutError) {
            console.error('Curator sign out failed', signOutError);
            setError('Could not log out. Please try again.');
        } finally {
            setSigningOut(false);
        }
    };

    if (loading) return <div className="resources-auth-placeholder" aria-hidden="true" />;

    return (
        <div className="resources-auth">
            {signedIn ? (
                <button type="button" className="resources-auth__button" onClick={handleSignOut} disabled={signingOut}>
                    {signingOut ? 'Logging out…' : 'Log out'}
                </button>
            ) : (
                <a className="resources-auth__button" href="/resources/login?redirect=%2Fresources">Curator login</a>
            )}
            {error && <span className="resources-auth__error" role="alert">{error}</span>}
        </div>
    );
}
