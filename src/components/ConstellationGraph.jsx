import React, { useEffect, useRef, useState } from 'react';

const ConstellationGraph = ({ consensusScore = 50, divergenceLabel = "MODERATE DIVERGENCE" }) => {
    const canvasRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState(0); // 0 to 1 animation

    // Sequence Effect
    useEffect(() => {
        // 1. Start loading (visual spinner)
        setLoading(true);
        setProgress(0);

        const timer1 = setTimeout(() => {
            setLoading(false); // Reveal canvas
            // 2. Start animation loop
            let p = 0;
            const interval = setInterval(() => {
                p += 0.05; // Much faster build (approx 0.5s)
                if (p >= 1) {
                    p = 1;
                    clearInterval(interval);
                }
                setProgress(p);
            }, 20);
        }, 500); // 0.5s mandatory "calculating" spin

        return () => clearTimeout(timer1);
    }, [consensusScore]);

    useEffect(() => {
        if (loading) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;

        // Configuration
        const spreadFactor = 200 - (consensusScore * 1.5);
        const linkDistance = 150 - (consensusScore * 0.8);
        const baseSpeed = 0.3; // Increased slightly for "floating" feel

        // Initialize Nodes CENTERED
        const nodes = Array.from({ length: 50 }).map(() => ({
            // Target Position (Spread out)
            tx: (Math.random() - 0.5) * spreadFactor * 3,
            ty: (Math.random() - 0.5) * spreadFactor * 3,
            // Current Position (Starts at center)
            x: canvas.width / 2,
            y: canvas.height / 2,
            // Velocity for floating
            vx: (Math.random() - 0.5) * baseSpeed,
            vy: (Math.random() - 0.5) * baseSpeed,
            size: Math.random() * 2 + 1.5,
            phase: Math.random() * Math.PI * 2
        }));

        const render = () => {
            if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
                canvas.width = canvas.offsetWidth;
                canvas.height = canvas.offsetHeight;
            }

            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;

            ctx.fillStyle = '#050505';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Phase 1: Nodes Expansion (Progress 0.0 -> 0.4)
            // Phase 2: Connections (Progress 0.4 -> 0.8)
            // Phase 3: Stability/Verdict (Progress > 0.8)

            const expansionProgress = Math.min(1, progress * 2.5); // Reaches 1 at p=0.4

            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];

                // Floating Physics
                node.tx += node.vx;
                node.ty += node.vy;

                // Soft boundaries
                if (node.tx > spreadFactor * 1.8) node.vx *= -1;
                if (node.tx < -spreadFactor * 1.8) node.vx *= -1;
                if (node.ty > spreadFactor * 1.8) node.vy *= -1;
                if (node.ty < -spreadFactor * 1.8) node.vy *= -1;


                // Interpolate from Center to Target based on expansionProgress
                // But constantly update 'center' to be the screen center
                const targetX = centerX + node.tx;
                const targetY = centerY + node.ty;

                // Actual position
                node.renderedX = centerX + (node.tx * expansionProgress);
                node.renderedY = centerY + (node.ty * expansionProgress);

                // Draw Links (Phase 2)
                if (progress > 0.4) {
                    const linkProgress = (progress - 0.4) * 2; // 0 to 1 between p=0.4 and 0.9
                    const maxDist = linkDistance * linkProgress;

                    for (let j = i + 1; j < nodes.length; j++) {
                        const dx = node.renderedX - nodes[j].renderedX;
                        const dy = node.renderedY - nodes[j].renderedY;
                        const dist = Math.sqrt(dx * dx + dy * dy);

                        if (dist < maxDist) {
                            const opacity = (1 - (dist / maxDist)) * 0.4;
                            ctx.beginPath();
                            ctx.strokeStyle = `rgba(0, 243, 100, ${opacity})`; // Green glow
                            ctx.moveTo(node.renderedX, node.renderedY);
                            ctx.lineTo(nodes[j].renderedX, nodes[j].renderedY);
                            ctx.stroke();
                        }
                    }
                }

                // Draw Node
                const alpha = Math.min(1, expansionProgress);
                ctx.beginPath();
                ctx.arc(node.renderedX, node.renderedY, node.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.fill();
            }

            animationFrameId = requestAnimationFrame(render);
        };

        render();
        return () => cancelAnimationFrame(animationFrameId);
    }, [consensusScore, loading, progress]);

    return (
        <div style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            borderRadius: '16px',
            background: '#050505',
            border: '1px solid rgba(255,255,255,0.05)',
            boxShadow: '0 0 40px rgba(0,0,0,0.5)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>

            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

            {/* LOADING SPINNER (Immediate) */}
            {loading && (
                <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: '#050505', zIndex: 20
                }}>
                    <div style={{
                        width: '60px', height: '60px',
                        border: '2px solid rgba(0, 243, 100, 0.1)',
                        borderTopColor: '#00f364',
                        borderRadius: '50%',
                        animation: 'spin 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite',
                        boxShadow: '0 0 20px rgba(0, 243, 100, 0.3)'
                    }} />
                    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                </div>
            )}

            {/* VERDICT OVERLAY (Phase 3) */}
            {!loading && (
                <div style={{
                    position: 'absolute',
                    top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    textAlign: 'center', pointerEvents: 'none',
                    opacity: progress > 0.8 ? 1 : 0,
                    transition: 'opacity 1s ease',
                    zIndex: 10
                }}>
                    <h3 style={{
                        color: 'white', fontSize: '3rem', fontWeight: 100,
                        letterSpacing: '0.2em', textTransform: 'uppercase', margin: 0,
                        textShadow: '0 0 30px rgba(0, 243, 100, 0.3)'
                    }}>
                        {divergenceLabel}
                    </h3>
                    <div style={{
                        width: '40px', height: '1px', background: '#444',
                        margin: '20px auto'
                    }} />
                    <p style={{
                        color: '#888', fontSize: '11px', fontFamily: 'monospace',
                        textTransform: 'uppercase', letterSpacing: '0.2em'
                    }}>
                        Consensus Score: {consensusScore}%
                    </p>
                </div>
            )}
        </div>
    );
};

export default ConstellationGraph;
