import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const NOTES_ROOT = "6 - Main Notes";

const requiredEnv = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
};

const gitBlobSha = (content) => {
  const body = Buffer.from(content, "utf8");
  return crypto
    .createHash("sha1")
    .update(`blob ${body.length}\0`)
    .update(body)
    .digest("hex");
};

async function collectMarkdownFiles(rootDir) {
  const notes = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) continue;

      const markdown = await fs.readFile(absolutePath, "utf8");
      const relativePath = path.relative(process.cwd(), absolutePath).split(path.sep).join("/");
      notes.push({
        filePath: relativePath,
        markdown,
        sourceSha: gitBlobSha(markdown),
      });
    }
  }

  await walk(rootDir);
  return notes.sort((left, right) => left.filePath.localeCompare(right.filePath));
}

const endpoint = requiredEnv("VAULT_SYNC_ENDPOINT");
const secret = requiredEnv("VAULT_SYNC_SECRET");
const repository = requiredEnv("GITHUB_REPOSITORY");
const ref = requiredEnv("GITHUB_REF");
const commitSha = requiredEnv("GITHUB_SHA");
const notesRoot = path.resolve(process.cwd(), NOTES_ROOT);
const notes = await collectMarkdownFiles(notesRoot);

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-vault-sync-secret": secret,
  },
  body: JSON.stringify({ repository, ref, commitSha, notes }),
  signal: AbortSignal.timeout(120_000),
});

const result = await response.json().catch(() => ({}));
if (!response.ok || !result?.ok) {
  throw new Error(`Vault sync failed with status ${response.status}.`);
}

console.log(
  `[vault-sync] ${result.received} notes checked, ${result.changed} changed, ` +
    `${result.embeddedChunks} chunks embedded, ${result.deleted} deleted.`,
);
