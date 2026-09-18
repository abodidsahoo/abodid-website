import { supabase } from '../supabase';
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

export type MoodboardItem = {
    id: string;
    imageUrl: string;
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

function mapMoodboardRow(row: MoodboardRow, palettes: Record<string, PaletteData>): MoodboardItem {
    const palette = palettes[row.id] || palettes[row.image_url] || null;
    return {
        id: row.id,
        imageUrl: row.image_url,
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

        return rows.map((row) => mapMoodboardRow(row, palettes));
    } catch (error) {
        console.error('Failed to load moodboard items:', error);
        return [];
    }
}

