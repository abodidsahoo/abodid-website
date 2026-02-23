import React, { useEffect, useMemo, useRef, useState } from 'react';
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
                        imageUrl,
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
    const imgRef = useRef(null);
    const assetCacheRef = useRef({});

    const currentItem = normalizedItems[currentIndex] || null;
    const imageUrl = currentItem?.imageUrl || '';
    const cachedData = imageUrl ? assetCacheRef.current[imageUrl] : null;

    useEffect(() => {
        setMounted(true);
    }, []);

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
            const aspect = cached.dimensions.width / cached.dimensions.height;
            let width = maxHeight * aspect;
            if (width > maxWidth) width = maxWidth;
            setLayoutWidth(`${Math.round(width)}px`);
            setIsLayoutStable(true);
        } else {
            setLayoutWidth('auto');
            setIsLayoutStable(false);
        }

        const safetyTimer = window.setTimeout(() => {
            setLoading(false);
            setIsLayoutStable(true);
            setLayoutWidth((current) => (current === 'auto' ? '100%' : current));
        }, 900);

        return () => window.clearTimeout(safetyTimer);
    }, [imageUrl]);

    useEffect(() => {
        if (!normalizedItems.length) return undefined;

        const indexesToPreload = [];
        for (let i = 1; i <= 5; i += 1) {
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

            analyzeImage(item.imageUrl)
                .then((result) => {
                    assetCacheRef.current[item.imageUrl] = result;
                })
                .catch(() => {});
        });

        return undefined;
    }, [currentIndex, normalizedItems]);

    useEffect(() => {
        if (isLayoutStable && shutterState === 'closed') {
            const timerId = window.setTimeout(() => setShutterState('opening'), 50);
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
        setLoading(false);
        if (!imgRef.current) return;
        const nextWidth = `${imgRef.current.clientWidth}px`;
        setLayoutWidth(nextWidth);
        setIsLayoutStable(true);
    };

    const handleDominantColor = (rgbString) => {
        setOverlayColor(toOverlayColor(rgbString));
    };

    const handleShutterClosed = () => {
        setShutterState('closed');
        if (!normalizedItems.length || pendingOffset === 0) return;
        setCurrentIndex(
            (value) =>
                (value + pendingOffset + normalizedItems.length) %
                normalizedItems.length,
        );
        setPendingOffset(0);
    };

    const handleShutterOpened = () => {
        setShutterState('open');
    };

    const requestSwitch = (offset) => {
        if (!normalizedItems.length) return;
        if (shutterState !== 'open' && shutterState !== 'opening') return;
        setPendingOffset(offset);
        setShutterState('closing');
    };

    const nextImage = (event) => {
        if (event) event.stopPropagation();
        requestSwitch(1);
    };

    const prevImage = (event) => {
        if (event) event.stopPropagation();
        requestSwitch(-1);
    };

    if (!mounted || !activeId || !currentItem) {
        return null;
    }

    return createPortal(
        <AnimatePresence>
            <motion.div
                className="moodboard-polaroid-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, backgroundColor: overlayColor }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            >
                <button
                    type="button"
                    className="global-nav-btn prev"
                    onClick={prevImage}
                    title="Previous (Left Arrow)"
                >
                    <svg
                        viewBox="0 0 24 24"
                        width="24"
                        height="24"
                        stroke="white"
                        strokeWidth="2"
                        fill="none"
                    >
                        <path d="M15 18l-6-6 6-6" />
                    </svg>
                </button>

                <button
                    type="button"
                    className="global-nav-btn next"
                    onClick={nextImage}
                    title="Next (Right Arrow)"
                >
                    <svg
                        viewBox="0 0 24 24"
                        width="24"
                        height="24"
                        stroke="white"
                        strokeWidth="2"
                        fill="none"
                    >
                        <path d="M9 18l6-6-6-6" />
                    </svg>
                </button>

                <button
                    type="button"
                    className="close-viewer-btn"
                    onClick={(event) => {
                        event.stopPropagation();
                        if (typeof onClose === 'function') onClose();
                    }}
                    aria-label="Close photo viewer"
                >
                    x
                </button>

                <motion.div
                    className="lightbox-polaroid"
                    onClick={(event) => event.stopPropagation()}
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{
                        scale: 1,
                        opacity: 1,
                        y: 0,
                        scaleY:
                            shutterState === 'closing' || shutterState === 'closed'
                                ? 0.02
                                : 1,
                        boxShadow:
                            shutterState === 'closing' || shutterState === 'closed'
                                ? '0px 0px 0px rgba(0,0,0,0)'
                                : '5px 8px 30px rgba(0,0,0,0.5)',
                    }}
                    transition={{
                        duration: shutterState === 'closing' ? 0.12 : 0.2,
                        ease:
                            shutterState === 'closing'
                                ? [0.7, 0, 0.84, 0]
                                : [0.16, 1, 0.3, 1],
                        delay: shutterState === 'closing' ? 0.05 : 0,
                    }}
                    onAnimationComplete={(definition) => {
                        if (
                            shutterState === 'closing' &&
                            definition?.scaleY === 0.02
                        ) {
                            handleShutterClosed();
                        }
                    }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                >
                    <div className="lightbox-inner">
                        <motion.div
                            className="lightbox-image-area"
                            animate={{
                                clipPath:
                                    shutterState === 'closing' ||
                                    shutterState === 'closed'
                                        ? 'inset(50% 0 50% 0)'
                                        : 'inset(0% 0 0% 0)',
                            }}
                            transition={{
                                duration: shutterState === 'closing' ? 0.1 : 0.2,
                                ease:
                                    shutterState === 'closing'
                                        ? [0.7, 0, 0.84, 0]
                                        : [0.16, 1, 0.3, 1],
                                delay:
                                    shutterState === 'opening' ||
                                    shutterState === 'open'
                                        ? 0.1
                                        : 0,
                            }}
                            onAnimationComplete={(definition) => {
                                if (
                                    shutterState === 'opening' &&
                                    definition?.clipPath === 'inset(0% 0 0% 0)'
                                ) {
                                    handleShutterOpened();
                                }
                            }}
                        >
                            <AnimatePresence mode="wait">
                                <motion.img
                                    key={currentItem.id}
                                    ref={imgRef}
                                    src={imageUrl}
                                    alt={currentItem.title}
                                    onLoad={handleImageLoad}
                                    onError={() => {
                                        setLoading(false);
                                        setIsLayoutStable(true);
                                    }}
                                    style={{ opacity: loading ? 0.01 : 1 }}
                                    initial={{ opacity: 1 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 1 }}
                                />
                            </AnimatePresence>
                        </motion.div>

                        <div
                            className="lightbox-caption"
                            style={{
                                width: layoutWidth,
                                opacity: layoutWidth !== 'auto' ? 1 : 0,
                                transition: 'opacity 0.1s',
                            }}
                        >
                            <div className="caption-copy">
                                <h3 className="lightbox-title" title={currentItem.title}>
                                    {currentItem.title}
                                </h3>
                            </div>
                            <PaletteExtractor
                                imageUrl={imageUrl}
                                onExtract={handleDominantColor}
                                inline={true}
                                initialPalette={cachedData?.palette}
                            />
                        </div>

                        {currentItem.projectHref && (
                            <a
                                className="project-link"
                                href={currentItem.projectHref}
                            >
                                Open Project
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
                    }

                    .lightbox-polaroid {
                        background: #fdfdfd;
                        padding: 24px;
                        padding-bottom: 64px;
                        width: fit-content;
                        max-width: 90vw;
                        max-height: 90vh;
                        display: flex;
                        flex-direction: column;
                        border-radius: 2px;
                        box-shadow: 0 50px 100px rgba(0, 0, 0, 0.5);
                        margin: auto;
                    }

                    .lightbox-inner {
                        display: flex;
                        flex-direction: column;
                        align-items: flex-start;
                        width: fit-content;
                        max-width: 100%;
                    }

                    .lightbox-image-area {
                        background: #eee;
                        max-height: 65vh;
                        overflow: hidden;
                        display: flex;
                        justify-content: center;
                    }

                    .lightbox-image-area img {
                        max-height: 65vh;
                        max-width: 80vw;
                        height: auto;
                        width: auto;
                        display: block;
                        object-fit: contain;
                    }

                    .lightbox-caption {
                        width: 100%;
                        color: #222;
                        margin-top: 1.5rem;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        gap: 2rem;
                        overflow: hidden;
                    }

                    .caption-copy {
                        min-width: 0;
                        flex: 1;
                    }

                    .lightbox-title {
                        font-family: var(--font-ui);
                        font-size: 0.86rem;
                        font-weight: 700;
                        margin: 0;
                        color: #2a2a2a;
                        line-height: 1.35;
                        letter-spacing: 0.08em;
                        text-transform: uppercase;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
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
                        bottom: 36px;
                        left: 50%;
                        transform: translateX(-50%);
                        font-family: var(--font-ui);
                        font-size: 0.8rem;
                        color: rgba(255, 255, 255, 0.6);
                        letter-spacing: 0.2em;
                        display: flex;
                        gap: 0.5rem;
                        align-items: center;
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
                        background: rgba(255, 255, 255, 0.05);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        width: 44px;
                        height: 44px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        transition: all 0.2s;
                        z-index: 10051;
                    }

                    .global-nav-btn:hover {
                        background: rgba(255, 255, 255, 0.15);
                        transform: translateY(-50%) scale(1.1);
                    }

                    .global-nav-btn.prev {
                        left: 40px;
                    }

                    .global-nav-btn.next {
                        right: 40px;
                    }

                    .close-viewer-btn {
                        position: absolute;
                        top: 20px;
                        right: 22px;
                        border: 1px solid rgba(255, 255, 255, 0.2);
                        background: rgba(0, 0, 0, 0.22);
                        color: rgba(255, 255, 255, 0.92);
                        width: 36px;
                        height: 36px;
                        border-radius: 999px;
                        font-family: var(--font-ui);
                        font-size: 0.92rem;
                        cursor: pointer;
                        text-transform: uppercase;
                        z-index: 10051;
                    }

                    .close-viewer-btn:hover {
                        background: rgba(255, 255, 255, 0.12);
                    }

                    @media (max-width: 900px) {
                        .global-nav-btn.prev {
                            left: 14px;
                        }

                        .global-nav-btn.next {
                            right: 14px;
                        }

                        .close-viewer-btn {
                            right: 14px;
                            top: 14px;
                        }

                        .lightbox-caption {
                            flex-direction: column;
                            align-items: flex-start;
                            gap: 0.9rem;
                        }

                        .lightbox-title {
                            font-size: 0.78rem;
                        }
                    }
                `}</style>
            </motion.div>
        </AnimatePresence>,
        document.body,
    );
}
