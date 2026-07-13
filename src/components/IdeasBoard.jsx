import React, { useState } from 'react';
import { Lightbulb, Plus } from 'lucide-react';

const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 2000;

const formatDate = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
};

export default function IdeasBoard({ initialNotes = [], initialLoadError = '' }) {
    const [notes, setNotes] = useState(initialNotes);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [website, setWebsite] = useState('');
    const [status, setStatus] = useState({ type: initialLoadError ? 'error' : 'idle', message: initialLoadError });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        const cleanBody = body.trim();

        if (!cleanBody) {
            setStatus({ type: 'error', message: 'Write a note before adding it to the board.' });
            return;
        }

        setSaving(true);
        setStatus({ type: 'idle', message: '' });

        try {
            const response = await fetch('/api/ideas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, body: cleanBody, website }),
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(payload.error || 'The note could not be saved.');
            }

            if (payload.note) {
                setNotes((current) => [payload.note, ...current.filter((note) => note.id !== payload.note.id)]);
            }
            setTitle('');
            setBody('');
            setStatus({ type: 'success', message: 'Saved. Your note is now on the board.' });
        } catch (error) {
            setStatus({ type: 'error', message: error.message || 'The note could not be saved.' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <main className="ideas-page">
            <header className="ideas-hero">
                <div className="ideas-kicker"><Lightbulb size={16} strokeWidth={1.6} aria-hidden="true" /> Public scratchpad</div>
                <h1>Ideas in motion</h1>
                <p>A small, open notebook for passing thoughts, reminders, and pieces of a larger vision.</p>
            </header>

            <div className="ideas-layout">
                <aside className="ideas-composer-wrap">
                    <form className="ideas-composer" onSubmit={handleSubmit}>
                        <div className="composer-heading">
                            <span>Write a note</span>
                            <small>Public immediately</small>
                        </div>

                        <label>
                            <span>Title <small>optional</small></span>
                            <input
                                type="text"
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                maxLength={MAX_TITLE_LENGTH}
                                placeholder="A name for this thought"
                            />
                        </label>

                        <label>
                            <span>Note</span>
                            <textarea
                                value={body}
                                onChange={(event) => setBody(event.target.value)}
                                maxLength={MAX_BODY_LENGTH}
                                rows={9}
                                placeholder="Write anything…"
                                required
                            />
                        </label>

                        <label className="ideas-honeypot" aria-hidden="true">
                            Website
                            <input
                                type="text"
                                value={website}
                                onChange={(event) => setWebsite(event.target.value)}
                                tabIndex={-1}
                                autoComplete="off"
                            />
                        </label>

                        <div className="composer-meta">
                            <span>{body.length}/{MAX_BODY_LENGTH}</span>
                            <button type="submit" disabled={saving || !body.trim()}>
                                <Plus size={15} strokeWidth={1.8} aria-hidden="true" />
                                {saving ? 'Saving…' : 'Add note'}
                            </button>
                        </div>

                        {status.message && (
                            <p className={`ideas-status ${status.type}`} role="status">{status.message}</p>
                        )}
                    </form>
                </aside>

                <section className="ideas-board" aria-labelledby="ideas-board-title">
                    <div className="board-heading">
                        <h2 id="ideas-board-title">The board</h2>
                        <span>{notes.length} {notes.length === 1 ? 'note' : 'notes'}</span>
                    </div>

                    {notes.length > 0 ? (
                        <div className="ideas-grid">
                            {notes.map((note, index) => (
                                <article className="idea-card" key={note.id}>
                                    <div className="idea-card-index">{String(index + 1).padStart(2, '0')}</div>
                                    <h3>{note.title || 'Untitled thought'}</h3>
                                    <p>{note.body}</p>
                                    <time dateTime={note.created_at}>{formatDate(note.created_at)}</time>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <div className="ideas-empty">
                            <Lightbulb size={22} strokeWidth={1.4} aria-hidden="true" />
                            <p>The board is empty. Add the first thought.</p>
                        </div>
                    )}
                </section>
            </div>

            <style>{`
                .ideas-page {
                    width: min(1440px, 100%); margin: 0 auto; padding: clamp(7rem, 10vw, 10rem) clamp(1rem, 4vw, 4rem) 7rem;
                    color: var(--text-primary); box-sizing: border-box;
                }
                .ideas-hero { max-width: 760px; margin-bottom: clamp(2.5rem, 5vw, 4.5rem); }
                .ideas-kicker {
                    display: inline-flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;
                    color: var(--text-secondary); font-family: var(--font-ui); font-size: 0.72rem;
                    font-weight: 600; letter-spacing: 0.11em; text-transform: uppercase;
                }
                .ideas-hero h1 {
                    margin: 0; font-family: var(--font-heading); font-size: clamp(3rem, 7vw, 7.2rem);
                    font-weight: 500; letter-spacing: -0.055em; line-height: 0.92;
                }
                .ideas-hero p {
                    max-width: 600px; margin: 1.5rem 0 0; color: var(--text-secondary);
                    font-family: var(--font-body); font-size: clamp(1rem, 1.5vw, 1.25rem); line-height: 1.55;
                }
                .ideas-layout {
                    display: grid; grid-template-columns: minmax(260px, 4fr) minmax(0, 8fr); gap: clamp(1rem, 2vw, 2rem);
                    align-items: start;
                }
                .ideas-composer-wrap { position: sticky; top: 6rem; }
                .ideas-composer,
                .ideas-board { border: 1px solid var(--border-subtle); background: var(--bg-surface); }
                .ideas-composer { padding: 1rem; }
                .composer-heading,
                .board-heading {
                    min-height: 42px; display: flex; align-items: center; justify-content: space-between; gap: 1rem;
                    border-bottom: 1px solid var(--border-subtle); font-family: var(--font-ui);
                }
                .composer-heading { margin: -1rem -1rem 1rem; padding: 0 1rem; }
                .composer-heading span,
                .board-heading h2 { margin: 0; font-size: 0.78rem; font-weight: 650; letter-spacing: 0.02em; }
                .composer-heading small,
                .board-heading span { color: var(--text-tertiary); font-size: 0.62rem; letter-spacing: 0.06em; text-transform: uppercase; }
                .ideas-composer label { display: flex; flex-direction: column; gap: 0.45rem; margin-bottom: 0.9rem; }
                .ideas-composer label > span { color: var(--text-secondary); font-family: var(--font-ui); font-size: 0.68rem; font-weight: 600; }
                .ideas-composer label > span small { color: var(--text-tertiary); font-weight: 400; }
                .ideas-composer input,
                .ideas-composer textarea {
                    width: 100%; box-sizing: border-box; border: 1px solid var(--border-subtle); border-radius: 0;
                    background: var(--bg-canvas); color: var(--text-primary); padding: 0.75rem;
                    font: inherit; font-size: 0.82rem; line-height: 1.55; resize: vertical;
                }
                .ideas-composer textarea { min-height: 170px; }
                .ideas-composer input:focus,
                .ideas-composer textarea:focus { outline: 1px solid var(--text-primary); outline-offset: -1px; }
                .ideas-honeypot { position: absolute !important; left: -10000px !important; width: 1px !important; height: 1px !important; overflow: hidden !important; }
                .composer-meta { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
                .composer-meta > span { color: var(--text-tertiary); font-family: var(--font-ui); font-size: 0.62rem; }
                .composer-meta button {
                    min-height: 38px; padding: 0 0.9rem; display: inline-flex; align-items: center; gap: 0.42rem;
                    border: 1px solid var(--text-primary); background: var(--text-primary); color: var(--bg-canvas);
                    cursor: pointer; font-family: var(--font-ui); font-size: 0.7rem; font-weight: 650;
                }
                .composer-meta button:disabled { cursor: not-allowed; opacity: 0.45; }
                .ideas-status { margin: 0.85rem 0 0; font-family: var(--font-ui); font-size: 0.68rem; line-height: 1.4; }
                .ideas-status.success { color: #10b981; }
                .ideas-status.error { color: #ef4444; }
                .ideas-board { min-width: 0; }
                .board-heading { padding: 0 1rem; }
                .ideas-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1px; background: var(--border-subtle); }
                .idea-card {
                    min-width: 0; min-height: 210px; padding: 1rem; display: flex; flex-direction: column;
                    background: var(--bg-surface); transition: background 0.18s ease;
                }
                .idea-card:hover { background: var(--bg-surface-hover); }
                .idea-card-index { color: var(--text-tertiary); font-family: var(--font-mono); font-size: 0.58rem; }
                .idea-card h3 { margin: 1.25rem 0 0.7rem; font-size: 0.88rem; font-weight: 650; line-height: 1.35; }
                .idea-card p {
                    margin: 0 0 1.5rem; color: var(--text-secondary); font-family: var(--font-body);
                    font-size: 0.8rem; line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere;
                }
                .idea-card time { margin-top: auto; color: var(--text-tertiary); font-family: var(--font-ui); font-size: 0.58rem; text-transform: uppercase; letter-spacing: 0.06em; }
                .ideas-empty { min-height: 260px; display: grid; place-items: center; align-content: center; gap: 0.75rem; color: var(--text-tertiary); }
                .ideas-empty p { margin: 0; font-family: var(--font-ui); font-size: 0.76rem; }
                @media (max-width: 820px) {
                    .ideas-page { padding-top: 6.5rem; }
                    .ideas-layout { grid-template-columns: 1fr; }
                    .ideas-composer-wrap { position: static; }
                    .ideas-grid { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
                }
                @media (max-width: 520px) {
                    .ideas-hero h1 { font-size: 3.35rem; }
                    .ideas-grid { grid-template-columns: 1fr; }
                    .idea-card { min-height: 180px; }
                }
            `}</style>
        </main>
    );
}
