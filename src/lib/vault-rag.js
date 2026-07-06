import crypto from "node:crypto";
import matter from "gray-matter";
import { createClient } from "@supabase/supabase-js";

export const DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small";
export const DEFAULT_EMBEDDING_DIMENSIONS = 1536;
export const DEFAULT_CHAT_MODEL = "google/gemini-2.5-flash";
export const DEFAULT_CHAT_MODELS = [
  "google/gemini-2.5-flash",
  "openai/gpt-4.1-mini",
  "google/gemini-2.5-pro",
  "openai/gpt-4o-mini",
  "openai/gpt-4.1",
];
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const TOKEN_TARGET = 650;
const TOKEN_MIN = 90;
const TOKEN_MAX = 850;
const TOKEN_OVERLAP = 100;
const OPENROUTER_FREE_SUFFIX = ":" + "free";
const OPENROUTER_FREE_ROUTER = ["openrouter", "free"].join("/");
const SENSITIVE_CONTENT_PATTERNS = [
  ["openai_key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/i],
  ["resend_key", /\bre_[A-Za-z0-9_-]{16,}\b/i],
  [
    "credential_assignment",
    /\b(?:api[_\s-]*key|access[_\s-]*token|auth[_\s-]*token|bearer[_\s-]*token|client[_\s-]*secret|password)\b\s*[:=]\s*["'`]?[A-Za-z0-9_./+=:@-]{8,}/i,
  ],
  ["private_key_block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/i],
];

export const VAULT_SYSTEM_PROMPT =
  "You are answering from Abodid's Obsidian Vault. Use the provided note excerpts as the primary source of truth. The excerpts come from Markdown notes in the vault. Answer naturally and thoughtfully, but do not invent claims that are not supported by the retrieved notes. If the retrieved notes are insufficient, say that clearly. When explicitly allowed, you may add a brief section labeled 'Outside the vault:' for small general-world clarifications from model knowledge, but never present that as web-searched or vault-sourced. Cite vault evidence inline with the exact bracketed excerpt numbers provided, such as [1] or [2]. Do not invent citation numbers. Do not cite sources that do not support the sentence. If you mention a note by name, use only its note title; never mention folder names, file paths, Markdown filenames, or vault directory names. The user is looking for meaning, patterns, and connections across notes, not just keyword matches.";

export function getRuntimeEnv(key) {
  if (typeof import.meta !== "undefined" && import.meta.env?.[key]) {
    return import.meta.env[key];
  }

  if (typeof process !== "undefined" && process.env?.[key]) {
    return process.env[key];
  }

  return undefined;
}

export function getOpenRouterHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer":
      getRuntimeEnv("PUBLIC_SITE_URL") ||
      getRuntimeEnv("SITE") ||
      "https://abodid.com",
    "X-Title": getRuntimeEnv("PUBLIC_SITE_NAME") || "Abodid Sahoo",
  };
}

export function getVaultEmbeddingModel() {
  return getRuntimeEnv("OPENROUTER_EMBEDDING_MODEL") || DEFAULT_EMBEDDING_MODEL;
}

export function getVaultChatModel() {
  return getVaultChatModels()[0] || DEFAULT_CHAT_MODEL;
}

export function isFreeOpenRouterModel(model) {
  const normalized = String(model || "").trim().toLowerCase();
  return normalized.endsWith(OPENROUTER_FREE_SUFFIX) || normalized === OPENROUTER_FREE_ROUTER;
}

export function getVaultChatModels() {
  const raw =
    getRuntimeEnv("OPENROUTER_VAULT_CHAT_MODELS") ||
    getRuntimeEnv("OPENROUTER_CHAT_MODEL");

  const configuredModels = raw
    ? raw
        .split(",")
        .map((model) => model.trim())
        .filter(Boolean)
    : [];
  const models = configuredModels.length
    ? [...configuredModels, ...DEFAULT_CHAT_MODELS]
    : DEFAULT_CHAT_MODELS;

  const paidModels = Array.from(new Set(models)).filter((model) => {
    const isFree = isFreeOpenRouterModel(model);
    if (isFree) {
      console.warn(`[vault-rag] Ignoring free OpenRouter model for vault chat: ${model}`);
    }
    return !isFree;
  });

  return paidModels.length ? paidModels : DEFAULT_CHAT_MODELS;
}

export function getVaultEmbeddingDimensions() {
  const raw = getRuntimeEnv("OPENROUTER_EMBEDDING_DIMENSIONS");
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_EMBEDDING_DIMENSIONS;
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_EMBEDDING_DIMENSIONS;
}

export function getBooleanEnv(key, defaultValue = false) {
  const raw = getRuntimeEnv(key);
  if (raw === undefined || raw === null || raw === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(String(raw).trim().toLowerCase());
}

export function detectSensitiveVaultContent(text) {
  const value = String(text || "");
  return SENSITIVE_CONTENT_PATTERNS.filter(([, pattern]) => pattern.test(value)).map(
    ([label]) => label,
  );
}

export function createSupabaseServiceClient() {
  const supabaseUrl = getRuntimeEnv("PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function parseMarkdownNote(markdown) {
  const parsed = matter(markdown || "");
  return {
    frontmatter: parsed.data || {},
    content: parsed.content || "",
  };
}

export function noteTitleFromPath(filePath) {
  const filename = (filePath || "").split("/").pop() || "Untitled";
  return filename.replace(/\.md$/i, "").replace(/-/g, " ").trim() || "Untitled";
}

export function noteIdFromPath(filePath) {
  return crypto.createHash("sha1").update(filePath || "").digest("hex");
}

export function folderPathFromFilePath(filePath) {
  const parts = (filePath || "").split("/");
  parts.pop();
  return parts.join("/");
}

export function sourceHrefForFilePath(filePath) {
  const filename = (filePath || "").split("/").pop() || "";
  const slug = filename.replace(/\.md$/i, "");
  if (!slug) return null;
  return `/research/obsidian-vault/${encodeURIComponent(slug)}`;
}

export function normalizeTags(...tagInputs) {
  const tags = new Set();

  const addTag = (value) => {
    if (value === null || value === undefined) return;

    if (Array.isArray(value)) {
      value.forEach(addTag);
      return;
    }

    if (typeof value === "object") {
      Object.values(value).forEach(addTag);
      return;
    }

    String(value)
      .split(/[,\n]/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .forEach((tag) => {
        const cleaned = tag
          .replace(/^#/, "")
          .replace(/^\[\[/, "")
          .replace(/\]\]$/, "")
          .trim();
        if (cleaned) tags.add(cleaned);
      });
  };

  tagInputs.forEach(addTag);
  return Array.from(tags).sort((a, b) => a.localeCompare(b));
}

export function extractInlineTags(markdown) {
  const tags = new Set();
  const tagPattern = /(^|\s)#([A-Za-z0-9/_-]{2,})/g;
  let match = tagPattern.exec(markdown || "");

  while (match) {
    tags.add(match[2]);
    match = tagPattern.exec(markdown || "");
  }

  return Array.from(tags);
}

export function estimateTokens(text) {
  if (!text) return 0;
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(wordCount * 1.3);
}

function cleanupMarkdownForChunks(markdown) {
  return (markdown || "")
    .replace(/!\[\[[^\]]+\]\]/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\r\n/g, "\n")
    .trim();
}

function splitIntoSections(markdown) {
  const lines = cleanupMarkdownForChunks(markdown).split("\n");
  const sections = [];
  let heading = "";
  let body = [];

  const flush = () => {
    const text = body.join("\n").trim();
    if (text) {
      sections.push({ heading, text });
    }
    body = [];
  };

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (headingMatch) {
      flush();
      heading = headingMatch[2].trim();
      continue;
    }
    body.push(line);
  }

  flush();
  return sections.length ? sections : [{ heading: "", text: cleanupMarkdownForChunks(markdown) }];
}

function splitLongParagraph(paragraph) {
  if (estimateTokens(paragraph) <= TOKEN_MAX) return [paragraph];

  const words = paragraph.split(/\s+/).filter(Boolean);
  const chunks = [];

  for (let start = 0; start < words.length; start += TOKEN_TARGET) {
    const end = Math.min(words.length, start + TOKEN_TARGET);
    chunks.push(words.slice(start, end).join(" "));
  }

  return chunks;
}

function takeOverlap(text) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= TOKEN_OVERLAP) return text;
  return words.slice(-TOKEN_OVERLAP).join(" ");
}

function pushChunk(chunks, chunk) {
  const text = chunk.text.trim();
  if (!text) return;

  const tokenCount = estimateTokens(text);
  if (tokenCount < TOKEN_MIN && chunks.length > 0) {
    chunks[chunks.length - 1].text = `${chunks[chunks.length - 1].text}\n\n${text}`;
    return;
  }

  if (tokenCount >= TOKEN_MIN || text.length >= 240) {
    chunks.push({ heading: chunk.heading, text });
  }
}

function chunkSection(section) {
  const paragraphs = section.text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .flatMap(splitLongParagraph);

  const chunks = [];
  let current = [];
  let currentTokens = 0;

  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokens(paragraph);

    if (
      current.length > 0 &&
      currentTokens + paragraphTokens > TOKEN_TARGET &&
      currentTokens >= TOKEN_MIN
    ) {
      const text = current.join("\n\n");
      pushChunk(chunks, { heading: section.heading, text });
      const overlap = takeOverlap(text);
      current = overlap ? [overlap, paragraph] : [paragraph];
      currentTokens = estimateTokens(current.join("\n\n"));
      continue;
    }

    current.push(paragraph);
    currentTokens += paragraphTokens;
  }

  if (current.length > 0) {
    pushChunk(chunks, {
      heading: section.heading,
      text: current.join("\n\n"),
    });
  }

  return chunks;
}

