import React, { useMemo, useRef, useState } from 'react';

const MAX_BODY_LENGTH = 2000;
const NOTE_PALETTES = [
    { surface: 'var(--pop-yellow)', ink: 'var(--pop-ink)', accent: 'var(--pop-pink)' },
    { surface: 'var(--pop-pink)', ink: 'var(--pop-ink)', accent: 'var(--pop-blue)' },
    { surface: 'var(--pop-cream)', ink: 'var(--pop-ink)', accent: 'var(--pop-orange)' },
    { surface: 'var(--pop-blue)', ink: 'var(--pop-cream)', accent: 'var(--pop-yellow)' },
    { surface: 'var(--pop-lime)', ink: 'var(--pop-ink)', accent: 'var(--pop-purple)' },
];

const hashString = (value) => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

const getNoteTextSize = (body) => {
    if (body.length <= 90) return 'note-card--statement';
    if (body.length <= 320) return 'note-card--medium';
    return 'note-card--long';
};

const buildNotes = (notes) => notes.map((note, index) => {
    const noteKey = String(note.id || `${note.created_at}-${index}`);
    const palette = NOTE_PALETTES[hashString(noteKey) % NOTE_PALETTES.length];

    return {
        note,
        label: String(index + 1).padStart(2, '0'),
        sizeClass: getNoteTextSize(note.body || ''),
        style: {
            '--note-surface': palette.surface,
            '--note-ink': palette.ink,
            '--note-accent': palette.accent,
        },
    };
});

