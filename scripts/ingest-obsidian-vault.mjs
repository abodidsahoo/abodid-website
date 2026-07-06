#!/usr/bin/env node
import "dotenv/config";

import fs from "node:fs/promises";
import path from "node:path";

import {
  createChunksForNote,
  createEmbedding,
  createSupabaseServiceClient,
  detectSensitiveVaultContent,
  getRuntimeEnv,
  getVaultEmbeddingDimensions,
  getVaultEmbeddingModel,
} from "../src/lib/vault-rag.js";

const DEFAULT_INCLUDE_PATHS = ["6 - Main Notes"];
const DEFAULT_EXCLUDE_PATHS = [
  ".git",
  ".obsidian",
  "node_modules",
  ".trash",
  "trash",
  "7 - Assets",
  "Attachments",
  "attachments",
];

const EMBEDDING_BATCH_SIZE = Number.parseInt(
  getRuntimeEnv("OPENROUTER_EMBEDDING_BATCH_SIZE") || "16",
  10,
);
const EMBEDDING_BATCH_DELAY_MS = Number.parseInt(
  getRuntimeEnv("OPENROUTER_EMBEDDING_BATCH_DELAY_MS") || "250",
  10,
);

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const limitArg = process.argv
  .slice(2)
  .find((arg) => arg.startsWith("--limit="))
  ?.split("=")[1];
const limit = limitArg ? Number.parseInt(limitArg, 10) : null;

function parseCsvEnv(key, fallback = []) {
  const raw = getRuntimeEnv(key);
  if (!raw) return fallback;
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePath(value) {
  return String(value || "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function startsWithAnyPath(filePath, prefixes) {
  const normalized = normalizePath(filePath).toLowerCase();
  return prefixes.some((prefix) => {
    const normalizedPrefix = normalizePath(prefix).toLowerCase();
    return (
      normalized === normalizedPrefix ||
      normalized.startsWith(`${normalizedPrefix}/`)
    );
  });
}

function shouldIndexPath(filePath, includePaths, excludePaths) {
  const normalized = normalizePath(filePath);
  if (!normalized.endsWith(".md")) return false;
  if (startsWithAnyPath(normalized, excludePaths)) return false;
  return includePaths.length === 0 || startsWithAnyPath(normalized, includePaths);
}

function getGithubHeaders() {
  const token = getRuntimeEnv("GITHUB_TOKEN");
  return token
    ? {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Astro-Obsidian-Vault-Ingest",
      }
    : {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Astro-Obsidian-Vault-Ingest",
      };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.message || `GitHub request failed with ${response.status}.`,
    );
  }

  return data;
}

async function fetchVaultFromGitHub({ includePaths, excludePaths }) {
  const owner = getRuntimeEnv("GITHUB_OWNER") || "abodidsahoo";
  const repo = getRuntimeEnv("GITHUB_REPO") || "obsidian-vault";
  const branch = getRuntimeEnv("GITHUB_BRANCH") || "main";
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
  const treeData = await fetchJson(treeUrl, { headers: getGithubHeaders() });
  const files = (treeData.tree || [])
    .filter((item) => item.type === "blob")
    .filter((item) => shouldIndexPath(item.path, includePaths, excludePaths));

  const selectedFiles = Number.isFinite(limit) ? files.slice(0, limit) : files;
  const notes = [];
  const batchSize = 20;

  for (let i = 0; i < selectedFiles.length; i += batchSize) {
    const batch = selectedFiles.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (file) => {
        const blob = await fetchJson(file.url, { headers: getGithubHeaders() });
        const content = Buffer.from(
          String(blob.content || "").replace(/\n/g, ""),
          "base64",
        ).toString("utf-8");

        return {
          filePath: file.path,
          markdown: content,
        };
      }),
    );

    notes.push(...results);
  }

  return notes;
}

async function walkLocalVault(rootDir, includePaths, excludePaths) {
  const notes = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = normalizePath(path.relative(rootDir, absolutePath));

      if (entry.isDirectory()) {
        if (!startsWithAnyPath(relativePath, excludePaths)) {
          await walk(absolutePath);
        }
        continue;
      }

      if (!entry.isFile()) continue;
      if (!shouldIndexPath(relativePath, includePaths, excludePaths)) continue;
      if (Number.isFinite(limit) && notes.length >= limit) continue;

      notes.push({
        filePath: relativePath,
        markdown: await fs.readFile(absolutePath, "utf-8"),
      });
    }
  }

  await walk(rootDir);
  return notes;
}