export function buildEmbeddingInput({ title, heading, tags, chunkText }) {
  const tagLine = Array.isArray(tags) && tags.length ? tags.join(", ") : "None";
  return [
    `Title: ${title || "Untitled"}`,
    `Heading: ${heading || "None"}`,
    `Tags: ${tagLine}`,
    "",
    "Content:",
    chunkText || "",
  ].join("\n");
}

export function contentHashForChunk({ title, heading, tags, chunkText, embeddingModel }) {
  const input = JSON.stringify({
    embeddingModel,
    title,
    heading,
    tags,
    chunkText,
  });

  return crypto.createHash("sha256").update(input).digest("hex");
}

export function createChunksForNote({ filePath, markdown, isPublic = true, embeddingModel }) {
  const { frontmatter, content } = parseMarkdownNote(markdown);
  const title =
    (typeof frontmatter.title === "string" && frontmatter.title.trim()) ||
    noteTitleFromPath(filePath);
  const shouldPublish = Boolean(isPublic) && detectSensitiveVaultContent(markdown).length === 0;
  const tags = normalizeTags(
    frontmatter.tags,
    frontmatter.tag,
    extractInlineTags(content),
  );

  const sections = splitIntoSections(content);
  const rawChunks = sections.flatMap(chunkSection);
  if (rawChunks.length === 0) {
    const fallbackText = cleanupMarkdownForChunks(content) || title;
    rawChunks.push({
      heading: null,
      text: fallbackText,
    });
  }
  const folderPath = folderPathFromFilePath(filePath);

  return rawChunks.map((chunk, index) => {
    const embeddingInput = buildEmbeddingInput({
      title,
      heading: chunk.heading,
      tags,
      chunkText: chunk.text,
    });

    return {
      note_id: noteIdFromPath(filePath),
      note_title: title,
      file_path: filePath,
      folder_path: folderPath,
      heading: chunk.heading || null,
      chunk_index: index,
      chunk_text: chunk.text,
      frontmatter,
      tags,
      embedding_input: embeddingInput,
      embedding_model: embeddingModel || getVaultEmbeddingModel(),
      content_hash: contentHashForChunk({
        title,
        heading: chunk.heading,
        tags,
        chunkText: chunk.text,
        embeddingModel: embeddingModel || getVaultEmbeddingModel(),
      }),
      is_public: shouldPublish,
    };
  });
}

