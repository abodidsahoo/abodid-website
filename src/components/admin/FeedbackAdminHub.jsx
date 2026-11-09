import React, { useEffect, useMemo, useState } from 'react';
import {
    Camera,
    Check,
    Copy,
    Download,
    FileSpreadsheet,
    HeartHandshake,
    Images,
    Loader2,
    Mail,
    MessageSquare,
    RefreshCw,
    Search,
    Sparkles,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import AdminPageHeader from './AdminPageHeader';
import './feedback-admin-hub.css';

const NIFT_SLUG = 'nift-bhubaneswar-space-materiality-2026-11-03';
const DU_SLUG = 'delhi-university-ethnographic-filmmaking';
const INTEREST_SLUG = 'nift-photography-workshop-photo-walk-2026-11';
const ALBUM_SLUG = 'photography-album-thoughts';

function formatISTDate(dateStr) {
    if (!dateStr) return '—';
    try {
        return new Intl.DateTimeFormat('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'Asia/Kolkata',
        }).format(new Date(dateStr));
    } catch {
        return dateStr;
    }
}

function getInitials(name) {
    if (!name || name === 'Anonymous' || name.startsWith('Anonymous')) return 'A';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function exportCsv(filename, rows, columns) {
    const escapeCsv = (val) => {
        const text = String(val ?? '');
        return '"' + (/^\s*[=+\-@]/.test(text) ? "'" : '') + text.replace(/"/g, '""') + '"';
    };
    const headerRow = columns.map((col) => escapeCsv(col.label)).join(',');
    const dataRows = rows.map((row) =>
        columns.map((col) => escapeCsv(col.getter(row))).join(',')
    );
    const content = [headerRow, ...dataRows].join('\r\n');
    const blob = new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function FeedbackAdminHub({ accessToken }) {
    const [activeWorkshop, setActiveWorkshop] = useState('nift'); // 'nift' | 'du'
    const [niftSubSection, setNiftSubSection] = useState('all'); // 'all' | 'lecture' | 'interest' | 'album'
    const [searchQuery, setSearchQuery] = useState('');
    const [copiedId, setCopiedId] = useState(null);

    // Data states
    const [summary, setSummary] = useState(null);
    const [collectionsData, setCollectionsData] = useState({
        [NIFT_SLUG]: { rows: [], loading: false, error: null },
        [DU_SLUG]: { rows: [], loading: false, error: null },
        [INTEREST_SLUG]: { rows: [], loading: false, error: null },
        [ALBUM_SLUG]: { rows: [], loading: false, error: null },
    });

    const getAuthToken = async () => {
        if (accessToken) return accessToken;
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token || null;
    };

    const fetchSummary = async () => {
        try {
            const token = await getAuthToken();
            if (!token) return;
            const res = await fetch('/api/admin/feedback/summary', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setSummary(data);
            }
        } catch (e) {
            console.error('Failed to load feedback summary:', e);
        }
    };

    const fetchCollection = async (slug) => {
        setCollectionsData((prev) => ({
            ...prev,
            [slug]: { ...prev[slug], loading: true, error: null },
        }));

        try {
            const token = await getAuthToken();
            if (!token) throw new Error('Not authenticated');
            const res = await fetch(`/api/admin/feedback/${slug}?limit=150`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to fetch collection');
            }
            const data = await res.json();
            setCollectionsData((prev) => ({
                ...prev,
                [slug]: { rows: data.rows || [], questions: data.questions || [], loading: false, error: null },
            }));
        } catch (err) {
            setCollectionsData((prev) => ({
                ...prev,
                [slug]: { ...prev[slug], loading: false, error: err.message },
            }));
        }
    };

    const reloadAll = async () => {
        await fetchSummary();
        await Promise.all([
            fetchCollection(NIFT_SLUG),
            fetchCollection(DU_SLUG),
            fetchCollection(INTEREST_SLUG),
            fetchCollection(ALBUM_SLUG),
        ]);
    };

    useEffect(() => {
        reloadAll();
    }, [accessToken]);

    const handleCopy = (text, id) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 1800);
    };

    // Filtered lists based on search
    const filterRows = (rows = []) => {
        if (!searchQuery.trim()) return rows;
        const q = searchQuery.toLowerCase();
        return rows.filter((row) =>
            (row.name && row.name.toLowerCase().includes(q)) ||
            (row.email && row.email.toLowerCase().includes(q)) ||
            (row.response && row.response.toLowerCase().includes(q)) ||
            Object.values(row.answers || {}).some((v) => String(v).toLowerCase().includes(q))
        );
    };

    const niftLectureRows = useMemo(() => filterRows(collectionsData[NIFT_SLUG]?.rows || []), [collectionsData, searchQuery]);
    const niftInterestRows = useMemo(() => filterRows(collectionsData[INTEREST_SLUG]?.rows || []), [collectionsData, searchQuery]);
    const niftAlbumRows = useMemo(() => filterRows(collectionsData[ALBUM_SLUG]?.rows || []), [collectionsData, searchQuery]);
    const duRows = useMemo(() => filterRows(collectionsData[DU_SLUG]?.rows || []), [collectionsData, searchQuery]);

    const niftTotalInteractions = (collectionsData[NIFT_SLUG]?.rows?.length || 0) +
        (collectionsData[INTEREST_SLUG]?.rows?.length || 0) +
        (collectionsData[ALBUM_SLUG]?.rows?.length || 0);

    const duTotalResponses = collectionsData[DU_SLUG]?.rows?.length || 0;

    // CSV Exporter for active view
    const handleExportActive = () => {
        if (activeWorkshop === 'du') {
            exportCsv('delhi-university-ethnographic-filmmaking-feedback', collectionsData[DU_SLUG]?.rows || [], [
                { label: 'Date (IST)', getter: (r) => formatISTDate(r.created_at) },
                { label: 'Name', getter: (r) => r.name || 'Anonymous' },
                { label: 'Email', getter: (r) => r.email || '' },
                { label: 'Best Part', getter: (r) => r.answers?.best_part || '' },
                { label: 'Improvements', getter: (r) => r.answers?.improvements || '' },
                { label: 'Future Topics', getter: (r) => r.answers?.future_workshop_topics || '' },
                { label: 'Other Comments', getter: (r) => r.answers?.other_comments || '' },
            ]);
        } else if (niftSubSection === 'interest') {
            exportCsv('nift-photography-workshop-interest', collectionsData[INTEREST_SLUG]?.rows || [], [
                { label: 'Date (IST)', getter: (r) => formatISTDate(r.created_at) },
                { label: 'Name', getter: (r) => r.name || 'Anonymous' },
                { label: 'Email', getter: (r) => r.email || '' },
                { label: 'Interested', getter: (r) => r.answers?.interested || 'Yes, I am interested.' },
            ]);
        } else if (niftSubSection === 'album') {
            exportCsv('nift-photography-album-thoughts', collectionsData[ALBUM_SLUG]?.rows || [], [
                { label: 'Date (IST)', getter: (r) => formatISTDate(r.created_at) },
                { label: 'Name', getter: (r) => r.name || 'Anonymous' },
                { label: 'Email', getter: (r) => r.email || '' },
                { label: 'Album Thoughts', getter: (r) => r.answers?.album_thoughts || r.response || '' },
            ]);
        } else {
            exportCsv('nift-space-materiality-feedback', collectionsData[NIFT_SLUG]?.rows || [], [
                { label: 'Date (IST)', getter: (r) => formatISTDate(r.created_at) },
                { label: 'Name', getter: (r) => r.name || 'Anonymous' },
                { label: 'Email', getter: (r) => r.email || '' },
                { label: 'Feedback', getter: (r) => r.answers?.feedback || r.response || '' },
            ]);
        }
    };

    const isGlobalLoading = Object.values(collectionsData).some((c) => c.loading);

    return (
        <section className="feedback-admin-hub">
            <div className="admin-page-intro">
                <AdminPageHeader
                    title="Feedback"
                    description="Workshop feedback, student responses, photography workshop interest, and photo album thoughts."
                />
            </div>

            <div className="admin-page-spacer" />

            {/* Top Bar Navigation & Controls */}
            <div className="feedback-top-controls">
                <div className="feedback-workshop-tabs" role="tablist" aria-label="Workshop Selector">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeWorkshop === 'nift'}
                        className={`feedback-workshop-tab ${activeWorkshop === 'nift' ? 'is-active' : ''}`}
                        onClick={() => setActiveWorkshop('nift')}
                    >
                        <span>NIFT Bhubaneswar</span>
                        <span className="feedback-tab-badge">{niftTotalInteractions}</span>
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeWorkshop === 'du'}
                        className={`feedback-workshop-tab ${activeWorkshop === 'du' ? 'is-active' : ''}`}
                        onClick={() => setActiveWorkshop('du')}
                    >
                        <span>DU Ethnographic Filmmaking</span>
                        <span className="feedback-tab-badge">{duTotalResponses}</span>
                    </button>
                </div>

                <div className="feedback-top-actions">
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, color: "var(--ui-text-muted)", pointerEvents: 'none' }} />
                        <input
                            type="search"
                            className="feedback-search-input"
                            style={{ paddingLeft: 30 }}
                            placeholder="Search name, email, or response..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button
                        type="button"
                        className="feedback-btn"
                        onClick={handleExportActive}
                        title="Download CSV"
                    >
                        <Download size={14} />
                        <span>Export CSV</span>
                    </button>
                    <button
                        type="button"
                        className="feedback-btn"
                        onClick={reloadAll}
                        disabled={isGlobalLoading}
                        title="Refresh all feedback"
                    >
                        <RefreshCw size={14} className={isGlobalLoading ? 'spin' : ''} />
                    </button>
                </div>
            </div>

            {/* WORKSHOP: NIFT BHUBANESWAR */}
            {activeWorkshop === 'nift' && (
                <div className="feedback-workshop-view">
                    {/* Sub-Section Filter Pills (Clean, non-redundant) */}
                    <div className="feedback-sub-nav">
                        <button
                            type="button"
                            className={`feedback-sub-pill ${niftSubSection === 'all' ? 'is-active' : ''}`}
                            onClick={() => setNiftSubSection('all')}
                        >
                            <span>All</span>
                            <span className="feedback-pill-count">{niftTotalInteractions}</span>
                        </button>
                        <button
                            type="button"
                            className={`feedback-sub-pill ${niftSubSection === 'lecture' ? 'is-active' : ''}`}
                            onClick={() => setNiftSubSection('lecture')}
                        >
                            <span>Lecture Feedback</span>
                            <span className="feedback-pill-count">{collectionsData[NIFT_SLUG]?.rows?.length || 0}</span>
                        </button>
                        <button
                            type="button"
                            className={`feedback-sub-pill ${niftSubSection === 'interest' ? 'is-active' : ''}`}
                            onClick={() => setNiftSubSection('interest')}
                        >
                            <span>Photography Workshop Interest</span>
                            <span className="feedback-pill-count">{collectionsData[INTEREST_SLUG]?.rows?.length || 0}</span>
                        </button>
                        <button
                            type="button"
                            className={`feedback-sub-pill ${niftSubSection === 'album' ? 'is-active' : ''}`}
                            onClick={() => setNiftSubSection('album')}
                        >
                            <span>Album Thoughts</span>
                            <span className="feedback-pill-count">{collectionsData[ALBUM_SLUG]?.rows?.length || 0}</span>
                        </button>
                    </div>

                    {/* Section 1: Lecture Responses */}
                    {(niftSubSection === 'all' || niftSubSection === 'lecture') && (
                        <div className="feedback-stream-block">
                            <div className="feedback-section-title-wrap">
                                <div>
                                    <h3 className="feedback-section-title">Lecture Feedback Responses</h3>
                                    <p className="feedback-section-desc">
                                        Space and Materiality — Material Manipulation with a Focus on Prop Design; Window Design & Budgeting
                                    </p>
                                </div>
                                <span className="feedback-tab-badge">{niftLectureRows.length} {niftLectureRows.length === 1 ? 'response' : 'responses'}</span>
                            </div>

                            {collectionsData[NIFT_SLUG]?.loading ? (
                                <div className="feedback-empty-state"><p>Loading lecture responses…</p></div>
                            ) : niftLectureRows.length === 0 ? (
                                <div className="feedback-empty-state"><p>No lecture feedback responses found.</p></div>
                            ) : (
                                <div className="feedback-responses-list">
                                    {niftLectureRows.map((row) => (
                                        <article key={row.id} className="feedback-card">
                                            <div className="feedback-card__topline">
                                                <div className="feedback-card__participant">
                                                    <div className="feedback-avatar">{getInitials(row.name)}</div>
                                                    <div>
                                                        <h4 className="feedback-card__name">{row.name || 'Anonymous Participant'}</h4>
                                                        {row.email ? (
                                                            <div className="feedback-card__email">
                                                                <a href={`mailto:${row.email}`}>{row.email}</a>
                                                                <button
                                                                    type="button"
                                                                    className="feedback-copy-icon-btn"
                                                                    onClick={() => handleCopy(row.email, `email-${row.id}`)}
                                                                    title="Copy email"
                                                                >
                                                                    {copiedId === `email-${row.id}` ? <Check size={12} color="#137333" /> : <Copy size={12} />}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="feedback-card__email">Email not shared</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="feedback-card__meta-right">
                                                    <span className="feedback-date-pill">{formatISTDate(row.created_at)}</span>
                                                    <button
                                                        type="button"
                                                        className="feedback-btn"
                                                        style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                                                        onClick={() => handleCopy(row.answers?.feedback || row.response, `text-${row.id}`)}
                                                        title="Copy response text"
                                                    >
                                                        {copiedId === `text-${row.id}` ? <Check size={12} color="#137333" /> : <Copy size={12} />}
                                                        <span>{copiedId === `text-${row.id}` ? 'Copied' : 'Copy'}</span>
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="feedback-qa-list">
                                                <div className="feedback-qa-block">
                                                    <span className="feedback-qa-label">What did you think of the lecture?</span>
                                                    <p className="feedback-qa-text">{row.answers?.feedback || row.response || '—'}</p>
                                                </div>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Section 2: People Interested in Photography Workshop */}
                    {(niftSubSection === 'all' || niftSubSection === 'interest') && (
                        <div className="feedback-stream-block" style={{ marginTop: niftSubSection === 'all' ? 36 : 0 }}>
                            <div className="feedback-section-title-wrap">
                                <div>
                                    <h3 className="feedback-section-title">People interested in photography workshop</h3>
                                    <p className="feedback-section-desc">
                                        Students who confirmed their interest for next week’s photography workshop and photo walk.
                                    </p>
                                </div>
                                <span className="feedback-tab-badge">{niftInterestRows.length} interested</span>
                            </div>

                            {collectionsData[INTEREST_SLUG]?.loading ? (
                                <div className="feedback-empty-state"><p>Loading workshop interests…</p></div>
                            ) : niftInterestRows.length === 0 ? (
                                <div className="feedback-empty-state"><p>No workshop interest entries recorded yet.</p></div>
                            ) : (
                                <div className="feedback-responses-list">
                                    {niftInterestRows.map((row) => (
                                        <article key={row.id} className="feedback-card">
                                            <div className="feedback-card__topline">
                                                <div className="feedback-card__participant">
                                                    <div className="feedback-avatar" style={{ background: "var(--color-success)" }}>
                                                        <Camera size={16} />
                                                    </div>
                                                    <div>
                                                        <h4 className="feedback-card__name">{row.name || 'Participant'}</h4>
                                                        {row.email ? (
                                                            <div className="feedback-card__email">
                                                                <a href={`mailto:${row.email}`}>{row.email}</a>
                                                                <button
                                                                    type="button"
                                                                    className="feedback-copy-icon-btn"
                                                                    onClick={() => handleCopy(row.email, `email-${row.id}`)}
                                                                    title="Copy email"
                                                                >
                                                                    {copiedId === `email-${row.id}` ? <Check size={12} color="#137333" /> : <Copy size={12} />}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="feedback-card__email">Linked from lecture response</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="feedback-card__meta-right">
                                                    <span className="feedback-badge-interest">
                                                        <Check size={12} />
                                                        Yes, I am interested.
                                                    </span>
                                                    <span className="feedback-date-pill">{formatISTDate(row.created_at)}</span>
                                                </div>
                                            </div>
                                            <div className="feedback-qa-list">
                                                <div className="feedback-qa-block">
                                                    <span className="feedback-qa-label">Status</span>
                                                    <p className="feedback-qa-text">
                                                        Opted in for the upcoming Photography Workshop + Photo Walk (9–15 November).
                                                        {row.email ? ` Ready to receive workshop invitation at ${row.email}.` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Section 3: Thoughts on the Photo Album */}
                    {(niftSubSection === 'all' || niftSubSection === 'album') && (
                        <div className="feedback-stream-block" style={{ marginTop: niftSubSection === 'all' ? 36 : 0 }}>
                            <div className="feedback-section-title-wrap">
                                <div>
                                    <h3 className="feedback-section-title">Thoughts on the photo album</h3>
                                    <p className="feedback-section-desc">
                                        Private student reflections, feedback, and notes on the photography album.
                                    </p>
                                </div>
                                <span className="feedback-tab-badge">{niftAlbumRows.length} {niftAlbumRows.length === 1 ? 'thought' : 'thoughts'}</span>
                            </div>

                            {collectionsData[ALBUM_SLUG]?.loading ? (
                                <div className="feedback-empty-state"><p>Loading album thoughts…</p></div>
                            ) : niftAlbumRows.length === 0 ? (
                                <div className="feedback-empty-state"><p>No album thoughts submitted yet.</p></div>
                            ) : (
                                <div className="feedback-responses-list">
                                    {niftAlbumRows.map((row) => (
                                        <article key={row.id} className="feedback-card">
                                            <div className="feedback-card__topline">
                                                <div className="feedback-card__participant">
                                                    <div className="feedback-avatar" style={{ background: '#3c4043' }}>
                                                        <Images size={16} />
                                                    </div>
                                                    <div>
                                                        <h4 className="feedback-card__name">{row.name || 'Anonymous Student'}</h4>
                                                        {row.email ? (
                                                            <div className="feedback-card__email">
                                                                <a href={`mailto:${row.email}`}>{row.email}</a>
                                                                <button
                                                                    type="button"
                                                                    className="feedback-copy-icon-btn"
                                                                    onClick={() => handleCopy(row.email, `email-${row.id}`)}
                                                                    title="Copy email"
                                                                >
                                                                    {copiedId === `email-${row.id}` ? <Check size={12} color="#137333" /> : <Copy size={12} />}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="feedback-card__email">Shared privately without email</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="feedback-card__meta-right">
                                                    <span className="feedback-badge-album">Album Review</span>
                                                    <span className="feedback-date-pill">{formatISTDate(row.created_at)}</span>
                                                    <button
                                                        type="button"
                                                        className="feedback-btn"
                                                        style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                                                        onClick={() => handleCopy(row.answers?.album_thoughts || row.response, `album-${row.id}`)}
                                                        title="Copy thoughts text"
                                                    >
                                                        {copiedId === `album-${row.id}` ? <Check size={12} color="#137333" /> : <Copy size={12} />}
                                                        <span>{copiedId === `album-${row.id}` ? 'Copied' : 'Copy'}</span>
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="feedback-qa-list">
                                                <div className="feedback-qa-block">
                                                    <span className="feedback-qa-label">Thoughts on the album</span>
                                                    <p className="feedback-qa-text">{row.answers?.album_thoughts || row.response || '—'}</p>
                                                </div>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* WORKSHOP: DELHI UNIVERSITY */}
            {activeWorkshop === 'du' && (
                <div className="feedback-workshop-view">
                    <div className="feedback-section-title-wrap" style={{ marginTop: 0 }}>
                        <div>
                            <h3 className="feedback-section-title">DU Ethnographic Filmmaking Workshop</h3>
                            <p className="feedback-section-desc">
                                University of Delhi · Department Workshop · All questions and participant suggestions
                            </p>
                        </div>
                        <span className="feedback-tab-badge">{duRows.length} {duRows.length === 1 ? 'response' : 'responses'}</span>
                    </div>

                    {collectionsData[DU_SLUG]?.loading ? (
                        <div className="feedback-empty-state"><p>Loading DU workshop responses…</p></div>
                    ) : duRows.length === 0 ? (
                        <div className="feedback-empty-state"><p>No DU workshop responses found.</p></div>
                    ) : (
                        <div className="feedback-responses-list">
                            {duRows.map((row) => (
                                <article key={row.id} className="feedback-card">
                                    <div className="feedback-card__topline">
                                        <div className="feedback-card__participant">
                                            <div className="feedback-avatar">{getInitials(row.name)}</div>
                                            <div>
                                                <h4 className="feedback-card__name">{row.name || 'Anonymous Participant'}</h4>
                                                {row.email ? (
                                                    <div className="feedback-card__email">
                                                        <a href={`mailto:${row.email}`}>{row.email}</a>
                                                        <button
                                                            type="button"
                                                            className="feedback-copy-icon-btn"
                                                            onClick={() => handleCopy(row.email, `email-${row.id}`)}
                                                            title="Copy email"
                                                        >
                                                            {copiedId === `email-${row.id}` ? <Check size={12} color="#137333" /> : <Copy size={12} />}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="feedback-card__email">Email not shared</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="feedback-card__meta-right">
                                            <span className="feedback-date-pill">{formatISTDate(row.created_at)}</span>
                                            <button
                                                type="button"
                                                className="feedback-btn"
                                                style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                                                onClick={() => handleCopy(row.response, `du-${row.id}`)}
                                                title="Copy all answers"
                                            >
                                                {copiedId === `du-${row.id}` ? <Check size={12} color="#137333" /> : <Copy size={12} />}
                                                <span>{copiedId === `du-${row.id}` ? 'Copied' : 'Copy'}</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* DU Questions Breakdown */}
                                    <div className="feedback-qa-list">
                                        {row.answers?.best_part && (
                                            <div className="feedback-qa-block">
                                                <span className="feedback-qa-label">What was the best part?</span>
                                                <p className="feedback-qa-text">{row.answers.best_part}</p>
                                            </div>
                                        )}
                                        {row.answers?.improvements && (
                                            <div className="feedback-qa-block">
                                                <span className="feedback-qa-label">What could have been improved?</span>
                                                <p className="feedback-qa-text">{row.answers.improvements}</p>
                                            </div>
                                        )}
                                        {row.answers?.future_workshop_topics && (
                                            <div className="feedback-qa-block">
                                                <span className="feedback-qa-label">What would you love to learn in a future workshop?</span>
                                                <p className="feedback-qa-text">{row.answers.future_workshop_topics}</p>
                                            </div>
                                        )}
                                        {row.answers?.other_comments && (
                                            <div className="feedback-qa-block">
                                                <span className="feedback-qa-label">Any other comments?</span>
                                                <p className="feedback-qa-text">{row.answers.other_comments}</p>
                                            </div>
                                        )}
                                        {!row.answers?.best_part && !row.answers?.improvements && !row.answers?.future_workshop_topics && !row.answers?.other_comments && (
                                            <div className="feedback-qa-block">
                                                <span className="feedback-qa-label">Response</span>
                                                <p className="feedback-qa-text">{row.response || '—'}</p>
                                            </div>
                                        )}
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}

