import { useEffect, useState } from "react";
import { verticesToSmoothSvgPath } from "../../lib/punctum/geometry";
import PunctumWorldModal from "./PunctumWorldModal";

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

export default function PunctumResultsBrowser({ fallbackImages }) {
  const [mounted, setMounted] = useState(false);
  const [images, setImages] = useState(
    fallbackImages.map((image) => ({ ...image, responseCount: 0 })),
  );
  const [loading, setLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionMarkings, setSessionMarkings] = useState([]);
  const [showCollectiveMap, setShowCollectiveMap] = useState(false);
  const [worldEntry, setWorldEntry] = useState(null);

  const sortMarkings = (list) => {
    if (!Array.isArray(list)) return [];
    const imageOrder = new Map(fallbackImages.map((img, idx) => [img.id, idx]));
    return [...list].sort((a, b) => {
      const orderA = imageOrder.get(a.imageId) ?? 999;
      const orderB = imageOrder.get(b.imageId) ?? 999;
      return orderA - orderB;
    });
  };

  useEffect(() => {
    setMounted(true);
    let active = true;
    let hasStoredMarkings = false;
    try {
      const raw = sessionStorage.getItem("punctum-session-markings");
      if (raw) {
        const parsed = JSON.parse(raw);
        const list = Object.values(parsed).filter(
          (item) => item && item.vertices && item.vertices.length >= 3,
        );
        if (list.length > 0 && active) {
          hasStoredMarkings = true;
          setSessionMarkings(sortMarkings(list));
        }
      }
    } catch {
      // The session API below remains the source of truth.
    }

    const sessionId =
      new URLSearchParams(window.location.search).get("session") ||
      sessionStorage.getItem("punctum-session-id") ||
      "";
    if (sessionId) {
      fetch(`/api/punctum/session?id=${encodeURIComponent(sessionId)}`)
        .then(async (response) => {
          if (!response.ok) throw new Error("Session unavailable");
          return response.json();
        })
        .then((payload) => {
          if (!active || !Array.isArray(payload.markings)) return;
          if (payload.markings.length > 0) {
            setSessionMarkings(sortMarkings(payload.markings));
            setShowCollectiveMap(false);
          } else if (!hasStoredMarkings) {
            setShowCollectiveMap(true);
          }
        })
        .catch(() => {
          if (active && !hasStoredMarkings) setShowCollectiveMap(true);
        })
        .finally(() => {
          if (active) setSessionLoading(false);
        });
    } else {
      setSessionLoading(false);
      if (!hasStoredMarkings) setShowCollectiveMap(true);
    }

    fetch("/api/punctum/results")
      .then(async (response) => {
        if (!response.ok) throw new Error("Results unavailable");
        return response.json();
      })
      .then((payload) => {
        if (active && Array.isArray(payload.images)) setImages(payload.images);
      })
      .catch(() => {
        // Fallback gallery remains available
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const reimagineMark = (item) => {
    const source = {
      imageUrl: item.imageUrl,
      polygon: item.vertices,
      explanation: item.annotation,
      width: item.width,
      height: item.height,
    };

    setWorldEntry({
      mode: "generate",
      source,
      request: {
        source,
        body: {
          requestId: crypto.randomUUID(),
          accessToken: crypto.randomUUID(),
          responseId: item.responseId,
        },
      },
    });
  };

  return (
    <section className="punctum-results-wrapper">
      {!showCollectiveMap ? (
        <div className="punctum-session-results">
          <div className="punctum-session-results__header">
            <div>
              <h2>Your punctums are marked now.</h2>
              <p>Reimagine them in a new world now with a different context.</p>
            </div>
            <button
              type="button"
              className="punctum-button punctum-button--light punctum-session-results__toggle"
              onClick={() => setShowCollectiveMap(true)}
            >
              See punctum markings by others for all images →
            </button>
          </div>

          {!mounted || sessionLoading ? (
            <div className="punctum-session-inline-loading" role="status">
              <p>Loading images…</p>
            </div>
          ) : sessionMarkings.length > 0 ? (
            <div className="punctum-session-results__list">
              {sessionMarkings.map((item) => (
                <article key={item.imageId} className="punctum-session-card">
                  <div
                    className="punctum-session-card__left"
                    style={{ aspectRatio: `${item.width} / ${item.height}` }}
                  >
                    <img src={item.imageUrl} alt={item.imageTitle} />
                    <PolygonOutline vertices={item.vertices} />
                  </div>
                  <div className="punctum-session-card__right">
                    <div className="punctum-session-card__actions">
                      <button
                        type="button"
                        className="punctum-button punctum-button--yellow"
                        onClick={() => reimagineMark(item)}
                      >
                        <span aria-hidden="true">✦</span> Reimagine Your Punctum
                      </button>
                      <a
                        className="punctum-button punctum-button--light"
                        href={`/research/punctum/results/${item.imageSlug}`}
                      >
                        See what others noticed
                      </a>
                    </div>
                    {item.annotation ? (
                      <blockquote
                        className={`punctum-session-card__note ${
                          item.annotation.length < 40
                            ? "is-short"
                            : item.annotation.length < 100
                              ? "is-medium"
                              : "is-long"
                        }`}
                      >
                        <span className="punctum-session-card__big-quote" aria-hidden="true">“</span>
                        <p>{item.annotation}</p>
                      </blockquote>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="punctum-session-inline-loading">
              <p>No punctums marked yet.</p>
            </div>
          )}
        </div>
      ) : (
        <>
          {sessionMarkings.length > 0 && (
            <div className="punctum-session-banner">
              <button
                type="button"
                className="punctum-button punctum-button--light"
                onClick={() => setShowCollectiveMap(false)}
              >
                ← View your session markings
              </button>
            </div>
          )}
          <section className="punctum-gallery" aria-busy={loading}>
            {images.map((image) => (
              <a
                className="punctum-gallery-card"
                href={`/research/punctum/results/${image.slug}`}
                key={image.id}
                aria-label={`View ${image.responseCount} ${
                  image.responseCount === 1 ? "mark" : "marks"
                } on ${image.title}`}
              >
                <div
                  className="punctum-gallery-card__image"
                  style={{ "--card-background": image.softBackground }}
                >
                  <img
                    src={image.url}
                    alt={image.title}
                    width={image.width}
                    height={image.height}
                    loading="lazy"
                  />
                  <span className="punctum-gallery-card__count">
                    <strong>{image.responseCount}</strong>
                    <span>{image.responseCount === 1 ? "mark" : "marks"}</span>
                  </span>
                </div>
              </a>
            ))}
          </section>
        </>
      )}

      {worldEntry && (
        <PunctumWorldModal
          entry={worldEntry}
          onClose={() => setWorldEntry(null)}
        />
      )}
    </section>
  );
}
