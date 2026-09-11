const normalizeHostname = (hostname = "") =>
  hostname.trim().toLowerCase().replace(/:\d+$/, "");

export const isPhotographyHostname = (hostname) => {
  const norm = normalizeHostname(hostname);
  return norm === 'photos.abodid.com' || norm === 'photos.localhost';
};

export function photographyDestination(url) {
  if (!isPhotographyHostname(url.hostname)) return null;
  if (url.pathname === '/') return '/photography-portfolio';
  if (url.pathname === '/robots.txt') return '/photography-portfolio/robots.txt';
  if (url.pathname === '/sitemap.xml') return '/photography-portfolio/sitemap.xml';
  return null;
}

export function getPhotosSubdomainRedirect(url) {
  if (!isPhotographyHostname(url.hostname)) return null;
  if (photographyDestination(url)) return null;
  if (
    url.pathname.startsWith('/_astro/') ||
    url.pathname.startsWith('/_image') ||
    url.pathname.startsWith('/api/') ||
    url.pathname === '/favicon.ico' ||
    url.pathname === '/favicon.svg'
  ) {
    return null;
  }
  return `https://abodid.com${url.pathname}${url.search}`;
}

