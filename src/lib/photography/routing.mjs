const normalizeHostname = (hostname = "") =>
  hostname.trim().toLowerCase().replace(/:\d+$/, "");

export const isPhotographyHostname = (hostname) => {
  const norm = normalizeHostname(hostname);
  return norm === 'photos.abodid.com' || norm === 'photos.localhost';
};

export function photographyDestination(_url) {
  return null;
}

export function getPhotosSubdomainRedirect(url) {
  if (!isPhotographyHostname(url.hostname)) return null;
  const pathname = url.pathname === '/' ? '/photography-portfolio' : (url.pathname.startsWith('/photography-portfolio') ? url.pathname : `/photography-portfolio${url.pathname}`);
  return `https://abodid.com${pathname}${url.search}`;
}


