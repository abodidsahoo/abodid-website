import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2.112.0";
import {
  canonicalizeUrl,
  type DigestCandidate,
  discoveryTooling,
  digestSubject,
  domainFromUrl,
  domainMatches,
  filterTopicsForDay,
  isIsoDate,
  limitWords,
  normalizeTitle,
  renderDigestHtml,
  scoreCandidate,
  selectExactlyFive,
  shouldDeliverToday,
  titleSimilarity,
  type VerifiedDigestCandidate,
} from "../_shared/reading-digest.ts";

type DigestSettings = {
  recipient_name: string;
  recipient_email: string | null;
  sender_name: string;
  sender_email: string;
  reply_to_email: string | null;
  timezone: "Asia/Kolkata";
  frequency: "daily" | "weekdays" | "weekly" | "paused";
  weekly_delivery_day: number;
  recent_lookback_days: number;
  openai_model: string;
  enabled: boolean;
};

type SourceRule = {
  domain: string;
  name: string;
  disposition: "trusted" | "blocked";
  notes: string;
};

type RunRow = { id: string; run_key: string; status: string };

type AiProvider = {
  name: "openai" | "openrouter";
  apiKey: string;
  endpoint: string;
  model: string;
  fallbackModel: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...corsHeaders,
    },
  });

const requiredEnv = (name: string): string => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
};

const resolveAiProvider = (openAiModel: string): AiProvider => {
  const requested =
    Deno.env.get("READING_DIGEST_AI_PROVIDER")?.trim().toLowerCase() ?? "auto";
  if (!["auto", "openai", "openrouter"].includes(requested)) {
    throw new Error(
      "READING_DIGEST_AI_PROVIDER must be auto, openai, or openrouter.",
    );
  }

  const openAiApiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
  const openRouterApiKey = Deno.env.get("OPENROUTER_API_KEY")?.trim();

  // Prefer gpt-4o-mini if requested model is generic or heavy or gpt-5.6
  const targetModel = (!openAiModel || openAiModel === "gpt-5.6" || openAiModel === "gpt-4o")
    ? "gpt-4o-mini"
    : openAiModel;

  if (
    (requested === "auto" || requested === "openrouter") && openRouterApiKey
  ) {
    return {
      name: "openrouter",
      apiKey: openRouterApiKey,
      // Use the standard Chat Completions endpoint — the Responses API
      // endpoint (/api/v1/responses) requires a separate key permission tier
      // and was causing 403 "Key limit exceeded" errors.
      endpoint: "https://openrouter.ai/api/v1/chat/completions",
      model: Deno.env.get("READING_DIGEST_OPENROUTER_MODEL")?.trim() ||
        "openai/gpt-4o-mini",
      fallbackModel:
        Deno.env.get("READING_DIGEST_OPENROUTER_FALLBACK_MODEL")?.trim() ||
        "openai/gpt-4o-mini",
    };
  }

  if ((requested === "auto" || requested === "openai") && openAiApiKey) {
    return {
      name: "openai",
      apiKey: openAiApiKey,
      endpoint: "https://api.openai.com/v1/responses",
      model: targetModel,
      fallbackModel: "gpt-4o-mini",
    };
  }

  const expected = requested === "openrouter"
    ? "OPENROUTER_API_KEY"
    : requested === "openai"
    ? "OPENAI_API_KEY"
    : "OPENAI_API_KEY or OPENROUTER_API_KEY";
  throw new Error(`Missing ${expected}.`);
};

const timingSafeEqual = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
};

const localDateParts = (now: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const date = `${value("year")}-${value("month")}-${value("day")}`;
  return { date, asUtcDate: new Date(`${date}T00:00:00Z`) };
};

const authorize = async (
  request: Request,
  database: SupabaseClient,
): Promise<boolean> => {
  const suppliedCronSecret = request.headers.get("x-cron-secret") ?? "";
  const cronSecret = Deno.env.get("READING_DIGEST_CRON_SECRET") ?? "";
  if (
    cronSecret && suppliedCronSecret &&
    timingSafeEqual(suppliedCronSecret, cronSecret)
  ) return true;

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  if (!token) return false;

  const { data: authData, error: authError } = await database.auth.getUser(
    token,
  );
  if (authError || !authData.user) return false;

  const { data: profile } = await database
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();
  return profile?.role === "admin";
};

// ── OpenAI Responses API helpers ─────────────────────────────────────────────
const extractOpenAiText = (response: Record<string, unknown>): string => {
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output as Array<Record<string, unknown>>) {
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const content of item.content as Array<Record<string, unknown>>) {
      if (content.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }
  throw new Error("OpenAI returned no output text.");
};

const extractOpenAiMetadata = (response: Record<string, unknown>) => {
  const output = Array.isArray(response.output) ? response.output : [];
  const citations: Array<{ url: string; title?: string }> = [];
  const searches: unknown[] = [];
  for (const item of output as Array<Record<string, unknown>>) {
    if (item.type === "web_search_call") {
      searches.push(item.action ?? { status: item.status });
    }
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const content of item.content as Array<Record<string, unknown>>) {
      if (!Array.isArray(content.annotations)) continue;
      for (
        const annotation of content.annotations as Array<
          Record<string, unknown>
        >
      ) {
        if (
          annotation.type === "url_citation" &&
          typeof annotation.url === "string"
        ) {
          citations.push({
            url: annotation.url,
            title: typeof annotation.title === "string"
              ? annotation.title
              : undefined,
          });
        }
      }
    }
  }
  return { citations, searches };
};

// ── OpenRouter Chat Completions helpers ───────────────────────────────────────
const extractChatText = (response: Record<string, unknown>): string => {
  const choices = Array.isArray(response.choices) ? response.choices : [];
  for (const choice of choices as Array<Record<string, unknown>>) {
    const message = choice.message as Record<string, unknown> | undefined;
    if (typeof message?.content === "string" && message.content.trim()) {
      return message.content.trim();
    }
  }
  throw new Error("OpenRouter Chat Completions returned no content.");
};

