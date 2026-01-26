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

// --- CURATED GLITCH ANIMATION ---
const CURATED_PALETTE = [
    // Foundation (Grays/Blacks/Whites)
    '#080808', '#1a1a1a', '#2d2d2d', '#f0f0f0', '#e5e5e5',
    // Earths (Browns/Beiges)
    '#8b4513', '#a0522d', '#cd853f', '#d2b48c', '#f5deb3', '#804000',
    // Reds (Vivid & Deep)
    '#8b0000', '#b22222', '#ff4500', '#dc143c',
    // Desaturated Blues/Greens
    '#2f4f4f', '#556b2f', '#4682b4', '#708090'
];

const getRandomColor = () => CURATED_PALETTE[Math.floor(Math.random() * CURATED_PALETTE.length)];

// Component for a single glitch tower - MOVED OUTSIDE FOR STABILITY
const GlitchTower = () => {
    const [blocks, setBlocks] = useState([]);

    useEffect(() => {
        // Initial Fill
        const generate = () => {
            const count = 4 + Math.floor(Math.random() * 4); // 4 to 8 blocks
            return Array.from({ length: count }, () => ({
                color: getRandomColor(),
                flex: Math.random() > 0.7 ? 2 : 1 // Random morphing (Rect vs Square)
            }));
        };

        setBlocks(generate());

        // Chaos Loop
        const interval = setInterval(() => {
            setBlocks(generate());
        }, 100); // 10fps glitch

        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            gap: '1px'
        }}>
            {blocks.map((b, i) => (
                <div key={i} style={{
                    backgroundColor: b.color,
                    flexGrow: b.flex,
                    width: '100%',
                    transition: 'background-color 0.1s, flex-grow 0.1s'
                }} />
            ))}
        </div>
    );
};

const PixelRain = () => {
    return (
        <div style={{
            display: 'flex',
            width: '204px', // Approx 4*48 + gaps
            height: '48px',
            gap: '1px',
            overflow: 'hidden',
        }}>
            <GlitchTower />
            <GlitchTower />
            <GlitchTower />
            <GlitchTower />
        </div>
    );
};


// --- REFACTORED: Exportable Analysis Logic ---
export const analyzeImage = (imageUrl) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = imageUrl;

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
                reject(err);
            }
        };

        img.onerror = (e) => reject(e);
    });
};

const PaletteExtractor = ({ imageUrl, onExtract, inline = false, initialPalette = null }) => {
    const [composition, setComposition] = useState(initialPalette);
    // Always start 'loading' briefly to show the Glitch/Rain effect (the "pop")
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // ALWAYS start with loading = true to trigger the PixelRain/Glitch animation
        setLoading(true);

        if (!imageUrl) return;

        // If we have cached data, show Glitch for a "microsecond" (e.g. 600ms) then reveal
        if (initialPalette) {
            const t = setTimeout(() => {
                setComposition(initialPalette);
                setLoading(false);
            }, 600);
            return () => clearTimeout(t);
        }

        setComposition(null);

        analyzeImage(imageUrl).then(result => {
            // Even if finished early, the user wants to see the glitch.
            // But if it's NOT cached, we should at least wait for analysis.
            setComposition(result.palette);
            if (onExtract) onExtract(result.bg);
        }).catch(err => {
            console.error(err);
        }).finally(() => {
            setLoading(false);
        });

    }, [imageUrl, initialPalette]);

    if (!inline) return null;

    return (
        <AnimatePresence mode="wait">
            {!loading && composition ? (
                <motion.div
                    key="palette"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0, minHeight: '48px' }}
                >
                    {composition.map((color, i) => (
                        <div
                            key={i}
                            style={{ width: '48px', height: '48px', backgroundColor: color, borderRadius: '1px', boxShadow: 'inset 0 0 4px rgba(0,0,0,0.1)' }}
                        />
                    ))}
                </motion.div>
            ) : (
                <motion.div
                    key="glitch"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ display: 'flex', alignItems: 'center', minHeight: '48px' }}
                >
                    <PixelRain />
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default PaletteExtractor;
