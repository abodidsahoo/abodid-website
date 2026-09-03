import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import CuratorDashboard from './CuratorDashboard';
import UserDashboard from './UserDashboard';

export default function UnifiedDashboard() {
    const getInitialRole = () => {
        try {
            const cached = localStorage.getItem('curator_profile');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed.role) return parsed.role;
            }
        } catch (e) {}
        return null;
    };

    const [userRole, setUserRole] = useState<string | null>(getInitialRole);
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkUserRole();
    }, []);

    const checkUserRole = async () => {
        try {
            if (!supabase) {
                console.error('UnifiedDashboard: Supabase missing');
                localStorage.removeItem('curator_profile');
                window.location.href = '/login?redirect=/resources/dashboard';
                return;
            }

            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError || !session || session.user?.is_anonymous) {
                console.log('UnifiedDashboard: No valid non-anonymous session', sessionError);
                localStorage.removeItem('curator_profile');
                window.location.href = '/login?redirect=/resources/dashboard';
                return;
            }

            setUser(session.user);

            // Fetch profile & update role in background/parallel
            const { data: profileData } = await supabase
                .from('profiles')
                .select('username, full_name, role')
                .eq('id', session.user.id)
                .single();

            if (profileData) {
                setUserRole(profileData.role || 'user');
                try {
                    localStorage.setItem('curator_profile', JSON.stringify(profileData));
                } catch (e) {}
            } else if (!userRole) {
                setUserRole('user');
            }
        } catch (e) {
            console.error('UnifiedDashboard: Error checking role', e);
            if (!userRole) {
                localStorage.removeItem('curator_profile');
                window.location.href = '/login?redirect=/resources/dashboard';
            }
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
                minHeight: '50vh',
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