const extractChatMetadata = (response: Record<string, unknown>) => {
  const citations: Array<{ url: string; title?: string }> = [];
  const searches: unknown[] = [];
  const choices = Array.isArray(response.choices) ? response.choices : [];
  for (const choice of choices as Array<Record<string, unknown>>) {
    const message = choice.message as Record<string, unknown> | undefined;
    if (!Array.isArray(message?.annotations)) continue;
    for (const annotation of message.annotations as Array<Record<string, unknown>>) {
      if (annotation.type !== "url_citation") continue;
      const nested = annotation.url_citation as Record<string, unknown> | undefined;
      const url = typeof nested?.url === "string"
        ? nested.url
        : typeof annotation.url === "string"
        ? annotation.url
        : "";
      if (url) {
        const title = typeof nested?.title === "string"
          ? nested.title
          : typeof annotation.title === "string"
          ? annotation.title
          : undefined;
        citations.push({
          url,
          title,
        });
      }
    }
  }
  const usage = response.usage as Record<string, unknown> | undefined;
  const serverToolUse = usage?.server_tool_use as Record<string, unknown> | undefined;
  if (typeof serverToolUse?.web_search_requests === "number") {
    searches.push({ requests: serverToolUse.web_search_requests });
  }
  return { citations, searches };
};

const candidateSchema = (count: number) => ({
  type: "object",
  additionalProperties: false,
  required: ["candidates"],
  properties: {
    candidates: {
      type: "array",
      minItems: count,
      maxItems: count,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "source_name",
          "publication_date",
          "estimated_reading_minutes",
          "url",
          "why_it_matters",
          "topic_names",
          "relevance_score",
          "credibility_score",
        ],
        properties: {
          title: { type: "string" },
          source_name: { type: "string" },
          publication_date: {
            type: "string",
            pattern: "^\\d{4}-\\d{2}-\\d{2}$",
          },
          estimated_reading_minutes: {
            type: "integer",
            minimum: 1,
            maximum: 180,
          },
          url: { type: "string" },
          why_it_matters: { type: "string" },
          topic_names: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
          },
          relevance_score: { type: "number", minimum: 0, maximum: 100 },
          credibility_score: { type: "number", minimum: 0, maximum: 100 },
        },
      },
    },
  },
});

const discoverCandidates = async ({
  provider,
  topics,
  sourceRules,
  excludedUrls,
  excludedTitles,
  favoriteZones,
  recentLookbackDays,
  count,
  round,
  today,
}: {
  provider: AiProvider;
  topics: Array<{ name: string; description: string; weight: number }>;
  sourceRules: SourceRule[];
  excludedUrls: string[];
  excludedTitles: string[];
  favoriteZones?: string[];
  recentLookbackDays: number;
  count: number;
  round: number;
  today: string;
}) => {
  const model = round === 1 ? provider.model : provider.fallbackModel;
  const trusted = sourceRules.filter((rule) => rule.disposition === "trusted");
  const blocked = sourceRules.filter((rule) => rule.disposition === "blocked");
  let prompt =
    `Today is ${today}. Discover ${count} direct, authentic reading sources for Abodid's daily digest.

Research interest topics active for today's daily cluster:
${
      topics.map((topic) =>
        `- ${topic.name} (${topic.weight})${
          topic.description ? `: ${topic.description}` : ""
        }`
      ).join("\n")
    }

Trusted domains & high-credibility sources:
${
      trusted.map((source) =>
        `- ${source.domain}${source.name ? ` — ${source.name}` : ""}`
      ).join("\n") || "- No custom trusted domains configured"
    }

Never use these blocked domains or subdomains:
${
      blocked.map((source) => `- ${source.domain}`).join("\n") ||
      "- No custom blocked domains configured"
    }

Hard Search & Discovery Requirements:
- SUBSTACK, REDDIT & INDEPENDENT BLOGS FOCUS: Perform deep web search across Substack newsletters (site:substack.com), Reddit community threads (site:reddit.com), independent author blogs, Medium, e-flux, and critical research repositories (arXiv).
- DIVERSE DOMAIN MIX: Provide a balanced mix across multiple websites and platforms. Do NOT return more than 2 items from any single domain (e.g., max 2 from arXiv, max 2 from Substack, max 2 from Medium/Reddit).
- EXACT DIRECT URLS ONLY: You MUST provide the exact, authentic URL for every specific article or research paper title. Do NOT guess arXiv IDs or fabricate URL paths. Every URL will be verified live against the page's actual HTML title — mismatched or guessed URLs will be automatically rejected.
- NO GLOSSARY OR DICTIONARY TERMS: NEVER return Tate Glossary pages, museum dictionary entries, single-word term definitions (e.g. "Curator", "Site-Specific", "Institutional Critique"), or introductory encyclopedia pages.
- CRITICAL & ANALYTICAL ESSAYS ONLY: Only return deep, analytical, thought-provoking long-form essays, opinion pieces, community debates, and critical research papers that offer fresh perspectives.
- REQUIRED LIVE SEARCH: Use the hosted web-search tool before selecting candidates. Base every title and direct URL on returned search results, never model memory.
- LIVE VALID URL GUARANTEE: Perform real web search to verify every URL exists and is active right now. Never output dead links, 404s, broken URLs, generic homepages, search result pages, or tracking links.
- why_it_matters: Must be a single concise sentence (max 20 words) connecting directly to Abodid's creative and research practice without unsupported claims.
- Scores must reflect subject relevance and human/source credibility.
- Round ${round}: Every candidate must be distinct from all excluded items below.`;

  if (favoriteZones && favoriteZones.length > 0) {
    prompt += `\n\nUSER FAVORITES & UPVOTED ZONES:\nThe user strongly UPVOTED and loved articles in these exact zones:\n${favoriteZones.map((zone) => `- ${zone}`).join("\n")}\nPriority Instruction: Actively prioritize discovering similar articles, essays, and community discussions in these exact zones!`;
  }

  prompt += `\n\nAlready sent or considered URLs:\n${
    excludedUrls.slice(-500).map((url) => `- ${url}`).join("\n") || "- None"
  }\n\nAlready sent or considered titles:\n${
    excludedTitles.slice(-500).map((title) => `- ${title}`).join("\n") || "- None"
  }`;

  // Build the request body differently depending on which API format is in use.
  // OpenAI uses the Responses API; OpenRouter uses Chat Completions.
  let requestBody: Record<string, unknown>;
  if (provider.name === "openrouter") {
    // Chat Completions with OpenRouter's hosted web-search server tool.
    requestBody = {
      model,
      max_tokens: 6000,
      ...discoveryTooling(provider.name),
      messages: [
        {
          role: "system",
          content:
            "Act as a sharp, independent cultural critic and research curator. You must use the hosted web-search tool for live discovery and ground every candidate URL in its results. Strictly reject generic dictionary definitions, glossary entries, and museum term pages. Search across Substack newsletters, independent blogs, Reddit community debates, and critical essays, then return strictly schema-valid data without hallucinations. Always respond with valid JSON that matches the requested schema.",
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "reading_digest_candidates",
          strict: true,
          schema: candidateSchema(count),
        },
      },
    };
  } else {
    // OpenAI Responses API format
    requestBody = {
      model,
      store: false,
      max_output_tokens: 6000,
      reasoning: { effort: "low" },
      ...discoveryTooling(provider.name),
      instructions:
        "Act as a sharp, independent cultural critic and research curator. Strictly reject generic dictionary definitions, glossary entries, and museum term pages. Perform deep web searches across Substack newsletters, independent blogs, Reddit community debates, and critical essays, and return strictly schema-valid data without hallucinations.",
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "reading_digest_candidates",
          strict: true,
          schema: candidateSchema(count),
        },
      },
    };
  }

  const aiResponse = await fetch(provider.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
      ...(provider.name === "openrouter"
        ? { "HTTP-Referer": "https://abodid.com", "X-Title": "Abodid Reading Digest" }
        : {}),
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(170_000),
  });

  const payload = (await aiResponse.json()) as Record<string, unknown>;
  if (!aiResponse.ok) {
    const message = JSON.stringify(payload).slice(0, 1_500);
    throw new Error(
      `${provider.name} API failed (${aiResponse.status}): ${message}`,
    );
  }

  const rawText = provider.name === "openrouter"
    ? extractChatText(payload)
    : extractOpenAiText(payload);
  const parsed = JSON.parse(rawText) as {
    candidates?: DigestCandidate[];
  };
  return {
    candidates: Array.isArray(parsed.candidates) ? parsed.candidates : [],
    responseId: typeof payload.id === "string" ? payload.id : "",
    model,
    metadata: provider.name === "openrouter"
      ? extractChatMetadata(payload)
      : extractOpenAiMetadata(payload),
  };
};

