import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import CuratorDashboard from './CuratorDashboard';
import UserDashboard from './UserDashboard';

export default function UnifiedDashboard() {
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        checkUserRole();
    }, []);

    const checkUserRole = async () => {
        try {
            if (!supabase) {
                console.error('UnifiedDashboard: Supabase missing');
                window.location.href = '/login';
                return;
            }

            // Safety timeout
            const timeoutId = setTimeout(() => {
                console.warn('UnifiedDashboard: Loading timed out, forcing render');
                setLoading(false);
            }, 3000);

            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                console.log('UnifiedDashboard: No session');
                window.location.href = '/login';
                return;
            }

            setUser(session.user); // Need to store user

            // Get user profile to check role
            const { data: profileData, error } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', session.user.id)
                .single();

            if (error) {
                console.error('UnifiedDashboard: Profile fetch error', error);
            }

            clearTimeout(timeoutId);
            setUserRole(profileData?.role || 'user');
        } catch (e) {
            console.error('UnifiedDashboard: Error checking role', e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                color: 'var(--text-secondary)'
            }}>
                Loading your dashboard...
            </div>
        );
    }

    // Show curator dashboard for curators and admins
    if (userRole === 'curator' || userRole === 'admin') {
        return <CuratorDashboard user={user} role={userRole} />;
    }

    // Show user dashboard for regular users
    return <UserDashboard user={user} />;
}
