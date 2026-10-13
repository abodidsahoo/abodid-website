import { useEffect, useMemo, useState } from "react";
import {
  BENCHMARK_FIELDS,
  OPPORTUNITY_BENCHMARK_JSON_SCHEMA,
  OPPORTUNITY_BENCHMARK_SYSTEM_PROMPT,
  buildOpportunityBenchmarkPrompt,
  formatBenchmarkValue,
  parseOpportunityBenchmarkResponse,
  type OpportunityBenchmarkExtraction,
} from "../../lib/opportunities/benchmark";

type ChromeAvailability =
  | "checking"
  | "missing"
  | "unavailable"
  | "downloadable"
  | "downloading"
  | "available"
  | "error";
type ProviderName = "chrome" | "openrouter";
type Verdict = "both" | "chrome" | "openrouter" | "neither";

type SourceSnapshot = {
  text: string;
  title: string | null;
  canonical_url: string | null;
  source_hash: string;
  fetch_ms: number;
  method: "url" | "pasted_text";
  captured_at: string;
  timezone: string;
};

type AttemptTelemetry = {
  model: string;
  reported_model?: string | null;
  success: boolean;
  stage?: string;
  latency_ms: number;
  http_status?: number | null;
  cost_usd?: number | null;
  error: string | null;
  warnings?: string[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number;
  } | null;
};

type ProviderRun = {
  provider: ProviderName;
  success: boolean;
  duration_ms: number;
  setup_ms?: number;
  inference_ms?: number;
  model: string;
  availability?: string;
  context_usage?: number | null;
  context_window?: number | null;
  download_progress?: number | null;
  result?: OpportunityBenchmarkExtraction;
  error?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | null;
  cost_usd?: number | null;
  cost_complete?: boolean;
  attempts?: AttemptTelemetry[];
};

type BenchmarkRound = {
  number: number;
  order: ProviderName[];
  started_at: string;
  chrome: ProviderRun;
  openrouter: ProviderRun;
};

type LanguageModelSessionLike = {
  prompt: (
    input: string,
    options?: {
      responseConstraint?: Record<string, unknown>;
      omitResponseConstraintInput?: boolean;
      signal?: AbortSignal;
    },
  ) => Promise<string>;
  destroy: () => void;
  contextUsage?: number;
  contextWindow?: number;
};

type LanguageModelLike = {
  availability: (options: Record<string, unknown>) => Promise<string>;
  create: (
    options: Record<string, unknown>,
  ) => Promise<LanguageModelSessionLike>;
};

type PreparedChromeSession = {
  session: LanguageModelSessionLike | null;
  setup_ms: number;
  availability: string;
  download_progress: number | null;
  error?: string;
};

const chromeOptions = {
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }],
};

const benchmarkEndpoint = "/api/experimental/opportunity-ai-benchmark";
const CHROME_INFERENCE_TIMEOUT_MS = 90_000;

const nowIso = () => new Date().toISOString();
const roundMs = (value: number) => Math.round(value * 10) / 10;

const getLanguageModel = () =>
  (globalThis as typeof globalThis & { LanguageModel?: LanguageModelLike })
    .LanguageModel;

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

const normalizedFingerprint = (result: OpportunityBenchmarkExtraction) =>
  JSON.stringify(
    Object.fromEntries(
      BENCHMARK_FIELDS.map(({ key }) => {
        const value = result[key];
        if (Array.isArray(value)) {
          return [key, value.map((item) => item.trim().toLowerCase()).sort()];
        }
        return [
          key,
          typeof value === "string" ? value.trim().toLowerCase() : value,
        ];
      }),
    ),
  );

