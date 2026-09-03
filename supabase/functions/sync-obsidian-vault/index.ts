import { createClient } from "npm:@supabase/supabase-js@2.112.0";

type IncomingNote = {
  filePath: string;
  markdown: string;
  sourceSha: string;
};

type SyncPayload = {
  repository: string;
  ref: string;
  commitSha: string;
  notes: IncomingNote[];
};

type NoteRecord = {
  note_id: string;
  note_title: string;
  file_path: string;
  folder_path: string;
  slug: string;
  markdown_content: string;
  wiki_links: string[];
  tags: string[];
  first_tag: string | null;
  is_public: boolean;
  content_hash: string;
  source_sha: string;
};

type PreparedChunk = {
  note_id: string;
  note_title: string;
  file_path: string;
  folder_path: string;
  heading: string | null;
  chunk_index: number;
  chunk_text: string;
  frontmatter: Record<string, unknown>;
  tags: string[];
  embedding_input: string;
  embedding_model: string;
  content_hash: string;
  is_public: boolean;
};

const EXPECTED_REPOSITORY = "abodidsahoo/obsidian-vault";
const EXPECTED_REF = "refs/heads/main";
const NOTES_ROOT = "6 - Main Notes/";
const EMBEDDING_MODEL = "openai/text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const EMBEDDING_BATCH_SIZE = 16;
const TOKEN_TARGET = 650;
const TOKEN_MIN = 90;
const TOKEN_MAX = 850;
const TOKEN_OVERLAP = 100;

const sensitivePatterns = [
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/i,
  /\bre_[A-Za-z0-9_-]{16,}\b/i,
  /\b(?:api[_\s-]*key|access[_\s-]*token|auth[_\s-]*token|bearer[_\s-]*token|client[_\s-]*secret|password)\b\s*[:=]\s*["'`]?[A-Za-z0-9_./+=:@-]{8,}/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
];

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

const requiredEnv = (name: string): string => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
};

const timingSafeEqual = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
};

const digestHex = async (algorithm: "SHA-1" | "SHA-256", value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest(algorithm, bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const noteSlugFromPath = (filePath: string) =>
  (filePath.split("/").pop() || "").replace(/\.md$/i, "").trim();

const noteTitleFromPath = (filePath: string) =>
  noteSlugFromPath(filePath).replace(/-/g, " ").trim() || "Untitled";

const folderPathFromFilePath = (filePath: string) => {
  const parts = filePath.split("/");
  parts.pop();
  return parts.join("/");
};

const stripWrappingQuotes = (value: string) =>
  value.trim().replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2").trim();

const parseMarkdownNote = (markdown: string) => {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return { frontmatter: {}, content: markdown };

  const yaml = match[1];
  const frontmatter: Record<string, unknown> = {};
  const title = yaml.match(/^title\s*:\s*(.+)$/im)?.[1];
  if (title) frontmatter.title = stripWrappingQuotes(title);

  const tagsLine = yaml.match(/^tags?\s*:\s*(.*)$/im)?.[1]?.trim();
  if (tagsLine) {
    frontmatter.tags = tagsLine
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map(stripWrappingQuotes)
      .filter(Boolean);
  }

  return {
    frontmatter,
    content: markdown.slice(match[0].length),
  };
};

const normalizeWikiLinkTarget = (value: string) =>
  String(value || "")
    .split("|")[0]
    .split("#")[0]
    .replace(/\.md$/i, "")
    .trim()
    .toLowerCase();

const extractWikiLinks = (markdown: string) => {
  const links = new Set<string>();
  const pattern = /(!?)\[\[([^\]]+)\]\]/g;
  let match = pattern.exec(markdown || "");
  while (match) {
    const target = normalizeWikiLinkTarget(match[2]);
    if (match[1] !== "!" && target) links.add(target);
    match = pattern.exec(markdown || "");
  }
  return Array.from(links).sort((a, b) => a.localeCompare(b));
};

const extractExplicitTags = (markdown: string) => {
  const tags: string[] = [];
  const seen = new Set<string>();

  for (const line of String(markdown || "").split(/\r?\n/)) {
    const normalizedLine = line
      .trim()
      .replace(/^[-*]\s+/, "")
      .replace(/\*\*|__/g, "");
    const lineMatch = normalizedLine.match(/^tags\s*::?\s*(.*)$/i);
    if (!lineMatch) continue;

    const pattern = /\[\[([^\]]+)\]\]/g;
    let match = pattern.exec(lineMatch[1] || "");
    while (match) {
      const target = String(match[1] || "")
        .split("|")[0]
        .split("#")[0]
        .replace(/\.md$/i, "")
        .trim();
      const key = target.toLowerCase();
      if (target && !seen.has(key)) {
        seen.add(key);
        tags.push(target);
      }
      match = pattern.exec(lineMatch[1] || "");
    }
  }
  return tags;
};

