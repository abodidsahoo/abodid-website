import { useState, useEffect, useRef } from 'react';
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

interface UseCardPhysicsProps {
    initialImages: any[];
    isActive: boolean;
    feedMode?: FeedMode;
    mediaFilters?: MediaFilter[];
    queueResetKey?: number;
    queueAnchorImage?: string | null;
    cardSensitivity?: number;
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

export const useCardPhysics = ({
    initialImages,
    isActive = true,
    feedMode = 'shuffle',
    mediaFilters = EMPTY_MEDIA_FILTERS,
    queueResetKey = 0,
    queueAnchorImage = null,
    cardSensitivity = 0.55,
}: UseCardPhysicsProps) => {
    // --- STATE ---
    const [stack, setStack] = useState<Card[]>([]);
    const [lastAction, setLastAction] = useState<'unstack' | 'restack' | 'add'>('unstack');
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
    const firstInteractionTimeRef = useRef<number | null>(null);

    const masterPoolRef = useRef<PoolItem[]>([]);
    const playbackQueueRef = useRef<PoolItem[]>([]);
    const preloadStatusRef = useRef<Map<string, PreloadStatus>>(new Map());
    const preloadPromisesRef = useRef<Map<string, Promise<void>>>(new Map());
    const feedModeRef = useRef<FeedMode>(feedMode);
    const mediaFiltersRef = useRef<MediaFilter[]>(mediaFilters);
    const queueAnchorImageRef = useRef<string | null>(queueAnchorImage);

    const sensitivityProfile = buildCardSensitivityProfile(cardSensitivity);

    // ASYMMETRIC PHYSICS
    const UNSTACK_THRESHOLD = sensitivityProfile.unstackThreshold;
    const RESTACK_THRESHOLD = sensitivityProfile.restackThreshold;
    const COOLDOWN_MS = sensitivityProfile.wheelCooldownMs;
    const MOUSE_MOVE_THRESHOLD = sensitivityProfile.mouseThreshold;
    const SPAWN_COOLDOWN_MS = sensitivityProfile.spawnCooldownMs;

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

            let orderedGroups = Array.from(grouped.entries());
            if (anchorImage) {
                const anchorItem = matched.find((item) => item.image === anchorImage);
                const anchorKey = anchorItem?.storyKey || '';
                const anchorIndex = orderedGroups.findIndex(([key]) => key === anchorKey);

                if (anchorIndex > 0) {
                    orderedGroups = [
                        ...orderedGroups.slice(anchorIndex),
                        ...orderedGroups.slice(0, anchorIndex),
                    ];
                }
            }

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

        scheduleQueuePreload();

        zIndexCounter.current += 1;
        totalRevealsRef.current += 1;
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
        };
    };

    const attemptSpawn = (
        force = false,
        initialOverride: { x: number; y: number } | null = null,
    ): boolean => {
        const now = Date.now();
        if (!force && now - lastSpawnTime.current < SPAWN_COOLDOWN_MS) return false;

        const card = generateCard(initialOverride);
        if (!card) return false;

        lastSpawnTime.current = now;
        const newStack = [...stackRef.current, card];

        if (newStack.length > 6) {
            newStack.splice(0, newStack.length - 6);
        }
        stackRef.current = newStack;
        setStack(newStack);
        return true;
    };

    // Keep refs in sync for queue building.
    useEffect(() => {
        feedModeRef.current = feedMode;
        mediaFiltersRef.current = mediaFilters;
        queueAnchorImageRef.current = queueAnchorImage;
        rebuildPlaybackQueue();
        resetStack();
    }, [feedMode, mediaFilters, queueResetKey, queueAnchorImage]);

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
        let misses = 0;
        const kickstart = setInterval(() => {
            if (!isActive) return;

            if (window.scrollY < 50 && stackRef.current.length < 4) {
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
    }, [isActive, feedMode, mediaFilters, queueResetKey, eligibleCount]);

    // --- EVENT LOOP ---
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (!isActive) return;

            const isVisible = window.scrollY < 800;
            if (!isVisible) return;

            if (e.deltaY > 0 && stackRef.current.length > 0) {
                e.preventDefault();
            }

            if ((e.deltaY > 0 && scrollAccumulatorRef.current < 0) ||
                (e.deltaY < 0 && scrollAccumulatorRef.current > 0)) {
                scrollAccumulatorRef.current = 0;
            }

            scrollAccumulatorRef.current += e.deltaY;

            if (e.deltaY > 0) {
                setLastAction('unstack');
            } else if (e.deltaY < 0) {
                setLastAction('restack');
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
                            setLastAction('unstack');
                            lastActionTime.current = now;
                            const newStack = stackRef.current.slice(0, -1);
                            stackRef.current = newStack;
                            setStack(newStack);
                            scrollAccumulatorRef.current -= UNSTACK_THRESHOLD;
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
                    setLastAction('restack');
                    attemptSpawn(true);
                    scrollAccumulatorRef.current += RESTACK_THRESHOLD;
                }
            }
        };

        const handleScroll = () => {
            const y = window.scrollY;
            if (containerRef.current) {
                containerRef.current.style.transform = `translateY(-${y * 0.5}px)`;
                const newOp = Math.max(0, 1 - y / 700);
                containerRef.current.style.opacity = newOp.toString();
            }
        };

        window.addEventListener('wheel', handleWheel, { passive: false });
        window.addEventListener('scroll', handleScroll);

        return () => {
            window.removeEventListener('wheel', handleWheel);
            window.removeEventListener('scroll', handleScroll);
        };
    }, [isActive, UNSTACK_THRESHOLD, RESTACK_THRESHOLD, COOLDOWN_MS]);

    // --- MOUSE ---
    useEffect(() => {
        const handleMove = (e: MouseEvent) => {
            if (!isActive) return;
            if (window.scrollY > 10) return;

            const dx = e.clientX - lastMousePosRef.current.x;
            const dy = e.clientY - lastMousePosRef.current.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > MOUSE_MOVE_THRESHOLD) {
                setLastAction('add');

                const angle = Math.atan2(dy, dx);
                const spawnDist = 1200;
                const ix = -Math.cos(angle) * spawnDist;
                const iy = -Math.sin(angle) * spawnDist;

                attemptSpawn(false, { x: ix, y: iy });
                lastMousePosRef.current = { x: e.clientX, y: e.clientY };
            }
        };

        window.addEventListener('mousemove', handleMove);
        return () => window.removeEventListener('mousemove', handleMove);
    }, [isActive, MOUSE_MOVE_THRESHOLD, SPAWN_COOLDOWN_MS]);

    // --- GESTURES ---
    const spawnCardFromGesture = (dx: number, dy: number, angle: number) => {
        setLastAction('add');

        const spawnDist = 1200;
        const ix = -Math.cos(angle) * spawnDist;
        const iy = -Math.sin(angle) * spawnDist;

        console.log('🚀 GESTURE SPANNING CARD...', { dx, dy, angle, ix, iy });
        attemptSpawn(true, { x: ix, y: iy });
    };

    return {
        stack,
        lastAction,
        containerRef,
        spawnCardFromGesture,
        eligibleCount,
    };
};
