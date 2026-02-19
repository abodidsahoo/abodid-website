
import React, { useEffect, useRef, useState } from 'react';
import { getPerformanceTier } from '../../lib/performance';
import '../../styles/grain.css';

const ImageGrain = ({ children, opacity = 0.12 }) => {
    const [tier, setTier] = useState('high'); // Default to high
    const canvasRef = useRef(null);

    useEffect(() => {
        setTier(getPerformanceTier());
    }, []);

    // Canvas Logic for High Tier
    useEffect(() => {
        if (tier !== 'high' || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;
        let timeoutId;

        const resize = () => {
            if (canvas.parentElement) {
                canvas.width = canvas.parentElement.offsetWidth;
                canvas.height = canvas.parentElement.offsetHeight;
            }
        };

        const drawNoise = () => {
            const w = canvas.width;
            const h = canvas.height;
            if (w === 0 || h === 0) return;

            const idata = ctx.createImageData(w, h);
            const buffer32 = new Uint32Array(idata.data.buffer);
            const len = buffer32.length;

            for (let i = 0; i < len; i++) {
                if (Math.random() < 0.5) {
                    buffer32[i] = 0xff000000;
                } else {
                    buffer32[i] = 0xffffffff;
                }
            }

            ctx.putImageData(idata, 0, 0);

            // Throttled to ~12 FPS for aesthetic "film" look even on high end
            timeoutId = setTimeout(() => {
                animationFrameId = requestAnimationFrame(drawNoise);
            }, 80);
        };

        // ResizeObserver to handle parent size changes
        const ro = new ResizeObserver(resize);
        if (canvas.parentElement) {
            ro.observe(canvas.parentElement);
        }

        resize();
        drawNoise();

        return () => {
            ro.disconnect();
            cancelAnimationFrame(animationFrameId);
            clearTimeout(timeoutId);
        };
    }, [tier]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
            {children}

            {tier === 'high' ? (
                <canvas
                    ref={canvasRef}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'none',
                        zIndex: 20,
                        opacity: opacity,
                        mixBlendMode: 'overlay',
                    }}
                />
            ) : (
                <div
                    className="grain-css-layer"
                    style={{ opacity: opacity * 1.2 }} // Boost CSS opacity slightly to match canvas Feel
                />
            )}
        </div>
    );
};

export default ImageGrain;
