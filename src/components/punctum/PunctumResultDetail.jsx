import { useEffect, useMemo, useRef, useState } from "react";
import { createIllustrativePolygons } from "../../lib/punctum/demo";
import { verticesToSmoothSvgPath } from "../../lib/punctum/geometry";
import PunctumFeedbackModal from "./PunctumFeedbackModal";
import PunctumWorldModal from "./PunctumWorldModal";

const AGE_LABELS = {
  "18-24": "18–24",
  "25-34": "25–34",
  "35-44": "35–44",
  "45-54": "45–54",
  "55-64": "55–64",
  "65+": "65+",
};

const GENDER_LABELS = {
  woman: "Women",
  man: "Men",
  non_binary: "Non-binary people",
  self_described: "Self-described",
};

function PolygonLayer({
  polygons,
  committed = false,
  selectedId = "",
  onSelect,
}) {
  const interactive = typeof onSelect === "function";

  return (
    <svg
      className={`punctum-polygon-layer ${committed ? "is-committed" : ""}`}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden={interactive ? undefined : "true"}
      aria-label={interactive ? "Individual attention marks" : undefined}
    >
      {polygons.map((polygon, index) => (
        <g
          className="punctum-result-mark"
          key={polygon.id}
          style={{ "--polygon-index": index }}
        >
          <path
            className="punctum-selection-halo punctum-selection-halo--outer"
            d={verticesToSmoothSvgPath(polygon.vertices)}
            vectorEffect="non-scaling-stroke"
          />
          <path
            className="punctum-selection-halo punctum-selection-halo--inner"
            d={verticesToSmoothSvgPath(polygon.vertices)}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={verticesToSmoothSvgPath(polygon.vertices)}
            vectorEffect="non-scaling-stroke"
            className={`punctum-organic-mark ${
              interactive ? "is-interactive" : ""
            } ${selectedId === polygon.id ? "is-selected" : ""}`}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={
              interactive
                ? `Mark ${index + 1}${polygon.annotation ? ", has an anonymous note" : ""}`
                : undefined
            }
            onClick={interactive ? () => onSelect(polygon) : undefined}
            onKeyDown={
              interactive
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(polygon);
                    }
                  }
                : undefined
            }
          >
            {interactive && <title>Open mark {index + 1}</title>}
          </path>
        </g>
      ))}
    </svg>
  );
}

function FilterSelect({ label, value, options, onChange, labels = {} }) {
  return (
    <label className="punctum-filter">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Everyone</option>
        {options.map((option) => (
          <option value={option.value} key={option.value}>
            {labels[option.value] || option.value} · {option.count}
          </option>
        ))}
      </select>
    </label>
  );
}

