import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const stripBlackMatte = (src) =>
    new Promise((resolve) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.decoding = 'async';
        image.referrerPolicy = 'no-referrer';

        image.onload = () => {
            try {
                const width = image.naturalWidth || image.width;
                const height = image.naturalHeight || image.height;
                if (!width || !height) {
                    resolve(src);
                    return;
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const context = canvas.getContext('2d', { willReadFrequently: true });
                if (!context) {
                    resolve(src);
                    return;
                }

                context.drawImage(image, 0, 0, width, height);
                const imageData = context.getImageData(0, 0, width, height);
                const { data } = imageData;

                // Remove black matte by shaping alpha only; preserve original logo colors.
                const matteCutoff = 0.09;
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const a = data[i + 3];
                    if (a === 0) continue;

                    const max = Math.max(r, g, b) / 255;
                    if (max <= matteCutoff) {
                        data[i + 3] = 0;
                        continue;
                    }

                    const alphaFactor = Math.max(0, Math.min(1, (max - matteCutoff) / (1 - matteCutoff)));
                    data[i + 3] = Math.round(a * alphaFactor);
                }

                context.putImageData(imageData, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            } catch (error) {
                console.warn('Failed to remove logo matte:', error);
                resolve(src);
            }
        };

        image.onerror = () => resolve(src);
        image.src = src;
    });

const INERTIA_FRICTION = 0.94;
const MIN_INERTIA_SPEED = 0.08;
const AUTO_DRIFT_SPEED = 0.18;

