export const ASSET_ORIGIN = 'https://assets.abodid.com';
export const ORIGINAL_PREFIX = 'photos/originals/';
export const DEFAULT_FOLDERS = ['exhibitions', 'exhibition-photos', 'documentary', 'editorial', 'fine-art', 'commercial'];
const forbidden = /(?:boudoir|punctum|avatar|landing-page|site-assets|site-graphics|ui-assets|profile-avatars)/i;
export const isPortfolioKey = (key) => {
  if (!key.startsWith(ORIGINAL_PREFIX) || forbidden.test(key) || key.includes('..')) return false;
  const parts = key.slice(ORIGINAL_PREFIX.length).split('/');
  return parts.length > 1 && /\.(jpe?g|png|webp|avif)$/i.test(key);
};
export const publicUrl = key => `${ASSET_ORIGIN}/${key.split('/').map(encodeURIComponent).join('/')}`;
const formatTitle = (value) => {
  const lowercaseWords = new Set(['in', 'of', 'an', 'a', 'the', 'on', 'at', 'by', 'for', 'with']);
  const uppercaseWords = new Set(['rca', 'uk', 'iba', 'mres', 'ma']);
  return value.replace(/[-_]+/g, ' ').split(' ').map((word, idx) => {
    const lower = word.toLowerCase();
    if (uppercaseWords.has(lower)) return lower.toUpperCase();
    if (lower === 'and') return '&';
    if (idx > 0 && lowercaseWords.has(lower)) return lower;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(' ');
};
export const humanize = formatTitle;

export function buildCatalog(objects, metadata = {}, folders = DEFAULT_FOLDERS) {
  const keys = new Set(objects.map(x => x.key));
  const matchingOriginals = new Map();
  for (const object of objects.filter(x => isPortfolioKey(x.key))) {
    const hash = object.etag?.replaceAll('"', '');
    if (hash) matchingOriginals.set(hash, [...(matchingOriginals.get(hash) || []), object.key]);
  }
  return objects.filter(x => isPortfolioKey(x.key)).map(object => {
    const relative = object.key.slice(ORIGINAL_PREFIX.length);
    const slash = relative.lastIndexOf('/');
    const directory = relative.slice(0, slash);
    const filename = relative.slice(slash + 1);
    const stem = filename.replace(/\.[^.]+$/, '');
    const folder = directory.split('/')[0] || directory;
    
    const details = metadata[object.key] || {};
    // Directory folder is the raw truth for series segmentation
    const series = details.series || directory.replaceAll('/', '-');
    const title = details.title || humanize(folder);
    const category = details.category || (/exhibit|gradshow|grad-show|frameless/.test(folder) ? 'Exhibitions' : /fashion|uncanny|widow|boudoir/.test(folder) ? 'Fashion & Portraiture' : /market|bus-ride|football|art-fair|uk-2026/.test(folder) ? 'Documentary' : /my-life|birthday/.test(folder) ? 'Personal' : 'Editorial');

    const variant = size => {
      const prefix = `photos/variants/${directory}/${size}/${stem}`;
      const fingerprint = object.etag?.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
      const candidates = [`${prefix}-${fingerprint}.webp`, `${prefix}.webp`];
      const direct = candidates.find(key => keys.has(key));
      if (direct) return direct;
      for (const other of matchingOriginals.get(object.etag?.replaceAll('"', '')) || []) {
        const rel = other.slice(ORIGINAL_PREFIX.length);
        const cut = rel.lastIndexOf('/');
        const base = `photos/variants/${rel.slice(0,cut)}/${size}/${rel.slice(cut+1).replace(/\.[^.]+$/, '')}`;
        const match = [`${base}-${fingerprint}.webp`, `${base}.webp`].find(key => keys.has(key));
        if (match) return match;
      }
      return undefined;
    };
    const smallKey = variant(800), largeKey = variant(1600);
    const origUrl = publicUrl(object.key);
    // 800 preferred for small thumbnails, 1600 preferred for large viewer
    const small = smallKey ? publicUrl(smallKey) : (largeKey ? publicUrl(largeKey) : origUrl);
    const large = largeKey ? publicUrl(largeKey) : origUrl;
    return {
      id: stem, key: object.key, category, series, title,
      label: details.label || category,
      location: details.location || '',
      story: details.story || '',
      alt: details.alt || `${title} — photograph by Abodid Sahoo`,
      camera: details.camera || '',
      width: details.width || 0, height: details.height || 0,
      original: origUrl, small, large,
    };
  }).filter(Boolean);
}
