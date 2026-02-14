import { supabase } from '../supabase';

type MoodboardRow = {
    id: string;
    image_url: string;
    storage_path: string;
    title: string | null;
    tags: unknown;
    published: boolean;
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
    createdAt: string | null;
    updatedAt: string | null;
};

const SELECT_FIELDS = 'id, image_url, storage_path, title, tags, published, created_at, updated_at';

function normalizeTags(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];

    return raw
        .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
        .filter(Boolean);
}

function mapMoodboardRow(row: MoodboardRow): MoodboardItem {
    return {
        id: row.id,
        imageUrl: row.image_url,
        storagePath: row.storage_path,
        title: row.title?.trim() || 'Untitled Mood',
        tags: normalizeTags(row.tags),
        published: Boolean(row.published),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export async function getPublishedMoodboardItems(): Promise<MoodboardItem[]> {
    try {
        const { data, error } = await supabase
            .from('moodboard_items')
            .select(SELECT_FIELDS)
            .eq('published', true)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return ((data || []) as MoodboardRow[]).map(mapMoodboardRow);
    } catch (error) {
        console.error('Failed to load moodboard items:', error);
        return [];
    }
}
