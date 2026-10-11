/**
 * YouTube and Vimeo Video / YouTube Playlist Info API
 *
 * POST /api/tools/yt-info
 * Body: { url: string }
 *
 * Uses yt-dlp for both providers, with YouTube's Innertube API as a fallback.
 */
export const prerender = false;

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import {
  parseSupportedMediaSource,
  type SupportedMediaProvider,
} from '../../../lib/tools/mediaSource';

const execFileAsync = promisify(execFile);

/* ── Types ───────────────────────────────────────────────────────────── */

interface InnertubeClient {
  name: string;
  params: Record<string, unknown>;
  headers: Record<string, string>;
  thirdParty?: { embedUrl: string };
}

interface VideoFormat {
  itag: number;
  formatId: string;
  url: string;
  mimeType: string;
  quality: string;
  qualityLabel: string;
  width?: number;
  height?: number;
  fps?: number;
  bitrate: number;
  contentLength?: string;
  audioQuality?: string;
  audioChannels?: number;
  audioSampleRate?: string;
  hasAudio: boolean;
  hasVideo: boolean;
}

interface VideoInfo {
  id: string;
  provider: SupportedMediaProvider;
  sourceUrl: string;
  title: string;
  author: string;
  duration: number;
  thumbnail: string;
  formats: VideoFormat[];
  isLive: boolean;
  isPlayable: boolean;
  downloadMode?: 'native' | 'proxy';
  error?: string;
}

interface PlaylistVideo {
  id: string;
  title: string;
  duration: number;
  thumbnail: string;
  index: number;
}

interface PlaylistInfo {
  id: string;
  title: string;
  author: string;
  videoCount: number;
  videos: PlaylistVideo[];
}

/* ── Innertube client strategies ─────────────────────────────────────── */

const INNERTUBE_API = 'https://www.youtube.com/youtubei/v1/player';
const INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