function IndividualPunctumGrid({
  image,
  polygons,
  selectedId,
  onSelect,
  onCreateWorld,
  openWorldsId,
  onToggleWorlds,
  onViewWorld,
}) {
  return (
    <section
      className="punctum-individual-grid"
      aria-label="Individual punctums"
    >
      {polygons.map((polygon, index) => {
        const generations = polygon.generations || [];
        const worldsOpen =
          generations.length > 0 && openWorldsId === polygon.id;
        const drawerId = `punctum-worlds-${polygon.id}`;

        return (
          <article
            className={`punctum-response-card ${
              selectedId === polygon.id ? "is-selected" : ""
            } ${worldsOpen ? "is-worlds-open" : ""}`}
            style={{
              "--punctum-card-delay": `${Math.min(index, 16) * 65}ms`,
            }}
            key={polygon.id}
          >
            <button
              type="button"
              className="punctum-response-card__visual"
              style={{ aspectRatio: `${image.width} / ${image.height}` }}
              onClick={() => onSelect(polygon)}
              aria-label={`Select individual punctum ${index + 1}`}
              aria-pressed={selectedId === polygon.id}
            >
              <img src={image.url} alt="" loading="lazy" />
              <PolygonLayer
                polygons={[polygon]}
                committed
                selectedId={selectedId}
              />
            </button>

            <span className="punctum-response-card__mark">
              Punctum {String(index + 1).padStart(2, "0")}
            </span>

            <div className="punctum-response-card__content">
              <blockquote
                className={`punctum-response-card__quote ${
                  polygon.annotation ? "has-comment" : "is-empty"
                }`}
              >
                <p>{polygon.annotation || "No written note."}</p>
              </blockquote>

              <div className="punctum-response-card__actions">
                <button
                  className="punctum-response-card__generate"
                  type="button"
                  onClick={() => onCreateWorld(polygon)}
                >
                  <span aria-hidden="true">✦</span>
                  Generate a World
                </button>
                {generations.length > 0 && (
                  <button
                    className="punctum-response-card__worlds-toggle"
                    type="button"
                    aria-expanded={worldsOpen}
                    aria-controls={drawerId}
                    onClick={() => onToggleWorlds(polygon.id)}
                  >
                    Generated Worlds
                    <span>{generations.length}</span>
                    <i aria-hidden="true">⌄</i>
                  </button>
                )}
              </div>
            </div>

            {worldsOpen && (
              <div
                className="punctum-response-card__worlds-drawer"
                id={drawerId}
                aria-label="Generated AI world lineage"
              >
                <div className="punctum-response-card__worlds">
                  {generations.map((generation, generationIndex) => (
                    <button
                      type="button"
                      onClick={() => onViewWorld(generation)}
                      key={generation.id}
                      aria-label={`Open generated world ${generationIndex + 1}`}
                    >
                      <img
                        src={generation.generatedImageUrl}
                        alt=""
                        loading="lazy"
                      />
                      <span>
                        {generation.parentGenerationId
                          ? `World ${generationIndex + 1} · continued`
                          : `World ${generationIndex + 1}`}
                      </span>
                      {generation.postGenerationPolygon && (
                        <PolygonLayer
                          polygons={[
                            {
                              id: `${generation.id}-new-punctum`,
                              vertices: generation.postGenerationPolygon,
                            },
                          ]}
                          committed
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}

export default function PunctumResultDetail({ image }) {
  const [mode, setMode] = useState("constellation");
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    age: "",
    gender: "",
    country: "",
  });
  const [selectedId, setSelectedId] = useState("");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSessionId, setFeedbackSessionId] = useState("");
  const [worldEntry, setWorldEntry] = useState(null);
  const [openWorldsId, setOpenWorldsId] = useState("");
  const endPanelRef = useRef(null);

  useEffect(() => {
    setFeedbackSessionId(sessionStorage.getItem("punctum-session-id") || "");
    const element = endPanelRef.current;
    if (!element || sessionStorage.getItem("punctum-feedback-popup-seen")) {
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        sessionStorage.setItem("punctum-feedback-popup-seen", "1");
        setFeedbackOpen(true);
        observer.disconnect();
      },
      { threshold: 0.65 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ image: image.slug });
    if (filters.age) params.set("age", filters.age);
    if (filters.gender) params.set("gender", filters.gender);
    if (filters.country) params.set("country", filters.country);
    setLoading(true);
    fetch(`/api/punctum/results?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Results unavailable");
        return result;
      })
      .then(setPayload)
      .catch((requestError) => {
        if (requestError.name !== "AbortError") {
          setPayload({
            polygons: [],
            responseCount: 0,
            totalResponseCount: 0,
            suppressed: false,
            minimumCohortSize: 10,
            availableFilters: { age: [], gender: [], country: [] },
          });
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [image.slug, filters]);

  const livePolygons = payload?.polygons || [];
  const isIllustrative =
    !loading && !payload?.suppressed && livePolygons.length === 0;
  const polygons = useMemo(
    () =>
      isIllustrative
        ? createIllustrativePolygons(image.id, 22)
        : livePolygons,
    [image.id, isIllustrative, livePolygons],
  );
  const available = payload?.availableFilters || {
    age: [],
    gender: [],
    country: [],
  };
  const hasAvailableFilters =
    available.age.length > 0 ||
    available.gender.length > 0 ||
    available.country.length > 0;
  const selectedPolygon =
    polygons.find((polygon) => polygon.id === selectedId) || null;
  const selectPolygon = (polygon) => {
    setSelectedId((current) => (current === polygon.id ? "" : polygon.id));
  };
  const setFilter = (key, value) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const createWorld = (polygon) => {
    const requestId = crypto.randomUUID();
    const accessToken = crypto.randomUUID();
    setWorldEntry({
      mode: "generate",
      source: {
        imageUrl: image.url,
        polygon: polygon.vertices,
        explanation:
          polygon.annotation || "No written explanation was added to this punctum.",
        width: image.width,
        height: image.height,
      },
      request: {
        source: {
          imageUrl: image.url,
          polygon: polygon.vertices,
          explanation:
            polygon.annotation || "No written explanation was added to this punctum.",
          width: image.width,
          height: image.height,
        },
        body: {
          requestId,
          accessToken,
          responseId: polygon.id,
        },
      },
    });
  };
  const viewWorld = (generation) => {
    setWorldEntry({
      mode: "view",
      generation,
      source: {
        imageUrl: generation.sourceImageUrl,
        polygon: generation.sourcePolygonNormalized,
        explanation: generation.viewerExplanation,
        width: generation.sourceWidth,
        height: generation.sourceHeight,
      },
    });
  };
  const attachGeneration = (generation) => {
    setPayload((current) => {
      if (!current?.polygons) return current;
      return {
        ...current,
        polygons: current.polygons.map((polygon) =>
          polygon.id === generation.sourceResponseId
            ? {
                ...polygon,
                generations: [
                  ...(polygon.generations || []).filter(
                    (item) => item.id !== generation.id,
                  ),
                  generation,
                ],
              }
            : polygon,
        ),
      };
    });
  };

  return (
    <main
      className={`punctum-result ${
        mode === "individual" ? "is-individual" : ""
      }`}
    >
      <header className="punctum-result__header">
        <div className="punctum-result__heading">
          <a className="punctum-result__back" href="/research/punctum/results">
            ← All results
          </a>
          <h1>Where attention gathered</h1>
        </div>
        <div className="punctum-result__summary" aria-live="polite">
          <strong>
            {isIllustrative ? "Preview" : payload?.responseCount || 0}
          </strong>
          <span>
            {isIllustrative
              ? "illustrative marks"
              : `${payload?.responseCount === 1 ? "confirmed mark" : "confirmed marks"}`}
          </span>
        </div>
      </header>

      <section
        className={`punctum-result__workspace ${
          !hasAvailableFilters || mode === "individual" ? "is-unfiltered" : ""
        }`}
      >
        <div
          className="punctum-result__visual"
          style={{ "--result-ratio": image.width / image.height }}
        >
          <div className="punctum-result__controls">
            <div className="punctum-result__modes" role="tablist" aria-label="Result view">
              {[
                ["constellation", "Constellation"],
                ["individual", "Individual punctums"],
              ].map(([value, label]) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === value}
                  className={mode === value ? "is-active" : ""}
                  onClick={() => setMode(value)}
                  key={value}
                >
                  {label}
                </button>
              ))}
            </div>
            <a
              className="punctum-result__add"
              href="/research/punctum/experiment"
            >
              Add your punctum
            </a>
          </div>

          {mode === "constellation" ? (
            <div
              className="punctum-result-stage"
              style={{
                "--result-background": image.softBackground,
                aspectRatio: `${image.width} / ${image.height}`,
              }}
            >
              <img
                src={image.url}
                alt={image.title}
                width={image.width}
                height={image.height}
              />
              <PolygonLayer
                polygons={polygons}
                selectedId={selectedId}
                onSelect={isIllustrative ? undefined : selectPolygon}
              />
              {selectedPolygon && (
                <aside className="punctum-result-note" aria-live="polite">
                  <button
                    type="button"
                    aria-label="Close note"
                    onClick={() => setSelectedId("")}
                  >
                    ×
                  </button>
                  <span>Anonymous note</span>
                  <p>{selectedPolygon.annotation || "No note was added."}</p>
                </aside>
              )}
              {loading && (
                <div className="punctum-result-stage__loading">
                  Gathering marks…
                </div>
              )}
            </div>
          ) : loading ? (
            <div className="punctum-individual-loading" role="status">
              Gathering individual punctums…
            </div>
          ) : (
            <IndividualPunctumGrid
              image={image}
              polygons={polygons}
              selectedId={selectedId}
              onSelect={selectPolygon}
              onCreateWorld={createWorld}
              openWorldsId={openWorldsId}
              onToggleWorlds={(polygonId) =>
                setOpenWorldsId((current) =>
                  current === polygonId ? "" : polygonId,
                )
              }
              onViewWorld={viewWorld}
            />
          )}
        </div>

        {hasAvailableFilters && mode === "constellation" && (
          <aside className="punctum-result__filters">
            <h2>Compare</h2>
            <div className="punctum-result__filter-grid">
              <FilterSelect
                label="Age"
                value={filters.age}
                options={available.age}
                labels={AGE_LABELS}
                onChange={(value) => setFilter("age", value)}
              />
              <FilterSelect
                label="Gender"
                value={filters.gender}
                options={available.gender}
                labels={GENDER_LABELS}
                onChange={(value) => setFilter("gender", value)}
              />
              <FilterSelect
                label="Country"
                value={filters.country}
                options={available.country}
                onChange={(value) => setFilter("country", value)}
              />
            </div>
            {payload?.suppressed && (
              <div className="punctum-result__notice" role="status">
                Fewer than {payload.minimumCohortSize} responses.
              </div>
            )}
          </aside>
        )}
      </section>

      <section className="punctum-result-end" ref={endPanelRef}>
        <div>
          <p className="punctum-eyebrow">Another look?</p>
          <h2>Play this again?</h2>
        </div>
        <div className="punctum-result-end__actions">
          <a
            className="punctum-button punctum-button--yellow"
            href="/research/punctum/experiment"
          >
            Play this again
          </a>
          <button
            className="punctum-button punctum-button--light"
            type="button"
            onClick={() => setFeedbackOpen(true)}
          >
            Maybe share with a friend
          </button>
        </div>
      </section>

      <PunctumFeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        sessionId={feedbackSessionId}
        sharePath={`/research/punctum/results/${image.slug}`}
      />
      {worldEntry && (
        <PunctumWorldModal
          entry={worldEntry}
          onClose={() => setWorldEntry(null)}
          onGenerationCompleted={attachGeneration}
        />
      )}
    </main>
  );
}
