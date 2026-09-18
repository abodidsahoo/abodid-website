import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MoodboardPolaroidViewer from './MoodboardPolaroidViewer.jsx';
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

function colorDistance(lab1, lab2) {
    if (!lab1 || !lab2) return Infinity;
    const dL = lab1[0] - lab2[0];
    const da = lab1[1] - lab2[1];
    const db = lab1[2] - lab2[2];

    const c1 = Math.sqrt(lab1[1] * lab1[1] + lab1[2] * lab1[2]);
    const c2 = Math.sqrt(lab2[1] * lab2[1] + lab2[2] * lab2[2]);
    const dC = Math.abs(c1 - c2);

    // Hue difference in Lab space
    const dH2 = Math.max(0, da * da + db * db - dC * dC);
    const dH = Math.sqrt(dH2);

    // Perceptually calibrated weighting: Hue difference (1.5x), Lightness (0.8x), Chroma (1.0x)
    let dist = Math.sqrt(0.8 * (dL * dL) + 1.0 * (dC * dC) + 1.5 * (dH * dH));

    // Achromatic / Neutral Guard:
    // Near the origin (a~0, b~0), dH collapses to 0. We explicitly penalize chromatic pollution
    // when matching neutral/gray targets against saturated colors, and vice versa.
    if (c1 < 10 && c2 > 12) {
        dist += (c2 - 12) * 1.8;
    } else if (c1 > 18 && c2 < 10) {
        dist += (18 - c2) * 1.5;
    }

    return dist;
}

function deltaE(lab1, lab2) {
    return colorDistance(lab1, lab2);
}

// Curated Multi-Stop Gradient Spectrum for seamless Photoshop-style color exploration
const GRADIENT_STOPS = [
    { hex: '#881b24', pos: 0.00, name: 'Ruby Rouge' },
    { hex: '#b24a2b', pos: 0.08, name: 'Terracotta' },
    { hex: '#cb7436', pos: 0.16, name: 'Warm Copper' },
    { hex: '#d28a22', pos: 0.24, name: 'Ochre Amber' },
    { hex: '#deb038', pos: 0.32, name: 'Warm Gold' },
    { hex: '#727c44', pos: 0.40, name: 'Moss Olive' },
    { hex: '#3d7156', pos: 0.48, name: 'Emerald Sage' },
    { hex: '#2c5963', pos: 0.56, name: 'Aegean Teal' },
    { hex: '#22385e', pos: 0.64, name: 'Deep Cobalt' },
    { hex: '#4e2a42', pos: 0.72, name: 'Plum Noir' },
    { hex: '#b97a78', pos: 0.80, name: 'Dusty Rose' },
    { hex: '#d9cdb8', pos: 0.88, name: 'Sand Cream' },
    { hex: '#4a4b50', pos: 0.94, name: 'Slate Graphite' },
    { hex: '#262629', pos: 1.00, name: 'Charcoal Noir' },
];

function sampleGradientColor(t) {
    const clampedT = Math.max(0, Math.min(1, t));
    let i = 0;
    while (i < GRADIENT_STOPS.length - 1 && clampedT > GRADIENT_STOPS[i + 1].pos) {
        i++;
    }
    const s0 = GRADIENT_STOPS[i];
    const s1 = GRADIENT_STOPS[i + 1] || s0;
    if (s0 === s1 || s1.pos === s0.pos) {
        return { hex: s0.hex, name: s0.name, pos: clampedT };
    }
    const localT = (clampedT - s0.pos) / (s1.pos - s0.pos);
    const [r0, g0, b0] = parseColorToRgb(s0.hex);
    const [r1, g1, b1] = parseColorToRgb(s1.hex);
    const r = Math.round(r0 + (r1 - r0) * localT);
    const g = Math.round(g0 + (g1 - g0) * localT);
    const b = Math.round(b0 + (b1 - b0) * localT);
    const hex = rgbToHex(r, g, b);

    let name = localT > 0.5 ? s1.name : s0.name;
    const dynamicName = getClosestNamedColor(r, g, b);

    return { hex, name: dynamicName || name, pos: clampedT };
}

