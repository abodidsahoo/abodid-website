import { supabase } from '../supabaseClient';

type Nullable<T> = T | null;

type SyncResultRow = {
    inserted_count: number;
    total_rows: number;
};

type PhotographyRow = {
    id: string;
    title: string;
    slug: string;
    cover_image: Nullable<string>;
    gallery_images: unknown;
    sort_order: Nullable<number>;
    created_at: Nullable<string>;
};

type PhotoStoryRow = {
    id: string;
    photo_url: string;
    story_markdown: Nullable<string>;
    sample_story_markdown: Nullable<string>;
    is_story_locked: Nullable<boolean>;
    genre: Nullable<string>;
    is_art: Nullable<boolean>;
    is_commercial: Nullable<boolean>;
    updated_at: Nullable<string>;
    created_at: Nullable<string>;
};

type BasePhotoAsset = {
    photoUrl: string;
    projectId: string;
    projectTitle: string;
    projectSlug: string;
    sourceType: 'cover' | 'gallery';
    sortOrder: Nullable<number>;
    projectCreatedAt: Nullable<string>;
};

export type PhotoStoryAsset = BasePhotoAsset & {
    storyId: Nullable<string>;
    storyMarkdown: string;
    sampleStoryMarkdown: string;
    effectiveStoryMarkdown: string;
    isStoryLocked: boolean;
    genre: Nullable<string>;
    isArt: boolean;
    isCommercial: boolean;
    hasStory: boolean;
    storyUpdatedAt: Nullable<string>;
    storyCreatedAt: Nullable<string>;
};

const STORY_SELECT =
    'id, photo_url, story_markdown, sample_story_markdown, is_story_locked, genre, is_art, is_commercial, updated_at, created_at';

function normalizePhotoUrl(url: unknown): string {
    return typeof url === 'string' ? url.trim() : '';
}

function splitUrlsByEncodedFilterLength(
    urls: string[],
    maxEncodedLength = 5500,
): string[][] {
    const chunks: string[][] = [];
    let current: string[] = [];
    let currentLen = 0;

    for (const url of urls) {
        // PostgREST receives URL-encoded values for "in.(...)",
        // so chunk by encoded length to avoid 400 URI-too-long errors.
        const encodedLen = encodeURIComponent(url).length + 1; // include comma separator

        if (current.length > 0 && currentLen + encodedLen > maxEncodedLength) {
            chunks.push(current);
            current = [url];
            currentLen = encodedLen;
            continue;
        }

        current.push(url);
        currentLen += encodedLen;
    }

    if (current.length > 0) {
        chunks.push(current);
    }

    return chunks;
}

function getGalleryUrls(rawGallery: unknown): string[] {
    if (!Array.isArray(rawGallery)) return [];

    return rawGallery
        .map((entry: any) => {
            if (typeof entry === 'string') return normalizePhotoUrl(entry);
            if (entry && typeof entry === 'object') {
                return normalizePhotoUrl(entry.url);
            }
            return '';
        })
        .filter(Boolean);
}

async function fetchPhotoStoriesByUrls(photoUrls: string[]): Promise<PhotoStoryRow[]> {
    if (!photoUrls.length) return [];

    const chunks = splitUrlsByEncodedFilterLength(photoUrls);
    const merged: PhotoStoryRow[] = [];

    for (const chunk of chunks) {
        const { data, error } = await supabase
            .from('photo_stories')
            .select(STORY_SELECT)
            .in('photo_url', chunk);

        if (error) throw error;
        merged.push(...((data || []) as PhotoStoryRow[]));
    }

    return merged;
}

export async function syncPhotoStoriesFromPhotography(): Promise<{
    insertedCount: number;
    totalRows: number;
}> {
    const { data, error } = await supabase.rpc('sync_photo_stories_from_photography');
    if (error) throw error;

    const row = Array.isArray(data) ? (data[0] as SyncResultRow | undefined) : (data as SyncResultRow | null);
    return {
        insertedCount: row?.inserted_count || 0,
        totalRows: row?.total_rows || 0,
    };
}