const extractInlineTags = (markdown: string) => {
  const tags = new Set<string>();
  const pattern = /(^|\s)#([A-Za-z0-9/_-]{2,})/g;
  let match = pattern.exec(markdown || "");
  while (match) {
    tags.add(match[2]);
    match = pattern.exec(markdown || "");
  }
  return Array.from(tags);
};

const normalizeTags = (...inputs: unknown[]) => {
  const tags = new Set<string>();
  const add = (value: unknown) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach(add);
      return;
    }
    String(value)
      .split(/[,\n]/)
      .map((tag) => tag.trim().replace(/^#/, "").replace(/^\[\[/, "").replace(/\]\]$/, ""))
      .filter(Boolean)
      .forEach((tag) => tags.add(tag));
  };
  inputs.forEach(add);
  return Array.from(tags).sort((a, b) => a.localeCompare(b));
};

const isPublicNote = (markdown: string) =>
  !sensitivePatterns.some((pattern) => pattern.test(markdown));

const createNoteRecord = async (note: IncomingNote): Promise<NoteRecord> => {
  const { frontmatter, content } = parseMarkdownNote(note.markdown);
  const tags = extractExplicitTags(content);
  const title = typeof frontmatter.title === "string" && frontmatter.title.trim()
    ? frontmatter.title.trim()
    : noteTitleFromPath(note.filePath);

  return {
    note_id: await digestHex("SHA-1", note.filePath),
    note_title: title,
    file_path: note.filePath,
    folder_path: folderPathFromFilePath(note.filePath),
    slug: noteSlugFromPath(note.filePath),
    markdown_content: note.markdown,
    wiki_links: extractWikiLinks(content),
    tags,
    first_tag: tags[0] || null,
    is_public: isPublicNote(note.markdown),
    content_hash: await digestHex("SHA-256", note.markdown),
    source_sha: note.sourceSha,
  };
};

const estimateTokens = (text: string) =>
  Math.ceil(text.trim().split(/\s+/).filter(Boolean).length * 1.3);

const cleanupMarkdownForChunks = (markdown: string) =>
  markdown
    .replace(/!\[\[[^\]]+\]\]/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\r\n/g, "\n")
    .trim();

const splitIntoSections = (markdown: string) => {
  const lines = cleanupMarkdownForChunks(markdown).split("\n");
  const sections: Array<{ heading: string; text: string }> = [];
  let heading = "";
  let body: string[] = [];
  const flush = () => {
    const text = body.join("\n").trim();
    if (text) sections.push({ heading, text });
    body = [];
  };

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (match) {
      flush();
      heading = match[2].trim();
    } else {
      body.push(line);
    }
  }
  flush();
  return sections.length ? sections : [{ heading: "", text: cleanupMarkdownForChunks(markdown) }];
};

const splitLongParagraph = (paragraph: string) => {
  if (estimateTokens(paragraph) <= TOKEN_MAX) return [paragraph];
  const words = paragraph.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let start = 0; start < words.length; start += TOKEN_TARGET) {
    chunks.push(words.slice(start, start + TOKEN_TARGET).join(" "));
  }
  return chunks;
};

const takeOverlap = (text: string) => {
  const words = text.split(/\s+/).filter(Boolean);
  return words.length <= TOKEN_OVERLAP ? text : words.slice(-TOKEN_OVERLAP).join(" ");
};

