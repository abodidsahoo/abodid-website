import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env') });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
});

// Color conversion helpers
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

function labToRgb(l, a, b) {
    let y = (l + 16) / 116;
    let x = a / 500 + y;
    let z = y - b / 200;

    x = Math.pow(x, 3) > 0.008856 ? Math.pow(x, 3) : (x - 16 / 116) / 7.787;
    y = Math.pow(y, 3) > 0.008856 ? Math.pow(y, 3) : (y - 16 / 116) / 7.787;
    z = Math.pow(z, 3) > 0.008856 ? Math.pow(z, 3) : (z - 16 / 116) / 7.787;

    x *= 95.047;
    y *= 100.000;
    z *= 108.883;

    let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
    let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
    let bVal = x * 0.0557 + y * -0.2040 + z * 1.0570;

    r /= 100;
    g /= 100;
    bVal /= 100;

    r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
    g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
    bVal = bVal > 0.0031308 ? 1.055 * Math.pow(bVal, 1 / 2.4) - 0.055 : 12.92 * bVal;

    return [
        Math.max(0, Math.min(255, Math.round(r * 255))),
        Math.max(0, Math.min(255, Math.round(g * 255))),
        Math.max(0, Math.min(255, Math.round(bVal * 255))),
    ];
}

function rgbToHex(r, g, b) {
    const toHex = (c) => c.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
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

    return [
        Math.round(h * 360),
        Math.round(s * 100),
        Math.round(l * 100),
    ];
}

function deltaE(lab1, lab2) {
    const dL = lab1[0] - lab2[0];
    const da = lab1[1] - lab2[1];
    const db = lab1[2] - lab2[2];
    return Math.sqrt(dL * dL + da * da + db * db);
}

function kMeansClustering(pixels, k = 4, iterations = 6) {
    if (!pixels.length) return [];

    const pixelsWithScore = pixels.map((p) => {
        const chroma = Math.sqrt(p[1] * p[1] + p[2] * p[2]);
        let angle = Math.atan2(p[2], p[1]) * (180 / Math.PI);
        if (angle < 0) angle += 360;
        let humanBonus = 1.0;
        if (angle > 10 && angle < 95) humanBonus = 1.25;
        return { lab: p, score: chroma * humanBonus };
    });

    pixelsWithScore.sort((a, b) => b.score - a.score);

    const seeds = [];
    for (const p of pixelsWithScore) {
        if (seeds.length >= Math.min(3, k)) break;
        if (seeds.every((s) => deltaE(s.lab, p.lab) > 12)) {
            seeds.push(p);
        }
    }

    const centroids = seeds.map((s) => [s.lab[0], s.lab[1], s.lab[2], 1]);
    const needed = k - centroids.length;
    const step = Math.floor(pixels.length / Math.max(1, needed));

    for (let i = 0; i < needed; i++) {
        const idx = Math.min(pixels.length - 1, Math.floor(i * step));
        centroids.push([pixels[idx][0], pixels[idx][1], pixels[idx][2], 1]);
    }

    const labels = new Int32Array(pixels.length);

    for (let iter = 0; iter < iterations; iter++) {
        for (let i = 0; i < pixels.length; i++) {
            let minDist = Infinity;
            let label = 0;
            const p = pixels[i];
            for (let j = 0; j < k; j++) {
                const c = centroids[j];
                const dL = p[0] - c[0];
                const da = p[1] - c[1];
                const db = p[2] - c[2];
                const dist = dL * dL + da * da + db * db;
                if (dist < minDist) {
                    minDist = dist;
                    label = j;
                }
            }
            labels[i] = label;
        }

        const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);
        for (let i = 0; i < pixels.length; i++) {
            const l = labels[i];
            const p = pixels[i];
            sums[l][0] += p[0];
            sums[l][1] += p[1];
            sums[l][2] += p[2];
            sums[l][3] += 1;
        }

        for (let j = 0; j < k; j++) {
            if (sums[j][3] > 0) {
                centroids[j] = [
                    sums[j][0] / sums[j][3],
                    sums[j][1] / sums[j][3],
                    sums[j][2] / sums[j][3],
                    sums[j][3],
                ];
            }
        }
    }

    return centroids.map((c) => ({
        lab: [Number(c[0].toFixed(2)), Number(c[1].toFixed(2)), Number(c[2].toFixed(2))],
        count: c[3],
    }));
}