const isArticleContent = (candidate: { title: string; url?: string; canonical_url?: string; estimated_reading_minutes?: number }): boolean => {
  const title = (candidate.title || "").trim();
  const wordCount = title.split(/\s+/).length;
  // Article titles must be descriptive sentences/phrases (4+ words). Short 1-3 word titles are usually dictionary terms or definitions.
  if (wordCount < 4) return false;

  // Minimum reading time for long-form essays, papers, and articles
  if ((candidate.estimated_reading_minutes || 0) < 3) return false;

  // Disallow common dictionary, glossary, index, or tag path patterns generically across all sites
  const url = (candidate.url || candidate.canonical_url || "").toLowerCase();
  if (/\/(?:glossary|dictionary|art-terms|terms|tags|category|topics|index)\b/.test(url)) {
    return false;
  }

  return true;
};

const promotionalReason = (candidate: DigestCandidate): string | null => {
  const value = `${candidate.title} ${candidate.source_name} ${candidate.url}`.toLowerCase();
  const patterns = [
    /\bpress release\b/,
    /\bsponsored\b/,
    /\btop \d+\b/,
    /\bbest \d+\b/,
    /\bproduct hunt\b/,
    /\bwe (?:are )?(?:launching|announce)\b/,
    /\bbuy now\b/,
  ];
  if (patterns.some((pattern) => pattern.test(value))) {
    return "Promotional or listicle-style material";
  }
  if (!isArticleContent(candidate)) {
    return "Non-article content (glossary definition, dictionary term, or short snippet)";
  }
  return null;
};