async function loadVaultNotes() {
  const includePaths = parseCsvEnv(
    "OBSIDIAN_VAULT_INDEX_PATHS",
    DEFAULT_INCLUDE_PATHS,
  );
  const excludePaths = parseCsvEnv(
    "OBSIDIAN_VAULT_EXCLUDE_PATHS",
    DEFAULT_EXCLUDE_PATHS,
  );
  const localVaultPath = getRuntimeEnv("OBSIDIAN_VAULT_PATH");

  if (localVaultPath) {
    const absolutePath = path.resolve(localVaultPath);
    return {
      source: `local:${absolutePath}`,
      notes: await walkLocalVault(absolutePath, includePaths, excludePaths),
    };
  }

  return {
    source: "github",
    notes: await fetchVaultFromGitHub({ includePaths, excludePaths }),
  };
}

async function loadExistingRows(supabase) {
  const rows = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("obsidian_chunks")
      .select("id,file_path,chunk_index,content_hash,is_public")
      .range(from, from + pageSize - 1);

    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

function makeChunkKey(filePath, chunkIndex) {
  return `${filePath}::${chunkIndex}`;
}

function toJsonSafe(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

async function sleep(ms) {
  if (!ms) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function deleteRowsById(supabase, ids) {
  const batchSize = 500;
  let deleted = 0;

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const { error } = await supabase
      .from("obsidian_chunks")
      .delete()
      .in("id", batch);

    if (error) throw error;
    deleted += batch.length;
  }

  return deleted;
}

async function updateChunkPublicStatus(supabase, chunks) {
  let updated = 0;

  for (const chunk of chunks) {
    const { error } = await supabase
      .from("obsidian_chunks")
      .update({ is_public: chunk.is_public })
      .eq("file_path", chunk.file_path)
      .eq("chunk_index", chunk.chunk_index)
      .eq("content_hash", chunk.content_hash);

    if (error) throw error;
    updated += 1;
  }

  return updated;
}

async function ingest() {
  const startedAt = Date.now();
  const embeddingModel = getVaultEmbeddingModel();
  const embeddingDimensions = getVaultEmbeddingDimensions();
  const privatePaths = parseCsvEnv("OBSIDIAN_VAULT_PRIVATE_PATHS", []);
  const summary = {
    source: "",
    filesScanned: 0,
    chunksCreated: 0,
    chunksEmbedded: 0,
    chunksSkippedUnchanged: 0,
    chunksMarkedPrivate: 0,
    chunksPrivacyUpdated: 0,
    chunksUpserted: 0,
    staleChunksDeleted: 0,
    notesMarkedPrivateByDetector: 0,
    sensitivePrivateFiles: [],
    errors: 0,
  };

  console.log("[vault-ingest] Loading vault notes...");
  const { source, notes } = await loadVaultNotes();
  summary.source = source;
  summary.filesScanned = notes.length;
  console.log(`[vault-ingest] Source: ${source}`);
  console.log(`[vault-ingest] Notes selected: ${notes.length}`);
  console.log(
    `[vault-ingest] Embedding model: ${embeddingModel} (${embeddingDimensions} dims)`,
  );

  let supabase = null;
  let existingRows = [];
  const existingByKey = new Map();

  if (!dryRun) {
    supabase = createSupabaseServiceClient();
    existingRows = await loadExistingRows(supabase);
    for (const row of existingRows) {
      existingByKey.set(makeChunkKey(row.file_path, row.chunk_index), row);
    }
    console.log(`[vault-ingest] Existing chunks: ${existingRows.length}`);
  }

  const pendingChunks = [];
  const privacyOnlyChunks = [];
  const currentKeys = new Set();
  const currentPaths = new Set();

  for (const note of notes) {
    try {
      currentPaths.add(note.filePath);
      const sensitiveMatches = detectSensitiveVaultContent(note.markdown);
      if (sensitiveMatches.length > 0) {
        summary.notesMarkedPrivateByDetector += 1;
        if (summary.sensitivePrivateFiles.length < 12) {
          summary.sensitivePrivateFiles.push(note.filePath);
        }
      }
      const chunks = createChunksForNote({
        filePath: note.filePath,
        markdown: note.markdown,
        isPublic: !startsWithAnyPath(note.filePath, privatePaths),
        embeddingModel,
      });

      summary.chunksCreated += chunks.length;
      summary.chunksMarkedPrivate += chunks.filter((chunk) => !chunk.is_public).length;

      for (const chunk of chunks) {
        const key = makeChunkKey(chunk.file_path, chunk.chunk_index);
        currentKeys.add(key);
        const existing = existingByKey.get(key);

        if (existing?.content_hash === chunk.content_hash) {
          summary.chunksSkippedUnchanged += 1;
          if (existing.is_public !== chunk.is_public) {
            privacyOnlyChunks.push(chunk);
          }
          continue;
        }

        pendingChunks.push(chunk);
      }
    } catch (error) {
      summary.errors += 1;
      console.error(`[vault-ingest] Failed to prepare ${note.filePath}:`, error);
    }
  }

  const staleIds = dryRun
    ? []
    : existingRows
        .filter((row) => {
          const key = makeChunkKey(row.file_path, row.chunk_index);
          return !currentPaths.has(row.file_path) || !currentKeys.has(key);
        })
        .map((row) => row.id);

  console.log(`[vault-ingest] Chunks prepared: ${summary.chunksCreated}`);
  console.log(`[vault-ingest] Chunks marked private: ${summary.chunksMarkedPrivate}`);
  console.log(`[vault-ingest] Chunks unchanged: ${summary.chunksSkippedUnchanged}`);
  console.log(`[vault-ingest] Chunks privacy-only updates: ${privacyOnlyChunks.length}`);
  console.log(`[vault-ingest] Chunks pending embeddings: ${pendingChunks.length}`);
  if (summary.notesMarkedPrivateByDetector > 0) {
    console.log(
      `[vault-ingest] Notes marked private by detector: ${summary.notesMarkedPrivateByDetector}`,
    );
    for (const filePath of summary.sensitivePrivateFiles) {
      console.log(`  - ${filePath}`);
    }
  }

  if (dryRun) {
    console.log("[vault-ingest] Dry run complete. No embeddings or database writes performed.");
    return summary;
  }

  if (privacyOnlyChunks.length > 0) {
    summary.chunksPrivacyUpdated = await updateChunkPublicStatus(
      supabase,
      privacyOnlyChunks,
    );
    console.log(
      `[vault-ingest] Updated privacy on ${summary.chunksPrivacyUpdated} unchanged chunks`,
    );
  }

  for (let i = 0; i < pendingChunks.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = pendingChunks.slice(i, i + EMBEDDING_BATCH_SIZE);
    const embeddings = await createEmbedding(
      batch.map((chunk) => chunk.embedding_input),
      {
        model: embeddingModel,
        dimensions: embeddingDimensions,
      },
    );

    const rows = batch.map((chunk, index) => {
      const { embedding_input, ...row } = chunk;
      return {
        ...row,
        frontmatter: toJsonSafe(row.frontmatter),
        embedding: embeddings[index],
      };
    });

    const { error } = await supabase
      .from("obsidian_chunks")
      .upsert(rows, { onConflict: "file_path,chunk_index" });

    if (error) throw error;

    summary.chunksEmbedded += rows.length;
    summary.chunksUpserted += rows.length;
    console.log(
      `[vault-ingest] Embedded ${summary.chunksEmbedded}/${pendingChunks.length}`,
    );
    await sleep(EMBEDDING_BATCH_DELAY_MS);
  }

  if (staleIds.length > 0) {
    summary.staleChunksDeleted = await deleteRowsById(supabase, staleIds);
  }

  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log("");
  console.log("[vault-ingest] Summary");
  console.log(`  Files scanned: ${summary.filesScanned}`);
  console.log(`  Chunks created: ${summary.chunksCreated}`);
  console.log(`  Chunks marked private: ${summary.chunksMarkedPrivate}`);
  console.log(`  Chunks embedded: ${summary.chunksEmbedded}`);
  console.log(`  Chunks skipped unchanged: ${summary.chunksSkippedUnchanged}`);
  console.log(`  Chunks privacy updated: ${summary.chunksPrivacyUpdated}`);
  console.log(`  Chunks inserted/updated: ${summary.chunksUpserted}`);
  console.log(`  Stale chunks deleted: ${summary.staleChunksDeleted}`);
  console.log(`  Errors: ${summary.errors}`);
  console.log(`  Finished in: ${elapsedSeconds}s`);

  return summary;
}

ingest().catch((error) => {
  console.error("[vault-ingest] Failed:", error.message || error);
  if (
    String(error.message || "").includes("obsidian_chunks") ||
    String(error.message || "").includes("match_obsidian_chunks")
  ) {
    console.error(
      "[vault-ingest] Make sure sql/create_obsidian_chunks.sql has been run in Supabase first.",
    );
  }
  process.exitCode = 1;
});
