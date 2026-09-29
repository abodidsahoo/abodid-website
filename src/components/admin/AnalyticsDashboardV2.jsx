import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ArrowRight,
    Bot,
    Check,
    ChevronDown,
    Clock3,
    ExternalLink,
    Flag,
    Globe2,
    MousePointerClick,
    RefreshCw,
    Route,
    Sparkles,
    Users,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import AdminPageHeader from './AdminPageHeader';
import './analytics-v2.css';

const RANGE_OPTIONS = [
    { id: 'today', label: 'Today' },
    { id: '7d', label: '7 days' },
    { id: '30d', label: '30 days' },
    { id: '90d', label: '90 days' },
];

const FILTERS = [
    { id: 'all', label: 'All meaningful' },
    { id: 'high_intent', label: 'High intent' },
    { id: 'converted', label: 'Reached out' },
    { id: 'returning', label: 'Returning' },
];

const number = new Intl.NumberFormat('en-GB');
const countryNames = typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null;

const formatNumber = (value) => number.format(Number(value) || 0);
const formatDuration = (value) => {
    const seconds = Math.max(0, Math.round(Number(value) || 0));
    if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    if (seconds >= 60) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${seconds}s`;
};
const formatPath = (value) => {
    const path = String(value || '/').split('?')[0];
    if (path === '/') return 'Home';
    return path.replace(/^\//, '').split('/').filter(Boolean).map((part) => (
        part.replace(/[-_]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
    )).join(' · ');
};
const formatCountry = (codeOrName) => {
    const value = String(codeOrName || 'Unknown');
    if (/^[A-Z]{2}$/.test(value)) {
        try { return countryNames?.of(value) || value; } catch { return value; }
    }
    return value;
};
const relativeTime = (value) => {
    const delta = Math.max(0, Date.now() - new Date(value).getTime());
    const minutes = Math.floor(delta / 60_000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
};

const TierBadge = ({ tier, score }) => {
    const label = tier === 'exceptional' ? 'Exceptional intent'
        : tier === 'high_intent' ? 'High intent'
            : 'Meaningful human';
    return <span className={`av2-tier av2-tier--${tier}`}>{label} · {score}</span>;
};

const MetricCard = ({ label, value, note, icon: Icon }) => (
    <article className="av2-metric-card">
        <div className="av2-metric-icon"><Icon size={17} /></div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{note}</span>
    </article>
);

const AnalyticsDashboardV2 = ({ accessToken }) => {
    const [range, setRange] = useState('7d');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [expandedId, setExpandedId] = useState('');
    const [filter, setFilter] = useState('all');
    const [refreshKey, setRefreshKey] = useState(0);
    const [showAllCountries, setShowAllCountries] = useState(false);
    const [showAllLandings, setShowAllLandings] = useState(false);

    const load = useCallback(async (signal) => {
        if (!accessToken) return;
        data ? setRefreshing(true) : setLoading(true);
        setError('');
        try {
            const timezoneOffset = new Date().getTimezoneOffset();
            const url = `/api/admin/analytics-v2?range=${range}&timezoneOffset=${timezoneOffset}`;
            const request = (token) => fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal });
            let response = await request(accessToken);
            if (response.status === 401) {
                const { data: refreshed } = await supabase.auth.refreshSession();
                if (refreshed?.session?.access_token) response = await request(refreshed.session.access_token);
            }
            const payload = await response.json();
            if (!response.ok) throw new Error(payload?.error || 'Could not load analytics.');
            setData(payload);
        } catch (requestError) {
            if (requestError?.name !== 'AbortError') setError(requestError?.message || 'Could not load analytics.');
        } finally {
            if (!signal.aborted) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, [accessToken, range, refreshKey]);

    useEffect(() => {
        const controller = new AbortController();
        load(controller.signal);
        return () => controller.abort();
    }, [load]);

    const updateLeadQuality = async (submissionId, status) => {
        const response = await fetch('/api/admin/analytics-v2', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({ submissionId, status }),
        });
        if (!response.ok) return;
        setData((current) => ({
            ...current,
            journeys: current.journeys.map((journey) => (
                journey.conversion?.submissionId === submissionId
                    ? { ...journey, conversion: { ...journey.conversion, status } }
                    : journey
            )),
        }));
    };

    const ga4 = data?.ga4 || {};
    const summary = ga4.summary || {};
    const journeys = data?.journeys || [];
    const filteredJourneys = useMemo(() => journeys.filter((journey) => {
        if (filter === 'high_intent') return journey.confidenceTier === 'high_intent' || journey.confidenceTier === 'exceptional';
        if (filter === 'converted') return Boolean(journey.conversion);
        if (filter === 'returning') return journey.returning;
        return true;
    }), [journeys, filter]);
    const countries = (ga4.countries || []).slice(0, showAllCountries ? 20 : 6);
    const landingPages = (ga4.landingPages || []).slice(0, showAllLandings ? 20 : 6);
    const leadOutcomes = useMemo(() => {
        const enquiries = journeys.filter((journey) => journey.conversion?.type === 'enquiry' && journey.conversion?.status !== 'spam');
        const qualified = enquiries.filter((journey) => ['qualified', 'won'].includes(journey.conversion?.status));
        const sourceCounts = qualified.reduce((counts, journey) => {
            const source = journey.source || 'Direct visit';
            counts.set(source, (counts.get(source) || 0) + 1);
            return counts;
        }, new Map());
        return {
            reachedOut: enquiries.length,
            qualified: qualified.length,
            won: enquiries.filter((journey) => journey.conversion?.status === 'won').length,
            notFit: enquiries.filter((journey) => ['unqualified', 'lost'].includes(journey.conversion?.status)).length,
            sources: [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]),
        };
    }, [journeys]);

    return (
        <section className="av2-root" aria-labelledby="analytics-v2-title">
            <header className="av2-header">
                <div>
                    <AdminPageHeader
                        headingId="analytics-v2-title"
                        title="Visitor intelligence"
                        description="The people who discovered your work, what held their attention, and where they decided to act."
                    />
                    <div className="av2-source-note">
                        <span className={`av2-status-dot ${ga4.available ? 'is-live' : ''}`} />
                        {ga4.available ? 'GA4 is the acquisition source of truth' : 'GA4 is temporarily unavailable'}
                        <span>·</span>
                        <span>Private journeys appear only after human qualification</span>
                    </div>
                </div>
                <div className="av2-actions">
                    <div className="av2-range" role="radiogroup" aria-label="Analytics period">
                        {RANGE_OPTIONS.map((option) => (
                            <button key={option.id} type="button" className={range === option.id ? 'is-active' : ''} onClick={() => setRange(option.id)}>
                                {option.label}
                            </button>
                        ))}
                    </div>
                    <button className="av2-refresh" type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading || refreshing} aria-label="Refresh analytics">
                        <RefreshCw size={16} className={refreshing ? 'is-spinning' : ''} />
                    </button>
                </div>
            </header>

            {error && <div className="av2-error">{error}</div>}
            {loading && !data ? <div className="av2-loading">Loading trustworthy analytics…</div> : (
                <>
                    <div className="av2-metrics" aria-label="GA4 overview">
                        <MetricCard icon={Users} label="New people" value={formatNumber(summary.newUsers)} note={`${formatNumber(summary.users)} total users`} />
                        <MetricCard icon={MousePointerClick} label="Engaged sessions" value={formatNumber(summary.engagedSessions)} note={`${formatNumber(summary.sessions)} sessions`} />
                        <MetricCard icon={Clock3} label="Average attention" value={formatDuration(summary.averageSessionDuration)} note="GA4 session duration" />
                        <MetricCard icon={Sparkles} label="Key actions" value={formatNumber(summary.keyEvents)} note="GA4 key events" />
                    </div>

                    <div className="av2-grid">
                        <section className="av2-block av2-block--wide">
                            <div className="av2-block-heading">
                                <div><span className="av2-eyebrow">Discovery</span><h2>How people found you</h2></div>
                                <span className="av2-data-label">GA4</span>
                            </div>
                            {(ga4.channels || []).length ? (
                                <div className="av2-channel-grid">
                                    {ga4.channels.map((channel) => (
                                        <article className="av2-channel" key={channel.channel}>
                                            <strong>{channel.channel}</strong>
                                            <span>{formatNumber(channel.sessions)} sessions</span>
                                            <small>{formatNumber(channel.engagedSessions)} engaged · {formatNumber(channel.keyEvents)} actions</small>
                                        </article>
                                    ))}
                                </div>
                            ) : <p className="av2-empty">No acquisition data for this period.</p>}
                        </section>

                        <section className="av2-block">
                            <div className="av2-block-heading">
                                <div><span className="av2-eyebrow">Place</span><h2>Countries</h2></div>
                                <Globe2 size={18} />
                            </div>
                            <div className="av2-ranked-list">
                                {countries.map((country, index) => (
                                    <div key={country.country}><span><b>{index + 1}</b>{formatCountry(country.country)}</span><strong>{formatNumber(country.sessions)}</strong></div>
                                ))}
                            </div>
                            {(ga4.countries || []).length > 6 && <button className="av2-text-button" type="button" onClick={() => setShowAllCountries((value) => !value)}>{showAllCountries ? 'Show less' : 'Show all countries'}</button>}
                        </section>

                        <section className="av2-block">
                            <div className="av2-block-heading">
                                <div><span className="av2-eyebrow">Entry</span><h2>Landing pages</h2></div>
                                <Flag size={18} />
                            </div>
                            <div className="av2-ranked-list av2-ranked-list--paths">
                                {landingPages.map((page, index) => (
                                    <div key={`${page.path}-${index}`}><span><b>{index + 1}</b>{formatPath(page.path)}</span><strong>{formatNumber(page.sessions)}</strong></div>
                                ))}
                            </div>
                            {(ga4.landingPages || []).length > 6 && <button className="av2-text-button" type="button" onClick={() => setShowAllLandings((value) => !value)}>{showAllLandings ? 'Show less' : 'Show all landing pages'}</button>}
                        </section>
                    </div>

                    <section className="av2-block av2-lead-loop">
                        <div className="av2-block-heading">
                            <div><span className="av2-eyebrow">Lead-quality feedback</span><h2>Meaningful outcomes, not generic clicks</h2></div>
                            <span className="av2-data-label">Private</span>
                        </div>
                        <div className="av2-outcome-grid">
                            <div><small>Reached out</small><strong>{leadOutcomes.reachedOut}</strong></div>
                            <div><small>Qualified</small><strong>{leadOutcomes.qualified}</strong></div>
                            <div><small>Won</small><strong>{leadOutcomes.won}</strong></div>
                            <div><small>Not a fit</small><strong>{leadOutcomes.notFit}</strong></div>
                        </div>
                        {leadOutcomes.sources.length > 0 ? (
                            <div className="av2-qualified-sources">
                                <span>Sources producing qualified or won enquiries</span>
                                <div>{leadOutcomes.sources.map(([source, count]) => <b key={source}>{source} · {count}</b>)}</div>
                            </div>
                        ) : <p className="av2-empty">Label enquiries below and their useful acquisition patterns will appear here.</p>}
                    </section>

                    <section className="av2-journeys">
                        <div className="av2-journeys-heading">
                            <div>
                                <span className="av2-eyebrow">Qualified private journeys</span>
                                <h2>People worth understanding</h2>
                                <p>Passive visits, obvious bots, and low-confidence traffic are kept out of this view.</p>
                            </div>
                            <div className="av2-filters">
                                {FILTERS.map((item) => <button key={item.id} type="button" className={filter === item.id ? 'is-active' : ''} onClick={() => setFilter(item.id)}>{item.label}</button>)}
                            </div>
                        </div>

                        {filteredJourneys.length === 0 ? (
                            <div className="av2-empty-state"><Bot size={20} /><strong>No qualified journeys yet</strong><span>When a visitor passes the human-confidence threshold, their session will appear here.</span></div>
                        ) : (
                            <div className="av2-session-list">
                                {filteredJourneys.map((journey) => {
                                    const expanded = expandedId === journey.id;
                                    return (
                                        <article className={`av2-session ${expanded ? 'is-expanded' : ''}`} key={journey.id}>
                                            <button className="av2-session-summary" type="button" onClick={() => setExpandedId(expanded ? '' : journey.id)} aria-expanded={expanded}>
                                                <div className="av2-session-primary">
                                                    <TierBadge tier={journey.confidenceTier} score={journey.confidenceScore} />
                                                    <h3>{journey.source || 'Direct visit'} <ArrowRight size={15} /> {formatPath(journey.landingPage)}</h3>
                                                    <p>{formatCountry(journey.country)}{journey.city ? ` · ${journey.city}` : ''} · {journey.returning ? 'Returning visitor' : 'New visitor'} · {relativeTime(journey.startedAt)}</p>
                                                </div>
                                                <div className="av2-session-facts">
                                                    <span><small>Active</small><strong>{formatDuration(journey.activeSeconds)}</strong></span>
                                                    <span><small>Pages</small><strong>{journey.pages.length}</strong></span>
                                                    <span><small>Exit</small><strong>{formatPath(journey.exitPage)}</strong></span>
                                                    <ChevronDown size={18} />
                                                </div>
                                            </button>

                                            {expanded && (
                                                <div className="av2-session-detail">
                                                    <div className="av2-path">
                                                        <h4><Route size={16} /> Page journey</h4>
                                                        {journey.pages.map((page, index) => (
                                                            <div className="av2-path-step" key={`${page.path}-${index}`}>
                                                                <span>{index + 1}</span>
                                                                <div><strong>{page.title || formatPath(page.path)}</strong><small>{page.path}</small></div>
                                                                <b>{formatDuration(page.engagedSeconds)}</b>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <aside className="av2-signal-panel">
                                                        <h4>Why this person appears</h4>
                                                        <dl>
                                                            <div><dt>Deepest scroll</dt><dd>{Math.round((journey.signals?.maxScrollDepth || 0) * 100)}%</dd></div>
                                                            <div><dt>Genuine clicks</dt><dd>{journey.signals?.genuineClicks || 0}</dd></div>
                                                            <div><dt>Content interactions</dt><dd>{journey.signals?.contentInteractions || 0}</dd></div>
                                                        </dl>
                                                        {journey.conversion ? (
                                                            <div className="av2-conversion">
                                                                <span><Check size={14} /> Reached out</span>
                                                                <strong>{journey.conversion.label}</strong>
                                                                {journey.conversion.submissionId && (
                                                                    <div className="av2-quality-actions" aria-label="Lead quality">
                                                                        {[
                                                                            ['qualified', 'Qualified'],
                                                                            ['won', 'Won'],
                                                                            ['unqualified', 'Not a fit'],
                                                                            ['spam', 'Spam'],
                                                                        ].map(([status, label]) => (
                                                                            <button key={status} type="button" className={journey.conversion.status === status ? 'is-active' : ''} onClick={() => updateLeadQuality(journey.conversion.submissionId, status)}>{label}</button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : <span className="av2-no-conversion">No form submitted</span>}
                                                    </aside>
                                                </div>
                                            )}
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    <footer className="av2-footer-note">
                        <ExternalLink size={14} /> GA4 supplies aggregate acquisition truth. Supabase adds the private page sequence only when Google cannot provide that individual journey.
                    </footer>
                </>
            )}
        </section>
    );
};

export default AnalyticsDashboardV2;
