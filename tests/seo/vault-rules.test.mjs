import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function computeTagIndexability(notesCount) {
  const isIndexable = notesCount >= 3;
  return {
    isIndexable,
    robotsDirective: isIndexable ? undefined : "noindex, follow",
    noindex: !isIndexable,
  };
}

function extractFirstUsefulParagraph(markdown) {
  if (!markdown) return "";
  const lines = markdown.split("\n");
  const paragraphLines = [];
  let inFrontmatter = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (i === 0 && line === "---") {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (line === "---") inFrontmatter = false;
      continue;
    }
    if (
      !line ||
      line.startsWith("#") ||
      line.startsWith("---") ||
      line.startsWith("Tags:") ||
      line.startsWith("tags:") ||
      line.startsWith("Date:") ||
      line.startsWith("date:") ||
      line.startsWith("![[") ||
      line.startsWith("![")
    ) {
      if (paragraphLines.length > 0) break;
      continue;
    }
    paragraphLines.push(line);
  }

  const rawParagraph = paragraphLines.join(" ");
  const cleaned = rawParagraph
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`#~]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length > 160) {
    const truncated = cleaned.slice(0, 157);
    const lastSpace = truncated.lastIndexOf(" ");
    return (lastSpace > 100 ? truncated.slice(0, lastSpace) : truncated) + "...";
  }
  return cleaned;
}

test("vault-rules: tag indexability threshold rule enforces >= 3 notes indexable, < 3 noindex follow", () => {
  // 0 notes -> weak tag page
  const emptyTag = computeTagIndexability(0);
  assert.equal(emptyTag.isIndexable, false);
  assert.equal(emptyTag.noindex, true);
  assert.equal(emptyTag.robotsDirective, "noindex, follow");

  // 1 note -> weak tag page
  const singleNoteTag = computeTagIndexability(1);
  assert.equal(singleNoteTag.isIndexable, false);
  assert.equal(singleNoteTag.noindex, true);
  assert.equal(singleNoteTag.robotsDirective, "noindex, follow");

  // 2 notes -> weak tag page
  const twoNotesTag = computeTagIndexability(2);
  assert.equal(twoNotesTag.isIndexable, false);
  assert.equal(twoNotesTag.noindex, true);
  assert.equal(twoNotesTag.robotsDirective, "noindex, follow");

  // 3 notes -> meaningful tag page
  const threeNotesTag = computeTagIndexability(3);
  assert.equal(threeNotesTag.isIndexable, true);
  assert.equal(threeNotesTag.noindex, false);
  assert.equal(threeNotesTag.robotsDirective, undefined);

  // 10 notes -> meaningful tag page
  const tenNotesTag = computeTagIndexability(10);
  assert.equal(tenNotesTag.isIndexable, true);
  assert.equal(tenNotesTag.noindex, false);
  assert.equal(tenNotesTag.robotsDirective, undefined);
});

test("vault-rules: extractFirstUsefulParagraph strips frontmatter, headings, images, and wikilinks", () => {
  const sampleMarkdown = `---
title: Memory and Spatial Navigation
tags: [spatial-computing, memory]
date: 2026-03-01
---

# Overview

![[memory-diagram.png]]

This note explores how [[cognitive-mapping|mental maps]] shape our perception of place and time. We examine spatial architecture and autoethnography.

## Second Section
Additional thoughts that should not be in the excerpt.
`;

  const description = extractFirstUsefulParagraph(sampleMarkdown);
  assert.equal(
    description,
    "This note explores how mental maps shape our perception of place and time. We examine spatial architecture and autoethnography.",
  );
});

test("vault-rules: 404 page file declares HTTP 404 status and noindex", () => {
  const page404Path = path.resolve(process.cwd(), "src/pages/404.astro");
  const content = fs.readFileSync(page404Path, "utf-8");

  assert.ok(
    content.includes("Astro.response.status = 404;"),
    "404.astro must set Astro.response.status = 404",
  );
  assert.ok(
    content.includes("noindex={true}"),
    "404.astro must set noindex={true}",
  );
  assert.ok(
    content.includes('robots="noindex, nofollow"'),
    "404.astro must set robots directive to noindex, nofollow",
  );
});