const chunkSection = (section: { heading: string; text: string }) => {
  const paragraphs = section.text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .flatMap(splitLongParagraph);
  const chunks: Array<{ heading: string; text: string }> = [];
  let current: string[] = [];
  let currentTokens = 0;

  const push = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    if (estimateTokens(clean) < TOKEN_MIN && chunks.length > 0) {
      chunks[chunks.length - 1].text += `\n\n${clean}`;
    } else if (estimateTokens(clean) >= TOKEN_MIN || clean.length >= 240) {
      chunks.push({ heading: section.heading, text: clean });
    }
  };

  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokens(paragraph);
    if (
      current.length > 0 &&
      currentTokens + paragraphTokens > TOKEN_TARGET &&
      currentTokens >= TOKEN_MIN
    ) {
      const text = current.join("\n\n");
      push(text);
      const overlap = takeOverlap(text);
      current = overlap ? [overlap, paragraph] : [paragraph];
      currentTokens = estimateTokens(current.join("\n\n"));
    } else {
      current.push(paragraph);
      currentTokens += paragraphTokens;
    }
  }
  if (current.length) push(current.join("\n\n"));
  return chunks;
};

const createChunks = async (
  note: IncomingNote,
  record: NoteRecord,
): Promise<PreparedChunk[]> => {
  const { frontmatter, content } = parseMarkdownNote(note.markdown);
  const semanticTags = normalizeTags(
    frontmatter.tags,
    frontmatter.tag,
    extractInlineTags(content),
  );
  const rawChunks = splitIntoSections(content).flatMap(chunkSection);
  if (!rawChunks.length) {
    rawChunks.push({
      heading: "",
      text: cleanupMarkdownForChunks(content) || record.note_title,
    });
  }

  return await Promise.all(rawChunks.map(async (chunk, index) => {
    const embeddingInput = [
      `Title: ${record.note_title}`,
      `Heading: ${chunk.heading || "None"}`,
      `Tags: ${semanticTags.length ? semanticTags.join(", ") : "None"}`,
      "",
      "Content:",
      chunk.text,
    ].join("\n");
    const contentHash = await digestHex("SHA-256", JSON.stringify({
      embeddingModel: EMBEDDING_MODEL,
      title: record.note_title,
      heading: chunk.heading,
      tags: semanticTags,
      chunkText: chunk.text,
    }));

    return {
      note_id: record.note_id,
      note_title: record.note_title,
      file_path: record.file_path,
      folder_path: record.folder_path,
      heading: chunk.heading || null,
      chunk_index: index,
      chunk_text: chunk.text,
      frontmatter,
      tags: semanticTags,
      embedding_input: embeddingInput,
      embedding_model: EMBEDDING_MODEL,
      content_hash: contentHash,
      is_public: record.is_public,
    };
  }));
};

