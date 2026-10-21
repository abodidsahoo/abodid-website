import { useCallback, useEffect, useState } from 'react';
import { Activity, BellRing, Bot, Database, KeyRound, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import './opportunity-system.css';

const serviceIcons = {
    database: Database,
    notifications: BellRing,
    extraction: KeyRound,
    telegram: Bot,
};

const getAdminToken = async (providedToken) => {
    if (providedToken) return providedToken;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Your admin session has expired.');
    return session.access_token;
};

export default function OpportunitySystem({ accessToken }) {
    const [system, setSystem] = useState({ services: [], activity: null, checkedAt: null });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadSystem = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const token = await getAdminToken(accessToken);
            const response = await fetch('/api/admin/opportunities/status', {
                cache: 'no-store',
                headers: { Authorization: `Bearer ${token}` },
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Could not check Opportunity Tracker services.');
            setSystem(payload);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Could not check Opportunity Tracker services.');
        } finally {
            setLoading(false);
        }
    }, [accessToken]);

    useEffect(() => {
        void loadSystem();
    }, [loadSystem]);

    return (
        <section className="opportunity-admin-collection opportunity-system" aria-labelledby="opportunity-system-title">
            <header className="opportunity-admin-results-heading">
                <div className="opportunity-admin-results-lead">
                    <h3 id="opportunity-system-title" className="opportunity-admin-counter">System</h3>
                    <p>Configuration status only. Credentials remain private in the deployment environment.</p>
                </div>
                <button type="button" className="opportunity-system-refresh" onClick={() => void loadSystem()} disabled={loading}>
                    <RefreshCw size={16} strokeWidth={1.8} aria-hidden="true" />
                    {loading ? 'Checking' : 'Check again'}
                </button>
            </header>

            {loading && system.services.length === 0 && (
                <p className="opportunity-system-state" role="status">Checking services…</p>
            )}
            {!loading && error && (
                <div className="opportunity-system-state is-error" role="alert">
                    <p>{error}</p>
                    <button type="button" onClick={() => void loadSystem()}>Try again</button>
                </div>
            )}
            {system.services.length > 0 && (
                <div className="opportunity-system-grid">
                    {system.services.filter((service) => service.id !== 'jobs').map((service) => {
                        const Icon = serviceIcons[service.id] || Activity;
                        return (
                            <article key={service.id} className={`opportunity-system-card is-${service.status}`}>
                                <div className="opportunity-system-card-heading">
                                    <span className="opportunity-system-icon" aria-hidden="true">
                                        <Icon size={19} strokeWidth={1.7} />
                                    </span>
                                    <span className="opportunity-system-status">{service.statusLabel}</span>
                                </div>
                                <h4>{service.label}</h4>
                                <p>{service.detail}</p>
                                {service.meta && <small>{service.meta}</small>}
                            </article>
                        );
                    })}
                </div>
            )}

        </section>
    );
}