const providerStats = (rounds: BenchmarkRound[], provider: ProviderName) => {
  const runs = rounds.map((round) => round[provider]);
  const successful = runs.filter((run) => run.success && run.result);
  const fingerprints = successful.map((run) =>
    normalizedFingerprint(run.result!),
  );
  const counts = new Map<string, number>();
  fingerprints.forEach((fingerprint) =>
    counts.set(fingerprint, (counts.get(fingerprint) || 0) + 1),
  );
  const mostCommon = Math.max(0, ...counts.values());
  const costComplete =
    provider === "chrome"
      ? true
      : runs.length > 0 &&
        runs.every(
          (run) =>
            run.cost_complete === true &&
            run.cost_usd !== null &&
            run.cost_usd !== undefined,
        );
  const fallbackRuns =
    provider === "openrouter"
      ? runs.filter((run) => (run.attempts?.length || 0) > 1).length
      : 0;

  return {
    attempts: runs.length,
    successes: successful.length,
    successRate: runs.length ? (successful.length / runs.length) * 100 : null,
    medianLatency: median(
      runs.filter((run) => run.success).map((run) => run.duration_ms),
    ),
    exactStability:
      successful.length > 1 ? (mostCommon / successful.length) * 100 : null,
    totalCost: costComplete
      ? runs.reduce((total, run) => total + (run.cost_usd || 0), 0)
      : null,
    costComplete,
    fallbackRuns,
    totalTokens: runs.reduce(
      (total, run) => total + (run.usage?.total_tokens || 0),
      0,
    ),
  };
};

const failureRun = (
  provider: ProviderName,
  startedAt: number,
  error: unknown,
  extras: Partial<ProviderRun> = {},
): ProviderRun => ({
  provider,
  success: false,
  duration_ms: roundMs(performance.now() - startedAt),
  model: provider === "chrome" ? "Gemini Nano (Chrome)" : "OpenRouter",
  error:
    error instanceof Error
      ? error.message
      : String(error || "Unknown benchmark error"),
  cost_usd: provider === "chrome" ? 0 : null,
  ...extras,
});

