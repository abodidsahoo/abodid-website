import { useEffect, useMemo, useRef, useState } from "react";
import {
  derivePunctumPolygon,
  getObjectFitCoverGeometry,
  normalizePointerPoint,
  verticesToSmoothSvgPath,
} from "../../lib/punctum/geometry";
import {
  getPunctumGestureStatus,
  PUNCTUM_LEFT_FLICK_EVENT,
  usePunctumGestureControl,
} from "../../hooks/usePunctumGestureControl";
import PunctumFeedbackModal from "./PunctumFeedbackModal";

const AGE_BANDS = [
  ["", "Choose an age band"],
  ["18-24", "18–24"],
  ["25-34", "25–34"],
  ["35-44", "35–44"],
  ["45-54", "45–54"],
  ["55-64", "55–64"],
  ["65+", "65+"],
  ["prefer_not", "Prefer not to say"],
];

const GENDERS = [
  ["", "Choose an option"],
  ["woman", "Woman"],
  ["man", "Man"],
  ["non_binary", "Non-binary"],
  ["self_described", "I describe myself another way"],
  ["prefer_not", "Prefer not to say"],
];

const COUNTRIES = [
  ["", "Choose a country"],
  ["IN", "India"],
  ["GB", "United Kingdom"],
  ["US", "United States"],
  ["CA", "Canada"],
  ["AU", "Australia"],
  ["NZ", "New Zealand"],
  ["BD", "Bangladesh"],
  ["PK", "Pakistan"],
  ["NP", "Nepal"],
  ["LK", "Sri Lanka"],
  ["SG", "Singapore"],
  ["MY", "Malaysia"],
  ["ID", "Indonesia"],
  ["PH", "Philippines"],
  ["TH", "Thailand"],
  ["VN", "Vietnam"],
  ["CN", "China"],
  ["JP", "Japan"],
  ["KR", "South Korea"],
  ["AE", "United Arab Emirates"],
  ["TR", "Türkiye"],
  ["ZA", "South Africa"],
  ["NG", "Nigeria"],
  ["KE", "Kenya"],
  ["GH", "Ghana"],
  ["FR", "France"],
  ["DE", "Germany"],
  ["IT", "Italy"],
  ["ES", "Spain"],
  ["PT", "Portugal"],
  ["NL", "Netherlands"],
  ["BE", "Belgium"],
  ["IE", "Ireland"],
  ["CH", "Switzerland"],
  ["AT", "Austria"],
  ["SE", "Sweden"],
  ["NO", "Norway"],
  ["DK", "Denmark"],
  ["FI", "Finland"],
  ["PL", "Poland"],
  ["GR", "Greece"],
  ["BR", "Brazil"],
  ["MX", "Mexico"],
  ["AR", "Argentina"],
  ["CL", "Chile"],
  ["CO", "Colombia"],
  ["ZZ", "Another country"],
  ["PREFER_NOT", "Prefer not to say"],
];

const fetchJson = async (url, options) => {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Something went wrong. Please try again.");
  }
  return payload;
};

const ONBOARDING_STEPS = 4;

function OnboardingFrame({ step, children, className = "" }) {
  return (
    <main className="punctum-onboarding">
      {step ? (
        <div
          className="punctum-onboarding__progress"
          aria-label={`Step ${step} of ${ONBOARDING_STEPS}`}
        >
          {Array.from({ length: ONBOARDING_STEPS }, (_, index) => index + 1).map((value) => (
            <span className={value <= step ? "is-active" : ""} key={value} />
          ))}
        </div>
      ) : (
        <div aria-hidden="true" />
      )}
      <div className={`punctum-onboarding__card ${className}`.trim()}>
        {children}
      </div>
    </main>
  );
}

function StoryActions({ onContinue, continueLabel = "Continue" }) {
  return (
    <div className="punctum-story__actions">
      <button
        className="punctum-button punctum-button--yellow"
        type="button"
        onClick={onContinue}
      >
        {continueLabel}
      </button>
    </div>
  );
}

function DifferenceStep({ onContinue }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onContinue();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onContinue]);

  return (
    <OnboardingFrame className="punctum-onboarding__card--centered punctum-onboarding__card--story">
      <section className="punctum-story">
        <h1>
          One image.<br />
          Many encounters.
        </h1>
        <p>What touches you may remain invisible to someone else.</p>
        <StoryActions onContinue={onContinue} />
      </section>
    </OnboardingFrame>
  );
}

