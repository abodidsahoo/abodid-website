import { marked } from "marked";

export function renderBlocksToHtml(blocks) {
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
    return "";
  }

  return blocks
    .map((block) => {
      const type = block.blockType || block.type;
      const content = block.content || block;

      switch (type) {
        case "body_text":
        case "text":
          if (!content.text) return "";
          return `<div>${marked.parse(content.text)}</div>`;

        case "heading": {
          const level = content.level || 2;
          const tag = level === 3 ? "h3" : "h2";
          return `<${tag}>${content.text || ""}</${tag}>`;
        }

        case "quotation":
        case "quote":
          return `<blockquote><p>${content.quote || content.text || ""}</p>${
            content.attribution || content.citation
              ? `<cite>— ${content.attribution || content.citation}</cite>`
              : ""
          }</blockquote>`;

        case "highlight":
          return `<div class="block-highlight" style="border-left: 3px solid var(--text-primary); padding-left: 1.2rem; margin: 1.8rem 0; font-style: italic; color: var(--text-secondary);"><div>${marked.parse(
            content.text || ""
          )}</div></div>`;

        case "single_image":
        case "image": {
          const media = content.media || content;
          const url = media.url || media.imageUrl;
          if (!url) return "";

          if (!media.caption) {
            return `<img src="${url}" alt="${media.alt || ""}" loading="lazy" style="width: 100%; height: auto; border-radius: 4px; margin: 2rem 0; display: block;" />`;
          }

          return `<figure class="block-image" style="margin: 2rem 0; padding: 0; width: 100%;"><img src="${url}" alt="${
            media.alt || media.caption || ""
          }" loading="lazy" style="width: 100%; height: auto; border-radius: 4px; margin: 0; display: block;" /><figcaption style="text-align: center; font-family: var(--font-sans); font-size: 0.85rem; color: var(--text-tertiary); margin-top: 0.75rem;">${
            media.caption
          }</figcaption></figure>`;
        }

        case "video_embed":
        case "video": {
          const url = content.url;
          if (!url) return "";
          let embedUrl = url;
          if (url.includes("youtube.com") || url.includes("youtu.be")) {
            const match = url.match(
              /(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{6,})/
            );
            if (match && match[1]) {
              embedUrl = `https://www.youtube.com/embed/${match[1]}`;
            }
          } else if (url.includes("vimeo")) {
            const id = url.split("/").pop().split("?")[0];
            embedUrl = `https://player.vimeo.com/video/${id}`;
          }

          return `<figure class="block-video" style="margin: 2rem 0; padding: 0; width: 100%;"><div class="video-wrapper" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 8px;"><iframe src="${embedUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allowfullscreen title="${
            content.caption || "Embedded Video"
          }"></iframe></div>${
            content.caption
              ? `<figcaption style="text-align: center; font-family: var(--font-sans); font-size: 0.85rem; color: var(--text-tertiary); margin-top: 0.75rem;">${content.caption}</figcaption>`
              : ""
          }</figure>`;
        }

        case "divider":
          return `<hr class="block-divider" />`;

        case "two_columns":
        case "columns":
          return `<div class="block-columns" style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin: 2rem 0;"><div>${marked.parse(
            content.leftText || ""
          )}</div><div>${marked.parse(content.rightText || "")}</div></div>`;

        default:
          return "";
      }
    })
    .join("");
}
