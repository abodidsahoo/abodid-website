import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MoodboardPolaroidViewer from './MoodboardPolaroidViewer.jsx';
import { analyzeImage } from './PaletteExtractor.jsx';

const idle = (callback) => {
    if (typeof window === 'undefined') return 0;
    if ('requestIdleCallback' in window) {
        return window.requestIdleCallback(callback, { timeout: 900 });
    }
    return window.setTimeout(callback, 80);
};

const cancelIdle = (id) => {
    if (typeof window === 'undefined') return;
    if ('cancelIdleCallback' in window) window.cancelIdleCallback(id);
    else window.clearTimeout(id);
};

export default function BoudoirMoodboard({ items = [], deepLinkParam = 'photo' }) {
    const photos = useMemo(
        () => (Array.isArray(items) ? items : []).filter(
            (item) => item?.id && item?.imageUrl && item?.thumbnailUrl,
        ),
        [items],
    );
    const [activeId, setActiveId] = useState(null);
    const assetCacheRef = useRef({});
    const queuedRef = useRef(new Set());
    const runningRef = useRef(false);
    const idleTaskRef = useRef(0);
    const cardRefs = useRef(new Map());

    const syncUrl = useCallback((id) => {
        if (typeof window === 'undefined' || !deepLinkParam) return;
        const url = new URL(window.location.href);
        if (id) url.searchParams.set(deepLinkParam, id);
        else url.searchParams.delete(deepLinkParam);
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }, [deepLinkParam]);

    const runPaletteQueue = useCallback(() => {
        if (runningRef.current || !queuedRef.current.size) return;
        runningRef.current = true;

        const [id] = queuedRef.current;
        queuedRef.current.delete(id);
        const item = photos.find((photo) => photo.id === id);
        if (!item || assetCacheRef.current[item.imageUrl]) {
            runningRef.current = false;
            runPaletteQueue();
            return;
        }

        idleTaskRef.current = idle(() => {
            analyzeImage(item.paletteImageUrl || item.thumbnailUrl)
                .then((analysis) => {
                    assetCacheRef.current[item.imageUrl] = analysis;
                })
                .catch(() => {})
                .finally(() => {
                    runningRef.current = false;
                    runPaletteQueue();
                });
        });
    }, [photos]);

    const queuePalette = useCallback((item, urgent = false) => {
        if (!item || assetCacheRef.current[item.imageUrl]) return;
        if (urgent) {
            queuedRef.current.delete(item.id);
            const existing = [...queuedRef.current];
            queuedRef.current = new Set([item.id, ...existing]);
        } else {
            queuedRef.current.add(item.id);
        }
        runPaletteQueue();
    }, [runPaletteQueue]);

    const preloadViewerImage = useCallback((item) => {
        if (typeof window === 'undefined' || !item?.imageUrl) return;
        const image = new window.Image();
        image.decoding = 'async';
        image.src = item.imageUrl;
    }, []);

    const openPhoto = useCallback((item) => {
        queuePalette(item, true);
        preloadViewerImage(item);
        setActiveId(item.id);
        syncUrl(item.id);
    }, [preloadViewerImage, queuePalette, syncUrl]);

    const closePhoto = useCallback(() => {
        setActiveId(null);
        syncUrl('');
    }, [syncUrl]);

    const changePhoto = useCallback((id) => {
        setActiveId(id);
        syncUrl(id);
    }, [syncUrl]);

    useEffect(() => {
        if (!photos.length || typeof window === 'undefined') return;
        const requested = new URLSearchParams(window.location.search).get(deepLinkParam);
        if (requested && photos.some((photo) => photo.id === requested)) {
            const item = photos.find((photo) => photo.id === requested);
            queuePalette(item, true);
            setActiveId(requested);
        }
    }, [deepLinkParam, photos, queuePalette]);

    useEffect(() => {
        if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const item = photos.find((photo) => photo.id === entry.target.dataset.photoId);
                queuePalette(item);
                observer.unobserve(entry.target);
            });
        }, { rootMargin: '700px 0px', threshold: 0.01 });

        cardRefs.current.forEach((node) => observer.observe(node));
        return () => observer.disconnect();
    }, [photos, queuePalette]);

    useEffect(() => () => {
        if (idleTaskRef.current) cancelIdle(idleTaskRef.current);
    }, []);

    return (
        <>
            <div className="boudoir-static-grid">
                {photos.map((item, index) => (
                    <figure className="boudoir-static-card" key={item.id}>
                        <button
                            ref={(node) => {
                                if (node) cardRefs.current.set(item.id, node);
                                else cardRefs.current.delete(item.id);
                            }}
                            type="button"
                            data-photo-id={item.id}
                            className="boudoir-photo-button"
                            onClick={() => openPhoto(item)}
                            onPointerEnter={() => {
                                queuePalette(item, true);
                                preloadViewerImage(item);
                            }}
                            onFocus={() => {
                                queuePalette(item, true);
                                preloadViewerImage(item);
                            }}
                            onTouchStart={() => queuePalette(item, true)}
                            aria-label={`Open ${item.title}`}
                        >
                            <img
                                src={item.thumbnailUrl}
                                alt={item.title}
                                loading={index < 12 ? 'eager' : 'lazy'}
                                fetchPriority={index < 6 ? 'high' : 'low'}
                                decoding="async"
                            />
                        </button>
                    </figure>
                ))}
            </div>

            {activeId && (
                <MoodboardPolaroidViewer
                    items={photos}
                    activeId={activeId}
                    onClose={closePhoto}
                    onChange={changePhoto}
                    sharedAssetCacheRef={assetCacheRef}
                    preloadRadius={2}
                />
            )}

            <style>{`
                .boudoir-static-grid {
                    columns: 4;
                    column-gap: 25px;
                    orphans: 1;
                    widows: 1;
                }
                .boudoir-static-card {
                    break-inside: avoid;
                    margin: 0 0 25px;
                    overflow: hidden;
                    border-radius: 14px;
                    background: #eadfce;
                }
                .boudoir-photo-button {
                    width: 100%;
                    padding: 0;
                    display: block;
                    overflow: hidden;
                    border: 0;
                    border-radius: inherit;
                    background: transparent;
                    cursor: zoom-in;
                }
                .boudoir-photo-button:focus-visible {
                    outline: 4px solid #2444ca;
                    outline-offset: -4px;
                }
                .boudoir-photo-button img {
                    width: 100%;
                    height: auto;
                    display: block;
                    vertical-align: bottom;
                    line-height: 0;
                }
                @media (max-width: 1100px) {
                    .boudoir-static-grid { columns: 3; }
                }
                @media (max-width: 760px) {
                    .boudoir-static-grid { columns: 2; }
                }
                @media (max-width: 480px) {
                    .boudoir-static-grid { columns: 1; }
                }
            `}</style>
        </>
    );
}
