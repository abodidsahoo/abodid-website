import type { HubTag } from './types';

export const cleanTagName = (value: string) =>
    value.trim().replace(/^#+/, '').replace(/\s+/g, ' ').trim().slice(0, 60);

const isSubsequence = (query: string, value: string) => {
    let queryIndex = 0;
    for (const character of value) {
        if (character === query[queryIndex]) queryIndex += 1;
        if (queryIndex === query.length) return true;
    }
    return false;
};

const matchRank = (name: string, query: string) => {
    const normalizedName = name.toLocaleLowerCase();
    const normalizedQuery = query.toLocaleLowerCase();
    if (normalizedName === normalizedQuery) return 0;
    if (normalizedName.startsWith(normalizedQuery)) return 1;
    if (normalizedName.split(/[^a-z0-9]+/i).some((word) => word.startsWith(normalizedQuery))) return 2;
    if (normalizedName.includes(normalizedQuery)) return 3;
    if (isSubsequence(normalizedQuery, normalizedName)) return 4;
    return Number.POSITIVE_INFINITY;
};

export function rankTagSuggestions(
    tags: HubTag[],
    query: string,
    selectedTagIds: string[] = [],
    limit = 8
): HubTag[] {
    const normalizedQuery = cleanTagName(query).toLocaleLowerCase();
    if (!normalizedQuery) return [];

    const selected = new Set(selectedTagIds);
    const unique = new Map<string, HubTag>();
    tags.forEach((tag) => {
        if (!selected.has(tag.id) && !unique.has(tag.id)) unique.set(tag.id, tag);
    });

    return [...unique.values()]
        .map((tag) => ({ tag, rank: matchRank(tag.name, normalizedQuery) }))
        .filter(({ rank }) => Number.isFinite(rank))
        .sort((left, right) =>
            left.rank - right.rank
            || left.tag.name.length - right.tag.name.length
            || left.tag.name.localeCompare(right.tag.name)
        )
        .slice(0, limit)
        .map(({ tag }) => tag);
}
