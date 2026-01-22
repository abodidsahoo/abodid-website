import React, { useState, useEffect, useRef } from 'react';
import { vaultTags } from '../utils/tags';
import confetti from 'canvas-confetti';

// Simple "Ting" sound as base64 (short bell/chime)
const TING_SOUND = "data:audio/wav;base64,UklGRl9vT1BXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU..."; // Placeholder, will use a real short base64 string in implementation

const InteractiveTags = () => {
    // --- STATE ---
    const [activeTags, setActiveTags] = useState([]);
    const [tags, setTags] = useState(vaultTags);

    // Game State
    const [uniqueCount, setUniqueCount] = useState(0);
    const [isUnlocked, setIsUnlocked] = useState(false);

    // --- REFS ---
    const activeTagsRef = useRef([]);
    const containerRef = useRef(null);
    const lastSpawnPosition = useRef({ x: -999, y: -999 });
    const tagIdCounter = useRef(0);
    const foundTagsRef = useRef(new Set());
    const tagsRef = useRef(vaultTags);

    // --- CONSTANTS ---
    const CHECK_INTERVAL = 15;
    const MIN_SPACING = 90;
    const MAX_TAGS = 20;
    const FADE_DURATION = 1500;
    const EDGE_PADDING = 20;
    const HEADER_BUFFER = 15;

    // FIXED UNLOCK THRESHOLD
    const UNLOCK_THRESHOLD = 50;

    // --- DATA FETCHING ---
    useEffect(() => {
        const fetchTags = async () => {
            try {
                const res = await fetch('/api/vault-tags.json');
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data) && data.length > 0) {
                        setTags(data);
                    }
                }
            } catch (err) {
                console.warn('Failed to fetch dynamic tags, using fallback.', err);
            }
        };
        fetchTags();
    }, []);

    useEffect(() => {
        tagsRef.current = tags;
    }, [tags]);

    // --- AUDIO HELPER ---
    const audioRef = useRef(null);
    const audioUnlockedRef = useRef(false);

    useEffect(() => {
        // Preload audio
        audioRef.current = new Audio('/sounds/ting.mp3');
        audioRef.current.volume = 0.5;
        audioRef.current.load();

        // Unlock audio on first user interaction
        const unlockAudio = () => {
            if (audioUnlockedRef.current || !audioRef.current) return;

            // Try to play and immediately pause to unlock the AudioContext
            audioRef.current.play().then(() => {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                audioUnlockedRef.current = true;
            }).catch(e => {
                // Ignore errors during unlock attempt (e.g., rapid clicks)
            });

            // Remove listeners once unlocked
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
            window.removeEventListener('touchstart', unlockAudio);
        };

        window.addEventListener('click', unlockAudio);
        window.addEventListener('keydown', unlockAudio);
        window.addEventListener('touchstart', unlockAudio);

        return () => {
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
            window.removeEventListener('touchstart', unlockAudio);
        };
    }, []);

    const playWinSound = () => {
        try {
            if (audioRef.current) {
                audioRef.current.currentTime = 0; // Reset to start
                audioRef.current.play().catch(e => console.warn("Audio blocked (interaction needed):", e));
            }
        } catch (e) {
            console.error("Audio error", e);
        }
    };

    // --- INTERACTION LOGIC ---
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

                if (
                    relX < EDGE_PADDING ||
                    relX > (containerRect.width - EDGE_PADDING) ||
                    relY < EDGE_PADDING ||
                    relY > (containerRect.height - EDGE_PADDING)
                ) return;

                const dxv = relX - lastSpawnPosition.current.x;
                const dyv = relY - lastSpawnPosition.current.y;
                const distFromLast = Math.sqrt(dxv * dxv + dyv * dyv);

                if (distFromLast > CHECK_INTERVAL) {
                    attemptSpawn(e.clientX, e.clientY, relX, relY, containerRect);
                }
            }
        };

        const attemptSpawn = (viewportX, viewportY, relX, relY, containerRect) => {
            const zones = getExclusionZones();
            const inExclusionZone = zones.some(rect => isInside(viewportX, viewportY, rect));
            if (inExclusionZone) return;

            const header = document.querySelector('.site-header');
            let finalRelY = relY;
            if (header) {
                const headerRect = header.getBoundingClientRect();
                const minViewportY = headerRect.bottom + HEADER_BUFFER;
                if (viewportY < minViewportY) {
                    finalRelY = minViewportY - containerRect.top;
                }
            }

            const hasCollision = activeTagsRef.current.some(tag => {
                const dx = relX - tag.x;
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
            const currentPool = tagsRef.current;
            const randomTag = currentPool[Math.floor(Math.random() * currentPool.length)];

            // --- GAMIFICATION LOGIC ---
            if (!foundTagsRef.current.has(randomTag)) {
                foundTagsRef.current.add(randomTag);
                const count = foundTagsRef.current.size;
                setUniqueCount(count);

                // DISPATCH EVENT FOR WIDGET
                const event = new CustomEvent('game-progress', {
                    detail: {
                        count,
                        total: currentPool.length,
                        unlocked: count === UNLOCK_THRESHOLD
                    }
                });
                window.dispatchEvent(event);

                // Check Win Condition: EXACTLY at the threshold to trigger once
                if (count === UNLOCK_THRESHOLD) {
                    setIsUnlocked(true);
                    playWinSound();
                    confetti({
                        particleCount: 150,
                        spread: 70,
                        origin: { y: 0.6 },
                        colors: ['#39ff14', '#ff0000', '#ffffff', '#00ff00'] // Neon Green, Red, White
                    });
                    window.dispatchEvent(new CustomEvent('game-unlock'));
                }
            }

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

    // --- HELPERS ---
    const isInside = (x, y, rect) => {
        return (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom);
    };

    const getExclusionZones = () => {
        const zones = [];
        // Only exclude interactive elements/sections to avoid covering clicks
        // But for background tags, we mainly care about not spawning ON TEXT excessively?
        // Actually, let's keep it simple.
        const heroContent = document.querySelector('.hero-content');
        if (heroContent) {
            const rect = heroContent.getBoundingClientRect();
            zones.push({
                left: rect.left - 20, right: rect.right + 20,
                top: rect.top - 20, bottom: rect.bottom + 20
            });
        }
        const sections = document.querySelectorAll('.section');
        sections.forEach(sec => {
            const rect = sec.getBoundingClientRect();
            if (rect.top < window.innerHeight) zones.push(rect);
        });
        return zones;
    };

    return (
        <div ref={containerRef} className="interactive-tags-container">
            {/* --- FLOATING TAGS ONLY --- */}
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
                    top: -3rem; 
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
