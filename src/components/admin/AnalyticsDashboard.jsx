import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ArcElement,
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Filler,
    Legend,
    LineElement,
    LinearScale,
    PointElement,
    Tooltip,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import {
    Clock3,
    Eye,
    MousePointerClick,
    RefreshCw,
    Route,
    UsersRound,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import './analytics-dashboard.css';

ChartJS.register(
    ArcElement,
    BarElement,
    CategoryScale,
    Filler,
    Legend,
    LineElement,
    LinearScale,
    PointElement,
    Tooltip,
);

const RANGE_OPTIONS = [
    { id: 'today', label: 'Today' },
    { id: '7d', label: '7D' },
    { id: '30d', label: '30D' },
    { id: '90d', label: '90D' },
];

const EMPTY_REPORT = {
    summary: { visitors: 0, sessions: 0, pageViews: 0, averageEngagedSeconds: 0 },
    sources: [],
    countries: [],
    timeline: [],
    pages: [],
    journeys: [],
    commonJourneys: [],
};

const CHART_COLOURS = [
    '#d61f45',
    '#5b8def',
    '#36a37c',
    '#d4933c',
    '#8b6fd6',
    '#4aa5b5',
    '#c95c9a',
    '#7b8b99',
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
    if (!value || value === 'Unknown') return 'Unknown';
    try {
        return countryNames?.of(value) || value;
    } catch (_error) {
        return value;
    }
};

const formatJourneyTime = (value) => {
    if (!value) return '';
    return new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
};

const formatTimelineLabel = (value, range) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return new Intl.DateTimeFormat('en-GB', range === 'today'
        ? { hour: '2-digit', minute: '2-digit' }
        : { day: 'numeric', month: 'short' }).format(date);
};

const readChartTheme = () => {
    if (typeof window === 'undefined') {
        return { text: '#f8fafc', muted: '#9ba9bb', grid: '#2a2a2a', surface: '#0a0a0a' };
    }

    const probe = document.createElement('span');
    probe.style.position = 'fixed';
    probe.style.opacity = '0';
    probe.style.pointerEvents = 'none';
    document.body.appendChild(probe);

    const read = (name, fallback) => {
        probe.style.color = `var(${name})`;
        return window.getComputedStyle(probe).color || fallback;
    };

    const theme = {
        text: read('--text-primary', '#f8fafc'),
        muted: read('--text-tertiary', '#9ba9bb'),
        grid: read('--border-subtle', '#2a2a2a'),
        surface: read('--bg-surface', '#0a0a0a'),
    };
    probe.remove();
    return theme;
};

const useChartTheme = () => {
    const [theme, setTheme] = useState(readChartTheme);

    useEffect(() => {
        const updateTheme = () => setTheme(readChartTheme());
        const observer = new MutationObserver(updateTheme);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        return () => observer.disconnect();
    }, []);

    return theme;
};

function MetricCard({ icon: Icon, value, label }) {
    return (
        <article className="analytics-metric-card">
            <span className="analytics-metric-icon" aria-hidden="true">
                <Icon size={17} strokeWidth={1.7} />
            </span>
            <strong>{value}</strong>
            <span>{label}</span>
        </article>
    );
}

