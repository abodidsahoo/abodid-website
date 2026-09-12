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

const rewritePath = (url, pathname) => rewrite(`${pathname}${url.search}`);

export default function middleware(request) {
  const url = requestUrlWithForwardedHost(request);

  if (isCurationHostname(url.hostname)) {
    const canonicalRedirect = getCurationCanonicalRedirect(url);
    if (canonicalRedirect) return permanentRedirect(canonicalRedirect);

    const internalPath = curationPathToInternalPath(url.pathname);
    if (internalPath) return rewritePath(url, internalPath);

    const externalRedirect = getCurationSubdomainRedirect(url);
    return externalRedirect ? permanentRedirect(externalRedirect) : next();
  }

  if (isLabHostname(url.hostname)) {
    const canonicalRedirect = getLabCanonicalRedirect(url);
    if (canonicalRedirect) return permanentRedirect(canonicalRedirect);

    const internalPath = labDestination(url);
    if (internalPath) return rewritePath(url, internalPath);

    const externalRedirect = getLabSubdomainRedirect(url);
    return externalRedirect ? permanentRedirect(externalRedirect) : next();
  }

  if (isPhotographyHostname(url.hostname)) {
    const internalPath = photographyDestination(url);
    if (internalPath) return rewritePath(url, internalPath);

    const externalRedirect = getPhotosSubdomainRedirect(url);
    return externalRedirect ? permanentRedirect(externalRedirect) : next();
  }

  const resourceRedirect = getLegacyResourceRedirect(url);
  if (resourceRedirect) return permanentRedirect(resourceRedirect);

  const labRedirect = legacyLabRedirectLocation(url);
  if (labRedirect) return permanentRedirect(labRedirect);

  return next();
}
