import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import PaletteExtractor, { analyzeImage } from './PaletteExtractor.jsx';

function resolveImageUrl(item) {
    return (
        (typeof item?.imageUrl === 'string' && item.imageUrl.trim()) ||
        (typeof item?.image_url === 'string' && item.image_url.trim()) ||
        (typeof item?.image === 'string' && item.image.trim()) ||
        (typeof item?.url === 'string' && item.url.trim()) ||
        ''
    );
}

function resolveTitle(item, fallback = 'Untitled') {
    return (
        (typeof item?.title === 'string' && item.title.trim()) ||
        (typeof item?.name === 'string' && item.name.trim()) ||
        fallback
    );
}

function toOverlayColor(rgbString) {
    if (typeof rgbString !== 'string' || !rgbString.startsWith('rgb')) {
        return 'rgba(10,10,10,0.95)';
    }
    return rgbString.replace('rgb', 'rgba').replace(')', ', 0.95)');
}

export default function MoodboardPolaroidViewer({
    items = [],
    activeId = null,
    onClose,
    onChange,
    onSelectColorFilter = null,
    sharedAssetCacheRef = null,
    preloadRadius = 5,
    showTitles = true,
}) {

    const normalizedItems = useMemo(
        () =>
            (Array.isArray(items) ? items : [])
                .map((item, index) => {
                    const imageUrl = resolveImageUrl(item);
                    if (!imageUrl) return null;
                    return {
                        id:
                            (typeof item?.id === 'string' && item.id) ||
                            `viewer-item-${index}`,
                        title: resolveTitle(item),
                        caption:
                            (typeof item?.caption === 'string' && item.caption.trim()) ||
                            '',
                        projectHref:
                            (typeof item?.projectHref === 'string' && item.projectHref.trim()) ||
                            (typeof item?.href === 'string' && item.href.trim()) ||
                            '',
                        sourceUrl:
                            (typeof item?.sourceUrl === 'string' && item.sourceUrl.trim()) ||
                            (typeof item?.source_url === 'string' && item.source_url.trim()) ||
                            '',
                        artistName:
                            (typeof item?.artistName === 'string' && item.artistName.trim()) ||
                            (typeof item?.artist_name === 'string' && item.artist_name.trim()) ||
                            '',
                        imageUrl,
                        palette: item?.palette || null,
                        paletteImageUrl:
                            (typeof item?.paletteImageUrl === 'string' && item.paletteImageUrl.trim()) ||
                            (imageUrl.startsWith('http') && !imageUrl.includes('/api/image-palette-proxy')
                                ? `/api/image-palette-proxy?url=${encodeURIComponent(imageUrl)}`
                                : imageUrl),
                    };
                })
                .filter(Boolean),
        [items],
    );


    const initialIndex = useMemo(() => {
        if (!activeId || !normalizedItems.length) return 0;
        const index = normalizedItems.findIndex((entry) => entry.id === activeId);
        return index >= 0 ? index : 0;
    }, [activeId, normalizedItems]);

    const [mounted, setMounted] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [layoutWidth, setLayoutWidth] = useState('auto');
    const [isLayoutStable, setIsLayoutStable] = useState(false);
    const [loading, setLoading] = useState(true);
    const [shutterState, setShutterState] = useState('open');
    const [pendingOffset, setPendingOffset] = useState(0);
    const [overlayColor, setOverlayColor] = useState('rgba(10,10,10,0.95)');
    const [hoveredSwatch, setHoveredSwatch] = useState(null); // { color, name }
    const imgRef = useRef(null);
    const closeButtonRef = useRef(null);
    const localAssetCacheRef = useRef({});
    const assetCacheRef = sharedAssetCacheRef || localAssetCacheRef;

    const currentItem = normalizedItems[currentIndex] || null;
    const imageUrl = currentItem?.imageUrl || '';
    const cachedData = imageUrl ? assetCacheRef.current[imageUrl] : null;

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted || typeof document === 'undefined') return undefined;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const focusFrame = window.requestAnimationFrame(() => {
            closeButtonRef.current?.focus({ preventScroll: true });
        });

        return () => {
            window.cancelAnimationFrame(focusFrame);
            document.body.style.overflow = previousOverflow;
        };
    }, [mounted]);

    useEffect(() => {
        if (!normalizedItems.length) return;
        setCurrentIndex(initialIndex);
    }, [initialIndex, normalizedItems]);

    useEffect(() => {
        if (!currentItem?.id || typeof onChange !== 'function') return;
        onChange(currentItem.id);
    }, [currentItem?.id, onChange]);

    useEffect(() => {
        if (!cachedData?.bg) return;
        setOverlayColor(toOverlayColor(cachedData.bg));
    }, [cachedData?.bg]);

    useEffect(() => {
        if (!imageUrl) return;
        setLoading(true);

        const cached = assetCacheRef.current[imageUrl];
        if (cached?.dimensions && typeof window !== 'undefined') {
            const maxHeight = window.innerHeight * 0.65;
            const maxWidth = window.innerWidth * 0.8;
            const MIN_LAYOUT_WIDTH = Math.min(340, maxWidth);
            const aspect = cached.dimensions.width / cached.dimensions.height;
            let width = Math.max(MIN_LAYOUT_WIDTH, maxHeight * aspect);
            if (width > maxWidth) width = maxWidth;
            setLayoutWidth(`${Math.round(width)}px`);
            setIsLayoutStable(true);
        } else {
            setLayoutWidth('auto');
            setIsLayoutStable(false);
        }

        const safetyTimer = window.setTimeout(() => {
            setIsLayoutStable(true);
        }, 300);

        return () => window.clearTimeout(safetyTimer);
    }, [imageUrl]);

    useEffect(() => {
        if (!normalizedItems.length) return undefined;

        const indexesToPreload = [];
        for (let i = 1; i <= preloadRadius; i += 1) {
            indexesToPreload.push((currentIndex + i) % normalizedItems.length);
            indexesToPreload.push(
                (currentIndex - i + normalizedItems.length) % normalizedItems.length,
            );
        }

        indexesToPreload.forEach((index) => {
            const item = normalizedItems[index];
            if (!item?.imageUrl || assetCacheRef.current[item.imageUrl]) return;

            const preloadLink = document.createElement('link');
            preloadLink.rel = 'preload';
            preloadLink.as = 'image';
            preloadLink.href = item.imageUrl;
            document.head.appendChild(preloadLink);

            analyzeImage(item.paletteImageUrl || item.imageUrl)
                .then((result) => {
                    assetCacheRef.current[item.imageUrl] = result;
                })
                .catch(() => {});
        });

        return undefined;
    }, [currentIndex, normalizedItems, preloadRadius, assetCacheRef]);

    useEffect(() => {
        if (isLayoutStable && shutterState === 'closed') {
            const timerId = window.setTimeout(() => setShutterState('opening'), 20);
            return () => window.clearTimeout(timerId);
        }
        return undefined;
    }, [isLayoutStable, shutterState]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'ArrowRight') {
                event.preventDefault();
                requestSwitch(1);
            }
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                requestSwitch(-1);
            }
            if (event.key === 'Escape' && typeof onClose === 'function') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    });

    const handleImageLoad = () => {
        if (imgRef.current) {
            const MIN_LAYOUT_WIDTH = 340;
            const measuredWidth = imgRef.current.clientWidth;
            const nextWidth = `${Math.max(MIN_LAYOUT_WIDTH, measuredWidth)}px`;
            setLayoutWidth(nextWidth);
            if (imageUrl) {
                const existing = assetCacheRef.current[imageUrl] || {};
                assetCacheRef.current[imageUrl] = {
                    ...existing,
                    dimensions: {
                        width: Math.max(MIN_LAYOUT_WIDTH, imgRef.current.naturalWidth || imgRef.current.clientWidth),
                        height: imgRef.current.naturalHeight || imgRef.current.clientHeight,
                    },
                };
            }
        }
        setIsLayoutStable(true);
    };

    const handleDominantColor = useCallback((rgbString, palette) => {
        setOverlayColor(toOverlayColor(rgbString));
        if (imageUrl) {
            const existing = assetCacheRef.current[imageUrl] || {};
            assetCacheRef.current[imageUrl] = {
                ...existing,
                bg: rgbString,
                ...(palette ? { palette } : {}),
            };
        }
    }, [imageUrl, assetCacheRef]);

    const handleShutterClosed = () => {
        setShutterState('closed');
        setHoveredSwatch(null);
        if (!normalizedItems.length || pendingOffset === 0) return;
        const nextIndex =
            (currentIndex + pendingOffset + normalizedItems.length) %
            normalizedItems.length;
        setCurrentIndex(nextIndex);
        setPendingOffset(0);

        const nextItem = normalizedItems[nextIndex];
        const nextUrl = nextItem?.imageUrl;
        const isCached = nextUrl && assetCacheRef.current[nextUrl]?.dimensions;
        if (isCached) {
            setIsLayoutStable(true);
        } else {
            setIsLayoutStable(false);
        }
    };

    const handleShutterOpened = () => {
        setShutterState('open');
    };

    const requestSwitch = (offset) => {
        if (!normalizedItems.length) return;
        if (shutterState !== 'open') return;
        setPendingOffset(offset);
        setShutterState('closing');
    };

    const handleCloseClick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof onClose === 'function') onClose();
    };

    const handleNavigationClick = (event, offset) => {
        event.preventDefault();
        event.stopPropagation();
        requestSwitch(offset);
    };

    const itemAspect =
        cachedData?.dimensions?.width && cachedData?.dimensions?.height
            ? `${cachedData.dimensions.width} / ${cachedData.dimensions.height}`
            : undefined;

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            <motion.div
                className="moodboard-polaroid-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, backgroundColor: overlayColor }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => {
                    if (e.target === e.currentTarget && typeof onClose === 'function') {
                        onClose();
                    }
                }}
            >
                <button
                    ref={closeButtonRef}
                    type="button"
                    className="close-viewer-btn"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={handleCloseClick}
                    aria-label="Close photo"
                >
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                        <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                </button>

                {normalizedItems.length > 1 && (
                    <>
                        <button
                            type="button"
                            className="global-nav-btn prev"
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => handleNavigationClick(event, -1)}
                            disabled={shutterState !== 'open'}
                            aria-label={`Previous photo: ${normalizedItems[(currentIndex - 1 + normalizedItems.length) % normalizedItems.length]?.title || ''}`}
                        >
                            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7"/></svg>
                        </button>
                        <button
                            type="button"
                            className="global-nav-btn next"
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => handleNavigationClick(event, 1)}
                            disabled={shutterState !== 'open'}
                            aria-label={`Next photo: ${normalizedItems[(currentIndex + 1) % normalizedItems.length]?.title || ''}`}
                        >
                            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
                        </button>
                    </>
                )}

                <motion.div
                    className="lightbox-polaroid"
                    initial={{ scale: 0.94, opacity: 0, y: 16 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.94, opacity: 0, y: 16 }}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="lightbox-inner">
                        <motion.div
                            className="lightbox-image-area"
                            style={itemAspect ? { aspectRatio: itemAspect } : undefined}
                            animate={{
                                clipPath:
                                    shutterState === 'closing' || shutterState === 'closed'
                                        ? 'inset(50% 0 50% 0)'
                                        : 'inset(0% 0 0% 0)',
                            }}
                            transition={{
                                duration: shutterState === 'closing' ? 0.14 : 0.2,
                                ease:
                                    shutterState === 'closing'
                                        ? [0.7, 0, 0.84, 0]
                                        : [0.16, 1, 0.3, 1],
                            }}
                            onAnimationComplete={() => {
                                if (shutterState === 'closing') {
                                    handleShutterClosed();
                                } else if (shutterState === 'opening') {
                                    handleShutterOpened();
                                }
                            }}
                        >
                            <img
                                key={currentItem.id}
                                ref={imgRef}
                                src={imageUrl}
                                alt={currentItem.title}
                                onLoad={handleImageLoad}
                                onError={() => {
                                    setIsLayoutStable(true);
                                }}
                            />
                        </motion.div>

                        <div
                            className="lightbox-caption"
                            style={{
                                width: layoutWidth !== 'auto' ? layoutWidth : '100%',
                            }}
                        >
                            <div className="caption-copy">
                                {hoveredSwatch ? (
                                    <div className="lightbox-hovered-swatch">
                                        <span className="hovered-swatch-name">{hoveredSwatch.name}</span>
                                    </div>
                                ) : showTitles ? (
                                    <h3 className="lightbox-title" title={currentItem.title}>
                                        {currentItem.projectHref ? (
                                            <a href={currentItem.projectHref}>
                                                {currentItem.title}
                                            </a>
                                        ) : (
                                            currentItem.title
                                        )}
                                    </h3>
                                ) : null}
                            </div>

                            <div className="lightbox-palette-container">
                                <PaletteExtractor
                                    imageUrl={currentItem.paletteImageUrl || imageUrl}
                                    onExtract={handleDominantColor}
                                    inline={true}
                                    initialPalette={cachedData?.palette || currentItem?.palette?.paletteHex}
                                    onSwatchHover={(color, name) => setHoveredSwatch({ color, name })}
                                    onSwatchLeave={() => setHoveredSwatch(null)}
                                    onSwatchClick={(color, name) => {
                                        if (onSelectColorFilter) {
                                            onSelectColorFilter(color, name);
                                            if (onClose) onClose();
                                        }
                                    }}
                                />
                                <div className={`swatch-instruction-hint ${hoveredSwatch ? 'is-visible' : ''}`}>
                                    <span>Click to filter by color</span>
                                </div>
                            </div>

                        </div>

                        {(currentItem.sourceUrl || currentItem.projectHref) && !showTitles && (
                            <a
                                className="project-link"
                                href={currentItem.sourceUrl || currentItem.projectHref}
                                target={currentItem.sourceUrl ? '_blank' : undefined}
                                rel={currentItem.sourceUrl ? 'noopener noreferrer' : undefined}
                            >
                                {currentItem.sourceUrl
                                    ? (currentItem.artistName ? `Credit: ${currentItem.artistName}` : 'View original source')
                                    : 'Open Project'}
                            </a>
                        )}
                    </div>
                </motion.div>

                <div className="global-counter-external">
                    <span className="current">{currentIndex + 1}</span>
                    <span className="separator">/</span>
                    <span className="total">{normalizedItems.length}</span>
                </div>

                <style>{`
                    .moodboard-polaroid-overlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100vw;
                        height: 100dvh;
                        z-index: 10050;
                        background: rgba(10, 10, 10, 0.95);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        isolation: isolate;
                    }

                    .lightbox-polaroid {
                        background: #fdfdfd;
                        padding: 24px;
                        padding-bottom: 64px;
                        width: fit-content;
                        min-width: min(90vw, 360px);
                        max-width: 90vw;
                        max-height: 90vh;
                        display: flex;
                        flex-direction: column;
                        border-radius: 2px;
                        box-shadow: 0 50px 100px rgba(0, 0, 0, 0.5);
                        margin: auto;
                        box-sizing: border-box;
                    }

                    .lightbox-inner {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        width: fit-content;
                        min-width: min(100%, 320px);
                        max-width: 100%;
                    }

                    .lightbox-image-area {
                        background: #eee;
                        max-height: 65vh;
                        min-height: 220px;
                        min-width: min(100%, 320px);
                        width: 100%;
                        overflow: hidden;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }

                    .lightbox-image-area img {
                        max-height: 65vh;
                        max-width: 80vw;
                        min-width: min(100%, 300px);
                        min-height: 200px;
                        height: auto;
                        width: auto;
                        display: block;
                        object-fit: contain;
                    }

                    .lightbox-caption {
                        width: 100%;
                        min-width: 100%;
                        color: #222;
                        margin-top: 1.5rem;
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        gap: 1.5rem;
                        overflow: visible;
                        box-sizing: border-box;
                    }

                    .lightbox-caption--palette-only {
                        justify-content: flex-end;
                    }

                    .caption-copy {
                        min-width: 0;
                        flex: 1;
                        height: 56px;
                        display: flex;
                        align-items: center;
                        justify-content: flex-start;
                        text-align: left;
                    }

                    .lightbox-hovered-swatch {
                        display: flex;
                        align-items: center;
                        justify-content: flex-start;
                        padding: 0;
                        margin: 0;
                        background: transparent;
                        border: none;
                        animation: fadeInHoveredText 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                        max-width: 100%;
                    }

                    @keyframes fadeInHoveredText {
                        from {
                            opacity: 0;
                            transform: translateY(2px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }

                    .hovered-swatch-name {
                        font-family: var(--font-ui, "Satoshi", sans-serif);
                        font-size: clamp(0.85rem, 1.2vw, 1.02rem);
                        font-weight: 750;
                        color: var(--pop-ink);
                        letter-spacing: 0.06em;
                        text-transform: uppercase;
                        line-height: 1;
                        margin: 0;
                        padding: 0;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }

                    .lightbox-palette-container {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        flex-shrink: 0;
                        position: relative;
                    }

                    .swatch-instruction-hint {
                        margin-top: 6px;
                        padding: 0;
                        width: 100%;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        text-align: center;
                        font-family: var(--font-mono, "Space Mono", monospace);
                        font-size: 0.62rem;
                        font-weight: 600;
                        color: #7a756b;
                        letter-spacing: 0.04em;
                        text-transform: uppercase;
                        line-height: 1;
                        white-space: nowrap;
                        opacity: 0;
                        transform: translateY(-2px);
                        transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1), transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
                        pointer-events: none;
                    }

                    .swatch-instruction-hint.is-visible {
                        opacity: 1;
                        transform: translateY(0);
                    }

                    .lightbox-title {
                        font-family: var(--font-ui);
                        font-size: 0.86rem;
                        font-weight: 700;
                        margin: 0;
                        color: #2a2a2a;
                        line-height: 1;
                        letter-spacing: 0.08em;
                        text-transform: uppercase;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }

                    .lightbox-title a {
                        color: inherit;
                        text-decoration: none;
                        border-bottom: 1px solid rgba(42, 42, 42, 0.4);
                    }

                    .lightbox-title a:hover,
                    .lightbox-title a:focus-visible {
                        border-bottom-color: currentColor;
                    }

                    .project-link {
                        margin-top: 0.85rem;
                        font-family: var(--font-ui);
                        font-size: 0.68rem;
                        text-transform: uppercase;
                        letter-spacing: 0.08em;
                        color: #1d1d1d;
                        text-decoration: none;
                        border-bottom: 1px solid rgba(29, 29, 29, 0.45);
                    }

                    .project-link:hover {
                        border-bottom-color: rgba(29, 29, 29, 0.9);
                    }

                    .global-counter-external {
                        position: absolute;
                        bottom: max(20px, env(safe-area-inset-bottom));
                        left: 50%;
                        transform: translateX(-50%);
                        font-family: var(--font-ui);
                        font-size: 0.72rem;
                        font-weight: 700;
                        color: rgba(255, 255, 255, 0.68);
                        letter-spacing: 0.14em;
                        display: flex;
                        gap: 0.4rem;
                        align-items: center;
                        padding: 0.55rem 0.8rem;
                        border: 1px solid rgba(255, 255, 255, 0.22);
                        border-radius: 999px;
                        background: rgba(10, 10, 10, 0.76);
                        backdrop-filter: blur(10px);
                        pointer-events: none;
                    }

                    .global-counter-external .current {
                        color: white;
                        font-weight: bold;
                    }

                    .global-counter-external .separator {
                        opacity: 0.4;
                    }

                    .global-nav-btn {
                        position: absolute;
                        top: 50%;
                        transform: translateY(-50%);
                        width: 52px;
                        height: 52px;
                        padding: 0;
                        border: 2px solid #111111;
                        border-radius: 999px;
                        background: rgba(255, 255, 255, 0.96);
                        color: #111111;
                        box-shadow: 0 4px 0 rgba(17, 17, 17, 0.95);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        touch-action: manipulation;
                        -webkit-tap-highlight-color: transparent;
                        transition: transform 150ms ease, box-shadow 150ms ease, background 150ms ease;
                        z-index: 10060;
                    }

                    .global-nav-btn svg,
                    .close-viewer-btn svg {
                        width: 26px;
                        height: 26px;
                        fill: none;
                        stroke: currentColor;
                        stroke-width: 2.25;
                        stroke-linecap: round;
                        stroke-linejoin: round;
                        pointer-events: none;
                    }

                    .global-nav-btn:hover:not(:disabled),
                    .close-viewer-btn:hover {
                        background: #ffffff;
                        transform: translateY(-50%) translateY(-2px);
                        box-shadow: 0 6px 0 rgba(17, 17, 17, 0.95);
                    }

                    .global-nav-btn:active:not(:disabled) {
                        transform: translateY(-50%) translateY(2px);
                        box-shadow: 0 2px 0 rgba(17, 17, 17, 0.95);
                    }

                    .global-nav-btn:focus-visible,
                    .close-viewer-btn:focus-visible {
                        outline: 3px solid #ffffff;
                        outline-offset: 4px;
                    }

                    .global-nav-btn:disabled {
                        cursor: wait;
                        opacity: 0.58;
                    }

                    .global-nav-btn.prev {
                        left: max(22px, env(safe-area-inset-left));
                    }

                    .global-nav-btn.next {
                        right: max(22px, env(safe-area-inset-right));
                    }

                    .close-viewer-btn {
                        position: absolute;
                        top: max(18px, env(safe-area-inset-top));
                        right: max(18px, env(safe-area-inset-right));
                        width: 52px;
                        height: 52px;
                        padding: 0;
                        border: 2px solid #111111;
                        border-radius: 999px;
                        background: rgba(255, 255, 255, 0.96);
                        color: #111111;
                        box-shadow: 0 4px 0 rgba(17, 17, 17, 0.95);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        touch-action: manipulation;
                        -webkit-tap-highlight-color: transparent;
                        transition: transform 150ms ease, box-shadow 150ms ease, background 150ms ease;
                        z-index: 10060;
                    }

                    .close-viewer-btn:hover {
                        transform: translateY(-2px);
                    }

                    .close-viewer-btn:active {
                        transform: translateY(2px);
                        box-shadow: 0 2px 0 rgba(17, 17, 17, 0.95);
                    }

                    @media (max-width: 900px) {
                        .global-nav-btn.prev {
                            left: max(10px, env(safe-area-inset-left));
                        }

                        .global-nav-btn.next {
                            right: max(10px, env(safe-area-inset-right));
                        }

                        .close-viewer-btn {
                            right: max(12px, env(safe-area-inset-right));
                            top: max(12px, env(safe-area-inset-top));
                        }

                        .lightbox-caption {
                            flex-direction: row;
                            justify-content: space-between;
                            align-items: center;
                            gap: 0.75rem;
                        }

                        .hovered-swatch-name {
                            font-size: 0.82rem;
                        }

                        .lightbox-title {
                            font-size: 0.78rem;
                        }
                    }

                    @media (max-width: 560px) {
                        .global-nav-btn,
                        .close-viewer-btn {
                            width: 48px;
                            height: 48px;
                        }

                        .global-nav-btn svg,
                        .close-viewer-btn svg {
                            width: 24px;
                            height: 24px;
                        }

                        .global-nav-btn.prev {
                            left: 8px;
                        }

                        .global-nav-btn.next {
                            right: 8px;
                        }
                    }

                    @media (prefers-reduced-motion: reduce) {
                        .global-nav-btn,
                        .close-viewer-btn {
                            transition: none;
                        }
                    }
                `}</style>
            </motion.div>
        </AnimatePresence>,
        document.body,
    );
}
