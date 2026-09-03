import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getPunctumImageById } from "../../data/punctumImages";
import {
  derivePunctumPolygon,
  verticesToSmoothSvgPath,
} from "../../lib/punctum/geometry";
import {
  DEFAULT_PUNCTUM_IMAGE_MODEL_ID,
  getPunctumImageModelOption,
  PUNCTUM_IMAGE_MODEL_OPTIONS,
} from "../../lib/punctum/worlds/model-options";
import PunctumBuildCanvas from "./PunctumBuildCanvas";

const DEFAULT_PALETTE = [
  "#e9e0d3",
  "#d2b894",
  "#9c7860",
  "#5f675c",
  "#2d3230",
];

const ANSWERS = [
  ["yes", "Yes"],
  ["no", "No"],
];

const GENERATION_TERMINAL_STEPS = [
  "Extracting your selected punctum",
  "Mapping its shape and position",
  "Sampling the source colour palette",
  "Analysing surrounding visual context",
  "Building the photographic generation prompt",
  "Sending context to the image model",
  "Synthesising a new visual world",
  "Refining composition, light and texture",
  "Rendering the final image",
  "Preparing your generated world",
];

const TERMINAL_VISIBLE_LINES = 4;
const TERMINAL_LINE_HEIGHT = 26;
const TERMINAL_TYPE_DELAY = 34;
const TERMINAL_STEP_HOLD = 950;

const normalizeReflectionAnswer = (answer) => {
  if (answer === "yes" || answer === "still") return "yes";
  if (answer === "no" || answer === "moved" || answer === "disappeared") {
    return "no";
  }
  return "";
};

const GENERATION_SESSION_STORAGE_KEY = "punctum-ai-world-session-id";
let memoryGenerationSessionId = "";

const createId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const getGenerationSessionId = () => {
  if (memoryGenerationSessionId) return memoryGenerationSessionId;
  try {
    const researchSessionId = globalThis.sessionStorage?.getItem(
      "punctum-session-id",
    );
    if (researchSessionId) {
      memoryGenerationSessionId = researchSessionId;
      return memoryGenerationSessionId;
    }
    const existing = globalThis.sessionStorage?.getItem(
      GENERATION_SESSION_STORAGE_KEY,
    );
    if (existing) {
      memoryGenerationSessionId = existing;
      return memoryGenerationSessionId;
    }
    memoryGenerationSessionId = createId();
    globalThis.sessionStorage?.setItem(
      GENERATION_SESSION_STORAGE_KEY,
      memoryGenerationSessionId,
    );
    return memoryGenerationSessionId;
  } catch {
    memoryGenerationSessionId ||= createId();
    return memoryGenerationSessionId;
  }
};

class PunctumRequestError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "PunctumRequestError";
    this.status = details.status || 0;
    this.code = details.code || "";
    this.retryAfter = Number(details.retryAfter) || 0;
    this.limit = Number(details.limit) || 0;
    this.used = Number(details.used) || 0;
  }
}

const requestErrorFromPayload = (response, payload, fallback) =>
  new PunctumRequestError(payload.error || fallback, {
    status: response.status,
    code: payload.code,
    retryAfter:
      payload.retryAfter || response.headers.get("retry-after") || 0,
    limit: payload.limit,
    used: payload.used,
  });

const fetchJson = async (url, options) => {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw requestErrorFromPayload(response, payload, "Request failed.");
  }
  return payload;
};

const formatRetryTime = (seconds) => {
  const rounded = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const minuteRemainder = minutes % 60;
    return `${hours}h ${String(minuteRemainder).padStart(2, "0")}m`;
  }
  if (minutes > 0) return `${minutes}m ${String(remainder).padStart(2, "0")}s`;
  return `${remainder}s`;
};

const isGenerationLimitFailure = (code, message) =>
  code === "generation_rate_limit" ||
  code === "generation_capacity_limit" ||
  /\b429\b|quota|rate[-_\s]?limit|resource[-_\s]?exhausted|public limit/i.test(
    message || "",
  );

