import { supabase } from '../supabase';
import { createSupabaseServiceClient } from '../supabaseServer';
import fs from 'node:fs';
import path from 'node:path';

export type PaletteData = {
    dominantHex: string;
    dominantLab: [number, number, number];
    dominantHsl: [number, number, number];
    paletteHex: string[];
    paletteLab: [number, number, number][];
    paletteHsl: [number, number, number][];
    isDark: boolean;
};

type MoodboardRow = {
    id: string;
    image_url: string;
    storage_path: string;
    title: string | null;
    tags: unknown;
    published: boolean;
    image_width: number | null;
    image_height: number | null;
    aspect_ratio: number | null;
    created_at: string | null;
    updated_at: string | null;
};

type MoodboardMediaVariantRow = {
    variant_key: string;
    public_url: string;
};

type MoodboardMediaAssetRow = {
    object_key: string;
    public_url: string;
    media_variants: MoodboardMediaVariantRow[] | null;
};

export type MoodboardItem = {
    id: string;
    imageUrl: string;
    thumbnailUrl: string;
    originalUrl: string;
    storagePath: string;
    title: string;
    tags: string[];
    published: boolean;
    imageWidth: number | null;
    imageHeight: number | null;
    aspectRatio: number | null;
    palette?: PaletteData | null;
    createdAt: string | null;
    updatedAt: string | null;
};

const SELECT_FIELDS = 'id, image_url, storage_path, title, tags, published, image_width, image_height, aspect_ratio, created_at, updated_at';
const MOODBOARD_PAGE_SIZE = 1000;
const MOODBOARD_R2_FOLDER = 'photos/originals/moodboard';
const MEDIA_SELECT_FIELDS = 'object_key, public_url, media_variants(variant_key, public_url)';

function loadGeneratedPalettes(): Record<string, PaletteData> {
    try {
        const palettePath = path.resolve(process.cwd(), 'src/data/moodboardPalettes.generated.json');
        if (fs.existsSync(palettePath)) {
            const raw = fs.readFileSync(palettePath, 'utf8');
            return JSON.parse(raw);
        }
    } catch {
        // Fallback gracefully
    }
    return {};
}

function normalizeTags(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];

    return raw
        .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
        .filter(Boolean);
}

export function moodboardObjectKey(row: Pick<MoodboardRow, 'storage_path' | 'image_url'>): string {
    const storagePath = row.storage_path?.trim() || '';
    if (storagePath.startsWith('assets/')) return storagePath.slice('assets/'.length);
    if (storagePath.startsWith(`${MOODBOARD_R2_FOLDER}/`)) return storagePath;

    try {
        const pathname = decodeURIComponent(new URL(row.image_url).pathname).replace(/^\/+/, '');
        if (pathname.startsWith(`${MOODBOARD_R2_FOLDER}/`)) return pathname;
    } catch {
        // Legacy Supabase-hosted moodboard items do not have an R2 object key.
    }

    return '';
}

export function mapMoodboardRows(
    rows: MoodboardRow[],
    palettes: Record<string, PaletteData>,
    mediaAssets: MoodboardMediaAssetRow[] = [],
): MoodboardItem[] {
    const assetsByObjectKey = new Map(mediaAssets.map((asset) => [asset.object_key, asset]));

    return rows.map((row) => {
        const mediaAsset = assetsByObjectKey.get(moodboardObjectKey(row));
        const variants = new Map(
            (mediaAsset?.media_variants || [])
                .filter((variant) => variant?.variant_key && variant?.public_url)
                .map((variant) => [String(variant.variant_key), variant.public_url]),
        );
        const originalUrl = mediaAsset?.public_url || row.image_url;
        const imageUrl = variants.get('1600') || originalUrl;
        const thumbnailUrl = variants.get('800') || imageUrl;
        const palette = palettes[row.id]
            || palettes[thumbnailUrl]
            || palettes[imageUrl]
            || palettes[originalUrl]
            || null;

        return {
            id: row.id,
            imageUrl,
            thumbnailUrl,
            originalUrl,
            storagePath: row.storage_path,
            title: row.title?.trim() || 'Untitled Mood',
            tags: normalizeTags(row.tags),
            published: Boolean(row.published),
            imageWidth: row.image_width,
            imageHeight: row.image_height,
            aspectRatio: row.aspect_ratio,
            palette,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    });
}

async function loadMoodboardMediaAssets(): Promise<MoodboardMediaAssetRow[]> {
    const serviceClient = createSupabaseServiceClient();
    if (!serviceClient) return [];

    const rows: MoodboardMediaAssetRow[] = [];
    for (let from = 0; ; from += MOODBOARD_PAGE_SIZE) {
        const { data, error } = await serviceClient
            .from('media_assets')
            .select(MEDIA_SELECT_FIELDS)
            .eq('storage_provider', 'cloudflare_r2')
            .eq('storage_bucket', 'assets')
            .eq('folder_path', MOODBOARD_R2_FOLDER)
            .range(from, from + MOODBOARD_PAGE_SIZE - 1);
        if (error) throw error;

        const page = (data || []) as unknown as MoodboardMediaAssetRow[];
        rows.push(...page);
        if (page.length < MOODBOARD_PAGE_SIZE) break;
    }
    return rows;
}

function mapMoodboardRow(row: MoodboardRow, palettes: Record<string, PaletteData>): MoodboardItem {
    return mapMoodboardRows([row], palettes)[0];
}

function mapMoodboardRowsWithoutVariants(
    rows: MoodboardRow[],
    palettes: Record<string, PaletteData>,
): MoodboardItem[] {
    return rows.map((row) => mapMoodboardRow(row, palettes));
}

export async function getPublishedMoodboardItems(): Promise<MoodboardItem[]> {
    try {
        const palettes = loadGeneratedPalettes();
        const rows: MoodboardRow[] = [];
        let from = 0;

        while (true) {
            const to = from + MOODBOARD_PAGE_SIZE - 1;
            const { data, error } = await supabase
                .from('moodboard_items')
                .select(SELECT_FIELDS)
                .eq('published', true)
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;

            const page = (data || []) as MoodboardRow[];
            rows.push(...page);

            if (page.length < MOODBOARD_PAGE_SIZE) break;
            from += MOODBOARD_PAGE_SIZE;
        }

        try {
            const mediaAssets = await loadMoodboardMediaAssets();
            return mapMoodboardRows(rows, palettes, mediaAssets);
        } catch (error) {
            console.error('Failed to load optimized moodboard variants:', error);
            return mapMoodboardRowsWithoutVariants(rows, palettes);
        }
    } catch (error) {
        console.error('Failed to load moodboard items:', error);
        return [];
    }
}
