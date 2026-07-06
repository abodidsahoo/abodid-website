export const prerender = false;

import {
  createEmbedding,
  createSupabaseServiceClient,
  createVaultAnswer,
  extractKeywordTerms,
  getBooleanEnv,
  getRuntimeEnv,
  getVaultChatModel,
  getVaultEmbeddingModel,
  mergeRetrievedRows,
  rewriteVaultSearchQuery,
  serializeSource,
  truncateText,
} from "../../lib/vault-rag.js";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const DEFAULT_RATE_LIMIT = 12;
const rateLimitBuckets =
  globalThis.__vaultChatRateLimitBuckets ||
  (globalThis.__vaultChatRateLimitBuckets = new Map());

const SOURCE_COLUMNS =
  "id,note_id,note_title,file_path,folder_path,heading,chunk_index,chunk_text,tags";

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function getClientKey(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "anonymous"
  );
}

function checkRateLimit(request) {
  const now = Date.now();
  const key = getClientKey(request);
  const maxRequests = Number.parseInt(
    getRuntimeEnv("VAULT_CHAT_RATE_LIMIT_PER_MINUTE") || `${DEFAULT_RATE_LIMIT}`,
    10,
  );

  for (const [bucketKey, bucket] of rateLimitBuckets.entries()) {
    if (now - bucket.startedAt > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitBuckets.delete(bucketKey);
    }
  }

  const bucket = rateLimitBuckets.get(key);
  if (!bucket || now - bucket.startedAt > RATE_LIMIT_WINDOW_MS) {
    rateLimitBuckets.set(key, { startedAt: now, count: 1 });
    return { ok: true, remaining: Math.max(0, maxRequests - 1) };
  }

  if (bucket.count >= maxRequests) {
    return {
      ok: false,
      retryAfter: Math.ceil(
        (RATE_LIMIT_WINDOW_MS - (now - bucket.startedAt)) / 1000,
      ),
    };
  }

  bucket.count += 1;
  return { ok: true, remaining: Math.max(0, maxRequests - bucket.count) };
}

function normalizeFilters(rawFilters = {}) {
  const filters = rawFilters && typeof rawFilters === "object" ? rawFilters : {};
  const cleanString = (value, maxLength = 160) =>
    typeof value === "string" && value.trim()
      ? value.trim().slice(0, maxLength)
      : null;

  return {
    tag: cleanString(filters.tag)?.replace(/^#/, "") || null,
    folder: cleanString(filters.folder || filters.folder_path),
    filePath: cleanString(filters.filePath || filters.file_path, 300),
    publicOnly: filters.publicOnly !== false,
  };
}

function validateQuestion(value) {
  const question = typeof value === "string" ? value.trim() : "";
  if (question.length < 2) {
    return { error: "Ask a slightly longer question." };
  }
  if (question.length > 800) {
    return { error: "Please keep the question under 800 characters." };
  }
  return { question };
}

async function runKeywordSearch(supabase, question, filters, publicOnly) {
  const terms = extractKeywordTerms(question);
  if (!terms.length) return [];

  const orFilter = terms
    .flatMap((term) => [
      `note_title.ilike.%${term}%`,
      `file_path.ilike.%${term}%`,
      `chunk_text.ilike.%${term}%`,
    ])
    .join(",");

  let query = supabase.from("obsidian_chunks").select(SOURCE_COLUMNS).limit(8);

  if (publicOnly) query = query.eq("is_public", true);
  if (filters.tag) query = query.contains("tags", [filters.tag]);
  if (filters.folder) query = query.ilike("folder_path", `${filters.folder}%`);
  if (filters.filePath) query = query.eq("file_path", filters.filePath);

  const { data, error } = await query.or(orFilter);
  if (error) {
    console.warn("[vault-chat] Keyword search failed:", error.message);
    return [];
  }

  return data || [];
}

function isMigrationError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("match_obsidian_chunks") ||
    message.includes("obsidian_chunks") ||
    message.includes("schema cache")
  );
}

