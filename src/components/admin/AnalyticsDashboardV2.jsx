import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    ArrowRight,
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
import { formatSessionPath as formatPath, selectSessionCards, describeSession, hasHumanInteractionEvidence } from '../../lib/analytics/session-journeys.js';
import AdminPageHeader from './AdminPageHeader';
import './analytics-v2.css';

const RANGE_OPTIONS = [
    { id: 'today', label: 'Today' },
    { id: '7d', label: '7 days' },
    { id: '30d', label: '30 days' },
    { id: '90d', label: '90 days' },
];

const FILTERS = [
    { id: 'human', label: 'Human activity' },
    { id: 'all', label: 'All recorded sessions' },
    { id: 'long', label: 'Long visits · 30s+' },
    { id: 'uncertain', label: 'Unconfirmed' },
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

const formatDateTime = (value) => {
    const date = new Date(value);
    return value && Number.isFinite(date.getTime())
        ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
        : 'Not recorded';
};
const TierBadge = ({ journey }) => {
    const supported = hasHumanInteractionEvidence(journey.signals);
    return <span className={`av2-tier av2-tier--${supported ? 'exceptional' : 'neutral'}`}>{supported ? 'Likely human · interaction evidence' : journey.evidence === 'legacy' ? 'Historical · unconfirmed' : 'Human status unconfirmed'}</span>;
};

const EVIDENCE_LABELS = {
    varied_pointer_movement: 'Varied pointer movement and timing',
    input_linked_scrolling: 'Scrolling following wheel, touch, or keyboard input',
    input_and_action: 'Input followed by an interactive click',
    keyboard_navigation: 'Keyboard navigation and action',
    touch_navigation: 'Touch input with scrolling or an action',
    separate_scroll_bursts: 'Separate scroll bursts',
    scroll_direction_changes: 'Changes in scroll direction',
    interactive_page_navigation: 'Page changes alongside direct interaction',
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
    const [filter, setFilter] = useState('human');
    const [sort, setSort] = useState('newest');
    const [sessionIndex, setSessionIndex] = useState(0);
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

    useEffect(() => {
        setExpandedId('');
        setSessionIndex(0);
    }, [filter, sort, range]);

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
    const filteredJourneys = useMemo(() => selectSessionCards(journeys, {
        filter, sort, limit: 100,
    }), [journeys, filter, sort]);
    const currentIndex = Math.min(sessionIndex, Math.max(0, filteredJourneys.length - 1));
    const currentJourney = filteredJourneys[currentIndex];
    const humanCount = journeys.filter((journey) => hasHumanInteractionEvidence(journey.signals)).length;
    const staleCollection = data?.sessionFeed?.latestCollectedAt &&
        Date.now() - new Date(data.sessionFeed.latestCollectedAt).getTime() > 48 * 60 * 60 * 1000;
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
                        description="Recent sessions, the route through your site, and the pages that held attention."
                    />
                    <div className="av2-source-note">
                        <span className={`av2-status-dot ${ga4.available ? 'is-live' : ''}`} />
                        {ga4.available ? 'GA4 connected' : ga4.category === 'configuration' ? 'GA4 configuration needs attention' : 'GA4 connection needs attention'}
                        <span>·</span>
                        <span>Human activity is judged by interaction evidence, independently of visit length</span>
                    </div>
                </div>
                <div className="av2-actions">
                    <div className="av2-range" role="group" aria-label="Analytics period">
                        {RANGE_OPTIONS.map((option) => (
                            <button key={option.id} type="button" aria-pressed={range === option.id} className={range === option.id ? 'is-active' : ''} onClick={() => setRange(option.id)}>
                                {option.label}
                            </button>
                        ))}
                    </div>
                    <button className="av2-refresh" type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading || refreshing} aria-label="Refresh analytics">
                        <RefreshCw size={16} className={refreshing ? 'is-spinning' : ''} />
                    </button>
                </div>
            </header>

            {error && <div className="av2-error" role="alert">{error}</div>}
            {data && !ga4.available && <div className="av2-error" role="status">{ga4.error || 'GA4 reporting is unavailable. Check the server configuration.'}</div>}
            {loading && !data ? <div className="av2-loading">Loading session history…</div> : (
                <>
                    <section className="av2-journeys av2-reader" aria-labelledby="recent-session-title">
                        <div className="av2-journeys-heading">
                            <div>
                                <span className="av2-eyebrow">One visit at a time</span>
                                <h2 id="recent-session-title">The story of each session</h2>
                                <p>Where they came from, what held their attention, and where the visit ended.</p>
                            </div>
                            <label className="av2-sort">Sort sessions
                                <span className="av2-sort-field">
                                    <select name="session-sort" value={sort} onChange={(event) => setSort(event.target.value)}>
                                        <option value="newest">Newest first</option>
                                        <option value="longest">Longest active time</option>
                                    </select>
                                    <ChevronDown size={16} aria-hidden="true" />
                                </span>
                            </label>
                        </div>
                        <div className="av2-filters" role="group" aria-label="Session filters">
                            {FILTERS.map((item) => <button key={item.id} type="button" aria-pressed={filter === item.id} className={filter === item.id ? 'is-active' : ''} onClick={() => setFilter(item.id)}>{item.label}</button>)}
                        </div>
                        {staleCollection && <div className="av2-error" role="status">Collection may be interrupted. The latest stored session began {formatDateTime(data.sessionFeed.latestCollectedAt)}.</div>}
                        {(data?.warnings || []).map((warning) => <p className="av2-error" key={warning}>{warning}</p>)}
                        {!currentJourney ? (
                            <div className="av2-empty-state"><MousePointerClick size={24} /><strong>{filter === 'human' ? 'No visits with enough human-interaction evidence in this period' : 'No sessions match this view'}</strong><span>{filter === 'human' ? 'Choose All recorded sessions to review visits whose human status is unconfirmed, or try a wider date range.' : 'Try another filter or a wider date range.'}</span></div>
                        ) : (() => {
                            const journey = currentJourney;
                            const attribution = journey.attribution || {};
                            const expanded = expandedId === journey.id;
                            return <>
                                <article className="av2-session av2-session-story">
                                    <div className="av2-card-heading"><TierBadge journey={journey} /><span>{relativeTime(journey.startedAt)}</span></div>
                                    <div className="av2-story-body">
                                        <p className="av2-story-date"><time dateTime={journey.startedAt}>{formatDateTime(journey.startedAt)}</time> · {journey.device?.label || 'Device not recorded'}</p>
                                        <p className="av2-story-paragraph">{describeSession(journey)}</p>
                                        <div className="av2-story-meta"><span><Clock3 size={14} /> Active time {formatDuration(journey.activeSeconds)}</span><span><Route size={14} /> {journey.pages.length} recorded page {journey.pages.length === 1 ? 'view' : 'views'}</span><span>Last seen {formatDateTime(journey.endedAt)}</span></div>
                                    </div>
                                    <button className="av2-journey-toggle" type="button" onClick={() => setExpandedId(expanded ? '' : journey.id)} aria-expanded={expanded} aria-controls={`journey-${journey.id}`}>
                                        {expanded ? 'Hide' : 'Show'} route, source & human evidence <ChevronDown size={16} aria-hidden="true" />
                                    </button>
                                    {expanded && <div id={`journey-${journey.id}`} className="av2-session-detail">
                                        <div className="av2-path">
                                            <h4>Recorded route through your site</h4>
                                            <p className="av2-explainer">{attribution.referrerDomain || 'Referrer unavailable'} → {journey.landingPage || 'Unknown entry'}</p>
                                            {journey.pages.length === 0 && <p className="av2-empty">No page sequence was recorded.</p>}
                                            {journey.pages.map((page, index) => <div className="av2-path-step" key={`${page.path}-${index}`}><span>{index + 1}</span><div><strong>{page.title || formatPath(page.path)}</strong><small>{page.path} · {formatDateTime(page.enteredAt)}</small></div><b>{formatDuration(page.engagedSeconds)}</b></div>)}
                                            {journey.pages.length >= 30 && <p className="av2-explainer">Earlier steps may be unavailable: the tracker buffers 30 recent page views.</p>}
                                            <h4 className="av2-evidence-title">Why this session is classified this way</h4>
                                            {hasHumanInteractionEvidence(journey.signals) ? <ul className="av2-evidence-list">{(journey.signals?.reasons || []).filter((reason) => EVIDENCE_LABELS[reason]).map((reason) => <li key={reason}><Check size={14} />{EVIDENCE_LABELS[reason]}</li>)}</ul> : <p className="av2-explainer">There is not enough measured interaction evidence to judge this visit. Duration alone does not establish a human, and absence of mouse activity does not establish a bot.</p>}
                                            <dl className="av2-evidence-stats"><div><dt>Pointer samples</dt><dd>{journey.signals?.pointerSamples || 0}</dd></div><div><dt>Input-linked scroll samples</dt><dd>{journey.signals?.intentionalScrollSamples ?? 'Not measured'}</dd></div><div><dt>Interactive clicks</dt><dd>{journey.signals?.genuineClicks || 0}</dd></div></dl>
                                        </div>
                                        <aside className="av2-signal-panel">
                                            <h4>How they found you</h4>
                                            <dl>{[['Referrer', attribution.referrerDomain], ['Campaign source', attribution.source], ['Medium', attribution.medium], ['Campaign', attribution.campaign], ['Tagged term', attribution.term], ['Tagged content', attribution.content]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not recorded'}</dd></div>)}</dl>
                                            <p className="av2-explainer">External page URLs, earlier browsing history, and unprovided search terms cannot be reconstructed from a referring domain.</p>
                                            {journey.conversion && <div className="av2-conversion"><span><Check size={14} /> Reached out</span><strong>{journey.conversion.label}</strong>{journey.conversion.submissionId && <div className="av2-quality-actions" aria-label="Lead quality">{[['qualified', 'Qualified'], ['won', 'Won'], ['unqualified', 'Not a fit'], ['spam', 'Spam']].map(([status, label]) => <button key={status} type="button" className={journey.conversion.status === status ? 'is-active' : ''} onClick={() => updateLeadQuality(journey.conversion.submissionId, status)}>{label}</button>)}</div>}</div>}
                                        </aside>
                                    </div>}
                                </article>
                                <nav className="av2-session-pager" aria-label="Browse sessions">
                                    <button type="button" disabled={currentIndex === 0} onClick={() => { setSessionIndex(currentIndex - 1); setExpandedId(''); }}><ArrowLeft size={17} aria-hidden="true" /> Previous</button>
                                    <span role="status" aria-live="polite">Session <strong>{currentIndex + 1}</strong> of {filteredJourneys.length}</span>
                                    <button type="button" disabled={currentIndex >= filteredJourneys.length - 1} onClick={() => { setSessionIndex(currentIndex + 1); setExpandedId(''); }}>Next session <ArrowRight size={17} aria-hidden="true" /></button>
                                </nav>
                            </>;
                        })()}
                        <details className="av2-reader-notes"><summary>About these sessions · {humanCount} with human-like interaction evidence in the latest {journeys.length} loaded</summary><p>Known automation is excluded. The behavioural label is a heuristic, not identity verification; advanced automation can imitate these signals. Mouse, touch, and keyboard use are supported. Short sessions with sufficient human-interaction evidence appear even below five seconds; other sessions need five seconds to appear in All recorded sessions.</p><p>Active time excludes hidden/unfocused time and is capped after 60 idle seconds. Older measurements may have included idle time. Locations are network estimates. “Last page” and “last seen” are the final received observations, not a confirmed browser close. Dates use {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p></details>
                    </section>

                    <div className="av2-metrics" aria-label="GA4 overview">
                        <MetricCard icon={Users} label="New users · GA4" value={ga4.available ? formatNumber(summary.newUsers) : '—'} note={ga4.available ? `${formatNumber(summary.users)} total users` : 'GA4 unavailable'} />
                        <MetricCard icon={MousePointerClick} label="Engaged sessions" value={ga4.available ? formatNumber(summary.engagedSessions) : '—'} note={ga4.available ? `${formatNumber(summary.sessions)} sessions` : 'GA4 unavailable'} />
                        <MetricCard icon={Clock3} label="Average session duration" value={ga4.available ? formatDuration(summary.averageSessionDuration) : '—'} note="GA4 session duration" />
                        <MetricCard icon={Sparkles} label="Key actions" value={ga4.available ? formatNumber(summary.keyEvents) : '—'} note="GA4 key events" />
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
                            ) : <p className="av2-empty">{ga4.available ? 'No acquisition data for this period.' : 'GA4 acquisition reporting is unavailable.'}</p>}
                            <details className="av2-source-details">
                                <summary>Show recorded sources and mediums</summary>
                                <div className="av2-ranked-list">
                                    {(ga4.sources || []).map((source, index) => <div key={`${source.source}-${source.medium}-${index}`}><span>{source.source} / {source.medium}</span><strong>{formatNumber(source.sessions)} sessions</strong></div>)}
                                </div>
                            </details>
                            <p className="av2-explainer">Direct means no usable referral was recorded: a typed address, bookmark, private message, app, or stripped referrer can all appear here.</p>
                        </section>

                        <section className="av2-block">
                            <div className="av2-block-heading">
                                <div><span className="av2-eyebrow">Place</span><h2>Estimated countries · GA4 sessions</h2></div>
                                <Globe2 size={18} />
                            </div>
                            <p className="av2-explainer">Network location estimates, not verified residence or proof of a real person. VPNs, mobile networks, and automated traffic can affect them.</p>
                            <div className="av2-ranked-list">
                                {countries.map((country, index) => (
                                    <div key={country.country}><span><b>{index + 1}</b>{formatCountry(country.country)}</span><strong>{formatNumber(country.sessions)}</strong></div>
                                ))}
                            </div>
                            {(ga4.countries || []).length > 6 && <button className="av2-text-button" type="button" onClick={() => setShowAllCountries((value) => !value)}>{showAllCountries ? 'Show less' : 'Show all countries'}</button>}
                        </section>

                        <section className="av2-block">
                            <div className="av2-block-heading">
                                <div><span className="av2-eyebrow">Entry</span><h2>Landing pages · GA4 sessions</h2></div>
                                <Flag size={18} />
                            </div>
                            <p className="av2-explainer">“Entry page unavailable” means GA4 did not record a landing page for the session. It is not a page on your website.</p>
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
                        ) : <p className="av2-empty">Label enquiries inside session cards and their useful acquisition patterns will appear here.</p>}
                    </section>

                    <footer className="av2-footer-note">
                        <ExternalLink size={14} /> GA4 aggregates and private session records have different coverage and filters. Their totals are not expected to match. Human-interaction evidence can qualify a visit below five seconds.
                    </footer>
                </>
            )}
        </section>
    );
};

export default AnalyticsDashboardV2;
