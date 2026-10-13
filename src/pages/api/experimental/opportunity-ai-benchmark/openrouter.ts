import type { APIRoute } from "astro";
import {
  BENCHMARK_JSON_SCHEMA,
  BenchmarkExtractionSchema,
} from "../../../../lib/opportunities/benchmark";
import {
  acquireOpportunityAiBenchmarkSlot,
  authorizeOpportunityAiBenchmark,
  benchmarkJson,
} from "../../../../lib/opportunities/benchmark-access";
import {
  getExtractionSystemPrompt,
  resolveOpportunityDeadline,
} from "../../../../lib/opportunities/extractor";
import { computeContentHash } from "../../../../lib/opportunities/scraper";
import {
  LLMExtractionOutputSchema,
  type LLMExtractionOutput,
} from "../../../../lib/opportunities/types";
import { formatOpportunityTitle } from "../../../../lib/opportunities/ui-helpers";

export const prerender = false;

const MAX_SOURCE_CHARS = 12_000;
const OPENROUTER_TIMEOUT_MS = 30_000;
const FALLBACK_MODEL = "openai/gpt-4o-mini";

type JsonObject = Record<string, unknown>;

type NormalizedUsage = {
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cached_tokens: number | null;
  reasoning_tokens: number | null;
  cost_usd: number | null;
};

type AttemptTelemetry = {
  model: string;
  reported_model: string | null;
  success: boolean;
  stage: "request" | "provider" | "response" | "parse" | "complete";
  latency_ms: number;
  http_status: number | null;
  generation_id: string | null;
  usage: NormalizedUsage | null;
  cost_usd: number | null;
  error: string | null;
  warnings: string[];
};

const isJsonObject = (value: unknown): value is JsonObject =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const readEnvironmentValue = (name: string) => {
  const metaEnvironment = import.meta.env as Record<
    string,
    string | boolean | undefined
  >;
  const value = metaEnvironment?.[name] ?? process.env[name];
  return typeof value === "string" ? value.trim() : "";
};

const finiteNumber = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
};

const normalizeUsage = (value: unknown): NormalizedUsage | null => {
  if (!isJsonObject(value)) return null;
  const promptDetails = isJsonObject(value.prompt_tokens_details)
    ? value.prompt_tokens_details
    : null;
  const completionDetails = isJsonObject(value.completion_tokens_details)
    ? value.completion_tokens_details
    : null;
  const costDetails = isJsonObject(value.cost_details)
    ? value.cost_details
    : null;
  const normalized: NormalizedUsage = {
    prompt_tokens: finiteNumber(value.prompt_tokens),
    completion_tokens: finiteNumber(value.completion_tokens),
    total_tokens: finiteNumber(value.total_tokens),
    cached_tokens: finiteNumber(promptDetails?.cached_tokens),
    reasoning_tokens: finiteNumber(completionDetails?.reasoning_tokens),
    cost_usd:
      finiteNumber(value.cost) ??
      finiteNumber(costDetails?.upstream_inference_cost),
  };

  return Object.values(normalized).some((item) => item !== null)
    ? normalized
    : null;
};

const aggregateUsage = (attempts: AttemptTelemetry[]) => {
  const usages = attempts
    .map((attempt) => attempt.usage)
    .filter((usage): usage is NormalizedUsage => Boolean(usage));
  const sum = (key: keyof Omit<NormalizedUsage, "cost_usd">) => {
    const values = usages
      .map((usage) => usage[key])
      .filter((value): value is number => value !== null);
    return values.length
      ? values.reduce((total, value) => total + value, 0)
      : null;
  };
  const costs = attempts
    .map((attempt) => attempt.cost_usd)
    .filter((value): value is number => value !== null);
  return {
    prompt_tokens: sum("prompt_tokens"),
    completion_tokens: sum("completion_tokens"),
    total_tokens: sum("total_tokens"),
    cached_tokens: sum("cached_tokens"),
    reasoning_tokens: sum("reasoning_tokens"),
    cost_usd: costs.length
      ? Number(costs.reduce((total, value) => total + value, 0).toFixed(10))
      : null,
  };
};

const contentFromMessage = (value: unknown) => {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .map((part) =>
      isJsonObject(part) && typeof part.text === "string" ? part.text : "",
    )
    .filter(Boolean)
    .join("\n");
};

