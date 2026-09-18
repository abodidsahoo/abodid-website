import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

export interface ManualDoc {
  slug: string;
  fullPath: string;
  chapterNumber: string;
  chapterTitle: string;
  sectionNumber: string;
  title: string;
  displayTitle: string;
  fullTitle: string;
  status: string;
  lastUpdated: string;
  readingTimeMinutes: number;
  rawMarkdown: string;
  cleanedMarkdown: string;
  frontmatter: Record<string, any>;
  relativeFilePath: string;
  keyTopics: string[];
}

export interface ManualChapter {
  id: string;
  number: string;
  title: string;
  folderName: string;
  docs: ManualDoc[];
}

export interface ManualNavigation {
  chapters: ManualChapter[];
  rootDocs: ManualDoc[];
  allDocs: ManualDoc[];
}

const MANUAL_ROOT_DIR = path.resolve(
  process.cwd(),
  "docs/system-manual/abodid-system-manual",
);

const CHAPTER_TITLES: Record<string, string> = {
  "00": "Manual, Index & Versioning",
  "01": "Philosophy, Manifesto & Creative Practice",
  "02": "Information Architecture & Content System",
  "03": "Visual System, Pop Editorial & Moodboards",
  "04": "Projects, Research & Editorial Examples",
  "05": "Application & Code Architecture",
  "06": "Data, Media, Obsidian & Knowledge",
  "07": "Interlude / Field Notes / Reserved",
  "08": "AI, APIs & Automation",
  "09": "Infrastructure, Security, Operations & Limits",
  "10": "Evolution, Alternatives & Onboarding",
};

