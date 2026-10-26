import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { createDie, DieFlick } from "./die-scene";

export default function DiceButton({
  disabled,
  onRoll,
}: {
  disabled: boolean;
  onRoll: (direction?: number) => Promise<void>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const model = useRef<ReturnType<typeof createDie>>();
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    dx: number;
    dy: number;
    samples: { x: number; y: number; time: number }[];
  }>();
  const suppressClick = useRef(false),
    rolling = useRef(false);
  const [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [dragging, setDragging] = useState(false);
  useEffect(() => {
    let cancelled = false;
    import("./die-scene")
      .then(({ createDie }) => {
        if (cancelled || !canvas.current) return;
        model.current = createDie(canvas.current);
        setLoaded(true);
      })
      .catch(() => {
        /* The static die remains a working discovery button without WebGL. */
      });
    return () => {
      cancelled = true;
      model.current?.dispose();
      model.current = undefined;
    };
  }, []);
  const roll = async (flick: DieFlick = { x: 0, y: 0 }) => {
    if (disabled || rolling.current) return;
    rolling.current = true;
    setBusy(true);
    try {
      await Promise.all([
        model.current?.roll(flick),
        onRoll(
          Math.abs(flick.velocity?.x ?? flick.x) > 5
            ? Math.sign(flick.velocity?.x ?? flick.x)
            : undefined,
        ),
      ]);
    } finally {
      rolling.current = false;
      setBusy(false);
    }
  };
  const clearGesture = () => {
    gesture.current = undefined;
    setDragging(false);
  };
  const down = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled || busy || event.button !== 0) return;
    suppressClick.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      dx: 0,
      dy: 0,
      samples: [{ x: event.clientX, y: event.clientY, time: event.timeStamp }],
    };
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = gesture.current;
    if (!drag || drag.id !== event.pointerId) return;
    drag.dx = event.clientX - drag.x;
    drag.dy = event.clientY - drag.y;
    drag.samples.push({
      x: event.clientX,
      y: event.clientY,
      time: event.timeStamp,
    });
    // Use the last ~90ms, so releasing after a pause produces a gentle roll.
    while (
      drag.samples.length > 2 &&
      drag.samples[1].time < event.timeStamp - 90
    )
      drag.samples.shift();
    if (Math.hypot(drag.dx, drag.dy) > 5) setDragging(true);
    model.current?.preview({ x: drag.dx, y: drag.dy });
  };
  const up = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = gesture.current;
    if (!drag || drag.id !== event.pointerId) return;
    const flick = Math.hypot(drag.dx, drag.dy) > 5;
    clearGesture();
    if (flick) {
      suppressClick.current = true;
      const sample = drag.samples[0];
      const elapsed = Math.max(1, event.timeStamp - sample.time) / 1000;
      const velocity = {
        x: (event.clientX - sample.x) / elapsed,
        y: (event.clientY - sample.y) / elapsed,
      };
      void roll({ x: drag.dx, y: drag.dy, velocity });
    } else model.current?.reset();
  };
  return (
    <button
      type="button"
      className={`discovery-die${dragging ? " is-dragging" : ""}`}
      disabled={disabled || busy}
      aria-label="Roll the die to discover an artist"
      aria-busy={busy}
      data-rolling={busy}
      data-model-ready={loaded}
      title="Roll to discover an artist · click or flick"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => {
        clearGesture();
        model.current?.reset();
      }}
      onLostPointerCapture={() => {
        if (gesture.current) {
          clearGesture();
          model.current?.reset();
        }
      }}
      onClick={(event) => {
        if (suppressClick.current && event.detail > 0) {
          suppressClick.current = false;
          return;
        }
        suppressClick.current = false;
        void roll();
      }}
    >
      <span className="die-shadow" aria-hidden="true" />
      {!loaded && (
        <span className="die-fallback" aria-hidden="true">
          ⚄
        </span>
      )}
      <canvas
        ref={canvas}
        className="die-model"
        aria-hidden="true"
        style={{ visibility: loaded ? "visible" : "hidden" }}
      />
    </button>
  );
}
