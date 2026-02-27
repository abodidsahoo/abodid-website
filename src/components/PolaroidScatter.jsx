import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import PaletteExtractor, { analyzeImage } from "./PaletteExtractor.jsx";
import MoodboardPolaroidViewer from "./MoodboardPolaroidViewer.jsx";

const PolaroidScatter = ({ items, immersive = false, deepLinkParam = '' }) => {
    const [selectedId, setSelectedId] = useState(null);
    const containerRef = useRef(null);
    const [scatteredItems, setScatteredItems] = useState([]);
    const [maxZIndex, setMaxZIndex] = useState(10);
    const [isDarkBg, setIsDarkBg] = useState(true);
    const assetCacheRef = useRef({});
    const probedUrlsRef = useRef(new Set());
    const deepLinkInitializedRef = useRef(false);
    const [visibleRange, setVisibleRange] = useState({ top: -Infinity, bottom: Infinity });

    // Track Background Brightness for UI Adaptivity
    useEffect(() => {
        const checkBg = () => {
            const root = document.documentElement;
            const bg = getComputedStyle(root).getPropertyValue('--polaroid-hub-bg').trim() || '#080808';

            // Simple brightness check (Y = 0.299R + 0.587G + 0.114B)
            // Handle hex and rgb
            let r, g, b;
            if (bg.startsWith('#')) {
                const hex = bg.slice(1);
                r = parseInt(hex.substring(0, 2), 16);
                g = parseInt(hex.substring(2, 4), 16);
                b = parseInt(hex.substring(4, 6), 16);
            } else if (bg.startsWith('rgb')) {
                const match = bg.match(/\d+/g);
                if (match) [r, g, b] = match.map(Number);
            }

            if (r !== undefined) {
                const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                setIsDarkBg(brightness < 128);
            }
        };

        checkBg();
        // Create an observer for style changes if possible, or just interval
        const interval = setInterval(checkBg, 1000);
        return () => clearInterval(interval);
    }, []);

    // Pre-probe all images like VisualMoodboard (warm cache + dimensions)
    useEffect(() => {
        if (typeof window === 'undefined') return;
        let cancelled = false;
        const list = Array.isArray(items) ? items : [];

        list.forEach((item) => {
            const imageUrl = item?.cover_image || item?.image || item?.url;
            if (!imageUrl) return;
            if (probedUrlsRef.current.has(imageUrl)) return;
            probedUrlsRef.current.add(imageUrl);

            const probe = new window.Image();
            probe.decoding = 'async';
            probe.loading = 'eager';
            probe.onload = () => {
                if (cancelled) return;
                const dimensions = {
                    width: probe.naturalWidth || 1,
                    height: probe.naturalHeight || 1,
                };
                const existing = assetCacheRef.current[imageUrl] || {};
                assetCacheRef.current[imageUrl] = { ...existing, dimensions };
            };
            probe.onerror = () => {
                if (cancelled) return;
                if (!assetCacheRef.current[imageUrl]) {
                    assetCacheRef.current[imageUrl] = {
                        dimensions: { width: 1, height: 1 },
                    };
                }
            };
            probe.src = imageUrl;
        });

        return () => {
            cancelled = true;
        };
    }, [items]);

    const deepLinkKey = deepLinkParam.trim();

    const syncDeepLink = (itemId) => {
        if (!deepLinkKey || typeof window === 'undefined') return;
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

    // Initial random scatter (Pre-Chunked Units + Spiral Wave)
    useEffect(() => {
        if (items.length > 0 && scatteredItems.length === 0) {

            // 1. Group items by Story (slug)
            const storyGroups = {};
            items.forEach(item => {
                const s = item.slug || 'misc';
                if (!storyGroups[s]) storyGroups[s] = [];
                storyGroups[s].push(item);
            });

            // 2. Create "Visual Units" from each story
            // Each Unit is a guaranteed thematic block (Cluster, Pair, or Single)
            const visualUnits = [];

            Object.keys(storyGroups).forEach(slug => {
                const group = [...storyGroups[slug]]; // Copy to consume

                while (group.length > 0) {
                    const r = Math.random();
                    let type = 'single';

                    // Determine Unit Type preferences
                    // Strong bias for Clusters to fulfill "Same bucket" requirement visibly
                    // 70% chance for cluster if enough items
                    if (group.length >= 3 && r > 0.3) type = 'cluster';
                    else if (group.length >= 2 && r > 0.15) type = 'pair';

                    if (type === 'cluster') {
                        // Larger clusters: 3-5 items
                        const maxTake = Math.min(5, group.length);
                        const clusterSize = Math.floor(Math.random() * (maxTake - 2)) + 3; // 3 to maxTake
                        const count = Math.min(clusterSize, group.length);
                        visualUnits.push({ type: 'cluster', items: group.splice(0, count) });
                    } else if (type === 'pair') {
                        visualUnits.push({ type: 'pair', items: group.splice(0, 2) });
                    } else {
                        visualUnits.push({ type: 'single', items: group.splice(0, 1) });
                    }
                }
            });

            // 3. Shuffle the Visual Units to mix stories globally
            // This gives the "Story A Cluster -> Story B Single -> Story C Cluster" rhythm
            for (let i = visualUnits.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [visualUnits[i], visualUnits[j]] = [visualUnits[j], visualUnits[i]];
            }

            // 4. Place Units along the Spiral Path
            const generatedItems = [];
            let currentY = immersive ? 150 : -50;
            const rand = (min, max) => Math.random() * (max - min) + min;
            let t = 0; // Wave phase

            visualUnits.forEach((unit, uIndex) => {

                // Spiral Path Center
                const waveX = Math.sin(t) * 450;

                // Smart Loading: Calculate Chunk Index (groups of 30)
                // We use global item index to determine chunk.
                const currentItemCount = generatedItems.length;
                const chunkIndex = Math.floor(currentItemCount / 30);

                if (unit.type === 'cluster') {
                    // --- CLUSTER (Thematic Pile) ---
                    const centerY = currentY + rand(-30, 30);

                    unit.items.forEach((item, i) => {
                        // In a cluster, the last item (length - 1) has the highest zIndex (top).
                        // i goes from 0 to length-1.
                        const isTop = (i === unit.items.length - 1);

                        // Priority 0 = Chunk 0 Top
                        // Priority 1 = Chunk 0 Buried
                        // Priority 2 = Chunk 1 Top...
                        // Formula: (Chunk * 2) + (isTop ? 0 : 1)
                        const priority = (chunkIndex * 2) + (isTop ? 0 : 1);

                        generatedItems.push({
                            ...item,
                            type: 'photo',
                            x: waveX + rand(-50, 50),
                            y: centerY + rand(-50, 50),
                            rotation: rand(-15, 15),
                            scale: rand(0.95, 1.05),
                            zIndex: (uIndex * 10) + i + 1,
                            isLarge: false,
                            id: item.id || `generated-${uIndex}-${i}-${Math.random().toString(36).substr(2, 9)}`,
                            priority: priority // NEW: For smart loading
                        });
                    });
                    currentY += rand(300, 380);

                } else if (unit.type === 'pair') {
                    // --- PAIR ---
                    const item1 = unit.items[0]; // Buried (z+1)
                    const item2 = unit.items[1]; // Top (z+2)

                    const pBuried = (chunkIndex * 2) + 1;
                    const pTop = (chunkIndex * 2) + 0;

                    generatedItems.push({
                        ...item1, type: 'photo',
                        x: waveX - 140, y: currentY + rand(-20, 20),
                        rotation: rand(-10, 5), scale: 1,
                        zIndex: (uIndex * 10) + 1, isLarge: false,
                        id: item1.id || `generated-${uIndex}-p1-${Math.random().toString(36).substr(2, 9)}`,
                        priority: pBuried
                    });

                    generatedItems.push({
                        ...item2, type: 'photo',
                        x: waveX + 140, y: currentY + rand(-20, 20),
                        rotation: rand(-5, 10), scale: 1,
                        zIndex: (uIndex * 10) + 2, isLarge: false,
                        id: item2.id || `generated-${uIndex}-p2-${Math.random().toString(36).substr(2, 9)}`,
                        priority: pTop
                    });

                    currentY += rand(250, 320);

                } else {
                    // --- SINGLE ---
                    const item = unit.items[0]; // Top
                    const pTop = (chunkIndex * 2) + 0;

                    generatedItems.push({
                        ...item,
                        type: 'photo',
                        x: waveX + rand(-20, 20),
                        y: currentY,
                        rotation: rand(-10, 10),
                        scale: 1,
                        zIndex: (uIndex * 10) + 1,
                        isLarge: false,
                        id: item.id || `generated-${uIndex}-s-${Math.random().toString(36).substr(2, 9)}`,
                        priority: pTop
                    });
                    currentY += rand(220, 280);
                }

                // Advance Wave
                t += 1.2 + rand(-0.2, 0.2);
            });

            setScatteredItems(generatedItems);
            const currentMax = Math.max(...generatedItems.map(i => i.zIndex || 0), 10);
            setMaxZIndex(currentMax);
        }
    }, [items, scatteredItems.length, immersive]);

    useEffect(() => {
        if (!deepLinkKey || typeof window === 'undefined') return;
        if (deepLinkInitializedRef.current) return;
        if (!scatteredItems.length) return;

        const requestedId = new URLSearchParams(window.location.search).get(deepLinkKey);
        if (requestedId && scatteredItems.some((item) => item.id === requestedId)) {
            setSelectedId(requestedId);
        } else if (requestedId) {
            syncDeepLink('');
        }
        deepLinkInitializedRef.current = true;
    }, [deepLinkKey, scatteredItems]);

    useEffect(() => {
        if (!selectedId) return;
        if (scatteredItems.some((item) => item.id === selectedId)) return;
        setSelectedId(null);
        syncDeepLink('');
    }, [selectedId, scatteredItems]);

    // PERF NOTE: Rendering every polaroid at once is expensive (hundreds of images + shadows).
    // Culling offscreen cards keeps pointer/scroll smooth without changing the visual layout.
    useEffect(() => {
        if (!immersive || typeof window === 'undefined') {
            setVisibleRange({ top: -Infinity, bottom: Infinity });
            return () => {};
        }

        let rafId = 0;
        const updateRange = () => {
            const containerTop = containerRef.current?.offsetTop ?? 0;
            const scrollY = window.scrollY || 0;
            const viewportH = window.innerHeight || 0;
            const buffer = Math.max(1200, viewportH * 1.5);
            setVisibleRange({
                top: scrollY - buffer - containerTop,
                bottom: scrollY + viewportH + buffer - containerTop,
            });
        };

        const onScroll = () => {
            if (rafId) return;
            rafId = window.requestAnimationFrame(() => {
                rafId = 0;
                updateRange();
            });
        };

        updateRange();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        return () => {
            if (rafId) window.cancelAnimationFrame(rafId);
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
        };
    }, [immersive]);

    // --- SMART LOADING CONTROLLER ---
    // Gradually release priorities to ensure "Top 30" load before "Buried 30"
    const [maxPriorityAllowed, setMaxPriorityAllowed] = useState(0);
    const smartLoadingEnabled = !immersive;

    useEffect(() => {
        if (!smartLoadingEnabled) {
            setMaxPriorityAllowed(Number.POSITIVE_INFINITY);
            return () => {};
        }

        // Start cascading the loads
        const interval = setInterval(() => {
            setMaxPriorityAllowed(prev => {
                // If we've reached a high enough number to cover everything, stop?
                // Or just keep incrementing. It's cheap.
                if (prev > 100) {
                    clearInterval(interval);
                    return prev;
                }
                return prev + 1;
            });
        }, 200); // New batch every 200ms
        // Priority 0: Instant.
        // Priority 1: 200ms.
        // Priority 2: 400ms.

        return () => clearInterval(interval);
    }, [smartLoadingEnabled]);

    // ... handlers ...
    const handleSelect = (id) => {
        if (!id) return;

        // If something is already selected (lightbox open), 
        // ANY click on a card should just close the lightbox, not switch.
        if (selectedId) {
            setSelectedId(null);
            syncDeepLink('');
            return;
        }

        const selectedItem = scatteredItems.find((item) => item.id === id);
        if (selectedItem) {
            const imageUrl = selectedItem.cover_image || selectedItem.image || selectedItem.url;
            if (imageUrl) {
                const preloadImage = new Image();
                preloadImage.src = imageUrl;
            }
            if (typeof selectedItem.priority === 'number') {
                setMaxPriorityAllowed((prev) => Math.max(prev, selectedItem.priority));
            }
        }

        // Otherwise open the clicked one
        setSelectedId(id);
        syncDeepLink(id);
    };

    const handleDragStart = (id) => {
        const newMax = maxZIndex + 1;
        setMaxZIndex(newMax);
        setScatteredItems(prev => {
            const next = [...prev];
            const idx = next.findIndex((item) => item.id === id);
            if (idx === -1) return prev;
            next[idx] = { ...next[idx], zIndex: newMax };
            return next;
        });
    };

    const handleRotate = (id, deltaRotation) => {
        setScatteredItems(prev => {
            const next = [...prev];
            const idx = next.findIndex((item) => item.id === id);
            if (idx === -1) return prev;
            next[idx] = { ...next[idx], rotation: next[idx].rotation + deltaRotation };
            return next;
        });
    };

    const handleDragEnd = (id, info) => {
        setScatteredItems(prev => {
            const next = [...prev];
            const idx = next.findIndex((item) => item.id === id);
            if (idx === -1) return prev;
            next[idx] = {
                ...next[idx],
                x: next[idx].x + info.offset.x,
                y: next[idx].y + info.offset.y
            };
            return next;
        });
    };

    // STRICT ID MATCHING ONLY. No slug fallback.
    const maxY = scatteredItems.length > 0 ? Math.max(...scatteredItems.map(i => i.y)) : 2000;
    // Note: We don't need padding-top 0 anymore if we aren't managing background here, but keeping basic layout is fine
    const dynamicStyle = immersive ? { minHeight: `${maxY + 600}px`, alignItems: 'flex-start' } : {};

    const viewerItems = useMemo(
        () =>
            scatteredItems
                .map((item) => {
                    const imageUrl = item.cover_image || item.image || item.url;
                    if (!imageUrl) return null;
                    const projectHref = item.link || item.projectHref || item.href || '';
                    return {
                        id: item.id,
                        title: item.title || 'Untitled',
                        imageUrl,
                        caption: item.caption || '',
                        projectHref,
                        href: projectHref,
                    };
                })
                .filter(Boolean),
        [scatteredItems],
    );

    const visibleItems = useMemo(() => {
        if (!immersive) return scatteredItems;
        return scatteredItems.filter(
            (item) => item.y >= visibleRange.top && item.y <= visibleRange.bottom,
        );
    }, [immersive, scatteredItems, visibleRange]);

    const handleViewerClose = () => {
        setSelectedId(null);
        syncDeepLink('');
    };

    const handleViewerChange = (id) => {
        if (!id) return;
        setSelectedId(id);
        syncDeepLink(id);
    };

    return (
        // REMOVED 'cutting-mat' class - background is now in parent Astro page for instant load
        <div className={`polaroid-scatter-container ${immersive ? 'immersive' : ''}`} ref={containerRef} style={dynamicStyle} onClick={handleViewerClose}>
            {/* REMOVED grid-overlay - moved to parent CSS */}

            {visibleItems.map((item) => {
                // strict ID match
                const isSelected = selectedId === item.id;
                return (
                    <PolaroidCard
                        key={item.id} // use strict ID
                        item={item}
                        isSelected={isSelected}
                        onSelect={() => handleSelect(item.id)} // use strict ID
                        dragConstraints={containerRef}
                        onDragStart={() => handleDragStart(item.id)}
                        onDragEnd={(_, info) => handleDragEnd(item.id, info)}
                        onRotate={(delta) => handleRotate(item.id, delta)}
                        isDarkBg={isDarkBg}
                        maxPriorityAllowed={maxPriorityAllowed}
                        smartLoadingEnabled={smartLoadingEnabled}
                    />
                );
            })}

            {selectedId && (
                <MoodboardPolaroidViewer
                    items={viewerItems}
                    activeId={selectedId}
                    onClose={handleViewerClose}
                    onChange={handleViewerChange}
                />
            )}

            <style>{`
                .polaroid-scatter-container {
                    position: relative;
                    width: 100vw;
                    margin-left: 50%;
                    transform: translateX(-50%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                    margin-bottom: 2rem;
                    user-select: none;
                }
                .polaroid-scatter-container.immersive { overflow: visible; margin-bottom: 0; }
                
                /* Removed .cutting-mat and .grid-overlay styles */
            `}</style>
        </div>
    );
};

const PolaroidCard = ({ item, isSelected, onSelect, onDragStart, onDragEnd, onRotate, isDarkBg, maxPriorityAllowed, smartLoadingEnabled }) => {
    // Track drag state to prevent triggering click (select) after a drag
    const isDraggingRef = useRef(false);
    const isPriorityImage = item?.isCover || item?.priority === 0;

    // --- SMART LOADING CHECK ---
    // If item.priority is undefined, load by default (legacy/fallback).
    // If defined, check against threshold.
    const shouldLoad = !smartLoadingEnabled || (item.priority === undefined) || (item.priority <= maxPriorityAllowed);

    return (
        <motion.div
            className='polaroid-card'
            drag
            dragMomentum={false}
            whileDrag={{ scale: 1.05, zIndex: 9999, cursor: 'grabbing', boxShadow: "0 40px 80px rgba(0,0,0,0.5)" }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ x: item.x, y: item.y, rotate: item.rotation, scale: item.scale, zIndex: item.zIndex, opacity: 1, boxShadow: "2px 3px 10px rgba(0,0,0,0.25)" }}
            transition={{ duration: 0.2 }}

            // Handlers
            onDragStart={(e, info) => {
                isDraggingRef.current = true;
                onDragStart && onDragStart(e, info);
            }}
            onDragEnd={(e, info) => {
                // Short timeout prevents the immediate 'click' event from firing on release
                setTimeout(() => { isDraggingRef.current = false; }, 200);
                onDragEnd && onDragEnd(e, info);
            }}

            // Use onClick for clicks - standard React event better for stopPropagation
            onClick={(event) => {
                if (isDraggingRef.current) return; // Ignore if it was a drag

                // STOP PROPAGATION to prevent clicking "through" the card to the container
                if (event && event.stopPropagation) event.stopPropagation();
                onSelect();
            }}
        >
            <div className="polaroid-inner">
                <div className="image-area" style={{ backgroundColor: shouldLoad ? '#222' : '#f0f0f0' }}>
                    {/* Only render SRC if permitted. Simulates prioritized download queue. */}
                    {shouldLoad ? (
                        <img
                            src={item.cover_image || item.image || item.url}
                            alt={item.title}
                            loading={isPriorityImage ? 'eager' : 'lazy'}
                            decoding={isPriorityImage ? 'sync' : 'async'}
                            draggable="false"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {/* Optional: Spinner or just blank */}
                        </div>
                    )}
                </div>

                {/* ROTATION HANDLES - Positioned strictly on white border corners */}
                <RotationHandle position="top-left" onRotate={onRotate} isDarkBg={isDarkBg} />
                <RotationHandle position="top-right" onRotate={onRotate} isDarkBg={isDarkBg} />
                <RotationHandle position="bottom-left" onRotate={onRotate} isDarkBg={isDarkBg} />
                <RotationHandle position="bottom-right" onRotate={onRotate} isDarkBg={isDarkBg} />
            </div>
            <style>{`
                .polaroid-card {
                    position: absolute;
                    width: 300px; /* Standardized width */
                    box-sizing: border-box; 
                    background: #fdfdfd; /* Pure white paper */
                    padding: 18px; padding-bottom: 85px; /* Real 6% side border ratio */
                    cursor: grab; border-radius: 2px;
                    transform-origin: center center;
                    
                    /* Real 3D Stuff: Deeper, darker shadow for lift */
                    box-shadow: 
                        1px 2px 4px rgba(60,60,60,0.1), /* Ambient contact shadow */
                        5px 8px 24px rgba(0,0,0,0.5); /* Deep lift shadow */
                        
                    /* Hardware accel */
                    will-change: transform;
                    touch-action: none;
                }
                .polaroid-card:hover {
                    cursor: pointer;
                }
                .polaroid-card:active {
                    cursor: grabbing;
                }

                .polaroid-inner { position: relative; width: 100%; height: 100%; }
                .image-area { width: 100%; aspect-ratio: 1/1; background: #222; overflow: hidden; position: relative; }
                .image-area img { width: 100%; height: 100%; object-fit: cover; }

                /* ROTATION HANDLE STYLES */
                .rotation-handle {
                    position: absolute;
                    /* Smaller hit area, push it to the absolute tips */
                    width: 38px;
                    height: 38px;
                    z-index: 100;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: crosshair; /* Fallback but mostly hidden */
                }
                
                .rotation-handle .arrow-container {
                    position: absolute;
                    opacity: 0;
                    transition: opacity 0.2s, transform 0.2s;
                    pointer-events: none;
                    transform-origin: center;
                }

                /* Show arrows only on corner interaction */
                .rotation-handle:hover .arrow-container,
                .rotation-handle.active .arrow-container {
                    opacity: 1;
                }

                /* Positioning handles strictly at the corners. 
                   Pushing them out even more to be "outside" the card. */
                .h-top-left { top: -15px; left: -15px; }
                .h-top-left .arrow-container { top: -25px; left: -25px; transform: rotate(0deg); }
                
                .h-top-right { top: -15px; right: -15px; }
                .h-top-right .arrow-container { top: -25px; right: -25px; transform: rotate(90deg); }
                
                .h-bottom-left { bottom: -15px; left: -15px; }
                .h-bottom-left .arrow-container { bottom: -25px; left: -25px; transform: rotate(270deg); }
                
                .h-bottom-right { bottom: -15px; right: -15px; }
                .h-bottom-right .arrow-container { bottom: -25px; right: -25px; transform: rotate(180deg); }
            `}</style>
        </motion.div>
    );
};

