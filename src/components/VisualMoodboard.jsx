import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import MoodboardPolaroidViewer from './MoodboardPolaroidViewer.jsx';

const OVERLAP_LIMIT = 0.22;
const EDGE_PADDING = 18;
const TOP_PADDING = 12;
const BOTTOM_PADDING = 24;

const SIZE_PRESETS = [
    { scale: 0.24, weight: 0.06 },
    { scale: 0.34, weight: 0.1 },
    { scale: 0.46, weight: 0.13 },
    { scale: 0.6, weight: 0.16 },
    { scale: 0.74, weight: 0.17 },
    { scale: 0.88, weight: 0.13 },
    { scale: 1.02, weight: 0.1 },
    { scale: 1.16, weight: 0.08 },
    { scale: 1.34, weight: 0.05 },
    { scale: 1.52, weight: 0.02 },
];

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function normalizeTags(rawTags) {
    if (!Array.isArray(rawTags)) return [];

    return rawTags
        .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
        .filter(Boolean);
}

function hashString(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function createSeededRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function overlapRatio(boxA, boxB) {
    const xOverlap = Math.max(
        0,
        Math.min(boxA.left + boxA.width, boxB.left + boxB.width) - Math.max(boxA.left, boxB.left),
    );
    const yOverlap = Math.max(
        0,
        Math.min(boxA.top + boxA.height, boxB.top + boxB.height) - Math.max(boxA.top, boxB.top),
    );

    if (xOverlap === 0 || yOverlap === 0) return 0;

    const intersection = xOverlap * yOverlap;
    const smallerArea = Math.min(boxA.width * boxA.height, boxB.width * boxB.height);
    if (!smallerArea) return 0;

    return intersection / smallerArea;
}

function pickSizeScale(random) {
    const roll = random();
    let cumulative = 0;

    for (const preset of SIZE_PRESETS) {
        cumulative += preset.weight;
        if (roll <= cumulative) return preset.scale;
    }

    return 1;
}

function resolveLaneCount(width) {
    if (width < 720) return 2;
    if (width < 1040) return 3;
    if (width < 1360) return 4;
    if (width < 1760) return 5;
    return 6;
}

function getBalancedCardSize(width, ratio, random) {
    const baseSquare = clamp(width * 0.17, 150, 310);
    const scaleToken = pickSizeScale(random);
    const baseLongSide = baseSquare * scaleToken;

    let cardWidth = ratio >= 1 ? baseLongSide : baseLongSide * ratio;
    let cardHeight = ratio >= 1 ? baseLongSide / ratio : baseLongSide;

    const maxWidth = clamp(width * 0.31, 190, 470);
    const maxHeight = clamp(width * 0.34, 190, 490);
    const downScale = Math.min(maxWidth / cardWidth, maxHeight / cardHeight, 1);

    cardWidth *= downScale;
    cardHeight *= downScale;

    const minEdge = width < 720 ? 62 : 76;
    const upScale = Math.max(minEdge / cardWidth, minEdge / cardHeight, 1);

    cardWidth *= upScale;
    cardHeight *= upScale;

    return {
        width: cardWidth,
        height: cardHeight,
    };
}

function computeFloatingLayout(items, width, height, seedSalt = 0) {
    const layout = new Map();
    if (!items.length || width <= 0 || height <= 0) return layout;

    const placed = [];
    const topInset = TOP_PADDING + 8;
    const bottomInset = BOTTOM_PADDING + 8;
    const laneCount = resolveLaneCount(width);
    const targetRows = Math.max(1, Math.ceil(items.length / laneCount));
    const usableWidth = width - EDGE_PADDING * 2;
    const laneWidth = usableWidth / laneCount;
    const laneHeights = Array.from({ length: laneCount }, (_, lane) => topInset + lane * 10);
    const depthCompression =
        targetRows <= 2
            ? 0.9
            : targetRows <= 4
                ? 0.94
                : targetRows <= 6
                    ? 0.98
                    : 1;

    items.forEach((item) => {
        const random = createSeededRandom(hashString(`${item.id}:${seedSalt}`));
        const ratio = clamp(item.aspectRatio || 1, 0.35, 2.85);
        const dimensions = getBalancedCardSize(width, ratio, random);
        const targetWidth = dimensions.width;
        const targetHeight = dimensions.height;
        const maxTopForCard = Math.max(topInset, height - bottomInset - targetHeight);
        const compressedMaxTop = topInset + (maxTopForCard - topInset) * depthCompression;

        const laneIndices = Array.from({ length: laneCount }, (_, lane) => lane);
        laneIndices.sort((a, b) => laneHeights[a] - laneHeights[b]);

        let bestCandidate = null;
        let bestScore = Infinity;

        for (let laneRank = 0; laneRank < laneIndices.length; laneRank += 1) {
            const lane = laneIndices[laneRank];
            const laneBaseX = EDGE_PADDING + lane * laneWidth;

            for (let attempt = 0; attempt < 3; attempt += 1) {
                const centerX = laneBaseX + laneWidth * 0.5;
                const crossLanePull = (random() - 0.5) * laneWidth * 0.42;
                const laneBias = (lane % 2 === 0 ? -1 : 1) * laneWidth * (0.02 + random() * 0.06);
                const left = clamp(
                    centerX - targetWidth / 2 + crossLanePull + laneBias,
                    EDGE_PADDING,
                    width - EDGE_PADDING - targetWidth,
                );

                const verticalOverlap = targetHeight * (0.02 + random() * 0.05);
                const verticalJitter = (random() - 0.5) * Math.min(20, targetHeight * 0.11);
                const top = clamp(
                    laneHeights[lane] - verticalOverlap + verticalJitter,
                    topInset,
                    compressedMaxTop,
                );

                const candidate = {
                    left,
                    top,
                    width: targetWidth,
                    height: targetHeight,
                    lane,
                };

                let highestOverlap = 0;
                let overlapPenalty = 0;
                for (
                    let previousIndex = Math.max(0, placed.length - 14);
                    previousIndex < placed.length;
                    previousIndex += 1
                ) {
                    const overlap = overlapRatio(candidate, placed[previousIndex]);
                    highestOverlap = Math.max(highestOverlap, overlap);
                    if (overlap > OVERLAP_LIMIT) {
                        overlapPenalty += (overlap - OVERLAP_LIMIT) * 1600;
                    }
                    if (overlap > OVERLAP_LIMIT + 0.14) break;
                }

                const lanePenalty = laneRank * 18;
                const depthPenalty = candidate.top * 0.02;
                const score = overlapPenalty + lanePenalty + depthPenalty;

                if (score < bestScore) {
                    bestScore = score;
                    bestCandidate = candidate;
                }
            }
        }

        if (!bestCandidate) return;
        const position = bestCandidate;
        placed.push(position);

        let laneAdvance = targetHeight * (0.86 + random() * 0.26);
        if (random() < 0.16) {
            laneAdvance += targetHeight * (0.12 + random() * 0.12);
        }
        laneHeights[position.lane] = Math.max(
            laneHeights[position.lane],
            position.top + laneAdvance,
        );

        // bleed nearby lane heights to break coherent side-by-side bands
        if (position.lane > 0) {
            laneHeights[position.lane - 1] = Math.max(
                laneHeights[position.lane - 1],
                position.top + targetHeight * (0.42 + random() * 0.2),
            );
        }
        if (position.lane < laneCount - 1) {
            laneHeights[position.lane + 1] = Math.max(
                laneHeights[position.lane + 1],
                position.top + targetHeight * (0.42 + random() * 0.2),
            );
        }

        const leftRoom = Math.max(0, position.left - EDGE_PADDING);
        const rightRoom = Math.max(0, width - EDGE_PADDING - (position.left + position.width));
        const topRoom = Math.max(0, position.top - topInset);
        const bottomRoom = Math.max(0, height - bottomInset - (position.top + position.height));

        const motionTierRoll = random();
        const motionTierMultiplier =
            motionTierRoll < 0.24 ? 2.18 : motionTierRoll < 0.66 ? 1.5 : 1.04;
        const breathDirection = random() < 0.82 ? 1 : -1; // majority cohort moves together

        const rawDriftX = (0.9 + random() * 3.8) * (0.8 + random() * 0.55);
        const rawDriftY = (7.8 + random() * 12.2) * motionTierMultiplier;
        const driftX = Math.max(0.7, Math.min(rawDriftX, leftRoom * 0.72, rightRoom * 0.72));
        const driftY = Math.max(3, Math.min(rawDriftY, topRoom * 0.78, bottomRoom * 0.78));
        const driftXDirection = random() < 0.5 ? -1 : 1;
        const scrollStagger = (position.top / Math.max(height, 1)) * 0.14;
        const horizontalStagger = (position.left / Math.max(width, 1)) * 0.04;
        const baseDuration = clamp(
            6.45 +
            random() * 0.62 +
            (motionTierRoll < 0.24 ? -0.18 : motionTierRoll < 0.66 ? -0.04 : 0.11),
            6.1,
            7.2,
        );
        const phaseJitter = random() * 0.14;
        const motionDelay = phaseJitter;

        layout.set(item.id, {
            ...position,
            driftX: driftX * driftXDirection,
            driftY,
            breathDirection,
            breathScale:
                (0.011 + random() * 0.015) *
                (motionTierRoll < 0.22 ? 1.55 : motionTierRoll < 0.58 ? 1.2 : 1),
            duration: baseDuration,
            motionDelay,
            appearDelay: clamp(0.02 + scrollStagger + horizontalStagger, 0.02, 0.22),
            zIndex: (() => {
                const layerRoll = random();

                if (layerRoll < 0.3) return 10 + Math.floor(random() * 28);
                if (layerRoll < 0.8) return 46 + Math.floor(random() * 84);
                return 134 + Math.floor(random() * 92);
            })(),
        });
    });

    return layout;
}

export default function VisualMoodboard({
    items = [],
    enableGrain = true,
    enablePolaroidViewer = false,
    deepLinkParam = '',
}) {
    const prefersReducedMotion = useReducedMotion();
    const stageRef = useRef(null);
    const probedIdsRef = useRef(new Set());
    const shuffleTimersRef = useRef([]);
    const [query, setQuery] = useState('');
    const [activeTag, setActiveTag] = useState('');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [tagsOpen, setTagsOpen] = useState(false);
    const [surfaceMode, setSurfaceMode] = useState('light');
    const [stageSize, setStageSize] = useState({ width: 1200, height: 900, viewportHeight: 900 });
    const [imageRatios, setImageRatios] = useState({});
    const [layoutSeed, setLayoutSeed] = useState(0);
    const [layoutOrder, setLayoutOrder] = useState([]);
    const [pendingSeed, setPendingSeed] = useState(null);
    const [pendingOrder, setPendingOrder] = useState(null);
    const [shufflePhase, setShufflePhase] = useState('idle');
    const [shuffleSequence, setShuffleSequence] = useState([]);
    const [stackFrameIndex, setStackFrameIndex] = useState(0);
    const [stackZFrames, setStackZFrames] = useState([]);
    const deepLinkInitializedRef = useRef(false);
    const [viewerActiveId, setViewerActiveId] = useState(null);

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
        return () => {
            if (typeof document === 'undefined') return;
            delete document.body.dataset.moodboardSurface;
        };
    }, []);

    useEffect(() => {
        const sourceItems = Array.isArray(items) ? items : [];
        let cancelled = false;

        sourceItems.forEach((item, index) => {
            const titleValue =
                (typeof item?.title === 'string' && item.title.trim()) ||
                (typeof item?.name === 'string' && item.name.trim()) ||
                `Mood ${index + 1}`;

            const imageUrl =
                (typeof item?.imageUrl === 'string' && item.imageUrl.trim()) ||
                (typeof item?.image_url === 'string' && item.image_url.trim()) ||
                (typeof item?.url === 'string' && item.url.trim()) ||
                '';

            if (!imageUrl) return;

            const itemId =
                (typeof item?.id === 'string' && item.id) ||
                `${titleValue.toLowerCase().replace(/\s+/g, '-')}-${index}`;

            if (probedIdsRef.current.has(itemId)) return;
            probedIdsRef.current.add(itemId);

            const probe = new window.Image();
            probe.decoding = 'async';
            probe.loading = 'eager';
            probe.onload = () => {
                if (cancelled) return;
                const ratio = probe.naturalWidth > 0 && probe.naturalHeight > 0
                    ? probe.naturalWidth / probe.naturalHeight
                    : 1;
                setImageRatios((previous) => {
                    if (previous[itemId]) return previous;
                    return { ...previous, [itemId]: ratio };
                });
            };
            probe.onerror = () => {
                if (cancelled) return;
                setImageRatios((previous) => {
                    if (previous[itemId]) return previous;
                    return { ...previous, [itemId]: 1 };
                });
            };
            probe.src = imageUrl;
        });

        return () => {
            cancelled = true;
        };
    }, [items]);

    const normalizedItems = useMemo(
        () =>
            (Array.isArray(items) ? items : [])
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
                            : 0);
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
                    };
                })
                .filter((item) => item.imageUrl),
        [items, imageRatios],
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

    const boardItems = useMemo(() => {
        if (!filteredItems.length) return [];

        const laneCount = resolveLaneCount(stageSize.width || 1200);
        if (filteredItems.length <= laneCount) return filteredItems;

        const completeRowCount = Math.floor(filteredItems.length / laneCount);
        const visibleCount = completeRowCount * laneCount;
        return filteredItems.slice(0, visibleCount);
    }, [filteredItems, stageSize.width]);

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
        setShufflePhase('idle');
    }, [boardItemsKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
        const ordered = boardItems.map((item) => item.id);
        for (let i = ordered.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
        }

        const stackFrames = [];
        let frameOrder = [...ordered];
        const frameCount = Math.max(52, Math.min(110, Math.ceil(ordered.length * 2.5)));
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

        clearShuffleTimers();
        setPendingSeed(nextSeed);
        setPendingOrder(ordered);
        setShuffleSequence(ordered);
        setStackZFrames(stackFrames);
        setStackFrameIndex(0);
        setShufflePhase('collect');

        let stackTicker = null;
        if (!prefersReducedMotion && stackFrames.length > 1) {
            stackTicker = window.setInterval(() => {
                setStackFrameIndex((value) => (value + 1) % stackFrames.length);
            }, 24);
            shuffleTimersRef.current.push(stackTicker);
        }

        const collectTimer = window.setTimeout(() => {
            setShufflePhase('stack');
        }, 260);

        const deployTimer = window.setTimeout(() => {
            if (stackTicker !== null) {
                clearInterval(stackTicker);
            }
            setShufflePhase('deploy');
        }, 1680);

        const finishTimer = window.setTimeout(() => {
            setLayoutSeed(nextSeed);
            setLayoutOrder(ordered);
            setPendingSeed(null);
            setPendingOrder(null);
            setShuffleSequence([]);
            setStackFrameIndex(0);
            setStackZFrames([]);
            setShufflePhase('idle');
            clearShuffleTimers();
        }, 2050);

        shuffleTimersRef.current.push(collectTimer, deployTimer, finishTimer);
    };

    useEffect(() => {
        const stageElement = stageRef.current;
        if (!stageElement) return undefined;

        const updateSize = () => {
            const width = stageElement.clientWidth || window.innerWidth;
            const viewportHeight = window.innerHeight || 900;
            const laneCount = resolveLaneCount(width);
            const referenceSquare = clamp(width * 0.2, 170, 360);
            const effectiveItemCount =
                filteredItems.length > laneCount
                    ? Math.floor(filteredItems.length / laneCount) * laneCount
                    : filteredItems.length;
            const rowCount = Math.ceil(Math.max(effectiveItemCount, 1) / laneCount);
            const densityScale =
                rowCount <= 2
                    ? 0.84
                    : rowCount <= 4
                        ? 0.94
                        : rowCount <= 6
                            ? 1.02
                            : 1.08;
            const rowSpan = clamp(referenceSquare * densityScale, 144, 336);
            const height = Math.max(
                viewportHeight * 0.9,
                TOP_PADDING + BOTTOM_PADDING + rowCount * rowSpan + viewportHeight * 0.3,
            );
            setStageSize({ width, height, viewportHeight });
        };

        updateSize();

        const resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(stageElement);
        window.addEventListener('resize', updateSize, { passive: true });

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', updateSize);
        };
    }, [filteredItems.length]);

    const layoutMap = useMemo(
        () => computeFloatingLayout(orderedItemsForLayout, stageSize.width, stageSize.height, layoutSeed),
        [orderedItemsForLayout, stageSize.width, stageSize.height, layoutSeed],
    );

    const pendingLayoutMap = useMemo(() => {
        if (pendingSeed === null) return layoutMap;
        return computeFloatingLayout(pendingItemsForLayout, stageSize.width, stageSize.height, pendingSeed);
    }, [pendingSeed, pendingItemsForLayout, stageSize.width, stageSize.height, layoutMap]);

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

                {filtersOpen && tagCounts.length > 0 && (
                    <button
                        type="button"
                        className={`tags-toggle ${tagsOpen ? 'active' : ''}`}
                        onClick={() => setTagsOpen((current) => !current)}
                    >
                        {tagsOpen ? 'Hide Tags' : 'Show Tags'}
                    </button>
                )}

                {(query || activeTag) && (
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
            >
                <span className="surface-toggle-label">
                    {surfaceMode === 'light' ? 'Dark Theme' : 'Light Theme'}
                </span>
            </button>

            {normalizedItems.length > 1 && (
                <button
                    type="button"
                    className={`shuffle-btn ${shufflePhase !== 'idle' ? 'busy' : ''}`}
                    onClick={handleShuffle}
                    disabled={shufflePhase !== 'idle' || boardItems.length < 2}
                >
                    <span className="shuffle-btn-label">
                        {shufflePhase === 'idle' ? 'Shuffle Board' : 'Shuffling...'}
                    </span>
                </button>
            )}

            {filtersOpen && (
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
                            const activeLayout = shufflePhase === 'deploy' ? deployLayout : idleLayout;
                            const isPriorityImage = priorityImageIds.has(item.id);
                            const shouldOpenViewer = enablePolaroidViewer;
                            const cardHref =
                                typeof item.href === 'string' && item.href.trim() ? item.href.trim() : '';
                            const isClickable = shouldOpenViewer || Boolean(cardHref);

                            const stackCenterX = stageSize.width / 2;
                            const stackCenterY = clamp(stageSize.height * 0.3, 200, 380);
                            const collectDx =
                                stackCenterX - (idleLayout.left + idleLayout.width / 2);
                            const collectDy =
                                stackCenterY - (idleLayout.top + idleLayout.height / 2);
                            const deployDx =
                                stackCenterX - (deployLayout.left + deployLayout.width / 2);
                            const deployDy =
                                stackCenterY - (deployLayout.top + deployLayout.height / 2);

                            const orderIndex = shuffleOrderMap.has(item.id)
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
                                shufflePhase === 'idle' ? 1 : shufflePhase === 'deploy' ? 0.88 : 0.66;
                            const breathingY = (activeLayout.driftY || 0) * breathDirection * breathingAmplitude;
                            const breathingScale =
                                (activeLayout.breathScale || 0.012) *
                                (shufflePhase === 'idle' ? 1 : shufflePhase === 'deploy' ? 0.86 : 0.72);
                            const breathingDuration = clamp(activeLayout.duration || 6.6, 5.8, 7.6);
                            const breathingDelay = shufflePhase === 'idle' ? activeLayout.motionDelay || 0 : 0;

                            const isShuffleActive = shufflePhase !== 'idle';
                            let figureAnimate;
                            let figureTransition;

                            if (shufflePhase === 'collect') {
                                figureAnimate = {
                                    x: collectDx + stackAnchorX,
                                    y: collectDy + stackAnchorY,
                                    scale: stackScaleBase,
                                    rotate: stackRotateBase * 0.45,
                                };
                                figureTransition = prefersReducedMotion
                                    ? { duration: 0.24 }
                                    : {
                                        duration: 0.24,
                                        ease: [0.18, 0.9, 0.25, 1],
                                        delay: 0,
                                    };
                            } else if (shufflePhase === 'stack') {
                                figureAnimate = {
                                    x: collectDx + stackAnchorX,
                                    y: collectDy + stackAnchorY,
                                    scale: stackScaleBase,
                                    rotate: stackRotateBase * 0.6,
                                };
                                figureTransition = prefersReducedMotion
                                    ? { duration: 0.16 }
                                    : {
                                        duration: 0.1,
                                        ease: 'easeInOut',
                                        delay: 0,
                                    };
                            } else if (shufflePhase === 'deploy') {
                                figureAnimate = {
                                    x: [deployDx + stackAnchorX, 0],
                                    y: [deployDy + stackAnchorY, 0],
                                    scale: [stackScaleBase, 1.005, 1],
                                    rotate: [stackRotateReturn * 0.12, 0],
                                };
                                figureTransition = prefersReducedMotion
                                    ? { duration: 0.26 }
                                    : {
                                        duration: 0.32,
                                        ease: [0.12, 0.9, 0.26, 1],
                                        delay: 0,
                                        times: [0, 0.72, 1],
                                    };
                            } else {
                                figureAnimate = {
                                    x: 0,
                                    y: 0,
                                    scale: 1,
                                    rotate: 0,
                                };
                                figureTransition = prefersReducedMotion
                                    ? { duration: 0.2 }
                                    : {
                                        duration: 0.34,
                                        ease: [0.22, 1, 0.36, 1],
                                    };
                            }

                            const animatedImage = (
                                <motion.img
                                    src={item.imageUrl}
                                    alt={item.title}
                                    loading={isPriorityImage ? 'eager' : 'lazy'}
                                    decoding={isPriorityImage ? 'sync' : 'async'}
                                    fetchPriority={isPriorityImage ? 'high' : 'low'}
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

                            return (
                                <motion.figure
                                    key={item.id}
                                    className={`moodboard-card ${isClickable ? 'is-clickable' : ''}`}
                                    initial={false}
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
                                            if (shufflePhase === 'collect' || shufflePhase === 'stack') {
                                                return 420 + stackLayerIndex;
                                            }
                                            return 420 + orderIndex;
                                        })(),
                                        pointerEvents: isClickable ? 'auto' : 'none',
                                    }}
                                >
                                    <motion.div
                                        className="moodboard-card-entry"
                                        initial={
                                            prefersReducedMotion
                                                ? false
                                                : { scale: 0.93, y: 18, opacity: 0 }
                                        }
                                        whileInView={
                                            prefersReducedMotion || isShuffleActive
                                                ? undefined
                                                : { scale: 1, y: 0, opacity: 1 }
                                        }
                                        viewport={{ once: true, amount: 0.2, margin: '0px 0px -10% 0px' }}
                                        animate={
                                            isShuffleActive
                                                ? { scale: 1, y: 0, opacity: 1 }
                                                : undefined
                                        }
                                        transition={
                                            prefersReducedMotion
                                                ? { duration: 0 }
                                                : isShuffleActive
                                                    ? { duration: 0.16, ease: 'easeOut' }
                                                    : {
                                                        duration: 0.52,
                                                        ease: [0.22, 1, 0.36, 1],
                                                        delay: activeLayout.appearDelay,
                                                    }
                                        }
                                    >
                                        {shouldOpenViewer ? (
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

                    .surface-toggle-btn {
                        bottom: calc(5.2rem + env(safe-area-inset-bottom, 0px) + 52px);
                    }

                    .shuffle-btn {
                        bottom: calc(5.2rem + env(safe-area-inset-bottom, 0px));
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
