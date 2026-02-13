import React, { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';

const SHAPE_SIZE = 52;
const SHAPE_CENTER = SHAPE_SIZE / 2;
const BASE_RADIUS = 12.2;
const SEGMENTS = 56;
const RIPPLE_POOL = 3;
const RIPPLE_DURATION = 230;
const RIPPLE_MIN_GAP = 4.4;
const RIPPLE_MAX_GAP = 22;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const smoothstep = (edge0, edge1, x) => {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
};

const lerpAngle = (from, to, t) => {
    const delta = ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    return from + delta * t;
};

const angleDiff = (a, b) => {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
};

const gauss = (d, sigma) => Math.exp(-(d * d) / (2 * sigma * sigma));

const buildSmoothClosedPath = (points) => {
    if (!points.length) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    const n = points.length;
    let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

    for (let i = 0; i < n; i += 1) {
        const p0 = points[(i - 1 + n) % n];
        const p1 = points[i];
        const p2 = points[(i + 1) % n];
        const p3 = points[(i + 2) % n];

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }

    return `${d} Z`;
};

const initialCirclePath = () => {
    const points = [];
    for (let i = 0; i < SEGMENTS; i += 1) {
        const t = (i / SEGMENTS) * Math.PI * 2;
        points.push({
            x: SHAPE_CENTER + BASE_RADIUS * Math.cos(t),
            y: SHAPE_CENTER + BASE_RADIUS * Math.sin(t),
        });
    }
    return buildSmoothClosedPath(points);
};

const LiquidCursor = () => {
    const layerRef = useRef(null);
    const blobRef = useRef(null);
    const gradientRef = useRef(null);
    const stopARef = useRef(null);
    const stopBRef = useRef(null);
    const stopCRef = useRef(null);

    const rafRef = useRef(null);
    const lastFrameTimeRef = useRef(0);

    const mouseRef = useRef({ x: -100, y: -100 });
    const posRef = useRef({ x: -100, y: -100 });

    const followVelRef = useRef({ x: 0, y: 0 });
    const rawVelRef = useRef({ x: 0, y: 0 });

    const lastMouseRef = useRef({ x: -100, y: -100, t: 0 });

    const angleRef = useRef(0);
    const prevAngleRef = useRef(0);

    const stretchRef = useRef(0);
    const stretchVelRef = useRef(0);
    const curveRef = useRef(0);
    const sizeScaleRef = useRef(1.06);

    const hoverRef = useRef(false);
    const hoverMixRef = useRef(0);
    const rippleElsRef = useRef([]);
    const rippleStateRef = useRef(
        Array.from({ length: RIPPLE_POOL }, () => ({
            active: false,
            start: 0,
        })),
    );

    const gradientId = useMemo(() => `liquid-fill-${Math.random().toString(36).slice(2, 9)}`, []);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        if (window.matchMedia('(pointer: coarse)').matches) return undefined;

        const previousCursor = document.body.style.cursor;
        document.body.style.cursor = 'none';

        const styleEl = document.createElement('style');
        styleEl.innerHTML = `
            * { cursor: none !important; }
            .liquid-cursor-layer {
                pointer-events: none;
                position: fixed;
                top: 0;
                left: 0;
                z-index: 99999;
                width: 100vw;
                height: 100vh;
                overflow: hidden;
            }
        `;
        document.head.appendChild(styleEl);

        const onPointerMove = (event) => {
            const now = performance.now();
            const { clientX, clientY } = event;

            mouseRef.current = { x: clientX, y: clientY };

            if (posRef.current.x < -90) {
                posRef.current = { x: clientX, y: clientY };
            }

            if (lastMouseRef.current.t > 0) {
                const dt = Math.max(8, now - lastMouseRef.current.t);
                const vx = (clientX - lastMouseRef.current.x) / dt;
                const vy = (clientY - lastMouseRef.current.y) / dt;
                rawVelRef.current.x += (vx - rawVelRef.current.x) * 0.42;
                rawVelRef.current.y += (vy - rawVelRef.current.y) * 0.42;
            }

            lastMouseRef.current = { x: clientX, y: clientY, t: now };

            const target = event.target;
            hoverRef.current =
                target instanceof Element &&
                !!target.closest(
                    'a, button, input, textarea, select, label, [role="button"], [data-hover], .clickable',
                );
        };

        window.addEventListener('pointermove', onPointerMove, { passive: true });

        const onPointerDown = (event) => {
            if (event.button !== 0) return;
            const now = performance.now();
            const ripples = rippleStateRef.current;
            let slot = ripples.find((ripple) => !ripple.active);
            if (!slot) {
                slot = ripples.reduce((oldest, ripple) =>
                    ripple.start < oldest.start ? ripple : oldest,
                );
            }
            slot.active = true;
            slot.start = now;
        };

        window.addEventListener('pointerdown', onPointerDown, { passive: true });

        const loop = (now) => {
            if (!layerRef.current || !blobRef.current || !gradientRef.current) {
                rafRef.current = requestAnimationFrame(loop);
                return;
            }

            if (!lastFrameTimeRef.current) {
                lastFrameTimeRef.current = now;
            }

            const dt = clamp(now - lastFrameTimeRef.current, 8, 24);
            lastFrameTimeRef.current = now;

            const prevX = posRef.current.x;
            const prevY = posRef.current.y;

            const dx = mouseRef.current.x - posRef.current.x;
            const dy = mouseRef.current.y - posRef.current.y;
            const distToMouse = Math.hypot(dx, dy);

            const followStrength = 0.14 + smoothstep(0, 180, distToMouse) * 0.14;
            const followLerp = 1 - Math.exp(-(followStrength * dt) / 16);

            posRef.current.x += dx * followLerp;
            posRef.current.y += dy * followLerp;

            const frameVx = (posRef.current.x - prevX) / dt;
            const frameVy = (posRef.current.y - prevY) / dt;

            followVelRef.current.x += (frameVx - followVelRef.current.x) * 0.34;
            followVelRef.current.y += (frameVy - followVelRef.current.y) * 0.34;

            const vx = followVelRef.current.x * 0.78 + rawVelRef.current.x * 0.22;
            const vy = followVelRef.current.y * 0.78 + rawVelRef.current.y * 0.22;

            const speed = Math.hypot(vx, vy);
            const speedFrame = speed * 16;

            const hoverActive = hoverRef.current ? 1 : 0;
            const hoverSpeedGate = hoverActive ? smoothstep(0.55, 4.7, speedFrame) : 0;
            const moveSizeGate = smoothstep(0.8, 5.2, speedFrame);
            const sizeTarget =
                1.06 + moveSizeGate * 0.055 + hoverActive * (0.018 + hoverSpeedGate * 0.12);
            const sizeLerp = sizeTarget > sizeScaleRef.current ? 0.22 : 0.16;
            sizeScaleRef.current += (sizeTarget - sizeScaleRef.current) * sizeLerp;
            if (!hoverActive && speedFrame < 0.45) {
                sizeScaleRef.current += (1.06 - sizeScaleRef.current) * 0.2;
            }
            sizeScaleRef.current = clamp(sizeScaleRef.current, 1.06, 1.24);

            if (speedFrame > 0.1) {
                const targetAngle = Math.atan2(vy, vx);
                angleRef.current = lerpAngle(angleRef.current, targetAngle, 0.2);
            }

            const angleDelta = angleDiff(angleRef.current, prevAngleRef.current);
            prevAngleRef.current = angleRef.current;

            const dragGate = smoothstep(10, 58, distToMouse);
            const speedGate = smoothstep(0.55, 4.6, speedFrame);
            let stretchTarget = Math.pow(Math.max(dragGate * 0.7, speedGate), 1.02);

            if (distToMouse < 8 && speedFrame < 0.6) {
                stretchTarget *= 0.08;
            }

            stretchVelRef.current += (stretchTarget - stretchRef.current) * 0.18;
            stretchVelRef.current *= stretchTarget > stretchRef.current ? 0.84 : 0.78;
            stretchRef.current += stretchVelRef.current;

            if (stretchTarget < 0.018 && Math.abs(stretchVelRef.current) < 0.0015) {
                stretchRef.current *= 0.92;
            }

            stretchRef.current = clamp(stretchRef.current, 0, 1);

            if (stretchTarget < 0.012 && speedFrame < 0.45 && distToMouse < 4.5) {
                stretchRef.current = 0;
                stretchVelRef.current = 0;
                curveRef.current *= 0.4;
                if (Math.abs(curveRef.current) < 0.003) {
                    curveRef.current = 0;
                }
            }

            const curveTarget = clamp(angleDelta * 5.4, -0.85, 0.85) * stretchRef.current;
            curveRef.current += (curveTarget - curveRef.current) * 0.16;
            curveRef.current *= stretchRef.current > 0.04 ? 0.94 : 0.72;

            const tailDir = angleRef.current + Math.PI;
            const perpX = -Math.sin(tailDir);
            const perpY = Math.cos(tailDir);

            const stretch = stretchRef.current;
            const sizeScale = sizeScaleRef.current;
            const baseRadius = BASE_RADIUS * sizeScale;
            const tailLength = (1.6 + stretch * 14.2) * (0.95 + sizeScale * 0.05);
            const frontCompress = (0.16 + stretch * 1.28) * (0.95 + (sizeScale - 1) * 0.42);
            const minRadius = baseRadius * 0.9;

            const points = [];

            for (let i = 0; i < SEGMENTS; i += 1) {
                const t = (i / SEGMENTS) * Math.PI * 2;

                const dTail = Math.abs(angleDiff(t, tailDir));
                const dFront = Math.abs(angleDiff(t, angleRef.current));
                const side = Math.abs(Math.sin(t - tailDir));

                const tailBody = gauss(dTail, 0.78);
                const tailTip = gauss(dTail, 0.25);

                const sideBody = Math.exp(-Math.pow(side / 0.54, 1.95));
                const sideTip = Math.exp(-Math.pow(side / 0.21, 2.2));

                const bodyPush = tailLength * tailBody * sideBody * 0.64;
                const tipPush = tailLength * tailTip * sideTip * 0.62;
                const sidePinch = tailLength * tailTip * Math.pow(side, 0.95) * 0.14;
                const frontCut = frontCompress * gauss(dFront, 0.9);
                const tipRound = gauss(dTail, 0.13) * (0.34 + stretch * 0.24);

                let radius = baseRadius + bodyPush + tipPush + tipRound - sidePinch - frontCut;
                radius = Math.max(minRadius, radius);

                const bendEnvelope = gauss(dTail, 0.9);
                const bend =
                    curveRef.current *
                    bendEnvelope *
                    Math.sin(t - tailDir) *
                    (1.3 + stretch * 2.2);

                points.push({
                    x: SHAPE_CENTER + radius * Math.cos(t) + perpX * bend,
                    y: SHAPE_CENTER + radius * Math.sin(t) + perpY * bend,
                });
            }

            blobRef.current.setAttribute('d', buildSmoothClosedPath(points));

            layerRef.current.style.transform = `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0)`;

            const frontX = SHAPE_CENTER + Math.cos(angleRef.current) * (baseRadius * 2.3 + stretch * 6);
            const frontY = SHAPE_CENTER + Math.sin(angleRef.current) * (baseRadius * 2.3 + stretch * 6);
            const backX = SHAPE_CENTER - Math.cos(angleRef.current) * (baseRadius * 2.8 + stretch * 9);
            const backY = SHAPE_CENTER - Math.sin(angleRef.current) * (baseRadius * 2.8 + stretch * 9);

            gradientRef.current.setAttribute('x1', backX.toFixed(2));
            gradientRef.current.setAttribute('y1', backY.toFixed(2));
            gradientRef.current.setAttribute('x2', frontX.toFixed(2));
            gradientRef.current.setAttribute('y2', frontY.toFixed(2));

            hoverMixRef.current += ((hoverRef.current ? 1 : 0) - hoverMixRef.current) * 0.16;
            const hoverMix = clamp(hoverMixRef.current, 0, 1);

            const energy = clamp(stretch * 0.92 + speedGate * 0.72, 0, 1);

            if (stopARef.current && stopBRef.current && stopCRef.current) {
                stopARef.current.setAttribute(
                    'stop-color',
                    `rgba(255, 255, 255, ${0.9 + energy * 0.1})`,
                );
                stopBRef.current.setAttribute(
                    'stop-color',
                    `rgba(171, 205, 255, ${0.72 + energy * 0.26 + hoverMix * 0.04})`,
                );
                stopCRef.current.setAttribute(
                    'stop-color',
                    `rgba(69, 109, 236, ${0.78 + energy * 0.2 + hoverMix * 0.02})`,
                );
            }

            blobRef.current.style.stroke = `rgba(241, 248, 255, ${0.58 + energy * 0.28 + hoverMix * 0.2})`;
            blobRef.current.style.strokeWidth = `${0.9 + energy * 0.34 + hoverMix * 0.22}`;
            blobRef.current.style.filter = `
                drop-shadow(0 0 ${4 + energy * 7}px rgba(110, 168, 255, ${0.34 + energy * 0.34}))
                drop-shadow(0 0 ${3 + hoverMix * 16}px rgba(103, 255, 172, ${0.1 + hoverMix * 0.86 + energy * 0.18}))
                drop-shadow(0 0 ${1 + hoverMix * 8}px rgba(184, 255, 214, ${0.04 + hoverMix * 0.34}))
            `;

            for (let i = 0; i < RIPPLE_POOL; i += 1) {
                const ring = rippleElsRef.current[i];
                const ripple = rippleStateRef.current[i];
                if (!ring || !ripple) continue;

                if (!ripple.active) {
                    ring.style.opacity = '0';
                    continue;
                }

                const progress = clamp((now - ripple.start) / RIPPLE_DURATION, 0, 1);
                if (progress >= 1) {
                    ripple.active = false;
                    ring.style.opacity = '0';
                    continue;
                }

                const eased = 1 - Math.pow(1 - progress, 2.25);
                const rippleMinRadius = baseRadius + RIPPLE_MIN_GAP;
                const rippleMaxRadius =
                    baseRadius + RIPPLE_MAX_GAP + (sizeScale - 1) * 8;
                const radius =
                    rippleMinRadius +
                    eased * (rippleMaxRadius - rippleMinRadius + stretch * 3.5);
                const alpha = 1 - progress;
                const glow = 0.82 * alpha;

                ring.setAttribute('r', radius.toFixed(2));
                ring.style.opacity = alpha.toFixed(3);
                ring.style.strokeWidth = `${1.45 - progress * 0.52}`;
                ring.style.filter = `drop-shadow(0 0 ${7 + eased * 9}px rgba(109, 255, 173, ${glow.toFixed(3)}))`;
            }

            rawVelRef.current.x *= 0.86;
            rawVelRef.current.y *= 0.86;

            rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);

        return () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerdown', onPointerDown);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            lastFrameTimeRef.current = 0;

            document.body.style.cursor = previousCursor;
            if (document.head.contains(styleEl)) {
                document.head.removeChild(styleEl);
            }
        };
    }, []);

    if (typeof document === 'undefined') return null;

    return createPortal(
        <div className="liquid-cursor-layer">
            <div
                ref={layerRef}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: 0,
                    height: 0,
                    pointerEvents: 'none',
                    willChange: 'transform',
                }}
            >
                <svg
                    width={SHAPE_SIZE}
                    height={SHAPE_SIZE}
                    viewBox={`0 0 ${SHAPE_SIZE} ${SHAPE_SIZE}`}
                    style={{
                        position: 'absolute',
                        left: `-${SHAPE_CENTER}px`,
                        top: `-${SHAPE_CENTER}px`,
                        overflow: 'visible',
                    }}
                    aria-hidden="true"
                >
                    <defs>
                        <linearGradient
                            id={gradientId}
                            ref={gradientRef}
                            gradientUnits="userSpaceOnUse"
                            x1={SHAPE_CENTER - BASE_RADIUS * 2}
                            y1={SHAPE_CENTER}
                            x2={SHAPE_CENTER + BASE_RADIUS * 2}
                            y2={SHAPE_CENTER}
                        >
                            <stop ref={stopARef} offset="0%" stopColor="rgba(255,255,255,0.95)" />
                            <stop ref={stopBRef} offset="44%" stopColor="rgba(171,205,255,0.82)" />
                            <stop ref={stopCRef} offset="100%" stopColor="rgba(69,109,236,0.84)" />
                        </linearGradient>
                    </defs>
                    <path
                        ref={blobRef}
                        d={initialCirclePath()}
                        fill={`url(#${gradientId})`}
                        stroke="rgba(241,248,255,0.6)"
                        strokeWidth="1"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        style={{
                            transition: 'stroke 120ms linear',
                            willChange: 'd, filter, stroke',
                        }}
                    />
                    {Array.from({ length: RIPPLE_POOL }).map((_, index) => (
                        <circle
                            key={`cursor-ripple-${index}`}
                            ref={(el) => {
                                rippleElsRef.current[index] = el;
                            }}
                            cx={SHAPE_CENTER}
                            cy={SHAPE_CENTER}
                            r={BASE_RADIUS + RIPPLE_MIN_GAP}
                            fill="none"
                            stroke="rgba(121,255,182,0.97)"
                            strokeWidth="1.25"
                            opacity="0"
                            style={{
                                willChange: 'r, opacity, stroke-width, filter',
                            }}
                        />
                    ))}
                </svg>
            </div>
        </div>,
        document.body,
    );
};

export default LiquidCursor;