// SVG for the double-headed curved arrow (Photoshop style)
const CurvedArrow = ({ isDarkBg }) => (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>
        {/* The Curve */}
        <path d="M10 25C10 16.7157 16.7157 10 25 10" stroke={isDarkBg ? 'white' : '#222'} strokeWidth="2" strokeLinecap="round" />
        {/* Top Arrow Head */}
        <path d="M21 7L25 10L21 13" stroke={isDarkBg ? 'white' : '#222'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Bottom Arrow Head */}
        <path d="M7 21L10 25L13 21" stroke={isDarkBg ? 'white' : '#222'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// HELPER: Rotation Handle Component
const RotationHandle = ({ position, onRotate, isDarkBg }) => {
    const [isActive, setIsActive] = useState(false);
    const lastAngle = useRef(0);

    const handlePointerDown = (e) => {
        e.stopPropagation();
        setIsActive(true);

        const card = e.currentTarget.closest('.polaroid-card');
        const rect = card.getBoundingClientRect();

        // Exact center of the card
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        lastAngle.current = Math.atan2(e.clientY - centerY, e.clientX - centerX);

        const handlePointerMove = (moveEvent) => {
            const currentAngle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX);
            const delta = currentAngle - lastAngle.current;

            // Smoother movement logic: use a lower sensitivity for precision gesture
            const rotationSensitivity = 0.5; // Adjusted for "smoother" feeling
            onRotate(delta * (180 / Math.PI) * rotationSensitivity);

            lastAngle.current = currentAngle;
        };

        const handlePointerUp = () => {
            setIsActive(false);
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('pointerup', handlePointerUp);
        };

        document.addEventListener('pointermove', handlePointerMove, { passive: true });
        document.addEventListener('pointerup', handlePointerUp);
    };

    return (
        <div
            className={`rotation-handle h-${position} ${isActive ? 'active' : ''}`}
            onPointerDown={handlePointerDown}
        >
            <div className="arrow-container"><CurvedArrow isDarkBg={isDarkBg} /></div>
        </div>
    );
};


const Lightbox = ({ items, initialId, onClose, assetCacheRef }) => {
    const initialIndex = items.findIndex(i => i.id === initialId);
    const [currentIndex, setCurrentIndex] = useState(initialIndex !== -1 ? initialIndex : 0);
    const [mounted, setMounted] = useState(false);

    // --- INTRODUCING ASSET CACHE ---
    // Stores: { [url]: { dimensions: {w, h}, palette: [...], bg: 'rgb(...)' } }
    // This allows us to "predict" the future.
    const fallbackCacheRef = useRef({});
    const cacheRef = assetCacheRef || fallbackCacheRef;

    // Calculate URL for current item
    const currentItem = items[currentIndex];
    const imageUrl = currentItem.cover_image || currentItem.image || currentItem.url;
    const projectHref = currentItem.link || currentItem.projectHref || currentItem.href || '';

    // Check Cache for INITIAL STATE
    const cachedData = cacheRef.current[imageUrl];

    // If we have cached dimensions, calculating width is deterministic math, not DOM reading.
    // Assume max height is roughly 85vh (Need to match CSS).
    // Let's grab viewport height for calculation.
    let initialWidth = 'auto';
    if (cachedData && cachedData.dimensions) {
        // MATCH CSS: .lightbox-image-area img { maxHeight: 65vh; }
        // We can approximate 65vh to px.
        const vh = window.innerHeight * 0.65; // Corrected to 65vh based on CSS
        const aspect = cachedData.dimensions.width / cachedData.dimensions.height;
        const targetWidth = vh * aspect;
        initialWidth = `${Math.round(targetWidth)}px`;
    }

    const [layoutWidth, setLayoutWidth] = useState(initialWidth);
    const [isLayoutStable, setIsLayoutStable] = useState(!!cachedData); // Stable if cached!
    const [loading, setLoading] = useState(!cachedData);
    const imgRef = useRef(null);

    // --- SHUTTER TRANSITION STATE ---
    // 'shutterState': 'open' (default), 'closing' (animating in), 'closed' (full black), 'opening' (animating out)
    const [shutterState, setShutterState] = useState('open');
    const [pendingOffset, setPendingOffset] = useState(0); // Direction we WANT to go

    const [overlayColor, setOverlayColor] = useState(
        (cachedData && cachedData.bg)
            ? cachedData.bg.replace('rgb', 'rgba').replace(')', ', 0.95)')
            : 'rgba(10,10,10,0.95)'
    );

    const handleImageLoad = () => {
        setLoading(false);
        if (imgRef.current) {
            const newWidth = `${imgRef.current.clientWidth}px`;
            // If we guessed wrong with cache, or if no cache, correct it now.
            if (newWidth !== layoutWidth) {
                setLayoutWidth(newWidth);
            }
            setIsLayoutStable(true);
        }
    };

    // 1. WATCH FOR STABILITY TO TRIGGER OPEN (SHUTTER LOGIC)
    useEffect(() => {
        // Only open if we are fully closed (image switched & loaded & layout ready)
        // OR if we are 'closing' but somehow everything is ready fast (rare race condition, safer to wait for closed)
        if (isLayoutStable && shutterState === 'closed') {
            // Small delay to ensure DOM paint/layout before opening shutter
            // This prevents the "flash of unstyled content"
            const t = setTimeout(() => setShutterState('opening'), 50);
            return () => clearTimeout(t);
        }
    }, [isLayoutStable, shutterState]);


    // (Removed extra layout buffering to match VisualMoodboard speed.)

    // Reset state on image change (When currentIndex actually updates)
    useEffect(() => {
        setLoading(true);

        // --- INSTANT RESIZE FROM CACHE ---
        const currentItem = items[currentIndex];
        const url = currentItem.cover_image || currentItem.image || currentItem.url;
        const cachedData = cacheRef.current[url];

        if (cachedData && cachedData.dimensions) {
            // Match CSS: max-height: 65vh, max-width: 80vw
            const maxH = window.innerHeight * 0.65;
            const maxW = window.innerWidth * 0.80;
            const aspect = cachedData.dimensions.width / cachedData.dimensions.height;

            // Calculate width based on height constraint first
            let targetWidth = maxH * aspect;

            // Apply width constraint
            if (targetWidth > maxW) {
                targetWidth = maxW;
            }

            setLayoutWidth(`${Math.round(targetWidth)}px`);

            // Trust the cache? Maybe wait for image load to confirm, but this stops the jump.
            // We set isLayoutStable to false briefly to allow the "Content Swap" processing if needed,
            // but effectively we want the container to ALREADY be the right size.
            setIsLayoutStable(true);
        } else {
            // No cache? Fallback.
            setIsLayoutStable(false);
        }

        // --- INSTANT BACKGROUND FROM CACHE ---
        if (cachedData && cachedData.bg) {
            const rgba = cachedData.bg.replace('rgb', 'rgba').replace(')', ', 0.95)');
            setOverlayColor(rgba);
        }

        // ABSOLUTE FAILSAFE: Ensure visibility after 800ms
        const safety = setTimeout(() => {
            setLoading(false);
            setIsLayoutStable(true);
        }, 800);
        return () => clearTimeout(safety);
    }, [currentIndex, items]);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleDominantColor = (rgbString) => {
        // INSTANT APPLY: No transition.
        const rgba = rgbString.replace('rgb', 'rgba').replace(')', ', 0.95)');
        setOverlayColor(rgba);
    };


    // --- NAVIGATION HANDLERS ---
    // Instead of switching immediately, we request a shutter close.
    const requestSwitch = (offset) => {
        if (shutterState !== 'open' && shutterState !== 'opening') return; // Prevent double-clicks

        setPendingOffset(offset);
        setShutterState('closing');
    };

    const nextImage = (e) => {
        if (e) e.stopPropagation();
        requestSwitch(1);
    };

    const prevImage = (e) => {
        if (e) e.stopPropagation();
        requestSwitch(-1);
    };

    // --- ANIMATION CALLBACKS ---
    const handleShutterClosed = () => {
        // 1. Shutter is fully black.
        setShutterState('closed');

        // 2. NOW we switch the image content.
        // This will trigger the useEffect([currentIndex]) -> setLoading(true) -> isLayoutStable(false)
        if (pendingOffset !== 0) {
            setCurrentIndex((prev) => (prev + pendingOffset + items.length) % items.length);
            setPendingOffset(0); // Reset
        }
    };

    const handleShutterOpened = () => {
        setShutterState('open');
    };

    // --- ANIMATION FRAME SYNC ---
    // Ensure we don't spam state updates.

    // --- AGGRESSIVE DATA PRE-FETCHING ---
    useEffect(() => {
        // Preload +/- 5 images AND their headers/palettes
        const indexesToPreload = [];
        for (let i = 1; i <= 5; i++) {
            indexesToPreload.push((currentIndex + i) % items.length);
            indexesToPreload.push((currentIndex - i + items.length) % items.length);
        }

        indexesToPreload.forEach(idx => {
            const item = items[idx];
            if (item) {
                const url = item.cover_image || item.image || item.url;
                if (url && !cacheRef.current[url]) {
                    // 1. Trigger network request (Browser Cache)
                    const link = document.createElement('link');
                    link.rel = 'preload';
                    link.as = 'image';
                    link.href = url;
                    document.head.appendChild(link);

                    // 2. Trigger CPU Analysis (Data Cache)
                    analyzeImage(url).then(data => {
                        cacheRef.current[url] = data;
                        // console.log("Cached asset:", url);
                    }).catch(e => { /* Ignore errors for background tasks */ });
                }
            }
        });
    }, [currentIndex, items]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight') nextImage();
            if (e.key === 'ArrowLeft') prevImage();
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [items.length, shutterState]);

    if (!mounted) return null;

    // currentItem and imageUrl are already defined at the top of the component.

    return createPortal(
        <AnimatePresence>
            <motion.div
                className="lightbox-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, backgroundColor: overlayColor }}
                exit={{ opacity: 0 }}
                style={{ backgroundColor: overlayColor }}
                onClick={onClose}
            >
                {/* GLOBAL NAVIGATION ARROWS */}
                <button className="global-nav-btn prev" onClick={prevImage} title="Previous (Left Arrow)">
                    <svg viewBox="0 0 24 24" width="24" height="24" stroke="white" strokeWidth="2" fill="none"><path d="M15 18l-6-6 6-6" /></svg>
                </button>

                <button className="global-nav-btn next" onClick={nextImage} title="Next (Right Arrow)">
                    <svg viewBox="0 0 24 24" width="24" height="24" stroke="white" strokeWidth="2" fill="none"><path d="M9 18l6-6-6-6" /></svg>
                </button>

                <button
                    type="button"
                    className="close-viewer-btn"
                    onClick={(event) => {
                        event.stopPropagation();
                        onClose();
                    }}
                    aria-label="Close photo viewer"
                >
                    x
                </button>

                <motion.div
                    className="lightbox-polaroid"
                    onClick={(event) => event.stopPropagation()}
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    // CONTAINER ANIMATION: Collapses to a strip on close, Expands on open
                    animate={{
                        scale: 1,
                        opacity: 1,
                        y: 0,
                        // Collapse to line
                        scaleY: (shutterState === 'closing' || shutterState === 'closed') ? 0.02 : 1,
                        // REMOVE SHADOW when collapsed to avoid "thin line" artifact
                        boxShadow: (shutterState === 'closing' || shutterState === 'closed')
                            ? "0px 0px 0px rgba(0,0,0,0)"
                            : "5px 8px 30px rgba(0,0,0,0.5)"
                    }}
                    transition={{
                        // Closing: Snap shut (0.12s).
                        // Opening: Snap open immediately (0.2s).
                        duration: (shutterState === 'closing') ? 0.12 : 0.2,
                        ease: (shutterState === 'closing') ? [0.7, 0, 0.84, 0] : [0.16, 1, 0.3, 1],
                        delay: (shutterState === 'closing') ? 0.05 : 0 // Reduced delay
                    }}
                    onAnimationComplete={(def) => {
                        // CLOSE LOGIC moves here (Container finishes last on close)
                        if (shutterState === 'closing' && def.scaleY === 0.02) {
                            handleShutterClosed();
                        }
                    }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                >
                    <div className="lightbox-inner">
                        {/*
                            IMAGE AREA WITH CLIP-PATH SHUTTER
                        */}
                        <motion.div
                            className="lightbox-image-area"
                            animate={{
                                clipPath: (shutterState === 'closing' || shutterState === 'closed')
                                    ? "inset(50% 0 50% 0)"  // Fully closed
                                    : "inset(0% 0 0% 0)"    // Fully open
                            }}
                            transition={{
                                // Closing: Super Fast wipe (0.1s).
                                // Opening: Wait for container (0.1s delay), then wipe open quickly (0.2s).
                                duration: (shutterState === 'closing') ? 0.1 : 0.2,
                                ease: (shutterState === 'closing') ? [0.7, 0, 0.84, 0] : [0.16, 1, 0.3, 1],
                                delay: (shutterState === 'opening' || shutterState === 'open') ? 0.1 : 0
                            }}
                            onAnimationComplete={(def) => {
                                // OPEN LOGIC stays here (Image finishes last on open)
                                if (shutterState === 'opening' && def.clipPath === "inset(0% 0 0% 0)") {
                                    handleShutterOpened();
                                }
                            }}
                        >
                            <AnimatePresence mode="wait">
                                <motion.img
                                    key={currentIndex}
                                    ref={imgRef}
                                    src={imageUrl}
                                    alt={currentItem.title}
                                    loading="eager"
                                    decoding="async"
                                    onLoad={handleImageLoad}
                                    onError={() => {
                                        setLoading(false);
                                        setIsLayoutStable(true);
                                    }}
                                    style={{ opacity: loading ? 0.01 : 1 }}
                                    initial={{ opacity: 1 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 1 }}
                                />
                            </AnimatePresence>
                        </motion.div>
                        <div
                            className="lightbox-caption"
                            style={{
                                width: layoutWidth,
                                // ALWAYS VISIBLE as long as we have a width (even if layout isn't "stable").
                                // This ensures the "Glitch" (PixelRain) is seen immediately.
                                opacity: layoutWidth !== 'auto' ? 1 : 0,
                                transition: 'opacity 0.1s'
                            }}
                        >
                            <div className="caption-copy">
                                <h3 className="lightbox-title" title={currentItem.title}>{currentItem.title}</h3>
                            </div>
                            {/* Palette inside the border, beside caption */}
                            <PaletteExtractor
                                imageUrl={imageUrl}
                                onExtract={handleDominantColor}
                                inline={true}
                                initialPalette={cachedData?.palette}
                            />
                        </div>
                        {projectHref && (
                            <a className="project-link" href={projectHref}>
                                Open Project
                            </a>
                        )}
                    </div>
                </motion.div>

                {/* Global counter below the photograph as a whole */}
                <div className="global-counter-external">
                    <span className="current">{currentIndex + 1}</span>
                    <span className="separator">/</span>
                    <span className="total">{items.length}</span>
                </div>

                <style>{`
                    .lightbox-overlay {
                        position: fixed; 
                        top: 0; left: 0; width: 100vw; height: 100dvh; 
                        z-index: 10050; 
                        /* High opacity solid color */
                        background: rgba(10,10,10,0.95); 
                        backdrop-filter: blur(0px);
                        display: flex; align-items: center; justify-content: center;
                        /* REMOVED TRANSITION for instant feel */
                    }
                    .lightbox-polaroid {
                        background: #fdfdfd;  
                        /* Classic Polaroid proportions: thin sides/top, thick bottom */
                        padding: 24px; 
                        padding-bottom: 64px; 
                        width: fit-content;
                        max-width: 90vw; max-height: 90vh; 
                        display: flex; flex-direction: column;
                        border-radius: 2px; 
                        box-shadow: 0 50px 100px rgba(0,0,0,0.5); 
                        margin: auto;
                    }
                    .lightbox-inner { 
                        display: flex; flex-direction: column; 
                        align-items: flex-start; /* Align text to left of image */
                        width: fit-content;
                        max-width: 100%;
                    }
                    .lightbox-image-area { 
                        background: #eee;
                        max-height: 65vh; 
                        overflow: hidden; 
                        display: flex;
                        justify-content: center;
                    }
                    .lightbox-image-area img { 
                        max-height: 65vh; 
                        max-width: 80vw;
                        height: auto; width: auto;
                        display: block; 
                        object-fit: contain; 
                    }
                    
                    .lightbox-caption { 
                        width: 100%; /* Spans exactly the image width */
                        color: #222; 
                        margin-top: 1.5rem;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        gap: 2rem;
                        overflow: hidden;
                    }

                    .caption-copy { min-width: 0; flex: 1; }
                    .lightbox-title { 
                        font-family: var(--font-ui); 
                        font-size: 0.86rem; 
                        font-weight: 700; 
                        margin: 0; 
                        color: #2a2a2a; 
                        line-height: 1.35; 
                        letter-spacing: 0.08em;
                        text-transform: uppercase;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    .project-link {
                        margin-top: 0.85rem;
                        font-family: var(--font-ui);
                        font-size: 0.68rem;
                        text-transform: uppercase;
                        letter-spacing: 0.08em;
                        color: #1d1d1d;
                        text-decoration: none;
                        border-bottom: 1px solid rgba(29, 29, 29, 0.45);
                        align-self: flex-start;
                    }
                    .project-link:hover {
                        border-bottom-color: rgba(29, 29, 29, 0.9);
                    }
                    .global-counter-external {
                        position: absolute;
                        bottom: 36px;
                        left: 50%;
                        transform: translateX(-50%);
                        font-family: var(--font-ui);
                        font-size: 0.8rem;
                        color: rgba(255,255,255,0.6);
                        letter-spacing: 0.2em;
                        display: flex;
                        gap: 0.5rem;
                        align-items: center;
                    }
                    .global-counter-external .current { color: white; font-weight: bold; }
                    .global-counter-external .separator { opacity: 0.4; }

                    /* GLOBAL NAV ARROWS */
                    .global-nav-btn {
                        position: absolute;
                        top: 50%;
                        transform: translateY(-50%);
                        background: rgba(255,255,255,0.05);
                        border: 1px solid rgba(255,255,255,0.1);
                        width: 44px;
                        height: 44px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        transition: all 0.2s;
                        z-index: 10051;
                    }
                    .global-nav-btn:hover {
                        background: rgba(255,255,255,0.15);
                        transform: translateY(-50%) scale(1.1);
                    }
                    .global-nav-btn.prev { left: 40px; }
                    .global-nav-btn.next { right: 40px; }

                    .close-viewer-btn {
                        position: absolute;
                        top: 20px;
                        right: 22px;
                        border: 1px solid rgba(255, 255, 255, 0.2);
                        background: rgba(0, 0, 0, 0.22);
                        color: rgba(255, 255, 255, 0.92);
                        width: 36px;
                        height: 36px;
                        border-radius: 999px;
                        font-family: var(--font-ui);
                        font-size: 0.92rem;
                        cursor: pointer;
                        text-transform: uppercase;
                        z-index: 10051;
                    }
                    .close-viewer-btn:hover {
                        background: rgba(255, 255, 255, 0.12);
                    }

                    @media (max-width: 900px) {
                        .global-nav-btn.prev { left: 14px; }
                        .global-nav-btn.next { right: 14px; }
                        .close-viewer-btn { right: 14px; top: 14px; }
                        .lightbox-caption {
                            flex-direction: column;
                            align-items: flex-start;
                            gap: 0.9rem;
                        }
                        .lightbox-title { font-size: 0.78rem; }
                    }
                `}</style>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
};

export default PolaroidScatter;
