import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function resolveImageUrl(item) {
    return (
        (typeof item?.imageUrl === 'string' && item.imageUrl.trim()) ||
        (typeof item?.image_url === 'string' && item.image_url.trim()) ||
        (typeof item?.url === 'string' && item.url.trim()) ||
        ''
    );
}

function resolveTitle(item, fallback) {
    return (
        (typeof item?.title === 'string' && item.title.trim()) ||
        (typeof item?.name === 'string' && item.name.trim()) ||
        fallback
    );
}

export default function MoodboardLightbox({
    items = [],
    activeId = null,
    onClose,
    onChange,
}) {
    const closeButtonRef = useRef(null);
    const dialogRef = useRef(null);
    const [mounted, setMounted] = useState(false);
    const [imageReady, setImageReady] = useState(false);
    const [imageFailed, setImageFailed] = useState(false);

    const normalizedItems = useMemo(
        () =>
            (Array.isArray(items) ? items : [])
                .map((item, index) => {
                    const imageUrl = resolveImageUrl(item);
                    if (!imageUrl) return null;

                    return {
                        id:
                            (typeof item?.id === 'string' && item.id) ||
                            `lightbox-item-${index}`,
                        title: resolveTitle(item, `Photograph ${index + 1}`),
                        imageUrl,
                    };
                })
                .filter(Boolean),
        [items],
    );

    const currentIndex = useMemo(() => {
        if (!activeId) return -1;
        return normalizedItems.findIndex((item) => item.id === activeId);
    }, [activeId, normalizedItems]);

    const currentItem = normalizedItems[currentIndex] || null;
    const hasMultipleItems = normalizedItems.length > 1;

    const changePhoto = (offset) => {
        if (!hasMultipleItems || typeof onChange !== 'function') return;
        const nextIndex =
            (currentIndex + offset + normalizedItems.length) %
            normalizedItems.length;
        onChange(normalizedItems[nextIndex].id);
    };

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        setImageReady(false);
        setImageFailed(false);
    }, [currentItem?.imageUrl]);

    useEffect(() => {
        if (!mounted || !currentItem || typeof document === 'undefined') return undefined;

        const previouslyFocused = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        const previousPaddingRight = document.body.style.paddingRight;
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

        document.body.style.overflow = 'hidden';
        if (scrollbarWidth > 0) {
            document.body.style.paddingRight = `${scrollbarWidth}px`;
        }
        closeButtonRef.current?.focus({ preventScroll: true });

        return () => {
            document.body.style.overflow = previousOverflow;
            document.body.style.paddingRight = previousPaddingRight;
            if (previouslyFocused instanceof HTMLElement) {
                previouslyFocused.focus({ preventScroll: true });
            }
        };
    }, [mounted, Boolean(currentItem)]);

    useEffect(() => {
        if (!currentItem || typeof window === 'undefined') return undefined;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose?.();
                return;
            }

            if (event.key === 'ArrowRight') {
                event.preventDefault();
                changePhoto(1);
                return;
            }

            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                changePhoto(-1);
                return;
            }

            if (event.key !== 'Tab' || !dialogRef.current) return;
            const focusable = Array.from(
                dialogRef.current.querySelectorAll('button:not([disabled])'),
            );
            if (!focusable.length) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, currentItem, hasMultipleItems, normalizedItems, onChange, onClose]);

    useEffect(() => {
        if (!currentItem || !hasMultipleItems || typeof window === 'undefined') {
            return undefined;
        }

        const adjacentIndexes = [
            (currentIndex - 1 + normalizedItems.length) % normalizedItems.length,
            (currentIndex + 1) % normalizedItems.length,
        ];
        adjacentIndexes.forEach((index) => {
            const preload = new window.Image();
            preload.decoding = 'async';
            preload.src = normalizedItems[index].imageUrl;
        });

        return undefined;
    }, [currentIndex, currentItem, hasMultipleItems, normalizedItems]);

    if (!mounted || !currentItem) return null;

    return createPortal(
        <div
            ref={dialogRef}
            className="moodboard-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label={`Photograph ${currentIndex + 1} of ${normalizedItems.length}`}
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose?.();
            }}
        >
            <button
                ref={closeButtonRef}
                type="button"
                className="moodboard-lightbox__close"
                onClick={() => onClose?.()}
                aria-label="Close photo"
                title="Close (Escape)"
            >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" />
                </svg>
            </button>

            {hasMultipleItems && (
                <button
                    type="button"
                    className="moodboard-lightbox__nav moodboard-lightbox__nav--previous"
                    onClick={() => changePhoto(-1)}
                    aria-label="Previous photograph"
                    title="Previous (Left Arrow)"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M15 5l-7 7 7 7" />
                    </svg>
                </button>
            )}

            <figure className="moodboard-lightbox__figure">
                <div className="moodboard-lightbox__stage">
                    {!imageReady && !imageFailed && (
                        <span className="moodboard-lightbox__loader" aria-label="Loading photograph" />
                    )}
                    {imageFailed ? (
                        <p className="moodboard-lightbox__error" role="alert">
                            This photograph could not be loaded.
                        </p>
                    ) : (
                        <img
                            key={currentItem.id}
                            src={currentItem.imageUrl}
                            alt={currentItem.title}
                            onLoad={() => setImageReady(true)}
                            onError={() => {
                                setImageReady(true);
                                setImageFailed(true);
                            }}
                            className={imageReady ? 'is-ready' : ''}
                            decoding="async"
                        />
                    )}
                </div>
                <figcaption className="moodboard-lightbox__counter" aria-live="polite">
                    {currentIndex + 1} / {normalizedItems.length}
                </figcaption>
            </figure>

            {hasMultipleItems && (
                <button
                    type="button"
                    className="moodboard-lightbox__nav moodboard-lightbox__nav--next"
                    onClick={() => changePhoto(1)}
                    aria-label="Next photograph"
                    title="Next (Right Arrow)"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            )}

            <style>{`
                .moodboard-lightbox {
                    position: fixed;
                    inset: 0;
                    z-index: 10050;
                    display: grid;
                    place-items: center;
                    padding: clamp(4.25rem, 8vh, 6.5rem) clamp(4rem, 8vw, 8rem) clamp(3rem, 6vh, 5rem);
                    background: rgba(5, 5, 7, 0.82);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    animation: moodboard-lightbox-in 180ms ease-out both;
                }

                .moodboard-lightbox__figure {
                    position: relative;
                    width: min(78vw, 1120px);
                    height: min(72dvh, 840px);
                    margin: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-width: 0;
                    animation: moodboard-lightbox-photo-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
                }

                .moodboard-lightbox__stage {
                    position: relative;
                    width: 100%;
                    min-height: 0;
                    flex: 1;
                    display: grid;
                    place-items: center;
                }

                .moodboard-lightbox__stage img {
                    display: block;
                    width: 100%;
                    height: 100%;
                    min-width: 0;
                    min-height: 0;
                    object-fit: contain;
                    opacity: 0;
                    filter: drop-shadow(0 20px 45px rgba(0, 0, 0, 0.42));
                    transition: opacity 150ms ease;
                }

                .moodboard-lightbox__stage img.is-ready {
                    opacity: 1;
                }

                .moodboard-lightbox__close,
                .moodboard-lightbox__nav {
                    appearance: none;
                    border-radius: 999px;
                    display: grid;
                    place-items: center;
                    cursor: pointer;
                    z-index: 2;
                    transition: transform 160ms ease, background-color 160ms ease, box-shadow 160ms ease;
                }

                .moodboard-lightbox__close {
                    position: absolute;
                    top: max(1.25rem, env(safe-area-inset-top));
                    right: max(1.25rem, env(safe-area-inset-right));
                    width: 48px;
                    height: 48px;
                    padding: 0;
                    border: 2px solid #fff;
                    background: #fff;
                    color: #111;
                    box-shadow: 0 8px 26px rgba(0, 0, 0, 0.32);
                }

                .moodboard-lightbox__nav {
                    position: absolute;
                    top: 50%;
                    width: 46px;
                    height: 46px;
                    padding: 0;
                    border: 1px solid rgba(255, 255, 255, 0.68);
                    background: rgba(8, 8, 10, 0.5);
                    color: #fff;
                    transform: translateY(-50%);
                }

                .moodboard-lightbox__nav--previous {
                    left: max(1.25rem, env(safe-area-inset-left));
                }

                .moodboard-lightbox__nav--next {
                    right: max(1.25rem, env(safe-area-inset-right));
                }

                .moodboard-lightbox__close svg,
                .moodboard-lightbox__nav svg {
                    width: 23px;
                    height: 23px;
                    fill: none;
                    stroke: currentColor;
                    stroke-width: 2;
                    stroke-linecap: round;
                    stroke-linejoin: round;
                }

                .moodboard-lightbox__close:hover,
                .moodboard-lightbox__close:focus-visible {
                    transform: scale(1.07);
                    box-shadow: 0 10px 32px rgba(0, 0, 0, 0.42);
                }

                .moodboard-lightbox__nav:hover,
                .moodboard-lightbox__nav:focus-visible {
                    background: rgba(255, 255, 255, 0.18);
                    transform: translateY(-50%) scale(1.07);
                }

                .moodboard-lightbox__close:focus-visible,
                .moodboard-lightbox__nav:focus-visible {
                    outline: 2px solid #fff;
                    outline-offset: 4px;
                }

                .moodboard-lightbox__counter {
                    flex: 0 0 auto;
                    margin-top: 0.9rem;
                    color: rgba(255, 255, 255, 0.76);
                    font-family: var(--font-ui);
                    font-size: 0.72rem;
                    font-variant-numeric: tabular-nums;
                    letter-spacing: 0.16em;
                }

                .moodboard-lightbox__loader {
                    position: absolute;
                    width: 30px;
                    height: 30px;
                    border: 2px solid rgba(255, 255, 255, 0.2);
                    border-top-color: #fff;
                    border-radius: 50%;
                    animation: moodboard-lightbox-spin 700ms linear infinite;
                }

                .moodboard-lightbox__error {
                    margin: 0;
                    color: #fff;
                    font-family: var(--font-ui);
                    font-size: 0.82rem;
                }

                @keyframes moodboard-lightbox-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes moodboard-lightbox-photo-in {
                    from { opacity: 0; transform: scale(0.97); }
                    to { opacity: 1; transform: scale(1); }
                }

                @keyframes moodboard-lightbox-spin {
                    to { transform: rotate(360deg); }
                }

                @media (max-width: 720px) {
                    .moodboard-lightbox {
                        padding: calc(4.25rem + env(safe-area-inset-top)) 3.25rem calc(2.5rem + env(safe-area-inset-bottom));
                    }

                    .moodboard-lightbox__figure {
                        width: calc(100vw - 6.5rem);
                        height: min(72dvh, 760px);
                    }

                    .moodboard-lightbox__close {
                        width: 44px;
                        height: 44px;
                    }

                    .moodboard-lightbox__nav {
                        width: 40px;
                        height: 40px;
                    }

                    .moodboard-lightbox__nav--previous {
                        left: max(0.45rem, env(safe-area-inset-left));
                    }

                    .moodboard-lightbox__nav--next {
                        right: max(0.45rem, env(safe-area-inset-right));
                    }
                }

                @media (prefers-reduced-motion: reduce) {
                    .moodboard-lightbox,
                    .moodboard-lightbox__figure,
                    .moodboard-lightbox__loader {
                        animation: none;
                    }

                    .moodboard-lightbox__stage img,
                    .moodboard-lightbox__close,
                    .moodboard-lightbox__nav {
                        transition: none;
                    }
                }
            `}</style>
        </div>,
        document.body,
    );
}
