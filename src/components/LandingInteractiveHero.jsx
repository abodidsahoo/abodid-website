import { useState, useEffect, useRef } from 'react';
import { vaultTags as fallbackVaultTags } from '../utils/tags';

const TAG_COLOR_THEMES = [
  { bg: 'var(--pop-pink, #f78bb1)', color: 'var(--pop-ink, #15130f)', border: 'rgba(23, 21, 15, 0.35)' },
  { bg: 'var(--pop-yellow, #ffe44f)', color: 'var(--pop-ink, #15130f)', border: 'rgba(23, 21, 15, 0.35)' },
  { bg: 'var(--pop-cream, #fff8e8)', color: 'var(--pop-ink, #15130f)', border: 'rgba(23, 21, 15, 0.3)' },
  { bg: 'var(--pop-lime, #caff48)', color: 'var(--pop-ink, #15130f)', border: 'rgba(23, 21, 15, 0.35)' },
  { bg: 'var(--pop-pink, #f78bb1)', color: 'var(--pop-ink, #15130f)', border: 'rgba(23, 21, 15, 0.35)' },
  { bg: 'var(--pop-yellow, #ffe44f)', color: 'var(--pop-ink, #15130f)', border: 'rgba(23, 21, 15, 0.35)' },
];

const BASE_AMBIENT_SLOTS = [
  { id: 'ambient-1', baseXPct: 10, baseYPct: 32, className: 'landing-ambient-tag--left', animDuration: '8s', animDelay: '-1s' },
  { id: 'ambient-2', baseXPct: 90, baseYPct: 26, className: 'landing-ambient-tag--right', animDuration: '9.5s', animDelay: '-3s' },
  { id: 'ambient-3', baseXPct: 11, baseYPct: 70, className: 'landing-ambient-tag--left', animDuration: '7.5s', animDelay: '-4.5s' },
  { id: 'ambient-4', baseXPct: 88, baseYPct: 66, className: 'landing-ambient-tag--right', animDuration: '10s', animDelay: '-2s' },
  { id: 'ambient-5', baseXPct: 73, baseYPct: 13, className: 'landing-ambient-tag--top', animDuration: '8.5s', animDelay: '-5s' },
];

function getRandomDistinct(pool, count) {
  if (!pool || pool.length === 0) return [];
  const chosen = [];
  const usedIndices = new Set();
  const maxAttempts = count * 12;
  let attempts = 0;

  while (chosen.length < Math.min(count, pool.length) && attempts < maxAttempts) {
    const idx = Math.floor(Math.random() * pool.length);
    if (!usedIndices.has(idx)) {
      usedIndices.add(idx);
      chosen.push(pool[idx]);
    }
    attempts++;
  }
  return chosen;
}

function createRandomAmbientTags(pool = fallbackVaultTags) {
  const chosenTags = getRandomDistinct(pool, BASE_AMBIENT_SLOTS.length);
  const shuffledThemes = [...TAG_COLOR_THEMES].sort(() => 0.5 - Math.random());
  // Staggered calm delays: softly appear one after another as page loads (no bounce)
  const softDelays = ['0.12s', '0.34s', '0.58s', '0.82s', '1.06s'];

  return BASE_AMBIENT_SLOTS.map((slot, i) => {
    // Subtle organic position jitter per refresh (+/- 2% within safe margins)
    const jitterX = Math.random() * 4 - 2;
    const jitterY = Math.random() * 4 - 2;

    return {
      ...slot,
      xPercent: Number((slot.baseXPct + jitterX).toFixed(1)),
      yPercent: Number((slot.baseYPct + jitterY).toFixed(1)),
      text: chosenTags[i] || 'creative-technology',
      theme: shuffledThemes[i % shuffledThemes.length],
      entryDelay: softDelays[i],
      isDissolved: false,
    };
  });
}

