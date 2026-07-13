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

const artifactDir = path.join(root, 'moodboard-webp-migration-2026-07-13');
const manifest = JSON.parse(
    await fs.readFile(path.join(artifactDir, 'conversion-manifest.json'), 'utf8'),
);
const knownDimensions = new Map(
    manifest.objects.map((object) => [
        `moodboard-assets/${object.webp_path}`,
        { width: object.webp_width, height: object.webp_height, source: 'conversion-manifest' },
    ]),
);

const { data: rows, error: selectError } = await supabase
    .from('moodboard_items')
    .select('id, image_url, storage_path, image_width, image_height, aspect_ratio')
    .order('created_at', { ascending: false })
    .limit(1000);

if (selectError) throw selectError;

async function dimensionsFor(row) {
    const known = knownDimensions.get(row.storage_path);
    if (known) return known;

    const response = await fetch(row.image_url);
    if (!response.ok) {
        throw new Error(`Download failed (${response.status}) for ${row.storage_path}`);
    }

    const metadata = await sharp(Buffer.from(await response.arrayBuffer()), {
        animated: true,
    }).metadata();

    const visibleHeight = metadata.pageHeight || metadata.height;

    if (!metadata.width || !visibleHeight) {
        throw new Error(`Missing dimensions for ${row.storage_path}`);
    }

    return { width: metadata.width, height: visibleHeight, source: 'asset-metadata' };
}

const results = [];
const concurrency = 8;

for (let offset = 0; offset < rows.length; offset += concurrency) {
    const batch = rows.slice(offset, offset + concurrency);
    const batchResults = await Promise.all(batch.map(async (row) => {
        const dimensions = await dimensionsFor(row);
        const { error } = await supabase
            .from('moodboard_items')
            .update({
                image_width: dimensions.width,
                image_height: dimensions.height,
            })
            .eq('id', row.id);

        if (error) throw error;

        return {
            id: row.id,
            storage_path: row.storage_path,
            image_width: dimensions.width,
            image_height: dimensions.height,
            aspect_ratio: dimensions.width / dimensions.height,
            source: dimensions.source,
        };
    }));

    results.push(...batchResults);
}

const { data: verifiedRows, error: verifyError } = await supabase
    .from('moodboard_items')
    .select('id, image_width, image_height, aspect_ratio')
    .limit(1000);

if (verifyError) throw verifyError;

const incomplete = verifiedRows.filter((row) => (
    !row.image_width || !row.image_height || !row.aspect_ratio
));

const report = {
    created_at: new Date().toISOString(),
    total_rows: rows.length,
    updated_rows: results.length,
    manifest_dimensions: results.filter((row) => row.source === 'conversion-manifest').length,
    inspected_asset_dimensions: results.filter((row) => row.source === 'asset-metadata').length,
    verified_rows: verifiedRows.length,
    incomplete_rows: incomplete.length,
    objects: results,
};

await fs.writeFile(
    path.join(artifactDir, 'dimensions-backfill-results.json'),
    `${JSON.stringify(report, null, 2)}\n`,
);

if (incomplete.length > 0) {
    throw new Error(`${incomplete.length} moodboard rows still lack dimensions.`);
}

console.log(JSON.stringify({
    total_rows: report.total_rows,
    updated_rows: report.updated_rows,
    manifest_dimensions: report.manifest_dimensions,
    inspected_asset_dimensions: report.inspected_asset_dimensions,
    incomplete_rows: report.incomplete_rows,
}, null, 2));
