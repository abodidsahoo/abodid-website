import { marked } from "marked";
import path from "node:path";

export function renderManualMarkdown(rawMarkdown: string): string {
  if (!rawMarkdown) return "";

  // 1. Universal Markdown Link Rewriter
  // Converts ANY relative .md links across the manual into canonical web paths:
  // e.g. [INDEX.md](./INDEX.md) -> /system-manual/index
  // e.g. [03.00 Design System](../03-visual-system/03.00-abodid-pop-editorial-design-system.md) -> /system-manual/03.00-abodid-pop-editorial-design-system
  // e.g. [00.00 Manual Charter](./00-manual/00.00-manual-charter.md) -> /system-manual/00.00-manual-charter
  let processed = rawMarkdown.replace(
    /\[([^\]]+)\]\(([^)]+\.md)\)/gi,
    (match, text, rawHref) => {
      const filename = path.basename(rawHref, ".md");
      const lower = filename.toLowerCase();

      if (lower === "readme") {
        return `[${text}](/system-manual)`;
      }
      if (lower === "index") {
        return `[${text}](/system-manual/index)`;
      }
      if (lower === "glossary") {
        return `[${text}](/system-manual/glossary)`;
      }
      if (lower === "changelog") {
        return `[${text}](/system-manual/changelog)`;
      }

      return `[${text}](/system-manual/${filename})`;
    },
  );

  // 2. Transform GitHub Alert Callouts:
  // > [!NOTE]
  // > Text
  const calloutRegex = />\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n((?:>.*\n?)*)/gi;
  processed = processed.replace(calloutRegex, (match, type, body) => {
    const cleanBody = body
      .split("\n")
      .map((line: string) => line.replace(/^>\s?/, ""))
      .join("\n")
      .trim();
    const alertType = type.toLowerCase();
    const icon =
      alertType === "note"
        ? "ℹ️"
        : alertType === "tip"
          ? "💡"
          : alertType === "important"
            ? "🟣"
            : alertType === "warning"
              ? "⚠️"
              : "🚨";

    return `\n\n<div class="manual-callout callout-${alertType}">
<div class="manual-callout-title">${icon} ${type.toUpperCase()}</div>
${marked.parse(cleanBody)}
</div>\n\n`;
  });

  // 3. Configure custom Marked renderer
  const renderer = new marked.Renderer();

  // Custom Code block renderer (Mermaid + Syntax header)
  renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
    const language = (lang || "").toLowerCase().trim();

    if (language === "mermaid") {
      return `<div class="manual-mermaid-block mermaid">${text}</div>`;
    }

    const displayLang = language || "code";
    return `<div class="manual-code-wrapper">
  <div class="manual-code-header">
    <span class="manual-code-lang">${displayLang.toUpperCase()}</span>
    <button type="button" class="manual-copy-btn" onclick="navigator.clipboard.writeText(this.closest('.manual-code-wrapper').querySelector('pre').innerText); this.innerText='Copied!'; setTimeout(() => this.innerText='Copy', 2000)">Copy</button>
  </div>
  <pre><code class="language-${displayLang}">${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>
</div>`;
  };

  // Heading renderer: Clean ID attribute, NO visible '#' hashtag
  renderer.heading = function ({ text, depth }: { text: string; depth: number }) {
    const slug = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");
    return `<h${depth} id="${slug}">${text}</h${depth}>`;
  };

  return marked.parse(processed, { renderer }) as string;
}
