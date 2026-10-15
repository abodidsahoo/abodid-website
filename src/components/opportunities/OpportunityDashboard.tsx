import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Opportunity, OpportunityCategory, OpportunityStatus } from '../../lib/opportunities/types';
import {
    formatCategoryTitle,
    formatDaysRemaining,
    formatOpportunityTitle,
    formatStatusTitle,
    getFirstName,
} from '../../lib/opportunities/ui-helpers';
import { isOpportunityAttention, opportunityAttentionScore } from '../../lib/opportunities/attention';
import { OpportunityCard, type RadarSaveState } from './OpportunityCard';
import { OpportunityDetailModal } from './OpportunityDetailModal';
import {
    WORKFLOW_STATUSES,
    opportunityMatchesTrackerStatus,
    type TrackerStatus,
} from './OpportunityStatusPicker';
import { EditOpportunityModal } from './EditOpportunityModal';
import { ManualCreateModal } from './ManualCreateModal';
import {
    OpportunityProfileDialog,
    type OpportunityEditableProfile,
} from './OpportunityProfileDialog';
import { OpportunitySupportPrompt } from './OpportunitySupportPrompt';
import { OpportunityRadarSignInDialog } from './OpportunityRadarSignInDialog';
import { OpportunitySettingsMenu } from './OpportunitySettingsMenu';
import { opportunitySupabase as supabase } from '../../lib/opportunitySupabase';
import {
    getOpportunitySupportPromptStorageKey,
    shouldShowOpportunitySupportPrompt,
} from '../../lib/opportunities/supportPrompt';
import {
    RADAR_IMPORT_INTENT_STORAGE_KEY,
    createRadarImportIntent,
    getRadarImportNextPath,
    parseRadarImportIntent,
} from '../../lib/opportunities/importIntent';

const GOOGLE_IDENTITY_SCOPES = 'openid email profile';

type UrgencyRailFilter = 'attention' | 'this_week' | 'this_month' | 'later' | 'all';

type ProfileSummary = OpportunityEditableProfile;

interface OpportunityDashboardProps {
    username: string;
    accessToken?: string | null;
    isOwner?: boolean;
    viewerProfile?: ProfileSummary | null;
}

