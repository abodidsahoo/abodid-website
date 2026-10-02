const IMAGE_URL_PATTERN = /\.(?:avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i;
const SOURCE_ATTRIBUTES = [
  "data-srcset",
  "srcset",
  "data-original-src",
  "data-original",
  "data-full-src",
  "data-hi-res-src",
  "data-src",
  "src",
];

let lastContext = null;

const absoluteUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw || raw.startsWith("javascript:")) return "";
  try {
    return new URL(raw, document.baseURI).href;
  } catch {
    return "";
  }
};

const bestSrcsetUrl = (value) => {
  const choices = String(value || "")
    .split(",")
    .map((part) => {
      const match = part.trim().match(/^(\S+)(?:\s+(\d+(?:\.\d+)?)(w|x))?$/);
      if (!match) return null;
      const amount = Number(match[2] || 1);
      const score = match[3] === "x" ? amount * 10_000 : amount;
      return { url: absoluteUrl(match[1]), score };
    })
    .filter((choice) => choice?.url)
    .sort((a, b) => b.score - a.score);
  return choices[0]?.url || "";
};

const selectorFor = (element) => {
  if (!(element instanceof Element)) return "";
  const parts = [];
  let node = element;
  while (node && node !== document.documentElement && parts.length < 7) {
    let part = node.localName;
    if (!part) break;
    if (node.id) {
      part += `#${CSS.escape(node.id)}`;
      parts.unshift(part);
      break;
    }
    const classes = [...node.classList].slice(0, 3);
    if (classes.length) part += `.${classes.map((name) => CSS.escape(name)).join(".")}`;
    const parent = node.parentElement;
    if (parent) {
      const siblings = [...parent.children].filter((child) => child.localName === node.localName);
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
    }
    parts.unshift(part);
    node = parent;
  }
  return parts.join(" > ");
};

const elementDetails = (element, url, sourceKind, css = "") => ({
  url,
  sourceKind,
  selector: selectorFor(element),
  tagName: element.localName,
  html: element.outerHTML?.slice(0, 2_000) || "",
  css,
});

const urlFromImage = (image) => {
  const srcsets = [];
  for (const source of image.closest("picture")?.querySelectorAll("source[srcset], source[data-srcset]") || []) {
    srcsets.push(source.getAttribute("data-srcset"), source.getAttribute("srcset"));
  }
  srcsets.push(image.getAttribute("data-srcset"), image.getAttribute("srcset"));
  for (const srcset of srcsets) {
    const best = bestSrcsetUrl(srcset);
    if (best) return { url: best, sourceKind: "srcset" };
  }

  const current = absoluteUrl(image.currentSrc);
  if (current) return { url: current, sourceKind: "currentSrc" };
  for (const attribute of SOURCE_ATTRIBUTES) {
    const value = image.getAttribute(attribute);
    const url = attribute.includes("srcset") ? bestSrcsetUrl(value) : absoluteUrl(value);
    if (url) return { url, sourceKind: attribute };
  }
  return null;
};

const urlsFromCss = (backgroundImage) => {
  const urls = [];
  const pattern = /url\(\s*(["']?)(.*?)\1\s*\)/gi;
  let match;
  while ((match = pattern.exec(backgroundImage || ""))) {
    const url = absoluteUrl(match[2]);
    if (url) urls.push(url);
  }
  return urls;
};

const directCandidate = (element) => {
  if (element instanceof HTMLImageElement) {
    const source = urlFromImage(element);
    if (source) return elementDetails(element, source.url, source.sourceKind);
  }

  if (element instanceof HTMLVideoElement) {
    const poster = absoluteUrl(element.poster);
    if (poster) return elementDetails(element, poster, "video-poster");
  }

  if (element instanceof SVGImageElement) {
    const href = absoluteUrl(element.href?.baseVal || element.getAttribute("href"));
    if (href) return elementDetails(element, href, "svg-image");
  }

  for (const pseudo of [null, "::before", "::after"]) {
    const style = getComputedStyle(element, pseudo);
    const [url] = urlsFromCss(style.backgroundImage);
    if (url) {
      const css = `${pseudo ? `${pseudo} ` : ""}background-image: ${style.backgroundImage};`;
      return elementDetails(element, url, pseudo ? "pseudo-background" : "css-background", css);
    }
  }

  if (element instanceof HTMLAnchorElement && IMAGE_URL_PATTERN.test(element.href)) {
    return elementDetails(element, element.href, "image-link");
  }

  for (const attribute of SOURCE_ATTRIBUTES) {
    const value = element.getAttribute(attribute);
    if (!value) continue;
    const url = attribute.includes("srcset") ? bestSrcsetUrl(value) : absoluteUrl(value);
    if (url && (IMAGE_URL_PATTERN.test(url) || url.startsWith("data:image/"))) {
      return elementDetails(element, url, attribute);
    }
  }

  return null;
};

const descendantCandidate = (element, x, y) => {
  if (element === document.body || element === document.documentElement) return null;
  const rect = element.getBoundingClientRect();
  const viewportArea = Math.max(1, innerWidth * innerHeight);
  if (rect.width * rect.height > viewportArea * 0.92) return null;

  const descendants = [...element.querySelectorAll("img, picture img, video[poster], svg image")];
  descendants.sort((left, right) => {
    const a = left.getBoundingClientRect();
    const b = right.getBoundingClientRect();
    const aContains = x >= a.left && x <= a.right && y >= a.top && y <= a.bottom;
    const bContains = x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
    if (aContains !== bContains) return aContains ? -1 : 1;
    const aDistance = Math.hypot(x - (a.left + a.width / 2), y - (a.top + a.height / 2));
    const bDistance = Math.hypot(x - (b.left + b.width / 2), y - (b.top + b.height / 2));
    return aDistance - bDistance;
  });

  for (const descendant of descendants.slice(0, 8)) {
    const candidate = directCandidate(descendant);
    if (candidate) return { ...candidate, sourceKind: `descendant-${candidate.sourceKind}` };
  }
  return null;
};

const resolveImageAtPoint = (x, y, eventPath = []) => {
  const elements = [];
  for (const item of [...eventPath, ...document.elementsFromPoint(x, y)]) {
    if (item instanceof Element && !elements.includes(item)) elements.push(item);
  }

  for (const element of elements) {
    const candidate = directCandidate(element);
    if (candidate) return candidate;
  }
  for (const element of elements) {
    const candidate = descendantCandidate(element, x, y);
    if (candidate) return candidate;
  }
  return null;
};

document.addEventListener("contextmenu", (event) => {
  const image = resolveImageAtPoint(event.clientX, event.clientY, event.composedPath());
  lastContext = {
    x: event.clientX,
    y: event.clientY,
    capturedAt: Date.now(),
    image,
  };

  // Some galleries deliberately suppress their own image context menus. When
  // there is an image under the pointer, keep the native Chrome menu available.
  if (image) event.stopImmediatePropagation();
}, true);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "resolve-moodboard-image") return;
  const fresh = lastContext && Date.now() - lastContext.capturedAt < 30_000;
  const image = fresh
    ? (lastContext.image || resolveImageAtPoint(lastContext.x, lastContext.y))
    : null;
  sendResponse({ image });
});