export default function LandingInteractiveHero({
  name = "Abodid Sahoo",
  heading,
  keyline = "Creative Technologist, Immersive Experience Designer and Visual Artist working between London and India",
  role,
  subtitle,
  location,
  description = null,
  statement,
  lede,
  ctaText = "Explore selected work",
  ctaHref = "#selected-work",
  secondaryCtaText = "Work with me",
  secondaryCtaHref = "#enquiry",
  vaultLabel = "my obsidian vault",
}) {
  const [activeTags, setActiveTags] = useState([]);
  const [ambientTags, setAmbientTags] = useState(() =>
    BASE_AMBIENT_SLOTS.map((slot, i) => ({
      ...slot,
      xPercent: slot.baseXPct,
      yPercent: slot.baseYPct,
      text: fallbackVaultTags[i % fallbackVaultTags.length] || 'creative-technology',
      theme: TAG_COLOR_THEMES[i % TAG_COLOR_THEMES.length],
      entryDelay: `${0.12 + i * 0.22}s`,
      isDissolved: false,
    }))
  );
  const [isClientReady, setIsClientReady] = useState(false);

  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const activeTagsRef = useRef([]);
  const lastSpawnPosition = useRef({ x: -999, y: -999 });
  const tagIdCounter = useRef(0);
  const tagsRef = useRef(fallbackVaultTags);
  const transitioningIndexRef = useRef(null);

  const CHECK_INTERVAL = 18;
  const MIN_SPACING = 85;
  const MAX_TAGS = 16;
  const FADE_DURATION = 1600;
  const EDGE_PADDING_X = 36;
  const EDGE_PADDING_Y = 36;

  // Resolve dominant title and keyline
  const heroTitle = name || heading || "Abodid Sahoo";
  const heroKeyline = keyline || role || subtitle || "Creative Technologist, Immersive Experience Designer and Visual Artist working between London and India";

  // On client mount: pick randomized tags once and activate smooth staggered entrance
  useEffect(() => {
    setAmbientTags(createRandomAmbientTags(tagsRef.current));
    setIsClientReady(true);
  }, []);

  // Fetch full live Obsidian vault tags from API for future transitions ONLY
  useEffect(() => {
    let isMounted = true;
    const fetchTags = async () => {
      try {
        const res = await fetch('/api/vault-tags.json');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0 && isMounted) {
            tagsRef.current = data;
            // DO NOT call setAmbientTags here!
            // That avoids the initial jarring flash where pills disappeared and were re-seeded.
          }
        }
      } catch (err) {
        // Fallback to static tags if network is unavailable
      }
    };
    fetchTags();
    return () => {
      isMounted = false;
    };
  }, []);

  // Smooth dissolve transition: dissolve pill into invisible space, rest in void, then appear smoothly
  useEffect(() => {
    if (!isClientReady) return;

    const timeouts = [];

    const interval = setInterval(() => {
      if (transitioningIndexRef.current !== null) return;

      const pool = tagsRef.current || fallbackVaultTags;
      if (!pool || pool.length === 0) return;

      setAmbientTags((prev) => {
        const slotIdx = Math.floor(Math.random() * prev.length);
        const currentSlot = prev[slotIdx];
        if (!currentSlot || currentSlot.isDissolved) return prev;

        const activeTexts = new Set(prev.map((s) => s.text));
        let candidate = pool[Math.floor(Math.random() * pool.length)];
        let attempts = 0;
        while (activeTexts.has(candidate) && attempts < 25) {
          candidate = pool[Math.floor(Math.random() * pool.length)];
          attempts++;
        }

        const newTheme = TAG_COLOR_THEMES[Math.floor(Math.random() * TAG_COLOR_THEMES.length)];
        transitioningIndexRef.current = slotIdx;

        // Phase 1: Pill smoothly dissolves into invisible space via CSS transition (0.75s)
        const t1 = setTimeout(() => {
          // Phase 2: In invisible space (opacity 0), update text & theme, pause in void (0.4s)
          setAmbientTags((curr) =>
            curr.map((s, idx) =>
              idx === slotIdx
                ? {
                    ...s,
                    text: candidate,
                    theme: newTheme,
                  }
                : s
            )
          );

          const t2 = setTimeout(() => {
            // Phase 3: Smoothly emerge from invisible space (0.85s)
            setAmbientTags((curr) =>
              curr.map((s, idx) =>
                idx === slotIdx
                  ? {
                      ...s,
                      isDissolved: false,
                    }
                  : s
              )
            );

            // Phase 4: Transition complete, release lock
            const t3 = setTimeout(() => {
              transitioningIndexRef.current = null;
            }, 850);
            timeouts.push(t3);
          }, 400);
          timeouts.push(t2);
        }, 750);
        timeouts.push(t1);

        return prev.map((s, idx) =>
          idx === slotIdx
            ? {
                ...s,
                isDissolved: true,
              }
            : s
        );
      });
    }, 7500);

    return () => {
      clearInterval(interval);
      timeouts.forEach(clearTimeout);
    };
  }, [isClientReady]);

  // Mousemove interaction strictly clear of the text content with cached geometry for zero lag
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let containerRect = null;
    let contentRect = null;
    let rafId = null;

    const measureGeometry = () => {
      if (container) containerRect = container.getBoundingClientRect();
      if (contentRef.current) contentRect = contentRef.current.getBoundingClientRect();
    };

    measureGeometry();
    window.addEventListener('resize', measureGeometry, { passive: true });
    window.addEventListener('scroll', measureGeometry, { passive: true });

    const isInsideContent = (relX, relY) => {
      if (!contentRect || !containerRect) return false;
      const bufferX = 40;
      const bufferY = 28;

      const left = contentRect.left - containerRect.left - bufferX;
      const right = contentRect.right - containerRect.left + bufferX;
      const top = contentRect.top - containerRect.top - bufferY;
      const bottom = contentRect.bottom - containerRect.top + bufferY;

      return relX >= left && relX <= right && relY >= top && relY <= bottom;
    };

    const processPointer = (clientX, clientY) => {
      if (!containerRect) measureGeometry();
      if (!containerRect) return;

      const isInside =
        clientX >= containerRect.left &&
        clientX <= containerRect.right &&
        clientY >= containerRect.top &&
        clientY <= containerRect.bottom;

      if (!isInside) return;

      const relX = clientX - containerRect.left;
      const relY = clientY - containerRect.top;

      if (isInsideContent(relX, relY)) {
        return;
      }

      const minX = Math.min(EDGE_PADDING_X, containerRect.width * 0.1);
      const maxX = Math.max(minX + 20, containerRect.width - EDGE_PADDING_X);
      const minY = Math.min(EDGE_PADDING_Y, containerRect.height * 0.1);
      const maxY = Math.max(minY + 20, containerRect.height - EDGE_PADDING_Y);

      if (relX < 10 || relX > containerRect.width - 10 || relY < 10 || relY > containerRect.height - 10) {
        return;
      }

      const clampedX = Math.max(minX, Math.min(maxX, relX));
      const clampedY = Math.max(minY, Math.min(maxY, relY));

      const dx = clampedX - lastSpawnPosition.current.x;
      const dy = clampedY - lastSpawnPosition.current.y;
      const distFromLast = Math.sqrt(dx * dx + dy * dy);

      if (distFromLast > CHECK_INTERVAL) {
        attemptSpawn(clampedX, clampedY);
      }
    };

    const handleMouseMove = (e) => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        processPointer(e.clientX, e.clientY);
      });
    };

    const attemptSpawn = (x, y) => {
      const hasCollision = activeTagsRef.current.some((tag) => {
        const dx = x - tag.x;
        const dy = y - tag.y;
        return Math.sqrt(dx * dx + dy * dy) < MIN_SPACING;
      });

      if (!hasCollision) {
        spawnTag(x, y);
        lastSpawnPosition.current = { x, y };
      }
    };

    const spawnTag = (x, y) => {
      const pool = tagsRef.current || fallbackVaultTags;
      const text = pool[Math.floor(Math.random() * pool.length)];
      const theme = TAG_COLOR_THEMES[Math.floor(Math.random() * TAG_COLOR_THEMES.length)];

      const newTag = {
        id: tagIdCounter.current++,
        text,
        theme,
        x,
        y,
      };

      activeTagsRef.current.push(newTag);
      if (activeTagsRef.current.length > MAX_TAGS) {
        activeTagsRef.current.shift();
      }

      setActiveTags([...activeTagsRef.current]);

      setTimeout(() => {
        activeTagsRef.current = activeTagsRef.current.filter((t) => t.id !== newTag.id);
        setActiveTags([...activeTagsRef.current]);
      }, FADE_DURATION + 50);
    };

    container.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', measureGeometry);
      window.removeEventListener('scroll', measureGeometry);
      container.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const handleScrollClick = (e, targetHref) => {
    if (targetHref.startsWith('#')) {
      const targetElement = document.querySelector(targetHref);
      if (targetElement) {
        e.preventDefault();
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  return (
    <section ref={containerRef} className="landing-interactive-hero" aria-labelledby="story-hero-heading">
      {/* Small pill in the bottom right corner: my obsidian vault */}
      <a
        href="/obsidian-vault"
        className="landing-hero__vault-pill"
        title="Explore my Obsidian vault"
      >
        <span className="landing-hero__vault-pill-dot" aria-hidden="true" />
        <span>{vaultLabel}</span>
        <span className="landing-hero__vault-arrow" aria-hidden="true">↗</span>
      </a>

      {/* Floating pill backdrop: ambient drifting pills + mouse trail pills clear of text */}
      <div
        className={`landing-hero__backdrop ${isClientReady ? 'landing-hero__backdrop--ready' : ''}`}
        aria-hidden="true"
        suppressHydrationWarning
      >
        {/* Ambient floating pills in periphery clear of text */}
        {isClientReady &&
          ambientTags.map((tag) => (
            <div
              key={tag.id}
              className={`landing-ambient-slot ${tag.className}`}
              style={{
                position: 'absolute',
                left: `${tag.xPercent}%`,
                top: `${tag.yPercent}%`,
              }}
              suppressHydrationWarning
            >
              <div
                className="landing-ambient-entry"
                style={{
                  animationDelay: tag.entryDelay,
                }}
              >
                <div
                  className="landing-ambient-floating-wrap"
                  style={{
                    animationDuration: tag.animDuration,
                    animationDelay: tag.animDelay,
                  }}
                >
                  <span
                    className={`landing-tag-content ${
                      tag.isDissolved ? 'landing-tag-content--dissolved' : ''
                    }`}
                    style={{
                      backgroundColor: tag.theme.bg,
                      color: tag.theme.color,
                      borderColor: tag.theme.border,
                    }}
                  >
                    #{tag.text}
                  </span>
                </div>
              </div>
            </div>
          ))}

        {/* Dynamic trail pills spawned by cursor, strictly clear of text */}
        {activeTags.map((tag) => (
          <div
            key={tag.id}
            className="landing-floating-tag landing-trail-tag"
            style={{
              position: 'absolute',
              left: `${tag.x}px`,
              top: `${tag.y}px`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <span
              className="landing-tag-content"
              style={{
                backgroundColor: tag.theme.bg,
                color: tag.theme.color,
                borderColor: tag.theme.border,
              }}
            >
              #{tag.text}
            </span>
          </div>
        ))}
      </div>

      {/* Main Centered Content — reading order: name -> keyline -> actions */}
      <div className="landing-hero__content" ref={contentRef}>
        <h1 id="story-hero-heading" className="landing-hero__heading">
          {heroTitle}
        </h1>

        {heroKeyline && (
          <p className="landing-hero__keyline">{heroKeyline}</p>
        )}

        {description && description !== heroKeyline && (
          <p className="landing-hero__description">{description}</p>
        )}

        <div className="landing-hero__actions">
          <a
            className="landing-hero__enter-btn"
            href={ctaHref}
            onClick={(e) => handleScrollClick(e, ctaHref)}
          >
            <span>{ctaText}</span>
            <span className="landing-hero__enter-arrow" aria-hidden="true">↓</span>
          </a>

          {secondaryCtaText && (
            <a
              className="landing-hero__secondary-btn"
              href={secondaryCtaHref}
              onClick={(e) => handleScrollClick(e, secondaryCtaHref)}
            >
              <span>{secondaryCtaText}</span>
              <span className="link-destination-arrow" aria-hidden="true">↗</span>
            </a>
          )}
        </div>
      </div>

      <style>{`
        .landing-interactive-hero {
          position: relative;
          min-height: 100svh;
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(5.5rem, 11vh, 8rem) clamp(1.5rem, 4vw, 4rem) clamp(3rem, 6vh, 4.5rem);
          background: var(--pop-blue, #2444ca);
          border: none;
          border-radius: 0;
          overflow: hidden;
          isolation: isolate;
          user-select: none;
          cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32' fill='none'%3E%3Cline x1='8' y1='8' x2='26' y2='26' stroke='%23fff8e8' stroke-width='4.5' stroke-linecap='round'/%3E%3Cline x1='8' y1='8' x2='16' y2='16' stroke='%23ff7eb5' stroke-width='2.5' stroke-linecap='round'/%3E%3Cline x1='16' y1='16' x2='26' y2='26' stroke='%2315130f' stroke-width='2.5' stroke-linecap='round'/%3E%3Cpath d='M5 0L6.5 3.5L10 5L6.5 6.5L5 10L3.5 6.5L0 5L3.5 3.5Z' fill='%23fff8e8' stroke='%2315130f' stroke-width='0.8'/%3E%3Ccircle cx='5' cy='5' r='1.2' fill='%23ffe44f'/%3E%3Cpath d='M13 1L14 3.2L16.2 4.2L14 5.2L13 7.5L12 5.2L9.8 4.2L12 3.2Z' fill='%23ffe44f'/%3E%3Cpath d='M2 12L3 14.2L5.2 15.2L3 16.2L2 18.5L1 16.2L-1.2 15.2L1 14.2Z' fill='%23ff7eb5'/%3E%3C/svg%3E") 4 4, crosshair;
        }

        @media (min-width: 769px) {
          .landing-interactive-hero {
            min-height: 100svh;
            min-height: 100vh;
          }
        }

        .landing-hero__vault-pill {
          position: absolute;
          bottom: clamp(1.2rem, 2.5vh, 2rem);
          right: clamp(1.2rem, 2.8vw, 2.5rem);
          z-index: 15;
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.42rem 0.95rem;
          border: 1px solid rgba(255, 248, 232, 0.3);
          border-radius: 999px;
          background: rgba(23, 21, 15, 0.32);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          color: var(--pop-cream, #fff8e8);
          font: 600 clamp(0.72rem, 0.85vw, 0.82rem)/1.2 var(--font-mono, monospace);
          letter-spacing: 0.03em;
          text-decoration: none;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.14);
          transition: transform 180ms ease, background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
          cursor: pointer;
        }

        .landing-hero__vault-pill:hover {
          background: rgba(255, 248, 232, 0.18);
          border-color: rgba(255, 248, 232, 0.7);
          transform: translateY(-2px);
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
        }

        .landing-hero__vault-pill-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--pop-lime, #caff48);
          box-shadow: 0 0 6px var(--pop-lime, #caff48);
          display: inline-block;
          animation: vaultPulse 2.4s ease-in-out infinite;
        }

        .landing-hero__vault-arrow {
          font-size: 0.88em;
          opacity: 0.75;
          transition: transform 180ms ease, opacity 180ms ease;
        }

        .landing-hero__vault-pill:hover .landing-hero__vault-arrow {
          opacity: 1;
          transform: translate(1px, -1px);
        }

        .landing-hero__backdrop {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 1;
          overflow: hidden;
          opacity: 0;
          transition: opacity 0.25s ease;
        }

        .landing-hero__backdrop--ready {
          opacity: 1;
        }

        /* Ambient Pill Slot: handles spatial positioning */
        .landing-ambient-slot {
          transform: translate(-50%, -50%);
          will-change: transform;
        }

        /* Soft staggered entry on page load: NO BOUNCE, gentle upward drift and soft fade */
        .landing-ambient-entry {
          animation: softPillEntry 0.85s cubic-bezier(0.16, 1, 0.3, 1) both;
          will-change: transform, opacity;
        }

        /* Ambient Floating Wrap: handles the continuous drifting orbit animation */
        .landing-ambient-floating-wrap {
          animation-name: ambientFloat;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          animation-direction: alternate;
          will-change: transform;
        }

        .landing-floating-tag {
          pointer-events: none;
          z-index: 5;
          will-change: transform, opacity;
        }

        .landing-trail-tag {
          animation: trailFadeMove 1.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        /* Capsule Container: pure hardware-accelerated GPU opacity & scale dissolve transitions */
        .landing-tag-content {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 7px 18px;
          border: 1px solid rgba(23, 21, 15, 0.3);
          border-radius: 999px;
          color: var(--pop-ink, #15130f) !important;
          font-family: var(--font-display, sans-serif);
          font-size: clamp(0.85rem, 0.95vw, 1.02rem);
          font-weight: 500;
          letter-spacing: -0.01em;
          white-space: nowrap;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16), 0 1px 4px rgba(0, 0, 0, 0.1);
          opacity: 1;
          transform: scale(1) translateZ(0);
          transition: opacity 0.85s cubic-bezier(0.16, 1, 0.3, 1),
                      transform 0.85s cubic-bezier(0.16, 1, 0.3, 1),
                      background-color 0.35s ease,
                      border-color 0.35s ease;
          will-change: transform, opacity;
          backface-visibility: hidden;
        }

        /* Dissolved into invisible space - pure GPU transition, zero glitch */
        .landing-tag-content--dissolved {
          opacity: 0 !important;
          transform: scale(0.88) translateZ(0) !important;
          pointer-events: none !important;
          transition: opacity 0.75s cubic-bezier(0.4, 0, 0.2, 1),
                      transform 0.75s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        .landing-hero__content {
          position: relative;
          z-index: 10;
          max-width: 66rem;
          margin: 0 auto;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: clamp(1.1rem, 2vw, 1.75rem);
          transform: translateY(-3vh);
        }

        .landing-hero__heading {
          margin: 0;
          font: 700 clamp(3.2rem, 6.8vw, 6.2rem)/0.92 var(--font-display, sans-serif);
          letter-spacing: -0.055em;
          color: var(--pop-cream, #fff8e8);
          text-wrap: balance;
          text-align: center;
        }

        .landing-hero__keyline {
          max-width: 46rem;
          margin: 0;
          font: 520 clamp(1.18rem, 1.85vw, 1.65rem)/1.42 var(--font-display, sans-serif);
          letter-spacing: -0.02em;
          color: var(--pop-cream, #fff8e8);
          text-wrap: balance;
          text-align: center;
        }

        .landing-hero__description {
          max-width: 44rem;
          margin: 0;
          font: 480 clamp(1rem, 1.4vw, 1.25rem)/1.5 var(--font-display, sans-serif);
          letter-spacing: -0.015em;
          color: rgba(255, 248, 232, 0.9);
          text-wrap: pretty;
          text-align: center;
        }

        .landing-hero__actions {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          gap: 1rem;
          margin-top: 0.5rem;
        }

        .landing-hero__enter-btn {
          min-height: 54px;
          padding: 0.85rem 2.2rem;
          display: inline-flex;
          align-items: center;
          gap: 0.75rem;
          border: 1.5px solid var(--pop-ink, var(--pop-ink));
          border-radius: 999px;
          background: var(--pop-yellow, #ffe44f);
          color: var(--pop-ink, #15130f) !important;
          font: 720 0.95rem/1 var(--font-display, sans-serif);
          letter-spacing: -0.01em;
          text-decoration: none;
          box-shadow: 0 4px 0 var(--pop-ink, var(--pop-ink));
          transition: transform 180ms ease, box-shadow 180ms ease, background-color 180ms ease;
          cursor: pointer;
        }

        .landing-hero__enter-btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 7px 0 var(--pop-ink, var(--pop-ink));
          background: #ffec6e;
        }

        .landing-hero__enter-btn:active {
          transform: translateY(0);
          box-shadow: 0 2px 0 var(--pop-ink, var(--pop-ink));
        }

        .landing-hero__enter-arrow {
          display: inline-block;
          font-weight: 800;
          font-size: 1.1rem;
          animation: bounceArrow 2s ease-in-out infinite;
        }

        .landing-hero__secondary-btn {
          min-height: 54px;
          padding: 0.85rem 1.8rem;
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          border: 1px solid rgba(255, 248, 232, 0.45);
          border-radius: 999px;
          background: rgba(255, 248, 232, 0.12);
          backdrop-filter: blur(8px);
          color: var(--pop-cream, #fff8e8) !important;
          font: 650 0.88rem/1 var(--font-mono, monospace);
          letter-spacing: 0.04em;
          text-transform: uppercase;
          text-decoration: none;
          transition: background-color 180ms ease, border-color 180ms ease, transform 180ms ease;
          cursor: pointer;
        }

        .landing-hero__secondary-btn:hover {
          background: rgba(255, 248, 232, 0.22);
          border-color: rgba(255, 248, 232, 0.8);
          transform: translateY(-2px);
        }

        @keyframes bounceArrow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(4px); }
        }

        @keyframes vaultPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.9;
          }
          50% {
            transform: scale(1.35);
            opacity: 1;
          }
        }

        /* Soft, calm, non-bouncy staggered entry on page load */
        @keyframes softPillEntry {
          0% {
            opacity: 0;
            transform: translateY(8px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Ambient subtle floating drift */
        @keyframes ambientFloat {
          0% {
            transform: translate(0, 0) rotate(0deg);
          }
          33% {
            transform: translate(8px, -10px) rotate(1.2deg);
          }
          66% {
            transform: translate(-6px, -6px) rotate(-1deg);
          }
          100% {
            transform: translate(0, 0) rotate(0deg);
          }
        }

        /* Cursor trail pills */
        @keyframes trailFadeMove {
          0% {
            opacity: 0;
            transform: translate(-50%, -40%) scale(0.65);
          }
          12% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -75%) scale(0.92);
          }
        }

        @media (max-width: 1080px) {
          .landing-ambient-tag--top {
            display: none;
          }
        }

        @media (max-width: 860px) {
          .landing-ambient-tag--left,
          .landing-ambient-tag--right {
            display: none;
          }
        }

        @media (max-width: 768px) {
          .landing-interactive-hero {
            min-height: 100svh;
            min-height: 100vh;
            padding: 5rem 1.25rem 3rem;
          }

          .landing-hero__content {
            transform: translateY(-1.5vh);
            gap: 1.15rem;
          }

          .landing-hero__vault-pill {
            bottom: 0.9rem;
            right: 0.9rem;
            padding: 0.35rem 0.75rem;
            font-size: 0.72rem;
          }

          .landing-hero__heading {
            font-size: clamp(2.4rem, 10vw, 3.6rem);
          }

          .landing-hero__keyline {
            font-size: clamp(1.1rem, 4.4vw, 1.35rem);
            line-height: 1.4;
          }

          .landing-hero__actions {
            flex-direction: column;
            width: 100%;
          }

          .landing-hero__enter-btn,
          .landing-hero__secondary-btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </section>
  );
}
