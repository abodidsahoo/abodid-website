import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// --- EXPERT PHOTOGRAPHIC PALETTE ENGINE ---

const rgbToLab = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
    r *= 100; g *= 100; b *= 100;

    const x = r * 0.4124 + g * 0.3576 + b * 0.1805;
    const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
    const z = r * 0.0193 + g * 0.1192 + b * 0.9505;

    let lX = x / 95.047;
    let lY = y / 100.000;
    let lZ = z / 108.883;

    lX = lX > 0.008856 ? Math.pow(lX, 1 / 3) : (7.787 * lX) + 16 / 116;
    lY = lY > 0.008856 ? Math.pow(lY, 1 / 3) : (7.787 * lY) + 16 / 116;
    lZ = lZ > 0.008856 ? Math.pow(lZ, 1 / 3) : (7.787 * lZ) + 16 / 116;

    return [(116 * lY) - 16, 500 * (lX - lY), 200 * (lY - lZ)];
};

const labToRgb = (l, a, b) => {
    let y = (l + 16) / 116;
    let x = a / 500 + y;
    let z = y - b / 200;

    x = Math.pow(x, 3) > 0.008856 ? Math.pow(x, 3) : (x - 16 / 116) / 7.787;
    y = Math.pow(y, 3) > 0.008856 ? Math.pow(y, 3) : (y - 16 / 116) / 7.787;
    z = Math.pow(z, 3) > 0.008856 ? Math.pow(z, 3) : (z - 16 / 116) / 7.787;

    x *= 95.047; y *= 100.000; z *= 108.883;

    let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
    let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
    let bVal = x * 0.0557 + y * -0.2040 + z * 1.0570;

    r /= 100; g /= 100; bVal /= 100;
    r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
    g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
    bVal = bVal > 0.0031308 ? 1.055 * Math.pow(bVal, 1 / 2.4) - 0.055 : 12.92 * bVal;

    return [
        Math.max(0, Math.min(255, Math.round(r * 255))),
        Math.max(0, Math.min(255, Math.round(g * 255))),
        Math.max(0, Math.min(255, Math.round(bVal * 255)))
    ];
};

const deltaE = (lab1, lab2) => {
    const dL = lab1[0] - lab2[0];
    const da = lab1[1] - lab2[1];
    const db = lab1[2] - lab2[2];
    return Math.sqrt(dL * dL + da * da + db * db);
};

// --- SMART SEEDING K-MEANS ---
const kMeansClustering = (pixels, k, iterations = 6) => {
    let centroids = [];

    // 1. Rig the Election: Find Top Priority Pixels
    const pixelsWithScore = pixels.map(p => {
        const chroma = Math.sqrt(p[1] * p[1] + p[2] * p[2]);
        let angle = Math.atan2(p[2], p[1]) * (180 / Math.PI);
        if (angle < 0) angle += 360;

        // "Golden Sector" for skin/earth tones: Approx 10 to 90 degrees (Red to Yellow)
        let humanBonus = 1.0;
        if (angle > 10 && angle < 95) {
            humanBonus = 1.25;
        }

        return {
            lab: p,
            score: chroma * humanBonus
        };
    });

    // Sort by weighted score descending
    pixelsWithScore.sort((a, b) => b.score - a.score);

    // Pick Top 3 distinct high-scoring seeds
    const seeds = [];
    for (let p of pixelsWithScore) {
        if (seeds.length >= 3) break;
        if (seeds.every(s => deltaE(s.lab, p.lab) > 10)) {
            seeds.push(p);
        }
    }

    // Add seeds to centroids
    seeds.forEach(s => centroids.push([...s.lab]));

    // Fill remaining K
    const needed = k - centroids.length;
    const step = Math.floor(pixels.length / needed);
    for (let i = 0; i < needed; i++) {
        const idx = Math.floor(i * step);
        if (idx < pixels.length) {
            centroids.push([...pixels[idx]]);
        }
    }

    let labels = new Array(pixels.length);

    for (let iter = 0; iter < iterations; iter++) {
        for (let i = 0; i < pixels.length; i++) {
            let minDist = Infinity;
            let label = 0;
            for (let j = 0; j < k; j++) {
                const dist = deltaE(pixels[i], centroids[j]);
                if (dist < minDist) { minDist = dist; label = j; }
            }
            labels[i] = label;
        }

        const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);
        for (let i = 0; i < pixels.length; i++) {
            const l = labels[i];
            sums[l][0] += pixels[i][0];
            sums[l][1] += pixels[i][1];
            sums[l][2] += pixels[i][2];
            sums[l][3]++;
        }

        for (let j = 0; j < k; j++) {
            if (sums[j][3] > 0) {
                centroids[j] = [sums[j][0] / sums[j][3], sums[j][1] / sums[j][3], sums[j][2] / sums[j][3], sums[j][3]];
            }
        }
    }
    return centroids.map(c => ({ lab: [c[0], c[1], c[2]], count: c[3] }));
};



