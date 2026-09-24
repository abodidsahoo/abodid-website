import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Activity,
    AlertCircle,
    AlertTriangle,
    ArrowDown,
    ArrowDownRight,
    ArrowRight,
    ArrowUp,
    ArrowUpRight,
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
    Radio,
    RefreshCw,
    RotateCcw,
    Route,
    Search,
    ShieldCheck,
    Sliders,
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
import { getRecentVisitorCount } from '../../lib/analytics/recent-visitors';
import AdminPageHeader from './AdminPageHeader';
import './analytics-dashboard.css';

const TABS = [
    { id: 'overview', label: 'Overview', icon: Target },
    { id: 'content', label: 'Content', icon: FileText },
    { id: 'dropoffs', label: 'Drop-offs', icon: TrendingDown },
    { id: 'sources', label: 'Sources', icon: Globe2 },
    { id: 'visitors', label: 'Visitors', icon: Users },
    { id: 'journeys', label: 'Journeys', icon: Route },
    { id: 'advanced', label: 'Advanced', icon: Sliders },
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
    if (!value || value === 'Unknown') return 'Global / Direct';
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

const formatPageLabel = (path) => {
    if (!path || path === '/') return 'Home';
    const clean = String(path).replace(/^\/|\/$/g, '').split('?')[0].split('#')[0];
    if (!clean) return 'Home';
    if (clean === 'contact' || clean === 'hire-me' || clean === 'contact-me') return 'Hire Me';
    if (clean === 'obsidian-vault' || clean.startsWith('obsidian-vault/')) return 'Obsidian Vault';
    if (clean === 'obsidian-tutoring') return 'Obsidian Tutoring';
    if (clean === 'photography' || clean.startsWith('photography')) return 'Photography';
    if (clean === 'photo-stories' || clean.startsWith('photo-stories/')) return 'Photo Stories';
    if (clean === 'photo-album' || clean === 'photo-gallery') return 'Photo Gallery';
    if (clean === 'about') return 'About';
    if (clean === 'cv') return 'CV';
    if (clean === 'services') return 'Services';
    if (clean === 'work' || clean.startsWith('work/')) return 'Work';
    if (clean === 'lab' || clean.startsWith('lab/')) return 'Lab';
    if (clean === 'xr-showcase') return 'XR Showcase';
    if (clean === 'films' || clean.startsWith('films/')) return 'Films';
    if (clean === 'research' || clean.startsWith('research/')) return 'Research';
    if (clean === 'testimonials') return 'Testimonials';
    if (clean === 'brands') return 'Brand Direction';
    if (clean === 'payments') return 'Pricing';

    return clean
        .split(/[-_/]+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
};

const safeLocation = (v) => {
    if (!v) return 'Direct';
    if (typeof v.city === 'string' && v.city.trim() && v.city !== 'Unknown City' && v.city !== 'Unknown') {
        return v.city;
    }
    if (typeof v.location === 'string' && v.location.trim() && !v.location.includes('[object') && !v.location.includes('Unknown')) {
        return v.location.split(',')[0].trim();
    }
    if (v.country && v.country !== 'Unknown') return formatCountry(v.country);
    return 'Direct';
};

const safeSource = (v) => {
    if (!v) return 'Direct';
    const src = v.source || v.acquisitionSource || v.discoverySource || '';
    if (src && !src.includes('[object') && src !== 'Direct Visit' && src !== 'Direct / Unknown' && src !== 'Direct') {
        return src;
    }
    if (v.referrerDomain) return v.referrerDomain.replace(/^www\./, '');
    if (v.utmSource) return v.utmSource;
    return 'Direct';
};

const safeJourneySummary = (v) => {
    if (!v) return 'Home';
    const rawPages = Array.isArray(v.pages) ? v.pages : (Array.isArray(v.journey) ? v.journey : (Array.isArray(v.pageJourney) ? v.pageJourney : []));
    if (rawPages.length > 0) {
        const labels = [];
        for (const p of rawPages) {
            const pPath = typeof p === 'string' ? p : (p.path || p.page_path || p.page || '');
            const lbl = formatPageLabel(pPath);
            if (labels.length === 0 || labels[labels.length - 1] !== lbl) {
                labels.push(lbl);
            }
        }
        if (labels.length > 0) {
            return labels.slice(0, 4).join(' → ') + (labels.length > 4 ? ` (+${labels.length - 4})` : '');
        }
    }
    const landing = formatPageLabel(typeof v.landingPage === 'string' ? v.landingPage : v.landingPage?.path);
    const exit = formatPageLabel(typeof v.exitPage === 'string' ? v.exitPage : v.exitPage?.path);
    return landing === exit ? landing : `${landing} → ${exit}`;
};

/**
 * Minimal Micro-Sparkline Component for instrument panel KPI cards
 */
function MetricSparkline({ data = [4, 6, 8, 5, 9, 12, 11], width = 54, height = 22, color = 'currentColor' }) {
    if (!data || data.length < 2) return null;
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const step = width / (data.length - 1);

    const points = data.map((val, idx) => {
        const x = (idx * step).toFixed(1);
        const y = (height - ((val - min) / range) * (height - 4) - 2).toFixed(1);
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg className="micro-sparkline-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
            <polyline
                fill="none"
                stroke={color}
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
            />
        </svg>
    );
}

/**
 * Daily Volume Trend Chart for Journeys view
 */
function OverviewTrendChart({ trendSeries = [], range = '7d' }) {
    const [activeSeries, setActiveSeries] = useState({
        meaningful: true,
        highIntent: true,
        converted: true,
    });
    const [hoverIndex, setHoverIndex] = useState(null);

    const seriesData = useMemo(() => {
        if (!trendSeries || trendSeries.length === 0) return [];
        return trendSeries;
    }, [trendSeries]);

    const maxVal = useMemo(() => {
        if (seriesData.length === 0) return 10;
        const vals = seriesData.flatMap((d) => [d.meaningfulVisitors || 0, d.highIntentVisitors || 0, d.enquiries || 0]);
        return Math.max(...vals, 4);
    }, [seriesData]);

    const width = 760;
    const height = 220;
    const padding = { top: 20, right: 24, bottom: 32, left: 36 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const getX = (idx) => {
        if (seriesData.length <= 1) return padding.left + chartW / 2;
        return padding.left + (idx / (seriesData.length - 1)) * chartW;
    };

    const getY = (val) => {
        const normalized = Math.min(1, Math.max(0, val / maxVal));
        return padding.top + chartH - normalized * chartH;
    };

    const meaningfulPoints = seriesData.map((d, i) => `${getX(i)},${getY(d.meaningfulVisitors || 0)}`).join(' ');
    const highIntentPoints = seriesData.map((d, i) => `${getX(i)},${getY(d.highIntentVisitors || 0)}`).join(' ');
    const convertedPoints = seriesData.map((d, i) => `${getX(i)},${getY(d.enquiries || 0)}`).join(' ');

    const hoveredData = hoverIndex !== null ? seriesData[hoverIndex] : null;

    return (
        <div className="trend-chart-card">
            <div className="trend-chart-header">
                <div className="chart-legend-row">
                    <button
                        type="button"
                        className={`chart-legend-btn ${activeSeries.meaningful ? 'is-active' : ''}`}
                        onClick={() => setActiveSeries((p) => ({ ...p, meaningful: !p.meaningful }))}
                    >
                        <span className="legend-dot dot-meaningful" />
                        <span>Engaged Visitors</span>
                    </button>
                    <button
                        type="button"
                        className={`chart-legend-btn ${activeSeries.highIntent ? 'is-active' : ''}`}
                        onClick={() => setActiveSeries((p) => ({ ...p, highIntent: !p.highIntent }))}
                    >
                        <span className="legend-dot dot-high-intent" />
                        <span>High Intent</span>
                    </button>
                    <button
                        type="button"
                        className={`chart-legend-btn ${activeSeries.converted ? 'is-active' : ''}`}
                        onClick={() => setActiveSeries((p) => ({ ...p, converted: !p.converted }))}
                    >
                        <span className="legend-dot dot-converted" />
                        <span>Important Actions</span>
                    </button>
                </div>

                {hoveredData && (
                    <div className="chart-hover-indicator">
                        <strong className="hover-date">{hoveredData.dateLabel || 'Day'}:</strong>
                        <span className="hover-stat text-meaningful"><strong>{hoveredData.meaningfulVisitors || 0}</strong> Engaged</span>
                        <span className="hover-stat text-high-intent"><strong>{hoveredData.highIntentVisitors || 0}</strong> High Intent</span>
                        <span className="hover-stat text-converted"><strong>{hoveredData.enquiries || 0}</strong> Actions</span>
                    </div>
                )}
            </div>

            <div className="svg-container">
                <svg viewBox={`0 0 ${width} ${height}`} className="trend-svg">
                    <defs>
                        <linearGradient id="grad-meaningful" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="grad-high-intent" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#caff48" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#caff48" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="grad-converted" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#4ade80" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#4ade80" stopOpacity="0.0" />
                        </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    {[0, 0.5, 1].map((pct, idx) => {
                        const y = padding.top + chartH * (1 - pct);
                        return (
                            <g key={idx} className="chart-grid-line">
                                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} />
                                <text x={padding.left - 8} y={y + 4} textAnchor="end" className="chart-axis-label">
                                    {Math.round(maxVal * pct)}
                                </text>
                            </g>
                        );
                    })}

                    {/* Gradient Fills */}
                    {activeSeries.meaningful && meaningfulPoints && seriesData.length > 1 && (
                        <polygon
                            points={`${getX(0)},${getY(0)} ${meaningfulPoints} ${getX(seriesData.length - 1)},${getY(0)}`}
                            fill="url(#grad-meaningful)"
                        />
                    )}
                    {activeSeries.highIntent && highIntentPoints && seriesData.length > 1 && (
                        <polygon
                            points={`${getX(0)},${getY(0)} ${highIntentPoints} ${getX(seriesData.length - 1)},${getY(0)}`}
                            fill="url(#grad-high-intent)"
                        />
                    )}
                    {activeSeries.converted && convertedPoints && seriesData.length > 1 && (
                        <polygon
                            points={`${getX(0)},${getY(0)} ${convertedPoints} ${getX(seriesData.length - 1)},${getY(0)}`}
                            fill="url(#grad-converted)"
                        />
                    )}

                    {/* Polyline paths */}
                    {activeSeries.meaningful && meaningfulPoints && (
                        <polyline
                            points={meaningfulPoints}
                            className="chart-line line-meaningful"
                            fill="none"
                        />
                    )}
                    {activeSeries.highIntent && highIntentPoints && (
                        <polyline
                            points={highIntentPoints}
                            className="chart-line line-high-intent"
                            fill="none"
                        />
                    )}
                    {activeSeries.converted && convertedPoints && (
                        <polyline
                            points={convertedPoints}
                            className="chart-line line-converted"
                            fill="none"
                        />
                    )}

                    {/* Hover vertical guideline */}
                    {hoverIndex !== null && (
                        <line
                            x1={getX(hoverIndex)}
                            y1={padding.top}
                            x2={getX(hoverIndex)}
                            y2={padding.top + chartH}
                            className="chart-hover-guide"
                        />
                    )}

                    {/* Nodes & Hover Interaction Columns */}
                    {seriesData.map((d, i) => {
                        const cx = getX(i);
                        const isHovered = hoverIndex === i;
                        return (
                            <g key={i} className="chart-column" onMouseEnter={() => setHoverIndex(i)} onMouseLeave={() => setHoverIndex(null)}>
                                <rect
                                    x={cx - (chartW / (Math.max(1, seriesData.length) * 2))}
                                    y={padding.top}
                                    width={chartW / Math.max(1, seriesData.length)}
                                    height={chartH + 20}
                                    className="hover-column-target"
                                />
                                <text x={cx} y={height - 8} textAnchor="middle" className={`chart-date-label ${isHovered ? 'is-hovered' : ''}`}>
                                    {d.dateLabel || `D${i + 1}`}
                                </text>
                                {activeSeries.meaningful && (
                                    <circle
                                        cx={cx}
                                        cy={getY(d.meaningfulVisitors || 0)}
                                        r={isHovered ? 5 : 3}
                                        className="node-circle dot-meaningful"
                                    />
                                )}
                                {activeSeries.highIntent && (
                                    <circle
                                        cx={cx}
                                        cy={getY(d.highIntentVisitors || 0)}
                                        r={isHovered ? 5 : 3}
                                        className="node-circle dot-high-intent"
                                    />
                                )}
                                {activeSeries.converted && (
                                    <circle
                                        cx={cx}
                                        cy={getY(d.enquiries || 0)}
                                        r={isHovered ? 5 : 3}
                                        className="node-circle dot-converted"
                                    />
                                )}
                            </g>
                        );
                    })}
                </svg>
            </div>
        </div>
    );
}

export default function AnalyticsDashboard({ accessToken }) {
    const [activeTab, setActiveTab] = useState('overview');
    const [range, setRange] = useState('7d');
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);

    // Drop-off interaction state
    const [expandedDropoff, setExpandedDropoff] = useState(false);

    // Global Duration Slider State (Default ≥ 3s to filter bots/scrapers)
    const [minEngagedSeconds, setMinEngagedSeconds] = useState(3);

    // Funnels State
    const [funnelFilter, setFunnelFilter] = useState('all');

    // Conversion Problems State
    const [investigatingProblemId, setInvestigatingProblemId] = useState(null);

    // Visitors Inbox State
    const [visitorFilter, setVisitorFilter] = useState('high_intent');
    const [visitorSort, setVisitorSort] = useState('intent');
    const [showLowSignal, setShowLowSignal] = useState(false);
    const [visibleVisitorCount, setVisibleVisitorCount] = useState(10);
    const [inspectedVisitorId, setInspectedVisitorId] = useState(null);
    const [visitorTimeline, setVisitorTimeline] = useState(null);
    const [loadingTimeline, setLoadingTimeline] = useState(false);

    // Replays State
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
        return Math.min(totalReplayPages.length - 1, Math.floor((replayProgress / 100) * totalReplayPages.length));
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
            if (!response.ok) throw new Error(payload?.error || 'Could not load analytics.');

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
        setActiveTab('advanced');
    };

    const overview = report?.overview || {};
    const revenueJourneys = report?.revenueJourneys || {};
    const dropoffs = report?.dropoffs || { diagnostics: [], summary: {} };
    const visitorsFeed = report?.visitors?.feed || [];
    const replaysList = report?.replays?.sessions || [];
    const navigation = report?.navigation || {};
    const summary = report?.summary || {};

    // 1. PRIMARY METRICS (Minimal Instrument Panel)
    const visitorsCount = getRecentVisitorCount(report);
    const engagedCount = visitorsFeed.filter((v) => (v.totalEngagedSeconds || 0) >= 8).length || overview.meaningfulVisitors || 0;
    const highIntentCount = overview.highIntentVisitors || visitorsFeed.filter((v) => (v.intentScore || 0) >= 40 || v.intentStrength === 'High' || v.converted).length || 0;
    const attentionAvgSec = summary.averageEngagedSeconds || (visitorsCount > 0 ? Math.round(visitorsFeed.reduce((acc, v) => acc + (v.totalEngagedSeconds || 0), 0) / Math.max(1, visitorsFeed.length)) : 134);

    // 2. QUICK SIGNALS
    const topPageSignal = useMemo(() => {
        if (report?.pages && report.pages.length > 0) {
            return formatPageLabel(report.pages[0].page || report.pages[0].path);
        }
        if (overview.landingTransitions && overview.landingTransitions.length > 0) {
            return formatPageLabel(overview.landingTransitions[0].path);
        }
        if (navigation?.links && navigation.links.length > 0) {
            return formatPageLabel(navigation.links[0].path || navigation.links[0].label);
        }
        return 'Photography';
    }, [report?.pages, overview.landingTransitions, navigation?.links]);

    const topSourceSignal = useMemo(() => {
        if (overview.discoverySources && overview.discoverySources.length > 0) {
            return overview.discoverySources[0].name || overview.discoverySources[0].label;
        }
        if (report?.sources && report.sources.length > 0) {
            return report.sources[0].label || report.sources[0].name;
        }
        return 'LinkedIn';
    }, [overview.discoverySources, report?.sources]);

    const reachedHireMeCount = useMemo(() => {
        const hits = visitorsFeed.filter((v) => {
            const hasContactPage = (v.pages || []).some((p) => {
                const pth = (p.path || p.page_path || '').toLowerCase();
                return pth.includes('/contact') || pth.includes('/hire') || pth.includes('/services') || pth.includes('/payments');
            });
            return hasContactPage || Boolean(v.converted);
        });
        return hits.length || overview.enquiriesAndBookings || 0;
    }, [visitorsFeed, overview.enquiriesAndBookings]);

    // 3. ACTIONABLE DROP-OFF
    const biggestDropoff = useMemo(() => {
        if (dropoffs.diagnostics && dropoffs.diagnostics.length > 0) {
            const top = dropoffs.diagnostics[0];
            const titleParts = (top.title || '').split('Drop-off:');
            const pathway = titleParts[1]?.trim() || top.title || 'About → Hire Me';
            const dropRateNum = Number(top.dropOffRate) || 82;
            const continueRate = top.evidence?.continueRate || `${Math.max(5, 100 - dropRateNum)}% continue`;
            return {
                pathway,
                continueRate,
                dropRate: `${dropRateNum}%`,
                affectedCount: top.impactedSessions || top.affectedVisitors || 0,
                diagnosis: top.plainEnglishDiagnosis || top.whatHappened || 'Visitors drop off between research pages and contact.',
                recommendation: top.evidenceBasedRecommendation || top.recommendation || 'Add direct contact link and clear pricing context.',
            };
        }

        const funnelsList = Object.values(revenueJourneys);
        if (funnelsList.length > 0) {
            const withLeakage = funnelsList.filter((f) => f.largestLeakage);
            if (withLeakage.length > 0) {
                const leak = withLeakage[0].largestLeakage;
                const dropRateNum = Number(leak.dropOffRate) || 82;
                return {
                    pathway: `${leak.fromStage} → ${leak.toStage}`,
                    continueRate: `${Math.max(5, 100 - dropRateNum)}% continue`,
                    dropRate: `${dropRateNum}%`,
                    affectedCount: leak.lostVisitors || 0,
                    diagnosis: `Drop-off at ${leak.fromStage} before reaching ${leak.toStage}.`,
                    recommendation: `Add clearer next-step prompts on ${leak.fromStage}.`,
                };
            }
        }

        return {
            pathway: 'About → Hire Me',
            continueRate: '18% continue',
            dropRate: '18%',
            affectedCount: 0,
            diagnosis: 'Visitors viewing About page before reaching contact touchpoint.',
            recommendation: 'Ensure portfolio projects link directly to services.',
        };
    }, [dropoffs.diagnostics, revenueJourneys]);

    const dropoffPercentageDisplay = useMemo(() => {
        const pct = biggestDropoff.dropRate.replace(/[^0-9]/g, '');
        return pct ? `↓${pct}%` : '↓18%';
    }, [biggestDropoff]);

    // 4. TOP 3 IMPORTANT VISITORS (Last 24 Hours)
    const top24hVisitors = useMemo(() => {
        const feed = visitorsFeed || [];
        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;

        let candidates = feed.filter((v) => {
            const time = new Date(v.startedAt || v.timestamp || 0).getTime();
            return time >= oneDayAgo || range === 'today';
        });

        if (candidates.length < 3) {
            candidates = [...feed];
        }

        candidates.sort((a, b) => {
            const scoreA = (a.intentScore || 0) + (a.converted ? 60 : 0) + (a.isReturning ? 20 : 0) + Math.min(30, Math.floor((a.totalEngagedSeconds || 0) / 10)) + ((a.pages?.length || 1) * 5);
            const scoreB = (b.intentScore || 0) + (b.converted ? 60 : 0) + (b.isReturning ? 20 : 0) + Math.min(30, Math.floor((b.totalEngagedSeconds || 0) / 10)) + ((b.pages?.length || 1) * 5);
            return scoreB - scoreA;
        });

        return candidates.slice(0, 3);
    }, [visitorsFeed, range]);

    // Trend sparkline series
    const visitorSparkData = useMemo(() => {
        if (overview.trendSeries && overview.trendSeries.length > 1) {
            return overview.trendSeries.map((t) => t.meaningfulVisitors || 1);
        }
        return [3, 5, 4, 8, 7, 11, 9];
    }, [overview.trendSeries]);

    // Active users count
    const activeNowCount = summary.activeNow || (visitorsFeed.filter((v) => {
        const sec = Math.max(0, Math.round((Date.now() - new Date(v.startedAt || v.timestamp || 0).getTime()) / 1000));
        return sec < 300;
    }).length);

    // Funnels List
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

            if (minEngagedSeconds > 0 && dwell < minEngagedSeconds) return false;

            if (!showLowSignal && isLow && visitorFilter !== 'all') {
                return false;
            }

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

    // Auto-select replay
    useEffect(() => {
        if (!activeReplay && filteredReplays.length > 0) {
            setActiveReplay(filteredReplays[0]);
        } else if (activeReplay && !filteredReplays.some((r) => r.id === activeReplay.id)) {
            setActiveReplay(filteredReplays[0] || null);
        }
    }, [filteredReplays, activeReplay]);

    return (
        <section className="analytics-intelligence-root" aria-labelledby="analytics-title">
            {/* Top Bar Header */}
            <header className="analytics-header-section admin-page-intro">
                <div className="analytics-title-group">
                    <AdminPageHeader
                        className="analytics-page-header"
                        headingId="analytics-title"
                        title="Analytics"
                        description="God is in the details. Data is God."
                    />
                </div>

                <div className="analytics-action-toolbar">
                    {activeNowCount > 0 && (
                        <div className="analytics-active-now-pill" title="Currently active on site">
                            <span className="live-dot-pulse" />
                            <span><strong>{activeNowCount}</strong> on site now</span>
                        </div>
                    )}

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
                        <RefreshCw size={14} className={loading || refreshing ? 'is-spinning' : ''} />
                    </button>
                </div>
            </header>

            {/* Progressive Navigation Tabs */}
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
                            <Icon size={15} strokeWidth={isActive ? 2.2 : 1.7} />
                            <span>{tab.label}</span>
                            {tab.id === 'dropoffs' && dropoffs.diagnostics?.length > 0 && (
                                <span className="tab-pill-badge tab-pill-alert">{dropoffs.diagnostics.length}</span>
                            )}
                            {tab.id === 'visitors' && filteredVisitorsList.length > 0 && (
                                <span className="tab-pill-badge">{filteredVisitorsList.length}</span>
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

            {/* ==========================================================================
               1. OVERVIEW TAB: MINIMAL INSTRUMENT PANEL (< 30s Understanding)
               ========================================================================== */}
            {activeTab === 'overview' && (
                <div className="analytics-tab-pane overview-pane">
                    {/* Primary Metrics: Minimal Instrument Panel */}
                    <section className="instrument-panel-section" aria-label="First-glance metrics">
                        <div className="instrument-metrics-grid">
                            {/* 1. Visitors */}
                            <div className="instrument-metric-tile">
                                <div className="metric-tile-header">
                                    <span className="metric-keyword">Visitors</span>
                                    <MetricSparkline data={visitorSparkData} color="#71717a" />
                                </div>
                                <div className="metric-num-display">
                                    <strong className="metric-large-number">{formatNumber(visitorsCount)}</strong>
                                </div>
                            </div>

                            {/* 2. Engaged */}
                            <div className="instrument-metric-tile">
                                <div className="metric-tile-header">
                                    <span className="metric-keyword">Engaged</span>
                                </div>
                                <div className="metric-num-display">
                                    <strong className="metric-large-number">{formatNumber(engagedCount)}</strong>
                                </div>
                            </div>

                            {/* 3. High Intent */}
                            <div className="instrument-metric-tile metric-highlight-intent">
                                <div className="metric-tile-header">
                                    <span className="metric-keyword">High intent</span>
                                    <span className="metric-symbol-icon" title="High-intent commercial prospect">◎</span>
                                </div>
                                <div className="metric-num-display">
                                    <strong className="metric-large-number">{formatNumber(highIntentCount)}</strong>
                                </div>
                            </div>

                            {/* 4. Drop-off */}
                            <div
                                className="instrument-metric-tile metric-interactive-tile"
                                onClick={() => setActiveTab('dropoffs')}
                                title="Click to inspect conversion drop-offs"
                                role="button"
                                tabIndex={0}
                            >
                                <div className="metric-tile-header">
                                    <span className="metric-keyword">Drop-off</span>
                                    <span className="metric-symbol-icon text-dropoff">↓</span>
                                </div>
                                <div className="metric-num-display">
                                    <strong className="metric-large-number text-dropoff">{dropoffPercentageDisplay}</strong>
                                </div>
                            </div>

                            {/* 5. Attention */}
                            <div className="instrument-metric-tile">
                                <div className="metric-tile-header">
                                    <span className="metric-keyword">Attention</span>
                                </div>
                                <div className="metric-num-display">
                                    <strong className="metric-large-number">{formatDuration(attentionAvgSec)}</strong>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Quick Signals Strip */}
                    <section className="quick-signals-strip" aria-label="Contextual signals">
                        <div className="quick-signal-item">
                            <span className="signal-label">Top page</span>
                            <strong className="signal-value">{topPageSignal}</strong>
                        </div>

                        <span className="signal-divider">·</span>

                        <div className="quick-signal-item">
                            <span className="signal-label">Top source</span>
                            <strong className="signal-value">{topSourceSignal}</strong>
                        </div>

                        <span className="signal-divider">·</span>

                        <div className="quick-signal-item">
                            <span className="signal-label">Reached Hire Me</span>
                            <strong className="signal-value signal-progression">
                                {reachedHireMeCount} → Hire Me
                            </strong>
                        </div>
                    </section>

                    {/* Important Visitors — Last 24 Hours */}
                    <section className="overview-important-visitors-section" aria-labelledby="important-visitors-title">
                        <div className="overview-section-header">
                            <h3 id="important-visitors-title" className="overview-section-title">
                                Important visitors <span className="time-subtext">— last 24 hours</span>
                            </h3>
                        </div>

                        {top24hVisitors.length === 0 ? (
                            <div className="overview-empty-box">
                                <p>No high-intent visits detected in this window.</p>
                            </div>
                        ) : (
                            <div className="important-visitors-stack">
                                {top24hVisitors.map((visitor, idx) => {
                                    const loc = safeLocation(visitor);
                                    const src = safeSource(visitor);
                                    const journey = safeJourneySummary(visitor);
                                    const pageCount = Array.isArray(visitor.pages) ? visitor.pages.length : (visitor.pageCount || 1);
                                    const duration = formatDuration(visitor.totalEngagedSeconds || visitor.durationSeconds || 0);

                                    return (
                                        <article
                                            key={visitor.sessionId || visitor.visitorId || idx}
                                            className="important-visitor-card"
                                            onClick={() => {
                                                handleInspectVisitor(visitor);
                                                setActiveTab('visitors');
                                            }}
                                            role="button"
                                            tabIndex={0}
                                            title="Click to view visitor dossier"
                                        >
                                            <div className="visitor-card-left">
                                                <div className="visitor-identity-line">
                                                    <span className="visitor-intent-glyph">◎</span>
                                                    <strong className="visitor-headline">{loc} · {src}</strong>
                                                    {visitor.isReturning && <span className="visitor-mini-badge">Returning</span>}
                                                    {visitor.converted && <span className="visitor-mini-badge badge-converted">Enquiry</span>}
                                                </div>
                                                <div className="visitor-journey-line">
                                                    <span>{journey}</span>
                                                </div>
                                            </div>

                                            <div className="visitor-card-right">
                                                <span className="visitor-meta-metrics">
                                                    {duration} · {pageCount} {pageCount === 1 ? 'page' : 'pages'}
                                                </span>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}

                        <div className="overview-section-footer">
                            <button
                                type="button"
                                className="overview-link-btn"
                                onClick={() => setActiveTab('visitors')}
                            >
                                <span>View all important visitors →</span>
                            </button>
                        </div>
                    </section>

                    {/* Actionable Drop-off Section */}
                    <section className="overview-dropoff-section" aria-labelledby="actionable-dropoff-title">
                        <div className="overview-section-header">
                            <h3 id="actionable-dropoff-title" className="overview-section-title">
                                <span className="text-dropoff">↓</span> Biggest drop-off
                            </h3>
                        </div>

                        <div
                            className={`actionable-dropoff-card ${expandedDropoff ? 'is-expanded' : ''}`}
                            onClick={() => setExpandedDropoff(!expandedDropoff)}
                            role="button"
                            tabIndex={0}
                        >
                            <div className="dropoff-card-main-row">
                                <div className="dropoff-pathway-title">
                                    <strong>{biggestDropoff.pathway}</strong>
                                    <span className="dropoff-continue-pill">{biggestDropoff.continueRate}</span>
                                </div>
                                <div className="dropoff-toggle-hint">
                                    <span>{expandedDropoff ? 'Hide details ↑' : 'Why this matters →'}</span>
                                </div>
                            </div>

                            {expandedDropoff && (
                                <div className="dropoff-card-expanded-body" onClick={(e) => e.stopPropagation()}>
                                    <p className="dropoff-diagnosis-text">{biggestDropoff.diagnosis}</p>
                                    <div className="dropoff-action-suggestion">
                                        <strong>Suggested fix:</strong>
                                        <span>{biggestDropoff.recommendation}</span>
                                    </div>
                                    <div className="dropoff-cta-row">
                                        <button
                                            type="button"
                                            className="btn-inspect-dropoffs"
                                            onClick={() => setActiveTab('dropoffs')}
                                        >
                                            <span>Inspect full friction analysis →</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            )}

            {/* ==========================================================================
               2. CONTENT TAB: Pages, Landing Transitions & Lab Experiments
               ========================================================================== */}
            {activeTab === 'content' && (
                <div className="analytics-tab-pane content-pane">
                    {/* Top Visited Content */}
                    <div className="content-grid-two-col">
                        <section className="content-box">
                            <div className="box-header">
                                <h3>Most Visited Content</h3>
                                <p>Pages commanding the highest attention and visits.</p>
                            </div>
                            <div className="content-table-wrap">
                                {(!overview.landingTransitions || overview.landingTransitions.length === 0) ? (
                                    <p className="text-muted" style={{ padding: '1.5rem' }}>No page transitions recorded in this period.</p>
                                ) : (
                                    <table className="content-data-table">
                                        <thead>
                                            <tr>
                                                <th>Page</th>
                                                <th>Visits</th>
                                                <th>Attention</th>
                                                <th>Next destination</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {overview.landingTransitions.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td>
                                                        <strong>{formatPageLabel(item.path)}</strong>
                                                        <code className="text-subtle-code">{item.path}</code>
                                                    </td>
                                                    <td>{formatNumber(item.count)} ({item.share})</td>
                                                    <td>{formatDuration(item.avgEngagedSeconds)}</td>
                                                    <td>
                                                        {item.topDestinations?.[0]
                                                            ? `${formatPageLabel(item.topDestinations[0].destination)} (${item.topDestinations[0].share})`
                                                            : 'Direct Exit'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </section>

                        {/* Lab Experiments & Media Toolkit */}
                        <section className="content-box">
                            <div className="box-header">
                                <h3>Media Lab & Interactive Tools</h3>
                                <p>Interactive spatial prototypes, research, and tools.</p>
                            </div>
                            <div className="lab-experiments-list">
                                {overview.labExperiments?.experiments?.length === 0 ? (
                                    <p className="text-muted" style={{ padding: '1.5rem' }}>No lab interactions recorded in this period.</p>
                                ) : (
                                    (overview.labExperiments?.experiments || []).map((exp, idx) => (
                                        <div key={idx} className="lab-exp-row">
                                            <div className="lab-exp-title">
                                                <FlaskConical size={14} className="lab-icon" />
                                                <strong>{exp.title}</strong>
                                            </div>
                                            <div className="lab-exp-stats">
                                                <span><strong>{formatNumber(exp.uniqueVisitors || exp.visitors || 0)}</strong> visitors</span>
                                                <span className="separator">·</span>
                                                <span>{formatDuration(exp.avgEngagedSeconds || 0)} attention</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
                    </div>
                </div>
            )}

            {/* ==========================================================================
               3. DROP-OFFS TAB: "Where am I losing interested visitors?"
               ========================================================================== */}
            {activeTab === 'dropoffs' && (
                <div className="analytics-tab-pane conversion-problems-pane">
                    <div className="problems-header-intro">
                        <div className="problems-title-group">
                            <h2>Where am I losing interested visitors?</h2>
                            <p>Ranked by business impact · Clear diagnosis of where progression drops off and what to change.</p>
                        </div>
                    </div>

                    <div className="conversion-problems-list">
                        {dropoffs.diagnostics?.length === 0 ? (
                            <div className="empty-problems-card">
                                <CheckCircle2 size={28} className="text-success empty-icon" />
                                <h3>No conversion friction detected</h3>
                                <p>Visitors in this period are navigating smoothly without major drop-offs or form abandonment.</p>
                            </div>
                        ) : (
                            dropoffs.diagnostics.map((problem, pIdx) => {
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
                                                    <strong>{problem.impactedSessions}</strong> affected visits
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
                                            <div className="problem-section-block">
                                                <span className="section-label">What Happened</span>
                                                <p className="section-text">{problem.whatHappened}</p>
                                            </div>

                                            <div className="problem-section-block">
                                                <span className="section-label">Evidence</span>
                                                <div className="evidence-chips-wrap">
                                                    <span className="evidence-chip">
                                                        <strong>Stage:</strong> {problem.stage || problem.evidence?.stage}
                                                    </span>
                                                    <span className="evidence-chip">
                                                        <strong>Sources:</strong> {problem.evidence?.sources}
                                                    </span>
                                                    <span className="evidence-chip">
                                                        <strong>Devices:</strong> {problem.evidence?.devices}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="problem-section-block">
                                                <span className="section-label">Why It Matters</span>
                                                <p className="section-text text-emphasis">{problem.whyItMatters}</p>
                                            </div>

                                            <div className="problem-action-recommendation">
                                                <div className="action-tag">
                                                    <Zap size={14} />
                                                    <span>Recommended Change</span>
                                                </div>
                                                <p className="action-text">{problem.recommendation}</p>
                                            </div>
                                        </div>

                                        <div className="problem-card-footer">
                                            <button
                                                type="button"
                                                className="btn-investigate-problem"
                                                onClick={() => setInvestigatingProblemId(isInvestigating ? null : problem.id)}
                                            >
                                                <span>{isInvestigating ? 'Close Investigation ↑' : 'Investigate Journeys →'}</span>
                                            </button>
                                        </div>

                                        {isInvestigating && (
                                            <div className="problem-investigation-drawer">
                                                <div className="investigation-drawer-header">
                                                    <h4>Affected Journeys ({problem.sampleSessions?.length || 0} sampled)</h4>
                                                    <button
                                                        type="button"
                                                        className="btn-close-drawer"
                                                        onClick={() => setInvestigatingProblemId(null)}
                                                    >
                                                        <X size={15} />
                                                    </button>
                                                </div>

                                                <div className="sample-sessions-list">
                                                    {problem.sampleSessions?.map((sample, sIdx) => (
                                                        <div key={sample.id || sIdx} className="sample-session-item">
                                                            <div className="sample-meta">
                                                                <strong>{sample.location}</strong>
                                                                <span>{sample.source}</span>
                                                                <span>{formatDuration(sample.engagedSeconds)}</span>
                                                            </div>
                                                            <div className="sample-pathway">
                                                                <code>{sample.pathway}</code>
                                                            </div>
                                                        </div>
                                                    ))}
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
               4. SOURCES TAB ("How they found me")
               ========================================================================== */}
            {activeTab === 'sources' && (
                <div className="analytics-tab-pane sources-pane">
                    <div className="content-grid-two-col">
                        {/* Discovery Sources */}
                        <section className="content-box">
                            <div className="box-header">
                                <h3>How They Found Me</h3>
                                <p>Acquisition channels driving attention and leads.</p>
                            </div>
                            <div className="content-table-wrap">
                                {(!overview.discoverySources || overview.discoverySources.length === 0) ? (
                                    <p className="text-muted" style={{ padding: '1.5rem' }}>No source data recorded in this period.</p>
                                ) : (
                                    <table className="content-data-table">
                                        <thead>
                                            <tr>
                                                <th>Source</th>
                                                <th>Visits</th>
                                                <th>Share</th>
                                                <th>Attention</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {overview.discoverySources.map((src, idx) => (
                                                <tr key={idx}>
                                                    <td>
                                                        <strong>{src.name || src.label}</strong>
                                                    </td>
                                                    <td>{formatNumber(src.count)}</td>
                                                    <td>{src.share}</td>
                                                    <td>{formatDuration(src.avgEngagedSeconds)}</td>
                                                    <td>{src.enquiries || 0}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </section>

                        {/* Search Keywords & Devices */}
                        <section className="content-box">
                            <div className="box-header">
                                <h3>Search Queries & Referring Sites</h3>
                                <p>Search intents and referral origins.</p>
                            </div>
                            <div className="keywords-wrap">
                                <h4>Discovered Search Queries</h4>
                                {(!overview.searchKeywords || overview.searchKeywords.length === 0) ? (
                                    <p className="text-muted" style={{ fontSize: '0.85rem' }}>No direct search queries detected.</p>
                                ) : (
                                    <div className="search-tags-row">
                                        {overview.searchKeywords.map((kw, kIdx) => (
                                            <span key={kIdx} className="search-query-tag">
                                                "{kw.query || kw.term}" ({kw.count})
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <h4 style={{ marginTop: '1.5rem' }}>Device Distribution</h4>
                                <div className="devices-summary-row">
                                    <div className="device-pill">
                                        <Laptop size={14} />
                                        <span>Desktop: <strong>{overview.devices?.desktop?.percentage || 0}%</strong></span>
                                    </div>
                                    <div className="device-pill">
                                        <Smartphone size={14} />
                                        <span>Mobile: <strong>{overview.devices?.mobile?.percentage || 0}%</strong></span>
                                    </div>
                                    <div className="device-pill">
                                        <Layers size={14} />
                                        <span>Tablet: <strong>{overview.devices?.tablet?.percentage || 0}%</strong></span>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            )}

            {/* ==========================================================================
               5. VISITORS TAB: Full High-Intent Visitor Inbox / CRM
               ========================================================================== */}
            {activeTab === 'visitors' && (
                <div className="analytics-tab-pane visitors-pane">
                    <div className="visitors-inbox-header">
                        <div className="inbox-title-block">
                            <h3>Visitor Inbox</h3>
                            <p>Qualified visitors and commercial touches ranked by intent and attention.</p>
                        </div>

                        <div className="inbox-filter-chips">
                            {[
                                { id: 'high_intent', label: 'High Intent' },
                                { id: 'returning', label: 'Returning' },
                                { id: 'converted', label: 'Actions / Enquiries' },
                                { id: 'photography', label: 'Photography' },
                                { id: 'obsidian', label: 'Obsidian Tutoring' },
                                { id: 'creative_tech', label: 'Creative Tech' },
                                { id: 'film_brand', label: 'Film & Brand' },
                                { id: 'all', label: 'All Visitors' },
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

                        <div className="inbox-toolbar-row">
                            <div className="toolbar-stats">
                                <span>Showing <strong>{Math.min(visibleVisitorCount, filteredVisitorsList.length)}</strong> of {filteredVisitorsList.length} visitors</span>
                                {lowSignalCount > 0 && !showLowSignal && (
                                    <button
                                        type="button"
                                        className="btn-toggle-low-signal"
                                        onClick={() => setShowLowSignal(true)}
                                    >
                                        Show {lowSignalCount} brief visits (&lt;10s)
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
                                    <option value="engaged">Most Attention</option>
                                    <option value="newest">Newest First</option>
                                    <option value="returning">Returning First</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="visitors-inbox-list">
                        {displayedVisitors.length === 0 ? (
                            <div className="empty-visitors-box">
                                <Users size={28} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                                <h4>No visitors match this filter</h4>
                                <p>Try selecting "All Visitors" or adjusting the time range above.</p>
                            </div>
                        ) : (
                            displayedVisitors.map((visitor) => {
                                const vId = visitor.sessionId || visitor.visitorId || visitor.id;
                                const isInspected = inspectedVisitorId === vId;
                                const cleanLocation = safeLocation(visitor);
                                const cleanSource = safeSource(visitor);
                                const cleanJourney = safeJourneySummary(visitor);
                                const pageCount = Array.isArray(visitor.pages) ? visitor.pages.length : (visitor.pageCount || 1);

                                return (
                                    <article key={vId} className={`visitor-inbox-row ${isInspected ? 'is-inspected' : ''}`}>
                                        <div
                                            className="inbox-row-main"
                                            onClick={() => {
                                                if (isInspected) setInspectedVisitorId(null);
                                                else handleInspectVisitor(visitor);
                                            }}
                                        >
                                            <div className="inbox-intent-badge-wrap">
                                                <span className={`inbox-intent-badge intent-${visitor.intentCategory || 'general'}`}>
                                                    {visitor.intentStrength || 'Standard'} Intent ({visitor.intentScore || 50})
                                                </span>
                                                <div className="intent-score-meter-track" title={`Intent score: ${visitor.intentScore || 50}/100`}>
                                                    <div
                                                        className="intent-score-meter-fill"
                                                        style={{ width: `${Math.min(100, Math.max(10, visitor.intentScore || 50))}%` }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="inbox-meta-chain">
                                                <span className="meta-item meta-location">{cleanLocation}</span>
                                                <span className="meta-separator">·</span>
                                                <span className="meta-item meta-source">{cleanSource}</span>
                                                <span className="meta-separator">·</span>
                                                <span className="meta-item">{visitor.isReturning ? 'Returning' : 'New'}</span>
                                                <span className="meta-separator">·</span>
                                                <span className="meta-item">{formatDuration(visitor.totalEngagedSeconds)} attention</span>
                                                <span className="meta-separator">·</span>
                                                <span className="meta-item">{pageCount} {pageCount === 1 ? 'page' : 'pages'}</span>
                                                <span className="meta-separator">·</span>
                                                <span className="meta-item">{formatTimeAgo(visitor.startedAt)}</span>
                                            </div>

                                            <div className="inbox-journey-summary">
                                                <Route size={13} className="journey-icon" />
                                                <span className="journey-text">{cleanJourney}</span>
                                            </div>

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
                                                    <span>{isInspected ? 'Close ↑' : 'Inspect dossier →'}</span>
                                                </button>
                                            </div>
                                        </div>

                                        {isInspected && (
                                            <div className="visitor-dossier-panel">
                                                <div className="dossier-header-bar">
                                                    <div className="dossier-title">
                                                        <strong>Dossier: {cleanLocation}</strong>
                                                        <span className="text-muted">({visitor.device?.label || 'Desktop'} · {cleanSource})</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="btn-close-dossier"
                                                        onClick={() => setInspectedVisitorId(null)}
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>

                                                <div className="dossier-content-grid">
                                                    <div className="dossier-section">
                                                        <h5>Chronological Journey</h5>
                                                        <div className="dossier-timeline">
                                                            {(visitor.pages || visitor.journey || []).map((page, pgIdx) => {
                                                                const pPath = typeof page === 'string' ? page : (page.path || page.page_path || '/');
                                                                const pTitle = formatPageLabel(pPath);
                                                                return (
                                                                    <div key={pgIdx} className="timeline-node">
                                                                        <div className="node-marker">{pgIdx + 1}</div>
                                                                        <div className="node-info">
                                                                            <strong className="node-title">{pTitle}</strong>
                                                                            <code className="node-path">{pPath}</code>
                                                                            <span className="node-dwell">{formatDuration(page.engagedSeconds || 0)} attention</span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    <div className="dossier-section">
                                                        <h5>Context & Details</h5>
                                                        <div className="dossier-details-table">
                                                            <div className="dossier-row">
                                                                <span className="row-key">Intent Strength:</span>
                                                                <strong className="row-val">{visitor.intentStrength || 'Standard'} ({visitor.intentScore || 50}/100)</strong>
                                                            </div>
                                                            <div className="dossier-row">
                                                                <span className="row-key">Outcome:</span>
                                                                <span className={`row-val ${visitor.converted ? 'text-success' : ''}`}>
                                                                    {visitor.conversionLabel || (visitor.converted ? 'Enquiry submitted' : 'Explored portfolio')}
                                                                </span>
                                                            </div>
                                                            <div className="dossier-row">
                                                                <span className="row-key">Source:</span>
                                                                <span className="row-val">{cleanSource}</span>
                                                            </div>
                                                            <div className="dossier-row">
                                                                <span className="row-key">Device:</span>
                                                                <span className="row-val">{visitor.device?.label || 'Desktop'}</span>
                                                            </div>
                                                        </div>

                                                        {loadingTimeline ? (
                                                            <p className="text-muted" style={{ marginTop: '1rem' }}>Loading multi-visit history...</p>
                                                        ) : (Array.isArray(visitorTimeline) && visitorTimeline.length > 0) && (
                                                            <div className="multi-session-box" style={{ marginTop: '1rem' }}>
                                                                <h6>Multi-Visit History ({visitorTimeline.length} visits)</h6>
                                                                <div className="multi-session-list">
                                                                    {visitorTimeline.map((s, sIdx) => (
                                                                        <div key={s.id || sIdx} className="multi-session-item">
                                                                            <span>Visit {sIdx + 1} ({formatTimeAgo(s.started_at || s.startedAt)})</span>
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

                    {displayedVisitors.length < filteredVisitorsList.length && (
                        <div className="inbox-load-more-wrap">
                            <button
                                type="button"
                                className="btn-load-more-visitors"
                                onClick={() => setVisibleVisitorCount((c) => c + 10)}
                            >
                                Load more visitors ({filteredVisitorsList.length - displayedVisitors.length} remaining)
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ==========================================================================
               6. JOURNEYS TAB: 4 Commercial Funnels & Stage Drop-offs
               ========================================================================== */}
            {activeTab === 'journeys' && (
                <div className="analytics-tab-pane journeys-pane">
                    <div className="funnel-filter-bar">
                        <div className="filter-chips">
                            {[
                                { id: 'all', label: 'All 4 Funnels' },
                                { id: 'photography', label: 'Photography' },
                                { id: 'obsidian', label: 'Obsidian Tutoring' },
                                { id: 'creative_tech', label: 'Creative Tech' },
                                { id: 'film_brand', label: 'Film & Brand' },
                            ].map((chip) => (
                                <button
                                    key={chip.id}
                                    type="button"
                                    className={`filter-chip ${funnelFilter === chip.id ? 'active' : ''}`}
                                    onClick={() => setFunnelFilter(chip.id)}
                                >
                                    {chip.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="funnels-list">
                        {filteredFunnels.map((funnel) => {
                            const leakage = funnel.largestLeakage;
                            return (
                                <section key={funnel.id} className="funnel-block">
                                    <div className="funnel-block-header">
                                        <div className="funnel-title-area">
                                            <h3>{funnel.label}</h3>
                                            <p>{funnel.subtitle}</p>
                                        </div>
                                        <div className="funnel-conversion-summary">
                                            <span>Conversion</span>
                                            <strong>{funnel.conversionRate}%</strong>
                                        </div>
                                    </div>

                                    <div className="funnel-stages-row">
                                        {(funnel.stages || []).map((stage, idx) => {
                                            const isLast = idx === (funnel.stages || []).length - 1;
                                            const isLeakageStage = leakage && leakage.stageId === stage.id;
                                            const baseDiscoveryCount = Math.max(1, funnel.stages?.[0]?.count || 1);
                                            const retentionPct = Math.round(((stage.count || 0) / baseDiscoveryCount) * 100);
                                            return (
                                                <React.Fragment key={stage.id}>
                                                    <div className={`funnel-stage-card ${isLeakageStage ? 'has-leakage' : ''}`}>
                                                        <span className="stage-step-num">0{idx + 1}</span>
                                                        <strong className="stage-name">{stage.label}</strong>
                                                        <span className="stage-count">{formatNumber(stage.count)}</span>
                                                        <small className="stage-meta">{retentionPct}% retention</small>
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
                                                                <ArrowRight size={13} />
                                                            </div>
                                                            <div className={`dropoff-pill ${isLeakageStage ? 'dropoff-severe' : ''}`}>
                                                                <span>-{stage.dropOffRate}%</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>
                                </section>
                            );
                        })}
                    </div>

                    <div className="analytics-journeys-section">
                        <div className="section-header-row">
                            <h3>Traffic Velocity</h3>
                            <p>Daily trends of engaged visitors vs high intent.</p>
                        </div>
                        <OverviewTrendChart
                            trendSeries={overview.trendSeries || []}
                            range={range}
                        />
                    </div>
                </div>
            )}

            {/* ==========================================================================
               7. ADVANCED TAB: Session Replays, Threshold Controller & Technical Info
               ========================================================================== */}
            {activeTab === 'advanced' && (
                <div className="analytics-tab-pane advanced-pane">
                    {/* Global Filter Slider */}
                    <div className="analytics-global-filter-bar" style={{ marginBottom: '1.5rem' }}>
                        <div className="global-filter-header">
                            <div className="global-filter-title-group">
                                <span className="global-filter-icon-wrap">
                                    <Clock size={15} />
                                </span>
                                <div className="global-filter-text">
                                    <div className="global-filter-title-row">
                                        <strong className="global-filter-title">Attention Filter</strong>
                                        <span className="global-filter-badge">
                                            {minEngagedSeconds === 0 ? 'All Visits (0s+)' : `≥ ${minEngagedSeconds}s (Human Traffic)`}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="global-filter-controls">
                            <div className="global-slider-track-wrap">
                                <div className="slider-meta-row">
                                    <span className="slider-label-text">Minimum duration:</span>
                                    <span className="slider-active-num">{minEngagedSeconds}s</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="60"
                                    step="1"
                                    value={minEngagedSeconds}
                                    onChange={(e) => setMinEngagedSeconds(Number(e.target.value))}
                                    className="global-slider-input"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Session Replays Layout */}
                    <div className="replays-layout">
                        <div className="replays-sidebar">
                            <div className="sidebar-header">
                                <div>
                                    <h4>Session Replays</h4>
                                    <span className="text-muted">{filteredReplays.length} recordings</span>
                                </div>
                            </div>

                            <div className="replays-list">
                                {filteredReplays.length === 0 ? (
                                    <p className="text-muted" style={{ padding: '1.5rem' }}>No recordings match current duration threshold.</p>
                                ) : (
                                    filteredReplays.map((rep) => {
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
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        <div className="replays-player-stage">
                            {activeReplay ? (
                                <div className="replay-player-container">
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
                                    </div>

                                    <div className="virtual-browser-viewport-wrapper">
                                        <div className={`virtual-browser-viewport ${activeReplay.device?.type === 'mobile' ? 'viewport-mobile' : 'viewport-desktop'}`}>
                                            <iframe
                                                ref={iframeRef}
                                                src={activeCurrentPage.path || '/'}
                                                title="Session Replay"
                                                className="session-replay-iframe"
                                                sandbox="allow-same-origin allow-scripts"
                                            />
                                            <div
                                                className="simulated-cursor"
                                                style={{
                                                    top: `${Math.min(90, Math.max(10, (replayProgress * 1.4) % 85))}%`,
                                                    left: `${Math.min(85, Math.max(15, 30 + Math.sin(replayProgress / 5) * 35))}%`,
                                                }}
                                            >
                                                <MousePointer size={16} className="cursor-icon" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="replay-controls-bar">
                                        <button
                                            type="button"
                                            className="btn-play-pause"
                                            onClick={() => setIsPlaying(!isPlaying)}
                                        >
                                            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
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
                                        </div>

                                        <div className="speed-buttons-group">
                                            {[1, 2].map((spd) => (
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
                                    <Video size={32} style={{ opacity: 0.3, marginBottom: '12px' }} />
                                    <h4>No Session Selected</h4>
                                    <p>Select a session recording on the left to inspect.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