function PolygonOutline({ vertices, className = "" }) {
  if (!Array.isArray(vertices) || vertices.length < 3) return null;
  return (
    <svg
      className={`punctum-world-polygon ${className}`.trim()}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        className="punctum-selection-halo punctum-selection-halo--outer"
        d={verticesToSmoothSvgPath(vertices)}
        vectorEffect="non-scaling-stroke"
      />
      <path
        className="punctum-selection-halo punctum-selection-halo--inner"
        d={verticesToSmoothSvgPath(vertices)}
        vectorEffect="non-scaling-stroke"
      />
      <path
        className="punctum-world-polygon__line"
        d={verticesToSmoothSvgPath(vertices)}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function LiveDrawingStroke({ points }) {
  if (!Array.isArray(points) || points.length === 0) return null;
  const svgPoints = points
    .map((point) => `${point.x * 100},${point.y * 100}`)
    .join(" ");

  return (
    <svg
      className="punctum-draw__mark-layer punctum-world-draw__mark-layer"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g className="punctum-draw__stroke-texture">
        <polyline
          className="punctum-draw__stroke-base"
          points={svgPoints}
        />
        <polyline
          className="punctum-draw__stroke-stripe punctum-draw__stroke-stripe--blue"
          points={svgPoints}
          transform="translate(0 -0.55)"
        />
        <polyline
          className="punctum-draw__stroke-stripe punctum-draw__stroke-stripe--red"
          points={svgPoints}
          transform="translate(0 -0.18)"
        />
        <polyline
          className="punctum-draw__stroke-stripe punctum-draw__stroke-stripe--yellow"
          points={svgPoints}
          transform="translate(0 0.18)"
        />
        <polyline
          className="punctum-draw__stroke-stripe punctum-draw__stroke-stripe--green"
          points={svgPoints}
          transform="translate(0 0.55)"
        />
      </g>
    </svg>
  );
}

function SourceFigure({ source }) {
  const explanation = (source.explanation || "")
    .replace(/^No written explanation.*$/i, "")
    .trim();

  return (
    <figure className="punctum-world-source">
      <div
        className="punctum-world-source__image"
        style={{ aspectRatio: `${source.width} / ${source.height}` }}
      >
        <img src={source.imageUrl} alt="Source image for this generated world" />
        <PolygonOutline vertices={source.polygon} />
      </div>
      {explanation && (
        <figcaption>
          <p>{explanation}</p>
        </figcaption>
      )}
    </figure>
  );
}

function ModelPicker({ selectedModelId, onChange, onGenerate }) {
  return (
    <section className="punctum-world-model-picker" aria-labelledby="punctum-model-heading">
      <div className="punctum-world-model-picker__heading">
        <h2 id="punctum-model-heading">Choose quality</h2>
      </div>
      <div className="punctum-world-model-container">
        <div className="punctum-world-model-button-group" role="radiogroup" aria-label="Reimagine quality">
          {PUNCTUM_IMAGE_MODEL_OPTIONS.map((option) => {
            const isSelected = selectedModelId === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`punctum-button punctum-world-model-btn ${
                  isSelected
                    ? "punctum-button--yellow is-selected"
                    : "punctum-button--light"
                }`}
                onClick={() => onChange(option.id)}
              >
                <span className="punctum-world-model-btn__title">{option.label}</span>
                <span className="punctum-world-model-btn__tech">
                  {option.sublabel} · {option.priceTag || option.resolution}
                </span>
              </button>
            );
          })}
        </div>
        <button
          className="punctum-button punctum-button--yellow punctum-world-model-picker__generate"
          type="button"
          onClick={onGenerate}
        >
          Generate a new world from your punctum →
        </button>
      </div>
    </section>
  );
}

