import { describe, expect, it } from 'vitest';
import { cleanTagName, rankTagSuggestions } from '../../src/lib/resources/tagSuggestions';
import type { HubTag } from '../../src/lib/resources/types';

const tags: HubTag[] = [
    { id: '1', name: 'Creative Coding' },
    { id: '2', name: 'Code' },
    { id: '3', name: 'Low Code' },
    { id: '4', name: 'Colour Systems' },
    { id: '5', name: 'Design' },
];

describe('resource tag suggestions', () => {
    it('cleans pasted hashes and repeated whitespace', () => {
        expect(cleanTagName(' ##Creative   Coding ')).toBe('Creative Coding');
    });

    it('ranks exact, prefix, word-prefix, substring and fuzzy matches in that order', () => {
        expect(rankTagSuggestions(tags, 'code').map((tag) => tag.name)).toEqual([
            'Code',
            'Low Code',
        ]);
        expect(rankTagSuggestions(tags, 'cre').map((tag) => tag.name)[0]).toBe('Creative Coding');
        expect(rankTagSuggestions(tags, 'dsgn').map((tag) => tag.name)[0]).toBe('Design');
    });

    it('removes selected tags and duplicate results before choosing the best match', () => {
        expect(rankTagSuggestions([...tags, tags[1]], 'co', ['2']).map((tag) => tag.name)).toEqual([
            'Colour Systems',
            'Low Code',
            'Creative Coding',
        ]);
    });
});
