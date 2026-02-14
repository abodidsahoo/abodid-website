import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const GAP_PX = 10;
const SPAN_STEPS = [1, 2, 4, 8];
const DEFAULT_SHOWREEL_VIDEO_URL =
    'https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/films/videos/Showreel%202025%20compressed.mp4';

const MODE_CONFIG = {
    desktop: { cols: 8, rows: 7 },
    tablet: { cols: 6, rows: 8 },
    mobile: { cols: 4, rows: 10 },
};

const PRESET_LAYOUTS = {
    desktop: [
        { id: 'bio', x: 0, y: 0, w: 2, h: 2 },
        { id: 'showreel', x: 2, y: 0, w: 3, h: 2 },
        { id: 'tags', x: 6, y: 0, w: 2, h: 2 },
        { id: 'films', x: 6, y: 2, w: 2, h: 2 },
        { id: 'photos', x: 0, y: 2, w: 3, h: 3 },
        { id: 'current', x: 3, y: 2, w: 2, h: 3 },
        { id: 'notes', x: 5, y: 4, w: 2, h: 2 },
        { id: 'research', x: 3, y: 5, w: 2, h: 1 },
        { id: 'resources', x: 7, y: 4, w: 1, h: 2 },
        { id: 'fundraising', x: 3, y: 6, w: 2, h: 1 },
        { id: 'newsletter', x: 0, y: 5, w: 1, h: 1 },
        { id: 'site', x: 6, y: 6, w: 1, h: 1 },
        { id: 'social', x: 7, y: 6, w: 1, h: 1 },
    ],
    tablet: [
        { id: 'bio', x: 0, y: 0, w: 2, h: 2 },
        { id: 'showreel', x: 2, y: 0, w: 3, h: 2 },
        { id: 'films', x: 5, y: 0, w: 1, h: 2 },
        { id: 'tags', x: 4, y: 2, w: 2, h: 1 },
        { id: 'photos', x: 0, y: 2, w: 3, h: 3 },
        { id: 'current', x: 3, y: 3, w: 2, h: 3 },
        { id: 'notes', x: 5, y: 3, w: 1, h: 3 },
        { id: 'resources', x: 0, y: 5, w: 2, h: 2 },
        { id: 'research', x: 2, y: 5, w: 2, h: 2 },
        { id: 'fundraising', x: 4, y: 6, w: 2, h: 1 },
        { id: 'newsletter', x: 0, y: 7, w: 2, h: 1 },
        { id: 'site', x: 4, y: 7, w: 1, h: 1 },
        { id: 'social', x: 5, y: 7, w: 1, h: 1 },
    ],
    mobile: [
        { id: 'bio', x: 0, y: 0, w: 2, h: 2 },
        { id: 'tags', x: 2, y: 0, w: 2, h: 1 },
        { id: 'showreel', x: 1, y: 1, w: 3, h: 2 },
        { id: 'films', x: 0, y: 2, w: 1, h: 2 },
        { id: 'current', x: 2, y: 3, w: 2, h: 3 },
        { id: 'photos', x: 0, y: 4, w: 2, h: 3 },
        { id: 'notes', x: 2, y: 6, w: 2, h: 1 },
        { id: 'fundraising', x: 0, y: 7, w: 2, h: 1 },
        { id: 'resources', x: 2, y: 7, w: 2, h: 1 },
        { id: 'research', x: 0, y: 8, w: 2, h: 1 },
        { id: 'newsletter', x: 0, y: 9, w: 2, h: 1 },
        { id: 'site', x: 2, y: 9, w: 1, h: 1 },
        { id: 'social', x: 3, y: 9, w: 1, h: 1 },
    ],
};

const TILE_META = {
    bio: { tag: 'IDENTITY', cta: 'FULL BIO', href: '/about' },
    showreel: { tag: 'SHOWREEL', cta: 'ALL FILMS', href: '/films' },
    films: { tag: 'FILMS', cta: 'SHOW ALL', href: '/films' },
    photos: { tag: 'PHOTO STORIES', cta: 'SHOW ALL', href: '/photography' },
    notes: { tag: 'OBSIDIAN NOTES', cta: 'DAILY NOTES', href: '/research/obsidian-vault' },
    resources: { tag: 'USEFUL RESOURCES', cta: 'HUB', href: '/resources' },
    research: { tag: 'RESEARCH', cta: 'ALL PROJECTS', href: '/research/projects' },
    fundraising: { tag: 'FUNDRAISING', cta: 'SUPPORT', href: '/fundraising' },
    current: { tag: 'WHAT AM I UP TO', cta: 'READ BLOG', href: '/blog' },
    tags: { tag: 'OBSIDIAN TAGS', cta: 'VAULT', href: '/research/obsidian-vault' },
    newsletter: { tag: 'NEWSLETTER', cta: 'JOIN', href: '/newsletter' },
    site: { tag: 'SITE', cta: '', href: '' },
    social: { tag: 'SOCIAL', cta: '', href: '' },
};

const HANDLE_CONFIG = {
    n: { cursor: 'ns-resize', icon: '↕', label: 'top edge' },
    e: { cursor: 'ew-resize', icon: '↔', label: 'right edge' },
    s: { cursor: 'ns-resize', icon: '↕', label: 'bottom edge' },
    w: { cursor: 'ew-resize', icon: '↔', label: 'left edge' },
};

const IMAGE_TILE_IDS = new Set([
    'showreel',
    'films',
    'photos',
    'resources',
    'research',
    'fundraising',
    'current',
]);

const EXPAND_PRIORITY = [
    'photos',
    'current',
    'notes',
    'showreel',
    'films',
    'resources',
    'research',
    'fundraising',
    'newsletter',
    'tags',
    'bio',
];

const EXPAND_TARGET_AREA = {
    photos: 12,
    current: 8,
    notes: 4,
    showreel: 8,
    films: 4,
    resources: 4,
    research: 4,
    fundraising: 3,
    newsletter: 2,
    tags: 2,
    bio: 4,
};

const EXPAND_DIRECTIONS = {
    photos: ['right', 'down', 'left', 'up'],
    current: ['down', 'up', 'right', 'left'],
    notes: ['down', 'up', 'right', 'left'],
    newsletter: ['up', 'down', 'right', 'left'],
    tags: ['left', 'down', 'up', 'right'],
};

const NON_EXPANDING_TILE_IDS = new Set(['newsletter', 'site', 'social']);

const SHUFFLE_LOCKED_TILE_IDS = new Set(['newsletter', 'site', 'social']);

const SHUFFLE_SIZE_OPTIONS = {
    bio: [
        { w: 2, h: 2 },
        { w: 3, h: 2 },
    ],
    showreel: [
        { w: 4, h: 3 },
        { w: 3, h: 2 },
    ],
    photos: [
        { w: 4, h: 3 },
        { w: 3, h: 3 },
        { w: 4, h: 2 },
        { w: 3, h: 2 },
        { w: 2, h: 3 },
    ],
    current: [
        { w: 2, h: 3 },
        { w: 3, h: 2 },
        { w: 2, h: 2 },
    ],
    notes: [
        { w: 1, h: 3 },
        { w: 2, h: 2 },
        { w: 1, h: 2 },
    ],
    films: [
        { w: 2, h: 1 },
        { w: 1, h: 2 },
        { w: 1, h: 1 },
    ],
    resources: [
        { w: 2, h: 1 },
        { w: 1, h: 2 },
        { w: 1, h: 1 },
    ],
    research: [
        { w: 2, h: 2 },
        { w: 2, h: 1 },
        { w: 1, h: 2 },
    ],
    fundraising: [
        { w: 2, h: 1 },
        { w: 2, h: 2 },
        { w: 1, h: 1 },
    ],
    tags: [
        { w: 2, h: 1 },
        { w: 1, h: 1 },
    ],
};

