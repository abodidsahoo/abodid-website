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

function ToggleArrow() {
  return (
    <span className="punctum-response-card__toggle-arrow" aria-hidden="true">
      <svg viewBox="0 0 16 16" focusable="false">
        <path d="M3.75 6.25 8 10l4.25-3.75" />
      </svg>
    </span>
  );
}

function ViewModeIcon({ type }) {
  if (type === "grid") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <rect x="2.25" y="2.25" width="4.5" height="4.5" rx="0.8" />
        <rect x="9.25" y="2.25" width="4.5" height="4.5" rx="0.8" />
        <rect x="2.25" y="9.25" width="4.5" height="4.5" rx="0.8" />
        <rect x="9.25" y="9.25" width="4.5" height="4.5" rx="0.8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect x="2.25" y="2.75" width="11.5" height="10.5" rx="1.4" />
      <path d="M5 5.75h6M5 8h6M5 10.25h3.5" />
    </svg>
  );
}

function GenerationThumbnail({ generation, index, onViewWorld }) {
  return (
    <button
      type="button"
      onClick={() => onViewWorld(generation)}
      aria-label={`Open generated world ${index + 1}`}
    >
      <img src={generation.generatedImageUrl} alt="" loading="lazy" />
      <span>
        {generation.parentGenerationId
          ? `World ${index + 1} · continued`
          : `World ${index + 1}`}
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
  const [openCommentId, setOpenCommentId] = useState("");

  return (
    <section
      className="punctum-individual-grid"
      aria-label="Individual punctums"
    >
      {polygons.map((polygon, index) => {
        const generations = polygon.generations || [];
        const worldsOpen =
          generations.length > 0 && openWorldsId === polygon.id;
        const commentOpen = openCommentId === polygon.id;
        const drawerId = `punctum-worlds-${polygon.id}`;
        const commentId = `punctum-comment-${polygon.id}`;

        return (
          <article
            className={`punctum-response-card ${
              selectedId === polygon.id ? "is-selected" : ""
            } ${worldsOpen ? "is-worlds-open" : ""} ${
              commentOpen ? "is-comment-open" : ""
            }`}
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
              <div className="punctum-response-card__actions">
                <button
                  className="punctum-response-card__generate"
                  type="button"
                  onClick={() => onCreateWorld(polygon)}
                >
                  <span aria-hidden="true">✦</span>
                  Reimagine Punctum
                </button>
                <button
                  className="punctum-response-card__worlds-toggle"
                  type="button"
                  aria-expanded={worldsOpen}
                  aria-controls={generations.length > 0 ? drawerId : undefined}
                  aria-label={
                    generations.length > 0
                      ? `${worldsOpen ? "Hide" : "See"} ${generations.length} generated ${
                          generations.length === 1 ? "world" : "worlds"
                        }`
                      : "No generated world yet"
                  }
                  disabled={generations.length === 0}
                  title={
                    generations.length === 0
                      ? "No generated world yet"
                      : undefined
                  }
                  onClick={() => onToggleWorlds(polygon.id)}
                >
                  <span className="punctum-response-card__action-label">
                    {generations.length > 0
                      ? "See Generated World"
                      : "No worlds generated yet"}
                  </span>
                  {generations.length > 0 && (
                    <span className="punctum-response-card__count">
                      {generations.length}
                    </span>
                  )}
                  {generations.length > 0 && <ToggleArrow />}
                </button>
                <button
                  className="punctum-response-card__comment-toggle"
                  type="button"
                  aria-expanded={commentOpen}
                  aria-controls={polygon.annotation ? commentId : undefined}
                  aria-label={
                    polygon.annotation
                      ? `${commentOpen ? "Hide" : "Show"} comment`
                      : "No comment added"
                  }
                  disabled={!polygon.annotation}
                  title={
                    polygon.annotation ? undefined : "No comment was added"
                  }
                  onClick={() =>
                    setOpenCommentId((current) =>
                      current === polygon.id ? "" : polygon.id,
                    )
                  }
                >
                  <span className="punctum-response-card__action-label">
                    {polygon.annotation
                      ? commentOpen
                        ? "Hide Comment"
                        : "Show Comment"
                      : "No Comment Added"}
                  </span>
                  {polygon.annotation && (
                    <span className="punctum-response-card__count">1</span>
                  )}
                  {polygon.annotation && <ToggleArrow />}
                </button>
              </div>
            </div>

            {commentOpen && polygon.annotation && (
              <div
                className="punctum-response-card__comment-drawer"
                id={commentId}
              >
                <blockquote className="punctum-response-card__quote has-comment">
                  <p>{polygon.annotation}</p>
                </blockquote>
              </div>
            )}

            {worldsOpen && (
              <div
                className="punctum-response-card__worlds-drawer"
                id={drawerId}
                aria-label="Generated AI world lineage"
              >
                <div className="punctum-response-card__worlds">
                  {generations.map((generation, generationIndex) => (
                    <GenerationThumbnail
                      key={generation.id}
                      generation={generation}
                      index={generationIndex}
                      onViewWorld={onViewWorld}
                    />
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

function SingularPunctumView({
  image,
  polygon,
  index,
  total,
  onCreateWorld,
  onViewWorld,
}) {
  const [showAllWorlds, setShowAllWorlds] = useState(false);

  useEffect(() => {
    setShowAllWorlds(false);
  }, [polygon?.id]);

  if (!polygon) {
    return (
      <div className="punctum-singular-empty" role="status">
        No individual punctum is available in this view.
      </div>
    );
  }

  const generations = polygon.generations || [];
  const visibleGenerations = showAllWorlds
    ? generations
    : generations.slice(0, 4);
  const hiddenWorldCount = Math.max(0, generations.length - 4);
  const hasComment = Boolean(polygon.annotation);

  return (
    <section
      className="punctum-singular-view"
      aria-label={`Punctum ${index + 1} of ${total}`}
    >
      <article className="punctum-singular-view__main">
        <figure
          className="punctum-singular-view__figure"
          style={{ aspectRatio: `${image.width} / ${image.height}` }}
        >
          <img
            src={image.url}
            alt={`${image.title}, showing punctum ${index + 1}`}
            width={image.width}
            height={image.height}
          />
          <PolygonLayer polygons={[polygon]} committed />
          <figcaption
            className="punctum-singular-view__counter"
            aria-label={`Punctum ${index + 1} of ${total}`}
          >
            {index + 1}/{total}
          </figcaption>
        </figure>

        <button
          className="punctum-singular-view__reimagine"
          type="button"
          onClick={() => onCreateWorld(polygon)}
        >
          <span aria-hidden="true">✦</span>
          Reimagine Punctum
        </button>

        <blockquote
          className={`punctum-singular-view__quote ${
            hasComment ? "has-comment" : "is-empty"
          }`}
        >
          <p>
            {polygon.annotation || "No comment was added to this punctum."}
          </p>
        </blockquote>
      </article>

      <aside className="punctum-singular-view__worlds">
        <header>
          <span>Generated worlds</span>
          <strong aria-label={`${generations.length} generated worlds`}>
            {generations.length}
          </strong>
        </header>

        {generations.length > 0 ? (
          <div
            className={`punctum-singular-view__world-grid ${
              visibleGenerations.length > 4
                ? "has-many"
                : `has-${visibleGenerations.length}`
            }`}
          >
            {visibleGenerations.map((generation, generationIndex) => (
              <GenerationThumbnail
                key={generation.id}
                generation={generation}
                index={generationIndex}
                onViewWorld={onViewWorld}
              />
            ))}
          </div>
        ) : (
          <div className="punctum-singular-view__worlds-empty">
            <span aria-hidden="true">✦</span>
            <p>No generated worlds yet.</p>
            <small>Reimagine this punctum to begin one.</small>
          </div>
        )}

        {hiddenWorldCount > 0 && (
          <button
            className="punctum-singular-view__show-more"
            type="button"
            aria-expanded={showAllWorlds}
            onClick={() => setShowAllWorlds((current) => !current)}
          >
            {showAllWorlds
              ? "Show fewer worlds"
              : `Show ${hiddenWorldCount} more ${hiddenWorldCount === 1 ? "world" : "worlds"}`}
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="m4 6 4 4 4-4" />
            </svg>
          </button>
        )}
      </aside>
    </section>
  );
}

export default function PunctumResultDetail({ image }) {
  const [mode, setMode] = useState("constellation");
  const [individualView, setIndividualView] = useState("grid");
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
  const focusedPolygon = selectedPolygon || polygons[0] || null;
  const focusedIndex = focusedPolygon
    ? polygons.findIndex((polygon) => polygon.id === focusedPolygon.id)
    : -1;
  const selectPolygon = (polygon) => {
    setSelectedId((current) => (current === polygon.id ? "" : polygon.id));
  };
  const showIndividualView = (view) => {
    setIndividualView(view);
    if (view === "singular" && !selectedPolygon && polygons[0]) {
      setSelectedId(polygons[0].id);
    }
  };
  const moveFocusedPolygon = (direction) => {
    if (polygons.length <= 1) return;
    const currentIndex = focusedIndex < 0 ? 0 : focusedIndex;
    const nextIndex =
      (currentIndex + direction + polygons.length) % polygons.length;
    setSelectedId(polygons[nextIndex].id);
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
        explanation: polygon.annotation || "",
        width: image.width,
        height: image.height,
      },
      request: {
        source: {
          imageUrl: image.url,
          polygon: polygon.vertices,
          explanation: polygon.annotation || "",
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
      } ${
        mode === "individual" && individualView === "singular"
          ? "is-singular"
          : ""
      }`}
    >
      <header className="punctum-result__header">
        <div className="punctum-result__heading">
          <a className="punctum-result__back" href="/research/punctum/results">
            ← All results
          </a>
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
            <div className="punctum-result__primary-controls">
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
              {mode === "individual" && individualView === "singular" && (
                <nav
                  className="punctum-result__singular-navigation"
                  aria-label="Browse individual punctums"
                >
                  <button
                    type="button"
                    aria-label="Previous punctum"
                    onClick={() => moveFocusedPolygon(-1)}
                    disabled={polygons.length <= 1}
                  >
                    <svg viewBox="0 0 18 18" aria-hidden="true">
                      <path d="m10.75 4.5-4.5 4.5 4.5 4.5" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label="Next punctum"
                    onClick={() => moveFocusedPolygon(1)}
                    disabled={polygons.length <= 1}
                  >
                    <svg viewBox="0 0 18 18" aria-hidden="true">
                      <path d="m7.25 4.5 4.5 4.5-4.5 4.5" />
                    </svg>
                  </button>
                </nav>
              )}
            </div>
            <div className="punctum-result__controls-right">
              {mode === "individual" && (
                <div
                  className="punctum-result__individual-views"
                  role="group"
                  aria-label="Individual punctum layout"
                >
                  {[
                    ["grid", "Grid view"],
                    ["singular", "Singular view"],
                  ].map(([value, label]) => (
                    <button
                      type="button"
                      className={individualView === value ? "is-active" : ""}
                      aria-pressed={individualView === value}
                      onClick={() => showIndividualView(value)}
                      key={value}
                    >
                      <ViewModeIcon type={value} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              )}
              {mode !== "individual" && (
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
              )}
            </div>
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
          ) : individualView === "grid" ? (
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
          ) : (
            <SingularPunctumView
              image={image}
              polygon={focusedPolygon}
              index={Math.max(0, focusedIndex)}
              total={polygons.length}
              onCreateWorld={createWorld}
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