function PlaySelect({ id, label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = options.find(([optionValue]) => optionValue === value);
  const displayValue = value ? selected?.[1] : "Choose";

  useEffect(() => {
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  return (
    <div
      className={`punctum-play-select ${open ? "is-open" : ""}`}
      ref={rootRef}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <button
        className="punctum-play-select__trigger"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{label}</span>
        <strong className={value ? "" : "is-placeholder"}>{displayValue}</strong>
        <i aria-hidden="true"></i>
      </button>
      {open && (
        <div
          className="punctum-play-select__menu"
          id={`${id}-options`}
          role="listbox"
          aria-label={label}
        >
          {options.slice(1).map(([optionValue, optionLabel]) => (
            <button
              className={optionValue === value ? "is-selected" : ""}
              type="button"
              role="option"
              aria-selected={optionValue === value}
              key={optionValue}
              onClick={() => {
                onChange(optionValue);
                setOpen(false);
              }}
            >
              <span>{optionLabel}</span>
              {optionValue === value && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileStep({ form, setForm, onBack, onContinue }) {
  const setValue = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onContinue();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onContinue]);

  return (
    <OnboardingFrame step={1}>
      <div className="punctum-profile">
        <div className="punctum-screen-heading">
          <h1>About you</h1>
          <p>Skip any.</p>
        </div>
        <div className="punctum-profile__fields">
          <PlaySelect
            id="punctum-age"
            label="Age"
            value={form.ageBand}
            options={AGE_BANDS}
            onChange={(value) => setValue("ageBand", value)}
          />
          <PlaySelect
            id="punctum-gender"
            label="Gender"
            value={form.gender}
            options={GENDERS}
            onChange={(value) => setValue("gender", value)}
          />
          <PlaySelect
            id="punctum-country"
            label="Country"
            value={form.countryCode}
            options={COUNTRIES}
            onChange={(value) => setValue("countryCode", value)}
          />
        </div>
        <div className="punctum-onboarding__actions">
          <button className="punctum-text-button" type="button" onClick={onBack}>
            Back
          </button>
          <button
            className="punctum-button punctum-button--yellow"
            type="button"
            onClick={onContinue}
          >
            Continue
          </button>
        </div>
      </div>
    </OnboardingFrame>
  );
}

function ConsentStep({ form, setForm, onBack, onContinue }) {
  const setValue = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Enter" && form.ageConfirmed && form.consentAccepted) {
        event.preventDefault();
        onContinue();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [form.ageConfirmed, form.consentAccepted, onContinue]);

  return (
    <OnboardingFrame step={2} className="punctum-onboarding__card--compact">
      <form
        className="punctum-consent"
        onSubmit={(event) => {
          event.preventDefault();
          onContinue();
        }}
      >
        <div className="punctum-screen-heading">
          <h1>Two quick checks.</h1>
        </div>
        <div className="punctum-consent__checks">
          <label>
            <input
              type="checkbox"
              checked={form.ageConfirmed}
              onChange={(event) =>
                setValue("ageConfirmed", event.target.checked)
              }
            />
            <span className="punctum-consent__checkmark" aria-hidden="true">✓</span>
            <strong>I’m 18 or older.</strong>
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.consentAccepted}
              onChange={(event) =>
                setValue("consentAccepted", event.target.checked)
              }
            />
            <span className="punctum-consent__checkmark" aria-hidden="true">✓</span>
            <strong>I allow you to use my results for research purposes.</strong>
          </label>
        </div>
        <div className="punctum-onboarding__actions">
          <button className="punctum-text-button" type="button" onClick={onBack}>
            Back
          </button>
          <div className="punctum-onboarding__action-group">
            <a href="/research/punctum/about">Privacy</a>
            <button
              className="punctum-button punctum-button--yellow"
              type="submit"
              disabled={!form.ageConfirmed || !form.consentAccepted}
            >
              Continue
            </button>
          </div>
        </div>
      </form>
    </OnboardingFrame>
  );
}

function TurnstileVerification({
  siteKey,
  isLocalPreview,
  onVerified,
}) {
  const widgetRef = useRef(null);
  const renderedRef = useRef(false);

  useEffect(() => {
    if (isLocalPreview) {
      onVerified("local-preview");
      return undefined;
    }
    if (!siteKey) return undefined;
    const render = () => {
      if (!widgetRef.current || renderedRef.current || !window.turnstile) return;
      renderedRef.current = true;
      window.turnstile.render(widgetRef.current, {
        sitekey: siteKey,
        theme: "auto",
        callback: onVerified,
        "expired-callback": () => onVerified(""),
        "error-callback": () => onVerified(""),
      });
    };
    const existing = document.querySelector(
      'script[src^="https://challenges.cloudflare.com/turnstile"]',
    );
    if (existing) {
      existing.addEventListener("load", render);
      render();
      return () => existing.removeEventListener("load", render);
    }
    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", render);
    document.head.appendChild(script);
    return () => script.removeEventListener("load", render);
  }, [isLocalPreview, onVerified, siteKey]);

  return (
    <div className="punctum-verification-box">
      {!isLocalPreview && siteKey ? (
        <div ref={widgetRef} />
      ) : !isLocalPreview && !siteKey ? (
        <p>Human verification is not configured. Please try again later.</p>
      ) : null}
    </div>
  );
}

function VerificationStep({
  siteKey,
  isLocalPreview,
  token,
  setToken,
  loading,
  error,
  onBegin,
}) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Enter" && token && !loading) {
        event.preventDefault();
        onBegin();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [token, loading, onBegin]);

  return (
    <OnboardingFrame step={3} className="punctum-onboarding__card--compact">
      <div className="punctum-verification">
        <h1>Are You Human?</h1>
        <TurnstileVerification
          siteKey={siteKey}
          isLocalPreview={isLocalPreview}
          onVerified={setToken}
        />
        {error && (
          <p className="punctum-form-error" role="alert">
            {error}
          </p>
        )}
        <div className="punctum-onboarding__actions">
          <button
            className="punctum-button punctum-button--yellow"
            type="button"
            disabled={!token || loading}
            onClick={onBegin}
          >
            {loading ? "Starting…" : "Yes, of course I am!"}
          </button>
        </div>
      </div>
    </OnboardingFrame>
  );
}

function PracticeStep({
  onContinue,
  gestureEnabled,
  gestureState,
  gestureStatus,
  onEnableGesture,
}) {
  const areaRef = useRef(null);
  const pointsRef = useRef([]);
  const drawingRef = useRef(false);
  const [points, setPoints] = useState([]);

  const toPoint = (event) => {
    const rect = areaRef.current.getBoundingClientRect();
    return {
      x: Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100)),
    };
  };
  const start = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // The mark still works if capture is unavailable for this pointer.
    }
    const next = [toPoint(event)];
    pointsRef.current = next;
    drawingRef.current = true;
    setPoints(next);
  };
  const move = (event) => {
    if (!drawingRef.current) return;
    const next = [...pointsRef.current, toPoint(event)];
    pointsRef.current = next;
    setPoints(next);
  };
  const finish = () => {
    drawingRef.current = false;
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onContinue();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onContinue]);

  useEffect(() => {
    const handleLeftFlick = () => onContinue();
    window.addEventListener(PUNCTUM_LEFT_FLICK_EVENT, handleLeftFlick);
    return () =>
      window.removeEventListener(PUNCTUM_LEFT_FLICK_EVENT, handleLeftFlick);
  }, [onContinue]);

  return (
    <OnboardingFrame step={4} className="punctum-onboarding__card--compact">
      <div className="punctum-practice">
        <div className="punctum-screen-heading">
          <h1>
            Test your Pencil.
            {points.length >= 3 && (
              <span className="punctum-practice__check-badge" aria-label="Pencil verified">
                <svg
                  viewBox="0 0 48 48"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="punctum-practice__check-icon"
                  shapeRendering="geometricPrecision"
                >
                  <circle
                    cx="24"
                    cy="24"
                    r="21"
                    stroke="#22c55e"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    className="punctum-check-circle"
                  />
                  <path
                    d="M14 24.5L21 31.5L34 16.5"
                    stroke="#22c55e"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="punctum-check-mark"
                  />
                </svg>
              </span>
            )}
          </h1>
        </div>
        <div
          ref={areaRef}
          className="punctum-practice__area"
          data-punctum-gesture-draw-zone
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={finish}
          onPointerCancel={finish}
          onLostPointerCapture={finish}
        >
          <span className="punctum-practice__shape punctum-practice__shape--one" />
          <span className="punctum-practice__shape punctum-practice__shape--two" />
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} />
          </svg>
          {!points.length && <strong>Draw here</strong>}
        </div>
        <div className="punctum-onboarding__actions">
          <button
            className="punctum-text-button"
            type="button"
            onClick={() => {
              drawingRef.current = false;
              pointsRef.current = [];
              setPoints([]);
            }}
          >
            Clear
          </button>
          <button
            className="punctum-button punctum-button--yellow"
            type="button"
            onClick={onContinue}
          >
            {points.length ? "Continue" : "Skip"}
          </button>
        </div>
      </div>
    </OnboardingFrame>
  );
}

