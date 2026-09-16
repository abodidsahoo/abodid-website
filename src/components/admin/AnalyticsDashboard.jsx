import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Activity,
    AlertCircle,
    AlertTriangle,
    ArrowDownRight,
    ArrowRight,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Clock,
    Compass,
    Eye,
    ExternalLink,
    FastForward,
    FileText,
    Filter,
    Flame,
    FlaskConical,
    Globe,
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
    Search,
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
    { id: 'dropoffs', label: 'Conversion Problems', icon: TrendingDown },
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

const formatTimeAgo = (timestamp) => {
    if (!timestamp) return 'Just now';
    const elapsedSec = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 1000));
    if (elapsedSec < 60) return `${elapsedSec}s ago`;
    const elapsedMin = Math.floor(elapsedSec / 60);
    if (elapsedMin < 60) return `${elapsedMin}m ago`;
    const elapsedHours = Math.floor(elapsedMin / 60);
    if (elapsedHours < 24) return `${elapsedHours}h ago`;
    return `${Math.floor(elapsedHours / 24)}d ago`;
};

function generateBriefingSummarySentence(overview = {}, range = '7d') {
    const meaningful = overview.meaningfulVisitors || 0;
    const highIntent = overview.highIntentVisitors || 0;
    const returning = overview.returningVisitors || 0;
    const enquiries = overview.enquiriesAndBookings || 0;

    const timeLabel = range === 'today' ? 'Today' :
        range === '7d' ? 'Over the last 7 days' :
        range === '30d' ? 'Over the last 30 days' : 'Over the last 90 days';

    if (meaningful === 0) {
        return `${timeLabel}, no meaningful visitor sessions were recorded yet.`;
    }

    const visitorWord = meaningful === 1 ? 'meaningful visitor' : 'meaningful visitors';
    const prospectWord = highIntent === 1 ? 'prospect' : 'prospects';
    const enquiryWord = enquiries === 1 ? 'confirmed enquiry / booking' : 'confirmed enquiries / bookings';

    if (enquiries > 0 && highIntent > 0) {
        return `${timeLabel}, ${meaningful} ${visitorWord} explored your portfolio, generating ${highIntent} high-intent ${prospectWord} and ${enquiries} ${enquiryWord}.`;
    }
    if (enquiries > 0) {
        return `${timeLabel}, ${meaningful} ${visitorWord} visited your portfolio, producing ${enquiries} ${enquiryWord}.`;
    }
    if (highIntent > 0) {
        return `${timeLabel}, ${meaningful} ${visitorWord} explored your work, with ${highIntent} high-intent ${prospectWord} inspecting services and pricing.`;
    }
    if (returning > 0) {
        return `${timeLabel}, ${meaningful} ${visitorWord} visited your portfolio, including ${returning} returning prospects.`;
    }
    return `${timeLabel}, ${meaningful} ${visitorWord} engaged with your portfolio content.`;
}

