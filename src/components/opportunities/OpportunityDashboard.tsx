import React, { useState, useEffect, useMemo } from 'react';
import type { Opportunity, OpportunityCategory, OpportunityStatus } from '../../lib/opportunities/types';
import { OpportunityCard } from './OpportunityCard';
import { EditOpportunityModal } from './EditOpportunityModal';
import { ManualCreateModal } from './ManualCreateModal';

type DeadlineFilter = 'all' | 'today' | '48hrs' | '7days' | '14days' | '30days' | 'rolling' | 'unknown' | 'expired';

export const OpportunityDashboard: React.FC = () => {
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

    // Capture bar state
    const [captureUrl, setCaptureUrl] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [isCapturing, setIsCapturing] = useState(false);

    // Filters
    const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Modals
    const [editingOpp, setEditingOpp] = useState<Opportunity | null>(null);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [manualInitialUrl, setManualInitialUrl] = useState('');

    // Toast
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Ticker state to force relative deadline re-render every 60s
    const [, setTick] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setTick((t) => t + 1), 60000);
        return () => clearInterval(timer);
    }, []);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 4000);
    };

    // 1. Initial Load & Auth Check
    const fetchOpportunities = async () => {
        try {
            const res = await fetch('/api/opportunities');
            if (res.status === 401) {
                setIsAuthenticated(false);
                setIsLoading(false);
                return;
            }
            if (res.ok) {
                const data = await res.json();
                setOpportunities(data.opportunities || []);
                setIsAuthenticated(true);
            }
        } catch (err) {
            console.error('Failed to load opportunities:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchOpportunities();
    }, []);

    // 2. Auth Login Handler
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!authPassword) return;

        try {
            const res = await fetch('/api/opportunities/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: authPassword }),
            });

            if (res.ok) {
                setIsAuthenticated(true);
                showToast('Authenticated ✓');
                fetchOpportunities();
            } else {
                showToast('❌ Invalid password');
            }
        } catch {
            showToast('❌ Login failed');
        }
    };

    // 3. Capture URL Handler
    const handleCapture = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!captureUrl.trim()) return;

        setIsCapturing(true);
        try {
            const res = await fetch('/api/opportunities/capture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: captureUrl.trim(),
                    password: authPassword || undefined,
                }),
            });

            const data = await res.json();

            if (res.status === 401) {
                setIsAuthenticated(false);
                showToast('❌ Password required');
                return;
            }

            if (!res.ok) {
                if (data.can_manual_create) {
                    showToast(`⚠️ ${data.error}`);
                    setManualInitialUrl(captureUrl);
                    setIsManualModalOpen(true);
                } else {
                    showToast(`❌ ${data.error || 'Extraction failed'}`);
                }
                return;
            }

            // Success
            if (data.is_duplicate) {
                showToast(`Already Saved ✓ Loaded "${data.opportunity.title}" (0 AI calls)`);
            } else {
                showToast(`Saved ✓ Extracted "${data.opportunity.title}"`);
            }

            setCaptureUrl('');
            fetchOpportunities();
        } catch (err: any) {
            showToast(`❌ Capture error: ${err.message}`);
        } finally {
            setIsCapturing(false);
        }
    };

    // 4. Update Status Handler
    const handleUpdateStatus = async (id: string, status: OpportunityStatus) => {
        // Optimistic update
        setOpportunities((prev) =>
            prev.map((o) => (o.id === id ? { ...o, status } : o))
        );

        try {
            const res = await fetch(`/api/opportunities/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });

            if (res.ok) {
                showToast(`Status updated to ${status} (0 AI calls)`);
            } else {
                showToast('❌ Failed to update status');
                fetchOpportunities();
            }
        } catch {
            showToast('❌ Error updating status');
            fetchOpportunities();
        }
    };

    // 5. Save Modal Edit Handler
    const handleSaveEdit = async (id: string, updates: Partial<Opportunity>) => {
        try {
            const res = await fetch(`/api/opportunities/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });

            if (res.ok) {
                showToast('Opportunity updated ✓ (0 AI calls)');
                fetchOpportunities();
            } else {
                showToast('❌ Failed to save updates');
            }
        } catch {
            showToast('❌ Error saving updates');
        }
    };

    // 6. Manual Create Handler
    const handleManualCreate = async (payload: any) => {
        try {
            const res = await fetch('/api/opportunities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                showToast('Opportunity created ✓ (0 AI calls)');
                fetchOpportunities();
            } else {
                showToast('❌ Failed to create opportunity');
            }
        } catch {
            showToast('❌ Error creating opportunity');
        }
    };

    // 7. Re-extract Handler (Explicit AI call)
    const handleReExtract = async (id: string) => {
        try {
            const res = await fetch(`/api/opportunities/${id}/re-extract`, {
                method: 'POST',
            });

            const data = await res.json();
            if (res.ok) {
                showToast(data.message || 'Re-extracted successfully ✓');
                fetchOpportunities();
            } else {
                showToast(`❌ ${data.error || 'Re-extraction failed'}`);
            }
        } catch (err: any) {
            showToast(`❌ Re-extraction error: ${err.message}`);
        }
    };

    // 8. Delete Handler
    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/opportunities/${id}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                showToast('Opportunity deleted');
                setOpportunities((prev) => prev.filter((o) => o.id !== id));
            } else {
                showToast('❌ Failed to delete');
            }
        } catch {
            showToast('❌ Error deleting');
        }
    };

    // Filter calculations
    const now = Date.now();

    // Urgent attention count: actionable items closing within 7 days
    const attentionCount = useMemo(() => {
        return opportunities.filter((o) => {
            const isActionable = o.status !== 'done' && o.status !== 'dismissed' && o.status !== 'submitted';
            if (!isActionable) return false;

            if (o.deadline_at) {
                const diffMs = new Date(o.deadline_at).getTime() - now;
                return diffMs >= 0 && diffMs <= 7 * 24 * 60 * 60 * 1000;
            }
            if (o.event_date) {
                const diffMs = new Date(o.event_date).getTime() - now;
                return diffMs >= 0 && diffMs <= 2 * 24 * 60 * 60 * 1000;
            }
            return false;
        }).length;
    }, [opportunities, now]);

    const filteredOpportunities = useMemo(() => {
        return opportunities.filter((o) => {
            // Category Filter
            if (categoryFilter !== 'all' && o.category !== categoryFilter) {
                return false;
            }

            // Status Filter
            if (statusFilter !== 'all' && o.status !== statusFilter) {
                return false;
            }

            // Search Query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchesTitle = o.title.toLowerCase().includes(q);
                const matchesOrg = o.organisation.toLowerCase().includes(q);
                const matchesReqs = o.requirements?.some((r) => r.toLowerCase().includes(q));
                const matchesNext = o.next_action?.toLowerCase().includes(q);
                if (!matchesTitle && !matchesOrg && !matchesReqs && !matchesNext) {
                    return false;
                }
            }

            // Deadline Filter
            if (deadlineFilter !== 'all') {
                if (deadlineFilter === 'rolling') {
                    return o.deadline_confidence === 'rolling';
                }
                if (deadlineFilter === 'unknown') {
                    return !o.deadline_at && o.deadline_confidence !== 'rolling';
                }

                if (!o.deadline_at) return false;
                const diffMs = new Date(o.deadline_at).getTime() - now;

                if (deadlineFilter === 'expired') {
                    return diffMs < 0;
                }
                if (diffMs < 0) return false; // ignore expired for future filters

                const diffHours = diffMs / (1000 * 60 * 60);
                if (deadlineFilter === 'today') return diffHours <= 24;
                if (deadlineFilter === '48hrs') return diffHours <= 48;
                if (deadlineFilter === '7days') return diffHours <= 7 * 24;
                if (deadlineFilter === '14days') return diffHours <= 14 * 24;
                if (deadlineFilter === '30days') return diffHours <= 30 * 24;
            }

            return true;
        });
    }, [opportunities, deadlineFilter, categoryFilter, statusFilter, searchQuery, now]);

    // If unauthenticated and no cached opportunities, render zero-scroll split auth hero
    if (isAuthenticated === false && opportunities.length === 0) {
        return (
            <div className="opportunities-shell">
                <div className="opp-auth-hero-wrap">
                    <div className="opp-auth-hero-split">
                        {/* Left Side: Brand & Mission */}
                        <div className="opp-auth-side-brand">
                            <div className="opp-auth-badge">🔒 Private Field Desk</div>
                            <h1 className="opp-auth-title">OPPORTUNITY RADAR</h1>
                            <p className="opp-auth-subtitle">
                                Track grants, residencies, fellowships, and critical submission deadlines with automated reminders.
                            </p>
                            <div className="opp-tag-cloud" style={{ borderTop: '2px dashed rgba(21, 19, 15, 0.25)', marginTop: '8px' }}>
                                <span className="opp-tag-pill">#Grants</span>
                                <span className="opp-tag-pill">#Residencies</span>
                                <span className="opp-tag-pill">#Fellowships</span>
                                <span className="opp-tag-pill">#OpenCalls</span>
                            </div>
                        </div>

                        {/* Right Side: Passcode Unlock Form */}
                        <div className="opp-auth-side-form">
                            <div>
                                <h2 style={{ fontSize: '1.4rem', fontWeight: 900, margin: '0 0 6px', color: 'var(--opp-ink)' }}>
                                    Unlock Workspace
                                </h2>
                                <p style={{ fontSize: '0.9rem', color: 'var(--opp-muted)', margin: 0 }}>
                                    Enter your private passcode to continue.
                                </p>
                            </div>

                            <form onSubmit={handleLogin} className="opp-auth-form">
                                <input
                                    type="password"
                                    className="opp-auth-input"
                                    placeholder="Enter secret passcode..."
                                    value={authPassword}
                                    onChange={(e) => setAuthPassword(e.target.value)}
                                    autoFocus
                                    required
                                />
                                <button type="submit" className="opp-btn opp-btn-purple" style={{ width: '100%', padding: '13px' }}>
                                    Unlock Workspace →
                                </button>
                            </form>
                        </div>
                    </div>
                </div>

                {/* Toast Notification */}
                {toastMessage && <div className="opp-toast">{toastMessage}</div>}
            </div>
        );
    }

    return (
        <div className="opportunities-shell">
            {/* Top Attention Header & Capture Bar */}
            <div className="opp-header">
                <div className="opp-header-top">
                    <div className="opp-title-area">
                        <div className="opp-eyebrow">⚡ FIELD RADAR · DON'T SLEEP ON THESE</div>
                        <h1 className="opp-main-title">OPPORTUNITY DESK</h1>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div className="opp-attention-pill">
                            <div className="opp-attention-pulse" />
                            <span>{attentionCount} need your attention</span>
                        </div>

                        <button
                            type="button"
                            className="opp-btn opp-btn-secondary opp-btn-sm"
                            onClick={() => {
                                setManualInitialUrl('');
                                setIsManualModalOpen(true);
                            }}
                        >
                            + Manual Entry
                        </button>
                    </div>
                </div>

                {/* Capture URL Bar */}
                <form onSubmit={handleCapture} className="opp-capture-form">
                    <input
                        type="url"
                        className="opp-capture-input"
                        placeholder="Paste opportunity link (grant, residency, fellowship, job call)..."
                        value={captureUrl}
                        onChange={(e) => setCaptureUrl(e.target.value)}
                        required
                    />

                    <button
                        type="submit"
                        className="opp-btn opp-btn-primary"
                        disabled={isCapturing}
                    >
                        {isCapturing ? '⚡ Scouting & Reading Page...' : 'Capture Link →'}
                    </button>
                </form>
            </div>

            {/* Filter Controls Bar */}
            <div className="opp-filters-bar">
                {/* Row 1: Deadlines */}
                <div className="opp-filter-row">
                    <span className="opp-filter-label">Deadline</span>
                    <div className="opp-filter-pills">
                        {(['all', 'today', '48hrs', '7days', '14days', '30days', 'rolling', 'unknown', 'expired'] as DeadlineFilter[]).map((d) => (
                            <button
                                key={d}
                                type="button"
                                className={`opp-filter-pill ${deadlineFilter === d ? 'active' : ''}`}
                                onClick={() => setDeadlineFilter(d)}
                            >
                                {d === 'all' ? 'All Deadlines' : d === '48hrs' ? '48 hrs' : d === '7days' ? '7 days' : d === '14days' ? '14 days' : d === '30days' ? '30 days' : d.charAt(0).toUpperCase() + d.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Row 2: Category */}
                <div className="opp-filter-row">
                    <span className="opp-filter-label">Category</span>
                    <div className="opp-filter-pills">
                        {['all', 'job', 'open_call', 'residency', 'grant', 'fellowship', 'conference', 'event', 'other'].map((cat) => (
                            <button
                                key={cat}
                                type="button"
                                className={`opp-filter-pill ${categoryFilter === cat ? 'active' : ''}`}
                                onClick={() => setCategoryFilter(cat)}
                            >
                                {cat === 'all' ? 'All Categories' : cat.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Row 3: Workflow Status & Search */}
                <div className="opp-filter-row" style={{ justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="opp-filter-label">Workflow</span>
                        <div className="opp-filter-pills">
                            {['all', 'inbox', 'interested', 'preparing', 'submitted', 'registered', 'attending', 'done', 'dismissed'].map((st) => (
                                <button
                                    key={st}
                                    type="button"
                                    className={`opp-filter-pill ${statusFilter === st ? 'active' : ''}`}
                                    onClick={() => setStatusFilter(st)}
                                >
                                    {st === 'all' ? 'All Statuses' : st.charAt(0).toUpperCase() + st.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <input
                        type="text"
                        className="opp-search-input"
                        placeholder="🔍 Search title, org, needs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Opportunities Grid / Left & Right Split Empty State */}
            {isLoading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--opp-cream)', fontSize: '1.2rem', fontWeight: 800 }}>
                    ⚡ Loading field radar...
                </div>
            ) : opportunities.length === 0 ? (
                /* 2-Column Split Empty State when 0 opportunities exist */
                <div className="opp-empty-split-grid">
                    {/* Left Block: Quick Actions */}
                    <div className="opp-empty-block">
                        <div className="opp-empty-block-header">
                            <div className="opp-empty-icon-sm">⚡</div>
                            <div>
                                <h3 className="opp-empty-heading">Start Tracking</h3>
                                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--opp-muted)' }}>Quick capture workflow</p>
                            </div>
                        </div>
                        <p className="opp-empty-text">
                            Paste any URL into the top bar to extract deadline metadata automatically, or log a private opportunity manually.
                        </p>
                        <div className="opp-empty-block-actions">
                            <button
                                type="button"
                                className="opp-btn opp-btn-primary"
                                onClick={() => {
                                    setManualInitialUrl('');
                                    setIsManualModalOpen(true);
                                }}
                            >
                                + Manual Entry
                            </button>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--opp-muted)', background: 'rgba(21, 19, 15, 0.04)', padding: '8px 12px', borderRadius: '6px' }}>
                            💡 <strong>Tip:</strong> Click your pinned Chrome extension icon on any page to capture instantly.
                        </div>
                    </div>

                    {/* Right Block: Radar Status */}
                    <div className="opp-empty-block accent">
                        <div className="opp-empty-block-header">
                            <div className="opp-empty-icon-sm">📡</div>
                            <div>
                                <h3 className="opp-empty-heading">Radar is Clear</h3>
                                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--opp-muted)' }}>No pending deadlines</p>
                            </div>
                        </div>
                        <p className="opp-empty-text">
                            Captured opportunities appear as interactive editorial cards with real-time countdowns and reminder triggers.
                        </p>
                        <div className="opp-tag-cloud">
                            <span className="opp-tag-pill">#Grants</span>
                            <span className="opp-tag-pill">#Residencies</span>
                            <span className="opp-tag-pill">#Fellowships</span>
                            <span className="opp-tag-pill">#OpenCalls</span>
                            <span className="opp-tag-pill">#JobCalls</span>
                        </div>
                    </div>
                </div>
            ) : filteredOpportunities.length === 0 ? (
                /* Compact alert when a filter produces 0 results */
                <div className="opp-no-filter-alert">
                    <div>
                        <strong>No opportunities match this filter.</strong>
                        <span style={{ color: 'var(--opp-muted)', marginLeft: '8px' }}>
                            Try adjusting your deadline horizon or category filter.
                        </span>
                    </div>
                    <button
                        type="button"
                        className="opp-btn opp-btn-secondary opp-btn-sm"
                        onClick={() => {
                            setDeadlineFilter('all');
                            setCategoryFilter('all');
                            setStatusFilter('all');
                            setSearchQuery('');
                        }}
                    >
                        Reset Filters ↺
                    </button>
                </div>
            ) : (
                /* Opportunities Grid when cards exist */
                <div className="opp-grid">
                    {filteredOpportunities.map((opp) => (
                        <OpportunityCard
                            key={opp.id}
                            opportunity={opp}
                            onUpdateStatus={handleUpdateStatus}
                            onEdit={(o) => setEditingOpp(o)}
                            onReExtract={handleReExtract}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            )}

            {/* Edit Modal */}
            {editingOpp && (
                <EditOpportunityModal
                    opportunity={editingOpp}
                    isOpen={Boolean(editingOpp)}
                    onClose={() => setEditingOpp(null)}
                    onSave={handleSaveEdit}
                />
            )}

            {/* Manual Create Modal */}
            <ManualCreateModal
                isOpen={isManualModalOpen}
                initialUrl={manualInitialUrl}
                onClose={() => setIsManualModalOpen(false)}
                onCreate={handleManualCreate}
            />

            {/* Toast Notification */}
            {toastMessage && <div className="opp-toast">{toastMessage}</div>}
        </div>
    );
};
export default OpportunityDashboard;
