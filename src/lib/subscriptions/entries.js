import { isPathExcluded } from '../searchVisibility.js';

export function dateValue(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function excerpt(value, limit = 420) {
  return String(value || '')
    .replace(/%%[\s\S]*?%%/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[.*?\]\(.*?\)|!\[\[.*?\]\]/g, '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/^[#>\s*-]+/gm, '')
    .replace(/[*_`=~]/g, '')
    .replace(/\s+/g, ' ').trim().slice(0, limit);
}

export const terms = (value) => (Array.isArray(value) ? value : [value])
  .flatMap((term) => typeof term === 'string' ? [term] : [term?.name || term?.label || term?.tag?.name])
  .map((term) => String(term || '').trim()).filter(Boolean);

export function safeHttpUrl(value, site = 'https://abodid.com') {
  if (!value) return undefined;
  try {
    const url = new URL(value, site);
    return /^https?:$/.test(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}

// Frontmatter is authoritative even when an older index still marks a note public.
export function isDistributable(metadata = {}) {
  const normalized = Object.fromEntries(Object.entries(metadata).map(([key, value]) => [key.toLowerCase(), value]));
  const falseValue = (value) => value === false || String(value).toLowerCase() === 'false';
  const trueValue = (value) => value === true || String(value).toLowerCase() === 'true';
  return !trueValue(normalized.draft) && !trueValue(normalized.private) && !trueValue(normalized.noindex)
    && !['private', 'draft', 'unpublished', 'archived'].includes(String(normalized.status || '').toLowerCase())
    && !['private', 'unlisted'].includes(String(normalized.visibility || '').toLowerCase())
    && !['published', 'public', 'is_public', 'publish'].some((key) => falseValue(normalized[key]));
}

export function normalizeEntries(entries, { site = 'https://abodid.com', now = new Date() } = {}) {
  const unique = new Map();
  for (const entry of entries) {
    const url = safeHttpUrl(entry.url, site);
    if (!url || !entry.title || !isDistributable(entry)) continue;
    const parsed = new URL(url);
    const siteUrl = new URL(site);
    if ([siteUrl.hostname, `www.${siteUrl.hostname}`].includes(parsed.hostname)) {
      parsed.protocol = siteUrl.protocol;
      parsed.host = siteUrl.host;
    }
    if (isPathExcluded(parsed.pathname)) continue;
    if (parsed.origin === siteUrl.origin) {
      // The existing moodboard viewer has an intentional per-image deep link.
      const photo = parsed.pathname === '/moodboard' && entry.feeds.includes('moodboard') ? parsed.searchParams.get('photo') : null;
      parsed.search = '';
      if (photo) parsed.searchParams.set('photo', photo);
    }
    else for (const key of [...parsed.searchParams.keys()]) {
      if (/^utm_|^(?:fbclid|gclid)$/i.test(key)) parsed.searchParams.delete(key);
    }
    if (!entry.feeds.includes('community')) parsed.hash = '';
    if (parsed.pathname !== '/') parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    const canonical = parsed.href;
    const published = dateValue(entry.published);
    const modified = dateValue(entry.modified);
    if (published && published > now) continue;
    if (dateValue(entry.expires) && dateValue(entry.expires) < now) continue;
    const existing = unique.get(canonical);
    if (existing) {
      existing.feeds = [...new Set([...existing.feeds, ...entry.feeds])];
      continue;
    }
    unique.set(canonical, {
      ...entry, url: canonical, published, modified,
      // The previous Astro RSS generator appended a slash to blog GUIDs.
      // Retain those opaque IDs while exposing the canonical link without it.
      guid: entry.guid || (entry.feeds.includes('blog') ? `${canonical}/` : canonical),
      description: excerpt(entry.description) || excerpt(entry.title),
      categories: [...new Set(terms(entry.categories))],
      author: terms(entry.author).join(', ') || 'Abodid Sahoo',
      image: safeHttpUrl(entry.image, site),
    });
  }
  return [...unique.values()].sort((a, b) =>
    (b.published?.getTime() || 0) - (a.published?.getTime() || 0) || a.url.localeCompare(b.url));
}

export function isObsidianContent(record) {
  return /\b(obsidian|second[- ]brain|pkm|personal knowledge|knowledge management|note[- ]taking|workflow)\b/i
    .test([record.title, ...terms(record.tags), ...terms(record.category)].join(' '));
}
