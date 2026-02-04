import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CardStacker = ({ images, anchorX = '65%', anchorY = '68%' }) => {
    // --- STATE ---
    const [stack, setStack] = useState([]);
    const [lastAction, setLastAction] = useState('unstack');

    // --- REFS ---
    const stackRef = useRef([]);
    const containerRef = useRef(null);
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
    const readyPoolRef = useRef([]);
    const historyPoolRef = useRef([]);
    const loadedSetWithRef = useRef(new Set());
    const downloadQueueRef = useRef([]);
    const activeDownloadsRef = useRef(0);

    // --- 1. SETUP ---
    useEffect(() => {
        if (images && images.length > 0) {
            const shuffled = [...images].sort(() => Math.random() - 0.5);
            shuffled.forEach(img => addToDownloadQueue(img.image || img.cover_image, img));
        }

        const fetchData = async () => {
            try {
                const res = await fetch('/api/all-photos.json');
                const allPhotos = await res.json();
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
    }, [images]);

    // --- 2. DOWNLOADER ---
    const addToDownloadQueue = (url, metadata) => {
        if (!url || loadedSetWithRef.current.has(url)) return;
        downloadQueueRef.current.push({ url, metadata });
        processDownloadQueue();
    };

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

    // --- 3. SPAWN ---
    const generateCard = (initialOverride = null) => {
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

    const attemptSpawn = (force = false, initialOverride = null) => {
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

    // --- 4. EVENT LOOP ---
    useEffect(() => {
        const handleWheel = (e) => {
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
                        // Passing null uses default behavior (which we'll handle in render props)
                        // OR we can explicitly pass { y: -1200 } here to be safe.
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
                containerRef.current.style.opacity = newOp;
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
        const handleMove = (e) => {
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

    return (
        <div
            className="card-stacker-container"
            ref={containerRef}
        >
            <div className="stack-anchor">
                <AnimatePresence custom={lastAction}>
                    {stack.map(card => {
                        // Determine initial state
                        // If card has explicit initialPos (Mouse spawn), use it.
                        // Else use default Fall from Top (Scroll/System spawn).
                        const initialAnim = card.initialPos ? {
                            opacity: 0,
                            scale: 0.9,
                            x: card.initialPos.x,
                            y: card.initialPos.y,
                            rotate: (Math.random() - 0.5) * 30
                        } : {
                            opacity: 0,
                            scale: 0.9,
                            x: 0,
                            y: -1200, // Default Fall
                            rotate: (Math.random() - 0.5) * 15
                        };

                        return (
                            <motion.div
                                key={card.id}
                                className="stacked-card"
                                custom={lastAction}

                                initial={initialAnim}

                                animate={{
                                    opacity: 1,
                                    scale: 1,
                                    y: card.y,
                                    x: card.x,
                                    rotate: card.angle,
                                    transition: { duration: 0.6, ease: "backOut" }
                                }}

                                exit={(customMode) => {
                                    if (customMode === 'unstack') {
                                        return {
                                            opacity: 0,
                                            y: -1200,
                                            scale: 1.1,
                                            rotate: card.angle * 4,
                                            transition: { duration: 0.6, ease: [0.32, 0, 0.67, 0] }
                                        };
                                    } else {
                                        return {
                                            opacity: 0,
                                            scale: 0.8,
                                            y: 50,
                                            transition: { duration: 0.3 }
                                        };
                                    }
                                }}

                                style={{ zIndex: card.zIndex }}
                            >
                                <img
                                    src={card.image}
                                    alt={card.title}
                                    loading="eager"
                                    decoding="sync"
                                />
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            <style>{`
                .card-stacker-container {
                    position: fixed; 
                    top: 0; right: 0;
                    width: 100%; height: 100vh;
                    pointer-events: none; z-index: 50;
                    will-change: transform, opacity;
                }
                .stack-anchor {
                    position: absolute;
                    top: ${anchorY}; 
                    left: ${anchorX}; 
                    width: 0; height: 0;
                }
                .stacked-card {
                    position: absolute;
                    width: 420px; 
                    aspect-ratio: 16/9;
                    background-color: #fff; 
                    padding: 16px; 
                    border-radius: 2px; 
                    box-shadow: 0 15px 50px rgba(0,0,0,0.15);
                    top: -118px; left: -210px;
                    display: flex; align-items: center; justify-content: center;
                    overflow: hidden; backface-visibility: hidden;
                }
                .stacked-card img {
                    width: 100%; height: 100%;
                    object-fit: cover; display: block;
                    border-radius: 1px; 
                }
            `}</style>
        </div>
    );
};

export default CardStacker;
