import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import * as cheerio from "cheerio";
import { measureXRImageQuality } from "./image-quality.js";

const PAGE_LIMIT_BYTES = 3 * 1024 * 1024;
const IMAGE_LIMIT_BYTES = 8 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 5;
const USER_AGENT =
  "Mozilla/5.0 (compatible; XRShowcaseMetadataBot/2.0; +https://abodid.com/xr-showcase)";

const PRIVATE_IPV4_RANGES = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^224\./,
  /^24[0-9]\./,
  /^25[0-5]\./,
];

const isPrivateAddress = (address: string) => {
  if (address === "::1" || address === "::" || address.startsWith("fc") || address.startsWith("fd")) {
    return true;
  }
  if (address.startsWith("fe8") || address.startsWith("fe9") || address.startsWith("fea") || address.startsWith("feb")) {
    return true;
  }
  if (PRIVATE_IPV4_RANGES.some((pattern) => pattern.test(address))) return true;

  const parts = address.split(".").map(Number);
  return parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;
};

const assertPublicHttpUrl = async (value: string) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a complete website URL beginning with http:// or https://.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only public http:// and https:// links are supported.");
  }
  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("Private network links cannot be used.");
  }

  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error("Private network links cannot be used.");
  }

  return url;
};

const fetchPublicUrl = async (
  value: string,
  init: RequestInit = {},
): Promise<{ response: Response; url: URL }> => {
  let url = await assertPublicHttpUrl(value);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const response = await fetch(url, {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return { response, url };
    }

    const location = response.headers.get("location");
    if (!location) throw new Error("The website returned an invalid redirect.");
    url = await assertPublicHttpUrl(new URL(location, url).toString());
  }

  throw new Error("The website redirected too many times.");
};

const readLimitedHtml = async (response: Response) => {
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > PAGE_LIMIT_BYTES) throw new Error("The linked page is too large to inspect.");

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > PAGE_LIMIT_BYTES) throw new Error("The linked page is too large to inspect.");
  return new TextDecoder().decode(bytes);
};

const absolutize = (candidate: string | undefined, baseUrl: string) => {
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

const firstMeta = (selectors: string[], $: cheerio.CheerioAPI) => {
  for (const selector of selectors) {
    const value = $(selector).attr("content") || $(selector).attr("href");
    if (value?.trim()) return value.trim();
  }
  return undefined;
};

const looksUsefulImage = (value: string | undefined) => {
  if (!value || value.startsWith("data:")) return false;
  const lower = value.toLowerCase();
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

const imageFromJsonLd = ($: cheerio.CheerioAPI, baseUrl: string) => {
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
      // Invalid JSON-LD is ignored in favour of other preview sources.
    }
  }
  return undefined;
};

type ImageQuality = {
  url: string;
  width: number;
  height: number;
  pixelArea: number;
  colorfulness: number;
  entropy: number;
  score: number;
};

const inspectImage = async (value: string): Promise<ImageQuality | null> => {
  try {
    const { response } = await fetchPublicUrl(value, {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "User-Agent": USER_AGENT,
      },
    });
    const contentType = response.headers.get("content-type") || "";
    const declaredSize = Number(response.headers.get("content-length") || 0);
    if (
      !response.ok ||
      !contentType.startsWith("image/") ||
      declaredSize > IMAGE_LIMIT_BYTES
    ) {
      return null;
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > IMAGE_LIMIT_BYTES) return null;
    return await measureXRImageQuality(bytes, value);
  } catch {
    return null;
  }
};

const selectBestImage = async (candidates: string[]) => {
  const uniqueCandidates = [...new Set(candidates)].slice(0, 4);
  const inspections = await Promise.all(
    uniqueCandidates.map(async (url) => ({ url, quality: await inspectImage(url) })),
  );
  return inspections
    .filter(
      (inspection): inspection is { url: string; quality: ImageQuality } =>
        Boolean(inspection.quality),
    )
    .sort((left, right) => right.quality.score - left.quality.score)[0] || null;
};

const youtubeId = (value: string) => {
  try {
    const url = new URL(value);
    if (url.hostname.includes("youtu.be")) return url.pathname.slice(1);
    if (url.hostname.includes("youtube.com")) return url.searchParams.get("v");
  } catch {
    return null;
  }
  return null;
};

