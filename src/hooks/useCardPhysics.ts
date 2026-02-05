import { useState, useEffect, useRef } from 'react';
import { getAllPhotography } from '../lib/services/content';

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

interface UseCardPhysicsProps {
    initialImages: any[];
}

export const useCardPhysics = ({ initialImages }: UseCardPhysicsProps) => {
    // --- STATE ---
    const [stack, setStack] = useState<Card[]>([]);
    const [lastAction, setLastAction] = useState<'unstack' | 'restack' | 'add'>('unstack');

    // --- REFS ---
    const stackRef = useRef<Card[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);
    const lastSpawnTime = useRef(0);
    const lastMousePosRef = useRef({ x: 0, y: 0 });

    const scrollAccumulatorRef = useRef(0);
    // Fix for Z-Index Stacking: Monotonic counter to ensure new cards ALWAYS appear on top
    const zIndexCounter = useRef(100);
    // Cooldown Ref
    const lastActionTime = useRef(0);

    // ASYMMETRIC PHYSICS
    const UNSTACK_THRESHOLD = 35; // Sensitivity High
    const RESTACK_THRESHOLD = 300; // Heavy restack
    const COOLDOWN_MS = 250; // Rhythm control

    // Pools
    const readyPoolRef = useRef<any[]>([]);
    const historyPoolRef = useRef<any[]>([]);
    const loadedSetWithRef = useRef<Set<string>>(new Set());
    const downloadQueueRef = useRef<{ url: string; metadata: any }[]>([]);
    const activeDownloadsRef = useRef(0);

    // --- DOWNLOADER ---
    const processDownloadQueue = () => {
        if (activeDownloadsRef.current >= 4) return;
        if (downloadQueueRef.current.length === 0) return;
        const next = downloadQueueRef.current.shift();
        if (!next) return;
        activeDownloadsRef.current++;
        const img = new Image();
        const done = () => {
            activeDownloadsRef.current--;
            if (!loadedSetWithRef.current.has(next.url)) {
                loadedSetWithRef.current.add(next.url);
                readyPoolRef.current.push(next.metadata);
                historyPoolRef.current.push(next.metadata);
            }
            processDownloadQueue();
        };
        img.onload = done;
        img.onerror = done;
        img.src = next.url;
    };

    const addToDownloadQueue = (url: string, metadata: any) => {
        if (!url || loadedSetWithRef.current.has(url)) return;
        downloadQueueRef.current.push({ url, metadata });
        processDownloadQueue();
    };

    // --- SPAWN ---
    const generateCard = (initialOverride: { x: number; y: number } | null = null): Card | null => {
        const now = Date.now();
        let pool = readyPoolRef.current;
        let isHistory = false;
        if (pool.length === 0) {
            if (historyPoolRef.current.length > 0) {
                pool = historyPoolRef.current;
                isHistory = true;
            } else {
                return null;
            }
        }
        const idx = Math.floor(Math.random() * pool.length);
        const img = pool[idx];
        if (!isHistory) pool.splice(idx, 1);

        // Increment Global Z-Index to strictly guarantee top placement
        zIndexCounter.current += 1;

        return {
            id: `card-${now}-${Math.random()}`,
            image: img.image || img.cover_image,
            title: img.title,
            angle: (Math.random() * 8 - 4),
            x: (Math.random() * 60 - 30),
            y: (Math.random() * 60 - 30),
            zIndex: zIndexCounter.current, // Monotonic increment
            initialPos: initialOverride // Store unique spawn origin
        };
    };

    const attemptSpawn = (force = false, initialOverride: { x: number; y: number } | null = null) => {
        const now = Date.now();
        if (!force && now - lastSpawnTime.current < 100) return;

        const card = generateCard(initialOverride);
        if (!card) return;

        lastSpawnTime.current = now;
        const newStack = [...stackRef.current, card];

        // REDUCED CAP: 6
        if (newStack.length > 6) {
            newStack.splice(0, newStack.length - 6);
        }
        stackRef.current = newStack;
        setStack(newStack);
    };

    // --- 1. SETUP ---
    useEffect(() => {
        if (initialImages && initialImages.length > 0) {
            const shuffled = [...initialImages].sort(() => Math.random() - 0.5);
            shuffled.forEach(img => addToDownloadQueue(img.image || img.cover_image, img));
        }

        const fetchData = async () => {
            try {
                // REFACTOR: Use service layer instead of raw fetch
                const allPhotos = await getAllPhotography();
                const shuffled = allPhotos.sort(() => Math.random() - 0.5);
                const feed = setInterval(() => {
                    if (downloadQueueRef.current.length < 5 && shuffled.length > 0) {
                        const chunk = shuffled.splice(0, 3);
                        chunk.forEach(item => addToDownloadQueue(item.image, item));
                    } else if (shuffled.length === 0) {
                        clearInterval(feed);
                    }
                }, 1000);
            } catch (e) { console.warn(e); }
        };
        fetchData();

        // Small Kickstart
        const kickstart = setInterval(() => {
            if (window.scrollY < 50 && stackRef.current.length < 4) {
                setLastAction('add');
                attemptSpawn(true);
            } else {
                clearInterval(kickstart);
            }
        }, 200);

        return () => clearInterval(kickstart);
    }, [initialImages]);

    // --- 4. EVENT LOOP ---
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            const isVisible = window.scrollY < 800;

            if (isVisible) {
                // LOCK SCROLL: Prevent page rubber-banding so flick energy goes to cards
                if (e.deltaY > 0 && stackRef.current.length > 0) {
                    e.preventDefault();
                }

                // Zero Latency Reset
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

                // A. UNSTACK
                if (scrollAccumulatorRef.current > UNSTACK_THRESHOLD) {
                    const now = Date.now();

                    // Rate Limit: Only allow unstack if cooldown passed
                    if (now - lastActionTime.current < COOLDOWN_MS) {
                        // In cooldown: Cap momentum so we don't queue up 10 unstacks
                        scrollAccumulatorRef.current = Math.min(scrollAccumulatorRef.current, UNSTACK_THRESHOLD * 1.1);
                    } else {
                        const potential = Math.floor(scrollAccumulatorRef.current / UNSTACK_THRESHOLD);
                        if (potential > 0) {
                            const hasCards = stackRef.current.length > 0;
                            if (hasCards) {
                                setLastAction('unstack');
                                lastActionTime.current = now;
                                const removeCount = 1;
                                const newStack = stackRef.current.slice(0, -removeCount);
                                stackRef.current = newStack;
                                setStack(newStack);
                                scrollAccumulatorRef.current -= (removeCount * UNSTACK_THRESHOLD);
                            } else {
                                scrollAccumulatorRef.current = 0;
                            }
                        }
                    }
                }
                // B. RESTACK 
                else if (scrollAccumulatorRef.current < -RESTACK_THRESHOLD) {
                    const potential = Math.floor(Math.abs(scrollAccumulatorRef.current) / RESTACK_THRESHOLD);
                    if (potential > 0) {
                        setLastAction('restack');
                        const addCount = 1;
                        // Force spawn (Scroll always spawns from TOP)
                        for (let i = 0; i < addCount; i++) attemptSpawn(true);
                        scrollAccumulatorRef.current += (addCount * RESTACK_THRESHOLD);
                    }
                }
            }
        };

        const handleScroll = () => {
            const y = window.scrollY;
            if (containerRef.current) {
                containerRef.current.style.transform = `translateY(-${y * 0.5}px)`;
                const newOp = Math.max(0, 1 - (y / 700));
                containerRef.current.style.opacity = newOp.toString();
            }
        };

        window.addEventListener('wheel', handleWheel, { passive: false });
        window.addEventListener('scroll', handleScroll);

        return () => {
            window.removeEventListener('wheel', handleWheel);
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    // --- 5. MOUSE ---
    useEffect(() => {
        const handleMove = (e: MouseEvent) => {
            if (window.scrollY > 10) return;
            const dx = e.clientX - lastMousePosRef.current.x;
            const dy = e.clientY - lastMousePosRef.current.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 150) {
                setLastAction('add');

                // Calculate entering vector
                // We want card to move IN THE DIRECTION of the mouse.
                // So start position is OPPOSITE to velocity.
                const angle = Math.atan2(dy, dx);
                const spawnDist = 1200; // Far off screen
                const ix = -Math.cos(angle) * spawnDist;
                const iy = -Math.sin(angle) * spawnDist;

                attemptSpawn(false, { x: ix, y: iy });

                lastMousePosRef.current = { x: e.clientX, y: e.clientY };
            }
        };
        window.addEventListener('mousemove', handleMove);
        return () => window.removeEventListener('mousemove', handleMove);
    }, []);

    return { stack, lastAction, containerRef };
};