function PunctumDrawingStage({
  image,
  index,
  total,
  initialPolygon = null,
  onConfirm,
  onSaveAnnotation,
  onNextImage,
  onSkip,
}) {
  const viewportRef = useRef(null);
  const strokeRef = useRef([]);
  const startTimeRef = useRef(0);
  const drawingRef = useRef(false);
  const savingRef = useRef(false);
  const [geometry, setGeometry] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const [stroke, setStroke] = useState([]);
  const [polygon, setPolygon] = useState(initialPolygon);
  const [saving, setSaving] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [notePhase, setNotePhase] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [recordedResponseId, setRecordedResponseId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return undefined;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setGeometry(
        getObjectFitCoverGeometry(
          rect.width,
          rect.height,
          image.width,
          image.height,
        ),
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [image.height, image.width]);

  useEffect(() => {
    strokeRef.current = [];
    drawingRef.current = false;
    savingRef.current = false;
    setStroke([]);
    setPolygon(initialPolygon);
    setSaving(false);
    setCommitted(false);
    setNotePhase(false);
    setNoteText("");
    setNoteSaving(false);
    setRecordedResponseId(null);
    setError("");
  }, [image.id, initialPolygon]);

  const eventPoint = (event) => {
    const rect = viewportRef.current.getBoundingClientRect();
    return normalizePointerPoint(
      event.clientX,
      event.clientY,
      rect,
      geometry,
    );
  };

  const onPointerDown = (event) => {
    if (committed || notePhase || savingRef.current) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const point = eventPoint(event);
    if (!point) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Continue with the active pointer even when capture is unavailable.
    }
    startTimeRef.current = performance.now();
    const first = [{ ...point, t: 0 }];
    strokeRef.current = first;
    drawingRef.current = true;
    setStroke(first);
    setPolygon(null);
    setError("");
  };

  const onPointerMove = (event) => {
    if (!drawingRef.current || savingRef.current) return;
    const coalescedEvents = event.nativeEvent?.getCoalescedEvents?.();
    const samples = coalescedEvents?.length
      ? coalescedEvents
      : [event.nativeEvent || event];
    const next = [...strokeRef.current];
    for (const sample of samples) {
      const point = eventPoint(sample);
      if (!point) continue;
      const previous = next[next.length - 1];
      if (
        previous &&
        Math.hypot(point.x - previous.x, point.y - previous.y) < 0.0015
      ) {
        continue;
      }
      next.push({
        ...point,
        t: performance.now() - startTimeRef.current,
      });
    }
    if (next.length === strokeRef.current.length) return;
    strokeRef.current = next;
    setStroke(next);
  };

  const finishDrawing = (event) => {
    if (!drawingRef.current) return;
    event?.preventDefault?.();
    const finalPoint = event ? eventPoint(event.nativeEvent || event) : null;
    const previous = strokeRef.current[strokeRef.current.length - 1];
    if (
      finalPoint &&
      (!previous ||
        Math.hypot(finalPoint.x - previous.x, finalPoint.y - previous.y) >=
          0.0015)
    ) {
      strokeRef.current = [
        ...strokeRef.current,
        {
          ...finalPoint,
          t: performance.now() - startTimeRef.current,
        },
      ];
      setStroke(strokeRef.current);
    }
    drawingRef.current = false;
    const derived = derivePunctumPolygon(strokeRef.current);
    if (derived) setPolygon(derived);
  };

  const transitionCooldownRef = useRef(Date.now() + 350);

  useEffect(() => {
    transitionCooldownRef.current = Date.now() + 350;
  }, [notePhase]);

  const confirm = async () => {
    if (!polygon || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const responseId = await onConfirm(polygon);
      setRecordedResponseId(responseId);
      setCommitted(true);
      setSaving(false);
      transitionCooldownRef.current = Date.now() + 400;
      setNotePhase(true);
    } catch (saveError) {
      setError(saveError.message);
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleCompleteNoteAndAdvance = async () => {
    if (noteSaving) return;
    const trimmed = noteText.trim();
    if (trimmed && recordedResponseId) {
      setNoteSaving(true);
      try {
        await onSaveAnnotation(recordedResponseId, trimmed, polygon);
      } catch (err) {
        setError(err.message || "Failed to save note");
        setNoteSaving(false);
        return;
      }
    }
    onNextImage();
  };

  const handleTextareaKeyDown = (event) => {
    if (event.key === "Enter") {
      if (!event.shiftKey) {
        event.preventDefault();
        if (Date.now() < transitionCooldownRef.current) return;
        transitionCooldownRef.current = Date.now() + 400;
        void handleCompleteNoteAndAdvance();
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
      if (event.key === "Enter") {
        if (savingRef.current || noteSaving || Date.now() < transitionCooldownRef.current) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        transitionCooldownRef.current = Date.now() + 400;
        if (!notePhase && polygon && !committed) {
          void confirm();
          return;
        }
        if (notePhase) {
          void handleCompleteNoteAndAdvance();
          return;
        }
        if (!polygon && !notePhase) {
          onSkip();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [committed, notePhase, polygon, noteText, recordedResponseId, onSkip, noteSaving]);

  useEffect(() => {
    const handleLeftFlick = () => {
      if (savingRef.current) return;
      if (!notePhase && polygon && !committed) {
        void confirm();
        return;
      }
      if (notePhase) {
        void handleCompleteNoteAndAdvance();
        return;
      }
      onSkip();
    };

    window.addEventListener(PUNCTUM_LEFT_FLICK_EVENT, handleLeftFlick);
    return () =>
      window.removeEventListener(PUNCTUM_LEFT_FLICK_EVENT, handleLeftFlick);
  }, [committed, notePhase, polygon, noteText, recordedResponseId]);

  const imageLayerStyle = {
    left: geometry.x,
    top: geometry.y,
    width: geometry.width,
    height: geometry.height,
  };
  const strokeSvgPoints = stroke
    .map((point) => `${point.x * 100},${point.y * 100}`)
    .join(" ");

  return (
    <main
      className="punctum-draw"
      style={{
        "--drawing-background": image.softBackground,
        "--drawing-ratio": `${image.width} / ${image.height}`,
      }}
    >
      <section className="punctum-draw__image-panel">
        <div className="punctum-draw__topline">
          <span>
            Photograph {index + 1} of {total}
          </span>
          <div className="punctum-draw__progress" aria-hidden="true">
            {Array.from({ length: total }, (_, itemIndex) => (
              <i className={itemIndex <= index ? "is-active" : ""} key={itemIndex} />
            ))}
          </div>
        </div>
        <div ref={viewportRef} className="punctum-draw__viewport">
          <img
            src={image.url}
            alt={image.title}
            width={image.width}
            height={image.height}
            draggable="false"
          />
          <div
            className="punctum-draw__pointer-layer"
            data-punctum-gesture-draw-zone
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={finishDrawing}
            onPointerCancel={finishDrawing}
            onLostPointerCapture={finishDrawing}
            aria-label="Draw over the part of the photograph that stays with you"
            role="application"
          />
          <svg
            className="punctum-draw__mark-layer"
            style={imageLayerStyle}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {stroke.length > 0 && !polygon && (
              <g className="punctum-draw__stroke-texture">
                <polyline
                  className="punctum-draw__stroke-base"
                  points={strokeSvgPoints}
                />
                <polyline
                  className="punctum-draw__stroke-stripe punctum-draw__stroke-stripe--blue"
                  points={strokeSvgPoints}
                  transform="translate(0 -0.55)"
                />
                <polyline
                  className="punctum-draw__stroke-stripe punctum-draw__stroke-stripe--red"
                  points={strokeSvgPoints}
                  transform="translate(0 -0.18)"
                />
                <polyline
                  className="punctum-draw__stroke-stripe punctum-draw__stroke-stripe--yellow"
                  points={strokeSvgPoints}
                  transform="translate(0 0.18)"
                />
                <polyline
                  className="punctum-draw__stroke-stripe punctum-draw__stroke-stripe--green"
                  points={strokeSvgPoints}
                  transform="translate(0 0.55)"
                />
              </g>
            )}
            {polygon && (
              <g className="punctum-organic-selection">
                <path
                  className="punctum-selection-halo punctum-selection-halo--outer"
                  d={verticesToSmoothSvgPath(polygon.vertices)}
                />
                <path
                  className="punctum-selection-halo punctum-selection-halo--inner"
                  d={verticesToSmoothSvgPath(polygon.vertices)}
                />
                <path
                  className={`punctum-selection-edge ${
                    saving || committed ? "is-shimmering" : "is-provisional"
                  }`}
                  d={verticesToSmoothSvgPath(polygon.vertices)}
                />
                {(saving || committed) && (
                  <path
                    className="punctum-selection-wave"
                    d={verticesToSmoothSvgPath(polygon.vertices)}
                  />
                )}
              </g>
            )}
          </svg>
          {!stroke.length && !polygon && (
            <div className="punctum-draw__cue" aria-hidden="true">
              <span></span>
              Draw on the photo
            </div>
          )}
        </div>
      </section>

      <aside className="punctum-draw__controls">
        {!notePhase ? (
          <div>
            <p className="punctum-eyebrow">
              {polygon ? "Your punctum" : "Punctum"}
            </p>
            <h1>
              {polygon
                ? "Is this the area that pulled you in?"
                : "Draw over that one thing in this image that draws your attention the most."}
            </h1>
            {!polygon && <p>A dot, line, circle, or scribble.</p>}
            {polygon && (
              <button
                className="punctum-button punctum-button--yellow punctum-draw__confirm"
                type="button"
                onClick={confirm}
                disabled={saving || committed}
              >
                {saving ? "Recording…" : "Yes!"}
              </button>
            )}
            {error && (
              <p className="punctum-form-error" role="alert">
                {error}
              </p>
            )}
          </div>
        ) : (
          <div>
            <p className="punctum-eyebrow">Optional note</p>
            <h1>What about this area caught you?</h1>
            <p>Describe what you noticed, remembered, felt, or imagined.</p>
            <label className="punctum-draw__note-box">
              <span className="visually-hidden">Your optional explanation</span>
              <textarea
                value={noteText}
                maxLength={180}
                rows={3}
                placeholder="A few words, if you want."
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={handleTextareaKeyDown}
                autoFocus
              />
              <div className="punctum-draw__note-meta">
                <span className="punctum-draw__hint">
                  Shift + Enter for new line
                </span>
                <small>{noteText.length} / 180</small>
              </div>
            </label>
            {error && (
              <p className="punctum-form-error" role="alert">
                {error}
              </p>
            )}
          </div>
        )}

        <div className="punctum-draw__actions">
          {!notePhase ? (
            <button
              className="punctum-button punctum-button--light punctum-button--small punctum-draw__skip"
              type="button"
              onClick={onSkip}
              disabled={saving}
            >
              {index === total - 1 ? "Skip & View Results →" : "Skip photo"}
            </button>
          ) : (
            <button
              className="punctum-button punctum-button--yellow"
              type="button"
              onClick={handleCompleteNoteAndAdvance}
              disabled={noteSaving}
            >
              {noteSaving
                ? "Saving…"
                : index === total - 1
                  ? noteText.trim()
                    ? "Save & View Results →"
                    : "View Results →"
                  : noteText.trim()
                    ? "Save & Next photo →"
                    : "Next photo →"}
            </button>
          )}
        </div>
      </aside>
    </main>
  );
}

function AnnotationStep({
  image,
  polygon,
  initialText,
  saving,
  error,
  onEdit,
  onSave,
  onSkip,
}) {
  const [text, setText] = useState(initialText);

  useEffect(() => {
    const handleLeftFlick = () => {
      if (!saving) onSkip();
    };

    window.addEventListener(PUNCTUM_LEFT_FLICK_EVENT, handleLeftFlick);
    return () =>
      window.removeEventListener(PUNCTUM_LEFT_FLICK_EVENT, handleLeftFlick);
  }, [onSkip, saving]);

  return (
    <main className="punctum-annotation">
      <section
        className="punctum-annotation__image"
        style={{
          "--annotation-background": image.softBackground,
          aspectRatio: `${image.width} / ${image.height}`,
        }}
      >
        <img src={image.url} alt={image.title} />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <g className="punctum-organic-selection punctum-annotation__selection-group">
            <path
              className="punctum-selection-halo punctum-selection-halo--outer"
              d={verticesToSmoothSvgPath(polygon.vertices)}
            />
            <path
              className="punctum-selection-halo punctum-selection-halo--inner"
              d={verticesToSmoothSvgPath(polygon.vertices)}
            />
            <path
              className="punctum-annotation__selection"
              d={verticesToSmoothSvgPath(polygon.vertices)}
            />
          </g>
        </svg>
        <button
          className="punctum-annotation__edit"
          type="button"
          aria-label="Edit your punctum"
          onClick={() => onEdit(text)}
        >
          <img
            className="punctum-annotation__edit-icon"
            src="/images/research/punctum/pencil.png"
            alt=""
            aria-hidden="true"
          />
          <span>Edit your punctum</span>
        </button>
      </section>
      <section className="punctum-annotation__prompt">
        <p className="punctum-eyebrow">Optional</p>
        <h1>What about this area caught you?</h1>
        <p>You may describe what you noticed, remembered, felt, or imagined.</p>
        <label>
          <span className="visually-hidden">Your optional explanation</span>
          <textarea
            value={text}
            maxLength={180}
            rows={4}
            placeholder="A few words, if you want."
            onChange={(event) => setText(event.target.value)}
            autoFocus
          />
          <small>{text.length} / 180</small>
        </label>
        {error && (
          <p className="punctum-form-error" role="alert">
            {error}
          </p>
        )}
        <div className="punctum-annotation__actions">
          <button
            className="punctum-button punctum-button--yellow"
            type="button"
            disabled={!text.trim() || saving}
            onClick={() => onSave(text)}
          >
            {saving ? "Saving…" : "Save & next"}
          </button>
          <button
            className="punctum-text-button"
            type="button"
            disabled={saving}
            onClick={onSkip}
          >
            Skip
          </button>
        </div>
      </section>
    </main>
  );
}

function CompletionStep({ sessionId }) {
  return (
    <main className="punctum-complete">
      <div className="punctum-complete__constellation" aria-hidden="true">
        {Array.from({ length: 11 }, (_, index) => (
          <span style={{ "--star": index }} key={index} />
        ))}
      </div>
      <div className="punctum-complete__layout">
        <div className="punctum-complete__left">
          <p className="punctum-eyebrow">Your responses have been recorded.</p>
          <h1>
            <span className="punctum-complete__line">Let's place your 'punctums'</span>
            <br />
            <span className="punctum-complete__line">in a new world!</span>
          </h1>
          <p>And see if you still feel the same about the 'punctum' after that.</p>
          <div className="punctum-complete__actions">
            <a
              className="punctum-button punctum-button--yellow"
              href={
                sessionId
                  ? `/research/punctum/results?session=${encodeURIComponent(sessionId)}`
                  : "/research/punctum/results"
              }
            >
              Reimagine your Punctum
            </a>
          </div>
        </div>
        <div className="punctum-complete__right">
          <PunctumFeedbackModal embedded={true} sessionId={sessionId} />
        </div>
      </div>
    </main>
  );
}

function PunctumGestureRuntime({
  enabled,
  videoRef,
  canvasRef,
  pointerRef,
  status,
  state,
  handDetected,
  onDisable,
}) {
  return (
    <>
      <video
        ref={videoRef}
        className="punctum-gesture-camera-source"
        autoPlay
        playsInline
        muted
        aria-hidden="true"
      />
      <canvas
        ref={canvasRef}
        className="punctum-gesture-camera-source"
        aria-hidden="true"
      />
      {enabled && (
        <>
          <div
            ref={pointerRef}
            className="punctum-gesture-pointer"
            aria-hidden="true"
          >
            <span></span>
          </div>
          <div
            className={`punctum-gesture-hud ${
              state === "ready" && handDetected ? "is-ready" : ""
            } ${state === "error" ? "is-error" : ""}`}
            role="status"
            aria-live="polite"
          >
            <i aria-hidden="true"></i>
            <span>{status}</span>
            <button type="button" onClick={onDisable}>
              Turn off
            </button>
          </div>
        </>
      )}
    </>
  );
}

export default function PunctumExperiment({
  images,
  turnstileSiteKey,
  isLocalPreview,
}) {
  const [step, setStep] = useState("difference");
  const [form, setForm] = useState({
    ageBand: "",
    gender: "",
    countryCode: "",
    ageConfirmed: false,
    consentAccepted: false,
  });
  const [turnstileToken, setTurnstileToken] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [annotation, setAnnotation] = useState(null);
  const [annotationDraft, setAnnotationDraft] = useState("");
  const [annotationSaving, setAnnotationSaving] = useState(false);
  const [annotationError, setAnnotationError] = useState("");
  const [completedMarks, setCompletedMarks] = useState(0);
  const [gestureEnabled, setGestureEnabled] = useState(false);
  const gestureControl = usePunctumGestureControl({
    enabled: gestureEnabled,
  });

  const currentImage = images[currentIndex];
  const orderedImages = useMemo(() => [...images], [images]);
  const gestureStatus = getPunctumGestureStatus({
    enabled: gestureEnabled,
    onboardingState: gestureControl.onboardingState,
    handDetected: gestureControl.handDetected,
  });

  useEffect(() => {
    const setupProgress = {
      difference: 0.09,
      profile: 0.17,
      consent: 0.21,
      verification: 0.25,
      practice: 0.29,
      complete: 1,
    };
    const imageSpan = 0.7 / Math.max(orderedImages.length, 1);
    const imageProgress =
      step === "drawing"
        ? 0.3 + currentIndex * imageSpan
        : step === "annotation"
          ? 0.3 + (currentIndex + 0.56) * imageSpan
          : null;
    const value = imageProgress ?? setupProgress[step] ?? 0.05;

    window.dispatchEvent(
      new CustomEvent("punctum:progress", {
        detail: { value, step, imageIndex: currentIndex },
      }),
    );
  }, [currentIndex, orderedImages.length, step]);

  const beginSession = async () => {
    setSessionLoading(true);
    setSessionError("");
    try {
      const payload = await fetchJson("/api/punctum/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          turnstileToken,
          language: navigator.language,
        }),
      });
      setSessionId(payload.sessionId);
      sessionStorage.removeItem("punctum-session-markings");
      sessionStorage.setItem("punctum-session-id", payload.sessionId);
      setStep("practice");
    } catch (error) {
      setSessionError(error.message);
      setTurnstileToken(isLocalPreview ? "local-preview" : "");
    } finally {
      setSessionLoading(false);
    }
  };

  const completeSession = async () => {
    setStep("complete");
    if (!sessionId) return;
    fetch("/api/punctum/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).catch(() => {});
  };

  const advance = () => {
    setAnnotation(null);
    setAnnotationDraft("");
    setAnnotationError("");
    if (currentIndex >= orderedImages.length - 1) {
      completeSession();
      return;
    }
    setCurrentIndex((index) => index + 1);
    setStep("drawing");
  };

  const saveSessionMarking = (responseId, polygon, text = "") => {
    try {
      const raw = sessionStorage.getItem("punctum-session-markings") || "{}";
      const data = JSON.parse(raw);
      data[currentImage.id] = {
        responseId,
        imageId: currentImage.id,
        imageTitle: currentImage.title,
        imageSlug: currentImage.slug,
        imageUrl: currentImage.url,
        width: currentImage.width,
        height: currentImage.height,
        softBackground: currentImage.softBackground,
        vertices: polygon.vertices,
        annotation: text || data[currentImage.id]?.annotation || "",
      };
      sessionStorage.setItem("punctum-session-markings", JSON.stringify(data));
    } catch {
      // ignore
    }
  };

  const commitPolygon = async (polygon) => {
    const editingResponseId = annotation?.responseId || null;
    const payload = await fetchJson("/api/punctum/responses", {
      method: editingResponseId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        imageId: currentImage.id,
        ...(editingResponseId
          ? { responseId: editingResponseId }
          : { idempotencyKey: crypto.randomUUID() }),
        vertices: polygon.vertices,
        drawingType: polygon.drawingType,
        polygonFitScore: polygon.polygonFitScore,
        brushRadius: polygon.brushRadius,
      }),
    });
    if (!editingResponseId) {
      setCompletedMarks((count) => count + (payload.alreadyRecorded ? 0 : 1));
    }
    saveSessionMarking(payload.responseId, polygon, "");
    return payload.responseId;
  };
  commitPolygon.afterGlow = (responseId, polygon) => {
    saveSessionMarking(responseId, polygon, "");
    setAnnotation({ responseId, polygon });
    setStep("annotation");
  };

  const editPunctum = (draft) => {
    setAnnotationDraft(draft);
    setAnnotationError("");
    setStep("drawing");
  };

  const saveAnnotation = async (text) => {
    setAnnotationSaving(true);
    setAnnotationError("");
    try {
      if (annotation?.responseId && annotation?.polygon) {
        saveSessionMarking(annotation.responseId, annotation.polygon, text);
      }
      await fetchJson("/api/punctum/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          responseId: annotation.responseId,
          text,
        }),
      });
      advance();
    } catch (error) {
      setAnnotationError(error.message);
    } finally {
      setAnnotationSaving(false);
    }
  };

  const restart = () => {
    sessionStorage.removeItem("punctum-session-id");
    sessionStorage.removeItem("punctum-session-markings");
    sessionStorage.removeItem("punctum-feedback-popup-seen");
    setStep("difference");
    setForm({
      ageBand: "",
      gender: "",
      countryCode: "",
      ageConfirmed: false,
      consentAccepted: false,
    });
    setTurnstileToken("");
    setSessionId("");
    setCurrentIndex(0);
    setCompletedMarks(0);
    setAnnotation(null);
    setAnnotationDraft("");
    setGestureEnabled(false);
  };

  const enableGestureControl = () => {
    if (!gestureEnabled) {
      setGestureEnabled(true);
      return;
    }
    if (gestureControl.onboardingState === "error") {
      setGestureEnabled(false);
      window.setTimeout(() => setGestureEnabled(true), 0);
    }
  };

  let content;
  if (step === "difference") {
    content = (
      <DifferenceStep
        onContinue={() => setStep("profile")}
        onSkip={() => setStep("profile")}
      />
    );
  } else if (step === "profile") {
    content = (
      <ProfileStep
        form={form}
        setForm={setForm}
        onBack={() => setStep("difference")}
        onContinue={() => setStep("consent")}
      />
    );
  } else if (step === "consent") {
    content = (
      <ConsentStep
        form={form}
        setForm={setForm}
        onBack={() => setStep("profile")}
        onContinue={() => setStep("verification")}
      />
    );
  } else if (step === "verification") {
    content = (
      <VerificationStep
        siteKey={turnstileSiteKey}
        isLocalPreview={isLocalPreview}
        token={turnstileToken}
        setToken={setTurnstileToken}
        loading={sessionLoading}
        error={sessionError}
        onBack={() => setStep("consent")}
        onBegin={beginSession}
      />
    );
  } else if (step === "practice") {
    content = (
      <PracticeStep
        onContinue={() => setStep("drawing")}
        gestureEnabled={gestureEnabled}
        gestureState={gestureControl.onboardingState}
        gestureStatus={gestureStatus}
        onEnableGesture={enableGestureControl}
      />
    );
  } else if (step === "drawing") {
    content = (
      <PunctumDrawingStage
        key={currentImage.id}
        image={currentImage}
        index={currentIndex}
        total={orderedImages.length}
        initialPolygon={annotation?.polygon || null}
        onConfirm={commitPolygon}
        onSaveAnnotation={saveAnnotation}
        onNextImage={advance}
        onSkip={advance}
      />
    );
  } else if (step === "annotation" && annotation) {
    content = (
      <AnnotationStep
        image={currentImage}
        polygon={annotation.polygon}
        initialText={annotationDraft}
        saving={annotationSaving}
        error={annotationError}
        onEdit={editPunctum}
        onSave={saveAnnotation}
        onSkip={advance}
      />
    );
  } else {
    content = <CompletionStep sessionId={sessionId} onRestart={restart} />;
  }

  return (
    <>
      {content}
      <PunctumGestureRuntime
        enabled={gestureEnabled}
        videoRef={gestureControl.videoRef}
        canvasRef={gestureControl.canvasRef}
        pointerRef={gestureControl.pointerRef}
        status={gestureStatus}
        state={gestureControl.onboardingState}
        handDetected={gestureControl.handDetected}
        onDisable={() => setGestureEnabled(false)}
      />
    </>
  );
}