export async function listPhotoStoryAssets(): Promise<PhotoStoryAsset[]> {
    const { data: projects, error: projectsError } = await supabase
        .from('photography')
        .select('id, title, slug, cover_image, gallery_images, sort_order, created_at')
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

    if (projectsError) throw projectsError;

    const deduped = new Map<string, BasePhotoAsset>();

    for (const project of (projects || []) as PhotographyRow[]) {
        const addAsset = (photoUrl: string, sourceType: 'cover' | 'gallery') => {
            const normalized = normalizePhotoUrl(photoUrl);
            if (!normalized || deduped.has(normalized)) return;

            deduped.set(normalized, {
                photoUrl: normalized,
                projectId: project.id,
                projectTitle: project.title || 'Untitled Project',
                projectSlug: project.slug || '',
                sourceType,
                sortOrder: project.sort_order,
                projectCreatedAt: project.created_at,
            });
        };

        addAsset(project.cover_image, 'cover');
        for (const galleryUrl of getGalleryUrls(project.gallery_images)) {
            addAsset(galleryUrl, 'gallery');
        }
    }

    const assets = Array.from(deduped.values());
    const photoUrls = assets.map((asset) => asset.photoUrl);
    const stories = await fetchPhotoStoriesByUrls(photoUrls);
    const storyByUrl = new Map(stories.map((row) => [normalizePhotoUrl(row.photo_url), row]));

    return assets.map((asset) => {
        const story = storyByUrl.get(asset.photoUrl);
        const storyMarkdown = story?.story_markdown || '';
        const sampleStoryMarkdown = story?.sample_story_markdown || '';
        const effectiveStoryMarkdown = storyMarkdown || sampleStoryMarkdown;
        const isStoryLocked = Boolean(story?.is_story_locked);

        return {
            ...asset,
            storyId: story?.id || null,
            storyMarkdown,
            sampleStoryMarkdown,
            effectiveStoryMarkdown,
            isStoryLocked,
            genre: story?.genre || null,
            isArt: Boolean(story?.is_art),
            isCommercial: Boolean(story?.is_commercial),
            hasStory: isStoryLocked,
            storyUpdatedAt: story?.updated_at || null,
            storyCreatedAt: story?.created_at || null,
        };
    });
}

export async function getPhotoStoryMetaByUrls(photoUrls: string[]): Promise<Map<string, {
    isArt: boolean;
    isCommercial: boolean;
    genre: string | null;
}>> {
    const normalized = photoUrls.map(normalizePhotoUrl).filter(Boolean);
    const rows = await fetchPhotoStoriesByUrls(normalized);

    return new Map(
        rows.map((row) => [
            normalizePhotoUrl(row.photo_url),
            {
                isArt: Boolean(row.is_art),
                isCommercial: Boolean(row.is_commercial),
                genre: row.genre || null,
            },
        ]),
    );
}

export async function getPhotoStoryByUrl(photoUrl: string): Promise<PhotoStoryRow | null> {
    const normalized = normalizePhotoUrl(photoUrl);
    if (!normalized) return null;

    const { data, error } = await supabase
        .from('photo_stories')
        .select(STORY_SELECT)
        .eq('photo_url', normalized)
        .maybeSingle();

    if (error) throw error;
    return (data as PhotoStoryRow | null) || null;
}

export async function upsertPhotoStoryByUrl(
    photoUrl: string,
    storyMarkdown: string,
    genre: string | null = null,
): Promise<PhotoStoryRow> {
    const normalized = normalizePhotoUrl(photoUrl);
    if (!normalized) throw new Error('Photo URL is required.');

    const payload = {
        photo_url: normalized,
        story_markdown: storyMarkdown ?? '',
        is_story_locked: true,
        genre,
    };

    const { data, error } = await supabase
        .from('photo_stories')
        .upsert(payload, { onConflict: 'photo_url' })
        .select(STORY_SELECT)
        .single();

    if (error) throw error;
    return data as PhotoStoryRow;
}

export async function upsertPhotoStoryLabelsByUrl(
    photoUrl: string,
    labels: {
        isArt?: boolean;
        isCommercial?: boolean;
        genre?: string | null;
    },
): Promise<PhotoStoryRow> {
    const normalized = normalizePhotoUrl(photoUrl);
    if (!normalized) throw new Error('Photo URL is required.');

    const payload: Record<string, unknown> = {
        photo_url: normalized,
    };

    if (typeof labels.isArt === 'boolean') payload.is_art = labels.isArt;
    if (typeof labels.isCommercial === 'boolean') payload.is_commercial = labels.isCommercial;
    if ('genre' in labels) payload.genre = labels.genre ?? null;

    const { data, error } = await supabase
        .from('photo_stories')
        .upsert(payload, { onConflict: 'photo_url' })
        .select(STORY_SELECT)
        .single();

    if (error) throw error;
    return data as PhotoStoryRow;
}
