// ---------------------------------------------------------------------------
// ⚠️  DEPRECATED — This file is NOT executed in production.
// ---------------------------------------------------------------------------
// Vercel ignores the root middleware.js file convention for Astro projects
// because @astrojs/vercel builds its own routing config. All subdomain
// routing logic has been moved to src/middleware.ts (Astro's middleware),
// which IS compiled into the Vercel build and runs for every request.
//
// This file is kept as reference only. Do not add new routing logic here.
// See: https://vercel.com/docs/functions/edge-middleware
//      "You can't use proxy with frameworks that build their own routing
//       middleware, such as Next.js and Astro."
// ---------------------------------------------------------------------------

import { next, rewrite } from '@vercel/functions';

import {
  curationPathToInternalPath,
  getCurationCanonicalRedirect,
  getCurationSubdomainRedirect,
  getLegacyResourceRedirect,
  isCurationHostname,
} from './src/lib/curationRoutes.js';
import {
  getLabCanonicalRedirect,
  getLabSubdomainRedirect,
  isLabHostname,
  labDestination,
  legacyLabRedirectLocation,
} from './src/lib/labRoutes.js';
import {
  getPhotosSubdomainRedirect,
  isPhotographyHostname,
  photographyDestination,
} from './src/lib/photography/routing.mjs';

export const config = { runtime: 'nodejs' };

const permanentRedirect = (location) =>
  new Response(null, {
    status: 308,
    headers: { Location: location },
  });

const requestUrlWithForwardedHost = (request) => {
  const url = new URL(request.url);
  const rawHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const forwardedHost = rawHost?.split(',')[0]?.trim();

  if (forwardedHost) {
    url.host = forwardedHost;
  }

  return url;
};

const rewritePath = (request, publicUrl, pathname) => {
  // Rewrite against the URL Vercel gave the middleware, rather than emitting a
  // relative target. Relative rewrites can resolve static files, but they do
  // not reliably re-enter Astro's server renderer for on-demand routes such as
  // /lab, /resources, and /resources/admin.
  const destination = new URL(request.url);
  destination.pathname = pathname;
  destination.search = publicUrl.search;
  return rewrite(destination);
};

export default function middleware(request) {
  const url = requestUrlWithForwardedHost(request);

  if (isCurationHostname(url.hostname)) {
    const canonicalRedirect = getCurationCanonicalRedirect(url);
    if (canonicalRedirect) return permanentRedirect(canonicalRedirect);

    const internalPath = curationPathToInternalPath(url.pathname);
    if (internalPath) return rewritePath(request, url, internalPath);

    const externalRedirect = getCurationSubdomainRedirect(url);
    return externalRedirect ? permanentRedirect(externalRedirect) : next();
  }

  if (isLabHostname(url.hostname)) {
    const dest = getLabSubdomainRedirect(url);
    if (dest) return permanentRedirect(dest);
    const destPath = url.pathname === '/' ? '/lab' : (url.pathname.startsWith('/lab') ? url.pathname : `/lab${url.pathname}`);
    return permanentRedirect(`https://abodid.com${destPath}${url.search}`);
  }

  if (isPhotographyHostname(url.hostname)) {
    const internalPath = photographyDestination(url);
    if (internalPath) return rewritePath(request, url, internalPath);

    const externalRedirect = getPhotosSubdomainRedirect(url);
    return externalRedirect ? permanentRedirect(externalRedirect) : next();
  }

  const resourceRedirect = getLegacyResourceRedirect(url);
  if (resourceRedirect) return permanentRedirect(resourceRedirect);

  const labRedirect = legacyLabRedirectLocation(url);
  if (labRedirect) return permanentRedirect(labRedirect);

  return next();
}
