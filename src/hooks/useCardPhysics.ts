import {
    useState,
    useEffect,
    useLayoutEffect,
    useRef,
    useCallback,
    type RefObject,
} from 'react';
import { getAllPhotography } from '../lib/services/content';
import { getPhotoStoryMetaByUrls } from '../lib/services/photoStories';
import { buildCardSensitivityProfile } from '../lib/cardSensitivity';

export interface Card {
    id: string;
    image: string;
    title: string;
    angle: number;
    x: number;
    y: number;
    zIndex: number;
    initialPos: { x: number; y: number } | null;
    revealOrder: number;
}

type FeedMode = 'shuffle' | 'story';
type MediaFilter = 'art' | 'commercial';

type PoolItem = {
    image: string;
    title: string;
    storyKey: string;
    isArt: boolean;
    isCommercial: boolean;
};

type PreloadStatus = 'loading' | 'loaded' | 'error';
const EMPTY_MEDIA_FILTERS: MediaFilter[] = [];
const SPAWN_DISTANCE_PX = 1200;

export type CardStackAction =
    | 'add'
    | 'overflow-trim'
    | 'exit-up'
    | 'exit-down'
    | 'exit-up-soft'
    | 'exit-down-soft';
export type CardSpawnEdge = 'top' | 'bottom' | 'left' | 'right';
export type CardReleaseDirection = 'up' | 'down';

interface UseCardPhysicsProps {
    initialImages: any[];
    isActive: boolean;
    feedMode?: FeedMode;
    mediaFilters?: MediaFilter[];
    queueResetKey?: number;
    queueAnchorImage?: string | null;
    cardSensitivity?: number;
    interactionRef?: RefObject<HTMLElement | null>;
    enableKickstart?: boolean;
    enableWheel?: boolean;
    enablePointer?: boolean;
    maxStackSize?: number;
}

const shuffle = <T,>(items: T[]): T[] => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
};

const asStringArray = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value
            .flatMap((item) => {
                if (typeof item === 'string') return [item];
                if (item && typeof item === 'object') {
                    const record = item as Record<string, unknown>;
                    const candidate =
                        record.url ??
                        record.label ??
                        record.name ??
                        record.value ??
                        record.title ??
                        record.slug;
                    return typeof candidate === 'string' ? [candidate] : [];
                }
                return [];
            })
            .map((item) => item.trim())
            .filter(Boolean);
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return [];
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) return asStringArray(parsed);
            } catch {
                // Fall through and treat as plain text.
            }
        }
        return [trimmed];
    }
    return [];
};

const normalizeUrl = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const PRELOAD_AHEAD_COUNT = 24;
const SOFT_EXIT_CARD_THRESHOLD = 2;
const useIsomorphicLayoutEffect =
    typeof window === 'undefined' ? useEffect : useLayoutEffect;

