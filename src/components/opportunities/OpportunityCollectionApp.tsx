import { OpportunityBusy } from './OpportunityBusy';
import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { opportunitySupabase as supabase } from '../../lib/opportunitySupabase';
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
    const [initialListRequest, setInitialListRequest] = useState<Promise<Response> | null>(null);
    const [viewerProfile, setViewerProfile] = useState<ProfileSummary | null>(null);

    useEffect(() => {
        let active = true;
        let sessionLoadId = 0;
        let lastToken: string | null | undefined;
        let lastLoad: Promise<void> | null = null;

        const loadSession = async (providedSession?: Session | null) => {
            const session = providedSession === undefined
                ? (await supabase.auth.getSession()).data.session
                : providedSession;
            if (!active) return;
            const token = session?.access_token || null;
            if (token === lastToken && lastLoad) return lastLoad;
            lastToken = token;
            const currentLoadId = ++sessionLoadId;
            const applySession = async () => {
                if (!session?.access_token || session.user.is_anonymous) {
                    setAccessToken(null);
                    setInitialListRequest(null);
                    setViewerProfile(null);
                    setLoading(false);
                    return;
                }

                // Begin the authenticated list request while the profile is being validated.
                const listRequest = fetch('/api/opportunities', {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                    cache: 'no-store',
                });
                void listRequest.catch(() => undefined);
                const response = await fetch('/api/opportunities/session', {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                    cache: 'no-store',
                });
                if (!active || currentLoadId !== sessionLoadId) return;

                if (!response.ok) {
                    setAccessToken(null);
                    setInitialListRequest(null);
                    setViewerProfile(null);
                    setLoading(false);
                    return;
                }

                const data = await response.json();
                if (!active || currentLoadId !== sessionLoadId) return;
                setAccessToken(session.access_token);
                setViewerProfile(data.profile || null);
                setInitialListRequest(() => data.profile?.username?.toLowerCase() === username.toLowerCase() ? listRequest : null);
                setLoading(false);
            };
            lastLoad = applySession().catch(() => {
                if (!active || currentLoadId !== sessionLoadId) return;
                lastToken = undefined;
                setAccessToken(null);
                setInitialListRequest(null);
                setViewerProfile(null);
                setLoading(false);
            });
            return lastLoad;
        };

        void loadSession();
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            void loadSession(session);
        });

        return () => {
            active = false;
            subscription.unsubscribe();
        };
    }, [username]);

    if (loading) {
        return <div className="opp-auth-loading" role="status"><OpportunityBusy inline={false}>Opening Opportunity Tracker</OpportunityBusy></div>;
    }

    const isOwner = Boolean(
        accessToken && viewerProfile?.username.toLowerCase() === username.toLowerCase(),
    );

    return (
        <OpportunityDashboard
            key={`${username}:${viewerProfile?.username || 'public'}`}
            username={username}
            initialListRequest={initialListRequest}
            accessToken={accessToken}
            isOwner={isOwner}
            viewerProfile={viewerProfile}
        />
    );
}
