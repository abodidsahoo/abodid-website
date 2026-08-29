import React, { useState, useEffect, useRef } from 'react';
import { vaultTags as fallbackVaultTags } from '../utils/tags';

// Vivid palette popping against the blue background (pink, yellow, cream, lime)
const TAG_COLOR_THEMES = [
  { bg: 'var(--pop-pink, #f78bb1)', color: 'var(--pop-ink, #17150f)', border: 'rgba(23, 21, 15, 0.35)' },
  { bg: 'var(--pop-pink, #f78bb1)', color: 'var(--pop-ink, #17150f)', border: 'rgba(23, 21, 15, 0.35)' },
  { bg: 'var(--pop-yellow, #f6e05e)', color: 'var(--pop-ink, #17150f)', border: 'rgba(23, 21, 15, 0.35)' },
  { bg: 'var(--pop-cream, #fdfbf7)', color: 'var(--pop-ink, #17150f)', border: 'rgba(23, 21, 15, 0.3)' },
  { bg: 'var(--pop-lime, #d4f738)', color: 'var(--pop-ink, #17150f)', border: 'rgba(23, 21, 15, 0.35)' },
  { bg: 'var(--pop-pink, #f78bb1)', color: 'var(--pop-ink, #17150f)', border: 'rgba(23, 21, 15, 0.35)' },
];

