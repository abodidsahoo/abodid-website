import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import MoodboardPolaroidViewer from './MoodboardPolaroidViewer.jsx';
import {
    BOTTOM_PADDING,
    TOP_PADDING,
    computeFloatingLayout,
    createSeededRandom,
    getFloatingStageSize,
    hashString,
    resolveLaneCount,
} from '../lib/moodboardLayout.js';

const SHUFFLE_ACTIVE_LIMIT = 20;
const DEFAULT_INITIAL_VISIBLE_ROWS = 4;
const DEFAULT_SCROLL_BATCH_ROWS = 1;
const SCROLL_START_THRESHOLD = 8;
const STAGE_PREFETCH_VIEWPORT_RATIO = 0.82;
const MIN_STAGE_PREFETCH_DISTANCE = 280;
const FALLBACK_DOC_PREFETCH_DISTANCE = 220;
const SCROLL_LOAD_STEP_MIN_PX = 42;
const SCROLL_LOAD_STEP_VIEWPORT_RATIO = 0.055;
const SHUFFLE_VIEWPORT_MARGIN = 140;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function normalizeTags(rawTags) {
    if (!Array.isArray(rawTags)) return [];

    return rawTags
        .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
        .filter(Boolean);
}

function getInitialVisibleCount(totalCount, laneCount, initialRows) {
    if (totalCount <= 0) return 0;
    const safeLaneCount = Math.max(1, laneCount);
    const safeRows = Math.max(1, initialRows);
    const target = safeLaneCount * safeRows;
    if (target >= totalCount) return totalCount;
    return Math.max(safeLaneCount, Math.floor(target / safeLaneCount) * safeLaneCount);
}

function getNextVisibleCount(currentCount, totalCount, laneCount, batchRows) {
    if (totalCount <= 0) return 0;
    if (currentCount >= totalCount) return totalCount;
    const safeLaneCount = Math.max(1, laneCount);
    const safeBatchRows = Math.max(1, batchRows);
    const target = currentCount + safeLaneCount * safeBatchRows;
    if (target >= totalCount) return totalCount;
    return Math.max(safeLaneCount, Math.ceil(target / safeLaneCount) * safeLaneCount);
}