function findClosestGradientPos(targetLab) {
    if (!targetLab) return 0.5;
    let bestT = 0;
    let minDist = Infinity;
    for (let step = 0; step <= 100; step++) {
        const t = step / 100;
        const sampled = sampleGradientColor(t);
        const [r, g, b] = parseColorToRgb(sampled.hex);
        const lab = rgbToLab(r, g, b);
        const d = colorDistance(targetLab, lab);
        if (d < minDist) {
            minDist = d;
            bestT = t;
        }
    }
    return bestT;
}

// Progressive chromatic discovery palette (Retained for preset lookups)
const DISCOVERY_PALETTES = [
    { name: 'Ruby Rouge', hex: '#881b24', tier: 4 },
    { name: 'Crimson Rouge', hex: '#9e2a2b', tier: 2 },
    { name: 'Rust Red', hex: '#a83c27', tier: 4 },
    { name: 'Terracotta', hex: '#b24a2b', tier: 1 },
    { name: 'Burnt Sienna', hex: '#c46238', tier: 3 },
    { name: 'Warm Copper', hex: '#cb7436', tier: 4 },
    { name: 'Ochre Amber', hex: '#d28a22', tier: 1 },
    { name: 'Golden Honey', hex: '#dca029', tier: 4 },
    { name: 'Warm Gold', hex: '#deb038', tier: 3 },
    { name: 'Dijon Mustard', hex: '#c5a33c', tier: 4 },
    { name: 'Moss Olive', hex: '#727c44', tier: 4 },
    { name: 'Olive Forest', hex: '#586948', tier: 3 },
    { name: 'Deep Pine', hex: '#3b553e', tier: 4 },
    { name: 'Emerald Sage', hex: '#3d7156', tier: 1 },
    { name: 'Seafoam Slate', hex: '#417672', tier: 4 },
    { name: 'Aegean Teal', hex: '#2c5963', tier: 2 },
    { name: 'Steel Ocean', hex: '#28697b', tier: 4 },
    { name: 'Cerulean Cyan', hex: '#2b7a99', tier: 3 },
    { name: 'Deep Cobalt', hex: '#22385e', tier: 1 },
    { name: 'Royal Navy', hex: '#1d2c4e', tier: 4 },
    { name: 'Midnight Indigo', hex: '#1c264d', tier: 3 },
    { name: 'Deep Plum', hex: '#3d2037', tier: 4 },
    { name: 'Plum Noir', hex: '#4e2a42', tier: 2 },
    { name: 'Velvet Mauve', hex: '#844c6c', tier: 3 },
    { name: 'Mulberry Wine', hex: '#974966', tier: 4 },
    { name: 'Dusty Rose', hex: '#b97a78', tier: 2 },
    { name: 'Blush Clay', hex: '#cda297', tier: 4 },
    { name: 'Sand Cream', hex: '#d9cdb8', tier: 1 },
    { name: 'Warm Taupe', hex: '#8d8070', tier: 4 },
    { name: 'Slate Graphite', hex: '#4a4b50', tier: 4 },
    { name: 'Charcoal Noir', hex: '#262629', tier: 2 },
];

// Balanced middle-ground similarity cutoff (strict enough to prevent cross-hue bleed, wide enough for rich galleries)
const MOOD_SIMILARITY_CUTOFF = 21;