function RankedList({ items, labelKey, formatLabel = (value) => value }) {
    if (!items.length) return <p className="analytics-empty-inline">No visits in this period.</p>;

    return (
        <ol className="analytics-ranked-list">
            {items.map((item) => {
                const label = formatLabel(item[labelKey]);
                const share = Math.max(0, Math.min(100, Number(item.share) || 0));
                return (
                    <li key={`${item[labelKey]}-${item.sessions}`}>
                        <div className="analytics-ranked-copy">
                            <span title={label}>{label}</span>
                            <span>{formatNumber(item.sessions)} <small>{share}%</small></span>
                        </div>
                        <span className="analytics-share-track" aria-hidden="true">
                            <span style={{ width: `${share}%` }} />
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}

function JourneyCard({ journey }) {
    const pages = Array.isArray(journey.pages) ? journey.pages : [];

    return (
        <article className="analytics-journey-card">
            <header>
                <div>
                    <strong>{journey.source || 'Direct / Unknown'}</strong>
                    <span>{formatCountry(journey.country)}</span>
                </div>
                <div className="analytics-journey-meta">
                    <span>{formatJourneyTime(journey.startedAt)}</span>
                    <strong>{formatDuration(journey.totalEngagedSeconds)}</strong>
                </div>
            </header>
            <ol className="analytics-route-list">
                {pages.map((page, index) => (
                    <li key={`${journey.id}-${page.sequenceNumber}-${page.path}-${index}`}>
                        <span className="analytics-route-dot" aria-hidden="true" />
                        <span className="analytics-route-path" title={page.title || page.path}>{page.path}</span>
                        <span className="analytics-route-time">{formatDuration(page.engagedSeconds)}</span>
                    </li>
                ))}
                <li className="analytics-route-exit">
                    <span className="analytics-route-dot" aria-hidden="true" />
                    <span className="analytics-route-path">Exit{journey.exitPage ? ` from ${journey.exitPage}` : ''}</span>
                </li>
            </ol>
        </article>
    );
}

export default function AnalyticsDashboard({ accessToken }) {
    const [range, setRange] = useState('7d');
    const [report, setReport] = useState(EMPTY_REPORT);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [error, setError] = useState('');
    const [generatedAt, setGeneratedAt] = useState('');
    const [realtimeStatus, setRealtimeStatus] = useState('connecting');
    const [refreshKey, setRefreshKey] = useState(0);
    const [focusedJourney, setFocusedJourney] = useState(null);
    const hasLoadedRef = useRef(false);
    const chartTheme = useChartTheme();

    const loadReport = useCallback(async (signal) => {
        if (!accessToken) return;
        const firstLoad = !hasLoadedRef.current;
        if (firstLoad) setLoading(true);
        else setRefreshing(true);
        setError('');

        try {
            const timezoneOffset = new Date().getTimezoneOffset();
            const params = new URLSearchParams(window.location.search);
            const submission = params.get('submission');
            const newsletterSubmission = params.get('newsletterSubmission');
            const submissionQuery = submission
                ? `&submission=${encodeURIComponent(submission)}`
                : newsletterSubmission
                    ? `&newsletterSubmission=${encodeURIComponent(newsletterSubmission)}`
                    : '';
            const requestUrl = `/api/admin/analytics?range=${encodeURIComponent(range)}&timezoneOffset=${timezoneOffset}${submissionQuery}`;
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

            setReport({ ...EMPTY_REPORT, ...(payload.report || {}) });
            setFocusedJourney(payload.focusedJourney || null);
            setGeneratedAt(payload.generatedAt || new Date().toISOString());
            hasLoadedRef.current = true;
            setHasLoaded(true);
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

    useEffect(() => {
        if (!accessToken) return undefined;

        let cancelled = false;
        let channel;
        let refreshTimer;
        setRealtimeStatus('connecting');

        // Realtime uses the signed-in user's JWT, so the database RLS policies
        // continue to enforce the administrator-only visibility boundary.
        supabase.realtime.setAuth(accessToken).then(() => {
            if (cancelled) return;

            const queueRefresh = () => {
                window.clearTimeout(refreshTimer);
                refreshTimer = window.setTimeout(() => {
                    setRefreshKey((value) => value + 1);
                }, 700);
            };

            channel = supabase
                .channel('admin-analytics-realtime')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'analytics_sessions',
                }, queueRefresh)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'analytics_page_views',
                }, queueRefresh)
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') setRealtimeStatus('live');
                    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                        setRealtimeStatus('unavailable');
                    }
                });
        }).catch(() => {
            if (!cancelled) setRealtimeStatus('unavailable');
        });

        return () => {
            cancelled = true;
            window.clearTimeout(refreshTimer);
            if (channel) void supabase.removeChannel(channel);
        };
    }, [accessToken]);

    const summaryCards = useMemo(() => [
        { label: 'Visitors', value: formatNumber(report.summary?.visitors), icon: UsersRound },
        { label: 'Sessions', value: formatNumber(report.summary?.sessions), icon: MousePointerClick },
        { label: 'Page views', value: formatNumber(report.summary?.pageViews), icon: Eye },
        { label: 'Avg. engaged time', value: formatDuration(report.summary?.averageEngagedSeconds), icon: Clock3 },
    ], [report.summary]);

    const timelineChart = useMemo(() => ({
        labels: (report.timeline || []).map((item) => formatTimelineLabel(item.bucket, range)),
        datasets: [
            {
                label: 'Page views',
                data: (report.timeline || []).map((item) => Number(item.pageViews) || 0),
                borderColor: CHART_COLOURS[1],
                backgroundColor: 'rgba(91, 141, 239, 0.12)',
                pointBackgroundColor: CHART_COLOURS[1],
                pointRadius: 2,
                pointHoverRadius: 4,
                borderWidth: 2,
                tension: 0.32,
                fill: true,
            },
            {
                label: 'Sessions',
                data: (report.timeline || []).map((item) => Number(item.sessions) || 0),
                borderColor: CHART_COLOURS[0],
                backgroundColor: CHART_COLOURS[0],
                pointBackgroundColor: CHART_COLOURS[0],
                pointRadius: 2,
                pointHoverRadius: 4,
                borderWidth: 2,
                tension: 0.32,
            },
        ],
    }), [range, report.timeline]);

    const sourceChart = useMemo(() => {
        const sources = (report.sources || []).slice(0, 8);
        return {
            labels: sources.map((item) => item.source),
            datasets: [{
                data: sources.map((item) => Number(item.sessions) || 0),
                backgroundColor: CHART_COLOURS,
                borderColor: chartTheme.surface,
                borderWidth: 2,
            }],
        };
    }, [chartTheme.surface, report.sources]);

    const countryChart = useMemo(() => {
        const countries = (report.countries || []).slice(0, 8);
        return {
            labels: countries.map((item) => formatCountry(item.country)),
            datasets: [{
                label: 'Sessions',
                data: countries.map((item) => Number(item.sessions) || 0),
                backgroundColor: CHART_COLOURS[2],
                borderRadius: 4,
                borderSkipped: false,
                barThickness: 12,
            }],
        };
    }, [report.countries]);

    const cartesianOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: {
                align: 'end',
                labels: {
                    color: chartTheme.muted,
                    boxWidth: 8,
                    boxHeight: 8,
                    usePointStyle: true,
                    padding: 16,
                    font: { size: 10 },
                },
            },
            tooltip: {
                callbacks: {
                    label: (context) => `${context.dataset.label}: ${formatNumber(context.raw)}`,
                },
            },
        },
        scales: {
            x: {
                grid: { display: false },
                border: { color: chartTheme.grid },
                ticks: { color: chartTheme.muted, maxTicksLimit: 8, font: { size: 10 } },
            },
            y: {
                beginAtZero: true,
                grid: { color: chartTheme.grid },
                border: { display: false },
                ticks: { color: chartTheme.muted, precision: 0, font: { size: 10 } },
            },
        },
    }), [chartTheme]);

    const barOptions = useMemo(() => ({
        ...cartesianOptions,
        indexAxis: 'y',
        plugins: {
            ...cartesianOptions.plugins,
            legend: { display: false },
        },
        scales: {
            x: {
                beginAtZero: true,
                grid: { color: chartTheme.grid },
                border: { display: false },
                ticks: { color: chartTheme.muted, precision: 0, font: { size: 10 } },
            },
            y: {
                grid: { display: false },
                border: { color: chartTheme.grid },
                ticks: { color: chartTheme.muted, font: { size: 10 } },
            },
        },
    }), [cartesianOptions, chartTheme]);

    const pieOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    color: chartTheme.muted,
                    boxWidth: 8,
                    boxHeight: 8,
                    usePointStyle: true,
                    padding: 13,
                    font: { size: 10 },
                },
            },
            tooltip: {
                callbacks: {
                    label: (context) => `${context.label}: ${formatNumber(context.raw)} sessions`,
                },
            },
        },
    }), [chartTheme.muted]);

    const hasData = Number(report.summary?.sessions) > 0;
    const liveLabel = realtimeStatus === 'live'
        ? 'Live updates on'
        : realtimeStatus === 'connecting'
            ? 'Connecting live updates'
            : 'Manual refresh only';

    return (
        <section className="analytics-dashboard" aria-labelledby="analytics-title">
            <header className="analytics-header">
                <div>
                    <p className="analytics-eyebrow">Visitor intelligence</p>
                    <h2 id="analytics-title">Analytics</h2>
                    <p>Acquisition, location, active attention and complete routes through the site.</p>
                    <div className="analytics-status-row" aria-live="polite">
                        <span className={`analytics-live-status is-${realtimeStatus}`}>
                            <span aria-hidden="true" />{liveLabel}
                        </span>
                        {generatedAt && (
                            <time dateTime={generatedAt}>Updated {new Intl.DateTimeFormat('en-GB', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                            }).format(new Date(generatedAt))}</time>
                        )}
                    </div>
                </div>
                <div className="analytics-controls">
                    <div className="analytics-range-filter" aria-label="Analytics period">
                        {RANGE_OPTIONS.map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                className={range === option.id ? 'active' : ''}
                                aria-pressed={range === option.id}
                                onClick={() => setRange(option.id)}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        className="analytics-refresh"
                        onClick={() => setRefreshKey((value) => value + 1)}
                        disabled={loading || refreshing}
                        aria-label="Refresh analytics"
                        title="Refresh analytics"
                    >
                        <RefreshCw size={16} className={loading || refreshing ? 'is-spinning' : ''} aria-hidden="true" />
                    </button>
                </div>
            </header>

            {error && hasLoaded && (
                <div className="analytics-error-banner" role="alert">
                    <span>{error}</span>
                    <button type="button" onClick={() => setRefreshKey((value) => value + 1)}>Retry</button>
                </div>
            )}

            {focusedJourney && (
                <section className="analytics-panel analytics-focused-journey" aria-labelledby="focused-journey-title">
                    <div className="analytics-panel-heading">
                        <div>
                            <h3 id="focused-journey-title">Visit connected to this notification</h3>
                            <p>Activity is limited to the saved visit and stops at the submission time.</p>
                        </div>
                        <a href="/admin/dashboard?section=analytics">Show all analytics</a>
                    </div>
                    <JourneyCard journey={focusedJourney} />
                </section>
            )}

            {error && !hasLoaded ? (
                <div className="analytics-message analytics-message-error" role="alert">
                    <strong>Analytics are temporarily unavailable.</strong>
                    <span>{error}</span>
                    <button type="button" onClick={() => setRefreshKey((value) => value + 1)}>Try again</button>
                </div>
            ) : (
                <>
                    <div className={`analytics-metrics ${loading ? 'is-loading' : ''}`} aria-busy={loading}>
                        {summaryCards.map((metric) => <MetricCard key={metric.label} {...metric} />)}
                    </div>

                    {!loading && !hasData && (
                        <div className="analytics-message">
                            <Route size={20} strokeWidth={1.6} aria-hidden="true" />
                            <strong>No visitor journeys yet.</strong>
                            <span>Production visits will appear here after the analytics migration is active.</span>
                        </div>
                    )}

                    {(loading || hasData) && (
                        <div className={`analytics-content ${loading ? 'is-loading' : ''}`} aria-busy={loading}>
                            <section className="analytics-panel analytics-trend-panel">
                                <div className="analytics-panel-heading">
                                    <div>
                                        <h3>Traffic over time</h3>
                                        <p>Sessions and page views for the selected period.</p>
                                    </div>
                                </div>
                                <div className="analytics-chart analytics-line-chart">
                                    {(report.timeline || []).length ? (
                                        <Line
                                            data={timelineChart}
                                            options={cartesianOptions}
                                            role="img"
                                            aria-label="Line chart showing sessions and page views over time"
                                        />
                                    ) : <p className="analytics-empty-inline">No time-series data in this period.</p>}
                                </div>
                            </section>

                            <div className="analytics-two-column analytics-chart-grid">
                                <section className="analytics-panel">
                                    <div className="analytics-panel-heading">
                                        <div>
                                            <h3>Traffic sources</h3>
                                            <p>Share of sessions by acquisition source.</p>
                                        </div>
                                    </div>
                                    <div className="analytics-chart analytics-pie-chart">
                                        <Pie
                                            data={sourceChart}
                                            options={pieOptions}
                                            role="img"
                                            aria-label="Pie chart showing sessions by traffic source"
                                        />
                                    </div>
                                    <RankedList items={(report.sources || []).slice(0, 5)} labelKey="source" />
                                </section>

                                <section className="analytics-panel">
                                    <div className="analytics-panel-heading">
                                        <div>
                                            <h3>Visitor countries</h3>
                                            <p>Sessions from the leading visitor locations.</p>
                                        </div>
                                    </div>
                                    <div className="analytics-chart analytics-bar-chart">
                                        <Bar
                                            data={countryChart}
                                            options={barOptions}
                                            role="img"
                                            aria-label="Bar chart showing sessions by visitor country"
                                        />
                                    </div>
                                </section>
                            </div>

                            <section className="analytics-panel analytics-pages-panel">
                                <div className="analytics-panel-heading">
                                    <div>
                                        <h3>Engaging pages</h3>
                                        <p>Ranked by total active, visible time.</p>
                                    </div>
                                </div>
                                <div className="analytics-table-wrap">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th scope="col">Page</th>
                                                <th scope="col">Views</th>
                                                <th scope="col">Visitors</th>
                                                <th scope="col">Avg. active</th>
                                                <th scope="col">Total active</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(report.pages || []).map((page) => (
                                                <tr key={page.pagePath}>
                                                    <th scope="row">
                                                        <span>{page.pageTitle || page.pagePath}</span>
                                                        <small>{page.pagePath}</small>
                                                    </th>
                                                    <td>{formatNumber(page.views)}</td>
                                                    <td>{formatNumber(page.visitors)}</td>
                                                    <td>{formatDuration(page.averageEngagedSeconds)}</td>
                                                    <td>{formatDuration(page.totalEngagedSeconds)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>

                            <div className="analytics-journey-grid">
                                <section className="analytics-panel">
                                    <div className="analytics-panel-heading">
                                        <div>
                                            <h3>Recent visitor journeys</h3>
                                            <p>Landing page to final recorded exit.</p>
                                        </div>
                                    </div>
                                    <div className="analytics-journey-list">
                                        {(report.journeys || []).slice(0, 10).map((journey) => (
                                            <JourneyCard key={journey.id} journey={journey} />
                                        ))}
                                    </div>
                                </section>

                                <section className="analytics-panel analytics-common-panel">
                                    <div className="analytics-panel-heading">
                                        <div>
                                            <h3>Common page sequences</h3>
                                            <p>Routes repeated during this period.</p>
                                        </div>
                                    </div>
                                    <ol className="analytics-common-list">
                                        {(report.commonJourneys || []).map((item, index) => (
                                            <li key={`${item.sequence}-${index}`}>
                                                <span className="analytics-common-rank">{String(index + 1).padStart(2, '0')}</span>
                                                <div>
                                                    <strong>{item.sequence.split(' > ').join(' → ')}</strong>
                                                    <span>{formatNumber(item.count)} session{Number(item.count) === 1 ? '' : 's'} · {formatDuration(item.averageEngagedSeconds)} avg.</span>
                                                </div>
                                            </li>
                                        ))}
                                    </ol>
                                </section>
                            </div>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
