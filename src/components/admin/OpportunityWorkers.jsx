import { useCallback, useEffect, useState } from 'react';
import { Activity, BellRing, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import './opportunity-system.css';
import './opportunity-workers.css';

const getAdminToken = async (providedToken) => {
    if (providedToken) return providedToken;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Your admin session has expired.');
    return session.access_token;
};

const queueCards = [
    {
        id: 'capture',
        label: 'Capture worker',
        description: 'Processes links, images, PDFs, and messages into saved opportunities.',
        Icon: Activity,
        completedLabel: 'Succeeded',
    },
    {
        id: 'reminders',
        label: 'Reminder worker',
        description: 'Delivers scheduled deadline reminders for saved opportunities.',
        Icon: BellRing,
        completedLabel: 'Sent',
    },
];

export default function OpportunityWorkers({ accessToken }) {
    const [system, setSystem] = useState({ services: [], activity: null, checkedAt: null });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadWorkers = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const token = await getAdminToken(accessToken);
            const response = await fetch('/api/admin/opportunities/status', {
                cache: 'no-store',
                headers: { Authorization: `Bearer ${token}` },
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Could not check Opportunity Tracker workers.');
            setSystem(payload);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Could not check Opportunity Tracker workers.');
        } finally {
            setLoading(false);
        }
    }, [accessToken]);

    useEffect(() => {
        void loadWorkers();
    }, [loadWorkers]);

    const workerStatus = system.services.find((service) => service.id === 'jobs');

    return (
        <section className="opportunity-admin-collection opportunity-system opportunity-workers" aria-labelledby="opportunity-workers-title">
            <header className="opportunity-admin-results-heading">
                <div className="opportunity-admin-results-lead">
                    <h3 id="opportunity-workers-title" className="opportunity-admin-counter">Workers</h3>
                    <p>Capture and reminder activity from the last 24 hours.</p>
                </div>
                <button type="button" className="opportunity-system-refresh" onClick={() => void loadWorkers()} disabled={loading}>
                    <RefreshCw size={16} strokeWidth={1.8} aria-hidden="true" />
                    {loading ? 'Checking' : 'Check again'}
                </button>
            </header>

            {loading && !system.activity && (
                <p className="opportunity-system-state" role="status">Checking workers…</p>
            )}
            {!loading && error && (
                <div className="opportunity-system-state is-error" role="alert">
                    <p>{error}</p>
                    <button type="button" onClick={() => void loadWorkers()}>Try again</button>
                </div>
            )}
            {!loading && !error && !system.activity && (
                <div className="opportunity-system-state is-error" role="alert">
                    <p>{workerStatus?.detail || 'Worker activity is unavailable.'}</p>
                </div>
            )}
            {system.activity && (
                <div className="opportunity-workers-grid">
                    {queueCards.map(({ id, label, description, Icon, completedLabel }) => {
                        const queue = system.activity[id];
                        const needsAttention = queue.failed > 0;
                        return (
                            <article key={id} className={`opportunity-worker-card ${needsAttention ? 'is-attention' : 'is-ready'}`}>
                                <div className="opportunity-system-card-heading">
                                    <span className="opportunity-system-icon" aria-hidden="true">
                                        <Icon size={19} strokeWidth={1.7} />
                                    </span>
                                    <span className="opportunity-system-status">
                                        {needsAttention ? 'Attention' : 'Healthy'}
                                    </span>
                                </div>
                                <h4>{label}</h4>
                                <p>{description}</p>
                                <dl className="opportunity-worker-metrics">
                                    <div><dt>Pending</dt><dd>{queue.pending}</dd></div>
                                    <div><dt>Processing</dt><dd>{queue.processing}</dd></div>
                                    <div><dt>{completedLabel}</dt><dd>{queue.completed}</dd></div>
                                    <div><dt>Failed</dt><dd>{queue.failed}</dd></div>
                                </dl>
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
