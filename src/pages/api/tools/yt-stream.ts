/**
 * YouTube Stream Proxy API
 *
 * GET /api/tools/yt-stream?url=<stream_url>&title=<filename>&type=<mime>
 *
 * Proxies media streams from googlevideo.com to:
 * 1. Circumvent browser CORS / hotlinking restrictions
 * 2. Force Content-Disposition attachment with sanitized filename
 * 3. Support range headers for audio/video seeking and resilient chunked streaming
 */
export const prerender = false;

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'download';
}

function isValidStreamHost(hostname: string): boolean {
  return (
    hostname.endsWith('.googlevideo.com') ||
    hostname.endsWith('.youtube.com') ||
    hostname === 'googlevideo.com' ||
    hostname === 'youtube.com'
  );
}

const UPSTREAM_CHUNK_SIZE = 512 * 1024;

function parseRequestedRange(value: string | null) {
  if (!value) return { start: 0, end: null as number | null };

  const match = /^bytes=(\d+)-(\d*)$/.exec(value.trim());
  if (!match) return null;

  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : null;
  if (!Number.isSafeInteger(start) || (end !== null && (!Number.isSafeInteger(end) || end < start))) {
    return null;
  }

  return { start, end };
}

function parseContentRange(value: string | null) {
  const match = value?.match(/^bytes\s+(\d+)-(\d+)\/(\d+)$/i);
  if (!match) return null;

  return {
    start: Number(match[1]),
    end: Number(match[2]),
    total: Number(match[3]),
  };
}

export async function GET({ request }: { request: Request }) {
  const reqUrl = new URL(request.url);
  const streamUrl = reqUrl.searchParams.get('url');
  const title = reqUrl.searchParams.get('title') || 'video';
  const ext = reqUrl.searchParams.get('ext') || 'mp4';

  if (!streamUrl) {
    return new Response(JSON.stringify({ error: 'Missing stream URL' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let parsedTarget: URL;
  try {
    parsedTarget = new URL(streamUrl);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid stream URL' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Prevent arbitrary SSRF - only allow YouTube media domains
  if (!isValidStreamHost(parsedTarget.hostname)) {
    return new Response(
      JSON.stringify({ error: 'Forbidden media stream host' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const requestedRangeHeader = request.headers.get('range');
  const requestedRange = parseRequestedRange(requestedRangeHeader);
  if (!requestedRange) {
    return new Response(JSON.stringify({ error: 'Unsupported byte range' }), {
      status: 416,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const baseFetchHeaders: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: 'https://www.youtube.com/',
  };

  const fetchChunk = (start: number, end: number) =>
    fetch(streamUrl, {
      method: 'GET',
      headers: {
        ...baseFetchHeaders,
        Range: `bytes=${start}-${end}`,
      },
      signal: request.signal,
    });

  try {
    // YouTube's adaptive media endpoints return 403 for a normal full-file
    // request (and even for large/open-ended ranges). Fetch conservative finite
    // chunks and expose them to the browser as one continuous response.
    const firstChunkEnd = requestedRange.end === null
      ? requestedRange.start + UPSTREAM_CHUNK_SIZE - 1
      : Math.min(
          requestedRange.end,
          requestedRange.start + UPSTREAM_CHUNK_SIZE - 1
        );
    const upstreamRes = await fetchChunk(requestedRange.start, firstChunkEnd);

    if (upstreamRes.status !== 206) {
      console.warn('[yt-stream] upstream rejected media request', {
        status: upstreamRes.status,
        host: parsedTarget.hostname,
        itag: parsedTarget.searchParams.get('itag'),
        contentType: upstreamRes.headers.get('content-type'),
      });
      return new Response(
        JSON.stringify({
          error: `Upstream error fetching media stream (${upstreamRes.status})`,
        }),
        {
          status: upstreamRes.status,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const firstContentRange = parseContentRange(
      upstreamRes.headers.get('content-range')
    );
    if (!firstContentRange || !upstreamRes.body) {
      return new Response(
        JSON.stringify({ error: 'Media server returned an invalid byte range' }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (requestedRange.start >= firstContentRange.total) {
      return new Response(null, {
        status: 416,
        headers: {
          'Content-Range': `bytes */${firstContentRange.total}`,
          'Accept-Ranges': 'bytes',
        },
      });
    }

    const responseEnd = Math.min(
      requestedRange.end ?? firstContentRange.total - 1,
      firstContentRange.total - 1
    );
    let nextChunkStart = firstContentRange.end + 1;
    let activeReader = upstreamRes.body.getReader();

    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          while (true) {
            const { done, value } = await activeReader.read();
            if (!done) {
              controller.enqueue(value);
              return;
            }

            if (nextChunkStart > responseEnd) {
              controller.close();
              return;
            }

            const chunkEnd = Math.min(
              nextChunkStart + UPSTREAM_CHUNK_SIZE - 1,
              responseEnd
            );
            const nextResponse = await fetchChunk(nextChunkStart, chunkEnd);
            if (nextResponse.status !== 206 || !nextResponse.body) {
              throw new Error(
                `Upstream rejected chunk ${nextChunkStart}-${chunkEnd} (${nextResponse.status})`
              );
            }

            const returnedRange = parseContentRange(
              nextResponse.headers.get('content-range')
            );
            if (
              !returnedRange ||
              returnedRange.start !== nextChunkStart ||
              returnedRange.end > chunkEnd
            ) {
              throw new Error('Upstream returned an unexpected byte range');
            }

            nextChunkStart = returnedRange.end + 1;
            activeReader = nextResponse.body.getReader();
          }
        } catch (error) {
          console.error('[yt-stream] chunked proxy error:', error);
          controller.error(error);
        }
      },
      cancel() {
        void activeReader.cancel();
      },
    });

    const filename = `${sanitizeFilename(title)}.${ext}`;
    const contentType =
      upstreamRes.headers.get('content-type') || 'application/octet-stream';

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', contentType);
    responseHeaders.set(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
    responseHeaders.set('Accept-Ranges', 'bytes');
    responseHeaders.set('Cache-Control', 'private, no-store');
    responseHeaders.set(
      'Content-Length',
      String(responseEnd - requestedRange.start + 1)
    );
    if (requestedRangeHeader) {
      responseHeaders.set(
        'Content-Range',
        `bytes ${requestedRange.start}-${responseEnd}/${firstContentRange.total}`
      );
    }

    return new Response(stream, {
      status: requestedRangeHeader ? 206 : 200,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error('[yt-stream] proxy error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to proxy media stream' }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