const createEmbeddings = async (inputs: string[], apiKey: string) => {
  const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://abodid.com",
      "X-Title": "Abodid Sahoo Vault Sync",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: inputs,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Embedding request failed (${response.status}).`);
  }
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows
    .slice()
    .sort((left: { index?: number }, right: { index?: number }) =>
      Number(left.index || 0) - Number(right.index || 0)
    )
    .map((row: { embedding?: number[] }) => row.embedding || []);
};

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed." }, 405);

  try {
    const suppliedSecret = request.headers.get("x-vault-sync-secret") || "";
    const expectedSecret = requiredEnv("VAULT_SYNC_SECRET");
    if (!suppliedSecret || !timingSafeEqual(suppliedSecret, expectedSecret)) {
      return json({ ok: false, error: "Unauthorized." }, 401);
    }

    const payload = await request.json() as SyncPayload;
    if (payload.repository !== EXPECTED_REPOSITORY || payload.ref !== EXPECTED_REF) {
      return json({ ok: false, error: "Unexpected repository or branch." }, 403);
    }
    if (!Array.isArray(payload.notes) || payload.notes.length > 1000) {
      return json({ ok: false, error: "Invalid notes payload." }, 400);
    }

    const incoming = payload.notes.filter((note) =>
      note &&
      typeof note.filePath === "string" &&
      note.filePath.startsWith(NOTES_ROOT) &&
      note.filePath.endsWith(".md") &&
      typeof note.markdown === "string" &&
      typeof note.sourceSha === "string" &&
      note.sourceSha.length > 0
    );

    const database = createClient(
      requiredEnv("SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: existing, error: existingError } = await database
      .from("obsidian_notes")
      .select("note_id,file_path,source_sha,is_public");
    if (existingError) throw existingError;

    const incomingPaths = new Set(incoming.map((note) => note.filePath));
    const stalePaths = (existing || [])
      .map((row: { file_path: string }) => row.file_path)
      .filter((filePath: string) => filePath.startsWith(NOTES_ROOT) && !incomingPaths.has(filePath));
    const existingByPath = new Map(
      (existing || []).map((row: { file_path: string; source_sha: string; is_public: boolean }) =>
        [row.file_path, row]
      ),
    );

    const prepared = await Promise.all(incoming.map(async (note) => ({
      note,
      record: await createNoteRecord(note),
    })));
    const changed = prepared.filter(({ record }) => {
      const previous = existingByPath.get(record.file_path) as
        | { source_sha: string; is_public: boolean }
        | undefined;
      return !previous ||
        previous.source_sha !== record.source_sha ||
        previous.is_public !== record.is_public;
    });

    if (changed.length) {
      const { error } = await database
        .from("obsidian_notes")
        .upsert(
          changed.map(({ record }) => ({
            ...record,
            // Publish the current Markdown immediately, but leave a marker so
            // a failed embedding pass is retried on the next workflow run.
            source_sha: `pending:${record.source_sha}`,
          })),
          { onConflict: "note_id" },
        );
      if (error) throw error;
    }

    const chunksByPath = new Map<string, PreparedChunk[]>();
    for (const { note, record } of changed) {
      chunksByPath.set(record.file_path, await createChunks(note, record));
    }
    const allChunks = Array.from(chunksByPath.values()).flat();
    const openRouterKey = allChunks.length ? requiredEnv("OPENROUTER_API_KEY") : "";
    let embeddedCount = 0;

    for (let start = 0; start < allChunks.length; start += EMBEDDING_BATCH_SIZE) {
      const batch = allChunks.slice(start, start + EMBEDDING_BATCH_SIZE);
      const embeddings = await createEmbeddings(
        batch.map((chunk) => chunk.embedding_input),
        openRouterKey,
      );
      if (embeddings.length !== batch.length) {
        throw new Error("Embedding response count did not match the chunk batch.");
      }

      const rows = batch.map((chunk, index) => {
        const { embedding_input: _embeddingInput, ...row } = chunk;
        return { ...row, embedding: embeddings[index] };
      });
      const { error } = await database
        .from("obsidian_chunks")
        .upsert(rows, { onConflict: "file_path,chunk_index" });
      if (error) throw error;
      embeddedCount += rows.length;
    }

    for (const [filePath, chunks] of chunksByPath) {
      const { error } = await database
        .from("obsidian_chunks")
        .delete()
        .eq("file_path", filePath)
        .gte("chunk_index", chunks.length);
      if (error) throw error;
    }

    if (changed.length) {
      const { error } = await database
        .from("obsidian_notes")
        .upsert(changed.map(({ record }) => record), { onConflict: "note_id" });
      if (error) throw error;
    }

    if (stalePaths.length) {
      const { error: chunkDeleteError } = await database
        .from("obsidian_chunks")
        .delete()
        .in("file_path", stalePaths);
      if (chunkDeleteError) throw chunkDeleteError;

      const { error: noteDeleteError } = await database
        .from("obsidian_notes")
        .delete()
        .in("file_path", stalePaths);
      if (noteDeleteError) throw noteDeleteError;
    }

    return json({
      ok: true,
      commitSha: payload.commitSha,
      received: incoming.length,
      changed: changed.length,
      embeddedChunks: embeddedCount,
      deleted: stalePaths.length,
    });
  } catch (error) {
    console.error("[sync-obsidian-vault]", error);
    return json({ ok: false, error: "Vault synchronization failed." }, 500);
  }
});