const TILE_MIN_SPANS = {
    bio: { w: 2, h: 2 },
    showreel: { w: 3, h: 2 },
    notes: { w: 2, h: 1 },
    tags: { w: 2, h: 1 },
    current: { w: 2, h: 2 },
    newsletter: { w: 1, h: 1 },
    site: { w: 1, h: 1 },
    social: { w: 1, h: 1 },
};
const SHOWREEL_MIN_RATIO = 4 / 3;
const SHOWREEL_MAX_RATIO = 16 / 9;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const truncate = (value, limit = 88) => {
    if (!value) return '';
    const cleaned = String(value).replace(/\s+/g, ' ').trim();
    if (cleaned.length <= limit) return cleaned;
    return `${cleaned.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
};

const snapSpan = (rawValue, maxValue) => {
    const rounded = clamp(Math.round(rawValue), 1, maxValue);
    const availableSteps = SPAN_STEPS.filter((step) => step <= maxValue);
    if (availableSteps.length === 0) return rounded;
    return availableSteps.reduce((best, current) => {
        const bestDistance = Math.abs(best - rounded);
        const currentDistance = Math.abs(current - rounded);
        return currentDistance < bestDistance ? current : best;
    }, availableSteps[0]);
};

const getSpanSteps = (maxValue) => {
    const steps = SPAN_STEPS.filter((step) => step <= maxValue);
    if (!steps.includes(1)) steps.unshift(1);
    if (!steps.includes(maxValue)) steps.push(maxValue);
    return [...new Set(steps)].sort((a, b) => a - b);
};

const getSmallerSpan = (current, maxValue) => {
    if (current <= 1) return 1;
    const below = getSpanSteps(maxValue).filter((step) => step < current);
    if (below.length > 0) return below[below.length - 1];
    return Math.max(1, current - 1);
};

const getTileMinSpan = (tileId, cols, rows) => {
    const configured = TILE_MIN_SPANS[tileId] || { w: 1, h: 1 };
    return {
        w: clamp(configured.w, 1, cols),
        h: clamp(configured.h, 1, rows),
    };
};

const rectsOverlap = (a, b) =>
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y;

const rectOverlapArea = (a, b) => {
    const width = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const height = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    return width * height;
};

const rectCenterDistance = (a, b) => {
    const ax = a.x + a.w / 2;
    const ay = a.y + a.h / 2;
    const bx = b.x + b.w / 2;
    const by = b.y + b.h / 2;
    return Math.abs(ax - bx) + Math.abs(ay - by);
};

const isInsideBoard = (tile, cols, rows) =>
    tile.x >= 0 &&
    tile.y >= 0 &&
    tile.x + tile.w <= cols &&
    tile.y + tile.h <= rows;

const buildOccupancy = (layout, cols, rows) => {
    const occupied = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => false),
    );

    for (const tile of layout) {
        for (let y = tile.y; y < tile.y + tile.h; y += 1) {
            for (let x = tile.x; x < tile.x + tile.w; x += 1) {
                if (x >= 0 && x < cols && y >= 0 && y < rows) occupied[y][x] = true;
            }
        }
    }

    return occupied;
};

const hasAnyGap = (occupied) =>
    occupied.some((row) => row.some((cell) => cell === false));

const canExpandTile = (tile, direction, occupied, cols, rows) => {
    if (direction === 'right') {
        if (tile.x + tile.w >= cols) return false;
        const x = tile.x + tile.w;
        for (let y = tile.y; y < tile.y + tile.h; y += 1) {
            if (occupied[y][x]) return false;
        }
        return true;
    }

    if (direction === 'down') {
        if (tile.y + tile.h >= rows) return false;
        const y = tile.y + tile.h;
        for (let x = tile.x; x < tile.x + tile.w; x += 1) {
            if (occupied[y][x]) return false;
        }
        return true;
    }

    if (direction === 'left') {
        if (tile.x <= 0) return false;
        const x = tile.x - 1;
        for (let y = tile.y; y < tile.y + tile.h; y += 1) {
            if (occupied[y][x]) return false;
        }
        return true;
    }

    if (direction === 'up') {
        if (tile.y <= 0) return false;
        const y = tile.y - 1;
        for (let x = tile.x; x < tile.x + tile.w; x += 1) {
            if (occupied[y][x]) return false;
        }
        return true;
    }

    return false;
};

const expandTileOnce = (tile, direction) => {
    if (direction === 'right') return { ...tile, w: tile.w + 1 };
    if (direction === 'down') return { ...tile, h: tile.h + 1 };
    if (direction === 'left') return { ...tile, x: tile.x - 1, w: tile.w + 1 };
    if (direction === 'up') return { ...tile, y: tile.y - 1, h: tile.h + 1 };
    return tile;
};

const expandLayoutIntoGaps = (layout, cols, rows, lockedId = null) => {
    if (!Array.isArray(layout) || !layout.length) return layout;

    const next = layout.map((tile) => ({ ...tile }));
    let iteration = 0;

    while (iteration < 96) {
        iteration += 1;
        const occupied = buildOccupancy(next, cols, rows);
        if (!hasAnyGap(occupied)) break;

        let changed = false;
        const ordered = [...next].sort((a, b) => {
            const aPriority = EXPAND_PRIORITY.indexOf(a.id);
            const bPriority = EXPAND_PRIORITY.indexOf(b.id);
            const aRank = aPriority === -1 ? 999 : aPriority;
            const bRank = bPriority === -1 ? 999 : bPriority;
            if (aRank !== bRank) return aRank - bRank;
            return a.id.localeCompare(b.id);
        });

        for (const tileRef of ordered) {
            const idx = next.findIndex((tile) => tile.id === tileRef.id);
            if (idx === -1) continue;

            const tile = next[idx];
            if (!tile) continue;
            if (tile.id === lockedId) continue;
            if (NON_EXPANDING_TILE_IDS.has(tile.id)) continue;

            const targetArea = EXPAND_TARGET_AREA[tile.id] || 8;
            if (tile.w * tile.h >= targetArea) continue;

            const directionOrder = EXPAND_DIRECTIONS[tile.id] || ['right', 'down', 'left', 'up'];
            for (const direction of directionOrder) {
                if (!canExpandTile(tile, direction, occupied, cols, rows)) continue;

                const candidate = expandTileOnce(tile, direction);
                if (!isInsideBoard(candidate, cols, rows)) continue;
                if (IMAGE_TILE_IDS.has(tile.id) && candidate.w / candidate.h > 2) continue;

                next[idx] = candidate;
                changed = true;
                break;
            }

            if (changed) break;
        }

        if (!changed) break;
    }

    return next;
};

const shuffleArray = (list) => {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

const layoutsEqual = (a, b) => {
    if (a === b) return true;
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;

    for (let index = 0; index < a.length; index += 1) {
        const left = a[index];
        const right = b[index];
        if (!left || !right) return false;
        if (
            left.id !== right.id ||
            left.x !== right.x ||
            left.y !== right.y ||
            left.w !== right.w ||
            left.h !== right.h
        ) {
            return false;
        }
    }

    return true;
};

const createShuffledLayout = (layout, cols, rows) => {
    if (!Array.isArray(layout) || !layout.length) return layout;

    const locked = layout
        .filter((tile) => SHUFFLE_LOCKED_TILE_IDS.has(tile.id))
        .map((tile) => ({
            ...tile,
            x: clamp(tile.x, 0, cols - tile.w),
            y: clamp(tile.y, 0, rows - tile.h),
        }));

    const lockedIds = new Set(locked.map((tile) => tile.id));
    const dynamic = layout.filter((tile) => !lockedIds.has(tile.id));
    const preferred = shuffleArray(dynamic.map((tile) => tile.id));
    preferred.sort((a, b) => {
        if (a === 'showreel') return -1;
        if (b === 'showreel') return 1;
        if (a === 'photos') return -1;
        if (b === 'photos') return 1;
        if (a === 'current') return -1;
        if (b === 'current') return 1;
        return 0;
    });

    const placed = [...locked];
    const byId = new Map();
    for (const tile of locked) byId.set(tile.id, tile);

    for (const tileId of preferred) {
        const base = dynamic.find((tile) => tile.id === tileId);
        if (!base) continue;
        const minSpan = getTileMinSpan(tileId, cols, rows);

        const options =
            (SHUFFLE_SIZE_OPTIONS[tileId] || [{ w: base.w, h: base.h }]).filter(
                (size) =>
                    size.w <= cols &&
                    size.h <= rows &&
                    size.w >= minSpan.w &&
                    size.h >= minSpan.h,
            );

        const orderedOptions = shuffleArray(options);
        let placedTile = null;

        for (const option of orderedOptions) {
            const maxX = Math.max(0, cols - option.w);
            const maxY = Math.max(0, rows - option.h);
            const seeded = {
                ...base,
                w: option.w,
                h: option.h,
                x: Math.floor(Math.random() * (maxX + 1)),
                y: Math.floor(Math.random() * (maxY + 1)),
            };

            let candidate = seeded;
            if (IMAGE_TILE_IDS.has(tileId)) {
                candidate = clampImageTileWideRatio(tileId, seeded, cols);
            }
            const found = findPlacementForTile(candidate, placed, cols, rows);
            if (found) {
                placedTile = found;
                break;
            }
        }

        if (!placedTile) {
            const fallback = {
                ...base,
                w: clamp(base.w, 1, cols),
                h: clamp(base.h, 1, rows),
                x: clamp(base.x, 0, cols - clamp(base.w, 1, cols)),
                y: clamp(base.y, 0, rows - clamp(base.h, 1, rows)),
            };

            let found = findPlacementForTile(fallback, placed, cols, rows);
            let working = fallback;
            let attempts = 0;

            while (!found && attempts < 18) {
                working = shrinkTileOneStep(working, cols, rows, tileId);
                found = findPlacementForTile(working, placed, cols, rows);
                attempts += 1;
            }

            if (found) placedTile = found;
        }

        if (!placedTile) continue;
        placed.push(placedTile);
        byId.set(tileId, placedTile);
    }

    const ordered = layout.map((tile) => byId.get(tile.id) || tile).filter(Boolean);
    return finalizeLayout(ordered, cols, rows);
};

const shrinkTileOneStep = (tile, cols, rows, tileId = tile.id) => {
    const minSpan = getTileMinSpan(tileId, cols, rows);
    if (tile.w <= minSpan.w && tile.h <= minSpan.h) {
        return {
            ...tile,
            w: minSpan.w,
            h: minSpan.h,
            x: clamp(tile.x, 0, cols - minSpan.w),
            y: clamp(tile.y, 0, rows - minSpan.h),
        };
    }

    let next = { ...tile };

    if ((tile.w >= tile.h && tile.w > minSpan.w) || tile.h <= minSpan.h) {
        next.w = Math.max(minSpan.w, getSmallerSpan(tile.w, cols));
    } else if (tile.h > minSpan.h) {
        next.h = Math.max(minSpan.h, getSmallerSpan(tile.h, rows));
    }

    if (next.w === tile.w && next.h === tile.h) {
        if (tile.w > minSpan.w) next.w = Math.max(minSpan.w, tile.w - 1);
        else if (tile.h > minSpan.h) next.h = Math.max(minSpan.h, tile.h - 1);
    }

    next.x = clamp(next.x, 0, cols - next.w);
    next.y = clamp(next.y, 0, rows - next.h);
    return next;
};

const findPlacementForTile = (tile, blocked, cols, rows) => {
    const maxX = cols - tile.w;
    const maxY = rows - tile.h;
    if (maxX < 0 || maxY < 0) return null;

    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let y = 0; y <= maxY; y += 1) {
        for (let x = 0; x <= maxX; x += 1) {
            const candidate = { ...tile, x, y };
            const hasOverlap = blocked.some((blockedTile) =>
                rectsOverlap(candidate, blockedTile),
            );
            if (hasOverlap) continue;

            const score = Math.abs(x - tile.x) + Math.abs(y - tile.y);
            if (score < bestScore) {
                best = candidate;
                bestScore = score;
                if (bestScore === 0) return best;
            }
        }
    }

    return best;
};

const sanitizeLayoutNoOverlap = (layout, cols, rows) => {
    if (!Array.isArray(layout) || !layout.length) return [];

    const ordered = [];
    const seen = new Set();

    for (const tile of layout) {
        if (!tile || !tile.id || seen.has(tile.id)) continue;
        seen.add(tile.id);
        ordered.push(tile);
    }

    const placedById = new Map();
    const settled = [];

    for (const source of ordered) {
        const minSpan = getTileMinSpan(source.id, cols, rows);
        let working = {
            ...source,
            w: clamp(Math.round(source.w) || minSpan.w, minSpan.w, cols),
            h: clamp(Math.round(source.h) || minSpan.h, minSpan.h, rows),
        };

        working = {
            ...working,
            x: clamp(Math.round(source.x) || 0, 0, cols - working.w),
            y: clamp(Math.round(source.y) || 0, 0, rows - working.h),
        };

        if (IMAGE_TILE_IDS.has(source.id)) {
            working = clampImageTileWideRatio(source.id, working, cols);
        }

        let placed = findPlacementForTile(working, settled, cols, rows);
        let attempts = 0;

        while (!placed && attempts < 24) {
            working = shrinkTileOneStep(working, cols, rows, source.id);
            if (IMAGE_TILE_IDS.has(source.id)) {
                working = clampImageTileWideRatio(source.id, working, cols);
            }
            placed = findPlacementForTile(working, settled, cols, rows);
            attempts += 1;
        }

        if (!placed) {
            placed = findPlacementForTile(
                { ...working, w: minSpan.w, h: minSpan.h, x: 0, y: 0 },
                settled,
                cols,
                rows,
            );
        }

        if (!placed) continue;

        placedById.set(source.id, placed);
        settled.push(placed);
    }

    return ordered.map((tile) => placedById.get(tile.id)).filter(Boolean);
};

const finalizeLayout = (layout, cols, rows, lockedId = null) => {
    const sanitized = sanitizeLayoutNoOverlap(layout, cols, rows);
    const expanded = expandLayoutIntoGaps(sanitized, cols, rows, lockedId);
    return sanitizeLayoutNoOverlap(expanded, cols, rows);
};

const resolveLayoutAfterChange = (layout, movingId, candidate, cols, rows) => {
    const minSpan = getTileMinSpan(movingId, cols, rows);
    const normalizedCandidate = {
        ...candidate,
        w: clamp(candidate.w, minSpan.w, cols),
        h: clamp(candidate.h, minSpan.h, rows),
    };
    normalizedCandidate.x = clamp(normalizedCandidate.x, 0, cols - normalizedCandidate.w);
    normalizedCandidate.y = clamp(normalizedCandidate.y, 0, rows - normalizedCandidate.h);
    if (!isInsideBoard(normalizedCandidate, cols, rows)) return layout;

    const orderedIds = layout.map((tile) => tile.id);
    const nextById = new Map(layout.map((tile) => [tile.id, { ...tile }]));
    nextById.set(movingId, { ...normalizedCandidate });

    const displacedIds = orderedIds.filter((id) => {
        if (id === movingId) return false;
        const tile = nextById.get(id);
        return tile ? rectsOverlap(tile, normalizedCandidate) : false;
    });

    if (displacedIds.length === 0) {
        return orderedIds.map((id) => nextById.get(id)).filter(Boolean);
    }

    const staticTiles = orderedIds
        .filter((id) => id !== movingId && !displacedIds.includes(id))
        .map((id) => nextById.get(id))
        .filter(Boolean);

    const rankedDisplaced = [...displacedIds].sort((leftId, rightId) => {
        const left = nextById.get(leftId);
        const right = nextById.get(rightId);
        if (!left || !right) return 0;
        const leftOverlap = rectOverlapArea(left, normalizedCandidate);
        const rightOverlap = rectOverlapArea(right, normalizedCandidate);
        if (leftOverlap !== rightOverlap) return rightOverlap - leftOverlap;

        const leftDistance = rectCenterDistance(left, normalizedCandidate);
        const rightDistance = rectCenterDistance(right, normalizedCandidate);
        if (leftDistance !== rightDistance) return leftDistance - rightDistance;

        return leftId.localeCompare(rightId);
    });

    const relocated = [];
    for (const tileId of rankedDisplaced) {
        const sourceTile = nextById.get(tileId);
        if (!sourceTile) continue;

        const blockers = [normalizedCandidate, ...staticTiles, ...relocated];
        let working = {
            ...sourceTile,
            x: clamp(sourceTile.x, 0, cols - sourceTile.w),
            y: clamp(sourceTile.y, 0, rows - sourceTile.h),
        };
        if (IMAGE_TILE_IDS.has(tileId)) {
            working = clampImageTileWideRatio(tileId, working, cols);
        }

        let placed = findPlacementForTile(working, blockers, cols, rows);
        let attempts = 0;
        while (!placed && attempts < 24) {
            const shrunk = shrinkTileOneStep(working, cols, rows, tileId);
            if (shrunk.w === working.w && shrunk.h === working.h) break;
            working = IMAGE_TILE_IDS.has(tileId)
                ? clampImageTileWideRatio(tileId, shrunk, cols)
                : shrunk;
            placed = findPlacementForTile(working, blockers, cols, rows);
            attempts += 1;
        }

        if (!placed) {
            const fallbackMin = getTileMinSpan(tileId, cols, rows);
            const minSizedBase = { ...working, w: fallbackMin.w, h: fallbackMin.h };
            const minSized = IMAGE_TILE_IDS.has(tileId)
                ? clampImageTileWideRatio(tileId, minSizedBase, cols)
                : minSizedBase;
            placed = findPlacementForTile(minSized, blockers, cols, rows);
        }

        if (!placed) return layout;

        nextById.set(tileId, placed);
        relocated.push(placed);
    }

    const next = orderedIds.map((id) => nextById.get(id)).filter(Boolean);
    for (let i = 0; i < next.length; i += 1) {
        for (let j = i + 1; j < next.length; j += 1) {
            if (rectsOverlap(next[i], next[j])) return layout;
        }
    }
    return next;
};

const buildResizeCandidate = (
    origin,
    corner,
    deltaCols,
    deltaRows,
    cols,
    rows,
    minSpan = { w: 1, h: 1 },
) => {
    let left = origin.x;
    let right = origin.x + origin.w;
    let top = origin.y;
    let bottom = origin.y + origin.h;

    if (corner.includes('e')) right += deltaCols;
    if (corner.includes('w')) left += deltaCols;
    if (corner.includes('s')) bottom += deltaRows;
    if (corner.includes('n')) top += deltaRows;

    left = clamp(left, 0, cols - 1);
    right = clamp(right, left + 1, cols);
    top = clamp(top, 0, rows - 1);
    bottom = clamp(bottom, top + 1, rows);

    const snappedWidth = Math.max(minSpan.w, snapSpan(right - left, cols));
    const snappedHeight = Math.max(minSpan.h, snapSpan(bottom - top, rows));

    if (corner.includes('w')) {
        left = right - snappedWidth;
        if (left < 0) {
            left = 0;
            right = snappedWidth;
        }
    } else {
        right = left + snappedWidth;
        if (right > cols) {
            right = cols;
            left = cols - snappedWidth;
        }
    }

    if (corner.includes('n')) {
        top = bottom - snappedHeight;
        if (top < 0) {
            top = 0;
            bottom = snappedHeight;
        }
    } else {
        bottom = top + snappedHeight;
        if (bottom > rows) {
            bottom = rows;
            top = rows - snappedHeight;
        }
    }

    const next = {
        ...origin,
        x: left,
        y: top,
        w: right - left,
        h: bottom - top,
    };

    const safeMin = {
        w: clamp(minSpan.w, 1, cols),
        h: clamp(minSpan.h, 1, rows),
    };

    if (next.w < safeMin.w) {
        const anchorRight = next.x + next.w;
        if (corner.includes('w')) {
            next.w = safeMin.w;
            next.x = clamp(anchorRight - safeMin.w, 0, cols - safeMin.w);
        } else {
            next.w = safeMin.w;
            next.x = clamp(next.x, 0, cols - safeMin.w);
        }
    }

    if (next.h < safeMin.h) {
        const anchorBottom = next.y + next.h;
        if (corner.includes('n')) {
            next.h = safeMin.h;
            next.y = clamp(anchorBottom - safeMin.h, 0, rows - safeMin.h);
        } else {
            next.h = safeMin.h;
            next.y = clamp(next.y, 0, rows - safeMin.h);
        }
    }

    return next;
};

const clampImageTileWideRatio = (tileId, candidate, cols) => {
    if (!IMAGE_TILE_IDS.has(tileId)) return candidate;
    if (!candidate || candidate.h <= 0) return candidate;

    if (tileId === 'showreel') {
        const maxWidth = Math.max(1, Math.floor(candidate.h * SHOWREEL_MAX_RATIO));
        const minWidth = Math.max(1, Math.ceil(candidate.h * SHOWREEL_MIN_RATIO));
        const lowerBound = Math.min(minWidth, maxWidth);
        const upperBound = Math.max(minWidth, maxWidth);
        const nextWidth = clamp(
            candidate.w,
            Math.min(cols, lowerBound),
            Math.min(cols, upperBound),
        );
        return {
            ...candidate,
            w: nextWidth,
            x: clamp(candidate.x, 0, cols - nextWidth),
        };
    }

    const currentRatio = candidate.w / candidate.h;
    if (currentRatio <= 2) return candidate;

    const maxWidthByRatio = Math.max(1, Math.floor(candidate.h * 2));
    const allowedSteps = getSpanSteps(cols).filter((step) => step <= maxWidthByRatio);
    const nextWidth = allowedSteps.length
        ? allowedSteps[allowedSteps.length - 1]
        : Math.min(1, maxWidthByRatio);

    return {
        ...candidate,
        w: nextWidth,
        x: clamp(candidate.x, 0, cols - nextWidth),
    };
};

const getInitials = (value) => {
    if (!value) return 'AB';
    const words = String(value).split(' ').filter(Boolean);
    if (!words.length) return 'AB';
    return words
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join('');
};

const getTileSizeClass = (tile) => {
    const area = tile.w * tile.h;
    if (area <= 1) return 'size-xs';
    if (area <= 2) return 'size-sm';
    if (area <= 4) return 'size-md';
    if (area <= 8) return 'size-lg';
    return 'size-xl';
};

function TileRotator({ items, renderItem, interval = 5200, startDelay = 0 }) {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (!items || items.length < 2) {
            setIndex(0);
            return undefined;
        }

        let tick;
        const kickoff = window.setTimeout(() => {
            tick = window.setInterval(() => {
                setIndex((prev) => prev + 1);
            }, interval);
        }, startDelay);

        return () => {
            window.clearTimeout(kickoff);
            if (tick) window.clearInterval(tick);
        };
    }, [items, interval, startDelay]);

    if (!items || items.length === 0) return null;

    const safeIndex = ((index % items.length) + items.length) % items.length;
    const item = items[safeIndex];
    const itemBaseKey = item?.id || item?.slug || item?.href || item?.title || safeIndex;
    const itemKey = `${itemBaseKey}-${index}`;

    return (
        <div className="rotator-shell">
            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={itemKey}
                    initial={{ opacity: 0, x: 22 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -22 }}
                    transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                    className="rotator-frame"
                >
                    {renderItem(item, index)}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}

function NotesTicker({ notes, visibleCount = 3, interval = 4300 }) {
    const safeNotes = Array.isArray(notes) ? notes : [];
    const [start, setStart] = useState(() =>
        safeNotes.length > 0 ? Math.floor(Math.random() * safeNotes.length) : 0,
    );

    useEffect(() => {
        if (safeNotes.length < 2) {
            setStart(0);
            return undefined;
        }

        const timer = window.setInterval(() => {
            setStart((prev) => (prev + 1) % safeNotes.length);
        }, interval);

        return () => window.clearInterval(timer);
    }, [safeNotes, interval]);

    if (!safeNotes.length) return null;

    const count = Math.max(1, Math.min(visibleCount, safeNotes.length));
    const current = [];
    for (let index = 0; index < count; index += 1) {
        current.push(safeNotes[(start + index) % safeNotes.length]);
    }

    return (
        <div className="notes-ticker-shell">
            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={`${start}-${count}`}
                    className="notes-stack"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -14 }}
                    transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                >
                    {current.map((note, index) => (
                        <a
                            key={`${note.id || note.href || note.title}-${index}`}
                            href={note.href || '/research/obsidian-vault'}
                            className="note-line"
                            onPointerDown={(event) => event.stopPropagation()}
                        >
                            <span className="note-index">
                                {String((start + index + 1) % 100).padStart(2, '0')}
                            </span>
                            <span className="note-title">{truncate(note.title || 'Untitled Note', 78)}</span>
                        </a>
                    ))}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}

function TagsNodeGrid({ tags, density = 'regular' }) {
    const shellRef = useRef(null);
    const [shellSize, setShellSize] = useState({ width: 0, height: 0 });
    const [seed, setSeed] = useState(() => Math.floor(Math.random() * 100000));

    const tagPool = useMemo(() => {
        const mapped = (Array.isArray(tags) ? tags : [])
            .map((tag, index) => {
                if (typeof tag === 'string') {
                    const raw = tag.replace(/\.md$/i, '').trim();
                    if (!raw) return null;
                    return {
                        id: `tag-${raw}-${index}`,
                        label: raw,
                        href: `/research/obsidian-vault/${encodeURIComponent(raw)}`,
                    };
                }

                const rawSlug = String(
                    tag?.slug || tag?.name || tag?.title || tag?.label || '',
                )
                    .replace(/\.md$/i, '')
                    .trim();

                if (!rawSlug) return null;

                const label = String(tag?.label || tag?.title || rawSlug)
                    .replace(/\.md$/i, '')
                    .trim();

                const href = String(
                    tag?.href || `/research/obsidian-vault/${encodeURIComponent(rawSlug)}`,
                );

                return {
                    id: `tag-${rawSlug}-${index}`,
                    label,
                    href,
                };
            })
            .filter(Boolean);

        if (mapped.length) return mapped;

        return [
            { id: 'fallback-memory', label: 'Memory', href: '/research/obsidian-vault/memory' },
            { id: 'fallback-archive', label: 'Archive', href: '/research/obsidian-vault/archive' },
            { id: 'fallback-story', label: 'Story', href: '/research/obsidian-vault/story' },
            { id: 'fallback-identity', label: 'Identity', href: '/research/obsidian-vault/identity' },
            { id: 'fallback-practice', label: 'Practice', href: '/research/obsidian-vault/practice' },
            { id: 'fallback-notes', label: 'Notes', href: '/research/obsidian-vault/notes' },
        ];
    }, [tags]);

    useEffect(() => {
        const node = shellRef.current;
        if (!node || typeof ResizeObserver === 'undefined') return undefined;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                setShellSize({
                    width,
                    height,
                });
            }
        });

        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    const gridMetrics = useMemo(() => {
        const width = shellSize.width || 240;
        const height = shellSize.height || 120;
        const gap = density === 'compact' ? 4 : 6;
        const shuffleRowHeight = density === 'compact' ? 20 : 22;
        const availableHeight = Math.max(0, height - shuffleRowHeight - gap);
        const minCellWidth = density === 'compact' ? 76 : 94;
        const minCellHeight = density === 'compact' ? 18 : 20;
        const columns = Math.max(1, Math.floor((width + gap) / (minCellWidth + gap)));
        const rows = Math.max(0, Math.floor((availableHeight + gap) / (minCellHeight + gap)));
        return {
            gap,
            columns,
            rows,
            slots: clamp(columns * rows, 0, 96),
        };
    }, [shellSize.width, shellSize.height, density]);

    const visibleTags = useMemo(() => {
        if (!tagPool.length || gridMetrics.slots <= 0) return [];

        let state = (seed * 1103515245 + 12345) >>> 0;
        const nextRand = () => {
            state = (state * 1664525 + 1013904223) >>> 0;
            return state / 4294967296;
        };

        const shuffled = [...tagPool];
        for (let index = shuffled.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(nextRand() * (index + 1));
            [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
        }

        if (shuffled.length >= gridMetrics.slots) return shuffled.slice(0, gridMetrics.slots);

        const filled = [];
        for (let index = 0; index < gridMetrics.slots; index += 1) {
            filled.push(shuffled[index % shuffled.length]);
        }
        return filled;
    }, [tagPool, gridMetrics.slots, seed]);

    const shuffleTags = () => {
        setSeed((previous) => previous + Math.floor(Math.random() * 997) + 1);
    };

    return (
        <div className="tags-node-grid" ref={shellRef}>
            <div
                className="tags-node-field"
                style={{
                    '--tag-cols': String(gridMetrics.columns),
                    '--tag-rows': String(Math.max(gridMetrics.rows, 1)),
                    '--tag-gap': `${gridMetrics.gap}px`,
                }}
            >
                {visibleTags.map((tag, index) => (
                    <a
                        key={`${tag.id}-${seed}-${index}`}
                        href={tag.href}
                        className="tag-node-link"
                        onPointerDown={(event) => event.stopPropagation()}
                    >
                        {tag.label}
                    </a>
                ))}
            </div>
            <button
                type="button"
                className="tags-shuffle-btn"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={shuffleTags}
            >
                Shuffle Tags
            </button>
        </div>
    );
}

function MediaThumb({ image, title }) {
    if (image) {
        return (
            <div className="media-thumb">
                <img src={image} alt={title || 'Thumbnail'} loading="lazy" />
            </div>
        );
    }

    return (
        <div className="media-thumb fallback">
            <span>{getInitials(title)}</span>
        </div>
    );
}

const toList = (value) => (Array.isArray(value) ? value : []);

const withFallback = (list, fallbackItem) => (list.length ? list : [fallbackItem]);

const LandingGridPrototype = ({
    showreelVideoUrl = DEFAULT_SHOWREEL_VIDEO_URL,
    films = [],
    photos = [],
    notes = [],
    obsidianTags = [],
    resources = [],
    researchProjects = [],
    fundraisingProjects = [],
    currentProjects = [],
}) => {
    const shellRef = useRef(null);
    const tilesRef = useRef([]);
    const [viewport, setViewport] = useState({
        width: typeof window !== 'undefined' ? window.innerWidth : 1440,
        height: typeof window !== 'undefined' ? window.innerHeight : 900,
    });
    const [shellSize, setShellSize] = useState({ width: 0, height: 0 });
    const [interaction, setInteraction] = useState(null);
    const [fillerToneMap, setFillerToneMap] = useState({});
    const [isShowreelOpen, setIsShowreelOpen] = useState(false);

    const mode = viewport.width >= 1240 ? 'desktop' : viewport.width >= 820 ? 'tablet' : 'mobile';
    const { cols, rows } = MODE_CONFIG[mode];

    const [tiles, setTiles] = useState(() =>
        finalizeLayout(
            PRESET_LAYOUTS.desktop.map((tile) => ({ ...tile })),
            MODE_CONFIG.desktop.cols,
            MODE_CONFIG.desktop.rows,
        ),
    );

    useEffect(() => {
        const onResize = () => {
            setViewport({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };

        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        setTiles(
            finalizeLayout(
                PRESET_LAYOUTS[mode].map((tile) => ({ ...tile })),
                cols,
                rows,
            ),
        );
    }, [mode, cols, rows]);

    useEffect(() => {
        tilesRef.current = tiles;
    }, [tiles]);

    useEffect(() => {
        setTiles((previous) => {
            const normalized = sanitizeLayoutNoOverlap(previous, cols, rows);
            return layoutsEqual(previous, normalized) ? previous : normalized;
        });
    }, [cols, rows]);

    useEffect(() => {
        if (!isShowreelOpen) return undefined;

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                setIsShowreelOpen(false);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isShowreelOpen]);

    useEffect(() => {
        const node = shellRef.current;
        if (!node || typeof ResizeObserver === 'undefined') return undefined;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                setShellSize({
                    width,
                    height,
                });
            }
        });

        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    const cellWidth = useMemo(() => {
        if (!shellSize.width) return 0;
        return Math.max(24, (shellSize.width - GAP_PX * (cols - 1)) / cols);
    }, [shellSize.width, cols]);

    const cellHeight = useMemo(() => {
        if (!shellSize.height) return 0;
        return Math.max(24, (shellSize.height - GAP_PX * (rows - 1)) / rows);
    }, [shellSize.height, rows]);

    const stepX = cellWidth + GAP_PX;
    const stepY = cellHeight + GAP_PX;

    const cycleFillerTone = (cellKey) => {
        setFillerToneMap((previous) => {
            const tones = ['accent-white', 'accent-red', 'accent-black'];
            const current = previous[cellKey] || 'accent-white';
            const currentIndex = tones.indexOf(current);
            const nextTone = tones[(currentIndex + 1) % tones.length];
            return {
                ...previous,
                [cellKey]: nextTone,
            };
        });
    };

    const shuffleGrid = () => {
        setTiles((previous) => finalizeLayout(createShuffledLayout(previous, cols, rows), cols, rows));
    };

    const openShowreel = () => setIsShowreelOpen(true);
    const closeShowreel = () => setIsShowreelOpen(false);

    const normalizedFilms = useMemo(
        () =>
            withFallback(
                toList(films).map((film, index) => ({
                    id: `film-${index}`,
                    title: truncate(film.title || 'Untitled Film', 58),
                    summary: truncate(film.description || 'Moving image project.', 82),
                    image: film.image || '',
                    href: '/films',
                    year: film.year || '',
                    videoUrl: film.videoUrl || '',
                })),
                {
                    id: 'film-fallback',
                    title: 'Showreel queue syncing...',
                    summary: 'No film row yet. This tile stays live for incoming entries.',
                    image: '',
                    href: '/films',
                    year: '',
                    videoUrl: '',
                },
            ),
        [films],
    );

    const normalizedPhotos = useMemo(
        () =>
            withFallback(
                toList(photos).map((photo, index) => ({
                    id: `photo-${index}`,
                    title: truncate(photo.title || 'Photo Story', 56),
                    summary: truncate(photo.summary || photo.description || 'Visual narrative fragment.', 82),
                    image: photo.image || photo.photoUrl || '',
                    href: photo.href || '/photography',
                })),
                {
                    id: 'photo-fallback',
                    title: 'Photo stories loading...',
                    summary: 'This lane will rotate through your latest photo stories.',
                    image: '',
                    href: '/photography',
                },
            ),
        [photos],
    );

    const normalizedNotes = useMemo(
        () =>
            withFallback(
                toList(notes).map((note, index) => ({
                    id: `note-${index}`,
                    title: truncate(note.title || 'Untitled Note', 60),
                    summary: truncate(note.summary || note.path || 'Daily vault index item.', 88),
                    image: note.image || '',
                    href: note.href || '/research/obsidian-vault',
                })),
                {
                    id: 'note-fallback',
                    title: 'Daily notes feed waiting...',
                    summary: 'Obsidian items will appear here one by one.',
                    image: '',
                    href: '/research/obsidian-vault',
                },
            ),
        [notes],
    );

    const normalizedResources = useMemo(
        () =>
            withFallback(
                toList(resources).map((resource, index) => ({
                    id: `resource-${index}`,
                    title: truncate(resource.title || 'Resource', 58),
                    summary: truncate(resource.summary || resource.description || 'Reference from the resource hub.', 82),
                    image: resource.image || resource.thumbnail_url || '',
                    href: resource.href || resource.url || '/resources',
                })),
                {
                    id: 'resource-fallback',
                    title: 'Resource hub queue...',
                    summary: 'New tools, references, and links will rotate here.',
                    image: '',
                    href: '/resources',
                },
            ),
        [resources],
    );

    const normalizedResearch = useMemo(
        () =>
            withFallback(
                toList(researchProjects).map((project, index) => ({
                    id: `research-${index}`,
                    title: truncate(project.title || 'Research Project', 58),
                    summary: truncate(project.summary || project.description || 'Experimental research stream.', 84),
                    image: project.image || '',
                    href: project.href || '/research/projects',
                })),
                {
                    id: 'research-fallback',
                    title: 'Research queue syncing...',
                    summary: 'Project tiles will start rotating when data arrives.',
                    image: '',
                    href: '/research/projects',
                },
            ),
        [researchProjects],
    );

    const normalizedCurrent = useMemo(
        () =>
            withFallback(
                toList(currentProjects).map((project, index) => ({
                    id: `current-${index}`,
                    title: truncate(project.title || 'Current Project', 46),
                    summary: truncate(project.summary || project.description || 'Action plan in progress.', 70),
                    action: truncate(project.action || project.duration || 'Iterating week by week.', 52),
                    image: project.image || '',
                    href: project.href || '/blog',
                })),
                {
                    id: 'current-fallback',
                    title: 'Current blog updates...',
                    summary: 'Latest writing appears here with visual cover.',
                    action: '',
                    image: '',
                    href: '/blog',
                },
            ),
        [currentProjects],
    );

    const normalizedFundraising = useMemo(
        () =>
            withFallback(
                toList(fundraisingProjects).map((project, index) => ({
                    id: `fundraising-${index}`,
                    title: truncate(project.title || 'Fundraising Project', 52),
                    summary: truncate(project.summary || 'Support this campaign.', 68),
                    image: project.image || '',
                    href: project.href || '/fundraising',
                })),
                {
                    id: 'fundraising-fallback',
                    title: 'Fundraising updates loading...',
                    summary: 'Campaign previews appear here.',
                    image: '',
                    href: '/fundraising',
                },
            ),
        [fundraisingProjects],
    );

    const normalizedTags = useMemo(() => {
        const tags = toList(obsidianTags)
            .map((tag, index) => {
                if (typeof tag === 'string') {
                    const cleaned = tag.replace(/\.md$/i, '').trim();
                    if (!cleaned) return null;
                    return {
                        id: `tag-${cleaned}-${index}`,
                        slug: cleaned,
                        label: truncate(cleaned, 28),
                        href: `/research/obsidian-vault/${encodeURIComponent(cleaned)}`,
                    };
                }

                const slug = String(tag?.slug || tag?.name || tag?.title || '')
                    .replace(/\.md$/i, '')
                    .trim();
                if (!slug) return null;

                const label = String(tag?.label || tag?.title || slug)
                    .replace(/\.md$/i, '')
                    .trim();

                return {
                    id: `tag-${slug}-${index}`,
                    slug,
                    label: truncate(label, 28),
                    href:
                        tag?.href || `/research/obsidian-vault/${encodeURIComponent(slug)}`,
                };
            })
            .filter(Boolean);

        return tags.length
            ? tags
            : [
                  {
                      id: 'tag-memory-fallback',
                      slug: 'memory',
                      label: 'Memory',
                      href: '/research/obsidian-vault/memory',
                  },
                  {
                      id: 'tag-archive-fallback',
                      slug: 'archive',
                      label: 'Archive',
                      href: '/research/obsidian-vault/archive',
                  },
                  {
                      id: 'tag-story-fallback',
                      slug: 'story',
                      label: 'Story',
                      href: '/research/obsidian-vault/story',
                  },
                  {
                      id: 'tag-identity-fallback',
                      slug: 'identity',
                      label: 'Identity',
                      href: '/research/obsidian-vault/identity',
                  },
                  {
                      id: 'tag-ritual-fallback',
                      slug: 'ritual',
                      label: 'Ritual',
                      href: '/research/obsidian-vault/ritual',
                  },
              ];
    }, [obsidianTags]);

    const gapFillers = useMemo(() => {
        if (!cols || !rows) return [];

        const occupied = Array.from({ length: rows }, () =>
            Array.from({ length: cols }, () => false),
        );

        for (const tile of tiles) {
            for (let y = tile.y; y < tile.y + tile.h; y += 1) {
                for (let x = tile.x; x < tile.x + tile.w; x += 1) {
                    if (y >= 0 && y < rows && x >= 0 && x < cols) {
                        occupied[y][x] = true;
                    }
                }
            }
        }

        const remaining = [];
        for (let y = 0; y < rows; y += 1) {
            for (let x = 0; x < cols; x += 1) {
                if (!occupied[y][x]) remaining.push({ x, y });
            }
        }

        if (!remaining.length) return [];

        const defaultToneFor = (x, y) => {
            const value = Math.abs(Math.sin((x + 1) * 17.23 + (y + 1) * 53.91));
            if (value < 0.68) return 'accent-white';
            if (value < 0.85) return 'accent-red';
            return 'accent-black';
        };

        return remaining.map((cell, index) => {
            const cellKey = `${cell.x}:${cell.y}`;
            const tone = fillerToneMap[cellKey] || defaultToneFor(cell.x, cell.y);
            return {
                id: `filler-${cell.x}-${cell.y}-${index}`,
                cellKey,
                kind: tone,
                x: cell.x,
                y: cell.y,
                w: 1,
                h: 1,
            };
        });
    }, [tiles, cols, rows, fillerToneMap]);

    useEffect(() => {
        if (!interaction || cellWidth <= 0 || cellHeight <= 0) return undefined;

        const onPointerMove = (event) => {
            event.preventDefault();

            const deltaCols = Math.round((event.clientX - interaction.startX) / stepX);
            const deltaRows = Math.round((event.clientY - interaction.startY) / stepY);

            setTiles((previous) => {
                const index = previous.findIndex((item) => item.id === interaction.id);
                if (index === -1) return previous;

                const next = [...previous];
                const activeTile = next[index];

                let candidate;
                if (interaction.mode === 'move') {
                    candidate = {
                        ...activeTile,
                        x: clamp(interaction.origin.x + deltaCols, 0, cols - interaction.origin.w),
                        y: clamp(interaction.origin.y + deltaRows, 0, rows - interaction.origin.h),
                    };
                } else {
                    const minSpan = getTileMinSpan(interaction.id, cols, rows);
                    candidate = buildResizeCandidate(
                        interaction.origin,
                        interaction.corner,
                        deltaCols,
                        deltaRows,
                        cols,
                        rows,
                        minSpan,
                    );
                    candidate = clampImageTileWideRatio(interaction.id, candidate, cols);
                }

                const resolved = resolveLayoutAfterChange(
                    previous,
                    interaction.id,
                    candidate,
                    cols,
                    rows,
                );
                return layoutsEqual(previous, resolved) ? previous : resolved;
            });
        };

        const stopInteraction = () => {
            setTiles((previous) => sanitizeLayoutNoOverlap(previous, cols, rows));
            setInteraction(null);
        };

        window.addEventListener('pointermove', onPointerMove, { passive: false });
        window.addEventListener('pointerup', stopInteraction);
        window.addEventListener('pointercancel', stopInteraction);

        return () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', stopInteraction);
            window.removeEventListener('pointercancel', stopInteraction);
        };
    }, [interaction, stepX, stepY, cellWidth, cellHeight, cols, rows]);

    const beginMove = (event, tileId) => {
        if (event.button !== undefined && event.button !== 0) return;
        const tile = tilesRef.current.find((item) => item.id === tileId);
        if (!tile) return;
        event.preventDefault();
        setInteraction({
            mode: 'move',
            id: tileId,
            corner: null,
            startX: event.clientX,
            startY: event.clientY,
            origin: { ...tile },
        });
    };

    const beginResize = (event, tileId, corner) => {
        if (event.button !== undefined && event.button !== 0) return;
        const tile = tilesRef.current.find((item) => item.id === tileId);
        if (!tile) return;
        event.preventDefault();
        event.stopPropagation();
        setInteraction({
            mode: 'resize',
            id: tileId,
            corner,
            startX: event.clientX,
            startY: event.clientY,
            origin: { ...tile },
        });
    };

    const renderMediaItem = (item, sizeClass = 'size-lg') => {
        const isTiny = sizeClass === 'size-xs';
        const isSmall = sizeClass === 'size-sm';

        return (
            <a
                href={item.href}
                className={`media-atom ${isTiny ? 'compact-xs' : ''} ${isSmall ? 'compact-sm' : ''}`}
                onPointerDown={(event) => event.stopPropagation()}
            >
                <MediaThumb image={item.image} title={item.title} />
                {!isTiny && (
                    <div className="media-copy">
                        <h4>{item.title}</h4>
                        {!isSmall && <p>{item.summary}</p>}
                    </div>
                )}
            </a>
        );
    };

    const renderPhotoItem = (item, sizeClass = 'size-lg', tone = 'dark') => (
        <a
            href={item.href}
            className={`photo-cover-card ${sizeClass} tone-${tone}`}
            onPointerDown={(event) => event.stopPropagation()}
        >
            {item.image ? (
                <img src={item.image} alt={item.title || 'Photo Story'} loading="lazy" />
            ) : (
                <div className="photo-fallback">NO IMAGE</div>
            )}
            <div className="photo-caption">
                <h4>{item.title}</h4>
            </div>
        </a>
    );

    const renderCoverCard = (item, sizeClass = 'size-lg', tone = 'dark', textOnly = false) => (
        <a
            href={item.href}
            className={`photo-cover-card ${sizeClass} tone-${tone} ${textOnly ? 'text-only' : ''}`}
            onPointerDown={(event) => event.stopPropagation()}
        >
            {textOnly ? (
                <div className="cover-text-only-copy">
                    <h4>{item.title}</h4>
                    {sizeClass !== 'size-xs' && item.summary ? <p>{item.summary}</p> : null}
                </div>
            ) : (
                <>
                    {item.image ? (
                        <img src={item.image} alt={item.title || 'Cover'} loading="lazy" />
                    ) : (
                        <div className="photo-fallback">NO IMAGE</div>
                    )}
                    <div className="photo-caption">
                        <h4>{item.title}</h4>
                    </div>
                </>
            )}
        </a>
    );

    const getMixedTone = (position, salt = 0) => {
        const hash = Math.abs(
            Math.sin((position + 1) * 12.9898 + (salt + 1) * 78.233),
        );
        const value = hash % 1;
        if (value < 0.84) return 'dark';
        if (value < 0.93) return 'light';
        return 'red';
    };

    const renderTileBody = (tile, index, sizeClass) => {
        switch (tile.id) {
            case 'bio':
                return (
                    <div className="bio-tile">
                        <div className="bio-top">
                            <h2>{sizeClass === 'size-xs' ? 'Abodid' : 'Abodid Sahoo'}</h2>
                            {sizeClass !== 'size-xs' && (
                                <p>Creative technologist and researcher.</p>
                            )}
                            {sizeClass !== 'size-xs' && <small>London · Bombay · Bhubaneswar</small>}
                        </div>
                        <div className="bio-bottom">
                            <p>
                                {sizeClass === 'size-xs'
                                    ? '8+ years.'
                                    : 'With over 8+ years of experience in photography, film and interactive media, I design authentic creative experiences for brands and organizations working in the culture and technology space.'}
                            </p>
                        </div>
                    </div>
                );

            case 'showreel':
                return (
                    <button
                        type="button"
                        className="showreel-card"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            openShowreel();
                        }}
                    >
                        <div className="showreel-video direct">
                            <video
                                src={showreelVideoUrl}
                                autoPlay
                                muted
                                loop
                                playsInline
                                preload="metadata"
                            />
                        </div>
                        <div className="showreel-overlay">
                            <span className="live-pill">PLAY</span>
                            {sizeClass !== 'size-xs' && <h3>Showreel 2025</h3>}
                            {sizeClass === 'size-lg' || sizeClass === 'size-xl' ? (
                                <p>Director / Editor / Cinematographer / Sound Designer...</p>
                            ) : null}
                            <span className="showreel-open-hint">Click to open player</span>
                        </div>
                    </button>
                );

            case 'films':
                return (
                    <TileRotator
                        items={normalizedFilms}
                        interval={11800}
                        startDelay={1200 + index * 160}
                        renderItem={(item, itemIndex) =>
                            renderCoverCard(
                                {
                                    ...item,
                                    summary: item.year ? `${item.year} · ${item.summary}` : item.summary,
                                },
                                sizeClass,
                                getMixedTone(itemIndex, index),
                                tile.h <= 1,
                            )
                        }
                    />
                );

            case 'photos':
                return (
                    <TileRotator
                        items={normalizedPhotos}
                        interval={12400}
                        startDelay={1500 + index * 140}
                        renderItem={(item, itemIndex) =>
                            renderPhotoItem(item, sizeClass, getMixedTone(itemIndex, index))
                        }
                    />
                );

            case 'notes':
                {
                    const visibleCount = tile.h >= 3 ? 3 : tile.h >= 2 ? 2 : 1;
                    const interval = 13000;
                    return (
                        <NotesTicker
                            notes={normalizedNotes}
                            visibleCount={visibleCount}
                            interval={interval}
                        />
                    );
                }

            case 'resources':
                return (
                    <TileRotator
                        items={normalizedResources}
                        interval={11600}
                        startDelay={2200 + index * 120}
                        renderItem={(item, itemIndex) =>
                            renderCoverCard(item, sizeClass, getMixedTone(itemIndex, index), tile.h <= 1)
                        }
                    />
                );

            case 'research':
                return (
                    <TileRotator
                        items={normalizedResearch}
                        interval={11200}
                        startDelay={2500 + index * 120}
                        renderItem={(item, itemIndex) =>
                            renderCoverCard(item, sizeClass, getMixedTone(itemIndex, index), tile.h <= 1)
                        }
                    />
                );

            case 'fundraising':
                return (
                    <TileRotator
                        items={normalizedFundraising}
                        interval={11900}
                        startDelay={2100 + index * 120}
                        renderItem={(item, itemIndex) =>
                            renderCoverCard(item, sizeClass, getMixedTone(itemIndex, index), tile.h <= 1)
                        }
                    />
                );

            case 'current':
                return (
                    <TileRotator
                        items={normalizedCurrent}
                        interval={13200}
                        startDelay={3000}
                        renderItem={(item, itemIndex) =>
                            renderCoverCard(item, sizeClass, getMixedTone(itemIndex, index), tile.h <= 1)
                        }
                    />
                );

            case 'tags':
                return (
                    <div className="tags-block">
                        <TagsNodeGrid
                            tags={normalizedTags}
                            density={sizeClass === 'size-xs' ? 'compact' : 'regular'}
                        />
                    </div>
                );

            case 'newsletter':
                return (
                    <div className="newsletter-box">
                        <p>
                            Weekly creative resources and field notes, sent with care.
                        </p>
                        <form
                            className="newsletter-form"
                            action="/api/subscribe"
                            method="POST"
                            onPointerDown={(event) => event.stopPropagation()}
                        >
                            <input
                                type="email"
                                name="email"
                                placeholder="Email Address"
                                aria-label="Email address"
                                required
                            />
                            <button type="submit" aria-label="Subscribe">
                                Subscribe
                            </button>
                        </form>
                    </div>
                );

            case 'site':
                return (
                    <div className="site-box">
                        <a href="/sitemap" onPointerDown={(event) => event.stopPropagation()}>
                            Sitemap
                        </a>
                        <a href="/licensing" onPointerDown={(event) => event.stopPropagation()}>
                            Licensing
                        </a>
                        <a href="/about" onPointerDown={(event) => event.stopPropagation()}>
                            About
                        </a>
                    </div>
                );

            case 'social':
                return (
                    <div className="social-box">
                        <a
                            href="https://www.instagram.com/abodid.sahoo"
                            target="_blank"
                            rel="noopener noreferrer"
                            onPointerDown={(event) => event.stopPropagation()}
                        >
                            Instagram
                        </a>
                        <a
                            href="https://uk.linkedin.com/in/abodidsahoo"
                            target="_blank"
                            rel="noopener noreferrer"
                            onPointerDown={(event) => event.stopPropagation()}
                        >
                            LinkedIn
                        </a>
                        <a
                            href="https://github.com/abodidsahoo"
                            target="_blank"
                            rel="noopener noreferrer"
                            onPointerDown={(event) => event.stopPropagation()}
                        >
                            GitHub
                        </a>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <section className="landing-grid-prototype">
            <div className="board-shell" ref={shellRef}>
                {cellWidth > 0 && cellHeight > 0 && (
                    <div className={`board-surface ${interaction ? 'is-active' : ''}`}>
                        {tiles.map((tile, index) => {
                            const meta = TILE_META[tile.id] || {
                                tag: tile.id.toUpperCase(),
                                cta: '',
                                href: '',
                            };
                            const sizeClass = getTileSizeClass(tile);
                            const isActive = interaction?.id === tile.id;
                            const left = tile.x * stepX;
                            const top = tile.y * stepY;
                            const width = tile.w * cellWidth + (tile.w - 1) * GAP_PX;
                            const height = tile.h * cellHeight + (tile.h - 1) * GAP_PX;

                            return (
                                <article
                                    key={tile.id}
                                    className={`landing-tile tile-${tile.id} ${sizeClass} ${isActive ? 'active' : ''}`}
                                    style={{
                                        left: `${left}px`,
                                        top: `${top}px`,
                                        width: `${width}px`,
                                        height: `${height}px`,
                                    }}
                                >
                                    <header
                                        className="tile-grip"
                                        onPointerDown={(event) => beginMove(event, tile.id)}
                                    >
                                        <span className="tile-tag">{meta.tag}</span>
                                        {meta.cta && meta.href ? (
                                            <a
                                                href={meta.href}
                                                className="tile-cta"
                                                onPointerDown={(event) => event.stopPropagation()}
                                            >
                                                {meta.cta}
                                                <span aria-hidden="true">↗</span>
                                            </a>
                                        ) : (
                                            <span className="tile-cta ghost">...</span>
                                        )}
                                    </header>

                                    <div className="tile-content">{renderTileBody(tile, index, sizeClass)}</div>

                                    {Object.entries(HANDLE_CONFIG).map(([corner, config]) => (
                                        <button
                                            key={corner}
                                            type="button"
                                            className={`resize-handle ${corner}`}
                                            style={{ cursor: config.cursor }}
                                            onPointerDown={(event) => beginResize(event, tile.id, corner)}
                                            aria-label={`Resize ${tile.id} from ${config.label}`}
                                        >
                                            <span className="resize-glyph" aria-hidden="true">
                                                {config.icon}
                                            </span>
                                        </button>
                                    ))}
                                </article>
                            );
                        })}

                        {gapFillers.map((filler) => {
                            const left = filler.x * stepX;
                            const top = filler.y * stepY;
                            const width = filler.w * cellWidth + (filler.w - 1) * GAP_PX;
                            const height = filler.h * cellHeight + (filler.h - 1) * GAP_PX;

                            return (
                                <div
                                    key={filler.id}
                                    className={`gap-filler ${filler.kind} is-interactive`}
                                    style={{
                                        left: `${left}px`,
                                        top: `${top}px`,
                                        width: `${width}px`,
                                        height: `${height}px`,
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    aria-label="Toggle filler color"
                                    onClick={() => cycleFillerTone(filler.cellKey)}
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            cycleFillerTone(filler.cellKey);
                                        }
                                    }}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
            <footer className="status-strip">
                <span className="status-left">Designed & Developed by Abodid Sahoo</span>
                <span className="status-center">Copyright © 2026 Abodid Sahoo</span>
                <span className="status-right">
                    <button
                        type="button"
                        className="shuffle-btn"
                        onClick={shuffleGrid}
                        onPointerDown={(event) => event.stopPropagation()}
                    >
                        Shuffle Grid
                    </button>
                    <span>All Rights Reserved</span>
                </span>
            </footer>

            <AnimatePresence>
                {isShowreelOpen && (
                    <motion.div
                        className="showreel-modal-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                        onClick={closeShowreel}
                    >
                        <motion.div
                            className="showreel-modal-panel"
                            initial={{ opacity: 0, y: 18, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 16, scale: 0.98 }}
                            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                            onClick={(event) => event.stopPropagation()}
                        >
                            <button
                                type="button"
                                className="showreel-modal-close"
                                onClick={closeShowreel}
                                aria-label="Close showreel player"
                            >
                                ×
                            </button>
                            <video
                                src={showreelVideoUrl}
                                controls
                                autoPlay
                                playsInline
                                preload="metadata"
                                className="showreel-modal-video"
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                .landing-grid-prototype {
                    position: relative;
                    width: 100vw;
                    height: 100dvh;
                    overflow: hidden;
                    padding: 0;
                    background: #020202;
                    color: #f5f5f5;
                    font-family: "Space Mono", monospace;
                    -webkit-font-smoothing: antialiased;
                }

                .landing-grid-prototype,
                .landing-grid-prototype * {
                    box-sizing: border-box;
                }

                .landing-grid-prototype::before {
                    content: "";
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                    background-image:
                        linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(255, 255, 255, 0.028) 1px, transparent 1px);
                    background-size: 48px 48px;
                    opacity: 0.6;
                    mask-image: radial-gradient(circle at center, black 55%, transparent 100%);
                }

                .board-shell {
                    position: absolute;
                    inset: 10px 10px 22px 10px;
                    padding: 0;
                }

                .board-surface {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    border: 0;
                    border-radius: 0;
                    background: transparent;
                    box-shadow: none;
                    overflow: hidden;
                }

                .board-surface.is-active {
                    cursor: grabbing;
                }

                .landing-tile {
                    position: absolute;
                    border: 1px solid rgba(255, 255, 255, 0.82);
                    border-radius: 0;
                    background: #090909;
                    z-index: 2;
                    display: flex;
                    flex-direction: column;
                    min-width: 0;
                    min-height: 0;
                    overflow: hidden;
                    transition:
                        left 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
                        top 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
                        width 190ms cubic-bezier(0.2, 0.8, 0.2, 1),
                        height 190ms cubic-bezier(0.2, 0.8, 0.2, 1),
                        border-color 160ms ease,
                        box-shadow 160ms ease;
                    will-change: left, top, width, height;
                }

                .landing-tile.active {
                    border-color: #fff;
                    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16);
                    z-index: 30;
                    transition:
                        border-color 120ms ease,
                        box-shadow 120ms ease;
                }

                .landing-tile:hover:not(.active) {
                    border-color: #fff;
                    box-shadow:
                        inset 0 0 0 1px rgba(255, 255, 255, 0.12),
                        0 0 16px rgba(255, 255, 255, 0.2);
                }

                .tile-grip {
                    flex: 0 0 auto;
                    height: 26px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.18);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                    padding: 0 8px;
                    background: rgba(255, 255, 255, 0.04);
                    cursor: grab;
                    user-select: none;
                    text-transform: uppercase;
                }

                .tile-grip:active {
                    cursor: grabbing;
                }

                .tile-tag {
                    font-size: 12px;
                    letter-spacing: 0.12em;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    color: rgba(255, 255, 255, 0.88);
                }

                .tile-cta {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 9px;
                    letter-spacing: 0.12em;
                    color: rgba(255, 255, 255, 0.86);
                    text-decoration: none;
                    transition: opacity 140ms ease;
                }

                .tile-cta:hover {
                    opacity: 0.72;
                }

                .tile-cta.ghost {
                    opacity: 0.35;
                }

                .tile-content {
                    position: relative;
                    flex: 1 1 auto;
                    min-height: 0;
                    min-width: 0;
                    padding: 8px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }

                .tile-photos .tile-content,
                .tile-films .tile-content,
                .tile-resources .tile-content,
                .tile-research .tile-content,
                .tile-current .tile-content,
                .tile-fundraising .tile-content {
                    padding: 0;
                }

                .gap-filler {
                    position: absolute;
                    z-index: 1;
                    pointer-events: none;
                    border: 1px solid rgba(255, 255, 255, 0.66);
                    border-radius: 0;
                    overflow: hidden;
                    transition: background 180ms ease;
                }

                .gap-filler.accent-white {
                    background: #f5f5f5;
                    border-color: rgba(255, 255, 255, 0.9);
                }

                .gap-filler.accent-red {
                    background: #d31818;
                    border-color: rgba(255, 255, 255, 0.66);
                }

                .gap-filler.accent-black {
                    background: #050505;
                    border-color: rgba(255, 255, 255, 0.66);
                }

                .gap-filler.is-interactive {
                    pointer-events: auto;
                    cursor: pointer;
                }

                .gap-filler.is-interactive:hover {
                    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35);
                }

                .gap-filler.gap-tags {
                    background: rgba(6, 6, 6, 0.72);
                    padding: 4px;
                }

                .tag-pill-cloud {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    flex-wrap: wrap;
                    align-content: flex-start;
                    gap: 3px;
                    overflow: hidden;
                }

                .tag-pill {
                    border: 1px solid rgba(255, 255, 255, 0.35);
                    border-radius: 0;
                    font-size: 6.5px;
                    line-height: 1;
                    padding: 0 6px;
                    color: rgba(255, 255, 255, 0.86);
                    white-space: nowrap;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    background: rgba(255, 255, 255, 0.03);
                }

                .gap-filler.gap-image {
                    background: #000;
                    border-color: rgba(255, 255, 255, 0.22);
                }

                .gap-filler.gap-image img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                }

                .gap-image-fallback {
                    width: 100%;
                    height: 100%;
                    display: grid;
                    place-items: center;
                    font-size: 8px;
                    letter-spacing: 0.08em;
                    color: rgba(255, 255, 255, 0.7);
                    background: linear-gradient(145deg, #111, #222);
                }

                .gap-image-title {
                    position: absolute;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    min-height: 24%;
                    background: rgba(255, 255, 255, 0.94);
                    color: #080808;
                    display: flex;
                    align-items: center;
                    padding: 3px 5px;
                    font-size: 8px;
                    font-family: "Inconsolata", monospace;
                    text-transform: uppercase;
                    line-height: 1.1;
                }

                .status-strip {
                    position: absolute;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 45;
                    height: 22px;
                    border-top: 1px solid rgba(255, 255, 255, 0.25);
                    background: rgba(179, 13, 13, 0.96);
                    color: #fff;
                    display: grid;
                    grid-template-columns: 1fr auto 1fr;
                    align-items: center;
                    gap: 8px;
                    padding: 0 10px;
                    font-size: 9px;
                    line-height: 1;
                    letter-spacing: 0.05em;
                    text-transform: uppercase;
                }

                .status-left {
                    justify-self: start;
                    min-width: 0;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .status-center {
                    justify-self: center;
                    white-space: nowrap;
                }

                .status-right {
                    justify-self: end;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    white-space: nowrap;
                }

                .shuffle-btn {
                    border: 1px solid rgba(255, 255, 255, 0.7);
                    background: transparent;
                    color: #fff;
                    font-family: "Space Mono", monospace;
                    font-size: 8px;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    line-height: 1;
                    padding: 2px 6px;
                    border-radius: 1px;
                    cursor: pointer;
                }

                .shuffle-btn:hover {
                    background: rgba(255, 255, 255, 0.14);
                }

                .showreel-modal-backdrop {
                    position: absolute;
                    inset: 0;
                    z-index: 120;
                    background: rgba(0, 0, 0, 0.92);
                    display: grid;
                    place-items: center;
                    padding: clamp(14px, 3vw, 32px);
                }

                .showreel-modal-panel {
                    position: relative;
                    width: min(1020px, 94vw);
                    max-height: 90dvh;
                    border-radius: 10px;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    background: rgba(5, 5, 5, 0.96);
                    padding: 12px;
                    box-shadow: 0 22px 64px rgba(0, 0, 0, 0.6);
                }

                .showreel-modal-video {
                    width: 100%;
                    max-height: calc(90dvh - 56px);
                    border-radius: 8px;
                    background: #000;
                    display: block;
                    outline: none;
                }

                .showreel-modal-close {
                    position: absolute;
                    top: 4px;
                    right: 6px;
                    width: 30px;
                    height: 30px;
                    border: 0;
                    border-radius: 999px;
                    background: rgba(255, 255, 255, 0.14);
                    color: #fff;
                    font-size: 20px;
                    line-height: 1;
                    cursor: pointer;
                }

                .showreel-modal-close:hover {
                    background: rgba(255, 255, 255, 0.22);
                }

                .rotator-shell {
                    position: relative;
                    width: 100%;
                    height: 100%;
                }

                .rotator-frame {
                    width: 100%;
                    height: 100%;
                }

                .notes-ticker-shell {
                    width: 100%;
                    height: 100%;
                    overflow: hidden;
                }

                .notes-stack {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .note-line {
                    flex: 1 1 0;
                    min-height: 0;
                    border: 1px solid rgba(255, 255, 255, 0.24);
                    border-radius: 1px;
                    padding: 6px;
                    display: grid;
                    grid-template-columns: 28px minmax(0, 1fr);
                    align-items: center;
                    gap: 6px;
                    text-decoration: none;
                    color: inherit;
                    background: rgba(255, 255, 255, 0.02);
                }

                .note-index {
                    font-size: 9px;
                    color: rgba(255, 255, 255, 0.6);
                    letter-spacing: 0.08em;
                }

                .note-title {
                    font-size: clamp(10px, 1vw, 13px);
                    line-height: 1.2;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .media-atom,
                .list-card,
                .current-card {
                    width: 100%;
                    height: 100%;
                    display: grid;
                    grid-template-columns: minmax(52px, 40%) 1fr;
                    gap: 8px;
                    color: inherit;
                    text-decoration: none;
                    min-height: 0;
                }

                .list-card {
                    grid-template-columns: minmax(48px, 42%) 1fr;
                }

                .showreel-card {
                    width: 100%;
                    height: 100%;
                    display: block;
                    position: relative;
                    border: 0;
                    padding: 0;
                    background: transparent;
                    color: inherit;
                    text-decoration: none;
                    text-align: left;
                    cursor: pointer;
                }

                .showreel-card:focus-visible {
                    outline: 1px solid rgba(255, 255, 255, 0.78);
                    outline-offset: -2px;
                }

                .showreel-card .media-thumb {
                    width: 100%;
                    height: 100%;
                }

                .photo-cover-card {
                    width: 100%;
                    height: 100%;
                    position: relative;
                    display: block;
                    text-decoration: none;
                    color: inherit;
                    overflow: hidden;
                    border-radius: 1px;
                }

                .photo-cover-card img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                }

                .photo-cover-card.text-only {
                    display: flex;
                    align-items: center;
                    justify-content: flex-start;
                    background: #090909;
                }

                .cover-text-only-copy {
                    width: 100%;
                    min-height: 0;
                    padding: 8px 10px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: flex-start;
                    gap: 3px;
                }

                .cover-text-only-copy h4 {
                    margin: 0;
                    font-family: "Inconsolata", monospace;
                    font-size: clamp(10px, 1vw, 13px);
                    font-weight: 600;
                    line-height: 1.15;
                    text-transform: none;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 100%;
                }

                .cover-text-only-copy p {
                    margin: 0;
                    font-size: clamp(7px, 0.65vw, 9px);
                    font-weight: 300;
                    line-height: 1.25;
                    color: rgba(255, 255, 255, 0.8);
                    text-transform: none;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .photo-fallback {
                    width: 100%;
                    height: 100%;
                    display: grid;
                    place-items: center;
                    font-size: 10px;
                    letter-spacing: 0.1em;
                    color: rgba(255, 255, 255, 0.7);
                    background: linear-gradient(145deg, #101010, #1b1b1b);
                }

                .photo-caption {
                    position: absolute;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    min-height: 20%;
                    max-height: 26%;
                    background: rgba(0, 0, 0, 0.92);
                    color: #f8f8f8;
                    padding: 7px 8px;
                    border-top: 1px solid rgba(255, 255, 255, 0.24);
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    gap: 2px;
                }

                .photo-caption h4 {
                    margin: 0;
                    font-family: "Inconsolata", monospace;
                    font-size: clamp(10px, 1vw, 13px);
                    font-weight: 600;
                    line-height: 1.1;
                    text-transform: none;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .photo-caption p {
                    margin: 0;
                    font-size: clamp(6.5px, 0.66vw, 8.5px);
                    font-weight: 300;
                    line-height: 1.2;
                    color: rgba(255, 255, 255, 0.82);
                    text-transform: none;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .photo-cover-card.tone-light .photo-caption {
                    background: rgba(248, 248, 248, 0.95);
                    color: #090909;
                    border-top: 1px solid rgba(0, 0, 0, 0.2);
                }

                .photo-cover-card.tone-light .photo-caption p {
                    color: rgba(0, 0, 0, 0.72);
                }

                .photo-cover-card.text-only.tone-light {
                    background: rgba(248, 248, 248, 0.95);
                    color: #090909;
                }

                .photo-cover-card.text-only.tone-light .cover-text-only-copy p {
                    color: rgba(0, 0, 0, 0.7);
                }

                .photo-cover-card.tone-dark .photo-caption {
                    background: rgba(0, 0, 0, 0.95);
                    color: #fff;
                    border-top: 1px solid rgba(255, 255, 255, 0.26);
                }

                .photo-cover-card.tone-dark .photo-caption p {
                    color: rgba(255, 255, 255, 0.84);
                }

                .photo-cover-card.tone-red .photo-caption {
                    background: rgba(182, 20, 20, 0.94);
                    color: #fff;
                    border-top: 1px solid rgba(255, 255, 255, 0.26);
                }

                .photo-cover-card.tone-red .photo-caption p {
                    color: rgba(255, 255, 255, 0.84);
                }

                .photo-cover-card.text-only.tone-red {
                    background: rgba(182, 20, 20, 0.95);
                    color: #fff;
                }

                .showreel-video {
                    width: 100%;
                    height: 100%;
                    border: 1px solid rgba(255, 255, 255, 0.22);
                    border-radius: 1px;
                    overflow: hidden;
                    background: #000;
                }

                .showreel-video iframe,
                .showreel-video video {
                    width: 100%;
                    height: 100%;
                    border: 0;
                    display: block;
                    object-fit: cover;
                }

                .showreel-overlay {
                    position: absolute;
                    inset: 0;
                    padding: 10px;
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-end;
                    gap: 6px;
                    background:
                        linear-gradient(to top, rgba(0, 0, 0, 0.84), rgba(0, 0, 0, 0.28) 42%, rgba(0, 0, 0, 0));
                }

                .showreel-overlay h3 {
                    margin: 0;
                    font-size: clamp(14px, 1.5vw, 20px);
                    letter-spacing: 0.02em;
                    line-height: 1.2;
                }

                .showreel-overlay p {
                    margin: 0;
                    font-size: clamp(7px, 0.66vw, 9px);
                    font-weight: 300;
                    color: rgba(255, 255, 255, 0.8);
                    line-height: 1.35;
                    text-transform: none;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .showreel-open-hint {
                    align-self: flex-start;
                    font-size: 8px;
                    letter-spacing: 0.05em;
                    color: rgba(255, 255, 255, 0.78);
                    text-transform: none;
                }

                .live-pill {
                    align-self: flex-start;
                    font-size: 9px;
                    letter-spacing: 0.16em;
                    padding: 3px 6px;
                    border: 1px solid rgba(255, 255, 255, 0.72);
                    border-radius: 1px;
                    background: rgba(0, 0, 0, 0.4);
                }

                .media-thumb {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    border: 1px solid rgba(255, 255, 255, 0.22);
                    border-radius: 1px;
                    overflow: hidden;
                    background: linear-gradient(
                        140deg,
                        rgba(255, 255, 255, 0.11),
                        rgba(255, 255, 255, 0.02)
                    );
                    min-height: 0;
                }

                .media-thumb img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                }

                .media-thumb.fallback {
                    display: grid;
                    place-items: center;
                    background: linear-gradient(145deg, #6e1204, #180f0f 58%);
                }

                .media-thumb.fallback span {
                    font-size: 11px;
                    letter-spacing: 0.1em;
                    color: rgba(255, 255, 255, 0.92);
                }

                .media-copy,
                .list-copy,
                .current-copy {
                    min-width: 0;
                    min-height: 0;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    gap: 4px;
                }

                .media-copy h4,
                .list-copy h4,
                .current-copy h4 {
                    margin: 0;
                    font-size: clamp(10px, 1vw, 13px);
                    font-weight: 600;
                    line-height: 1.2;
                    letter-spacing: 0.01em;
                    text-transform: none;
                }

                .media-copy p,
                .list-copy p,
                .current-copy p {
                    margin: 0;
                    font-size: clamp(6.8px, 0.62vw, 8.8px);
                    font-weight: 300;
                    line-height: 1.34;
                    color: rgba(255, 255, 255, 0.72);
                    text-transform: none;
                    display: -webkit-box;
                    -webkit-line-clamp: 3;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .current-copy small {
                    color: rgba(255, 255, 255, 0.72);
                    font-size: 10px;
                    letter-spacing: 0.04em;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .bio-tile {
                    width: 100%;
                    height: 100%;
                    border: 1px solid rgba(255, 255, 255, 0.28);
                    border-radius: 1px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }

                .bio-top {
                    background: #d82a17;
                    padding: 8px;
                    color: #fff;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    gap: 3px;
                }

                .bio-top h2 {
                    margin: 0;
                    font-family: "Inconsolata", monospace;
                    font-size: clamp(18px, 1.95vw, 24px);
                    line-height: 1;
                    letter-spacing: 0.02em;
                    text-transform: uppercase;
                }

                .bio-top p {
                    margin: 0;
                    font-size: clamp(10px, 0.95vw, 12px);
                    font-weight: 400;
                    line-height: 1.2;
                    text-transform: none;
                }

                .bio-top small {
                    font-size: clamp(9px, 0.92vw, 12px);
                    letter-spacing: 0.08em;
                    opacity: 0.9;
                    text-transform: uppercase;
                }

                .bio-bottom {
                    background: #f6f6f6;
                    color: #121212;
                    padding: 8px;
                    display: flex;
                    align-items: flex-start;
                    flex: 1 1 auto;
                }

                .bio-bottom p {
                    margin: 0;
                    font-family: "Inconsolata", monospace;
                    font-size: clamp(10px, 0.95vw, 12px);
                    font-weight: 400;
                    line-height: 1.35;
                    text-transform: none;
                    display: -webkit-box;
                    -webkit-line-clamp: 4;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .tags-block {
                    width: 100%;
                    height: 100%;
                    border: 1px solid rgba(255, 255, 255, 0.24);
                    border-radius: 1px;
                    background: rgba(6, 6, 6, 0.74);
                    padding: 6px;
                    overflow: hidden;
                }

                .tags-node-grid {
                    width: 100%;
                    height: 100%;
                    display: grid;
                    grid-template-rows: minmax(0, 1fr) auto;
                    gap: 5px;
                }

                .tags-node-field {
                    width: 100%;
                    min-height: 0;
                    display: grid;
                    grid-template-columns: repeat(var(--tag-cols, 3), minmax(0, 1fr));
                    grid-template-rows: repeat(var(--tag-rows, 3), minmax(0, 1fr));
                    gap: var(--tag-gap, 6px);
                    overflow: hidden;
                    align-content: stretch;
                }

                .tag-node-link {
                    min-height: 0;
                    width: 100%;
                    height: 100%;
                    box-sizing: border-box;
                    padding: 2px 7px;
                    border: 1px solid rgba(255, 255, 255, 0.4);
                    border-radius: 1px;
                    font-family: "Inconsolata", monospace;
                    font-size: clamp(8px, 0.76vw, 11px);
                    font-weight: 500;
                    line-height: 1.05;
                    text-transform: none;
                    letter-spacing: 0.03em;
                    background: rgba(255, 255, 255, 0.06);
                    color: rgba(255, 255, 255, 0.92);
                    display: flex;
                    align-items: center;
                    justify-content: flex-start;
                    white-space: nowrap;
                    text-decoration: none;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .tag-node-link:hover {
                    background: rgba(255, 255, 255, 0.15);
                    border-color: rgba(255, 255, 255, 0.72);
                }

                .tags-shuffle-btn {
                    width: 100%;
                    height: 22px;
                    border: 1px solid rgba(255, 255, 255, 0.44);
                    border-radius: 1px;
                    background: rgba(0, 0, 0, 0.56);
                    color: rgba(255, 255, 255, 0.9);
                    font-family: "Inconsolata", monospace;
                    font-size: 9px;
                    letter-spacing: 0.05em;
                    text-transform: uppercase;
                    line-height: 1;
                    cursor: pointer;
                }

                .tags-shuffle-btn:hover {
                    background: rgba(255, 255, 255, 0.12);
                }

                .newsletter-box {
                    width: 100%;
                    height: 100%;
                    border: 1px solid rgba(255, 255, 255, 0.26);
                    border-radius: 1px;
                    padding: 4px;
                    display: grid;
                    grid-template-rows: auto auto;
                    align-content: start;
                    gap: 3px;
                    background: rgba(255, 255, 255, 0.02);
                    overflow: hidden;
                }

                .newsletter-box p {
                    margin: 0;
                    font-size: clamp(9px, 0.88vw, 12px);
                    font-weight: 400;
                    line-height: 1.28;
                    color: rgba(255, 255, 255, 0.82);
                    text-transform: none;
                }

                .newsletter-form {
                    display: grid;
                    grid-template-rows: auto auto;
                    gap: 4px;
                }

                .newsletter-form input {
                    width: 100%;
                    min-width: 0;
                    border: 1px solid rgba(255, 255, 255, 0.34);
                    border-radius: 1px;
                    padding: 7px 8px;
                    background: rgba(0, 0, 0, 0.5);
                    color: #fff;
                    font-family: "Space Mono", monospace;
                    font-size: clamp(10px, 0.9vw, 12px);
                    outline: none;
                }

                .newsletter-form input::placeholder {
                    color: rgba(255, 255, 255, 0.45);
                }

                .newsletter-form button {
                    width: 100%;
                    min-width: 0;
                    height: 30px;
                    border: 1px solid rgba(255, 255, 255, 0.68);
                    border-radius: 1px;
                    background: rgba(255, 255, 255, 0.1);
                    color: #fff;
                    font-size: clamp(10px, 0.86vw, 12px);
                    line-height: 1;
                    cursor: pointer;
                    transition: background 160ms ease;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    margin-top: 0;
                }

                .newsletter-form button:hover {
                    background: rgba(255, 255, 255, 0.2);
                }

                .newsletter-compact-cta {
                    width: 100%;
                    height: 100%;
                    display: grid;
                    place-items: center;
                    text-decoration: none;
                    color: rgba(255, 255, 255, 0.9);
                    border: 1px solid rgba(255, 255, 255, 0.34);
                    font-size: clamp(9px, 0.84vw, 11px);
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }

                .site-box,
                .social-box {
                    width: 100%;
                    height: 100%;
                    display: grid;
                    gap: 4px;
                    align-content: center;
                    padding: 6px;
                    border: 1px solid rgba(255, 255, 255, 0.24);
                    background: rgba(255, 255, 255, 0.04);
                    font-size: clamp(7px, 0.78vw, 10px);
                    text-transform: none;
                    letter-spacing: 0.03em;
                }

                .site-box a,
                .social-box a {
                    color: rgba(255, 255, 255, 0.76);
                    text-decoration: none;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .site-box a:hover,
                .social-box a:hover {
                    color: #ffffff;
                }

                .landing-tile.size-xs .tile-grip {
                    height: 20px;
                    padding: 0 4px;
                }

                .landing-tile.size-xs .tile-tag {
                    font-size: 10px;
                    letter-spacing: 0.08em;
                }

                .landing-tile.size-xs .tile-cta {
                    display: none;
                }

                .landing-tile.size-xs .tile-content {
                    padding: 4px;
                }

                .landing-tile.size-sm .tile-content {
                    padding: 5px;
                }

                .landing-tile.size-sm .newsletter-box {
                    padding: 4px;
                    gap: 4px;
                }

                .landing-tile.size-sm .newsletter-box p {
                    display: block;
                    font-size: clamp(8.5px, 0.84vw, 10px);
                }

                .landing-tile.size-sm .newsletter-form input {
                    padding: 6px 7px;
                    font-size: 10px;
                }

                .landing-tile.size-sm .newsletter-form button {
                    height: 26px;
                    font-size: 10px;
                }

                .landing-tile.size-xs.tile-photos .tile-content,
                .landing-tile.size-xs.tile-films .tile-content,
                .landing-tile.size-xs.tile-resources .tile-content,
                .landing-tile.size-xs.tile-research .tile-content,
                .landing-tile.size-xs.tile-current .tile-content,
                .landing-tile.size-xs.tile-fundraising .tile-content {
                    padding: 0;
                }

                .landing-tile.size-xs .media-copy,
                .landing-tile.size-xs .list-copy,
                .landing-tile.size-xs .current-copy {
                    display: none;
                }

                .landing-tile.size-sm .media-copy p,
                .landing-tile.size-sm .list-copy p,
                .landing-tile.size-sm .current-copy p,
                .landing-tile.size-sm .current-copy small {
                    display: none;
                }

                .landing-tile.size-xs .media-atom,
                .landing-tile.size-xs .list-card,
                .landing-tile.size-xs .current-card {
                    grid-template-columns: 1fr;
                }

                .landing-tile.size-sm .media-atom,
                .landing-tile.size-sm .list-card,
                .landing-tile.size-sm .current-card {
                    grid-template-columns: minmax(32px, 54%) 1fr;
                    gap: 5px;
                }

                .landing-tile.size-sm .photo-caption p,
                .landing-tile.size-xs .photo-caption p {
                    display: none;
                }

                .landing-tile.size-xs .photo-caption {
                    min-height: 35%;
                    padding: 4px 5px;
                }

                .landing-tile.size-xs .photo-caption h4 {
                    font-size: 9px;
                }

                .landing-tile.size-xs .tag-pill {
                    font-size: 7px;
                    padding: 1px 3px;
                }

                .landing-tile.size-xs .tag-node-link {
                    padding: 2px 5px;
                    font-size: 8px;
                }

                .landing-tile.size-xs .tags-shuffle-btn {
                    height: 18px;
                    font-size: 7px;
                    letter-spacing: 0.04em;
                }

                .landing-tile.size-xs .cover-text-only-copy {
                    padding: 5px 6px;
                    gap: 2px;
                }

                .landing-tile.size-xs .cover-text-only-copy h4 {
                    font-size: 9px;
                }

                .landing-tile.size-xs .cover-text-only-copy p {
                    display: none;
                }

                .landing-tile.size-xs .note-line {
                    grid-template-columns: 1fr;
                    padding: 4px;
                }

                .landing-tile.size-xs .note-index {
                    display: none;
                }

                .landing-tile.size-xs .note-line + .note-line,
                .landing-tile.size-sm .note-line:nth-child(n + 3) {
                    display: none;
                }

                .landing-tile.size-xs .showreel-overlay p,
                .landing-tile.size-sm .showreel-overlay p {
                    display: none;
                }

                .landing-tile.size-xs .showreel-overlay h3,
                .landing-tile.size-xs .live-pill {
                    font-size: 9px;
                }

                .landing-tile.size-xs .bio-tile {
                    display: flex;
                    flex-direction: column;
                }

                .landing-tile.size-xs .bio-top p,
                .landing-tile.size-xs .bio-top small {
                    display: none;
                }

                .landing-tile.size-xs .bio-bottom p {
                    -webkit-line-clamp: 2;
                    font-size: 9px;
                }

                .resize-handle {
                    position: absolute;
                    border: 0;
                    background: transparent;
                    color: rgba(255, 255, 255, 0.9);
                    font-size: 0;
                    padding: 0;
                    border-radius: 1px;
                    opacity: 0;
                    pointer-events: auto;
                    transition: opacity 140ms ease;
                    z-index: 35;
                }

                .resize-handle::before {
                    content: "";
                    position: absolute;
                    opacity: 0;
                    transition: opacity 140ms ease;
                }

                .resize-glyph {
                    position: absolute;
                    font-size: 11px;
                    line-height: 1;
                    color: rgba(255, 255, 255, 0.82);
                    opacity: 0;
                    transition:
                        opacity 140ms ease,
                        transform 140ms ease;
                }

                .landing-tile:hover .resize-handle,
                .landing-tile.active .resize-handle,
                .resize-handle:hover {
                    opacity: 1;
                }

                .landing-tile:hover .resize-handle::before,
                .landing-tile.active .resize-handle::before,
                .resize-handle:hover::before {
                    opacity: 1;
                }

                .landing-tile:hover .resize-glyph,
                .landing-tile.active .resize-glyph,
                .resize-handle:hover .resize-glyph {
                    opacity: 0.95;
                }

                .resize-handle.n,
                .resize-handle.s {
                    left: 8px;
                    right: 8px;
                    height: 10px;
                }

                .resize-handle.e,
                .resize-handle.w {
                    top: 8px;
                    bottom: 8px;
                    width: 10px;
                }

                .resize-handle.n {
                    top: -5px;
                }

                .resize-handle.s {
                    bottom: -5px;
                }

                .resize-handle.e {
                    right: -5px;
                }

                .resize-handle.w {
                    left: -5px;
                }

                .resize-handle.n::before,
                .resize-handle.s::before {
                    left: 0;
                    right: 0;
                    top: 50%;
                    border-top: 1px solid rgba(255, 255, 255, 0.72);
                    transform: translateY(-50%);
                }

                .resize-handle.e::before,
                .resize-handle.w::before {
                    top: 0;
                    bottom: 0;
                    left: 50%;
                    border-left: 1px solid rgba(255, 255, 255, 0.72);
                    transform: translateX(-50%);
                }

                .resize-handle.n .resize-glyph,
                .resize-handle.s .resize-glyph {
                    left: 50%;
                    top: 50%;
                    transform: translate(-50%, -50%);
                }

                .resize-handle.e .resize-glyph,
                .resize-handle.w .resize-glyph {
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                }

                @media (max-width: 920px) {
                    .tile-grip {
                        height: 24px;
                        padding: 0 6px;
                    }

                    .tile-content {
                        padding: 6px;
                    }

                    .tile-photos .tile-content,
                    .tile-films .tile-content,
                    .tile-resources .tile-content,
                    .tile-research .tile-content,
                    .tile-current .tile-content,
                    .tile-fundraising .tile-content {
                        padding: 0 !important;
                    }

                    .status-strip {
                        height: 20px;
                        font-size: 8px;
                        padding: 0 7px;
                        gap: 5px;
                    }

                }
            `}</style>
        </section>
    );
};

export default LandingGridPrototype;
