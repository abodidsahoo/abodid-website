import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import OpportunityDashboard from './OpportunityDashboard';

type ProfileSummary = {
    username: string;
    display_name: string;
    avatar_url: string | null;
    is_public: boolean;
    role?: string;
};

export default function OpportunityCollectionApp({ username }: { username: string }) {
    const [loading, setLoading] = useState(true);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [viewerProfile, setViewerProfile] = useState<ProfileSummary | null>(null);

    useEffect(() => {
        let active = true;

        const loadSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!active) return;

            if (!session?.access_token || session.user.is_anonymous) {
                setAccessToken(null);
                setViewerProfile(null);
                setLoading(false);
                return;
            }

            const response = await fetch('/api/opportunities/session', {
                headers: { Authorization: `Bearer ${session.access_token}` },
                cache: 'no-store',
            });
            if (!active) return;

            if (!response.ok) {
                setAccessToken(null);
                setViewerProfile(null);
                setLoading(false);
                return;
            }

            const data = await response.json();
            setAccessToken(session.access_token);
            setViewerProfile(data.profile || null);
            setLoading(false);
        };

        void loadSession();
        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
            void loadSession();
        });

        return () => {
            active = false;
            subscription.unsubscribe();
        };
    }, []);

    if (loading) {
        return <div className="opp-auth-loading" role="status">Opening opportunity collection…</div>;
    }

    const isOwner = Boolean(
        accessToken && viewerProfile?.username.toLowerCase() === username.toLowerCase(),
    );

    return (
        <OpportunityDashboard
            username={username}
            accessToken={accessToken}
            isOwner={isOwner}
            viewerProfile={viewerProfile}
        />
    );
}
