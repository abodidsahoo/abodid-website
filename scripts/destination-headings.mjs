import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";

// Put linked headings in the outgoing HTML. A first click needs no metadata request.
export default function destinationHeadings() {
  return {
    name: "destination-headings",
    hooks: {
      "astro:server:setup": ({ server }) => {
        // Match Vercel's directory-index handling for the embedded static studio in dev.
        server.middlewares.use((req, _res, next) => {
          const url = new URL(req.url || "/", "http://localhost");
          if (/^\/podcast-studio(?:\/[a-z-]+)?$/.test(url.pathname)) {
            const index = url.pathname + "/index.html";
            if (existsSync(new URL("../public" + index, import.meta.url))) req.url = index + url.search;
          }
          next();
        });
      },
      "astro:build:generated": async ({ dir }) => {
        const root = fileURLToPath(dir);
        const files = (await readdir(root, { recursive: true })).filter(name => name.endsWith(".html"));
        const titles = new Map();
        const pages = [];
        for (const name of files) {
          const file = join(root, name);
          const route = "/" + relative(root, file).split(sep).join("/").replace(/(?:^|\/)index\.html$/, "");
          const html = await readFile(file, "utf8");
          const $ = load(html);
          const heading = $("main h1").first();
          // Adjacent title spans and line breaks should retain word boundaries.
          heading.find("br").replaceWith(" ");
          const title = (heading.text() || $("title").first().text()).replace(/\s+/g, " ").trim();
          if (title && !/noindex/i.test($('meta[name="robots"]').attr("content") || "")) titles.set(route, title);
          const links = new Set();
          for (const link of $("a[href]").toArray()) {
            try {
              const url = new URL($(link).attr("href"), new URL(route, "https://abodid.com"));
              if (url.origin === "https://abodid.com") links.add(url.pathname.replace(/\/+$/, "") || "/");
            } catch { /* Non-navigable URLs have no heading. */ }
          }
          pages.push({ file, links });
        }
        for (const { file, links } of pages) {
          const html = await readFile(file, "utf8");
          if (!html.includes('data-destination-headings="build"')) continue;
          const linked = Object.fromEntries([...links].filter(path => titles.has(path)).map(path => [path, titles.get(path)]));
          const encoded = JSON.stringify(linked).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
          await writeFile(file, html.replace('data-destination-headings="build"', () => 'data-destination-headings="' + encoded + '"'));
        }
        await writeFile(join(root, "destination-headings.json"), JSON.stringify(Object.fromEntries(titles)));
      },
    },
  };
}
