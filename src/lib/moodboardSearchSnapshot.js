export const MOODBOARD_SEARCH_BUCKET = 'moodboard-search';
export const MOODBOARD_SEARCH_FILE = 'search-v1.json';

export function getMoodboardSearchSnapshotUrl(supabaseUrl) {
    if (!supabaseUrl) return '';
    return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${MOODBOARD_SEARCH_BUCKET}/${MOODBOARD_SEARCH_FILE}`;
}

export function parseMoodboardSearchSnapshot(value) {
    if (value?.schemaVersion !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 1
        || typeof value.generatedAt !== 'string' || !Number.isFinite(Date.parse(value.generatedAt))
        || !Array.isArray(value.items) || value.items.length > 50_000) {
        throw new Error('Invalid moodboard search snapshot.');
    }
    const byId = new Map();
    for (const item of value.items) {
        if (!item || typeof item.id !== 'string' || !item.id || byId.has(item.id)
            || typeof item.title !== 'string' || typeof item.artistName !== 'string'
            || !Array.isArray(item.tags) || item.tags.some((tag) => typeof tag !== 'string')) {
            throw new Error('Invalid moodboard search entry.');
        }
        byId.set(item.id, { title: item.title, artistName: item.artistName, tags: item.tags });
    }
    return { byId, generatedAt: Date.parse(value.generatedAt) };
}

export function applyMoodboardSearchSnapshot(items, snapshot) {
    if (!snapshot) return items;
    return items.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        // A newly deployed page can be newer than the most recent publication.
        if (Date.parse(item.updatedAt) > snapshot.generatedAt) return [item];
        const entry = snapshot.byId.get(item.id);
        // The file contains every published ID. Drop references since unpublished
        // or deleted; newly inserted references still need the next site build.
        if (!entry) return Date.parse(item.createdAt) > snapshot.generatedAt ? [item] : [];
        if (item.title === entry.title && (item.artistName || '') === entry.artistName
            && item.tags?.length === entry.tags.length
            && item.tags.every((tag, index) => tag === entry.tags[index])) return [item];
        return [{ ...item, ...entry }];
    });
}

export async function fetchMoodboardSearchSnapshot(url, signal) {
    const response = await fetch(url, { signal, credentials: 'omit', priority: 'low' });
    if (!response.ok) throw new Error(`Moodboard search update unavailable (${response.status}).`);
    const text = await response.text();
    if (text.length > 4 * 1024 * 1024) throw new Error('Moodboard search update is too large.');
    return parseMoodboardSearchSnapshot(JSON.parse(text));
}