function calculateReadingTime(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

export function cleanDisplayTitle(rawTitle: string): string {
  if (!rawTitle) return "";
  return rawTitle
    .replace(/^#+\s*/, "")
    .replace(/^chapter\s*\d{1,2}[:\s—–-]*/i, "")
    .replace(/^\d{1,2}(?:\.\d{1,2})*(?:\.\d{1,2})*\s*[—–:\-\.]\s*/, "")
    .replace(/^[0-9.]+-/, "")
    .trim();
}

function extractAndCleanMarkdown(rawMarkdown: string, filename: string, sectionNumber: string) {
  const lines = rawMarkdown.split("\n");
  let rawTitle = "";
  let status = "Current";
  let lastUpdated = "2026-09-18";

  // Scan for metadata
  for (const line of lines) {
    const trimmed = line.trim();
    if (!rawTitle && trimmed.startsWith("# ")) {
      rawTitle = trimmed.replace(/^#\s+/, "").trim();
    }
    if (trimmed.startsWith("Status:")) {
      status = trimmed.replace(/^Status:\s*/, "").trim();
    }
    if (trimmed.startsWith("Last Updated:") || trimmed.startsWith("Last Audited:")) {
      lastUpdated = trimmed.replace(/^Last (?:Updated|Audited):\s*/, "").trim();
    }
  }

  if (!rawTitle) {
    const basename = path.basename(filename, ".md");
    rawTitle = basename
      .replace(/^[0-9.]+-/, "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }

  // Extract clean display title without any leading number prefix (e.g. "03.00 — ")
  const displayTitle = cleanDisplayTitle(rawTitle);
  
  // Format full title consistently (e.g. "03.00 — Abodid Pop Editorial Design System" or "Overview")
  const fullTitle = sectionNumber && sectionNumber !== "00" && sectionNumber !== "root"
    ? `${sectionNumber} — ${displayTitle}`
    : (rawTitle.includes("—") ? rawTitle : displayTitle);

  // Strip leading H1 and metadata lines from the body to prevent duplicate headers
  let contentLines = [...lines];
  let inHeaderPreamble = true;

  while (contentLines.length > 0 && inHeaderPreamble) {
    const firstLine = contentLines[0].trim();
    if (
      !firstLine ||
      firstLine.startsWith("# ") ||
      firstLine.startsWith("Status:") ||
      firstLine.startsWith("Last Updated:") ||
      firstLine.startsWith("Last Audited:") ||
      firstLine === "---"
    ) {
      contentLines.shift();
    } else {
      inHeaderPreamble = false;
    }
  }

  // Extract key topics from H2 and H3 headings
  const keyTopics: string[] = [];
  for (const line of contentLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("## ") || trimmed.startsWith("### ")) {
      const topic = trimmed
        .replace(/^#{2,3}\s+/, "")
        .replace(/^\d+(?:\.\d+)*\s*[—–:\-\.]\s*/, "")
        .replace(/`([^`]+)`/g, "$1")
        .trim();
      if (topic && !keyTopics.includes(topic) && topic.length < 60) {
        keyTopics.push(topic);
      }
    }
  }

  const cleanedMarkdown = contentLines.join("\n").trim();

  return { title: displayTitle, displayTitle, fullTitle, status, lastUpdated, cleanedMarkdown, keyTopics };
}

let cachedNav: ManualNavigation | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 10000; // 10-second cache in development, instant sub-millisecond response

export async function getAllManualDocs(forceRefresh = false): Promise<ManualNavigation> {
  const now = Date.now();
  if (!forceRefresh && cachedNav && (now - lastCacheTime < CACHE_TTL_MS)) {
    return cachedNav;
  }

  const entries = await fs.readdir(MANUAL_ROOT_DIR, { withFileTypes: true });
  const chapters: ManualChapter[] = [];
  const rootDocs: ManualDoc[] = [];
  const allDocs: ManualDoc[] = [];

  // 1. Process root files (README.md, INDEX.md, CHANGELOG.md, GLOSSARY.md)
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      const filePath = path.join(MANUAL_ROOT_DIR, entry.name);
      const content = await fs.readFile(filePath, "utf-8");
      const { data: frontmatter, content: rawMarkdown } = matter(content);
      const slug = entry.name === "README.md" ? "overview" : entry.name.replace(/\.md$/, "").toLowerCase();
      const { title, displayTitle, fullTitle, status, lastUpdated, cleanedMarkdown, keyTopics } = extractAndCleanMarkdown(rawMarkdown, entry.name, "root");

      const doc: ManualDoc = {
        slug,
        fullPath: slug,
        chapterNumber: "root",
        chapterTitle: "Core Specification",
        sectionNumber: "00",
        title: displayTitle,
        displayTitle,
        fullTitle: fullTitle || displayTitle,
        status,
        lastUpdated,
        readingTimeMinutes: calculateReadingTime(rawMarkdown),
        rawMarkdown,
        cleanedMarkdown,
        frontmatter,
        relativeFilePath: entry.name,
        keyTopics,
      };

      rootDocs.push(doc);
      allDocs.push(doc);
    }
  }

  // 2. Process numbered chapters (00 through 10)
  const chapterFolders = entries
    .filter((e) => e.isDirectory() && /^\d{2}-/.test(e.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const folder of chapterFolders) {
    const chapterNumber = folder.name.slice(0, 2);
    const chapterTitle = CHAPTER_TITLES[chapterNumber] || folder.name.replace(/^\d{2}-/, "").replace(/-/g, " ");
    const folderPath = path.join(MANUAL_ROOT_DIR, folder.name);
    const fileEntries = await fs.readdir(folderPath, { withFileTypes: true });

    const chapterDocs: ManualDoc[] = [];

    const mdFiles = fileEntries
      .filter((f) => f.isFile() && f.name.endsWith(".md"))
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const file of mdFiles) {
      const filePath = path.join(folderPath, file.name);
      const content = await fs.readFile(filePath, "utf-8");
      const { data: frontmatter, content: rawMarkdown } = matter(content);
      const sectionMatch = file.name.match(/^(\d{2}\.\d{2})/);
      const sectionNumber = sectionMatch ? sectionMatch[1] : chapterNumber;
      const { title, displayTitle, fullTitle, status, lastUpdated, cleanedMarkdown, keyTopics } = extractAndCleanMarkdown(rawMarkdown, file.name, sectionNumber);
      const fileSlug = file.name.replace(/\.md$/, "");
      const fullPath = `${folder.name}/${fileSlug}`;

      const doc: ManualDoc = {
        slug: fileSlug,
        fullPath,
        chapterNumber,
        chapterTitle,
        sectionNumber,
        title: displayTitle,
        displayTitle,
        fullTitle,
        status,
        lastUpdated,
        readingTimeMinutes: calculateReadingTime(rawMarkdown),
        rawMarkdown,
        cleanedMarkdown,
        frontmatter,
        relativeFilePath: `${folder.name}/${file.name}`,
        keyTopics,
      };

      chapterDocs.push(doc);
      allDocs.push(doc);
    }

    chapters.push({
      id: folder.name,
      number: chapterNumber,
      title: chapterTitle,
      folderName: folder.name,
      docs: chapterDocs,
    });
  }

  cachedNav = {
    chapters,
    rootDocs,
    allDocs,
  };
  lastCacheTime = Date.now();

  return cachedNav;
}

export async function getManualDocBySlug(targetSlug: string): Promise<{
  doc: ManualDoc | null;
  prevDoc: ManualDoc | null;
  nextDoc: ManualDoc | null;
  nav: ManualNavigation;
}> {
  const nav = await getAllManualDocs();
  const normalizedTarget = (targetSlug || "overview").toLowerCase().replace(/^\/+|\/+$/g, "");

  let foundIndex = -1;

  for (let i = 0; i < nav.allDocs.length; i++) {
    const doc = nav.allDocs[i];
    if (
      doc.slug.toLowerCase() === normalizedTarget ||
      doc.fullPath.toLowerCase() === normalizedTarget ||
      doc.slug.toLowerCase().replace(/^[0-9.]+-/, "") === normalizedTarget ||
      (normalizedTarget === "overview" && doc.slug === "overview") ||
      (normalizedTarget === "index" && doc.slug === "index") ||
      (normalizedTarget === "glossary" && doc.slug === "glossary") ||
      (normalizedTarget === "changelog" && doc.slug === "changelog")
    ) {
      foundIndex = i;
      break;
    }
  }

  // Fallback to overview if not found
  if (foundIndex === -1 && (normalizedTarget === "" || normalizedTarget === "system-manual")) {
    foundIndex = 0;
  }

  const doc = foundIndex !== -1 ? nav.allDocs[foundIndex] : null;
  const prevDoc = foundIndex > 0 ? nav.allDocs[foundIndex - 1] : null;
  const nextDoc = foundIndex !== -1 && foundIndex < nav.allDocs.length - 1 ? nav.allDocs[foundIndex + 1] : null;

  return {
    doc,
    prevDoc,
    nextDoc,
    nav,
  };
}