function OdometerNumber({ value }) {
  const digits = String(value).split('');
  return (
    <span className="hero-vault-tags-card__odometer" aria-label={`${value}+ tags`}>
      <span className="odometer-digits">
        {digits.map((digit, i) => {
          const num = parseInt(digit, 10);
          return (
            <span key={i} className="odometer-slot">
              <span
                className="odometer-strip"
                style={{ transform: `translateY(-${isNaN(num) ? 0 : num * 10}%)` }}
              >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <span key={n}>{n}</span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
      <span className="odometer-suffix">+ tags</span>
    </span>
  );
}

export default function HeroVaultTagsCard({
  heading = "A glimpse into my second brain.",
  cta = "Move cursor to surface vault tags ↗",
  href = "/research/obsidian-vault",
}) {
  const [activeTags, setActiveTags] = useState([]);
  const [tags, setTags] = useState(fallbackVaultTags);
  const [tagCount, setTagCount] = useState(() => {
    // Start randomly between 572 and 596
    return Math.floor(Math.random() * (596 - 572 + 1)) + 572;
  });

  const containerRef = useRef(null);
  const activeTagsRef = useRef([]);
  const lastSpawnPosition = useRef({ x: -999, y: -999 });
  const tagIdCounter = useRef(0);
  const tagsRef = useRef(fallbackVaultTags);

  // Exact lightweight physics matching visual-tag-cloud
  const CHECK_INTERVAL = 15;
  const MIN_SPACING = 65;
  const MAX_TAGS = 16;
  const FADE_DURATION = 1500;
  const EDGE_PADDING_X = 48;
  const EDGE_PADDING_Y = 32;

  const formattedDate = (() => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  })();

  useEffect(() => {
    let isMounted = true;
    const fetchTags = async () => {
      try {
        const res = await fetch('/api/vault-tags.json');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0 && isMounted) {
            setTags(data);
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
    // Wait a few seconds on initial landing before the first subtle roll
    const timer1 = setTimeout(() => {
      setTagCount((prev) => Math.min(620, prev + 1));
    }, 5500);

    const timer2 = setTimeout(() => {
      setTagCount((prev) => Math.min(620, prev + 1));
    }, 13500);

    const timer3 = setTimeout(() => {
      setTagCount((prev) => Math.min(620, prev + 1));
    }, 24000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
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

      // Keep tags neatly positioned inside the card bounds
      const minX = Math.min(EDGE_PADDING_X, rect.width * 0.2);
      const maxX = Math.max(minX + 20, rect.width - EDGE_PADDING_X);
      const minY = Math.min(EDGE_PADDING_Y, rect.height * 0.16);
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

  return (
    <a
      ref={containerRef}
      href={href}
      className="hero-vault-tags-card story-hero__future-card"
      data-auto-contrast
      aria-label="Obsidian Vault Interactive Explorer"
    >
      <div className="hero-vault-tags-card__backdrop" aria-hidden="true">
        {activeTags.map((tag) => (
          <div
            key={tag.id}
            className="hero-floating-tag"
            style={{
              position: 'absolute',
              left: `${tag.x}px`,
              top: `${tag.y}px`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <span
              className="hero-tag-content"
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

      <div className="hero-vault-tags-card__content">
        <div className="hero-vault-tags-card__top">
          <h2 className="hero-vault-tags-card__heading">{heading}</h2>
          <span className="hero-vault-tags-card__cta">{cta}</span>
        </div>

        <div className="hero-vault-tags-card__bottom">
          <OdometerNumber value={tagCount} />
          <div className="hero-vault-tags-card__sync-status">
            <span className="hero-vault-tags-card__live-dot" aria-hidden="true" />
            <span className="hero-vault-tags-card__sync-text">
              live sync <span className="hero-vault-tags-card__sync-sep">//</span> {formattedDate}
            </span>
          </div>
        </div>
      </div>

      <style>{`
        .hero-vault-tags-card {
          position: relative;
          min-height: 0;
          height: 100%;
          padding: clamp(1.4rem, 2.6vw, 2.6rem);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 2rem;
          overflow: hidden;
          border: var(--home-next-border, 1px solid var(--pop-ink, #17150f));
          border-radius: var(--home-next-radius-panel, 18px);
          background: var(--pop-blue, #2442e3);
          color: var(--pop-cream, #fdfbf7);
          text-decoration: none;
          cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32' fill='none'%3E%3Cline x1='8' y1='8' x2='26' y2='26' stroke='%23fdfbf7' stroke-width='4.5' stroke-linecap='round'/%3E%3Cline x1='8' y1='8' x2='16' y2='16' stroke='%23f78bb1' stroke-width='2.5' stroke-linecap='round'/%3E%3Cline x1='16' y1='16' x2='26' y2='26' stroke='%2317150f' stroke-width='2.5' stroke-linecap='round'/%3E%3Cpath d='M5 0L6.5 3.5L10 5L6.5 6.5L5 10L3.5 6.5L0 5L3.5 3.5Z' fill='%23fdfbf7' stroke='%2317150f' stroke-width='0.8'/%3E%3Ccircle cx='5' cy='5' r='1.2' fill='%23f6e05e'/%3E%3Cpath d='M13 1L14 3.2L16.2 4.2L14 5.2L13 7.5L12 5.2L9.8 4.2L12 3.2Z' fill='%23f6e05e'/%3E%3Cpath d='M2 12L3 14.2L5.2 15.2L3 16.2L2 18.5L1 16.2L-1.2 15.2L1 14.2Z' fill='%23f78bb1'/%3E%3C/svg%3E") 4 4, crosshair;
          user-select: none;
          isolation: isolate;
        }

        .hero-vault-tags-card__backdrop {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 5;
          overflow: hidden;
        }

        .hero-floating-tag {
          pointer-events: none;
          z-index: 10;
          animation: trailFade 1.5s ease-out forwards;
          will-change: transform, opacity;
        }

        .hero-tag-content {
          display: inline-block;
          padding: 4px 10px;
          border: 1px solid rgba(23, 21, 15, 0.3);
          border-radius: 999px;
          font-family: var(--font-display, sans-serif);
          font-size: 0.8rem;
          font-weight: 500;
          letter-spacing: -0.01em;
          white-space: nowrap;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1);
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

        .hero-vault-tags-card__content {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 100%;
          gap: 1.5rem;
          pointer-events: none;
        }

        .hero-vault-tags-card__top {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }

        .hero-vault-tags-card__heading {
          max-width: 14ch;
          margin: 0;
          color: var(--pop-cream, #fdfbf7);
          font: 620 clamp(1.85rem, 2.9vw, 3.1rem)/0.94 var(--font-display, sans-serif);
          letter-spacing: -0.045em;
          text-wrap: balance;
        }

        .hero-vault-tags-card__cta {
          max-width: 32ch;
          display: block;
          color: var(--pop-cream, #fdfbf7);
          font: 650 0.72rem/1.45 var(--font-mono, monospace);
          letter-spacing: 0.04em;
          text-transform: uppercase;
          opacity: 0.88;
        }

        .hero-vault-tags-card__bottom {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          text-align: right;
          gap: 0.35rem;
          align-self: flex-end;
        }

        .hero-vault-tags-card__odometer {
          display: inline-flex;
          align-items: baseline;
          color: var(--pop-cream, #fdfbf7);
          font: 800 clamp(1.75rem, 3.2vw, 2.5rem)/1 var(--font-mono, monospace);
          letter-spacing: -0.03em;
          text-transform: uppercase;
          line-height: 1;
        }

        .odometer-digits {
          display: inline-flex;
          align-items: baseline;
          height: 1.05em;
          overflow: hidden;
        }

        .odometer-slot {
          display: inline-block;
          height: 1.05em;
          line-height: 1.05em;
          overflow: hidden;
          position: relative;
        }

        .odometer-strip {
          display: flex;
          flex-direction: column;
          transition: transform 650ms cubic-bezier(0.16, 1, 0.3, 1);
          will-change: transform;
        }

        .odometer-strip span {
          display: inline-block;
          height: 1.05em;
          line-height: 1.05em;
          text-align: center;
        }

        .odometer-suffix {
          margin-left: 0.25rem;
          line-height: 1.05em;
        }

        .hero-vault-tags-card__sync-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: var(--pop-cream, #fdfbf7);
          font-family: "Courier New", Courier, "SF Mono", monospace !important;
          font-size: 0.6rem !important;
          font-weight: 700 !important;
          letter-spacing: 0.03em !important;
          opacity: 0.9;
        }

        .hero-vault-tags-card__sync-sep {
          opacity: 0.45;
          margin: 0 1px;
        }

        .hero-vault-tags-card__live-dot {
          position: relative;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #34d399;
          box-shadow: 0 0 6px #10b981;
          animation: liveRadarPulse 2s ease-in-out infinite;
        }

        .hero-vault-tags-card__live-dot::after {
          content: "";
          position: absolute;
          inset: -2px;
          border-radius: 50%;
          border: 1px solid rgba(52, 211, 153, 0.6);
          animation: liveRingExpand 2s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
        }

        @keyframes liveRadarPulse {
          0%, 100% {
            background: #10b981;
            box-shadow: 0 0 5px #34d399;
          }
          50% {
            background: #34d399;
            box-shadow: 0 0 12px #6ee7b7;
          }
        }

        @keyframes liveRingExpand {
          0% {
            transform: scale(0.6);
            opacity: 0.9;
          }
          100% {
            transform: scale(2.2);
            opacity: 0;
          }
        }
      `}</style>
    </a>
  );
}