export const OpportunityDashboard: React.FC<OpportunityDashboardProps> = ({
    username,
    accessToken = null,
    isOwner = false,
    viewerProfile = null,
}) => {
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
    const [activeViewerProfile, setActiveViewerProfile] = useState<ProfileSummary | null>(viewerProfile);
    const [collectionProfile, setCollectionProfile] = useState<ProfileSummary | null>(
        isOwner ? viewerProfile : null,
    );
    const [profileVisibility, setProfileVisibility] = useState(Boolean(viewerProfile?.is_public));
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [loadError, setLoadError] = useState('');

    // Capture bar state
    const [captureUrl, setCaptureUrl] = useState('');
    const [isCapturing, setIsCapturing] = useState(false);
    const [captureResult, setCaptureResult] = useState<Opportunity | null>(null);
    const [captureError, setCaptureError] = useState('');

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
    const [manualInitialUrl, setManualInitialUrl] = useState('');
    const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
    const [supportPromptSource, setSupportPromptSource] = useState<'automatic' | 'manual' | null>(null);
    const [radarStates, setRadarStates] = useState<Record<string, RadarSaveState>>({});
    const [radarSignInOpportunity, setRadarSignInOpportunity] = useState<Opportunity | null>(null);
    const [isStartingRadarSignIn, setIsStartingRadarSignIn] = useState(false);
    const [radarSignInError, setRadarSignInError] = useState('');

    // Toast
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Ticker state to force relative deadline re-render every 60s
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(timer);
    }, []);

    const showToast = useCallback((msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    }, []);

    const authenticatedHeaders = (includeJson = false) => ({
        ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    });

    const handleAddToRadar = useCallback(async (opportunity: Opportunity) => {
        if (!accessToken) {
            setRadarSignInError('');
            setRadarSignInOpportunity(opportunity);
            return;
        }

        setRadarStates((current) => ({ ...current, [opportunity.id]: 'adding' }));
        try {
            const response = await fetch('/api/opportunities/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ source_opportunity_id: opportunity.id }),
            });
            const payload = await response.json().catch(() => ({}));

            if (response.status === 401) {
                setRadarStates((current) => ({ ...current, [opportunity.id]: 'idle' }));
                setRadarSignInOpportunity(opportunity);
                return;
            }
            if (!response.ok) throw new Error(payload.error || 'Could not add this opportunity');

            const nextState: RadarSaveState = payload.status === 'added' ? 'added' : 'already';
            setRadarStates((current) => ({ ...current, [opportunity.id]: nextState }));
            showToast(nextState === 'added' ? '✓ Added to your radar' : '✓ Already on your radar');
        } catch (error) {
            setRadarStates((current) => ({ ...current, [opportunity.id]: 'error' }));
            showToast(error instanceof Error ? `❌ ${error.message}` : '❌ Could not add this opportunity');
        }
    }, [accessToken, showToast]);

    const beginRadarSignIn = async () => {
        if (!radarSignInOpportunity) return;
        setIsStartingRadarSignIn(true);
        setRadarSignInError('');

        try {
            const intent = createRadarImportIntent(radarSignInOpportunity.id, username);
            window.sessionStorage.setItem(RADAR_IMPORT_INTENT_STORAGE_KEY, JSON.stringify(intent));
            const callback = new URL('/opportunities/auth/callback', window.location.origin);
            callback.searchParams.set('next', getRadarImportNextPath(intent));

            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    scopes: GOOGLE_IDENTITY_SCOPES,
                    redirectTo: callback.toString(),
                    queryParams: { prompt: 'select_account' },
                },
            });
            if (error) throw error;
        } catch {
            setRadarSignInError('Google sign-in could not start. Try again.');
            setIsStartingRadarSignIn(false);
        }
    };

    // 1. Fetch the owner's private rows, or a deliberately safe public projection.
    const fetchOpportunities = async () => {
        setIsLoading(true);
        setLoadError('');
        try {
            const endpoint = isOwner
                ? `/api/opportunities?refresh=${Date.now()}`
                : `/api/opportunities/public/${encodeURIComponent(username)}?refresh=${Date.now()}`;
            const res = await fetch(endpoint, {
                cache: 'no-store',
                headers: authenticatedHeaders(),
            });
            if (res.ok) {
                const data = await res.json();
                setOpportunities(data.opportunities || []);
                if (data.profile) setCollectionProfile(data.profile);
            } else if (res.status === 404) {
                setOpportunities([]);
                setCollectionProfile(null);
            } else {
                setLoadError('Your opportunities could not be loaded.');
            }
        } catch (err) {
            console.error('Failed to load opportunities:', err);
            setLoadError('Your opportunities could not be loaded. Check your connection and try again.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchOpportunities();
    }, [username, accessToken, isOwner]);

    useEffect(() => {
        if (isLoading) return;

        const url = new URL(window.location.href);
        const sourceId = url.searchParams.get('add') || '';
        const nonce = url.searchParams.get('intent') || '';
        if (!sourceId && !nonce) return;

        const cleanPendingUrl = () => {
            url.searchParams.delete('add');
            url.searchParams.delete('intent');
            window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        };

        const pending = parseRadarImportIntent(
            window.sessionStorage.getItem(RADAR_IMPORT_INTENT_STORAGE_KEY),
            { sourceId, sourceUsername: username, nonce },
        );
        if (!pending) {
            window.sessionStorage.removeItem(RADAR_IMPORT_INTENT_STORAGE_KEY);
            cleanPendingUrl();
            return;
        }

        const opportunity = opportunities.find((item) => item.id === sourceId);
        if (!opportunity) {
            window.sessionStorage.removeItem(RADAR_IMPORT_INTENT_STORAGE_KEY);
            cleanPendingUrl();
            showToast('This opportunity is no longer available');
            return;
        }

        if (!accessToken) {
            setRadarSignInOpportunity(opportunity);
            return;
        }

        window.sessionStorage.removeItem(RADAR_IMPORT_INTENT_STORAGE_KEY);
        cleanPendingUrl();
        setRadarSignInOpportunity(null);

        if (isOwner) {
            setRadarStates((current) => ({ ...current, [opportunity.id]: 'already' }));
            showToast('✓ Already on your radar');
            return;
        }

        void handleAddToRadar(opportunity);
    }, [accessToken, handleAddToRadar, isLoading, isOwner, opportunities, showToast, username]);

    useEffect(() => {
        setProfileVisibility(Boolean(viewerProfile?.is_public));
    }, [viewerProfile?.is_public]);

    useEffect(() => {
        setActiveViewerProfile(viewerProfile);
    }, [viewerProfile]);

    const supportPromptStorageKey = useMemo(
        () => getOpportunitySupportPromptStorageKey(username),
        [username],
    );

    useEffect(() => {
        if (isManualModalOpen) return;
        if (isProfileDialogOpen) return;
        if (supportPromptSource) return;

        let hasBeenDismissed = false;
        try {
            hasBeenDismissed = window.localStorage.getItem(supportPromptStorageKey) === 'dismissed';
        } catch {
            // The prompt can still work when browser storage is unavailable.
        }

        if (shouldShowOpportunitySupportPrompt({
            opportunityCount: opportunities.length,
            isOwner,
            isLoading,
            hasBeenDismissed,
        })) {
            setSupportPromptSource('automatic');
        }
    }, [isLoading, isManualModalOpen, isOwner, isProfileDialogOpen, opportunities.length, supportPromptStorageKey]);

    const closeProfileDialog = () => {
        setIsProfileDialogOpen(false);
        window.requestAnimationFrame(() => {
            document.querySelector<HTMLButtonElement>('#opportunity-settings-trigger')?.focus();
        });
    };

    const handleProfileSaved = (nextProfile: OpportunityEditableProfile) => {
        const previousUsername = activeViewerProfile?.username;
        setActiveViewerProfile(nextProfile);
        setProfileVisibility(nextProfile.is_public);
        if (isOwner) setCollectionProfile(nextProfile);
        showToast('Profile saved.');

        if (previousUsername && previousUsername !== nextProfile.username) {
            window.location.assign(`/opportunities/${encodeURIComponent(nextProfile.username)}`);
        }
    };

    const dismissSupportPrompt = () => {
        const shouldReturnToSettings = supportPromptSource === 'manual';
        if (supportPromptSource === 'automatic') {
            try {
                window.localStorage.setItem(supportPromptStorageKey, 'dismissed');
            } catch {
                // Dismiss for this visit even when browser storage is unavailable.
            }
        }
        setSupportPromptSource(null);
        if (shouldReturnToSettings) {
            window.requestAnimationFrame(() => {
                document.querySelector<HTMLButtonElement>('#opportunity-settings-trigger')?.focus();
            });
        }
    };

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut({ scope: 'local' });
            window.location.assign('/opportunities');
        } catch {
            showToast('Logout failed');
        }
    };

    // 3. Capture URL Handler
    const handleCapture = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!captureUrl.trim()) return;

        setIsCapturing(true);
        setCaptureError('');
        setCaptureResult(null);
        try {
            const res = await fetch('/api/opportunities/capture', {
                method: 'POST',
                headers: authenticatedHeaders(true),
                body: JSON.stringify({ url: captureUrl }),
            });

            const data = await res.json();
            if (res.ok && data.opportunity) {
                setCaptureResult(data.opportunity);
                setCaptureUrl('');
                setOpportunities((prev) => {
                    const filtered = prev.filter((o) => o.id !== data.opportunity.id);
                    return [data.opportunity, ...filtered];
                });
            } else {
                const message = data.error || 'Failed to capture this opportunity';
                setCaptureError(message);
                showToast(`❌ ${message}`);
                if (data.can_manual_create) {
                    setManualInitialUrl(data.canonical_url || captureUrl.trim());
                    setIsManualModalOpen(true);
                }
            }
        } catch (err: any) {
            const message = `Network error: ${err.message}`;
            setCaptureError(message);
            showToast(`❌ ${message}`);
        } finally {
            setIsCapturing(false);
        }
    };

    // 4. Update Status
    const handleUpdateStatus = async (id: string, newStatus: OpportunityStatus) => {
        const previousStatus = opportunities.find((opportunity) => opportunity.id === id)?.status;
        setOpportunities((prev) =>
            prev.map((o) => (o.id === id ? { ...o, status: newStatus } : o))
        );

        try {
            const res = await fetch(`/api/opportunities/${id}`, {
                method: 'PATCH',
                headers: authenticatedHeaders(true),
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
                showToast(`✓ Status updated to ${formatStatusTitle(newStatus)}`);
            } else {
                if (previousStatus) {
                    setOpportunities((prev) => prev.map((o) => (
                        o.id === id ? { ...o, status: previousStatus } : o
                    )));
                }
                showToast('❌ Failed to update status');
            }
        } catch {
            if (previousStatus) {
                setOpportunities((prev) => prev.map((o) => (
                    o.id === id ? { ...o, status: previousStatus } : o
                )));
            }
            showToast('❌ Network error updating status');
        }
    };

    const handleUpdateChecklist = async (id: string, completedRequirements: string[]) => {
        const response = await fetch(`/api/opportunities/${id}`, {
            method: 'PATCH',
            headers: authenticatedHeaders(true),
            body: JSON.stringify({ completed_requirements: completedRequirements }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.opportunity) {
            throw new Error(data.error || 'Checklist progress could not be saved');
        }

        setOpportunities((current) => current.map((opportunity) => (
            opportunity.id === id ? data.opportunity : opportunity
        )));
    };

    const handleUpdateDeadline = async (id: string, deadline: string) => {
        const response = await fetch(`/api/opportunities/${id}`, {
            method: 'PATCH',
            headers: authenticatedHeaders(true),
            body: JSON.stringify({ deadline }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.opportunity) {
            throw new Error(data.error || 'Deadline could not be saved');
        }

        setOpportunities((current) => current.map((opportunity) => (
            opportunity.id === id ? data.opportunity : opportunity
        )));
        showToast('✓ Deadline saved');
    };

    // 5. Update Priority
    const handleUpdatePriority = async (id: string, priority: number) => {
        const previousPriority = opportunities.find((opportunity) => opportunity.id === id)?.priority || 1;
        setOpportunities((prev) =>
            prev.map((o) => (o.id === id ? { ...o, priority } : o))
        );

        let res: Response;
        try {
            res = await fetch(`/api/opportunities/${id}`, {
                method: 'PATCH',
                headers: authenticatedHeaders(true),
                body: JSON.stringify({ priority }),
            });
        } catch {
            setOpportunities((prev) => prev.map((o) => (
                o.id === id ? { ...o, priority: previousPriority } : o
            )));
            showToast('❌ Failed to update priority');
            throw new Error('Failed to update priority');
        }

        if (!res.ok) {
            setOpportunities((prev) => prev.map((o) => (
                o.id === id ? { ...o, priority: previousPriority } : o
            )));
            showToast('❌ Failed to update priority');
            throw new Error('Failed to update priority');
        }

        const label = priority === 3 ? 'High' : priority === 2 ? 'Medium' : 'Low';
        showToast(`✓ Priority set to ${label}`);
    };

    // 6. Save Edits from Modal
    const handleSaveEdit = async (id: string, updates: Partial<Opportunity>) => {
        setOpportunities((prev) =>
            prev.map((o) => (o.id === id ? { ...o, ...updates } : o))
        );

        try {
            const res = await fetch(`/api/opportunities/${id}`, {
                method: 'PATCH',
                headers: authenticatedHeaders(true),
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
                headers: authenticatedHeaders(true),
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
                headers: authenticatedHeaders(),
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
                headers: authenticatedHeaders(),
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
        return opportunities.filter((opportunity) => isOpportunityAttention(opportunity, now)).length;
    }, [opportunities, now]);

    // Filter & Smart Sort Opportunities
    const filteredOpportunities = useMemo(() => {
        const filtered = opportunities.filter((o) => {
            // Category Filter
            if (categoryFilter !== 'all' && o.category !== categoryFilter) {
                return false;
            }

            // Workflow Status Filter
            if (
                statusFilter !== 'all'
                && !opportunityMatchesTrackerStatus(o.status, statusFilter as TrackerStatus)
            ) {
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
            if (urgencyFilter === 'attention') {
                return isOpportunityAttention(o, now);
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
            return opportunityAttentionScore(a, now) - opportunityAttentionScore(b, now);
        });
    }, [opportunities, urgencyFilter, categoryFilter, statusFilter, priorityFilter, searchQuery, now]);

    // Active secondary filters count for badge
    const activeSecondaryFiltersCount =
        (categoryFilter !== 'all' ? 1 : 0) +
        (statusFilter !== 'all' ? 1 : 0) +
        (priorityFilter !== 'all' ? 1 : 0) +
        (searchQuery.trim() ? 1 : 0);

    const collectionOwnerName = collectionProfile?.display_name || username;
    const collectionTitle = `${collectionOwnerName.charAt(0).toUpperCase()}${collectionOwnerName.slice(1)}'s Opportunities`;
    const viewerFirstName = getFirstName(activeViewerProfile?.display_name || activeViewerProfile?.username || username);
    const viewerDashboardPath = activeViewerProfile
        ? `/opportunities/${encodeURIComponent(activeViewerProfile.username)}`
        : '/opportunities';

    return (
        <div className="opportunities-shell">
            {/* Enlarged Curated Opportunities Hero Deck */}
            <header className="opp-hero-deck">
                <div className="opp-hero-main">
                    <div className="opp-hero-header-row">
                        <div className="opp-hero-branding">
                            <span className="opp-hero-eyebrow">OPPORTUNITY TRACKER</span>
                            <h1 className="opp-hero-title">
                                {isOwner ? `Hi, ${viewerFirstName}.` : collectionTitle}
                            </h1>
                            <p className="opp-hero-tagline">
                                {isOwner ? 'One Click. Every opportunity organized.' : 'Curated opportunities, ready to track.'}
                            </p>
                        </div>
                        {activeViewerProfile ? (
                            <div className="opp-hero-account-actions">
                                {!isOwner && (
                                    <a
                                        className="opp-my-radar-link"
                                        href={viewerDashboardPath}
                                    >
                                        <span aria-hidden="true">←</span>
                                        <span>My Radar</span>
                                    </a>
                                )}
                                <OpportunitySettingsMenu
                                    accessToken={accessToken}
                                    isPublic={profileVisibility}
                                    username={activeViewerProfile.username}
                                    onLogout={handleLogout}
                                    onEditProfile={() => setIsProfileDialogOpen(true)}
                                    onOpenSupport={() => setSupportPromptSource('manual')}
                                    onToast={showToast}
                                    onVisibilityChange={setProfileVisibility}
                                />
                            </div>
                        ) : (
                            <a className="opp-google-signin-compact" href={`/opportunities?next=${encodeURIComponent(`/opportunities/${username}`)}`}>
                                Sign in with Google <span aria-hidden="true">→</span>
                            </a>
                        )}
                    </div>

                    {/* Capture Bar: Only the collection owner may mutate data. */}
                    {isOwner && (
                        <div className="opp-capture-workspace">
                            <div className="opp-capture-heading">
                                <label htmlFor="opportunity-capture-url">Save an opportunity</label>
                                <p id="opportunity-capture-help">
                                    Paste any opportunity link. We'll organize the deadline, requirements and next steps.
                                </p>
                            </div>
                            <form onSubmit={handleCapture} className="opp-hero-capture-bar">
                                <input
                                    id="opportunity-capture-url"
                                    type="url"
                                    className="opp-hero-capture-input"
                                    placeholder="https://example.org/opportunity"
                                    value={captureUrl}
                                    onChange={(e) => {
                                        setCaptureUrl(e.target.value);
                                        setCaptureError('');
                                    }}
                                    aria-describedby={`opportunity-capture-help${captureError ? ' opportunity-capture-error' : ''}`}
                                    aria-invalid={Boolean(captureError)}
                                    inputMode="url"
                                    autoComplete="url"
                                    required
                                />
                                <button
                                    type="submit"
                                    className="opp-btn opp-btn-primary opp-hero-btn"
                                    disabled={isCapturing}
                                >
                                    {isCapturing ? 'Organizing…' : 'Save Opportunity →'}
                                </button>
                                <button
                                    type="button"
                                    className="opp-btn opp-btn-secondary opp-hero-btn"
                                    onClick={() => {
                                        setManualInitialUrl('');
                                        setIsManualModalOpen(true);
                                    }}
                                >
                                    Add manually
                                </button>
                            </form>
                            {captureError && (
                                <p id="opportunity-capture-error" className="opp-capture-error" role="alert">
                                    {captureError}
                                </p>
                            )}
                            {captureResult && (
                                <div className="opp-capture-success" role="status" aria-live="polite">
                                    <div>
                                        <span className="opp-capture-success-label">Saved to your radar</span>
                                        <strong>{formatOpportunityTitle(captureResult.title)}</strong>
                                        <span>
                                            {formatDaysRemaining(
                                                captureResult.deadline_at,
                                                captureResult.deadline_confidence,
                                            ).label}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        className="opp-btn opp-btn-secondary opp-capture-view-btn"
                                        onClick={() => setSelectedDetailId(captureResult.id)}
                                    >
                                        View Opportunity →
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </header>

            {/* Thin Divider Line */}
            <div className="opp-radar-divider" />

            {!isOwner && collectionProfile && (
                <aside className="opp-radar-intro" aria-label="Save opportunities">
                    <strong>See something useful?</strong>
                    <span>Add it to your private radar.</span>
                </aside>
            )}

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
                                        {[{ id: 'all', label: 'All' }, ...WORKFLOW_STATUSES].map((statusOption) => (
                                            <button
                                                key={statusOption.id}
                                                type="button"
                                                className={`opp-popover-pill ${statusFilter === statusOption.id ? 'active' : ''}`}
                                                onClick={() => setStatusFilter(statusOption.id)}
                                            >
                                                {statusOption.label}
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
                <div className="opp-loading-state" role="status">
                    Loading opportunities…
                </div>
            ) : loadError ? (
                <div className="opp-load-error" role="alert">
                    <strong>{loadError}</strong>
                    <button type="button" className="opp-btn opp-btn-secondary" onClick={() => void fetchOpportunities()}>
                        Try again
                    </button>
                </div>
            ) : !collectionProfile && !isOwner ? (
                <div className="opp-empty-split-grid">
                    <div className="opp-empty-block">
                        <div className="opp-empty-block-header">
                            <div className="opp-empty-icon-sm">🔒</div>
                            <div>
                                <h2 className="opp-empty-heading">Collection unavailable</h2>
                                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--opp-muted)' }}>Private or not found</p>
                            </div>
                        </div>
                        <p className="opp-empty-text">This username does not exist or the owner has kept their collection private.</p>
                        <a className="opp-btn opp-btn-primary opp-btn-sm" href="/opportunities">Create your collection →</a>
                    </div>
                </div>
            ) : opportunities.length === 0 ? (
                /* Split Empty State when 0 opportunities recorded */
                <div className="opp-empty-split-grid">
                    <div className="opp-empty-block">
                        <div className="opp-empty-block-header">
                            <div className="opp-empty-icon-sm">⚡</div>
                            <div>
                                <h3 className="opp-empty-heading">{isOwner ? 'Start Tracking' : 'No Shared Opportunities Yet'}</h3>
                                <p className="opp-empty-kicker">
                                    {isOwner ? 'Quick capture workflow' : `@${username}'s public collection`}
                                </p>
                            </div>
                        </div>
                        <p className="opp-empty-text">
                            {isOwner
                                ? 'Paste any opportunity link into the bar above or add one manually to track its deadline.'
                                : 'This collection is public, but its owner has not shared any active opportunities yet.'}
                        </p>
                        {isOwner && <div className="opp-empty-block-actions">
                            <button
                                type="button"
                                className="opp-btn opp-btn-primary opp-btn-sm"
                                onClick={() => {
                                    document.querySelector<HTMLInputElement>('#opportunity-capture-url')?.focus();
                                }}
                            >
                                Paste your first link ↑
                            </button>
                            <button
                                type="button"
                                className="opp-btn opp-btn-secondary opp-btn-sm"
                                onClick={() => {
                                    setManualInitialUrl('');
                                    setIsManualModalOpen(true);
                                }}
                            >
                                Add manually
                            </button>
                        </div>}
                    </div>

                    <div className="opp-empty-block accent">
                        <div className="opp-empty-block-header">
                            <div className="opp-empty-icon-sm">📡</div>
                            <div>
                                <h3 className="opp-empty-heading">What your first card will show</h3>
                                <p className="opp-empty-kicker">Interactive example</p>
                            </div>
                        </div>
                        <div className="opp-empty-demo-card" aria-label="Example opportunity card">
                            <div className="opp-empty-demo-meta">
                                <span className="opp-days-remaining warning"><span className="opp-days-pulse-dot" />12 days left</span>
                            </div>
                            <strong>Creative Research Fellowship</strong>
                            <span>Example Arts Foundation</span>
                            <div className="opp-empty-demo-actions" aria-hidden="true">
                                <span>Fellowship</span>
                                <span>More details →</span>
                            </div>
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
                            onOpen={(o) => setSelectedDetailId(o.id)}
                            onSelectCategory={(cat) => setCategoryFilter(cat)}
                            showRadarAction={!isOwner}
                            radarState={radarStates[opp.id] || 'idle'}
                            onAddToRadar={handleAddToRadar}
                        />
                    ))}
                </div>
            )}

            {/* Bottom ownership / sign-in action */}
            <footer className="opp-public-footer">
                {!activeViewerProfile ? (
                    <div className="opp-curator-trigger-box">
                        <a className="opp-curator-login-btn" href="/opportunities">
                            Sign in to save opportunities →
                        </a>
                    </div>
                ) : !isOwner ? (
                    <div className="opp-curator-active-bar">
                        <span className="opp-curator-badge">Viewing @{username}</span>
                        <a className="opp-curator-logout-btn" href={viewerDashboardPath}>
                            My Radar
                        </a>
                    </div>
                ) : (
                    <div className="opp-curator-active-bar">
                        <span className="opp-curator-badge">
                            {profileVisibility ? '● Public collection' : '● Private collection'}
                        </span>
                    </div>
                )}
            </footer>

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
                        isAuthenticated={isOwner}
                        isOpen={Boolean(selectedOpp)}
                        onClose={() => setSelectedDetailId(null)}
                        onUpdateStatus={handleUpdateStatus}
                        onUpdatePriority={handleUpdatePriority}
                        onUpdateChecklist={handleUpdateChecklist}
                        onUpdateDeadline={handleUpdateDeadline}
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
                        showRadarAction={!isOwner}
                        radarState={radarStates[selectedOpp.id] || 'idle'}
                        onAddToRadar={handleAddToRadar}
                    />
                );
            })()}

            <OpportunityRadarSignInDialog
                opportunity={radarSignInOpportunity}
                isStarting={isStartingRadarSignIn}
                error={radarSignInError}
                onClose={() => {
                    setRadarSignInOpportunity(null);
                    setIsStartingRadarSignIn(false);
                    setRadarSignInError('');
                }}
                onContinue={() => void beginRadarSignIn()}
            />

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
            {isOwner && <ManualCreateModal
                isOpen={isManualModalOpen}
                initialUrl={manualInitialUrl}
                onClose={() => setIsManualModalOpen(false)}
                onCreate={handleManualCreate}
            />}

            {activeViewerProfile && (
                <OpportunityProfileDialog
                    accessToken={accessToken}
                    isOpen={isProfileDialogOpen}
                    profile={activeViewerProfile}
                    onClose={closeProfileDialog}
                    onSaved={handleProfileSaved}
                />
            )}

            {activeViewerProfile && (
                <OpportunitySupportPrompt
                    isOpen={supportPromptSource !== null}
                    onDismiss={dismissSupportPrompt}
                />
            )}

            {/* Toast Notification */}
            {toastMessage && <div className="opp-toast" role="status" aria-live="polite">{toastMessage}</div>}
        </div>
    );
};
export default OpportunityDashboard;