const parseProductionExtraction = (content: string): LLMExtractionOutput => {
  let json = content.trim();
  if (json.startsWith("```json")) {
    json = json.slice(7).replace(/```$/, "").trim();
  } else if (json.startsWith("```")) {
    json = json.slice(3).replace(/```$/, "").trim();
  }
  return LLMExtractionOutputSchema.parse(JSON.parse(json));
};

const normalizeProductionExtraction = (
  extraction: LLMExtractionOutput,
  pageTitle: string | null,
  pageText: string,
) => {
  const deadline = resolveOpportunityDeadline(
    extraction.deadline,
    extraction.timezone,
    pageText,
  );
  const warnings: string[] = [];
  let applicationUrl: string | null = null;
  if (extraction.application_url) {
    try {
      const parsed = new URL(extraction.application_url);
      if (parsed.protocol === "http:" || parsed.protocol === "https:")
        applicationUrl = parsed.toString();
      else
        warnings.push(
          "Production output contained a non-web application URL; benchmark normalized it to null.",
        );
    } catch {
      warnings.push(
        "Production output contained an invalid or relative application URL; benchmark normalized it to null.",
      );
    }
  }

  const result = BenchmarkExtractionSchema.parse({
    title: formatOpportunityTitle(
      extraction.title || pageTitle || "Untitled Opportunity",
    ).slice(0, 240),
    organisation: extraction.organisation || null,
    category: extraction.category || "other",
    summary: extraction.summary || null,
    deadline: deadline.deadline_raw || extraction.deadline || null,
    timezone: deadline.deadline_timezone || extraction.timezone || null,
    // The current production schema does not have a separate eligibility
    // field. Keep that limitation visible instead of inferring it from the
    // requirements array inside the benchmark adapter.
    eligibility: [],
    funding: extraction.fee_or_funding || null,
    requirements: extraction.requirements || [],
    application_url: applicationUrl,
    location: extraction.location || null,
  });
  return { result, warnings };
};

const safeContextLine = (value: unknown, maxLength: number) =>
  typeof value === "string"
    ? value
        .replace(/[\r\n]+/g, " ")
        .trim()
        .slice(0, maxLength)
    : "";

const readSourceUrl = (value: unknown) => {
  const raw = safeContextLine(value, 4_096);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return ["http:", "https:"].includes(parsed.protocol)
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
};

const errorCode = (error: unknown) => {
  if (!(error instanceof Error)) return "unknown_error";
  if (error.name === "TimeoutError" || error.name === "AbortError")
    return "timeout";
  if (error.name === "BenchmarkOutputParseError") return "invalid_output";
  if (error instanceof SyntaxError) return "invalid_provider_json";
  return "request_failed";
};

const makeTelemetry = (
  attempts: AttemptTelemetry[],
  startedAt: number,
  selectedModel: string | null,
) => {
  const usage = aggregateUsage(attempts);
  return {
    provider: "openrouter" as const,
    pipeline: "production_opportunity_extractor" as const,
    model: selectedModel,
    attempts,
    attempt_count: attempts.length,
    latency_ms: Math.round(performance.now() - startedAt),
    usage,
    cost_usd: usage.cost_usd,
    cost_complete:
      attempts.length > 0 &&
      attempts.every((attempt) => attempt.cost_usd !== null),
    cost_source: usage.cost_usd === null ? "unavailable" : "openrouter_usage",
    schema_hash: computeContentHash(JSON.stringify(BENCHMARK_JSON_SCHEMA)),
    limitations: ["Production extraction has no separate eligibility field."],
  };
};

export const POST: APIRoute = async ({ request }) => {
  const authorization = authorizeOpportunityAiBenchmark(request);
  if (!authorization.ok) return authorization.response;

  const apiKey = readEnvironmentValue("OPENROUTER_API_KEY");
  if (!apiKey)
    return benchmarkJson(
      { error: "OpenRouter is not configured for this benchmark." },
      503,
    );

  let body: JsonObject;
  try {
    const parsed: unknown = await request.json();
    if (!isJsonObject(parsed)) throw new Error("not an object");
    body = parsed;
  } catch {
    return benchmarkJson(
      { error: "The request body must be a JSON object." },
      400,
    );
  }

  const source = isJsonObject(body.source) ? body.source : body;
  const text = typeof source.text === "string" ? source.text : "";
  if (!text.trim())
    return benchmarkJson(
      { error: "A frozen source text snapshot is required." },
      400,
    );
  if (text.length > MAX_SOURCE_CHARS) {
    return benchmarkJson(
      { error: `Source text must not exceed ${MAX_SOURCE_CHARS} characters.` },
      413,
    );
  }

  const suppliedHash = safeContextLine(source.hash ?? source.source_hash, 128);
  const sourceHash = computeContentHash(text);
  if (suppliedHash && suppliedHash !== sourceHash) {
    return benchmarkJson(
      { error: "The source snapshot changed after it was prepared." },
      409,
    );
  }

  const title = safeContextLine(source.title, 500) || null;
  const sourceUrlValue = source.canonical_url ?? source.url;
  const url = readSourceUrl(sourceUrlValue);
  if (sourceUrlValue && !url)
    return benchmarkJson({ error: "The source URL is invalid." }, 400);

  const capturedAt =
    safeContextLine(body.captured_at ?? body.capturedAt, 100) || null;
  const timezone =
    safeContextLine(body.capture_timezone ?? body.timezone, 100) || null;

  let systemPrompt: string;
  try {
    systemPrompt = getExtractionSystemPrompt();
  } catch {
    return benchmarkJson(
      { error: "The current opportunity extraction prompt is not configured." },
      503,
    );
  }

  // Keep this message shape aligned with extractOpportunityWithLLM(). The
  // benchmark adds telemetry around the call, but does not save, authenticate,
  // consume user quota, or change the production extraction function.
  const contextLines = [
    url ? `SOURCE URL: ${url}` : "",
    title ? `PAGE TITLE: ${title}` : "",
    capturedAt ? `CAPTURED AT: ${capturedAt}` : "",
    timezone ? `BROWSER TIMEZONE: ${timezone}` : "",
  ].filter(Boolean);
  const userPrompt = `${contextLines.length ? `CAPTURE CONTEXT:\n${contextLines.join("\n")}\n\n` : ""}PAGE:\n${text}`;

  const configuredModel =
    readEnvironmentValue("OPENROUTER_OPPORTUNITIES_MODEL") ||
    "google/gemini-3.8-flash";
  const models = [...new Set([configuredModel, FALLBACK_MODEL])];
  const maxTokens = Math.min(
    2_000,
    Math.max(
      300,
      Number(readEnvironmentValue("OPENROUTER_OPPORTUNITIES_MAX_TOKENS")) ||
        1_200,
    ),
  );
  const attempts: AttemptTelemetry[] = [];
  const benchmarkStartedAt = performance.now();
  const slot = acquireOpportunityAiBenchmarkSlot(request);
  if (!slot.ok) return slot.response;

  try {
    for (const model of models) {
      const attemptStartedAt = performance.now();
      let httpStatus: number | null = null;
      let generationId: string | null = null;
      let usage: NormalizedUsage | null = null;

      try {
        const response = await fetch(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            signal: AbortSignal.timeout(OPENROUTER_TIMEOUT_MS),
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://abodid.com/opportunities",
              "X-Title": "Abodid Opportunity Assistant",
            },
            body: JSON.stringify({
              model,
              response_format: { type: "json_object" },
              usage: { include: true },
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              temperature: 0.1,
              max_tokens: maxTokens,
            }),
          },
        );
        httpStatus = response.status;

        let payload: unknown;
        try {
          payload = await response.json();
        } catch (error) {
          attempts.push({
            model,
            reported_model: null,
            success: false,
            stage: "response",
            latency_ms: Math.round(performance.now() - attemptStartedAt),
            http_status: httpStatus,
            generation_id: null,
            usage: null,
            cost_usd: null,
            error: errorCode(error),
            warnings: [],
          });
          continue;
        }

        const payloadObject = isJsonObject(payload) ? payload : {};
        usage = normalizeUsage(payloadObject.usage);
        generationId =
          typeof payloadObject.id === "string" ? payloadObject.id : null;
        const reportedModel =
          typeof payloadObject.model === "string" ? payloadObject.model : null;

        if (!response.ok) {
          attempts.push({
            model,
            reported_model: reportedModel,
            success: false,
            stage: "provider",
            latency_ms: Math.round(performance.now() - attemptStartedAt),
            http_status: httpStatus,
            generation_id: generationId,
            usage,
            cost_usd: usage?.cost_usd ?? null,
            error: `http_${response.status}`,
            warnings: [],
          });
          continue;
        }

        const choices = Array.isArray(payloadObject.choices)
          ? payloadObject.choices
          : [];
        const firstChoice = isJsonObject(choices[0]) ? choices[0] : null;
        const message =
          firstChoice && isJsonObject(firstChoice.message)
            ? firstChoice.message
            : null;
        const content = contentFromMessage(message?.content);

        try {
          const productionExtraction = parseProductionExtraction(content);
          const { result, warnings } = normalizeProductionExtraction(
            productionExtraction,
            title,
            text,
          );
          attempts.push({
            model,
            reported_model: reportedModel,
            success: true,
            stage: "complete",
            latency_ms: Math.round(performance.now() - attemptStartedAt),
            http_status: httpStatus,
            generation_id: generationId,
            usage,
            cost_usd: usage?.cost_usd ?? null,
            error: null,
            warnings,
          });
          return benchmarkJson({
            result,
            source_hash: sourceHash,
            telemetry: makeTelemetry(
              attempts,
              benchmarkStartedAt,
              reportedModel || model,
            ),
          });
        } catch (error) {
          // The API call may still be billed even when its output is invalid.
          // Preserve that usage before trying the fallback model.
          attempts.push({
            model,
            reported_model: reportedModel,
            success: false,
            stage: "parse",
            latency_ms: Math.round(performance.now() - attemptStartedAt),
            http_status: httpStatus,
            generation_id: generationId,
            usage,
            cost_usd: usage?.cost_usd ?? null,
            error: errorCode(error),
            warnings: [],
          });
        }
      } catch (error) {
        attempts.push({
          model,
          reported_model: null,
          success: false,
          stage: "request",
          latency_ms: Math.round(performance.now() - attemptStartedAt),
          http_status: httpStatus,
          generation_id: generationId,
          usage,
          cost_usd: usage?.cost_usd ?? null,
          error: errorCode(error),
          warnings: [],
        });
      }
    }

    console.warn("All Opportunity AI benchmark OpenRouter attempts failed", {
      models,
      failureStages: attempts.map((attempt) => attempt.stage),
    });
    return benchmarkJson(
      {
        error: "OpenRouter could not produce a valid benchmark extraction.",
        source_hash: sourceHash,
        telemetry: makeTelemetry(attempts, benchmarkStartedAt, null),
      },
      502,
    );
  } finally {
    slot.release();
  }
};
