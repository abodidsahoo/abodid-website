import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const MANUAL_ROOT_DIR = path.resolve(
  process.cwd(),
  "docs/system-manual/abodid-system-manual",
);

describe("Abodid System Manual Structural Integrity", () => {
  it("should have root documentation files", async () => {
    const entries = await fs.readdir(MANUAL_ROOT_DIR);
    assert.ok(entries.includes("README.md"), "README.md missing");
    assert.ok(entries.includes("INDEX.md"), "INDEX.md missing");
    assert.ok(entries.includes("CHANGELOG.md"), "CHANGELOG.md missing");
    assert.ok(entries.includes("GLOSSARY.md"), "GLOSSARY.md missing");
  });

  it("should contain all 11 permanent top-level chapters (00 through 10)", async () => {
    const entries = await fs.readdir(MANUAL_ROOT_DIR, { withFileTypes: true });
    const chapters = entries
      .filter((e) => e.isDirectory() && /^\d{2}-/.test(e.name))
      .map((e) => e.name.slice(0, 2));

    for (let i = 0; i <= 10; i++) {
      const expectedKey = String(i).padStart(2, "0");
      assert.ok(
        chapters.includes(expectedKey),
        `Chapter ${expectedKey} missing from system manual`,
      );
    }
  });

  it("should have valid markdown files with non-empty headings across all chapters", async () => {
    const entries = await fs.readdir(MANUAL_ROOT_DIR, { withFileTypes: true });
    const chapterFolders = entries.filter((e) => e.isDirectory() && /^\d{2}-/.test(e.name));

    let totalDocs = 0;
    for (const folder of chapterFolders) {
      const folderPath = path.join(MANUAL_ROOT_DIR, folder.name);
      const files = await fs.readdir(folderPath);
      const mdFiles = files.filter((f) => f.endsWith(".md"));
      assert.ok(mdFiles.length > 0, `Chapter ${folder.name} has no markdown files`);

      for (const file of mdFiles) {
        totalDocs++;
        const content = await fs.readFile(path.join(folderPath, file), "utf-8");
        const { content: markdown } = matter(content);
        assert.ok(markdown.length > 50, `${folder.name}/${file} is too short`);
        assert.ok(markdown.includes("# "), `${folder.name}/${file} lacks an H1 title`);
      }
    }
    console.log(`Verified ${totalDocs} chapter documents + 4 root documents.`);
  });
});