export const useCardPhysics = ({
    initialImages,
    isActive = true,
    feedMode = 'shuffle',
    mediaFilters = EMPTY_MEDIA_FILTERS,
    queueResetKey = 0,
    queueAnchorImage = null,
    cardSensitivity = 0.55,
    interactionRef,
    enableKickstart = true,
    enableWheel = true,
    enablePointer = true,
    maxStackSize = 6,
}: UseCardPhysicsProps) => {
    // --- STATE ---
    const [stack, setStack] = useState<Card[]>([]);
    const [lastAction, setLastAction] = useState<CardStackAction>('add');
    const [eligibleCount, setEligibleCount] = useState(0);

    // --- REFS ---
    const stackRef = useRef<Card[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);
    const lastSpawnTime = useRef(0);
    const lastMousePosRef = useRef({ x: 0, y: 0 });

    const scrollAccumulatorRef = useRef(0);
    const zIndexCounter = useRef(100);
    const lastActionTime = useRef(0);
    const totalRevealsRef = useRef(0);
    const cycleRevealCountRef = useRef(0);
    const firstInteractionTimeRef = useRef<number | null>(null);

    const masterPoolRef = useRef<PoolItem[]>([]);
    const playbackQueueRef = useRef<PoolItem[]>([]);
    const preloadStatusRef = useRef<Map<string, PreloadStatus>>(new Map());
    const preloadPromisesRef = useRef<Map<string, Promise<void>>>(new Map());
    const feedModeRef = useRef<FeedMode>(feedMode);
    const mediaFiltersRef = useRef<MediaFilter[]>(mediaFilters);
    const queueAnchorImageRef = useRef<string | null>(queueAnchorImage);
    const queueResetKeyRef = useRef(queueResetKey);

    const sensitivityProfile = buildCardSensitivityProfile(cardSensitivity);
    const safeMaxStackSize = Math.max(1, Math.round(maxStackSize));

    // ASYMMETRIC PHYSICS
    const UNSTACK_THRESHOLD = sensitivityProfile.unstackThreshold;
    const RESTACK_THRESHOLD = sensitivityProfile.restackThreshold;
    const COOLDOWN_MS = sensitivityProfile.wheelCooldownMs;
    const MOUSE_MOVE_THRESHOLD = sensitivityProfile.mouseThreshold;
    const SPAWN_COOLDOWN_MS = sensitivityProfile.spawnCooldownMs;

    const getInteractionState = () => {
        if (typeof window === 'undefined') {
            return {
                isInteractiveZone: false,
                isPointerZone: false,
            };
        }

        const interactionEl = interactionRef?.current;
        if (!interactionEl) {
            return {
                isInteractiveZone: window.scrollY < 800,
                isPointerZone: window.scrollY < 800,
            };
        }

        const rect = interactionEl.getBoundingClientRect();
        const viewportH = Math.max(window.innerHeight, 1);

        // Section is visible if any part of it overlaps the viewport.
        // When sticky-pinned, rect.top <= 0 and rect.bottom >= viewportH.
        const isSectionVisible =
            rect.top <= viewportH * 0.9 &&
            rect.bottom >= viewportH * 0.1;

        return {
            isInteractiveZone: isSectionVisible,
            isPointerZone: isSectionVisible,
        };
    };

    const buildQueue = (mode: FeedMode, filters: MediaFilter[], anchorImage: string | null) => {
        const source = masterPoolRef.current;
        if (source.length === 0) {
            return { queue: [] as PoolItem[], matchedCount: 0 };
        }

        const activeFilters = filters.filter(
            (filter): filter is MediaFilter =>
                filter === 'art' || filter === 'commercial',
        );
        const matched =
            activeFilters.length === 0
                ? source
                : source.filter((item) => {
                    if (activeFilters.includes('art') && item.isArt) return true;
                    if (activeFilters.includes('commercial') && item.isCommercial) return true;
                    return false;
                });

        if (matched.length === 0) {
            return { queue: [] as PoolItem[], matchedCount: 0 };
        }

        if (mode === 'story') {
            const grouped = new Map<string, PoolItem[]>();
            for (const item of matched) {
                const key = item.storyKey || 'ungrouped';
                if (!grouped.has(key)) grouped.set(key, []);
                grouped.get(key)?.push(item);
            }

            if (anchorImage) {
                const anchorItem = matched.find((item) => item.image === anchorImage);
                const anchorKey = anchorItem?.storyKey || null;
                const anchorGroup = anchorKey ? grouped.get(anchorKey) ?? [] : [];

                if (anchorItem && anchorGroup.length > 0) {
                    const anchorIndexInGroup = anchorGroup.findIndex(
                        (item) => item.image === anchorItem.image,
                    );
                    const queue = anchorIndexInGroup >= 0
                        ? anchorGroup.slice(anchorIndexInGroup + 1)
                        : anchorGroup;

                    return { queue, matchedCount: queue.length };
                }
            }

            const orderedGroups = Array.from(grouped.entries());
            const queue: PoolItem[] = [];
            for (const [, group] of orderedGroups) {
                // Story mode is deterministic: complete one story before moving to the next.
                queue.push(...group);
            }

            return { queue, matchedCount: matched.length };
        }

        return { queue: shuffle(matched), matchedCount: matched.length };
    };

    const ensureImagePreloaded = (url: string): Promise<void> => {
        const normalized = normalizeUrl(url);
        if (!normalized) return Promise.resolve();

        const status = preloadStatusRef.current.get(normalized);
        if (status === 'loaded') return Promise.resolve();

        const existing = preloadPromisesRef.current.get(normalized);
        if (existing) return existing;

        if (typeof window === 'undefined') return Promise.resolve();

        const task = new Promise<void>((resolve) => {
            const img = new window.Image();
            preloadStatusRef.current.set(normalized, 'loading');

            const done = (nextStatus: PreloadStatus) => {
                preloadStatusRef.current.set(normalized, nextStatus);
                preloadPromisesRef.current.delete(normalized);
                resolve();
            };

            img.onload = async () => {
                try {
                    if (typeof img.decode === 'function') {
                        await img.decode();
                    }
                } catch {
                    // decode may reject even when image bytes are usable.
                }
                done('loaded');
            };

            img.onerror = () => {
                done('error');
            };

            try {
                (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = 'high';
            } catch {
                // fetchPriority is not supported in all browsers.
            }

            img.decoding = 'async';
            img.src = normalized;
        });

        preloadPromisesRef.current.set(normalized, task);
        return task;
    };

    const scheduleQueuePreload = () => {
        if (typeof window === 'undefined') return;
        const queue = playbackQueueRef.current;
        if (!queue.length) return;

        const preloadCandidates = queue.slice(0, PRELOAD_AHEAD_COUNT);
        preloadCandidates.forEach((item) => {
            void ensureImagePreloaded(item.image);
        });
    };

    const rebuildPlaybackQueue = () => {
        const { queue, matchedCount } = buildQueue(
            feedModeRef.current,
            mediaFiltersRef.current,
            queueAnchorImageRef.current,
        );
        playbackQueueRef.current = queue;
        setEligibleCount((prev) => (prev === matchedCount ? prev : matchedCount));
        scheduleQueuePreload();
    };

    const resetStack = () => {
        stackRef.current = [];
        setStack((prev) => (prev.length === 0 ? prev : []));
        scrollAccumulatorRef.current = 0;
        lastSpawnTime.current = 0;
        lastActionTime.current = 0;
        lastMousePosRef.current = { x: 0, y: 0 };
        cycleRevealCountRef.current = 0;
        setLastAction('add');
    };

    const normalizeInitialImages = (rawImages: any[]): PoolItem[] => {
        const uniqueByUrl = new Set<string>();
        const out: PoolItem[] = [];

        for (const raw of rawImages || []) {
            const url = normalizeUrl(raw?.image || raw?.cover_image);
            if (!url || uniqueByUrl.has(url)) continue;
            uniqueByUrl.add(url);

            out.push({
                image: url,
                title: raw?.title || 'Untitled',
                storyKey: raw?.slug || raw?.title || 'ungrouped',
                isArt: false,
                isCommercial: false,
            });
        }

        return out;
    };

    // --- SPAWN ---
    const generateCard = (initialOverride: { x: number; y: number } | null = null): Card | null => {
        const now = Date.now();

        if (playbackQueueRef.current.length === 0) {
            rebuildPlaybackQueue();
        }

        let next: PoolItem | undefined;
        let remainingGuard = playbackQueueRef.current.length;

        while (remainingGuard > 0) {
            const candidate = playbackQueueRef.current[0];
            if (!candidate) return null;

            const status = preloadStatusRef.current.get(candidate.image);

            if (status === 'loaded') {
                next = playbackQueueRef.current.shift();
                break;
            }

            if (status === 'error') {
                playbackQueueRef.current.shift();
                remainingGuard -= 1;
                continue;
            }

            void ensureImagePreloaded(candidate.image);
            scheduleQueuePreload();
            return null;
        }

        if (!next) {
            scheduleQueuePreload();
            return null;
        }

        queueAnchorImageRef.current = next.image;
        scheduleQueuePreload();

        zIndexCounter.current += 1;
        totalRevealsRef.current += 1;
        cycleRevealCountRef.current += 1;
        if (!firstInteractionTimeRef.current) {
            firstInteractionTimeRef.current = now;
        }

        if (typeof window !== 'undefined') {
            (window as any).__cardEngagement = {
                reveals: totalRevealsRef.current,
                firstInteraction: firstInteractionTimeRef.current,
                lastInteraction: now,
            };
        }

        return {
            id: `card-${now}-${Math.random()}`,
            image: next.image,
            title: next.title,
            angle: Math.random() * 8 - 4,
            x: Math.random() * 60 - 30,
            y: Math.random() * 60 - 30,
            zIndex: zIndexCounter.current,
            initialPos: initialOverride,
            revealOrder: cycleRevealCountRef.current,
        };
    };

    const attemptSpawn = useCallback((
        force = false,
        initialOverride: { x: number; y: number } | null = null,
    ): boolean => {
        const now = Date.now();
        if (!force && now - lastSpawnTime.current < SPAWN_COOLDOWN_MS) return false;

        const card = generateCard(initialOverride);
        if (!card) return false;

        lastSpawnTime.current = now;
        const newStack = [...stackRef.current, card];

        if (newStack.length > safeMaxStackSize) {
            setLastAction('overflow-trim');
            newStack.splice(0, newStack.length - safeMaxStackSize);
        }
        stackRef.current = newStack;
        setStack(newStack);
        return true;
    }, [SPAWN_COOLDOWN_MS, safeMaxStackSize]);

    const spawnCardFromVector = useCallback((
        x: number,
        y: number,
        options: { force?: boolean; action?: CardStackAction } = {},
    ) => {
        const { force = true, action = 'add' } = options;
        setLastAction(action);
        return attemptSpawn(force, { x, y });
    }, [attemptSpawn]);

    const spawnCardFromEdge = useCallback((
        edge: CardSpawnEdge,
        options: { force?: boolean; action?: CardStackAction } = {},
    ) => {
        switch (edge) {
            case 'bottom':
                return spawnCardFromVector(0, SPAWN_DISTANCE_PX, options);
            case 'left':
                return spawnCardFromVector(-SPAWN_DISTANCE_PX, 0, options);
            case 'right':
                return spawnCardFromVector(SPAWN_DISTANCE_PX, 0, options);
            case 'top':
            default:
                return spawnCardFromVector(0, -SPAWN_DISTANCE_PX, options);
        }
    }, [spawnCardFromVector]);

    const removeTopCard = useCallback((direction: CardReleaseDirection = 'up') => {
        if (stackRef.current.length === 0) {
            scrollAccumulatorRef.current = 0;
            return false;
        }

        const useSoftRelease = stackRef.current.length <= SOFT_EXIT_CARD_THRESHOLD;
        setLastAction(
            direction === 'down'
                ? (useSoftRelease ? 'exit-down-soft' : 'exit-down')
                : (useSoftRelease ? 'exit-up-soft' : 'exit-up'),
        );
        lastActionTime.current = Date.now();
        scrollAccumulatorRef.current = 0;

        const newStack = stackRef.current.slice(0, -1);
        stackRef.current = newStack;
        setStack(newStack);
        return true;
    }, []);

    useIsomorphicLayoutEffect(() => {
        feedModeRef.current = feedMode;
        mediaFiltersRef.current = mediaFilters;
        queueAnchorImageRef.current = queueAnchorImage;
        rebuildPlaybackQueue();

        const shouldPreserveVisibleStack =
            feedMode === 'story' &&
            !!queueAnchorImage &&
            stackRef.current.length > 0;

        if (!shouldPreserveVisibleStack) {
            resetStack();
        }
    }, [feedMode, mediaFilters, queueAnchorImage]);

    useIsomorphicLayoutEffect(() => {
        queueResetKeyRef.current = queueResetKey;
        rebuildPlaybackQueue();
        resetStack();
    }, [queueResetKey]);

    useIsomorphicLayoutEffect(() => {
        if (!isActive) {
            resetStack();
        }
    }, [isActive]);

    // Seed with initial images (fallback) before full dataset loads.
    useEffect(() => {
        if (!initialImages || initialImages.length === 0) return;
        const fallbackPool = normalizeInitialImages(initialImages);
        if (fallbackPool.length === 0) return;

        masterPoolRef.current = fallbackPool;
        rebuildPlaybackQueue();
    }, [initialImages]);

    // Load full dataset and enrich with photo_stories labels.
    useEffect(() => {
        let cancelled = false;

        const shouldSkip = !isActive && (!initialImages || initialImages.length === 0);
        if (shouldSkip) return;

        const hydrate = async () => {
            try {
                const allProjects = await getAllPhotography();
                const uniqueByUrl = new Set<string>();
                const pooled: PoolItem[] = [];

                allProjects.forEach((proj: any) => {
                    const storyKey = proj.slug || proj.title || 'ungrouped';
                    const title = proj.title || 'Untitled';

                    const coverUrl = normalizeUrl(proj.image || proj.cover_image);
                    if (coverUrl && !uniqueByUrl.has(coverUrl)) {
                        uniqueByUrl.add(coverUrl);
                        pooled.push({
                            image: coverUrl,
                            title,
                            storyKey,
                            isArt: false,
                            isCommercial: false,
                        });
                    }

                    const galleryUrls = asStringArray(proj.images);
                    galleryUrls.forEach((rawUrl) => {
                        const url = normalizeUrl(rawUrl);
                        if (!url || uniqueByUrl.has(url)) return;
                        uniqueByUrl.add(url);
                        pooled.push({
                            image: url,
                            title,
                            storyKey,
                            isArt: false,
                            isCommercial: false,
                        });
                    });
                });

                if (pooled.length === 0) return;

                const metaByUrl = await getPhotoStoryMetaByUrls(pooled.map((item) => item.image));
                const enriched = pooled.map((item) => {
                    const meta = metaByUrl.get(item.image);
                    if (!meta) return item;

                    return {
                        ...item,
                        isArt: meta.isArt,
                        isCommercial: meta.isCommercial,
                    };
                });

                if (cancelled) return;
                masterPoolRef.current = enriched;
                rebuildPlaybackQueue();
            } catch (error) {
                console.warn('Failed to hydrate full photo pool:', error);
            }
        };

        hydrate();

        return () => {
            cancelled = true;
        };
    }, [isActive, initialImages]);

    // Kickstart spawns; rerun when mode/filter changes for instant reshuffle.
    useEffect(() => {
        if (!enableKickstart) return undefined;

        let misses = 0;
        const kickstart = setInterval(() => {
            if (!isActive) return;

            if (stackRef.current.length < 4 && getInteractionState().isPointerZone) {
                setLastAction('add');
                const spawned = attemptSpawn(true);
                if (!spawned) {
                    misses += 1;
                    if (misses > 120) clearInterval(kickstart);
                }
                return;
            }

            if (stackRef.current.length >= 4) {
                clearInterval(kickstart);
            }
        }, 200);

        return () => clearInterval(kickstart);
    }, [isActive, feedMode, mediaFilters, queueResetKey, eligibleCount, interactionRef, enableKickstart]);

    // --- WHEEL ---
    useEffect(() => {
        if (!enableWheel) return undefined;

        const handleWheel = (e: WheelEvent) => {
            if (!isActive) return;

            const { isInteractiveZone } = getInteractionState();
            if (!isInteractiveZone) return;

            if (e.deltaY > 0 && stackRef.current.length > 0) {
                e.preventDefault();
            }

            if ((e.deltaY > 0 && scrollAccumulatorRef.current < 0) ||
                (e.deltaY < 0 && scrollAccumulatorRef.current > 0)) {
                scrollAccumulatorRef.current = 0;
            }

            scrollAccumulatorRef.current += e.deltaY;

            if (e.deltaY > 0) {
                setLastAction('exit-up');
            } else if (e.deltaY < 0) {
                setLastAction('add');
            }

            if (scrollAccumulatorRef.current > UNSTACK_THRESHOLD) {
                const now = Date.now();

                // CRITICAL FIX FOR WINDOWS MOUSE:
                // Previously, we clamped the accumulator if we were in cooldown, effectively ignoring rapid "clicks".
                // Now, we ONLY clamp if the delta was small (Trackpad drift).
                // If the user does a big discrete scroll (e.g. 100px), we LET it accumulate so it triggers cleanly next frame.

                if (now - lastActionTime.current < COOLDOWN_MS) {
                    // Only clamp if it looks like continuous drift, not a deliberate click
                    // A discrete click is usually > 40-50 modes.
                    const isDiscreteClick = e.deltaY > 30;

                    if (!isDiscreteClick) {
                        scrollAccumulatorRef.current = Math.min(
                            scrollAccumulatorRef.current,
                            UNSTACK_THRESHOLD * 1.1,
                        );
                    }
                    // If it IS a discrete click, let it ride. The accumulator will hold the value (> Threshold).
                    // On the next wheel event (or a frame loop if we had one), it would re-trigger.
                    // But since we are event-driven, we need to ensure we don't just lose it.
                    // Actually, the logic below "if (potential > 0)" runs EVERY event.
                    // So if we are in cooldown, we just skip the ACTION, but keep the ACCUMULATOR.

                } else {
                    const potential = Math.floor(scrollAccumulatorRef.current / UNSTACK_THRESHOLD);
                    if (potential > 0) {
                        if (stackRef.current.length > 0) {
                            if (removeTopCard('up')) {
                                scrollAccumulatorRef.current = Math.max(
                                    0,
                                    scrollAccumulatorRef.current - UNSTACK_THRESHOLD,
                                );
                            }
                        } else {
                            scrollAccumulatorRef.current = 0;
                        }
                    }
                }
            } else if (scrollAccumulatorRef.current < -RESTACK_THRESHOLD) {
                const potential = Math.floor(
                    Math.abs(scrollAccumulatorRef.current) / RESTACK_THRESHOLD,
                );
                if (potential > 0) {
                    setLastAction('add');
                    attemptSpawn(true);
                    scrollAccumulatorRef.current += RESTACK_THRESHOLD;
                }
            }
        };

        window.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            window.removeEventListener('wheel', handleWheel);
        };
    }, [
        isActive,
        enableWheel,
        UNSTACK_THRESHOLD,
        RESTACK_THRESHOLD,
        COOLDOWN_MS,
        interactionRef,
        attemptSpawn,
        removeTopCard,
    ]);

    // --- SCROLL VISUALS ---
    useEffect(() => {
        const handleScroll = () => {
            if (containerRef.current) {
                if (interactionRef?.current) {
                    containerRef.current.style.transform = '';
                    containerRef.current.style.opacity = '1';
                    return;
                }

                const y = window.scrollY;
                containerRef.current.style.transform = `translateY(-${y * 0.5}px)`;
                const newOp = Math.max(0, 1 - y / 700);
                containerRef.current.style.opacity = newOp.toString();
            }
        };

        handleScroll();
        window.addEventListener('scroll', handleScroll);

        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, [isActive, interactionRef]);

    // --- MOUSE ---
    useEffect(() => {
        if (!enablePointer) {
            lastMousePosRef.current = { x: 0, y: 0 };
            return undefined;
        }

        const handleMove = (e: MouseEvent) => {
            if (!isActive) return;
            if (!getInteractionState().isPointerZone) return;

            if (lastMousePosRef.current.x === 0 && lastMousePosRef.current.y === 0) {
                lastMousePosRef.current = { x: e.clientX, y: e.clientY };
                return;
            }

            const dx = e.clientX - lastMousePosRef.current.x;
            const dy = e.clientY - lastMousePosRef.current.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > MOUSE_MOVE_THRESHOLD) {
                setLastAction('add');

                const angle = Math.atan2(dy, dx);
                const ix = -Math.cos(angle) * SPAWN_DISTANCE_PX;
                const iy = -Math.sin(angle) * SPAWN_DISTANCE_PX;

                spawnCardFromVector(ix, iy, { force: false, action: 'add' });
                lastMousePosRef.current = { x: e.clientX, y: e.clientY };
            }
        };

        window.addEventListener('mousemove', handleMove);
        return () => window.removeEventListener('mousemove', handleMove);
    }, [
        isActive,
        enablePointer,
        MOUSE_MOVE_THRESHOLD,
        interactionRef,
        spawnCardFromVector,
    ]);

    // --- GESTURES ---
    const spawnCardFromGesture = useCallback((dx: number, dy: number, angle: number) => {
        const ix = -Math.cos(angle) * SPAWN_DISTANCE_PX;
        const iy = -Math.sin(angle) * SPAWN_DISTANCE_PX;

        console.log('🚀 GESTURE SPANNING CARD...', { dx, dy, angle, ix, iy });
        spawnCardFromVector(ix, iy, { force: true, action: 'add' });
    }, [spawnCardFromVector]);

    let shouldHideRenderedStack = !isActive;
    if (queueResetKeyRef.current !== queueResetKey) {
        queueResetKeyRef.current = queueResetKey;
        shouldHideRenderedStack = true;
    }

    const renderedStack = shouldHideRenderedStack ? [] : stack;
    const renderedLastAction = shouldHideRenderedStack ? 'add' : lastAction;

    return {
        stack: renderedStack,
        lastAction: renderedLastAction,
        containerRef,
        spawnCardFromGesture,
        spawnCardFromEdge,
        spawnCardFromVector,
        removeTopCard,
        eligibleCount,
    };
};