export function truncateText(text, maxLength = 420) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

export function serializeSource(
  row,
  { citationNumber = null, includeSimilarity = false, excerptLength = 420 } = {},
) {
  const source = {
    id: row.id,
    note_id: row.note_id,
    citation_number: citationNumber,
    note_title: row.note_title,
    heading: row.heading,
    chunk_index: row.chunk_index,
    tags: Array.isArray(row.tags) ? row.tags.slice(0, 8) : [],
    href: sourceHrefForFilePath(row.file_path),
    excerpt: truncateText(row.chunk_text, excerptLength),
  };

  if (includeSimilarity && typeof row.similarity === "number") {
    source.similarity = row.similarity;
  }

  return source;
}

export function prepareContextBlock(rows, maxChars = 12000) {
  let usedChars = 0;
  const blocks = [];

  for (const [index, row] of rows.entries()) {
    const tags = Array.isArray(row.tags) && row.tags.length
      ? row.tags.join(", ")
      : "None";
    const excerpt = truncateText(row.chunk_text, 1500);
    const block = [
      `[${index + 1}] Note title: ${row.note_title}`,
      `Section heading: ${row.heading || "None"}`,
      `Tags: ${tags}`,
      "",
      excerpt,
    ].join("\n");

    if (usedChars + block.length > maxChars) break;
    blocks.push(block);
    usedChars += block.length;
  }

  return blocks.join("\n\n---\n\n");
}

