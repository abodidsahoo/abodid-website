import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { clearResourcePageData, getResourceViewer, type ResourceViewer } from '../../lib/resources/pageData';
import CuratorDashboard from './CuratorDashboard';
import UserDashboard from './UserDashboard';
import ResourceLoading from './ResourceLoading';

export default function UnifiedDashboard() {
    const [viewer, setViewer] = useState<ResourceViewer | null>(null);
    const [reconnecting, setReconnecting] = useState(false);

    useEffect(() => {
        let active = true;
        let running = false;
        let timer: ReturnType<typeof setTimeout>;
        const resolveViewer = async () => {
            if (!active || running) return;
            running = true;
            try {
                const next = await getResourceViewer();
                if (!active) return;
                if (!next) {
                    window.location.replace('/login?redirect=/resources/dashboard');
                    return;
                }
                setViewer(next);
                setReconnecting(false);
            } catch (error) {
                if (!active) return;
                console.error('Dashboard connection interrupted:', error);
                setReconnecting(true);
                timer = setTimeout(resolveViewer, 8_000);
            } finally {
                running = false;
            }
        };
        void resolveViewer();
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                clearResourcePageData();
                setViewer(null);
                window.location.replace('/login?redirect=/resources/dashboard');
            } else if (event === 'SIGNED_IN') {
                setViewer(current => current?.user.id === session?.user.id ? current : null);
                // Leave the auth callback before making another Supabase call.
                clearTimeout(timer);
                timer = setTimeout(resolveViewer, 0);
            }
        });
        window.addEventListener('online', resolveViewer);
        return () => {
            active = false;
            clearTimeout(timer);
            subscription.unsubscribe();
            window.removeEventListener('online', resolveViewer);
        };
    }, []);

    if (!viewer) return <ResourceLoading reconnecting={reconnecting} />;
    if (viewer.role === 'curator' || viewer.role === 'admin') {
        return <CuratorDashboard key={`${viewer.user.id}:${viewer.role}`} user={viewer.user} role={viewer.role} />;
    }
    return <UserDashboard key={viewer.user.id} user={viewer.user} />;
}
