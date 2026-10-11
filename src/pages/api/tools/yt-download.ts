/**
 * Native yt-dlp download endpoint.
 *
 * Re-extracting at download time avoids expired signed CDN URLs and lets
 * yt-dlp apply current YouTube/Vimeo extractor handling itself.
 */
export const prerender = false;

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { parseSupportedMediaSource } from '../../../lib/tools/mediaSource';

const BINARY_CANDIDATES = [
  resolve(process.cwd(), '.tools/yt-dlp'),
  '/opt/homebrew/bin/yt-dlp',
  'yt-dlp',
  '/usr/local/bin/yt-dlp',
];

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'download';
}

function contentTypeForExtension(ext: string): string {
  const types: Record<string, string> = {
    m4a: 'audio/mp4',
    mp3: 'audio/mpeg',
    mp4: 'video/mp4',
    opus: 'audio/ogg',
    webm: 'video/webm',
  };
  return types[ext] || 'application/octet-stream';
}

async function spawnYtDlp(args: string[]) {
  let lastError: unknown;

  for (const binary of BINARY_CANDIDATES) {
    try {
      const child = spawn(binary, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      await new Promise<void>((resolve, reject) => {
        child.once('spawn', resolve);
        child.once('error', reject);
      });

      return child;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('yt-dlp is not installed');
}

export async function GET({ request }: { request: Request }) {
  const requestUrl = new URL(request.url);
  const referer = request.headers.get('Referer') || '';
  const isLocal = ['localhost', '127.0.0.1'].includes(requestUrl.hostname);
  const isSameOrigin = referer.startsWith(`${requestUrl.origin}/`);

  if (!isLocal && !isSameOrigin) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const sourceUrl = requestUrl.searchParams.get('url') || '';
  const formatId = requestUrl.searchParams.get('formatId') || '';
  const title = (requestUrl.searchParams.get('title') || 'video').slice(
    0,
    180
  );
  const ext = (requestUrl.searchParams.get('ext') || 'mp4').toLowerCase();

  const source = parseSupportedMediaSource(sourceUrl);
  if (!source || !source.videoId) {
    return Response.json(
      { error: 'Invalid YouTube or Vimeo video URL' },
      { status: 400 }
    );
  }

  if (!/^[a-zA-Z0-9_.+-]{1,80}$/.test(formatId)) {
    return Response.json({ error: 'Invalid download format' }, { status: 400 });
  }

  if (!/^[a-z0-9]{2,5}$/.test(ext)) {
    return Response.json({ error: 'Invalid file extension' }, { status: 400 });
  }

  let child: Awaited<ReturnType<typeof spawnYtDlp>>;

  try {
    child = await spawnYtDlp([
      '--quiet',
      '--no-warnings',
      '--no-progress',
      '--no-playlist',
      '--force-ipv4',
      '--format',
      formatId,
      '--output',
      '-',
      '--',
      source.sourceUrl,
    ]);
  } catch (error) {
    console.error('[yt-download] unable to start yt-dlp:', error);
    return Response.json(
      {
        error:
          'The local download engine is unavailable. Install or update yt-dlp and try again.',
      },
      { status: 503 }
    );
  }

  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => {
    stderr = `${stderr}${chunk}`.slice(-8000);
  });
  child.once('close', (code) => {
    if (code !== 0) {
      console.error(`[yt-download] yt-dlp exited with code ${code}: ${stderr}`);
    }
  });

  const stopDownload = () => {
    if (!child.killed) child.kill('SIGTERM');
  };
  request.signal.addEventListener('abort', stopDownload, { once: true });

  const filename = `${sanitizeFilename(title)}.${ext}`;
  const body = Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>;

  return new Response(body, {
    headers: {
      'Content-Type': contentTypeForExtension(ext),
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
