import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as cheerio from "cheerio";
import ts from "typescript";

const rootDir = process.cwd();
const dataPath = path.join(rootDir, "src/data/xr-showcase.ts");
const outputPath = path.join(rootDir, "src/data/xr-showcase.generated.json");
const userAgent =
  "Mozilla/5.0 (compatible; XRShowcaseMetadataBot/2.0; +https://abodid.com/xr-showcase)";
const requestHeaders = {
  accept: "text/html,application/xhtml+xml",
  "accept-language": "en-GB,en;q=0.9",
  "user-agent": userAgent,
};

const loadShowcaseItems = async () => {
  const source = await readFile(dataPath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: dataPath,
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`;
  const module = await import(moduleUrl);
  return module.xrShowcaseItems;
};

const absolutize = (candidate, baseUrl) => {
  if (!candidate) return undefined;

  try {
    const resolved = new URL(candidate, baseUrl);
    if (resolved.protocol === "http:" && new URL(baseUrl).protocol === "https:") {
      resolved.protocol = "https:";
    }
    return resolved.toString();
  } catch {
    return undefined;
  }
};

const firstMeta = ($, selectors) => {
  for (const selector of selectors) {
    const value = $(selector).attr("content") || $(selector).attr("href");
    if (value) return value.trim();
  }
  return undefined;
};

const looksUsefulImage = (url) => {
  if (!url || url.startsWith("data:")) return false;
  const lower = url.toLowerCase();
  return ![
    "favicon",
    "sprite",
    "cookie",
    "badge",
    "tracking",
    "pixel",
    "logo",
    "icon",
    "avatar",
  ].some((token) => lower.includes(token));
};

const isReachableImage = async (url) => {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: {
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "user-agent": userAgent,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok && (response.headers.get("content-type") || "").startsWith("image/");
  } catch {
    return false;
  }
};

const imageFromJsonLd = ($, baseUrl) => {
  for (const script of $('script[type="application/ld+json"]').toArray()) {
    try {
      const parsed = JSON.parse($(script).contents().text());
      const roots = Array.isArray(parsed) ? parsed : [parsed];
      const nodes = roots.flatMap((root) => [root, ...(root?.["@graph"] || [])]);

      for (const node of nodes) {
        const image = node?.image;
        const candidate =
          typeof image === "string"
            ? image
            : Array.isArray(image)
              ? typeof image[0] === "string"
                ? image[0]
                : image[0]?.url
              : image?.url;
        const resolved = absolutize(candidate, baseUrl);
        if (looksUsefulImage(resolved)) return resolved;
      }
    } catch {
      // Invalid structured data should not block the remaining preview sources.
    }
  }
  return undefined;
};

const youtubeId = (value) => {
  try {
    const url = new URL(value);
    return url.hostname.includes("youtu.be")
      ? url.pathname.slice(1)
      : url.hostname.includes("youtube.com")
        ? url.searchParams.get("v")
        : null;
  } catch {
    return null;
  }
};

const enrichItem = async (item) => {
  if (!item.url) {
    return { id: item.id, status: "gradient", error: "No URL supplied" };
  }

  const domain = new URL(item.url).hostname.replace(/^www\./, "");
  const videoId = youtubeId(item.url);
  if (videoId) {
    const youtubeCandidates = ["maxresdefault", "sddefault", "hqdefault"].map(
      (quality) => `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`,
    );
    let selectedImage;
    for (const candidate of youtubeCandidates) {
      if (await isReachableImage(candidate)) {
        selectedImage = candidate;
        break;
      }
    }

    return {
      id: item.id,
      canonicalUrl: item.url,
      source: "YouTube",
      domain,
      selectedImage,
      status: selectedImage ? "image" : "gradient",
    };
  }

  try {
    const response = await fetch(item.url, {
      headers: requestHeaders,
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`Page request returned ${response.status}`);

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return { id: item.id, domain, status: "gradient", error: "URL is not an HTML page" };
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const canonicalUrl =
      absolutize($('link[rel="canonical"]').attr("href"), response.url) || response.url;
    const ogImage = absolutize(
      firstMeta($, [
        'meta[property="og:image:secure_url"]',
        'meta[property="og:image"]',
        'meta[name="og:image"]',
      ]),
      response.url,
    );
    const twitterImage = absolutize(
      firstMeta($, [
        'meta[name="twitter:image"]',
        'meta[property="twitter:image"]',
        'meta[name="twitter:image:src"]',
      ]),
      response.url,
    );
    const jsonLdImage = imageFromJsonLd($, response.url);
    const contentImage = absolutize(
      $("main img, article img, .content img, img")
        .toArray()
        .map(
          (image) =>
            $(image).attr("src") ||
            $(image).attr("data-src") ||
            $(image).attr("data-lazy-src"),
        )
        .find(looksUsefulImage),
      response.url,
    );
    const imageCandidates = [...new Set([ogImage, twitterImage, jsonLdImage, contentImage])]
      .filter(looksUsefulImage);
    let selectedImage;
    for (const candidate of imageCandidates) {
      if (await isReachableImage(candidate)) {
        selectedImage = candidate;
        break;
      }
    }
    const source =
      firstMeta($, ['meta[property="og:site_name"]', 'meta[name="application-name"]']) ||
      domain;

    return {
      id: item.id,
      canonicalUrl,
      source,
      domain,
      selectedImage,
      status: selectedImage ? "image" : "gradient",
    };
  } catch (error) {
    return {
      id: item.id,
      domain,
      status: "gradient",
      error: error instanceof Error ? error.message : "Unknown metadata error",
    };
  }
};

const items = await loadShowcaseItems();
const metadata = new Array(items.length);
let nextIndex = 0;

const worker = async () => {
  while (nextIndex < items.length) {
    const index = nextIndex;
    nextIndex += 1;
    metadata[index] = await enrichItem(items[index]);
  }
};

await Promise.all(
  Array.from({ length: Math.min(6, items.length) }, () => worker()),
);
await writeFile(outputPath, `${JSON.stringify(metadata, null, 2)}\n`);

const imageCount = metadata.filter((item) => item.selectedImage).length;
console.log(
  `Wrote ${metadata.length} XR previews: ${imageCount} remote images, ${metadata.length - imageCount} gradients.`,
);
