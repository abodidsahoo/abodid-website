import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const MAX_BODY_LENGTH = 2000;
const NOTE_GRADIENTS = [
    { background: 'linear-gradient(145deg, #2b1834 0%, #19182c 52%, #090b14 100%)', color: '#fffaff', sheen: 'rgba(255, 255, 255, 0.08)' },
    { background: 'linear-gradient(145deg, #152b42 0%, #101c2c 50%, #050910 100%)', color: '#f7fbff', sheen: 'rgba(255, 255, 255, 0.07)' },
    { background: 'linear-gradient(145deg, #173027 0%, #0d1d1b 52%, #040b0c 100%)', color: '#f6fff9', sheen: 'rgba(255, 255, 255, 0.07)' },
    { background: 'linear-gradient(145deg, #371722 0%, #21121a 52%, #0a070b 100%)', color: '#fffaf5', sheen: 'rgba(255, 255, 255, 0.07)' },
    { background: 'linear-gradient(145deg, #211d43 0%, #12172f 52%, #050712 100%)', color: '#fbf9ff', sheen: 'rgba(255, 255, 255, 0.07)' },
];

const hashString = (value) => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

const getNoteTheme = (note) => NOTE_GRADIENTS[hashString(String(note.id)) % NOTE_GRADIENTS.length];

const getComposerTextSize = (length) => {
    if (length <= 100) return 'admin-note-xl';
    if (length <= 300) return 'admin-note-lg';
    if (length <= 700) return 'admin-note-md';
    return 'admin-note-sm';
};

const getCardTextSize = (body) => {
    const words = body.trim().split(/\s+/).filter(Boolean).length;
    if (words <= 12) return 'large';
    if (words <= 32) return 'medium';
    return 'small';
};

