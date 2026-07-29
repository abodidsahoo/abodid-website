import { useCallback, useEffect, useRef } from "react";
import { useHandTracking } from "./useHandTracking";

const DRAW_ZONE_SELECTOR = "[data-punctum-gesture-draw-zone]";
const ACTION_SELECTOR = [
  "button:not(:disabled)",
  "a[href]",
  "input:not(:disabled)",
  "textarea:not(:disabled)",
  "select:not(:disabled)",
  "[role='button']:not([aria-disabled='true'])",
].join(",");
const GESTURE_POINTER_ID = 9107;
const POINTER_SAMPLE_COUNT = 3;
const POINTER_DEAD_ZONE_PX = 0.55;
const ACTION_CLICK_TRAVEL_PX = 64;
const LEFT_FLICK_MIN_X_PX = 52;
const LEFT_FLICK_HORIZONTAL_BIAS = 1.7;

export const PUNCTUM_LEFT_FLICK_EVENT = "punctum:gesture-left-flick";

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const findAction = (element) => {
  const action = element?.closest?.(ACTION_SELECTOR);
  if (!action || action.matches(":disabled, [aria-disabled='true']")) return null;
  return action;
};

const dispatchGesturePointer = (target, type, point) => {
  if (!target || typeof window === "undefined") return;
  target.dispatchEvent(
    new window.PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: GESTURE_POINTER_ID,
      pointerType: "pen",
      isPrimary: true,
      clientX: point.x,
      clientY: point.y,
      button: type === "pointermove" ? -1 : 0,
      buttons: type === "pointerup" || type === "pointercancel" ? 0 : 1,
      pressure: type === "pointerup" || type === "pointercancel" ? 0 : 0.62,
    }),
  );
};

export const getPunctumGestureStatus = ({
  enabled,
  onboardingState,
  handDetected,
}) => {
  if (!enabled) return "Optional · use your hand and pinch to draw";
  switch (onboardingState) {
    case "requesting_camera":
      return "Allow camera access in the browser";
    case "loading_model":
      return "Preparing gesture control…";
    case "waiting_for_hand":
      return "Show one hand to the camera";
    case "calibrating":
      return "Hold your hand still for a moment";
    case "ready":
      return handDetected
        ? "Pinch to draw · side flick left to continue"
        : "Bring your hand into view";
    case "hand_lost_temporarily":
      return "Bring your hand back into view";
    case "error":
      return "Camera unavailable · continue with the pointer";
    default:
      return "Preparing gesture control…";
  }
};

