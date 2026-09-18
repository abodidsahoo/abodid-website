import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MoodboardPolaroidViewer from './MoodboardPolaroidViewer.jsx';
import { analyzeImage } from './PaletteExtractor.jsx';
import { getClosestNamedColor } from '../lib/colorNaming.js';

// --- COLOR SPACE MATH & CONVERSIONS ---
function parseColorToRgb(str) {
    if (!str || typeof str !== 'string') return [128, 128, 128];
    const trimmed = str.trim();

    if (trimmed.startsWith('#')) {
        let clean = trimmed.replace('#', '');
        if (clean.length === 3) {
            clean = clean.split('').map((c) => c + c).join('');
        }
        const num = parseInt(clean, 16);
        if (!isNaN(num)) {
            return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
        }
    }

    if (trimmed.startsWith('rgb')) {
        const match = trimmed.match(/\(([^)]+)\)/);
        if (match && match[1]) {
            const parts = match[1].split(',').map((p) => parseFloat(p.trim()));
            if (parts.length >= 3 && !parts.slice(0, 3).some(isNaN)) {
                return [
                    Math.max(0, Math.min(255, Math.round(parts[0]))),
                    Math.max(0, Math.min(255, Math.round(parts[1]))),
                    Math.max(0, Math.min(255, Math.round(parts[2]))),
                ];
            }
        }
    }

    return [128, 128, 128];
}

function rgbToHex(r, g, b) {
    const toHex = (c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToLab(r, g, b) {
    let rLinear = r / 255;
    let gLinear = g / 255;
    let bLinear = b / 255;

    rLinear = rLinear > 0.04045 ? Math.pow((rLinear + 0.055) / 1.055, 2.4) : rLinear / 12.92;
    gLinear = gLinear > 0.04045 ? Math.pow((gLinear + 0.055) / 1.055, 2.4) : gLinear / 12.92;
    bLinear = bLinear > 0.04045 ? Math.pow((bLinear + 0.055) / 1.055, 2.4) : bLinear / 12.92;

    rLinear *= 100;
    gLinear *= 100;
    bLinear *= 100;

    const x = rLinear * 0.4124 + gLinear * 0.3576 + bLinear * 0.1805;
    const y = rLinear * 0.2126 + gLinear * 0.7152 + bLinear * 0.0722;
    const z = rLinear * 0.0193 + gLinear * 0.1192 + bLinear * 0.9505;

    let lX = x / 95.047;
    let lY = y / 100.000;
    let lZ = z / 108.883;

    lX = lX > 0.008856 ? Math.pow(lX, 1 / 3) : (7.787 * lX) + 16 / 116;
    lY = lY > 0.008856 ? Math.pow(lY, 1 / 3) : (7.787 * lY) + 16 / 116;
    lZ = lZ > 0.008856 ? Math.pow(lZ, 1 / 3) : (7.787 * lZ) + 16 / 116;

    const L = (116 * lY) - 16;
    const a = 500 * (lX - lY);
    const bVal = 200 * (lY - lZ);

    return [Number(L.toFixed(2)), Number(a.toFixed(2)), Number(bVal.toFixed(2))];
}

function hexToLab(hex) {
    const [r, g, b] = parseColorToRgb(hex);
    return rgbToLab(r, g, b);
}

function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            case b:
                h = (r - g) / d + 4;
                break;
        }
        h /= 6;
    }

    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hexToHsl(hex) {
    const [r, g, b] = parseColorToRgb(hex);
    return rgbToHsl(r, g, b);
}

function deltaE(lab1, lab2) {
    if (!lab1 || !lab2) return Infinity;
    const dL = lab1[0] - lab2[0];
    const da = lab1[1] - lab2[1];
    const db = lab1[2] - lab2[2];
    return Math.sqrt(dL * dL + da * da + db * db);
}

// Preset chromatic discovery palette
const DISCOVERY_PALETTES = [
    { name: 'Terracotta', hex: '#b24a2b' },
    { name: 'Ochre Amber', hex: '#d28a22' },
    { name: 'Olive Forest', hex: '#586948' },
    { name: 'Aegean Teal', hex: '#2c5963' },
    { name: 'Deep Cobalt', hex: '#22385e' },
    { name: 'Plum Noir', hex: '#4e2a42' },
    { name: 'Dusty Rose', hex: '#b97a78' },
    { name: 'Sand Cream', hex: '#d9cdb8' },
    { name: 'Charcoal', hex: '#262629' },
];