export default function NotepadBoard({
    initialNotes = [],
    initialLoadError = '',
    endpoint = '/api/ideas',
    maxBodyLength = MAX_BODY_LENGTH,
    eyebrow = 'Fragments in motion · Public notebook',
    title = 'Notepad',
    description = 'Passing thoughts, unfinished ideas and things worth remembering.',
    formLabel = 'Add a thought',
    placeholder = 'Write something…',
    submitLabel = 'Post note',
    savingLabel = 'Posting note…',
    archiveEyebrow = 'Live archive',
    archiveTitle = 'Notes, as they arrive.',
    itemLabel = 'Note',
    singularLabel = 'note',
    pluralLabel = 'notes',
    emptyMessage = 'The page is blank for now. Leave the first thought.',
}) {
    const [notes, setNotes] = useState(initialNotes);
    const [body, setBody] = useState('');
    const [website, setWebsite] = useState('');
    const [errorMessage, setErrorMessage] = useState(initialLoadError);
    const [saving, setSaving] = useState(false);
    const formRef = useRef(null);
    const boardNotes = useMemo(() => buildNotes(notes), [notes]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        const cleanBody = body.trim();

        if (!cleanBody || saving) return;

        setSaving(true);
        setErrorMessage('');

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ body: cleanBody, website }),
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(payload.error || 'The note could not be saved.');
            }

            if (payload.note) {
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
        formRef.current?.requestSubmit();
    };

    return (
        <div className="notepad-page">
            <section className="notepad-intro" aria-labelledby="notepad-title">
                <div className="notepad-intro__copy">
                    <span className="notepad-eyebrow">{eyebrow}</span>
                    <h1 id="notepad-title">{title}</h1>
                    <p className="notepad-intro__description">{description}</p>
                </div>

                <form ref={formRef} className="notepad-form" onSubmit={handleSubmit} aria-busy={saving}>
                    <label className="notepad-form__label" htmlFor="notepad-entry">{formLabel}</label>
                    <textarea
                        id="notepad-entry"
                        value={body}
                        onChange={(event) => setBody(event.target.value)}
                        onKeyDown={handleKeyDown}
                        maxLength={maxBodyLength || undefined}
                        placeholder={placeholder}
                        rows={5}
                        required
                    />
                    <label className="notepad-honeypot" aria-hidden="true">
                        Website
                        <input
                            type="text"
                            value={website}
                            onChange={(event) => setWebsite(event.target.value)}
                            tabIndex={-1}
                            autoComplete="off"
                        />
                    </label>
                    <div className="notepad-form__footer">
                        <p className={`notepad-status ${errorMessage ? 'is-visible' : ''}`} role="status">
                            {errorMessage || (saving ? savingLabel : 'Enter to post · Shift + Enter for a new line')}
                        </p>
                        <button type="submit" disabled={!body.trim() || saving}>
                            <span>{saving ? 'Posting' : submitLabel}</span>
                            <span aria-hidden="true">↗</span>
                        </button>
                    </div>
                </form>
            </section>

            <section className="notepad-archive" aria-labelledby="notes-heading">
                <header className="notepad-archive__header">
                    <div>
                        <span className="notepad-eyebrow">{archiveEyebrow}</span>
                        <h2 id="notes-heading">{archiveTitle}</h2>
                    </div>
                    <span className="notepad-count">{notes.length} {notes.length === 1 ? singularLabel : pluralLabel}</span>
                </header>

                {boardNotes.length > 0 ? (
                    <div className="notes-grid">
                        {boardNotes.map(({ note, label, sizeClass, style }) => (
                            <article className={`note-card ${sizeClass}`} style={style} key={note.id}>
                                <div className="note-card__meta" aria-hidden="true">
                                    <span>{itemLabel} / {label}</span>
                                    <span className="note-card__mark"></span>
                                </div>
                                <p>{note.body}</p>
                            </article>
                        ))}
                    </div>
                ) : (
                    <p className="notepad-empty">{emptyMessage}</p>
                )}
            </section>

            <style>{`
                .notepad-page {
                    width: 100%;
                    padding: 8px;
                    overflow: clip;
                    background: var(--pop-blue);
                    color: var(--pop-ink);
                    font-family: var(--font-body);
                }

                .notepad-intro,
                .notepad-archive {
                    border: 1px solid var(--pop-border);
                    border-radius: var(--pop-radius-panel);
                }

                .notepad-intro {
                    display: grid;
                    grid-template-columns: minmax(0, 1.08fr) minmax(360px, 0.92fr);
                    gap: 8px;
                    padding: 8px;
                    background: var(--pop-pink);
                }

                .notepad-intro__copy,
                .notepad-form {
                    min-width: 0;
                    border: 1px solid var(--pop-border);
                    border-radius: var(--pop-radius-card);
                }

                .notepad-intro__copy {
                    min-height: clamp(390px, 56vh, 610px);
                    padding: clamp(1.5rem, 4vw, 4rem);
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    background: var(--pop-pink);
                }

                .notepad-eyebrow,
                .notepad-form__label,
                .notepad-count,
                .note-card__meta {
                    font: 750 clamp(0.68rem, 0.9vw, 0.78rem)/1.35 var(--font-mono, monospace);
                    letter-spacing: 0.09em;
                    text-transform: uppercase;
                }

                .notepad-intro h1 {
                    max-width: 8ch;
                    margin: auto 0 0;
                    color: var(--pop-ink);
                    font: 720 clamp(4rem, 9vw, 9rem)/0.82 var(--font-display, sans-serif);
                    letter-spacing: -0.075em;
                    text-wrap: balance;
                }

                .notepad-intro__description {
                    max-width: 32rem;
                    margin: clamp(1.5rem, 3vw, 2.5rem) 0 0;
                    color: var(--pop-ink);
                    font: 480 clamp(1.15rem, 1.75vw, 1.85rem)/1.15 var(--font-display, sans-serif);
                    letter-spacing: -0.025em;
                    text-wrap: pretty;
                }

                .notepad-form {
                    padding: clamp(1.25rem, 2.2vw, 2rem);
                    display: flex;
                    flex-direction: column;
                    background: var(--pop-yellow);
                }

                .notepad-form__label {
                    display: block;
                    margin-bottom: 1rem;
                }

                .notepad-form textarea {
                    width: 100%;
                    min-height: 0;
                    flex: 1;
                    padding: clamp(1rem, 2vw, 1.6rem);
                    resize: none;
                    border: 1px solid var(--pop-border);
                    border-radius: var(--pop-radius-control);
                    outline: none;
                    background: var(--pop-cream);
                    color: var(--pop-ink);
                    caret-color: var(--pop-purple);
                    font: 500 clamp(1.35rem, 2.3vw, 2.3rem)/1.15 var(--font-display, sans-serif);
                    letter-spacing: -0.035em;
                    transition: box-shadow var(--pop-motion), transform var(--pop-motion);
                }

                .notepad-form textarea::placeholder {
                    color: color-mix(in srgb, var(--pop-ink) 55%, transparent);
                }

                .notepad-form textarea:focus-visible {
                    box-shadow: 0 0 0 3px var(--pop-purple);
                }

                .notepad-form__footer {
                    min-height: 52px;
                    margin-top: 0.8rem;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 1rem;
                }

                .notepad-status {
                    margin: 0;
                    color: color-mix(in srgb, var(--pop-ink) 78%, transparent);
                    font: 700 0.68rem/1.35 var(--font-mono, monospace);
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                }

                .notepad-status.is-visible {
                    color: #8b1d12;
                }

                .notepad-form button {
                    min-width: 136px;
                    min-height: 48px;
                    padding: 0 1.05rem;
                    display: inline-flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 0.8rem;
                    border: 1px solid var(--pop-ink);
                    border-radius: var(--pop-radius-control);
                    background: var(--pop-blue);
                    color: var(--pop-cream);
                    font: 750 0.72rem/1 var(--font-mono, monospace);
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    cursor: pointer;
                    transition: transform var(--pop-motion), box-shadow var(--pop-motion), opacity var(--pop-motion);
                }

                .notepad-form button:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 3px 0 var(--pop-ink);
                }

                .notepad-form button:focus-visible {
                    outline: 3px solid var(--pop-purple);
                    outline-offset: 3px;
                }

                .notepad-form button:disabled {
                    cursor: not-allowed;
                    opacity: 0.45;
                }

                .notepad-honeypot {
                    position: absolute !important;
                    left: -10000px !important;
                    width: 1px !important;
                    height: 1px !important;
                    overflow: hidden !important;
                }

                .notepad-archive {
                    margin-top: 8px;
                    padding: clamp(1rem, 2.2vw, 2rem);
                    background: #f5ede0;
                }

                .notepad-archive__header {
                    margin-bottom: clamp(1.25rem, 2.4vw, 2rem);
                    padding: clamp(0.5rem, 1vw, 1rem) 0 clamp(1.25rem, 2.4vw, 2rem);
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                    gap: 2rem;
                    border-bottom: 1px solid var(--pop-line);
                }

                .notepad-archive h2 {
                    max-width: 13ch;
                    margin: 0.5rem 0 0;
                    color: var(--pop-ink);
                    font: 620 clamp(2.5rem, 5vw, 5.2rem)/0.9 var(--font-display, sans-serif);
                    letter-spacing: -0.065em;
                    text-wrap: balance;
                }

                .notepad-count {
                    flex: none;
                    padding: 0.75rem 0.9rem;
                    border: 1px solid var(--pop-ink);
                    border-radius: var(--pop-radius-control);
                    background: var(--pop-cyan);
                }

                .notes-grid {
                    columns: 4;
                    column-gap: clamp(0.9rem, 1.5vw, 1.4rem);
                    orphans: 1;
                    widows: 1;
                }

                .note-card {
                    width: 100%;
                    margin: 0 0 clamp(0.9rem, 1.5vw, 1.4rem);
                    padding: clamp(1rem, 1.4vw, 1.35rem);
                    display: inline-block;
                    break-inside: avoid;
                    overflow: hidden;
                    border: 1px solid var(--pop-border);
                    border-radius: var(--pop-radius-card);
                    background: var(--note-surface);
                    color: var(--note-ink);
                    vertical-align: top;
                    transition: transform var(--pop-motion), box-shadow var(--pop-motion);
                }

                .note-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 0 color-mix(in srgb, var(--pop-ink) 18%, transparent);
                }

                .note-card__meta {
                    margin-bottom: clamp(1rem, 1.6vw, 1.4rem);
                    padding-bottom: 0.75rem;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 1rem;
                    border-bottom: 1px solid currentColor;
                }

                .note-card__mark {
                    width: 0.72rem;
                    height: 0.72rem;
                    flex: none;
                    border: 1px solid currentColor;
                    border-radius: 50%;
                    background: var(--note-accent);
                }

                .note-card p {
                    margin: 0;
                    color: inherit;
                    font-family: var(--font-display, sans-serif);
                    white-space: pre-wrap;
                    overflow-wrap: anywhere;
                    text-wrap: pretty;
                }

                .note-card--statement p {
                    font-size: clamp(1.35rem, 1.9vw, 2rem);
                    font-weight: 620;
                    line-height: 1.08;
                    letter-spacing: -0.04em;
                }

                .note-card--medium p {
                    font-size: clamp(1.05rem, 1.25vw, 1.28rem);
                    font-weight: 540;
                    line-height: 1.3;
                    letter-spacing: -0.02em;
                }

                .note-card--long p {
                    font-size: 0.98rem;
                    font-weight: 480;
                    line-height: 1.47;
                }

                .notepad-empty {
                    margin: 0;
                    padding: clamp(4rem, 10vw, 9rem) 1rem;
                    color: var(--pop-ink);
                    text-align: center;
                    font: 600 clamp(1.2rem, 2vw, 1.6rem)/1.4 var(--font-display, sans-serif);
                }

                @media (max-width: 1100px) {
                    .notepad-intro {
                        grid-template-columns: minmax(0, 1fr) minmax(320px, 0.9fr);
                    }

                    .notes-grid {
                        columns: 3;
                    }
                }

                @media (max-width: 800px) {
                    .notepad-intro {
                        grid-template-columns: 1fr;
                    }

                    .notepad-intro__copy {
                        min-height: 390px;
                    }

                    .notepad-form textarea {
                        min-height: 240px;
                    }

                    .notes-grid {
                        columns: 2;
                    }
                }

                @media (max-width: 520px) {
                    .notepad-page,
                    .notepad-intro {
                        padding: 6px;
                    }

                    .notepad-intro__copy {
                        min-height: 330px;
                        padding: 1.3rem;
                    }

                    .notepad-intro h1 {
                        font: 720 clamp(3.5rem, 18vw, 5.4rem)/0.85 var(--font-display, sans-serif);
                        letter-spacing: -0.065em;
                    }

                    .notepad-intro__description {
                        font-size: 1.1rem;
                        line-height: 1.2;
                    }

                    .notepad-form {
                        padding: 1rem;
                    }

                    .notepad-form textarea {
                        min-height: 210px;
                        font-size: 1.35rem;
                    }

                    .notepad-form__footer,
                    .notepad-archive__header {
                        align-items: stretch;
                        flex-direction: column;
                    }

                    .notepad-form button {
                        width: 100%;
                    }

                    .notepad-archive {
                        padding: 1rem;
                    }

                    .notepad-count {
                        align-self: flex-start;
                    }

                    .notes-grid {
                        columns: 1;
                    }

                    .note-card {
                        margin-bottom: 1rem;
                    }
                }

                @media (prefers-reduced-motion: reduce) {
                    .notepad-form textarea,
                    .notepad-form button,
                    .note-card {
                        transition-duration: 0.01ms;
                    }

                    .notepad-form button:hover:not(:disabled),
                    .note-card:hover {
                        transform: none;
                    }
                }
            `}</style>
        </div>
    );
}