export function usePunctumGestureControl({ enabled }) {
  const pointerRef = useRef(null);
  const lastPointRef = useRef({ x: 0, y: 0, initialized: false });
  const pointSamplesRef = useRef([]);
  const isPinchingRef = useRef(false);
  const activeDrawZoneRef = useRef(null);
  const activeActionRef = useRef(null);

  const updateGesturePointer = useCallback(
    (rawX, rawY, { pinching = false } = {}) => {
      if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) {
        return lastPointRef.current;
      }

      const viewportX = Math.min(window.innerWidth - 1, Math.max(0, rawX));
      const viewportY = Math.min(window.innerHeight - 1, Math.max(0, rawY));

      const samples = [
        ...pointSamplesRef.current,
        { x: viewportX, y: viewportY },
      ].slice(-POINTER_SAMPLE_COUNT);
      pointSamplesRef.current = samples;

      const drawingActive = pinching && Boolean(activeDrawZoneRef.current);
      const stableX = drawingActive
        ? viewportX
        : median(samples.map((sample) => sample.x));
      const stableY = drawingActive
        ? viewportY
        : median(samples.map((sample) => sample.y));
      const previous = lastPointRef.current;
      const distance = previous.initialized
        ? Math.hypot(stableX - previous.x, stableY - previous.y)
        : 0;

      let amount = 1;
      if (previous.initialized && distance > POINTER_DEAD_ZONE_PX) {
        if (drawingActive) {
          if (distance < 4) amount = 0.42;
          else if (distance < 24) amount = 0.64;
          else if (distance < 100) amount = 0.78;
          else amount = 0.86;
        } else if (pinching) {
          amount = distance < 12 ? 0.36 : 0.52;
        } else if (distance < 6) amount = 0.3;
        else if (distance < 32) amount = 0.46;
        else if (distance < 110) amount = 0.6;
        else amount = 0.72;
      } else if (previous.initialized) {
        amount = 0;
      }

      const point = {
        x: previous.initialized
          ? previous.x + (stableX - previous.x) * amount
          : stableX,
        y: previous.initialized
          ? previous.y + (stableY - previous.y) * amount
          : stableY,
        initialized: true,
      };
      lastPointRef.current = point;

      const element = document.elementFromPoint(point.x, point.y);
      const drawZone = element?.closest?.(DRAW_ZONE_SELECTOR) || null;
      const action = drawZone ? null : findAction(element);

      const pointer = pointerRef.current;
      if (pointer) {
        pointer.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
        pointer.classList.add("is-visible");
        pointer.classList.toggle("is-pencil", Boolean(drawZone));
        pointer.classList.toggle("is-action", Boolean(action));
        pointer.classList.toggle("is-pinching", pinching);
      }

      return point;
    },
    [],
  );

  const handleHandMove = useCallback(
    (metrics) => {
      updateGesturePointer(metrics.x, metrics.y, {
        pinching: isPinchingRef.current,
      });
    },
    [updateGesturePointer],
  );

  const handlePinchChange = useCallback(
    (metrics) => {
      const point = lastPointRef.current;
      if (!point.initialized) return;

      isPinchingRef.current = metrics.phase !== "end";
      pointerRef.current?.classList.toggle(
        "is-pinching",
        isPinchingRef.current,
      );

      if (metrics.phase === "start") {
        const element = document.elementFromPoint(point.x, point.y);
        const drawZone = element?.closest?.(DRAW_ZONE_SELECTOR) || null;

        if (drawZone) {
          activeActionRef.current = null;
          activeDrawZoneRef.current = drawZone;
          dispatchGesturePointer(drawZone, "pointerdown", point);
          return;
        }

        const action = findAction(element);
        activeActionRef.current = action
          ? { element: action, x: point.x, y: point.y }
          : null;
        action?.classList.add("is-gesture-pressed");
        return;
      }

      if (metrics.phase === "move") {
        if (activeDrawZoneRef.current) {
          dispatchGesturePointer(activeDrawZoneRef.current, "pointermove", point);
        }
        return;
      }

      if (activeDrawZoneRef.current) {
        dispatchGesturePointer(activeDrawZoneRef.current, "pointerup", point);
        activeDrawZoneRef.current = null;
        return;
      }

      const activeAction = activeActionRef.current;
      activeActionRef.current = null;
      activeAction?.element.classList.remove("is-gesture-pressed");
      if (!activeAction || metrics.endedBy === "hand_lost") return;

      const releaseElement = document.elementFromPoint(point.x, point.y);
      const releaseAction = findAction(releaseElement);
      const travel = Math.hypot(point.x - activeAction.x, point.y - activeAction.y);
      if (
        releaseAction !== activeAction.element ||
        travel > ACTION_CLICK_TRAVEL_PX
      ) {
        return;
      }

      if (
        activeAction.element instanceof HTMLInputElement ||
        activeAction.element instanceof HTMLTextAreaElement ||
        activeAction.element instanceof HTMLSelectElement
      ) {
        activeAction.element.focus({ preventScroll: true });
      }
      activeAction.element.click();
    },
    [],
  );

  const handleSideFlick = useCallback((dx, dy) => {
    if (
      dx > -LEFT_FLICK_MIN_X_PX ||
      Math.abs(dx) < Math.abs(dy) * LEFT_FLICK_HORIZONTAL_BIAS
    ) {
      return;
    }

    window.dispatchEvent(
      new CustomEvent(PUNCTUM_LEFT_FLICK_EVENT, {
        detail: { direction: "left", dx, dy },
      }),
    );
  }, []);

  const tracking = useHandTracking({
    isActive: enabled,
    engine: "mediapipe",
    motionSource: "index",
    gestureMotionSource: "hand",
    gestureMode: "hand",
    gesturePosture: "side-wave",
    threshold: 58,
    gestureCooldownMs: 1250,
    pinchMode: "single-hand-horizontal",
    pinchEngageThreshold: 0.14,
    pinchReleaseThreshold: 0.27,
    pinchIntentHoldMs: 170,
    onHandMove: handleHandMove,
    onPinchChange: handlePinchChange,
    onGesture: handleSideFlick,
  });

  useEffect(() => {
    const pointer = pointerRef.current;
    const site = document.querySelector(".punctum-site");
    const gestureHasControl = enabled && tracking.handDetected;

    site?.classList.toggle("has-gesture-hand-control", gestureHasControl);

    if (enabled && tracking.handDetected) {
      pointer?.classList.add("is-visible");
    } else {
      pointer?.classList.remove(
        "is-visible",
        "is-pinching",
        "is-pencil",
        "is-action",
      );

      if (activeDrawZoneRef.current) {
        dispatchGesturePointer(
          activeDrawZoneRef.current,
          "pointercancel",
          lastPointRef.current,
        );
        activeDrawZoneRef.current = null;
      }
      activeActionRef.current?.element.classList.remove("is-gesture-pressed");
      activeActionRef.current = null;
      isPinchingRef.current = false;
      lastPointRef.current = { x: 0, y: 0, initialized: false };
      pointSamplesRef.current = [];
    }

    return () => {
      site?.classList.remove("has-gesture-hand-control");
    };
  }, [enabled, tracking.handDetected]);

  useEffect(
    () => () => {
      document
        .querySelector(".punctum-site")
        ?.classList.remove("has-gesture-hand-control");
      activeActionRef.current?.element.classList.remove("is-gesture-pressed");
    },
    [],
  );

  return {
    ...tracking,
    pointerRef,
  };
}