// --- REFACTORED: Exportable Analysis Logic ---
export const analyzeImage = (imageUrl) => {
    return new Promise((resolve, reject) => {
        if (!imageUrl) {
            return reject(new Error("No image URL provided"));
        }

        const isRemote =
            typeof imageUrl === 'string' &&
            (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) &&
            !imageUrl.includes('/api/image-palette-proxy') &&
            typeof window !== 'undefined' &&
            !imageUrl.startsWith(window.location.origin);

        const targetUrl = isRemote
            ? `/api/image-palette-proxy?url=${encodeURIComponent(imageUrl)}`
            : imageUrl;

        const attemptLoad = (srcUrl, isFallback = false) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.src = srcUrl;

            img.onload = () => {
                try {
                    // Return dimensions immediately for layout pre-calc
                    const dims = { width: img.naturalWidth, height: img.naturalHeight };

                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    const size = 120; // Low res for speed
                    canvas.width = size; canvas.height = size;
                    ctx.drawImage(img, 0, 0, size, size);

                    const data = ctx.getImageData(0, 0, size, size).data;
                    const labPixels = [];
                    for (let i = 0; i < data.length; i += 16) {
                        labPixels.push(rgbToLab(data[i], data[i + 1], data[i + 2]));
                    }

                    if (labPixels.length === 0) throw new Error("No image data");

                    // SEEDING
                    let clusters = kMeansClustering(labPixels, 12);

                    // MERGING
                    for (let i = 0; i < clusters.length; i++) {
                        for (let j = i + 1; j < clusters.length; j++) {
                            if (deltaE(clusters[i].lab, clusters[j].lab) < 12) {
                                clusters[i].count += clusters[j].count;
                                clusters.splice(j, 1);
                                j--;
                            }
                        }
                    }

                    const enrich = clusters.map(c => {
                        const chroma = Math.sqrt(c.lab[1] ** 2 + c.lab[2] ** 2);
                        const percentage = c.count / labPixels.length;
                        return { lab: c.lab, count: percentage, chroma };
                    });

                    if (enrich.length === 0) throw new Error("Clustering failed");

                    // 4 PILLARS
                    const background = enrich.reduce((a, b) => (a.count > b.count ? a : b));
                    const candidate2 = enrich.filter(c => c !== background && deltaE(c.lab, background.lab) > 15);
                    const secondary = candidate2.length > 0 ? candidate2.reduce((a, b) => (a.count > b.count ? a : b)) : background;
                    const candidate3 = enrich.filter(c => c !== background && c !== secondary && c.count < 0.2);
                    const accent = candidate3.length > 0 ? candidate3.reduce((a, b) => (a.chroma > b.chroma ? a : b)) : enrich.reduce((a, b) => (a.chroma > b.chroma ? a : b));
                    const candidate4 = enrich.filter(c => c !== background && c !== secondary && c !== accent);
                    const textural = candidate4.length > 0 ? candidate4.reduce((a, b) => (a.count > b.count ? a : b)) : secondary;

                    // SMART BG
                    let finalAccent = accent;
                    const candidates = [background, secondary, finalAccent, textural];
                    let smartBg = candidates.reduce((prev, current) => {
                        if (!current || !current.lab) return prev;
                        if (!prev || !prev.lab) return current;

                        const getScore = (c) => {
                            let angle = Math.atan2(c.lab[2], c.lab[1]) * (180 / Math.PI);
                            if (angle < 0) angle += 360;
                            let bonus = 1.0;
                            if (angle > 10 && angle < 95) bonus = 1.25;
                            return c.chroma * bonus;
                        };
                        return (getScore(current) > getScore(prev)) ? current : prev;
                    }, background);

                    if (smartBg.chroma < 10) smartBg = background;

                    const bgRgb = labToRgb(...(smartBg.lab || [20, 20, 20]));
                    const smartBgString = `rgb(${bgRgb[0]},${bgRgb[1]},${bgRgb[2]})`;

                    const safeMap = (item) => {
                        if (!item || !item.lab) return 'rgb(128,128,128)';
                        const rgb = labToRgb(...item.lab);
                        return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
                    };

                    const palette = [
                        safeMap(background),
                        safeMap(secondary),
                        safeMap(textural),
                        safeMap(finalAccent)
                    ];

                    resolve({ dimensions: dims, palette, bg: smartBgString });

                } catch (err) {
                    if (!isFallback && isRemote && srcUrl !== targetUrl) {
                        attemptLoad(targetUrl, true);
                    } else {
                        reject(err);
                    }
                }
            };

            img.onerror = (e) => {
                if (!isFallback && isRemote && srcUrl !== targetUrl) {
                    attemptLoad(targetUrl, true);
                } else {
                    reject(e);
                }
            };
        };

        attemptLoad(targetUrl, false);
    });
};

