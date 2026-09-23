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

export default function LandingInteractiveHero({
  name = "Abodid Sahoo",
  location = "London, UK",
  heading = "Creative Director, Artist & Researcher",
  statement = "Building experiences at the crossover of technology, art, and human attention.",
  lede = "Directing exhibitions, digital installations, and visual media that move culture forward.",
  ctaText = "Enter the Site",
  ctaHref = "#selected-work",
  secondaryCtaText = "Let’s build together",
  secondaryCtaHref = "#enquiry",
}) {
  const [activeTags, setActiveTags] = useState([]);
  const containerRef = useRef(null);
  const activeTagsRef = useRef([]);
  const lastSpawnPosition = useRef({ x: -999, y: -999 });
  const tagIdCounter = useRef(0);
  const tagsRef = useRef(fallbackVaultTags);

  const CHECK_INTERVAL = 18;
  const MIN_SPACING = 85;
  const MAX_TAGS = 18;
  const FADE_DURATION = 1500;
  const EDGE_PADDING_X = 36;
  const EDGE_PADDING_Y = 36;

  useEffect(() => {
    let isMounted = true;
    const fetchTags = async () => {
      try {
        const res = await fetch('/api/vault-tags.json');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0 && isMounted) {
            tagsRef.current = data;
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      const isInside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      if (!isInside) return;

      const relX = e.clientX - rect.left;
      const relY = e.clientY - rect.top;

      const minX = Math.min(EDGE_PADDING_X, rect.width * 0.1);
      const maxX = Math.max(minX + 20, rect.width - EDGE_PADDING_X);
      const minY = Math.min(EDGE_PADDING_Y, rect.height * 0.1);
      const maxY = Math.max(minY + 20, rect.height - EDGE_PADDING_Y);

      if (relX < 10 || relX > rect.width - 10 || relY < 10 || relY > rect.height - 10) {
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
      {/* Floating pill trail backdrop */}
      <div className="landing-hero__backdrop" aria-hidden="true">
        {activeTags.map((tag) => (
          <div
            key={tag.id}
            className="landing-floating-tag"
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

      {/* Main Centered Content */}
      <div className="landing-hero__content">
        <div className="landing-hero__masthead">
          <p className="landing-hero__name">{name}</p>
          <p className="landing-hero__availability">
            {(() => {
              const parts = location.split('·').map(s => s.trim());
              return parts.length === 2 ? (
                <>
                  <span>{parts[0]}</span>
                  <span className="landing-hero__availability-dot" aria-hidden="true">•</span>
                  <span>{parts[1]}</span>
                </>
              ) : <span>{location}</span>;
            })()}
          </p>
        </div>

        <h1 id="story-hero-heading" className="landing-hero__heading" aria-label={`Abodid Sahoo — ${heading}`}>
          <span className="sr-only">Abodid Sahoo — </span>{heading}
        </h1>

        <p className="landing-hero__statement">{statement}</p>
        <p className="landing-hero__lede">{lede}</p>

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
          min-height: calc(100svh - 16px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(3rem, 6vw, 6rem) clamp(1.5rem, 4vw, 4rem);
          background: var(--pop-blue, #2444ca);
          border: none;
          border-radius: clamp(18px, 2vw, 28px);
          overflow: hidden;
          isolation: isolate;
          user-select: none;
          cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32' fill='none'%3E%3Cline x1='8' y1='8' x2='26' y2='26' stroke='%23fff8e8' stroke-width='4.5' stroke-linecap='round'/%3E%3Cline x1='8' y1='8' x2='16' y2='16' stroke='%23ff7eb5' stroke-width='2.5' stroke-linecap='round'/%3E%3Cline x1='16' y1='16' x2='26' y2='26' stroke='%2315130f' stroke-width='2.5' stroke-linecap='round'/%3E%3Cpath d='M5 0L6.5 3.5L10 5L6.5 6.5L5 10L3.5 6.5L0 5L3.5 3.5Z' fill='%23fff8e8' stroke='%2315130f' stroke-width='0.8'/%3E%3Ccircle cx='5' cy='5' r='1.2' fill='%23ffe44f'/%3E%3Cpath d='M13 1L14 3.2L16.2 4.2L14 5.2L13 7.5L12 5.2L9.8 4.2L12 3.2Z' fill='%23ffe44f'/%3E%3Cpath d='M2 12L3 14.2L5.2 15.2L3 16.2L2 18.5L1 16.2L-1.2 15.2L1 14.2Z' fill='%23ff7eb5'/%3E%3C/svg%3E") 4 4, crosshair;
        }

        .landing-hero__backdrop {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 1;
          overflow: hidden;
        }

        .landing-floating-tag {
          pointer-events: none;
          z-index: 5;
          animation: trailFade 1.5s ease-out forwards;
          will-change: transform, opacity;
        }

        .landing-tag-content {
          display: inline-block;
          padding: 8px 18px;
          border: 1px solid rgba(23, 21, 15, 0.3);
          border-radius: 999px;
          color: var(--pop-ink, #15130f) !important;
          font-family: var(--font-display, sans-serif);
          font-size: 1.05rem;
          font-weight: 480;
          letter-spacing: -0.01em;
          white-space: nowrap;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16), 0 1px 4px rgba(0, 0, 0, 0.1);
        }

        .landing-hero__content {
          position: relative;
          z-index: 10;
          max-width: 68rem;
          margin: 0 auto;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: clamp(1.2rem, 2.2vw, 2.2rem);
        }

        .landing-hero__masthead {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
          font: 750 clamp(0.75rem, 0.95vw, 0.88rem)/1.35 var(--font-mono, monospace);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--pop-yellow, #ffe44f);
        }

        .landing-hero__name {
          margin: 0;
          color: inherit;
          white-space: nowrap;
        }

        .landing-hero__availability {
          margin: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          color: var(--pop-cream, #fff8e8);
          opacity: 0.9;
          white-space: nowrap;
        }

        .landing-hero__availability img {
          width: 14px;
          height: 14px;
          object-fit: contain;
          display: inline-block;
        }

        .landing-hero__availability-dot {
          font-size: 1.35em;
          line-height: 1;
          opacity: 0.7;
          margin: 0 0.15rem;
          vertical-align: middle;
        }

        .landing-hero__heading {
          margin: 0;
          font: 700 clamp(2.8rem, 6.5vw, 6.2rem)/0.88 var(--font-display, sans-serif);
          letter-spacing: -0.055em;
          color: var(--pop-cream, #fff8e8);
          text-wrap: balance;
        }

        .landing-hero__statement {
          max-width: 46rem;
          margin: 0;
          font: 520 clamp(1.2rem, 2vw, 1.85rem)/1.45 var(--font-display, sans-serif);
          letter-spacing: -0.02em;
          color: var(--pop-cream, #fff8e8);
          text-wrap: pretty;
        }

        .landing-hero__lede {
          max-width: 40rem;
          margin: 0;
          font: 450 clamp(0.95rem, 1.2vw, 1.15rem)/1.5 var(--font-body, sans-serif);
          color: rgba(255, 248, 232, 0.86);
          text-wrap: pretty;
        }

        .landing-hero__actions {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          gap: 1rem;
          margin-top: 0.8rem;
        }

        .landing-hero__enter-btn {
          min-height: 56px;
          padding: 0.9rem 2.2rem;
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
          min-height: 56px;
          padding: 0.9rem 1.8rem;
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

        @keyframes trailFade {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(0.5);
          }
          10% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.9);
          }
        }

        @media (max-width: 768px) {
          .landing-interactive-hero {
            min-height: 85vh;
            padding: 3rem 1.25rem;
          }

          .landing-hero__heading {
            font-size: clamp(2.4rem, 10vw, 3.6rem);
          }

          .landing-hero__statement {
            font-size: 1.15rem;
          }

          .landing-hero__lede {
            font-size: 0.95rem;
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