function getPhotoMatchDistance(targetLab, palette) {
    if (!palette) return Infinity;
    const domLab = palette.dominantLab || palette.paletteLab?.[0];
    if (!domLab) return Infinity;

    const targetC = Math.sqrt(targetLab[1] * targetLab[1] + targetLab[2] * targetLab[2]);
    const domC = Math.sqrt(domLab[1] * domLab[1] + domLab[2] * domLab[2]);

    // Direct dominant tone distance
    let domDist = colorDistance(targetLab, domLab);

    // Dominant atmosphere guard for neutral targets:
    // If user filtered by gray, photos with saturated dominant tones (e.g. red, yellow, blue) receive heavy penalty
    if (targetC < 10 && domC > 14) {
        domDist += (domC - 14) * 2.2;
    }

    let minDistance = domDist;

    // Secondary swatches are weighted with a 1.25x penalty so an unrelated atmosphere does not bleed into the results
    if (Array.isArray(palette.paletteLab)) {
        for (const pLab of palette.paletteLab) {
            const d = colorDistance(targetLab, pLab) * 1.25;
            if (d < minDistance) minDistance = d;
        }
    }

    // Blend ratio: For neutral targets, dominant tone counts for 45% to prevent vivid images with a single gray shadow from sneaking in
    const domWeight = targetC < 10 ? 0.45 : 0.30;
    const swatchWeight = 1 - domWeight;

    return (minDistance * swatchWeight + domDist * domWeight);
}