const CLIENTS: InnertubeClient[] = [
  {
    name: 'ANDROID_VR',
    params: {
      clientName: 'ANDROID_VR',
      clientVersion: '1.60.19',
      deviceMake: 'Oculus',
      deviceModel: 'Quest 3',
      osName: 'Android',
      osVersion: '12',
      hl: 'en',
      gl: 'US',
    },
    headers: {
      'Content-Type': 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  },
  {
    name: 'WEB_REMIX',
    params: {
      clientName: 'WEB_REMIX',
      clientVersion: '1.20240101.00.00',
      hl: 'en',
      gl: 'US',
    },
    headers: {
      'Content-Type': 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  },
  {
    name: 'WEB_EMBEDDED',
    params: {
      clientName: 'WEB_EMBEDDED_PLAYER',
      clientVersion: '1.20240725.01.00',
      hl: 'en',
      gl: 'US',
    },
    headers: {
      'Content-Type': 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    thirdParty: { embedUrl: 'https://www.google.com' },
  },
];

/* ── yt-dlp Native Extraction Helper ─────────────────────────────────── */

function mapYtDlpFormat(f: Record<string, unknown>): VideoFormat | null {
  const url = f.url as string | undefined;
  if (!url) return null;
  const hasVideo = !!(f.vcodec && f.vcodec !== 'none');
  const hasAudio = !!(f.acodec && f.acodec !== 'none');
  if (!hasVideo && !hasAudio) return null;

  const width = f.width as number | undefined;
  const height = f.height as number | undefined;
  const tbr = f.tbr as number | undefined;
  const vbr = f.vbr as number | undefined;
  const abr = f.abr as number | undefined;
  const fps = f.fps as number | undefined;

  let qualityLabel = (f.format_note as string) || '';
  if (!qualityLabel && height) {
    qualityLabel = `${height}p`;
  } else if (!qualityLabel && abr) {
    qualityLabel = `${Math.round(abr)}kbps`;
  }

  return {
    itag: Number(f.format_id) || 0,
    formatId: String(f.format_id || ''),
    url,
    mimeType: f.ext ? `${hasVideo ? 'video' : 'audio'}/${f.ext}` : '',
    quality: (f.format_note as string) || (height ? `${height}p` : ''),
    qualityLabel,
    width,
    height,
    fps,
    bitrate: tbr ? Math.round(tbr * 1000) : vbr ? Math.round(vbr * 1000) : 0,
    contentLength: f.filesize
      ? String(f.filesize)
      : f.filesize_approx
      ? String(f.filesize_approx)
      : undefined,
    audioQuality: abr ? `${Math.round(abr)}kbps` : undefined,
    hasAudio,
    hasVideo,
  };
}

async function tryYtDlp(
  sourceUrl: string,
  provider: SupportedMediaProvider,
  fallbackId: string
): Promise<VideoInfo | null> {
  const binaryCandidates = [
    resolve(process.cwd(), '.tools/yt-dlp'),
    '/opt/homebrew/bin/yt-dlp',
    'yt-dlp',
    '/usr/local/bin/yt-dlp',
  ];
  for (const bin of binaryCandidates) {
    try {
      const { stdout } = await execFileAsync(
        bin,
        ['-j', '--no-warnings', '--no-playlist', '--', sourceUrl],
        { timeout: 30000, maxBuffer: 8 * 1024 * 1024 }
      );
      const data = JSON.parse(stdout);
      const rawFormats = (data.formats || []) as Record<string, unknown>[];
      const formats = rawFormats
        .map(mapYtDlpFormat)
        .filter(Boolean) as VideoFormat[];

      if (formats.length > 0) {
        return {
          id: (data.id as string) || fallbackId,
          provider,
          sourceUrl,
          title: (data.title as string) || '',
          author:
            (data.uploader as string) ||
            (data.channel as string) ||
            (data.creator as string) ||
            '',
          duration: Number(data.duration) || 0,
          thumbnail: (data.thumbnail as string) || '',
          formats,
          isLive: !!data.is_live,
          isPlayable: true,
          downloadMode: 'native',
        };
      }
    } catch {
      // Continue to next binary candidate or fallback
    }
  }
  return null;
}

/* ── Helpers ──────────────────────────────────────────────────────────── */

function parseFormat(f: Record<string, unknown>): VideoFormat | null {
  const url = f.url as string | undefined;
  if (!url) return null; // Skip cipher-protected formats

  const mimeType = (f.mimeType as string) || '';
  const width = f.width as number | undefined;
  const height = f.height as number | undefined;

  return {
    itag: f.itag as number,
    formatId: String(f.itag || ''),
    url,
    mimeType,
    quality: (f.quality as string) || '',
    qualityLabel: (f.qualityLabel as string) || '',
    width,
    height,
    fps: f.fps as number | undefined,
    bitrate: (f.bitrate as number) || 0,
    contentLength: f.contentLength as string | undefined,
    audioQuality: f.audioQuality as string | undefined,
    audioChannels: f.audioChannels as number | undefined,
    audioSampleRate: f.audioSampleRate as string | undefined,
    hasAudio: !!(f.audioQuality || f.audioChannels),
    hasVideo: !!(width && height),
  };
}

/* ── Innertube fetch ─────────────────────────────────────────────────── */

async function tryClient(
  videoId: string,
  client: InnertubeClient,
  sourceUrl: string
): Promise<VideoInfo> {
  const body: Record<string, unknown> = {
    videoId,
    context: {
      client: { ...client.params },
    },
    contentCheckOk: true,
    racyCheckOk: true,
  };

  if (client.thirdParty) {
    body.context = {
      ...(body.context as Record<string, unknown>),
      thirdParty: client.thirdParty,
    };
  }

  const res = await fetch(`${INNERTUBE_API}?key=${INNERTUBE_KEY}&prettyPrint=false`, {
    method: 'POST',
    headers: client.headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Innertube ${client.name}: HTTP ${res.status}`);

  const data = await res.json();
  const status = data.playabilityStatus;

  if (status?.status !== 'OK') {
    return {
      id: videoId,
      provider: 'youtube',
      sourceUrl,
      title: '',
      author: '',
      duration: 0,
      thumbnail: '',
      formats: [],
      isLive: false,
      isPlayable: false,
      error: status?.reason || status?.messages?.[0] || 'Video is not available.',
    };
  }

  const details = data.videoDetails || {};
  const streaming = data.streamingData || {};
  const raw = [
    ...(streaming.formats || []),
    ...(streaming.adaptiveFormats || []),
  ];

  const formats = raw.map(parseFormat).filter(Boolean) as VideoFormat[];
  const thumbs = details.thumbnail?.thumbnails || [];
  const bestThumb = thumbs[thumbs.length - 1]?.url || '';

  return {
    id: videoId,
    provider: 'youtube',
    sourceUrl,
    title: details.title || '',
    author: details.author || '',
    duration: parseInt(details.lengthSeconds || '0', 10),
    thumbnail: bestThumb,
    formats,
    isLive: !!details.isLiveContent,
    isPlayable: true,
    downloadMode: 'proxy',
  };
}

async function fetchOEmbed(videoId: string) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    if (res.ok) {
      const data = (await res.json()) as Record<string, string>;
      return {
        title: data.title || '',
        author: data.author_name || '',
        thumbnail:
          data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      };
    }
  } catch {}
  return null;
}

async function fetchVideoInfo(
  videoId: string,
  sourceUrl: string
): Promise<VideoInfo> {
  let lastError = '';

  for (const client of CLIENTS) {
    try {
      const info = await tryClient(videoId, client, sourceUrl);

      // If we got formats, enrich title/thumb if needed and return
      if (info.formats.length > 0) {
        if (!info.title || !info.thumbnail) {
          const oembed = await fetchOEmbed(videoId);
          if (oembed) {
            info.title = info.title || oembed.title;
            info.author = info.author || oembed.author;
            info.thumbnail = info.thumbnail || oembed.thumbnail;
          }
        }
        return info;
      }

      if (!info.isPlayable) {
        lastError = info.error || 'Video is not available.';
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  // Fallback to oembed for basic metadata display even if stream is restricted
  const oembed = await fetchOEmbed(videoId);

  return {
    id: videoId,
    provider: 'youtube',
    sourceUrl,
    title: oembed?.title || '',
    author: oembed?.author || '',
    duration: 0,
    thumbnail: oembed?.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    formats: [],
    isLive: false,
    isPlayable: false,
    downloadMode: 'proxy',
    error:
      lastError ||
      'Could not retrieve direct download links for this video. It may be DRM-protected or age-restricted.',
  };
}

/* ── Playlist fetch ──────────────────────────────────────────────────── */

async function fetchPlaylistInfo(playlistId: string): Promise<PlaylistInfo> {
  const res = await fetch(
    `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`,
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        Cookie: 'CONSENT=YES+1',
      },
    }
  );

  const html = await res.text();

  // Extract ytInitialData
  const match = html.match(/var\s+ytInitialData\s*=\s*({.*?});\s*<\/script>/s);
  if (!match) throw new Error('Could not parse playlist page.');

  const data = JSON.parse(match[1]);

  // Navigate to playlist contents
  const tabs =
    data?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
  const tab = tabs[0]?.tabRenderer;
  const sections =
    tab?.content?.sectionListRenderer?.contents || [];
  const items =
    sections[0]?.itemSectionRenderer?.contents?.[0]
      ?.playlistVideoListRenderer?.contents || [];

  const videos: PlaylistVideo[] = items
    .filter((i: Record<string, unknown>) => i.playlistVideoRenderer)
    .map((i: Record<string, unknown>) => {
      const r = i.playlistVideoRenderer as Record<string, unknown>;
      const thumbs = (r.thumbnail as Record<string, unknown>)?.thumbnails as Array<Record<string, string>> | undefined;
      return {
        id: r.videoId as string,
        title:
          ((r.title as Record<string, unknown>)?.runs as Array<Record<string, string>>)?.[0]
            ?.text || '',
        duration: parseInt((r.lengthSeconds as string) || '0', 10),
        thumbnail: thumbs?.[thumbs.length - 1]?.url || '',
        index: parseInt(
          (r.index as Record<string, string>)?.simpleText || '0',
          10
        ),
      };
    });

  const playlistTitle =
    (data?.metadata?.playlistMetadataRenderer?.title as string) || 'Playlist';
  const sidebarItems =
    data?.sidebar?.playlistSidebarRenderer?.items || [];
  const playlistAuthor =
    sidebarItems[1]?.playlistSidebarSecondaryInfoRenderer?.videoOwner
      ?.videoOwnerRenderer?.title?.runs?.[0]?.text || '';

  return {
    id: playlistId,
    title: playlistTitle,
    author: playlistAuthor,
    videoCount: videos.length,
    videos,
  };
}

/* ── Handler ─────────────────────────────────────────────────────────── */

export async function POST({ request }: { request: Request }) {
  // Basic referer check
  const referer = request.headers.get('Referer') || '';
  const host = request.headers.get('Host') || '';
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
  const isSameOrigin =
    referer.includes('abodid.com') || referer.includes(host);
  if (!isLocal && !isSameOrigin) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { url } = (await request.json()) as { url?: string };

    if (!url || typeof url !== 'string') {
      return jsonError('A YouTube or Vimeo URL is required.', 400);
    }

    const source = parseSupportedMediaSource(url);
    if (!source) {
      return jsonError(
        'Invalid URL. Paste a YouTube video or playlist link, or a public Vimeo video link.',
        400
      );
    }

    const { videoId, playlistId } = source;

    // Pure playlist URL (no video ID)
    if (source.provider === 'youtube' && !videoId && playlistId) {
      const playlist = await fetchPlaylistInfo(playlistId);
      return jsonOk({ type: 'playlist', data: playlist });
    }

    // Video URL (may also contain a playlist ID)
    if (videoId) {
      let info = await tryYtDlp(source.sourceUrl, source.provider, videoId);
      if ((!info || info.formats.length === 0) && source.provider === 'youtube') {
        info = await fetchVideoInfo(videoId, source.sourceUrl);
      }

      if (!info || info.formats.length === 0) {
        return jsonError(
          'Could not extract this Vimeo video. Check that the video is public and available, then try again.',
          422
        );
      }
      const payload: Record<string, unknown> = { type: 'video', data: info };

      // Attach playlist data if present
      if (source.provider === 'youtube' && playlistId) {
        try {
          const playlist = await fetchPlaylistInfo(playlistId);
          payload.playlist = playlist;
        } catch {
          // Playlist fetch is best-effort
        }
      }

      return jsonOk(payload);
    }

    return jsonError(
      'Invalid URL. Paste a YouTube video or playlist link, or a public Vimeo video link.',
      400
    );
  } catch (err) {
    console.error('[yt-info]', err);
    return jsonError(
      'Failed to fetch video information. Please try again.',
      500
    );
  }
}

/* ── Response helpers ────────────────────────────────────────────────── */

function jsonOk(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
