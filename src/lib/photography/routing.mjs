export function photographyDestination(url) {
  if (url.hostname !== 'photos.abodid.com') return null;
  if (url.pathname === '/') return '/photography-portfolio';
  if (url.pathname === '/robots.txt') return '/photography-portfolio/robots.txt';
  if (url.pathname === '/sitemap.xml') return '/photography-portfolio/sitemap.xml';
  return null;
}
