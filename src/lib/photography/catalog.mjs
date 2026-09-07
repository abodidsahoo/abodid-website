export const ASSET_ORIGIN = 'https://assets.abodid.com';
export const ORIGINAL_PREFIX = 'photos/originals/';
export const DEFAULT_FOLDERS = ['exhibitions', 'exhibition-photos', 'documentary', 'editorial', 'fine-art', 'commercial'];
const forbidden = /(?:punctum|avatar|landing-page|site-assets|site-graphics|ui-assets|profile-avatars)/i;
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
const humanize = formatTitle;
const seriesRules = [
  ['rca-outernet', 'outernet', 'Outernet', 'RCA · 2024', 'London', 'Digital Direction at Outernet, London.'],
  ['into-the-flux', 'into-the-flux', 'Into the Flux', 'IBA · London', 'London', 'An exhibition at IBA, London.'],
  ['breathe-variations', 'breathe-variations', 'Breathe / Variations', 'RCA · 2023', 'London', 'Breathe / Variations at the Royal College of Art.'],
  ['hidden-exhibition', 'hidden', 'Hidden', 'RCA', 'London', 'Hidden exhibition at the Royal College of Art.'],
  ['rca-digital-direction', 'digital-direction', 'Digital Direction', 'RCA · 2024', 'London', 'The 2024 Digital Direction graduate exhibition at the Royal College of Art.'],
  ['rca-grad-show-truman', 'truman-brewery', 'Truman Brewery', 'RCA · Graduate show', 'London', 'The Royal College of Art graduate show at Truman Brewery.'],
  ['rca-2023-ting', 'ting', 'Ting', 'Collaboration · 2023', 'London', 'A photographic collaboration with Ting at the Royal College of Art.'],
  ['rca-2023-ma-print', 'print', 'In Print', 'RCA · 2023', 'London', 'MA Print exhibition at the Royal College of Art.'],
  ['rca-2023-mres', 'mres', 'Research in View', 'RCA · 2023', 'London', 'MRes exhibition at the Royal College of Art.'],
];
export function buildCatalog(objects, metadata = {}, folders = DEFAULT_FOLDERS) {
  const keys = new Set(objects.map(x => x.key));
  return objects.filter(x => isPortfolioKey(x.key, folders)).map(object => {
    const relative = object.key.slice(ORIGINAL_PREFIX.length);
    const slash = relative.lastIndexOf('/');
    const directory = relative.slice(0, slash);
    const filename = relative.slice(slash + 1);
    const stem = filename.replace(/\.[^.]+$/, '');
    const folder = relative.split('/')[0];
    const category = /^exhibition/.test(folder) ? 'Exhibitions' : humanize(folder);
    const rule = seriesRules.find(([prefix]) => stem.startsWith(prefix));
    const details = metadata[object.key] || {};
    const series = details.series || rule?.[1] || directory.replaceAll('/', '-');
    const title = details.title || rule?.[2] || humanize(directory.split('/').pop());
    const variant = size => {
      const prefix = `photos/variants/${directory}/${size}/${stem}`;
      const fingerprint = object.etag?.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
      const candidates = [`${prefix}-${fingerprint}.webp`, `${prefix}.webp`];
      return candidates.find(key => keys.has(key));
    };
    const smallKey = variant(800), largeKey = variant(1600);
    const origUrl = publicUrl(object.key);
    const small = smallKey ? publicUrl(smallKey) : origUrl;
    const large = largeKey ? publicUrl(largeKey) : origUrl;
    return {
      id: stem, key: object.key, category, series, title,
      label: details.label || rule?.[3] || category,
      location: details.location || rule?.[4] || '',
      story: details.story || rule?.[5] || '',
      alt: details.alt || `${title} — photograph ${stem.match(/\d+$/)?.[0] || ''} by Abodid Sahoo`,
      camera: details.camera || '',
      width: details.width || 0, height: details.height || 0,
      original: origUrl, small, large,
    };
  }).filter(Boolean);
}