function shuffleValues(values) {
    const out = [...values];
    for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

function jitterSequence(items, windowSize = 8) {
    const result = [...items];
    for (let i = 0; i < result.length; i++) {
        if (result[i]?.type === 'text') continue;
        const maxIndex = Math.min(result.length - 1, i + windowSize);
        const eligibleIndices = [];
        for (let idx = i; idx <= maxIndex; idx++) {
            if (result[idx]?.type !== 'text') {
                eligibleIndices.push(idx);
            }
        }
        if (eligibleIndices.length > 0) {
            const rIndex = Math.floor(Math.random() * eligibleIndices.length);
            const j = eligibleIndices[rIndex];
            if (i !== j) {
                [result[i], result[j]] = [result[j], result[i]];
            }
        }
    }
    return result;
}

function pickRandomItemIds(items, limit) {
    if (!Array.isArray(items) || items.length === 0) return [];
    const cappedLimit = Math.max(2, Math.min(limit, items.length));
    const copy = shuffleValues(items);
    return copy.slice(0, cappedLimit).map((item) => item.id);
}

function pickViewportCandidateIds({ items, layoutMap, stageElement, pointer, limit }) {
    if (!Array.isArray(items) || !items.length) return [];
    const safeLimit = Math.max(2, Math.min(limit, items.length));
    if (!stageElement || !layoutMap || layoutMap.size === 0 || typeof window === 'undefined') {
        return pickRandomItemIds(items, safeLimit);
    }

    const stageRect = stageElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight || 900;
    const viewportWidth = window.innerWidth || 1400;
    const px = Number(pointer?.x) || viewportWidth * 0.5;
    const py = Number(pointer?.y) || viewportHeight * 0.5;

    const scored = [];

    for (const item of items) {
        const layout = layoutMap.get(item.id);
        if (!layout) continue;

        const top = stageRect.top + layout.top;
        const left = stageRect.left + layout.left;
        const width = layout.width;
        const height = layout.height;
        const right = left + width;
        const bottom = top + height;

        const intersectsViewport =
            right >= 0 &&
            left <= viewportWidth &&
            bottom >= 0 &&
            top <= viewportHeight;

        const cx = left + width * 0.5;
        const cy = top + height * 0.5;
        const distance = Math.hypot(cx - px, cy - py);

        scored.push({
            id: item.id,
            distance,
            visiblePriority: intersectsViewport ? 0 : 1,
        });
    }

    if (!scored.length) {
        return pickRandomItemIds(items, safeLimit);
    }

    scored.sort((a, b) => {
        if (a.visiblePriority !== b.visiblePriority) {
            return a.visiblePriority - b.visiblePriority;
        }
        return a.distance - b.distance;
    });

    return scored.slice(0, safeLimit).map((entry) => entry.id);
}

function pickViewportVisibleIds({ items, layoutMap, stageElement, pointer, margin = SHUFFLE_VIEWPORT_MARGIN }) {
    if (!Array.isArray(items) || !items.length) return [];
    if (!stageElement || !layoutMap || layoutMap.size === 0 || typeof window === 'undefined') {
        return [];
    }

    const stageRect = stageElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight || 900;
    const viewportWidth = window.innerWidth || 1400;
    const px = Number(pointer?.x) || viewportWidth * 0.5;
    const py = Number(pointer?.y) || viewportHeight * 0.5;
    const pad = Math.max(0, margin);
    const scored = [];

    for (const item of items) {
        const layout = layoutMap.get(item.id);
        if (!layout) continue;

        const top = stageRect.top + layout.top;
        const left = stageRect.left + layout.left;
        const width = layout.width;
        const height = layout.height;
        const right = left + width;
        const bottom = top + height;

        const intersectsViewport =
            right >= -pad &&
            left <= viewportWidth + pad &&
            bottom >= -pad &&
            top <= viewportHeight + pad;

        if (!intersectsViewport) continue;

        const cx = left + width * 0.5;
        const cy = top + height * 0.5;
        const distance = Math.hypot(cx - px, cy - py);

        scored.push({
            id: item.id,
            distance,
        });
    }

    if (!scored.length) return [];

    scored.sort((a, b) => a.distance - b.distance);
    return scored.map((entry) => entry.id);
}

function resolveShuffleTiming(count, prefersReducedMotion) {
    const safeCount = Math.max(1, count);
    const fadeDuration = prefersReducedMotion ? 0.12 : 0.28;
    const fadeStep = prefersReducedMotion ? 0 : clamp(1.05 / safeCount, 0.015, 0.045);
    const deployDuration = prefersReducedMotion ? 0.14 : 0.36;
    const deployStep = prefersReducedMotion ? 0 : clamp(0.8 / safeCount, 0.01, 0.03);
    const fadeTotal = fadeDuration + fadeStep * Math.max(0, safeCount - 1);
    const deployTotal = deployDuration + deployStep * Math.max(0, safeCount - 1);

    return {
        fadeDuration,
        fadeStep,
        deployDuration,
        deployStep,
        fadeTotal,
        deployTotal,
    };
}



export default function VisualMoodboard({
    items = [],
    enableGrain = true,
    enablePolaroidViewer = false,
    deepLinkParam = '',
    enableQuickShuffle = false,
    quickShuffleLimit = 18,
    enableInfiniteScroll = false,
    initialVisibleRows = DEFAULT_INITIAL_VISIBLE_ROWS,
    rowsPerScrollBatch = DEFAULT_SCROLL_BATCH_ROWS,
    sizeMultiplier = 1.0,
    spacingMultiplier = 1.0,
    minScale = 0.24,
    jitterWindow = 0,
    hideSearch = false,
    defaultSurfaceMode = 'light',
}) {
    const prefersReducedMotion = useReducedMotion();
    const stageRef = useRef(null);
    const layoutMapRef = useRef(new Map());
    const pointerRef = useRef({ x: 0, y: 0 });
    const userHasScrolledRef = useRef(false);
    const lastInfiniteLoadScrollYRef = useRef(-Infinity);
    const lastObservedScrollYRef = useRef(0);
    const shuffleTimersRef = useRef([]);
    const [query, setQuery] = useState('');
    const [activeTag, setActiveTag] = useState('');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [tagsOpen, setTagsOpen] = useState(false);
    const [surfaceMode, setSurfaceMode] = useState(defaultSurfaceMode);
    const [stageSize, setStageSize] = useState({ width: 1200, height: 900, viewportHeight: 900 });
    const [imageRatios, setImageRatios] = useState({});
    const [layoutSeed, setLayoutSeed] = useState(() => Math.floor(Math.random() * 1000000000));
    const [layoutOrder, setLayoutOrder] = useState([]);
    const [pendingSeed, setPendingSeed] = useState(null);
    const [pendingOrder, setPendingOrder] = useState(null);
    const [shufflePhase, setShufflePhase] = useState('idle');
    const [shuffleSequence, setShuffleSequence] = useState([]);
    const [stackFrameIndex, setStackFrameIndex] = useState(0);
    const [stackZFrames, setStackZFrames] = useState([]);
    const [shuffleCenter, setShuffleCenter] = useState(null);
    const [shuffleTiming, setShuffleTiming] = useState(() => resolveShuffleTiming(1, false));
    const [shuffleSafetyMs, setShuffleSafetyMs] = useState(2800);
    const [quickBatchIds, setQuickBatchIds] = useState([]);
    const [visibleCount, setVisibleCount] = useState(0);
    const deepLinkInitializedRef = useRef(false);
    const [viewerActiveId, setViewerActiveId] = useState(null);
    const quickModeEnabled = Boolean(enableQuickShuffle);
    const quickLimit = clamp(Math.round(Number(quickShuffleLimit) || 18), 15, 20);
    const infiniteScrollEnabled = Boolean(enableInfiniteScroll) && !quickModeEnabled;
    const normalizedInitialRows = clamp(
        Math.round(Number(initialVisibleRows) || DEFAULT_INITIAL_VISIBLE_ROWS),
        1,
        10,
    );
    const normalizedBatchRows = clamp(
        Math.round(Number(rowsPerScrollBatch) || DEFAULT_SCROLL_BATCH_ROWS),
        1,
        6,
    );

    useEffect(() => {
        return () => {
            shuffleTimersRef.current.forEach((timerId) => {
                clearTimeout(timerId);
                clearInterval(timerId);
            });
            shuffleTimersRef.current = [];
        };
    }, []);

    useEffect(() => {
        if (typeof document === 'undefined') return;
        document.body.dataset.moodboardSurface = surfaceMode;
    }, [surfaceMode]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        pointerRef.current = {
            x: window.innerWidth * 0.5,
            y: window.innerHeight * 0.5,
        };

        const updatePointer = (event) => {
            pointerRef.current = {
                x: event.clientX,
                y: event.clientY,
            };
        };

        window.addEventListener('mousemove', updatePointer, { passive: true });
        return () => window.removeEventListener('mousemove', updatePointer);
    }, []);

    useEffect(() => {
        return () => {
            if (typeof document === 'undefined') return;
            delete document.body.dataset.moodboardSurface;
        };
    }, []);

    const handleImageLoad = (itemId, event) => {
        const image = event.currentTarget;
        if (!image?.naturalWidth || !image?.naturalHeight) return;

        const ratio = image.naturalWidth / image.naturalHeight;
        setImageRatios((previous) => {
            if (Math.abs((previous[itemId] || 0) - ratio) < 0.001) {
                return previous;
            }
            return { ...previous, [itemId]: ratio };
        });
    };

    const jitteredItems = useMemo(() => {
        if (jitterWindow <= 0 || !Array.isArray(items) || !items.length) return items;
        return jitterSequence(items, jitterWindow);
    }, [items, jitterWindow]);

    const normalizedItems = useMemo(
        () =>
            (Array.isArray(jitteredItems) ? jitteredItems : [])
                .map((item, index) => {
                    const titleValue =
                        (typeof item.title === 'string' && item.title.trim()) ||
                        (typeof item.name === 'string' && item.name.trim()) ||
                        `Mood ${index + 1}`;

                    const imageUrl =
                        (typeof item.imageUrl === 'string' && item.imageUrl.trim()) ||
                        (typeof item.image_url === 'string' && item.image_url.trim()) ||
                        (typeof item.url === 'string' && item.url.trim()) ||
                        '';
                    const itemHref =
                        (typeof item.href === 'string' && item.href.trim()) ||
                        (typeof item.link === 'string' && item.link.trim()) ||
                        '';
                    const itemCaption =
                        (typeof item.caption === 'string' && item.caption.trim()) ||
                        (typeof item.description === 'string' && item.description.trim()) ||
                        '';
                    const itemProjectHref =
                        (typeof item.projectHref === 'string' && item.projectHref.trim()) ||
                        itemHref;

                    const normalizedTags = normalizeTags(item.tags);
                    const ratioFromMeta =
                        Number(item?.aspect_ratio) ||
                        Number(item?.aspectRatio) ||
                        ((Number(item?.image_width) > 0 && Number(item?.image_height) > 0)
                            ? Number(item.image_width) / Number(item.image_height)
                            : ((Number(item?.imageWidth) > 0 && Number(item?.imageHeight) > 0)
                                ? Number(item.imageWidth) / Number(item.imageHeight)
                                : 0));
                    const ratioFromProbe = imageRatios[
                        (typeof item.id === 'string' && item.id) ||
                        `${titleValue.toLowerCase().replace(/\s+/g, '-')}-${index}`
                    ];
                    const aspectRatio = ratioFromMeta > 0 ? ratioFromMeta : (ratioFromProbe || 1);

                    return {
                        id:
                            (typeof item.id === 'string' && item.id) ||
                            `${titleValue.toLowerCase().replace(/\s+/g, '-')}-${index}`,
                        title: titleValue,
                        imageUrl,
                        href: itemHref,
                        projectHref: itemProjectHref,
                        caption: itemCaption,
                        tags: normalizedTags,
                        aspectRatio,
                        searchText: `${titleValue} ${normalizedTags.join(' ')}`.toLowerCase(),
                        type: item.type || 'photo',
                        text: item.text || '',
                        customSpacingAfter: Number(item.customSpacingAfter) || 0,
                    };
                })
                .filter((item) => item.imageUrl || item.type === 'text'),
        [jitteredItems, imageRatios],
    );

    const tagCounts = useMemo(() => {
        const bucket = new Map();

        normalizedItems.forEach((item) => {
            item.tags.forEach((tag) => {
                const key = tag.toLowerCase();
                if (!key) return;
                bucket.set(key, (bucket.get(key) || 0) + 1);
            });
        });

        return Array.from(bucket.entries())
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .map(([tag, count]) => ({ tag, count }));
    }, [normalizedItems]);

    const normalizedQuery = query.trim().toLowerCase();

    const filteredItems = useMemo(() => {
        return normalizedItems.filter((item) => {
            if (activeTag && !item.tags.some((tag) => tag.toLowerCase() === activeTag)) {
                return false;
            }

            if (!normalizedQuery) return true;
            return item.searchText.includes(normalizedQuery);
        });
    }, [normalizedItems, activeTag, normalizedQuery]);

    const laneCount = useMemo(
        () => resolveLaneCount(stageSize.width || 1200, sizeMultiplier),
        [stageSize.width, sizeMultiplier],
    );

    useEffect(() => {
        if (!infiniteScrollEnabled) {
            setVisibleCount(0);
            userHasScrolledRef.current = false;
            lastInfiniteLoadScrollYRef.current = -Infinity;
            lastObservedScrollYRef.current = typeof window === 'undefined' ? 0 : (window.scrollY || 0);
            return;
        }

        const nextVisibleCount = getInitialVisibleCount(
            filteredItems.length,
            laneCount,
            normalizedInitialRows,
        );
        setVisibleCount(nextVisibleCount);
        userHasScrolledRef.current = false;
        lastInfiniteLoadScrollYRef.current = -Infinity;
        lastObservedScrollYRef.current = typeof window === 'undefined' ? 0 : (window.scrollY || 0);
    }, [
        infiniteScrollEnabled,
        filteredItems.length,
        laneCount,
        normalizedInitialRows,
        activeTag,
        normalizedQuery,
    ]);

    const hasMoreItems = infiniteScrollEnabled && visibleCount < filteredItems.length;

    useEffect(() => {
        if (!infiniteScrollEnabled || !hasMoreItems || typeof window === 'undefined') {
            return undefined;
        }

        lastObservedScrollYRef.current = window.scrollY || 0;

        const handleScroll = () => {
            const currentScrollY = window.scrollY || 0;
            const previousScrollY = lastObservedScrollYRef.current;
            lastObservedScrollYRef.current = currentScrollY;

            if (!userHasScrolledRef.current && currentScrollY > SCROLL_START_THRESHOLD) {
                userHasScrolledRef.current = true;
            }
            if (!userHasScrolledRef.current) return;
            if (currentScrollY <= previousScrollY) return;

            const viewportHeight = window.innerHeight || 0;
            let shouldLoadMore = false;
            const stageElement = stageRef.current;

            if (stageElement && viewportHeight > 0) {
                const stageRect = stageElement.getBoundingClientRect();
                const stageHasEnteredViewport = stageRect.top < viewportHeight + 32;
                if (stageHasEnteredViewport) {
                    const stagePrefetchDistance = Math.max(
                        MIN_STAGE_PREFETCH_DISTANCE,
                        viewportHeight * STAGE_PREFETCH_VIEWPORT_RATIO,
                    );
                    const distanceToStageBottom = stageRect.bottom - viewportHeight;
                    shouldLoadMore = distanceToStageBottom <= stagePrefetchDistance;
                }
            }

            if (!shouldLoadMore) {
                const docHeight = Math.max(
                    document.documentElement?.scrollHeight || 0,
                    document.body?.scrollHeight || 0,
                );
                const distanceToBottom = docHeight - (currentScrollY + viewportHeight);
                shouldLoadMore = distanceToBottom <= FALLBACK_DOC_PREFETCH_DISTANCE;
            }

            if (!shouldLoadMore) return;
            const scrollLoadStep = Math.max(
                SCROLL_LOAD_STEP_MIN_PX,
                Math.round(viewportHeight * SCROLL_LOAD_STEP_VIEWPORT_RATIO),
            );
            if (currentScrollY < lastInfiniteLoadScrollYRef.current + scrollLoadStep) return;

            lastInfiniteLoadScrollYRef.current = currentScrollY;
            setVisibleCount((current) =>
                getNextVisibleCount(
                    current,
                    filteredItems.length,
                    laneCount,
                    normalizedBatchRows,
                ),
            );
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [
        infiniteScrollEnabled,
        hasMoreItems,
        filteredItems.length,
        laneCount,
        normalizedBatchRows,
    ]);

    useEffect(() => {
        if (!quickModeEnabled) {
            setQuickBatchIds([]);
            return;
        }

        const nextIds = filteredItems.slice(0, quickLimit).map((item) => item.id);
        setQuickBatchIds((current) => {
            if (
                current.length === nextIds.length &&
                current.every((id, index) => id === nextIds[index])
            ) {
                return current;
            }
            return nextIds;
        });
    }, [quickModeEnabled, filteredItems, quickLimit]);

    const boardItems = useMemo(() => {
        if (!filteredItems.length) return [];

        if (quickModeEnabled) {
            const selectedIds = quickBatchIds.length
                ? quickBatchIds
                : filteredItems.slice(0, quickLimit).map((item) => item.id);
            if (!selectedIds.length) return [];

            const orderMap = new Map(selectedIds.map((id, index) => [id, index]));
            return filteredItems
                .filter((item) => orderMap.has(item.id))
                .sort((a, b) => (orderMap.get(a.id) || 0) - (orderMap.get(b.id) || 0));
        }

        if (infiniteScrollEnabled) {
            const guaranteedVisibleCount = getInitialVisibleCount(
                filteredItems.length,
                laneCount,
                normalizedInitialRows,
            );
            const cappedVisibleCount = clamp(
                visibleCount || guaranteedVisibleCount,
                0,
                filteredItems.length,
            );
            return filteredItems.slice(0, cappedVisibleCount);
        }

        return filteredItems;
    }, [
        filteredItems,
        quickModeEnabled,
        quickBatchIds,
        quickLimit,
        infiniteScrollEnabled,
        laneCount,
        normalizedInitialRows,
        visibleCount,
    ]);

    const deepLinkKey = deepLinkParam.trim();

    const syncDeepLink = (itemId) => {
        if (!enablePolaroidViewer || !deepLinkKey || typeof window === 'undefined') {
            return;
        }

        const nextUrl = new URL(window.location.href);
        if (itemId) {
            nextUrl.searchParams.set(deepLinkKey, itemId);
        } else {
            nextUrl.searchParams.delete(deepLinkKey);
        }
        window.history.replaceState(
            {},
            '',
            `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`,
        );
    };

    useEffect(() => {
        if (!enablePolaroidViewer || !deepLinkKey || typeof window === 'undefined') {
            return;
        }
        if (deepLinkInitializedRef.current) return;
        if (!normalizedItems.length) return;

        const requestedId = new URLSearchParams(window.location.search).get(
            deepLinkKey,
        );
        if (requestedId && normalizedItems.some((item) => item.id === requestedId)) {
            setViewerActiveId(requestedId);
        } else if (requestedId) {
            syncDeepLink('');
        }

        deepLinkInitializedRef.current = true;
    }, [enablePolaroidViewer, deepLinkKey, normalizedItems]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!viewerActiveId) return;
        if (boardItems.some((item) => item.id === viewerActiveId)) return;
        setViewerActiveId(null);
        syncDeepLink('');
    }, [boardItems, viewerActiveId]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleViewerOpen = (itemId) => {
        if (!itemId) return;
        setViewerActiveId(itemId);
        syncDeepLink(itemId);
    };

    const handleViewerClose = () => {
        setViewerActiveId(null);
        syncDeepLink('');
    };

    const handleViewerChange = (itemId) => {
        if (!itemId) return;
        setViewerActiveId(itemId);
        syncDeepLink(itemId);
    };

    const boardItemsKey = useMemo(
        () => boardItems.map((item) => item.id).join('|'),
        [boardItems],
    );

    const clearShuffleTimers = () => {
        shuffleTimersRef.current.forEach((timerId) => {
            clearTimeout(timerId);
            clearInterval(timerId);
        });
        shuffleTimersRef.current = [];
    };

    useEffect(() => {
        if (shufflePhase === 'idle') return;
        clearShuffleTimers();
        setPendingSeed(null);
        setPendingOrder(null);
        setShuffleSequence([]);
        setStackFrameIndex(0);
        setStackZFrames([]);
        setShuffleCenter(null);
        setShufflePhase('idle');
    }, [boardItemsKey]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (shufflePhase === 'idle') return undefined;

        const safetyTimer = window.setTimeout(() => {
            clearShuffleTimers();
            setPendingSeed(null);
            setPendingOrder(null);
            setShuffleSequence([]);
            setStackFrameIndex(0);
            setStackZFrames([]);
            setShuffleCenter(null);
            setShufflePhase('idle');
        }, shuffleSafetyMs);

        return () => clearTimeout(safetyTimer);
    }, [shufflePhase, shuffleSafetyMs]); // eslint-disable-line react-hooks/exhaustive-deps

    const shuffleOrderMap = useMemo(() => {
        const orderMap = new Map();
        shuffleSequence.forEach((id, index) => orderMap.set(id, index));
        return orderMap;
    }, [shuffleSequence]);

    const stackZOrderMap = useMemo(() => {
        const orderMap = new Map();
        if (!stackZFrames.length) return orderMap;

        const frame = stackZFrames[stackFrameIndex % stackZFrames.length] || [];
        frame.forEach((id, index) => orderMap.set(id, index));
        return orderMap;
    }, [stackZFrames, stackFrameIndex]);

    const layoutOrderMap = useMemo(() => {
        const orderMap = new Map();
        layoutOrder.forEach((id, index) => orderMap.set(id, index));
        return orderMap;
    }, [layoutOrder]);

    const pendingOrderMap = useMemo(() => {
        const orderMap = new Map();
        if (Array.isArray(pendingOrder)) {
            pendingOrder.forEach((id, index) => orderMap.set(id, index));
        }
        return orderMap;
    }, [pendingOrder]);

    const filteredIndexMap = useMemo(() => {
        const indexMap = new Map();
        boardItems.forEach((item, index) => indexMap.set(item.id, index));
        return indexMap;
    }, [boardItems]);

    const orderedItemsForLayout = useMemo(() => {
        if (!boardItems.length || layoutOrderMap.size === 0) return boardItems;

        const fallbackBase = layoutOrderMap.size + 2000;
        return [...boardItems].sort((a, b) => {
            const rankA = layoutOrderMap.has(a.id)
                ? layoutOrderMap.get(a.id)
                : fallbackBase + (filteredIndexMap.get(a.id) || 0);
            const rankB = layoutOrderMap.has(b.id)
                ? layoutOrderMap.get(b.id)
                : fallbackBase + (filteredIndexMap.get(b.id) || 0);
            return rankA - rankB;
        });
    }, [boardItems, layoutOrderMap, filteredIndexMap]);

    const pendingItemsForLayout = useMemo(() => {
        if (!boardItems.length || pendingOrderMap.size === 0) return orderedItemsForLayout;

        const fallbackBase = pendingOrderMap.size + 2000;
        return [...boardItems].sort((a, b) => {
            const rankA = pendingOrderMap.has(a.id)
                ? pendingOrderMap.get(a.id)
                : fallbackBase + (filteredIndexMap.get(a.id) || 0);
            const rankB = pendingOrderMap.has(b.id)
                ? pendingOrderMap.get(b.id)
                : fallbackBase + (filteredIndexMap.get(b.id) || 0);
            return rankA - rankB;
        });
    }, [boardItems, pendingOrderMap, filteredIndexMap, orderedItemsForLayout]);

    const handleShuffle = () => {
        if (shufflePhase !== 'idle' || boardItems.length < 2) return;

        const randomSeedBump = Math.floor(Math.random() * 1000000000);
        const nextSeed = (layoutSeed + randomSeedBump + 1) >>> 0;
        const visibleIds = pickViewportVisibleIds({
            items: boardItems,
            layoutMap: layoutMapRef.current,
            stageElement: stageRef.current,
            pointer: pointerRef.current,
        });
        const candidateIds = quickModeEnabled
            ? pickViewportCandidateIds({
                items: boardItems,
                layoutMap: layoutMapRef.current,
                stageElement: stageRef.current,
                pointer: pointerRef.current,
                limit: quickLimit,
            })
            : visibleIds.length >= 2
                ? visibleIds
                : pickViewportCandidateIds({
                    items: boardItems,
                    layoutMap: layoutMapRef.current,
                    stageElement: stageRef.current,
                    pointer: pointerRef.current,
                    limit: SHUFFLE_ACTIVE_LIMIT,
                });
        const ordered = shuffleValues(candidateIds);

        if (ordered.length < 2) return;

        if (stageRef.current && typeof window !== 'undefined') {
            const rect = stageRef.current.getBoundingClientRect();
            const viewportCenterX = window.innerWidth * 0.5;
            const viewportCenterY = window.innerHeight * 0.5;
            const relativeCenterX = viewportCenterX - rect.left;
            const relativeCenterY = viewportCenterY - rect.top;
            setShuffleCenter({
                x: clamp(relativeCenterX, EDGE_PADDING + 80, Math.max(EDGE_PADDING + 80, stageSize.width - EDGE_PADDING - 80)),
                y: clamp(relativeCenterY, TOP_PADDING + 90, Math.max(TOP_PADDING + 90, stageSize.height - BOTTOM_PADDING - 90)),
            });
        } else {
            setShuffleCenter({
                x: stageSize.width * 0.5,
                y: stageSize.height * 0.5,
            });
        }

        const stackFrames = [];
        let frameOrder = [...ordered];
        const frameCount = Math.max(36, Math.min(72, Math.ceil(ordered.length * 2.6)));
        let previousTop = frameOrder[frameOrder.length - 1];
        const topCycle = [...ordered];
        for (let i = topCycle.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [topCycle[i], topCycle[j]] = [topCycle[j], topCycle[i]];
        }
        let topCycleIndex = 0;

        for (let frame = 0; frame < frameCount; frame += 1) {
            const next = [...frameOrder];
            if (next.length > 1) {
                let nextTop = topCycle[topCycleIndex % topCycle.length];
                topCycleIndex += 1;
                if (nextTop === previousTop) {
                    nextTop = topCycle[topCycleIndex % topCycle.length];
                    topCycleIndex += 1;
                }
                if (nextTop === previousTop) {
                    const fallbackPool = next.filter((id) => id !== previousTop);
                    nextTop = fallbackPool[Math.floor(Math.random() * fallbackPool.length)] || nextTop;
                }

                const topIndex = next.indexOf(nextTop);
                if (topIndex > -1) {
                    next.splice(topIndex, 1);
                    next.push(nextTop);
                }
                previousTop = next[next.length - 1];
            }

            const bodySwapCount = Math.max(1, Math.min(4, Math.ceil(next.length / 8)));
            for (let swap = 0; swap < bodySwapCount; swap += 1) {
                const upperBound = Math.max(1, next.length - 1);
                const a = Math.floor(Math.random() * upperBound);
                let b = Math.floor(Math.random() * upperBound);
                if (upperBound > 1 && b === a) {
                    b = (b + 1) % upperBound;
                }
                [next[a], next[b]] = [next[b], next[a]];
            }

            stackFrames.push(next);
            frameOrder = next;
        }

        const timing = resolveShuffleTiming(ordered.length, prefersReducedMotion);
        const fadePadding = prefersReducedMotion ? 40 : 80;
        const collectDuration = prefersReducedMotion ? 120 : 240;
        const stackDuration = prefersReducedMotion ? 240 : 560;
        const deployPad = prefersReducedMotion ? 80 : 140;
        const fadeOutFinishAt = timing.fadeTotal + fadePadding;
        const collectStartAt = fadeOutFinishAt;
        const stackStartAt = collectStartAt + collectDuration;
        const deployStartAt = stackStartAt + stackDuration;
        const finishAt = deployStartAt + timing.deployTotal + deployPad;

        clearShuffleTimers();
        setPendingSeed(nextSeed);
        setPendingOrder(ordered);
        setShuffleSequence(ordered);
        setStackZFrames(stackFrames);
        setStackFrameIndex(0);
        setShuffleTiming(timing);
        setShuffleSafetyMs(Math.max(2800, finishAt + 320));
        setShufflePhase('fadeOut');

        let stackTicker = null;
        if (!prefersReducedMotion && stackFrames.length > 1) {
            stackTicker = window.setInterval(() => {
                setStackFrameIndex((value) => (value + 1) % stackFrames.length);
            }, 26);
            shuffleTimersRef.current.push(stackTicker);
        }

        const collectTimer = window.setTimeout(() => {
            setShufflePhase('stack');
        }, stackStartAt);

        const fadeTimer = window.setTimeout(() => {
            setShufflePhase('collect');
        }, collectStartAt);

        const deployTimer = window.setTimeout(() => {
            if (stackTicker !== null) {
                clearInterval(stackTicker);
            }
            setShufflePhase('deploy');
        }, deployStartAt);

        const finishTimer = window.setTimeout(() => {
            setLayoutSeed(nextSeed);
            setLayoutOrder(ordered);
            setPendingSeed(null);
            setPendingOrder(null);
            setShuffleSequence([]);
            setStackFrameIndex(0);
            setStackZFrames([]);
            setShuffleCenter(null);
            setShufflePhase('idle');
            clearShuffleTimers();
        }, finishAt);

        shuffleTimersRef.current.push(fadeTimer, collectTimer, deployTimer, finishTimer);
    };

    useEffect(() => {
        const stageElement = stageRef.current;
        if (!stageElement) return undefined;

        const updateSize = () => {
            const width = stageElement.clientWidth || window.innerWidth;
            const viewportHeight = window.innerHeight || 900;
            setStageSize(getFloatingStageSize({
                width,
                viewportHeight,
                itemCount: boardItems.length,
                sizeMultiplier,
                spacingMultiplier,
            }));
        };

        updateSize();

        const resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(stageElement);
        window.addEventListener('resize', updateSize, { passive: true });

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', updateSize);
        };
    }, [boardItems.length, sizeMultiplier, spacingMultiplier]);

    const layoutMap = useMemo(
        () => computeFloatingLayout(orderedItemsForLayout, stageSize.width, stageSize.height, layoutSeed, sizeMultiplier, spacingMultiplier, minScale),
        [orderedItemsForLayout, stageSize.width, stageSize.height, layoutSeed, sizeMultiplier, spacingMultiplier, minScale],
    );
    useEffect(() => {
        layoutMapRef.current = layoutMap;
    }, [layoutMap]);

    const pendingLayoutMap = useMemo(() => {
        if (pendingSeed === null) return layoutMap;
        return computeFloatingLayout(pendingItemsForLayout, stageSize.width, stageSize.height, pendingSeed, sizeMultiplier, spacingMultiplier, minScale);
    }, [pendingSeed, pendingItemsForLayout, stageSize.width, stageSize.height, layoutMap, sizeMultiplier, spacingMultiplier, minScale]);

    const stageContentBottom = useMemo(() => {
        let maxBottom = TOP_PADDING;

        boardItems.forEach((item) => {
            const idleLayout = layoutMap.get(item.id);
            if (idleLayout) {
                maxBottom = Math.max(maxBottom, idleLayout.top + idleLayout.height);
            }

            const deployLayout = pendingLayoutMap.get(item.id);
            if (deployLayout) {
                maxBottom = Math.max(maxBottom, deployLayout.top + deployLayout.height);
            }
        });

        return maxBottom;
    }, [boardItems, layoutMap, pendingLayoutMap]);

    const stageRenderHeight = useMemo(() => {
        const tailBuffer = clamp(stageSize.width * 0.05, 56, 108);
        const viewportFloor = Math.max(420, stageSize.viewportHeight * 0.72);
        return Math.max(viewportFloor, stageContentBottom + tailBuffer);
    }, [stageContentBottom, stageSize.width, stageSize.viewportHeight]);

    const priorityImageIds = useMemo(() => {
        const ranked = boardItems
            .map((item) => ({ id: item.id, layout: layoutMap.get(item.id) }))
            .filter((entry) => Boolean(entry.layout))
            .sort(
                (a, b) =>
                    a.layout.top - b.layout.top || a.layout.left - b.layout.left,
            );

        const foldThreshold = stageSize.viewportHeight * 1.15;
        const foldCandidates = ranked
            .filter((entry) => entry.layout.top < foldThreshold)
            .slice(0, 12);
        const selected = foldCandidates.length ? foldCandidates : ranked.slice(0, 10);

        return new Set(selected.map((entry) => entry.id));
    }, [boardItems, layoutMap, stageSize.viewportHeight]);

    return (
        <div className={`visual-moodboard-root ${surfaceMode === 'light' ? 'surface-light' : 'surface-dark'}`}>
            <div className="moodboard-toolbar">
                {!hideSearch && (
                    <button
                        type="button"
                        className={`filters-toggle ${filtersOpen ? 'active' : ''}`}
                        onClick={() =>
                            setFiltersOpen((current) => {
                                const next = !current;
                                if (!next) setTagsOpen(false);
                                return next;
                            })
                        }
                    >
                        {filtersOpen ? 'Hide Keyword Search' : 'Search by Keywords'}
                    </button>
                )}

                {!hideSearch && filtersOpen && tagCounts.length > 0 && (
                    <button
                        type="button"
                        className={`tags-toggle ${tagsOpen ? 'active' : ''}`}
                        onClick={() => setTagsOpen((current) => !current)}
                    >
                        {tagsOpen ? 'Hide Tags' : 'Show Tags'}
                    </button>
                )}

                {!hideSearch && (query || activeTag) && (
                    <button
                        type="button"
                        className="reset-filters-btn"
                        onClick={() => {
                            setQuery('');
                            setActiveTag('');
                        }}
                    >
                        Reset
                    </button>
                )}
            </div>

            <button
                type="button"
                className="surface-toggle-btn"
                onClick={() => setSurfaceMode((current) => (current === 'light' ? 'dark' : 'light'))}
                aria-label={`Switch to ${surfaceMode === 'light' ? 'dark' : 'light'} theme`}
            >
                <span className="surface-toggle-label desktop-control-label">
                    {surfaceMode === 'light' ? 'Dark Theme' : 'Light Theme'}
                </span>
                <span className="surface-toggle-label mobile-control-label" aria-hidden="true">
                    Light / Dark
                </span>
            </button>

            {normalizedItems.length > 1 && (
                <button
                    type="button"
                    className={`shuffle-btn ${shufflePhase !== 'idle' ? 'busy' : ''}`}
                    onClick={handleShuffle}
                    disabled={shufflePhase !== 'idle' || boardItems.length < 2}
                >
                    <span className="shuffle-btn-label desktop-control-label">
                        {shufflePhase === 'idle' ? 'Shuffle Board' : 'Shuffling...'}
                    </span>
                    <span className="shuffle-btn-label mobile-control-label" aria-hidden="true">
                        {shufflePhase === 'idle' ? 'Shuffle' : 'Shuffling...'}
                    </span>
                </button>
            )}

            {!hideSearch && filtersOpen && (
                <div className="moodboard-controls">
                    <div className="moodboard-search-wrap">
                        <input
                            type="text"
                            className="moodboard-search"
                            placeholder="Search by tag, mood, or keyword..."
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                        />
                        {query && (
                            <button type="button" className="clear-search-btn" onClick={() => setQuery('')}>
                                Clear
                            </button>
                        )}
                    </div>

                    {tagsOpen && (
                        <div className="moodboard-tag-strip">
                            <button
                                type="button"
                                className={`tag-chip ${activeTag === '' ? 'active' : ''}`}
                                onClick={() => setActiveTag('')}
                            >
                                All ({normalizedItems.length})
                            </button>

                            {tagCounts.map(({ tag, count }) => (
                                <button
                                    key={tag}
                                    type="button"
                                    className={`tag-chip ${activeTag === tag ? 'active' : ''}`}
                                    onClick={() => setActiveTag((current) => (current === tag ? '' : tag))}
                                >
                                    {tag} ({count})
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {normalizedItems.length === 0 ? (
                <div className="moodboard-empty-state">
                    No images yet. Upload from the Admin Dashboard moodboard panel.
                </div>
            ) : (
                <div className="moodboard-stage" ref={stageRef} style={{ minHeight: `${stageRenderHeight}px` }}>
                    <AnimatePresence>
                        {boardItems.map((item, index) => {
                            const idleLayout = layoutMap.get(item.id);
                            if (!idleLayout) return null;
                            const deployLayout = pendingLayoutMap.get(item.id) || idleLayout;
                            const isShuffleActive = shufflePhase !== 'idle';
                            const isShuffleCandidate = shuffleOrderMap.has(item.id);
                            const shuffleIsActiveForItem = isShuffleActive && isShuffleCandidate;
                            const activeLayout =
                                shuffleIsActiveForItem && shufflePhase === 'deploy'
                                    ? deployLayout
                                    : idleLayout;
                            const isPriorityImage = priorityImageIds.has(item.id);
                            const shouldOpenViewer = enablePolaroidViewer;
                            const cardHref =
                                typeof item.href === 'string' && item.href.trim() ? item.href.trim() : '';
                            const isClickable = shouldOpenViewer || Boolean(cardHref);

                            const stackCenterX = shuffleCenter?.x || stageSize.width * 0.5;
                            const stackCenterY =
                                shuffleCenter?.y ||
                                clamp(stageSize.height * 0.5, TOP_PADDING + 90, stageSize.height - BOTTOM_PADDING - 90);
                            const collectDx =
                                stackCenterX - (idleLayout.left + idleLayout.width / 2);
                            const collectDy =
                                stackCenterY - (idleLayout.top + idleLayout.height / 2);
                            const deployDx =
                                stackCenterX - (deployLayout.left + deployLayout.width / 2);
                            const deployDy =
                                stackCenterY - (deployLayout.top + deployLayout.height / 2);

                            const orderIndex = isShuffleCandidate
                                ? shuffleOrderMap.get(item.id)
                                : index;
                            const stackRandom = createSeededRandom(
                                hashString(`${item.id}:${pendingSeed ?? layoutSeed}:stack:${orderIndex}`),
                            );
                            const stackAnchorX = ((orderIndex % 7) - 3) * 3.5 + (stackRandom() - 0.5) * 3;
                            const stackAnchorY =
                                ((Math.floor(orderIndex / 7) % 5) - 2) * 2.2 + (stackRandom() - 0.5) * 3;
                            const stackScaleBase = clamp(
                                0.92 + stackRandom() * 0.05 - orderIndex * 0.0013,
                                0.86,
                                0.99,
                            );
                            const stackRotateBase = (stackRandom() - 0.5) * 8;
                            const stackRotateReturn = stackRotateBase + (stackRandom() - 0.5) * 10;
                            const stackLayerIndex = stackZOrderMap.has(item.id)
                                ? stackZOrderMap.get(item.id)
                                : orderIndex;
                            const breathDirection = activeLayout.breathDirection || 1;
                            const breathingAmplitude =
                                shuffleIsActiveForItem
                                    ? shufflePhase === 'deploy'
                                        ? 0.88
                                        : 0.66
                                    : 1;
                            const breathingY = (activeLayout.driftY || 0) * breathDirection * breathingAmplitude;
                            const breathingScale =
                                (activeLayout.breathScale || 0.012) *
                                (shuffleIsActiveForItem
                                    ? shufflePhase === 'deploy'
                                        ? 0.86
                                        : 0.72
                                    : 1);
                            const breathingDuration = clamp(activeLayout.duration || 6.6, 5.8, 7.6);
                            const breathingDelay =
                                !shuffleIsActiveForItem ? activeLayout.motionDelay || 0 : 0;

                            let figureAnimate;
                            let figureTransition;

                            if (shufflePhase === 'fadeOut') {
                                figureAnimate = {
                                    x: 0,
                                    y: shuffleIsActiveForItem ? -6 : 0,
                                    scale: shuffleIsActiveForItem ? 0.96 : 1,
                                    rotate: 0,
                                    opacity: shuffleIsActiveForItem ? 0 : 1,
                                };
                                figureTransition = prefersReducedMotion
                                    ? { duration: 0.12 }
                                    : {
                                        duration: shuffleTiming.fadeDuration,
                                        ease: [0.28, 0.9, 0.4, 1],
                                        delay: shuffleIsActiveForItem
                                            ? orderIndex * shuffleTiming.fadeStep
                                            : 0,
                                    };
                            } else if (shufflePhase === 'collect') {
                                figureAnimate = {
                                    x: shuffleIsActiveForItem ? collectDx + stackAnchorX : 0,
                                    y: shuffleIsActiveForItem ? collectDy + stackAnchorY : 0,
                                    scale: shuffleIsActiveForItem ? stackScaleBase * 0.98 : 1,
                                    rotate: shuffleIsActiveForItem ? stackRotateBase * 0.36 : 0,
                                    opacity: 1,
                                };
                                figureTransition = prefersReducedMotion
                                    ? { duration: 0.12 }
                                    : {
                                        duration: 0.24,
                                        ease: [0.3, 0.95, 0.5, 1],
                                        delay: 0,
                                    };
                            } else if (shufflePhase === 'stack') {
                                figureAnimate = {
                                    x: shuffleIsActiveForItem ? collectDx + stackAnchorX : 0,
                                    y: shuffleIsActiveForItem ? collectDy + stackAnchorY : 0,
                                    scale: shuffleIsActiveForItem ? stackScaleBase : 1,
                                    rotate: shuffleIsActiveForItem ? stackRotateBase * 0.6 : 0,
                                    opacity: 1,
                                };
                                figureTransition = prefersReducedMotion
                                    ? { duration: 0.12 }
                                    : {
                                        duration: 0.14,
                                        ease: [0.22, 0.92, 0.32, 1],
                                        delay: 0,
                                    };
                            } else if (shufflePhase === 'deploy') {
                                figureAnimate = {
                                    x: shuffleIsActiveForItem ? [deployDx + stackAnchorX, 0] : 0,
                                    y: shuffleIsActiveForItem ? [deployDy + stackAnchorY, 0] : 0,
                                    scale: shuffleIsActiveForItem ? [stackScaleBase, 1.01, 1] : 1,
                                    rotate: shuffleIsActiveForItem ? [stackRotateReturn * 0.12, 0] : [0, 0],
                                    opacity: 1,
                                };
                                figureTransition = prefersReducedMotion
                                    ? { duration: 0.14 }
                                    : {
                                        duration: shuffleTiming.deployDuration,
                                        ease: [0.2, 0.9, 0.28, 1],
                                        delay: shuffleIsActiveForItem
                                            ? orderIndex * shuffleTiming.deployStep
                                            : 0,
                                        times: [0, 0.86, 1],
                                    };
                            } else {
                                figureAnimate = {
                                    x: 0,
                                    y: 0,
                                    scale: 1,
                                    rotate: 0,
                                    opacity: 1,
                                };
                                figureTransition = prefersReducedMotion
                                    ? { duration: 0.12 }
                                    : {
                                        duration: 0.2,
                                        ease: [0.2, 0.9, 0.28, 1],
                                        delay: activeLayout.appearDelay || 0,
                                    };
                            }

                            const animatedImage = (
                                <motion.img
                                    src={item.imageUrl}
                                    alt={item.title}
                                    onLoad={(event) => handleImageLoad(item.id, event)}
                                    loading={isPriorityImage ? 'eager' : 'lazy'}
                                    decoding={isPriorityImage ? 'sync' : 'async'}
                                    animate={
                                        prefersReducedMotion
                                            ? { y: 0, scale: 1 }
                                            : {
                                                y: [0, breathingY, 0, -breathingY * 0.36, 0],
                                                scale: [
                                                    1,
                                                    1 + breathingScale,
                                                    1,
                                                    1 - breathingScale * 0.52,
                                                    1,
                                                ],
                                            }
                                    }
                                    transition={
                                        prefersReducedMotion
                                            ? { duration: 0 }
                                            : {
                                                duration: breathingDuration,
                                                ease: 'easeInOut',
                                                repeat: Infinity,
                                                repeatType: 'loop',
                                                delay: breathingDelay,
                                                times: [0, 0.32, 0.54, 0.78, 1],
                                            }
                                    }
                                    style={{ transformOrigin: '50% 50%' }}
                                />
                            );

                            const isTextCard = item.type === 'text';
                            return (
                                <motion.figure
                                    key={item.id}
                                    className={`moodboard-card ${isTextCard ? 'is-text-card' : ''} ${isClickable && !isTextCard ? 'is-clickable' : ''}`}
                                    initial={
                                        prefersReducedMotion
                                            ? false
                                            : { opacity: 0, scale: 0.92, y: 14 }
                                    }
                                    exit={{ scale: 0.9, transition: { duration: 0.2 } }}
                                    animate={figureAnimate}
                                    transition={figureTransition}
                                    style={{
                                        left: `${activeLayout.left}px`,
                                        top: `${activeLayout.top}px`,
                                        width: `${activeLayout.width}px`,
                                        height: `${activeLayout.height}px`,
                                        zIndex: (() => {
                                            if (shufflePhase === 'idle') return activeLayout.zIndex;
                                            if (!shuffleIsActiveForItem) return activeLayout.zIndex;
                                            if (shufflePhase === 'collect' || shufflePhase === 'stack') {
                                                return 420 + stackLayerIndex;
                                            }
                                            return 420 + orderIndex;
                                        })(),
                                        pointerEvents:
                                            isTextCard || (shufflePhase === 'idle' && isClickable) ? 'auto' : 'none',
                                    }}
                                >
                                    <motion.div
                                        className="moodboard-card-entry"
                                        initial={false}
                                        animate={{ scale: 1, y: 0, opacity: 1 }}
                                        transition={
                                            prefersReducedMotion
                                                ? { duration: 0 }
                                                : isShuffleActive
                                                    ? { duration: 0.16, ease: 'easeOut' }
                                                    : {
                                                        duration: 0.28,
                                                        ease: [0.22, 1, 0.36, 1],
                                                        delay: 0,
                                                    }
                                        }
                                    >
                                        {isTextCard ? (
                                            <div className="moodboard-text-card-content">
                                                <div className="moodboard-text-card-inner">
                                                    {item.text.split('\n\n').map((para, i) => (
                                                        <p key={i}>{para.trim()}</p>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : shouldOpenViewer ? (
                                            <button
                                                type="button"
                                                className="moodboard-card-link moodboard-card-link-button"
                                                onClick={() => handleViewerOpen(item.id)}
                                                aria-label={`Open ${item.title}`}
                                            >
                                                {animatedImage}
                                            </button>
                                        ) : isClickable ? (
                                            <a
                                                href={cardHref}
                                                className="moodboard-card-link"
                                                aria-label={`Open ${item.title}`}
                                            >
                                                {animatedImage}
                                            </a>
                                        ) : (
                                            animatedImage
                                        )}
                                    </motion.div>
                                </motion.figure>
                            );
                        })}
                    </AnimatePresence>

                    {filteredItems.length === 0 && (
                        <div className="moodboard-empty-filter">
                            No matches. Try a shorter keyword or clear the tag filter.
                        </div>
                    )}

                </div>
            )}

            {enablePolaroidViewer && viewerActiveId && (
                <MoodboardPolaroidViewer
                    items={boardItems}
                    activeId={viewerActiveId}
                    onClose={handleViewerClose}
                    onChange={handleViewerChange}
                />
            )}

            <style>{`
                .visual-moodboard-root {
                    width: 100%;
                    position: relative;
                    z-index: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                    padding-bottom: clamp(1.2rem, 2.6vw, 2.2rem);
                }

                .visual-moodboard-root.surface-dark {
                    --ui-text: rgba(245, 236, 227, 0.94);
                    --ui-text-strong: rgba(255, 249, 242, 0.98);
                    --ui-muted: rgba(242, 228, 218, 0.86);
                    --ui-border: rgba(255, 255, 255, 0.24);
                    --ui-bg: rgba(0, 0, 0, 0.52);
                    --ui-bg-subtle: rgba(255, 255, 255, 0.04);
                    --ui-active-bg: rgba(234, 42, 16, 0.22);
                    --ui-active-border: rgba(234, 42, 16, 0.98);
                    --ui-active-text: rgba(255, 248, 244, 0.98);
                    --ui-focus-border: rgba(234, 42, 16, 0.9);
                    --ui-focus-ring: rgba(234, 42, 16, 0.22);
                    --fab-bg: rgba(255, 255, 255, 0.98);
                    --fab-border: rgba(255, 255, 255, 1);
                    --fab-text: rgba(10, 10, 10, 0.96);
                    --fab-shadow: 0 8px 18px rgba(0, 0, 0, 0.34);
                    --fab-hover-shadow: 0 12px 22px rgba(0, 0, 0, 0.4);
                }

                .visual-moodboard-root.surface-light {
                    --ui-text: rgba(34, 29, 23, 0.94);
                    --ui-text-strong: rgba(24, 20, 16, 0.98);
                    --ui-muted: rgba(46, 39, 31, 0.84);
                    --ui-border: rgba(33, 28, 22, 0.26);
                    --ui-bg: rgba(255, 252, 246, 0.82);
                    --ui-bg-subtle: rgba(255, 252, 246, 0.9);
                    --ui-active-bg: rgba(27, 23, 18, 0.88);
                    --ui-active-border: rgba(27, 23, 18, 0.96);
                    --ui-active-text: rgba(250, 245, 237, 0.98);
                    --ui-focus-border: rgba(30, 25, 19, 0.92);
                    --ui-focus-ring: rgba(30, 25, 19, 0.2);
                    --fab-bg: rgba(248, 241, 230, 0.98);
                    --fab-border: rgba(225, 211, 188, 0.98);
                    --fab-text: rgba(24, 20, 16, 0.96);
                    --fab-shadow: 0 8px 16px rgba(62, 46, 26, 0.2);
                    --fab-hover-shadow: 0 12px 20px rgba(62, 46, 26, 0.24);
                }

                .moodboard-controls {
                    width: min(1200px, calc(100vw - 2rem));
                    margin: 0 auto;
                    display: flex;
                    flex-direction: column;
                    gap: 0.85rem;
                }

                .moodboard-toolbar {
                    width: min(1200px, calc(100vw - 2rem));
                    margin: 0 auto;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 0.55rem;
                    padding-top: 0.1rem;
                }

                .filters-toggle,
                .tags-toggle,
                .reset-filters-btn {
                    border: 1px solid var(--ui-border);
                    background: var(--ui-bg);
                    color: var(--ui-text);
                    border-radius: 10px;
                    min-height: 38px;
                    padding: 0 0.85rem;
                    cursor: pointer;
                    font-family: var(--font-ui);
                    font-size: 0.68rem;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                }

                .surface-toggle-btn,
                .shuffle-btn {
                    position: fixed;
                    right: clamp(0.8rem, 1.4vw, 1.4rem);
                    bottom: clamp(1rem, 2.2vh, 1.5rem);
                    z-index: 2000;
                    min-height: 42px;
                    min-width: 142px;
                    border: 1px solid var(--fab-border);
                    border-radius: 12px;
                    padding: 0 1rem;
                    cursor: pointer;
                    color: var(--fab-text);
                    font-family: var(--font-ui);
                    font-size: 0.68rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    background: var(--fab-bg);
                    box-shadow: var(--fab-shadow);
                    transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
                }

                .surface-toggle-btn {
                    bottom: calc(clamp(1rem, 2.2vh, 1.5rem) + 52px);
                }

                .surface-toggle-label,
                .shuffle-btn-label {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 42px;
                    color: var(--fab-text);
                }

                .mobile-control-label {
                    display: none;
                }

                .shuffle-btn.busy {
                    cursor: wait;
                    filter: brightness(0.98);
                }

                .surface-toggle-btn:hover,
                .shuffle-btn:hover:enabled {
                    transform: translateY(-1px);
                    box-shadow: var(--fab-hover-shadow);
                }

                .shuffle-btn:disabled {
                    opacity: 0.86;
                }

                .filters-toggle.active {
                    border-color: var(--ui-active-border);
                    background: var(--ui-active-bg);
                    color: var(--ui-active-text);
                }

                .tags-toggle.active {
                    border-color: var(--ui-active-border);
                    background: var(--ui-active-bg);
                    color: var(--ui-active-text);
                }

                .reset-filters-btn {
                    background: var(--ui-bg-subtle);
                }

                .moodboard-search-wrap {
                    display: flex;
                    align-items: center;
                    gap: 0.65rem;
                }

                .moodboard-search {
                    flex: 1;
                    min-height: 46px;
                    border: 1px solid var(--ui-border);
                    background: var(--ui-bg);
                    color: var(--ui-text-strong);
                    border-radius: 10px;
                    padding: 0.75rem 1rem;
                    font-family: var(--font-ui);
                    font-size: 0.82rem;
                    letter-spacing: 0.02em;
                }

                .moodboard-search:focus {
                    outline: none;
                    border-color: var(--ui-focus-border);
                    box-shadow: 0 0 0 2px var(--ui-focus-ring);
                }

                .moodboard-search::placeholder {
                    color: var(--ui-muted);
                }

                .clear-search-btn {
                    border: 1px solid var(--ui-border);
                    background: var(--ui-bg-subtle);
                    color: var(--ui-text);
                    border-radius: 10px;
                    min-height: 46px;
                    padding: 0 1rem;
                    cursor: pointer;
                    font-family: var(--font-ui);
                    font-size: 0.72rem;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                }

                .moodboard-tag-strip {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    align-items: center;
                }

                .tag-chip {
                    border: 1px solid var(--ui-border);
                    background: var(--ui-bg-subtle);
                    color: var(--ui-text);
                    border-radius: 999px;
                    padding: 0.38rem 0.72rem;
                    font-family: var(--font-ui);
                    font-size: 0.68rem;
                    letter-spacing: 0.05em;
                    text-transform: lowercase;
                    cursor: pointer;
                }

                .tag-chip.active {
                    background: var(--ui-active-bg);
                    border-color: var(--ui-active-border);
                    color: var(--ui-active-text);
                }

                .moodboard-stage {
                    position: relative;
                    width: 100vw;
                    margin: 0 calc(50% - 50vw);
                    overflow: hidden;
                    background: transparent;
                }

                .moodboard-card {
                    position: absolute;
                    margin: 0;
                    border-radius: 0;
                    border: 0;
                    background: transparent;
                    box-shadow: none;
                    overflow: visible;
                    pointer-events: none;
                    will-change: transform;
                }

                .moodboard-card.is-clickable {
                    cursor: pointer;
                }

                .moodboard-card.is-text-card {
                    pointer-events: auto;
                    background: transparent !important;
                    border: 0 !important;
                    box-shadow: none !important;
                }

                .moodboard-text-card-content {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: flex-start;
                    padding: 0 !important;
                    box-sizing: border-box;
                    background: transparent !important;
                    border: 0 !important;
                    box-shadow: none !important;
                    text-align: left;
                }

                .moodboard-text-card-inner {
                    width: 100%;
                    text-align: left;
                }

                .moodboard-text-card-inner p {
                    margin: 0 0 1.35rem 0;
                    color: var(--mood-title-color);
                    font-family: var(--font-ui);
                    font-size: clamp(1.05rem, 1.5vw, 1.25rem);
                    font-weight: 600;
                    line-height: 1.65;
                    letter-spacing: -0.01em;
                    text-wrap: pretty;
                    word-break: keep-all;
                }

                .moodboard-text-card-inner p:last-child {
                    margin-bottom: 0;
                }

                .moodboard-card-entry {
                    width: 100%;
                    height: 100%;
                    will-change: transform, opacity;
                }

                .moodboard-card-link {
                    display: block;
                    width: 100%;
                    height: 100%;
                    pointer-events: auto;
                    text-decoration: none;
                }

                .moodboard-card-link-button {
                    appearance: none;
                    border: 0;
                    padding: 0;
                    margin: 0;
                    background: transparent;
                    text-align: inherit;
                    cursor: pointer;
                }

                .moodboard-card-link:focus-visible {
                    outline: 2px solid var(--ui-focus-border);
                    outline-offset: 2px;
                }

                .moodboard-card img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    display: block;
                    border: 0;
                    box-shadow: none;
                    will-change: transform;
                }

                .moodboard-empty-state,
                .moodboard-empty-filter {
                    width: min(720px, calc(100vw - 2rem));
                    margin: 1rem auto;
                    border: 1px dashed var(--ui-border);
                    background: var(--ui-bg-subtle);
                    color: var(--ui-text);
                    border-radius: 12px;
                    padding: 1rem 1.2rem;
                    font-family: var(--font-ui);
                    font-size: 0.76rem;
                    letter-spacing: 0.03em;
                    text-align: center;
                    text-transform: uppercase;
                }

                .moodboard-empty-filter {
                    position: absolute;
                    top: 1rem;
                    left: 50%;
                    transform: translateX(-50%);
                    margin: 0;
                    background: rgba(0, 0, 0, 0.72);
                    backdrop-filter: blur(4px);
                }

                .visual-moodboard-root.surface-light .moodboard-empty-filter {
                    background: rgba(255, 252, 246, 0.9);
                }

                @media (max-width: 900px) {
                    .moodboard-toolbar,
                    .moodboard-controls {
                        width: calc(100vw - 1.25rem);
                    }

                    .surface-toggle-btn,
                    .shuffle-btn {
                        right: 0.55rem;
                        min-width: 0;
                        min-height: 28px;
                        border-radius: 8px;
                        padding: 0 0.5rem;
                        font-size: 0.54rem;
                        letter-spacing: 0.06em;
                        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.16);
                    }

                    .surface-toggle-btn {
                        bottom: calc(4.45rem + env(safe-area-inset-bottom, 0px) + 34px);
                    }

                    .shuffle-btn {
                        bottom: calc(4.45rem + env(safe-area-inset-bottom, 0px));
                    }

                    .surface-toggle-label,
                    .shuffle-btn-label {
                        min-height: 28px;
                        white-space: nowrap;
                    }

                    .desktop-control-label {
                        display: none;
                    }

                    .mobile-control-label {
                        display: flex;
                    }

                    .moodboard-search-wrap {
                        flex-direction: column;
                    }

                    .moodboard-search,
                    .clear-search-btn {
                        width: 100%;
                    }
                }

            `}</style>
        </div>
    );
}

function useReducedMotion() {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        setPrefersReducedMotion(mediaQuery.matches);

        const listener = (event) => {
            setPrefersReducedMotion(event.matches);
        };

        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', listener);
            return () => mediaQuery.removeEventListener('change', listener);
        } else {
            mediaQuery.addListener(listener);
            return () => mediaQuery.removeListener(listener);
        }
    }, []);

    return prefersReducedMotion;
}