export default function AdminNotepad({ accessToken = '' }) {
    const [view, setView] = useState('write');
    const [body, setBody] = useState('');
    const [website, setWebsite] = useState('');
    const [notes, setNotes] = useState([]);
    const [notesLoaded, setNotesLoaded] = useState(false);
    const [loadingNotes, setLoadingNotes] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const refreshInFlightRef = useRef(false);

    const refreshNotes = useCallback(async ({ showLoading = false, surfaceError = false } = {}) => {
        if (refreshInFlightRef.current) return;
        refreshInFlightRef.current = true;

        if (showLoading) setLoadingNotes(true);
        if (surfaceError) setErrorMessage('');

        try {
            const { data, error } = await supabase
                .from('ideas_notes')
                .select('id, body, created_at')
                .order('created_at', { ascending: false })
                .limit(200);

            if (error) throw error;

            setNotes(Array.isArray(data) ? data : []);
            setNotesLoaded(true);
            setErrorMessage('');
        } catch (error) {
            if (surfaceError) {
                setErrorMessage(error.message || 'The notes could not be loaded.');
            }
        } finally {
            refreshInFlightRef.current = false;
            if (showLoading) setLoadingNotes(false);
        }
    }, []);

    const loadNotes = () => {
        setView('notes');
        void refreshNotes({ showLoading: !notesLoaded, surfaceError: true });
    };

    useEffect(() => {
        if (view !== 'notes') return undefined;

        let cancelled = false;
        let channel;
        let realtimeRefreshTimer;

        const queueRefresh = () => {
            window.clearTimeout(realtimeRefreshTimer);
            realtimeRefreshTimer = window.setTimeout(() => {
                void refreshNotes();
            }, 250);
        };

        const connectRealtime = async () => {
            try {
                if (accessToken) await supabase.realtime.setAuth(accessToken);
                if (cancelled) return;

                channel = supabase
                    .channel('admin-notepad-realtime')
                    .on('postgres_changes', {
                        event: '*',
                        schema: 'public',
                        table: 'ideas_notes',
                    }, queueRefresh)
                    .subscribe();
            } catch (_error) {
                // The periodic refresh below remains active if realtime is unavailable.
            }
        };

        const refreshWhenVisible = () => {
            if (document.visibilityState === 'visible') void refreshNotes();
        };

        void connectRealtime();
        void refreshNotes();
        const refreshInterval = window.setInterval(() => {
            if (document.visibilityState === 'visible') void refreshNotes();
        }, 5000);
        window.addEventListener('focus', refreshWhenVisible);
        document.addEventListener('visibilitychange', refreshWhenVisible);

        return () => {
            cancelled = true;
            window.clearInterval(refreshInterval);
            window.clearTimeout(realtimeRefreshTimer);
            window.removeEventListener('focus', refreshWhenVisible);
            document.removeEventListener('visibilitychange', refreshWhenVisible);
            if (channel) void supabase.removeChannel(channel);
        };
    }, [accessToken, refreshNotes, view]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        const cleanBody = body.trim();
        if (!cleanBody || saving) return;

        setSaving(true);
        setErrorMessage('');

        try {
            const response = await fetch('/api/ideas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ body: cleanBody, website }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'The note could not be saved.');

            if (payload.note && notesLoaded) {
                setNotes((current) => [payload.note, ...current.filter((note) => note.id !== payload.note.id)]);
            }
            setBody('');
        } catch (error) {
            setErrorMessage(error.message || 'The note could not be saved.');
        } finally {
            setSaving(false);
        }
    };

    const handleKeyDown = (event) => {
        if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent?.isComposing) return;
        event.preventDefault();
        event.currentTarget.form?.requestSubmit();
    };

    return (
        <section className="admin-notepad" aria-labelledby="admin-notepad-title">
            <header className="admin-notepad-header">
                <h2 id="admin-notepad-title">Notepad</h2>
                {view === 'write' ? (
                    <button type="button" className="admin-notepad-switch" onClick={loadNotes}>
                        Show notes
                    </button>
                ) : (
                    <button
                        type="button"
                        className="admin-notepad-switch"
                        onClick={() => {
                            setView('write');
                            setErrorMessage('');
                        }}
                    >
                        Back to writing
                    </button>
                )}
            </header>

            <div className="admin-notepad-space">
                {view === 'write' ? (
                    <form className="admin-notepad-form" onSubmit={handleSubmit} aria-busy={saving}>
                        <label className="visually-hidden" htmlFor="admin-notepad-entry">Write a note</label>
                        <textarea
                            id="admin-notepad-entry"
                            className={getComposerTextSize(body.length)}
                            value={body}
                            onChange={(event) => setBody(event.target.value)}
                            onKeyDown={handleKeyDown}
                            maxLength={MAX_BODY_LENGTH}
                            placeholder="Write something…"
                            autoFocus
                            required
                        />
                        <label className="admin-notepad-honeypot" aria-hidden="true">
                            Website
                            <input
                                type="text"
                                value={website}
                                onChange={(event) => setWebsite(event.target.value)}
                                tabIndex={-1}
                                autoComplete="off"
                            />
                        </label>
                        <button className="visually-hidden" type="submit" tabIndex={-1}>Post note</button>
                        <p className={`admin-notepad-status ${errorMessage ? 'is-visible' : ''}`} role="status">
                            {errorMessage}
                        </p>
                        <div
                            className={`admin-enter-hint ${body.trim() && !saving && !errorMessage ? 'is-visible' : ''}`}
                            aria-hidden={!body.trim() || saving || Boolean(errorMessage)}
                        >
                            <span>Hit Enter to post</span>
                            <span className="admin-enter-symbol" aria-hidden="true">↵</span>
                        </div>
                    </form>
                ) : (
                    <div className="admin-notes-view" aria-live="polite">
                        {loadingNotes && <p className="admin-notepad-state">Loading notes…</p>}
                        {!loadingNotes && errorMessage && (
                            <div className="admin-notepad-state">
                                <p>{errorMessage}</p>
                                <button
                                    type="button"
                                    onClick={() => refreshNotes({ showLoading: true, surfaceError: true })}
                                >
                                    Try again
                                </button>
                            </div>
                        )}
                        {!loadingNotes && !errorMessage && notesLoaded && notes.length === 0 && (
                            <p className="admin-notepad-state">No notes yet.</p>
                        )}
                        {!loadingNotes && !errorMessage && notes.length > 0 && (
                            <div className="admin-notes-grid">
                                {notes.map((note) => {
                                    const theme = getNoteTheme(note);
                                    return (
                                        <article
                                            className={`admin-note-card admin-card-text-${getCardTextSize(note.body)}`}
                                            style={{ '--card-gradient': theme.background, '--card-ink': theme.color, '--card-sheen': theme.sheen }}
                                            key={note.id}
                                        >
                                            <p>{note.body}</p>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <style>{`
                .admin-notepad {
                    width: min(1400px, 100%);
                    margin: 0 auto;
                    font-family: var(--font-sans);
                }
                .admin-notepad-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }
                .admin-notepad-header h2 {
                    margin: 0;
                    color: var(--text-primary);
                    font-size: clamp(3.2rem, 6.5vw, 6.5rem);
                    font-weight: 520;
                    letter-spacing: -0.055em;
                    line-height: 0.95;
                }
                .admin-notepad-switch {
                    min-height: 34px;
                    padding: 0.45rem 0.75rem;
                    border: 1px solid var(--border-subtle);
                    border-radius: 8px;
                    background: var(--bg-surface);
                    color: var(--text-secondary);
                    cursor: pointer;
                    font: inherit;
                    font-size: 0.72rem;
                    font-weight: 600;
                    transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
                }
                .admin-notepad-switch:hover {
                    border-color: var(--border-strong);
                    background: var(--bg-surface-hover);
                    color: var(--text-primary);
                }
                .admin-notepad-switch:focus-visible,
                .admin-notepad-form textarea:focus-visible {
                    outline: 2px solid var(--border-focus);
                    outline-offset: 2px;
                }
                .admin-notepad-space { min-height: 0; }
                .admin-notepad-form { position: relative; }
                .admin-notepad-form textarea {
                    display: block;
                    width: 100%;
                    min-height: clamp(410px, 64vh, 720px);
                    max-height: 78vh;
                    box-sizing: border-box;
                    padding: clamp(3.5rem, 5vw, 5.75rem) clamp(1.5rem, 3vw, 3rem) clamp(1.5rem, 3vw, 3rem);
                    padding-bottom: 4.5rem;
                    border: 1px solid var(--border-subtle);
                    border-radius: clamp(18px, 2vw, 28px);
                    resize: none;
                    background: var(--bg-surface);
                    color: var(--text-primary);
                    caret-color: var(--text-primary);
                    box-shadow: 0 20px 55px color-mix(in srgb, var(--text-primary) 7%, transparent);
                    font-family: var(--font-sans);
                    font-weight: 400;
                    letter-spacing: -0.04em;
                    line-height: 1.08;
                    transition: border-color 160ms ease, box-shadow 160ms ease, font-size 200ms ease;
                }
                .admin-notepad-form textarea:focus {
                    border-color: var(--border-strong);
                    box-shadow: 0 24px 65px color-mix(in srgb, var(--text-primary) 10%, transparent);
                }
                .admin-notepad-form textarea::placeholder { color: var(--text-tertiary); opacity: 0.55; }
                .admin-notepad-form textarea.admin-note-xl { font-size: clamp(2.5rem, 5vw, 5rem); }
                .admin-notepad-form textarea.admin-note-lg { font-size: clamp(2.1rem, 4vw, 4rem); }
                .admin-notepad-form textarea.admin-note-md { font-size: clamp(1.65rem, 3vw, 2.8rem); }
                .admin-notepad-form textarea.admin-note-sm { font-size: clamp(1.3rem, 2vw, 1.9rem); }
                .admin-notepad-status {
                    position: absolute;
                    left: clamp(1.5rem, 3vw, 3rem);
                    bottom: 1.35rem;
                    margin: 0;
                    color: #d94a3a;
                    font-size: 0.75rem;
                    opacity: 0;
                    pointer-events: none;
                }
                .admin-notepad-status.is-visible { opacity: 1; }
                .admin-enter-hint {
                    position: absolute;
                    right: clamp(1.5rem, 3vw, 3rem);
                    bottom: 1.15rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--text-tertiary);
                    font-size: 0.68rem;
                    font-weight: 550;
                    letter-spacing: 0.04em;
                    opacity: 0;
                    pointer-events: none;
                    transform: translateY(3px);
                    transition: opacity 160ms ease, transform 160ms ease;
                }
                .admin-enter-hint.is-visible { opacity: 0.74; transform: translateY(0); }
                .admin-enter-symbol {
                    display: grid;
                    width: 1.45rem;
                    height: 1.45rem;
                    place-items: center;
                    border: 1px solid var(--border-subtle);
                    border-radius: 6px;
                    font-size: 0.92rem;
                }
                .admin-notepad-honeypot {
                    position: absolute !important;
                    left: -10000px !important;
                    width: 1px !important;
                    height: 1px !important;
                    overflow: hidden !important;
                }
                .admin-notes-view {
                    min-height: clamp(340px, 58vh, 620px);
                    padding: clamp(1rem, 2vw, 1.5rem);
                    box-sizing: border-box;
                    border: 1px solid var(--border-subtle);
                    border-radius: clamp(18px, 2vw, 28px);
                    background: var(--bg-surface);
                }
                .admin-notes-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
                    gap: 1rem;
                }
                .admin-note-card {
                    position: relative;
                    display: flex;
                    box-sizing: border-box;
                    align-items: flex-start;
                    padding: clamp(1.25rem, 2vw, 2rem);
                    overflow: hidden;
                    border: 1px solid color-mix(in srgb, var(--card-ink) 14%, transparent);
                    border-radius: 14px;
                    background: var(--card-gradient);
                    color: var(--card-ink);
                    box-shadow: 0 16px 34px rgba(20, 16, 13, 0.13);
                }
                .admin-note-card::before {
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(circle at 18% 12%, var(--card-sheen), transparent 38%);
                    content: '';
                    pointer-events: none;
                }
                .admin-note-card p {
                    position: relative;
                    z-index: 1;
                    margin: 0;
                    font-weight: 500;
                    line-height: 1.38;
                    letter-spacing: -0.02em;
                    white-space: pre-wrap;
                    overflow-wrap: anywhere;
                }
                .admin-card-text-large { min-height: 230px; }
                .admin-card-text-medium { min-height: 185px; }
                .admin-card-text-small { grid-column: span 2; }
                .admin-card-text-large p { font-size: clamp(1.65rem, 2.4vw, 2.6rem); }
                .admin-card-text-medium p { font-size: clamp(1.15rem, 1.65vw, 1.55rem); }
                .admin-card-text-small p { font-size: 1rem; }
                .admin-notepad-state {
                    min-height: 300px;
                    margin: 0;
                    display: grid;
                    place-items: center;
                    align-content: center;
                    gap: 0.8rem;
                    color: var(--text-tertiary);
                    font-size: 0.82rem;
                    text-align: center;
                }
                .admin-notepad-state p { margin: 0; }
                .admin-notepad-state button {
                    padding: 0.4rem 0.65rem;
                    border: 1px solid var(--border-subtle);
                    border-radius: 7px;
                    background: var(--bg-color);
                    color: var(--text-primary);
                    cursor: pointer;
                    font: inherit;
                    font-size: 0.72rem;
                }
                .visually-hidden {
                    position: absolute !important;
                    width: 1px !important;
                    height: 1px !important;
                    padding: 0 !important;
                    margin: -1px !important;
                    overflow: hidden !important;
                    clip: rect(0, 0, 0, 0) !important;
                    white-space: nowrap !important;
                    border: 0 !important;
                }
                @media (max-width: 640px) {
                    .admin-notepad-header { align-items: flex-end; }
                    .admin-notepad-header h2 { font-size: 3.35rem; }
                    .admin-notepad-form textarea { min-height: 410px; padding: 2.5rem 1.3rem 4rem; }
                    .admin-enter-hint { right: 1.3rem; bottom: 1.1rem; }
                    .admin-notes-view { padding: 0.75rem; }
                    .admin-notes-grid { grid-template-columns: 1fr; }
                    .admin-card-text-small { grid-column: 1; }
                }
                @media (prefers-reduced-motion: reduce) {
                    .admin-notepad-form textarea,
                    .admin-enter-hint { transition: none; }
                }
            `}</style>
        </section>
    );
}
