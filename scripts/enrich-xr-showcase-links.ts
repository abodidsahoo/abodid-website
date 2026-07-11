import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";
import { xrShowcaseItems, type XRShowcaseItem } from "../src/data/xr-showcase";

type Metadata = {
  id: string;
  title?: string;
  description?: string;
  canonicalUrl?: string;
  source?: string;
  domain?: string;
  contentType?: string;
  ogImage?: string;
  twitterImage?: string;
  jsonLdImage?: string;
  selectedImage?: string;
  localThumbnail?: string;
  status: XRShowcaseItem["status"];
  error?: string;
};

const rootDir = process.cwd();
const outputPath = path.join(rootDir, "src/data/xr-showcase.generated.json");
const imageDir = path.join(rootDir, "public/images/xr-showcase");
const userAgent =
  "Mozilla/5.0 (compatible; XRShowcaseMetadataBot/1.0; +https://abodid.com/xr-showcase)";

const getYouTubeId = (url: string) => {
  const parsed = new URL(url);
  if (parsed.hostname.includes("youtu.be")) return parsed.pathname.slice(1);
  if (parsed.hostname.includes("youtube.com")) return parsed.searchParams.get("v");
  return null;
};

const absolutize = (candidate: string | undefined, baseUrl: string) => {
  if (!candidate) return undefined;
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return undefined;
  }
};

const firstMeta = ($: cheerio.CheerioAPI, selectors: string[]) => {
  for (const selector of selectors) {
    const value = $(selector).attr("content") || $(selector).attr("href");
    if (value) return value.trim();
  }
  return undefined;
};

const getJsonLdImage = ($: cheerio.CheerioAPI, baseUrl: string) => {
  const scripts = $('script[type="application/ld+json"]').toArray();
  for (const script of scripts) {
    const raw = $(script).contents().text();
    try {
      const parsed = JSON.parse(raw);
      const nodes = Array.isArray(parsed) ? parsed : [parsed, ...(parsed["@graph"] || [])];
      for (const node of nodes) {
        const image = node?.image;
        if (typeof image === "string") return absolutize(image, baseUrl);
        if (Array.isArray(image) && typeof image[0] === "string") return absolutize(image[0], baseUrl);
        if (typeof image?.url === "string") return absolutize(image.url, baseUrl);
      }
    } catch {
      // Invalid JSON-LD should not block the rest of the enrichment run.
    }
  }
  return undefined;
};

const looksUsefulImage = (url: string | undefined) => {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (lower.startsWith("data:")) return false;
  return ![
    "logo",
    "favicon",
    "icon",
    "sprite",
    "avatar",
    "cookie",
    "badge",
  ].some((token) => lower.includes(token));
};

const downloadImage = async (imageUrl: string, itemId: string) => {
  const response = await fetch(imageUrl, { headers: { "user-agent": userAgent } });
  if (!response.ok) throw new Error(`Image request failed: ${response.status}`);

  const contentType = response.headers.get("content-type") || "";
  const extension = contentType.includes("png")
    ? "png"
    : contentType.includes("avif")
      ? "avif"
      : contentType.includes("webp")
        ? "webp"
        : "jpg";
  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.byteLength < 8000) {
    throw new Error("Image was too small to use as a project thumbnail");
  }

  const filename = `${itemId}.${extension}`;
  await writeFile(path.join(imageDir, filename), buffer);
  return `/images/xr-showcase/${filename}`;
};

const enrichItem = async (item: XRShowcaseItem): Promise<Metadata> => {
  if (!item.url) {
    return { id: item.id, status: item.status, error: "No URL supplied" };
  }

  const domain = new URL(item.url).hostname.replace(/^www\./, "");
  const youtubeId = getYouTubeId(item.url);

  if (youtubeId) {
    const thumbnailCandidates = ["maxresdefault", "sddefault", "hqdefault"].map(
      (quality) => `https://img.youtube.com/vi/${youtubeId}/${quality}.jpg`,
    );

    for (const candidate of thumbnailCandidates) {
      try {
        const localThumbnail = await downloadImage(candidate, item.id);
        return {
          id: item.id,
          source: "YouTube",
          domain,
          contentType: "video",
          selectedImage: candidate,
          localThumbnail,
          status: item.status,
        };
      } catch {
        // Try the next YouTube thumbnail quality.
      }
    }
  }

  try {
    const response = await fetch(item.url, { headers: { "user-agent": userAgent } });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    if (!contentType.includes("text/html")) {
      return { id: item.id, domain, contentType, status: item.status };
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const canonicalUrl = absolutize(
      $('link[rel="canonical"]').attr("href") || response.url,
      item.url,
    );
    const title = firstMeta($, ['meta[property="og:title"]', 'meta[name="twitter:title"]']) || $("title").text().trim();
    const description = firstMeta($, [
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
      'meta[name="description"]',
    ]);
    const ogImage = absolutize(firstMeta($, ['meta[property="og:image"]', 'meta[property="og:image:secure_url"]']), item.url);
    const twitterImage = absolutize(firstMeta($, ['meta[name="twitter:image"]', 'meta[property="twitter:image"]']), item.url);
    const jsonLdImage = getJsonLdImage($, item.url);
    const contentImage = absolutize(
      $("main img, article img, .content img, img")
        .toArray()
        .map((img) => $(img).attr("src") || $(img).attr("data-src"))
        .find(looksUsefulImage),
      item.url,
    );
    const selectedImage = [ogImage, twitterImage, jsonLdImage, contentImage].find(looksUsefulImage);
    let localThumbnail: string | undefined;

    if (selectedImage) {
      try {
        localThumbnail = await downloadImage(selectedImage, item.id);
      } catch {
        localThumbnail = undefined;
      }
    }

    return {
      id: item.id,
      title,
      description,
      canonicalUrl,
      source:
        firstMeta($, ['meta[property="og:site_name"]', 'meta[name="application-name"]']) ||
        domain,
      domain,
      contentType: contentType.split(";")[0],
      ogImage,
      twitterImage,
      jsonLdImage,
      selectedImage,
      localThumbnail,
      status: localThumbnail ? item.status : "metadata-review",
    };
  } catch (error) {
    return {
      id: item.id,
      domain,
      status: "metadata-review",
      error: error instanceof Error ? error.message : "Unknown metadata error",
    };
  }
};

await mkdir(imageDir, { recursive: true });

const enriched = [];
for (const item of xrShowcaseItems) {
  enriched.push(await enrichItem(item));
}

await writeFile(outputPath, `${JSON.stringify(enriched, null, 2)}\n`);
console.log(`Wrote ${enriched.length} XR metadata records to ${outputPath}`);
