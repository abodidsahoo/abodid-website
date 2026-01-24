import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import CuratorDashboard from './CuratorDashboard';
import UserDashboard from './UserDashboard';

export default function UnifiedDashboard() {
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        checkUserRole();
    }, []);

    const checkUserRole = async () => {
        if (!supabase) {
            window.location.href = '/login';
            return;
        }

        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            window.location.href = '/login';
            return;
        }

        // Get user profile to check role
        const { data: profileData } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();

        setUserRole(profileData?.role || 'user');
        setLoading(false);
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
        return <CuratorDashboard />;
    }

    // Show user dashboard for regular users
    return <UserDashboard />;
}