export default function BrandFilmStrip() {
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [logoSrcByUrl, setLogoSrcByUrl] = useState({});
    const [isDragging, setIsDragging] = useState(false);

    const viewportRef = useRef(null);
    const trackRef = useRef(null);
    const minOffsetRef = useRef(0);
    const maxOffsetRef = useRef(0);
    const positionRef = useRef(0);
    const velocityRef = useRef(0);
    const driftDirectionRef = useRef(-1);
    const pointerActiveRef = useRef(false);
    const isDraggingRef = useRef(false);
    const activePointerIdRef = useRef(null);
    const lastPointerXRef = useRef(0);
    const lastMoveTimeRef = useRef(0);
    const animationFrameRef = useRef(null);

    useEffect(() => {
        const fetchBrands = async () => {
            const { data, error } = await supabase
                .from('brands')
                .select('*')
                .order('display_order', { ascending: true })
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching brands:', error);
            } else {
                setBrands(data || []);
            }
            setLoading(false);
        };
        fetchBrands();
    }, []);

    useEffect(() => {
        if (!brands.length) return;

        let cancelled = false;
        const logoUrls = [...new Set(brands.map((brand) => brand.logo_url).filter(Boolean))];

        const processLogos = async () => {
            const processedEntries = await Promise.all(
                logoUrls.map(async (logoUrl) => [logoUrl, await stripBlackMatte(logoUrl)]),
            );

            if (cancelled) return;
            setLogoSrcByUrl((prev) => {
                const next = { ...prev };
                for (const [logoUrl, processedUrl] of processedEntries) {
                    next[logoUrl] = processedUrl;
                }
                return next;
            });
        };

        processLogos();
        return () => {
            cancelled = true;
        };
    }, [brands]);

    const clampPosition = useCallback(
        (nextPosition) => Math.min(maxOffsetRef.current, Math.max(minOffsetRef.current, nextPosition)),
        [],
    );

    const applyPosition = useCallback((nextPosition) => {
        const clampedPosition = clampPosition(nextPosition);
        positionRef.current = clampedPosition;

        if (trackRef.current) {
            trackRef.current.style.transform = `translate3d(${clampedPosition}px, 0, 0)`;
        }

        return clampedPosition;
    }, [clampPosition]);

    useEffect(() => {
        if (!trackRef.current || !viewportRef.current || !brands.length) return undefined;

        const measureTrack = () => {
            if (!trackRef.current || !viewportRef.current) return;

            const viewportWidth = viewportRef.current.clientWidth;
            const trackWidth = trackRef.current.scrollWidth;
            minOffsetRef.current = Math.min(0, viewportWidth - trackWidth);
            maxOffsetRef.current = 0;
            applyPosition(positionRef.current);
        };

        measureTrack();
        const resizeObserver = new ResizeObserver(measureTrack);
        resizeObserver.observe(trackRef.current);
        resizeObserver.observe(viewportRef.current);

        return () => resizeObserver.disconnect();
    }, [brands.length, applyPosition]);

    useEffect(() => {
        if (!brands.length) return undefined;

        const tick = () => {
            if (!pointerActiveRef.current) {
                if (Math.abs(velocityRef.current) > MIN_INERTIA_SPEED) {
                    const attemptedPosition = positionRef.current + velocityRef.current;
                    const appliedPosition = applyPosition(attemptedPosition);
                    if (Math.abs(appliedPosition - attemptedPosition) > 0.1) {
                        velocityRef.current *= 0.45;
                        driftDirectionRef.current = velocityRef.current >= 0 ? 1 : -1;
                    }
                    velocityRef.current *= INERTIA_FRICTION;
                } else {
                    velocityRef.current = 0;
                    const attemptedPosition =
                        positionRef.current + (AUTO_DRIFT_SPEED * driftDirectionRef.current);
                    const appliedPosition = applyPosition(attemptedPosition);
                    if (Math.abs(appliedPosition - attemptedPosition) > 0.05) {
                        driftDirectionRef.current *= -1;
                    }
                }
            }

            animationFrameRef.current = requestAnimationFrame(tick);
        };

        animationFrameRef.current = requestAnimationFrame(tick);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };
    }, [brands.length, applyPosition]);

    const handlePointerDown = (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;

        pointerActiveRef.current = true;
        activePointerIdRef.current = event.pointerId;
        lastPointerXRef.current = event.clientX;
        lastMoveTimeRef.current = performance.now();
        velocityRef.current = 0;
        isDraggingRef.current = false;
        setIsDragging(true);
        event.currentTarget.setPointerCapture?.(event.pointerId);
    };

    const handlePointerMove = (event) => {
        if (!pointerActiveRef.current || activePointerIdRef.current !== event.pointerId) return;

        const now = performance.now();
        const deltaX = event.clientX - lastPointerXRef.current;
        const deltaTime = Math.max(1, now - lastMoveTimeRef.current);

        if (Math.abs(deltaX) > 0.1) {
            isDraggingRef.current = true;
            driftDirectionRef.current = deltaX > 0 ? 1 : -1;
        }

        applyPosition(positionRef.current + deltaX);

        const sampledVelocity = (deltaX / deltaTime) * 16;
        velocityRef.current = (velocityRef.current * 0.7) + (sampledVelocity * 0.3);

        lastPointerXRef.current = event.clientX;
        lastMoveTimeRef.current = now;

        if (event.cancelable && Math.abs(deltaX) > 0) {
            event.preventDefault();
        }
    };

    const handlePointerEnd = (event) => {
        if (!pointerActiveRef.current) return;
        if (activePointerIdRef.current !== null && activePointerIdRef.current !== event.pointerId) return;

        pointerActiveRef.current = false;
        activePointerIdRef.current = null;
        isDraggingRef.current = false;
        setIsDragging(false);

        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    };

    if (loading || brands.length === 0) return null;

    return (
        <div className="brand-filmstrip-wrapper">
            <div
                className={`brand-filmstrip ${isDragging ? 'is-dragging' : ''}`}
                ref={viewportRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
            >
                <div className="filmstrip-track" ref={trackRef}>
                    {brands.map((brand) => (
                        <div
                            key={brand.id}
                            className="filmstrip-item"
                        >
                            <img
                                src={logoSrcByUrl[brand.logo_url] || brand.logo_url}
                                alt={brand.name}
                                loading="lazy"
                            />
                        </div>
                    ))}
                </div>
            </div>

            <style>{`
                .brand-filmstrip-wrapper {
                    position: relative;
                    width: 100%;
                    /* Removed breakout hacks */
                    z-index: 10;
                    margin: 0;
                    pointer-events: auto;
                }

                .brand-filmstrip {
                    width: 100%;
                    overflow: hidden;
                    position: relative;
                    padding: 0;
                    cursor: grab;
                    touch-action: pan-y;
                    user-select: none;
                    -webkit-user-select: none;
                    
                    background: transparent;
                    mix-blend-mode: normal;
                    opacity: 1;
                    pointer-events: auto; 
                }

                .brand-filmstrip.is-dragging {
                    cursor: grabbing;
                }

                .filmstrip-track {
                    display: flex;
                    align-items: center;
                    gap: 6rem; /* Decent enough spacing between logos */
                    width: max-content;
                    padding: 0 4rem 0 2rem;
                    will-change: transform;
                }

                .filmstrip-item {
                    flex-shrink: 0;
                    width: auto;
                    height: 132px; 
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: transform 0.3s ease;
                    position: relative;
                    z-index: 1;
                    pointer-events: none;
                }

                .filmstrip-item:hover {
                    transform: scale(1.05);
                }

                .brand-filmstrip.is-dragging .filmstrip-item:hover {
                    transform: none;
                }

                .filmstrip-item img {
                    height: 100%;
                    width: auto;
                    max-width: 132px;
                    object-fit: contain;
                    mix-blend-mode: normal !important;
                    filter: none;
                    opacity: 1;
                    pointer-events: none;
                    user-select: none;
                    -webkit-user-select: none;
                    -webkit-user-drag: none;
                }

                @media (max-width: 768px) {
                    .brand-filmstrip {
                        padding: 0;
                    }
                    .filmstrip-track {
                        gap: 3.2rem;
                        padding: 0 2rem 0 1rem;
                    }
                    .filmstrip-item { 
                        height: 77px;
                    }
                }
            `}</style>
        </div>
    );
}