const verifyUrl = async (url: string) => {
  const headers = {
    Accept:
      "text/html,application/xhtml+xml,application/pdf,text/plain;q=0.8,*/*;q=0.2",
    "User-Agent": "AbodidReadingDigest/1.0 (+https://abodid.com)",
    Range: "bytes=0-262143",
  };
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers,
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    return {
      ok: false as const,
      reason: `URL request failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    };
  }

  const contentType =
    response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ??
      "";
  const finalUrl = canonicalizeUrl(response.url || url);
  const acceptableType = contentType.startsWith("text/") ||
    contentType === "application/pdf" ||
    contentType === "application/xhtml+xml" ||
    (!contentType &&
      new URL(response.url || url).pathname.toLowerCase().endsWith(".pdf"));
  let pageTitle = "";
  if (contentType.includes("html") || contentType.includes("xhtml") || contentType.includes("xml")) {
    try {
      const text = await response.text();
      const metaMatch = text.match(/<meta\s+(?:name|property)=["'](?:og:title|citation_title)["']\s+content=["']([^"']+)["']/i)
        || text.match(/<meta\s+content=["']([^"']+)["']\s+(?:name|property)=["'](?:og:title|citation_title)["']/i);
      if (metaMatch && metaMatch[1]) {
        pageTitle = metaMatch[1].trim();
      } else {
        const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
          pageTitle = titleMatch[1].trim();
        }
      }
    } catch {
      // Ignore text reading errors
    }
  } else {
    await response.body?.cancel().catch(() => undefined);
  }

  if (!response.ok || !finalUrl) {
    return {
      ok: false as const,
      reason: `URL returned HTTP ${response.status}`,
      httpStatus: response.status,
      contentType,
      pageTitle,
    };
  }
  if (!acceptableType) {
    return {
      ok: false as const,
      reason: `Unsupported content type: ${contentType || "unknown"}`,
      httpStatus: response.status,
      contentType,
      pageTitle,
    };
  }
  return {
    ok: true as const,
    finalUrl,
    httpStatus: response.status,
    contentType,
    pageTitle,
  };
};

const inChunks = async <T, R>(
  items: T[],
  size: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> => {
  const output: R[] = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(
      ...(await Promise.all(items.slice(index, index + size).map(worker))),
    );
  }
  return output;
};

const sendWithResend = async ({
  apiKey,
  settings,
  recipient,
  subject,
  html,
  idempotencyKey,
}: {
  apiKey: string;
  settings: DigestSettings;
  recipient: string;
  subject: string;
  html: string;
  idempotencyKey: string;
}) => {
  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: `${settings.sender_name} <${settings.sender_email}>`,
      to: [recipient],
      subject,
      html,
      ...(settings.reply_to_email ? { reply_to: settings.reply_to_email } : {}),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const payload = (await resendResponse.json()) as {
    id?: string;
    message?: string;
    name?: string;
  };
  if (!resendResponse.ok || !payload.id) {
    throw new Error(
      `Resend failed (${resendResponse.status}): ${
        payload.message ?? payload.name ?? "unknown error"
      }`,
    );
  }
  return payload.id;
};

const markRunFailed = async (
  database: SupabaseClient,
  runId: string,
  error: unknown,
) => {
  const message = error instanceof Error ? error.message : String(error);
  await database
    .from("reading_digest_runs")
    .update({
      status: "failed",
      finished_at: new Date().toISOString(),
      error_message: message.slice(0, 2_000),
    })
    .eq("id", runId);
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let database: SupabaseClient;
  try {
    database = createClient(
      requiredEnv("SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
  } catch (error) {
    return json({
      error: error instanceof Error
        ? error.message
        : "Server configuration is incomplete.",
    }, 500);
  }

  if (!(await authorize(request, database))) {
    return json({ error: "Unauthorized" }, 401);
  }

  let input: { trigger?: string; force?: boolean; articles?: Array<Record<string, unknown>> } = {};
  try {
    input = await request.json();
  } catch {
    input = {};
  }

  // ── Shared helper: fetch top-5 articles from DB + render HTML ────────────
  const buildTestEmailPayload = async (
    testSettings: DigestSettings,
    digestDate: string,
    subjectPrefix: string,
  ) => {
    let selected: VerifiedDigestCandidate[] = [];

    // Priority 0: Render exact articles currently displayed on active Reader's Digest screen
    if (input.articles && Array.isArray(input.articles) && input.articles.length > 0) {
      selected = input.articles.map((row) => ({
        title: String(row.title ?? ""),
        source_name: String(row.source_name ?? ""),
        source_domain: String(row.source_domain ?? ""),
        publication_date: String(row.publication_date ?? ""),
        estimated_reading_minutes: Number(row.estimated_reading_minutes ?? 5),
        url: String(row.url ?? row.canonical_url ?? ""),
        canonical_url: String(row.canonical_url ?? ""),
        why_it_matters: String(row.why_it_matters ?? ""),
        topic_names: Array.isArray(row.topic_names) ? row.topic_names as string[] : [],
        relevance_score: Number(row.relevance_score ?? 70),
        credibility_score: Number(row.credibility_score ?? 70),
        rank_score: Number(row.rank_score ?? 0),
        is_foundational: Boolean(row.is_foundational),
        normalized_title: String(row.normalized_title ?? ""),
        verification_status: "verified" as const,
        http_status: Number(row.http_status ?? 200),
        content_type: String(row.content_type ?? "text/html"),
      }));
    }

    // Priority 1: Check the latest delivered issue (guarantees preview matches the active delivered newsletter 100%)
    if (selected.length < 1) {
      const { data: latestDelivery } = await database
        .from("reading_digest_deliveries")
        .select("created_at, reading_digest_delivery_items(position, reading_digest_readings(*))")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestDelivery?.reading_digest_delivery_items?.length) {
        const items = (latestDelivery.reading_digest_delivery_items as Array<Record<string, unknown>>)
          .sort((a, b) => Number(a.position) - Number(b.position))
          .map((item) => item.reading_digest_readings as Record<string, unknown>)
          .filter(Boolean);

        selected = items.map((row) => ({
          title: String(row.title ?? ""),
          source_name: String(row.source_name ?? ""),
          source_domain: String(row.source_domain ?? ""),
          publication_date: String(row.publication_date ?? ""),
          estimated_reading_minutes: Number(row.estimated_reading_minutes ?? 5),
          url: String(row.url ?? row.canonical_url ?? ""),
          canonical_url: String(row.canonical_url ?? ""),
          why_it_matters: String(row.why_it_matters ?? ""),
          topic_names: Array.isArray(row.topic_names) ? row.topic_names as string[] : [],
          relevance_score: Number(row.relevance_score ?? 70),
          credibility_score: Number(row.credibility_score ?? 70),
          rank_score: Number(row.rank_score ?? 0),
          is_foundational: Boolean(row.is_foundational),
          normalized_title: String(row.normalized_title ?? ""),
          verification_status: "verified" as const,
          http_status: Number(row.http_status ?? 200),
          content_type: String(row.content_type ?? "text/html"),
        }));
      }
    }

    // Step 2: Fallback to candidate pool if no delivery exists yet
    if (selected.length < 1) {
      const { data: candidateRows } = await database
        .from("reading_digest_readings")
        .select(
          "id, url, canonical_url, title, normalized_title, source_name, source_domain, publication_date, estimated_reading_minutes, why_it_matters, topic_names, relevance_score, credibility_score, rank_score, is_foundational, verification_status, http_status, content_type, first_discovered_at",
        )
        .eq("verification_status", "verified")
        .not("status", "eq", "rejected")
        .order("first_discovered_at", { ascending: false })
        .limit(30);

      const pool = (candidateRows ?? [])
        .map((row) => ({
          title: String(row.title ?? ""),
          source_name: String(row.source_name ?? ""),
          source_domain: String(row.source_domain ?? ""),
          publication_date: String(row.publication_date ?? ""),
          estimated_reading_minutes: Number(row.estimated_reading_minutes ?? 5),
          url: String(row.url ?? row.canonical_url ?? ""),
          canonical_url: String(row.canonical_url ?? ""),
          why_it_matters: String(row.why_it_matters ?? ""),
          topic_names: Array.isArray(row.topic_names) ? row.topic_names as string[] : [],
          relevance_score: Number(row.relevance_score ?? 70),
          credibility_score: Number(row.credibility_score ?? 70),
          rank_score: Number(row.rank_score ?? 0),
          is_foundational: Boolean(row.is_foundational),
          normalized_title: String(row.normalized_title ?? ""),
          verification_status: "verified" as const,
          http_status: Number(row.http_status ?? 200),
          content_type: String(row.content_type ?? "text/html"),
        }))
        .filter(isArticleContent);

      const now = new Date();
      selected = selectExactlyFive(pool, now);
      if (selected.length !== 5) selected = pool.slice(0, 5) as typeof selected;
    }

    if (selected.length < 1) {
      throw new Error(
        "No verified articles in the database yet. Run a full digest first to populate the article pool.",
      );
    }

    const subject = digestSubject(testSettings.recipient_name, digestDate);
    const html = renderDigestHtml({
      items: selected,
      recipientName: testSettings.recipient_name,
      digestDate,
      isTest: true,
    });

    return { selected, subject, html };
  };

  // ── Preview-email path (returns HTML, does NOT send) ──────────────────────
  if (input.trigger === "preview_email") {
    try {
      const { data: settingsRow, error: settingsErr } = await database
        .from("reading_digest_settings")
        .select("*")
        .eq("id", true)
        .single();
      if (settingsErr || !settingsRow) {
        return json({ error: "Reading digest settings are unavailable." }, 500);
      }
      const testSettings = settingsRow as DigestSettings;
      const now = new Date();
      const digestDate = now.toISOString().slice(0, 10);
      const { selected, subject, html } = await buildTestEmailPayload(
        testSettings,
        digestDate,
        "[PREVIEW]",
      );
      return json({
        ok: true,
        subject,
        html,
        articles: selected.map((a) => ({ title: a.title, source_domain: a.source_domain, url: a.url })),
        recipient: testSettings.recipient_email,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return json({ error: message }, 500);
    }
  }

  // ── Fast test-email path (sends immediately) ──────────────────────────────
  // Skips OpenRouter discovery entirely. Picks the top 5 already-discovered
  // articles from the DB and sends them via Resend as a preview email.
  if (input.trigger === "test_email") {
    try {
      const { data: settingsRow, error: settingsErr } = await database
        .from("reading_digest_settings")
        .select("*")
        .eq("id", true)
        .single();
      if (settingsErr || !settingsRow) {
        return json({ error: "Reading digest settings are unavailable." }, 500);
      }
      const testSettings = settingsRow as DigestSettings;
      if (!testSettings.recipient_email) {
        return json({ error: "Set a recipient email in the dashboard first." }, 400);
      }
      const now = new Date();
      const digestDate = now.toISOString().slice(0, 10);
      const { subject, html } = await buildTestEmailPayload(
        testSettings,
        digestDate,
        "[TEST]",
      );
      const resendApiKey = requiredEnv("RESEND_API_KEY");
      const idempotencyKey = `test-email/${crypto.randomUUID()}`;
      const resendEmailId = await sendWithResend({
        apiKey: resendApiKey,
        settings: testSettings,
        recipient: testSettings.recipient_email,
        subject,
        html,
        idempotencyKey,
      });
      return json({
        ok: true,
        status: "sent",
        test: true,
        resend_email_id: resendEmailId,
        recipient: testSettings.recipient_email,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return json({ error: message }, 500);
    }
  }
  // ── End fast-path blocks ──────────────────────────────────────────────────

  const triggerSource = input.trigger === "cron"
    ? "cron"
    : input.trigger === "manual"
    ? "manual"
    : "dashboard";
  const force = input.force === true;
  const now = new Date();

  const { data: settingsData, error: settingsError } = await database
    .from("reading_digest_settings")
    .select("*")
    .eq("id", true)
    .single();
  if (settingsError || !settingsData) {
    return json({ error: "Reading digest settings are unavailable." }, 500);
  }
  const settings = settingsData as DigestSettings;
  const local = localDateParts(now, settings.timezone);
  const runKey = force
    ? `${triggerSource}:${crypto.randomUUID()}`
    : `scheduled:${local.date}`;

  const { data: insertedRun, error: runInsertError } = await database
    .from("reading_digest_runs")
    .insert({
      run_key: runKey,
      trigger_source: triggerSource,
      status: "running",
    })
    .select("id, run_key, status")
    .single();

  let run = insertedRun as RunRow | null;
  if (runInsertError?.code === "23505") {
    const { data: existingRun } = await database
      .from("reading_digest_runs")
      .select("id, run_key, status")
      .eq("run_key", runKey)
      .single();
    if (!existingRun) {
      return json({ error: "Could not inspect the existing run." }, 500);
    }
    if (existingRun.status !== "failed") {
      return json({
        ok: true,
        status: existingRun.status,
        message: "This digest run has already been claimed.",
      });
    }
    run = existingRun as RunRow;
    await database
      .from("reading_digest_runs")
      .update({ status: "running", finished_at: null, error_message: null })
      .eq("id", run.id);
  } else if (runInsertError || !run) {
    return json({
      error: runInsertError?.message ?? "Could not create the digest run.",
    }, 500);
  }

  try {
    if (!settings.recipient_email) {
      throw new Error(
        "Set a recipient email in the dashboard before running the digest.",
      );
    }

    const { data: resumableDelivery } = await database
      .from("reading_digest_deliveries")
      .select(
        "id, recipient_email, subject, html, idempotency_key, resend_email_id",
      )
      .eq("run_id", run.id)
      .maybeSingle();
    if (resumableDelivery) {
      const { count: reservedCount } = await database
        .from("reading_digest_delivery_items")
        .select("reading_id", { count: "exact", head: true })
        .eq("delivery_id", resumableDelivery.id);
      if (reservedCount !== 5) {
        throw new Error(
          "The failed delivery does not have exactly five reserved items and cannot be resumed safely.",
        );
      }
      const resendEmailId = resumableDelivery.resend_email_id ||
        await sendWithResend({
          apiKey: requiredEnv("RESEND_API_KEY"),
          settings,
          recipient: resumableDelivery.recipient_email,
          subject: resumableDelivery.subject,
          html: resumableDelivery.html,
          idempotencyKey: resumableDelivery.idempotency_key,
        });
      await database
        .from("reading_digest_deliveries")
        .update({ resend_email_id: resendEmailId, status: "sending" })
        .eq("id", resumableDelivery.id);
      const { error: resumeError } = await database.rpc(
        "reading_digest_finalize_delivery",
        {
          p_delivery_id: resumableDelivery.id,
          p_resend_email_id: resendEmailId,
        },
      );
      if (resumeError) {
        throw new Error(
          `Could not finalise the resumed delivery: ${resumeError.message}`,
        );
      }
      return json({
        ok: true,
        status: "sent",
        resumed: true,
        run_id: run.id,
        delivery_id: resumableDelivery.id,
      });
    }

    if (
      (!settings.enabled ||
        !shouldDeliverToday(
          settings.frequency,
          settings.weekly_delivery_day,
          local.asUtcDate,
        )) && !force
    ) {
      await database
        .from("reading_digest_runs")
        .update({
          status: "skipped",
          finished_at: new Date().toISOString(),
          metadata: { reason: "delivery_frequency" },
        })
        .eq("id", run.id);
      return json({
        ok: true,
        status: "skipped",
        reason: "Delivery frequency is not due today.",
      });
    }

    const aiProvider = resolveAiProvider(settings.openai_model);
    const resendApiKey = requiredEnv("RESEND_API_KEY");

    const [
      { data: topicRows, error: topicError },
      { data: sourceRows, error: sourceError },
    ] = await Promise.all([
      database
        .from("reading_digest_topics")
        .select("name, description, weight")
        .eq("active", true)
        .order("weight", { ascending: false }),
      database
        .from("reading_digest_sources")
        .select("domain, name, disposition, notes")
        .eq("active", true),
    ]);
    if (topicError || sourceError) {
      throw new Error(
        topicError?.message ?? sourceError?.message ??
          "Could not load preferences.",
      );
    }
    if (!topicRows?.length) {
      throw new Error("At least one active topic is required.");
    }

    const { data: sentRows, error: sentError } = await database
      .from("reading_digest_readings")
      .select("canonical_url, title")
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
      .limit(1_000);
    if (sentError) throw new Error(sentError.message);

    const { data: feedbackRows } = await database
      .from("reading_digest_feedback")
      .select("signal, reading_digest_readings!inner(source_domain, title, topic_names)")
      .limit(1_000);
    const sourcePreferences = new Map<string, number>();
    const favoriteZones: string[] = [];
    for (const row of feedbackRows ?? []) {
      const relation = (row as Record<string, unknown>)
        .reading_digest_readings as
          | { source_domain?: string; title?: string; topic_names?: string[] }
          | Array<{ source_domain?: string; title?: string; topic_names?: string[] }>;
      const item = Array.isArray(relation) ? relation[0] : relation;
      const domain = item?.source_domain;
      if (!domain) continue;
      const signal = (row as { signal: string }).signal;
      const adjustment = (signal === "helpful" || signal === "useful")
        ? 5
        : signal === "read"
        ? 2
        : signal === "not_for_me"
        ? -12
        : -5;
      sourcePreferences.set(
        domain,
        (sourcePreferences.get(domain) ?? 0) + adjustment,
      );

      if ((signal === "helpful" || signal === "useful") && item?.title) {
        const topicsText = item.topic_names && item.topic_names.length > 0 ? ` [Topics: ${item.topic_names.join(", ")}]` : "";
        favoriteZones.push(`"${item.title}"${topicsText}`);
      }
    }

    const allTopics = (topicRows as Array<{ name: string; description: string; weight: number }>).map((topic) => ({
      ...topic,
      weight: Number(topic.weight),
    }));
    const topics = filterTopicsForDay(allTopics, local.asUtcDate);
    const sourceRules = (sourceRows ?? []) as SourceRule[];
    const trustedDomains = sourceRules.filter((rule) =>
      rule.disposition === "trusted"
    ).map((rule) => rule.domain);
    const blockedDomains = sourceRules.filter((rule) =>
      rule.disposition === "blocked"
    ).map((rule) => rule.domain);
    const excludedUrls = new Set<string>(
      (sentRows ?? []).map((row: { canonical_url: string }) => row.canonical_url),
    );
    const excludedTitles = new Set<string>((sentRows ?? []).map((row: { title: string }) => row.title));
    const sentTitles = [...excludedTitles];
    const eligibleByUrl = new Map<
      string,
      VerifiedDigestCandidate & { reading_id: string }
    >();
    const responseIds: string[] = [];
    const usedModels = new Set<string>();
    const discoveryMetadata: unknown[] = [];
    let discoveredCount = 0;
    let verifiedCount = 0;

    for (let round = 1; round <= 2 && eligibleByUrl.size < 5; round += 1) {
      const discovery = await discoverCandidates({
        provider: aiProvider,
        topics,
        sourceRules,
        excludedUrls: [...excludedUrls],
        excludedTitles: [...excludedTitles],
        favoriteZones,
        recentLookbackDays: settings.recent_lookback_days,
        count: round === 1 ? 16 : 10,
        round,
        today: local.date,
      });
      if (discovery.responseId) responseIds.push(discovery.responseId);
      usedModels.add(discovery.model);
      discoveryMetadata.push(discovery.metadata);
      discoveredCount += discovery.candidates.length;

      const prepared = discovery.candidates.map((candidate) => {
        const canonical = canonicalizeUrl(candidate.url);
        const domain = canonical ? domainFromUrl(canonical) : "";
        let reason: string | null = null;
        if (!canonical || !domain) reason = "Invalid source URL";
        else if (!isIsoDate(candidate.publication_date)) {
          reason = "Publication date could not be verified";
        } else if (
          new Date(`${candidate.publication_date}T00:00:00Z`) >
            new Date(now.getTime() + 2 * 86_400_000)
        ) reason = "Publication date is in the future";
        else if (
          blockedDomains.some((blocked) => domainMatches(domain, blocked))
        ) reason = "Blocked source";
        else if (excludedUrls.has(canonical)) {
          reason = "Previously sent or already considered URL";
        } else if (
          sentTitles.some((title: string) =>
            titleSimilarity(candidate.title, title) >= 0.82
          )
        ) reason = "Duplicate of a previously sent title";
        else reason = promotionalReason(candidate);
        return { candidate, canonical, domain, reason };
      });

      const checked = await inChunks(prepared, 4, async (entry) => {
        if (entry.reason || !entry.canonical) {
          return { ...entry, verification: null };
        }
        return { ...entry, verification: await verifyUrl(entry.canonical) };
      });

      for (const entry of checked) {
        const candidate = entry.candidate;
        const preliminaryCanonical = entry.canonical;
        if (!preliminaryCanonical || !isIsoDate(candidate.publication_date)) {
          continue;
        }

        let rejectionReason = entry.reason;
        let canonical = preliminaryCanonical;
        let domain = entry.domain;
        let verificationStatus:
          | "verified"
          | "broken"
          | "blocked"
          | "duplicate"
          | "unverifiable" = "unverifiable";
        let httpStatus: number | null = null;
        let contentType: string | null = null;

        if (!rejectionReason && entry.verification?.ok) {
          canonical = entry.verification.finalUrl;
          domain = domainFromUrl(canonical);
          httpStatus = entry.verification.httpStatus;
          contentType = entry.verification.contentType;

          // Verify page title matches candidate title (detects hallucinated URLs)
          if (entry.verification.pageTitle) {
            const similarity = titleSimilarity(candidate.title, entry.verification.pageTitle);
            if (similarity < 0.22) {
              rejectionReason = `URL content title mismatch (page title: "${entry.verification.pageTitle.slice(0, 50)}")`;
              verificationStatus = "broken";
            }
          }

          if (!rejectionReason) {
            if (
              blockedDomains.some((blocked) => domainMatches(domain, blocked))
            ) {
              rejectionReason = "Redirected to a blocked source";
              verificationStatus = "blocked";
            } else if (excludedUrls.has(canonical)) {
              rejectionReason =
                "Redirected to a previously sent or considered URL";
              verificationStatus = "duplicate";
            } else {
              verificationStatus = "verified";
            }
          }
        } else if (
          !rejectionReason && entry.verification && !entry.verification.ok
        ) {
          rejectionReason = entry.verification.reason;
          verificationStatus = "broken";
          httpStatus = entry.verification.httpStatus ?? null;
          contentType = entry.verification.contentType ?? null;
        } else if (rejectionReason === "Blocked source") {
          verificationStatus = "blocked";
        } else if (
          rejectionReason?.toLowerCase().includes("duplicate") ||
          rejectionReason?.includes("Previously sent")
        ) {
          verificationStatus = "duplicate";
        }

        if (
          verificationStatus === "verified" &&
          [...eligibleByUrl.values()].some((existingCandidate) =>
            titleSimilarity(candidate.title, existingCandidate.title) >= 0.82
          )
        ) {
          rejectionReason = "Duplicate title within this discovery run";
          verificationStatus = "duplicate";
        }

        const normalizedTitle = normalizeTitle(candidate.title);
        const trusted = trustedDomains.some((trustedDomain) =>
          domainMatches(domain, trustedDomain)
        );
        const rankScore = scoreCandidate({
          candidate,
          trusted,
          sourcePreference: Math.max(
            -15,
            Math.min(10, sourcePreferences.get(domain) ?? 0),
          ),
          now,
        });
        const why = limitWords(candidate.why_it_matters, 20);
        const row = {
          url: entry.verification?.ok
            ? entry.verification.finalUrl
            : candidate.url,
          canonical_url: canonical,
          title: candidate.title.trim().slice(0, 500),
          normalized_title: normalizedTitle,
          source_name: candidate.source_name.trim().slice(0, 200) || domain,
          source_domain: domain,
          publication_date: candidate.publication_date,
          estimated_reading_minutes: Math.max(
            1,
            Math.min(180, Math.round(candidate.estimated_reading_minutes)),
          ),
          why_it_matters: why,
          topic_names: candidate.topic_names.map((topic) => topic.trim())
            .filter(Boolean).slice(0, 12),
          relevance_score: Math.max(
            0,
            Math.min(100, Number(candidate.relevance_score) || 0),
          ),
          credibility_score: Math.max(
            0,
            Math.min(100, Number(candidate.credibility_score) || 0),
          ),
          rank_score: rankScore,
          is_foundational: false,
          verification_status: verificationStatus,
          http_status: httpStatus,
          content_type: contentType,
          status: verificationStatus === "verified" ? "discovered" : "rejected",
          rejection_reason: rejectionReason,
          last_discovered_at: new Date().toISOString(),
          discovery_run_id: run.id,
          metadata: {
            openai_response_id: discovery.responseId,
            ai_provider: aiProvider.name,
            ai_model: discovery.model,
            trusted_source: trusted,
          },
        };

        const { data: existing } = await database
          .from("reading_digest_readings")
          .select("id, status")
          .eq("canonical_url", canonical)
          .maybeSingle();
        let readingId = existing?.id as string | undefined;
        let readingStatus = existing?.status as string | undefined;
        if (existing) {
          const safeUpdate =
            existing.status === "sent" || existing.status === "selected"
              ? {
                last_discovered_at: row.last_discovered_at,
                discovery_run_id: run.id,
                metadata: row.metadata,
              }
              : row;
          await database.from("reading_digest_readings").update(safeUpdate).eq(
            "id",
            existing.id,
          );
        } else {
          const { data: inserted, error: insertError } = await database
            .from("reading_digest_readings")
            .insert(row)
            .select("id, status")
            .single();
          if (insertError) {
            throw new Error(
              `Could not store discovered reading: ${insertError.message}`,
            );
          }
          readingId = inserted.id;
          readingStatus = inserted.status;
        }

        excludedUrls.add(canonical);
        excludedTitles.add(candidate.title);
        if (
          verificationStatus !== "verified" || readingStatus === "sent" ||
          readingStatus === "selected" || !readingId
        ) continue;
        verifiedCount += 1;
        eligibleByUrl.set(canonical, {
          ...candidate,
          title: row.title,
          source_name: row.source_name,
          estimated_reading_minutes: row.estimated_reading_minutes,
          why_it_matters: why,
          topic_names: row.topic_names,
          canonical_url: canonical,
          source_domain: domain,
          normalized_title: normalizedTitle,
          rank_score: rankScore,
          verification_status: "verified",
          http_status: httpStatus ?? 200,
          content_type: contentType ?? "",
          url: row.url,
          reading_id: readingId,
        });
      }
    }

    const selected = selectExactlyFive(
      [...eligibleByUrl.values()],
      now,
    ) as Array<VerifiedDigestCandidate & { reading_id: string }>;
    if (selected.length !== 5) {
      throw new Error(
        `Only ${eligibleByUrl.size} verified, non-repeated readings remained; refusing to send anything other than exactly five.`,
      );
    }

    const subject = digestSubject(settings.recipient_name, local.date);
    const html = renderDigestHtml({
      items: selected,
      recipientName: settings.recipient_name,
      digestDate: local.date,
    });
    const idempotencyKey = `reading-digest/${run.run_key}`.slice(0, 256);

    const { data: delivery, error: deliveryError } = await database
      .from("reading_digest_deliveries")
      .insert({
        run_id: run.id,
        delivery_date: local.date,
        recipient_email: settings.recipient_email,
        subject,
        status: "preparing",
        idempotency_key: idempotencyKey,
        html,
      })
      .select("id")
      .single();
    if (deliveryError) {
      throw new Error(`Could not prepare delivery: ${deliveryError.message}`);
    }

    const { error: itemError } = await database.from(
      "reading_digest_delivery_items",
    ).insert(
      selected.map((item, index) => ({
        delivery_id: delivery.id,
        reading_id: item.reading_id,
        position: index + 1,
        is_read_first: index === 0,
      })),
    );
    if (itemError) {
      throw new Error(`Could not reserve delivery items: ${itemError.message}`);
    }

    await Promise.all([
      database
        .from("reading_digest_readings")
        .update({ status: "selected", selected_at: new Date().toISOString() })
        .in("id", selected.map((item) => item.reading_id)),
      database
        .from("reading_digest_deliveries")
        .update({ status: "sending", attempted_at: new Date().toISOString() })
        .eq("id", delivery.id),
      database
        .from("reading_digest_runs")
        .update({
          discovered_count: discoveredCount,
          verified_count: verifiedCount,
          selected_count: 5,
          openai_response_ids: responseIds,
          metadata: {
            ai_provider: aiProvider.name,
            ai_models: [...usedModels],
            discovery: discoveryMetadata,
          },
        })
        .eq("id", run.id),
    ]);

    const resendEmailId = await sendWithResend({
      apiKey: resendApiKey,
      settings,
      recipient: settings.recipient_email,
      subject,
      html,
      idempotencyKey,
    });
    await database
      .from("reading_digest_deliveries")
      .update({ resend_email_id: resendEmailId, status: "sending" })
      .eq("id", delivery.id);

    const { error: finalizeError } = await database.rpc(
      "reading_digest_finalize_delivery",
      {
        p_delivery_id: delivery.id,
        p_resend_email_id: resendEmailId,
      },
    );
    if (finalizeError) {
      throw new Error(
        `Email sent, but database finalisation failed: ${finalizeError.message}`,
      );
    }

    return json({
      ok: true,
      status: "sent",
      run_id: run.id,
      delivery_id: delivery.id,
      resend_email_id: resendEmailId,
      selected_count: 5,
    });
  } catch (error) {
    await markRunFailed(database, run.id, error);
    const message = error instanceof Error ? error.message : String(error);
    const { data: failedDelivery } = await database
      .from("reading_digest_deliveries")
      .select("id")
      .eq("run_id", run.id)
      .maybeSingle();
    if (failedDelivery) {
      await database
        .from("reading_digest_deliveries")
        .update({ status: "failed", error_message: message.slice(0, 2_000) })
        .eq("id", failedDelivery.id);
    }
    console.error("daily-reading-digest failed", {
      runId: run.id,
      error: message,
    });
    return json({ error: message, run_id: run.id }, 500);
  }
});