function groupSourcesByNote(sources) {
  const groups = new Map();

  for (const source of sources) {
    if (!source.is_cited) continue;
    const key = source.note_id || source.href || source.note_title;
    if (!key) continue;

    if (!groups.has(key)) {
      groups.set(key, {
        note_id: source.note_id,
        note_title: source.note_title,
        href: source.href,
        citations: [],
      });
    }

    const group = groups.get(key);
    if (
      Number.isInteger(source.citation_number) &&
      !group.citations.includes(source.citation_number)
    ) {
      group.citations.push(source.citation_number);
    }
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    citations: group.citations.sort((a, b) => a - b),
  }));
}

function remapVisibleCitations(answer, sources) {
  const sourceByOriginalCitation = new Map();
  for (const source of sources) {
    if (Number.isInteger(source.citation_number)) {
      sourceByOriginalCitation.set(source.citation_number, source);
    }
  }

  const originalToVisible = new Map();
  let nextCitation = 1;
  const remappedAnswer = String(answer || "").replace(/\[(\d+)\]/g, (match, rawNumber) => {
    const originalNumber = Number.parseInt(rawNumber, 10);
    if (!sourceByOriginalCitation.has(originalNumber)) return match;

    if (!originalToVisible.has(originalNumber)) {
      originalToVisible.set(originalNumber, nextCitation);
      nextCitation += 1;
    }

    return `[${originalToVisible.get(originalNumber)}]`;
  });

  const remappedSources = sources.map((source) => {
    const originalCitation = source.citation_number;
    const visibleCitation = originalToVisible.get(originalCitation);
    return {
      ...source,
      retrieval_rank: originalCitation,
      citation_number: visibleCitation || null,
      is_cited: Number.isInteger(visibleCitation),
    };
  });

  return {
    answer: remappedAnswer,
    sources: remappedSources,
  };
}