export async function createEmbedding(input, options = {}) {
  const apiKey = options.apiKey || getRuntimeEnv("OPENROUTER_API_KEY");
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is missing.");
  }

  const model = options.model || getVaultEmbeddingModel();
  const dimensions = options.dimensions || getVaultEmbeddingDimensions();
  const response = await fetch(`${OPENROUTER_BASE_URL}/embeddings`, {
    method: "POST",
    headers: getOpenRouterHeaders(apiKey),
    body: JSON.stringify({
      model,
      input,
      dimensions,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        `OpenRouter embeddings request failed with ${response.status}.`,
    );
  }

  const embeddings = Array.isArray(data?.data)
    ? data.data.map((item) => item.embedding)
    : [];

  if (!embeddings.length || !embeddings.every(Array.isArray)) {
    throw new Error("OpenRouter returned an invalid embeddings response.");
  }

  return Array.isArray(input) ? embeddings : embeddings[0];
}

export function normalizeChatHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .filter((message) => message && ["user", "assistant"].includes(message.role))
    .slice(-6)
    .map((message) => ({
      role: message.role,
      content: truncateText(message.content, 1200),
    }));
}

function parseJsonObject(text) {
  const value = String(text || "")
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(value);
  } catch {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function cleanSearchQuery(value, fallback) {
  const query = String(value || "").replace(/\s+/g, " ").trim();
  if (!query) return fallback;
  return truncateText(query, 520);
}

function extractRecentAcronyms(history) {
  const messages = normalizeChatHistory(history).slice(-4);
  const acronyms = [];
  const ignored = new Set(["API", "URL", "HTTP", "JSON", "LLM", "AI"]);

  for (const message of messages.reverse()) {
    const matches = String(message.content || "").match(/\b[A-Z][A-Z0-9&]{1,}\b/g) || [];
    for (const match of matches) {
      if (ignored.has(match)) continue;
      if (acronyms.includes(match)) continue;
      acronyms.push(match);
      if (acronyms.length >= 4) return acronyms;
    }
  }

  return acronyms;
}

function isLikelyAmbiguousFollowUp(question) {
  return /\b(it|that|this|they|them|there|previous|above|full\s*(?:form|name|foundation)|institution|school|college|place)\b/i.test(
    question || "",
  );
}

function anchorSearchQueryToHistory({ question, searchQuery, history }) {
  const acronyms = extractRecentAcronyms(history);
  if (!acronyms.length || !isLikelyAmbiguousFollowUp(question)) return searchQuery;

  const queryHasAcronym = acronyms.some((acronym) =>
    new RegExp(`\\b${acronym}\\b`, "i").test(searchQuery || ""),
  );
  if (queryHasAcronym) return searchQuery;

  return cleanSearchQuery(
    `${acronyms.slice(0, 2).join(" ")} full form full name institution ${question}`,
    searchQuery,
  );
}

export async function rewriteVaultSearchQuery({ question, history = [] }) {
  const apiKey = getRuntimeEnv("OPENROUTER_API_KEY");
  if (!apiKey) {
    return {
      searchQuery: question,
      rewritten: false,
      model: null,
      outsideKnowledgeHint: null,
      error: "OPENROUTER_API_KEY is missing.",
    };
  }

  const acronymHints = extractRecentAcronyms(history);
  const messages = [
    {
      role: "system",
      content:
        "Rewrite the user's latest question into one standalone semantic search query for Abodid's Obsidian Vault. Use recent chat history to resolve follow-ups, pronouns, ellipses, acronyms, and phrases like 'that institution' or 'full form'. Keep the rewritten query anchored to the current conversation topic; do not switch to a different topic just because a word has another meaning. Treat wording like 'full foundation institution' as likely meaning 'full form/full name of that institution' when recent history is about an acronym or institution. You may use general model knowledge only to add common aliases or acronym expansions that improve retrieval, such as including both an acronym and a likely institution name. Do not answer the question. Do not invent personal events or claims about Abodid. Return only strict JSON with keys: search_query, used_history, outside_knowledge_hint.",
    },
    ...normalizeChatHistory(history).slice(-4),
    {
      role: "user",
      content: [
        `Latest question: ${question}`,
        acronymHints.length
          ? `Recent acronym/institution hints from chat: ${acronymHints.join(", ")}`
          : "Recent acronym/institution hints from chat: None",
        "",
        "Example: if recent chat is about NID and the latest question asks 'What is the full foundation institution?', rewrite it as 'NID National Institute of Design full form full name institution'.",
        "Return JSON only. Keep search_query under 60 words. If you used general model knowledge for an acronym/alias, put a short note in outside_knowledge_hint; otherwise use null.",
      ].join("\n"),
    },
  ];

  let lastError = null;

  for (const model of getVaultChatModels()) {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: getOpenRouterHeaders(apiKey),
      body: JSON.stringify({
        model,
        messages,
        temperature: 0,
        max_tokens: 220,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      lastError = new Error(
        data?.error?.message ||
          `OpenRouter query rewrite failed with ${response.status}.`,
      );
      console.warn(`[vault-rag] Query rewrite failed (${model}):`, lastError.message);
      continue;
    }

    const content = data?.choices?.[0]?.message?.content?.trim();
    const parsed = parseJsonObject(content);
    const baseSearchQuery = cleanSearchQuery(parsed?.search_query, question);
    const searchQuery = anchorSearchQueryToHistory({
      question,
      searchQuery: baseSearchQuery,
      history,
    });

    return {
      searchQuery,
      rewritten: searchQuery !== question,
      model: data.model || model,
      usedHistory: Boolean(parsed?.used_history) || searchQuery !== baseSearchQuery,
      outsideKnowledgeHint:
        typeof parsed?.outside_knowledge_hint === "string" &&
        parsed.outside_knowledge_hint.trim()
          ? truncateText(parsed.outside_knowledge_hint, 180)
          : null,
    };
  }

  return {
    searchQuery: question,
    rewritten: false,
    model: null,
    outsideKnowledgeHint: null,
    error: lastError?.message || "Query rewrite unavailable.",
  };
}

export async function createVaultAnswer({
  question,
  rows,
  history = [],
  searchQuery = question,
  allowModelKnowledgeFallback = false,
  outsideKnowledgeHint = null,
}) {
  const apiKey = getRuntimeEnv("OPENROUTER_API_KEY");
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is missing.");
  }

  const contextBlock = prepareContextBlock(rows);
  const messages = [
    { role: "system", content: VAULT_SYSTEM_PROMPT },
    ...normalizeChatHistory(history),
    {
      role: "user",
      content: [
        "Use only these retrieved vault excerpts when answering.",
        "Every factual claim that depends on the vault should include inline citations using the exact bracketed numbers attached to the excerpts, for example [1] or [2].",
        "If one sentence uses multiple excerpts, cite each relevant number, for example [1], [3].",
        "If the excerpts do not support the premise of the question, say so and cite the closest relevant excerpts.",
        "When naming a source note in prose, use only the note title. Do not mention folder names, vault paths, directory numbers, or .md filenames.",
        allowModelKnowledgeFallback
          ? "If the vault excerpts establish the user's intended topic but omit a small general-world clarification, you may add a brief sentence labeled exactly 'Outside the vault:' using your model knowledge. Do not present that as web-searched or vault-sourced, and do not add citation brackets to outside-vault facts. If you are unsure, say it is not confirmed in the vault."
          : "Do not add outside knowledge that is not supported by the retrieved vault excerpts.",
        outsideKnowledgeHint
          ? `Potential outside-vault hint for retrieval only, not a citation: ${outsideKnowledgeHint}`
          : "",
        "",
        "Vault excerpts:",
        contextBlock || "No relevant excerpts were retrieved.",
        "",
        searchQuery && searchQuery !== question
          ? `Standalone search query used for retrieval: ${searchQuery}`
          : "",
        `Question: ${question}`,
      ].join("\n"),
    },
  ];

  let lastError = null;

  for (const model of getVaultChatModels()) {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: getOpenRouterHeaders(apiKey),
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.35,
        max_tokens: 900,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      lastError = new Error(
        data?.error?.message ||
          `OpenRouter chat request failed with ${response.status}.`,
      );
      console.warn(`[vault-rag] Chat model failed (${model}):`, lastError.message);
      continue;
    }

    const answer = data?.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      lastError = new Error(`OpenRouter returned an empty answer for ${model}.`);
      console.warn(`[vault-rag] ${lastError.message}`);
      continue;
    }

    return {
      answer,
      model: data.model || model,
      usage: data.usage || null,
    };
  }

  throw lastError || new Error("All OpenRouter chat models failed.");
}

