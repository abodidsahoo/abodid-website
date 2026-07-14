import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import { paulGrahamQuotes } from "../lib/paulGrahamQuotes.js";

const CARD_COLORS = ["#4893B0", "#FFC46F", "#DE5847", "#8C312B"];
const CARD_TEXT_COLORS = ["#111111", "#111111", "#111111", "#FFFFFF"];
const SLIDE_OUT = { duration: 0.52, ease: [0.4, 0, 0.2, 1] };
const SLIDE_IN = { duration: 0.52, ease: [0.16, 1, 0.3, 1] };
const SETTLED = { duration: 0 };
const CROSSFADE = { duration: 0.095, ease: [0.22, 1, 0.36, 1] };
const FLICK_DISTANCE = 52;
const FLICK_MIN_DISTANCE = 18;
const FLICK_VELOCITY = 0.45;
const CLICK_TOLERANCE = 8;

function wrapIndex(index, length) {
  return ((index % length) + length) % length;
}

function sizeIndexFor(wordCount) {
  if (wordCount <= 18) return 0;
  if (wordCount <= 40) return 1;
  if (wordCount <= 75) return 2;
  if (wordCount <= 120) return 3;
  return 4;
}

function cardMotion(role, phase, fadeDirection) {
  if (role === "next") {
    return {
      y: phase === "forward" ? 0 : 18,
      opacity: 1,
      scale: phase === "forward" ? 1 : 0.992,
    };
  }

  if (role === "queued") {
    return {
      y: phase === "forward" ? 18 : 30,
      opacity: 1,
      scale: phase === "forward" ? 0.992 : 0.984,
    };
  }

  if (role === "incoming") {
    return phase === "forward"
      ? { y: 30, opacity: 1, scale: 0.984 }
      : { y: 42, opacity: 0, scale: 0.976 };
  }

  if (phase === "forward") {
    return { y: "-108%", opacity: 0.16, scale: 1 };
  }

  if (phase === "fadeOut") {
    return { y: fadeDirection > 0 ? -8 : 8, opacity: 0, scale: 1 };
  }

  if (phase === "fadeIn") {
    return { y: fadeDirection > 0 ? 8 : -8, opacity: 0, scale: 1 };
  }

  return { y: 0, opacity: 1, scale: 1 };
}

function QuoteMetadata({ quote }) {
  if (!quote.source && !quote.year) return null;

  return (
    <p className="quote-card__metadata">
      {[quote.source, quote.year].filter(Boolean).join(" · ")}
    </p>
  );
}

