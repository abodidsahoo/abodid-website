import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import OpportunityUsers from './OpportunityUsers';
import OpportunitySystem from './OpportunitySystem';
import OpportunityWorkers from './OpportunityWorkers';
import './opportunity-admin-shell.css';

const VIEW_PATHS = {
    users: '/admin/opportunities',
    system: '/admin/opportunities/system',
    workers: '/admin/opportunities/workers',
};

const VIEW_TITLES = {
    users: 'Opportunity Tracker',
    system: 'Opportunity System',
    workers: 'Opportunity Workers',
};

const descriptions = {
    users: 'See who has joined and open their saved collections.',
    system: 'Check the services and configuration.',
    workers: 'Monitor capture and reminder activity from the last 24 hours.',
};

const viewFromLocation = () => {
    const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
    if (pathname === VIEW_PATHS.system) return 'system';
    if (pathname === VIEW_PATHS.workers) return 'workers';
    return 'users';
};

const shouldHandleNavigation = (event) => (
    !event.defaultPrevented
    && event.button === 0
    && !event.metaKey
    && !event.ctrlKey
    && !event.shiftKey
    && !event.altKey
);

const getAdminToken = async (providedToken) => {
    if (providedToken) return providedToken;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Your admin session has expired.');
    return session.access_token;
};

export default function OpportunityAdminHub({ accessToken }) {
    const [activeView, setActiveView] = useState(() => viewFromLocation());
    const [directory, setDirectory] = useState({ users: [], summary: {} });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadDirectory = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const token = await getAdminToken(accessToken);
            const response = await fetch('/api/admin/opportunity-users', {
                cache: 'no-store',
                headers: { Authorization: `Bearer ${token}` },
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Could not load Opportunity Tracker.');
            setDirectory(payload);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Could not load Opportunity Tracker.');
        } finally {
            setLoading(false);
        }
    }, [accessToken]);

    useEffect(() => {
        void loadDirectory();
    }, [loadDirectory]);

    useEffect(() => {
        const handleHistoryChange = () => {
            if (!window.location.pathname.startsWith('/admin/opportunities')) return;
            setActiveView(viewFromLocation());
        };
        window.addEventListener('popstate', handleHistoryChange);
        window.addEventListener('admin:route-change', handleHistoryChange);
        return () => {
            window.removeEventListener('popstate', handleHistoryChange);
            window.removeEventListener('admin:route-change', handleHistoryChange);
        };
    }, []);

    useEffect(() => {
        document.title = `${VIEW_TITLES[activeView]} | Admin`;
    }, [activeView]);

    const navigate = useCallback((event, view, userId = null) => {
        if (event && !shouldHandleNavigation(event)) return;
        event?.preventDefault();

        const url = new URL(VIEW_PATHS[view], window.location.origin);
        if (userId) url.searchParams.set('user', userId);
        window.history.pushState({}, '', url);
        setActiveView(view);
    }, []);

    return (
        <section className="opportunity-admin opportunity-admin-page" aria-labelledby="opportunity-admin-title">
            <header className="opportunity-admin-frontispiece">
                <div className="opportunity-admin-header-copy">
                    <h2 id="opportunity-admin-title" className="opportunity-admin-page-title">Opportunity Tracker</h2>
                    <p className="opportunity-admin-page-description">{descriptions[activeView]}</p>
                </div>
                <div className="opportunity-admin-header-actions">
                    <nav className="opportunity-admin-view-nav" aria-label="Opportunity Tracker sections">
                        {['users', 'system', 'workers'].map((view) => (
                            <a
                                key={view}
                                href={VIEW_PATHS[view]}
                                aria-current={activeView === view ? 'page' : undefined}
                                onClick={(event) => navigate(event, view)}
                            >
                                {view === 'users' ? 'Users' : view === 'system' ? 'System' : 'Workers'}
                            </a>
                        ))}
                    </nav>
                    <a href="/opportunities" target="_blank" rel="noreferrer" className="is-primary">
                        Open tracker
                        <ArrowUpRight size={15} strokeWidth={2} aria-hidden="true" />
                    </a>
                </div>
            </header>

            {activeView === 'users' && (
                <OpportunityUsers
                    accessToken={accessToken}
                    directory={directory}
                    loading={loading}
                    error={error}
                    onRetry={loadDirectory}
                />
            )}
            {activeView === 'system' && <OpportunitySystem accessToken={accessToken} />}
            {activeView === 'workers' && <OpportunityWorkers accessToken={accessToken} />}
        </section>
    );
}
