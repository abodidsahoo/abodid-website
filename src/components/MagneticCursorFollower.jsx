import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const DOT_FOLLOW_LAMBDA = 26;
const RING_POSITION_LAMBDA = 10;
const RING_VISUAL_LAMBDA = 14;
const HOTSPOT_OFFSET_X = -1;
const HOTSPOT_OFFSET_Y = -1;

const layerStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 2147483647,
  pointerEvents: "none",
  opacity: 0,
  transition: "opacity 140ms ease-out",
};

const followerStyle = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
};

const dotStyle = {
  position: "absolute",
  left: 0,
  top: 0,
  width: "5px",
  height: "5px",
  borderRadius: "999px",
  transform: "translate(-50%, -50%)",
  background: "rgba(255, 255, 255, 0.92)",
  boxShadow:
    "0 0 0 1px rgba(255, 255, 255, 0.18), 0 0 7px rgba(255, 255, 255, 0.36), 0 0 2px rgba(0, 0, 0, 0.65)",
};

const ringStyle = {
  position: "absolute",
  left: 0,
  top: 0,
  width: "26px",
  height: "26px",
  borderRadius: "999px",
  border: "1px solid rgba(255, 255, 255, 0.52)",
  boxShadow: "0 0 2px rgba(0, 0, 0, 0.55)",
  willChange: "transform, opacity",
};

const MagneticCursorFollower = () => {
  const layerRef = useRef(null);
  const dotRef = useRef(null);
  const ringRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (window.matchMedia("(pointer: coarse)").matches) return undefined;

    const target = { x: -1000, y: -1000 };
    const dot = { x: -1000, y: -1000 };
    const ring = { x: -1000, y: -1000 };
    const ringVisual = { scale: 1, opacity: 0.52 };

    let rafId = null;
    let lastTime = 0;
    let initialized = false;
    let isVisible = false;

    const setVisible = (nextVisible) => {
      if (!layerRef.current || isVisible === nextVisible) return;
      layerRef.current.style.opacity = nextVisible ? "1" : "0";
      isVisible = nextVisible;
    };

    const smoothDamp = (current, destination, lambda, dtSeconds) =>
      current + (destination - current) * (1 - Math.exp(-lambda * dtSeconds));

    const sync = () => {
      if (!dotRef.current || !ringRef.current) return;
      dotRef.current.style.transform = `translate3d(${dot.x}px, ${dot.y}px, 0) translate(-50%, -50%)`;
      ringRef.current.style.transform = `translate3d(${ring.x}px, ${ring.y}px, 0) translate(-50%, -50%) scale(${ringVisual.scale})`;
      ringRef.current.style.opacity = String(ringVisual.opacity);
    };

    const onPointerMove = (event) => {
      target.x = event.clientX + HOTSPOT_OFFSET_X;
      target.y = event.clientY + HOTSPOT_OFFSET_Y;

      if (!initialized) {
        dot.x = target.x;
        dot.y = target.y;
        ring.x = target.x;
        ring.y = target.y;
        initialized = true;
        lastTime = performance.now();
        sync();
      }

      setVisible(true);
    };

    const onPointerLeaveWindow = (event) => {
      if (event.relatedTarget === null) {
        setVisible(false);
      }
    };

    const onBlur = () => setVisible(false);

    const loop = (now) => {
      if (initialized) {
        const dtSeconds = Math.min(0.034, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;

        dot.x = smoothDamp(dot.x, target.x, DOT_FOLLOW_LAMBDA, dtSeconds);
        dot.y = smoothDamp(dot.y, target.y, DOT_FOLLOW_LAMBDA, dtSeconds);
        ring.x = smoothDamp(ring.x, dot.x, RING_POSITION_LAMBDA, dtSeconds);
        ring.y = smoothDamp(ring.y, dot.y, RING_POSITION_LAMBDA, dtSeconds);

        const dotGap = Math.hypot(target.x - dot.x, target.y - dot.y);
        const ringGap = Math.hypot(dot.x - ring.x, dot.y - ring.y);
        const movingRatio = Math.min(1, Math.max(dotGap / 24, ringGap / 20));
        const targetRingScale = movingRatio > 0.03 ? 1 : 1.18;
        const targetRingOpacity = movingRatio > 0.03 ? 0.52 : 0.34;

        ringVisual.scale = smoothDamp(
          ringVisual.scale,
          targetRingScale,
          RING_VISUAL_LAMBDA,
          dtSeconds,
        );
        ringVisual.opacity = smoothDamp(
          ringVisual.opacity,
          targetRingOpacity,
          RING_VISUAL_LAMBDA,
          dtSeconds,
        );

        sync();
      }

      rafId = window.requestAnimationFrame(loop);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("mouseout", onPointerLeaveWindow, { passive: true });
    window.addEventListener("blur", onBlur);
    rafId = window.requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("mouseout", onPointerLeaveWindow);
      window.removeEventListener("blur", onBlur);
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div ref={layerRef} aria-hidden="true" style={layerStyle}>
      <div style={followerStyle}>
        <span ref={dotRef} style={dotStyle} />
        <span ref={ringRef} style={ringStyle} />
      </div>
    </div>,
    document.body,
  );
};

export default MagneticCursorFollower;
