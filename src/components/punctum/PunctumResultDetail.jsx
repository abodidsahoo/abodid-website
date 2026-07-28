import { useEffect, useMemo, useRef, useState } from "react";
import { createIllustrativePolygons } from "../../lib/punctum/demo";
import {
  pointInPolygon,
  verticesToSmoothSvgPath,
} from "../../lib/punctum/geometry";
import PunctumFeedbackModal from "./PunctumFeedbackModal";

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

function HeatmapCanvas({ polygons }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = 720;
    const height = 480;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, width, height);
    if (!polygons.length) return;

    const field = document.createElement("canvas");
    const fieldWidth = 240;
    const fieldHeight = 160;
    field.width = fieldWidth;
    field.height = fieldHeight;
    const fieldContext = field.getContext("2d");
    const imageData = fieldContext.createImageData(fieldWidth, fieldHeight);

    for (let y = 0; y < fieldHeight; y += 1) {
      for (let x = 0; x < fieldWidth; x += 1) {
        const rippleX =
          Math.sin(y * 0.16) * 2.8 + Math.sin((x + y) * 0.075) * 1.7;
        const rippleY =
          Math.cos(x * 0.13) * 2.4 + Math.cos((x - y) * 0.065) * 1.5;
        const point = {
          x: (x + 0.5 + rippleX) / fieldWidth,
          y: (y + 0.5 + rippleY) / fieldHeight,
        };
        let selected = 0;
        for (const polygon of polygons) {
          if (pointInPolygon(point, polygon.vertices)) selected += 1;
        }
        const density = selected / polygons.length;
        const index = (y * fieldWidth + x) * 4;
        const intensity = Math.min(1, Math.sqrt(density) * 1.8);
        const wash =
          0.9 +
          Math.sin(x * 0.19 + y * 0.11) * 0.06 +
          Math.sin(x * 0.043 - y * 0.17) * 0.04;
        imageData.data[index] = Math.round(255 - intensity * 28);
        imageData.data[index + 1] = Math.round(246 - intensity * 63);
        imageData.data[index + 2] = Math.round(226 - intensity * 89);
        imageData.data[index + 3] =
          density > 0 ? Math.round((42 + intensity * 156) * wash) : 0;
      }
    }
    fieldContext.putImageData(imageData, 0, 0);

    context.save();
    context.globalCompositeOperation = "screen";
    context.filter = "blur(22px) saturate(1.08)";
    context.globalAlpha = 0.68;
    context.drawImage(field, -14, 8, width + 28, height - 4);
    context.filter = "blur(10px) saturate(1.16)";
    context.globalAlpha = 0.76;
    context.drawImage(field, 8, -5, width - 10, height + 12);
    context.filter = "blur(4px) saturate(1.04)";
    context.globalAlpha = 0.34;
    context.drawImage(field, 0, 0, width, height);
    context.restore();
  }, [polygons]);

  return (
    <canvas
      ref={canvasRef}
      className="punctum-heatmap"
      aria-label="Selection-proportion heatmap"
    />
  );
}

function PolygonLayer({
  polygons,
  committed = false,
  selectedId = "",
  onSelect,
  variant = "",
}) {
  const interactive = typeof onSelect === "function";

  return (
    <svg
      className={`punctum-polygon-layer ${committed ? "is-committed" : ""} ${
        variant ? `is-${variant}` : ""
      }`}
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

export default function PunctumResultDetail({ image }) {
  const [mode, setMode] = useState("constellation");
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    age: "",
    gender: "",
    country: "",
  });
  const [selectedId, setSelectedId] = useState("");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSessionId, setFeedbackSessionId] = useState("");
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
    setError("");
    fetch(`/api/punctum/results?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Results unavailable");
        return result;
      })
      .then(setPayload)
      .catch((requestError) => {
        if (requestError.name !== "AbortError") {
          setError("Live results are taking a pause. The empty-study preview is shown.");
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

  return (
    <main
      className={`punctum-result ${
        mode === "responses" ? "is-responses" : ""
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
          hasAvailableFilters ? "" : "is-unfiltered"
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
                ["heatmap", "Heatmap"],
                ["responses", "Responses"],
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
            {mode === "heatmap" && <HeatmapCanvas polygons={polygons} />}
            {(mode === "constellation" || mode === "heatmap") && (
              <PolygonLayer
                polygons={polygons}
                selectedId={selectedId}
                onSelect={isIllustrative ? undefined : selectPolygon}
                variant={mode}
              />
            )}
            {mode === "responses" && selectedPolygon && (
              <PolygonLayer
                polygons={[selectedPolygon]}
                selectedId={selectedId}
                committed
              />
            )}
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
              <div className="punctum-result-stage__loading">Gathering marks…</div>
            )}
          </div>
        </div>

        {hasAvailableFilters && (
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

      {mode === "responses" && (
        <section className="punctum-response-grid" aria-label="Individual anonymous marks">
          {polygons.slice(0, 18).map((polygon, index) => (
            <article className="punctum-response-card" key={polygon.id}>
              <button
                type="button"
                className="punctum-response-card__visual"
                style={{ aspectRatio: `${image.width} / ${image.height}` }}
                onClick={() => selectPolygon(polygon)}
                aria-label={`Select mark ${index + 1}`}
              >
                <img src={image.url} alt="" loading="lazy" />
                <PolygonLayer
                  polygons={[polygon]}
                  committed
                  selectedId={selectedId}
                />
              </button>
              <div className="punctum-response-card__copy">
                <span>Mark {String(index + 1).padStart(2, "0")}</span>
                {polygon.annotation && <p>“{polygon.annotation}”</p>}
              </div>
            </article>
          ))}
        </section>
      )}

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
    </main>
  );
}