function OverviewTrendChart({ trendSeries = [], range = '7d' }) {
    const [activeSeries, setActiveSeries] = useState({
        meaningful: true,
        highIntent: true,
        converted: true,
    });
    const [hoverIndex, setHoverIndex] = useState(null);
    const svgRef = useRef(null);

    const toggleSeries = (key) => {
        setActiveSeries((prev) => {
            const next = { ...prev, [key]: !prev[key] };
            if (!next.meaningful && !next.highIntent && !next.converted) {
                return prev;
            }
            return next;
        });
    };

    const data = useMemo(() => {
        if (!trendSeries || trendSeries.length === 0) {
            return [
                { date: '1', label: 'Mon', meaningful: 0, highIntent: 0, converted: 0, total: 0 },
                { date: '2', label: 'Tue', meaningful: 0, highIntent: 0, converted: 0, total: 0 },
                { date: '3', label: 'Wed', meaningful: 0, highIntent: 0, converted: 0, total: 0 },
                { date: '4', label: 'Thu', meaningful: 0, highIntent: 0, converted: 0, total: 0 },
                { date: '5', label: 'Fri', meaningful: 0, highIntent: 0, converted: 0, total: 0 },
                { date: '6', label: 'Sat', meaningful: 0, highIntent: 0, converted: 0, total: 0 },
                { date: '7', label: 'Sun', meaningful: 0, highIntent: 0, converted: 0, total: 0 },
            ];
        }
        return trendSeries;
    }, [trendSeries]);

    const maxVal = useMemo(() => {
        let max = 0;
        data.forEach((d) => {
            if (activeSeries.meaningful) max = Math.max(max, d.meaningful || 0, d.total || 0);
            if (activeSeries.highIntent) max = Math.max(max, d.highIntent || 0);
            if (activeSeries.converted) max = Math.max(max, d.converted || 0);
        });
        return Math.max(max, 4);
    }, [data, activeSeries]);

    const width = 800;
    const height = 220;
    const padL = 40;
    const padR = 24;
    const padT = 20;
    const padB = 34;

    const chartW = width - padL - padR;
    const chartH = height - padT - padB;

    const getX = (idx) => {
        if (data.length <= 1) return padL + chartW / 2;
        return padL + (idx / (data.length - 1)) * chartW;
    };

    const getY = (val) => {
        return padT + chartH - (val / maxVal) * chartH;
    };

    const createSplinePath = (metricKey) => {
        if (data.length === 0) return '';
        const points = data.map((d, i) => ({ x: getX(i), y: getY(d[metricKey] || 0) }));
        if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

        let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i];
            const p1 = points[i + 1];
            const cp1x = p0.x + (p1.x - p0.x) * 0.4;
            const cp1y = p0.y;
            const cp2x = p1.x - (p1.x - p0.x) * 0.4;
            const cp2y = p1.y;
            d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
        }
        return d;
    };

    const createAreaPath = (metricKey) => {
        const line = createSplinePath(metricKey);
        if (!line) return '';
        const lastX = getX(data.length - 1);
        const firstX = getX(0);
        const bottomY = padT + chartH;
        return `${line} L ${lastX.toFixed(1)} ${bottomY} L ${firstX.toFixed(1)} ${bottomY} Z`;
    };

    const handleMouseMove = (e) => {
        if (!svgRef.current || data.length === 0) return;
        const rect = svgRef.current.getBoundingClientRect();
        const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
        if (clientX === undefined) return;
        const relX = clientX - rect.left;
        const svgRelX = (relX / rect.width) * width;
        const clampedSvgX = Math.max(padL, Math.min(width - padR, svgRelX));
        const fraction = (clampedSvgX - padL) / chartW;
        const idx = Math.min(data.length - 1, Math.max(0, Math.round(fraction * (data.length - 1))));
        setHoverIndex(idx);
    };

    const handleMouseLeave = () => {
        setHoverIndex(null);
    };

    const hoverItem = hoverIndex !== null ? data[hoverIndex] : null;

    const yTicks = useMemo(() => {
        const ticks = [];
        for (let i = 0; i <= 3; i++) {
            const val = Math.round((maxVal / 3) * i);
            ticks.push({ val, y: getY(val) });
        }
        return ticks;
    }, [maxVal]);

    const totalMeaningful = useMemo(() => data.reduce((acc, d) => acc + (d.meaningful || 0), 0), [data]);
    const totalHighIntent = useMemo(() => data.reduce((acc, d) => acc + (d.highIntent || 0), 0), [data]);
    const totalConverted = useMemo(() => data.reduce((acc, d) => acc + (d.converted || 0), 0), [data]);
    const peakDay = useMemo(() => {
        let peak = data[0];
        data.forEach((d) => {
            if ((d.meaningful || 0) > (peak?.meaningful || 0)) peak = d;
        });
        return peak;
    }, [data]);

    return (
        <div className="trend-chart-card">
            <div className="trend-chart-header">
                <div className="trend-title-block">
                    <div className="trend-badge-row">
                        <Activity size={15} className="text-accent" />
                        <span className="trend-card-title">Commercial Intent & Traffic Velocity</span>
                    </div>
                    <p className="trend-card-desc">
                        Visualizing the transformation from curious site visitors to high-intent leads and confirmed bookings over time.
                    </p>
                </div>

                <div className="trend-legend-pills">
                    <button
                        type="button"
                        className={`legend-pill pill-meaningful ${activeSeries.meaningful ? 'is-active' : ''}`}
                        onClick={() => toggleSeries('meaningful')}
                    >
                        <span className="pill-dot dot-meaningful" />
                        <span>Meaningful Traffic ({totalMeaningful})</span>
                    </button>
                    <button
                        type="button"
                        className={`legend-pill pill-high-intent ${activeSeries.highIntent ? 'is-active' : ''}`}
                        onClick={() => toggleSeries('highIntent')}
                    >
                        <span className="pill-dot dot-high-intent" />
                        <span>High-Intent Leads ({totalHighIntent})</span>
                    </button>
                    <button
                        type="button"
                        className={`legend-pill pill-converted ${activeSeries.converted ? 'is-active' : ''}`}
                        onClick={() => toggleSeries('converted')}
                    >
                        <span className="pill-dot dot-converted" />
                        <span>Enquiries ({totalConverted})</span>
                    </button>
                </div>
            </div>

            <div className="trend-quick-metrics">
                <div className="quick-metric-item">
                    <span className="quick-label">Daily Avg Traffic</span>
                    <strong className="quick-val">{(totalMeaningful / (data.length || 1)).toFixed(1)} / day</strong>
                </div>
                <div className="quick-metric-item">
                    <span className="quick-label">High-Intent Lead Ratio</span>
                    <strong className="quick-val">
                        {totalMeaningful > 0 ? `${((totalHighIntent / totalMeaningful) * 100).toFixed(0)}%` : '0%'}
                    </strong>
                </div>
                <div className="quick-metric-item">
                    <span className="quick-label">Peak Volume Date</span>
                    <strong className="quick-val">{peakDay?.fullLabel || peakDay?.label || 'None'}</strong>
                </div>
            </div>

            <div
                className="svg-trend-wrap"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onTouchMove={handleMouseMove}
                onTouchEnd={handleMouseLeave}
            >
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${width} ${height}`}
                    className="svg-trend-canvas"
                    preserveAspectRatio="none"
                >
                    <defs>
                        <linearGradient id="gradMeaningful" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.28" />
                            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="gradHighIntent" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.32" />
                            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="gradConverted" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.36" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                        </linearGradient>
                    </defs>

                    {yTicks.map((tick, idx) => (
                        <g key={idx} className="chart-grid-row">
                            <line
                                x1={padL}
                                y1={tick.y}
                                x2={width - padR}
                                y2={tick.y}
                                stroke="rgba(255, 255, 255, 0.07)"
                                strokeDasharray="3 3"
                            />
                            <text
                                x={padL - 8}
                                y={tick.y + 4}
                                textAnchor="end"
                                className="chart-axis-text"
                                fill="rgba(255, 255, 255, 0.4)"
                                fontSize="10"
                            >
                                {tick.val}
                            </text>
                        </g>
                    ))}

                    {data.map((d, idx) => {
                        const showLabel = data.length <= 10 || idx % Math.ceil(data.length / 8) === 0 || idx === data.length - 1;
                        if (!showLabel) return null;
                        const x = getX(idx);
                        return (
                            <text
                                key={idx}
                                x={x}
                                y={height - 10}
                                textAnchor="middle"
                                className="chart-axis-text"
                                fill="rgba(255, 255, 255, 0.45)"
                                fontSize="10"
                            >
                                {d.label}
                            </text>
                        );
                    })}

                    {activeSeries.meaningful && (
                        <path d={createAreaPath('meaningful')} fill="url(#gradMeaningful)" />
                    )}
                    {activeSeries.highIntent && (
                        <path d={createAreaPath('highIntent')} fill="url(#gradHighIntent)" />
                    )}
                    {activeSeries.converted && (
                        <path d={createAreaPath('converted')} fill="url(#gradConverted)" />
                    )}

                    {activeSeries.meaningful && (
                        <path
                            d={createSplinePath('meaningful')}
                            fill="none"
                            stroke="#38bdf8"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    )}
                    {activeSeries.highIntent && (
                        <path
                            d={createSplinePath('highIntent')}
                            fill="none"
                            stroke="#f59e0b"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    )}
                    {activeSeries.converted && (
                        <path
                            d={createSplinePath('converted')}
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    )}

                    {hoverIndex !== null && hoverItem && (
                        <g className="chart-hover-group">
                            <line
                                x1={getX(hoverIndex)}
                                y1={padT}
                                x2={getX(hoverIndex)}
                                y2={padT + chartH}
                                stroke="rgba(255, 255, 255, 0.35)"
                                strokeWidth="1.2"
                                strokeDasharray="2 2"
                            />

                            {activeSeries.meaningful && (
                                <circle
                                    cx={getX(hoverIndex)}
                                    cy={getY(hoverItem.meaningful || 0)}
                                    r="4.5"
                                    fill="#38bdf8"
                                    stroke="#0e1015"
                                    strokeWidth="2"
                                />
                            )}
                            {activeSeries.highIntent && (
                                <circle
                                    cx={getX(hoverIndex)}
                                    cy={getY(hoverItem.highIntent || 0)}
                                    r="4.5"
                                    fill="#f59e0b"
                                    stroke="#0e1015"
                                    strokeWidth="2"
                                />
                            )}
                            {activeSeries.converted && (
                                <circle
                                    cx={getX(hoverIndex)}
                                    cy={getY(hoverItem.converted || 0)}
                                    r="4.5"
                                    fill="#10b981"
                                    stroke="#0e1015"
                                    strokeWidth="2"
                                />
                            )}
                        </g>
                    )}
                </svg>

                {hoverIndex !== null && hoverItem && (
                    <div
                        className="chart-floating-tooltip"
                        style={{
                            left: `${(getX(hoverIndex) / width) * 100}%`,
                            transform: getX(hoverIndex) > width * 0.75
                                ? 'translate(-105%, -50%)'
                                : 'translate(10px, -50%)',
                        }}
                    >
                        <div className="tooltip-date-header">
                            <strong>{hoverItem.fullLabel || hoverItem.date}</strong>
                        </div>
                        <div className="tooltip-metrics-list">
                            <div className="tooltip-row text-meaningful">
                                <span>Meaningful Visits:</span>
                                <strong>{hoverItem.meaningful || 0}</strong>
                            </div>
                            <div className="tooltip-row text-high-intent">
                                <span>High-Intent Leads:</span>
                                <strong>{hoverItem.highIntent || 0}</strong>
                            </div>
                            <div className="tooltip-row text-converted">
                                <span>Enquiries / Bookings:</span>
                                <strong>{hoverItem.converted || 0}</strong>
                            </div>
                            <div className="tooltip-row text-total">
                                <span>Total Sessions:</span>
                                <span>{hoverItem.total || 0}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

const safeLocation = (v) => {
    if (!v) return 'Direct Visitor';
    if (typeof v.location === 'string' && v.location.trim() && !v.location.includes('[object')) return v.location;
    if (typeof v.geo === 'string' && v.geo.trim() && !v.geo.includes('[object')) return v.geo;
    if (v.city || v.country) return [v.city, v.country].filter(Boolean).join(', ');
    return 'Direct Visitor';
};

const safeSource = (v) => {
    if (!v) return 'Direct Entry';
    if (typeof v.source === 'string' && v.source.trim() && !v.source.includes('[object')) return v.source;
    if (typeof v.acquisitionSource === 'string' && v.acquisitionSource.trim() && !v.acquisitionSource.includes('[object')) return v.acquisitionSource;
    if (typeof v.discoverySource === 'string' && v.discoverySource.trim() && !v.discoverySource.includes('[object')) return v.discoverySource;
    if (typeof v.referrer === 'string' && v.referrer.trim() && !v.referrer.includes('[object')) return v.referrer;
    return 'Direct Entry';
};

const safeJourneySummary = (v) => {
    if (!v) return '/';
    if (typeof v.journeySummary === 'string' && v.journeySummary.trim() && !v.journeySummary.includes('[object')) {
        return v.journeySummary;
    }
    const rawPages = Array.isArray(v.pages) ? v.pages : (Array.isArray(v.journey) ? v.journey : (Array.isArray(v.pageJourney) ? v.pageJourney : []));
    if (rawPages.length > 0) {
        const pageNames = rawPages
            .map((p) => {
                if (!p) return null;
                if (typeof p === 'string' && !p.includes('[object')) return p;
                if (typeof p === 'object') return p.title || p.path || p.page || null;
                return null;
            })
            .filter(Boolean);
        if (pageNames.length > 0) return pageNames.join(' → ');
    }
    const landing = typeof v.landingPage === 'string' ? v.landingPage : (v.landingPage?.path || '/');
    const exit = typeof v.exitPage === 'string' ? v.exitPage : (v.exitPage?.path || landing);
    return `${landing} → ${exit}`;
};

export default function AnalyticsDashboard({ accessToken }) {
    const [activeTab, setActiveTab] = useState('overview');
    const [range, setRange] = useState('7d');
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);

    // Global Filter Bar State (Default ≥ 3s to filter out bot hits and rapid bounces)
    const [minEngagedSeconds, setMinEngagedSeconds] = useState(3);

    // Tab 2: Funnels State
    const [funnelFilter, setFunnelFilter] = useState('all');

    // Tab 3: Conversion Problems State
    const [investigatingProblemId, setInvestigatingProblemId] = useState(null);

    // Tab 4: Visitors Inbox State
    const [visitorFilter, setVisitorFilter] = useState('high_intent'); // 'high_intent' | 'returning' | 'converted' | 'photography' | 'obsidian' | 'creative_tech' | 'film_brand' | 'all'
    const [visitorSort, setVisitorSort] = useState('intent'); // 'intent' | 'engaged' | 'newest' | 'returning'
    const [showLowSignal, setShowLowSignal] = useState(false);
    const [visibleVisitorCount, setVisibleVisitorCount] = useState(10);
    const [inspectedVisitorId, setInspectedVisitorId] = useState(null);
    const [visitorTimeline, setVisitorTimeline] = useState(null);
    const [loadingTimeline, setLoadingTimeline] = useState(false);

    // Tab 5: Replays State
    const [activeReplay, setActiveReplay] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [replayProgress, setReplayProgress] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [replayDeviceFilter, setReplayDeviceFilter] = useState('all');
    const [replayIntentFilter, setReplayIntentFilter] = useState('all');
    const [replaySearchQuery, setReplaySearchQuery] = useState('');
    const replayTimerRef = useRef(null);
    const iframeRef = useRef(null);

    const totalReplayPages = activeReplay?.pageJourney || [];
    const currentPageIndex = useMemo(() => {
        if (!totalReplayPages || totalReplayPages.length === 0) return 0;
        if (totalReplayPages.length === 1) return 0;
        const idx = Math.min(totalReplayPages.length - 1, Math.floor((replayProgress / 100) * totalReplayPages.length));
        return idx;
    }, [totalReplayPages, replayProgress]);

    const activeCurrentPage = totalReplayPages[currentPageIndex] || { path: '/' };

    // Synchronize iframe scroll with playback progress
    useEffect(() => {
        if (iframeRef.current && activeReplay) {
            try {
                const iframeWin = iframeRef.current.contentWindow;
                if (iframeWin && iframeWin.document) {
                    const docElem = iframeWin.document.documentElement;
                    const scrollHeight = (docElem.scrollHeight || 1) - (docElem.clientHeight || 1);
                    if (scrollHeight > 0) {
                        const pageProgress = totalReplayPages.length > 1
                            ? (replayProgress % (100 / totalReplayPages.length)) / (100 / totalReplayPages.length)
                            : replayProgress / 100;
                        const targetScroll = Math.max(0, scrollHeight * Math.min(1, pageProgress * 1.35));
                        iframeWin.scrollTo({ top: targetScroll, behavior: 'smooth' });
                    }
                }
            } catch (_e) {
                // Ignore cross-origin warnings if any
            }
        }
    }, [replayProgress, activeReplay, totalReplayPages.length]);

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
        const vId = visitor.sessionId || visitor.visitorId || visitor.id;
        setInspectedVisitorId(vId);
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

    // Visitors Filtering & Sorting
    const { filteredVisitorsList, lowSignalCount } = useMemo(() => {
        let lowCount = 0;
        const list = visitorsFeed.filter((v) => {
            const dwell = v.totalEngagedSeconds || 0;
            const isLow = dwell < 10 && (v.intentScore || 0) < 35 && (v.pages?.length || 1) <= 1 && !v.converted;
            if (isLow) lowCount++;

            // Global engagement filter
            if (minEngagedSeconds > 0 && dwell < minEngagedSeconds) return false;

            // Hide low-signal unless user toggled or 'all' is explicitly selected
            if (!showLowSignal && isLow && visitorFilter !== 'all') {
                return false;
            }

            // Filter chips
            if (visitorFilter === 'high_intent') {
                return (v.intentScore || 0) >= 40 || v.intentStrength === 'High' || Boolean(v.converted);
            }
            if (visitorFilter === 'returning') {
                return Boolean(v.isReturning || v.is_returning);
            }
            if (visitorFilter === 'converted') {
                return Boolean(v.converted);
            }
            if (visitorFilter === 'photography') {
                return v.intentCategory === 'photography';
            }
            if (visitorFilter === 'obsidian') {
                return v.intentCategory === 'obsidian';
            }
            if (visitorFilter === 'creative_tech') {
                return v.intentCategory === 'creative_tech';
            }
            if (visitorFilter === 'lab_experiments') {
                return Boolean(v.isLabVisitor);
            }
            if (visitorFilter === 'film_brand') {
                return v.intentCategory === 'film_brand';
            }
            return true;
        });

        // Sorting
        list.sort((a, b) => {
            if (visitorSort === 'intent') {
                return (b.intentScore || 0) - (a.intentScore || 0);
            }
            if (visitorSort === 'engaged') {
                return (b.totalEngagedSeconds || 0) - (a.totalEngagedSeconds || 0);
            }
            if (visitorSort === 'newest') {
                return new Date(b.startedAt || 0) - new Date(a.startedAt || 0);
            }
            if (visitorSort === 'returning') {
                if (a.isReturning && !b.isReturning) return -1;
                if (!a.isReturning && b.isReturning) return 1;
                return (b.intentScore || 0) - (a.intentScore || 0);
            }
            return 0;
        });

        return { filteredVisitorsList: list, lowSignalCount: lowCount };
    }, [visitorsFeed, minEngagedSeconds, visitorFilter, visitorSort, showLowSignal]);

    const displayedVisitors = useMemo(() => {
        return filteredVisitorsList.slice(0, visibleVisitorCount);
    }, [filteredVisitorsList, visibleVisitorCount]);

    // Replay filtering
    const filteredReplays = useMemo(() => {
        return replaysList.filter((rep) => {
            const duration = rep.durationSeconds || 0;
            if (duration < minEngagedSeconds) return false;
            const devType = rep.device?.type || 'desktop';
            if (replayDeviceFilter !== 'all' && devType !== replayDeviceFilter) return false;
            if (replayIntentFilter !== 'all' && rep.intentCategory !== replayIntentFilter) return false;
            if (replaySearchQuery.trim()) {
                const q = replaySearchQuery.toLowerCase();
                const matchLoc = (rep.location || '').toLowerCase().includes(q);
                const matchSrc = (rep.source || '').toLowerCase().includes(q);
                const matchDev = (rep.device?.label || '').toLowerCase().includes(q);
                const matchId = (rep.id || rep.visitorId || '').toLowerCase().includes(q);
                if (!matchLoc && !matchSrc && !matchDev && !matchId) return false;
            }
            return true;
        });
    }, [replaysList, minEngagedSeconds, replayDeviceFilter, replayIntentFilter, replaySearchQuery]);

    // 30-Second Daily Briefing Helpers
    const briefingSentence = useMemo(() => {
        return generateBriefingSummarySentence(overview, range);
    }, [overview, range]);

    const topBriefingProblem = useMemo(() => {
        if (!dropoffs.diagnostics || dropoffs.diagnostics.length === 0) return null;
        const first = dropoffs.diagnostics[0];
        if (!first || first.affectedCount === 0) return null;
        return first;
    }, [dropoffs.diagnostics]);

    const isBriefingSampleInsufficient = (overview.meaningfulVisitors || 0) < 3 || !topBriefingProblem;

    const topBriefingProspects = useMemo(() => {
        const feed = visitorsFeed || [];
        const candidates = feed.filter((v) => {
            return (v.intentScore || 0) >= 35 || v.intentStrength === 'High' || Boolean(v.isReturning) || Boolean(v.converted);
        });
        candidates.sort((a, b) => {
            if (b.converted && !a.converted) return 1;
            if (a.converted && !b.converted) return -1;
            return (b.intentScore || 0) - (a.intentScore || 0) || (b.totalEngagedSeconds || 0) - (a.totalEngagedSeconds || 0);
        });
        return candidates.slice(0, 3);
    }, [visitorsFeed]);

    // Auto-select first replay if current activeReplay is missing or filtered out
    useEffect(() => {
        if (!activeReplay && filteredReplays.length > 0) {
            setActiveReplay(filteredReplays[0]);
        } else if (activeReplay && !filteredReplays.some((r) => r.id === activeReplay.id)) {
            setActiveReplay(filteredReplays[0] || null);
        }
    }, [filteredReplays, activeReplay]);

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
                            {tab.id === 'visitors' && filteredVisitorsList.length > 0 && (
                                <span className="tab-pill-badge">{filteredVisitorsList.length}</span>
                            )}
                            {tab.id === 'replays' && replaysList.length > 0 && (
                                <span className="tab-pill-badge">{filteredReplays.length}</span>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Global Engagement & Duration Controller Block */}
            <div className="analytics-global-filter-bar">
                <div className="global-filter-header">
                    <div className="global-filter-title-group">
                        <span className="global-filter-icon-wrap">
                            <Clock size={15} />
                        </span>
                        <div className="global-filter-text">
                            <div className="global-filter-title-row">
                                <strong className="global-filter-title">Engagement Duration Filter</strong>
                                <span className="global-filter-badge">
                                    {minEngagedSeconds === 0 ? 'All Sessions (0s+)' : `≥ ${minEngagedSeconds}s (Human Traffic)`}
                                </span>
                            </div>
                            <p className="global-filter-subtitle">
                                Filters out automated bots and rapid scrapers (&lt;3s) to surface genuine human leads across the dashboard.
                            </p>
                        </div>
                    </div>

                    <div className="global-filter-stats-pills">
                        <span className="filter-stat-pill" title="Filtered visitors matching threshold">
                            <Users size={12} />
                            <strong>{filteredVisitorsList.length}</strong> / {visitorsFeed.length} Visitors
                        </span>
                        <span className="filter-stat-pill" title="Filtered replays matching threshold">
                            <Video size={12} />
                            <strong>{filteredReplays.length}</strong> / {replaysList.length} Replays
                        </span>
                        {minEngagedSeconds !== 3 && (
                            <button
                                type="button"
                                className="btn-reset-global-filter"
                                onClick={() => setMinEngagedSeconds(3)}
                                title="Reset filter to standard human interactions (≥ 3s)"
                            >
                                <X size={12} />
                                <span>Default (≥ 3s)</span>
                            </button>
                        )}
                    </div>
                </div>

                <div className="global-filter-controls">
                    <div className="global-slider-track-wrap">
                        <div className="slider-meta-row">
                            <span className="slider-label-text">Threshold Slider:</span>
                            <span className="slider-active-num">{minEngagedSeconds} seconds</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="120"
                            step="1"
                            value={minEngagedSeconds}
                            onChange={(e) => setMinEngagedSeconds(Number(e.target.value))}
                            className="global-engagement-slider"
                            aria-label="Minimum browse duration in seconds"
                        />
                        <div className="slider-ticks-row">
                            <span>0s (All)</span>
                            <span>3s (Human)</span>
                            <span>10s</span>
                            <span>30s</span>
                            <span>60s (1m)</span>
                            <span>120s (2m+)</span>
                        </div>
                    </div>

                    <div className="global-preset-buttons">
                        <button
                            type="button"
                            className={`preset-btn ${minEngagedSeconds === 3 ? 'is-active' : ''}`}
                            onClick={() => setMinEngagedSeconds(3)}
                            title="Filter out bots and bounces below 3 seconds"
                        >
                            ≥ 3s (Human Interactions)
                        </button>
                        <button
                            type="button"
                            className={`preset-btn ${minEngagedSeconds === 10 ? 'is-active' : ''}`}
                            onClick={() => setMinEngagedSeconds(10)}
                        >
                            ≥ 10s Engaged
                        </button>
                        <button
                            type="button"
                            className={`preset-btn ${minEngagedSeconds === 30 ? 'is-active' : ''}`}
                            onClick={() => setMinEngagedSeconds(30)}
                        >
                            ≥ 30s Deep Read
                        </button>
                        <button
                            type="button"
                            className={`preset-btn ${minEngagedSeconds === 60 ? 'is-active' : ''}`}
                            onClick={() => setMinEngagedSeconds(60)}
                        >
                            ≥ 1m High Intent
                        </button>
                        <button
                            type="button"
                            className={`preset-btn ${minEngagedSeconds === 0 ? 'is-active' : ''}`}
                            onClick={() => setMinEngagedSeconds(0)}
                        >
                            All Logs (0s+)
                        </button>
                    </div>
                </div>
            </div>

            {error && (
                <div className="analytics-alert-banner" role="alert">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                    <button type="button" onClick={() => setRefreshKey((k) => k + 1)}>Retry</button>
                </div>
            )}

            {/* ==========================================================================
               1. OVERVIEW TAB: 30-SECOND COMMERCIAL BRIEFING
               ========================================================================== */}
            {activeTab === 'overview' && (
                <div className="analytics-tab-pane overview-briefing-pane">
                    {/* Section 1: Daily Commercial Pulse */}
                    <section className="briefing-section briefing-section-pulse" aria-labelledby="section-pulse-title">
                        <div className="briefing-section-header">
                            <span className="briefing-section-num">01</span>
                            <div>
                                <h3 id="section-pulse-title">Daily Commercial Pulse</h3>
                                <p>Did anything commercially meaningful happen during this period?</p>
                            </div>
                        </div>

                        <div className="briefing-pulse-grid">
                            <div className="pulse-kpi-card">
                                <span className="pulse-kpi-label">Meaningful Visitors</span>
                                <strong className="pulse-kpi-value">{formatNumber(overview.meaningfulVisitors)}</strong>
                                <span className="pulse-kpi-subtext">Engaged human visits (&gt;10s)</span>
                            </div>

                            <div className="pulse-kpi-card pulse-kpi-accent">
                                <span className="pulse-kpi-label">High-Intent Prospects</span>
                                <strong className="pulse-kpi-value">{formatNumber(overview.highIntentVisitors)}</strong>
                                <span className="pulse-kpi-subtext">Inspected pricing, work & contact</span>
                            </div>

                            <div className="pulse-kpi-card">
                                <span className="pulse-kpi-label">Returning Prospects</span>
                                <strong className="pulse-kpi-value">{formatNumber(overview.returningVisitors)}</strong>
                                <span className="pulse-kpi-subtext">Multi-session evolving leads</span>
                            </div>

                            <div className="pulse-kpi-card pulse-kpi-success">
                                <span className="pulse-kpi-label">Enquiries / Bookings</span>
                                <strong className="pulse-kpi-value">{formatNumber(overview.enquiriesAndBookings)}</strong>
                                <span className="pulse-kpi-subtext">Confirmed client touches</span>
                            </div>
                        </div>

                        <div className="briefing-summary-sentence">
                            <Sparkles size={16} className="sentence-icon" />
                            <p>{briefingSentence}</p>
                        </div>
                    </section>

                    {/* Section 2: Needs Attention */}
                    <section className="briefing-section briefing-section-attention" aria-labelledby="section-attention-title">
                        <div className="briefing-section-header">
                            <span className="briefing-section-num">02</span>
                            <div>
                                <h3 id="section-attention-title">Needs Attention</h3>
                                <p>What is the single biggest thing hurting conversion?</p>
                            </div>
                        </div>

                        {isBriefingSampleInsufficient ? (
                            <div className="briefing-attention-empty">
                                <CheckCircle2 size={24} className="empty-icon text-muted" />
                                <div>
                                    <strong>Not enough data yet</strong>
                                    <p>Traffic volume or friction signals in this period are insufficient to diagnose high-confidence drop-offs without misleading assumptions.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="briefing-attention-card">
                                <div className="attention-card-header">
                                    <div className="attention-title-area">
                                        <span className="attention-badge-alert">
                                            <AlertTriangle size={13} />
                                            <span>High Priority Bottleneck</span>
                                        </span>
                                        <h4>{topBriefingProblem.title}</h4>
                                        <p className="attention-diagnosis">{topBriefingProblem.plainEnglishDiagnosis || topBriefingProblem.whatHappened}</p>
                                    </div>
                                    <div className="attention-impact-badge">
                                        <strong>{topBriefingProblem.affectedVisitors || topBriefingProblem.impactedSessions || 0}</strong>
                                        <span>affected visitors</span>
                                    </div>
                                </div>

                                <div className="attention-supporting-facts">
                                    <span className="fact-label">Key Evidence:</span>
                                    <ul>
                                        {(topBriefingProblem.supportingFacts || [
                                            topBriefingProblem.evidence?.stage ? `Funnel Stage: ${topBriefingProblem.evidence.stage}` : null,
                                            topBriefingProblem.evidence?.sources && topBriefingProblem.evidence.sources !== 'None recorded' ? `Sources: ${topBriefingProblem.evidence.sources}` : null,
                                            topBriefingProblem.evidence?.devices && topBriefingProblem.evidence.devices !== 'None recorded' ? `Devices: ${topBriefingProblem.evidence.devices}` : null,
                                            topBriefingProblem.evidence?.locations && topBriefingProblem.evidence.locations !== 'None recorded' ? `Locations: ${topBriefingProblem.evidence.locations}` : null,
                                        ].filter(Boolean)).map((fact, fIdx) => (
                                            <li key={fIdx}>{fact}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="attention-recommendation">
                                    <strong className="rec-title">Recommended Action:</strong>
                                    <p>{topBriefingProblem.evidenceBasedRecommendation || topBriefingProblem.recommendation}</p>
                                </div>

                                <div className="attention-actions-row">
                                    <button
                                        type="button"
                                        className="btn-attention-action btn-primary-attention"
                                        onClick={() => {
                                            setVisitorFilter('high_intent');
                                            setActiveTab('visitors');
                                        }}
                                    >
                                        <span>Investigate visitors →</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-attention-action btn-secondary-attention"
                                        onClick={() => setActiveTab('journeys')}
                                    >
                                        <span>View funnel →</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Section 3: People Worth Checking */}
                    <section className="briefing-section briefing-section-people" aria-labelledby="section-people-title">
                        <div className="briefing-section-header">
                            <span className="briefing-section-num">03</span>
                            <div>
                                <h3 id="section-people-title">People Worth Checking</h3>
                                <p>Is there anyone specific worth investigating right now?</p>
                            </div>
                        </div>

                        {topBriefingProspects.length === 0 ? (
                            <div className="briefing-people-empty">
                                <Users size={24} className="empty-icon text-muted" />
                                <div>
                                    <strong>No high-signal prospects detected yet</strong>
                                    <p>No visitors in this time window have reached high-intent thresholds or returned for repeated evaluations.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="briefing-prospects-list">
                                {topBriefingProspects.map((prospect, pIndex) => (
                                    <div key={prospect.sessionId || prospect.visitorId || prospect.id || pIndex} className="briefing-prospect-row">
                                        <div className="prospect-main-info">
                                            <div className="prospect-badges-row">
                                                <span className={`briefing-intent-badge intent-${(prospect.intentStrength || 'Normal').toLowerCase()}`}>
                                                    {prospect.intentStrength || 'Lead'} Intent ({prospect.intentScore || 0})
                                                </span>
                                                <span className="briefing-state-badge">
                                                    {prospect.isReturning ? 'Returning Lead' : 'New Visitor'}
                                                </span>
                                                {prospect.converted && (
                                                    <span className="briefing-converted-badge">Enquired / Converted</span>
                                                )}
                                            </div>
                                            <div className="prospect-meta-line">
                                                <span className="prospect-location" title="Visitor Location">
                                                    <MapPin size={13} />
                                                    {safeLocation(prospect)}
                                                </span>
                                                <span className="meta-separator">·</span>
                                                <span className="prospect-source" title="Acquisition Source & Referrer">
                                                    <Globe size={13} />
                                                    {safeSource(prospect)}
                                                </span>
                                                <span className="meta-separator">·</span>
                                                <span className="prospect-time" title="Total Engaged Time">
                                                    <Clock size={13} />
                                                    {formatDuration(prospect.totalEngagedSeconds || prospect.durationSeconds || 0)} engaged
                                                </span>
                                            </div>
                                            <div className="prospect-simplified-journey">
                                                <span className="journey-label">Journey:</span>
                                                <span className="journey-path">
                                                    {safeJourneySummary(prospect)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="prospect-action-area">
                                            <button
                                                type="button"
                                                className="btn-inspect-prospect"
                                                onClick={() => {
                                                    handleInspectVisitor(prospect);
                                                    setActiveTab('visitors');
                                                }}
                                            >
                                                <span>Inspect →</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="briefing-view-all-footer">
                            <button
                                type="button"
                                className="btn-view-all-visitors"
                                onClick={() => setActiveTab('visitors')}
                            >
                                <span>View all visitors →</span>
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {/* ==========================================================================
               2. REVENUE JOURNEYS TAB (Comprehensive Funnels & Creative Disclosures)
               ========================================================================== */}
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
                                <section key={funnel.id} className="funnel-block">
                                    <div className="funnel-block-header">
                                        <div className="funnel-title-area">
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
                                        {(funnel.stages || []).map((stage, idx) => {
                                            const isLast = idx === (funnel.stages || []).length - 1;
                                            const isLeakageStage = leakage && leakage.stageId === stage.id;
                                            const baseDiscoveryCount = Math.max(1, funnel.stages?.[0]?.count || 1);
                                            const retentionPct = Math.round(((stage.count || 0) / baseDiscoveryCount) * 100);
                                            return (
                                                <React.Fragment key={stage.id}>
                                                    <div
                                                        className={`funnel-stage-card ${isLeakageStage ? 'has-leakage' : ''}`}
                                                        onClick={() => setActiveTab('dropoffs')}
                                                        role="button"
                                                        tabIndex={0}
                                                        title="Click to inspect conversion problems"
                                                    >
                                                        <span className="stage-step-num">0{idx + 1}</span>
                                                        <strong className="stage-name">{stage.label}</strong>
                                                        <span className="stage-count">{formatNumber(stage.count)}</span>
                                                        <small className="stage-meta">{retentionPct}% of discovery</small>
                                                        {/* Visual Waterfall Retention Fill Bar */}
                                                        <div className="funnel-waterfall-track">
                                                            <div
                                                                className={`funnel-waterfall-fill ${isLeakageStage ? 'fill-leakage' : ''}`}
                                                                style={{ width: `${Math.max(6, retentionPct)}%` }}
                                                            />
                                                        </div>
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
                                            <div className="leakage-icon-wrap">
                                                <AlertCircle size={15} />
                                            </div>
                                            <div className="leakage-text">
                                                <strong>Primary Funnel Bottleneck:</strong> {leakage.fromStage} → {leakage.toStage} ({leakage.dropOffRate}% drop-off, {leakage.lostVisitors} lost visitors).
                                            </div>
                                            <button
                                                type="button"
                                                className="btn-inspect-leakage"
                                                onClick={() => setActiveTab('dropoffs')}
                                            >
                                                <span>Inspect Problem →</span>
                                            </button>
                                        </div>
                                    )}
                                </section>
                            );
                        })}
                    </div>

                    {/* Funnel Velocity & Trend Chart */}
                    <div className="analytics-journeys-section">
                        <div className="section-header-row">
                            <h3>Portfolio Traffic & Intent Velocity</h3>
                            <p>Daily volume trends of meaningful visitors versus high-intent evaluations over time.</p>
                        </div>
                        <OverviewTrendChart
                            trendSeries={overview.trendSeries || []}
                            range={range}
                        />
                    </div>

                    {/* Commercial Discipline Health */}
                    <div className="analytics-journeys-section">
                        <div className="section-header-row">
                            <h3>Commercial Discipline Health</h3>
                            <p>Live revenue tracking by creative service and consulting offering.</p>
                        </div>

                        <div className="discipline-share-bar-container">
                            <div className="discipline-share-bar">
                                {(overview.revenueBreakdown || []).map((disc) => {
                                    const totalVis = (overview.revenueBreakdown || []).reduce((acc, d) => acc + (d.visitors || 0), 0);
                                    const pct = totalVis > 0 ? Math.round(((disc.visitors || 0) / totalVis) * 100) : 25;
                                    return (
                                        <div
                                            key={disc.id}
                                            className={`discipline-bar-segment segment-${disc.id}`}
                                            style={{ width: `${Math.max(4, pct)}%`, backgroundColor: disc.color || '#38bdf8' }}
                                            title={`${disc.label}: ${disc.visitors} visitors (${pct}%)`}
                                        />
                                    );
                                })}
                            </div>
                        </div>

                        <div className="discipline-cards-grid">
                            {(overview.revenueBreakdown || []).map((disc) => (
                                <div key={disc.id} className="discipline-card">
                                    <div className="discipline-card-header">
                                        <h4>{disc.label}</h4>
                                        <span className="disc-rate">{disc.conversionRate} conv.</span>
                                    </div>
                                    <p className="discipline-desc">{disc.subtitle}</p>
                                    <div className="discipline-metrics-row">
                                        <div className="metric-pill">
                                            <span>Visitors</span>
                                            <strong>{disc.visitors}</strong>
                                        </div>
                                        <div className="metric-pill">
                                            <span>High-Intent</span>
                                            <strong>{disc.highIntent}</strong>
                                        </div>
                                        <div className="metric-pill">
                                            <span>Enquiries</span>
                                            <strong>{disc.enquiries}</strong>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Media Lab & Interactive Experiments Intelligence */}
                    <div className="analytics-journeys-section">
                        <div className="section-header-row">
                            <div className="section-title-with-badge">
                                <h3>Media Lab & Interactive Experiments</h3>
                                <span className="lab-badge"><FlaskConical size={13} /> Experimental Lab</span>
                            </div>
                            <p>Live visitor engagement, prototype interactions, and client inquiries across your interactive experiments.</p>
                        </div>

                        <div className="lab-kpi-strip">
                            <div className="lab-kpi-item">
                                <span className="lab-kpi-label">Lab Explorers</span>
                                <strong className="lab-kpi-val">{formatNumber(overview.labExperiments?.totalVisitors || 0)}</strong>
                                <span className="lab-kpi-hint">Interactive visits</span>
                            </div>
                            <div className="lab-kpi-item">
                                <span className="lab-kpi-label">Total Lab Dwell</span>
                                <strong className="lab-kpi-val">{formatDuration(overview.labExperiments?.totalEngagedSeconds || 0)}</strong>
                                <span className="lab-kpi-hint">Engaged time</span>
                            </div>
                            <div className="lab-kpi-item">
                                <span className="lab-kpi-label">Avg Exploration Time</span>
                                <strong className="lab-kpi-val">{formatDuration(overview.labExperiments?.avgEngagedSeconds || 0)}</strong>
                                <span className="lab-kpi-hint">Per explorer</span>
                            </div>
                            <div className="lab-kpi-item">
                                <span className="lab-kpi-label">Lab Inquiries</span>
                                <strong className="lab-kpi-val text-success">{overview.labExperiments?.enquiries || 0} ({overview.labExperiments?.conversionRate || '0.0%'})</strong>
                                <span className="lab-kpi-hint">Converted leads</span>
                            </div>
                        </div>

                        <div className="lab-share-bar-container">
                            <div className="lab-share-bar">
                                {(overview.labExperiments?.experiments || []).map((exp) => {
                                    const totalExpVis = (overview.labExperiments?.experiments || []).reduce((acc, e) => acc + (e.visitors || 0), 0);
                                    const pct = totalExpVis > 0 ? Math.round(((exp.visitors || 0) / totalExpVis) * 100) : 15;
                                    return (
                                        <div
                                            key={exp.id}
                                            className={`lab-bar-segment segment-${exp.id}`}
                                            style={{ width: `${Math.max(4, pct)}%`, backgroundColor: exp.color || '#caff48' }}
                                            title={`${exp.title}: ${exp.visitors} explorers (${pct}%)`}
                                        />
                                    );
                                })}
                            </div>
                        </div>

                        <div className="lab-experiments-grid">
                            {(overview.labExperiments?.experiments || []).map((exp) => (
                                <div key={exp.id} className="lab-experiment-card">
                                    <div className="lab-card-header">
                                        <div className="lab-card-title-group">
                                            <div className="lab-bullet-indicator" style={{ backgroundColor: exp.color || '#caff48' }} />
                                            <h4>{exp.title}</h4>
                                        </div>
                                        <a
                                            href={exp.path}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="lab-exp-live-link"
                                            title={`Open ${exp.title} in new tab`}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <span>Open</span>
                                            <ExternalLink size={12} />
                                        </a>
                                    </div>
                                    <span className="lab-exp-discipline">{exp.discipline}</span>
                                    <p className="lab-exp-desc">{exp.description}</p>
                                    
                                    <div className="lab-exp-share-wrap">
                                        <div className="lab-exp-share-meta">
                                            <span>Lab Traffic Share</span>
                                            <strong>{exp.share}</strong>
                                        </div>
                                        <div className="lab-exp-share-track">
                                            <div
                                                className="lab-exp-share-fill"
                                                style={{ width: exp.share || '0%', backgroundColor: exp.color || '#caff48' }}
                                            />
                                        </div>
                                    </div>

                                    <div className="lab-exp-metrics-row">
                                        <div className="lab-metric-pill">
                                            <span>Explorers</span>
                                            <strong>{exp.visitors}</strong>
                                        </div>
                                        <div className="lab-metric-pill">
                                            <span>Avg Dwell</span>
                                            <strong>{formatDuration(exp.avgEngagedSeconds)}</strong>
                                        </div>
                                        <div className="lab-metric-pill">
                                            <span>&gt;15s Deep</span>
                                            <strong>{exp.deepEngaged || 0}</strong>
                                        </div>
                                        <div className="lab-metric-pill">
                                            <span>Enquiries</span>
                                            <strong className="text-success">{exp.enquiries}</strong>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Traffic Discovery & Search Intent */}
                    <div className="analytics-journeys-section">
                        <div className="section-header-row">
                            <h3>Traffic Discovery & Search Intent</h3>
                            <p>How prospective clients discovered your work (LinkedIn, Google search keywords, direct referrals, or AI agents).</p>
                        </div>

                        <div className="discovery-sources-grid">
                            {(overview.discoverySources || []).map((src) => (
                                <div key={src.id} className="discovery-source-card">
                                    <div className="source-card-header">
                                        <div className="source-title-group">
                                            <Compass size={14} className="source-icon" />
                                            <strong>{src.label}</strong>
                                        </div>
                                        <span className="source-share-badge">{src.share}</span>
                                    </div>

                                    <div className="source-share-bar-wrap">
                                        <div
                                            className="source-share-bar-fill"
                                            style={{ width: src.share || '0%' }}
                                        />
                                    </div>

                                    <div className="source-stats-row">
                                        <div className="source-stat-item">
                                            <span className="stat-label">Visitors</span>
                                            <strong className="stat-num">{src.count}</strong>
                                        </div>
                                        <div className="source-stat-item">
                                            <span className="stat-label">Avg Dwell</span>
                                            <strong className="stat-num">{formatDuration(src.avgEngagedSeconds)}</strong>
                                        </div>
                                        <div className="source-stat-item">
                                            <span className="stat-label">Enquiries</span>
                                            <strong className="stat-num text-success">{src.enquiries} ({src.conversionRate})</strong>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Landing Pages & Subsequent Destinations */}
                    <div className="analytics-journeys-section">
                        <div className="section-header-row">
                            <h3>Landing Pages & Subsequent Destinations</h3>
                            <p>Where visitors first arrived and the top pages they navigated to next.</p>
                        </div>

                        <div className="landing-transitions-list">
                            {(overview.landingTransitions || []).map((lt) => (
                                <div key={lt.path} className="landing-transition-card">
                                    <div className="landing-header">
                                        <div className="landing-path-title">
                                            <strong className="path-code">{lt.path}</strong>
                                            <span className="landing-meta-badge">{lt.count} entries ({lt.share}) · Avg {formatDuration(lt.avgEngagedSeconds)}</span>
                                        </div>
                                    </div>
                                    <div className="landing-destinations-row">
                                        <span className="dest-lead">Next pages visited:</span>
                                        {lt.topDestinations?.map((dest, dIdx) => (
                                            <div key={dIdx} className="destination-pill">
                                                <ArrowRight size={11} />
                                                <code className="dest-code">{dest.destination}</code>
                                                <span className="dest-share">{dest.share}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ==========================================================================
               3. CONVERSION PROBLEMS TAB ("Where am I losing clients?")
               ========================================================================== */}
            {activeTab === 'dropoffs' && (
                <div className="analytics-tab-pane conversion-problems-pane">
                    {/* Header Intro */}
                    <div className="problems-header-intro">
                        <div className="problems-title-group">
                            <h2>Where am I losing clients?</h2>
                            <p>Ranked by business impact · Clear diagnosis of where prospective leads drop off and what to change.</p>
                        </div>
                    </div>

                    {/* Summary Strip */}
                    <div className="problems-summary-banner">
                        <div className="summary-left">
                            <span className="summary-bullet">●</span>
                            <strong className="summary-text">
                                {dropoffs.summary?.summaryText || `${dropoffs.diagnostics?.length || 0} conversion problems detected`}
                            </strong>
                        </div>
                    </div>

                    {/* Stacked Problem Rows */}
                    <div className="conversion-problems-list">
                        {dropoffs.diagnostics?.length === 0 ? (
                            <div className="empty-problems-card">
                                <CheckCircle2 size={32} className="text-success empty-icon" />
                                <h3>No conversion friction detected</h3>
                                <p>All visitors in this period are flowing smoothly through funnels without major drop-offs or form abandonment.</p>
                            </div>
                        ) : (
                            (dropoffs.diagnostics || []).map((problem, pIdx) => {
                                const isInvestigating = investigatingProblemId === problem.id;
                                const maxImpact = Math.max(1, ...(dropoffs.diagnostics || []).map((d) => d.impactedSessions || 0));
                                const impactPercent = Math.min(100, Math.max(12, Math.round(((problem.impactedSessions || 0) / maxImpact) * 100)));
                                return (
                                    <article key={problem.id} className={`problem-card ${isInvestigating ? 'is-investigating' : ''}`}>
                                        <div className="problem-card-header">
                                            <div className="problem-title-row">
                                                <span className="problem-rank">#{pIdx + 1}</span>
                                                <h3 className="problem-headline">{problem.title}</h3>
                                                <span className={`problem-severity-badge severity-${(problem.severity || 'medium').toLowerCase().replace(/\s+/g, '-')}`}>
                                                    {problem.severity}
                                                </span>
                                            </div>
                                            <div className="problem-impact-group">
                                                <div className="problem-impact-pill">
                                                    <strong>{problem.impactedSessions}</strong> sessions affected
                                                </div>
                                                <div className="problem-visual-impact-bar-wrap" title={`Relative impact: ${impactPercent}%`}>
                                                    <div
                                                        className="problem-visual-impact-bar-fill"
                                                        style={{ width: `${impactPercent}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="problem-body-grid">
                                            {/* 1. What Happened */}
                                            <div className="problem-section-block">
                                                <span className="section-label">What Happened</span>
                                                <p className="section-text">{problem.whatHappened}</p>
                                            </div>

                                            {/* 2. Evidence */}
                                            <div className="problem-section-block">
                                                <span className="section-label">Evidence & Pattern</span>
                                                <div className="evidence-chips-wrap">
                                                    <span className="evidence-chip">
                                                        <strong>Funnel Stage:</strong> {problem.stage || problem.evidence?.stage}
                                                    </span>
                                                    <span className="evidence-chip">
                                                        <strong>Sources:</strong> {problem.evidence?.sources}
                                                    </span>
                                                    <span className="evidence-chip">
                                                        <strong>Devices:</strong> {problem.evidence?.devices}
                                                    </span>
                                                    {problem.evidence?.locations && problem.evidence?.locations !== 'None recorded' && (
                                                        <span className="evidence-chip">
                                                            <strong>Locations:</strong> {problem.evidence?.locations}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 3. Why It Matters */}
                                            <div className="problem-section-block">
                                                <span className="section-label">Why It Matters</span>
                                                <p className="section-text text-emphasis">{problem.whyItMatters}</p>
                                            </div>

                                            {/* 4. Recommended Change */}
                                            <div className="problem-action-recommendation">
                                                <div className="action-tag">
                                                    <Zap size={14} className="text-accent" />
                                                    <span>Recommended Action</span>
                                                </div>
                                                <p className="action-text">{problem.recommendation}</p>
                                            </div>
                                        </div>

                                        {/* 5. Dominant Action */}
                                        <div className="problem-card-footer">
                                            <button
                                                type="button"
                                                className="btn-investigate-problem"
                                                onClick={() => setInvestigatingProblemId(isInvestigating ? null : problem.id)}
                                            >
                                                <span>{isInvestigating ? 'Close Investigation ↑' : 'Investigate Problem →'}</span>
                                            </button>
                                        </div>

                                        {/* Progressive Investigation Drawer */}
                                        {isInvestigating && (
                                            <div className="problem-investigation-drawer">
                                                <div className="investigation-drawer-header">
                                                    <div className="drawer-title-group">
                                                        <h4>Detailed Investigation: {problem.title}</h4>
                                                        <span className="drawer-step-count">Problem {pIdx + 1} of {dropoffs.diagnostics.length}</span>
                                                    </div>
                                                    <div className="drawer-nav-actions">
                                                        <button
                                                            type="button"
                                                            className="drawer-nav-btn"
                                                            disabled={pIdx === 0}
                                                            onClick={() => setInvestigatingProblemId(dropoffs.diagnostics[pIdx - 1].id)}
                                                        >
                                                            <ChevronLeft size={14} />
                                                            <span>Previous problem</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="drawer-nav-btn"
                                                            disabled={pIdx === dropoffs.diagnostics.length - 1}
                                                            onClick={() => setInvestigatingProblemId(dropoffs.diagnostics[pIdx + 1].id)}
                                                        >
                                                            <span>Next problem</span>
                                                            <ChevronRight size={14} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn-close-drawer"
                                                            onClick={() => setInvestigatingProblemId(null)}
                                                            title="Close investigation"
                                                        >
                                                            <X size={15} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Sample Affected Journeys */}
                                                <div className="investigation-samples-section">
                                                    <h5>Representative Affected Journeys ({problem.sampleSessions?.length || 0} sampled)</h5>
                                                    <div className="sample-sessions-list">
                                                        {problem.sampleSessions?.length === 0 ? (
                                                            <p className="text-muted">Not enough session recordings for this specific issue yet.</p>
                                                        ) : (
                                                            problem.sampleSessions?.map((sample, sIdx) => (
                                                                <div key={sample.id || sIdx} className="sample-session-item">
                                                                    <div className="sample-meta">
                                                                        <strong>{sample.location}</strong>
                                                                        <span>{sample.source}</span>
                                                                        <span>{sample.deviceLabel}</span>
                                                                        <span>{formatDuration(sample.engagedSeconds)}</span>
                                                                    </div>
                                                                    <div className="sample-pathway">
                                                                        <code>{sample.pathway}</code>
                                                                    </div>
                                                                    {sample.hasReplay && (
                                                                        <button
                                                                            type="button"
                                                                            className="btn-sample-replay"
                                                                            onClick={() => {
                                                                                const match = replaysList.find((r) => r.id === sample.id || r.visitorId === sample.visitorId) || replaysList[0];
                                                                                if (match) handleLaunchReplay(match);
                                                                                else setActiveTab('replays');
                                                                            }}
                                                                        >
                                                                            <Play size={12} />
                                                                            <span>Watch Replay</span>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </article>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* ==========================================================================
               4. VISITORS TAB (High-Intent Visitor Inbox / CRM Feed)
               ========================================================================== */}
            {activeTab === 'visitors' && (
                <div className="analytics-tab-pane visitors-pane">
                    {/* Header Intro */}
                    <div className="visitors-inbox-header">
                        <div className="inbox-title-block">
                            <h3>High-Intent Visitor Inbox</h3>
                            <p>Qualified prospective clients and commercial touches ranked by intent and dwell time.</p>
                        </div>

                        {/* Filter Chips */}
                        <div className="inbox-filter-chips">
                            {[
                                { id: 'high_intent', label: 'High Intent' },
                                { id: 'returning', label: 'Returning' },
                                { id: 'converted', label: 'Converted' },
                                { id: 'photography', label: 'Photography' },
                                { id: 'obsidian', label: 'Obsidian Tutoring' },
                                { id: 'creative_tech', label: 'Creative Tech' },
                                { id: 'lab_experiments', label: 'Media Lab' },
                                { id: 'film_brand', label: 'Film & Brand' },
                                { id: 'all', label: 'All Traffic' },
                            ].map((chip) => (
                                <button
                                    key={chip.id}
                                    type="button"
                                    className={`inbox-filter-chip ${visitorFilter === chip.id ? 'is-active' : ''}`}
                                    onClick={() => {
                                        setVisitorFilter(chip.id);
                                        setVisibleVisitorCount(10);
                                    }}
                                >
                                    {chip.label}
                                </button>
                            ))}
                        </div>

                        {/* Toolbar: Stats + Low Signal Toggle + Sort */}
                        <div className="inbox-toolbar-row">
                            <div className="toolbar-stats">
                                <span>Showing <strong>{Math.min(visibleVisitorCount, filteredVisitorsList.length)}</strong> of {filteredVisitorsList.length} prospects</span>
                                {lowSignalCount > 0 && !showLowSignal && (
                                    <button
                                        type="button"
                                        className="btn-toggle-low-signal"
                                        onClick={() => setShowLowSignal(true)}
                                    >
                                        Show {lowSignalCount} low-signal visits (&lt;10s)
                                    </button>
                                )}
                                {showLowSignal && (
                                    <button
                                        type="button"
                                        className="btn-toggle-low-signal is-active"
                                        onClick={() => setShowLowSignal(false)}
                                    >
                                        Hide low-signal visits
                                    </button>
                                )}
                            </div>

                            <div className="toolbar-sort-wrap">
                                <span className="sort-label">Sort:</span>
                                <select
                                    value={visitorSort}
                                    onChange={(e) => setVisitorSort(e.target.value)}
                                    className="inbox-sort-select"
                                >
                                    <option value="intent">Highest Intent</option>
                                    <option value="engaged">Most Engaged Time</option>
                                    <option value="newest">Newest First</option>
                                    <option value="returning">Returning Leads First</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Inbox Stacked Rows */}
                    <div className="visitors-inbox-list">
                        {displayedVisitors.length === 0 ? (
                            <div className="empty-visitors-box">
                                <Users size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                                <h4>No visitors match this filter</h4>
                                <p>Try selecting "All Traffic" or adjusting your global duration threshold.</p>
                            </div>
                        ) : (
                            displayedVisitors.map((visitor) => {
                                const vId = visitor.sessionId || visitor.visitorId || visitor.id;
                                const isInspected = inspectedVisitorId === vId;
                                const intentCategoryLabel = visitor.intentCategory === 'obsidian' ? 'Obsidian Tutoring' :
                                    visitor.intentCategory === 'creative_tech' ? 'Creative Tech' :
                                        visitor.intentCategory === 'film_brand' ? 'Film & Brand' :
                                            visitor.intentCategory === 'photography' ? 'Photography' : 'General Portfolio';

                                const cleanLocation = safeLocation(visitor);
                                const cleanSource = safeSource(visitor);
                                const cleanJourney = safeJourneySummary(visitor);
                                const cleanKeyword = typeof visitor.searchKeyword === 'string' && visitor.searchKeyword.trim() && !visitor.searchKeyword.includes('[object') ? visitor.searchKeyword.trim() : null;
                                const pageCount = Array.isArray(visitor.pages) ? visitor.pages.length : (Array.isArray(visitor.journey) ? visitor.journey.length : (visitor.pageCount || 1));

                                return (
                                    <article key={vId} className={`visitor-inbox-row ${isInspected ? 'is-inspected' : ''}`}>
                                        <div
                                            className="inbox-row-main"
                                            onClick={() => {
                                                if (isInspected) setInspectedVisitorId(null);
                                                else handleInspectVisitor(visitor);
                                            }}
                                        >
                                            {/* 1. Strongest visual element: Intent Badge + Lab Badge + Visual Intent Score Gauge */}
                                            <div className="inbox-intent-badge-wrap">
                                                <span className={`inbox-intent-badge intent-${visitor.intentCategory || 'general'}`}>
                                                    {intentCategoryLabel} · {visitor.intentStrength || 'Normal'} Intent ({visitor.intentScore || 50})
                                                </span>

                                                {visitor.isLabVisitor && visitor.labExperimentNames?.length > 0 && (
                                                    <span className="inbox-lab-badge" title={`Explored experiments: ${visitor.labExperimentNames.join(', ')}`}>
                                                        <FlaskConical size={11} />
                                                        <span>{visitor.labExperimentNames[0]}{visitor.labExperimentNames.length > 1 ? ` +${visitor.labExperimentNames.length - 1}` : ''}</span>
                                                    </span>
                                                )}

                                                <div className="intent-score-meter-wrap" title={`Intent Score: ${visitor.intentScore || 50}/100`}>
                                                    <div className="intent-score-meter-track">
                                                        <div
                                                            className={`intent-score-meter-fill ${(visitor.intentScore || 50) >= 55 ? 'fill-high' : 'fill-normal'}`}
                                                            style={{ width: `${Math.min(100, Math.max(10, visitor.intentScore || 50))}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 2. Clean metadata chain */}
                                            <div className="inbox-meta-chain">
                                                <span className="meta-item meta-location">{cleanLocation}</span>
                                                <span className="meta-separator">·</span>
                                                <span className="meta-item meta-source">{cleanSource}</span>
                                                {cleanKeyword && (
                                                    <>
                                                        <span className="meta-separator">·</span>
                                                        <span className="meta-item meta-keyword">"{cleanKeyword}"</span>
                                                    </>
                                                )}
                                                <span className="meta-separator">·</span>
                                                <span className="meta-item meta-type">{visitor.isReturning ? 'Returning Lead' : 'New Visitor'}</span>
                                                <span className="meta-separator">·</span>
                                                <span className="meta-item meta-duration">{formatDuration(visitor.totalEngagedSeconds)}</span>
                                                <span className="meta-separator">·</span>
                                                <span className="meta-item meta-pages">{pageCount} {pageCount === 1 ? 'page' : 'pages'}</span>
                                                <span className="meta-separator">·</span>
                                                <span className="meta-item meta-time">{formatTimeAgo(visitor.startedAt || visitor.endedAt)}</span>
                                            </div>

                                            {/* 3. One-line journey summary */}
                                            <div className="inbox-journey-summary">
                                                <Route size={13} className="journey-icon" />
                                                <span className="journey-text">
                                                    {cleanJourney}
                                                </span>
                                            </div>

                                            {/* 4. Single Dominant Action Button */}
                                            <div className="inbox-action-wrap">
                                                <button
                                                    type="button"
                                                    className="btn-inspect-prospect"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (isInspected) setInspectedVisitorId(null);
                                                        else handleInspectVisitor(visitor);
                                                    }}
                                                >
                                                    <span>{isInspected ? 'Close ↑' : 'Inspect visitor →'}</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Expanded Detail Dossier */}
                                        {isInspected && (
                                            <div className="visitor-dossier-panel">
                                                <div className="dossier-header-bar">
                                                    <div className="dossier-title">
                                                        <strong>Lead Dossier: {cleanLocation}</strong>
                                                        <span className="text-muted">({visitor.device?.label || 'Desktop'} · {cleanSource})</span>
                                                    </div>
                                                    <div className="dossier-actions">
                                                        {visitor.hasReplay && (
                                                            <button
                                                                type="button"
                                                                className="btn-dossier-replay"
                                                                onClick={() => {
                                                                    const match = replaysList.find((r) => r.id === visitor.sessionId || r.visitorId === visitor.visitorId) || replaysList[0];
                                                                    if (match) handleLaunchReplay(match);
                                                                    else setActiveTab('replays');
                                                                }}
                                                            >
                                                                <Play size={13} />
                                                                <span>Watch Session Replay</span>
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            className="btn-close-dossier"
                                                            onClick={() => setInspectedVisitorId(null)}
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="dossier-content-grid">
                                                    {/* Full Chronological Journey */}
                                                    <div className="dossier-section">
                                                        <h5>Chronological Journey Pathway</h5>
                                                        <div className="dossier-timeline">
                                                            {(visitor.pages || visitor.journey || []).map((page, pgIdx) => {
                                                                const pageList = visitor.pages || visitor.journey || [];
                                                                const maxPageDwell = Math.max(1, ...pageList.map((p) => p.engagedSeconds || 0));
                                                                const pageDwellPct = Math.min(100, Math.max(10, Math.round(((page.engagedSeconds || 0) / maxPageDwell) * 100)));
                                                                const pTitle = typeof page === 'string' ? page : (page.title || page.path || 'Page');
                                                                const pPath = typeof page === 'string' ? page : (page.path || '/');
                                                                return (
                                                                    <div key={pgIdx} className="timeline-node">
                                                                        <div className="node-marker">{pgIdx + 1}</div>
                                                                        <div className="node-info">
                                                                            <strong className="node-title">{pTitle}</strong>
                                                                            <code className="node-path">{pPath}</code>
                                                                            <span className="node-dwell">{formatDuration(page.engagedSeconds || 0)} dwell</span>
                                                                            {/* Visual Page Dwell Bar */}
                                                                            <div className="timeline-dwell-bar-wrap">
                                                                                <div
                                                                                    className="timeline-dwell-bar-fill"
                                                                                    style={{ width: `${pageDwellPct}%` }}
                                                                                    title={`Dwell distribution: ${pageDwellPct}%`}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Commercial Context & Attribution */}
                                                    <div className="dossier-section">
                                                        <h5>Commercial Context & Attribution</h5>
                                                        <div className="dossier-details-table">
                                                            <div className="dossier-row">
                                                                <span className="row-key">Commercial Intent:</span>
                                                                <strong className="row-val">{intentCategoryLabel} ({visitor.intentStrength || 'Normal'})</strong>
                                                            </div>
                                                            <div className="dossier-row">
                                                                <span className="row-key">Intent Score:</span>
                                                                <strong className="row-val">{visitor.intentScore || 50} / 100</strong>
                                                            </div>
                                                            <div className="dossier-row">
                                                                <span className="row-key">Outcome / Conversion:</span>
                                                                <span className={`row-val ${visitor.converted ? 'text-success' : ''}`}>
                                                                    {visitor.conversionLabel || (visitor.converted ? 'Enquiry Submitted' : 'Browsed Portfolio')}
                                                                </span>
                                                            </div>
                                                            <div className="dossier-row">
                                                                <span className="row-key">Acquisition Source:</span>
                                                                <span className="row-val">{cleanSource}</span>
                                                            </div>
                                                            {cleanKeyword && (
                                                                <div className="dossier-row">
                                                                    <span className="row-key">Search Discovery:</span>
                                                                    <strong className="row-val">"{cleanKeyword}"</strong>
                                                                </div>
                                                            )}
                                                            <div className="dossier-row">
                                                                <span className="row-key">Device & System:</span>
                                                                <span className="row-val">{visitor.device?.label || 'Desktop'} ({visitor.device?.type || 'desktop'})</span>
                                                            </div>
                                                            {visitor.isLabVisitor && (
                                                                <div className="dossier-row">
                                                                    <span className="row-key">Lab Experiments:</span>
                                                                    <strong className="row-val text-accent" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                                                        <FlaskConical size={13} />
                                                                        <span>{visitor.labExperimentNames?.join(', ') || 'Media Lab'}</span>
                                                                    </strong>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Multi-session History if available */}
                                                        {loadingTimeline ? (
                                                            <p className="text-muted" style={{ marginTop: '1rem' }}>Loading multi-session journey...</p>
                                                        ) : (Array.isArray(visitorTimeline) && visitorTimeline.length > 0) && (
                                                            <div className="multi-session-box" style={{ marginTop: '1rem' }}>
                                                                <h6>Multi-Session History ({visitorTimeline.length} sessions)</h6>
                                                                <div className="multi-session-list">
                                                                    {visitorTimeline.map((s, sIdx) => (
                                                                        <div key={s.id || sIdx} className="multi-session-item">
                                                                            <span>Session {sIdx + 1} ({formatTimeAgo(s.started_at || s.startedAt)})</span>
                                                                            <strong>{formatDuration(s.total_engaged_seconds || s.totalEngagedSeconds)}</strong>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </article>
                                );
                            })
                        )}
                    </div>

                    {/* Load More Button */}
                    {displayedVisitors.length < filteredVisitorsList.length && (
                        <div className="inbox-load-more-wrap">
                            <button
                                type="button"
                                className="btn-load-more-visitors"
                                onClick={() => setVisibleVisitorCount((c) => c + 10)}
                            >
                                Load More Prospects ({filteredVisitorsList.length - displayedVisitors.length} remaining)
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ==========================================================================
               5. REPLAYS TAB
               ========================================================================== */}
            {activeTab === 'replays' && (
                <div className="analytics-tab-pane replays-pane">
                    <div className="replays-layout">
                        {/* Replay Catalog & User Selection Sidebar */}
                        <div className="replays-sidebar">
                            <div className="sidebar-header">
                                <div>
                                    <h4>Visitor Replay Directory</h4>
                                    <span className="text-muted">{filteredReplays.length} of {replaysList.length} recordings</span>
                                </div>
                            </div>

                            {/* Replay Filter Controls */}
                            <div className="replay-sidebar-filters">
                                {/* Search User / Location */}
                                <div className="replay-search-input-wrap">
                                    <Search size={13} className="text-muted search-icon" />
                                    <input
                                        type="text"
                                        placeholder="Search location, source, or device..."
                                        value={replaySearchQuery}
                                        onChange={(e) => setReplaySearchQuery(e.target.value)}
                                        className="replay-search-input"
                                    />
                                    {replaySearchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setReplaySearchQuery('')}
                                            className="btn-clear-search"
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>

                                {/* Filter by Device Pills */}
                                <div className="replay-filter-pills">
                                    <button
                                        type="button"
                                        className={`filter-pill-sm ${replayDeviceFilter === 'all' ? 'is-active' : ''}`}
                                        onClick={() => setReplayDeviceFilter('all')}
                                    >
                                        All Devices
                                    </button>
                                    <button
                                        type="button"
                                        className={`filter-pill-sm ${replayDeviceFilter === 'mobile' ? 'is-active' : ''}`}
                                        onClick={() => setReplayDeviceFilter('mobile')}
                                    >
                                        <Smartphone size={11} />
                                        Mobile
                                    </button>
                                    <button
                                        type="button"
                                        className={`filter-pill-sm ${replayDeviceFilter === 'desktop' ? 'is-active' : ''}`}
                                        onClick={() => setReplayDeviceFilter('desktop')}
                                    >
                                        <Laptop size={11} />
                                        Desktop / Mac
                                    </button>
                                    <button
                                        type="button"
                                        className={`filter-pill-sm ${replayDeviceFilter === 'tablet' ? 'is-active' : ''}`}
                                        onClick={() => setReplayDeviceFilter('tablet')}
                                    >
                                        <Layers size={11} />
                                        Tablet
                                    </button>
                                </div>
                            </div>

                            {/* Scrollable User Replay Cards List */}
                            <div className="replays-list">
                                {filteredReplays.length === 0 ? (
                                    <div style={{ padding: '36px 16px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.45)' }}>
                                        <Video size={24} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                                        <p style={{ margin: 0, fontSize: '13px', fontWeight: 500 }}>No matching recordings</p>
                                        <p style={{ margin: '6px 0 0', fontSize: '11px', opacity: 0.7, lineHeight: 1.4 }}>
                                            {minEngagedSeconds > 0
                                                ? `No sessions recorded with duration ≥ ${minEngagedSeconds}s. Lower the duration slider above.`
                                                : 'Try selecting "All Devices" or clear the search query.'}
                                        </p>
                                    </div>
                                ) : (
                                    filteredReplays.map((rep) => {
                                        const isCurrent = activeReplay?.id === rep.id;
                                        const repDeviceType = rep.device?.type || 'desktop';
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
                                                    <span className="rep-device-tag">
                                                        {repDeviceType === 'mobile' ? <Smartphone size={11} /> : repDeviceType === 'tablet' ? <Layers size={11} /> : <Laptop size={11} />}
                                                        {rep.device?.label || (repDeviceType === 'mobile' ? 'Mobile' : 'Desktop')}
                                                    </span>
                                                    <span className="rep-duration">{formatDuration(rep.durationSeconds)}</span>
                                                </div>
                                                <p className="rep-label">{rep.conversionLabel}</p>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Replay Player Main Stage */}
                        <div className="replays-player-stage">
                            {activeReplay ? (
                                <div className="replay-player-container">
                                    {/* Virtual Browser Chrome with Auto-Detected Device Badge */}
                                    <div className="virtual-browser-header">
                                        <div className="browser-header-left">
                                            <div className="browser-dots">
                                                <span /><span /><span />
                                            </div>
                                            <div className="browser-url-bar">
                                                <ShieldCheck size={13} className="text-success" />
                                                <span>https://abodid.com{activeCurrentPage.path || '/'}</span>
                                            </div>
                                        </div>

                                        {/* Visitor Detected Device Badge */}
                                        <div className="browser-device-detected-badge">
                                            {activeReplay.device?.type === 'mobile' ? (
                                                <Smartphone size={13} className="text-accent" />
                                            ) : activeReplay.device?.type === 'tablet' ? (
                                                <Layers size={13} className="text-accent" />
                                            ) : (
                                                <Laptop size={13} className="text-accent" />
                                            )}
                                            <span>Browsed on: <strong>{activeReplay.device?.label || 'Desktop'}</strong></span>
                                        </div>
                                    </div>

                                    {/* Virtual Browser Viewport */}
                                    <div className="virtual-browser-viewport-wrapper">
                                        <div
                                            className={`virtual-browser-viewport ${activeReplay.device?.type === 'mobile' ? 'viewport-mobile' : activeReplay.device?.type === 'tablet' ? 'viewport-tablet' : 'viewport-desktop'}`}
                                        >
                                            {activeReplay.device?.type === 'mobile' && (
                                                <>
                                                    <div className="phone-dynamic-island" />
                                                    <div className="phone-home-indicator" />
                                                </>
                                            )}

                                            <iframe
                                                ref={iframeRef}
                                                src={activeCurrentPage.path || '/'}
                                                title="Visitor Session Browser"
                                                className="session-replay-iframe"
                                                sandbox="allow-same-origin allow-scripts"
                                            />

                                            {/* Simulated Cursor Stream */}
                                            <div
                                                className="simulated-cursor"
                                                style={{
                                                    top: `${Math.min(90, Math.max(10, (replayProgress * 1.4) % 85))}%`,
                                                    left: `${Math.min(85, Math.max(15, 30 + Math.sin(replayProgress / 5) * 35))}%`,
                                                }}
                                            >
                                                <MousePointer size={18} className="cursor-icon" />
                                                <div className="cursor-ripple" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Replay Scrubber & Controls */}
                                    <div className="replay-controls-bar">
                                        <button
                                            type="button"
                                            className="btn-play-pause"
                                            onClick={() => setIsPlaying(!isPlaying)}
                                        >
                                            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                                        </button>

                                        <div className="replay-timeline-scrubber">
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={replayProgress}
                                                onChange={(e) => {
                                                    setReplayProgress(Number(e.target.value));
                                                    setIsPlaying(false);
                                                }}
                                                className="scrubber-slider"
                                            />
                                            <div className="timeline-meta-row">
                                                <span>
                                                    {formatDuration(((activeReplay.durationSeconds || 120) * replayProgress) / 100)} / {formatDuration(activeReplay.durationSeconds || 120)}
                                                </span>
                                                <span>Page {currentPageIndex + 1} of {totalReplayPages.length || 1}</span>
                                            </div>
                                        </div>

                                        <div className="speed-buttons-group">
                                            {[1, 2, 4].map((spd) => (
                                                <button
                                                    key={spd}
                                                    type="button"
                                                    className={`btn-speed ${playbackSpeed === spd ? 'is-active' : ''}`}
                                                    onClick={() => setPlaybackSpeed(spd)}
                                                >
                                                    {spd}x
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="no-replay-selected">
                                    <Video size={36} style={{ opacity: 0.3, marginBottom: '12px' }} />
                                    <h4>No Session Selected</h4>
                                    <p>Select a visitor from the directory on the left to inspect their real browsing journey.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
