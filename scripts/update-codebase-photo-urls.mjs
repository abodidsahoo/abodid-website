import fs from "node:fs";
import path from "node:path";

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  let modified = false;

  // 1. Replace photos.abodid.com references
  if (content.includes("https://assets.abodid.com/photos/originals/")) {
    content = content.replaceAll("https://assets.abodid.com/photos/originals/", "https://assets.abodid.com/photos/originals/");
    modified = true;
  }
  if (content.includes("https://assets.abodid.com/photos/variants/")) {
    content = content.replaceAll("https://assets.abodid.com/photos/variants/", "https://assets.abodid.com/photos/variants/");
    modified = true;
  }
  if (content.includes("https://assets.abodid.com")) {
    content = content.replaceAll("https://assets.abodid.com", "https://assets.abodid.com");
    modified = true;
  }

  // 2. Replace assets.abodid.com/originals/ (non-punctum) with photos/
  if (content.includes("https://assets.abodid.com/originals/") && !content.includes("punctum-experiment")) {
    content = content.replaceAll("https://assets.abodid.com/originals/", "https://assets.abodid.com/photos/originals/");
    modified = true;
  }
  if (content.includes("https://assets.abodid.com/variants/") && !content.includes("punctum-experiment")) {
    content = content.replaceAll("https://assets.abodid.com/variants/", "https://assets.abodid.com/photos/variants/");
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`Updated URLs in: ${filePath}`);
  }
}

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".git" && entry.name !== ".astro") {
        scanDir(fullPath);
      }
    } else if (/\.(ts|js|mjs|astro|json)$/.test(entry.name)) {
      replaceInFile(fullPath);
    }
  }
}

console.log("=== UPDATING ALL CODEBASE PHOTO URLS ===");
scanDir(path.resolve("src"));
scanDir(path.resolve("scripts"));
console.log("✅ Codebase URL update complete!");
