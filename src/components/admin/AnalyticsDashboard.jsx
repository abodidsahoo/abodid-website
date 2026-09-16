import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Activity,
    AlertCircle,
    ArrowDownRight,
    ArrowRight,
    CheckCircle2,
    ChevronRight,
    Compass,
    Eye,
    FastForward,
    Filter,
    Flame,
    Globe2,
    HelpCircle,
    Info,
    Laptop,
    Layers,
    MapPin,
    Maximize2,
    MousePointer,
    MousePointerClick,
    Pause,
    Play,
    RefreshCw,
    RotateCcw,
    Route,
    ShieldCheck,
    Smartphone,
    Sparkles,
    Target,
    TrendingDown,
    TrendingUp,
    UserCheck,
    Users,
    Video,
    X,
    Zap,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import AdminPageHeader from './AdminPageHeader';
import './analytics-dashboard.css';

const TABS = [
    { id: 'overview', label: 'Overview', icon: Target },
    { id: 'journeys', label: 'Revenue Journeys', icon: Route },
    { id: 'dropoffs', label: 'Drop-offs', icon: TrendingDown },
    { id: 'visitors', label: 'Visitors', icon: Users },
    { id: 'replays', label: 'Replays', icon: Video },
];

const RANGE_OPTIONS = [
    { id: 'today', label: 'Today' },
    { id: '7d', label: '7D' },
    { id: '30d', label: '30D' },
    { id: '90d', label: '90D' },
];

const numberFormatter = new Intl.NumberFormat('en-GB');
const countryNames = typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null;

const formatNumber = (value) => numberFormatter.format(Number(value) || 0);

const formatDuration = (value) => {
    const seconds = Math.max(0, Math.round(Number(value) || 0));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${remainder}s`;
    return `${remainder}s`;
};

const formatCountry = (value) => {
    if (!value || value === 'Unknown') return 'Global / Unknown';
    try {
        return countryNames?.of(value) || value;
    } catch (_error) {
        return value;
    }
};

const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays}d ago`;
};