export async function POST({ request }) {
  const rateLimit = checkRateLimit(request);
  if (!rateLimit.ok) {
    return jsonResponse(
      {
        error: "Too many vault questions. Please try again shortly.",
        retry_after_seconds: rateLimit.retryAfter,
      },
      429,
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON request body." }, 400);
  }

  const validation = validateQuestion(body.question || body.message);
  if (validation.error) {
    return jsonResponse({ error: validation.error }, 400);
  }

  const question = validation.question;
  const filters = normalizeFilters(body.filters);
  const allowPrivate = getRuntimeEnv("ALLOW_PRIVATE_VAULT_CHAT") === "true";
  const publicOnly = allowPrivate ? filters.publicOnly !== false : true;
  const rewriteEnabled = getBooleanEnv("VAULT_CHAT_ENABLE_QUERY_REWRITE", true);
  const allowModelKnowledgeFallback = getBooleanEnv(
    "VAULT_CHAT_ALLOW_MODEL_KNOWLEDGE",
    true,
  );
  const debugEnabled = Boolean(import.meta.env.DEV && body.debug);

  try {
    const supabase = createSupabaseServiceClient();

    const { error: readinessError } = await supabase
      .from("obsidian_chunks")
      .select("id")
      .limit(1);

    if (readinessError) throw readinessError;

    const rewriteResult = rewriteEnabled
      ? await rewriteVaultSearchQuery({
          question,
          history: body.history,
        })
      : {
          searchQuery: question,
          rewritten: false,
          model: null,
          outsideKnowledgeHint: null,
        };
    const searchQuery = rewriteResult.searchQuery || question;

    const questionEmbedding = await createEmbedding(searchQuery);

    const { data: vectorRows, error: vectorError } = await supabase.rpc(
      "match_obsidian_chunks",
      {
        query_embedding: questionEmbedding,
        match_count: 12,
        match_threshold: 0.16,
        public_only: publicOnly,
        tag_filter: filters.tag,
        folder_filter: filters.folder,
        file_path_filter: filters.filePath,
      },
    );

    if (vectorError) throw vectorError;

    const keywordRows = await runKeywordSearch(
      supabase,
      searchQuery,
      filters,
      publicOnly,
    );
    const rows = mergeRetrievedRows(vectorRows || [], keywordRows).slice(0, 12);

    if (!rows.length) {
      if (allowModelKnowledgeFallback) {
        const answerResult = await createVaultAnswer({
          question,
          rows: [],
          history: body.history,
          searchQuery,
          allowModelKnowledgeFallback,
          outsideKnowledgeHint: rewriteResult.outsideKnowledgeHint,
        });

        return jsonResponse({
          answer: answerResult.answer,
          sources: [],
          source_notes: [],
          ...(debugEnabled
            ? {
                debug: {
                  vector_matches: 0,
                  keyword_matches: keywordRows.length,
                  public_only: publicOnly,
                  embedding_model: getVaultEmbeddingModel(),
                  chat_model: answerResult.model || getVaultChatModel(),
                  query_rewrite: {
                    enabled: rewriteEnabled,
                    rewritten: rewriteResult.rewritten,
                    search_query: searchQuery,
                    model: rewriteResult.model,
                    used_history: rewriteResult.usedHistory || false,
                    outside_knowledge_hint:
                      rewriteResult.outsideKnowledgeHint || null,
                    error: rewriteResult.error || null,
                  },
                  model_knowledge_fallback: allowModelKnowledgeFallback,
                },
              }
            : {}),
        });
      }

      return jsonResponse({
        answer:
          "I could not find enough relevant public notes in the vault to answer that well.",
        sources: [],
        ...(debugEnabled
          ? {
              debug: {
                vector_matches: 0,
                keyword_matches: keywordRows.length,
                public_only: publicOnly,
                embedding_model: getVaultEmbeddingModel(),
                query_rewrite: {
                  enabled: rewriteEnabled,
                  rewritten: rewriteResult.rewritten,
                  search_query: searchQuery,
                  model: rewriteResult.model,
                  used_history: rewriteResult.usedHistory || false,
                  outside_knowledge_hint:
                    rewriteResult.outsideKnowledgeHint || null,
                  error: rewriteResult.error || null,
                },
              },
            }
          : {}),
      });
    }

    const answerResult = await createVaultAnswer({
      question,
      rows,
      history: body.history,
      searchQuery,
      allowModelKnowledgeFallback,
      outsideKnowledgeHint: rewriteResult.outsideKnowledgeHint,
    });

    const rawSources = rows.map((row, index) =>
      serializeSource(row, {
        citationNumber: index + 1,
        includeSimilarity: debugEnabled,
        excerptLength: 760,
      }),
    );
    const { answer, sources } = remapVisibleCitations(
      answerResult.answer,
      rawSources,
    );
    const sourceNotes = groupSourcesByNote(sources);

    return jsonResponse({
      answer,
      sources,
      source_notes: sourceNotes,
      ...(debugEnabled
        ? {
            debug: {
              vector_matches: (vectorRows || []).length,
              keyword_matches: keywordRows.length,
              public_only: publicOnly,
              embedding_model: getVaultEmbeddingModel(),
              chat_model: answerResult.model || getVaultChatModel(),
              usage: answerResult.usage,
              question: truncateText(question, 120),
              query_rewrite: {
                enabled: rewriteEnabled,
                rewritten: rewriteResult.rewritten,
                search_query: searchQuery,
                model: rewriteResult.model,
                used_history: rewriteResult.usedHistory || false,
                outside_knowledge_hint:
                  rewriteResult.outsideKnowledgeHint || null,
                error: rewriteResult.error || null,
              },
              model_knowledge_fallback: allowModelKnowledgeFallback,
            },
          }
        : {}),
    });
  } catch (error) {
    console.error("[vault-chat] Failed:", error);

    if (isMigrationError(error)) {
      return jsonResponse(
        {
          error:
            "The vault search database is not ready yet. Run sql/create_obsidian_chunks.sql in Supabase, then run npm run ingest:vault.",
        },
        503,
      );
    }

    return jsonResponse(
      {
        error: "Vault search failed. Please try again in a moment.",
        ...(import.meta.env.DEV
          ? { detail: error instanceof Error ? error.message : String(error) }
          : {}),
      },
      500,
    );
  }
}