const tagRules: Array<[string, RegExp]> = [
  ["Augmented Reality", /\baugmented reality\b|\bar\b/i],
  ["Virtual Reality", /\bvirtual reality\b|\bvr\b/i],
  ["Mixed Reality", /\bmixed reality\b|\bmr\b/i],
  ["XR", /\bextended reality\b|\bxr\b/i],
  ["Fashion", /\bfashion\b|\bgarment/i],
  ["Retail", /\bretail\b|\bshopping\b/i],
  ["Immersive Experience", /\bimmersive\b/i],
  ["Installation", /\binstallation\b/i],
  ["Museums", /\bmuseum\b|\bgallery\b|\bcultural\b/i],
  ["Research", /\bresearch\b|\bstudy\b|\bacademic\b/i],
  ["Audience Insight", /\baudience\b|\buser experience\b|\bvisitor\b/i],
  ["Education", /\beducation\b|\blearning\b|\bcourse\b|\bprogramme\b/i],
  ["Mentorship", /\bmentor/i],
  ["Funding", /\bfunding\b|\bgrant\b|\bfund\b/i],
  ["Travel", /\btravel\b|\btourism\b|\bdestination\b/i],
  ["Metaverse", /\bmetaverse\b/i],
  ["Real-Time Graphics", /\breal[ -]?time\b|\brealtime\b/i],
  ["Creative Technology", /\bcreative technolog/i],
];

const inferPrimaryGenre = (text: string) => {
  const rules: Array<[string, RegExp]> = [
    ["Fashion XR", /\bfashion\b.*\b(xr|ar|vr|virtual|augmented|immersive|digital)\b|\b(xr|ar|vr|virtual|augmented|immersive|digital)\b.*\bfashion\b/i],
    ["Museums & Culture", /\bmuseum\b|\bgallery\b|\bcultural\b/i],
    ["Funding", /\bfunding\b|\bgrant\b|\bfund\b/i],
    ["Education & Mentorship", /\beducation\b|\bmentor|\bcourse\b|\bprogramme\b/i],
    ["Audience Insight", /\baudience\b|\buser experience\b|\bvisitor experience\b/i],
    ["Research", /\bresearch\b|\bstudy\b|\bacademic\b|\bjournal\b/i],
    ["Retail", /\bretail\b|\bshopping\b/i],
    ["Travel", /\btravel\b|\btourism\b|\bdestination\b/i],
    ["Immersive Installation", /\binstallation\b|\bimmersive exhibition\b/i],
    ["Augmented Reality", /\baugmented reality\b|\bar\b/i],
    ["Virtual Reality", /\bvirtual reality\b|\bvr\b/i],
  ];
  return rules.find(([, pattern]) => pattern.test(text))?.[0] || "Creative Concepts";
};

