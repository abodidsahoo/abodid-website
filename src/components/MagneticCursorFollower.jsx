import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const RING_POSITION_LAMBDA = 10;
const RING_VISUAL_LAMBDA = 14;
const HOTSPOT_OFFSET_X = -1;
const HOTSPOT_OFFSET_Y = -1;
const CUSTOM_CURSOR_ATTR = "data-custom-cursor";
const HIDE_NATIVE_CURSOR_SELECTOR = [
  "body",
  "a[href]",
  "button",
  "summary",
  "label[for]",
  "[role='button']",
  "[data-cursor-hide-native]",
].join(", ");
const NATIVE_CURSOR_SELECTOR = [
  "input:not([type='checkbox']):not([type='radio']):not([type='range']):not([type='button']):not([type='submit']):not([type='reset'])",
  "textarea",
  "select",
  "[contenteditable='true']",
  "[data-native-cursor]",
  "[data-native-cursor] *",
  ".cursor-revealed",
  ".cursor-revealed *",
  "iframe",
  "video[controls]",
].join(", ");

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
  background: "var(--cursor-dot-bg)",
  boxShadow:
    "0 0 0 1px var(--cursor-dot-outline), 0 0 7px var(--cursor-dot-glow), 0 0 2px var(--cursor-shadow)",
};

const ringStyle = {
  position: "absolute",
  left: 0,
  top: 0,
  width: "26px",
  height: "26px",
  borderRadius: "999px",
  border: "1px solid var(--cursor-ring-border)",
  boxShadow: "0 0 2px var(--cursor-shadow)",
  willChange: "transform, opacity",
};

const MagneticCursorFollower = () => {
  const layerRef = useRef(null);
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const [mounted, setMounted] = React.useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return undefined;
    if (window.matchMedia("(pointer: coarse)").matches) return undefined;

    const styleEl = document.createElement("style");
    styleEl.textContent = `
      html[${CUSTOM_CURSOR_ATTR}="active"] ${HIDE_NATIVE_CURSOR_SELECTOR} {
        cursor: none !important;
      }

      html[${CUSTOM_CURSOR_ATTR}="active"] ${NATIVE_CURSOR_SELECTOR} {
        cursor: auto !important;
      }
    `;
    document.head.appendChild(styleEl);
    document.documentElement.setAttribute(CUSTOM_CURSOR_ATTR, "active");

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

    const updatePointer = (event) => {
      if (
        !event ||
        typeof event.clientX !== "number" ||
        typeof event.clientY !== "number"
      ) {
        return;
      }

      target.x = event.clientX + HOTSPOT_OFFSET_X;
      target.y = event.clientY + HOTSPOT_OFFSET_Y;
      dot.x = target.x;
      dot.y = target.y;

      if (!initialized) {
        ring.x = target.x;
        ring.y = target.y;
        initialized = true;
        lastTime = performance.now();
      }

      sync();
      setVisible(true);
    };

    const onPointerMove = (event) => {
      if (event.pointerType === "touch") return;
      updatePointer(event);
    };

    const onMouseMove = (event) => {
      updatePointer(event);
    };

    const onPointerLeaveWindow = (event) => {
      if (event.relatedTarget === null) {
        setVisible(false);
      }
    };

    const onBlur = () => setVisible(false);
    const teardownCursorMode = () => {
      document.documentElement.removeAttribute(CUSTOM_CURSOR_ATTR);
      styleEl.remove();
    };

    const loop = (now) => {
      if (initialized) {
        const dtSeconds = Math.min(0.034, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;

        ring.x = smoothDamp(ring.x, target.x, RING_POSITION_LAMBDA, dtSeconds);
        ring.y = smoothDamp(ring.y, target.y, RING_POSITION_LAMBDA, dtSeconds);

        const ringGap = Math.hypot(target.x - ring.x, target.y - ring.y);
        const movingRatio = Math.min(1, ringGap / 20);
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
    document.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    document.addEventListener("mousemove", onMouseMove, true);
    window.addEventListener("pointerdown", onPointerMove, { passive: true, capture: true });
    window.addEventListener("pointerup", onPointerMove, { passive: true, capture: true });
    window.addEventListener("mouseout", onPointerLeaveWindow, { passive: true });
    window.addEventListener("blur", onBlur);
    window.addEventListener("pagehide", teardownCursorMode);
    rafId = window.requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mousemove", onMouseMove, true);
      window.removeEventListener("pointerdown", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerMove, true);
      window.removeEventListener("mouseout", onPointerLeaveWindow);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pagehide", teardownCursorMode);
      teardownCursorMode();
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  if (!mounted || typeof document === "undefined") return null;

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
