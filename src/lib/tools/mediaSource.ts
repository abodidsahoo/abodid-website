export type SupportedMediaProvider = 'youtube' | 'vimeo';

export interface SupportedMediaSource {
  provider: SupportedMediaProvider;
  sourceUrl: string;
  videoId: string | null;
  playlistId: string | null;
}

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
]);

const VIMEO_HOSTS = new Set([
  'vimeo.com',
  'www.vimeo.com',
  'player.vimeo.com',
]);

function cleanVideoId(value: string | null): string | null {
  return value && /^[a-zA-Z0-9_-]{11}$/.test(value) ? value : null;
}

/**
 * Parse only the media hosts this tool intentionally supports. Returning a
 * validated URL here keeps the yt-dlp endpoints from becoming open proxies.
 */
export function parseSupportedMediaSource(
  input: string
): SupportedMediaSource | null {
  const value = input.trim();
  if (!value || value.length > 2048) return null;

  const rawYouTubeId = cleanVideoId(value);
  if (rawYouTubeId) {
    return {
      provider: 'youtube',
      sourceUrl: `https://www.youtube.com/watch?v=${rawYouTubeId}`,
      videoId: rawYouTubeId,
      playlistId: null,
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) return null;
  if (parsed.username || parsed.password) return null;

  const hostname = parsed.hostname.toLowerCase();
  parsed.protocol = 'https:';
  parsed.hash = '';

  if (YOUTUBE_HOSTS.has(hostname)) {
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    let videoId: string | null = null;

    if (hostname === 'youtu.be') {
      videoId = cleanVideoId(pathParts[0] || null);
    } else if (['embed', 'v', 'shorts', 'live'].includes(pathParts[0] || '')) {
      videoId = cleanVideoId(pathParts[1] || null);
    } else {
      videoId = cleanVideoId(parsed.searchParams.get('v'));
    }

    const playlistId = parsed.searchParams.get('list');
    if (!videoId && !playlistId) return null;

    return {
      provider: 'youtube',
      sourceUrl: parsed.toString(),
      videoId,
      playlistId,
    };
  }

  if (VIMEO_HOSTS.has(hostname)) {
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    const videoId = [...pathParts].reverse().find((part) => /^\d+$/.test(part));
    if (!videoId) return null;

    return {
      provider: 'vimeo',
      sourceUrl: parsed.toString(),
      videoId,
      playlistId: null,
    };
  }

  return null;
}