export default function PaulGrahamQuoteDeck() {
  const quotes = paulGrahamQuotes;
  const prefersReducedMotion = useReducedMotion();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState("idle");
  const [fadeDirection, setFadeDirection] = useState(1);
  const [fitStep, setFitStep] = useState(0);
  const [canScrollQuote, setCanScrollQuote] = useState(false);
  const quoteScrollerRef = useRef(null);
  const quoteTextRef = useRef(null);
  const cardGestureRef = useRef(null);
  const lockedRef = useRef(false);
  const finishingRef = useRef(false);
  const phaseRef = useRef("idle");
  const timersRef = useRef(new Set());

  const currentQuote = quotes[currentIndex];
  const baseSizeIndex = sizeIndexFor(currentQuote?.wordCount || 0);
  const effectiveSizeIndex = Math.min(4, baseSizeIndex + fitStep);

  const visibleCards = useMemo(
    () =>
      ["current", "next", "queued", "incoming"].map((role, offset) => {
        const absoluteIndex = wrapIndex(currentIndex + offset, quotes.length);
        return { role, absoluteIndex, quote: quotes[absoluteIndex] };
      }),
    [currentIndex, quotes],
  );

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const schedule = useCallback((callback, delay) => {
    const timer = window.setTimeout(() => {
      timersRef.current.delete(timer);
      callback();
    }, delay);
    timersRef.current.add(timer);
    return timer;
  }, []);

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
    },
    [],
  );

  const runCrossfade = useCallback(
    (direction) => {
      if (lockedRef.current || phaseRef.current !== "idle") return;

      lockedRef.current = true;
      setFadeDirection(direction);
      setFitStep(0);
      setCanScrollQuote(false);
      setPhase("fadeOut");

      schedule(() => {
        setCurrentIndex((index) => wrapIndex(index + direction, quotes.length));
        setPhase("fadeIn");

        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => setPhase("idle"));
        });

        schedule(() => {
          lockedRef.current = false;
        }, 115);
      }, 95);
    },
    [quotes.length, schedule],
  );

  const advance = useCallback(() => {
    if (lockedRef.current || phaseRef.current !== "idle") return;

    if (prefersReducedMotion) {
      runCrossfade(1);
      return;
    }

    lockedRef.current = true;
    finishingRef.current = false;
    setPhase("forward");
  }, [prefersReducedMotion, runCrossfade]);

  const restorePrevious = useCallback(() => {
    runCrossfade(-1);
  }, [runCrossfade]);

  const finishForward = useCallback(() => {
    if (phaseRef.current !== "forward" || finishingRef.current) return;
    finishingRef.current = true;
    setFitStep(0);
    setCanScrollQuote(false);
    setCurrentIndex((index) => wrapIndex(index + 1, quotes.length));
    setPhase("restack");

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setPhase("idle"));
    });

    schedule(() => {
      lockedRef.current = false;
    }, 80);
  }, [quotes.length, schedule]);

  useEffect(() => {
    setFitStep(0);
    setCanScrollQuote(false);
  }, [currentQuote?.id]);

  useEffect(() => {
    const scroller = quoteScrollerRef.current;
    const quoteText = quoteTextRef.current;
    if (!scroller || !quoteText || typeof ResizeObserver === "undefined") return;

    let frame = 0;
    const measure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const isOverflowing = scroller.scrollHeight > scroller.clientHeight + 2;
        if (isOverflowing && baseSizeIndex + fitStep < 4) {
          setCanScrollQuote(false);
          setFitStep((step) => Math.min(4 - baseSizeIndex, step + 1));
        } else {
          setCanScrollQuote(isOverflowing);
        }
      });
    };

    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    observer.observe(quoteText);
    measure();

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [baseSizeIndex, currentQuote?.id, fitStep]);

  const handleDeckKeyDown = (event) => {
    if (event.repeat) {
      event.preventDefault();
      return;
    }

    const isButtonActivation =
      event.target instanceof HTMLButtonElement &&
      (event.key === "Enter" || event.key === " ");
    if (isButtonActivation) return;

    if (["Enter", " ", "ArrowDown", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      advance();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      restorePrevious();
    }
  };

  if (!currentQuote || quotes.length < 4) return null;

  return (
    <section className="quote-drawer" aria-labelledby="quote-drawer-title">
      <header className="quote-drawer__intro">
        <h1 id="quote-drawer-title">Paul Graham’s Quotes Box</h1>
      </header>

      <div
        className="quote-deck"
        role="region"
        aria-label="Paul Graham quote deck"
        onKeyDown={handleDeckKeyDown}
      >
        <div className="quote-deck__stage">
          {visibleCards.map(({ role, quote, absoluteIndex }) => {
            const isCurrent = role === "current";
            const paletteIndex = absoluteIndex % CARD_COLORS.length;
            const transition =
              phase === "forward"
                ? role === "current"
                  ? SLIDE_OUT
                  : SLIDE_IN
                : phase === "restack"
                  ? SETTLED
                  : phase === "idle"
                    ? SETTLED
                    : CROSSFADE;

            return (
              <motion.article
                key={role}
                className={`quote-card quote-card--${role}`}
                style={{
                  backgroundColor: CARD_COLORS[paletteIndex],
                  color: CARD_TEXT_COLORS[paletteIndex],
                  zIndex:
                    role === "current"
                      ? 4
                      : role === "next"
                        ? 3
                        : role === "queued"
                          ? 2
                          : 1,
                }}
                data-size-index={
                  isCurrent ? effectiveSizeIndex : sizeIndexFor(quote.wordCount)
                }
                aria-hidden={!isCurrent}
                tabIndex={isCurrent ? 0 : -1}
                animate={cardMotion(role, phase, fadeDirection)}
                transition={transition}
                onPointerDown={
                  isCurrent
                    ? (event) => {
                        if (event.button !== 0 || lockedRef.current) return;
                        cardGestureRef.current = {
                          pointerId: event.pointerId,
                          startX: event.clientX,
                          startY: event.clientY,
                          startedAt: performance.now(),
                        };
                        event.currentTarget.focus({ preventScroll: true });
                        event.currentTarget.setPointerCapture?.(event.pointerId);
                      }
                    : undefined
                }
                onPointerUp={
                  isCurrent
                    ? (event) => {
                        const gesture = cardGestureRef.current;
                        if (!gesture || gesture.pointerId !== event.pointerId) return;
                        cardGestureRef.current = null;
                        event.currentTarget.releasePointerCapture?.(event.pointerId);

                        const deltaX = event.clientX - gesture.startX;
                        const deltaY = event.clientY - gesture.startY;
                        const upwardDistance = -deltaY;
                        const elapsed = Math.max(
                          1,
                          performance.now() - gesture.startedAt,
                        );
                        const upwardVelocity = upwardDistance / elapsed;
                        const isClick =
                          Math.hypot(deltaX, deltaY) <= CLICK_TOLERANCE;
                        const isFlick =
                          upwardDistance >= FLICK_DISTANCE ||
                          (upwardDistance >= FLICK_MIN_DISTANCE &&
                            upwardVelocity >= FLICK_VELOCITY);

                        if (isClick || isFlick) advance();
                      }
                    : undefined
                }
                onPointerCancel={() => {
                  cardGestureRef.current = null;
                }}
                onAnimationComplete={isCurrent ? finishForward : undefined}
              >
                <div
                  className={`quote-card__content${isCurrent ? "" : " is-preview"}`}
                >
                  <div
                    ref={isCurrent ? quoteScrollerRef : null}
                    className={`quote-card__scroller${isCurrent && canScrollQuote ? " is-scrollable" : ""}`}
                    tabIndex={isCurrent && canScrollQuote ? 0 : -1}
                    onPointerDown={
                      isCurrent && canScrollQuote
                        ? (event) => event.stopPropagation()
                        : undefined
                    }
                    onClick={
                      isCurrent && canScrollQuote
                        ? (event) => {
                            event.stopPropagation();
                            advance();
                          }
                        : undefined
                    }
                  >
                    <blockquote ref={isCurrent ? quoteTextRef : null}>
                      {quote.quote}
                    </blockquote>
                  </div>
                  <footer className="quote-card__attribution">
                    <p className="quote-card__author">{quote.author}</p>
                    <QuoteMetadata quote={quote} />
                  </footer>
                </div>
              </motion.article>
            );
          })}
          <button
            type="button"
            className="quote-card__next"
            aria-label="Next quote"
            style={{ color: CARD_TEXT_COLORS[currentIndex % CARD_COLORS.length] }}
            onClick={advance}
          >
            <span>Next quote</span>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 19V6M7 11l5-5 5 5" />
            </svg>
          </button>
        </div>
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        Quote {currentIndex + 1} of {quotes.length}, by {currentQuote.author}
      </p>
    </section>
  );
}