// Optimal average tolerance for overall dominant mood matching
const MOOD_DELTA_E_TOLERANCE = 22;

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

export default function MoodboardGallery({
    items = [],
    deepLinkParam = 'photo',
    showTitles = true,
}) {
    const photos = useMemo(
        () => (Array.isArray(items) ? items : []).filter(
            (item) => item?.id && item?.imageUrl && item?.thumbnailUrl,
        ),
        [items],
    );

    const [activeId, setActiveId] = useState(null);
    const [selectedSwatch, setSelectedSwatch] = useState(null); // { hex, name, lab, hsl }
    const [dynamicPalettes, setDynamicPalettes] = useState({});

    const assetCacheRef = useRef({});
    const queuedRef = useRef(new Set());
    const runningRef = useRef(false);
    const idleTaskRef = useRef(0);
    const cardRefs = useRef(new Map());

    const getPhotoPalette = useCallback((item) => {
        if (item?.palette) return item.palette;
        if (dynamicPalettes[item.id]) return dynamicPalettes[item.id];
        if (dynamicPalettes[item.imageUrl]) return dynamicPalettes[item.imageUrl];
        if (dynamicPalettes[item.thumbnailUrl]) return dynamicPalettes[item.thumbnailUrl];
        return null;
    }, [dynamicPalettes]);

    const syncUrl = useCallback((id) => {
        if (typeof window === 'undefined' || !deepLinkParam) return;
        const url = new URL(window.location.href);
        if (id) url.searchParams.set(deepLinkParam, id);
        else url.searchParams.delete(deepLinkParam);
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }, [deepLinkParam]);

    const scrollToTop = useCallback(() => {
        if (typeof window === 'undefined') return;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // Secondary safeguard in case layout reflow takes a frame
        window.requestAnimationFrame(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }, []);

    const handleSelectColorFilter = useCallback((rawColor, customName = null) => {
        if (!rawColor) {
            setSelectedSwatch(null);
            return;
        }
        try {
            const [r, g, b] = parseColorToRgb(rawColor);
            const hex = rgbToHex(r, g, b);
            const lab = rgbToLab(r, g, b);
            const hsl = rgbToHsl(r, g, b);
            const matchedPreset = DISCOVERY_PALETTES.find(
                (p) => p.hex.toLowerCase() === hex.toLowerCase(),
            );
            const name = customName || matchedPreset?.name || getClosestNamedColor(r, g, b);
            setSelectedSwatch({ hex, name, lab, hsl });
            setActiveId(null);
            syncUrl(null);
            scrollToTop();
        } catch (e) {
            console.warn('Failed to parse color swatch:', rawColor, e);
        }
    }, [scrollToTop, syncUrl]);

    const clearColorFilter = useCallback(() => {
        setSelectedSwatch(null);
    }, []);

    // Ensure whenever selectedSwatch is activated, user is brought to the top of the gallery
    useEffect(() => {
        if (selectedSwatch) {
            scrollToTop();
        }
    }, [selectedSwatch, scrollToTop]);

    // Filter STRICTLY by the overall mood / dominant ambient atmosphere of the image
    const filteredPhotos = useMemo(() => {
        if (!selectedSwatch) return photos;

        return photos.filter((item) => {
            const palette = getPhotoPalette(item);
            if (!palette) return false;

            // Only match the overall dominant/major background tone
            const domLab = palette.dominantLab || palette.paletteLab?.[0];
            if (!domLab) return false;

            return deltaE(selectedSwatch.lab, domLab) <= MOOD_DELTA_E_TOLERANCE;
        });
    }, [photos, selectedSwatch, getPhotoPalette]);

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
                    if (analysis && Array.isArray(analysis.palette)) {
                        setDynamicPalettes((prev) => ({
                            ...prev,
                            [item.id]: {
                                paletteHex: analysis.palette,
                                paletteLab: analysis.palette.map(hexToLab),
                                paletteHsl: analysis.palette.map(hexToHsl),
                                dominantHex: analysis.palette[0] || analysis.bg || '#333333',
                                dominantLab: hexToLab(analysis.palette[0] || '#333333'),
                                dominantHsl: hexToHsl(analysis.palette[0] || '#333333'),
                                isDark: Boolean(analysis.isDark),
                            },
                        }));
                    }
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
        <div className="boudoir-moodboard-wrapper">
            {/* --- MINIMAL POP EDITORIAL DISCOVERY BAR --- */}
            <div className="pop-discovery-bar">
                <span className="pop-strip-label">EXPLORE BY MOOD:</span>
                <div className="pop-strip-swatches">
                    {DISCOVERY_PALETTES.map((preset) => (
                        <button
                            key={preset.hex}
                            type="button"
                            className={`pop-strip-dot ${selectedSwatch?.hex?.toLowerCase() === preset.hex.toLowerCase() ? 'is-active' : ''}`}
                            style={{ backgroundColor: preset.hex }}
                            onClick={() => {
                                if (selectedSwatch?.hex?.toLowerCase() === preset.hex.toLowerCase()) {
                                    clearColorFilter();
                                } else {
                                    handleSelectColorFilter(preset.hex, preset.name);
                                }
                            }}
                            title={`Filter mood: ${preset.name} (${preset.hex})`}
                        >
                            <span className="sr-only">{preset.name}</span>
                        </button>
                    ))}
                    {selectedSwatch && (
                        <button
                            type="button"
                            className="pop-strip-clear"
                            onClick={clearColorFilter}
                        >
                            ✕ Reset
                        </button>
                    )}
                </div>
            </div>

            {/* --- MASONRY GRID --- */}
            <div className="boudoir-static-grid">
                {/* 1. FIRST ITEM: COLOR SWATCH HERO CARD (WHEN ACTIVE) */}
                {selectedSwatch && (
                    <figure className="boudoir-static-card pop-swatch-hero-card">
                        <div
                            className="swatch-hero-canvas"
                            style={{ backgroundColor: selectedSwatch.hex }}
                        >
                            <div className="swatch-hero-footer">
                                <div className="swatch-hero-meta">
                                    <span className="swatch-hero-name">
                                        {selectedSwatch.name || 'Color Mood'}
                                    </span>
                                    <span className="swatch-hero-hex">
                                        {selectedSwatch.hex.toLowerCase()}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    className="swatch-hero-dismiss"
                                    onClick={clearColorFilter}
                                    title="Clear filter"
                                    aria-label="Clear filter"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    </figure>
                )}

                {/* 2. MATCHING PHOTOS (NO TINY PILLS) */}
                {filteredPhotos.map((item, index) => (
                    <figure className="boudoir-static-card" key={item.id}>
                        <div className="card-image-wrap">
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
                                TouchStart={() => queuePalette(item, true)}
                                aria-label={`Open ${item.title}`}
                            >
                                <img
                                    src={item.thumbnailUrl}
                                    alt={item.title}
                                    loading={index < 12 ? 'eager' : 'lazy'}
                                    fetchpriority={index < 6 ? 'high' : 'low'}
                                    decoding="async"
                                />
                            </button>
                        </div>
                    </figure>
                ))}
            </div>

            {filteredPhotos.length === 0 && (
                <div className="boudoir-empty-state">
                    <span className="pop-empty-box" style={{ backgroundColor: selectedSwatch?.hex || '#999' }}></span>
                    <p className="pop-empty-title">No photos found with this overall atmosphere.</p>
                    <button type="button" className="pop-empty-btn" onClick={clearColorFilter}>
                        Show All Photos
                    </button>
                </div>
            )}

            {activeId && (
                <MoodboardPolaroidViewer
                    items={filteredPhotos.length ? filteredPhotos : photos}
                    activeId={activeId}
                    onClose={closePhoto}
                    onChange={changePhoto}
                    onSelectColorFilter={(color, name) => handleSelectColorFilter(color, name)}
                    sharedAssetCacheRef={assetCacheRef}
                    preloadRadius={2}
                    showTitles={showTitles}
                />
            )}

            <style>{`
                .boudoir-moodboard-wrapper {
                    width: 100%;
                }

                /* --- CLEAN POP EDITORIAL DISCOVERY STRIP --- */
                .pop-discovery-bar {
                    margin-bottom: 2rem;
                    position: sticky;
                    top: 72px;
                    z-index: 50;
                    background: #fff8e8;
                    border: 2px solid #15130f;
                    border-radius: 12px;
                    padding: 0.65rem 1rem;
                    box-shadow: 3px 3px 0px #15130f;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    flex-wrap: wrap;
                    gap: 0.75rem;
                }

                .pop-strip-label {
                    font-family: var(--font-mono, "Space Mono", monospace);
                    font-size: 0.78rem;
                    font-weight: 700;
                    letter-spacing: 0.06em;
                    color: #15130f;
                }

                .pop-strip-swatches {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                }

                .pop-strip-dot {
                    width: 22px;
                    height: 22px;
                    border-radius: 4px;
                    border: 1.5px solid #15130f;
                    cursor: pointer;
                    padding: 0;
                    outline: none;
                    transition: transform 0.15s ease, box-shadow 0.15s ease;
                }

                .pop-strip-dot:hover {
                    transform: scale(1.2) translateY(-1px);
                    box-shadow: 2px 2px 0px #15130f;
                    z-index: 2;
                }

                .pop-strip-dot.is-active {
                    transform: scale(1.25);
                    box-shadow: 2px 2px 0px #15130f;
                    outline: 2px solid #15130f;
                    outline-offset: 1px;
                }

                .pop-strip-clear {
                    border: 1.5px solid #15130f;
                    background: #ffffff;
                    color: #15130f;
                    font-family: var(--font-mono, "Space Mono", monospace);
                    font-size: 0.72rem;
                    font-weight: 700;
                    padding: 0.25rem 0.6rem;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-left: 0.25rem;
                    box-shadow: 1.5px 1.5px 0px #15130f;
                    transition: all 0.1s ease;
                }

                .pop-strip-clear:hover {
                    background: #15130f;
                    color: #fff8e8;
                }

                /* --- MASONRY GRID & CARDS --- */
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
                    border: 1.5px solid #15130f;
                    background: #eadfce;
                    position: relative;
                }

                /* 1. COLOR SWATCH HERO CARD (POSITION 0 IN GRID) */
                .pop-swatch-hero-card {
                    background: #15130f;
                }

                .swatch-hero-canvas {
                    width: 100%;
                    min-height: 320px;
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-end;
                    padding: 12px;
                    box-sizing: border-box;
                }

                .swatch-hero-footer {
                    background: #ffffff;
                    border: 1.5px solid #15130f;
                    border-radius: 8px;
                    padding: 0.65rem 0.85rem;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    box-shadow: 2.5px 2.5px 0px #15130f;
                }

                .swatch-hero-meta {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .swatch-hero-name {
                    font-family: var(--font-ui, "Satoshi", sans-serif);
                    font-size: 0.95rem;
                    font-weight: 700;
                    color: #15130f;
                    line-height: 1.2;
                }

                .swatch-hero-hex {
                    font-family: var(--font-mono, "Space Mono", monospace);
                    font-size: 0.78rem;
                    font-weight: 600;
                    color: #555555;
                    letter-spacing: 0.02em;
                }

                .swatch-hero-dismiss {
                    width: 26px;
                    height: 26px;
                    border-radius: 4px;
                    border: 1.5px solid #15130f;
                    background: #fff8e8;
                    color: #15130f;
                    font-family: var(--font-mono, "Space Mono", monospace);
                    font-size: 0.8rem;
                    font-weight: 700;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0;
                    transition: all 0.1s ease;
                }

                .swatch-hero-dismiss:hover {
                    background: #15130f;
                    color: #fff8e8;
                }

                /* Photo Cards */
                .card-image-wrap {
                    position: relative;
                    width: 100%;
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

                /* --- EMPTY STATE --- */
                .boudoir-empty-state {
                    padding: 3.5rem 2rem;
                    text-align: center;
                    background: #fff8e8;
                    border: 2px solid #15130f;
                    border-radius: 12px;
                    box-shadow: 3px 3px 0px #15130f;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 1rem;
                    margin: 2rem 0;
                }

                .pop-empty-box {
                    width: 32px;
                    height: 32px;
                    border-radius: 4px;
                    border: 2px solid #15130f;
                    display: block;
                }

                .pop-empty-title {
                    font-family: var(--font-ui, "Satoshi", sans-serif);
                    font-size: 0.95rem;
                    color: #15130f;
                    margin: 0;
                }

                .pop-empty-btn {
                    border: 2px solid #15130f;
                    background: #15130f;
                    color: #fff8e8;
                    font-family: var(--font-mono, "Space Mono", monospace);
                    font-size: 0.8rem;
                    font-weight: 700;
                    padding: 0.45rem 1rem;
                    border-radius: 6px;
                    cursor: pointer;
                    box-shadow: 2px 2px 0px rgba(0, 0, 0, 0.2);
                    transition: transform 0.1s ease;
                }

                .pop-empty-btn:hover {
                    transform: translate(-1px, -1px);
                }

                @media (max-width: 1100px) {
                    .boudoir-static-grid { columns: 3; }
                }
                @media (max-width: 760px) {
                    .boudoir-static-grid { columns: 2; }
                    .pop-discovery-bar { top: 60px; }
                }
                @media (max-width: 480px) {
                    .boudoir-static-grid { columns: 1; }
                }
            `}</style>
        </div>
    );
}
