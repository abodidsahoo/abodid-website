import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { getTransformedRoutes } from "@vercel/routing-utils";

const root = new URL("../", import.meta.url);
const astroConfig = fs.readFileSync(new URL("astro.config.mjs", root), "utf8");
const vercelConfig = JSON.parse(fs.readFileSync(new URL("vercel.json", root), "utf8"));

const transformed = getTransformedRoutes({
  redirects: vercelConfig.redirects,
  rewrites: vercelConfig.rewrites || [],
  headers: vercelConfig.headers || [],
  trailingSlash: vercelConfig.trailingSlash,
});

assert.equal(transformed.error, null);

function resolveRedirect(rawUrl) {
  const url = new URL(rawUrl);

  for (const route of transformed.routes) {
    if (!route.src || !route.status || !route.headers?.Location) continue;
    if (route.has?.some((condition) => condition.type === "host" && condition.value !== url.host)) {
      continue;
    }

    const match = url.pathname.match(new RegExp(route.src));
    if (!match) continue;

    let location = route.headers.Location;
    for (let index = 1; index < match.length; index += 1) {
      location = location.replaceAll(`$${index}`, match[index] || "");
    }

    const destination = new URL(location, url.origin);
    if (!destination.search) destination.search = url.search;
    return { status: route.status, location: destination.toString() };
  }

  return null;
}

test("keeps Astro middleware out of the shared Vercel edge renderer", () => {
  assert.doesNotMatch(astroConfig, /edgeMiddleware\s*:\s*true/);
});

test("redirects Lab host paths before Astro rendering", () => {
  assert.deepEqual(resolveRedirect("https://lab.abodid.com/"), {
    status: 308,
    location: "https://abodid.com/lab",
  });
  assert.deepEqual(resolveRedirect("https://lab.abodid.com/sequence-room?board=demo"), {
    status: 308,
    location: "https://abodid.com/lab/sequence-room?board=demo",
  });
  assert.deepEqual(resolveRedirect("https://lab.abodid.com/research/papers"), {
    status: 308,
    location: "https://abodid.com/research/papers",
  });
  assert.deepEqual(resolveRedirect("https://lab.abodid.com/_astro/app.js"), {
    status: 308,
    location: "https://abodid.com/_astro/app.js",
  });
});

test("redirects Curation and Photography hosts before Astro rendering", () => {
  assert.deepEqual(resolveRedirect("https://curation.abodid.com/resource/example/edit"), {
    status: 308,
    location: "https://abodid.com/resources/example/edit",
  });
  assert.deepEqual(resolveRedirect("https://curation.abodid.com/dashboard?view=saved"), {
    status: 308,
    location: "https://abodid.com/resources/dashboard?view=saved",
  });
  assert.deepEqual(resolveRedirect("https://photos.abodid.com/series?name=archive"), {
    status: 308,
    location: "https://abodid.com/photography-portfolio/series?name=archive",
  });
});

test("does not redirect canonical main-site dynamic routes", () => {
  assert.equal(resolveRedirect("https://abodid.com/lab/sequence-room"), null);
  assert.equal(resolveRedirect("https://abodid.com/api/sequence-room/share"), null);
  assert.equal(resolveRedirect("https://abodid.com/obsidian-vault/topic/grope"), null);
});

test("keeps legacy Lab redirects at the platform routing layer", () => {
  assert.deepEqual(resolveRedirect("https://abodid.com/research/polaroid-hub/the-hub"), {
    status: 308,
    location: "https://abodid.com/lab/sequence-room",
  });
  assert.deepEqual(resolveRedirect("https://abodid.com/research/punctum/results/photo-one?session=abc"), {
    status: 308,
    location: "https://abodid.com/lab/punctum/results/photo-one?session=abc",
  });
});