function GenerationTerminal({ onComplete }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [characterCount, setCharacterCount] = useState(0);
  const completionNotifiedRef = useRef(false);
  const currentStep = GENERATION_TERMINAL_STEPS[stepIndex];

  useEffect(() => {
    if (!currentStep) return undefined;

    if (characterCount < currentStep.length) {
      const typeTimer = window.setTimeout(
        () => setCharacterCount((count) => count + 1),
        TERMINAL_TYPE_DELAY,
      );
      return () => window.clearTimeout(typeTimer);
    }

    if (stepIndex >= GENERATION_TERMINAL_STEPS.length - 1) {
      if (!onComplete || completionNotifiedRef.current) return undefined;
      const completionTimer = window.setTimeout(() => {
        completionNotifiedRef.current = true;
        onComplete();
      }, TERMINAL_STEP_HOLD);
      return () => window.clearTimeout(completionTimer);
    }

    const nextStepTimer = window.setTimeout(() => {
      setStepIndex((index) => index + 1);
      setCharacterCount(0);
    }, TERMINAL_STEP_HOLD);
    return () => window.clearTimeout(nextStepTimer);
  }, [characterCount, currentStep, onComplete, stepIndex]);

  const visibleStepCount = stepIndex + 1;
  const offset =
    Math.max(0, visibleStepCount - TERMINAL_VISIBLE_LINES) *
    TERMINAL_LINE_HEIGHT;

  return (
    <div className="punctum-world-result__terminal">
      <div className="punctum-world-result__terminal-bar" aria-hidden="true">
        <i />
        <i />
        <i />
        <span>generation.log</span>
      </div>
      <div
        className="punctum-world-result__terminal-viewport"
        aria-hidden="true"
      >
        <div
          className="punctum-world-result__terminal-track"
          style={{ transform: `translateY(-${offset}px)` }}
        >
          {GENERATION_TERMINAL_STEPS.slice(0, visibleStepCount).map(
            (step, index) => {
              const isActive = index === stepIndex;
              return (
                <div
                  className={`punctum-world-result__terminal-line ${
                    isActive ? "is-active" : "is-complete"
                  }`}
                  key={step}
                >
                  <span className="punctum-world-result__terminal-prompt">
                    {isActive ? "›" : "✓"}
                  </span>
                  <span className="punctum-world-result__terminal-command">
                    <span>
                      {isActive ? step.slice(0, characterCount) : step}
                    </span>
                    {isActive && (
                      <i className="punctum-world-result__terminal-cursor" />
                    )}
                  </span>
                </div>
              );
            },
          )}
        </div>
      </div>
      <span className="visually-hidden" aria-live="polite">
        {characterCount === currentStep.length ? currentStep : ""}
      </span>
    </div>
  );
}