export function extractKeywordTerms(question) {
  const normalized = String(question || "")
    .replace(/[^\p{L}\p{N}\s_-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return [];

  const stopWords = new Set([
    "about",
    "across",
    "around",
    "does",
    "find",
    "from",
    "have",
    "into",
    "mention",
    "notes",
    "recurring",
    "say",
    "search",
    "the",
    "what",
    "where",
    "with",
    "written",
  ]);

  const terms = normalized
    .split(" ")
    .map((term) => term.trim())
    .filter((term) => term.length >= 3)
    .filter((term) => !stopWords.has(term.toLowerCase()))
    .slice(0, 8);

  return Array.from(new Set(terms));
}

export function mergeRetrievedRows(vectorRows, keywordRows) {
  const byId = new Map();

  for (const row of vectorRows || []) {
    byId.set(row.id, {
      ...row,
      similarity: typeof row.similarity === "number" ? row.similarity : 0,
      _rankScore: typeof row.similarity === "number" ? row.similarity : 0,
    });
  }

  for (const row of keywordRows || []) {
    const existing = byId.get(row.id);
    if (existing) {
      existing._rankScore += 0.08;
      continue;
    }

    byId.set(row.id, {
      ...row,
      similarity: typeof row.similarity === "number" ? row.similarity : null,
      _rankScore: 0.42,
    });
  }

  return Array.from(byId.values())
    .sort((a, b) => b._rankScore - a._rankScore)
    .map(({ _rankScore, ...row }) => row);
}