function getContrastTextColor(hex) {
    if (!hex) return '#ffffff';
    const [r, g, b] = parseColorToRgb(hex);
    const toLinear = (c) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    const lum = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    // Relative luminance threshold: bright / pale backgrounds get matte black (#15130f), dark gets crisp white (#ffffff)
    return lum > 0.36 ? '#15130f' : '#ffffff';
}

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
    const [scrubbingColor, setScrubbingColor] = useState(null); // live preview during drag
    const [loadedImages, setLoadedImages] = useState(() => new Set());
    const [thumbPos, setThumbPos] = useState(null); // float 0..1
    const [hoverInfo, setHoverInfo] = useState(null); // { pos, hex, name }
    const [isDragging, setIsDragging] = useState(false);
    const [bounceKey, setBounceKey] = useState(0);
    const [isBouncing, setIsBouncing] = useState(false);
    const [bounceDirection, setBounceDirection] = useState('right');
    
    const assetCacheRef = useRef({});
    const gradientRef = useRef(null);
    const trackRectRef = useRef(null);
    const isPointerDownRef = useRef(false);
    const startXRef = useRef(0);
    const isDraggingRef = useRef(false);
    const interactionSourceRef = useRef('none');
    const bounceTimerRef = useRef(null);
    const lastPosRef = useRef(0.5);
    const pendingColorRef = useRef(null);

    const triggerElasticBounce = useCallback((dir = null) => {
        if (dir) setBounceDirection(dir);
        setBounceKey((k) => k + 1);
        setIsBouncing(true);
        if (bounceTimerRef.current) clearTimeout(bounceTimerRef.current);
        bounceTimerRef.current = setTimeout(() => {
            setIsBouncing(false);
        }, 300);
    }, []);

    const getPhotoPalette = useCallback((item) => {
        return item?.palette || null;
    }, []);

    const markImageLoaded = useCallback((id) => {
        setLoadedImages((prev) => {
            if (prev.has(id)) return prev;
            const next = new Set(prev);
            next.add(id);
            return next;
        });
    }, []);

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
        window.requestAnimationFrame(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }, []);

    const handleSelectColorFilter = useCallback((rawColor, customName = null, skipScroll = false) => {
        if (!rawColor) {
            setSelectedSwatch(null);
            setScrubbingColor(null);
            setThumbPos(null);
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
            setScrubbingColor(null);
            setActiveId(null);
            syncUrl(null);
            if (!skipScroll) {
                scrollToTop();
            }
        } catch (e) {
            console.warn('Failed to parse color swatch:', rawColor, e);
        }
    }, [scrollToTop, syncUrl]);

    const clearColorFilter = useCallback(() => {
        setSelectedSwatch(null);
        setScrubbingColor(null);
        setThumbPos(null);
        interactionSourceRef.current = 'none';
    }, []);

    // Sync thumb position only when selectedSwatch is changed externally (e.g. Polaroid card swatch click)
    useEffect(() => {
        if (selectedSwatch) {
            if (interactionSourceRef.current !== 'gradient') {
                const pos = findClosestGradientPos(selectedSwatch.lab);
                const dir = pos >= (lastPosRef.current ?? 0.5) ? 'right' : 'left';
                lastPosRef.current = pos;
                setThumbPos(pos);
                triggerElasticBounce(dir);
            }
        } else {
            setThumbPos(null);
        }
    }, [selectedSwatch, triggerElasticBounce]);

    // Gradient interactive pointer handlers (Freeform continuous & smooth)
    const handlePointerDown = (e) => {
        if (!gradientRef.current) return;
        const rect = gradientRef.current.getBoundingClientRect();
        trackRectRef.current = rect;
        const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const sampled = sampleGradientColor(t);
        const dir = t >= (lastPosRef.current ?? 0.5) ? 'right' : 'left';
        
        isPointerDownRef.current = true;
        startXRef.current = e.clientX;
        isDraggingRef.current = false;
        setIsDragging(false);
        setHoverInfo(null);
        
        lastPosRef.current = t;
        pendingColorRef.current = sampled;
        interactionSourceRef.current = 'gradient';
        
        setThumbPos(t);
        setBounceDirection(dir);
        
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch (err) {}
    };

    const handlePointerMove = (e) => {
        if (!gradientRef.current) return;
        const rect = trackRectRef.current || gradientRef.current.getBoundingClientRect();
        const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const sampled = sampleGradientColor(t);

        if (isPointerDownRef.current) {
            const dist = Math.abs(e.clientX - startXRef.current);
            if (dist > 3 && !isDraggingRef.current) {
                isDraggingRef.current = true;
                setIsDragging(true);
            }

            const delta = t - (lastPosRef.current ?? t);
            if (Math.abs(delta) > 0.002) {
                setBounceDirection(delta >= 0 ? 'right' : 'left');
            }
            lastPosRef.current = t;
            pendingColorRef.current = sampled;
            interactionSourceRef.current = 'gradient';
            setThumbPos(t);
        } else {
            setHoverInfo({ pos: t, hex: sampled.hex, name: sampled.name });
        }
    };

    const handlePointerUp = (e) => {
        if (isPointerDownRef.current) {
            const wasDragging = isDraggingRef.current;
            isPointerDownRef.current = false;
            isDraggingRef.current = false;
            setIsDragging(false);
            trackRectRef.current = null;
            try {
                e.currentTarget.releasePointerCapture(e.pointerId);
            } catch (err) {}
            
            if (pendingColorRef.current) {
                handleSelectColorFilter(pendingColorRef.current.hex, pendingColorRef.current.name, true);
            }
            if (wasDragging) {
                triggerElasticBounce();
            }
        }
    };

    const handlePointerLeave = () => {
        if (!isPointerDownRef.current) {
            setHoverInfo(null);
        }
    };

    const handleKeyDown = (e) => {
        let nextPos = thumbPos !== null ? thumbPos : 0.5;
        let dir = 'right';
        if (e.key === 'ArrowLeft') {
            nextPos = Math.max(0, nextPos - 0.02);
            dir = 'left';
        } else if (e.key === 'ArrowRight') {
            nextPos = Math.min(1, nextPos + 0.02);
            dir = 'right';
        } else if (e.key === 'Home') {
            nextPos = 0;
            dir = 'left';
        } else if (e.key === 'End') {
            nextPos = 1;
            dir = 'right';
        } else {
            return;
        }

        e.preventDefault();
        lastPosRef.current = nextPos;
        interactionSourceRef.current = 'gradient';
        const sampled = sampleGradientColor(nextPos);
        setThumbPos(nextPos);
        triggerElasticBounce(dir);
        handleSelectColorFilter(sampled.hex, sampled.name, false);
    };

    // Filter by expanded similarity and sort sequentially: closest match at the top
    const filteredPhotos = useMemo(() => {
        if (!selectedSwatch) return photos;

        const targetLab = selectedSwatch.lab;
        const matches = [];

        for (const item of photos) {
            const palette = getPhotoPalette(item);
            const dist = getPhotoMatchDistance(targetLab, palette);
            if (dist <= MOOD_SIMILARITY_CUTOFF) {
                matches.push({ item, dist });
            }
        }

        // Sequential sorting: closest match at top, softer matches towards the bottom
        matches.sort((a, b) => a.dist - b.dist);
        return matches.map((m) => m.item);
    }, [photos, selectedSwatch, getPhotoPalette]);

    const preloadViewerImage = useCallback((item) => {
        if (typeof window === 'undefined' || !item?.imageUrl) return;
        const image = new window.Image();
        image.decoding = 'async';
        image.src = item.imageUrl;
    }, []);

    const openPhoto = useCallback((item) => {
        preloadViewerImage(item);
        setActiveId(item.id);
        syncUrl(item.id);
    }, [preloadViewerImage, syncUrl]);

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
            setActiveId(requested);
        }
    }, [deepLinkParam, photos]);

    const displayColor = scrubbingColor || selectedSwatch;

    return (
        <div className="boudoir-moodboard-wrapper">
            {/* --- SEAMLESS EDITORIAL GRADIENT DISCOVERY BAR --- */}
            <div className="pop-discovery-bar">
                <div className="pop-strip-left">
                    <span className="pop-strip-label">EXPLORE BY COLOR:</span>
                </div>

                <div className="pop-gradient-container">
                    <div
                        ref={gradientRef}
                        className="pop-gradient-track"
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        onPointerLeave={handlePointerLeave}
                        role="slider"
                        aria-label="Color Palette Gradient Slider"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={thumbPos !== null ? Math.round(thumbPos * 100) : 0}
                        tabIndex={0}
                        onKeyDown={handleKeyDown}
                    >
                        {(() => {
                            const activeThumbPos = thumbPos !== null ? thumbPos : (lastPosRef.current ?? 0.5);
                            const activeColor = sampleGradientColor(activeThumbPos);
                            const thumbBg = activeColor.hex;
                            return (
                                <div
                                    className={`pop-gradient-thumb ${isDragging ? 'is-dragging' : ''} ${isBouncing ? 'is-landing' : ''} ${selectedSwatch ? 'is-active' : 'is-idle'}`}
                                    style={{
                                        left: `${activeThumbPos * 100}%`,
                                        backgroundColor: thumbBg,
                                    }}
                                />
                            );
                        })()}
                        {!isDragging && hoverInfo && (
                            <div
                                className="pop-gradient-hover-badge"
                                style={{
                                    left: `${hoverInfo.pos * 100}%`,
                                }}
                            >
                                <span className="pop-hover-dot" style={{ backgroundColor: hoverInfo.hex }} />
                                <span className="pop-hover-name">{hoverInfo.name}</span>
                            </div>
                        )}
                    </div>

                    {selectedSwatch && (
                        <button
                            type="button"
                            className="pop-strip-clear"
                            onClick={clearColorFilter}
                            title="Reset color filter"
                            aria-label="Reset color filter"
                        >
                            ✕ Reset
                        </button>
                    )}
                </div>
            </div>

            {/* --- MASONRY GRID --- */}
            <div className="boudoir-static-grid">
                {/* 1. FIRST ITEM: COLOR SWATCH HERO CARD (WHEN ACTIVE) */}
                {selectedSwatch && (() => {
                    const textColor = getContrastTextColor(selectedSwatch.hex);
                    const words = (selectedSwatch.name || 'Color Mood').trim().split(/\s+/);
                    const maxWordLen = Math.max(...words.map((w) => w.length));
                    
                    let fontSizeClamp = 'clamp(1.6rem, 3.8vw, 3.2rem)';
                    if (words.length >= 2 || maxWordLen > 8) {
                        fontSizeClamp = maxWordLen > 10 ? 'clamp(1.2rem, 2.5vw, 2.2rem)' : 'clamp(1.4rem, 3.0vw, 2.6rem)';
                    }

                    return (
                        <figure
                            className="boudoir-static-card pop-swatch-hero-card"
                            style={{ backgroundColor: selectedSwatch.hex }}
                        >
                            <div className="swatch-hero-canvas">
                                <button
                                    type="button"
                                    className="swatch-hero-dismiss-btn"
                                    onClick={clearColorFilter}
                                    title="Clear color filter"
                                    aria-label="Clear color filter"
                                    style={{ color: textColor }}
                                >
                                    ✕
                                </button>

                                <div
                                    className="swatch-hero-title"
                                    style={{
                                        color: textColor,
                                        fontSize: fontSizeClamp,
                                    }}
                                >
                                    {words.map((word, idx) => (
                                        <span key={idx} className="swatch-hero-word">
                                            {word}
                                        </span>
                                    ))}
                                </div>

                                <span
                                    className="swatch-hero-hex-tag"
                                    style={{ color: textColor }}
                                >
                                    {selectedSwatch.hex.toLowerCase()}
                                </span>
                            </div>
                        </figure>
                    );
                })()}

                {/* 2. MATCHING PHOTOS WITH PRE-RESERVED ASPECT RATIO & SMOOTH FADE */}
                {filteredPhotos.map((item, index) => {
                    const palette = getPhotoPalette(item);
                    const dominantBg = palette?.dominantHex || '#eadfce';
                    const aspectRatio = item.aspectRatio || (item.imageWidth && item.imageHeight ? (item.imageWidth / item.imageHeight) : undefined);
                    const isLoaded = loadedImages.has(item.id);

                    return (
                        <figure
                            className="boudoir-static-card"
                            key={item.id}
                            style={{
                                backgroundColor: dominantBg,
                                ...(aspectRatio ? { aspectRatio: String(aspectRatio) } : {}),
                            }}
                        >
                            <div
                                className="card-image-wrap"
                                style={aspectRatio ? { aspectRatio: String(aspectRatio) } : undefined}
                            >
                                <button
                                    type="button"
                                    data-photo-id={item.id}
                                    className="boudoir-photo-button"
                                    onClick={() => openPhoto(item)}
                                    onPointerEnter={() => preloadViewerImage(item)}
                                    onFocus={() => preloadViewerImage(item)}
                                    aria-label={`Open ${item.title}`}
                                >
                                    <img
                                        src={item.thumbnailUrl}
                                        alt={item.title}
                                        loading={index < 8 ? 'eager' : 'lazy'}
                                        fetchPriority={index < 4 ? 'high' : 'low'}
                                        decoding="async"
                                        onLoad={() => markImageLoaded(item.id)}
                                        className={`boudoir-photo-img ${isLoaded ? 'is-loaded' : ''}`}
                                        style={aspectRatio ? { aspectRatio: String(aspectRatio) } : undefined}
                                    />
                                </button>
                            </div>
                        </figure>
                    );
                })}
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

                /* --- SEAMLESS POP EDITORIAL GRADIENT DISCOVERY STRIP --- */
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
                    gap: 1.15rem;
                }

                .pop-strip-left {
                    display: flex;
                    align-items: center;
                    flex-shrink: 0;
                }

                .pop-strip-label {
                    font-family: var(--font-mono, "Space Mono", monospace);
                    font-size: 0.76rem;
                    font-weight: 700;
                    letter-spacing: 0.06em;
                    color: #15130f;
                    white-space: nowrap;
                    flex-shrink: 0;
                }

                .pop-gradient-container {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    position: relative;
                    min-width: 0;
                }

                .pop-gradient-track {
                    flex: 1;
                    height: 24px;
                    border-radius: 6px;
                    border: 1.5px solid #15130f;
                    box-shadow: 1.5px 1.5px 0px #15130f;
                    background: linear-gradient(
                        to right,
                        #881b24 0%,
                        #b24a2b 8%,
                        #cb7436 16%,
                        #d28a22 24%,
                        #deb038 32%,
                        #727c44 40%,
                        #3d7156 48%,
                        #2c5963 56%,
                        #22385e 64%,
                        #4e2a42 72%,
                        #b97a78 80%,
                        #d9cdb8 88%,
                        #4a4b50 94%,
                        #262629 100%
                    );
                    position: relative;
                    cursor: crosshair;
                    user-select: none;
                    touch-action: none;
                    outline: none;
                    transition: box-shadow 0.15s ease;
                }

                .pop-gradient-track:hover,
                .pop-gradient-track:focus-visible {
                    box-shadow: 2px 2px 0px #15130f;
                }

                .pop-gradient-thumb {
                    position: absolute;
                    top: 50%;
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    border: 2.5px solid #ffffff;
                    box-shadow: 0 0 0 1.5px #15130f, 0 2px 6px rgba(0, 0, 0, 0.35);
                    transform: translate(-50%, -50%) scale(1);
                    pointer-events: none;
                    transition: left 0.38s cubic-bezier(0.18, 1.25, 0.4, 1), transform 0.12s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.12s ease-out, opacity 0.2s ease;
                    transform-origin: center center;
                    z-index: 5;
                }

                .pop-gradient-thumb.is-idle {
                    opacity: 0.6;
                }

                .pop-gradient-thumb.is-active {
                    opacity: 1;
                }

                .pop-gradient-thumb.is-dragging {
                    transition: transform 0.12s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.12s ease-out, left 0s !important;
                    transform: translate(-50%, -50%) scale(1.18);
                    box-shadow: 0 0 0 2px #15130f, 0 4px 12px rgba(0, 0, 0, 0.4);
                    opacity: 1;
                }

                .pop-gradient-hover-badge {
                    position: absolute;
                    bottom: calc(100% + 8px);
                    transform: translateX(-50%);
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 2px 7px;
                    background: #15130f;
                    color: #ffffff;
                    border-radius: 4px;
                    font-family: var(--font-mono, "Space Mono", monospace);
                    font-size: 0.62rem;
                    font-weight: 700;
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                    white-space: nowrap;
                    pointer-events: none;
                    z-index: 10;
                    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
                    animation: fadeInBadge 0.12s ease-out;
                }

                .pop-gradient-hover-badge::after {
                    content: '';
                    position: absolute;
                    top: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    border-width: 4px;
                    border-style: solid;
                    border-color: #15130f transparent transparent transparent;
                }

                .pop-hover-dot {
                    width: 7px;
                    height: 7px;
                    border-radius: 50%;
                    border: 1px solid #ffffff;
                    flex-shrink: 0;
                }

                .pop-strip-clear {
                    border: 1.5px solid #15130f;
                    background: #ffffff;
                    color: #15130f;
                    font-family: var(--font-mono, "Space Mono", monospace);
                    font-size: 0.72rem;
                    font-weight: 700;
                    padding: 0.25rem 0.6rem;
                    height: 24px;
                    border-radius: 4px;
                    cursor: pointer;
                    box-shadow: 1.5px 1.5px 0px #15130f;
                    transition: all 0.1s ease;
                    white-space: nowrap;
                    flex-shrink: 0;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }

                .pop-strip-clear:hover {
                    background: #15130f;
                    color: #fff8e8;
                }

                @media (max-width: 768px) {
                    .pop-discovery-bar {
                        position: sticky;
                        top: 64px;
                        flex-direction: column;
                        align-items: stretch;
                        gap: 0.55rem;
                        padding: 0.6rem 0.75rem;
                        border-radius: 10px;
                    }

                    .pop-strip-left {
                        width: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                    }

                    .pop-strip-label {
                        font-size: 0.70rem;
                    }

                    .pop-gradient-container {
                        width: 100%;
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                    }

                    .pop-strip-clear {
                        font-size: 0.68rem;
                        padding: 0.2rem 0.5rem;
                        height: 22px;
                    }
                }

                /* --- MASONRY GRID & CARDS --- */
                .boudoir-static-grid {
                    columns: 4;
                    column-gap: 25px;
                    orphans: 1;
                    widows: 1;
                    width: 100%;
                    box-sizing: border-box;
                }

                @media (max-width: 1200px) {
                    .boudoir-static-grid {
                        columns: 3;
                        column-gap: 20px;
                    }
                }

                @media (max-width: 768px) {
                    .boudoir-static-grid {
                        columns: 2;
                        column-gap: 14px;
                    }
                    .boudoir-static-card {
                        margin: 0 0 14px !important;
                        border-radius: 10px !important;
                    }
                }

                @media (max-width: 480px) {
                    .boudoir-static-grid {
                        columns: 1;
                        column-gap: 0;
                    }
                    .boudoir-static-card {
                        margin: 0 0 16px !important;
                    }
                }

                .boudoir-static-card {
                    break-inside: avoid;
                    -webkit-column-break-inside: avoid;
                    page-break-inside: avoid;
                    margin: 0 0 25px;
                    overflow: hidden;
                    border-radius: 14px;
                    border: 1.5px solid #15130f;
                    background: #eadfce;
                    position: relative;
                    width: 100%;
                    box-sizing: border-box;
                    display: inline-block;
                }

                /* 1. COLOR SWATCH HERO CARD (POSITION 0 IN GRID) */
                .pop-swatch-hero-card {
                    aspect-ratio: 4 / 5;
                    border: 1.5px solid #15130f;
                    position: relative;
                    width: 100%;
                    box-sizing: border-box;
                }

                .swatch-hero-canvas {
                    width: 100%;
                    height: 100%;
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    text-align: center;
                    padding: clamp(1.2rem, 3.5vw, 2.5rem);
                    box-sizing: border-box;
                    overflow: hidden;
                }

                .swatch-hero-title {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 0.12em;
                    font-family: var(--font-display, "Satoshi", sans-serif);
                    font-weight: 750;
                    line-height: 0.92;
                    letter-spacing: -0.04em;
                    text-transform: capitalize;
                    word-break: break-word;
                    user-select: none;
                    max-width: 100%;
                    box-sizing: border-box;
                }

                .swatch-hero-word {
                    display: block;
                    max-width: 100%;
                }

                .swatch-hero-hex-tag {
                    position: absolute;
                    bottom: clamp(0.75rem, 2vw, 1.25rem);
                    right: clamp(0.75rem, 2vw, 1.25rem);
                    font-family: var(--font-mono, "Space Mono", monospace);
                    font-size: clamp(0.62rem, 1.6vw, 0.72rem);
                    font-weight: 700;
                    letter-spacing: 0.08em;
                    text-transform: lowercase;
                    opacity: 0.85;
                }

                .swatch-hero-dismiss-btn {
                    position: absolute;
                    top: clamp(0.75rem, 2vw, 1.2rem);
                    right: clamp(0.75rem, 2vw, 1.2rem);
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    border: 1.5px solid currentColor;
                    background: transparent;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.72rem;
                    font-weight: 700;
                    opacity: 0.55;
                    transition: opacity 0.15s ease, transform 0.15s ease;
                    padding: 0;
                    z-index: 2;
                }

                .swatch-hero-dismiss-btn:hover {
                    opacity: 1;
                    transform: scale(1.1);
                }

                /* Photo Cards */
                .card-image-wrap {
                    position: relative;
                    width: 100%;
                    height: 100%;
                }

                .boudoir-photo-button {
                    width: 100%;
                    height: 100%;
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

                .boudoir-photo-img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                    vertical-align: bottom;
                    line-height: 0;
                    opacity: 0;
                    transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .boudoir-photo-img.is-loaded {
                    opacity: 1;
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
