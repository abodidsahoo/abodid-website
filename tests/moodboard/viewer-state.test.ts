import { describe, expect, it } from 'vitest';
import { getViewerIndex } from '../../src/lib/moodboardViewerState.js';

describe('moodboard viewer state', () => {
    it('keeps the active photo selected when clearing a filter expands and reorders the list', () => {
        const filteredItems = [{ id: 'photo-b' }, { id: 'photo-d' }];
        const allItems = [
            { id: 'photo-a' },
            { id: 'photo-b' },
            { id: 'photo-c' },
            { id: 'photo-d' },
        ];

        expect(getViewerIndex(filteredItems, 'photo-d')).toBe(1);
        expect(getViewerIndex(allItems, 'photo-d')).toBe(3);
    });

    it('falls back safely when the active photo is removed by a filter', () => {
        expect(getViewerIndex([{ id: 'photo-a' }, { id: 'photo-b' }], 'photo-z')).toBe(0);
        expect(getViewerIndex([], 'photo-z')).toBe(0);
    });
});