const PaletteExtractor = ({ imageUrl, onExtract, inline = false, initialPalette = null }) => {
    const [composition, setComposition] = useState(initialPalette);
    const [compositionSource, setCompositionSource] = useState(
        initialPalette ? imageUrl : '',
    );

    useEffect(() => {
        if (!imageUrl) return;

        let cancelled = false;

        // If we already have initialPalette for this image, show immediately without delay or loading state
        if (initialPalette && initialPalette.length > 0) {
            setComposition(initialPalette);
            setCompositionSource(imageUrl);
            return;
        }

        // If changing to another image with no cached palette, clear stale palette
        if (compositionSource !== imageUrl) {
            setComposition(null);
            setCompositionSource('');
        }

        analyzeImage(imageUrl)
            .then((result) => {
                if (cancelled) return;
                setComposition(result.palette);
                setCompositionSource(imageUrl);
                if (result.bg && onExtract) onExtract(result.bg, result.palette);
            })
            .catch((err) => {
                if (cancelled) return;
                console.error('Palette analysis failed:', err);
                const fallbackPalette = ['#1a1a1a', '#4a4a4a', '#8a8a8a', '#d0d0d0'];
                setComposition(fallbackPalette);
                setCompositionSource(imageUrl);
                if (onExtract) onExtract('rgb(20,20,20)', fallbackPalette);
            });

        return () => {
            cancelled = true;
        };
    }, [imageUrl, initialPalette, onExtract, compositionSource]);

    if (!inline) return null;

    const paletteIsPrepared = Boolean(
        composition && compositionSource === imageUrl,
    );

    return (
        <div
            className="palette-extractor-slot"
            style={{
                position: 'relative',
                width: '204px',
                height: '48px',
                flexShrink: 0,
                display: 'flex',
                gap: '4px',
                alignItems: 'center',
            }}
        >
            {paletteIsPrepared ? (
                composition.map((color, i) => (
                    <div
                        key={i}
                        style={{
                            width: '48px',
                            height: '48px',
                            backgroundColor: color,
                            borderRadius: '1px',
                            boxShadow: 'inset 0 0 4px rgba(0,0,0,0.1)',
                        }}
                    />
                ))
            ) : (
                [0, 1, 2, 3].map((i) => (
                    <div
                        key={i}
                        style={{
                            width: '48px',
                            height: '48px',
                            backgroundColor: 'rgba(128, 128, 128, 0.12)',
                            borderRadius: '1px',
                        }}
                    />
                ))
            )}
        </div>
    );
};

export default PaletteExtractor;
