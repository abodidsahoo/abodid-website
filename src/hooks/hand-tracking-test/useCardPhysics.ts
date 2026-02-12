// ISOLATED COPY of useCardPhysics for hand tracking testing
// Original: /src/hooks/useCardPhysics.ts
import { useState, useEffect, useRef } from 'react';

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
    isActive: boolean;
}

export const useCardPhysics = ({ initialImages, isActive = true }: UseCardPhysicsProps) => {
    const [stack, setStack] = useState<Card[]>([]);
    const [lastAction, setLastAction] = useState<'unstack' | 'restack' | 'add'>('unstack');

    const stackRef = useRef<Card[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);
    const lastSpawnTime = useRef(0);
    const zIndexCounter = useRef(100);

    const readyPoolRef = useRef<any[]>([]);
    const loadedSetWithRef = useRef<Set<string>>(new Set());

    // Generate a new card
    const generateCard = (initialOverride: { x: number; y: number } | null = null): Card | null => {
        const now = Date.now();
        let pool = readyPoolRef.current;

        if (pool.length === 0) {
            // Cycle back to start if pool exhausted
            pool = initialImages;
        }

        if (pool.length === 0) return null;

        const idx = Math.floor(Math.random() * pool.length);
        const img = pool[idx];

        zIndexCounter.current += 1;

        return {
            id: `card-${now}-${Math.random()}`,
            image: img.image || img.cover_image || img,
            title: img.title || 'Photo',
            angle: (Math.random() * 8 - 4),
            x: (Math.random() * 60 - 30),
            y: (Math.random() * 60 - 30),
            zIndex: zIndexCounter.current,
            initialPos: initialOverride
        };
    };

    // Spawn a new card
    const attemptSpawn = (force = false, initialOverride: { x: number; y: number } | null = null) => {
        const now = Date.now();
        console.log('🎯 attemptSpawn called', { force, initialOverride, timeSinceLastSpawn: now - lastSpawnTime.current });

        if (!force && now - lastSpawnTime.current < 100) {
            console.log('⏱️  Spawn blocked by cooldown (100ms)');
            return;
        }

        const card = generateCard(initialOverride);
        if (!card) {
            console.log('❌ generateCard returned null - no images available');
            return;
        }

        lastSpawnTime.current = now;
        const newStack = [...stackRef.current, card];

        if (newStack.length > 6) {
            newStack.splice(0, newStack.length - 6);
        }
        stackRef.current = newStack;
        setStack(newStack);
        setLastAction('add');
        console.log('🎉 Card spawned successfully! Stack length:', newStack.length);
    };

    // Initialize pool
    useEffect(() => {
        if (initialImages && initialImages.length > 0) {
            readyPoolRef.current = [...initialImages];
            // No pre-spawned cards - user starts from scratch
        }
    }, [initialImages]);

    // Mouse movement detection for spawning cards
    const lastMousePosRef = useRef({ x: 0, y: 0 });
    const mouseMoveDistAccumulator = useRef(0);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const currentPos = { x: e.clientX, y: e.clientY };

            // Calculate distance from last position
            const dx = currentPos.x - lastMousePosRef.current.x;
            const dy = currentPos.y - lastMousePosRef.current.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            mouseMoveDistAccumulator.current += dist;

            // Spawn card every 150px of mouse movement (same threshold as gestures)
            if (mouseMoveDistAccumulator.current > 150) {
                const angle = Math.atan2(dy, dx);
                const spawnDist = 1200;
                const ix = -Math.cos(angle) * spawnDist;
                const iy = -Math.sin(angle) * spawnDist;

                console.log('🖱️ Mouse movement card spawn!', { dx, dy, dist: mouseMoveDistAccumulator.current });
                attemptSpawn(false, { x: ix, y: iy });
                mouseMoveDistAccumulator.current = 0;
            }

            lastMousePosRef.current = currentPos;
        };

        if (isActive) {
            window.addEventListener('mousemove', handleMouseMove);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, [isActive]);

    // Expose spawn function for hand tracking
    const spawnCardFromGesture = (dx: number, dy: number, angle: number) => {
        console.log('🎴 spawnCardFromGesture called!', { dx, dy, angle, isActive });
        if (!isActive) {
            console.log('❌ Spawn blocked: isActive is false');
            return;
        }

        const spawnDist = 1200;
        const ix = -Math.cos(angle) * spawnDist;
        const iy = -Math.sin(angle) * spawnDist;

        console.log('✅ Calling attemptSpawn with position:', { ix, iy });
        attemptSpawn(false, { x: ix, y: iy });
    };

    return {
        stack,
        lastAction,
        containerRef,
        spawnCardFromGesture
    };
};
