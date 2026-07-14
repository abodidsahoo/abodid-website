import React, { useEffect, useMemo, useRef, useState } from 'react';

const MAX_BODY_LENGTH = 2000;
const NOTE_GRADIENTS = [
    {
        gradient: 'linear-gradient(145deg, #2b1834 0%, #19182c 52%, #090b14 100%)',
        ink: '#fffaff',
        sheen: 'rgba(255, 255, 255, 0.08)',
    },
    {
        gradient: 'linear-gradient(145deg, #152b42 0%, #101c2c 50%, #050910 100%)',
        ink: '#f7fbff',
        sheen: 'rgba(255, 255, 255, 0.07)',
    },
    {
        gradient: 'linear-gradient(145deg, #173027 0%, #0d1d1b 52%, #040b0c 100%)',
        ink: '#f6fff9',
        sheen: 'rgba(255, 255, 255, 0.07)',
    },
    {
        gradient: 'linear-gradient(145deg, #371722 0%, #21121a 52%, #0a070b 100%)',
        ink: '#fffaf5',
        sheen: 'rgba(255, 255, 255, 0.07)',
    },
    {
        gradient: 'linear-gradient(145deg, #211d43 0%, #12172f 52%, #050712 100%)',
        ink: '#fbf9ff',
        sheen: 'rgba(255, 255, 255, 0.07)',
    },
];

const hashString = (value) => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

const createSeededRandom = (seed) => {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
};

const getWordCount = (body) => body.trim().split(/\s+/).filter(Boolean).length;

const getNoteTextSize = (body) => {
    const wordCount = getWordCount(body);
    if (wordCount <= 10) return 'large';
    if (wordCount <= 36) return 'medium';
    return 'small';
};

const getComposerTextSize = (length) => {
    if (length <= 100) return 'composer-xl';
    if (length <= 300) return 'composer-lg';
    if (length <= 700) return 'composer-md';
    return 'composer-sm';
};

function AutoFitNote({ body }) {
    const cardRef = useRef(null);
    const textRef = useRef(null);

    useEffect(() => {
        const card = cardRef.current;
        const text = textRef.current;
        if (!card || !text) return undefined;

        let animationFrame;
        let cancelled = false;

        const fitText = () => {
            if (cancelled) return;

            const cardStyles = window.getComputedStyle(card);
            const horizontalPadding = parseFloat(cardStyles.paddingLeft) + parseFloat(cardStyles.paddingRight);
            const verticalPadding = parseFloat(cardStyles.paddingTop) + parseFloat(cardStyles.paddingBottom);
            const availableWidth = card.clientWidth - horizontalPadding;
            const availableHeight = card.clientHeight - verticalPadding;
            if (availableWidth <= 0 || availableHeight <= 0) return;

            const minimumSize = 16;
            const maximumSize = Math.max(
                minimumSize,
                Math.min(132, availableWidth * 0.38, availableHeight * 0.48),
            );
            const spareLines = body.length > 500 ? 0.35 : body.length > 180 ? 0.6 : 0.9;
            let smallest = minimumSize;
            let largest = maximumSize;
            let fittedSize = minimumSize;

            for (let attempt = 0; attempt < 11; attempt += 1) {
                const candidate = (smallest + largest) / 2;
                text.style.fontSize = `${candidate}px`;
                const textStyles = window.getComputedStyle(text);
                const lineHeight = parseFloat(textStyles.lineHeight) || candidate * 1.25;
                const usedHeight = text.getBoundingClientRect().height;
                const fits = usedHeight + lineHeight * spareLines <= availableHeight
                    && text.scrollWidth <= availableWidth + 1;

                if (fits) {
                    fittedSize = candidate;
                    smallest = candidate;
                } else {
                    largest = candidate;
                }
            }

            text.style.fontSize = `${Math.floor(fittedSize * 10) / 10}px`;
        };

        const requestFit = () => {
            window.cancelAnimationFrame(animationFrame);
            animationFrame = window.requestAnimationFrame(fitText);
        };
        const resizeObserver = new ResizeObserver(requestFit);

        resizeObserver.observe(card);
        requestFit();
        document.fonts?.ready.then(requestFit);

        return () => {
            cancelled = true;
            window.cancelAnimationFrame(animationFrame);
            resizeObserver.disconnect();
        };
    }, [body]);

    return (
        <article ref={cardRef} className={`note-card note-text-${getNoteTextSize(body)}`}>
            <p ref={textRef}>{body}</p>
        </article>
    );
}