async function extractPaletteFromImageBuffer(buffer) {
    const { data, info } = await sharp(buffer)
        .resize(100, 100, { fit: 'cover' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const labPixels = [];
    const step = 2; // sample every 2nd pixel for speed + representative spread

    for (let i = 0; i < data.length; i += 4 * step) {
        const a = data[i + 3];
        if (a < 128) continue; // skip transparent
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        labPixels.push(rgbToLab(r, g, b));
    }

    if (!labPixels.length) {
        throw new Error('No valid pixels found');
    }

    const rawClusters = kMeansClustering(labPixels, 6, 6);
    const clusters = rawClusters.filter((c) => c.count > 0);

    // Merge very close clusters
    for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
            if (deltaE(clusters[i].lab, clusters[j].lab) < 12) {
                clusters[i].count += clusters[j].count;
                clusters.splice(j, 1);
                j--;
            }
        }
    }

    const enriched = clusters.map((c) => {
        const chroma = Math.sqrt(c.lab[1] * c.lab[1] + c.lab[2] * c.lab[2]);
        const percentage = c.count / labPixels.length;
        return { lab: c.lab, count: percentage, chroma };
    });

    if (!enriched.length) throw new Error('Clustering produced empty palette');

    // 4 Primary Color Pillars
    const background = enriched.reduce((a, b) => (a.count > b.count ? a : b));
    const candidate2 = enriched.filter((c) => c !== background && deltaE(c.lab, background.lab) > 14);
    const secondary = candidate2.length > 0 ? candidate2.reduce((a, b) => (a.count > b.count ? a : b)) : background;

    const candidate3 = enriched.filter((c) => c !== background && c !== secondary && c.count < 0.25);
    const accent = candidate3.length > 0
        ? candidate3.reduce((a, b) => (a.chroma > b.chroma ? a : b))
        : enriched.reduce((a, b) => (a.chroma > b.chroma ? a : b));

    const candidate4 = enriched.filter((c) => c !== background && c !== secondary && c !== accent);
    const textural = candidate4.length > 0
        ? candidate4.reduce((a, b) => (a.count > b.count ? a : b))
        : secondary;

    const pillars = [background, secondary, textural, accent];
    const paletteHex = [];
    const paletteLab = [];
    const paletteHsl = [];

    for (const item of pillars) {
        const rgb = labToRgb(item.lab[0], item.lab[1], item.lab[2]);
        paletteHex.push(rgbToHex(rgb[0], rgb[1], rgb[2]));
        paletteLab.push([item.lab[0], item.lab[1], item.lab[2]]);
        paletteHsl.push(rgbToHsl(rgb[0], rgb[1], rgb[2]));
    }

    const dominantRgb = labToRgb(background.lab[0], background.lab[1], background.lab[2]);
    const dominantHex = rgbToHex(dominantRgb[0], dominantRgb[1], dominantRgb[2]);
    const dominantLab = [background.lab[0], background.lab[1], background.lab[2]];
    const dominantHsl = rgbToHsl(dominantRgb[0], dominantRgb[1], dominantRgb[2]);

    const isDark = background.lab[0] < 50;

    return {
        dominantHex,
        dominantLab,
        dominantHsl,
        paletteHex,
        paletteLab,
        paletteHsl,
        isDark,
    };
}