const cleanTag = (value: string) =>
  value
    .replace(/^#+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);

const uniqueTags = (values: string[]) => {
  const seen = new Set<string>();
  return values.filter((value) => {
    const cleaned = cleanTag(value);
    const key = cleaned.toLowerCase();
    if (!cleaned || key.length < 2 || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(cleanTag);
};

export type XRLinkMetadata = {
  sourceUrl: string;
  canonicalUrl: string;
  title: string;
  description: string;
  sourceName: string;
  sourceDomain: string;
  previewImageUrl: string | null;
  imageAlt: string;
  primaryGenre: string;
  tags: string[];
  metadataStatus: "ready" | "no_image";
  metadata: Record<string, unknown>;
};

export const extractXRLinkMetadata = async (sourceUrl: string): Promise<XRLinkMetadata> => {
  const requestedUrl = await assertPublicHttpUrl(sourceUrl.trim());
  const domain = requestedUrl.hostname.replace(/^www\./, "");
  const videoId = youtubeId(requestedUrl.toString());

  if (videoId) {
    let videoTitle = "YouTube XR reference";
    let channelName = "YouTube";
    try {
      const oEmbedUrl = new URL("https://www.youtube.com/oembed");
      oEmbedUrl.searchParams.set("url", requestedUrl.toString());
      oEmbedUrl.searchParams.set("format", "json");
      const { response } = await fetchPublicUrl(oEmbedUrl.toString(), {
        headers: {
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
      });
      if (response.ok) {
        const details = (await response.json()) as {
          title?: string;
          author_name?: string;
        };
        videoTitle = details.title?.trim() || videoTitle;
        channelName = details.author_name?.trim() || channelName;
      }
    } catch {
      // The standard YouTube preview still works when oEmbed is unavailable.
    }

    const candidates = ["maxresdefault", "sddefault", "hqdefault"].map(
      (quality) => `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`,
    );
    const selectedImage = await selectBestImage(candidates);
    const previewImageUrl = selectedImage?.url || null;

    return {
      sourceUrl: requestedUrl.toString(),
      canonicalUrl: requestedUrl.toString(),
      title: videoTitle.slice(0, 180),
      description: `${videoTitle}, an XR video reference published by ${channelName} on YouTube.`.slice(
        0,
        1200,
      ),
      sourceName: channelName.slice(0, 120),
      sourceDomain: domain,
      previewImageUrl,
      imageAlt: `${videoTitle.slice(0, 140)} preview image`,
      primaryGenre: "Creative Concepts",
      tags: ["XR", "Video"],
      metadataStatus: previewImageUrl ? "ready" : "no_image",
      metadata: {
        provider: "youtube",
        videoId,
        fetchedAt: new Date().toISOString(),
        image_quality: selectedImage?.quality || null,
      },
    };
  }

  const { response, url: finalUrl } = await fetchPublicUrl(requestedUrl.toString(), {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-GB,en;q=0.9",
      "User-Agent": USER_AGENT,
    },
  });
  if (!response.ok) throw new Error(`The website returned ${response.status}.`);
  if (!(response.headers.get("content-type") || "").includes("text/html")) {
    throw new Error("The link does not point to a readable web page.");
  }

  const html = await readLimitedHtml(response);
  const $ = cheerio.load(html);
  const canonicalUrl =
    absolutize($('link[rel="canonical"]').attr("href"), finalUrl.toString()) ||
    finalUrl.toString();
  const sourceDomain = new URL(canonicalUrl).hostname.replace(/^www\./, "");
  const sourceName =
    firstMeta(['meta[property="og:site_name"]', 'meta[name="application-name"]'], $) ||
    sourceDomain;
  const title =
    firstMeta(['meta[property="og:title"]', 'meta[name="twitter:title"]'], $) ||
    $("title").first().text().trim() ||
    sourceName;
  const suppliedDescription = firstMeta(
    [
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
      'meta[name="description"]',
    ],
    $,
  );
  const description =
    suppliedDescription ||
    `Explore ${title}, an XR reference published by ${sourceName}.`;

  const candidates = [
    absolutize(
      firstMeta(
        [
          'meta[property="og:image:secure_url"]',
          'meta[property="og:image"]',
          'meta[name="og:image"]',
        ],
        $,
      ),
      finalUrl.toString(),
    ),
    absolutize(
      firstMeta(
        [
          'meta[name="twitter:image"]',
          'meta[property="twitter:image"]',
          'meta[name="twitter:image:src"]',
        ],
        $,
      ),
      finalUrl.toString(),
    ),
    imageFromJsonLd($, finalUrl.toString()),
    absolutize(
      $("main img, article img, .content img, img")
        .toArray()
        .map(
          (image) =>
            $(image).attr("src") ||
            $(image).attr("data-src") ||
            $(image).attr("data-lazy-src"),
        )
        .find(looksUsefulImage),
      finalUrl.toString(),
    ),
  ].filter((value): value is string => Boolean(value && looksUsefulImage(value)));

  const selectedImage = await selectBestImage(candidates);
  const previewImageUrl = selectedImage?.url || null;

  const metadataKeywords = [
    ...(firstMeta(['meta[name="keywords"]'], $)?.split(",") || []),
    ...$('meta[property="article:tag"]')
      .toArray()
      .map((element) => $(element).attr("content") || ""),
  ];
  const classificationText = `${title} ${description} ${metadataKeywords.join(" ")}`;
  const inferredTags = tagRules
    .filter(([, pattern]) => pattern.test(classificationText))
    .map(([tag]) => tag);
  const tags = uniqueTags([...inferredTags, ...metadataKeywords]).slice(0, 12);
  const primaryGenre = inferPrimaryGenre(classificationText);

  return {
    sourceUrl: requestedUrl.toString(),
    canonicalUrl,
    title: title.slice(0, 180),
    description: description.slice(0, 1200),
    sourceName: sourceName.slice(0, 120),
    sourceDomain,
    previewImageUrl,
    imageAlt: `${title.slice(0, 140)} preview image`,
    primaryGenre,
    tags: tags.length ? tags : ["XR"],
    metadataStatus: previewImageUrl ? "ready" : "no_image",
    metadata: {
      fetchedAt: new Date().toISOString(),
      finalUrl: finalUrl.toString(),
      pageTitle: title,
      suppliedDescription: Boolean(suppliedDescription),
      image_quality: selectedImage?.quality || null,
    },
  };
};