export default function OpportunityAiBenchmark() {
  const [url, setUrl] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [pastedTitle, setPastedTitle] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [repeatCount, setRepeatCount] = useState(1);
  const [chromeAvailability, setChromeAvailability] =
    useState<ChromeAvailability>("checking");
  const [chromeDownload, setChromeDownload] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<SourceSnapshot | null>(null);
  const [rounds, setRounds] = useState<BenchmarkRound[]>([]);
  const [judgments, setJudgments] = useState<Record<string, Verdict>>({});
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Checking this browser for Chrome AI…");
  const [error, setError] = useState("");

  useEffect(() => {
    setAccessToken(
      sessionStorage.getItem("opportunity-ai-benchmark-token") || "",
    );
    const check = async () => {
      const languageModel = getLanguageModel();
      if (!languageModel) {
        setChromeAvailability("missing");
        setStatus(
          "Chrome LanguageModel is not exposed in this browser. Open this page in supported desktop Chrome.",
        );
        return;
      }
      try {
        const availability = (await languageModel.availability(
          chromeOptions,
        )) as ChromeAvailability;
        setChromeAvailability(availability);
        setStatus(
          availability === "available"
            ? "Chrome AI is ready. Nothing has been sent or saved."
            : availability === "unavailable"
              ? "This device does not currently meet Chrome AI requirements."
              : "Chrome AI can run after its local model finishes downloading.",
        );
      } catch (availabilityError) {
        setChromeAvailability("error");
        setStatus(
          availabilityError instanceof Error
            ? availabilityError.message
            : "Chrome AI availability check failed.",
        );
      }
    };
    void check();
  }, []);

  const requestHeaders = () => ({
    "Content-Type": "application/json",
    ...(accessToken.trim() ? { "x-benchmark-token": accessToken.trim() } : {}),
  });

  const prepareSource = async (
    capturedAt: string,
    timezone: string,
  ): Promise<SourceSnapshot> => {
    const response = await fetch(`${benchmarkEndpoint}/source`, {
      method: "POST",
      headers: requestHeaders(),
      body: JSON.stringify({
        url: url.trim() || undefined,
        page_text: pastedText.trim() || undefined,
        title: pastedTitle.trim() || undefined,
        captured_at: capturedAt,
        timezone,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.source) {
      throw new Error(
        payload.error || `Source preparation failed (HTTP ${response.status})`,
      );
    }
    return {
      ...(payload.source as Omit<SourceSnapshot, "captured_at" | "timezone">),
      captured_at: capturedAt,
      timezone,
    };
  };

  /**
   * Chrome requires transient user activation when the on-device model needs
   * its first download. Calling create() before this function's first await
   * keeps that activation attached to the benchmark button click. The session
   * is then reused for the first Chrome run after the shared source is ready.
   */
  const prepareChromeSession = async (): Promise<PreparedChromeSession> => {
    const startedAt = performance.now();
    const languageModel = getLanguageModel();
    const availability = chromeAvailability;
    let downloadProgress: number | null = null;

    if (!languageModel) {
      return {
        session: null,
        setup_ms: 0,
        availability: "missing",
        download_progress: null,
        error: "LanguageModel API is not available",
      };
    }

    try {
      // Do not put an await before this call: it may need the click's
      // transient user activation to start Chrome's model download.
      const sessionPromise = languageModel.create({
        ...chromeOptions,
        initialPrompts: [
          { role: "system", content: OPPORTUNITY_BENCHMARK_SYSTEM_PROMPT },
        ],
        monitor(monitor: EventTarget) {
          monitor.addEventListener("downloadprogress", (event) => {
            const loaded = Number(
              (event as Event & { loaded?: number }).loaded || 0,
            );
            downloadProgress = loaded;
            setChromeDownload(loaded);
            setChromeAvailability(loaded < 1 ? "downloading" : "available");
          });
        },
      });
      const session = await sessionPromise;
      setChromeAvailability("available");
      return {
        session,
        setup_ms: roundMs(performance.now() - startedAt),
        availability: "available",
        download_progress: downloadProgress,
      };
    } catch (sessionError) {
      return {
        session: null,
        setup_ms: roundMs(performance.now() - startedAt),
        availability,
        download_progress: downloadProgress,
        error:
          sessionError instanceof Error
            ? sessionError.message
            : String(sessionError),
      };
    }
  };

  const runChrome = async (
    source: SourceSnapshot,
    prepared?: PreparedChromeSession,
  ): Promise<ProviderRun> => {
    const startedAt = performance.now();
    const languageModel = getLanguageModel();
    if (!languageModel)
      return failureRun(
        "chrome",
        startedAt,
        new Error("LanguageModel API is not available"),
      );

    let session: LanguageModelSessionLike | null = null;
    let availability = prepared?.availability || "unknown";
    let setupMs = prepared?.setup_ms || 0;
    let downloadProgress = prepared?.download_progress ?? null;
    try {
      if (prepared) {
        if (!prepared.session)
          throw new Error(prepared.error || "Chrome AI session setup failed");
        session = prepared.session;
      } else {
        availability = await languageModel.availability(chromeOptions);
        setChromeAvailability(availability as ChromeAvailability);
        if (availability === "unavailable") {
          throw new Error(
            "Gemini Nano is unavailable on this device or Chrome profile",
          );
        }

        const setupStartedAt = performance.now();
        session = await languageModel.create({
          ...chromeOptions,
          initialPrompts: [
            { role: "system", content: OPPORTUNITY_BENCHMARK_SYSTEM_PROMPT },
          ],
          monitor(monitor: EventTarget) {
            monitor.addEventListener("downloadprogress", (event) => {
              const loaded = Number(
                (event as Event & { loaded?: number }).loaded || 0,
              );
              downloadProgress = loaded;
              setChromeDownload(loaded);
              setChromeAvailability(loaded < 1 ? "downloading" : "available");
            });
          },
        });
        setupMs = roundMs(performance.now() - setupStartedAt);
      }

      const inferenceStartedAt = performance.now();
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => {
        controller.abort(
          new DOMException(
            "Chrome AI inference timed out after 90 seconds.",
            "TimeoutError",
          ),
        );
      }, CHROME_INFERENCE_TIMEOUT_MS);
      let raw: string;
      try {
        raw = await session.prompt(
          buildOpportunityBenchmarkPrompt({
            pageText: source.text,
            pageTitle: source.title,
            sourceUrl: source.canonical_url,
            capturedAt: source.captured_at,
            timezone: source.timezone,
          }),
          {
            responseConstraint: OPPORTUNITY_BENCHMARK_JSON_SCHEMA,
            signal: controller.signal,
          },
        );
      } finally {
        window.clearTimeout(timeoutId);
      }
      const inferenceMs = roundMs(performance.now() - inferenceStartedAt);
      const result = parseOpportunityBenchmarkResponse(raw);

      return {
        provider: "chrome",
        success: true,
        duration_ms: roundMs(setupMs + inferenceMs),
        setup_ms: setupMs,
        inference_ms: inferenceMs,
        model: "Gemini Nano (browser managed)",
        availability,
        context_usage: session.contextUsage ?? null,
        context_window: session.contextWindow ?? null,
        download_progress: downloadProgress,
        result,
        usage: null,
        cost_usd: 0,
        cost_complete: true,
      };
    } catch (chromeError) {
      const elapsedSinceRunStarted = performance.now() - startedAt;
      return failureRun("chrome", startedAt, chromeError, {
        duration_ms: roundMs(
          prepared ? setupMs + elapsedSinceRunStarted : elapsedSinceRunStarted,
        ),
        setup_ms: setupMs,
        availability,
        download_progress: downloadProgress,
      });
    } finally {
      session?.destroy();
    }
  };

  const runOpenRouter = async (
    source: SourceSnapshot,
  ): Promise<ProviderRun> => {
    const startedAt = performance.now();
    try {
      const response = await fetch(`${benchmarkEndpoint}/openrouter`, {
        method: "POST",
        headers: requestHeaders(),
        body: JSON.stringify({
          source,
          captured_at: source.captured_at,
          timezone: source.timezone,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      const telemetry = payload.telemetry || {};
      if (!response.ok || !payload.result) {
        return failureRun(
          "openrouter",
          startedAt,
          new Error(
            payload.error || `OpenRouter failed (HTTP ${response.status})`,
          ),
          {
            duration_ms: roundMs(performance.now() - startedAt),
            inference_ms: telemetry.latency_ms || undefined,
            model: telemetry.model || "OpenRouter",
            usage: telemetry.usage || null,
            cost_usd: telemetry.cost_usd ?? null,
            cost_complete: telemetry.cost_complete === true,
            attempts: telemetry.attempts || [],
          },
        );
      }

      return {
        provider: "openrouter",
        success: true,
        duration_ms: roundMs(performance.now() - startedAt),
        inference_ms:
          telemetry.latency_ms || roundMs(performance.now() - startedAt),
        model: telemetry.model || "OpenRouter",
        result: payload.result,
        usage: telemetry.usage || null,
        cost_usd: telemetry.cost_usd ?? null,
        cost_complete: telemetry.cost_complete === true,
        attempts: telemetry.attempts || [],
      };
    } catch (openRouterError) {
      return failureRun("openrouter", startedAt, openRouterError);
    }
  };

  const runBenchmark = async () => {
    if (!url.trim() && !pastedText.trim()) {
      setError("Enter an opportunity URL or paste a captured page snapshot.");
      return;
    }
    if (pastedText.trim() && pastedText.trim().length < 80) {
      setError("The pasted page snapshot is too short to benchmark reliably.");
      return;
    }

    setBusy(true);
    setError("");
    setRounds([]);
    setJudgments({});
    setChromeDownload(null);
    if (accessToken.trim())
      sessionStorage.setItem(
        "opportunity-ai-benchmark-token",
        accessToken.trim(),
      );

    // Invoke before the first await so Chrome can associate a first-time
    // model download with this explicit button click.
    const preparedChromePromise = prepareChromeSession();
    let preparedChromeConsumed = false;

    try {
      setStatus("Preparing one immutable source snapshot…");
      const capturedAt = nowIso();
      const captureTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const prepared = await prepareSource(capturedAt, captureTimezone);
      setSnapshot(prepared);

      const nextRounds: BenchmarkRound[] = [];
      for (let index = 0; index < repeatCount; index += 1) {
        const roundStartedAt = nowIso();
        const order: ProviderName[] =
          index % 2 === 0 ? ["chrome", "openrouter"] : ["openrouter", "chrome"];
        setStatus(
          `Running sample ${index + 1} of ${repeatCount}: ${order[0] === "chrome" ? "Chrome AI" : "OpenRouter"} first…`,
        );

        let chrome: ProviderRun | null = null;
        let openrouter: ProviderRun | null = null;
        for (const provider of order) {
          if (provider === "chrome") {
            const preparedChrome =
              index === 0 ? await preparedChromePromise : undefined;
            preparedChromeConsumed =
              preparedChromeConsumed || Boolean(preparedChrome);
            chrome = await runChrome(prepared, preparedChrome);
          } else openrouter = await runOpenRouter(prepared);
        }

        const round: BenchmarkRound = {
          number: index + 1,
          order,
          started_at: roundStartedAt,
          chrome: chrome!,
          openrouter: openrouter!,
        };
        nextRounds.push(round);
        setRounds([...nextRounds]);
      }
      setStatus(
        "Benchmark complete. Review each field against the source and mark the accurate answer.",
      );
    } catch (benchmarkError) {
      if (!preparedChromeConsumed) {
        void preparedChromePromise.then(({ session }) => session?.destroy());
      }
      setError(
        benchmarkError instanceof Error
          ? benchmarkError.message
          : "Benchmark failed unexpectedly.",
      );
      setStatus("The benchmark stopped before both engines could be compared.");
    } finally {
      setBusy(false);
    }
  };

  const latestChrome = [...rounds]
    .reverse()
    .find((round) => round.chrome.result)?.chrome.result;
  const latestOpenRouter = [...rounds]
    .reverse()
    .find((round) => round.openrouter.result)?.openrouter.result;
  const chromeStats = useMemo(() => providerStats(rounds, "chrome"), [rounds]);
  const openRouterStats = useMemo(
    () => providerStats(rounds, "openrouter"),
    [rounds],
  );

  const accuracy = useMemo(() => {
    const verdicts = Object.values(judgments);
    const judged = verdicts.length;
    const chromeCorrect = verdicts.filter(
      (verdict) => verdict === "both" || verdict === "chrome",
    ).length;
    const openRouterCorrect = verdicts.filter(
      (verdict) => verdict === "both" || verdict === "openrouter",
    ).length;
    return {
      judged,
      chrome: judged ? (chromeCorrect / judged) * 100 : null,
      openrouter: judged ? (openRouterCorrect / judged) * 100 : null,
    };
  }, [judgments]);

  const exportResults = () => {
    if (!snapshot || !rounds.length) return;
    const report = {
      benchmark: "opportunity-ai-chrome-vs-openrouter",
      exported_at: nowIso(),
      source: snapshot,
      browser: navigator.userAgent,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language_scope: "English input and output",
      chrome_availability: chromeAvailability,
      rounds,
      human_judgments: judgments,
      reviewed_accuracy_percent: {
        chrome: accuracy.chrome,
        openrouter: accuracy.openrouter,
        fields_judged: accuracy.judged,
      },
      note: "Agreement is not accuracy. Accuracy values exist only for fields reviewed by a human against the source.",
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `opportunity-ai-benchmark-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  };

  const availabilityLabel =
    chromeAvailability === "missing"
      ? "API missing"
      : chromeAvailability === "checking"
        ? "Checking"
        : chromeAvailability;

  return (
    <main className="ai-bench-shell">
      <header className="ai-bench-hero">
        <nav aria-label="Lab navigation">
          <a href="/lab">← Lab</a>
          <span>Isolated experiment · no database writes</span>
        </nav>
        <div className="ai-bench-title-row">
          <div>
            <p className="eyebrow">Chrome AI × OpenRouter</p>
            <h1>
              Opportunity
              <br />
              extraction bench
            </h1>
          </div>
          <div className="hero-note">
            <strong>One page. One frozen snapshot. Two engines.</strong>
            <p>
              Compare factual extraction, speed, repeatability, and real cloud
              cost without saving an opportunity or signing in.
            </p>
          </div>
        </div>
        <div className="engine-strip" aria-label="Benchmark engine status">
          <div>
            <span className={`status-dot status-${chromeAvailability}`} />
            <small>ON DEVICE</small>
            <strong>Gemini Nano</strong>
            <em>
              English-only · {availabilityLabel}
              {chromeDownload !== null && chromeDownload < 1
                ? ` · ${Math.round(chromeDownload * 100)}%`
                : ""}
            </em>
          </div>
          <div>
            <span className="status-dot status-cloud" />
            <small>CLOUD BASELINE</small>
            <strong>OpenRouter</strong>
            <em>Current production extraction pipeline</em>
          </div>
          <div>
            <span className="status-dot status-safe" />
            <small>EXPERIMENT BOUNDARY</small>
            <strong>Zero saves</strong>
            <em>No Supabase · no user quota</em>
          </div>
        </div>
      </header>

      <section
        className="bench-panel input-panel"
        aria-labelledby="source-heading"
      >
        <div className="section-heading">
          <span>01</span>
          <div>
            <p className="eyebrow">Source</p>
            <h2 id="source-heading">Choose one opportunity page</h2>
          </div>
        </div>

        <label className="field-label" htmlFor="benchmark-url">
          Opportunity URL
        </label>
        <div className="url-row">
          <input
            id="benchmark-url"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://organisation.org/open-call"
            autoComplete="url"
            disabled={busy}
          />
          <label className="run-count">
            <span>Repeat</span>
            <select
              value={repeatCount}
              onChange={(event) => setRepeatCount(Number(event.target.value))}
              disabled={busy}
            >
              <option value={1}>1 run</option>
              <option value={3}>3 runs</option>
              <option value={5}>5 runs</option>
            </select>
          </label>
        </div>

        <details className="paste-panel">
          <summary>
            Page cannot be fetched? Paste the rendered page snapshot instead
          </summary>
          <div className="paste-fields">
            <label>
              <span>Page title</span>
              <input
                value={pastedTitle}
                onChange={(event) => setPastedTitle(event.target.value)}
                placeholder="Optional title"
                disabled={busy}
              />
            </label>
            <label>
              <span>Captured page text and labelled links</span>
              <textarea
                value={pastedText}
                onChange={(event) => setPastedText(event.target.value)}
                rows={8}
                placeholder="Paste rendered opportunity content here…"
                disabled={busy}
              />
            </label>
          </div>
        </details>

        <details className="access-panel">
          <summary>Deployed benchmark access</summary>
          <label>
            <span>
              Benchmark token (only required outside local development)
            </span>
            <input
              type="password"
              value={accessToken}
              onChange={(event) => setAccessToken(event.target.value)}
              autoComplete="off"
              disabled={busy}
            />
          </label>
        </details>

        <div className="run-row">
          <button
            className="primary-action"
            type="button"
            onClick={runBenchmark}
            disabled={busy}
          >
            {busy ? "Benchmark running…" : "Run both engines →"}
          </button>
          <p>
            <strong>Privacy:</strong> Chrome processing stays on device. The
            same frozen text is sent to OpenRouter only for the cloud
            comparison.
          </p>
        </div>
        <div className="live-status" role="status" aria-live="polite">
          {status}
        </div>
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
      </section>

      {snapshot && (
        <section className="source-receipt" aria-label="Frozen source receipt">
          <div>
            <span>Snapshot</span>
            <strong>{snapshot.source_hash.slice(0, 12)}</strong>
          </div>
          <div>
            <span>Characters</span>
            <strong>{snapshot.text.length.toLocaleString()}</strong>
          </div>
          <div>
            <span>Preparation</span>
            <strong>{snapshot.fetch_ms} ms</strong>
          </div>
          <div>
            <span>Method</span>
            <strong>
              {snapshot.method === "url" ? "Safe URL fetch" : "Pasted DOM text"}
            </strong>
          </div>
          <details>
            <summary>Inspect exact shared input</summary>
            <pre>{snapshot.text}</pre>
          </details>
        </section>
      )}

      {rounds.length > 0 && (
        <>
          <section
            className="bench-panel metrics-panel"
            aria-labelledby="metrics-heading"
          >
            <div className="section-heading">
              <span>02</span>
              <div>
                <p className="eyebrow">Performance</p>
                <h2 id="metrics-heading">Measured, not estimated</h2>
              </div>
            </div>
            <div className="provider-metrics">
              <ProviderMetrics
                name="Chrome AI"
                tone="pink"
                stats={chromeStats}
                costLabel="$0 API cost"
              />
              <ProviderMetrics
                name="OpenRouter"
                tone="blue"
                stats={openRouterStats}
                costLabel={
                  !openRouterStats.attempts
                    ? "—"
                    : openRouterStats.totalCost === null
                      ? "Unavailable"
                      : `$${openRouterStats.totalCost.toFixed(6)}`
                }
              />
            </div>
            <p className="metric-note">
              Exact stability means byte-equivalent normalized fields across
              successful repeat runs. OpenRouter uses the current server-only
              production prompt, schema, model setting, fallback, and deadline
              safety net—but never saves or consumes a user quota. Its existing
              schema has no separate eligibility field, so that limitation
              remains visible here.
            </p>
          </section>

          <section
            className="bench-panel comparison-panel"
            aria-labelledby="comparison-heading"
          >
            <div className="section-heading comparison-heading-row">
              <span>03</span>
              <div>
                <p className="eyebrow">Accuracy review</p>
                <h2 id="comparison-heading">Which answer matches the page?</h2>
              </div>
              <button
                className="secondary-action"
                type="button"
                onClick={exportResults}
              >
                Export full JSON ↓
              </button>
            </div>

            {(!latestChrome || !latestOpenRouter) && (
              <div className="partial-warning">
                One engine did not return a valid extraction. Its failure still
                counts in reliability; successful output remains visible below.
              </div>
            )}

            <div
              className="comparison-table"
              role="table"
              aria-label="Field extraction comparison"
            >
              <div className="comparison-row comparison-header" role="row">
                <strong role="columnheader">Field</strong>
                <strong role="columnheader">Chrome AI</strong>
                <strong role="columnheader">OpenRouter</strong>
                <strong role="columnheader">Human verdict</strong>
              </div>
              {BENCHMARK_FIELDS.map((field) => (
                <div className="comparison-row" role="row" key={field.key}>
                  <div className="field-name" role="cell">
                    {field.label}
                  </div>
                  <div className="field-value" role="cell">
                    {latestChrome
                      ? formatBenchmarkValue(field.key, latestChrome[field.key])
                      : "No valid result"}
                  </div>
                  <div className="field-value" role="cell">
                    {latestOpenRouter
                      ? formatBenchmarkValue(
                          field.key,
                          latestOpenRouter[field.key],
                        )
                      : "No valid result"}
                  </div>
                  <div
                    className="verdict-grid"
                    role="cell"
                    aria-label={`Accuracy verdict for ${field.label}`}
                  >
                    {(
                      [
                        ["both", "Both"],
                        ["chrome", "Chrome"],
                        ["openrouter", "OpenRouter"],
                        ["neither", "Neither"],
                      ] as Array<[Verdict, string]>
                    ).map(([value, label]) => (
                      <button
                        type="button"
                        key={value}
                        className={
                          judgments[field.key] === value ? "is-selected" : ""
                        }
                        aria-pressed={judgments[field.key] === value}
                        onClick={() =>
                          setJudgments((current) => ({
                            ...current,
                            [field.key]: value,
                          }))
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="accuracy-summary">
              <div>
                <span>Reviewed fields</span>
                <strong>
                  {accuracy.judged} / {BENCHMARK_FIELDS.length}
                </strong>
              </div>
              <div>
                <span>Chrome accuracy</span>
                <strong>
                  {accuracy.chrome === null
                    ? "Not judged"
                    : `${Math.round(accuracy.chrome)}%`}
                </strong>
              </div>
              <div>
                <span>OpenRouter accuracy</span>
                <strong>
                  {accuracy.openrouter === null
                    ? "Not judged"
                    : `${Math.round(accuracy.openrouter)}%`}
                </strong>
              </div>
            </div>
            <p className="metric-note">
              Accuracy is intentionally human-reviewed against the source.
              Agreement between two models can still mean both models are wrong.
            </p>
          </section>

          <section
            className="bench-panel run-log"
            aria-labelledby="run-log-heading"
          >
            <div className="section-heading">
              <span>04</span>
              <div>
                <p className="eyebrow">Reliability log</p>
                <h2 id="run-log-heading">Every attempt remains visible</h2>
              </div>
            </div>
            <div className="run-log-grid">
              {rounds.map((round) => (
                <article key={round.number}>
                  <header>
                    <strong>Run {round.number}</strong>
                    <span>
                      {round.order
                        .map((provider) =>
                          provider === "chrome" ? "Chrome" : "OpenRouter",
                        )
                        .join(" → ")}
                    </span>
                  </header>
                  <RunLine run={round.chrome} />
                  <RunLine run={round.openrouter} />
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      <footer className="bench-footer">
        <strong>Decision rule</strong>
        <p>
          Do not replace OpenRouter from one successful laptop test. This
          version benchmarks English pages only. Test several pages and eligible
          device classes; treat unsupported Chrome profiles and critical-field
          misses as automatic hybrid-fallback cases.
        </p>
      </footer>
    </main>
  );
}

function ProviderMetrics({
  name,
  tone,
  stats,
  costLabel,
}: {
  name: string;
  tone: "pink" | "blue";
  stats: ReturnType<typeof providerStats>;
  costLabel: string;
}) {
  return (
    <article className={`provider-card provider-${tone}`}>
      <h3>{name}</h3>
      <dl>
        <div>
          <dt>Success</dt>
          <dd>
            {stats.successRate === null
              ? "—"
              : `${Math.round(stats.successRate)}%`}{" "}
            <small>
              {stats.successes}/{stats.attempts}
            </small>
          </dd>
        </div>
        <div>
          <dt>Median elapsed</dt>
          <dd>
            {stats.medianLatency === null
              ? "—"
              : `${Math.round(stats.medianLatency)} ms`}
          </dd>
        </div>
        <div>
          <dt>Exact stability</dt>
          <dd>
            {stats.exactStability === null
              ? "Need repeats"
              : `${Math.round(stats.exactStability)}%`}
          </dd>
        </div>
        <div>
          <dt>API cost</dt>
          <dd>{costLabel}</dd>
        </div>
        <div>
          <dt>Tokens</dt>
          <dd>
            {stats.totalTokens
              ? stats.totalTokens.toLocaleString()
              : name === "Chrome AI"
                ? "Local / unbilled"
                : "—"}
          </dd>
        </div>
        <div>
          <dt>Fallback use</dt>
          <dd>
            {name === "OpenRouter"
              ? `${stats.fallbackRuns}/${stats.attempts}`
              : "Not applicable"}
          </dd>
        </div>
      </dl>
    </article>
  );
}

function RunLine({ run }: { run: ProviderRun }) {
  return (
    <div className={`run-line ${run.success ? "is-success" : "is-failure"}`}>
      <span>{run.provider === "chrome" ? "Chrome AI" : "OpenRouter"}</span>
      <strong>
        {run.success ? `${Math.round(run.duration_ms)} ms` : "Failed"}
      </strong>
      <em>{run.success ? run.model : run.error}</em>
      {run.provider === "openrouter" &&
        run.cost_usd !== null &&
        run.cost_usd !== undefined && (
          <small>
            ${run.cost_usd.toFixed(6)}
            {run.cost_complete === false ? " partial" : ""}
          </small>
        )}
      {run.provider === "openrouter" && Boolean(run.attempts?.length) && (
        <ol className="attempt-list" aria-label="OpenRouter provider attempts">
          {run.attempts!.map((attempt, index) => (
            <li key={`${attempt.model}-${index}`}>
              <span>Attempt {index + 1}</span>
              <strong>{attempt.model}</strong>
              <em>
                {attempt.success
                  ? "Succeeded"
                  : `Failed · ${attempt.stage || attempt.error || "unknown stage"}`}
              </em>
              <small>
                {Math.round(attempt.latency_ms)} ms
                {attempt.cost_usd === null || attempt.cost_usd === undefined
                  ? " · cost unavailable"
                  : ` · $${attempt.cost_usd.toFixed(6)}`}
              </small>
              {Boolean(attempt.warnings?.length) && (
                <small>{attempt.warnings!.join(" ")}</small>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