function DrawNewPunctum({
  generation,
  accessToken,
  drawTarget,
  onGenerateAnother,
  onGenerationUpdated,
}) {
  const [answer, setAnswer] = useState(
    normalizeReflectionAnswer(generation.postGenerationAnswer),
  );
  const [polygon, setPolygon] = useState(
    generation.postGenerationPolygon || null,
  );
  const [explanation, setExplanation] = useState(
    generation.postGenerationExplanation || "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [stroke, setStroke] = useState([]);
  const strokeRef = useRef([]);
  const drawingRef = useRef(false);
  const startedAtRef = useRef(0);
  const canEdit = Boolean(accessToken);
  const sourceResultImage = getPunctumImageById(generation.sourceImageId);
  const sourceResultHref = sourceResultImage
    ? `/research/punctum/results/${sourceResultImage.slug}`
    : "/research/punctum/results";

  useEffect(() => {
    strokeRef.current = [];
    drawingRef.current = false;
    setStroke([]);
    setAnswer(normalizeReflectionAnswer(generation.postGenerationAnswer));
    setPolygon(generation.postGenerationPolygon || null);
    setExplanation(generation.postGenerationExplanation || "");
    setError("");
  }, [generation.id]);

  const pointFromEvent = (event, element) => {
    const rect = element.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
      t: performance.now() - startedAtRef.current,
    };
  };

  const startDrawing = (event) => {
    if (
      !canEdit ||
      answer !== "no" ||
      polygon ||
      (event.pointerType === "mouse" && event.button !== 0)
    ) {
      return;
    }
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Keep drawing even if this browser cannot capture the active pointer.
    }
    startedAtRef.current = performance.now();
    const first = [pointFromEvent(event, event.currentTarget)];
    strokeRef.current = first;
    drawingRef.current = true;
    setStroke(first);
    setPolygon(null);
    setError("");
  };

  const moveDrawing = (event) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const coalescedEvents = event.nativeEvent?.getCoalescedEvents?.();
    const samples = coalescedEvents?.length
      ? coalescedEvents
      : [event.nativeEvent || event];
    const next = [...strokeRef.current];
    for (const sample of samples) {
      const point = pointFromEvent(sample, event.currentTarget);
      const previous = next[next.length - 1];
      if (
        previous &&
        Math.hypot(point.x - previous.x, point.y - previous.y) < 0.0015
      ) {
        continue;
      }
      next.push(point);
    }
    if (next.length === strokeRef.current.length) return;
    strokeRef.current = next;
    setStroke(next);
  };

  const finishDrawing = (event) => {
    if (!drawingRef.current) return;
    event?.preventDefault?.();
    const element = event?.currentTarget;
    const finalPoint =
      event && element
        ? pointFromEvent(event.nativeEvent || event, element)
        : null;
    const previous = strokeRef.current[strokeRef.current.length - 1];
    if (
      finalPoint &&
      (!previous ||
        Math.hypot(finalPoint.x - previous.x, finalPoint.y - previous.y) >=
          0.0015)
    ) {
      strokeRef.current = [...strokeRef.current, finalPoint];
      setStroke(strokeRef.current);
    }
    drawingRef.current = false;
    const nextPolygon = derivePunctumPolygon(strokeRef.current);
    if (nextPolygon) setPolygon(nextPolygon.vertices);
  };

  const clearMark = () => {
    drawingRef.current = false;
    strokeRef.current = [];
    setStroke([]);
    setPolygon(null);
    setError("");
  };

  const persist = async (nextAnswer = answer, nextPolygon = polygon) => {
    if (!accessToken) return generation;
    const payload = await fetchJson("/api/punctum/generations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationId: generation.id,
        accessToken,
        answer: nextAnswer,
        polygon: nextPolygon,
        explanation,
      }),
    });
    return payload.generation;
  };

  const chooseAnswer = async (value) => {
    setAnswer(value);
    clearMark();
    setExplanation("");
    setError("");
    if (value !== "yes" || !canEdit) return;

    setSaving(true);
    try {
      const saved = await persist("still", null);
      onGenerationUpdated(saved);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const saveAndProceed = async () => {
    if (answer !== "no" || !polygon || !canEdit) return;
    setSaving(true);
    setError("");
    try {
      const saved = await persist("moved", polygon);
      onGenerationUpdated(saved);
      onGenerateAnother({
        parent: { ...saved, accessToken },
        polygon,
        explanation,
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const drawingSurface =
    drawTarget && answer === "no"
      ? createPortal(
          <>
            {!polygon && <LiveDrawingStroke points={stroke} />}
            <PolygonOutline vertices={polygon} className="is-new" />
            {canEdit && !polygon && (
              <div
                className="punctum-world-draw__pointer-layer"
                data-punctum-gesture-draw-zone
                onPointerDown={startDrawing}
                onPointerMove={moveDrawing}
                onPointerUp={finishDrawing}
                onPointerCancel={finishDrawing}
                onLostPointerCapture={finishDrawing}
                aria-label="Draw over what catches your attention in the generated photograph"
                role="application"
                tabIndex={0}
              />
            )}
          </>,
          drawTarget,
        )
      : null;

  return (
    <section
      className={`punctum-world-reflection is-${answer || "unanswered"}`}
    >
      {!answer && canEdit && (
        <div className="punctum-world-reflection__question">
          <p className="punctum-eyebrow">Look again</p>
          <h2>Does the same thing still draw your attention?</h2>
          <div className="punctum-world-answers">
            {ANSWERS.map(([value, label]) => (
              <button
                type="button"
                aria-pressed="false"
                onClick={() => void chooseAnswer(value)}
                key={value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {answer === "yes" && (
        <div className="punctum-world-reflection__yes" aria-live="polite">
          <h2>Great! That’s interesting.</h2>
          <p>
            Your punctum must be really powerful. Changing the context of an
            image often makes a punctum lose some of its pull. Since the same
            thing still draws your attention here, this must be a strong one.
          </p>
          {saving && <span role="status">Recording your answer…</span>}
          {error && (
            <p className="punctum-form-error" role="alert">
              {error}
            </p>
          )}
          <div className="punctum-world-reflection__results">
            <a
              className={`punctum-button punctum-button--yellow ${
                saving ? "is-disabled" : ""
              }`}
              href={sourceResultHref}
              aria-disabled={saving}
              onClick={(event) => {
                if (saving) event.preventDefault();
              }}
            >
              See what others observed
            </a>
          </div>
        </div>
      )}

      {answer === "no" && (
        <div className="punctum-world-reflection__new-attention">
          <p className="punctum-eyebrow">Look once more</p>
          <h2>Then, what draws your attention this time?</h2>
          <p className="punctum-world-reflection__draw-instruction">
            <span>Mark what pulls your attention in this new image.</span>
            <span
              className="punctum-world-reflection__draw-arrow"
              aria-hidden="true"
            >
              →
            </span>
          </p>
          {canEdit && polygon ? (
            <div className="punctum-world-reflection__actions">
              <button
                className="punctum-button punctum-button--yellow"
                type="button"
                disabled={saving}
                onClick={saveAndProceed}
              >
                {saving ? "Saving your punctum…" : "Save and Proceed"}
              </button>
              <button
                className="punctum-text-button"
                type="button"
                disabled={saving}
                onClick={clearMark}
              >
                Clear and redraw
              </button>
            </div>
          ) : !canEdit ? (
            <p className="punctum-world-readonly">
              This new punctum is part of the public generation record.
            </p>
          ) : null}
          {error && (
            <p className="punctum-form-error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}

      {!canEdit && !answer && (
        <p className="punctum-world-readonly">
          This public generation can be revisited here. New marks remain
          available only in the session that created it.
        </p>
      )}
      {drawingSurface}
    </section>
  );
}

export default function PunctumWorldModal({
  entry,
  onClose,
  onGenerationCompleted,
}) {
  const [phase, setPhase] = useState(
    entry?.mode === "view" ? "completed" : "selecting",
  );
  const [palette, setPalette] = useState(
    entry?.generation?.palette?.length
      ? entry.generation.palette
      : DEFAULT_PALETTE,
  );
  const [source, setSource] = useState(entry?.source || null);
  const [generation, setGeneration] = useState(
    entry?.mode === "view" ? entry.generation : null,
  );
  const [lineage, setLineage] = useState(
    entry?.mode === "view" ? [entry.generation] : [],
  );
  const [error, setError] = useState("");
  const [failureCode, setFailureCode] = useState("");
  const [retryAt, setRetryAt] = useState(0);
  const [retrySeconds, setRetrySeconds] = useState(0);
  const [finalReady, setFinalReady] = useState(false);
  const [finalImageLoaded, setFinalImageLoaded] = useState(false);
  const [progress, setProgress] = useState(
    entry?.mode === "view" ? 100 : 1,
  );
  const [selectedModelId, setSelectedModelId] = useState(
    DEFAULT_PUNCTUM_IMAGE_MODEL_ID,
  );
  const [drawTarget, setDrawTarget] = useState(null);
  const progressRef = useRef(entry?.mode === "view" ? 100 : 1);
  const runRef = useRef(0);
  const lastRequestRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (!retryAt) {
      setRetrySeconds(0);
      return undefined;
    }
    const updateCountdown = () => {
      const remaining = Math.max(
        0,
        Math.ceil((retryAt - Date.now()) / 1000),
      );
      setRetrySeconds(remaining);
      if (remaining === 0) setRetryAt(0);
    };
    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(interval);
  }, [retryAt]);

  useEffect(() => {
    if (phase !== "generating" || finalImageLoaded) return undefined;
    const interval = window.setInterval(() => {
      const current = progressRef.current;
      const next = Math.min(99, current + (99 - current) * 0.0025);
      progressRef.current = next;
      setProgress(next);
    }, 100);
    return () => window.clearInterval(interval);
  }, [finalImageLoaded, phase]);

  useEffect(() => {
    if (phase !== "generating" || !finalImageLoaded) return undefined;
    const startedAt = performance.now();
    const startingProgress = progressRef.current;
    let animationFrame = 0;
    let completionTimer = 0;

    const finishProgress = (now) => {
      const elapsed = Math.min(1, (now - startedAt) / 500);
      const eased = 1 - (1 - elapsed) ** 3;
      const next = startingProgress + (100 - startingProgress) * eased;
      progressRef.current = next;
      setProgress(next);

      if (elapsed < 1) {
        animationFrame = requestAnimationFrame(finishProgress);
        return;
      }

      progressRef.current = 100;
      setProgress(100);
      setFinalReady(true);
      completionTimer = window.setTimeout(() => {
        setPhase("completed");
      }, 1_250);
    };

    animationFrame = requestAnimationFrame(finishProgress);
    return () => {
      cancelAnimationFrame(animationFrame);
      window.clearTimeout(completionTimer);
    };
  }, [finalImageLoaded, phase]);

  const completeGeneration = (nextGeneration, accessToken, runId) => {
    if (runId !== runRef.current) return;
    const withAccess = { ...nextGeneration, accessToken };
    setGeneration(withAccess);
    setFinalReady(false);
    setFinalImageLoaded(false);
    setPalette(
      nextGeneration.palette?.length
        ? nextGeneration.palette
        : DEFAULT_PALETTE,
    );
    setLineage((current) => {
      const withoutDuplicate = current.filter(
        (item) => item.id !== withAccess.id,
      );
      return [...withoutDuplicate, withAccess];
    });
    onGenerationCompleted?.(nextGeneration);
  };

  const pollGeneration = async (generationId, accessToken, runId) => {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 3000));
      if (runId !== runRef.current) return;
      const payload = await fetchJson(
        `/api/punctum/generations?id=${encodeURIComponent(generationId)}`,
      );
      if (payload.generation.status === "completed") {
        completeGeneration(payload.generation, accessToken, runId);
        return;
      }
      if (payload.generation.status === "failed") {
        throw new Error(
          payload.generation.errorMessage || "The generation failed.",
        );
      }
      if (payload.generation.palette?.length) {
        setPalette(payload.generation.palette);
      }
    }
    throw new Error("The new world is still being prepared. Please retry.");
  };

  const generate = async (request) => {
    const generationRequest = {
      ...request,
      body: {
        ...request.body,
        generationSessionId:
          request.body.generationSessionId || getGenerationSessionId(),
      },
    };
    const runId = runRef.current + 1;
    runRef.current = runId;
    lastRequestRef.current = generationRequest;
    setSource(generationRequest.source);
    setGeneration(null);
    setFinalReady(false);
    setFinalImageLoaded(false);
    progressRef.current = 1;
    setProgress(1);
    setPalette(DEFAULT_PALETTE);
    setPhase("generating");
    setError("");
    setFailureCode("");
    setRetryAt(0);

    try {
      const response = await fetch("/api/punctum/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(generationRequest.body),
      });
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !contentType.includes("application/x-ndjson")) {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw requestErrorFromPayload(
            response,
            payload,
            "The generation could not start.",
          );
        }
        if (payload.generation?.status === "completed") {
          completeGeneration(
            payload.generation,
            generationRequest.body.accessToken,
            runId,
          );
          return;
        }
        if (payload.generation?.id) {
          await pollGeneration(
            payload.generation.id,
            generationRequest.body.accessToken,
            runId,
          );
          return;
        }
        throw new Error(payload.error || "The generation could not start.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffered = "";
      let streamGenerationId = "";
      let streamCompleted = false;
      while (runId === runRef.current) {
        const { done, value } = await reader.read();
        if (done) break;
        buffered += decoder.decode(value, { stream: true });
        const lines = buffered.split("\n");
        buffered = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.generation?.id) {
            streamGenerationId = event.generation.id;
          }
          if (event.type === "palette" && event.palette?.length) {
            setPalette(event.palette);
          } else if (event.type === "completed") {
            streamCompleted = true;
            completeGeneration(
              event.generation,
              generationRequest.body.accessToken,
              runId,
            );
          } else if (event.type === "failed") {
            throw new PunctumRequestError(
              event.error || "The generation failed.",
              { code: event.code },
            );
          }
        }
      }
      if (
        runId === runRef.current &&
        !streamCompleted &&
        streamGenerationId
      ) {
        await pollGeneration(
          streamGenerationId,
          generationRequest.body.accessToken,
          runId,
        );
      }
    } catch (requestError) {
      if (runId !== runRef.current) return;
      setError(requestError.message || "The generation failed.");
      setFailureCode(requestError.code || "");
      const retryAfter = Math.max(0, Number(requestError.retryAfter) || 0);
      setRetryAt(retryAfter ? Date.now() + retryAfter * 1000 : 0);
      setPhase("failed");
    }
  };

  useEffect(() => {
    if (!entry) return;
    if (entry.mode === "generate" || entry.mode === "create") {
      lastRequestRef.current = entry.request;
      setSource(entry.source);
      setGeneration(null);
      setFinalReady(false);
      setFinalImageLoaded(false);
      progressRef.current = 1;
      setProgress(1);
      setPhase("selecting");
      return;
    }
    setSource(entry.source);
    setGeneration(entry.generation);
    setFinalReady(false);
    setFinalImageLoaded(false);
    progressRef.current = 100;
    setProgress(100);
    setPalette(
      entry.generation.palette?.length
        ? entry.generation.palette
        : DEFAULT_PALETTE,
    );
    setPhase("completed");
    fetchJson(
      `/api/punctum/generations?id=${encodeURIComponent(entry.generation.id)}`,
    )
      .then((payload) => {
        setLineage(payload.lineage || [entry.generation]);
        setGeneration(payload.generation);
      })
      .catch(() => {
        setLineage([entry.generation]);
      });
  }, [entry]);

  if (!entry || !source) return null;

  const goBack = () => {
    runRef.current += 1;
    const pendingParentId = lastRequestRef.current?.body?.parentGenerationId;
    if (!generation && pendingParentId) {
      const previous = lineage.find((item) => item.id === pendingParentId);
      if (previous) {
        setGeneration(previous);
        setSource({
          imageUrl: previous.sourceImageUrl,
          polygon: previous.sourcePolygonNormalized,
          explanation: previous.viewerExplanation,
          width: previous.sourceWidth,
          height: previous.sourceHeight,
        });
        setPalette(previous.palette?.length ? previous.palette : DEFAULT_PALETTE);
        setFinalReady(false);
        setFinalImageLoaded(false);
        progressRef.current = 100;
        setProgress(100);
        setPhase("completed");
        return;
      }
    }
    if (generation?.parentGenerationId && lineage.length > 1) {
      const currentIndex = lineage.findIndex(
        (item) => item.id === generation.id,
      );
      const previous = lineage[Math.max(0, currentIndex - 1)];
      if (previous) {
        setGeneration(previous);
        setFinalReady(false);
        setFinalImageLoaded(false);
        progressRef.current = 100;
        setProgress(100);
        setSource({
          imageUrl: previous.sourceImageUrl,
          polygon: previous.sourcePolygonNormalized,
          explanation: previous.viewerExplanation,
          width: previous.sourceWidth,
          height: previous.sourceHeight,
        });
        setPalette(previous.palette?.length ? previous.palette : DEFAULT_PALETTE);
        setPhase("completed");
        return;
      }
    }
    onClose();
  };

  const retry = () => {
    if (retrySeconds > 0) return;
    const previous = lastRequestRef.current;
    if (!previous) return;
    generate({
      ...previous,
      body: {
        ...previous.body,
        requestId: createId(),
        accessToken: createId(),
      },
    });
  };

  const startGeneration = () => {
    const pending = lastRequestRef.current;
    if (!pending) return;
    generate({
      ...pending,
      body: {
        ...pending.body,
        modelId: selectedModelId,
      },
    });
  };

  const generateAnother = ({ parent, polygon, explanation }) => {
    const requestId = createId();
    const accessToken = createId();
    const request = {
      source: {
        imageUrl: parent.generatedImageUrl,
        polygon,
        explanation:
          explanation || "A new punctum was selected in the generated world.",
        width: parent.sourceWidth,
        height: parent.sourceHeight,
      },
      body: {
        requestId,
        accessToken,
        parentGenerationId: parent.id,
        parentAccessToken: parent.accessToken,
      },
    };
    const previousModel = getPunctumImageModelOption(parent.model);
    if (previousModel) setSelectedModelId(previousModel.id);
    lastRequestRef.current = request;
    setSource(request.source);
    setGeneration(null);
    setFinalReady(false);
    setFinalImageLoaded(false);
    progressRef.current = 1;
    setProgress(1);
    setPalette(DEFAULT_PALETTE);
    setError("");
    setFailureCode("");
    setRetryAt(0);
    setPhase("selecting");
  };

  const updateGeneration = (updated) => {
    const accessToken = generation?.accessToken;
    const withAccess = { ...updated, accessToken };
    setGeneration(withAccess);
    setLineage((current) =>
      current.map((item) => (item.id === updated.id ? withAccess : item)),
    );
    onGenerationCompleted?.(updated);
  };
  const selectedModel =
    getPunctumImageModelOption(selectedModelId) ||
    PUNCTUM_IMAGE_MODEL_OPTIONS[0];
  const limitReached = isGenerationLimitFailure(failureCode, error);
  const completedModel =
    getPunctumImageModelOption(generation?.model) || selectedModel;

  return (
    <div className="punctum-world-modal" role="dialog" aria-modal="true" aria-label="AI world from punctum">
      <header className="punctum-world-modal__header">
        <button
          ref={closeButtonRef}
          className="punctum-world-modal__back"
          type="button"
          onClick={goBack}
        >
          {generation?.parentGenerationId || lastRequestRef.current?.body?.parentGenerationId
            ? "← Back to previous image"
            : "← Back to your punctums"}
        </button>
        <div>
          <span>AI world</span>
          <strong>
            {generation
              ? `Generation ${Math.max(
                  1,
                  lineage.findIndex((item) => item.id === generation.id) + 1,
                )}`
              : phase === "selecting"
                ? "Choose an image model"
                : "Recontextualising your punctum"}
          </strong>
        </div>
        <button
          className="punctum-world-modal__close"
          type="button"
          aria-label="Close AI world"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <main className={`punctum-world-modal__body is-${phase}`}>
        <section
          className={`punctum-world-comparison ${
            phase === "completed" ? "is-reflecting" : ""
          }`}
        >
          <div className="punctum-world-left-column">
            <SourceFigure source={source} />
            {phase === "completed" && generation && (
              <DrawNewPunctum
                key={generation.id}
                generation={generation}
                accessToken={generation.accessToken}
                drawTarget={drawTarget}
                onGenerateAnother={generateAnother}
                onGenerationUpdated={updateGeneration}
              />
            )}
          </div>
          {phase === "selecting" ? (
            <div
              className="punctum-world-picker-slot"
              style={{ aspectRatio: `${source.width} / ${source.height}` }}
            >
              <ModelPicker
                selectedModelId={selectedModelId}
                onChange={setSelectedModelId}
                onGenerate={startGeneration}
              />
            </div>
          ) : (
            <figure className={`punctum-world-result is-${phase}`}>
              <div
                className={`punctum-world-result__image ${
                  finalReady ? "is-revealing" : ""
                }`}
                style={{ aspectRatio: `${source.width} / ${source.height}` }}
              >
                <PunctumBuildCanvas
                  palette={palette}
                  width={source.width}
                  height={source.height}
                  imageUrl={source.imageUrl}
                  polygon={source.polygon}
                  active={phase === "generating"}
                />
                {generation?.generatedImageUrl && (
                  <img
                    className={`punctum-world-result__final ${
                      finalReady ? "is-ready" : ""
                    }`}
                    src={generation.generatedImageUrl}
                    alt="AI-generated world built from the selected punctum"
                    onLoad={() => {
                      if (phase === "generating") {
                        setFinalImageLoaded(true);
                      } else {
                        setFinalReady(true);
                      }
                    }}
                  />
                )}
                {phase === "completed" && generation && (
                  <div
                    className="punctum-world-draw-target"
                    ref={setDrawTarget}
                  />
                )}
                {phase === "generating" && (
                  <div className="punctum-world-result__status" role="status">
                    <div className="punctum-world-result__status-stack">
                      <div className="punctum-world-result__status-card">
                        <strong>
                          <span>Building a new world</span>
                          <span>with your punctum.</span>
                        </strong>
                        <GenerationTerminal />
                      </div>
                      <div
                        className="punctum-world-result__progress"
                        role="progressbar"
                        aria-label="AI world generation progress"
                        aria-valuemin="1"
                        aria-valuemax="100"
                        aria-valuenow={Math.max(1, Math.round(progress))}
                      >
                        <div className="punctum-world-result__progress-track">
                          <i
                            style={{
                              width: `${Math.max(1, Math.min(100, progress))}%`,
                            }}
                          />
                        </div>
                        <output>{Math.max(1, Math.round(progress))}%</output>
                      </div>
                    </div>
                  </div>
                )}
                {phase === "failed" && (
                  <div className="punctum-world-result__failure" role="alert">
                    <div className="punctum-world-result__failure-card">
                      <span>
                        {limitReached
                          ? "Thank you for exploring"
                          : failureCode === "generation_in_progress"
                            ? "One world at a time"
                            : "A small pause"}
                      </span>
                      <strong>
                        {limitReached
                          ? "The world-builder is taking a short rest."
                          : failureCode === "generation_in_progress"
                            ? "Your new world is already on its way."
                            : "This world could not be made just now."}
                      </strong>
                      <p>
                        {limitReached
                          ? "I keep a gentle limit on AI generations so this public experiment can stay open to everyone. Please come back a little later—or explore the worlds already made from other people’s punctums."
                          : failureCode === "generation_in_progress"
                            ? "Let the current generation finish before beginning another. You can explore the public collection while you wait."
                            : "Nothing you selected has been lost. You can try once more, or step into the collection of worlds that are already here."}
                      </p>
                      {retrySeconds > 0 && (
                        <p
                          className="punctum-world-result__failure-timing"
                          aria-live="off"
                        >
                          New generations may be available in{" "}
                          <time aria-live="off">
                            {formatRetryTime(retrySeconds)}
                          </time>
                          .
                        </p>
                      )}
                      <div className="punctum-world-result__failure-actions">
                        <a
                          className="punctum-button punctum-world-result__failure-cta"
                          href="/research/punctum/results"
                        >
                          Explore existing worlds
                          <span className="link-destination-arrow" aria-hidden="true">↗</span>
                        </a>
                        {!limitReached && (
                          <button
                            className="punctum-button punctum-world-result__failure-retry"
                            type="button"
                            onClick={retry}
                            disabled={retrySeconds > 0}
                          >
                            {retrySeconds > 0
                              ? `Try again in ${formatRetryTime(retrySeconds)}`
                              : "Try again"}
                          </button>
                        )}
                        <button
                          className="punctum-text-button"
                          type="button"
                          onClick={goBack}
                        >
                          Back to this image
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <figcaption>
                <span>Generated world · {completedModel.label}</span>
                <div className="punctum-world-palette" aria-label="Punctum colour palette">
                  {palette.map((colour, index) => (
                    <i
                      key={`${colour}-${index}`}
                      style={{ backgroundColor: colour }}
                      title={colour}
                    />
                  ))}
                </div>
              </figcaption>
            </figure>
          )}
        </section>
      </main>
    </div>
  );
}