const buildFloatingNotes = (notes) => notes.map((note, noteIndex) => {
    const noteSeed = hashString(String(note.id || `${note.created_at}-${noteIndex}`));
    const random = createSeededRandom(noteSeed);
    const noteBody = note.body || '';
    const wordCount = getWordCount(noteBody);
    const characterCount = noteBody.length;
    const ratioOptions = [0.8, 0.88, 1, 1.1, 1.25];
    let aspectRatio = ratioOptions[Math.floor(random() * ratioOptions.length)];

    if (characterCount > 700) aspectRatio = random() < 0.5 ? 1 : 1.16;
    else if (characterCount > 320) aspectRatio = random() < 0.45 ? 1 : 1.25;
    else if (characterCount > 150) aspectRatio = [1, 1.1, 1.25][Math.floor(random() * 3)];

    // A few cards can gently break the rhythm without becoming panoramic.
    if (characterCount < 320 && random() < 0.08) {
        aspectRatio = aspectRatio < 1 ? 0.76 : 1.3;
    }

    const shape = aspectRatio < 0.94 ? 'vertical' : aspectRatio > 1.06 ? 'horizontal' : 'square';
    const columnSpan = characterCount > 900
        ? 8
        : characterCount > 500
            ? 7
            : characterCount > 240
                ? 6
                : wordCount > 28
                    ? 5
                    : shape === 'vertical'
                        ? 3
                        : shape === 'horizontal'
                            ? 5
                            : 4;
    const compactSpan = characterCount > 320 ? 6 : shape === 'vertical' ? 3 : 4;
    const width = 91 + Math.round(random() * 9);
    const alignmentRoll = random();
    const justifySelf = alignmentRoll < 0.34 ? 'start' : alignmentRoll < 0.68 ? 'center' : 'end';
    const tiltMagnitude = 5 + random() * 10;
    const tiltDirection = noteSeed % 2 === 0 ? -1 : 1;
    const tilt = `${tiltDirection * tiltMagnitude}deg`;
    const driftX = `${(random() < 0.5 ? -1 : 1) * (3 + random() * 8)}px`;
    const driftY = `${-4 - random() * 10}px`;
    const duration = `${6.5 + random() * 6}s`;
    const delay = `${-random() * 10}s`;
    const gradient = NOTE_GRADIENTS[Math.floor(random() * NOTE_GRADIENTS.length)];

    return {
        note,
        shape,
        style: {
            width: `${width}%`,
            justifySelf,
            marginTop: `${Math.round(random() * 92)}px`,
            marginBottom: `${24 + Math.round(random() * 64)}px`,
            '--note-aspect': aspectRatio,
            '--note-span': columnSpan,
            '--note-compact-span': compactSpan,
            '--note-gradient': gradient.gradient,
            '--note-ink': gradient.ink,
            '--note-sheen': gradient.sheen,
            '--tilt': tilt,
            '--drift-x': driftX,
            '--drift-y': driftY,
            '--float-duration': duration,
            '--float-delay': delay,
        },
    };
});

