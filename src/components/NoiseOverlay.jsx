import React, { useEffect, useRef } from 'react';

const NoiseOverlay = ({ opacity = 0.05 }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;
        let timeoutId;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };

        const drawNoise = () => {
            const w = canvas.width;
            const h = canvas.height;
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

            // Throttled to ~10 FPS (100ms delay)
            timeoutId = setTimeout(() => {
                animationFrameId = requestAnimationFrame(drawNoise);
            }, 100);
        };

        window.addEventListener('resize', resize);
        resize();
        drawNoise();

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationFrameId);
            clearTimeout(timeoutId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 900,
                opacity: opacity,
                mixBlendMode: 'overlay'
            }}
        />
    );
};

export default NoiseOverlay;