export default function AnalyticsDashboard({ accessToken }) {
    const [activeTab, setActiveTab] = useState('overview');
    const [range, setRange] = useState('7d');
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);

    // Filter & Drilldown States
    const [funnelFilter, setFunnelFilter] = useState('all');
    const [dropoffFilter, setDropoffFilter] = useState('all');
    const [selectedVisitor, setSelectedVisitor] = useState(null);
    const [visitorTimeline, setVisitorTimeline] = useState(null);
    const [loadingTimeline, setLoadingTimeline] = useState(false);

    // Replay Player State
    const [activeReplay, setActiveReplay] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [replayProgress, setReplayProgress] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const replayTimerRef = useRef(null);

    const loadReport = useCallback(async (signal) => {
        if (!accessToken) return;
        if (!report) setLoading(true);
        else setRefreshing(true);
        setError('');

        try {
            const timezoneOffset = new Date().getTimezoneOffset();
            const requestUrl = `/api/admin/analytics?range=${encodeURIComponent(range)}&traffic=human&timezoneOffset=${timezoneOffset}`;
            const requestReport = (token) => fetch(requestUrl, {
                headers: { Authorization: `Bearer ${token}` },
                signal,
            });

            let response = await requestReport(accessToken);
            if (response.status === 401) {
                const { data, error: refreshError } = await supabase.auth.refreshSession();
                const refreshedToken = data?.session?.access_token;
                if (!refreshError && refreshedToken) {
                    response = await requestReport(refreshedToken);
                }
            }
            const payload = await response.json();
            if (!response.ok) throw new Error(payload?.error || 'Could not load revenue intelligence.');

            setReport(payload.report || {});
        } catch (requestError) {
            if (requestError.name !== 'AbortError') {
                setError(requestError.message || 'Could not load analytics.');
            }
        } finally {
            if (!signal.aborted) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, [accessToken, range]);

    useEffect(() => {
        const controller = new AbortController();
        loadReport(controller.signal);
        return () => controller.abort();
    }, [loadReport, refreshKey]);

    // Load visitor's multi-session history when inspecting
    const handleInspectVisitor = async (visitor) => {
        setSelectedVisitor(visitor);
        if (!visitor?.visitorId) return;

        setLoadingTimeline(true);
        try {
            const res = await fetch(`/api/admin/analytics?visitorId=${encodeURIComponent(visitor.visitorId)}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            const data = await res.json();
            if (data.multiSessionJourney) {
                setVisitorTimeline(data.multiSessionJourney);
            } else {
                setVisitorTimeline(null);
            }
        } catch (_e) {
            setVisitorTimeline(null);
        } finally {
            setLoadingTimeline(false);
        }
    };

    // Replay Player Animation Loop
    useEffect(() => {
        if (isPlaying && activeReplay) {
            const totalDuration = activeReplay.durationSeconds || 120;
            const intervalMs = 100 / playbackSpeed;
            const stepPercent = (100 / (totalDuration * 10)) * playbackSpeed;

            replayTimerRef.current = setInterval(() => {
                setReplayProgress((prev) => {
                    if (prev >= 100) {
                        setIsPlaying(false);
                        return 100;
                    }
                    return Math.min(100, prev + stepPercent);
                });
            }, intervalMs);
        } else {
            clearInterval(replayTimerRef.current);
        }
        return () => clearInterval(replayTimerRef.current);
    }, [isPlaying, activeReplay, playbackSpeed]);

    const handleLaunchReplay = (replay) => {
        setActiveReplay(replay);
        setReplayProgress(0);
        setIsPlaying(true);
        setActiveTab('replays');
    };

    const overview = report?.overview || {};
    const revenueJourneys = report?.revenueJourneys || {};
    const dropoffs = report?.dropoffs || { diagnostics: [], summary: {} };
    const visitorsFeed = report?.visitors?.feed || [];
    const replaysList = report?.replays?.sessions || [];

    const filteredFunnels = useMemo(() => {
        if (funnelFilter === 'all') return Object.values(revenueJourneys);
        return Object.values(revenueJourneys).filter((f) => f.id === funnelFilter);
    }, [revenueJourneys, funnelFilter]);

    const filteredDropoffs = useMemo(() => {
        if (dropoffFilter === 'all') return dropoffs.diagnostics || [];
        return (dropoffs.diagnostics || []).filter((d) => d.id === dropoffFilter);
    }, [dropoffs.diagnostics, dropoffFilter]);

    return (
        <section className="analytics-intelligence-root" aria-labelledby="analytics-title">
            {/* Top Bar Navigation */}
            <div className="analytics-header-section admin-page-intro">
                <div className="analytics-title-group">
                    <AdminPageHeader
                        className="analytics-page-header"
                        headingId="analytics-title"
                        title="Revenue & Intelligence"
                        description="Data is God. How curious attention becomes commercial engagements."
                    />
                </div>

                <div className="analytics-action-toolbar">
                    <div className="analytics-range-picker" role="radiogroup" aria-label="Time period">
                        {RANGE_OPTIONS.map((opt) => (
                            <button
                                key={opt.id}
                                type="button"
                                className={range === opt.id ? 'active' : ''}
                                onClick={() => setRange(opt.id)}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    <button
                        type="button"
                        className="analytics-refresh-btn"
                        onClick={() => setRefreshKey((k) => k + 1)}
                        disabled={loading || refreshing}
                        title="Refresh analytics data"
                    >
                        <RefreshCw size={15} className={loading || refreshing ? 'is-spinning' : ''} />
                    </button>
                </div>
            </div>

            {/* Section-Level Tab Navigation */}
            <nav className="analytics-section-nav" aria-label="Analytics Sections">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            className={`analytics-section-tab ${isActive ? 'is-active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <Icon size={16} strokeWidth={isActive ? 2.2 : 1.7} />
                            <span>{tab.label}</span>
                            {tab.id === 'dropoffs' && dropoffs.diagnostics?.length > 0 && (
                                <span className="tab-pill-badge tab-pill-alert">{dropoffs.diagnostics.length}</span>
                            )}
                            {tab.id === 'replays' && replaysList.length > 0 && (
                                <span className="tab-pill-badge">{replaysList.length}</span>
                            )}
                        </button>
                    );
                })}
            </nav>

            {error && (
                <div className="analytics-alert-banner" role="alert">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                    <button type="button" onClick={() => setRefreshKey((k) => k + 1)}>Retry</button>
                </div>
            )}

            {/* PROGRESSIVE SECTIONS */}

            {/* 1. OVERVIEW TAB */}
            {activeTab === 'overview' && (
                <div className="analytics-tab-pane overview-pane">
                    {/* 5 Core Commercial Metrics */}
                    <div className="commercial-kpi-grid">
                        <div className="kpi-card">
                            <div className="kpi-header">
                                <span className="kpi-label">Meaningful Visitors</span>
                                <UserCheck size={16} className="kpi-icon" />
                            </div>
                            <strong className="kpi-value">{formatNumber(overview.meaningfulVisitors)}</strong>
                            <span className="kpi-subtext">Engaged human visits (&gt;10s)</span>
                        </div>

                        <div className="kpi-card kpi-highlight">
                            <div className="kpi-header">
                                <span className="kpi-label">High-Intent Leads</span>
                                <Flame size={16} className="kpi-icon text-accent" />
                            </div>
                            <strong className="kpi-value">{formatNumber(overview.highIntentVisitors)}</strong>
                            <span className="kpi-subtext">Inspected pricing, work & contact</span>
                        </div>

                        <div className="kpi-card">
                            <div className="kpi-header">
                                <span className="kpi-label">Returning Visitors</span>
                                <RotateCcw size={16} className="kpi-icon" />
                            </div>
                            <strong className="kpi-value">{formatNumber(overview.returningVisitors)}</strong>
                            <span className="kpi-subtext">Multi-session evolving leads</span>
                        </div>

                        <div className="kpi-card kpi-success">
                            <div className="kpi-header">
                                <span className="kpi-label">Enquiries & Bookings</span>
                                <Sparkles size={16} className="kpi-icon text-success" />
                            </div>
                            <strong className="kpi-value">{formatNumber(overview.enquiriesAndBookings)}</strong>
                            <span className="kpi-subtext">Confirmed client touches</span>
                        </div>

                        <div className="kpi-card">
                            <div className="kpi-header">
                                <span className="kpi-label">Conversion Rate</span>
                                <TrendingUp size={16} className="kpi-icon" />
                            </div>
                            <strong className="kpi-value">{overview.conversionRate || '0.0%'}</strong>
                            <span className="kpi-subtext">Enquiries / Meaningful traffic</span>
                        </div>
                    </div>

                    {/* 4 Commercial Revenue Paths Breakdown */}
                    <div className="analytics-block">
                        <div className="block-header">
                            <div>
                                <h3>Commercial Revenue Paths</h3>
                                <p>Live performance and enquiry velocity across the 4 primary business verticals.</p>
                            </div>
                        </div>

                        <div className="revenue-disciplines-grid">
                            {(overview.revenueBreakdown || []).map((path) => (
                                <article key={path.id} className="discipline-card" style={{ '--accent-color': path.color }}>
                                    <div className="discipline-card-header">
                                        <div className="discipline-badge-dot" />
                                        <div>
                                            <h4>{path.label}</h4>
                                            <p className="discipline-subtitle">{path.subtitle}</p>
                                        </div>
                                    </div>

                                    <div className="discipline-stats-row">
                                        <div>
                                            <span className="stat-label">Visitors</span>
                                            <strong className="stat-val">{formatNumber(path.visitors)}</strong>
                                        </div>
                                        <div>
                                            <span className="stat-label">High Intent</span>
                                            <strong className="stat-val text-accent">{formatNumber(path.highIntent)}</strong>
                                        </div>
                                        <div>
                                            <span className="stat-label">Enquiries</span>
                                            <strong className="stat-val text-success">{formatNumber(path.enquiries)}</strong>
                                        </div>
                                        <div>
                                            <span className="stat-label">Conv. Rate</span>
                                            <strong className="stat-val">{path.conversionRate}</strong>
                                        </div>
                                    </div>

                                    <div className="discipline-footer">
                                        <span className="trend-pill">{path.trend}</span>
                                        <button
                                            type="button"
                                            className="drill-btn"
                                            onClick={() => {
                                                setFunnelFilter(path.id);
                                                setActiveTab('journeys');
                                            }}
                                        >
                                            Inspect Funnel
                                            <ChevronRight size={14} />
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 2. REVENUE JOURNEYS TAB */}
            {activeTab === 'journeys' && (
                <div className="analytics-tab-pane journeys-pane">
                    {/* Funnel Filter Bar */}
                    <div className="funnel-filter-bar">
                        <div className="filter-chips">
                            <button
                                type="button"
                                className={`filter-chip ${funnelFilter === 'all' ? 'active' : ''}`}
                                onClick={() => setFunnelFilter('all')}
                            >
                                All 4 Revenue Paths
                            </button>
                            <button
                                type="button"
                                className={`filter-chip ${funnelFilter === 'photography' ? 'active' : ''}`}
                                onClick={() => setFunnelFilter('photography')}
                            >
                                Photography
                            </button>
                            <button
                                type="button"
                                className={`filter-chip ${funnelFilter === 'obsidian' ? 'active' : ''}`}
                                onClick={() => setFunnelFilter('obsidian')}
                            >
                                Obsidian Tutoring
                            </button>
                            <button
                                type="button"
                                className={`filter-chip ${funnelFilter === 'creative_tech' ? 'active' : ''}`}
                                onClick={() => setFunnelFilter('creative_tech')}
                            >
                                Creative Tech
                            </button>
                            <button
                                type="button"
                                className={`filter-chip ${funnelFilter === 'film_brand' ? 'active' : ''}`}
                                onClick={() => setFunnelFilter('film_brand')}
                            >
                                Film & Brand
                            </button>
                        </div>
                    </div>

                    {/* Funnel Visualizers */}
                    <div className="funnels-list">
                        {filteredFunnels.map((funnel) => {
                            const leakage = funnel.largestLeakage;
                            return (
                                <section key={funnel.id} className="funnel-block" style={{ '--accent-color': funnel.color }}>
                                    <div className="funnel-block-header">
                                        <div className="funnel-title-area">
                                            <div className="funnel-color-pill" />
                                            <div>
                                                <h3>{funnel.label}</h3>
                                                <p>{funnel.subtitle} · <em>Target: {funnel.targetRole}</em></p>
                                            </div>
                                        </div>
                                        <div className="funnel-conversion-summary">
                                            <span>Overall Conversion</span>
                                            <strong>{funnel.conversionRate}%</strong>
                                            <small>{funnel.totalConverted} of {funnel.totalDiscovery} entries</small>
                                        </div>
                                    </div>

                                    {/* 5 Funnel Stages */}
                                    <div className="funnel-stages-row">
                                        {funnel.stages.map((stage, idx) => {
                                            const isLast = idx === funnel.stages.length - 1;
                                            const isLeakageStage = leakage && leakage.stageId === stage.id;
                                            return (
                                                <React.Fragment key={stage.id}>
                                                    <div
                                                        className={`funnel-stage-card ${isLeakageStage ? 'has-leakage' : ''}`}
                                                        onClick={() => {
                                                            setDropoffFilter(stage.id === 'intent' ? 'pricing_abandoned' : 'all');
                                                            setActiveTab('dropoffs');
                                                        }}
                                                        role="button"
                                                        tabIndex={0}
                                                        title="Click to inspect drop-offs for this stage"
                                                    >
                                                        <span className="stage-step-num">0{idx + 1}</span>
                                                        <strong className="stage-name">{stage.label}</strong>
                                                        <span className="stage-count">{formatNumber(stage.count)}</span>
                                                        <small className="stage-meta">visitors reached</small>
                                                    </div>

                                                    {!isLast && (
                                                        <div className="funnel-stage-connector">
                                                            <div className="connector-arrow">
                                                                <ArrowRight size={14} />
                                                            </div>
                                                            <div className={`dropoff-pill ${isLeakageStage ? 'dropoff-severe' : ''}`}>
                                                                <ArrowDownRight size={12} />
                                                                <span>-{stage.dropOffRate}%</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>

                                    {/* Automated Leakage Callout */}
                                    {leakage && (
                                        <div className="funnel-leakage-banner">
                                            <div className="leakage-info">
                                                <AlertCircle size={16} className="text-accent" />
                                                <div>
                                                    <strong>Largest Leakage: {leakage.dropOffRate}% drop-off between {leakage.fromStage} → {leakage.toStage}</strong>
                                                    <p>{leakage.lostVisitors} potential clients dropped out at this step during the selected period.</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                className="leakage-action-btn"
                                                onClick={() => {
                                                    setDropoffFilter(funnel.id === 'obsidian' ? 'pricing_abandoned' : 'form_abandoned');
                                                    setActiveTab('dropoffs');
                                                }}
                                            >
                                                Diagnose Drop-offs
                                                <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    )}
                                </section>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 3. DROP-OFFS TAB */}
            {activeTab === 'dropoffs' && (
                <div className="analytics-tab-pane dropoffs-pane">
                    <div className="dropoff-intro-box">
                        <div>
                            <h3>Drop-off & Failure Point Diagnostics</h3>
                            <p>Answering: <strong>Where are potential clients dropping out? What exactly did they do? What should I change on the website?</strong></p>
                        </div>
                        <div className="friction-summary-pills">
                            <span className="summary-chip">
                                <strong>{dropoffs.summary?.totalFrictionEvents || 0}</strong> Friction Instances
                            </span>
                            <span className="summary-chip chip-priority">
                                Top Priority: <strong>{dropoffs.summary?.topActionPriority}</strong>
                            </span>
                        </div>
                    </div>

                    {/* Diagnostics Cards */}
                    <div className="diagnostics-grid">
                        {filteredDropoffs.map((item) => (
                            <article key={item.id} className={`diagnostic-card severity-${item.severity}`}>
                                <div className="diagnostic-header">
                                    <div className="diagnostic-title-line">
                                        <span className={`severity-tag severity-${item.severity}`}>{item.severity.toUpperCase()}</span>
                                        <span className="diagnostic-category">{item.category}</span>
                                    </div>
                                    <h4>{item.label}</h4>
                                </div>

                                <div className="diagnostic-metrics">
                                    <div>
                                        <span className="dm-label">Affected Visits</span>
                                        <strong className="dm-value">{formatNumber(item.affectedSessions)}</strong>
                                    </div>
                                    <div>
                                        <span className="dm-label">Friction Share</span>
                                        <strong className="dm-value">{item.affectedShare}</strong>
                                    </div>
                                    <div>
                                        <span className="dm-label">Primary Path</span>
                                        <strong className="dm-value">{item.primaryDisciplines?.join(', ')}</strong>
                                    </div>
                                </div>

                                <div className="diagnostic-body">
                                    <div className="diagnostic-section">
                                        <span className="section-title"><Activity size={13} /> Observed User Behavior</span>
                                        <p>{item.summary}</p>
                                    </div>

                                    <div className="diagnostic-section section-actionable">
                                        <span className="section-title text-success"><Zap size={13} /> Actionable Website Fix</span>
                                        <p>{item.recommendation}</p>
                                    </div>
                                </div>

                                <div className="diagnostic-footer">
                                    <button
                                        type="button"
                                        className="btn-secondary-sm"
                                        onClick={() => {
                                            setActiveTab('visitors');
                                        }}
                                    >
                                        <Users size={13} />
                                        Inspect Affected Visitors
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-primary-sm"
                                        onClick={() => {
                                            const matchReplay = replaysList.find((r) => r.id === item.sampleSessionId) || replaysList[0];
                                            if (matchReplay) handleLaunchReplay(matchReplay);
                                            else setActiveTab('replays');
                                        }}
                                    >
                                        <Play size={13} />
                                        Watch Session Replay
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            )}

            {/* 4. VISITORS TAB (High-Intent Visitor Feed) */}
            {activeTab === 'visitors' && (
                <div className="analytics-tab-pane visitors-pane">
                    <div className="visitors-table-header">
                        <div>
                            <h3>High-Intent Visitor Feed</h3>
                            <p>Detailed chronological intelligence on high-intent prospective clients, connected across visits by persistent visitor ID.</p>
                        </div>
                    </div>

                    <div className="visitors-table-wrap">
                        <table className="visitors-feed-table">
                            <thead>
                                <tr>
                                    <th>Timestamp & Source</th>
                                    <th>Location</th>
                                    <th>Visitor Status</th>
                                    <th>Inferred Intent</th>
                                    <th>Intent Score</th>
                                    <th>Engaged Time</th>
                                    <th>Pages</th>
                                    <th>Outcome</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visitorsFeed.map((visitor) => (
                                    <tr
                                        key={visitor.sessionId || visitor.visitorId}
                                        className="visitor-feed-row"
                                        onClick={() => handleInspectVisitor(visitor)}
                                    >
                                        <td>
                                            <div className="visitor-source-cell">
                                                <strong>{visitor.source || 'Direct Visit'}</strong>
                                                <time>{formatTimeAgo(visitor.timestamp)}</time>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="visitor-location-cell">
                                                <MapPin size={13} className="text-muted" />
                                                <span>{visitor.city ? `${visitor.city}, ${visitor.country}` : formatCountry(visitor.country)}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`status-badge ${visitor.isReturning ? 'status-returning' : 'status-new'}`}>
                                                {visitor.isReturning ? `Returning (${visitor.visitCount} visits)` : 'New Lead'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`intent-tag intent-${visitor.intentCategory}`}>
                                                {visitor.intentCategory === 'obsidian' ? 'Obsidian Tutoring' :
                                                    visitor.intentCategory === 'creative_tech' ? 'Creative Tech' :
                                                        visitor.intentCategory === 'film_brand' ? 'Film & Brand' : 'Photography'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="intent-score-cell">
                                                <div className="score-bar">
                                                    <div className="score-fill" style={{ width: `${visitor.intentScore}%` }} />
                                                </div>
                                                <span>{visitor.intentScore}/100 ({visitor.intentStrength})</span>
                                            </div>
                                        </td>
                                        <td>
                                            <strong>{formatDuration(visitor.totalEngagedSeconds)}</strong>
                                        </td>
                                        <td>
                                            <span className="page-count-badge">{visitor.pageCount} pages</span>
                                        </td>
                                        <td>
                                            {visitor.converted ? (
                                                <span className="outcome-badge outcome-converted">
                                                    <CheckCircle2 size={12} /> {visitor.conversionLabel || 'Enquiry Submitted'}
                                                </span>
                                            ) : (
                                                <span className="outcome-badge outcome-dropoff">
                                                    {visitor.conversionLabel || 'Browsed Portfolio'}
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                className="btn-inspect-row"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleInspectVisitor(visitor);
                                                }}
                                            >
                                                Inspect
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 5. REPLAYS TAB */}
            {activeTab === 'replays' && (
                <div className="analytics-tab-pane replays-pane">
                    <div className="replays-layout">
                        {/* Replay Catalog List */}
                        <div className="replays-sidebar">
                            <div className="sidebar-header">
                                <h4>Targeted Session Recordings</h4>
                                <span className="text-muted">{replaysList.length} recorded</span>
                            </div>

                            <div className="replays-list">
                                {replaysList.map((rep) => {
                                    const isCurrent = activeReplay?.id === rep.id;
                                    return (
                                        <div
                                            key={rep.id}
                                            className={`replay-card-item ${isCurrent ? 'is-selected' : ''}`}
                                            onClick={() => {
                                                setActiveReplay(rep);
                                                setReplayProgress(0);
                                                setIsPlaying(true);
                                            }}
                                        >
                                            <div className="rep-header">
                                                <strong>{rep.location}</strong>
                                                <time>{formatTimeAgo(rep.startedAt)}</time>
                                            </div>
                                            <div className="rep-meta-row">
                                                <span className="rep-source">{rep.source}</span>
                                                <span className="rep-duration">{formatDuration(rep.durationSeconds)}</span>
                                            </div>
                                            <p className="rep-label">{rep.conversionLabel}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Replay Player Main Stage */}
                        <div className="replays-player-stage">
                            {activeReplay ? (
                                <div className="replay-player-container">
                                    {/* Virtual Browser Chrome */}
                                    <div className="virtual-browser-header">
                                        <div className="browser-dots">
                                            <span /><span /><span />
                                        </div>
                                        <div className="browser-url-bar">
                                            <ShieldCheck size={13} className="text-success" />
                                            <span>https://abodid.com{activeReplay.pageJourney?.[0]?.path || '/'}</span>
                                        </div>
                                        <div className="browser-privacy-badge">
                                            <ShieldCheck size={12} />
                                            <span>Inputs & Text Masked</span>
                                        </div>
                                    </div>

                                    {/* Visual Playback Simulation Viewport */}
                                    <div className="replay-viewport-screen">
                                        <div className="replay-page-mockup">
                                            <div className="mockup-hero">
                                                <h2>{activeReplay.pageJourney?.[0]?.title || 'Portfolio Work'}</h2>
                                                <p>Viewing Session: {activeReplay.id} · From {activeReplay.location}</p>
                                            </div>

                                            {/* Simulated Animated Pointer Trail */}
                                            <div
                                                className="simulated-pointer"
                                                style={{
                                                    left: `${Math.min(90, Math.max(10, 20 + Math.sin(replayProgress / 6) * 35))}%`,
                                                    top: `${Math.min(85, Math.max(15, 30 + Math.cos(replayProgress / 8) * 25))}%`,
                                                }}
                                            >
                                                <MousePointer size={18} />
                                                <span className="pointer-tag">{activeReplay.source}</span>
                                            </div>

                                            {/* Click ripple animation on certain progress intervals */}
                                            {replayProgress > 30 && replayProgress < 45 && (
                                                <div className="click-ripple" style={{ left: '45%', top: '50%' }} />
                                            )}
                                        </div>
                                    </div>

                                    {/* Player Controls Bar */}
                                    <div className="replay-controls-bar">
                                        <div className="controls-left">
                                            <button
                                                type="button"
                                                className="btn-play-pause"
                                                onClick={() => setIsPlaying(!isPlaying)}
                                            >
                                                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                                            </button>

                                            <button
                                                type="button"
                                                className="btn-speed-toggle"
                                                onClick={() => setPlaybackSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))}
                                            >
                                                {playbackSpeed}x Speed
                                            </button>

                                            <span className="playback-timer">
                                                {formatDuration(Math.round((activeReplay.durationSeconds || 120) * (replayProgress / 100)))} / {formatDuration(activeReplay.durationSeconds)}
                                            </span>
                                        </div>

                                        {/* Scrubbable Timeline */}
                                        <div className="timeline-scrubber-track">
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={replayProgress}
                                                onChange={(e) => setReplayProgress(Number(e.target.value))}
                                                className="timeline-slider"
                                            />
                                        </div>
                                    </div>

                                    {/* Live Event Stream Timeline */}
                                    <div className="replay-events-drawer">
                                        <h5>Session Behavioral Stream</h5>
                                        <div className="events-stream-list">
                                            {(activeReplay.events || []).map((ev, idx) => (
                                                <div key={idx} className="event-stream-item">
                                                    <span className="event-time">{formatDuration(ev.timeOffset)}</span>
                                                    <span className="event-type-badge">{ev.type}</span>
                                                    <span className="event-text">{ev.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="replay-empty-stage">
                                    <Video size={36} className="text-muted" />
                                    <h4>Select a recording to watch session replay</h4>
                                    <p>Only high-intent or friction-laden visits are recorded to conserve bandwidth.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* VISITOR JOURNEY INSPECTION DRAWER / MODAL */}
            {selectedVisitor && (
                <div className="visitor-modal-backdrop" onClick={() => setSelectedVisitor(null)}>
                    <div className="visitor-modal-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="visitor-modal-header">
                            <div>
                                <span className="modal-lead-tag">Prospective Client Intelligence</span>
                                <h3>{selectedVisitor.city ? `${selectedVisitor.city}, ${selectedVisitor.country}` : 'Visitor Profile'}</h3>
                                <p>Persistent Visitor ID: <code>{selectedVisitor.visitorId}</code></p>
                            </div>
                            <button type="button" className="btn-close-modal" onClick={() => setSelectedVisitor(null)}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="visitor-modal-body">
                            {/* Summary Metadata */}
                            <div className="visitor-quick-meta">
                                <div>
                                    <span>First Touch</span>
                                    <strong>{selectedVisitor.source}</strong>
                                </div>
                                <div>
                                    <span>Commercial Intent</span>
                                    <strong>{selectedVisitor.intentCategory} ({selectedVisitor.intentScore}/100)</strong>
                                </div>
                                <div>
                                    <span>Total Engaged</span>
                                    <strong>{formatDuration(selectedVisitor.totalEngagedSeconds)}</strong>
                                </div>
                                <div>
                                    <span>Status</span>
                                    <strong>{selectedVisitor.isReturning ? 'Returning Lead' : 'New Visitor'}</strong>
                                </div>
                            </div>

                            {/* Multi-Session Chronological Journey */}
                            <div className="visitor-timeline-section">
                                <h4>Multi-Session Evolution</h4>
                                {loadingTimeline ? (
                                    <p className="text-muted">Loading full visitor journey across visits…</p>
                                ) : (
                                    <ol className="journey-chronological-list">
                                        {(selectedVisitor.journey || []).map((page, pIdx) => (
                                            <li key={pIdx} className="journey-node">
                                                <div className="node-dot" />
                                                <div className="node-content">
                                                    <div className="node-header">
                                                        <strong className="node-path">{page.path}</strong>
                                                        <span className="node-duration">{formatDuration(page.engagedSeconds)}</span>
                                                    </div>
                                                    <span className="node-title">{page.title}</span>
                                                </div>
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </div>

                            {/* Key Interactions Log */}
                            {selectedVisitor.keyInteractions?.length > 0 && (
                                <div className="visitor-interactions-section">
                                    <h4>Key Behavioral Touchpoints</h4>
                                    <ul className="interactions-list">
                                        {selectedVisitor.keyInteractions.map((act, aIdx) => (
                                            <li key={aIdx} className="interaction-item">
                                                <Zap size={13} className="text-accent" />
                                                <span>{act.label}</span>
                                                <time>+{act.timeOffset}s</time>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <div className="visitor-modal-footer">
                            <button
                                type="button"
                                className="btn-primary-modal"
                                onClick={() => {
                                    const matchReplay = replaysList.find((r) => r.visitorId === selectedVisitor.visitorId) || replaysList[0];
                                    if (matchReplay) {
                                        setSelectedVisitor(null);
                                        handleLaunchReplay(matchReplay);
                                    }
                                }}
                            >
                                <Play size={14} />
                                Watch Session Replay
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
