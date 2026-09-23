import React, { useState, useEffect, useMemo } from 'react';
import type { Opportunity, OpportunityCategory, OpportunityStatus } from '../../lib/opportunities/types';
import { formatCategoryTitle } from '../../lib/opportunities/ui-helpers';
import { OpportunityCard } from './OpportunityCard';
import { OpportunityDetailModal } from './OpportunityDetailModal';
import { EditOpportunityModal } from './EditOpportunityModal';
import { ManualCreateModal } from './ManualCreateModal';

type UrgencyRailFilter = 'attention' | 'this_week' | 'this_month' | 'later' | 'all';

interface OpportunityDashboardProps {
    initialIsAuthenticated?: boolean;
}

export const OpportunityDashboard: React.FC<OpportunityDashboardProps> = ({ initialIsAuthenticated = false }) => {
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(initialIsAuthenticated);
    const [isLoading, setIsLoading] = useState<boolean>(initialIsAuthenticated);

    // Capture bar state
    const [captureUrl, setCaptureUrl] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [isCapturing, setIsCapturing] = useState(false);

    // Filters: Single clean Urgency Rail + Secondary Filter Tray Toggle
    const [urgencyFilter, setUrgencyFilter] = useState<UrgencyRailFilter>('all');
    const [isFilterTrayOpen, setIsFilterTrayOpen] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [priorityFilter, setPriorityFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Modals
    const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null);
    const [editingOpp, setEditingOpp] = useState<Opportunity | null>(null);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [manualInitialUrl, setManualInitialUrl] = useState('');

    // Toast
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Ticker state to force relative deadline re-render every 60s
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(timer);
    }, []);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    // 1. Fetch Opportunities (Public by default)
    const fetchOpportunities = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/opportunities?refresh=${Date.now()}`, {
                cache: 'no-store',
            });
            if (res.ok) {
                const data = await res.json();
                setOpportunities(data.opportunities || []);
                if (typeof data.authenticated === 'boolean') {
                    setIsAuthenticated(data.authenticated);
                }
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
                setIsLoginModalOpen(false);
                setAuthPassword('');
                showToast('✓ Curator Workspace Unlocked');
                fetchOpportunities();
            } else {
                showToast('❌ Invalid Passcode');
            }
        } catch {
            showToast('❌ Login failed');
        }
    };

    const handleLogout = async () => {
        try {
            await fetch('/api/opportunities/auth', { method: 'DELETE' });
            setIsAuthenticated(false);
            showToast('Logged out of Curator Mode');
            fetchOpportunities();
        } catch {
            showToast('Logout failed');
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
                body: JSON.stringify({ url: captureUrl }),
            });

            const data = await res.json();
            if (res.ok && data.opportunity) {
                showToast(`✓ Captured "${data.opportunity.title}"`);
                setCaptureUrl('');
                setOpportunities((prev) => {
                    const filtered = prev.filter((o) => o.id !== data.opportunity.id);
                    return [data.opportunity, ...filtered];
                });
            } else {
                showToast(`❌ ${data.error || 'Failed to capture'}`);
            }
        } catch (err: any) {
            showToast(`❌ Network error: ${err.message}`);
        } finally {
            setIsCapturing(false);
        }
    };

    // 4. Update Status
    const handleUpdateStatus = async (id: string, newStatus: OpportunityStatus) => {
        setOpportunities((prev) =>
            prev.map((o) => (o.id === id ? { ...o, status: newStatus } : o))
        );

        try {
            const res = await fetch(`/api/opportunities/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
                const formatted = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
                showToast(`✓ Status updated to ${formatted}`);
            } else {
                showToast('❌ Failed to update status');
            }
        } catch {
            showToast('❌ Network error updating status');
        }
    };

    // 5. Update Priority
    const handleUpdatePriority = async (id: string, priority: number) => {
        setOpportunities((prev) =>
            prev.map((o) => (o.id === id ? { ...o, priority } : o))
        );

        try {
            const res = await fetch(`/api/opportunities/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ priority }),
            });
            if (res.ok) {
                const label = priority === 3 ? 'High' : priority === 2 ? 'Medium' : 'Low';
                showToast(`✓ Priority set to ${label}`);
            }
        } catch {
            showToast('❌ Failed to update priority');
        }
    };

    // 6. Save Edits from Modal
    const handleSaveEdit = async (id: string, updates: Partial<Opportunity>) => {
        setOpportunities((prev) =>
            prev.map((o) => (o.id === id ? { ...o, ...updates } : o))
        );

        try {
            const res = await fetch(`/api/opportunities/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            if (res.ok) {
                showToast('✓ Opportunity details saved');
                fetchOpportunities();
            } else {
                showToast('❌ Failed to save changes');
            }
        } catch {
            showToast('❌ Network error saving changes');
        }
    };

    // 7. Manual Create
    const handleManualCreate = async (payload: any) => {
        try {
            const res = await fetch('/api/opportunities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (res.ok && data.opportunity) {
                showToast(`✓ Created "${data.opportunity.title}"`);
                setOpportunities((prev) => [data.opportunity, ...prev]);
            } else {
                showToast(`❌ ${data.error || 'Failed to create'}`);
            }
        } catch {
            showToast('❌ Error creating opportunity');
        }
    };

    // 8. Re-extract
    const handleReExtract = async (id: string) => {
        try {
            const res = await fetch(`/api/opportunities/${id}/re-extract`, {
                method: 'POST',
            });
            const data = await res.json();
            if (res.ok && data.opportunity) {
                showToast('✓ Re-extracted fresh metadata');
                setOpportunities((prev) =>
                    prev.map((o) => (o.id === id ? data.opportunity : o))
                );
            } else {
                showToast(`❌ ${data.error || 'Failed to re-extract'}`);
            }
        } catch {
            showToast('❌ Error re-extracting');
        }
    };

    // 9. Delete
    const handleDelete = async (id: string) => {
        setOpportunities((prev) => prev.filter((o) => o.id !== id));
        try {
            const res = await fetch(`/api/opportunities/${id}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                showToast('✓ Opportunity deleted');
            } else {
                showToast('❌ Failed to delete');
            }
        } catch {
            showToast('❌ Error deleting');
        }
    };

    // Count opportunities needing immediate attention (due within 7 days or priority 3)
    const attentionCount = useMemo(() => {
        return opportunities.filter((o) => {
            if (o.status === 'done' || o.status === 'dismissed') return false;
            if (o.priority === 3) return true;
            const actionableAt = o.deadline_at || o.event_date;
            if (!actionableAt) return false;
            const diffMs = new Date(actionableAt).getTime() - now;
            const diffHours = diffMs / (1000 * 60 * 60);
            return diffHours > 0 && diffHours <= 7 * 24;
        }).length;
    }, [opportunities, now]);

    // Filter & Smart Sort Opportunities
    const filteredOpportunities = useMemo(() => {
        const filtered = opportunities.filter((o) => {
            // Category Filter
            if (categoryFilter !== 'all' && o.category !== categoryFilter) {
                return false;
            }

            // Workflow Status Filter
            if (statusFilter !== 'all' && o.status !== statusFilter) {
                return false;
            }

            // Priority Star Rating Filter
            if (priorityFilter !== 'all' && (o.priority || 1) !== Number(priorityFilter)) {
                return false;
            }

            // Search Query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchTitle = o.title?.toLowerCase().includes(q);
                const matchOrg = o.organisation?.toLowerCase().includes(q);
                const matchSummary = o.summary?.toLowerCase().includes(q);
                const matchNotes = o.notes?.toLowerCase().includes(q);
                const matchReqs = o.requirements?.some((r) => r.toLowerCase().includes(q));
                if (!matchTitle && !matchOrg && !matchSummary && !matchNotes && !matchReqs) {
                    return false;
                }
            }

            // Urgency Rail Filters: 'attention' | 'this_week' | 'this_month' | 'later' | 'all'
            if (urgencyFilter === 'all') return true;

            const actionableAt = o.deadline_at || o.event_date;
            const diffMs = actionableAt ? new Date(actionableAt).getTime() - now : null;
            const diffHours = diffMs !== null ? diffMs / (1000 * 60 * 60) : null;
            const isDoneOrDismissed = o.status === 'done' || o.status === 'dismissed';

            if (urgencyFilter === 'attention') {
                if (isDoneOrDismissed) return false;
                if (o.priority === 3) return true;
                if (diffHours !== null && diffHours > 0 && diffHours <= 7 * 24) return true;
                return false;
            }

            if (urgencyFilter === 'this_week') {
                if (diffHours === null) return false;
                return diffHours > 0 && diffHours <= 7 * 24;
            }

            if (urgencyFilter === 'this_month') {
                if (diffHours === null) return false;
                return diffHours > 0 && diffHours <= 30 * 24;
            }

            if (urgencyFilter === 'later') {
                if (o.deadline_confidence === 'rolling') return true;
                if (diffHours === null) return true;
                return diffHours > 30 * 24;
            }

            return true;
        });

        // Smart Sort: High priority opportunities nearing deadline automatically surface first
        return filtered.sort((a, b) => {
            const getScore = (opp: Opportunity) => {
                const isDone = opp.status === 'done' || opp.status === 'dismissed';
                if (isDone) return 100000;

                const prio = opp.priority || 1; // 1, 2, 3
                const prioBonus = (3 - prio) * 50; // Priority 3 gets 0 penalty, Priority 1 gets +100 penalty

                if (opp.deadline_at) {
                    const diffHours = (new Date(opp.deadline_at).getTime() - now) / (1000 * 60 * 60);
                    if (diffHours < 0) return 90000; // expired
                    return Math.max(0, diffHours) + prioBonus;
                }

                if (opp.event_date) {
                    const diffHours = (new Date(opp.event_date).getTime() - now) / (1000 * 60 * 60);
                    if (diffHours < 0) return 90000; // past event
                    return Math.max(0, diffHours) + prioBonus;
                }

                if (opp.deadline_confidence === 'rolling') return 8000 + prioBonus;
                return 5000 + prioBonus; // no date
            };

            return getScore(a) - getScore(b);
        });
    }, [opportunities, urgencyFilter, categoryFilter, statusFilter, priorityFilter, searchQuery, now]);

    // Active secondary filters count for badge
    const activeSecondaryFiltersCount =
        (categoryFilter !== 'all' ? 1 : 0) +
        (statusFilter !== 'all' ? 1 : 0) +
        (priorityFilter !== 'all' ? 1 : 0) +
        (searchQuery.trim() ? 1 : 0);

    return (
        <div className="opportunities-shell">
            {/* Enlarged Curated Opportunities Hero Deck */}
            <header className="opp-hero-deck">
                <div className="opp-hero-main">
                    <div className="opp-hero-header-row">
                        <div className="opp-hero-branding">
                            <h1 className="opp-hero-title">Curated Opportunities</h1>
                            <p className="opp-hero-tagline">See it. Save it. Seize it.</p>
                        </div>
                        {isAuthenticated && (
                            <div className="opp-hero-curator-top-pill">
                                <span className="opp-curator-pulse-dot" />
                                <span className="opp-curator-pill-label">Curator Mode</span>
                                <button
                                    type="button"
                                    className="opp-curator-pill-logout"
                                    onClick={handleLogout}
                                    title="Exit Curator Mode (Switch to Visitor View)"
                                >
                                    Log Out ✕
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Capture Bar: Only shown when authenticated */}
                    {isAuthenticated && (
                        <form onSubmit={handleCapture} className="opp-hero-capture-bar">
                            <input
                                type="url"
                                className="opp-hero-capture-input"
                                placeholder="Paste opportunity URL (grant, residency, open call)..."
                                value={captureUrl}
                                onChange={(e) => setCaptureUrl(e.target.value)}
                                required
                            />
                            <button
                                type="submit"
                                className="opp-btn opp-btn-primary opp-hero-btn"
                                disabled={isCapturing}
                            >
                                {isCapturing ? '⚡ Scouting...' : 'Capture →'}
                            </button>
                            <button
                                type="button"
                                className="opp-btn opp-btn-secondary opp-hero-btn"
                                onClick={() => {
                                    setManualInitialUrl('');
                                    setIsManualModalOpen(true);
                                }}
                            >
                                + Add Manually
                            </button>
                        </form>
                    )}
                </div>
            </header>

            {/* Thin Divider Line */}
            <div className="opp-radar-divider" />

            {/* Horizontal Urgency Rail & Filter Popover Toggle */}
            <div className="opp-rail-wrapper">
                <div className="opp-urgency-rail">
                    {(
                        [
                            { id: 'all', label: 'All' },
                            { id: 'attention', label: '⚡ Attention' },
                            { id: 'this_week', label: 'This Week' },
                            { id: 'this_month', label: 'This Month' },
                            { id: 'later', label: 'Later' },
                        ] as { id: UrgencyRailFilter; label: string }[]
                    ).map((r) => (
                        <button
                            key={r.id}
                            type="button"
                            className={`opp-rail-pill ${urgencyFilter === r.id ? 'active' : ''}`}
                            onClick={() => setUrgencyFilter(r.id)}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>

                {/* Filter Button with Badge and Dropdown Anchor */}
                <div className="opp-filter-anchor-wrap">
                    <button
                        type="button"
                        className={`opp-filter-toggle-btn ${isFilterTrayOpen || activeSecondaryFiltersCount > 0 ? 'active' : ''}`}
                        onClick={() => setIsFilterTrayOpen(!isFilterTrayOpen)}
                        aria-expanded={isFilterTrayOpen}
                        aria-haspopup="dialog"
                    >
                        <span>Filter {isFilterTrayOpen ? '↑' : '↓'}</span>
                        {activeSecondaryFiltersCount > 0 && (
                            <span className="opp-filter-count-badge">{activeSecondaryFiltersCount}</span>
                        )}
                    </button>

                    {/* Floating Popover: Floats right below the filter button with NO layout shift */}
                    {isFilterTrayOpen && (
                        <>
                            <div
                                className="opp-popover-backdrop"
                                onClick={() => setIsFilterTrayOpen(false)}
                            />
                            <div className="opp-filter-popover" role="dialog" aria-label="Filter Opportunities">
                                <div className="opp-popover-header">
                                    <span className="opp-popover-title">Refine Radar</span>
                                    {activeSecondaryFiltersCount > 0 && (
                                        <button
                                            type="button"
                                            className="opp-reset-filters-link"
                                            onClick={() => {
                                                setCategoryFilter('all');
                                                setStatusFilter('all');
                                                setPriorityFilter('all');
                                                setSearchQuery('');
                                            }}
                                        >
                                            Reset All ↺
                                        </button>
                                    )}
                                </div>

                                {/* Box 1: Category Selection */}
                                <div className="opp-popover-section">
                                    <div className="opp-popover-section-label">Category</div>
                                    <div className="opp-popover-pills">
                                        {['all', 'grant', 'residency', 'fellowship', 'open_call', 'job', 'conference', 'event'].map((cat) => (
                                            <button
                                                key={cat}
                                                type="button"
                                                className={`opp-popover-pill ${categoryFilter === cat ? 'active' : ''}`}
                                                onClick={() => setCategoryFilter(cat)}
                                            >
                                                {cat === 'all' ? 'All' : cat === 'open_call' ? 'Open Call' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Box 2: Workflow Status Selection */}
                                <div className="opp-popover-section">
                                    <div className="opp-popover-section-label">Workflow Status</div>
                                    <div className="opp-popover-pills">
                                        {['all', 'inbox', 'interested', 'preparing', 'submitted', 'registered', 'done'].map((st) => (
                                            <button
                                                key={st}
                                                type="button"
                                                className={`opp-popover-pill ${statusFilter === st ? 'active' : ''}`}
                                                onClick={() => setStatusFilter(st)}
                                            >
                                                {st === 'all' ? 'All' : st.charAt(0).toUpperCase() + st.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Box 3: Priority Rating Selection */}
                                <div className="opp-popover-section">
                                    <div className="opp-popover-section-label">Priority Rating</div>
                                    <div className="opp-popover-pills">
                                        {[
                                            { id: 'all', label: 'All' },
                                            { id: '3', label: '★★★ High' },
                                            { id: '2', label: '★★ Medium' },
                                            { id: '1', label: '★ Low' },
                                        ].map((p) => (
                                            <button
                                                key={p.id}
                                                type="button"
                                                className={`opp-popover-pill ${priorityFilter === p.id ? 'active' : ''}`}
                                                onClick={() => setPriorityFilter(p.id)}
                                            >
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Box 4: Live Search Box */}
                                <div className="opp-popover-search-box">
                                    <input
                                        type="text"
                                        className="opp-popover-search-input"
                                        placeholder="🔍 Search title, org, eligibility..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Category Filter Title Heading (e.g. "Residency Listings", "Job Listings", "Open Call Listings") */}
            {categoryFilter !== 'all' && (
                <div className="opp-category-header-banner">
                    <h2 className="opp-category-header-title">
                        {formatCategoryTitle(categoryFilter)} Listings
                    </h2>
                    <button
                        type="button"
                        className="opp-category-header-clear"
                        onClick={() => setCategoryFilter('all')}
                        title="Show all listings"
                    >
                        Show All Listings ✕
                    </button>
                </div>
            )}

            {/* Opportunities Grid / Empty State */}
            {isLoading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--opp-cream)', fontSize: '1.1rem', fontWeight: 800 }}>
                    ⚡ Loading opportunities...
                </div>
            ) : opportunities.length === 0 ? (
                /* Split Empty State when 0 opportunities recorded */
                <div className="opp-empty-split-grid">
                    <div className="opp-empty-block">
                        <div className="opp-empty-block-header">
                            <div className="opp-empty-icon-sm">⚡</div>
                            <div>
                                <h3 className="opp-empty-heading">Start Tracking</h3>
                                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--opp-muted)' }}>Quick capture workflow</p>
                            </div>
                        </div>
                        <p className="opp-empty-text">
                            Paste any opportunity link into the bar above or click Add Manually to log deadlines and setup automatic reminders.
                        </p>
                        <div className="opp-empty-block-actions">
                            <button
                                type="button"
                                className="opp-btn opp-btn-primary opp-btn-sm"
                                onClick={() => {
                                    setManualInitialUrl('');
                                    setIsManualModalOpen(true);
                                }}
                            >
                                + Add Manually
                            </button>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--opp-muted)', background: 'rgba(21, 19, 15, 0.04)', padding: '8px 12px', borderRadius: '6px' }}>
                            💡 <strong>Tip:</strong> Pinned Chrome extension captures in 1 click from any browser tab.
                        </div>
                    </div>

                    <div className="opp-empty-block accent">
                        <div className="opp-empty-block-header">
                            <div className="opp-empty-icon-sm">📡</div>
                            <div>
                                <h3 className="opp-empty-heading">Radar is Clear</h3>
                                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--opp-muted)' }}>No pending deadlines</p>
                            </div>
                        </div>
                        <p className="opp-empty-text">
                            Active opportunities appear as cards with real-time countdowns, priority stars, and automatic daily email digest checks.
                        </p>
                        <div className="opp-tag-cloud">
                            <span className="opp-tag-pill">Grants</span>
                            <span className="opp-tag-pill">Residencies</span>
                            <span className="opp-tag-pill">Fellowships</span>
                            <span className="opp-tag-pill">Open Calls</span>
                            <span className="opp-tag-pill">Jobs</span>
                        </div>
                    </div>
                </div>
            ) : filteredOpportunities.length === 0 ? (
                /* Compact alert when search/filters return 0 items */
                <div className="opp-no-filter-alert">
                    <div>
                        <strong>No opportunities match this filter.</strong>
                        <span style={{ color: 'var(--opp-muted)', marginLeft: '8px' }}>
                            Try adjusting your urgency horizon or clearing secondary filters.
                        </span>
                    </div>
                    <button
                        type="button"
                        className="opp-btn opp-btn-secondary opp-btn-sm"
                        onClick={() => {
                            setUrgencyFilter('all');
                            setCategoryFilter('all');
                            setStatusFilter('all');
                            setSearchQuery('');
                        }}
                    >
                        Reset Filters ↺
                    </button>
                </div>
            ) : (
                /* Opportunities Cards Grid */
                <div className="opp-grid">
                    {filteredOpportunities.map((opp) => (
                        <OpportunityCard
                            key={opp.id}
                            opportunity={opp}
                            isAuthenticated={isAuthenticated}
                            onOpen={(o) => setSelectedDetailId(o.id)}
                            onUpdateStatus={handleUpdateStatus}
                            onUpdatePriority={handleUpdatePriority}
                            onSelectCategory={(cat) => setCategoryFilter(cat)}
                        />
                    ))}
                </div>
            )}

            {/* Bottom Public / Curator Access Trigger */}
            <footer className="opp-public-footer">
                {!isAuthenticated ? (
                    <div className="opp-curator-trigger-box">
                        <button
                            type="button"
                            className="opp-curator-login-btn"
                            onClick={() => setIsLoginModalOpen(true)}
                        >
                            + Add an opportunity
                        </button>
                    </div>
                ) : (
                    <div className="opp-curator-active-bar">
                        <span className="opp-curator-badge">✓ Curator Access Active</span>
                        <button
                            type="button"
                            className="opp-curator-logout-btn"
                            onClick={handleLogout}
                        >
                            Lock Desk 🔒
                        </button>
                    </div>
                )}
            </footer>

            {/* Curator Passcode Login Modal */}
            {isLoginModalOpen && (
                <div className="opp-modal-overlay" onClick={() => setIsLoginModalOpen(false)}>
                    <div className="opp-modal opp-curator-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="opp-modal-header">
                            <span className="opp-modal-title">Curator Access</span>
                            <button
                                type="button"
                                className="opp-modal-close-btn"
                                onClick={() => setIsLoginModalOpen(false)}
                                aria-label="Close"
                            >
                                ✕
                            </button>
                        </div>
                        <form onSubmit={handleLogin} className="opp-curator-form">
                            <p className="opp-curator-modal-desc">
                                Enter your passcode to unlock opportunity URL capture and curation controls.
                            </p>
                            <div className="opp-curator-input-group">
                                <label className="opp-curator-input-label" htmlFor="curator-passcode-input">
                                    Passcode
                                </label>
                                <input
                                    id="curator-passcode-input"
                                    type="password"
                                    className="opp-curator-input-field"
                                    placeholder="Enter passcode..."
                                    value={authPassword}
                                    onChange={(e) => setAuthPassword(e.target.value)}
                                    autoFocus
                                    required
                                />
                                <div className="opp-curator-modal-hint-box">
                                    <span className="opp-curator-modal-hint-icon">💡</span>
                                    <span className="opp-curator-modal-hint-text">
                                        Hint: Abodid's full name in <strong>lowercase</strong>
                                    </span>
                                </div>
                            </div>
                            <div className="opp-curator-modal-actions">
                                <button
                                    type="button"
                                    className="opp-btn opp-btn-secondary"
                                    onClick={() => setIsLoginModalOpen(false)}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="opp-btn opp-btn-primary">
                                    Unlock Desk →
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Opportunity Detail Modal with Keyboard Arrow Navigation */}
            {(() => {
                const selectedIndex = filteredOpportunities.findIndex((o) => o.id === selectedDetailId);
                const selectedOpp = selectedIndex >= 0 ? filteredOpportunities[selectedIndex] : null;

                if (!selectedOpp) return null;

                const handleNavigate = (direction: 1 | -1) => {
                    if (filteredOpportunities.length === 0) return;
                    const nextIdx = (selectedIndex + direction + filteredOpportunities.length) % filteredOpportunities.length;
                    setSelectedDetailId(filteredOpportunities[nextIdx].id);
                };

                return (
                    <OpportunityDetailModal
                        opportunity={selectedOpp}
                        isAuthenticated={isAuthenticated}
                        isOpen={Boolean(selectedOpp)}
                        onClose={() => setSelectedDetailId(null)}
                        onUpdateStatus={handleUpdateStatus}
                        onUpdatePriority={handleUpdatePriority}
                        onSelectCategory={(cat) => setCategoryFilter(cat)}
                        onEdit={(o) => {
                            setSelectedDetailId(null);
                            setEditingOpp(o);
                        }}
                        onReExtract={handleReExtract}
                        onDelete={async (id) => {
                            setSelectedDetailId(null);
                            await handleDelete(id);
                        }}
                        onNavigateNext={() => handleNavigate(1)}
                        onNavigatePrev={() => handleNavigate(-1)}
                        currentIndex={selectedIndex + 1}
                        totalCount={filteredOpportunities.length}
                    />
                );
            })()}

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