async function main() {
    console.log('--- Moodboard Palette Extractor ---');

    const dataDir = path.join(root, 'src', 'data');
    await fs.mkdir(dataDir, { recursive: true });
    const outputPath = path.join(dataDir, 'moodboardPalettes.generated.json');

    // Load existing cache if available
    let generatedMap = {};
    try {
        const raw = await fs.readFile(outputPath, 'utf8');
        generatedMap = JSON.parse(raw);
        console.log(`Loaded ${Object.keys(generatedMap).length} existing palette mappings.`);
    } catch {
        // Fresh start
    }

    // 1. Fetch all moodboard items from Supabase
    const { data: supabaseItems, error: fetchError } = await supabase
        .from('moodboard_items')
        .select('id, image_url, storage_path, title')
        .order('created_at', { ascending: false });

    if (fetchError) {
        console.warn(`Could not query moodboard_items: ${fetchError.message}`);
    }

    const itemsToProcess = [];

    if (supabaseItems && supabaseItems.length) {
        for (const item of supabaseItems) {
            if (!generatedMap[item.id] || !generatedMap[item.image_url]) {
                itemsToProcess.push({
                    id: item.id,
                    imageUrl: item.image_url,
                    storagePath: item.storage_path,
                });
            }
        }
    }

    // 2. Load R2 photography albums snapshot (boudoir, uk-2026, my-life/bts, etc.)
    try {
        const r2SnapshotRaw = await fs.readFile(path.join(dataDir, 'photographyR2.generated.json'), 'utf8');
        const r2Snapshot = JSON.parse(r2SnapshotRaw);

        // Filter for albums used in moodboards: boudoir, uk-2026, my-life, etc.
        const albumKeys = r2Snapshot.filter((entry) => {
            const k = entry.key;
            return (
                k.startsWith('photos/variants/boudoir/800/') ||
                k.startsWith('photos/variants/uk-2026/800/') ||
                k.startsWith('photos/variants/my-life/800/') ||
                k.startsWith('photos/variants/exhibition-photos/800/') ||
                k.startsWith('photos/originals/boudoir/') ||
                k.startsWith('photos/originals/uk-2026/') ||
                k.startsWith('photos/originals/my-life/')
            );
        });

        for (const entry of albumKeys) {
            const url = `https://assets.abodid.com/${entry.key}`;
            const etag = entry.etag ? entry.etag.replace(/"/g, '') : null;
            if (!generatedMap[url] && (!etag || !generatedMap[etag])) {
                itemsToProcess.push({
                    id: etag || entry.key,
                    imageUrl: url,
                    storagePath: entry.key,
                });
            }
        }
    } catch (err) {
        console.warn('Could not read photographyR2 snapshot:', err.message);
    }

    console.log(`Found ${itemsToProcess.length} new items to extract palettes for.`);

    const supabaseRows = [];
    let successCount = 0;
    let failCount = 0;

    const concurrency = 6;
    for (let i = 0; i < itemsToProcess.length; i += concurrency) {
        const batch = itemsToProcess.slice(i, i + concurrency);
        await Promise.all(
            batch.map(async (item) => {
                try {
                    const res = await fetch(item.imageUrl);
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const arrayBuffer = await res.arrayBuffer();
                    const paletteData = await extractPaletteFromImageBuffer(Buffer.from(arrayBuffer));

                    const record = {
                        id: item.id,
                        imageUrl: item.imageUrl,
                        storagePath: item.storagePath,
                        ...paletteData,
                    };

                    generatedMap[item.id] = record;
                    generatedMap[item.imageUrl] = record;
                    if (item.storagePath) {
                        generatedMap[item.storagePath] = record;
                    }

                    if (item.id && item.id.includes('-') && item.id.length === 36) {
                        supabaseRows.push({
                            moodboard_item_id: item.id,
                            storage_path: item.storagePath,
                            image_url: item.imageUrl,
                            dominant_hex: paletteData.dominantHex,
                            dominant_lab: paletteData.dominantLab,
                            dominant_hsl: paletteData.dominantHsl,
                            palette_hex: paletteData.paletteHex,
                            palette_lab: paletteData.paletteLab,
                            palette_hsl: paletteData.paletteHsl,
                            is_dark: paletteData.isDark,
                        });
                    }

                    successCount++;
                    if (successCount % 25 === 0 || successCount === itemsToProcess.length) {
                        console.log(`[Progress] Processed ${successCount}/${itemsToProcess.length} images...`);
                    }
                } catch (err) {
                    failCount++;
                    console.warn(`[Warning] Failed to extract palette for ${item.storagePath}: ${err.message}`);
                }
            }),
        );
    }

    // 3. Write static generated JSON file
    await fs.writeFile(outputPath, JSON.stringify(generatedMap, null, 2), 'utf8');
    console.log(`\nSuccessfully wrote static palette cache to ${outputPath}`);
    console.log(`Extraction run complete: ${successCount} new successful, ${failCount} failed.`);

    // 4. Upsert to Supabase if any supabase rows were processed
    if (supabaseRows.length > 0) {
        console.log('\nAttempting to upsert into Supabase moodboard_color_palettes...');
        try {
            const batchSize = 100;
            for (let i = 0; i < supabaseRows.length; i += batchSize) {
                const batch = supabaseRows.slice(i, i + batchSize);
                const { error: upsertError } = await supabase
                    .from('moodboard_color_palettes')
                    .upsert(batch, { onConflict: 'moodboard_item_id' });

                if (upsertError) {
                    console.log(`Supabase table note: ${upsertError.message}`);
                    break;
                }
            }
        } catch (err) {
            console.log(`Supabase upsert note: ${err.message}`);
        }
    }

    console.log('\n--- All moodboards & albums palette extraction finished! ---');
}

main().catch((err) => {
    console.error('Fatal error in extractor:', err);
    process.exit(1);
});