export default function NotepadBoard({ initialNotes = [], initialLoadError = '' }) {
    const [notes, setNotes] = useState(initialNotes);
    const [body, setBody] = useState('');
    const [website, setWebsite] = useState('');
    const [errorMessage, setErrorMessage] = useState(initialLoadError);
    const [saving, setSaving] = useState(false);
    const formRef = useRef(null);
    const floatingNotes = useMemo(() => buildFloatingNotes(notes), [notes]);

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
        <main className="notepad-page">
            <h1>Notepad</h1>

            <form ref={formRef} className="notepad-form" onSubmit={handleSubmit} aria-busy={saving}>
                <label className="visually-hidden" htmlFor="notepad-entry">Write a note</label>
                <textarea
                    id="notepad-entry"
                    className={getComposerTextSize(body.length)}
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    onKeyDown={handleKeyDown}
                    maxLength={MAX_BODY_LENGTH}
                    placeholder="Write something…"
                    autoFocus
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
                <button className="visually-hidden" type="submit" tabIndex={-1}>Post note</button>
                <p className={`notepad-status ${errorMessage ? 'is-visible' : ''}`} role="status">
                    {errorMessage}
                </p>
                <div
                    className={`enter-hint ${body.trim() && !saving && !errorMessage ? 'is-visible' : ''}`}
                    aria-hidden={!body.trim() || saving || Boolean(errorMessage)}
                >
                    <span>Hit Enter to post</span>
                    <span className="enter-symbol" aria-hidden="true">↵</span>
                </div>
            </form>

            <section
                className="notes-space"
                aria-label="Posted notes"
            >
                {floatingNotes.map(({ note, shape, style }) => (
                    <div className={`floating-note note-shape-${shape}`} style={style} key={note.id}>
                        <AutoFitNote body={note.body} />
                    </div>
                ))}
            </section>

            <style>{`
                .notepad-page {
                    width: min(1680px, 100%);
                    min-height: 100vh;
                    margin: 0 auto;
                    padding: clamp(7rem, 9vw, 9.5rem) clamp(1rem, 4vw, 4.5rem) clamp(6rem, 10vw, 10rem);
                    color: var(--text-primary);
                    box-sizing: border-box;
                }
                .notepad-page h1 {
                    margin: 0;
                    font-family: var(--font-heading);
                    font-size: clamp(3.75rem, 8.5vw, 8.5rem);
                    font-weight: 500;
                    letter-spacing: -0.065em;
                    line-height: 0.84;
                }
                .notepad-form {
                    position: relative;
                    width: min(1280px, 100%);
                    margin-top: clamp(1.75rem, 3vw, 3rem);
                }
                .notepad-form textarea {
                    display: block;
                    width: 100%;
                    min-height: clamp(320px, 44vh, 500px);
                    max-height: 68vh;
                    box-sizing: border-box;
                    padding: clamp(1.35rem, 2.5vw, 2.5rem);
                    padding-bottom: clamp(3.5rem, 5vw, 4.5rem);
                    border: 1px solid var(--border-default, var(--border-subtle));
                    border-radius: clamp(24px, 3vw, 44px);
                    outline: none;
                    resize: none;
                    background: color-mix(in srgb, var(--bg-surface) 88%, transparent);
                    color: var(--text-primary);
                    caret-color: var(--text-primary);
                    box-shadow: 0 18px 55px color-mix(in srgb, var(--text-primary) 8%, transparent);
                    font-family: var(--font-heading);
                    font-weight: 400;
                    letter-spacing: -0.04em;
                    line-height: 1.06;
                    transition: border-color 180ms ease, box-shadow 180ms ease, font-size 220ms ease;
                }
                .notepad-form textarea:focus {
                    border-color: var(--text-primary);
                    box-shadow: 0 22px 70px color-mix(in srgb, var(--text-primary) 12%, transparent);
                }
                .notepad-form textarea::placeholder {
                    color: var(--text-tertiary);
                    opacity: 0.56;
                }
                .notepad-form textarea.composer-xl { font-size: clamp(2.6rem, 6vw, 5.75rem); }
                .notepad-form textarea.composer-lg { font-size: clamp(2.2rem, 4.8vw, 4.5rem); }
                .notepad-form textarea.composer-md { font-size: clamp(1.8rem, 3.4vw, 3.1rem); }
                .notepad-form textarea.composer-sm { font-size: clamp(1.4rem, 2.3vw, 2.1rem); }
                .notepad-honeypot {
                    position: absolute !important;
                    left: -10000px !important;
                    width: 1px !important;
                    height: 1px !important;
                    overflow: hidden !important;
                }
                .notepad-status {
                    position: absolute;
                    left: clamp(1.4rem, 3vw, 3rem);
                    bottom: 1rem;
                    margin: 0;
                    color: #d94a3a;
                    font-family: var(--font-ui);
                    font-size: 0.82rem;
                    opacity: 0;
                    pointer-events: none;
                }
                .notepad-status.is-visible { opacity: 1; }
                .enter-hint {
                    position: absolute;
                    right: clamp(1.35rem, 2.5vw, 2.5rem);
                    bottom: clamp(1.1rem, 1.8vw, 1.55rem);
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--text-tertiary);
                    font-family: var(--font-ui);
                    font-size: 0.68rem;
                    font-weight: 500;
                    letter-spacing: 0.045em;
                    opacity: 0;
                    pointer-events: none;
                    transform: translateY(3px);
                    transition: opacity 160ms ease, transform 160ms ease;
                }
                .enter-hint.is-visible {
                    opacity: 0.72;
                    transform: translateY(0);
                }
                .enter-symbol {
                    display: grid;
                    width: 1.45rem;
                    height: 1.45rem;
                    place-items: center;
                    border: 1px solid var(--border-default, var(--border-subtle));
                    border-radius: 6px;
                    font-size: 0.92rem;
                    line-height: 1;
                }
                .notes-space {
                    display: grid;
                    grid-template-columns: repeat(12, minmax(0, 1fr));
                    align-items: start;
                    column-gap: clamp(1.75rem, 4vw, 5rem);
                    row-gap: clamp(3.5rem, 7vw, 8rem);
                    min-height: 36vh;
                    margin-top: clamp(3rem, 7vw, 8rem);
                    padding: 0 clamp(0rem, 1.5vw, 1.5rem);
                }
                .floating-note {
                    grid-column: span var(--note-span);
                    animation: notepad-float var(--float-duration) ease-in-out var(--float-delay) infinite alternate;
                    will-change: transform;
                }
                .note-card {
                    position: relative;
                    display: flex;
                    width: 100%;
                    aspect-ratio: var(--note-aspect);
                    box-sizing: border-box;
                    align-items: flex-start;
                    padding: clamp(1.35rem, 2.25vw, 2.25rem);
                    overflow: hidden;
                    border: 1px solid color-mix(in srgb, var(--note-ink) 15%, transparent);
                    border-radius: clamp(14px, 1.3vw, 20px);
                    background: var(--note-gradient);
                    color: var(--note-ink);
                    box-shadow: 0 24px 55px rgba(21, 17, 13, 0.18), 0 3px 10px rgba(21, 17, 13, 0.08);
                    transform: rotate(var(--tilt));
                    transform-origin: 50% 50%;
                }
                .note-card::before {
                    position: absolute;
                    inset: 0;
                    background:
                        radial-gradient(circle at 18% 12%, var(--note-sheen), transparent 38%),
                        linear-gradient(115deg, color-mix(in srgb, var(--note-sheen) 55%, transparent), transparent 45%);
                    content: '';
                    pointer-events: none;
                }
                .note-card p {
                    position: relative;
                    z-index: 1;
                    width: 100%;
                    margin: 0;
                    font-family: var(--font-body);
                    font-weight: 500;
                    line-height: 1.27;
                    letter-spacing: -0.015em;
                    white-space: pre-wrap;
                    overflow-wrap: anywhere;
                }
                .note-text-large p { font-size: clamp(1.7rem, 2.8vw, 3rem); }
                .note-text-medium p { font-size: clamp(1.2rem, 1.75vw, 1.7rem); }
                .note-text-small p { font-size: 1rem; }
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
                @keyframes notepad-float {
                    from { transform: translate3d(0, 0, 0); }
                    to { transform: translate3d(var(--drift-x), var(--drift-y), 0); }
                }
                @media (max-width: 1200px) {
                    .floating-note { grid-column: span var(--note-compact-span); }
                }
                @media (max-width: 860px) {
                    .notes-space { grid-template-columns: repeat(6, minmax(0, 1fr)); }
                    .note-shape-vertical,
                    .note-shape-square { grid-column: span 3; }
                    .note-shape-horizontal { grid-column: span 6; }
                }
                @media (max-width: 639px) {
                    .notepad-page {
                        padding-right: 0.85rem;
                        padding-left: 0.85rem;
                    }
                    .notepad-page h1 { font-size: clamp(3.75rem, 18vw, 5.5rem); }
                    .notepad-form textarea {
                        min-height: 320px;
                        padding: 1.35rem 1.35rem 3.75rem;
                        border-radius: 26px;
                    }
                    .enter-hint {
                        right: 1.35rem;
                        bottom: 1.1rem;
                    }
                    .notes-space {
                        grid-template-columns: 1fr;
                        row-gap: 3.5rem;
                        padding: 0 0.8rem;
                    }
                    .note-shape-vertical,
                    .note-shape-square,
                    .note-shape-horizontal { grid-column: 1; }
                    .floating-note { width: 100% !important; margin-top: 1.25rem !important; }
                }
                @media (prefers-reduced-motion: reduce) {
                    .floating-note { animation: none; }
                    .notepad-form textarea { transition: none; }
                }
            `}</style>
        </main>
    );
}
