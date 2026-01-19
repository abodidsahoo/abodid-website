import React, { useState, useEffect, useRef } from 'react';
import { vaultTags } from '../utils/tags';

const InteractiveTags = () => {
    const [activeTags, setActiveTags] = useState([]);
    const activeTagsRef = useRef([]);
    const containerRef = useRef(null);
    const lastSpawnPosition = useRef({ x: -999, y: -999 });
    const tagIdCounter = useRef(0);

    // CONSTANTS
    const CHECK_INTERVAL = 15;
    const MIN_SPACING = 90;
    const MAX_TAGS = 20;
    const FADE_DURATION = 1500;
    const EDGE_PADDING = 20;
    const HEADER_BUFFER = 15; // Minimum distance tag center must be from header bottom

    // Helper to check if point is inside a rect
    const isInside = (x, y, rect) => {
        return (
            x >= rect.left &&
            x <= rect.right &&
            y >= rect.top &&
            y <= rect.bottom
        );
    };

    // Helper to get all exclusion rects
    const getExclusionZones = () => {
        const zones = [];

        // 1. Header (Strict exclusion REMOVED to allow Clamping/Displacement)
        // We want tags to spawn (displaced) even if hovering the header.
        /* 
        const header = document.querySelector('.site-header');
        if (header) {
            zones.push(header.getBoundingClientRect());
        } 
        */

        // 2. Hero Content (Text block)
        const heroContent = document.querySelector('.hero-content');
        if (heroContent) {
            const rect = heroContent.getBoundingClientRect();
            zones.push({
                left: rect.left - 20,
                right: rect.right + 20,
                top: rect.top - 20,
                bottom: rect.bottom + 20
            });
        }

        // 3. Sections below the hero
        const sections = document.querySelectorAll('.section');
        sections.forEach(sec => {
            const rect = sec.getBoundingClientRect();
            if (rect.top < window.innerHeight) {
                zones.push(rect);
            }
        });

        return zones;
    };


    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!containerRef.current) return;

            const containerRect = containerRef.current.getBoundingClientRect();

            const isMouseInsideContainer =
                e.clientX >= containerRect.left &&
                e.clientX <= containerRect.right &&
                e.clientY >= containerRect.top &&
                e.clientY <= containerRect.bottom;

            if (isMouseInsideContainer) {
                const relX = e.clientX - containerRect.left;
                const relY = e.clientY - containerRect.top;

                // EDGE PADDING CHECK
                if (
                    relX < EDGE_PADDING ||
                    relX > (containerRect.width - EDGE_PADDING) ||
                    relY < EDGE_PADDING ||
                    relY > (containerRect.height - EDGE_PADDING)
                ) {
                    return;
                }

                const dxv = relX - lastSpawnPosition.current.x;
                const dyv = relY - lastSpawnPosition.current.y;
                const distFromLast = Math.sqrt(dxv * dxv + dyv * dyv);

                if (distFromLast > CHECK_INTERVAL) {
                    attemptSpawn(e.clientX, e.clientY, relX, relY, containerRect);
                }
            }
        };

        const attemptSpawn = (viewportX, viewportY, relX, relY, containerRect) => {
            // 1. Check Exclusion Zones (Strict Overlap)
            const zones = getExclusionZones();
            // We use viewportY for check, but later might clamp it
            const inExclusionZone = zones.some(rect => isInside(viewportX, viewportY, rect));

            if (inExclusionZone) return;

            // 2. Header Clamping Logic
            // Ensure tag spawns below header even if mouse is close
            const header = document.querySelector('.site-header');
            let finalRelY = relY;

            if (header) {
                const headerRect = header.getBoundingClientRect();
                const minViewportY = headerRect.bottom + HEADER_BUFFER;

                // If the mouse is above this safe line (but below header due to exclusion check),
                // or if we just want to enforce the tag position:
                if (viewportY < minViewportY) {
                    // DISPLACE: Force Y to be minViewportY
                    // Convert minViewportY back to Relative Y
                    finalRelY = minViewportY - containerRect.top;
                }
            }

            // 3. Check Tag Collision (Anti-Overlap) using FINAL coordinates
            const hasCollision = activeTagsRef.current.some(tag => {
                const dx = relX - tag.x; // We keep X same as mouse usually
                const dy = finalRelY - tag.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                return dist < MIN_SPACING;
            });

            if (!hasCollision) {
                spawnTag(relX, finalRelY);
                lastSpawnPosition.current = { x: relX, y: finalRelY };
            }
        };

        const spawnTag = (x, y) => {
            const randomTag = vaultTags[Math.floor(Math.random() * vaultTags.length)];
            const newTag = {
                id: tagIdCounter.current++,
                text: randomTag,
                x,
                y,
                createdAt: Date.now()
            };

            activeTagsRef.current.push(newTag);
            if (activeTagsRef.current.length > MAX_TAGS) {
                activeTagsRef.current.shift();
            }

            setActiveTags([...activeTagsRef.current]);

            setTimeout(() => {
                activeTagsRef.current = activeTagsRef.current.filter(t => t.id !== newTag.id);
                setActiveTags([...activeTagsRef.current]);
            }, FADE_DURATION + 100);
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    return (
        <div ref={containerRef} className="interactive-tags-container">
            {activeTags.map(tag => (
                <div
                    key={tag.id}
                    className="floating-tag"
                    style={{
                        position: 'absolute',
                        left: tag.x,
                        top: tag.y,
                        transform: 'translate(-50%, -50%)',
                    }}
                >
                    <span className="tag-content">{tag.text}</span>
                </div>
            ))}

            <style>{`
                .interactive-tags-container {
                    position: absolute;
                    top: -3rem; /* Cover the 3rem padding gap of Main */
                    left: 50%;
                    transform: translateX(-50%);
                    width: 100vw;
                    height: calc(100vh + 3rem); 
                    pointer-events: none;
                    z-index: 0; 
                    display: block;
                    overflow: hidden; 
                }

                .floating-tag {
                    pointer-events: none;
                    z-index: 20;
                    animation: trailFade 1.5s ease-out forwards;
                    will-change: transform, opacity;
                }

                .tag-content {
                    display: inline-block;
                    padding: 4px 10px;
                    border: 1px solid var(--text-primary, #333);
                    border-radius: 6px; 
                    background: transparent;
                    color: var(--text-primary, #333);
                    font-family: 'Poppins', sans-serif;
                    font-size: 0.85rem;
                    white-space: nowrap;
                    font-weight: 400;
                }

                @keyframes trailFade {
                    0% { 
                        opacity: 1; 
                        transform: translate(-50%, -50%) scale(0.5);
                    }
                    10% {
                        transform: translate(-50%, -50%) scale(1);
                        opacity: 1;
                    }
                    100% { 
                        opacity: 0; 
                        transform: translate(-50%, -50%) scale(0.9);
                    }
                }
            `}</style>
        </div>
    );
};

export default InteractiveTags;
