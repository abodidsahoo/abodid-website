import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
    BookOpen,
    Play,
    Plus,
    Trash2,
    Check,
    X,
    Bookmark,
    ThumbsUp,
    ThumbsDown,
    ExternalLink,
    RefreshCw,
    ShieldCheck,
    ShieldAlert,
    Sliders,
    Clock,
    Send,
    AlertCircle,
    CheckCircle2,
    ChevronDown,
    Archive,
    Calendar,
    Eye
} from 'lucide-react';

export default function ReadingDigestManager() {
    const [activeTab, setActiveTab] = useState('readings');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [running, setRunning] = useState(false);
    const [sendingTest, setSendingTest] = useState(false);
    const [openOptionsId, setOpenOptionsId] = useState(null);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [previewModal, setPreviewModal] = useState(null); // { html, subject, recipient, articles }
    const [cachedPreview, setCachedPreview] = useState(null); // pre-fetched in background
    const [previewLoading, setPreviewLoading] = useState(false);
    const [selectedArchiveId, setSelectedArchiveId] = useState(null);

    // Data states
    const [settings, setSettings] = useState({
        recipient_name: 'Abodid',
        recipient_email: 'abodidsahoo@gmail.com',
        sender_name: "Abodid's Intern",
        sender_email: 'hello@abodid.com',
        frequency: 'daily',
        weekly_delivery_day: 1,
        recent_lookback_days: 45,
        enabled: true,
    });
    const [topics, setTopics] = useState([]);
    const [sources, setSources] = useState([]);
    const [readings, setReadings] = useState([]);
    const [savedReadingIds, setSavedReadingIds] = useState(new Set());
    const [feedbackMap, setFeedbackMap] = useState(new Map());
    const [deliveries, setDeliveries] = useState([]);
    const [runs, setRuns] = useState([]);

    // Compute the latest curated 5 articles for Tab 1 (aligned with latest issue)
    const latestDigestItems = (() => {
        if (deliveries && deliveries.length > 0) {
            const latestDel = deliveries[0];
            const delItems = (latestDel.reading_digest_delivery_items || [])
                .sort((a, b) => a.position - b.position)
                .map(item => item.reading_digest_readings)
                .filter(Boolean);
            if (delItems.length > 0) return delItems;
        }
        const valid = readings.filter(r => r.status === 'sent' || r.status === 'selected' || r.status === 'discovered');
        if (valid.length > 0) return valid.slice(0, 5);
        return readings.slice(0, 5);
    })();

    // Build Archives List (date-wise generations + delivered article sets)
    const archivesList = (() => {
        const list = [];
        for (const del of deliveries || []) {
            const items = (del.reading_digest_delivery_items || [])
                .sort((a, b) => a.position - b.position)
                .map(item => item.reading_digest_readings)
                .filter(Boolean);
            list.push({
                id: del.id,
                type: 'delivery',
                date: del.delivery_date || del.created_at?.slice(0, 10),
                createdAt: del.created_at,
                subject: del.subject,
                recipient: del.recipient_email,
                status: del.status,
                html: del.html,
                articles: items,
            });
        }
        for (const run of runs || []) {
            const hasDelivery = deliveries?.some(d => d.run_id === run.id);
            if (!hasDelivery) {
                const runReadings = (readings || [])
                    .filter(r => r.discovery_run_id === run.id && r.status !== 'rejected')
                    .slice(0, 5);
                if (runReadings.length > 0) {
                    list.push({
                        id: run.id,
                        type: 'run',
                        date: run.started_at?.slice(0, 10),
                        createdAt: run.started_at,
                        subject: `Digest Run (${run.trigger_source}) — ${run.started_at?.slice(0, 10)}`,
                        recipient: settings.recipient_email,
                        status: run.status === 'completed' ? 'sent' : run.status,
                        html: null,
                        articles: runReadings,
                    });
                }
            }
        }
        return list
            .filter(entry => entry.articles && entry.articles.length > 0)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    })();

    const selectedArchive = archivesList.find(a => a.id === selectedArchiveId) || archivesList[0];

    useEffect(() => {
        fetchDigestData();
    }, []);

    const fetchDigestData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const [
                settingsRes,
                topicsRes,
                sourcesRes,
                readingsRes,
                savesRes,
                feedbackRes,
                deliveriesRes,
                runsRes
            ] = await Promise.all([
                supabase.from('reading_digest_settings').select('*').eq('id', true).maybeSingle(),
                supabase.from('reading_digest_topics').select('*').order('weight', { ascending: false }),
                supabase.from('reading_digest_sources').select('*').order('disposition').order('domain'),
                supabase.from('reading_digest_readings').select('*').order('first_discovered_at', { ascending: false }).limit(60),
                user ? supabase.from('reading_digest_saves').select('reading_id').eq('user_id', user.id) : { data: [] },
                supabase.from('reading_digest_feedback').select('reading_id, signal, created_at').order('created_at', { ascending: false }).limit(200),
                supabase.from('reading_digest_deliveries').select('*, reading_digest_delivery_items(*, reading_digest_readings(*))').order('created_at', { ascending: false }).limit(30),
                supabase.from('reading_digest_runs').select('*').order('started_at', { ascending: false }).limit(30),
            ]);

            if (settingsRes.error) {
                if (settingsRes.error.code === '42P01' || settingsRes.error.message?.includes('schema cache') || settingsRes.error.message?.includes('Could not find')) {
                    setMessage({
                        type: 'error',
                        text: 'Database tables not found in Supabase yet. Please run the SQL migration (supabase/migrations/20260804100000_create_daily_reading_digest.sql) in your Supabase SQL Editor.'
                    });
                    setLoading(false);
                    return;
                }
            }

            if (settingsRes.data) {
                setSettings({
                    ...settingsRes.data,
                    sender_name: (!settingsRes.data.sender_name || settingsRes.data.sender_name === 'Abodid reads') ? "Abodid's Intern" : settingsRes.data.sender_name
                });
            }
            if (topicsRes.data) setTopics(topicsRes.data);
            if (sourcesRes.data) setSources(sourcesRes.data);
            if (readingsRes.data) setReadings(readingsRes.data);
            if (savesRes.data) setSavedReadingIds(new Set(savesRes.data.map(s => s.reading_id)));

            if (feedbackRes.data) {
                const map = new Map();
                for (const item of feedbackRes.data) {
                    map.set(item.reading_id, [...(map.get(item.reading_id) || []), item.signal]);
                }
                setFeedbackMap(map);
            }

            if (deliveriesRes.data) setDeliveries(deliveriesRes.data);
            if (runsRes.data) setRuns(runsRes.data);
        } catch (err) {
            console.error('Error fetching reading digest data:', err);
            setMessage({ type: 'error', text: err.message });
        } finally {
            setLoading(false);
        }
        // Pre-fetch preview silently in the background so the modal opens instantly
        prefetchPreview();
    };

    // Silently fetch the preview HTML in the background — no loading states shown
    const prefetchPreview = async () => {
        try {
            const { data, error } = await supabase.functions.invoke('daily-reading-digest', {
                body: { trigger: 'preview_email', articles: latestDigestItems }
            });
            if (!error && data && !data.error) {
                setCachedPreview({ html: data.html, subject: data.subject, recipient: data.recipient, articles: data.articles });
            }
        } catch (_) {
            // Silently ignore — the button will fall back to a live fetch
        }
    };

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage({ type: '', text: '' });
        try {
            const { error } = await supabase.from('reading_digest_settings').upsert({
                id: true,
                recipient_name: settings.recipient_name,
                recipient_email: settings.recipient_email,
                sender_name: settings.sender_name,
                sender_email: settings.sender_email,
                frequency: settings.frequency,
                weekly_delivery_day: Number(settings.weekly_delivery_day),
                recent_lookback_days: Number(settings.recent_lookback_days),
                enabled: settings.enabled,
            });
            if (error) throw error;
            setMessage({ type: 'success', text: 'Settings updated successfully!' });
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleRunNow = async () => {
        if (!confirm('Run the reading digest generator now? This will discover articles, rank them, and dispatch email.')) return;
        setRunning(true);
        setCachedPreview(null);
        setMessage({ type: 'info', text: 'Digest run triggered...' });
        try {
            const { data, error } = await supabase.functions.invoke('daily-reading-digest', {
                body: { trigger: 'manual_admin', force: true }
            });
            if (error) {
                let errorMsg = error.message;
                if (error.context && typeof error.context.json === 'function') {
                    try {
                        const body = await error.context.json();
                        if (body.error) errorMsg = body.error;
                    } catch (_) {}
                }
                throw new Error(errorMsg);
            }
            if (data?.error) throw new Error(data.error);
            setMessage({ type: 'success', text: 'Digest run completed successfully!' });
            await fetchDigestData();
        } catch (err) {
            await fetchDigestData();
            setMessage({ type: 'error', text: 'Run failed: ' + err.message });
        } finally {
            setRunning(false);
        }
    };

    const handlePreviewTestEmail = async () => {
        if (!settings.recipient_email) {
            setMessage({ type: 'error', text: 'Please configure a recipient email address first.' });
            return;
        }
        // If we already pre-fetched the preview, open it instantly and refresh cache in background
        if (cachedPreview) {
            setPreviewModal(cachedPreview);
            setCachedPreview(null);
            prefetchPreview();
            return;
        }
        // Otherwise fall back to a live fetch (e.g. user clicked very quickly)
        setPreviewLoading(true);
        setSendingTest(true);
        try {
            const { data, error } = await supabase.functions.invoke('daily-reading-digest', {
                body: { trigger: 'preview_email', articles: latestDigestItems }
            });
            if (error) {
                let errorMsg = error.message;
                if (error.context && typeof error.context.json === 'function') {
                    try { const body = await error.context.json(); if (body.error) errorMsg = body.error; } catch (_) {}
                }
                throw new Error(errorMsg);
            }
            if (data?.error) throw new Error(data.error);
            const preview = { html: data.html, subject: data.subject, recipient: data.recipient, articles: data.articles };
            setCachedPreview(preview);
            setPreviewModal(preview);
        } catch (err) {
            setMessage({ type: 'error', text: 'Preview failed: ' + err.message });
        } finally {
            setSendingTest(false);
            setPreviewLoading(false);
        }
    };

    const handleConfirmSendTestEmail = async () => {
        setSendingTest(true);
        setPreviewModal(null);
        setMessage({ type: 'info', text: `Sending test email to ${settings.recipient_email}...` });
        try {
            const { data, error } = await supabase.functions.invoke('daily-reading-digest', {
                body: { trigger: 'test_email' }
            });
            if (error) {
                let errorMsg = error.message;
                if (error.context && typeof error.context.json === 'function') {
                    try { const body = await error.context.json(); if (body.error) errorMsg = body.error; } catch (_) {}
                }
                throw new Error(errorMsg);
            }
            if (data?.error) throw new Error(data.error);
            setMessage({ type: 'success', text: `Test digest email sent to ${settings.recipient_email}!` });
            await fetchDigestData();
        } catch (err) {
            setMessage({ type: 'error', text: 'Send failed: ' + err.message });
        } finally {
            setSendingTest(false);
        }
    };

    // Topics actions
    const handleAddTopic = async (e) => {
        e.preventDefault();
        if (!newTopic.name.trim()) return;
        try {
            const { error } = await supabase.from('reading_digest_topics').insert({
                name: newTopic.name.trim(),
                description: newTopic.description.trim(),
                weight: Number(newTopic.weight),
                active: true,
            });
            if (error) throw error;
            setNewTopic({ name: '', description: '', weight: 1.0 });
            await fetchDigestData();
            setMessage({ type: 'success', text: 'Topic added.' });
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        }
    };

    const handleToggleTopic = async (id, currentActive) => {
        try {
            const { error } = await supabase.from('reading_digest_topics').update({ active: !currentActive }).eq('id', id);
            if (error) throw error;
            await fetchDigestData();
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        }
    };

    const handleDeleteTopic = async (id) => {
        if (!confirm('Remove this topic?')) return;
        try {
            const { error } = await supabase.from('reading_digest_topics').delete().eq('id', id);
            if (error) throw error;
            await fetchDigestData();
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        }
    };

    // Sources actions
    const handleAddSource = async (e) => {
        e.preventDefault();
        const domainClean = newTopicDomain(newSource.domain);
        if (!domainClean) return;
        try {
            const { error } = await supabase.from('reading_digest_sources').upsert({
                domain: domainClean,
                name: newSource.name.trim(),
                disposition: newSource.disposition,
                notes: newSource.notes.trim(),
                active: true,
            }, { onConflict: 'domain' });
            if (error) throw error;
            setNewSource({ domain: '', name: '', disposition: 'trusted', notes: '' });
            await fetchDigestData();
            setMessage({ type: 'success', text: 'Domain rule saved.' });
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        }
    };

    const newTopicDomain = (input) => {
        const raw = input.trim().toLowerCase();
        if (!raw) return '';
        try {
            return new URL(raw.includes('://') ? raw : `https://${raw}`).hostname.replace(/^www\./, '');
        } catch {
            return raw;
        }
    };

    const handleToggleSource = async (id, currentActive) => {
        try {
            const { error } = await supabase.from('reading_digest_sources').update({ active: !currentActive }).eq('id', id);
            if (error) throw error;
            await fetchDigestData();
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        }
    };

    const handleDeleteSource = async (id) => {
        if (!confirm('Delete this source rule?')) return;
        try {
            const { error } = await supabase.from('reading_digest_sources').delete().eq('id', id);
            if (error) throw error;
            await fetchDigestData();
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        }
    };

    // Bookmark reading
    const handleToggleSave = async (readingId) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const isSaved = savedReadingIds.has(readingId);
            if (isSaved) {
                await supabase.from('reading_digest_saves').delete().eq('user_id', user.id).eq('reading_id', readingId);
                const next = new Set(savedReadingIds);
                next.delete(readingId);
                setSavedReadingIds(next);
            } else {
                await supabase.from('reading_digest_saves').insert({ user_id: user.id, reading_id: readingId });
                setSavedReadingIds(new Set([...savedReadingIds, readingId]));
            }
        } catch (err) {
            console.error('Error toggling save:', err);
        }
    };

    // Send Feedback
    const handleSendFeedback = async (readingId, signal) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            await supabase.from('reading_digest_feedback').insert({
                reading_id: readingId,
                user_id: user.id,
                signal: signal
            });
            const current = feedbackMap.get(readingId) || [];
            const nextMap = new Map(feedbackMap);
            nextMap.set(readingId, [...current, signal]);
            setFeedbackMap(nextMap);
        } catch (err) {
            console.error('Error sending feedback:', err);
        }
    };

    if (loading) {
        return (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <RefreshCw size={24} className="spin-icon" style={{ marginBottom: '1rem' }} />
                <p>Loading Reading Digest control panel...</p>
                <style>{`.spin-icon { animation: spin 1.2s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    const latestRun = runs[0];

    return (
        <div className="rd-admin">
            {/* Header */}
            <div className="rd-admin-header">
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.3rem' }}>
                        <p className="rd-admin-kicker" style={{ margin: 0 }}>AUTOMATED RESEARCH & DAILY DIGEST</p>
                        <span className={`rd-badge ${settings.enabled && settings.frequency !== 'paused' ? 'rd-badge-success' : 'rd-badge-muted'}`}>
                            {settings.enabled && settings.frequency !== 'paused' ? 'Active' : 'Paused'}
                        </span>
                    </div>
                    <h2>
                        <BookOpen size={32} style={{ marginRight: '0.65rem', verticalAlign: 'middle' }} />
                        Reader's Digest
                    </h2>
                    <span className="rd-admin-subtitle">
                        Hi {settings.recipient_name || 'Abodid'}, I have curated these amazing articles for you to read today.
                    </span>
                </div>

                <div className="rd-admin-header-actions">
                    <button type="button" onClick={handlePreviewTestEmail} disabled={sendingTest || running} className="rd-btn rd-btn-secondary">
                        <Send size={15} /> {previewLoading ? 'Loading Preview...' : cachedPreview ? 'Preview Test Email' : 'Preview Test Email'}
                    </button>
                    <button type="button" onClick={handleRunNow} disabled={running || sendingTest} className="rd-btn rd-btn-primary">
                        <Play size={15} fill="currentColor" /> {running ? 'Running Digest...' : 'Run Digest Now'}
                    </button>
                </div>
            </div>

            {/* Alert Messages */}
            {message.text && (
                <div className={`rd-alert rd-alert--${message.type === 'error' ? 'error' : 'success'}`}>
                    {message.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                    <span style={{ flex: 1 }}>{message.text}</span>
                    <button type="button" onClick={() => setMessage({ type: '', text: '' })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* 2-COLUMN XR SHOWCASE GRID LAYOUT */}
            <div className="rd-admin-layout">
                {/* LEFT SIDEBAR: CONTROLLERS & NAVIGATION */}
                <aside className="rd-admin-sidebar">
                    <div className="rd-sidebar-block">
                        <p className="rd-sidebar-title">NAVIGATION & PANELS</p>
                        <div className="rd-sidebar-menu">
                            {[
                                { id: 'readings', label: "Reader's Digest", icon: BookOpen, count: 5 },
                                { id: 'archive', label: 'Curation Archives', icon: Archive, count: archivesList.length },
                                { id: 'overview', label: 'Delivery & Settings', icon: Sliders },
                                { id: 'topics', label: 'Topics & Weights', icon: BookOpen, count: topics.filter(t => t.active).length },
                                { id: 'sources', label: 'Source Rules', icon: ShieldCheck, count: sources.length },
                                { id: 'activity', label: 'Run & Delivery Logs', icon: Clock }
                            ].map(item => {
                                const Icon = item.icon;
                                const isActive = activeTab === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setActiveTab(item.id)}
                                        className={`rd-sidebar-btn ${isActive ? 'active' : ''}`}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                            <Icon size={16} />
                                            <span>{item.label}</span>
                                        </div>
                                        {item.count !== undefined && (
                                            <span className="rd-sidebar-count">{item.count}</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* DOCKED QUICK CONTROLLER FORM */}
                    <div className="rd-sidebar-block rd-sidebar-controls">
                        <p className="rd-sidebar-title">QUICK CONTROLLERS</p>
                        <form onSubmit={handleSaveSettings} style={{ display: 'grid', gap: '0.85rem' }}>
                            <div className="rd-field">
                                <label>Recipient Email</label>
                                <input
                                    type="email" required
                                    value={settings.recipient_email}
                                    onChange={e => setSettings({ ...settings, recipient_email: e.target.value })}
                                />
                            </div>
                            <div className="rd-field">
                                <label>Schedule</label>
                                <select
                                    value={settings.frequency}
                                    onChange={e => setSettings({ ...settings, frequency: e.target.value, enabled: e.target.value !== 'paused' })}
                                >
                                    <option value="daily">Daily (08:00 IST)</option>
                                    <option value="weekdays">Weekdays (Mon-Fri)</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="paused">Paused</option>
                                </select>
                            </div>
                            <button type="submit" disabled={saving} className="rd-btn rd-btn-secondary" style={{ width: '100%', marginTop: '0.35rem', justifyContent: 'center' }}>
                                {saving ? 'Saving...' : 'Save Settings'}
                            </button>
                        </form>
                    </div>
                </aside>

                {/* RIGHT MAIN STAGE: READER'S DIGEST & CONTROLLER PANELS */}
                <main className="rd-admin-main">
                    {/* TAB 1: READINGS & DIGEST SHOWCASE (PRIMARY / DEFAULT) */}
                    {activeTab === 'readings' && (
                        <div>
                            <div style={{ marginBottom: '1.75rem', paddingBottom: '1.1rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <p className="rd-admin-kicker">TODAY'S CURATED SELECTION</p>
                                    <h3 style={{ fontSize: '1.45rem', margin: '0.2rem 0 0 0', fontWeight: 700 }}>5 Curated Readings for Today</h3>
                                </div>
                                <span className="rd-badge rd-badge-success">Verified Search</span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                {latestDigestItems.map((reading, index) => {
                                    const isSaved = savedReadingIds.has(reading.id);
                                    const signals = feedbackMap.get(reading.id) || [];
                                    const isOptionsOpen = openOptionsId === reading.id;

                                    return (
                                        <article
                                            key={reading.id}
                                            className="rd-reading-card"
                                            style={{ padding: '1.1rem 1.35rem', borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--bg-color)', position: 'relative' }}
                                        >
                                            {/* Top Meta Bar + Dropdown Toggle */}
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                                    <span className="rd-domain-pill">{reading.source_domain}</span>

                                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                                                        {reading.estimated_reading_minutes || 4} min read
                                                    </span>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => setOpenOptionsId(isOptionsOpen ? null : reading.id)}
                                                    className="rd-btn rd-btn-secondary"
                                                    style={{ padding: '0.25rem 0.55rem', minHeight: 'auto', borderRadius: '6px', fontSize: '0.75rem', gap: '0.25rem' }}
                                                    title="Options & Feedback"
                                                >
                                                    <span>Options</span>
                                                    <ChevronDown size={13} style={{ transform: isOptionsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                                                </button>
                                            </div>

                                            {/* Prominent Main Article Title - Clicking opens article directly */}
                                            <h4 className="rd-reading-title" style={{ margin: '0.4rem 0 0.45rem 0', fontSize: '1.35rem', lineHeight: '1.3', fontWeight: 700 }}>
                                                <a href={reading.url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>
                                                    {index + 1}. {reading.title} <ExternalLink size={14} style={{ verticalAlign: 'middle', marginLeft: '0.25rem', opacity: 0.65 }} />
                                                </a>
                                            </h4>

                                            {/* Compact Summary */}
                                            {reading.why_it_matters && (
                                                <p className="rd-reading-why" style={{ fontSize: '0.88rem', lineHeight: '1.5', color: 'var(--text-secondary)', margin: 0 }}>
                                                    {reading.why_it_matters}
                                                </p>
                                            )}

                                            {/* EXPANDABLE DROPDOWN PANEL FOR FEEDBACK & TOPICS */}
                                            {isOptionsOpen && (
                                                <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                        <div style={{ display: 'flex', gap: '0.45rem' }}>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    const btn = e.currentTarget;
                                                                    btn.classList.add('rd-pop-anim');
                                                                    setTimeout(() => btn.classList.remove('rd-pop-anim'), 400);
                                                                    handleToggleSave(reading.id);
                                                                }}
                                                                title={isSaved ? 'Remove Bookmark' : 'Save Reading to Library'}
                                                                className={`rd-btn rd-btn-secondary ${isSaved ? 'rd-badge-success' : ''}`}
                                                                style={{ padding: '0.35rem 0.65rem', minHeight: 'auto', gap: '0.35rem', fontSize: '0.76rem' }}
                                                            >
                                                                <Bookmark size={13} fill={isSaved ? 'currentColor' : 'none'} />
                                                                <span>{isSaved ? 'Saved' : 'Save'}</span>
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    const btn = e.currentTarget;
                                                                    btn.classList.add('rd-pop-anim');
                                                                    setTimeout(() => btn.classList.remove('rd-pop-anim'), 400);
                                                                    handleSendFeedback(reading.id, 'helpful');
                                                                }}
                                                                title="Upvote / Steer future searches into this zone"
                                                                className="rd-btn rd-btn-secondary"
                                                                style={{
                                                                    padding: '0.35rem 0.65rem', minHeight: 'auto', gap: '0.35rem', fontSize: '0.76rem',
                                                                    color: (signals.includes('helpful') || signals.includes('useful')) ? '#22c55e' : 'inherit',
                                                                    borderColor: (signals.includes('helpful') || signals.includes('useful')) ? 'color-mix(in srgb, #22c55e 40%, transparent)' : 'var(--border-subtle)'
                                                                }}
                                                            >
                                                                <ThumbsUp size={13} fill={(signals.includes('helpful') || signals.includes('useful')) ? 'currentColor' : 'none'} />
                                                                <span>{(signals.includes('helpful') || signals.includes('useful')) ? 'Upvoted' : 'Helpful'}</span>
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    const btn = e.currentTarget;
                                                                    btn.classList.add('rd-pop-anim');
                                                                    setTimeout(() => btn.classList.remove('rd-pop-anim'), 400);
                                                                    handleSendFeedback(reading.id, 'not_for_me');
                                                                }}
                                                                title="Not for me / Reduce similar topics"
                                                                className="rd-btn rd-btn-secondary"
                                                                style={{
                                                                    padding: '0.35rem 0.65rem', minHeight: 'auto', gap: '0.35rem', fontSize: '0.76rem',
                                                                    color: signals.includes('not_for_me') ? '#ef4444' : 'inherit',
                                                                    borderColor: signals.includes('not_for_me') ? 'color-mix(in srgb, #ef4444 40%, transparent)' : 'var(--border-subtle)'
                                                                }}
                                                            >
                                                                <ThumbsDown size={13} fill={signals.includes('not_for_me') ? 'currentColor' : 'none'} />
                                                                <span>{signals.includes('not_for_me') ? 'Disliked' : 'Not for me'}</span>
                                                            </button>
                                                        </div>

                                                        {reading.topic_names && reading.topic_names.length > 0 && (
                                                            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                                                                {reading.topic_names.map(t => (
                                                                    <span key={t} className="rd-badge rd-badge-muted" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
                                                                        #{t}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </article>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* TAB 2: OVERVIEW & SETTINGS */}
                    {activeTab === 'overview' && (
                        <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div className="rd-panel-header">
                                <h3>Digest Delivery Configuration</h3>
                                <p>Manage recipient details and delivery schedule frequency.</p>
                            </div>

                            <div className="rd-form-grid">
                                <div className="rd-field">
                                    <label>Recipient Email Address</label>
                                    <input
                                        type="email" required
                                        value={settings.recipient_email}
                                        onChange={e => setSettings({ ...settings, recipient_email: e.target.value })}
                                        placeholder="abodidsahoo@gmail.com"
                                    />
                                </div>

                                <div className="rd-field">
                                    <label>Recipient Name</label>
                                    <input
                                        type="text" required
                                        value={settings.recipient_name}
                                        onChange={e => setSettings({ ...settings, recipient_name: e.target.value })}
                                        placeholder="Abodid"
                                    />
                                </div>

                                <div className="rd-field">
                                    <label>Schedule Frequency</label>
                                    <select
                                        value={settings.frequency}
                                        onChange={e => setSettings({ ...settings, frequency: e.target.value })}
                                    >
                                        <option value="daily">Daily (Every day at 08:00 IST)</option>
                                        <option value="weekdays">Weekdays (Monday to Friday)</option>
                                        <option value="weekly">Weekly (Once a week)</option>
                                        <option value="paused">Paused (Disable scheduled emails)</option>
                                    </select>
                                </div>

                                {settings.frequency === 'weekly' && (
                                    <div className="rd-field">
                                        <label>Weekly Delivery Day</label>
                                        <select
                                            value={settings.weekly_delivery_day}
                                            onChange={e => setSettings({ ...settings, weekly_delivery_day: Number(e.target.value) })}
                                        >
                                            <option value={1}>Monday</option>
                                            <option value={2}>Tuesday</option>
                                            <option value={3}>Wednesday</option>
                                            <option value={4}>Thursday</option>
                                            <option value={5}>Friday</option>
                                            <option value={6}>Saturday</option>
                                            <option value={0}>Sunday</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="rd-form-footer">
                                <button type="button" onClick={handlePreviewTestEmail} disabled={sendingTest || saving} className="rd-btn rd-btn-secondary">
                                    <Send size={15} /> {previewLoading ? 'Loading Preview...' : 'Preview Test Email'}
                                </button>
                                <button type="submit" disabled={saving} className="rd-btn rd-btn-primary">
                                    {saving ? 'Saving Settings...' : 'Save Configuration'}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* TAB 3: TOPICS & WEIGHTS */}
                    {activeTab === 'topics' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                            {/* Add Topic Form */}
                            <div>
                                <div className="rd-panel-header" style={{ marginBottom: '1rem' }}>
                                    <h3>Add Interest Topic</h3>
                                    <p>Topics define research interests used to discover and rank articles.</p>
                                </div>
                                <form onSubmit={handleAddTopic} style={{ display: 'grid', gridTemplateColumns: '2fr 3fr 1fr auto', gap: '1rem', alignItems: 'flex-end' }}>
                                    <div className="rd-field">
                                        <label>Topic Name</label>
                                        <input
                                            type="text" required placeholder="e.g. Generative Design"
                                            value={newTopic.name} onChange={e => setNewTopic({ ...newTopic, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="rd-field">
                                        <label>Description / Focus</label>
                                        <input
                                            type="text" placeholder="e.g. Algorithmic architecture & code art"
                                            value={newTopic.description} onChange={e => setNewTopic({ ...newTopic, description: e.target.value })}
                                        />
                                    </div>
                                    <div className="rd-field">
                                        <label>Weight (0.1 - 5.0)</label>
                                        <input
                                            type="number" step="0.1" min="0.1" max="5.0"
                                            value={newTopic.weight} onChange={e => setNewTopic({ ...newTopic, weight: e.target.value })}
                                        />
                                    </div>
                                    <button type="submit" className="rd-btn rd-btn-primary">
                                        <Plus size={15} /> Add Topic
                                    </button>
                                </form>
                            </div>

                            {/* Topics List */}
                            <div style={{ paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
                                <div className="rd-panel-header" style={{ marginBottom: '1rem' }}>
                                    <h3>Active Topics ({topics.length})</h3>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {topics.map(topic => (
                                        <div
                                            key={topic.id}
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                padding: '1rem 1.25rem', borderRadius: '8px', border: '1px solid var(--border-subtle)',
                                                background: topic.active ? 'var(--bg-surface)' : 'var(--bg-color)',
                                                opacity: topic.active ? 1 : 0.6
                                            }}
                                        >
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{topic.name}</strong>
                                                    <span className="rd-badge rd-badge-muted">
                                                        Weight: {topic.weight}
                                                    </span>
                                                </div>
                                                {topic.description && (
                                                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                        {topic.description}
                                                    </p>
                                                )}
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleTopic(topic.id, topic.active)}
                                                    className="rd-btn rd-btn-secondary"
                                                    style={{ minHeight: '2rem', padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                                                >
                                                    {topic.active ? 'Pause' : 'Enable'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteTopic(topic.id)}
                                                    style={{
                                                        padding: '0.4rem', borderRadius: '6px', border: 'none',
                                                        background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', cursor: 'pointer'
                                                    }}
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 4: SOURCE RULES */}
                    {activeTab === 'sources' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                            {/* Add Source Rule */}
                            <div>
                                <div className="rd-panel-header" style={{ marginBottom: '1rem' }}>
                                    <h3>Add Domain Filter Rule</h3>
                                    <p>Configure domain rules to prioritize trusted publications or block unwanted sites.</p>
                                </div>
                                <form onSubmit={handleAddSource} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 2fr auto', gap: '1rem', alignItems: 'flex-end' }}>
                                    <div className="rd-field">
                                        <label>Domain</label>
                                        <input
                                            type="text" required placeholder="e.g. tate.org.uk"
                                            value={newSource.domain} onChange={e => setNewSource({ ...newSource, domain: e.target.value })}
                                        />
                                    </div>
                                    <div className="rd-field">
                                        <label>Publisher Name</label>
                                        <input
                                            type="text" placeholder="e.g. Tate Britain"
                                            value={newSource.name} onChange={e => setNewSource({ ...newSource, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="rd-field">
                                        <label>Disposition</label>
                                        <select
                                            value={newSource.disposition}
                                            onChange={e => setNewSource({ ...newSource, disposition: e.target.value })}
                                        >
                                            <option value="trusted">Trusted</option>
                                            <option value="blocked">Blocked</option>
                                        </select>
                                    </div>
                                    <div className="rd-field">
                                        <label>Notes</label>
                                        <input
                                            type="text" placeholder="Reason or context"
                                            value={newSource.notes} onChange={e => setNewSource({ ...newSource, notes: e.target.value })}
                                        />
                                    </div>
                                    <button type="submit" className="rd-btn rd-btn-primary">
                                        <Plus size={15} /> Save Rule
                                    </button>
                                </form>
                            </div>

                            {/* Sources Grid */}
                            <div style={{ paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
                                <div className="rd-panel-header" style={{ marginBottom: '1rem' }}>
                                    <h3>Domain Rules ({sources.length})</h3>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                                    {sources.map(source => (
                                        <div
                                            key={source.id}
                                            style={{
                                                padding: '1.1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)',
                                                background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                                            }}
                                        >
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                                    <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{source.domain}</strong>
                                                    <span className={`rd-badge ${source.disposition === 'trusted' ? 'rd-badge-success' : 'rd-badge-muted'}`}>
                                                        {source.disposition}
                                                    </span>
                                                </div>
                                                {source.name && <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{source.name}</p>}
                                                {source.notes && <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{source.notes}</p>}
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleSource(source.id, source.active)}
                                                    className="rd-btn rd-btn-secondary"
                                                    style={{ minHeight: '2rem', padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                                                >
                                                    {source.active ? 'Pause' : 'Enable'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteSource(source.id)}
                                                    style={{
                                                        padding: '0.35rem', borderRadius: '6px', border: 'none',
                                                        background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', cursor: 'pointer'
                                                    }}
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 5: CURATION ARCHIVES */}
                    {activeTab === 'archive' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', boxSizing: 'border-box' }}>
                            <div className="rd-panel-header">
                                <h3>Curation Archives</h3>
                                <p>Date-wise archive of daily digest generations, manual runs, and delivered newsletter article sets.</p>
                            </div>

                            {archivesList.length === 0 ? (
                                <div style={{ padding: '3rem 1.5rem', textAlign: 'center', background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                                    <Archive size={40} style={{ color: 'var(--text-tertiary)', marginBottom: '0.75rem' }} />
                                    <h4 style={{ margin: '0 0 0.4rem 0', color: 'var(--text-primary)' }}>No archived digest runs yet</h4>
                                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                        Run a digest or send a test email to generate your first archive entry.
                                    </p>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: '1.5rem', alignItems: 'start' }}>
                                    {/* Master List of Archive Generations */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '720px', overflowY: 'auto', paddingRight: '4px' }}>
                                        {archivesList.map((entry) => {
                                            const isSelected = (selectedArchive?.id === entry.id);
                                            return (
                                                <button
                                                    key={entry.id}
                                                    type="button"
                                                    onClick={() => setSelectedArchiveId(entry.id)}
                                                    style={{
                                                        textAlign: 'left',
                                                        padding: '0.95rem 1.1rem',
                                                        borderRadius: '10px',
                                                        border: isSelected ? '2px solid var(--accent-color, #0f172a)' : '1px solid var(--border-subtle)',
                                                        background: isSelected ? 'var(--bg-hover, rgba(255,255,255,0.06))' : 'var(--bg-surface)',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease',
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                                        <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                                                            {entry.date}
                                                        </span>
                                                        <span className={`rd-badge ${entry.status === 'sent' || entry.status === 'completed' ? 'rd-badge-success' : entry.status === 'failed' ? 'rd-badge-danger' : 'rd-badge-muted'}`} style={{ fontSize: '0.68rem' }}>
                                                            {entry.status}
                                                        </span>
                                                    </div>
                                                    <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                        {entry.subject}
                                                    </h4>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                                        <span>{entry.articles?.length || 0} articles</span>
                                                        <span>{entry.createdAt ? new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Detail View of Selected Archive */}
                                    {selectedArchive ? (
                                        <div style={{ background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border-subtle)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                            {/* Archive Entry Header */}
                                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
                                                        <span className={`rd-badge ${selectedArchive.status === 'sent' || selectedArchive.status === 'completed' ? 'rd-badge-success' : 'rd-badge-muted'}`}>
                                                            {selectedArchive.status}
                                                        </span>
                                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                                                            {selectedArchive.createdAt ? new Date(selectedArchive.createdAt).toLocaleString() : ''}
                                                        </span>
                                                    </div>
                                                    <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>{selectedArchive.subject}</h3>
                                                    {selectedArchive.recipient && (
                                                        <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                                            Recipient: {selectedArchive.recipient}
                                                        </p>
                                                    )}
                                                </div>

                                                {selectedArchive.html && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setPreviewModal({ html: selectedArchive.html, subject: selectedArchive.subject, recipient: selectedArchive.recipient, articles: selectedArchive.articles })}
                                                        className="rd-btn rd-btn-secondary"
                                                        style={{ gap: '0.4rem' }}
                                                    >
                                                        <Eye size={15} /> View Email Newsletter
                                                    </button>
                                                )}
                                            </div>

                                            {/* Curated Article Set for this Archive */}
                                            <div>
                                                <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                    Curated Articles ({selectedArchive.articles?.length || 0})
                                                </h4>
                                                {(!selectedArchive.articles || selectedArchive.articles.length === 0) ? (
                                                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>No individual article records associated with this generation.</p>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                                        {selectedArchive.articles.map((art, idx) => (
                                                            <div
                                                                key={art.id || idx}
                                                                style={{
                                                                    padding: '1rem 1.15rem',
                                                                    borderRadius: '8px',
                                                                    border: '1px solid var(--border-subtle)',
                                                                    background: 'var(--bg-color)',
                                                                }}
                                                            >
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                                                                    <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>#{idx + 1}</span>
                                                                    <span className="rd-domain-pill">{art.source_domain}</span>
                                                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                                                                        {art.estimated_reading_minutes || 5} min read
                                                                    </span>
                                                                </div>
                                                                <h5 style={{ margin: '0 0 0.35rem 0', fontSize: '0.98rem', fontWeight: 600 }}>
                                                                    <a href={art.url || art.canonical_url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                                                        {art.title} <ExternalLink size={13} style={{ color: 'var(--text-tertiary)' }} />
                                                                    </a>
                                                                </h5>
                                                                {art.why_it_matters && (
                                                                    <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                                                        {art.why_it_matters}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ padding: '3rem', textAlign: 'center', background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}>
                                            Select an archive entry from the left column to view its articles.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 6: RUN & DELIVERY LOGS */}
                    {activeTab === 'activity' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', width: '100%', boxSizing: 'border-box' }}>
                            {/* Execution Runs */}
                            <div>
                                <div className="rd-panel-header" style={{ marginBottom: '1rem' }}>
                                    <h3>Pipeline Execution Runs</h3>
                                    <p>Detailed log of discovery and ranking runs.</p>
                                </div>
                                <div style={{ overflowX: 'auto', width: '100%' }}>
                                    <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-tertiary)', fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                                                <th style={{ width: '24%', padding: '0.75rem' }}>Started At</th>
                                                <th style={{ width: '14%', padding: '0.75rem' }}>Trigger</th>
                                                <th style={{ width: '14%', padding: '0.75rem' }}>Status</th>
                                                <th style={{ width: '10%', padding: '0.75rem', textAlign: 'center' }}>Disc.</th>
                                                <th style={{ width: '10%', padding: '0.75rem', textAlign: 'center' }}>Verif.</th>
                                                <th style={{ width: '10%', padding: '0.75rem', textAlign: 'center' }}>Select.</th>
                                                <th style={{ width: '18%', padding: '0.75rem' }}>Error</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {runs.map(run => (
                                                <tr key={run.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                                    <td style={{ padding: '0.75rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{new Date(run.started_at).toLocaleString('en-IN')}</td>
                                                    <td style={{ padding: '0.75rem', textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{run.trigger_source}</td>
                                                    <td style={{ padding: '0.75rem' }}>
                                                        <span className={`rd-badge ${run.status === 'completed' ? 'rd-badge-success' : 'rd-badge-muted'}`}>
                                                            {run.status}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '0.75rem', color: 'var(--text-primary)', textAlign: 'center' }}>{run.discovered_count}</td>
                                                    <td style={{ padding: '0.75rem', color: 'var(--text-primary)', textAlign: 'center' }}>{run.verified_count}</td>
                                                    <td style={{ padding: '0.75rem', color: 'var(--text-primary)', textAlign: 'center' }}>{run.selected_count}</td>
                                                    <td style={{ padding: '0.75rem', color: '#ef4444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={run.error_message || ''}>{run.error_message || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Email Deliveries */}
                            <div style={{ paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
                                <div className="rd-panel-header" style={{ marginBottom: '1rem' }}>
                                    <h3>Email Delivery Logs</h3>
                                    <p>History of sent emails and Resend transactional IDs.</p>
                                </div>
                                <div style={{ overflowX: 'auto', width: '100%' }}>
                                    <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-tertiary)', fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                                                <th style={{ width: '18%', padding: '0.75rem' }}>Delivery Date</th>
                                                <th style={{ width: '34%', padding: '0.75rem' }}>Subject</th>
                                                <th style={{ width: '14%', padding: '0.75rem' }}>Status</th>
                                                <th style={{ width: '18%', padding: '0.75rem' }}>Sent At</th>
                                                <th style={{ width: '16%', padding: '0.75rem' }}>Resend ID</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {deliveries.map(del => (
                                                <tr key={del.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                                    <td style={{ padding: '0.75rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{del.delivery_date}</td>
                                                    <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{del.subject || 'Personal Reading Digest'}</td>
                                                    <td style={{ padding: '0.75rem' }}>
                                                        <span className={`rd-badge ${del.status === 'sent' ? 'rd-badge-success' : 'rd-badge-muted'}`}>
                                                            {del.status}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{del.sent_at ? new Date(del.sent_at).toLocaleString('en-IN') : '-'}</td>
                                                    <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{del.resend_email_id || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* Scoped CSS styling matching XR Showcase design system */}
            <style>{`
                .rd-admin { display: grid; gap: 1rem; color: var(--text-primary); width: 100%; box-sizing: border-box; }
                .rd-admin-header { display: flex; justify-content: space-between; gap: 1.5rem; align-items: flex-end; padding: 0 0 1rem; border-bottom: 1px solid var(--border-subtle); flex-wrap: wrap; }
                .rd-admin-kicker { margin: 0 0 .3rem; color: var(--text-tertiary); font-size: .72rem; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; }
                .rd-admin-header h2 { margin: 0; font-size: clamp(2rem, 4vw, 3.2rem); line-height: 1; font-weight: 700; display: flex; align-items: center; }
                .rd-admin-subtitle { display: block; margin-top: .55rem; color: var(--text-secondary); font-size: .92rem; }
                .rd-admin-header-actions { display: flex; gap: .55rem; align-items: center; flex-wrap: wrap; }

                .rd-admin-layout { display: grid; grid-template-columns: minmax(240px, 320px) minmax(0, 1fr); gap: 1rem; align-items: start; }
                .rd-admin-sidebar { border: 1px solid var(--border-subtle); border-radius: 12px; background: var(--bg-surface); overflow: hidden; position: sticky; top: 1rem; display: flex; flex-direction: column; gap: 1rem; padding: 1rem; }
                .rd-sidebar-block { display: flex; flex-direction: column; gap: 0.65rem; }
                .rd-sidebar-controls { border-top: 1px solid var(--border-subtle); padding-top: 0.85rem; }
                .rd-sidebar-title { margin: 0 0 0.2rem 0; color: var(--text-tertiary); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.09em; text-transform: uppercase; }
                .rd-sidebar-menu { display: flex; flex-direction: column; gap: 0.35rem; }
                .rd-sidebar-btn { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 0.65rem 0.8rem; border-radius: 8px; border: 1px solid transparent; background: transparent; color: var(--text-secondary); font-size: 0.84rem; font-weight: 700; cursor: pointer; transition: all 0.15s ease; width: 100%; text-align: left; }
                .rd-sidebar-btn:hover { background: var(--bg-surface-hover); color: var(--text-primary); }
                .rd-sidebar-btn.active { background: var(--bg-surface-hover); color: var(--text-primary); border-color: var(--border-subtle); }
                .rd-sidebar-count { font-size: 0.72rem; font-weight: 700; padding: 0.15rem 0.45rem; border-radius: 9999px; background: var(--bg-color); color: var(--text-tertiary); }

                .rd-admin-main { border: 1px solid var(--border-subtle); border-radius: 12px; background: var(--bg-surface); padding: clamp(1rem, 2.2vw, 1.5rem); min-height: 500px; box-sizing: border-box; overflow: hidden; }

                .rd-btn { display: inline-flex; align-items: center; justify-content: center; gap: .45rem; min-height: 2.5rem; border-radius: 8px; padding: .6rem 1.1rem; font: 700 .84rem/1 var(--font-ui); cursor: pointer; text-decoration: none; transition: all 0.15s ease; }
                .rd-btn-primary { background: var(--text-primary); color: var(--bg-color); border: 1px solid var(--text-primary); }
                .rd-btn-primary:hover { opacity: 0.92; }
                .rd-btn-secondary { background: transparent; color: var(--text-primary); border: 1px solid var(--border-subtle); }
                .rd-btn-secondary:hover { background: var(--bg-surface-hover); border-color: var(--text-tertiary); }

                .rd-alert { border: 1px solid var(--border-subtle); border-radius: 8px; padding: .85rem 1.1rem; display: flex; align-items: center; gap: .75rem; font-size: .88rem; }
                .rd-alert--error { border-color: color-mix(in srgb, #ef4444 40%, var(--border-subtle)); background: color-mix(in srgb, #ef4444 10%, transparent); color: #ef4444; }
                .rd-alert--success { border-color: color-mix(in srgb, #22c55e 40%, var(--border-subtle)); background: color-mix(in srgb, #22c55e 10%, transparent); color: #22c55e; }

                .rd-badge { display: inline-flex; align-items: center; padding: .2rem .55rem; border-radius: 9999px; font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
                .rd-badge-success { background: color-mix(in srgb, #22c55e 15%, transparent); color: #22c55e; border: 1px solid color-mix(in srgb, #22c55e 30%, transparent); }
                .rd-badge-muted { background: var(--bg-surface-hover); color: var(--text-tertiary); border: 1px solid var(--border-subtle); }

                .rd-panel-header h3 { margin: 0; font-size: 1.2rem; font-weight: 700; color: var(--text-primary); }
                .rd-panel-header p { margin: .3rem 0 0 0; font-size: .88rem; color: var(--text-secondary); }

                .rd-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.25rem; }
                .rd-field { display: flex; flex-direction: column; gap: .42rem; }
                .rd-field label { font-size: .75rem; font-weight: 750; text-transform: uppercase; letter-spacing: .05em; color: var(--text-secondary); }
                .rd-field input, .rd-field select { padding: .65rem .85rem; border-radius: 8px; border: 1px solid var(--border-subtle); background: var(--bg-color); color: var(--text-primary); font-size: .88rem; font-family: var(--font-ui); width: 100%; box-sizing: border-box; transition: border-color 0.15s ease; }
                .rd-field input:focus, .rd-field select:focus { border-color: var(--text-primary); outline: none; }

                .rd-form-footer { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; padding-top: 1.25rem; border-top: 1px solid var(--border-subtle); }
                .rd-checkbox-label { display: inline-flex; align-items: center; gap: .6rem; cursor: pointer; font-size: .88rem; font-weight: 600; color: var(--text-primary); }
                .rd-checkbox-label input { width: 17px; height: 17px; accent-color: var(--text-primary); cursor: pointer; }

                .rd-reading-card { padding: 1.5rem; border-radius: 10px; border: 1px solid var(--border-subtle); background: var(--bg-color); transition: border-color 0.15s ease; }
                .rd-reading-card:hover { border-color: var(--text-tertiary); }
                .rd-reading-meta { display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
                .rd-domain-pill { font-size: 0.75rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.06em; }
                .rd-reading-title { margin: 0 0 0.5rem 0; font-size: 1.2rem; line-height: 1.35; font-weight: 700; }
                .rd-reading-title a { color: var(--text-primary); text-decoration: none; }
                .rd-reading-title a:hover { text-decoration: underline; }
                .rd-reading-why { margin: 0.75rem 0; font-size: 0.95rem; color: var(--text-secondary); line-height: 1.6; }
                .rd-reading-actions { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-subtle); flex-wrap: wrap; }
                .rd-read-link { font-size: 0.85rem; font-weight: 700; color: var(--text-primary); text-decoration: none; }
                .rd-read-link:hover { text-decoration: underline; }

                @keyframes rdPop {
                    0% { transform: scale(1); }
                    35% { transform: scale(1.35) rotate(-6deg); }
                    70% { transform: scale(0.92) rotate(3deg); }
                    100% { transform: scale(1); }
                }
                .rd-pop-anim {
                    animation: rdPop 0.38s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }

                @media(max-width: 900px) {
                    .rd-admin-layout { grid-template-columns: 1fr; }
                    .rd-admin-sidebar { position: static; }
                }
            `}</style>

            {/* ── Email Preview Modal ──────────────────────────────────────── */}
            {previewModal && (
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 9999,
                        background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
                        display: 'flex', alignItems: 'stretch', justifyContent: 'center',
                        padding: '20px',
                        boxSizing: 'border-box',
                    }}
                    onClick={(e) => e.target === e.currentTarget && setPreviewModal(null)}
                >
                    <div style={{
                        background: '#ffffff', borderRadius: '16px', overflow: 'hidden',
                        display: 'flex', flexDirection: 'column',
                        width: '100%', maxWidth: '820px', boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
                    }}>
                        {/* Modal header */}
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '16px 20px', borderBottom: '1px solid #e2e8f0',
                            background: '#f8fafc', flexShrink: 0,
                        }}>
                            <div>
                                <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' }}>Email Preview</p>
                                <p style={{ margin: '2px 0 0', fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{previewModal.subject}</p>
                                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>To: {previewModal.recipient}</p>
                            </div>
                            <button
                                onClick={() => setPreviewModal(null)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
                                title="Close preview"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* iframe preview */}
                        <iframe
                            srcDoc={previewModal.html}
                            style={{ flex: 1, border: 'none', width: '100%', minHeight: '400px' }}
                            title="Email preview"
                            sandbox="allow-same-origin"
                        />

                        {/* Modal footer actions */}
                        <div style={{
                            display: 'flex', gap: '10px', justifyContent: 'flex-end',
                            padding: '14px 20px', borderTop: '1px solid #e2e8f0',
                            background: '#f8fafc', flexShrink: 0,
                        }}>
                            <button
                                onClick={() => setPreviewModal(null)}
                                style={{
                                    padding: '9px 20px', borderRadius: '8px', border: '1px solid #cbd5e1',
                                    background: '#fff', color: '#475569', fontSize: '13px', fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >Cancel</button>
                            <button
                                onClick={handleConfirmSendTestEmail}
                                disabled={sendingTest}
                                style={{
                                    padding: '9px 20px', borderRadius: '8px', border: 'none',
                                    background: '#0f172a', color: '#fff', fontSize: '13px', fontWeight: 700,
                                    cursor: sendingTest ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                }}
                            >
                                <Send size={14} />
                                Send It
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
